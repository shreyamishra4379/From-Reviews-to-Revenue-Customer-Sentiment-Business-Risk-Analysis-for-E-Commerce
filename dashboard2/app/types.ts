// Shared TypeScript types for the dashboard — mirrors the exported JSON shapes

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
  correlations: { pair: string; rho: number; p_value: number; p_label: string }[];
  ontime_vs_late: { ontime_mean: number; late_mean: number; ontime_n: number; late_n: number };
  disclaimer: string;
}

export interface Aspect {
  aspect: string;
  total_mentions: number;
  negative: number;
  neutral: number;
  positive: number;
  neg_pct: number;
}

export interface Topic {
  topic_id: number;
  label: string;
  review_count: number;
  top_terms: string[];
}

export interface CustomerVoice {
  aspects: Aspect[];
  topics: Topic[];
  per_score_agreement: { score: number; agreement_pct: number }[];
  sentiment_distribution: Record<string, number>;
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

export interface Heatmap {
  categories: string[];
  aspects: string[];
  values: number[][];
}

export interface CategoryIntelligence {
  low_n_threshold: number;
  categories: CategoryRow[];
  heatmap: Heatmap;
}

export interface DeliveryData {
  state_late_rates: { state: string; late_rate_pct: number; order_count: number }[];
  category_late_rates: { category: string; late_rate_pct: number; order_count: number }[];
  aspect_by_delivery: { aspect: string; on_time: number; late: number }[];
  monthly_trends: { month: string; order_count: number; review_count: number; neg_sentiment_rate: number }[];
}

export interface SensitivityRow {
  impact_pct: number;
  label: string;
  exposure_BRL: number;
}

export interface PrioRow {
  category: string;
  segment: string;
  neg_sentiment_rate: number;
  neg_review_rate: number;
  total_value: number;
  review_count: number;
  low_n: boolean;
}

export interface BusinessImpact {
  disclaimer: string;
  currency: string;
  affected_order_value_BRL: number;
  affected_orders: number;
  sensitivity_table: SensitivityRow[];
  prioritization: PrioRow[];
  low_n_threshold: number;
  ontime_vs_late: { ontime_mean: number; late_mean: number; ontime_n: number; late_n: number };
  price_bands: { band: string; mean_score: number; n: number }[];
  logistic_regression: {
    pseudo_r2: number;
    n_obs: number;
    disclaimer: string;
    coefficients: { predictor: string; coef: number; p_value: number }[];
  };
}
