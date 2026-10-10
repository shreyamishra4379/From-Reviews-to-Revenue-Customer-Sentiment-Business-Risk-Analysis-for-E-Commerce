"""
Stage 4: Product/Category/Business-Impact Analytics, Statistical Analysis, SQL Layer
====================================================================================
Joins Stage 3 NLP outputs to Stage 1 fact/dim tables. Does NOT recompute NLP.
All monetary values in BRL (R$). No causation claims — associations only.
"""
import pandas as pd
import numpy as np
import scipy.stats as stats
import statsmodels.api as sm
import json, os, sys, warnings
warnings.filterwarnings('ignore')

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.insert(0, ROOT)
sys.stdout.reconfigure(encoding='utf-8')
from src.utils.metrics import delay_days, late_flag, neg_review_flag, parse_aspects

DATA_DIR = os.path.join(ROOT, "data", "processed")
OUT_DIR  = os.path.join(DATA_DIR, "stage4")
os.makedirs(OUT_DIR, exist_ok=True)

def _log(msg): print(msg, flush=True)

# ============================================================================
# DATA LOADING & JOIN
# ============================================================================
def load_joined():
    _log("Loading and joining tables...")
    nlp  = pd.read_parquet(f"{DATA_DIR}/nlp_reviews.parquet")
    ords = pd.read_parquet(f"{DATA_DIR}/fact_orders.parquet")
    items= pd.read_parquet(f"{DATA_DIR}/fact_order_items.parquet")
    prods= pd.read_parquet(f"{DATA_DIR}/dim_products.parquet")
    custs= pd.read_parquet(f"{DATA_DIR}/dim_customers.parquet")

    for c in ['order_delivered_customer_date','order_estimated_delivery_date','order_purchase_timestamp']:
        ords[c] = pd.to_datetime(ords[c])

    ords['delay_days'] = delay_days(ords['order_delivered_customer_date'],
                                    ords['order_estimated_delivery_date'])
    # NaN (not False) for orders that were never delivered — they are neither late nor on time
    ords['is_late'] = late_flag(ords['delay_days'])

    # Parse extracted_aspects into real Python lists. Parquet returns numpy arrays, and
    # ast.literal_eval(str(array)) silently concatenates the elements into one string.
    nlp['extracted_aspects'] = nlp['extracted_aspects'].apply(parse_aspects)
    # review_id alone is not unique in Olist (a few reviews cover several orders)
    nlp['review_key'] = nlp['review_id'] + '|' + nlp['order_id']

    # merge
    df = nlp.merge(ords[['order_id','customer_id','is_late','delay_days',
                         'order_purchase_timestamp']], on='order_id', how='inner')
    df = df.merge(custs[['customer_id','state']], on='customer_id', how='left')
    df = df.merge(items[['order_id','order_item_id','product_id','seller_id','price','freight_value']],
                  on='order_id', how='inner')
    df = df.merge(prods[['product_id','product_category_name_english']],
                  on='product_id', how='left')

    df['category'] = df['product_category_name_english'].fillna('unknown')
    df['is_neg_review'] = neg_review_flag(df['review_score'])
    df['is_neg_sentiment'] = (df['sentiment_label'] == 'Negative').astype(int)
    df['item_value'] = df['price'] + df['freight_value']
    df['order_month'] = df['order_purchase_timestamp'].dt.to_period('M').astype(str)
    df['order_quarter'] = df['order_purchase_timestamp'].dt.to_period('Q').astype(str)

    _log(f"Joined dataset (review x order item grain): {len(df):,} rows, "
         f"{df['review_key'].nunique():,} unique reviews")
    return df


REVIEW_COLS = ['review_id','order_id','review_score','sentiment_label','topic_label',
               'extracted_aspects','is_late','delay_days','state','order_month',
               'order_quarter','is_neg_review','is_neg_sentiment']

