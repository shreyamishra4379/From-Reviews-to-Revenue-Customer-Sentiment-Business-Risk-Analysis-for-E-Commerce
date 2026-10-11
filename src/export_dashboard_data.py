"""
Stage 6 — Export pre-aggregated JSON for the web dashboard.
Reads ONLY from data/processed/ (no NLP recomputation).
Writes to dashboard/public/data/*.json
Prints reconciliation report against source parquets.
"""
import sys, json
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import pandas as pd
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from src.nlp.topic_names import topic_name

ROOT   = Path(__file__).resolve().parent.parent
DATA   = ROOT / "data" / "processed"
S4     = DATA / "stage4"
OUT    = ROOT / "dashboard" / "public" / "data"
OUT.mkdir(parents=True, exist_ok=True)

def jdump(obj, path: Path):
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2, default=str), encoding="utf-8", newline="\n")
    print(f"  Wrote {path.name}  ({path.stat().st_size // 1024} KB)")

errors = []

# ─────────────────────────────────────────────────────────────────────────────
# LOAD SOURCE DATA
# ─────────────────────────────────────────────────────────────────────────────
print("Loading source data …")
nlp_m   = json.loads((DATA / "nlp_summary_metrics.json").read_text(encoding="utf-8"))
nlp_t   = json.loads((DATA / "nlp_topics.json").read_text(encoding="utf-8"))
nlp_a   = json.loads((DATA / "nlp_aspects.json").read_text(encoding="utf-8"))
s4_m    = json.loads((S4  / "stage4_metrics.json").read_text(encoding="utf-8"))

cat_agg      = pd.read_csv(S4 / "agg_category.csv")
seller_agg   = pd.read_csv(S4 / "agg_seller.csv")
state_agg    = pd.read_csv(S4 / "agg_state.csv")
monthly      = pd.read_csv(S4 / "agg_monthly.csv")
quarterly    = pd.read_csv(S4 / "agg_quarterly.csv")
prio         = pd.read_csv(S4 / "business_prioritization.csv")
complaint_mx = pd.read_csv(S4 / "complaint_matrix.csv", index_col=0)

# parquets – for reconciliation only
reviews_pq   = pd.read_parquet(DATA / "fact_order_reviews.parquet")
nlp_pq       = pd.read_parquet(DATA / "nlp_reviews.parquet")
orders_pq    = pd.read_parquet(DATA / "fact_orders.parquet")
items_pq     = pd.read_parquet(DATA / "fact_order_items.parquet")
products_pq  = pd.read_parquet(DATA / "dim_products.parquet")
customers_pq = pd.read_parquet(DATA / "dim_customers.parquet")

print("Done.\n")

# ─────────────────────────────────────────────────────────────────────────────
# RECONCILIATION
# ─────────────────────────────────────────────────────────────────────────────
print("=" * 60)
print("RECONCILIATION REPORT")
print("=" * 60)

def check(label, a, b, tol=0.01):
    ok = abs(a - b) / max(abs(b), 1) <= tol
    tag = "OK " if ok else "FAIL"
    print(f"  [{tag}] {label}: source={b:,.0f}  export={a:,.0f}")
    if not ok:
        errors.append(f"{label}: source={b} export={a}")

# Total reviews
check("total_reviews (nlp_m vs parquet rows)",
      nlp_m["total_reviews"], len(reviews_pq))

# Reviews with text
text_reviews_src = nlp_pq.shape[0]
check("reviews_with_text (nlp_m vs nlp_reviews.parquet rows)",
      nlp_m["reviews_with_text"], text_reviews_src)

# Total orders
total_orders_src = orders_pq["order_id"].nunique()
total_orders_reviews = reviews_pq["order_id"].nunique()
print(f"  [INFO] fact_orders unique orders: {total_orders_src:,}")
print(f"  [INFO] fact_order_reviews unique orders: {total_orders_reviews:,}")

# Revenue
total_rev_src = items_pq["price"].sum()
print(f"  [INFO] Total item revenue (fact_order_items.price sum): R$ {total_rev_src:,.2f}")

# NLP sentiment distribution
dist = nlp_m["transformer_sentiment"]["distribution"]
dist_total = sum(dist.values())
check("sentiment dist total (vs nlp_reviews rows)",
      dist_total, text_reviews_src)

# Category totals
cat_review_sum = cat_agg["review_count"].sum()
print(f"  [INFO] Sum of cat_agg review_count: {cat_review_sum:,} "
      f"(>= review-level rows {s4_m['review_level_rows']:,}: an order can span categories)")
