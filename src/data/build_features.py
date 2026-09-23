"""
build_features.py — Stage 2 Part B: Feature Engineering
========================================================
Builds an order-level feature table from the star-schema parquets
produced by Stage 1 (data/processed/).

Grain: order_id (one row per order).
Output: data/processed/features_orders.parquet

Usage:
    python src/data/build_features.py
"""
import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
sys.stdout.reconfigure(encoding='utf-8')

import pandas as pd
import numpy as np
from pathlib import Path
from config.settings import DATA_PROC

# ═══════════════════════════════════════════════════════════════════════════
#  Load star-schema tables
# ═══════════════════════════════════════════════════════════════════════════

def load(name: str) -> pd.DataFrame:
    return pd.read_parquet(DATA_PROC / name)

print("=" * 80)
print("STAGE 2 — FEATURE ENGINEERING")
print("=" * 80)

fact_orders   = load("fact_orders.parquet")
fact_items    = load("fact_order_items.parquet")
fact_reviews  = load("fact_order_reviews.parquet")
dim_customers = load("dim_customers.parquet")
dim_products  = load("dim_products.parquet")
dim_sellers   = load("dim_sellers.parquet")
dim_payments  = load("dim_payments.parquet")

print(f"Loaded tables. fact_orders: {len(fact_orders):,} rows")

# ═══════════════════════════════════════════════════════════════════════════
#  Start with fact_orders as the base (order_id grain)
# ═══════════════════════════════════════════════════════════════════════════

features = fact_orders[["order_id", "customer_id", "order_status",
                         "order_purchase_timestamp",
                         "order_delivered_customer_date",
                         "order_estimated_delivery_date"]].copy()

# ── 1. delivery_delay_days ──────────────────────────────────────────────
# Formula: (order_delivered_customer_date - order_estimated_delivery_date) in days
# Negative = early, positive = late. Null for undelivered orders.
features["delivery_delay_days"] = (
    (features["order_delivered_customer_date"] -
     features["order_estimated_delivery_date"])
    .dt.total_seconds() / 86400.0
)

# ── 2. Item-level aggregations ──────────────────────────────────────────
# order_total_value = sum(price) + sum(freight_value) per order
# freight_ratio = sum(freight_value) / sum(price) per order
# items_per_order = count of items per order
# distinct_sellers_per_order = nunique(seller_id) per order

items_agg = (
    fact_items.groupby("order_id")
    .agg(
        total_price=("price", "sum"),
        total_freight=("freight_value", "sum"),
        items_per_order=("order_item_id", "count"),
        distinct_sellers_per_order=("seller_id", "nunique"),
    )
    .reset_index()
)
items_agg["order_total_value"] = items_agg["total_price"] + items_agg["total_freight"]
items_agg["freight_ratio"] = np.where(
    items_agg["total_price"] > 0,
    items_agg["total_freight"] / items_agg["total_price"],
    np.nan
)

features = features.merge(
    items_agg[["order_id", "order_total_value", "freight_ratio",
               "items_per_order", "distinct_sellers_per_order"]],
    on="order_id", how="left"
)

# ── 3. Payment features ────────────────────────────────────────────────
# payment_installments = payment_installments_max from dim_payments
# payment_type = primary_payment_type from dim_payments
features = features.merge(
    dim_payments[["order_id", "payment_installments_max", "primary_payment_type"]],
    on="order_id", how="left"
)
features = features.rename(columns={
    "payment_installments_max": "payment_installments",
    "primary_payment_type": "payment_type",
})

# ── 4. Review features ─────────────────────────────────────────────────
# review_score: mean score if order has multiple reviews (very rare)
# has_review_text: True if ANY review for the order has non-null review_comment_message
review_agg = (
    fact_reviews.groupby("order_id")
    .agg(
        review_score=("review_score", "mean"),
        has_review_text=("review_comment_message", lambda x: x.notna().any()),
    )
    .reset_index()
)
# Round review_score to original integer if only 1 review per order
# (which is the vast majority)
review_count = fact_reviews.groupby("order_id").size().reset_index(name="n_reviews")
review_agg = review_agg.merge(review_count, on="order_id", how="left")

features = features.merge(
    review_agg[["order_id", "review_score", "has_review_text"]],
    on="order_id", how="left"
)

# ── 5. Customer state ──────────────────────────────────────────────────
features = features.merge(
    dim_customers[["customer_id", "state"]].rename(columns={"state": "customer_state"}),
    on="customer_id", how="left"
)

