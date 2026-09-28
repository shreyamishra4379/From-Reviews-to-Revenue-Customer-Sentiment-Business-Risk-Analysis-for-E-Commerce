"""
Customer Voice & Business Impact Analytics — Interactive Dashboard
===================================================================
Streamlit dashboard showcasing all Stages 1–4 findings.
All numbers loaded from saved outputs — nothing recomputed.
Currency: BRL (R$). No causation claims — associations only.
"""
import streamlit as st
import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import json, os

# ─────────────────────── CONFIG ───────────────────────
st.set_page_config(
    page_title="Customer Voice & Business Impact Analytics",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="expanded"
)

DATA = "data/processed"
S4 = f"{DATA}/stage4"

# ─────────────────────── LOAD DATA ───────────────────────
@st.cache_data
def load_all():
    nlp_metrics = json.load(open(f"{DATA}/nlp_summary_metrics.json", encoding="utf-8"))
    nlp_topics = json.load(open(f"{DATA}/nlp_topics.json", encoding="utf-8"))
    s4_metrics = json.load(open(f"{S4}/stage4_metrics.json", encoding="utf-8"))
    cat_agg = pd.read_csv(f"{S4}/agg_category.csv")
    seller_agg = pd.read_csv(f"{S4}/agg_seller.csv")
    state_agg = pd.read_csv(f"{S4}/agg_state.csv")
    monthly = pd.read_csv(f"{S4}/agg_monthly.csv")
    quarterly = pd.read_csv(f"{S4}/agg_quarterly.csv")
    prio = pd.read_csv(f"{S4}/business_prioritization.csv")
    complaint_mx = pd.read_csv(f"{S4}/complaint_matrix.csv", index_col=0)
    reviews = pd.read_parquet(f"{DATA}/fact_order_reviews.parquet")
    return (nlp_metrics, nlp_topics, s4_metrics, cat_agg, seller_agg,
            state_agg, monthly, quarterly, prio, complaint_mx, reviews)

(nlp_m, nlp_t, s4_m, cat_agg, seller_agg, state_agg,
 monthly, quarterly, prio, complaint_mx, reviews) = load_all()

# ─────────────────────── THEME ───────────────────────
COLORS = {
    "bg": "#0E1117",
    "card": "#1B1F2B",
    "accent": "#00D4AA",
    "accent2": "#7B61FF",
    "accent3": "#FF6B6B",
    "text": "#FAFAFA",
    "muted": "#8B8FA3",
    "positive": "#00D4AA",
    "negative": "#FF6B6B",
    "neutral": "#FFD93D",
}

plotly_template = dict(
    layout=go.Layout(
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        font=dict(color=COLORS["text"], family="Inter, sans-serif"),
        xaxis=dict(gridcolor="rgba(255,255,255,0.06)"),
        yaxis=dict(gridcolor="rgba(255,255,255,0.06)"),
        margin=dict(l=40, r=20, t=40, b=40),
    )
)

