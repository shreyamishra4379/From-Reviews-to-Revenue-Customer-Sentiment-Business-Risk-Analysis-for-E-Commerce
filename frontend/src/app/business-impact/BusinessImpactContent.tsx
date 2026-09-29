"use client";

import { useEffect, useState } from "react";
import { SectionHeader, InsightBox } from "@/components/ui/InsightBox";
import { BarChart } from "@/components/charts/BarChart";
import { ScatterPlot } from "@/components/charts/ScatterPlot";
import { DataTable, formatters } from "@/components/ui/DataTable";
import { SegmentBadge, SegmentLegend } from "@/components/ui/SegmentBadge";
import { getStage4Metrics, getBusinessPrioritization } from "@/lib/api";
import { formatCurrency, formatNumber, SEGMENT_COLORS } from "@/lib/utils";

interface ExposureMetrics {
  affected_order_value_BRL: number;
  affected_orders: number;
  sensitivity_table: Array<{ impact_pct: number; exposure_BRL: number }>;
}

interface Stage4Metrics {
  commercial_exposure: ExposureMetrics;
}

interface BusinessPrioritization {
  category: string;
  review_count: number;
  neg_review_rate: number;
  neg_sentiment_rate: number;
  avg_order_value: number;
  total_value: number;
  segment: string;
}

