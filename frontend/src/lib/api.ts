const API_BASE = '/api';

async function fetchJson<T>(endpoint: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error(`Failed to fetch ${endpoint}:`, error);
    return null;
  }
}

export async function getNlpMetrics() {
  return fetchJson<{
    total_reviews: number;
    reviews_with_text: number;
    text_coverage_pct: number;
    transformer_sentiment: {
      agreement_rate_pct: number;
      distribution: Record<string, number>;
      per_score_agreement_pct: Record<string, number>;
    };
    baseline_lexicon: {
      agreement_rate_pct: number;
      distribution: Record<string, number>;
    };
    aspect_summary: Record<string, {
      total_mentions: number;
      negative: number;
      neutral: number;
      positive: number;
    }>;
  }>('/nlp/metrics');
}

export async function getNlpTopics() {
  return fetchJson<{
    embedding_topics: Array<{
      topic_id: number;
      review_count: number;
      representative_terms: string[];
      business_topic_name: string;
      sample_reviews: string[];
    }>;
  }>('/nlp/topics');
}

export async function getStage4Metrics() {
  return fetchJson<{
    statistical_analysis: {
      correlations: Record<string, { rho: number; p_value: number }>;
      ontime_vs_late: {
        ontime_mean: number;
        late_mean: number;
        ontime_n: number;
        late_n: number;
      };
      price_bands: {
        bands: Record<string, { mean: number; n: number }>;
        H: number;
        p_value: number;
      };
      logistic_regression: {
        coefficients: Record<string, number>;
        p_values: Record<string, number>;
        pseudo_r2: number;
        n_obs: number;
        disclaimer: string;
      };
    };
    delivery_analysis: {
      top_late_states: Array<{ state: string; late_rate: number; n: number }>;
      top_late_categories: Array<{ category: string; late_rate: number; n: number }>;
      aspect_by_delivery: Array<{
        extracted_aspects: string;
        on_time: number;
        late: number;
        total: number;
        late_share: number;
      }>;
    };
    commercial_exposure: {
      affected_order_value_BRL: number;
      affected_orders: number;
      sensitivity_table: Array<{ impact_pct: number; exposure_BRL: number }>;
    };
  }>('/stage4/metrics');
}

export async function getCategoryAgg() {
  return fetchJson<Array<{
    category: string;
    review_count: number;
    avg_review_score: number;
    neg_review_rate: number;
    neg_sentiment_rate: number;
    avg_order_value: number;
    avg_item_price: number;
    avg_freight: number;
    late_delivery_rate: number;
    top_complaint_topic: string;
    confidence: string;
  }>>('/agg/category');
}

export async function getBusinessPrioritization() {
  return fetchJson<Array<{
    category: string;
    review_count: number;
    neg_review_rate: number;
    neg_sentiment_rate: number;
    avg_order_value: number;
    total_value: number;
    segment: string;
  }>>('/business/prioritization');
}

export async function getComplaintMatrix() {
  return fetchJson<Array<Record<string, number>>>('/business/complaint-matrix');
}

export async function getMonthlyAgg() {
  return fetchJson<Array<{
    order_month: string;
    review_count: number;
    avg_review_score: number;
    neg_review_rate: number;
    neg_sentiment_rate: number;
    avg_order_value: number;
    late_delivery_rate: number;
  }>>('/agg/monthly');
}

export async function getSqlQueries() {
  return fetchJson<Array<{ filename: string; content: string }>>('/sql/queries');
}

export async function executeSqlQuery(query: string) {
  try {
    const res = await fetch(`${API_BASE}/sql/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error('SQL execution failed:', error);
    return { data: [], rowCount: 0, error: String(error) };
  }
}

export async function getReviewScoreDistribution() {
  return fetchJson<Array<{ score: number; count: number }>>('/reviews/score-distribution');
}