def review_level(df):
    """One row per review. Item price/freight are summed to order level, so a review on a
    3-item order counts once (not three times) in correlations and tests."""
    first = {c: (c, 'first') for c in REVIEW_COLS}
    rev = df.groupby('review_key').agg(
        **first,
        order_items_price=('price', 'sum'),
        order_freight=('freight_value', 'sum'),
        order_value=('item_value', 'sum'),
        n_items=('order_item_id', 'count'),
    ).reset_index()
    return rev

def review_level_by(df, key):
    """One row per (key, review): e.g. per (category, review). A review on an order with
    two items from the same category counts once for that category."""
    first = {c: (c, 'first') for c in REVIEW_COLS}
    return df.groupby([key, 'review_key']).agg(
        **first,
        group_item_value=('item_value', 'sum'),
        group_avg_item_price=('price', 'mean'),
        group_avg_freight=('freight_value', 'mean'),
    ).reset_index()

# ============================================================================
# 1. SAMPLE-SIZE VALIDATION
# ============================================================================
def sample_size_validation(by_prod, by_cat):
    _log("\n" + "="*70)
    _log("1. SAMPLE-SIZE VALIDATION")
    _log("="*70)

    # Review counts per product (one row per product x review)
    prod_n = by_prod.groupby('product_id').agg(
        n_reviews=('review_key','nunique'),
        neg_rate=('is_neg_review','mean')
    ).reset_index()

    _log(f"Products: {len(prod_n):,} total")
    _log(f"  1 review only: {(prod_n['n_reviews']==1).sum():,}")
    _log(f"  2-9 reviews:   {((prod_n['n_reviews']>=2)&(prod_n['n_reviews']<10)).sum():,}")
    _log(f"  10-29 reviews: {((prod_n['n_reviews']>=10)&(prod_n['n_reviews']<30)).sum():,}")
    _log(f"  30+ reviews:   {(prod_n['n_reviews']>=30).sum():,}")

    # Review counts per category
    cat_n = by_cat.groupby('category').agg(
        n_reviews=('review_key','nunique'),
        neg_rate=('is_neg_review','mean')
    ).reset_index()
    _log(f"\nCategories: {len(cat_n):,} total")
    _log(f"  <30 reviews:   {(cat_n['n_reviews']<30).sum():,}")
    _log(f"  30-99 reviews: {((cat_n['n_reviews']>=30)&(cat_n['n_reviews']<100)).sum():,}")
    _log(f"  100+ reviews:  {(cat_n['n_reviews']>=100).sum():,}")

    # Thresholds
    PROD_MIN = 30
    CAT_MIN  = 100
    _log(f"\nThresholds: Products >= {PROD_MIN}, Categories >= {CAT_MIN}")
    _log("Rationale: N>=30 is a common minimum for the Central Limit Theorem to")
    _log("  apply to proportions; N>=100 for categories provides stable rate estimates.")

    # Concrete misleading example
    low_n = prod_n[(prod_n['n_reviews']<=2) & (prod_n['neg_rate']==1.0)].iloc[0]
    high_n = prod_n[(prod_n['n_reviews']>=50) & (prod_n['neg_rate'].between(0.15,0.30))].iloc[0]

    _log(f"\nMisleading ranking example (REAL DATA):")
    _log(f"  Product A: {low_n['product_id']}")
    _log(f"    Reviews: {int(low_n['n_reviews'])}, Negative rate: {low_n['neg_rate']*100:.0f}%")
    _log(f"  Product B: {high_n['product_id']}")
    _log(f"    Reviews: {int(high_n['n_reviews'])}, Negative rate: {high_n['neg_rate']*100:.1f}%")
    _log(f"  Without thresholds, Product A (N={int(low_n['n_reviews'])}) ranks 'worse' than")
    _log(f"  Product B (N={int(high_n['n_reviews'])}), which is statistically meaningless.")

    return PROD_MIN, CAT_MIN, {
        'product_threshold': PROD_MIN, 'category_threshold': CAT_MIN,
        'product_distribution': {
            '1_review': int((prod_n['n_reviews']==1).sum()),
            '2_to_9':   int(((prod_n['n_reviews']>=2)&(prod_n['n_reviews']<10)).sum()),
            '10_to_29': int(((prod_n['n_reviews']>=10)&(prod_n['n_reviews']<30)).sum()),
            '30_plus':  int((prod_n['n_reviews']>=30).sum())
        },
        'misleading_example': {
            'low_n_product': low_n['product_id'],
            'low_n_reviews': int(low_n['n_reviews']),
            'low_n_neg_rate': round(low_n['neg_rate'], 4),
            'high_n_product': high_n['product_id'],
            'high_n_reviews': int(high_n['n_reviews']),
            'high_n_neg_rate': round(high_n['neg_rate'], 4)
        }
    }

