"""
Reconciliation tests on the processed outputs in data/processed/.

Raw-vs-processed checks are skipped when data/raw/ is absent (it is gitignored;
run `python src/data/download_data.py` to fetch it).
"""
import json

import pandas as pd
import pytest

from config.settings import DATA_PROC, DATA_RAW, RAW_FILES

STAGE4 = DATA_PROC / "stage4"
EXPECTED_ASPECTS = {
    "Delivery/Logistics", "Product Quality", "Customer Service", "Wrong/Missing Item",
    "Packaging", "Price/Value", "Description Mismatch", "Uncategorized",
}

needs_raw = pytest.mark.skipif(
    not all((DATA_RAW / f).exists() for f in RAW_FILES.values()),
    reason="data/raw/ not downloaded",
)


@pytest.fixture(scope="module")
def tables():
    names = ["fact_orders", "fact_order_items", "fact_order_reviews",
             "dim_products", "dim_customers", "dim_sellers", "nlp_reviews"]
    return {n: pd.read_parquet(DATA_PROC / f"{n}.parquet") for n in names}


@pytest.fixture(scope="module")
def stage4_metrics():
    return json.loads((STAGE4 / "stage4_metrics.json").read_text(encoding="utf-8"))


# ── Order totals reconcile before and after the transformation ───────────────
@needs_raw
def test_order_item_totals_match_raw(tables):
    raw = pd.read_csv(DATA_RAW / RAW_FILES["items"])
    items = tables["fact_order_items"]
    assert len(items) == len(raw)
    assert items["price"].sum() == pytest.approx(raw["price"].sum(), abs=0.01)
    assert items["freight_value"].sum() == pytest.approx(raw["freight_value"].sum(), abs=0.01)


@needs_raw
def test_no_fact_rows_dropped(tables):
    for key, table in [("orders", "fact_orders"), ("reviews", "fact_order_reviews")]:
        raw = pd.read_csv(DATA_RAW / RAW_FILES[key])
        assert len(tables[table]) == len(raw), table


# ── Keys and joins ───────────────────────────────────────────────────────────
def test_primary_keys_unique(tables):
    assert tables["fact_orders"]["order_id"].is_unique
    assert tables["dim_products"]["product_id"].is_unique
    assert tables["dim_customers"]["customer_id"].is_unique
    assert tables["dim_sellers"]["seller_id"].is_unique
    assert not tables["fact_order_items"].duplicated(["order_id", "order_item_id"]).any()
    # review_id alone is NOT unique in Olist; (review_id, order_id) is
    assert not tables["nlp_reviews"].duplicated(["review_id", "order_id"]).any()


def test_foreign_keys_resolve(tables):
    items, orders = tables["fact_order_items"], tables["fact_orders"]
    assert items["order_id"].isin(orders["order_id"]).all()
    assert items["product_id"].isin(tables["dim_products"]["product_id"]).all()
    assert items["seller_id"].isin(tables["dim_sellers"]["seller_id"]).all()
    assert orders["customer_id"].isin(tables["dim_customers"]["customer_id"]).all()


def test_order_customer_join_is_one_to_one(tables):
    joined = tables["fact_orders"].merge(tables["dim_customers"], on="customer_id", how="left")
    assert len(joined) == len(tables["fact_orders"])


def test_nlp_reviews_are_the_text_subset(tables):
    reviews, nlp = tables["fact_order_reviews"], tables["nlp_reviews"]
    assert len(nlp) == reviews["review_comment_message"].notna().sum()
    assert set(nlp["sentiment_label"]) <= {"Positive", "Neutral", "Negative"}


# ── Stage 4 outputs ──────────────────────────────────────────────────────────
def test_complaint_matrix_has_only_real_aspects():
    # Regression: multi-aspect reviews used to appear as concatenated columns
    matrix = pd.read_csv(STAGE4 / "complaint_matrix.csv", index_col=0)
    assert set(matrix.columns) <= EXPECTED_ASPECTS
    assert ((matrix >= 0) & (matrix <= 1)).all().all()


def test_review_level_totals_reconcile(stage4_metrics):
    n = stage4_metrics["review_level_rows"]
    monthly = pd.read_csv(STAGE4 / "agg_monthly.csv")
    assert monthly["review_count"].sum() == n
    # one review can cover items from several categories, never fewer
    assert pd.read_csv(STAGE4 / "agg_category.csv")["review_count"].sum() >= n


def test_stats_use_one_row_per_review(stage4_metrics, tables):
    s = stage4_metrics["statistical_analysis"]
    n_late_split = s["ontime_vs_late"]["ontime_n"] + s["ontime_vs_late"]["late_n"]
    assert n_late_split == s["n_reviews_analysed"] == s["logistic_regression"]["n_obs"]
    assert n_late_split <= len(tables["nlp_reviews"])


def test_exposure_is_scenario_labelled_and_consistent(stage4_metrics):
    exp = stage4_metrics["commercial_exposure"]
    assert "not observed" in exp["disclaimer"].lower()
    for row in exp["sensitivity_table"]:
        assert row["exposure_BRL"] == pytest.approx(
            exp["affected_order_value_BRL"] * row["impact_pct"] / 100, abs=0.01)


def test_late_rates_are_valid_proportions():
    for f in ["agg_category.csv", "agg_state.csv", "agg_monthly.csv"]:
        rates = pd.read_csv(STAGE4 / f)["late_delivery_rate"].dropna()
        assert rates.between(0, 1).all(), f


# ── SQL layer ────────────────────────────────────────────────────────────────
def test_all_sql_queries_run():
    from src.analytics.validate_sql import main
    assert main() == 0


def test_sql_matches_python_category_complaint_rate():
    from src.analytics.validate_sql import connect
    sql = (DATA_PROC.parent.parent / "sql" / "05_category_complaint_rate.sql").read_text(encoding="utf-8")
    via_sql = connect().execute(sql).df().set_index("category")
    via_py = pd.read_csv(STAGE4 / "agg_category.csv").set_index("category")
    for cat in via_sql.index:
        assert via_sql.loc[cat, "total_reviews"] == via_py.loc[cat, "review_count"]
        assert via_sql.loc[cat, "negative_sentiment_rate"] == pytest.approx(
            via_py.loc[cat, "neg_sentiment_rate"], abs=1e-4)


def test_sandboxed_connection_blocks_file_access():
    import duckdb
    from src.analytics.validate_sql import connect_sandboxed
    conn = connect_sandboxed()
    assert conn.execute("SELECT COUNT(*) FROM nlp_reviews").fetchone()[0] > 0
    with pytest.raises(duckdb.Error):
        conn.execute(f"SELECT * FROM read_csv_auto('{(DATA_PROC.parent.parent / 'README.md').as_posix()}')")
