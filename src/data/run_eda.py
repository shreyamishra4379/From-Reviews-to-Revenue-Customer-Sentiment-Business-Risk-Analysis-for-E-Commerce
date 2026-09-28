"""
run_eda.py — Stage 2 Part A: Exploratory Data Analysis
=======================================================
Reads ONLY from data/processed/ star-schema parquets produced by Stage 1.
Produces charts in reports/figures/ and prints all summary statistics to stdout.

Usage:
    python src/data/run_eda.py
"""
import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
sys.stdout.reconfigure(encoding='utf-8')

import pandas as pd
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
import seaborn as sns
from pathlib import Path
from config.settings import DATA_PROC

# ── Output directory ────────────────────────────────────────────────────
FIGURES_DIR = Path(__file__).resolve().parent.parent.parent / "reports" / "figures"
FIGURES_DIR.mkdir(parents=True, exist_ok=True)

# ── Style ────────────────────────────────────────────────────────────────
sns.set_theme(style="whitegrid", palette="muted", font_scale=1.1)
plt.rcParams.update({
    "figure.dpi": 150,
    "savefig.dpi": 150,
    "savefig.bbox": "tight",
    "figure.figsize": (12, 6),
})

# ═══════════════════════════════════════════════════════════════════════════
#  Load data
# ═══════════════════════════════════════════════════════════════════════════

def load_table(name: str) -> pd.DataFrame:
    return pd.read_parquet(DATA_PROC / name)

print("=" * 80)
print("STAGE 2 — EXPLORATORY DATA ANALYSIS")
print("=" * 80)

fact_orders   = load_table("fact_orders.parquet")
fact_items    = load_table("fact_order_items.parquet")
fact_reviews  = load_table("fact_order_reviews.parquet")
dim_customers = load_table("dim_customers.parquet")
dim_products  = load_table("dim_products.parquet")
dim_sellers   = load_table("dim_sellers.parquet")
dim_payments  = load_table("dim_payments.parquet")
dim_geo       = load_table("dim_geolocation.parquet")

print(f"Loaded: fact_orders={len(fact_orders):,}, fact_items={len(fact_items):,}, "
      f"fact_reviews={len(fact_reviews):,}")
print(f"        dim_customers={len(dim_customers):,}, dim_products={len(dim_products):,}, "
      f"dim_sellers={len(dim_sellers):,}, dim_payments={len(dim_payments):,}, "
      f"dim_geo={len(dim_geo):,}")

# ═══════════════════════════════════════════════════════════════════════════
#  1. ORDER VOLUME OVER TIME
# ═══════════════════════════════════════════════════════════════════════════

print("\n" + "─" * 80)
print("1. ORDER VOLUME OVER TIME")
print("─" * 80)

orders_ts = fact_orders.copy()
orders_ts["order_month"] = orders_ts["order_purchase_timestamp"].dt.to_period("M")
orders_ts["order_week"] = orders_ts["order_purchase_timestamp"].dt.to_period("W")

# Monthly trend
monthly = orders_ts.groupby("order_month").size().reset_index(name="order_count")
monthly["order_month_str"] = monthly["order_month"].astype(str)
print("\nMonthly order volume:")
print(monthly[["order_month_str", "order_count"]].to_string(index=False))

# Check for gaps
all_months = pd.period_range(
    start=monthly["order_month"].min(),
    end=monthly["order_month"].max(),
    freq="M"
)
missing_months = set(all_months) - set(monthly["order_month"])
if missing_months:
    print(f"\n⚠️  MISSING MONTHS (gaps in coverage): {sorted(missing_months)}")
else:
    print("\n✓ No missing months in date coverage.")

# Date range
min_date = fact_orders["order_purchase_timestamp"].min()
max_date = fact_orders["order_purchase_timestamp"].max()
print(f"\nDate range: {min_date} to {max_date}")

# Monthly chart
fig, ax = plt.subplots(figsize=(14, 5))
ax.bar(range(len(monthly)), monthly["order_count"], color="#4C72B0", edgecolor="white")
ax.set_xticks(range(len(monthly)))
ax.set_xticklabels(monthly["order_month_str"], rotation=45, ha="right", fontsize=8)
ax.set_xlabel("Month")
ax.set_ylabel("Order Count")
ax.set_title("Monthly Order Volume")
ax.yaxis.set_major_formatter(mticker.FuncFormatter(lambda x, _: f"{int(x):,}"))
plt.tight_layout()
fig.savefig(FIGURES_DIR / "01_monthly_order_volume.png")
plt.close(fig)

