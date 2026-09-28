"""
verify_star_schema.py - Comprehensive verification of the star schema output.
Produces exact counts for the Stage 1 Walkthrough artifact.
"""
import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__))))

import pandas as pd
from config.settings import DATA_RAW, DATA_PROC, STAR_FILES, RAW_FILES

sys.stdout.reconfigure(encoding='utf-8')

print("=" * 80)
print("STAGE 1 VERIFICATION REPORT")
print("=" * 80)

# ── 1. Raw file inventory ────────────────────────────────────────────────
print("\n--- RAW FILES IN data/raw/ ---")
for key, fname in RAW_FILES.items():
    fpath = DATA_RAW / fname
    df = pd.read_csv(fpath)
    rows, cols = df.shape
    print(f"  {fname:50s}  {rows:>10,} rows x {cols} cols")

# ── 2. Star schema file inventory ────────────────────────────────────────
print("\n--- STAR SCHEMA FILES IN data/processed/ ---")
star_tables = {}
for key, fname in STAR_FILES.items():
    fpath = DATA_PROC / fname
    df = pd.read_parquet(fpath)
    star_tables[key] = df
    size_mb = fpath.stat().st_size / 1024 / 1024
    print(f"  {fname:35s}  {len(df):>10,} rows x {df.shape[1]:2} cols  ({size_mb:.2f} MB)")

# ── 3. Per-table column-level missingness ────────────────────────────────
print("\n--- COLUMN-LEVEL MISSINGNESS IN STAR SCHEMA ---")
for key, df in star_tables.items():
    missing = df.isnull().sum()
    missing = missing[missing > 0]
    if missing.empty:
        print(f"  [{key}] No missing values")
    else:
        print(f"  [{key}]")
        for col, cnt in missing.items():
            pct = cnt / len(df) * 100
            print(f"    {col:40s}  {cnt:>8,} ({pct:5.2f}%)")

# ── 4. NLP gating metric ────────────────────────────────────────────────
reviews = star_tables["fact_order_reviews"]
total = len(reviews)
non_null_msg = reviews["review_comment_message"].notna().sum()
non_null_title = reviews["review_comment_title"].notna().sum()
print(f"\n--- NLP GATING METRIC ---")
print(f"  Total reviews:                     {total:>10,}")
print(f"  review_comment_message non-null:    {non_null_msg:>10,}  ({non_null_msg/total*100:.2f}%)")
print(f"  review_comment_title non-null:      {non_null_title:>10,}  ({non_null_title/total*100:.2f}%)")

# ── 5. FK integrity checks on star schema ────────────────────────────────
print("\n--- FK INTEGRITY CHECKS (STAR SCHEMA) ---")

items = star_tables["fact_order_items"]
orders = star_tables["fact_orders"]
products = star_tables["dim_products"]
sellers = star_tables["dim_sellers"]
payments = star_tables["dim_payments"]
customers = star_tables["dim_customers"]

checks = [
    ("fact_order_items.order_id -> fact_orders.order_id",
     items[~items["order_id"].isin(orders["order_id"])]),
    ("fact_order_items.product_id -> dim_products.product_id",
     items[~items["product_id"].isin(products["product_id"])]),
    ("fact_order_items.seller_id -> dim_sellers.seller_id",
     items[~items["seller_id"].isin(sellers["seller_id"])]),
    ("fact_order_reviews.order_id -> fact_orders.order_id",
     reviews[~reviews["order_id"].isin(orders["order_id"])]),
    ("fact_orders.customer_id -> dim_customers.customer_id",
     orders[~orders["customer_id"].isin(customers["customer_id"])]),
    ("dim_payments.order_id -> fact_orders.order_id",
     payments[~payments["order_id"].isin(orders["order_id"])]),
]
for desc, broken in checks:
    status = "OK" if len(broken) == 0 else f"BROKEN ({len(broken):,})"
    print(f"  {desc:55s} {status}")

# ── 6. Order status distribution ────────────────────────────────────────
print("\n--- ORDER STATUS DISTRIBUTION ---")
for status, cnt in orders["order_status"].value_counts().items():
    pct = cnt / len(orders) * 100
    print(f"  {status:20s}  {cnt:>8,}  ({pct:5.2f}%)")

# ── 7. Review score distribution ────────────────────────────────────────
print("\n--- REVIEW SCORE DISTRIBUTION ---")
for score in range(1, 6):
    cnt = (reviews["review_score"] == score).sum()
    pct = cnt / len(reviews) * 100
    print(f"  Score {score}:  {cnt:>8,}  ({pct:5.2f}%)")

# ── 8. Payment type distribution ────────────────────────────────────────
print("\n--- PAYMENT TYPE DISTRIBUTION (primary_payment_type) ---")
for ptype, cnt in payments["primary_payment_type"].value_counts().items():
    pct = cnt / len(payments) * 100
    print(f"  {ptype:20s}  {cnt:>8,}  ({pct:5.2f}%)")

# ── 9. Product category coverage ────────────────────────────────────────
cats = products["product_category_name_english"].value_counts()
print(f"\n--- PRODUCT CATEGORIES ---")
print(f"  Total unique English categories: {cats.shape[0]}")
print(f"  Products tagged 'unknown': {(products['product_category_name_english'] == 'unknown').sum()}")
print(f"  Top 10 categories by product count:")
for cat, cnt in cats.head(10).items():
    print(f"    {cat:40s}  {cnt:>6,}")

# ── 10. Geolocation coverage ────────────────────────────────────────────
geo = star_tables["dim_geolocation"]
print(f"\n--- GEOLOCATION ---")
print(f"  Unique zip prefixes: {len(geo):,}")
print(f"  Unique states: {geo['state'].nunique()}")

# ── 11. dim_payments sanity ──────────────────────────────────────────────
print(f"\n--- DIM_PAYMENTS SANITY ---")
print(f"  Rows: {len(payments):,}")
print(f"  Orders in fact_orders but missing from dim_payments: "
      f"{orders[~orders['order_id'].isin(payments['order_id'])].shape[0]}")
print(f"  Mean total_payment_value: R$ {payments['total_payment_value'].mean():.2f}")
print(f"  Median total_payment_value: R$ {payments['total_payment_value'].median():.2f}")

print("\n" + "=" * 80)
print("VERIFICATION COMPLETE")
print("=" * 80)
