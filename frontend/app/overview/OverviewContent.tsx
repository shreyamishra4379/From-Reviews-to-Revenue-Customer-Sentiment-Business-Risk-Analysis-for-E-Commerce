"use client";

import { useEffect, useState } from "react";
import { MetricCard } from "@/components/ui/MetricCard";
import { SectionHeader, InsightBox } from "@/components/ui/InsightBox";
import { BarChart } from "@/components/charts/BarChart";
import { PieChart } from "@/components/charts/PieChart";
import { formatCurrency, formatNumber, COLORS } from "@/lib/utils";
import { getNlpMetrics, getStage4Metrics, getReviewScoreDistribution } from "@/lib/api";

interface OverviewMetrics {
  total_reviews: number;
  reviews_with_text: number;
  text_coverage_pct: number;
  transformer_sentiment: {
    agreement_rate_pct: number;
    distribution: Record<string, number>;
    per_score_agreement_pct: Record<string, number>;
  };
}

interface Stage4Metrics {
  commercial_exposure: {
    affected_order_value_BRL: number;
    affected_orders: number;
    sensitivity_table: Array<{ impact_pct: number; exposure_BRL: number }>;
  };
  statistical_analysis: {
    correlations: Record<string, { rho: number; p_value: number }>;
    ontime_vs_late: {
      ontime_mean: number;
      late_mean: number;
      ontime_n: number;
      late_n: number;
    };
  };
}