# Weekly trend
weekly = orders_ts.groupby("order_week").size().reset_index(name="order_count")
weekly["order_week_str"] = weekly["order_week"].astype(str)

fig, ax = plt.subplots(figsize=(16, 5))
ax.plot(range(len(weekly)), weekly["order_count"], linewidth=0.8, color="#4C72B0")
ax.set_xlabel("Week")
ax.set_ylabel("Order Count")
ax.set_title("Weekly Order Volume")
# Show only every 10th tick
tick_positions = range(0, len(weekly), 10)
ax.set_xticks(tick_positions)
ax.set_xticklabels([weekly["order_week_str"].iloc[i] for i in tick_positions],
                    rotation=45, ha="right", fontsize=7)
plt.tight_layout()
fig.savefig(FIGURES_DIR / "02_weekly_order_volume.png")
plt.close(fig)

# Flag anomaly: look for weeks with unusually low or high volume
weekly_mean = weekly["order_count"].mean()
weekly_std = weekly["order_count"].std()
anomalies = weekly[
    (weekly["order_count"] < weekly_mean - 2 * weekly_std) |
    (weekly["order_count"] > weekly_mean + 2 * weekly_std)
]
if len(anomalies) > 0:
    print(f"\n⚠️  Weeks with volume > 2σ from mean ({weekly_mean:.0f} ± {weekly_std:.0f}):")
    print(anomalies[["order_week_str", "order_count"]].to_string(index=False))
else:
    print(f"\n✓ No weekly anomalies (mean={weekly_mean:.0f}, std={weekly_std:.0f})")


# ═══════════════════════════════════════════════════════════════════════════
#  2. REVENUE DISTRIBUTION
# ═══════════════════════════════════════════════════════════════════════════

print("\n" + "─" * 80)
print("2. REVENUE DISTRIBUTION")
print("─" * 80)

# ── 2a. Item-level revenue stats ────────────────────────────────────────
print("\n--- Price (from fact_order_items) ---")
print(fact_items["price"].describe(percentiles=[0.25, 0.5, 0.75, 0.9, 0.95, 0.99]).to_string())

print("\n--- Freight Value (from fact_order_items) ---")
print(fact_items["freight_value"].describe(percentiles=[0.25, 0.5, 0.75, 0.9, 0.95, 0.99]).to_string())

print("\n--- Payment Value (from dim_payments: total_payment_value) ---")
print(dim_payments["total_payment_value"].describe(
    percentiles=[0.25, 0.5, 0.75, 0.9, 0.95, 0.99]).to_string())

# ── 2b. Revenue by category ────────────────────────────────────────────
items_with_cat = fact_items.merge(
    dim_products[["product_id", "product_category_name_english"]],
    on="product_id", how="left"
)
items_with_cat["item_revenue"] = items_with_cat["price"] + items_with_cat["freight_value"]

rev_by_cat = (
    items_with_cat.groupby("product_category_name_english")
    .agg(
        total_revenue=("item_revenue", "sum"),
        order_count=("order_id", "nunique"),
        item_count=("order_id", "count"),
    )
    .sort_values("total_revenue", ascending=False)
    .reset_index()
)
rev_by_cat["pct_revenue"] = rev_by_cat["total_revenue"] / rev_by_cat["total_revenue"].sum() * 100

print("\n--- Top 20 Categories by Revenue (price + freight_value) ---")
print(rev_by_cat.head(20).to_string(index=False, float_format="%.2f"))

# Chart: Top 15 categories by revenue
top15_cat = rev_by_cat.head(15)
fig, ax = plt.subplots(figsize=(12, 7))
ax.barh(range(len(top15_cat)), top15_cat["total_revenue"], color="#4C72B0")
ax.set_yticks(range(len(top15_cat)))
ax.set_yticklabels(top15_cat["product_category_name_english"], fontsize=9)
ax.invert_yaxis()
ax.set_xlabel("Total Revenue (R$)")
ax.set_title("Top 15 Categories by Revenue (price + freight)")
ax.xaxis.set_major_formatter(mticker.FuncFormatter(lambda x, _: f"R$ {x/1e6:.1f}M"))
plt.tight_layout()
fig.savefig(FIGURES_DIR / "03_revenue_by_category_top15.png")
plt.close(fig)

# ── 2c. Revenue by state (customer state) ──────────────────────────────
items_with_state = fact_items.merge(
    fact_orders[["order_id", "customer_id"]], on="order_id", how="left"
).merge(
    dim_customers[["customer_id", "state"]], on="customer_id", how="left"
)
items_with_state["item_revenue"] = items_with_state["price"] + items_with_state["freight_value"]