# ============================================================================
# 2. AGGREGATE NLP + BUSINESS METRICS
# ============================================================================
def _group_metrics(g):
    """g is at (group, review) grain, so every mean is over unique reviews."""
    return pd.Series({
        'review_count':       g['review_key'].nunique(),
        'avg_review_score':   g['review_score'].mean(),
        'neg_review_rate':    g['is_neg_review'].mean(),
        'neg_sentiment_rate': g['is_neg_sentiment'].mean(),
        'avg_order_value':    g['order_value'].mean(),
        'avg_item_price':     g['avg_item_price'].mean(),
        'avg_freight':        g['avg_freight'].mean(),
        'late_delivery_rate': g['is_late'].mean(),          # NaN (undelivered) excluded
        'delivered_reviews':  g['is_late'].notna().sum(),
        'total_item_value':   g['item_value'].sum(),
    })

def _attach_order_value(by_key, rev):
    """Add the full order value of each review to a (group, review) table."""
    out = by_key.merge(rev[['review_key','order_value']], on='review_key', how='left')
    return out.rename(columns={'group_item_value': 'item_value',
                               'group_avg_item_price': 'avg_item_price',
                               'group_avg_freight': 'avg_freight'})

def aggregate_metrics(rev, by_cat, by_seller, prod_min, cat_min):
    _log("\n" + "="*70)
    _log("2. AGGREGATE NLP + BUSINESS METRICS")
    _log("="*70)
    _log("Grain: every rate is computed over unique reviews in the group "
         "(multi-item orders are not double-counted).")

    cat_rows = _attach_order_value(by_cat, rev)
    seller_rows = _attach_order_value(by_seller, rev)
    rev_rows = rev.rename(columns={'order_items_price': 'item_value_tmp'}).copy()
    rev_rows['item_value'] = rev_rows['order_value']
    rev_rows['avg_item_price'] = rev_rows['item_value_tmp'] / rev_rows['n_items']
    rev_rows['avg_freight'] = rev_rows['order_freight'] / rev_rows['n_items']

    # --- By Category ---
    cat_agg = cat_rows.groupby('category').apply(_group_metrics, include_groups=False).reset_index()
    cat_topics = cat_rows.groupby('category')['topic_label'].agg(
        lambda x: x.value_counts().index[0]).reset_index()
    cat_topics.columns = ['category', 'top_topic']
    cat_agg = cat_agg.merge(cat_topics, on='category')
    cat_exp = cat_rows[cat_rows['is_neg_sentiment'] == 1].explode('extracted_aspects')
    cat_exp = cat_exp[cat_exp['extracted_aspects'] != 'Uncategorized']
    top_asp = cat_exp.groupby('category')['extracted_aspects'].agg(
        lambda x: x.value_counts().index[0]).reset_index()
    top_asp.columns = ['category', 'top_complaint_aspect']
    cat_agg = cat_agg.merge(top_asp, on='category', how='left')
    cat_agg['confidence'] = np.where(cat_agg['review_count'] >= cat_min, 'HIGH', 'LOW-N')
    cat_agg = cat_agg.sort_values('neg_sentiment_rate', ascending=False)
    _log(f"Category aggregation: {len(cat_agg)} categories ({(cat_agg['confidence']=='HIGH').sum()} above threshold)")

    # --- By Seller ---
    seller_agg = seller_rows.groupby('seller_id').apply(_group_metrics, include_groups=False).reset_index()
    seller_agg['confidence'] = np.where(seller_agg['review_count'] >= prod_min, 'HIGH', 'LOW-N')
    _log(f"Seller aggregation: {len(seller_agg)} sellers ({(seller_agg['confidence']=='HIGH').sum()} above threshold)")

    # --- By State / Month / Quarter (one state/month per review) ---
    state_agg = rev_rows.groupby('state').apply(_group_metrics, include_groups=False).reset_index()
    _log(f"State aggregation: {len(state_agg)} states")
    month_agg = rev_rows.groupby('order_month').apply(_group_metrics, include_groups=False).reset_index()
    _log(f"Monthly aggregation: {len(month_agg)} months")
    qtr_agg = rev_rows.groupby('order_quarter').apply(_group_metrics, include_groups=False).reset_index()
    _log(f"Quarterly aggregation: {len(qtr_agg)} quarters")

    # --- Product-Complaint Matrix (category x aspect) ---
    # complaint rate = share of reviews mentioning the aspect whose sentiment is Negative
    df_exp = cat_rows.explode('extracted_aspects')
    complaint_matrix_long = df_exp.groupby(['category', 'extracted_aspects']).agg(
        mention_count=('review_key', 'nunique'),
        neg_count=('is_neg_sentiment', 'sum'),
    ).reset_index()
    complaint_matrix_long['complaint_rate'] = (complaint_matrix_long['neg_count'] /
                                               complaint_matrix_long['mention_count'])
    complaint_matrix = complaint_matrix_long.pivot_table(
        index='category', columns='extracted_aspects', values='complaint_rate', fill_value=0)
    valid_cats = cat_agg[cat_agg['confidence'] == 'HIGH']['category'].tolist()
    complaint_matrix_valid = complaint_matrix.loc[complaint_matrix.index.isin(valid_cats)]
    _log(f"Product-Complaint Matrix: {complaint_matrix_valid.shape[0]} categories x "
         f"{complaint_matrix_valid.shape[1]} aspects: {list(complaint_matrix_valid.columns)}")

    # Save
    cat_agg.to_csv(f"{OUT_DIR}/agg_category.csv", index=False)
    seller_agg.to_csv(f"{OUT_DIR}/agg_seller.csv", index=False)
    state_agg.to_csv(f"{OUT_DIR}/agg_state.csv", index=False)
    month_agg.to_csv(f"{OUT_DIR}/agg_monthly.csv", index=False)
    qtr_agg.to_csv(f"{OUT_DIR}/agg_quarterly.csv", index=False)
    complaint_matrix_valid.to_csv(f"{OUT_DIR}/complaint_matrix.csv")
    complaint_matrix_long.to_csv(f"{OUT_DIR}/complaint_matrix_long.csv", index=False)

    return cat_agg, cat_rows, complaint_matrix_valid

