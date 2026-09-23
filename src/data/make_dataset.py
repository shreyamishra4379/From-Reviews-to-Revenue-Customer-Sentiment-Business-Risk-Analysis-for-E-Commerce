"""
make_dataset.py — Clean raw data and build the star-schema parquet files.

This is the single authoritative cleaning pipeline. Every row-drop, imputation,
or transformation is logged with counts so audits are reproducible.

Usage:
    python -m src.data.make_dataset          # from project root
    python src/data/make_dataset.py          # also works
"""
import sys
import os
import pandas as pd
import numpy as np

# Allow imports from project root
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
from config.settings import (
    DATA_PROC, STAR_FILES, CATEGORY_TRANSLATION_PATCHES,
)
from src.data.load_raw import load_all_raw


# ═══════════════════════════════════════════════════════════════════════════
#  Cleaning helpers
# ═══════════════════════════════════════════════════════════════════════════

def _log(msg: str) -> None:
    """Print a tagged log line for traceability."""
    import sys
    try:
        print(f"[CLEAN] {msg}")
    except UnicodeEncodeError:
        print(f"[CLEAN] {msg.encode('ascii', 'replace').decode()}")


def clean_geolocation(geo: pd.DataFrame) -> pd.DataFrame:
    """
    Deduplicate geolocation rows and aggregate to one row per zip prefix.

    Raw table has 1,000,163 rows with 261,831 exact duplicates.
    After drop_duplicates, we further aggregate by zip_code_prefix using the
    median lat/lng (multiple distinct coordinates can exist per zip).
    """
    before = len(geo)
    geo = geo.drop_duplicates()
    after_dedup = len(geo)
    _log(f"Geolocation: dropped {before - after_dedup:,} exact duplicates "
         f"({before:,} -> {after_dedup:,})")

    # Aggregate to one representative row per zip prefix
    geo_agg = (
        geo.groupby("geolocation_zip_code_prefix", as_index=False)
        .agg(
            geolocation_lat=("geolocation_lat", "median"),
            geolocation_lng=("geolocation_lng", "median"),
            geolocation_city=("geolocation_city", "first"),
            geolocation_state=("geolocation_state", "first"),
        )
    )
    _log(f"Geolocation: aggregated to {len(geo_agg):,} unique zip prefixes")
    return geo_agg


def clean_products(products: pd.DataFrame, translation: pd.DataFrame) -> pd.DataFrame:
    """
    1. Patch the 2 missing category translations.
    2. Join English category names.
    3. Impute 610 missing categories as 'unknown'.
    """
    # Patch the translation table
    patches = pd.DataFrame(
        list(CATEGORY_TRANSLATION_PATCHES.items()),
        columns=["product_category_name", "product_category_name_english"],
    )
    translation = pd.concat([translation, patches], ignore_index=True)
    _log(f"Translation table: patched 2 missing categories -> "
         f"{len(translation)} total entries")

    # Merge
    products = products.merge(translation, on="product_category_name", how="left")

    # Impute missing categories
    missing_cat = products["product_category_name_english"].isna().sum()
    products["product_category_name_english"] = (
        products["product_category_name_english"].fillna("unknown")
    )
    _log(f"Products: imputed {missing_cat} missing English category names as 'unknown'")

    return products


def build_dim_payments(payments: pd.DataFrame) -> pd.DataFrame:
    """
    Aggregate payments to one row per order_id so that joining to fact_orders
    does not cause fan-out.
    """
    # Primary payment type = the type with the highest payment_value for that order
    idx_max = payments.groupby("order_id")["payment_value"].idxmax()
    primary_type = payments.loc[idx_max, ["order_id", "payment_type"]].rename(
        columns={"payment_type": "primary_payment_type"}
    )

    agg = (
        payments.groupby("order_id", as_index=False)
        .agg(
            total_payment_value=("payment_value", "sum"),
            payment_installments_max=("payment_installments", "max"),
            n_payment_methods=("payment_type", "nunique"),
        )
    )
    dim = agg.merge(primary_type, on="order_id", how="left")
    _log(f"dim_payments: aggregated {len(payments):,} payment rows -> "
         f"{len(dim):,} order-level rows")
    return dim