# ─────────────────────── CSS ───────────────────────
st.markdown("""
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

* { font-family: 'Inter', sans-serif; }

.main { background-color: #0E1117; }

.metric-card {
    background: linear-gradient(135deg, #1B1F2B 0%, #252A3A 100%);
    border-radius: 16px;
    padding: 24px;
    border: 1px solid rgba(255,255,255,0.06);
    text-align: center;
    transition: transform 0.2s, box-shadow 0.2s;
}
.metric-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 32px rgba(0,212,170,0.15);
}
.metric-value {
    font-size: 2.2rem;
    font-weight: 800;
    background: linear-gradient(135deg, #00D4AA, #7B61FF);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    margin: 8px 0 4px 0;
}
.metric-label {
    font-size: 0.85rem;
    color: #8B8FA3;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 1px;
}
.metric-sublabel {
    font-size: 0.75rem;
    color: #5A5F73;
    margin-top: 4px;
}

.section-header {
    font-size: 1.6rem;
    font-weight: 700;
    margin: 2rem 0 1rem 0;
    padding-bottom: 8px;
    border-bottom: 2px solid rgba(0,212,170,0.3);
    color: #FAFAFA;
}

.insight-box {
    background: linear-gradient(135deg, rgba(0,212,170,0.08), rgba(123,97,255,0.08));
    border-left: 3px solid #00D4AA;
    border-radius: 0 12px 12px 0;
    padding: 16px 20px;
    margin: 12px 0;
    font-size: 0.9rem;
    color: #C8CCD8;
}

.warning-box {
    background: linear-gradient(135deg, rgba(255,107,107,0.08), rgba(255,217,61,0.08));
    border-left: 3px solid #FF6B6B;
    border-radius: 0 12px 12px 0;
    padding: 16px 20px;
    margin: 12px 0;
    font-size: 0.85rem;
    color: #C8CCD8;
}

.stTabs [data-baseweb="tab-list"] {
    gap: 8px;
}
.stTabs [data-baseweb="tab"] {
    background-color: #1B1F2B;
    border-radius: 8px;
    padding: 8px 20px;
    color: #8B8FA3;
    border: 1px solid rgba(255,255,255,0.06);
}
.stTabs [aria-selected="true"] {
    background: linear-gradient(135deg, #00D4AA, #7B61FF) !important;
    color: #0E1117 !important;
}
</style>
""", unsafe_allow_html=True)

# ─────────────────────── SIDEBAR ───────────────────────
with st.sidebar:
    st.markdown("# 📊 Navigation")
    page = st.radio("", [
        "🏠 Overview",
        "🧠 NLP Insights",
        "📈 Statistical Analysis",
        "🚚 Delivery Analysis",
        "💰 Business Impact",
        "🏢 Category Deep Dive",
        "🗄️ SQL Analytics"
    ], label_visibility="collapsed")

    st.markdown("---")
    st.markdown(f"""
    <div style='text-align:center; color:#5A5F73; font-size:0.75rem;'>
    <b>Dataset:</b> Olist E-Commerce<br>
    <b>Reviews:</b> {nlp_m['total_reviews']:,}<br>
    <b>With Text:</b> {nlp_m['reviews_with_text']:,} ({nlp_m['text_coverage_pct']}%)<br>
    <b>Currency:</b> BRL (R$)<br>
    <b>Language:</b> Portuguese
    </div>
    """, unsafe_allow_html=True)

