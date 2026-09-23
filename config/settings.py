"""
Project-wide configuration constants.
All paths, column names, and data-quality thresholds live here so that
notebooks and src/ modules reference one single source of truth.
"""
import os
from pathlib import Path

# ── Paths ────────────────────────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_RAW     = PROJECT_ROOT / "data" / "raw"
DATA_PROC    = PROJECT_ROOT / "data" / "processed"
DATA_SAMPLE  = PROJECT_ROOT / "data" / "sample"

# ── Raw file names ───────────────────────────────────────────────────────
RAW_FILES = {
    "customers":   "olist_customers_dataset.csv",
    "geolocation": "olist_geolocation_dataset.csv",
    "items":       "olist_order_items_dataset.csv",
    "payments":    "olist_order_payments_dataset.csv",
    "reviews":     "olist_order_reviews_dataset.csv",
    "orders":      "olist_orders_dataset.csv",
    "products":    "olist_products_dataset.csv",
    "sellers":     "olist_sellers_dataset.csv",
    "translation": "product_category_name_translation.csv",
}

# ── Star-schema output file names ────────────────────────────────────────
STAR_FILES = {
    "fact_orders":       "fact_orders.parquet",
    "fact_order_items":  "fact_order_items.parquet",
    "fact_order_reviews":"fact_order_reviews.parquet",
    "dim_customers":     "dim_customers.parquet",
    "dim_products":      "dim_products.parquet",
    "dim_sellers":       "dim_sellers.parquet",
    "dim_payments":      "dim_payments.parquet",
    "dim_geolocation":   "dim_geolocation.parquet",
}

# ── Date columns to parse ────────────────────────────────────────────────
ORDER_DATE_COLS = [
    "order_purchase_timestamp",
    "order_approved_at",
    "order_delivered_carrier_date",
    "order_delivered_customer_date",
    "order_estimated_delivery_date",
]

# ── Manual translation patches for the 2 missing categories ─────────────
CATEGORY_TRANSLATION_PATCHES = {
    "pc_gamer": "pc_gamer",
    "portateis_cozinha_e_preparadores_de_alimentos": "portable_kitchen_food_preparers",
}

# ── Currency label ───────────────────────────────────────────────────────
CURRENCY = "R$"
