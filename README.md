# Sentiment-to-Outcome Analytics: An NLP-Driven Risk Assessment Framework for E-Commerce

> **Currency:** All monetary values are in Brazilian Reais (R$ BRL). No ₹ or $ symbols are used anywhere in this project.

---

## Executive Summary

This project builds an end-to-end data science portfolio demonstrating how natural-language signals in customer reviews can be quantified and connected to measurable business outcomes. Using the public Olist Brazilian E-Commerce dataset (99,224 orders, 9 relational tables), the pipeline integrates a star-schema data warehouse, multilingual NLP sentiment analysis and topic modeling on 40,977 Portuguese-language reviews (41.3% of all reviews), Spearman rank correlations and non-parametric group tests, and a scenario-based commercial exposure model — all producing analytical outputs joinable to revenue, delivery, and seller data. The goal is to answer: **which product categories and sellers carry the highest NLP-verified complaint risk, how strongly does delivery timing associate with review scores, and what is the estimated order-value exposure tied to negative customer experience?**

---

## 1. Business Problem

E-commerce platforms receive thousands of reviews, but most business decisions rely on aggregate star ratings alone — ignoring the nuance in written text. This project addresses three core questions:

1. **What are customers actually complaining about?** (NLP topic and aspect extraction)
2. **Which categories/sellers have disproportionate complaint risk relative to their revenue exposure?** (Business prioritization)
3. **How strongly do operational factors — delivery delay, price, freight — associate with negative reviews?** (Statistical analysis, association only, not causal)

---

## 2. Dataset Description & Real Constraints

**Source:** Olist Brazilian E-Commerce Public Dataset, downloaded via `kagglehub`.

```python
import kagglehub
path = kagglehub.dataset_download("olistbr/brazilian-ecommerce")
```

**9 CSV files:** customers, geolocation, order_items, order_payments, order_reviews, orders, products, sellers, category_name_translation.

| Table | Rows |
|---|---|
| orders | 99,441 |
| order_items | 112,650 |
| order_reviews | 99,224 |
| products | 32,951 |
| customers | 99,441 |
| sellers | 3,095 |

**Real constraints discovered during this project:**
- **Currency:** BRL only. No cost, profit, or CLV data available.
- **No returns/refund table.** Cannot compute actual return rates or financial impact of returns.
- **No product size/fit attributes.** Sizing complaints cannot be verified against specs.
- **Review text coverage: only 41.3%** (40,977 of 99,224 reviews) have non-null `review_comment_message`. All NLP analyses apply only to this subset.
- **Language: Portuguese.** All review text is in Portuguese; a multilingual model was used directly (see NLP section).
- **Positive-review skew:** 57,328 of 99,224 reviews (57.8%) are 5-star. This affects complaint analysis — negative patterns are derived from a minority of the total review corpus.
- **Seller identity:** Sellers are anonymized using Game of Thrones house names in this project.

---

## 3. Data Architecture — Star Schema

Built in Stage 1. All tables saved to `data/processed/` as Parquet.

```
                    ┌─────────────────┐
                    │  fact_orders    │
                    │  (99,441 rows)  │
                    └────────┬────────┘
                             │ order_id
          ┌──────────────────┼──────────────────┐
          │                  │                  │
┌─────────▼──────┐  ┌────────▼──────┐  ┌───────▼──────────┐
│fact_order_items│  │fact_order_    │  │fact_order_reviews │
│(112,650 rows)  │  │reviews        │  │+ nlp_reviews      │
│price, freight  │  │(99,224 rows)  │  │(40,977 NLP rows)  │
└────┬───────────┘  └───────────────┘  └───────────────────┘
     │ product_id / seller_id / customer_id
     │
┌────▼──────┐  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐
│dim_products│  │dim_sellers  │  │dim_customers │  │dim_payments  │
│(32,951)   │  │(3,095)      │  │(99,441)      │  │(103,886)     │
└───────────┘  └─────────────┘  └──────────────┘  └──────────────┘
```

---

## 4. Data Dictionary

