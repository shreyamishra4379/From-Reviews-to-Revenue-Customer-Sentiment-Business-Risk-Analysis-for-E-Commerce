"""
download_data.py — Stage 1 step 0: fetch the Olist dataset with kagglehub.

Copies (not symlinks) the 9 CSVs into data/raw/ so the repo is self-contained.
Requires Kaggle credentials: ~/.kaggle/kaggle.json, or the KAGGLE_USERNAME and
KAGGLE_KEY environment variables. Stops with a clear message if anything is
missing instead of continuing with partial data.

Usage:
    python src/data/download_data.py
"""
import os
import shutil
import sys

import pandas as pd

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
from config.settings import DATA_RAW, RAW_FILES

DATASET = "olistbr/brazilian-ecommerce"


def raw_files_present() -> bool:
    return all((DATA_RAW / f).exists() for f in RAW_FILES.values())


def download() -> None:
    if raw_files_present():
        print(f"[DOWNLOAD] All {len(RAW_FILES)} raw CSVs already in {DATA_RAW} - skipping.")
        return

    try:
        import kagglehub
    except ImportError:
        sys.exit("[DOWNLOAD] kagglehub is not installed. Run: pip install kagglehub")

    try:
        path = kagglehub.dataset_download(DATASET)
    except Exception as e:  # kagglehub raises several auth/network error types
        sys.exit(f"[DOWNLOAD] kagglehub download failed: {e}\n"
                 "Configure ~/.kaggle/kaggle.json or set KAGGLE_USERNAME and KAGGLE_KEY.")
    print("Path to dataset files:", path)

    DATA_RAW.mkdir(parents=True, exist_ok=True)
    src_dir = type(DATA_RAW)(path)
    missing = []
    for name in RAW_FILES.values():
        src = src_dir / name
        if not src.exists():
            missing.append(name)
            continue
        shutil.copy2(src, DATA_RAW / name)
        rows = len(pd.read_csv(src))   # review text contains newlines, so count with pandas
        print(f"[DOWNLOAD] {name:45s} {rows:>10,} rows")

    if missing:
        sys.exit(f"[DOWNLOAD] Expected files not found in the download: {missing}")
    print(f"[DOWNLOAD] Copied {len(RAW_FILES)} files to {DATA_RAW}")


if __name__ == "__main__":
    download()
