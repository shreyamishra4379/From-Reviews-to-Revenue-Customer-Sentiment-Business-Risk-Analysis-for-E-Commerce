"""
fraud_signals.py — Fraud and counterfeit signals in review text (trust & safety).

Flags text reviews that mention scams, fraud, counterfeit or fake products, using
Portuguese keyword patterns (accents removed before matching). These are mentions
written by customers, NOT confirmed fraud: a review saying "não é original" is a
complaint, not proof. Rates are reported with their review counts, and sellers and
categories are only ranked above the project's sample-size thresholds.

Output: data/processed/stage4/fraud_signals.json

Usage:
    python src/analytics/fraud_signals.py
"""
import json
import os
import sys
import unicodedata

import pandas as pd

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DATA = os.path.join(ROOT, "data", "processed")
OUT = os.path.join(DATA, "stage4", "fraud_signals.json")

SELLER_MIN = 30     # same thresholds as Stage 4 sample-size validation
CATEGORY_MIN = 100

# Signal type -> Portuguese patterns (matched on lower-case text without accents)
SIGNALS = {
    "Counterfeit or not original": [
        r"\bfalsificad", r"\bfals[oa]s?\b", r"\bpirata", r"\breplica",
        r"nao (?:e|eh|era) original", r"\bnao original",
    ],
    "Scam or fraud": [r"\bgolpe", r"\bfraud", r"\bestelionat", r"\benganad"],
    "Stolen or cloned": [r"\broubad", r"\bclonad"],
}


def normalise(text: str) -> str:
    return unicodedata.normalize("NFKD", str(text).lower()).encode("ascii", "ignore").decode()


def flag_reviews(texts: pd.Series) -> pd.DataFrame:
    """One boolean column per signal type, plus `any_signal`."""
    norm = texts.map(normalise)
    flags = pd.DataFrame(index=texts.index)
    for name, patterns in SIGNALS.items():
        flags[name] = norm.str.contains("|".join(f"(?:{p})" for p in patterns), regex=True)
    flags["any_signal"] = flags[list(SIGNALS)].any(axis=1)
    return flags


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    nlp = pd.read_parquet(os.path.join(DATA, "nlp_reviews.parquet"))
    items = pd.read_parquet(os.path.join(DATA, "fact_order_items.parquet"))
    prods = pd.read_parquet(os.path.join(DATA, "dim_products.parquet"))

    flags = flag_reviews(nlp["review_comment_message"])
    rev = pd.concat([nlp[["review_id", "order_id", "review_score", "sentiment_label"]], flags], axis=1)
    flagged = rev[rev["any_signal"]]

    by_type = [{
        "signal": name,
        "reviews": int(rev[name].sum()),
        "avg_review_score": round(float(rev.loc[rev[name], "review_score"].mean()), 2),
        "negative_sentiment_pct": round(float((rev.loc[rev[name], "sentiment_label"] == "Negative").mean() * 100), 1),
    } for name in SIGNALS]

    # One row per (review, seller) and (review, category): a review counts once per group
    joined = rev.merge(items[["order_id", "seller_id", "product_id"]], on="order_id")
    joined = joined.merge(prods[["product_id", "product_category_name_english"]], on="product_id", how="left")
    joined["category"] = joined["product_category_name_english"].fillna("unknown")
    joined["review_key"] = joined["review_id"] + "|" + joined["order_id"]

    def rank(key: str, minimum: int, top: int):
        g = joined.drop_duplicates([key, "review_key"]).groupby(key).agg(
            reviews=("review_key", "nunique"), flagged=("any_signal", "sum"))
        g = g[g["reviews"] >= minimum]
        g["rate_pct"] = (g["flagged"] / g["reviews"] * 100).round(2)
        g = g[g["flagged"] > 0].sort_values(["rate_pct", "flagged"], ascending=False).head(top)
        return [{key: k, "reviews": int(r.reviews), "flagged": int(r.flagged), "rate_pct": float(r.rate_pct)}
                for k, r in g.iterrows()]

    # A few verbatim examples (store names in Olist text are already anonymised)
    examples = []
    for name in SIGNALS:
        sample = rev[rev[name]].merge(nlp[["review_id", "order_id", "review_comment_message"]],
                                      on=["review_id", "order_id"]).head(2)
        examples += [{"signal": name, "review_score": int(s.review_score),
                      "text": str(s.review_comment_message).strip()[:220]} for s in sample.itertuples()]

    result = {
        "method": "Keyword patterns on Portuguese review text (accents removed). Mentions, not confirmed fraud.",
        "patterns": SIGNALS,
        "text_reviews": int(len(rev)),
        "flagged_reviews": int(len(flagged)),
        "flagged_pct": round(len(flagged) / len(rev) * 100, 2),
        "flagged_avg_review_score": round(float(flagged["review_score"].mean()), 2),
        "all_avg_review_score": round(float(rev["review_score"].mean()), 2),
        "flagged_negative_sentiment_pct": round(float((flagged["sentiment_label"] == "Negative").mean() * 100), 1),
        "by_signal": by_type,
        "top_sellers": rank("seller_id", SELLER_MIN, 10),
        "top_categories": rank("category", CATEGORY_MIN, 10),
        "seller_min_reviews": SELLER_MIN,
        "category_min_reviews": CATEGORY_MIN,
        "examples": examples,
    }
    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(f"Flagged {result['flagged_reviews']:,} of {result['text_reviews']:,} text reviews "
          f"({result['flagged_pct']}%); avg score {result['flagged_avg_review_score']} vs {result['all_avg_review_score']}")
    for t in by_type:
        print(f"  {t['signal']:30s} {t['reviews']:4d} reviews, avg {t['avg_review_score']}")
    print(f"Saved {OUT}")


if __name__ == "__main__":
    main()