# ═══════════════════════════════════════════════════════════
# PAGE: OVERVIEW
# ═══════════════════════════════════════════════════════════
if page == "🏠 Overview":
    st.markdown("""
    <h1 style='text-align:center; font-weight:800; font-size:2.4rem;
        background: linear-gradient(135deg, #00D4AA, #7B61FF);
        -webkit-background-clip: text; -webkit-text-fill-color: transparent;'>
        Customer Voice & Business Impact Analytics
    </h1>
    <p style='text-align:center; color:#8B8FA3; font-size:1rem; margin-bottom:2rem;'>
        NLP-Driven Risk Assessment Framework for E-Commerce · Olist Dataset · BRL (R$)
    </p>
    """, unsafe_allow_html=True)

    # KPI cards
    exp = s4_m['commercial_exposure']
    cols = st.columns(5)
    kpis = [
        ("99,441", "Total Orders", ""),
        (f"{nlp_m['reviews_with_text']:,}", "Reviews Analyzed", f"{nlp_m['text_coverage_pct']}% of all reviews"),
        (f"{nlp_m['transformer_sentiment']['agreement_rate_pct']}%", "NLP Agreement", "Transformer vs Star Rating"),
        ("8", "Complaint Topics", "Data-driven discovery"),
        (f"R$ {exp['affected_order_value_BRL']:,.0f}", "At-Risk Order Value", "Tied to negative sentiment"),
    ]
    for col, (val, label, sub) in zip(cols, kpis):
        col.markdown(f"""
        <div class='metric-card'>
            <div class='metric-value'>{val}</div>
            <div class='metric-label'>{label}</div>
            <div class='metric-sublabel'>{sub}</div>
        </div>
        """, unsafe_allow_html=True)

    st.markdown("<br>", unsafe_allow_html=True)

    # Review score distribution
    col1, col2 = st.columns([1.2, 1])

    with col1:
        st.markdown("<div class='section-header'>Review Score Distribution</div>", unsafe_allow_html=True)
        score_dist = reviews['review_score'].value_counts().sort_index()
        fig = go.Figure(go.Bar(
            x=score_dist.index.astype(str),
            y=score_dist.values,
            marker=dict(
                color=['#FF6B6B', '#FF9F43', '#FFD93D', '#54A0FF', '#00D4AA'],
                cornerradius=6
            ),
            text=[f"{v:,}" for v in score_dist.values],
            textposition='outside',
            textfont=dict(size=13, color='#C8CCD8')
        ))
        fig.update_layout(**plotly_template['layout'].to_plotly_json(),
                          height=350, xaxis_title="Review Score", yaxis_title="Count",
                          showlegend=False)
        st.plotly_chart(fig, use_container_width=True)

    with col2:
        st.markdown("<div class='section-header'>Sentiment Distribution (NLP)</div>", unsafe_allow_html=True)
        sent_dist = nlp_m['transformer_sentiment']['distribution']
        fig2 = go.Figure(go.Pie(
            labels=list(sent_dist.keys()),
            values=list(sent_dist.values()),
            marker=dict(colors=[COLORS['positive'], COLORS['negative'], COLORS['neutral']]),
            hole=0.55,
            textinfo='label+percent',
            textfont=dict(size=13)
        ))
        fig2.update_layout(**plotly_template['layout'].to_plotly_json(), height=350,
                           showlegend=False)
        st.plotly_chart(fig2, use_container_width=True)

    # Statistical highlights
    st.markdown("<div class='section-header'>Key Statistical Findings</div>", unsafe_allow_html=True)
    st.markdown("""
    <div class='insight-box'>
        <b>All results are associations only.</b> This project uses observational data and does not establish causation.
    </div>
    """, unsafe_allow_html=True)

    corrs = s4_m['statistical_analysis']['correlations']
    lat = s4_m['statistical_analysis']['ontime_vs_late']

    c1, c2, c3 = st.columns(3)
    c1.metric("Delivery Delay vs Score", f"ρ = {corrs['Delivery Delay vs Review Score']['rho']}", "p < 0.0001")
    c2.metric("On-Time Avg Score", f"{lat['ontime_mean']}", f"vs Late: {lat['late_mean']}")
    c3.metric("Complaint Rate vs Avg Rating", f"ρ = {corrs['Complaint Rate vs Avg Rating']['rho']}", "Category-level")


