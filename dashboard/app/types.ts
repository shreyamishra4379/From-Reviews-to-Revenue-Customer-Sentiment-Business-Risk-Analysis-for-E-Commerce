// Shared TypeScript types — mirror the JSON written by export_dashboard_data.py

export interface Correlation { pair: string; rho: number; n?: number; p_value: number; p_label: string; significant?: boolean }

export interface OntimeVsLate {
  ontime_mean: number; late_mean: number; ontime_n: number; late_n: number;
  ontime_neg_review_rate?: number; late_neg_review_rate?: number;
  test?: string; p_value?: number; p_label?: string; significant?: boolean;
}

export interface Overview {
  total_reviews: number;
  reviews_with_text: number;
  text_coverage_pct: number;
  total_orders: number;
  nlp_agreement_pct: number;
  complaint_topics_count: number;
  sentiment_distribution: Record<string, number>;
  per_score_agreement_pct: Record<string, number>;
  review_score_distribution: Record<string, number>;
  correlations: Correlation[];
  ontime_vs_late: OntimeVsLate & { ontime_neg_review_rate: number; late_neg_review_rate: number };
  disclaimer: string;
  headlines: {
    top_aspects_by_negative: { aspect: string; negative: number; share_of_negative_pct: number }[];
    highest_negative_rate_aspect: { aspect: string; neg_pct: number; total_mentions: number };
    late_delivery: { delivered_orders: number; late_orders: number; late_pct: number };
    exposure: { affected_order_value_BRL: number; affected_orders: number; at_5_pct_BRL: number };
    act_first: { count: number; categories: { category: string; neg_sentiment_rate: number; review_count: number }[] };
  };
}

export interface Aspect {
  aspect: string;
  total_mentions: number;
  negative: number;
  neutral: number;
  positive: number;
  neg_pct: number;
  pos_pct?: number;
}

export interface Topic { topic_id: number; label: string; review_count: number; top_terms: string[] }

export interface NlpInsights {
  total_reviews: number;
  reviews_with_text: number;
  text_coverage_pct: number;
  sentiment_distribution: Record<string, number>;
  agreement_rate_pct: number;
  per_score_agreement: { score: number; agreement_pct: number }[];
  review_score_distribution: Record<string, number>;
  aspects: Aspect[];
  topics: Topic[];
}

export interface CategoryRow {
  category: string;
  review_count: number;
  avg_review_score: number;
  neg_review_rate: number;
  neg_sentiment_rate: number;
  avg_item_price: number;
  avg_freight: number;
  late_delivery_rate: number;
  top_complaint_topic: string;
  confidence: string;
  low_n: boolean;
}

export interface Heatmap { categories: string[]; aspects: string[]; values: number[][] }

export interface CategoryIntelligence { low_n_threshold: number; categories: CategoryRow[]; heatmap: Heatmap }

export interface DeliveryData {
  state_late_rates: { state: string; late_rate_pct: number; order_count: number }[];
  category_late_rates: { category: string; late_rate_pct: number; order_count: number }[];
  aspect_by_delivery: { aspect: string; on_time: number; late: number }[];
  monthly_trends: { month: string; order_count: number; review_count: number; neg_sentiment_rate: number }[];
  ontime_vs_late: OntimeVsLate & { ontime_neg_review_rate: number; late_neg_review_rate: number };
}

export interface SensitivityRow { impact_pct: number; label: string; exposure_BRL: number }

export interface PrioRow {
  category: string;
  segment: string;
  neg_sentiment_rate: number;
  neg_review_rate: number;
  total_value: number;
  review_count: number;
  low_n: boolean;
}

export interface Coefficient { predictor: string; coef: number; p_value: number }

export interface Logit {
  pseudo_r2: number;
  n_obs: number;
  disclaimer: string;
  odds_ratios?: Record<string, number>;
  coefficients: Coefficient[];
}

export interface BusinessImpact {
  disclaimer: string;
  currency: string;
  affected_order_value_BRL: number;
  affected_orders: number;
  sensitivity_table: SensitivityRow[];
  prioritization: PrioRow[];
  low_n_threshold: number;
  prioritization_thresholds: { median_neg_sentiment_rate: number; median_total_value_BRL: number };
  ontime_vs_late: OntimeVsLate;
  price_bands: { band: string; mean_score: number; n: number }[];
  logistic_regression: Logit;
}

export interface StatisticalAnalysis {
  disclaimer: string;
  correlations: Correlation[];
  ontime_vs_late: OntimeVsLate;
  price_bands: { H_stat: number; p_value: number; bands: { band: string; mean_score: number; n: number }[] };
  logistic_regression: Logit;
}
