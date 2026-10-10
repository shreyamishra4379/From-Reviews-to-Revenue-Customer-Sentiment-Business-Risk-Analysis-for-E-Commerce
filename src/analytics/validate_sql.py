"""
validate_sql.py — Run every query in sql/ against the processed tables with DuckDB.

Exits non-zero if any query fails or returns no rows, so it can be used as a check.

Usage:
    python src/analytics/validate_sql.py
"""
import glob
import json
import os
import sys

import duckdb

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DATA_DIR = os.path.join(ROOT, "data", "processed")
SQL_DIR = os.path.join(ROOT, "sql")

with open(os.path.join(SQL_DIR, "views.json"), encoding="utf-8") as _f:
    _VIEWS = json.load(_f)
PARQUET_VIEWS = _VIEWS["parquet"]
CSV_VIEWS = _VIEWS["csv"]


def connect(data_dir: str = DATA_DIR) -> duckdb.DuckDBPyConnection:
    """In-memory DuckDB connection with one view per processed table."""
    conn = duckdb.connect(database=":memory:")
    for view, fname in PARQUET_VIEWS.items():
        path = os.path.join(data_dir, fname).replace("\\", "/")
        if os.path.exists(path):
            conn.execute(f"CREATE VIEW {view} AS SELECT * FROM read_parquet('{path}')")
    for view, fname in CSV_VIEWS.items():
        path = os.path.join(data_dir, fname).replace("\\", "/")
        if os.path.exists(path):
            conn.execute(f"CREATE VIEW {view} AS SELECT * FROM read_csv_auto('{path}', header=true)")
    return conn


def connect_sandboxed(data_dir: str = DATA_DIR) -> duckdb.DuckDBPyConnection:
    """Like connect(), but user SQL can only touch files in data/processed/ and cannot
    change that setting. Used by the dashboard's SQL editor."""
    conn = connect(data_dir)
    allowed = data_dir.replace("\\", "/").rstrip("/") + "/"
    conn.execute(f"SET allowed_directories = ['{allowed}']")
    conn.execute("SET enable_external_access = false")
    conn.execute("SET lock_configuration = true")
    return conn


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    conn = connect()
    sql_files = sorted(glob.glob(os.path.join(SQL_DIR, "*.sql")))
    if not sql_files:
        print("No SQL files found in sql/ directory.")
        return 1

    failures = []
    for file in sql_files:
        name = os.path.basename(file)
        print(f"\n--- Executing {name} ---")
        with open(file, "r", encoding="utf-8") as f:
            query = f.read()
        try:
            result = conn.execute(query).df()
        except Exception as e:
            print(f"ERROR executing {name}: {e}")
            failures.append(name)
            continue
        print(result.head(5).to_string())
        print(f"Total rows returned: {len(result)}")
        if result.empty:
            failures.append(name)

    print(f"\n{len(sql_files) - len(failures)}/{len(sql_files)} queries executed and returned rows.")
    if failures:
        print("Failed:", ", ".join(failures))
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