rev_by_state = (
    items_with_state.groupby("state")
    .agg(
        total_revenue=("item_revenue", "sum"),
        order_count=("order_id", "nunique"),
    )
    .sort_values("total_revenue", ascending=False)
    .reset_index()
)
rev_by_state["pct_revenue"] = rev_by_state["total_revenue"] / rev_by_state["total_revenue"].sum() * 100

print("\n--- Revenue by Customer State ---")
print(rev_by_state.to_string(index=False, float_format="%.2f"))

fig, ax = plt.subplots(figsize=(14, 6))
ax.bar(rev_by_state["state"], rev_by_state["total_revenue"], color="#4C72B0", edgecolor="white")
ax.set_xlabel("Customer State")
ax.set_ylabel("Total Revenue (R$)")
ax.set_title("Revenue by Customer State")
ax.yaxis.set_major_formatter(mticker.FuncFormatter(lambda x, _: f"R$ {x/1e6:.1f}M"))
plt.xticks(rotation=45)
plt.tight_layout()
fig.savefig(FIGURES_DIR / "04_revenue_by_state.png")
plt.close(fig)

# ── 2d. Revenue by payment type ────────────────────────────────────────
rev_by_ptype = (
    dim_payments.groupby("primary_payment_type")
    .agg(
        total_payment=("total_payment_value", "sum"),
        order_count=("order_id", "count"),
    )
    .sort_values("total_payment", ascending=False)
    .reset_index()
)
rev_by_ptype["pct_payment"] = rev_by_ptype["total_payment"] / rev_by_ptype["total_payment"].sum() * 100

print("\n--- Revenue by Payment Type (total_payment_value from dim_payments) ---")
print(rev_by_ptype.to_string(index=False, float_format="%.2f"))

fig, ax = plt.subplots(figsize=(8, 5))
ax.bar(rev_by_ptype["primary_payment_type"], rev_by_ptype["total_payment"],
       color=["#4C72B0", "#DD8452", "#55A868", "#C44E52", "#8172B3"][:len(rev_by_ptype)])
ax.set_xlabel("Primary Payment Type")
ax.set_ylabel("Total Payment Value (R$)")
ax.set_title("Revenue by Primary Payment Type")
ax.yaxis.set_major_formatter(mticker.FuncFormatter(lambda x, _: f"R$ {x/1e6:.1f}M"))
plt.tight_layout()
fig.savefig(FIGURES_DIR / "05_revenue_by_payment_type.png")
plt.close(fig)


# ═══════════════════════════════════════════════════════════════════════════
#  3. DELIVERY PERFORMANCE
# ═══════════════════════════════════════════════════════════════════════════

print("\n" + "─" * 80)
print("3. DELIVERY PERFORMANCE")
print("─" * 80)

delivered = fact_orders[fact_orders["order_delivered_customer_date"].notna()].copy()
delivered["delivery_delay_days"] = (
    delivered["order_delivered_customer_date"] - delivered["order_estimated_delivery_date"]
).dt.total_seconds() / 86400.0

print(f"\nTotal orders: {len(fact_orders):,}")
print(f"Orders with delivery date (delivered): {len(delivered):,}")
print(f"Orders without delivery date: {len(fact_orders) - len(delivered):,}")

print("\n--- Delivery Delay (days) Summary ---")
print(f"  (negative = delivered early, positive = delivered late)")
print(delivered["delivery_delay_days"].describe(
    percentiles=[0.01, 0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95, 0.99]
).to_string())

on_time = (delivered["delivery_delay_days"] <= 0).sum()
late = (delivered["delivery_delay_days"] > 0).sum()
print(f"\nOn-time or early: {on_time:,} ({on_time/len(delivered)*100:.2f}%)")
print(f"Late: {late:,} ({late/len(delivered)*100:.2f}%)")

# Delay distribution chart
fig, axes = plt.subplots(1, 2, figsize=(16, 5))

# Histogram
axes[0].hist(delivered["delivery_delay_days"].clip(-30, 60), bins=90,
             color="#4C72B0", edgecolor="white", alpha=0.8)
axes[0].axvline(0, color="red", linestyle="--", linewidth=1.5, label="On-time boundary")
axes[0].set_xlabel("Delivery Delay (days)")
axes[0].set_ylabel("Count")
axes[0].set_title("Delivery Delay Distribution (clipped to [-30, 60])")
axes[0].legend()

