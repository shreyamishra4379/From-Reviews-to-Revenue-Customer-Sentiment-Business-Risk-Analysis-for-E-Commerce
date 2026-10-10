"""
Shared metric definitions used by Stage 4 and the test suite.

Keeping these in one place means the pipeline and the tests agree on what
"late", "negative review" and "delay" mean.
"""
import numpy as np
import pandas as pd

NEG_REVIEW_MAX_SCORE = 2   # review_score <= 2 is a negative review


def delay_days(delivered: pd.Series, estimated: pd.Series) -> pd.Series:
    """Days between actual and estimated delivery. Positive = late, negative = early.
    NaN when the order was never delivered."""
    delivered = pd.to_datetime(delivered)
    estimated = pd.to_datetime(estimated)
    return (delivered - estimated).dt.total_seconds() / 86400


def late_flag(delay: pd.Series) -> pd.Series:
    """1.0 if late, 0.0 if on time or early, NaN if not delivered.
    Undelivered orders must not be counted as on time."""
    return pd.Series(np.where(delay.isna(), np.nan, (delay > 0).astype(float)),
                     index=delay.index)


def neg_review_flag(score: pd.Series) -> pd.Series:
    """1 for review_score <= 2, else 0."""
    return (score <= NEG_REVIEW_MAX_SCORE).astype(int)


def parse_aspects(x) -> list:
    """Normalise an extracted_aspects cell to a list of aspect names.

    Parquet round-trips lists as numpy arrays. Calling ast.literal_eval(str(arr))
    on those turns "['A' 'B']" into the single string "AB", so arrays and lists
    are converted directly instead."""
    if isinstance(x, (list, tuple, np.ndarray)):
        items = [str(a) for a in x]
    elif isinstance(x, str) and x.strip():
        import ast
        try:
            parsed = ast.literal_eval(x)
            items = [str(a) for a in parsed] if isinstance(parsed, (list, tuple)) else [str(parsed)]
        except (ValueError, SyntaxError):
            items = [x]
    else:
        items = []
    return items or ['Uncategorized']
