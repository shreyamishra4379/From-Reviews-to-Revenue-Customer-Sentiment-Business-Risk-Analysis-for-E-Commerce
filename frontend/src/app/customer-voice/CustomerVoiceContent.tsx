"use client";

import { useEffect, useState } from "react";
import { SectionHeader, InsightBox } from "@/components/ui/InsightBox";
import { BarChart, HorizontalBarChart } from "@/components/charts/BarChart";
import { PieChart } from "@/components/charts/PieChart";
import { DataTable, formatters } from "@/components/ui/DataTable";
import { getNlpMetrics, getNlpTopics } from "@/lib/api";
import { COLORS } from "@/lib/utils";

interface NlpMetrics {
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
}

interface NlpTopics {
  embedding_topics: Array<{
    topic_id: number;
    review_count: number;
    representative_terms: string[];
    business_topic_name: string;
    sample_reviews: string[];
  }>;
}

export function CustomerVoiceContent() {
  const [metrics, setMetrics] = useState<NlpMetrics | null>(null);
  const [topics, setTopics] = useState<NlpTopics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [m, t] = await Promise.all([getNlpMetrics(), getNlpTopics()]);
        setMetrics(m);
        setTopics(t);
      } catch (error) {
        console.error("Failed to load customer voice data:", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading || !metrics || !topics) return null;

  // Sentiment Agreement by Score
  const agreementData = Object.entries(metrics.transformer_sentiment.per_score_agreement_pct)
    .map(([score, rate]) => ({
      score: `Score ${score}`,
      rate,
      color: rate < 50 ? COLORS.negative : rate < 70 ? COLORS.neutral : COLORS.positive,
    }));

  // Aspect breakdown
  const aspectData = Object.entries(metrics.aspect_summary)
    .filter(([k]) => k !== "Uncategorized")
    .map(([aspect, info]) => ({
      aspect,
      total: info.total_mentions,
      negative: info.negative,
      neutral: info.neutral,
      positive: info.positive,
      negPct: (info.negative / info.total_mentions) * 100,
    }))
    .sort((a, b) => a.negPct - b.negPct);

  // Topic table data
  const topicData = topics.embedding_topics.map(t => ({
    topic: `T${t.topic_id}`,
    reviews: t.review_count,
    terms: t.representative_terms.slice(0, 6).join(", "),
    name: t.business_topic_name,
  }));

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">🧠 NLP Insights</h1>

      {/* Agreement by Score */}
      <SectionHeader>Sentiment Agreement by Star Rating</SectionHeader>
      <div className="bg-[#1B1F2B] border border-white/5 rounded-xl p-6 mb-8">
        <BarChart
          data={agreementData}
          xKey="score"
          yKey="rate"
          colors={agreementData.map(d => d.color)}
          height={350}
          formatYValue={(v) => `${v.toFixed(1)}%`}
        />
      </div>

      <InsightBox>
        Score 3 (37.8% agreement) is inherently ambiguous — neither clearly positive nor negative.
        Score 5 reviews agree 82.6% of the time, indicating the model handles clear sentiment well.
      </InsightBox>

      {/* Aspect Breakdown */}
      <SectionHeader>Complaint Aspect Breakdown</SectionHeader>
      <div className="bg-[#1B1F2B] border border-white/5 rounded-xl p-6 mb-8">
        <HorizontalBarChart
          data={aspectData}
          labelKey="aspect"
          valueKey="negPct"
          height={450}
          formatXValue={(v) => `${v.toFixed(1)}%`}
        />
      </div>

      {/* Aspect Table */}
      <SectionHeader>Aspect Detail Table</SectionHeader>
      <div className="bg-[#1B1F2B] border border-white/5 rounded-xl p-6 mb-8">
        <DataTable
          data={aspectData}
          columns={[
            { key: "aspect", header: "Aspect", width: "200px" },
            { key: "total", header: "Total Mentions", align: "right", format: formatters.number },
            { key: "negative", header: "Negative", align: "right", format: formatters.number },
            { key: "neutral", header: "Neutral", align: "right", format: formatters.number },
            { key: "positive", header: "Positive", align: "right", format: formatters.number },
            { key: "negPct", header: "Negative %", align: "right", format: (v) => `${v.toFixed(1)}%` },
          ]}
          keyExtractor={(row) => row.aspect}
        />
      </div>

      {/* Topics */}
      <SectionHeader>Discovered Topics (Embedding-Based)</SectionHeader>
      <div className="bg-[#1B1F2B] border border-white/5 rounded-xl p-6">
        <DataTable
          data={topicData}
          columns={[
            { key: "topic", header: "Topic", width: "80px" },
            { key: "name", header: "Business Name", width: "250px" },
            { key: "reviews", header: "Reviews", align: "right", format: formatters.number },
            { key: "terms", header: "Top Terms" },
          ]}
          keyExtractor={(row) => row.topic}
        />
      </div>
    </div>
  );
}