### Fact Tables

| Column | Table | Description |
|---|---|---|
| `order_id` | fact_orders | Primary key |
| `order_delivered_customer_date` | fact_orders | Actual delivery date |
| `order_estimated_delivery_date` | fact_orders | Estimated delivery date |
| `price` | fact_order_items | Item price in R$ |
| `freight_value` | fact_order_items | Freight cost in R$ |
| `review_score` | fact_order_reviews | Customer rating 1–5 |
| `review_comment_message` | fact_order_reviews | Free-text review (41.3% non-null) |

### Derived / NLP Features (Stage 3 — `nlp_reviews.parquet`)

| Column | Description |
|---|---|
| `sentiment_label` | XLM-RoBERTa label: Positive / Negative / Neutral |
| `sentiment_score` | Model confidence score |
| `baseline_sentiment_label` | Portuguese lexicon baseline label |
| `tfidf_topic_id` | Topic ID from TF-IDF + NMF (0–7) |
| `emb_topic_id` | Topic ID from embedding + KMeans (0–7) |
| `topic_label` | Business-readable topic label (derived from c-TF-IDF terms) |
| `extracted_aspects` | List of detected complaint aspects per review |
| `sentiment_agrees` | Boolean: NLP label matches star-rating expectation |

### Derived Business Features (Stage 4)

| Column | Description |
|---|---|
| `delay_days` | `order_delivered_customer_date` − `order_estimated_delivery_date` in days |
| `is_late` | Boolean: delay_days > 0 |
| `is_neg_review` | Boolean: review_score ≤ 2 |
| `is_neg_sentiment` | Boolean: sentiment_label == 'Negative' |
| `order_value` | price + freight_value |

---

## 5. Methodology

### Stage 1: Data Acquisition, Audit & Star Schema
- Downloaded 9 CSVs via `kagglehub` and copied to `data/raw/`.
- Schema audit: row counts, column types, missingness %, primary/foreign key validation.
- Built star schema in `data/processed/` as Parquet files.
- Key cleaning decisions: dropped duplicate order rows; retained null review text rows in fact table (excluded only from NLP).

### Stage 2: EDA & Feature Engineering
- Computed delivery delay, late-delivery flag, order value.
- Analyzed review score distribution, delivery delay distribution, category revenue.
- Key EDA outputs saved to `data/processed/features_orders.parquet`.

### Stage 3: NLP Pipeline

**Language decision: Approach (b) — Multilingual models directly on Portuguese.**

Rationale: `cardiffnlp/twitter-xlm-roberta-base-sentiment` is trained natively on multilingual Twitter data including Portuguese. Machine-translation would add noise, cost, and rate-limiting for 40,977 reviews. Using native multilingual models is standard practice in modern multilingual NLP.

**Benchmarks (500-review sample, CPU):**

| Method | 500 reviews | Actual for 40,977 |
|---|---|---|
| Portuguese Lexicon Baseline | — | 8.3 seconds |
| XLM-RoBERTa Sentiment | 179.3s | 91.2 minutes |
| Sentence Embeddings (MiniLM) | 50.0s | 9.5 minutes |
| TF-IDF + NMF | 0.9s | 3.9 seconds |

**Sentiment:** Two-tier approach — Portuguese lexicon baseline (fast, interpretable), then `cardiffnlp/twitter-xlm-roberta-base-sentiment` transformer on all 40,977 reviews with batch_size=32 and incremental checkpointing every 2,000 reviews.

**Topic modeling:** TF-IDF + NMF (8 topics, baseline) and Sentence Transformers + KMeans (8 topics, advanced). Topics interpreted via c-TF-IDF on cluster documents — not pre-assumed labels.

**Aspect extraction:** Data-driven discovery — mined top-30 most disproportionately frequent terms from negative reviews, then grouped into 7 semantic categories. NOT pre-assumed.