export function OverviewContent() {
  const [nlpMetrics, setNlpMetrics] = useState<OverviewMetrics | null>(null);
  const [stage4Metrics, setStage4Metrics] = useState<Stage4Metrics | null>(null);
  const [scoreDist, setScoreDist] = useState<Array<{ score: number; count: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [nlp, s4, scores] = await Promise.all([
          getNlpMetrics(),
          getStage4Metrics(),
          getReviewScoreDistribution(),
        ]);
        setNlpMetrics(nlp);
        setStage4Metrics(s4);
        setScoreDist(scores || []);
      } catch (error) {
        console.error("Failed to load overview data:", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading || !nlpMetrics || !stage4Metrics) {
    return null; // Suspense will handle loading
  }

  const exp = stage4Metrics.commercial_exposure;
  const corrs = stage4Metrics.statistical_analysis.correlations;
  const lat = stage4Metrics.statistical_analysis.ontime_vs_late;

  return (
    <div>
      {/* Header */}
      <div className="text-center mb-10">
        <h1 className="text-3xl md:text-4xl font-extrabold bg-gradient-to-r from-[#00D4AA] to-[#7B61FF] bg-clip-text text-transparent">
          Customer Voice & Business Impact Analytics
        </h1>
        <p className="text-[#8B8FA3] mt-2 text-base md:text-lg">
          NLP-Driven Risk Assessment Framework for E-Commerce · Olist Dataset · BRL (R$)
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <MetricCard
          value="99,441"
          label="Total Orders"
          formatter="number"
        />
        <MetricCard
          value={nlpMetrics.reviews_with_text}
          label="Reviews Analyzed"
          sublabel={`${nlpMetrics.text_coverage_pct}% of all reviews`}
          formatter="number"
        />
        <MetricCard
          value={`${nlpMetrics.transformer_sentiment.agreement_rate_pct}%`}
          label="NLP Agreement"
          sublabel="Transformer vs Star Rating"
        />
        <MetricCard
          value="8"
          label="Complaint Topics"
          sublabel="Data-driven discovery"
        />
        <MetricCard
          value={exp.affected_order_value_BRL}
          label="At-Risk Order Value"
          sublabel="Tied to negative sentiment"
          formatter="currency"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Review Score Distribution */}
        <div className="bg-[#1B1F2B] border border-white/5 rounded-xl p-6">
          <SectionHeader>Review Score Distribution</SectionHeader>
          <BarChart
            data={scoreDist}
            xKey="score"
            yKey="count"
            colors={["#FF6B6B", "#FF9F43", "#FFD93D", "#54A0FF", "#00D4AA"]}
            height={350}
            formatYValue={(v) => v.toLocaleString()}
          />
        </div>

        {/* Sentiment Distribution */}
        <div className="bg-[#1B1F2B] border border-white/5 rounded-xl p-6">
          <SectionHeader>Sentiment Distribution (NLP)</SectionHeader>
          <PieChart
            data={Object.entries(nlpMetrics.transformer_sentiment.distribution).map(([name, value]) => ({
              name,
              value,
              color: name === "Positive" ? COLORS.positive : name === "Negative" ? COLORS.negative : COLORS.neutral,
            }))}
            height={350}
            innerRadius={60}
          />
        </div>
      </div>

      {/* Statistical Highlights */}
      <SectionHeader>Key Statistical Findings</SectionHeader>
      <InsightBox variant="warning">
        <strong>All results are associations only.</strong> This project uses observational data and does not establish causation.
      </InsightBox>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-[#1B1F2B] border border-white/5 rounded-xl p-5 text-center">
          <div className="text-2xl font-bold text-[#00D4AA]">
            ρ = {corrs["Delivery Delay vs Review Score"]?.rho?.toFixed(4) || "—"}
          </div>
          <div className="text-sm text-[#8B8FA3] mt-1">Delivery Delay vs Review Score</div>
          <div className="text-xs text-[#5A5F73] mt-1">{"p < 0.0001"}</div>
        </div>
        <div className="bg-[#1B1F2B] border border-white/5 rounded-xl p-5 text-center">
          <div className="text-2xl font-bold text-[#FF6B6B]">
            {lat.ontime_mean.toFixed(2)} vs {lat.late_mean.toFixed(2)}
          </div>
          <div className="text-sm text-[#8B8FA3] mt-1">On-Time vs Late Avg Score</div>
          <div className="text-xs text-[#5A5F73] mt-1">{"Mann-Whitney U, p < 0.0001"}</div>
        </div>
        <div className="bg-[#1B1F2B] border border-white/5 rounded-xl p-5 text-center">
          <div className="text-2xl font-bold text-[#7B61FF]">
            ρ = {corrs["Complaint Rate vs Avg Rating"]?.rho?.toFixed(4) || "—"}
          </div>
          <div className="text-sm text-[#8B8FA3] mt-1">Complaint Rate vs Avg Rating</div>
          <div className="text-xs text-[#5A5F73] mt-1">Category-level, near-perfect inverse</div>
        </div>
      </div>

      {/* Commercial Exposure Summary */}
      <SectionHeader>Commercial Exposure Summary</SectionHeader>
      <div className="bg-[#1B1F2B] border border-white/5 rounded-xl p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-semibold mb-4">Scenario-Based Exposure Model</h3>
            <InsightBox variant="warning">
              ⚠️ <strong>All figures below are scenario-based estimates, NOT observed historical revenue loss.</strong><br />
              Formula: commercial_exposure = affected_order_value × configurable_impact_assumption
            </InsightBox>
            <div className="space-y-2">
              {exp.sensitivity_table.map((row, i) => (
                <div key={i} className="flex justify-between py-2 border-b border-white/5 last:border-0">
                  <span className="text-[#8B8FA3]">{row.impact_pct.toFixed(0)}% Impact Assumption</span>
                  <span className="font-semibold text-white">{formatCurrency(row.exposure_BRL)}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="bg-[#1B1F2B] border border-white/5 rounded-lg p-5">
              <div className="text-3xl font-bold bg-gradient-to-r from-[#00D4AA] to-[#7B61FF] bg-clip-text text-transparent">
                {formatCurrency(exp.affected_order_value_BRL)}
              </div>
              <div className="text-sm text-[#8B8FA3] mt-1">Total At-Risk Order Value</div>
              <div className="text-xs text-[#5A5F73] mt-1">Tied to negative NLP sentiment</div>
            </div>
            <div className="mt-4 bg-[#1B1F2B] border border-white/5 rounded-lg p-5">
              <div className="text-3xl font-bold bg-gradient-to-r from-[#00D4AA] to-[#7B61FF] bg-clip-text text-transparent">
                {formatNumber(exp.affected_orders)}
              </div>
              <div className="text-sm text-[#8B8FA3] mt-1">Affected Orders</div>
              <div className="text-xs text-[#5A5F73] mt-1">Orders with negative sentiment</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}