# Box plot
axes[1].boxplot(delivered["delivery_delay_days"].dropna(), vert=True, widths=0.5,
                patch_artist=True,
                boxprops=dict(facecolor="#4C72B0", alpha=0.7))
axes[1].set_ylabel("Delivery Delay (days)")
axes[1].set_title("Delivery Delay Box Plot")
plt.tight_layout()
fig.savefig(FIGURES_DIR / "06_delivery_delay_distribution.png")
plt.close(fig)

# ── 3a. Delay rate by customer state ────────────────────────────────────
delivered_state = delivered.merge(
    fact_orders[["order_id", "customer_id"]], on="order_id", how="left"
    # order_id already in delivered, but we need customer_id
    # Actually delivered IS a copy of fact_orders rows, so customer_id is already there
)
# customer_id is already in 'delivered' since it's a copy of fact_orders
delivered_cust = delivered.merge(
    dim_customers[["customer_id", "state"]], on="customer_id", how="left"
)
delivered_cust["is_late"] = delivered_cust["delivery_delay_days"] > 0

delay_by_state = (
    delivered_cust.groupby("state")
    .agg(
        total_orders=("order_id", "count"),
        late_orders=("is_late", "sum"),
    )
    .reset_index()
)
delay_by_state["delay_rate_pct"] = delay_by_state["late_orders"] / delay_by_state["total_orders"] * 100
delay_by_state = delay_by_state.sort_values("delay_rate_pct", ascending=False)

print("\n--- Delay Rate by Customer State ---")
print(delay_by_state.to_string(index=False, float_format="%.2f"))

fig, ax = plt.subplots(figsize=(14, 6))
colors = ["#C44E52" if r > 10 else "#4C72B0" for r in delay_by_state["delay_rate_pct"]]
ax.bar(delay_by_state["state"], delay_by_state["delay_rate_pct"], color=colors, edgecolor="white")
ax.axhline(delay_by_state["delay_rate_pct"].mean(), color="red", linestyle="--",
           label=f"Mean: {delay_by_state['delay_rate_pct'].mean():.1f}%")
ax.set_xlabel("Customer State")
ax.set_ylabel("Delay Rate (%)")
ax.set_title("Delivery Delay Rate by Customer State (>0 days late)")
ax.legend()
plt.xticks(rotation=45)
plt.tight_layout()
fig.savefig(FIGURES_DIR / "07_delay_rate_by_state.png")
plt.close(fig)

# ── 3b. Delay rate by category ─────────────────────────────────────────
delivered_items = delivered.merge(
    fact_items[["order_id", "product_id"]], on="order_id", how="left"
).merge(
    dim_products[["product_id", "product_category_name_english"]], on="product_id", how="left"
)
delivered_items["is_late"] = delivered_items["delivery_delay_days"] > 0

delay_by_cat = (
    delivered_items.groupby("product_category_name_english")
    .agg(
        total_items=("order_id", "count"),
        late_items=("is_late", "sum"),
    )
    .reset_index()
)
delay_by_cat["delay_rate_pct"] = delay_by_cat["late_items"] / delay_by_cat["total_items"] * 100
delay_by_cat = delay_by_cat.sort_values("delay_rate_pct", ascending=False)

# Show only categories with >=50 items for meaningful rates
delay_by_cat_sig = delay_by_cat[delay_by_cat["total_items"] >= 50]

print("\n--- Delay Rate by Category (categories with ≥50 items) — Top 20 ---")
print(delay_by_cat_sig.head(20).to_string(index=False, float_format="%.2f"))

fig, ax = plt.subplots(figsize=(12, 8))
top20_delay_cat = delay_by_cat_sig.head(20)
ax.barh(range(len(top20_delay_cat)), top20_delay_cat["delay_rate_pct"], color="#C44E52")
ax.set_yticks(range(len(top20_delay_cat)))
ax.set_yticklabels(top20_delay_cat["product_category_name_english"], fontsize=9)
ax.invert_yaxis()
ax.set_xlabel("Delay Rate (%)")
ax.set_title("Top 20 Categories by Delivery Delay Rate (≥50 items)")
plt.tight_layout()
fig.savefig(FIGURES_DIR / "08_delay_rate_by_category_top20.png")
plt.close(fig)


# ═══════════════════════════════════════════════════════════════════════════
#  4. REVIEW SCORE DISTRIBUTION
# ═══════════════════════════════════════════════════════════════════════════

print("\n" + "─" * 80)
print("4. REVIEW SCORE DISTRIBUTION")
print("─" * 80)