### Stage 4: Statistical Analysis & Business Layer
- **Spearman rank correlation** (ordinal review scores, non-normal continuous predictors)
- **Mann-Whitney U** for two-group comparisons (non-parametric; review scores are not normally distributed)
- **Kruskal-Wallis H** for multi-group comparisons (categories, price bands)
- **Logistic regression** for probability of negative review (observational only — see Limitations)
- **Scenario-based exposure model** (not historical revenue loss)
- **11 DuckDB-validated SQL queries** in `sql/`

---

## 6. Key EDA Findings

**Review score distribution (all 99,224 reviews):**
| Score | Count | % |
|---|---|---|
| 5 ⭐ | 57,328 | 57.8% |
| 4 ⭐ | 19,142 | 19.3% |
| 3 ⭐ | 8,179 | 8.2% |
| 2 ⭐ | 3,151 | 3.2% |
| 1 ⭐ | 11,424 | 11.5% |

**Delivery performance (96,476 delivered orders):**
| Metric | Value |
|---|---|
| Late deliveries (delay > 0) | 7,827 (8.1%) |
| Median delivery vs. estimate | −11.9 days (early) |
| Mean delivery vs. estimate | −11.2 days (early) |
| 95th percentile delay | +3.8 days late |
| Max observed delay | 189 days |

**Order economics:**
| Metric | Value |
|---|---|
| Total gross revenue (item prices) | R$ 13,591,643.70 |
| Total freight collected | R$ 2,251,909.54 |
| Median item price | R$ 74.99 |
| Mean item price | R$ 120.65 |
| Median freight | R$ 16.26 |
| Unique products sold | 32,951 |
| Unique active sellers | 3,095 |

**Top 5 categories by revenue:**
| Category | Revenue (R$) |
|---|---|
| health_beauty | R$ 1,258,681.34 |
| watches_gifts | R$ 1,205,005.68 |
| bed_bath_table | R$ 1,036,988.68 |
| sports_leisure | R$ 988,048.97 |
| computers_accessories | R$ 911,954.32 |

---

## 7. NLP Results

**Text coverage:** 40,977 of 99,224 reviews (41.3%) have non-null review text and were processed.

### Sentiment Distribution (XLM-RoBERTa, all 40,977 text reviews)

| Label | Count | % |
|---|---|---|
| Positive | 21,493 | 52.5% |
| Negative | 9,896 | 24.1% |
| Neutral | 9,588 | 23.4% |

**Lexicon baseline:** Positive 23,153 | Neutral 9,804 | Negative 8,020

### Sentiment vs. Star Rating Agreement

| Metric | Rate |
|---|---|
| Transformer agreement with star rating | **69.88%** |
| Transformer disagreement | **30.12%** |
| Lexicon baseline agreement | **65.76%** |

**Per-score agreement (transformer):**
| Score | Agreement |
|---|---|
| 5 ⭐ | 82.6% |
| 4 ⭐ | 58.8% |
| 3 ⭐ | 37.8% — inherently ambiguous |
| 2 ⭐ | 56.4% |
| 1 ⭐ | 63.9% |

The 30.12% disagreement rate is expected: customers often give high star ratings but complain in text ("produto bom, mas entrega demorou"), or give 1-star ratings where the complaint is about a non-text issue not captured in the review message.

### Topic Table (Embedding-Based, c-TF-IDF Interpretation)

All topic names derived from **actual top terms in each cluster** — not pre-assumed.

| Topic | Reviews | Representative Terms | Business Interpretation |
|---|---|---|---|
| T0 | 5,864 | produto, recomendo, prazo, entrega, loja | Positive Shopping Experience |
| T1 | 5,193 | recebi, comprei, entrega, veio, correios, nao | Order Receipt / Delivery Problems |
| T2 | 4,056 | produto, qualidade, entrega, bom, ótimo | Product Quality Praise |
| T3 | 6,462 | prazo, antes, produto, antes prazo, chegou | Early Delivery Satisfaction |
| T4 | 4,005 | bom, recomendo, tudo, excelente, tudo ok | General Approval / Short Praise |
| T5 | 5,365 | entrega, produto, bom, rápida, entrega rápida | Fast Delivery + Product Satisfaction |
| T6 | 4,759 | produto, veio, comprei, qualidade, recebi | Product Expectation vs. Reality |
| T7 | 5,273 | produto, recebi, ainda, recebi produto, entregue | Delivery Status / Pending Orders |