# ============================================================================
# 3. STATISTICAL ANALYSIS
# ============================================================================
def statistical_analysis(rev, cat_rows, cat_agg):
    _log("\n" + "="*70)
    _log("3. STATISTICAL ANALYSIS")
    _log("="*70)
    _log("Test: Spearman rank correlation (review scores are ordinal 1-5;")
    _log("  delay/price/freight are non-normally distributed continuous)")
    _log("Unit of analysis: one row per review; price and freight are order totals.")
    results = {}

    dfc = rev.dropna(subset=['delay_days']).copy()
    dfc['is_late'] = dfc['is_late'].astype(bool)
    dfc = dfc.rename(columns={'order_items_price': 'price', 'order_freight': 'freight_value'})
    results['unit_of_analysis'] = ('one row per text review on a delivered order; '
                                   'price and freight_value are order-level totals')
    results['n_reviews_analysed'] = int(len(dfc))
    _log(f"Reviews analysed (delivered orders only): {len(dfc):,}")

    # --- Correlations ---
    pairs = [
        ('delay_days',   'review_score', 'Delivery Delay vs Review Score'),
        ('freight_value','review_score', 'Freight Value vs Review Score'),
        ('price',        'review_score', 'Price vs Review Score'),
    ]
    _log("\nSpearman Correlations:")
    corrs = {}
    for x, y, label in pairs:
        rho, p = stats.spearmanr(dfc[x], dfc[y])
        _log(f"  {label}: rho={rho:.4f}, p={p:.2e}, N={len(dfc):,}")
        corrs[label] = {'rho': round(rho,4), 'p_value': float(p), 'n': int(len(dfc))}

    # Complaint rate vs avg rating (at category level)
    cat_valid = cat_agg[cat_agg['confidence']=='HIGH'].copy()
    rho_cr, p_cr = stats.spearmanr(cat_valid['neg_review_rate'], cat_valid['avg_review_score'])
    _log(f"  Complaint Rate vs Avg Rating (category-level): rho={rho_cr:.4f}, p={p_cr:.2e}, "
         f"N={len(cat_valid)} categories")
    _log("    (partly definitional: both are functions of the same review scores)")
    corrs['Complaint Rate vs Avg Rating'] = {'rho': round(rho_cr,4), 'p_value': float(p_cr),
                                             'n': int(len(cat_valid))}
    # NLP-based complaint rate vs avg rating — not definitional, since sentiment comes from text
    rho_ns, p_ns = stats.spearmanr(cat_valid['neg_sentiment_rate'], cat_valid['avg_review_score'])
    _log(f"  Negative-Sentiment Rate vs Avg Rating (category-level): rho={rho_ns:.4f}, p={p_ns:.2e}")
    corrs['Negative Sentiment Rate vs Avg Rating'] = {'rho': round(rho_ns,4), 'p_value': float(p_ns),
                                                      'n': int(len(cat_valid))}
    results['correlations'] = corrs

    # --- Group Comparisons ---
    _log("\nGroup Comparisons:")

    late = dfc[dfc['is_late']]['review_score']
    ontime = dfc[~dfc['is_late']]['review_score']
    u_stat, u_p = stats.mannwhitneyu(ontime, late, alternative='greater')
    _log(f"  On-time vs Late Delivery (Mann-Whitney U, one-sided):")
    _log(f"    On-time mean: {ontime.mean():.2f} (N={len(ontime):,})")
    _log(f"    Late mean:    {late.mean():.2f} (N={len(late):,})")
    _log(f"    U={u_stat:,.0f}, p={u_p:.2e}")
    results['ontime_vs_late'] = {
        'test': 'Mann-Whitney U (one-sided)',
        'ontime_mean': round(ontime.mean(),2), 'ontime_n': len(ontime),
        'late_mean': round(late.mean(),2), 'late_n': len(late),
        'ontime_neg_review_rate': round(float((ontime <= 2).mean()), 4),
        'late_neg_review_rate': round(float((late <= 2).mean()), 4),
        'U': float(u_stat), 'p_value': float(u_p)
    }

    median_freight = dfc['freight_value'].median()
    high_f = dfc[dfc['freight_value'] > median_freight]['review_score']
    low_f  = dfc[dfc['freight_value'] <= median_freight]['review_score']
    uf, pf = stats.mannwhitneyu(low_f, high_f, alternative='greater')
    _log(f"\n  High vs Low Freight (split at median R$ {median_freight:.2f}, Mann-Whitney U):")
    _log(f"    Low freight mean:  {low_f.mean():.2f} (N={len(low_f):,})")
    _log(f"    High freight mean: {high_f.mean():.2f} (N={len(high_f):,})")
    _log(f"    U={uf:,.0f}, p={pf:.2e}")
    results['freight_comparison'] = {
        'test': 'Mann-Whitney U (one-sided)', 'median_freight': round(median_freight,2),
        'low_mean': round(low_f.mean(),2), 'low_n': len(low_f),
        'high_mean': round(high_f.mean(),2), 'high_n': len(high_f),
        'U': float(uf), 'p_value': float(pf)
    }

    dfc['price_band'] = pd.cut(dfc['price'], bins=[0,50,150,500,np.inf],
                                labels=['<50','50-150','150-500','>500'])
    groups_price = [g['review_score'].values for _, g in dfc.groupby('price_band', observed=True)]
    kw_stat, kw_p = stats.kruskal(*groups_price)
    price_means = dfc.groupby('price_band', observed=True)['review_score'].agg(['mean','count'])
    _log(f"\n  Order Price Bands (Kruskal-Wallis H test):")
    for band, row in price_means.iterrows():
        _log(f"    {band}: mean={row['mean']:.2f}, N={int(row['count']):,}")
    _log(f"    H={kw_stat:.2f}, p={kw_p:.2e}")
    results['price_bands'] = {
        'test': 'Kruskal-Wallis H',
        'bands': {str(b): {'mean': round(r['mean'],2), 'n': int(r['count'])}
                  for b, r in price_means.iterrows()},
        'H': round(kw_stat,2), 'p_value': float(kw_p)
    }

    # Cross-category comparison (one row per category x review)
    top5 = cat_valid.nlargest(5, 'avg_review_score')[['category','review_count','avg_review_score','neg_review_rate']]
    bot5 = cat_valid.nsmallest(5, 'avg_review_score')[['category','review_count','avg_review_score','neg_review_rate']]
    cr = cat_rows[cat_rows['category'].isin(cat_valid['category'])]
    cat_groups = [g['review_score'].values for _, g in cr.groupby('category')]
    kw_cat, kw_cat_p = stats.kruskal(*cat_groups)
    _log(f"\n  Cross-category comparison (Kruskal-Wallis H test, {len(cat_groups)} categories):")
    _log(f"    H={kw_cat:.2f}, p={kw_cat_p:.2e}")
    for title, t in [('Top', top5), ('Bottom', bot5)]:
        _log(f"    {title} 5 categories by avg score:")
        for _, r in t.iterrows():
            _log(f"      {r['category']}: avg={r['avg_review_score']:.2f}, "
                 f"neg_rate={r['neg_review_rate']*100:.1f}%, N={int(r['review_count'])}")
    results['category_comparison'] = {
        'test': 'Kruskal-Wallis H', 'n_categories': len(cat_groups),
        'H': round(kw_cat,2), 'p_value': float(kw_cat_p),
        'top5': top5.to_dict('records'), 'bottom5': bot5.to_dict('records')
    }

    # --- Logistic Regression ---
    _log("\n  Logistic Regression: P(negative_review) ~ delay + price + freight")
    _log("  NOTE: Observational data only. Coefficients are ASSOCIATIONS, not causal effects.")
    X = sm.add_constant(dfc[['delay_days','price','freight_value']])
    y = dfc['is_neg_review']
    model = sm.Logit(y, X).fit(disp=0)
    _log(str(model.summary().tables[1]))
    results['logistic_regression'] = {
        'disclaimer': 'Observational data only. Coefficients are associations, not causal effects.',
        'coefficients': {k: round(v,6) for k,v in model.params.items()},
        'odds_ratios': {k: round(float(np.exp(v)),4) for k,v in model.params.items()},
        'p_values': {k: float(v) for k,v in model.pvalues.items()},
        'pseudo_r2': round(model.prsquared, 4),
        'n_obs': int(model.nobs)
    }

    return results

