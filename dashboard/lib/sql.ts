import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { DuckDBInstance, type DuckDBConnection } from "@duckdb/node-api";

// Read-only SQL over data/processed/, running DuckDB inside the Next.js server.
// The table list comes from sql/views.json, which src/analytics/validate_sql.py also
// reads, so the SQL page, the AI assistant and the validation script see the same tables.

const PROJECT_ROOT = join(process.cwd(), "..");
const DATA_DIR = join(PROJECT_ROOT, "data", "processed").replace(/\\/g, "/");
const QUERY_TIMEOUT_MS = 30_000;

export interface SqlResult {
  columns: string[];
  rows: unknown[][];
  row_count: number;
  truncated: boolean;
}

// One SELECT/WITH statement, no file or settings access.
// DuckDB itself is also locked to data/processed/ (see openInstance).
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

async function openInstance(): Promise<DuckDBInstance> {
  const views = JSON.parse(readFileSync(join(PROJECT_ROOT, "sql", "views.json"), "utf-8")) as {
    parquet: Record<string, string>;
    csv: Record<string, string>;
  };
  const instance = await DuckDBInstance.create(":memory:");
  const conn = await instance.connect();
  try {
    for (const [view, file] of Object.entries(views.parquet)) {
      const path = `${DATA_DIR}/${file}`;
      if (existsSync(path)) await conn.run(`CREATE VIEW ${view} AS SELECT * FROM read_parquet('${path}')`);
    }
    for (const [view, file] of Object.entries(views.csv)) {
      const path = `${DATA_DIR}/${file}`;
      if (existsSync(path)) await conn.run(`CREATE VIEW ${view} AS SELECT * FROM read_csv_auto('${path}', header=true)`);
    }
    // From here on, queries can only read files in data/processed/ and cannot change that.
    await conn.run(`SET allowed_directories = ['${DATA_DIR}/']`);
    await conn.run("SET enable_external_access = false");
    await conn.run("SET lock_configuration = true");
  } finally {
    conn.closeSync();
  }
  return instance;
}

// One shared instance per server process (kept on globalThis so dev hot-reloads reuse it).
const g = globalThis as unknown as { __duckdb?: Promise<DuckDBInstance> };
function instance(): Promise<DuckDBInstance> {
  if (!g.__duckdb) {
    g.__duckdb = openInstance().catch(e => {
      g.__duckdb = undefined;
      throw e;
    });
  }
  return g.__duckdb;
}

// JSON-safe cell values: BIGINT -> number, NaN -> null, dates -> "YYYY-MM-DD hh:mm:ss".
function toJsonCell(js: unknown, json: unknown): unknown {
  if (typeof js === "bigint") return Number(js);
  if (typeof js === "number") return Number.isFinite(js) ? js : null;
  if (js instanceof Date) return json;
  if (Array.isArray(js)) return js.map((v, i) => toJsonCell(v, Array.isArray(json) ? json[i] : v));
  return js;
}

/** Runs one read-only query. Throws Error with a readable message on failure. */
export async function runSql(sql: string, maxRows = 500): Promise<SqlResult> {
  const invalid = validateSql(sql);
  if (invalid) throw new Error(invalid);

  const conn: DuckDBConnection = await (await instance()).connect();
  const timer = setTimeout(() => conn.interrupt(), QUERY_TIMEOUT_MS);
  try {
    const reader = await conn.streamAndReadUntil(sql, maxRows + 1);
    const js = reader.getRowsJS();
    const json = reader.getRowsJson();
    const truncated = js.length > maxRows || !reader.done;
    const rows = js.slice(0, maxRows).map((r, i) => r.map((v, j) => toJsonCell(v, json[i][j])));
    return { columns: reader.columnNames(), rows, row_count: rows.length, truncated };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(/interrupt/i.test(msg) ? `Query timed out after ${QUERY_TIMEOUT_MS / 1000}s` : msg);
  } finally {
    clearTimeout(timer);
    conn.closeSync();
  }
}