### Aspect Breakdown (Data-Driven — 7 discovered categories + Uncategorized)

All aspects discovered by mining disproportionately frequent terms in negative reviews.

| Aspect | Mentions | Negative | % Negative |
|---|---|---|---|
| Product Quality | 18,450 | 5,326 | 28.9% |
| Delivery/Logistics | 18,181 | 4,028 | 22.2% |
| Customer Service | 4,918 | 1,889 | 38.4% |
| Description Mismatch | 1,853 | 633 | 34.2% |
| Wrong/Missing Item | 1,817 | 1,136 | **62.5%** |
| Price/Value | 1,790 | 695 | 38.8% |
| Packaging | 874 | 485 | **55.5%** |
| Uncategorized | 11,497 | 1,695 | 14.7% |

**Notable:** Wrong/Missing Item (62.5%) and Packaging (55.5%) have the highest negative rates — when customers mention these aspects, complaints are the dominant outcome.

---

## 8. Statistical Findings

> ⚠️ All results below are **associations only**. This project uses observational data and does not establish causation. No causal language is used.

### Spearman Rank Correlations

**Why Spearman:** Review scores are ordinal (1–5). Delay, price, and freight are continuous but non-normally distributed. Spearman handles both without normality assumptions.

| Relationship | ρ | p-value | Interpretation |
|---|---|---|---|
| Delivery Delay vs. Review Score | **−0.1755** | < 0.0001 | Moderate negative — longer delays associate with lower scores |
| Freight Value vs. Review Score | −0.0383 | 2.04 × 10⁻¹⁶ | Very weak negative |
| Price vs. Review Score | +0.0216 | 3.33 × 10⁻⁶ | Very weak positive — pricier items are not associated with worse reviews |
| Complaint Rate vs. Avg Rating (category-level) | **−0.9829** | 2.52 × 10⁻²⁷ | Near-perfect inverse at category level |

### Group Comparisons

**On-time vs. Late Delivery (Mann-Whitney U, one-sided):**
- On-time mean score: **3.82** (N = 41,359)
- Late mean score: **2.09** (N = 4,778)
- U = 151,887,118, **p < 0.0001**

**High vs. Low Freight (split at median R$ 16.59, Mann-Whitney U):**
- Low freight mean: **3.69**, High freight mean: **3.58**
- p = 2.52 × 10⁻¹⁵ — statistically significant but practically small (Δ = 0.11)

**Price Bands (Kruskal-Wallis H):**
- H = 18.57, p = 3.36 × 10⁻⁴
- Means: <R$50 → 3.61, R$50–150 → 3.64, R$150–500 → 3.69, >R$500 → 3.69

**Cross-category (Kruskal-Wallis H, 37 categories above N=100):**
- H = 640.29, p = 1.06 × 10⁻¹¹¹ — massive variation across categories

### Logistic Regression (Observational Only)

**Model:** P(negative review) ~ delay_days + price + freight_value  
**Note: Observational data. Coefficients are associations, NOT causal estimates.**

| Predictor | Coefficient | p-value |
|---|---|---|
| delay_days | +0.0472 | < 0.001 |
| price | −0.0002 | < 0.001 |
| freight_value | +0.0050 | < 0.001 |

---

## 9. Business Impact

### Commercial Exposure Model

> ⚠️ **Scenario-based estimate, NOT observed historical revenue loss.**  
> Formula: `commercial_exposure = affected_order_value × impact_assumption`

**Total order value tied to Negative NLP sentiment:** R$ 1,763,586.00 (9,529 affected orders)

| Impact Assumption | Scenario-Based Exposure (R$) |
|---|---|
| 1% | R$ 17,635.86 |
| 2% | R$ 35,271.72 |
| 5% | R$ 88,179.30 |
| 10% | R$ 176,358.60 |
| 15% | R$ 264,537.90 |
| 20% | R$ 352,717.20 |