export function BusinessImpactContent() {
  const [exposure, setExposure] = useState<ExposureMetrics | null>(null);
  const [prioritization, setPrioritization] = useState<BusinessPrioritization[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [s4, prio] = await Promise.all([
          getStage4Metrics(),
          getBusinessPrioritization(),
        ]);
        setExposure(s4?.commercial_exposure || null);
        setPrioritization(prio || []);
      } catch (error) {
        console.error("Failed to load business impact data:", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading || !exposure) return null;

  const highHigh = prioritization.filter(p => p.segment === "HIGH Risk + HIGH Exposure");
  const highLow = prioritization.filter(p => p.segment === "HIGH Risk + LOW Exposure");
  const lowHigh = prioritization.filter(p => p.segment === "LOW Risk + HIGH Exposure");
  const lowLow = prioritization.filter(p => p.segment === "LOW Risk + LOW Exposure");

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">💰 Business Impact</h1>

      {/* Disclaimer */}
      <InsightBox variant="warning">
        ⚠️ <strong>All figures below are scenario-based estimates, NOT observed historical revenue loss.</strong><br />
        Formula: commercial_exposure = affected_order_value × configurable_impact_assumption<br />
        All monetary values in Brazilian Reais (R$ BRL).
      </InsightBox>

      {/* Exposure Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-[#1B1F2B] border border-white/5 rounded-xl p-6">
          <div className="text-4xl font-extrabold bg-gradient-to-r from-[#00D4AA] to-[#7B61FF] bg-clip-text text-transparent">
            {formatCurrency(exposure.affected_order_value_BRL)}
          </div>
          <div className="text-sm text-[#8B8FA3] mt-2">Total At-Risk Order Value</div>
          <div className="text-xs text-[#5A5F73] mt-1">Tied to negative NLP sentiment</div>
        </div>
        <div className="bg-[#1B1F2B] border border-white/5 rounded-xl p-6">
          <div className="text-4xl font-extrabold bg-gradient-to-r from-[#00D4AA] to-[#7B61FF] bg-clip-text text-transparent">
            {formatNumber(exposure.affected_orders)}
          </div>
          <div className="text-sm text-[#8B8FA3] mt-2">Affected Orders</div>
          <div className="text-xs text-[#5A5F73] mt-1">Orders with negative sentiment</div>
        </div>
      </div>

      {/* Sensitivity Table */}
      <SectionHeader>Sensitivity Table — Scenario-Based Exposure</SectionHeader>
      <div className="bg-[#1B1F2B] border border-white/5 rounded-xl p-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <BarChart
              data={exposure.sensitivity_table.map(s => ({
                impact: `${s.impact_pct.toFixed(0)}%`,
                exposure: s.exposure_BRL,
              }))}
              xKey="impact"
              yKey="exposure"
              colors={exposure.sensitivity_table.map(s => 
                s.impact_pct <= 2 ? "#00D4AA" : s.impact_pct <= 10 ? "#FFD93D" : "#FF6B6B"
              )}
              height={350}
              formatYValue={(v) => formatCurrency(v)}
            />
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-4">Exposure Scenarios</h3>
            <div className="space-y-3">
              {exposure.sensitivity_table.map((row, i) => (
                <div key={i} className="flex items-center justify-between py-3 px-4 bg-white/5 rounded-lg">
                  <span className="text-[#8B8FA3]">{row.impact_pct.toFixed(0)}% Impact Assumption</span>
                  <span className="font-semibold text-white">{formatCurrency(row.exposure_BRL)}</span>
                </div>
              ))}
            </div>
            <InsightBox variant="warning" className="mt-4">
              <strong>Note:</strong> These are scenario-based estimates, not observed historical revenue loss.
              The impact assumption represents the percentage of at-risk order value that could potentially
              be lost due to negative customer experience (churn, reduced repeat purchases, reputational damage).
            </InsightBox>
          </div>
        </div>
      </div>

      {/* Business Prioritization Framework */}
      <SectionHeader>Business Prioritization — 2×2 Framework</SectionHeader>
      <InsightBox>
        Segmentation by <strong>Negative Sentiment Rate</strong> (median: 24.0%) and 
        <strong>Total Order Value</strong> (median: R$ 84,759). Categories with insufficient reviews are excluded.
      </InsightBox>

      {/* Scatter Plot */}
      <div className="bg-[#1B1F2B] border border-white/5 rounded-xl p-6 mb-8">
        <ScatterPlot
          data={prioritization.map(p => ({
            x: p.total_value,
            y: p.neg_sentiment_rate,
            size: p.review_count,
            color: p.segment,
            label: p.category,
            ...p,
          }))}
          xKey="x"
          yKey="y"
          sizeKey="size"
          colorKey="color"
          labelKey="label"
          colorScale={SEGMENT_COLORS}
          height={500}
          xAxisLabel="Total Order Value (R$)"
          yAxisLabel="Negative Sentiment Rate"
          xDomain={[0, Math.max(...prioritization.map(p => p.total_value)) * 1.1]}
          yDomain={[0, Math.max(...prioritization.map(p => p.neg_sentiment_rate)) * 1.1]}
        />
        <SegmentLegend className="mt-4" />
      </div>

      {/* Prioritization Tables by Segment */}
      <div className="space-y-6">
        {[
          { segment: "HIGH Risk + HIGH Exposure", label: "Immediate Action", data: highHigh },
          { segment: "HIGH Risk + LOW Exposure", label: "Monitor Closely", data: highLow },
          { segment: "LOW Risk + HIGH Exposure", label: "Protect & Maintain", data: lowHigh },
          { segment: "LOW Risk + LOW Exposure", label: "Low Priority", data: lowLow },
        ].map(({ segment, label, data }) => {
          if (data.length === 0) return null;
          
          const sorted = [...data].sort((a, b) => b.neg_sentiment_rate - a.neg_sentiment_rate);
          
          return (
            <div key={segment} className="bg-[#1B1F2B] border border-white/5 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <SegmentBadge segment={segment} count={sorted.length} />
                <span className="text-sm text-[#8B8FA3]">{label}</span>
              </div>
              <DataTable
                data={sorted}
                columns={[
                  { key: "category", header: "Category", width: "200px" },
                  { key: "review_count", header: "Reviews", align: "right", format: formatters.number },
                  { key: "neg_sentiment_rate", header: "Neg Sentiment %", align: "right", format: (v) => `${(v * 100).toFixed(1)}%` },
                  { key: "neg_review_rate", header: "Neg Review %", align: "right", format: (v) => `${(v * 100).toFixed(1)}%` },
                  { key: "total_value", header: "Total Value (R$)", align: "right", format: formatters.currency },
                ]}
                keyExtractor={(row) => row.category}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}