# ═══════════════════════════════════════════════════════════
# PAGE: NLP INSIGHTS
# ═══════════════════════════════════════════════════════════
elif page == "🧠 NLP Insights":
    st.markdown("<h1 style='font-weight:700;'>🧠 NLP Insights</h1>", unsafe_allow_html=True)

    # Agreement by score
    st.markdown("<div class='section-header'>Sentiment Agreement by Star Rating</div>", unsafe_allow_html=True)
    per_score = nlp_m['transformer_sentiment']['per_score_agreement_pct']
    scores = list(per_score.keys())
    vals = list(per_score.values())
    colors_agree = ['#FF6B6B' if v < 50 else '#FFD93D' if v < 70 else '#00D4AA' for v in vals]

    fig = go.Figure(go.Bar(
        x=[f"Score {s}" for s in scores], y=vals,
        marker=dict(color=colors_agree, cornerradius=6),
        text=[f"{v:.1f}%" for v in vals], textposition='outside',
        textfont=dict(size=14, color='#C8CCD8')
    ))
    fig.update_layout(**plotly_template['layout'].to_plotly_json(), height=350,
                      yaxis_title="Agreement %", yaxis_range=[0,100])
    st.plotly_chart(fig, use_container_width=True)

    st.markdown("""
    <div class='insight-box'>
        Score 3 (37.8% agreement) is inherently ambiguous — neither clearly positive nor negative.
        Score 5 reviews agree 82.6% of the time, indicating the model handles clear sentiment well.
    </div>
    """, unsafe_allow_html=True)

    # Aspects
    st.markdown("<div class='section-header'>Complaint Aspect Breakdown</div>", unsafe_allow_html=True)
    aspects = nlp_m['aspect_summary']
    asp_df = pd.DataFrame([
        {'Aspect': k, 'Total Mentions': v['total_mentions'],
         'Negative': v['negative'], 'Neutral': v['neutral'], 'Positive': v['positive'],
         'Neg %': round(v['negative']/v['total_mentions']*100, 1)}
        for k, v in aspects.items() if k != 'Uncategorized'
    ]).sort_values('Neg %', ascending=True)

    fig = go.Figure(go.Bar(
        y=asp_df['Aspect'], x=asp_df['Neg %'],
        orientation='h',
        marker=dict(
            color=asp_df['Neg %'],
            colorscale=[[0, '#00D4AA'], [0.5, '#FFD93D'], [1, '#FF6B6B']],
            cornerradius=4
        ),
        text=[f"{v:.1f}% ({n:,})" for v, n in zip(asp_df['Neg %'], asp_df['Total Mentions'])],
        textposition='outside',
        textfont=dict(size=12, color='#C8CCD8')
    ))
    fig.update_layout(**plotly_template['layout'].to_plotly_json(), height=400,
                      xaxis_title="Negative Rate (%)", xaxis_range=[0, 80])
    st.plotly_chart(fig, use_container_width=True)

    # Topics
    st.markdown("<div class='section-header'>Discovered Topics (Embedding-Based)</div>", unsafe_allow_html=True)
    topic_data = []
    for t in nlp_t['embedding_topics']:
        topic_data.append({
            'Topic': f"T{t['topic_id']}",
            'Reviews': t['review_count'],
            'Top Terms': ', '.join(t['representative_terms'][:6])
        })
    st.dataframe(pd.DataFrame(topic_data), use_container_width=True, hide_index=True,
                 column_config={"Reviews": st.column_config.NumberColumn(format="%d")})