### Business Prioritization Framework

Segmentation by **Negative Sentiment Rate** and **Total Order Value** (split at medians: 24.0% and R$ 84,759).

**HIGH Risk + HIGH Exposure — Immediate Action (9 categories):**

| Category | Neg Sentiment Rate | Total Value (R$) | N Reviews |
|---|---|---|---|
| office_furniture | 38.5% | 122,420 | 606 |
| unknown | 30.6% | 88,610 | 628 |
| computers_accessories | 29.0% | 384,706 | 2,707 |
| telephony | 27.5% | 170,467 | 1,852 |
| furniture_decor | 26.7% | 281,940 | 2,585 |
| baby | 26.5% | 183,848 | 1,074 |
| housewares | 26.3% | 278,299 | 2,364 |
| watches_gifts | 25.0% | 554,566 | 2,489 |
| toys | 24.4% | 214,070 | 1,447 |

**LOW Risk + HIGH Exposure — Protect & Maintain (9 categories):**

| Category | Neg Sentiment Rate | Total Value (R$) | N Reviews |
|---|---|---|---|
| health_beauty | 23.9% | 494,424 | 3,341 |
| bed_bath_table | 24.0% | 488,451 | 4,277 |
| sports_leisure | 21.9% | 406,742 | 2,945 |
| cool_stuff | 22.6% | 303,034 | 1,528 |
| auto | 20.9% | 299,722 | 1,688 |

---

## 10. Power BI Dashboard

> **⏳ PENDING — This section is a placeholder.**

The Power BI dashboard is built manually in Power BI Desktop using the Parquet outputs from `data/processed/stage4/` and the SQL queries in `sql/`. Once built, add screenshots here.

**Planned visuals:**
- Category complaint heatmap (complaint_matrix.csv)
- Business prioritization 2×2 scatter
- Monthly sentiment trend line
- Late delivery rate by state (map)
- Seller performance table

**To add screenshots:** Replace this section with `![Dashboard Screenshot](reports/figures/dashboard.png)` once exported from Power BI Desktop.

---

## 11. Limitations

1. **No returns/refund data.** The dataset has no returns table. Return rates, refund amounts, and post-return sentiment cannot be computed. The exposure model cannot account for actual customer churn.
2. **No cost, profit, or CLV data.** All financial figures are gross order value (price + freight). Margins, acquisition costs, and lifetime value are not available and not estimated.
3. **Review text covers only 41.3% of orders.** All NLP findings apply to the 40,977 reviews with text. The 58.7% of orders without text may have systematically different sentiment — their opinions are unobserved.
4. **Positive-review skew.** 57.8% of reviews are 5-star. Complaint patterns are derived from a minority of reviews, which limits the generalizability of aspect-level findings to the full customer base.
5. **Observational statistics only.** All correlation and regression results are associations. No experimental design, instrument, or control exists in this data to support causal inference.
6. **Portuguese NLP caveats.** XLM-RoBERTa was trained on Twitter-style text. Formal or regional Portuguese expressions may be misclassified. The 30.12% disagreement rate between NLP labels and star ratings reflects both genuine ambiguity and model limitations.
7. **Aspect categories partially overlap.** The extracted_aspects field uses regex patterns. A review mentioning both delivery and product quality is tagged with both — aspect counts are not mutually exclusive.
8. **Seller anonymization.** Seller IDs are hashed. No seller-level business context (size, type, tenure) is available for interpretation.

---

## 12. Future Improvements

1. **Targeted data collection:** Add returns/refund tracking, product cost data, and customer re-purchase records to enable CLV and margin-level analysis.
2. **Better review coverage:** Implement post-purchase survey triggers to increase text coverage beyond 41.3%.
3. **Fine-tuned Portuguese sentiment model:** Fine-tune XLM-RoBERTa on Olist-domain reviews with human-labeled sentiment to improve the current 69.88% agreement rate.
4. **BERTopic** for more coherent topic modeling, replacing the current KMeans-on-embeddings approach.
5. **Causal inference methods:** Difference-in-differences or instrumental variable approaches (e.g., using exogenous delivery delays from weather events) to move beyond observational associations.
6. **Time-series analysis:** Model complaint rate trends over time to detect improving or worsening seller performance.

