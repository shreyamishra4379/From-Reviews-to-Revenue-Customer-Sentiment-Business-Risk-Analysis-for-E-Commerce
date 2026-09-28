"""
load_raw.py — Load all 9 raw CSVs into a dict of DataFrames.

Usage:
    from src.data.load_raw import load_all_raw
    raw = load_all_raw()          # returns dict[str, pd.DataFrame]
    orders = raw["orders"]
"""
import pandas as pd
import sys
import os

# Allow imports from project root
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
from config.settings import DATA_RAW, RAW_FILES, ORDER_DATE_COLS


def load_all_raw() -> dict[str, pd.DataFrame]:
    """
    Read every raw CSV into a DataFrame.
    Date columns in the orders table are parsed automatically.
    """
    frames: dict[str, pd.DataFrame] = {}
    for key, filename in RAW_FILES.items():
        filepath = DATA_RAW / filename
        if not filepath.exists():
            raise FileNotFoundError(
                f"Expected raw file not found: {filepath}\n"
                "Run the kagglehub download step first."
            )
        if key == "orders":
            frames[key] = pd.read_csv(filepath, parse_dates=ORDER_DATE_COLS)
        else:
            frames[key] = pd.read_csv(filepath)
    return frames


if __name__ == "__main__":
    raw = load_all_raw()
    for k, df in raw.items():
        print(f"{k:15s}  {df.shape[0]:>10,} rows  ×  {df.shape[1]} cols")
