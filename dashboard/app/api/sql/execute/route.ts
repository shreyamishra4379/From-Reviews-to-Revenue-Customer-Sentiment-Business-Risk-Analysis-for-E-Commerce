import { NextRequest, NextResponse } from "next/server";
import { runSql, validateSql } from "@/lib/sql";
import { guardRequest } from "@/lib/security/guard";
import { logSecurityEvent } from "@/lib/security/audit";

// POST /api/sql/execute
// Body: { sql: string }
// Returns { columns: string[], rows: unknown[][], row_count: number, truncated: boolean }
// No metric logic in JS — all computation happens in DuckDB (see lib/sql.ts).
// Defence in depth: rate limit + size limit, a read-only statement validator, and a
// DuckDB sandbox that cannot read files outside data/processed/. Refusals are logged.

const ROUTE = "/api/sql/execute";
const MAX_SQL_CHARS = 5_000;

export async function POST(req: NextRequest) {
  const { blocked, client } = guardRequest(req, ROUTE);
  if (blocked) return blocked;

  let sql: string | undefined;
  try {
    const body = await req.json() as { sql?: unknown };
    sql = typeof body?.sql === "string" ? body.sql.trim() : undefined;
  } catch {
    return NextResponse.json({ error: "The request body must be JSON: { \"sql\": \"SELECT ...\" }" }, { status: 400 });
  }
  if (!sql) return NextResponse.json({ error: "No SQL provided" }, { status: 400 });
  if (sql.length > MAX_SQL_CHARS) {
    logSecurityEvent("request_too_large", ROUTE, client, `SQL of ${sql.length} characters`);
    return NextResponse.json({ error: `Queries are limited to ${MAX_SQL_CHARS} characters.` }, { status: 413 });
  }

  const invalid = validateSql(sql);
  if (invalid) {
    logSecurityEvent("sql_blocked", ROUTE, client, `${invalid} Query: ${sql.slice(0, 160)}`);
    return NextResponse.json({ error: invalid }, { status: 400 });
  }

  try {
    return NextResponse.json(await runSql(sql, 500));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/permission|external access|disabled by configuration|lock_configuration|cannot change/i.test(message)) {
      logSecurityEvent("sql_sandbox_denied", ROUTE, client, `${publicError(message.split("\n")[0])} Query: ${sql.slice(0, 160)}`);
      return NextResponse.json(
        { error: "Access denied: queries can only read the project's processed tables, not other files or settings." },
        { status: 403 },
      );
    }
    return NextResponse.json({ error: publicError(message) }, { status: 400 });
  }
}

/** Error text without server file paths (they reveal how the machine is laid out). */
function publicError(message: string): string {
  return message
    .replace(/[A-Za-z]:[\\/][^\s"'`]*/g, "<path>")            // Windows paths
    .replace(/(?<![\w.])\/(?:[\w.-]+\/)+[\w.-]*/g, "<path>");  // Unix paths
}