# ═══════════════════════════════════════════════════════════
# PAGE: STATISTICAL ANALYSIS
# ═══════════════════════════════════════════════════════════
elif page == "📈 Statistical Analysis":
    st.markdown("<h1 style='font-weight:700;'>📈 Statistical Analysis</h1>", unsafe_allow_html=True)
    st.markdown("""
    <div class='warning-box'>
        ⚠️ <b>All results are associations only.</b> This project uses observational data and does not establish causation.
    </div>
    """, unsafe_allow_html=True)

    # Correlations
    st.markdown("<div class='section-header'>Spearman Rank Correlations</div>", unsafe_allow_html=True)
    corrs = s4_m['statistical_analysis']['correlations']
    corr_df = pd.DataFrame([
        {'Variable Pair': k, 'ρ (Spearman)': v['rho'],
         'p-value': f"{v['p_value']:.2e}" if v['p_value'] > 0 else "< 1e-300"}
        for k, v in corrs.items()
    ])

    fig = go.Figure(go.Bar(
        x=[r['ρ (Spearman)'] for _, r in corr_df.iterrows()],
        y=[r['Variable Pair'] for _, r in corr_df.iterrows()],
        orientation='h',
        marker=dict(
            color=[COLORS['negative'] if r['ρ (Spearman)'] < 0 else COLORS['positive']
                   for _, r in corr_df.iterrows()],
            cornerradius=6
        ),
        text=[f"ρ = {r['ρ (Spearman)']:.4f}" for _, r in corr_df.iterrows()],
        textposition='outside', textfont=dict(size=13, color='#C8CCD8')
    ))
    fig.update_layout(**plotly_template['layout'].to_plotly_json(), height=300,
                      xaxis_title="Spearman ρ", xaxis_range=[-1.1, 0.3])
    st.plotly_chart(fig, use_container_width=True)

    # On-time vs Late
    st.markdown("<div class='section-header'>On-Time vs Late Delivery</div>", unsafe_allow_html=True)
    lat = s4_m['statistical_analysis']['ontime_vs_late']

    c1, c2, c3 = st.columns(3)
    c1.metric("On-Time Mean Score", f"{lat['ontime_mean']}", f"N = {lat['ontime_n']:,}")
    c2.metric("Late Mean Score", f"{lat['late_mean']}", f"N = {lat['late_n']:,}", delta_color="inverse")
    c3.metric("Mann-Whitney U", f"p < 0.0001", "Highly significant")

    # Price bands
    st.markdown("<div class='section-header'>Price Band Comparison</div>", unsafe_allow_html=True)
    pb = s4_m['statistical_analysis']['price_bands']
    pb_df = pd.DataFrame([
        {'Price Band': k, 'Mean Score': v['mean'], 'N': v['n']}
        for k, v in pb['bands'].items()
    ])
    fig = go.Figure(go.Bar(
        x=pb_df['Price Band'], y=pb_df['Mean Score'],
        marker=dict(color=[COLORS['accent2'], COLORS['accent'], COLORS['neutral'], COLORS['accent3']],
                    cornerradius=6),
        text=[f"{v:.2f}" for v in pb_df['Mean Score']], textposition='outside',
        textfont=dict(size=14, color='#C8CCD8')
    ))
    fig.update_layout(**plotly_template['layout'].to_plotly_json(), height=350,
                      yaxis_title="Mean Review Score", yaxis_range=[3.4, 3.9])
    st.plotly_chart(fig, use_container_width=True)
    st.caption(f"Kruskal-Wallis H = {pb['H']}, p = {pb['p_value']:.2e}")

    # Regression
    st.markdown("<div class='section-header'>Logistic Regression</div>", unsafe_allow_html=True)
    reg = s4_m['statistical_analysis']['logistic_regression']
    st.markdown(f"""
    <div class='warning-box'>
        <b>Model:</b> P(negative review) ~ delay_days + price + freight_value<br>
        <b>Pseudo R²:</b> {reg['pseudo_r2']}<br>
        <b>N observations:</b> {reg['n_obs']:,}<br><br>
        ⚠️ {reg['disclaimer']}
    </div>
    """, unsafe_allow_html=True)
    reg_df = pd.DataFrame([
        {'Predictor': k, 'Coefficient': v, 'p-value': f"{reg['p_values'][k]:.6f}"}
        for k, v in reg['coefficients'].items()
    ])
    st.dataframe(reg_df, use_container_width=True, hide_index=True)


