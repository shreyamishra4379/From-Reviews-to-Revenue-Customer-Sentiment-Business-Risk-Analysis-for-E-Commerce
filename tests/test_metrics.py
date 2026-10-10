"""Unit tests for the shared metric definitions in src/utils/metrics.py."""
import numpy as np
import pandas as pd

from src.utils.metrics import delay_days, late_flag, neg_review_flag, parse_aspects


def test_delay_days_sign_and_units():
    delivered = pd.Series(["2018-01-10 12:00", "2018-01-05 00:00", None])
    estimated = pd.Series(["2018-01-08 00:00", "2018-01-10 00:00", "2018-01-10 00:00"])
    d = delay_days(delivered, estimated)
    assert d[0] == 2.5            # 2.5 days late
    assert d[1] == -5.0           # 5 days early
    assert np.isnan(d[2])         # never delivered


def test_late_flag_excludes_undelivered_orders():
    flag = late_flag(pd.Series([2.5, -5.0, 0.0, np.nan]))
    assert flag.tolist()[:3] == [1.0, 0.0, 0.0]   # exactly on the estimate is not late
    assert np.isnan(flag.iloc[3])                  # undelivered is neither late nor on time
    assert flag.mean() == 1 / 3                    # mean() skips undelivered orders


def test_neg_review_flag_threshold():
    assert neg_review_flag(pd.Series([1, 2, 3, 4, 5])).tolist() == [1, 1, 0, 0, 0]


def test_parse_aspects_numpy_array_is_not_concatenated():
    # Regression: ast.literal_eval(str(np.array(['A', 'B']))) returns the single string 'AB'
    arr = np.array(["Delivery/Logistics", "Product Quality"], dtype=object)
    assert parse_aspects(arr) == ["Delivery/Logistics", "Product Quality"]


def test_parse_aspects_other_inputs():
    assert parse_aspects(["Packaging"]) == ["Packaging"]
    assert parse_aspects("['Packaging', 'Price/Value']") == ["Packaging", "Price/Value"]
    assert parse_aspects(np.array([], dtype=object)) == ["Uncategorized"]
    assert parse_aspects(None) == ["Uncategorized"]