if cat_review_sum < s4_m["review_level_rows"]:
    errors.append("category review counts are below the number of reviews")
check("monthly review_count total (vs Stage 4 review-level rows)",
      monthly["review_count"].sum(), s4_m["review_level_rows"])
check("state review_count total (vs Stage 4 review-level rows)",
      state_agg["review_count"].sum(), s4_m["review_level_rows"], tol=0.002)

# Exposure
exp = s4_m["commercial_exposure"]
print(f"  [INFO] affected_order_value_BRL: R$ {exp['affected_order_value_BRL']:,.2f}")
print(f"  [INFO] affected_orders:          {exp['affected_orders']:,}")

print()
print("Reconciliation complete.")
print()

# ─────────────────────────────────────────────────────────────────────────────
# EXPORT 1 — overview.json
# ─────────────────────────────────────────────────────────────────────────────
print("Exporting …")
overview = {
    "total_reviews":       nlp_m["total_reviews"],
    "reviews_with_text":   nlp_m["reviews_with_text"],
    "text_coverage_pct":   nlp_m["text_coverage_pct"],
    "total_orders":        int(total_orders_src),
    "nlp_agreement_pct":   nlp_m["transformer_sentiment"]["agreement_rate_pct"],
    "complaint_topics_count": len(nlp_m["aspect_summary"]),

    # sentiment distribution
    "sentiment_distribution": dist,

    # per-score agreement
    "per_score_agreement_pct": nlp_m["transformer_sentiment"]["per_score_agreement_pct"],

    # review score histogram (from parquet — ground truth)
    "review_score_distribution": {
        str(int(k)): int(v)
        for k, v in reviews_pq["review_score"].value_counts().sort_index().items()
    },

    # correlations
    "correlations": [
        {"pair": k, "rho": v["rho"], "n": v.get("n"),
         "p_value": v["p_value"],
         "p_label": "< 1e-300" if v["p_value"] == 0 else f"{v['p_value']:.2e}"}
        for k, v in s4_m["statistical_analysis"]["correlations"].items()
    ],

    # on-time vs late
    "ontime_vs_late": s4_m["statistical_analysis"]["ontime_vs_late"],

    # disclaimer
    "disclaimer": "Scenario-based estimate, not observed revenue loss",
    "headlines": None,   # filled in below
}

# Headline facts for the Overview page. Computed here so the UI only displays them.
_asp = [(k, v) for k, v in nlp_m["aspect_summary"].items() if k != "Uncategorized"]
_neg_total = sum(v["negative"] for _, v in _asp)
_by_neg = sorted(_asp, key=lambda kv: -kv[1]["negative"])
_by_rate = sorted(_asp, key=lambda kv: -kv[1]["negative"] / kv[1]["total_mentions"])
_delivered = orders_pq.dropna(subset=["order_delivered_customer_date", "order_estimated_delivery_date"])
_late = (pd.to_datetime(_delivered["order_delivered_customer_date"]) >
         pd.to_datetime(_delivered["order_estimated_delivery_date"]))
_exp = s4_m["commercial_exposure"]
_act_first = prio[prio["segment"] == "HIGH Risk + HIGH Exposure"].sort_values("neg_sentiment_rate", ascending=False)
overview["headlines"] = {
    "top_aspects_by_negative": [
        {"aspect": k, "negative": int(v["negative"]),
         "share_of_negative_pct": round(v["negative"] / _neg_total * 100, 1)}
        for k, v in _by_neg[:3]
    ],
    "highest_negative_rate_aspect": {
        "aspect": _by_rate[0][0],
        "neg_pct": round(_by_rate[0][1]["negative"] / _by_rate[0][1]["total_mentions"] * 100, 1),
        "total_mentions": int(_by_rate[0][1]["total_mentions"]),
    },
    "late_delivery": {"delivered_orders": int(len(_delivered)), "late_orders": int(_late.sum()),
                      "late_pct": round(float(_late.mean()) * 100, 1)},
    "exposure": {"affected_order_value_BRL": float(_exp["affected_order_value_BRL"]),
                 "affected_orders": int(_exp["affected_orders"]),
                 "at_5_pct_BRL": next(float(r["exposure_BRL"]) for r in _exp["sensitivity_table"]
                                      if r["impact_pct"] == 5.0)},
    "act_first": {"count": int(len(_act_first)),
                  "categories": [{"category": r.category, "neg_sentiment_rate": round(float(r.neg_sentiment_rate), 4),
                                  "review_count": int(r.review_count)} for r in _act_first.head(5).itertuples()]},
}
jdump(overview, OUT / "overview.json")