# ============================================================================
# 4. DELIVERY ANALYSIS
# ============================================================================
def delivery_analysis(rev, cat_rows):
    _log("\n" + "="*70)
    _log("4. DELIVERY ANALYSIS")
    _log("="*70)
    _log("Late rates use delivered orders only; one row per review.")

    delivered_cat = cat_rows[cat_rows['is_late'].notna()]
    cat_late = delivered_cat.groupby('category').agg(
        n=('review_key','nunique'), late_rate=('is_late','mean')
    ).reset_index()
    cat_late = cat_late[cat_late['n']>=100].sort_values('late_rate', ascending=False)
    _log("Top 10 categories by late-delivery rate (N>=100):")
    for _, r in cat_late.head(10).iterrows():
        _log(f"  {r['category']}: {r['late_rate']*100:.1f}% late (N={int(r['n'])})")

    delivered = rev[rev['is_late'].notna()]
    state_late = delivered.groupby('state').agg(
        n=('review_key','nunique'), late_rate=('is_late','mean')
    ).reset_index()
    state_late = state_late[state_late['n']>=100].sort_values('late_rate', ascending=False)
    _log("\nTop 10 states by late-delivery rate (N>=100):")
    for _, r in state_late.head(10).iterrows():
        _log(f"  {r['state']}: {r['late_rate']*100:.1f}% late (N={int(r['n'])})")

    # Complaint aspects in late vs on-time (negative-sentiment reviews, delivered orders)
    df_neg = delivered[delivered['is_neg_sentiment']==1].explode('extracted_aspects').reset_index(drop=True)
    aspect_by_late = pd.crosstab(df_neg['extracted_aspects'], df_neg['is_late'].astype(bool))
    aspect_by_late = aspect_by_late.rename(columns={False: 'on_time', True: 'late'})
    aspect_by_late['total'] = aspect_by_late['on_time'] + aspect_by_late['late']
    aspect_by_late['late_share'] = (aspect_by_late['late'] / aspect_by_late['total'] * 100).round(1)
    aspect_by_late = aspect_by_late.sort_values('late', ascending=False)
    aspect_by_late.index.name = 'extracted_aspects'
    aspect_by_late.columns.name = None
    _log("\nComplaint aspects: Late vs On-time (negative-sentiment reviews only):")
    _log(f"  {'Aspect':<25} {'On-time':>8} {'Late':>8} {'Late%':>8}")
    for asp, r in aspect_by_late.iterrows():
        _log(f"  {asp:<25} {int(r['on_time']):>8} {int(r['late']):>8} {r['late_share']:>7.1f}%")

    return {
        'top_late_categories': cat_late.head(10).to_dict('records'),
        'top_late_states': state_late.head(10).to_dict('records'),
        'aspect_by_delivery': aspect_by_late.reset_index().to_dict('records')
    }

