import { NextRequest, NextResponse } from "next/server";
import { runSql, validateSql } from "@/lib/sql";

// POST /api/sql/execute
// Body: { sql: string }
// Returns { columns: string[], rows: unknown[][], row_count: number, truncated: boolean }
// No metric logic in JS — all computation happens in DuckDB (see lib/sql.ts).

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { sql?: string };
    const sql = body?.sql?.trim();
    if (!sql) {
      return NextResponse.json({ error: "No SQL provided" }, { status: 400 });
    }
    const invalid = validateSql(sql);
    if (invalid) {
      return NextResponse.json({ error: invalid }, { status: 400 });
    }
    return NextResponse.json(await runSql(sql, 500));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }
}