# ─────────────────────────────────────────────────────────────────────────────
# EXPORT 2 — category_intelligence.json
# ─────────────────────────────────────────────────────────────────────────────
# Low-N threshold: the category minimum chosen in Stage 4 sample-size validation
LOW_N_THRESHOLD = int(s4_m["sample_size_validation"]["category_threshold"])

MAIN_ASPECTS = [
    "Delivery/Logistics", "Product Quality", "Customer Service",
    "Wrong/Missing Item", "Packaging", "Price/Value",
    "Description Mismatch", "Uncategorized"
]

cat_rows = []
for _, row in cat_agg.iterrows():
    cat_rows.append({
        "category":           str(row.get("category", "Unknown")),
        "review_count":       int(row["review_count"]),
        "avg_review_score":   round(float(row["avg_review_score"]), 3),
        "neg_review_rate":    round(float(row["neg_review_rate"]), 4),
        "neg_sentiment_rate": round(float(row["neg_sentiment_rate"]), 4),
        "avg_item_price":     round(float(row["avg_item_price"]), 2),
        "avg_freight":        round(float(row.get("avg_freight", 0)), 2),
        "late_delivery_rate": round(float(row.get("late_delivery_rate", 0)), 4),
        "top_complaint_topic": "" if pd.isna(row.get("top_complaint_aspect")) else str(row["top_complaint_aspect"]),
        "confidence":         str(row.get("confidence", "")),
        "low_n":              bool(int(row["review_count"]) < LOW_N_THRESHOLD),
    })
cat_rows.sort(key=lambda x: x["neg_sentiment_rate"], reverse=True)

# Complaint matrix (category × aspect) — the 20 categories with the most reviews
unexpected = [c for c in complaint_mx.columns if c not in MAIN_ASPECTS]
if unexpected:
    errors.append(f"complaint_matrix has unexpected aspect columns: {unexpected}")
available_aspects = [a for a in MAIN_ASPECTS if a in complaint_mx.columns and a != "Uncategorized"]
by_volume = cat_agg.set_index("category")["review_count"]
heatmap_cats = sorted(complaint_mx.index, key=lambda c: -by_volume.get(c, 0))[:20]
heatmap = {
    "categories": heatmap_cats,
    "aspects":    available_aspects,
    "values": [
        [round(float(complaint_mx.loc[cat, asp]) * 100, 1) if asp in complaint_mx.columns else 0.0
         for asp in available_aspects]
        for cat in heatmap_cats
    ]
}

cat_intelligence = {
    "low_n_threshold": LOW_N_THRESHOLD,
    "categories":       cat_rows,
    "heatmap":          heatmap,
}
jdump(cat_intelligence, OUT / "category_intelligence.json")

# ─────────────────────────────────────────────────────────────────────────────
# EXPORT 3 — delivery.json
# ─────────────────────────────────────────────────────────────────────────────
del_data = s4_m["delivery_analysis"]

# State late rates — merge with state_agg for extra info
state_late = [
    {"state": d["state"], "late_rate_pct": round(d["late_rate"] * 100, 2),
     "order_count": int(d["n"])}
    for d in del_data["top_late_states"]
]

# Category late rates
cat_late = [
    {"category": d["category"], "late_rate_pct": round(d["late_rate"] * 100, 2),
     "order_count": int(d["n"])}
    for d in del_data["top_late_categories"]
]

# Aspect by delivery (late vs on-time)
asp_by_delivery = [
    {
        "aspect":   d["extracted_aspects"],
        "on_time":  int(d.get("on_time", 0)),
        "late":     int(d.get("late", 0)),
    }
    for d in del_data["aspect_by_delivery"]
    if d["extracted_aspects"] in MAIN_ASPECTS
]

# Monthly trends
monthly_rows = []
for _, row in monthly.sort_values("order_month").iterrows():
    monthly_rows.append({
        "month":              str(row["order_month"]),
        "order_count":        int(row["review_count"]),
        "review_count":       int(row.get("review_count", 0)),
        "neg_sentiment_rate": round(float(row["neg_sentiment_rate"]), 4),
    })