# ═══════════════════════════════════════════════════════════════════════════
#  Star-schema builder
# ═══════════════════════════════════════════════════════════════════════════

def build_star_schema() -> dict[str, pd.DataFrame]:
    """
    Build all Fact and Dimension tables from raw data.
    Returns dict of table_name -> DataFrame.
    """
    raw = load_all_raw()

    _log("=" * 60)
    _log("BUILDING STAR SCHEMA")
    _log("=" * 60)

    # ── Dimension: Geolocation ───────────────────────────────────────────
    dim_geo = clean_geolocation(raw["geolocation"])
    dim_geo = dim_geo.rename(columns={
        "geolocation_zip_code_prefix": "zip_code_prefix",
        "geolocation_lat": "lat",
        "geolocation_lng": "lng",
        "geolocation_city": "city",
        "geolocation_state": "state",
    })

    # ── Dimension: Customers ─────────────────────────────────────────────
    dim_customers = raw["customers"].rename(columns={
        "customer_zip_code_prefix": "zip_code_prefix",
        "customer_city": "city",
        "customer_state": "state",
    })
    _log(f"dim_customers: {len(dim_customers):,} rows (1 per customer_id / order)")

    # ── Dimension: Products ──────────────────────────────────────────────
    dim_products = clean_products(raw["products"], raw["translation"])
    _log(f"dim_products: {len(dim_products):,} rows")

    # ── Dimension: Sellers ───────────────────────────────────────────────
    dim_sellers = raw["sellers"].rename(columns={
        "seller_zip_code_prefix": "zip_code_prefix",
        "seller_city": "city",
        "seller_state": "state",
    })
    _log(f"dim_sellers: {len(dim_sellers):,} rows")

    # ── Dimension: Payments (aggregated to order grain) ──────────────────
    dim_payments = build_dim_payments(raw["payments"])

    # ── Fact: Orders ─────────────────────────────────────────────────────
    fact_orders = raw["orders"].copy()
    _log(f"fact_orders: {len(fact_orders):,} rows")

    # ── Fact: Order Items ────────────────────────────────────────────────
    fact_items = raw["items"].copy()
    # Parse shipping_limit_date
    fact_items["shipping_limit_date"] = pd.to_datetime(
        fact_items["shipping_limit_date"], errors="coerce"
    )
    _log(f"fact_order_items: {len(fact_items):,} rows")

    # ── Fact: Order Reviews ──────────────────────────────────────────────
    fact_reviews = raw["reviews"].copy()
    for col in ["review_creation_date", "review_answer_timestamp"]:
        fact_reviews[col] = pd.to_datetime(fact_reviews[col], errors="coerce")
    non_null_msg = fact_reviews["review_comment_message"].notna().sum()
    total_reviews = len(fact_reviews)
    _log(f"fact_order_reviews: {total_reviews:,} rows "
         f"(review_comment_message non-null: {non_null_msg:,} = "
         f"{non_null_msg/total_reviews*100:.2f}%)")

    return {
        "fact_orders":        fact_orders,
        "fact_order_items":   fact_items,
        "fact_order_reviews": fact_reviews,
        "dim_customers":      dim_customers,
        "dim_products":       dim_products,
        "dim_sellers":        dim_sellers,
        "dim_payments":       dim_payments,
        "dim_geolocation":    dim_geo,
    }


def save_star_schema(tables: dict[str, pd.DataFrame]) -> None:
    """Write every table to a parquet file in data/processed/."""
    DATA_PROC.mkdir(parents=True, exist_ok=True)
    _log("-" * 60)
    _log("WRITING PARQUET FILES")
    _log("-" * 60)
    for key, df in tables.items():
        filepath = DATA_PROC / STAR_FILES[key]
        df.to_parquet(filepath, index=False, engine="pyarrow")
        size_mb = filepath.stat().st_size / 1024 / 1024
        _log(f"  {STAR_FILES[key]:30s}  {len(df):>10,} rows  {size_mb:6.2f} MB")


# ═══════════════════════════════════════════════════════════════════════════
#  Main
# ═══════════════════════════════════════════════════════════════════════════

def main():
    tables = build_star_schema()
    save_star_schema(tables)
    _log("=" * 60)
    _log("DONE — Star schema built in data/processed/")
    _log("=" * 60)


if __name__ == "__main__":
    main()