# Overall distribution
print("\n--- Overall Review Score Distribution ---")
score_dist = fact_reviews["review_score"].value_counts().sort_index()
for score, cnt in score_dist.items():
    pct = cnt / len(fact_reviews) * 100
    print(f"  Score {score}: {cnt:>8,} ({pct:5.2f}%)")

print(f"\nMean: {fact_reviews['review_score'].mean():.3f}")
print(f"Median: {fact_reviews['review_score'].median():.1f}")
print(f"Std: {fact_reviews['review_score'].std():.3f}")

fig, ax = plt.subplots(figsize=(8, 5))
ax.bar(score_dist.index, score_dist.values, color="#4C72B0", edgecolor="white")
ax.set_xlabel("Review Score")
ax.set_ylabel("Count")
ax.set_title("Overall Review Score Distribution")
for i, (score, cnt) in enumerate(score_dist.items()):
    ax.text(score, cnt + 500, f"{cnt/len(fact_reviews)*100:.1f}%", ha="center", fontsize=9)
plt.tight_layout()
fig.savefig(FIGURES_DIR / "09_review_score_distribution.png")
plt.close(fig)

# ── 4a. Review score by category ───────────────────────────────────────
reviews_with_cat = fact_reviews.merge(
    fact_items[["order_id", "product_id"]].drop_duplicates("order_id"),
    on="order_id", how="left"
).merge(
    dim_products[["product_id", "product_category_name_english"]],
    on="product_id", how="left"
)

score_by_cat = (
    reviews_with_cat.groupby("product_category_name_english")
    .agg(
        mean_score=("review_score", "mean"),
        median_score=("review_score", "median"),
        review_count=("review_score", "count"),
    )
    .reset_index()
)
score_by_cat_sig = score_by_cat[score_by_cat["review_count"] >= 30].sort_values("mean_score")

print("\n--- Review Score by Category (≥30 reviews) — Bottom 15 (lowest scores) ---")
print(score_by_cat_sig.head(15).to_string(index=False, float_format="%.3f"))

print("\n--- Review Score by Category (≥30 reviews) — Top 15 (highest scores) ---")
print(score_by_cat_sig.tail(15).to_string(index=False, float_format="%.3f"))

fig, ax = plt.subplots(figsize=(12, 8))
bottom15 = score_by_cat_sig.head(15)
top15 = score_by_cat_sig.tail(15)
combined = pd.concat([bottom15, top15])
colors = ["#C44E52"] * len(bottom15) + ["#55A868"] * len(top15)
ax.barh(range(len(combined)), combined["mean_score"], color=colors)
ax.set_yticks(range(len(combined)))
ax.set_yticklabels(combined["product_category_name_english"], fontsize=8)
ax.set_xlabel("Mean Review Score")
ax.set_title("Bottom 15 & Top 15 Categories by Mean Review Score (≥30 reviews)")
ax.axvline(fact_reviews["review_score"].mean(), color="gray", linestyle="--",
           label=f"Overall mean: {fact_reviews['review_score'].mean():.2f}")
ax.legend()
plt.tight_layout()
fig.savefig(FIGURES_DIR / "10_review_score_by_category.png")
plt.close(fig)

# ── 4b. Review score by delivery delay bucket ─────────────────────────
reviews_with_delay = fact_reviews.merge(
    delivered[["order_id", "delivery_delay_days"]], on="order_id", how="inner"
)
reviews_with_delay["delay_bucket"] = pd.cut(
    reviews_with_delay["delivery_delay_days"],
    bins=[-np.inf, -7, 0, 7, 14, np.inf],
    labels=["7+ days early", "0-7 days early", "1-7 days late", "8-14 days late", "15+ days late"]
)

score_by_delay = (
    reviews_with_delay.groupby("delay_bucket", observed=True)
    .agg(
        mean_score=("review_score", "mean"),
        median_score=("review_score", "median"),
        std_score=("review_score", "std"),
        review_count=("review_score", "count"),
        pct_score_1=("review_score", lambda x: (x == 1).sum() / len(x) * 100),
        pct_score_5=("review_score", lambda x: (x == 5).sum() / len(x) * 100),
    )
    .reset_index()
)

print("\n--- Review Score by Delivery Delay Bucket ---")
print(score_by_delay.to_string(index=False, float_format="%.3f"))

fig, ax = plt.subplots(figsize=(10, 5))
ax.bar(range(len(score_by_delay)), score_by_delay["mean_score"],
       color=["#55A868", "#55A868", "#DD8452", "#C44E52", "#C44E52"][:len(score_by_delay)],
       edgecolor="white")
