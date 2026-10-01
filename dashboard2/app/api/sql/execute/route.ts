import { NextRequest, NextResponse } from "next/server";
import { spawnSync } from "child_process";
import { join } from "path";

// POST /api/sql/execute
// Body: { sql: string }
// Spawns Python → DuckDB and returns { columns: string[], rows: unknown[][], row_count: number }
// No metric logic in JS — all computation happens in Python.

const DATA_DIR = join(process.cwd(), "..", "data", "processed");

const RUNNER = `
import sys, json, traceback
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import duckdb
from pathlib import Path

DATA = Path(r"${DATA_DIR.replace(/\\/g, "\\\\")}") 

sql = sys.stdin.read()

TABLES = {
    "nlp_reviews":        "nlp_reviews.parquet",
    "fact_orders":        "fact_orders.parquet",
    "fact_order_items":   "fact_order_items.parquet",
    "fact_order_reviews": "fact_order_reviews.parquet",
    "dim_products":       "dim_products.parquet",
    "dim_customers":      "dim_customers.parquet",
    "dim_sellers":        "dim_sellers.parquet",
    "dim_payments":       "dim_payments.parquet",
}

try:
    conn = duckdb.connect(":memory:")
    for tbl, fname in TABLES.items():
        p = DATA / fname
        if p.exists():
            conn.execute(f"CREATE VIEW {tbl} AS SELECT * FROM read_parquet('{p.as_posix()}')")

    df = conn.execute(sql).df()
    conn.close()

    # Limit to 500 rows for web response
    truncated = len(df) > 500
    df = df.head(500)

    # Convert to JSON-safe types
    import numpy as np
    for col in df.columns:
        if df[col].dtype == object:
            df[col] = df[col].astype(str)

    result = {
        "columns": list(df.columns),
        "rows": df.values.tolist(),
        "row_count": len(df) + (1 if truncated else 0),  # approximate when truncated
        "truncated": truncated,
    }
    print(json.dumps(result, default=str))
except Exception as e:
    print(json.dumps({"error": str(e), "traceback": traceback.format_exc()}))
`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { sql?: string };
    const sql = body?.sql?.trim();
    if (!sql) {
      return NextResponse.json({ error: "No SQL provided" }, { status: 400 });
    }

    // Basic safety: no data-mutation statements
    const upper = sql.toUpperCase().replace(/\s+/g, " ");
    const BLOCKED = ["DROP ", "DELETE ", "INSERT ", "UPDATE ", "CREATE TABLE", "ALTER ", "TRUNCATE "];
    for (const kw of BLOCKED) {
      if (upper.includes(kw)) {
        return NextResponse.json(
          { error: `Statement contains blocked keyword: ${kw.trim()}` },
          { status: 400 }
        );
      }
    }

    const result = spawnSync("python", ["-c", RUNNER], {
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