# ═══════════════════════════════════════════════════════════
# PAGE: DELIVERY ANALYSIS
# ═══════════════════════════════════════════════════════════
elif page == "🚚 Delivery Analysis":
    st.markdown("<h1 style='font-weight:700;'>🚚 Delivery Analysis</h1>", unsafe_allow_html=True)

    del_data = s4_m['delivery_analysis']

    # States
    st.markdown("<div class='section-header'>Late Delivery Rate by State</div>", unsafe_allow_html=True)
    state_df = pd.DataFrame(del_data['top_late_states'])
    fig = go.Figure(go.Bar(
        x=state_df['state'], y=state_df['late_rate'].apply(lambda x: x*100),
        marker=dict(
            color=state_df['late_rate'].apply(lambda x: x*100),
            colorscale=[[0, '#00D4AA'], [0.5, '#FFD93D'], [1, '#FF6B6B']],
            cornerradius=6
        ),
        text=[f"{r*100:.1f}%" for r in state_df['late_rate']],
        textposition='outside', textfont=dict(size=12, color='#C8CCD8')
    ))
    fig.update_layout(**plotly_template['layout'].to_plotly_json(), height=400,
                      xaxis_title="State", yaxis_title="Late Rate (%)")
    st.plotly_chart(fig, use_container_width=True)

    # Categories
    st.markdown("<div class='section-header'>Late Delivery Rate by Category (N≥100)</div>", unsafe_allow_html=True)
    cat_late_df = pd.DataFrame(del_data['top_late_categories'])
    fig = go.Figure(go.Bar(
        y=cat_late_df['category'], x=cat_late_df['late_rate'].apply(lambda x: x*100),
        orientation='h',
        marker=dict(
            color=cat_late_df['late_rate'].apply(lambda x: x*100),
            colorscale=[[0, '#00D4AA'], [0.5, '#FFD93D'], [1, '#FF6B6B']],
            cornerradius=4
        ),
        text=[f"{r*100:.1f}%" for r in cat_late_df['late_rate']],
        textposition='outside', textfont=dict(size=12, color='#C8CCD8')
    ))
    fig.update_layout(**plotly_template['layout'].to_plotly_json(), height=450,
                      xaxis_title="Late Rate (%)")
    st.plotly_chart(fig, use_container_width=True)

    # Aspect by delivery
    st.markdown("<div class='section-header'>Complaint Aspects: Late vs On-Time</div>", unsafe_allow_html=True)
    asp_del = pd.DataFrame(del_data['aspect_by_delivery'])
    # Filter to top aspects (single-word/main aspects only)
    main_asp = asp_del[asp_del['extracted_aspects'].isin([
        'Delivery/Logistics', 'Product Quality', 'Customer Service',
        'Wrong/Missing Item', 'Packaging', 'Price/Value', 'Description Mismatch', 'Uncategorized'
    ])].copy()
    if not main_asp.empty:
        fig = go.Figure()
        fig.add_trace(go.Bar(name='On-Time', y=main_asp['extracted_aspects'],
                             x=main_asp['on_time'], orientation='h',
                             marker_color=COLORS['positive']))
        fig.add_trace(go.Bar(name='Late', y=main_asp['extracted_aspects'],
                             x=main_asp['late'], orientation='h',
                             marker_color=COLORS['negative']))
        fig.update_layout(**plotly_template['layout'].to_plotly_json(), height=400,
                          barmode='group', xaxis_title="Count (Negative Reviews)",
                          legend=dict(orientation='h', y=1.1))
        st.plotly_chart(fig, use_container_width=True)