# ============================================================================
# 5. COMMERCIAL EXPOSURE MODEL
# ============================================================================
def commercial_exposure(rev):
    _log("\n" + "="*70)
    _log("5. COMMERCIAL EXPOSURE MODEL")
    _log("  (Scenario-based estimate, NOT observed historical revenue loss)")
    _log("="*70)

    # Order value counted once per order, even if the order has several reviews
    neg_orders = rev[rev['is_neg_sentiment']==1].drop_duplicates('order_id')
    affected_value = neg_orders['order_value'].sum()
    affected_orders = neg_orders['order_id'].nunique()

    _log(f"\nTotal order value (items + freight) tied to negative NLP sentiment: R$ {affected_value:,.2f}")
    _log(f"Affected orders: {affected_orders:,}")

    assumptions = [0.01, 0.02, 0.05, 0.10, 0.15, 0.20]
    _log(f"\nSensitivity Table:")
    _log(f"  {'Impact %':>10} {'Scenario Exposure (R$)':>25}")
    _log(f"  {'-'*10} {'-'*25}")
    table = []
    for pct in assumptions:
        exp = affected_value * pct
        _log(f"  {pct*100:>9.0f}% R$ {exp:>22,.2f}")
        table.append({'impact_pct': pct*100, 'exposure_BRL': round(exp,2)})

    _log("\n  * All figures are scenario-based estimates, NOT observed historical revenue loss.")
    _log("  * commercial_exposure = affected_order_value x configurable_impact_assumption")

    return {
        'affected_order_value_BRL': round(affected_value,2),
        'affected_orders': affected_orders,
        'sensitivity_table': table,
        'disclaimer': 'Scenario-based estimate, not observed historical revenue loss.'
    }

