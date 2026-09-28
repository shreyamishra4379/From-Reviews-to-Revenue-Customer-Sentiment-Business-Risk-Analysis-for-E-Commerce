"""
setup.py — One-command project bootstrap.
==========================================
Run this ONCE after cloning. It will:
  1. Download raw Kaggle data (if not already present).
  2. Run each pipeline stage ONLY if its outputs are missing.
  3. Skip any stage whose outputs already exist (pre-built files come via Git LFS).

Usage:
    python setup.py
    python setup.py --force   # re-run every stage even if outputs exist
    python setup.py --skip-data   # skip Kaggle download (data already present)
"""

import os
import sys
import subprocess
import argparse
from pathlib import Path

# ── Paths ─────────────────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parent
DATA_RAW  = ROOT / "data" / "raw"
DATA_PROC = ROOT / "data" / "processed"
CHECKPOINT_DIR = DATA_PROC / "checkpoints"

# ── Stage output sentinels ────────────────────────────────────────────────────
# Each stage is skipped when ALL its sentinel files exist.
STAGE_SENTINELS = {
    "stage1_star_schema": [
        DATA_PROC / "fact_orders.parquet",
        DATA_PROC / "fact_order_reviews.parquet",
        DATA_PROC / "dim_customers.parquet",
        DATA_PROC / "dim_products.parquet",
        DATA_PROC / "dim_sellers.parquet",
        DATA_PROC / "dim_payments.parquet",
        DATA_PROC / "dim_geolocation.parquet",
        DATA_PROC / "fact_order_items.parquet",
    ],
    "stage2_features": [
        DATA_PROC / "features_orders.parquet",
    ],
    "stage3_nlp": [
        DATA_PROC / "nlp_reviews.parquet",
        DATA_PROC / "nlp_topics.json",
        DATA_PROC / "nlp_aspects.json",
        DATA_PROC / "nlp_summary_metrics.json",
        CHECKPOINT_DIR / "embeddings.npy",
        CHECKPOINT_DIR / "transformer_sentiment.pkl",
    ],
    "stage4_analytics": [
        DATA_PROC / "stage4" / "stage4_metrics.json",
        DATA_PROC / "stage4" / "agg_category.csv",
        DATA_PROC / "stage4" / "agg_seller.csv",
        DATA_PROC / "stage4" / "business_prioritization.csv",
    ],
}

# ── Kaggle raw files ──────────────────────────────────────────────────────────
RAW_FILES = [
    "olist_customers_dataset.csv",
    "olist_geolocation_dataset.csv",
    "olist_order_items_dataset.csv",
    "olist_order_payments_dataset.csv",
    "olist_order_reviews_dataset.csv",
    "olist_orders_dataset.csv",
    "olist_products_dataset.csv",
    "olist_sellers_dataset.csv",
    "product_category_name_translation.csv",
]


def _run(cmd: list[str], label: str) -> None:
    """Run a subprocess command, exiting on failure."""
    print(f"\n{'='*70}")
    print(f"  RUNNING: {label}")
    print(f"{'='*70}")
    result = subprocess.run(cmd, cwd=ROOT)
    if result.returncode != 0:
        print(f"\n[ERROR] '{label}' failed with exit code {result.returncode}.")
        sys.exit(result.returncode)
    print(f"  ✓ {label} — complete.")


def _all_exist(paths: list[Path]) -> bool:
    return all(p.exists() for p in paths)


def _stage_done(stage_name: str) -> bool:
    return _all_exist(STAGE_SENTINELS[stage_name])


def download_raw_data() -> None:
    """Download Olist dataset from Kaggle via kagglehub if not already present."""
    missing = [f for f in RAW_FILES if not (DATA_RAW / f).exists()]
    if not missing:
        print("  ✓ Raw data already present — skipping Kaggle download.")
        return

    print(f"  → Missing {len(missing)} raw file(s). Downloading from Kaggle…")
    DATA_RAW.mkdir(parents=True, exist_ok=True)

    # Use kagglehub (no API key needed for public datasets)
    download_script = """
import kagglehub, shutil, os
from pathlib import Path

dest = Path("data/raw")
dest.mkdir(parents=True, exist_ok=True)

path = kagglehub.dataset_download("olistbr/brazilian-ecommerce")
src = Path(path)

for f in src.rglob("*.csv"):
    target = dest / f.name
    if not target.exists():
        shutil.copy2(f, target)
        print(f"  Copied: {f.name}")
    else:
        print(f"  Already exists: {f.name}")

print("Download complete.")
"""
    tmp = ROOT / "_download_tmp.py"
    tmp.write_text(download_script, encoding="utf-8")
    try:
        _run([sys.executable, str(tmp)], "Kaggle data download")
    finally:
        tmp.unlink(missing_ok=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="Bootstrap the project pipeline.")
    parser.add_argument("--force",      action="store_true", help="Re-run all stages even if outputs exist.")
    parser.add_argument("--skip-data",  action="store_true", help="Skip Kaggle download (raw data already present).")
    parser.add_argument("--stage",      choices=list(STAGE_SENTINELS.keys()) + ["app"], help="Run a single specific stage.")
    args = parser.parse_args()

    print("\n" + "="*70)
    print("  From Reviews to Revenue — Project Setup")
    print("="*70)

    # ── Step 0: Ensure directories exist ─────────────────────────────────────
    DATA_RAW.mkdir(parents=True, exist_ok=True)
    DATA_PROC.mkdir(parents=True, exist_ok=True)
    CHECKPOINT_DIR.mkdir(parents=True, exist_ok=True)
    (DATA_PROC / "stage4").mkdir(parents=True, exist_ok=True)

    # ── Step 1: Raw data ──────────────────────────────────────────────────────
    if not args.skip_data:
        download_raw_data()
    else:
        print("  ✓ --skip-data flag set — skipping Kaggle download.")

    # ── Step 2: Star-schema (Stage 1) ─────────────────────────────────────────
    if args.force or not _stage_done("stage1_star_schema"):
        _run([sys.executable, "src/data/make_dataset.py"], "Stage 1 — Star Schema")
    else:
        print("\n  ✓ Stage 1 (Star Schema) outputs exist — skipping.")

    # ── Step 3: Feature engineering (Stage 2) ─────────────────────────────────
    if args.force or not _stage_done("stage2_features"):
        _run([sys.executable, "src/data/build_features.py"], "Stage 2 — Feature Engineering")
    else:
        print("  ✓ Stage 2 (Features) outputs exist — skipping.")

    # ── Step 4: NLP pipeline (Stage 3) ────────────────────────────────────────
    if args.force or not _stage_done("stage3_nlp"):
        _run([sys.executable, "src/analytics/nlp_pipeline.py"], "Stage 3 — NLP Pipeline")
    else:
        print("  ✓ Stage 3 (NLP) outputs exist — skipping.")

    # ── Step 5: Business analytics (Stage 4) ──────────────────────────────────
    if args.force or not _stage_done("stage4_analytics"):
        _run([sys.executable, "src/analytics/stage4_analysis.py"], "Stage 4 — Business Analytics")
        _run([sys.executable, "src/analytics/validate_sql.py"], "Stage 4 — SQL Validation")
    else:
        print("  ✓ Stage 4 (Analytics) outputs exist — skipping.")

    print("\n" + "="*70)
    print("  ✅ Setup complete! Launch the dashboard with:")
    print("     python -m streamlit run app.py")
    print("="*70 + "\n")


if __name__ == "__main__":
    main()