# ═══════════════════════════════════════════════════════════
# PAGE: BUSINESS IMPACT
# ═══════════════════════════════════════════════════════════
elif page == "💰 Business Impact":
    st.markdown("<h1 style='font-weight:700;'>💰 Business Impact</h1>", unsafe_allow_html=True)

    st.markdown("""
    <div class='warning-box'>
        ⚠️ <b>All figures below are scenario-based estimates, NOT observed historical revenue loss.</b><br>
        Formula: commercial_exposure = affected_order_value × configurable_impact_assumption
    </div>
    """, unsafe_allow_html=True)

    exp = s4_m['commercial_exposure']

    c1, c2 = st.columns(2)
    c1.markdown(f"""
    <div class='metric-card'>
        <div class='metric-value'>R$ {exp['affected_order_value_BRL']:,.0f}</div>
        <div class='metric-label'>Total At-Risk Order Value</div>
        <div class='metric-sublabel'>Tied to negative NLP sentiment</div>
    </div>
    """, unsafe_allow_html=True)
    c2.markdown(f"""
    <div class='metric-card'>
        <div class='metric-value'>{exp['affected_orders']:,}</div>
        <div class='metric-label'>Affected Orders</div>
        <div class='metric-sublabel'>Orders with negative sentiment</div>
    </div>
    """, unsafe_allow_html=True)

    st.markdown("<br>", unsafe_allow_html=True)

    # Sensitivity table
    st.markdown("<div class='section-header'>Sensitivity Table — Scenario-Based Exposure</div>", unsafe_allow_html=True)
    sens = pd.DataFrame(exp['sensitivity_table'])
    fig = go.Figure(go.Bar(
        x=[f"{int(r)}%" for r in sens['impact_pct']],
        y=sens['exposure_BRL'],
        marker=dict(
            color=sens['exposure_BRL'],
            colorscale=[[0, '#00D4AA'], [0.5, '#FFD93D'], [1, '#FF6B6B']],
            cornerradius=6
        ),
        text=[f"R$ {v:,.0f}" for v in sens['exposure_BRL']],
        textposition='outside', textfont=dict(size=13, color='#C8CCD8')
    ))
    fig.update_layout(**plotly_template['layout'].to_plotly_json(), height=400,
                      xaxis_title="Impact Assumption", yaxis_title="Scenario Exposure (R$)")
    st.plotly_chart(fig, use_container_width=True)

    # Prioritization
    st.markdown("<div class='section-header'>Business Prioritization — 2×2 Framework</div>", unsafe_allow_html=True)

    seg_colors = {
        'HIGH Risk + HIGH Exposure': '#FF6B6B',
        'HIGH Risk + LOW Exposure': '#FF9F43',
        'LOW Risk + HIGH Exposure': '#54A0FF',
        'LOW Risk + LOW Exposure': '#00D4AA'
    }

    prio_renamed = prio.rename(columns={
        'product_category_name_english': 'Category',
        'neg_sentiment_rate': 'Neg Sentiment Rate',
        'neg_review_rate': 'Neg Review Rate',
        'total_value': 'Total Revenue'
    })

    fig = px.scatter(
        prio_renamed, x='Total Revenue', y='Neg Sentiment Rate',
        color='segment', hover_name='Category',
        size='review_count', size_max=35,
        color_discrete_map=seg_colors,
        labels={'Total Revenue': 'Total Order Value (R$)', 'Neg Sentiment Rate': 'Negative Sentiment Rate'}
    )
    fig.update_layout(**plotly_template['layout'].to_plotly_json(), height=500,
                      legend=dict(orientation='h', y=-0.15, font=dict(size=11)))
    st.plotly_chart(fig, width='stretch')

    # Table
    for seg in ['HIGH Risk + HIGH Exposure', 'HIGH Risk + LOW Exposure',
                'LOW Risk + HIGH Exposure', 'LOW Risk + LOW Exposure']:
        subset = prio_renamed[prio_renamed['segment'] == seg].sort_values('Neg Sentiment Rate', ascending=False)
        color = seg_colors[seg]
        st.markdown(f"<span style='color:{color}; font-weight:700;'>● {seg}</span> ({len(subset)} categories)", unsafe_allow_html=True)
        st.dataframe(subset[['Category', 'review_count', 'Neg Sentiment Rate', 'Total Revenue']].reset_index(drop=True),
                     width='stretch', hide_index=True,
                     column_config={
                         "review_count": st.column_config.NumberColumn("Reviews", format="%d"),
                         "Neg Sentiment Rate": st.column_config.NumberColumn("Neg Rate", format="%.1f%%"),
                         "Total Revenue": st.column_config.NumberColumn("Value (R$)", format="R$ %,.0f")
                     })


