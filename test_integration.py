"""
Full integration test -- verifies all data loads and all SQL queries work.
Run from the project root: python test_integration.py
"""
import sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
import sys, json, glob
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data" / "processed"
SQL_DIR = ROOT / "sql"
S4   = DATA / "stage4"

errors = []

# ── Test 1: JSON/CSV data loads ───────────────────────────────────────────────
print("=" * 60)
print("TEST 1: Data file loading")
print("=" * 60)

import pandas as pd, numpy as np

tests = [
    (DATA / "nlp_summary_metrics.json",  "json"),
    (DATA / "nlp_topics.json",           "json"),
    (S4   / "stage4_metrics.json",       "json"),
    (S4   / "agg_category.csv",          "csv"),
    (S4   / "agg_seller.csv",            "csv"),
    (S4   / "agg_state.csv",             "csv"),
    (S4   / "agg_monthly.csv",           "csv"),
    (S4   / "agg_quarterly.csv",         "csv"),
    (S4   / "business_prioritization.csv","csv"),
    (S4   / "complaint_matrix.csv",      "csv"),
    (DATA / "fact_order_reviews.parquet","parquet"),
    (DATA / "nlp_reviews.parquet",       "parquet"),
    (DATA / "fact_orders.parquet",       "parquet"),
    (DATA / "fact_order_items.parquet",  "parquet"),
    (DATA / "dim_products.parquet",      "parquet"),
    (DATA / "dim_customers.parquet",     "parquet"),
    (DATA / "dim_sellers.parquet",       "parquet"),
    (DATA / "dim_payments.parquet",      "parquet"),
]

for path, kind in tests:
    try:
        if kind == "json":
            json.loads(path.read_text(encoding="utf-8"))
        elif kind == "csv":
            pd.read_csv(path)
        elif kind == "parquet":
            pd.read_parquet(path)
        print(f"  OK  {path.name}")
    except Exception as e:
        print(f"  FAIL {path.name}: {e}")
        errors.append(f"Data load failed: {path.name} - {e}")

# ── Test 2: SQL queries via DuckDB ───────────────────────────────────────────
print()
print("=" * 60)
print("TEST 2: SQL query execution")
print("=" * 60)

import duckdb

conn = duckdb.connect(":memory:")
PARQUET_TABLES = {
    "nlp_reviews":        DATA / "nlp_reviews.parquet",
    "fact_orders":        DATA / "fact_orders.parquet",
    "fact_order_items":   DATA / "fact_order_items.parquet",
    "fact_order_reviews": DATA / "fact_order_reviews.parquet",
    "dim_products":       DATA / "dim_products.parquet",
    "dim_customers":      DATA / "dim_customers.parquet",
    "dim_sellers":        DATA / "dim_sellers.parquet",
    "dim_payments":       DATA / "dim_payments.parquet",
}
for tbl, path in PARQUET_TABLES.items():
    conn.execute(f"CREATE VIEW {tbl} AS SELECT * FROM read_parquet('{path.as_posix()}')")

for sql_file in sorted(SQL_DIR.glob("*.sql")):
    query = sql_file.read_text(encoding="utf-8").strip()
    try:
        result = conn.execute(query).df()
        print(f"  OK  {sql_file.name} -> {len(result)} rows, cols: {list(result.columns)}")
    except Exception as e:
        print(f"  FAIL {sql_file.name}: {e}")
        errors.append(f"SQL failed: {sql_file.name} - {e}")

conn.close()

# ── Summary ───────────────────────────────────────────────────────────────────
print()
print("=" * 60)
if errors:
    print(f"FAILED - {len(errors)} error(s):")
    for e in errors:
        print(f"  - {e}")
    sys.exit(1)
else:
    print("ALL TESTS PASSED")
    print("The project is ready. Run:  python -m streamlit run app.py")