# ============================================================================
# 6. BUSINESS PRIORITIZATION FRAMEWORK
# ============================================================================
def business_prioritization(cat_agg):
    _log("\n" + "="*70)
    _log("6. BUSINESS PRIORITIZATION FRAMEWORK")
    _log("="*70)

    ca = cat_agg[cat_agg['confidence']=='HIGH'].copy()
    # Exposure axis: value (price + freight) of this category's items in text-reviewed orders
    ca['total_value'] = ca['total_item_value']

    med_neg = ca['neg_sentiment_rate'].median()
    med_val = ca['total_value'].median()
    _log(f"Thresholds (medians): neg_sentiment_rate={med_neg:.3f}, total_value=R$ {med_val:,.0f}")

    def segment(row):
        high_risk = row['neg_sentiment_rate'] > med_neg
        high_exp  = row['total_value'] > med_val
        if high_risk and high_exp:  return 'HIGH Risk + HIGH Exposure'
        if high_risk and not high_exp: return 'HIGH Risk + LOW Exposure'
        if not high_risk and high_exp: return 'LOW Risk + HIGH Exposure'
        return 'LOW Risk + LOW Exposure'

    ca['segment'] = ca.apply(segment, axis=1)

    _log("\nPrioritization Table:")
    for seg in ['HIGH Risk + HIGH Exposure','HIGH Risk + LOW Exposure',
                'LOW Risk + HIGH Exposure','LOW Risk + LOW Exposure']:
        subset = ca[ca['segment']==seg].sort_values('neg_sentiment_rate', ascending=False)
        _log(f"\n  {seg} ({len(subset)} categories):")
        for _, r in subset.iterrows():
            _log(f"    {r['category']:<35} neg_rate={r['neg_sentiment_rate']*100:.1f}%  "
                 f"value=R$ {r['total_value']:>10,.0f}  N={int(r['review_count'])}")

    ca[['category','review_count','neg_review_rate','neg_sentiment_rate',
        'avg_order_value','total_value','segment']].to_csv(f"{OUT_DIR}/business_prioritization.csv", index=False)

    return ca, {'median_neg_sentiment_rate': round(float(med_neg), 4),
                'median_total_value_BRL': round(float(med_val), 2)}