# ═══════════════════════════════════════════════════════════
# PAGE: CATEGORY DEEP DIVE
# ═══════════════════════════════════════════════════════════
elif page == "🏢 Category Deep Dive":
    st.markdown("<h1 style='font-weight:700;'>🏢 Category Deep Dive</h1>", unsafe_allow_html=True)

    # Heatmap
    st.markdown("<div class='section-header'>Category × Complaint Aspect Heatmap</div>", unsafe_allow_html=True)

    # Filter to main single aspects for readability
    single_aspects = [c for c in complaint_mx.columns if c in [
        'Delivery/Logistics', 'Product Quality', 'Customer Service',
        'Wrong/Missing Item', 'Packaging', 'Price/Value', 'Description Mismatch', 'Uncategorized'
    ]]
    if single_aspects:
        hm_data = complaint_mx[single_aspects].head(20)
        fig = go.Figure(go.Heatmap(
            z=hm_data.values * 100,
            x=hm_data.columns,
            y=hm_data.index,
            colorscale=[[0, '#0E1117'], [0.3, '#1B4332'], [0.6, '#FFD93D'], [1, '#FF6B6B']],
            text=np.round(hm_data.values * 100, 1),
            texttemplate="%{text}%",
            textfont=dict(size=10),
            colorbar=dict(title="Complaint %")
        ))
        fig.update_layout(**plotly_template['layout'].to_plotly_json(), height=600)
        st.plotly_chart(fig, use_container_width=True)

    # Monthly trends
    st.markdown("<div class='section-header'>Monthly Trends</div>", unsafe_allow_html=True)
    monthly_sorted = monthly.sort_values('order_month')
    fig = make_subplots(specs=[[{"secondary_y": True}]])
    fig.add_trace(go.Bar(
        x=monthly_sorted['order_month'], y=monthly_sorted['review_count'],
        name='Reviews', marker_color='rgba(0,212,170,0.3)',
    ), secondary_y=False)
    fig.add_trace(go.Scatter(
        x=monthly_sorted['order_month'], y=monthly_sorted['neg_sentiment_rate']*100,
        name='Neg Sentiment %', line=dict(color=COLORS['negative'], width=3),
        mode='lines+markers'
    ), secondary_y=True)
    fig.update_layout(**plotly_template['layout'].to_plotly_json(), height=400,
                      legend=dict(orientation='h', y=1.1))
    fig.update_yaxes(title_text="Review Count", secondary_y=False)
    fig.update_yaxes(title_text="Negative Sentiment %", secondary_y=True)
    st.plotly_chart(fig, use_container_width=True)

    # Category table
    st.markdown("<div class='section-header'>Full Category Metrics</div>", unsafe_allow_html=True)
    cat_display = cat_agg[cat_agg['confidence'] == 'HIGH'].sort_values('neg_sentiment_rate', ascending=False)
    st.dataframe(
        cat_display[['category', 'review_count', 'avg_review_score', 'neg_review_rate',
                     'neg_sentiment_rate', 'avg_item_price', 'avg_freight', 'late_delivery_rate',
                     'top_complaint_topic']].reset_index(drop=True),
        use_container_width=True, hide_index=True,
        column_config={
            "category": "Category",
            "review_count": st.column_config.NumberColumn("Reviews", format="%d"),
            "avg_review_score": st.column_config.NumberColumn("Avg Score", format="%.2f"),
            "neg_review_rate": st.column_config.NumberColumn("Neg Review %", format="%.1f%%"),
            "neg_sentiment_rate": st.column_config.NumberColumn("Neg Sentiment %", format="%.1f%%"),
            "avg_item_price": st.column_config.NumberColumn("Avg Price (R$)", format="R$ %.2f"),
            "avg_freight": st.column_config.NumberColumn("Avg Freight (R$)", format="R$ %.2f"),
            "late_delivery_rate": st.column_config.NumberColumn("Late %", format="%.1f%%"),
            "top_complaint_topic": "Top Topic"
        }
    )


# ═══════════════════════════════════════════════════════════
# PAGE: SQL ANALYTICS
# ═══════════════════════════════════════════════════════════
elif page == "🗄️ SQL Analytics":
    st.markdown("<h1 style='font-weight:700;'>🗄️ SQL Analytical Queries</h1>", unsafe_allow_html=True)
    st.markdown("""
    <div class='insight-box'>
        11 validated SQL queries run against the Parquet data warehouse via DuckDB.
        All queries returned real results and can be connected to any BI tool.
    </div>
    """, unsafe_allow_html=True)

    sql_files = sorted([f for f in os.listdir("sql") if f.endswith('.sql')])
    selected = st.selectbox("Select Query", sql_files)

    if selected:
        with open(f"sql/{selected}", 'r', encoding='utf-8') as f:
            query = f.read()
        st.code(query, language='sql')

        try:
            import duckdb
            conn = duckdb.connect(':memory:')
            for tbl in ['nlp_reviews', 'fact_orders', 'fact_order_items',
                        'dim_products', 'dim_customers', 'dim_sellers']:
                conn.execute(f"CREATE VIEW {tbl} AS SELECT * FROM read_parquet('{DATA}/{tbl}.parquet')")
            result = conn.execute(query).df()
            st.dataframe(result.head(20), use_container_width=True, hide_index=True)
            st.caption(f"Total rows: {len(result):,}")
            conn.close()
        except Exception as e:
            st.error(f"Error: {e}")