# ── 6. Seller state (mode / most-frequent for the order) ───────────────
# For multi-seller orders, take the seller with the highest total price contribution
items_with_seller_state = fact_items.merge(
    dim_sellers[["seller_id", "state"]].rename(columns={"state": "seller_state"}),
    on="seller_id", how="left"
)
# Pick the seller_state corresponding to the item with the highest price per order
# (deterministic tie-breaking)
seller_state_per_order = (
    items_with_seller_state
    .sort_values(["order_id", "price"], ascending=[True, False])
    .drop_duplicates(subset="order_id", keep="first")
    [["order_id", "seller_state"]]
)
features = features.merge(seller_state_per_order, on="order_id", how="left")

# ── 7. is_interstate_order ──────────────────────────────────────────────
# Formula: customer_state != seller_state
features["is_interstate_order"] = features["customer_state"] != features["seller_state"]
# Set to NaN where either state is missing
features.loc[
    features["customer_state"].isna() | features["seller_state"].isna(),
    "is_interstate_order"
] = np.nan

# ── 8. Product category (mode for the order, English) ──────────────────
# For multi-item orders, take the category of the item with the highest price
items_with_cat = fact_items.merge(
    dim_products[["product_id", "product_category_name_english"]],
    on="product_id", how="left"
)
cat_per_order = (
    items_with_cat
    .sort_values(["order_id", "price"], ascending=[True, False])
    .drop_duplicates(subset="order_id", keep="first")
    [["order_id", "product_category_name_english"]]
    .rename(columns={"product_category_name_english": "product_category"})
)
features = features.merge(cat_per_order, on="order_id", how="left")

# ── 9. Outlier flag columns (non-destructive) ──────────────────────────
# These flag orders whose key metrics exceed the IQR upper fence
# computed in the EDA. Values from EDA:
#   price upper fence: 277.40 -> but this is item-level; at order level we flag on order_total_value
#   delivery_delay_days upper fence: 8.39
# We compute order-level IQR for order_total_value and freight_ratio

def iqr_upper(series: pd.Series, multiplier=1.5):
    Q1 = series.quantile(0.25)
    Q3 = series.quantile(0.75)
    return Q3 + multiplier * (Q3 - Q1)

otv_upper = iqr_upper(features["order_total_value"].dropna())
fr_upper = iqr_upper(features["freight_ratio"].dropna())
delay_upper = 8.39  # From EDA

features["is_value_outlier"] = features["order_total_value"] > otv_upper
features["is_freight_ratio_outlier"] = features["freight_ratio"] > fr_upper
features["is_delay_outlier"] = features["delivery_delay_days"] > delay_upper

# ═══════════════════════════════════════════════════════════════════════════
#  Drop helper columns not needed in final output
# ═══════════════════════════════════════════════════════════════════════════

# Keep order_purchase_timestamp for potential time-based analysis downstream
# Drop the raw delivery dates (delay_days captures the key info)
features = features.drop(columns=[
    "order_delivered_customer_date",
    "order_estimated_delivery_date",
])

# ═══════════════════════════════════════════════════════════════════════════
#  Report feature table
# ═══════════════════════════════════════════════════════════════════════════

print(f"\nFeature table shape: {features.shape}")
print(f"Grain: order_id (1 row per order)")
print(f"Total rows: {len(features):,}")

# ── Sample rows ─────────────────────────────────────────────────────────
print("\n" + "─" * 80)
print("SAMPLE ROWS (5 rows from delivered orders with reviews)")
print("─" * 80)

sample = features[
    features["delivery_delay_days"].notna() &
    features["review_score"].notna()
].head(5)

# Show all columns
pd.set_option("display.max_columns", None)
pd.set_option("display.width", 200)
print(sample.to_string(index=False))

# ── Feature-by-feature report ──────────────────────────────────────────
print("\n" + "─" * 80)
print("FEATURE DEFINITIONS AND NULL RATES")
print("─" * 80)