# ============================================================================
# MAIN
# ============================================================================
def main():
    df = load_joined()
    rev = review_level(df)
    by_cat = review_level_by(df, 'category')
    by_prod = review_level_by(df, 'product_id')
    by_seller = review_level_by(df, 'seller_id')
    _log(f"Review-level table: {len(rev):,} reviews on {rev['order_id'].nunique():,} orders")

    prod_min, cat_min, validation_info = sample_size_validation(by_prod, by_cat)
    cat_agg, cat_rows, complaint_matrix = aggregate_metrics(rev, by_cat, by_seller, prod_min, cat_min)
    stats_res = statistical_analysis(rev, cat_rows, cat_agg)
    delivery_res = delivery_analysis(rev, cat_rows)
    exposure_res = commercial_exposure(rev)
    prio, prio_thresholds = business_prioritization(cat_agg)

    all_metrics = {
        'grain_note': ('All rates are computed over unique reviews (review_id + order_id). '
                       'Multi-item orders are not double-counted.'),
        'review_level_rows': int(len(rev)),
        'sample_size_validation': validation_info,
        'statistical_analysis': stats_res,
        'delivery_analysis': delivery_res,
        'commercial_exposure': exposure_res,
        'prioritization_thresholds': prio_thresholds,
    }
    with open(f"{OUT_DIR}/stage4_metrics.json", 'w', encoding='utf-8') as f:
        json.dump(all_metrics, f, indent=2, ensure_ascii=False, default=str)

    _log(f"\nAll outputs saved to {OUT_DIR}/")
    _log("Stage 4 complete.")

if __name__ == "__main__":
    main()