delivery = {
    "state_late_rates":    state_late,
    "category_late_rates": cat_late,
    "aspect_by_delivery":  asp_by_delivery,
    "monthly_trends":      monthly_rows,
    "ontime_vs_late":      s4_m["statistical_analysis"]["ontime_vs_late"],
}
jdump(delivery, OUT / "delivery.json")

# ─────────────────────────────────────────────────────────────────────────────
# EXPORT 4 — business_impact.json
# ─────────────────────────────────────────────────────────────────────────────
exp = s4_m["commercial_exposure"]
sens = exp["sensitivity_table"]

# Sensitivity table — already a list of dicts
sensitivity = [
    {
        "impact_pct":   float(row["impact_pct"]),
        "label":        f"{int(row['impact_pct'])}% impact assumption",
        "exposure_BRL": float(row["exposure_BRL"]),
    }
    for row in exp["sensitivity_table"]
]

# Prioritization (2×2)
prio_rows = []
for _, row in prio.iterrows():
    prio_rows.append({
        "category":         str(row.get("product_category_name_english", row.get("category", ""))),
        "segment":          str(row["segment"]),
        "neg_sentiment_rate": round(float(row["neg_sentiment_rate"]), 4),
        "neg_review_rate":  round(float(row.get("neg_review_rate", 0)), 4),
        "total_value":      round(float(row["total_value"]), 2),
        "review_count":     int(row["review_count"]),
        "low_n":            bool(int(row["review_count"]) < LOW_N_THRESHOLD),
    })

# Statistical analysis summary
stat = s4_m["statistical_analysis"]
logit = stat["logistic_regression"]

business_impact = {
    "disclaimer":              "Scenario-based estimate, not observed revenue loss",
    "currency":                "BRL (R$)",
    "affected_order_value_BRL": float(exp["affected_order_value_BRL"]),
    "affected_orders":         int(exp["affected_orders"]),
    "sensitivity_table":       sensitivity,
    "prioritization":          prio_rows,
    "low_n_threshold":         LOW_N_THRESHOLD,
    "prioritization_thresholds": s4_m["prioritization_thresholds"],

    # statistical highlights
    "ontime_vs_late": {
        "ontime_mean": float(stat["ontime_vs_late"]["ontime_mean"]),
        "late_mean":   float(stat["ontime_vs_late"]["late_mean"]),
        "ontime_n":    int(stat["ontime_vs_late"]["ontime_n"]),
        "late_n":      int(stat["ontime_vs_late"]["late_n"]),
    },
    "price_bands": [
        {"band": k, "mean_score": float(v["mean"]), "n": int(v["n"])}
        for k, v in stat["price_bands"]["bands"].items()
    ],
    "logistic_regression": {
        "pseudo_r2":  logit["pseudo_r2"],
        "n_obs":      logit["n_obs"],
        "disclaimer": logit["disclaimer"],
        "coefficients": [
            {"predictor": k, "coef": float(v),
             "p_value": float(logit["p_values"][k])}
            for k, v in logit["coefficients"].items()
        ]
    }
}
jdump(business_impact, OUT / "business_impact.json")

# ─────────────────────────────────────────────────────────────────────────────
# EXPORT 5 — statistical_analysis.json  (dedicated page)
# ─────────────────────────────────────────────────────────────────────────────
stat    = s4_m["statistical_analysis"]
logit   = stat["logistic_regression"]
pb      = stat["price_bands"]

statistical_analysis = {
    "disclaimer": "All results are associations only. This project uses observational data and does not establish causation.",
    # Spearman correlations
    "correlations": [
        {"pair": k, "rho": v["rho"], "n": v.get("n"),
         "p_value": v["p_value"],
         "p_label": "< 1e-300" if v["p_value"] == 0 else f"{v['p_value']:.2e}",
         "significant": bool(v["p_value"] < 0.05)}
        for k, v in stat["correlations"].items()
    ],
    # On-time vs Late
    "ontime_vs_late": {
        "ontime_mean": float(stat["ontime_vs_late"]["ontime_mean"]),
        "late_mean":   float(stat["ontime_vs_late"]["late_mean"]),
        "ontime_n":    int(stat["ontime_vs_late"]["ontime_n"]),
        "late_n":      int(stat["ontime_vs_late"]["late_n"]),
        "test":        "Mann-Whitney U",
        "p_label":     "p < 1e-300" if stat["ontime_vs_late"]["p_value"] == 0 else f"p = {stat['ontime_vs_late']['p_value']:.2e}",
        "significant": bool(stat["ontime_vs_late"]["p_value"] < 0.05),
    },
    # Price bands
    "price_bands": {
        "H_stat": float(pb["H"]),
        "p_value": float(pb["p_value"]),
        "bands": [
            {"band": k, "mean_score": float(v["mean"]), "n": int(v["n"])}
            for k, v in pb["bands"].items()
        ],
    },
    # Logistic regression
    "logistic_regression": {
        "pseudo_r2":  logit["pseudo_r2"],
        "odds_ratios": logit.get("odds_ratios", {}),
        "n_obs":      int(logit["n_obs"]),
        "disclaimer": logit["disclaimer"],
        "coefficients": [
            {"predictor": k, "coef": float(v), "p_value": float(logit["p_values"][k])}
            for k, v in logit["coefficients"].items()
        ],
    },
}
jdump(statistical_analysis, OUT / "statistical_analysis.json")

