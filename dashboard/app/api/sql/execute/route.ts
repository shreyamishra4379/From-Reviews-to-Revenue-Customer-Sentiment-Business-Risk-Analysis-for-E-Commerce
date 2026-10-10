import { NextRequest, NextResponse } from "next/server";
import { spawnSync } from "child_process";
import { join } from "path";

// POST /api/sql/execute
// Body: { sql: string }
// Spawns Python → DuckDB and returns { columns: string[], rows: unknown[][], row_count: number }
// No metric logic in JS — all computation happens in Python.
// Views are registered by src/analytics/validate_sql.py, so the editor and the
// SQL validation script see exactly the same tables.

const PROJECT_ROOT = join(process.cwd(), "..");
const MAX_ROWS = 500;

const RUNNER = `
import sys, json
from decimal import Decimal
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.path.insert(0, sys.argv[1])
from src.analytics.validate_sql import connect_sandboxed

sql = sys.stdin.read()
max_rows = int(sys.argv[2])
try:
    conn = connect_sandboxed()
    cur = conn.execute(sql)
    columns = [d[0] for d in cur.description]
    rows = cur.fetchmany(max_rows + 1)
    conn.close()
    truncated = len(rows) > max_rows
    # NaN is not valid JSON
    rows = [[None if isinstance(v, float) and v != v else v for v in r] for r in rows[:max_rows]]
    print(json.dumps({"columns": columns, "rows": rows, "row_count": len(rows),
                      "truncated": truncated},
                     default=lambda v: float(v) if isinstance(v, Decimal) else str(v)))
except Exception as e:
    print(json.dumps({"error": str(e)}))
`;

// Read-only analytics editor: one SELECT/WITH statement, no file or settings access.
// DuckDB itself is also locked to data/processed/ (see connect_sandboxed).
const BLOCKED = [
  "COPY", "EXPORT", "IMPORT", "ATTACH", "DETACH", "INSTALL", "LOAD", "PRAGMA",
  "SET", "RESET", "CALL", "CREATE", "DROP", "DELETE", "INSERT", "UPDATE",
  "ALTER", "TRUNCATE", "CHECKPOINT", "VACUUM",
];

function validate(sql: string): string | null {
  const body = sql.replace(/--.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "").trim().replace(/;\s*$/, "");
  if (!/^(SELECT|WITH)\b/i.test(body)) return "Only SELECT / WITH queries are allowed.";
  if (body.includes(";")) return "Only a single statement is allowed.";
  const upper = body.toUpperCase();
  for (const kw of BLOCKED) {
    if (new RegExp(`\\b${kw}\\b`).test(upper)) return `Statement contains blocked keyword: ${kw}`;
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { sql?: string };
    const sql = body?.sql?.trim();
    if (!sql) {
      return NextResponse.json({ error: "No SQL provided" }, { status: 400 });
    }
    const invalid = validate(sql);
    if (invalid) {
      return NextResponse.json({ error: invalid }, { status: 400 });
    }

    const result = spawnSync("python", ["-c", RUNNER, PROJECT_ROOT, String(MAX_ROWS)], {
      input: sql,
      encoding: "utf-8",
      maxBuffer: 20 * 1024 * 1024,   // 20 MB
      timeout: 30_000,                // 30s
    });

    if (result.error) {
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }
    if (result.status !== 0) {
      const errMsg = result.stderr || result.stdout || "Python exited non-zero";
      return NextResponse.json({ error: errMsg.slice(0, 2000) }, { status: 500 });
    }

    const stdout = (result.stdout ?? "").trim();
    if (!stdout) {
      return NextResponse.json({ error: "Empty response from Python" }, { status: 500 });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(stdout);
    } catch {
      return NextResponse.json({ error: `Invalid JSON from Python:\n${stdout.slice(0, 500)}` }, { status: 500 });
    }

    const r = parsed as { error?: string };
    if (r.error) {
      return NextResponse.json({ error: r.error }, { status: 400 });
    }

    return NextResponse.json(parsed);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