ax.set_xticks(range(len(score_by_delay)))
ax.set_xticklabels(score_by_delay["delay_bucket"], rotation=20, ha="right")
ax.set_ylabel("Mean Review Score")
ax.set_title("Mean Review Score by Delivery Delay Bucket")
for i, row in score_by_delay.iterrows():
    ax.text(i, row["mean_score"] + 0.05, f"{row['mean_score']:.2f}\n(n={row['review_count']:,})",
            ha="center", fontsize=9)
ax.set_ylim(0, 5.5)
plt.tight_layout()
fig.savefig(FIGURES_DIR / "11_review_score_by_delay_bucket.png")
plt.close(fig)

# Simple on-time vs late comparison
reviews_with_delay["on_time"] = reviews_with_delay["delivery_delay_days"] <= 0
ontime_vs_late = (
    reviews_with_delay.groupby("on_time")
    .agg(
        mean_score=("review_score", "mean"),
        median_score=("review_score", "median"),
        count=("review_score", "count"),
    )
    .reset_index()
)
ontime_vs_late["label"] = ontime_vs_late["on_time"].map({True: "On-time/Early", False: "Late"})

print("\n--- Review Score: On-time vs Late (simple split) ---")
print(ontime_vs_late[["label", "mean_score", "median_score", "count"]].to_string(index=False, float_format="%.3f"))


# ═══════════════════════════════════════════════════════════════════════════
#  5. CUSTOMER GEOGRAPHY
# ═══════════════════════════════════════════════════════════════════════════

print("\n" + "─" * 80)
print("5. CUSTOMER GEOGRAPHY")
print("─" * 80)

# Orders by customer state
orders_with_cust = fact_orders.merge(
    dim_customers[["customer_id", "state", "city"]], on="customer_id", how="left"
)
orders_by_state = (
    orders_with_cust.groupby("state")
    .agg(order_count=("order_id", "count"))
    .sort_values("order_count", ascending=False)
    .reset_index()
)
orders_by_state["pct"] = orders_by_state["order_count"] / orders_by_state["order_count"].sum() * 100
orders_by_state["cumulative_pct"] = orders_by_state["pct"].cumsum()

print("\n--- Order Concentration by Customer State ---")
print(orders_by_state.to_string(index=False, float_format="%.2f"))

fig, ax = plt.subplots(figsize=(14, 6))
ax.bar(orders_by_state["state"], orders_by_state["order_count"], color="#4C72B0", edgecolor="white")
ax2 = ax.twinx()
ax2.plot(orders_by_state["state"], orders_by_state["cumulative_pct"], color="#C44E52",
         marker="o", markersize=4, linewidth=1.5, label="Cumulative %")
ax2.set_ylabel("Cumulative %")
ax2.axhline(80, color="gray", linestyle="--", alpha=0.5)
ax.set_xlabel("Customer State")
ax.set_ylabel("Order Count")
ax.set_title("Order Concentration by Customer State (with cumulative %)")
ax2.legend(loc="center right")
plt.xticks(rotation=45)
plt.tight_layout()
fig.savefig(FIGURES_DIR / "12_order_concentration_by_state.png")
plt.close(fig)

# Top 20 cities
orders_by_city = (
    orders_with_cust.groupby(["state", "city"])
    .agg(order_count=("order_id", "count"))
    .sort_values("order_count", ascending=False)
    .reset_index()
)
orders_by_city["pct"] = orders_by_city["order_count"] / orders_by_city["order_count"].sum() * 100

print("\n--- Top 20 Cities by Order Count ---")
print(orders_by_city.head(20).to_string(index=False, float_format="%.2f"))

# Geolocation enrichment (just verify geo has coverage for customer zips)
customer_zips = dim_customers["zip_code_prefix"].nunique()
geo_zips = dim_geo["zip_code_prefix"].nunique()
covered = dim_customers["zip_code_prefix"].isin(dim_geo["zip_code_prefix"]).sum()
print(f"\nGeolocation coverage: {covered:,}/{len(dim_customers):,} customers have matching zip "
      f"in geolocation ({covered/len(dim_customers)*100:.1f}%)")
print(f"  Unique customer zips: {customer_zips:,} | Unique geo zips: {geo_zips:,}")


# ═══════════════════════════════════════════════════════════════════════════
#  6. SELLER CONCENTRATION
# ═══════════════════════════════════════════════════════════════════════════

print("\n" + "─" * 80)
print("6. SELLER CONCENTRATION")
print("─" * 80)

items_revenue = fact_items.copy()
items_revenue["item_revenue"] = items_revenue["price"] + items_revenue["freight_value"]