# ─────────────────────────────────────────────────────────────────────────────
# EXPORT 6 — nlp_insights.json  (NLP Insights page)
# ─────────────────────────────────────────────────────────────────────────────
dist = nlp_m["transformer_sentiment"]["distribution"]

# Aspect rows (sorted by neg_pct desc)
aspect_rows = []
for asp_name, v in nlp_m["aspect_summary"].items():
    total = v["total_mentions"]
    if total == 0:
        continue
    aspect_rows.append({
        "aspect":         asp_name,
        "total_mentions": int(total),
        "negative":       int(v["negative"]),
        "neutral":        int(v.get("neutral", 0)),
        "positive":       int(v["positive"]),
        "neg_pct":        round(v["negative"] / total * 100, 1),
        "pos_pct":        round(v["positive"] / total * 100, 1),
    })
aspect_rows.sort(key=lambda x: x["neg_pct"], reverse=True)

# Topics embedding-based
topics = [
    {"topic_id": t["topic_id"],
     "label": topic_name(t["topic_id"]),
     "review_count": int(t["review_count"]),
     "top_terms": t["representative_terms"][:10]}
    for t in nlp_t.get("embedding_topics", [])
]

# Review score distribution
score_dist = {
    str(int(k)): int(v)
    for k, v in reviews_pq["review_score"].value_counts().sort_index().items()
}

nlp_insights = {
    # Coverage
    "total_reviews":        nlp_m["total_reviews"],
    "reviews_with_text":    nlp_m["reviews_with_text"],
    "text_coverage_pct":    nlp_m["text_coverage_pct"],

    # Sentiment
    "sentiment_distribution": dist,
    "agreement_rate_pct":   nlp_m["transformer_sentiment"]["agreement_rate_pct"],
    "per_score_agreement":  [
        {"score": int(k), "agreement_pct": float(v)}
        for k, v in nlp_m["transformer_sentiment"]["per_score_agreement_pct"].items()
    ],

    # Review score histogram
    "review_score_distribution": score_dist,

    # Aspects
    "aspects": aspect_rows,

    # Topics
    "topics": topics,
}
jdump(nlp_insights, OUT / "nlp_insights.json")

# ─────────────────────────────────────────────────────────────────────────────
# EXPORT 7 — security.json  (fraud and counterfeit signals in review text)
# ─────────────────────────────────────────────────────────────────────────────
fraud_path = S4 / "fraud_signals.json"
if fraud_path.exists():
    fraud = json.loads(fraud_path.read_text(encoding="utf-8"))
    fraud.pop("patterns", None)   # the UI shows the method text; patterns stay in Python
    jdump({"fraud_signals": fraud}, OUT / "security.json")
else:
    print("  [WARN] fraud_signals.json missing - run: python src/analytics/fraud_signals.py")

# ─────────────────────────────────────────────────────────────────────────────
# SUMMARY
# ─────────────────────────────────────────────────────────────────────────────
print()
print("=" * 60)
print("EXPORT SUMMARY")
print("=" * 60)
for f in sorted(OUT.glob("*.json")):
    print(f"  {f.name:35s}  {f.stat().st_size // 1024:>4} KB")

print()
if errors:
    print(f"RECONCILIATION FAILED ({len(errors)} issues):")
    for e in errors:
        print(f"  - {e}")
    sys.exit(1)
else:
    print("All exports reconciled OK.")

# Fingerprint every result file (SHA-256) so later tampering is detectable
from src.security.integrity import write_manifest
_m = write_manifest()
print(f"Integrity manifest: {len(_m['files'])} files fingerprinted (SHA-256).")
