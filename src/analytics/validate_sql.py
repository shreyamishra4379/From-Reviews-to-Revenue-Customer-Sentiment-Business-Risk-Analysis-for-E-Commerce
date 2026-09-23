import duckdb
import os
import glob

def setup_duckdb():
    print("Setting up DuckDB and views...")
    conn = duckdb.connect(database=':memory:')
    
    # Create views over the parquet files
    parquet_dir = 'data/processed'
    conn.execute(f"CREATE VIEW nlp_reviews AS SELECT * FROM read_parquet('{parquet_dir}/nlp_reviews.parquet')")
    conn.execute(f"CREATE VIEW fact_orders AS SELECT * FROM read_parquet('{parquet_dir}/fact_orders.parquet')")
    conn.execute(f"CREATE VIEW fact_order_items AS SELECT * FROM read_parquet('{parquet_dir}/fact_order_items.parquet')")
    conn.execute(f"CREATE VIEW dim_products AS SELECT * FROM read_parquet('{parquet_dir}/dim_products.parquet')")
    conn.execute(f"CREATE VIEW dim_customers AS SELECT * FROM read_parquet('{parquet_dir}/dim_customers.parquet')")
    conn.execute(f"CREATE VIEW dim_sellers AS SELECT * FROM read_parquet('{parquet_dir}/dim_sellers.parquet')")
    
    return conn

def main():
    conn = setup_duckdb()
    
    sql_files = sorted(glob.glob('sql/*.sql'))
    if not sql_files:
        print("No SQL files found in sql/ directory.")
        return
        
    for file in sql_files:
        print(f"\n--- Executing {file} ---")
        with open(file, 'r', encoding='utf-8') as f:
            query = f.read()
            
        try:
            # Execute query and print first 5 rows
            result = conn.execute(query).df()
            print(result.head(5).to_string())
            print(f"Total rows returned: {len(result)}")
        except Exception as e:
            print(f"ERROR executing {file}: {e}")

if __name__ == "__main__":
    main()