seller_agg = (
    items_revenue.groupby("seller_id")
    .agg(
        order_count=("order_id", "nunique"),
        item_count=("order_id", "count"),
        total_revenue=("item_revenue", "sum"),
    )
    .sort_values("total_revenue", ascending=False)
    .reset_index()
)
seller_agg["pct_revenue"] = seller_agg["total_revenue"] / seller_agg["total_revenue"].sum() * 100
seller_agg["cum_pct_revenue"] = seller_agg["pct_revenue"].cumsum()
seller_agg["pct_orders"] = seller_agg["order_count"] / seller_agg["order_count"].sum() * 100
seller_agg["cum_pct_orders"] = seller_agg["pct_orders"].cumsum()

print(f"\nTotal unique sellers: {len(seller_agg):,}")
print(f"\nSeller Revenue Summary:")
print(seller_agg["total_revenue"].describe(
    percentiles=[0.25, 0.5, 0.75, 0.9, 0.95, 0.99]).to_string())

# Concentration analysis
for threshold in [50, 80, 90]:
    n_for_rev = (seller_agg["cum_pct_revenue"] <= threshold).sum() + 1
    n_for_ord = (seller_agg["cum_pct_orders"] <= threshold).sum() + 1
    print(f"\n  {threshold}% of revenue comes from {n_for_rev:,} sellers "
          f"({n_for_rev/len(seller_agg)*100:.1f}% of all sellers)")
    print(f"  {threshold}% of orders comes from {n_for_ord:,} sellers "
          f"({n_for_ord/len(seller_agg)*100:.1f}% of all sellers)")

print("\n--- Top 10 Sellers by Revenue ---")
print(seller_agg.head(10)[["seller_id", "order_count", "item_count", "total_revenue",
                            "pct_revenue", "cum_pct_revenue"]].to_string(index=False, float_format="%.2f"))

# Chart: Seller revenue Pareto
fig, ax = plt.subplots(figsize=(12, 5))
x = range(len(seller_agg))
ax.fill_between(x, seller_agg["cum_pct_revenue"], alpha=0.3, color="#4C72B0")
ax.plot(x, seller_agg["cum_pct_revenue"], color="#4C72B0", linewidth=1.5)
ax.axhline(80, color="red", linestyle="--", alpha=0.7, label="80% threshold")
ax.set_xlabel("Sellers (ranked by revenue)")
ax.set_ylabel("Cumulative % of Revenue")
ax.set_title("Seller Revenue Concentration (Pareto Curve)")
ax.legend()
plt.tight_layout()
fig.savefig(FIGURES_DIR / "13_seller_revenue_pareto.png")
plt.close(fig)

# Seller order-count distribution
fig, ax = plt.subplots(figsize=(10, 5))
ax.hist(seller_agg["order_count"].clip(upper=200), bins=100, color="#4C72B0", edgecolor="white")
ax.set_xlabel("Orders per Seller (clipped at 200)")
ax.set_ylabel("Number of Sellers")
ax.set_title("Distribution of Orders per Seller")
plt.tight_layout()
fig.savefig(FIGURES_DIR / "14_seller_order_distribution.png")
plt.close(fig)


# ═══════════════════════════════════════════════════════════════════════════
#  7. OUTLIER FLAGGING
# ═══════════════════════════════════════════════════════════════════════════

print("\n" + "─" * 80)
print("7. OUTLIER FLAGGING")
print("─" * 80)

def flag_outliers_iqr(series: pd.Series, name: str, multiplier: float = 1.5):
    """Flag outliers using IQR method and report counts."""
    Q1 = series.quantile(0.25)
    Q3 = series.quantile(0.75)
    IQR = Q3 - Q1
    lower = Q1 - multiplier * IQR
    upper = Q3 + multiplier * IQR
    outlier_low = (series < lower).sum()
    outlier_high = (series > upper).sum()
    total = series.notna().sum()
    print(f"\n  {name}:")
    print(f"    Q1={Q1:.2f}, Q3={Q3:.2f}, IQR={IQR:.2f}")
    print(f"    Lower fence: {lower:.2f}, Upper fence: {upper:.2f}")
    print(f"    Outliers below: {outlier_low:,} ({outlier_low/total*100:.2f}%)")
    print(f"    Outliers above: {outlier_high:,} ({outlier_high/total*100:.2f}%)")
    print(f"    Total outliers: {outlier_low + outlier_high:,} ({(outlier_low+outlier_high)/total*100:.2f}%)")
    # Extreme values
    print(f"    Min: {series.min():.2f}, Max: {series.max():.2f}")
    print(f"    Top 5 values: {sorted(series.dropna().values, reverse=True)[:5]}")
    return lower, upper

