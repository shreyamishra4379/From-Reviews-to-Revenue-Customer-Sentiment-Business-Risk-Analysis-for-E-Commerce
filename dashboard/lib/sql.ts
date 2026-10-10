import { spawnSync } from "child_process";
import { join } from "path";

// Read-only SQL over data/processed/ via Python + DuckDB.
// Views are registered by src/analytics/validate_sql.py, so the SQL page, the AI
// assistant and the SQL validation script all see exactly the same tables.

const PROJECT_ROOT = join(process.cwd(), "..");

export interface SqlResult {
  columns: string[];
  rows: unknown[][];
  row_count: number;
  truncated: boolean;
}

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

// One SELECT/WITH statement, no file or settings access.
// DuckDB itself is also locked to data/processed/ (see connect_sandboxed).
const BLOCKED = [
  "COPY", "EXPORT", "IMPORT", "ATTACH", "DETACH", "INSTALL", "LOAD", "PRAGMA",
  "SET", "RESET", "CALL", "CREATE", "DROP", "DELETE", "INSERT", "UPDATE",
  "ALTER", "TRUNCATE", "CHECKPOINT", "VACUUM",
];

export function validateSql(sql: string): string | null {
  const body = sql.replace(/--.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "").trim().replace(/;\s*$/, "");
  if (!/^(SELECT|WITH|DESCRIBE)\b/i.test(body)) return "Only SELECT / WITH queries are allowed.";
  if (body.includes(";")) return "Only a single statement is allowed.";
  const upper = body.toUpperCase();
  for (const kw of BLOCKED) {
    if (new RegExp(`\\b${kw}\\b`).test(upper)) return `Statement contains blocked keyword: ${kw}`;
  }
  return null;
}

/** Runs one read-only query. Throws Error with a readable message on failure. */
export function runSql(sql: string, maxRows = 500): SqlResult {
  const invalid = validateSql(sql);
  if (invalid) throw new Error(invalid);

  const result = spawnSync("python", ["-c", RUNNER, PROJECT_ROOT, String(maxRows)], {
    input: sql,
    encoding: "utf-8",
    maxBuffer: 20 * 1024 * 1024,   // 20 MB
    timeout: 30_000,                // 30s
  });
  if (result.error) throw new Error(result.error.message);
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || "Python exited non-zero").slice(0, 2000));
  }
  const stdout = (result.stdout ?? "").trim();
  if (!stdout) throw new Error("Empty response from Python");

  let parsed: SqlResult & { error?: string };
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new Error(`Invalid JSON from Python:\n${stdout.slice(0, 500)}`);
  }
  if (parsed.error) throw new Error(parsed.error);
  return parsed;
}