feature_defs = [
    ("order_id",                  "str",     "Unique order identifier (PK)",
     "From fact_orders.order_id"),
    ("customer_id",               "str",     "FK to dim_customers",
     "From fact_orders.customer_id"),
    ("order_status",              "str",     "Order status (delivered, shipped, etc.)",
     "From fact_orders.order_status"),
    ("order_purchase_timestamp",  "datetime","Timestamp of order purchase",
     "From fact_orders.order_purchase_timestamp"),
    ("delivery_delay_days",       "float64", "Days between actual and estimated delivery. Negative=early, Positive=late",
     "Formula: (order_delivered_customer_date - order_estimated_delivery_date).total_seconds() / 86400"),
    ("order_total_value",         "float64", "Total order value including freight (R$)",
     "Formula: sum(price) + sum(freight_value) over items in the order"),
    ("freight_ratio",             "float64", "Ratio of freight to product price",
     "Formula: sum(freight_value) / sum(price); NaN if sum(price)=0"),
    ("items_per_order",           "int/float","Number of items in the order",
     "Formula: count of rows in fact_order_items for this order_id"),
    ("distinct_sellers_per_order","int/float","Number of distinct sellers in the order",
     "Formula: nunique(seller_id) over items in the order"),
    ("payment_installments",      "int/float","Max installment count for this order",
     "From dim_payments.payment_installments_max"),
    ("payment_type",              "str",     "Primary payment type (credit_card, boleto, etc.)",
     "From dim_payments.primary_payment_type (type with highest payment_value)"),
    ("review_score",              "float64", "Mean review score (1-5). NaN if no review.",
     "Formula: mean(review_score) across reviews for this order_id"),
    ("has_review_text",           "bool",    "True if any review for this order has non-null comment text",
     "Formula: any(review_comment_message.notna()) for this order_id"),
    ("customer_state",            "str",     "Customer's state (2-letter code)",
     "From dim_customers.state via customer_id"),
    ("seller_state",              "str",     "Seller state of the highest-price item in the order",
     "From dim_sellers.state for the seller of the highest-price item in the order"),
    ("is_interstate_order",       "bool",    "True if customer_state != seller_state",
     "Formula: customer_state != seller_state; NaN if either is missing"),
    ("product_category",          "str",     "English product category of highest-price item",
     "From dim_products.product_category_name_english for the highest-price item"),
    ("is_value_outlier",          "bool",    "True if order_total_value > IQR upper fence",
     "Formula: order_total_value > Q3 + 1.5*IQR (computed on order_total_value)"),
    ("is_freight_ratio_outlier",  "bool",    "True if freight_ratio > IQR upper fence",
     "Formula: freight_ratio > Q3 + 1.5*IQR (computed on freight_ratio)"),
    ("is_delay_outlier",          "bool",    "True if delivery_delay_days > 8.39 (IQR upper fence from EDA)",
     "Formula: delivery_delay_days > 8.39"),
]

for col_name, dtype, desc, formula in feature_defs:
    total = len(features)
    null_count = features[col_name].isna().sum() if col_name in features.columns else "N/A"
    null_pct = (null_count / total * 100) if isinstance(null_count, (int, np.integer)) else "N/A"
    print(f"\n  {col_name}")
    print(f"    Type: {dtype}")
    print(f"    Description: {desc}")
    print(f"    Formula: {formula}")
    print(f"    Null count: {null_count:,} ({null_pct:.2f}%)" if isinstance(null_pct, float) else f"    Null: {null_pct}")

# ── Features NOT possible with this dataset ────────────────────────────
print("\n" + "─" * 80)
print("FEATURES NOT POSSIBLE WITH THIS DATASET")
print("─" * 80)
print("""
  1. profit_margin — No cost/wholesale data available; only selling price exists.
  2. customer_lifetime_value — No customer repeat-purchase linkage beyond
     customer_unique_id (which maps to order-level customer_id, not a true
     longitudinal customer record with account history).
  3. return_flag — No returns/refunds table exists in the dataset.
  4. seller_rating — No seller-level rating/reputation data beyond what can be
     inferred from review scores on their orders.
  5. product_rating_history — No time-series of product ratings; only per-order
     review scores available.
  6. discount_amount — No coupon or discount data; voucher payment type exists
     but doesn't indicate a discount on price.
  7. delivery_distance_km — While geolocation has lat/lng, computing haversine
     distances would require mapping seller zip to geo coordinates and introduces
     approximation; flagged but not engineered yet.
""")

# ═══════════════════════════════════════════════════════════════════════════
#  Save to parquet
# ═══════════════════════════════════════════════════════════════════════════

output_path = DATA_PROC / "features_orders.parquet"
features.to_parquet(output_path, index=False, engine="pyarrow")
size_mb = output_path.stat().st_size / 1024 / 1024
print(f"\n✓ Saved {output_path} ({len(features):,} rows, {size_mb:.2f} MB)")

print("\n" + "=" * 80)
print("FEATURE ENGINEERING COMPLETE")
print("=" * 80)