# Price outliers
print("\n--- Price Outliers (fact_order_items.price) ---")
lo_p, hi_p = flag_outliers_iqr(fact_items["price"], "price")

# Freight outliers
print("\n--- Freight Value Outliers (fact_order_items.freight_value) ---")
lo_f, hi_f = flag_outliers_iqr(fact_items["freight_value"], "freight_value")

# Delivery delay outliers
print("\n--- Delivery Delay Outliers (delivery_delay_days) ---")
lo_d, hi_d = flag_outliers_iqr(delivered["delivery_delay_days"], "delivery_delay_days")

# Payment value outliers
print("\n--- Payment Value Outliers (dim_payments.total_payment_value) ---")
lo_pv, hi_pv = flag_outliers_iqr(dim_payments["total_payment_value"], "total_payment_value")

print("\n" + "─" * 80)
print("PROPOSED OUTLIER TREATMENT (awaiting user confirmation)")
print("─" * 80)
print("""
  1. price: Add is_price_outlier flag column to features table
     - Upper fence ~R$ {:.2f}; extreme max visible
     - Proposed: Keep in base data, flag for downstream analyses
     - Do NOT exclude from base processed tables

  2. freight_value: Add is_freight_outlier flag column
     - Upper fence ~R$ {:.2f}
     - Proposed: Keep in base data, flag for downstream analyses

  3. delivery_delay_days: Add is_delay_outlier flag column
     - Upper fence ~{:.1f} days; extreme delays may be data entry errors
     - Proposed: Keep in base data, flag for downstream analyses
     - Note: extreme negative values (delivered long before estimate) are valid

  4. total_payment_value: Add is_payment_outlier flag column
     - Upper fence ~R$ {:.2f}
     - Proposed: Keep in base data, flag for downstream analyses

  All flags will be boolean columns in the features table.
  No data will be removed from data/processed/*.parquet.
""".format(hi_p, hi_f, hi_d, hi_pv))


# ═══════════════════════════════════════════════════════════════════════════
#  8. EDA FINDINGS SUMMARY
# ═══════════════════════════════════════════════════════════════════════════

print("\n" + "=" * 80)
print("EDA FINDINGS SUMMARY")
print("=" * 80)

print("""
OBSERVED FINDINGS:

1. ORDER VOLUME: Orders span from {min_d} to {max_d}. Volume ramped up
   significantly during 2017 and plateaued in 2018. [Check printed stats
   for exact monthly counts and any gap/anomaly flags above.]

2. REVENUE CONCENTRATION: São Paulo (SP) dominates revenue. Top product
   categories by revenue are printed above. Credit card is the dominant
   payment type.

3. DELIVERY: The majority of orders are delivered on time or early.
   Late delivery rate and delay magnitude vary by state and by category.
   [Exact rates printed above.]

4. REVIEW SCORES: Distribution is heavily right-skewed (most common = 5).
   Mean score is ~{mean_score:.2f}. Late deliveries are associated with
   lower mean review scores — this is an observed association, not a
   causal claim.
   *** CANDIDATE SIGNAL FOR STAGE 3: delivery delay ↔ review score
       relationship — compute exact correlation and test significance
       in Stage 3. ***

5. CUSTOMER GEOGRAPHY: Orders are heavily concentrated in southeastern
   Brazil (SP, RJ, MG). [Exact state/city breakdown printed above.]

6. SELLER CONCENTRATION: A small fraction of sellers accounts for the
   majority of revenue. [Exact Pareto numbers printed above.] This means
   grouped statistics by seller may be unstable for long-tail sellers.
   *** CANDIDATE SIGNAL FOR STAGE 3: seller volume ↔ review quality —
       check whether high-volume sellers have systematically different
       review distributions than low-volume sellers. ***

7. OUTLIERS: Price, freight, delivery delay, and payment value all have
   right-tail outliers. Proposed treatment: flag columns (not destructive
   removal). Awaiting user confirmation.

   *** CANDIDATE SIGNAL FOR STAGE 3: extreme freight ratios or prices
       may correlate with review complaints — test after NLP extraction. ***
""".format(
    min_d=min_date.strftime("%Y-%m-%d"),
    max_d=max_date.strftime("%Y-%m-%d"),
    mean_score=fact_reviews["review_score"].mean()
))

print("=" * 80)
print("EDA COMPLETE — Charts saved to reports/figures/")
print("=" * 80)