---

## 13. Tech Stack

| Layer | Tools |
|---|---|
| Language | Python 3.12 |
| Data processing | pandas, numpy, pyarrow |
| NLP | transformers (XLM-RoBERTa), sentence-transformers (MiniLM), scikit-learn (TF-IDF, NMF, KMeans), NLTK |
| Statistics | scipy, statsmodels |
| SQL | DuckDB (validates queries against Parquet) |
| Storage | Parquet (columnar, compressed) |
| BI | Power BI Desktop (manual, separate step) |
| Dataset acquisition | kagglehub |

---

## 14. Project Structure

```
├── data/
│   ├── raw/                    # 9 original CSVs from Kaggle
│   └── processed/
│       ├── fact_orders.parquet
│       ├── fact_order_items.parquet
│       ├── fact_order_reviews.parquet
│       ├── dim_*.parquet
│       ├── nlp_reviews.parquet      # Stage 3 NLP outputs (40,977 rows)
│       ├── nlp_topics.json
│       ├── nlp_aspects.json
│       ├── nlp_summary_metrics.json
│       └── stage4/
│           ├── agg_category.csv
│           ├── agg_seller.csv
│           ├── agg_state.csv
│           ├── agg_monthly.csv
│           ├── agg_quarterly.csv
│           ├── complaint_matrix.csv
│           ├── business_prioritization.csv
│           └── stage4_metrics.json
├── sql/
│   ├── 01_category_revenue.sql
│   ├── 02_avg_review_score_by_category.sql
│   ├── 03_negative_review_rate.sql
│   ├── 04_late_delivery_rate.sql
│   ├── 05_category_complaint_rate.sql
│   ├── 06_seller_performance.sql
│   ├── 07_monthly_trends.sql
│   ├── 08_product_ranking.sql
│   ├── 09_complaint_breakdown.sql
│   ├── 10_customer_geography.sql
│   └── 11_order_value_segments.sql
├── src/
│   ├── data/
│   │   ├── load_raw.py
│   │   └── make_dataset.py
│   └── analytics/
│       ├── nlp_pipeline.py          # Stage 3 NLP
│       ├── stage4_analysis.py       # Stage 4 business analytics
│       └── validate_sql.py          # DuckDB SQL validation
├── requirements.txt
└── README.md
```

---

## 15. Setup & Reproduction

### Prerequisites
```bash
pip install -r requirements.txt
```

Key packages: `pandas`, `pyarrow`, `torch`, `transformers`, `sentence-transformers`, `scikit-learn`, `scipy`, `statsmodels`, `duckdb`, `kagglehub`, `nltk`

### Kaggle Credentials
Configure `~/.kaggle/kaggle.json` with your Kaggle API key before running Stage 1.

### Reproduce Each Stage

```bash
# Stage 1: Download data & build star schema
python src/data/load_raw.py
python src/data/make_dataset.py

# Stage 2: EDA & feature engineering
python src/data/build_features.py

# Stage 3: NLP pipeline (~1.5–2 hours on CPU)
python src/analytics/nlp_pipeline.py

# Stage 4: Business analytics & statistics
python src/analytics/stage4_analysis.py

# Stage 4: Validate SQL queries
python src/analytics/validate_sql.py

# Power BI: Manual — open Power BI Desktop, connect to data/processed/ Parquet files
```

> ⚠️ The NLP pipeline (`nlp_pipeline.py`) runs XLM-RoBERTa sentiment inference on 40,977 reviews on CPU (~91 minutes actual runtime). Incremental checkpoints are saved every 2,000 reviews to `data/processed/checkpoints/` so runs can be resumed if interrupted.
