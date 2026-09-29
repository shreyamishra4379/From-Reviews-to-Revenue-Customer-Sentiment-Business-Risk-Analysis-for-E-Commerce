"use client";

import { useEffect, useState } from "react";
import { SectionHeader, InsightBox } from "@/components/ui/InsightBox";
import { BarChart, HorizontalBarChart } from "@/components/charts/BarChart";
import { LineChart } from "@/components/charts/LineChart";
import { Heatmap } from "@/components/charts/Heatmap";
import { DataTable, formatters } from "@/components/ui/DataTable";
import { SegmentBadge } from "@/components/ui/SegmentBadge";
import { getCategoryAgg, getBusinessPrioritization, getComplaintMatrix, getMonthlyAgg, getStage4Metrics } from "@/lib/api";
import { formatCurrency, formatNumber } from "@/lib/utils";

interface CategoryAgg {
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

interface MonthlyAgg {
  order_month: string;
  review_count: number;
  avg_review_score: number;
  neg_review_rate: number;
  neg_sentiment_rate: number;
  avg_order_value: number;
  late_delivery_rate: number;
}

interface Stage4Metrics {
  delivery_analysis: {
    top_late_categories: Array<{ category: string; late_rate: number; n: number }>;
  };
}

export function CategoryIntelligenceContent() {
  const [catAgg, setCatAgg] = useState<CategoryAgg[]>([]);
  const [prioritization, setPrioritization] = useState<BusinessPrioritization[]>([]);
  const [complaintMatrix, setComplaintMatrix] = useState<Record<string, number>[]>([]);
  const [monthly, setMonthly] = useState<MonthlyAgg[]>([]);
  const [stage4, setStage4] = useState<Stage4Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [cat, prio, matrix, month, s4] = await Promise.all([
          getCategoryAgg(),
          getBusinessPrioritization(),
          getComplaintMatrix(),
          getMonthlyAgg(),
          getStage4Metrics(),
        ]);
        setCatAgg(cat || []);
        setPrioritization(prio || []);
        setComplaintMatrix(matrix || []);
        setMonthly(month || []);
        setStage4(s4);
      } catch (error) {
        console.error("Failed to load category data:", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) return null;

  // Filter high confidence categories
  const highConf = catAgg.filter(c => c.confidence === "HIGH");

  // Complaint matrix data for heatmap
  const matrixRows = [...new Set(complaintMatrix.map(r => String(r.category)))].filter(c => highConf.some(h => h.category === c));
  const matrixCols = ["Delivery/Logistics", "Product Quality", "Customer Service", "Wrong/Missing Item", "Packaging", "Price/Value", "Description Mismatch"];
  
  const heatmapData = matrixRows.flatMap(row => 
    matrixCols.map(col => ({
      row,
      col,
      value: complaintMatrix.find(r => String(r.category) === row)?.[col] || 0,
    }))
  );

  // Monthly trends
  const monthlySorted = [...monthly].sort((a, b) => a.order_month.localeCompare(b.order_month));

  // Top late categories
  const lateCategories = stage4?.delivery_analysis.top_late_categories || [];

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">🏢 Category Deep Dive</h1>

      {/* Category × Complaint Aspect Heatmap */}
      <SectionHeader>Category × Complaint Aspect Heatmap</SectionHeader>
      <InsightBox>
        Showing complaint rates (%) for high-confidence categories (N≥100 reviews). 
        Darker red = higher complaint rate for that aspect.
      </InsightBox>
      <div className="bg-[#1B1F2B] border border-white/5 rounded-xl p-6 mb-8">
        <Heatmap
          data={heatmapData}
          rows={matrixRows.slice(0, 20)}
          cols={matrixCols}
          height={550}
        />
      </div>

      {/* Monthly Trends */}
      <SectionHeader>Monthly Trends</SectionHeader>
      <div className="bg-[#1B1F2B] border border-white/5 rounded-xl p-6 mb-8">
        <LineChart
          data={monthlySorted}
          xKey="order_month"
          lines={[
            { key: "review_count", label: "Reviews", color: "rgba(0,212,170,0.3)", type: "area", yAxisId: "left" },
            { key: "neg_sentiment_rate", label: "Neg Sentiment %", color: "#FF6B6B", strokeWidth: 3, yAxisId: "right" },
          ]}
          height={400}
          yAxisLeftLabel="Review Count"
          yAxisRightLabel="Negative Sentiment %"
          formatYValue={(v) => v.toLocaleString()}
        />
      </div>

      {/* Late Delivery by Category */}
      <SectionHeader>Late Delivery Rate by Category (N≥100)</SectionHeader>
      <div className="bg-[#1B1F2B] border border-white/5 rounded-xl p-6 mb-8">
        <HorizontalBarChart
          data={lateCategories.slice(0, 15).map(c => ({
            category: c.category,
            late_rate: c.late_rate * 100,
            n: c.n,
          }))}
          labelKey="category"
          valueKey="late_rate"
          height={450}
          formatXValue={(v) => `${v.toFixed(1)}%`}
        />
      </div>

      {/* Business Prioritization */}
      <SectionHeader>Business Prioritization — 2×2 Framework</SectionHeader>
      <InsightBox>
        Segmentation by <strong>Negative Sentiment Rate</strong> and <strong>Total Order Value</strong> (split at medians).
        Categories flagged with LOW-N have insufficient sample size.
      </InsightBox>

      <div className="space-y-6 mb-8">
        {["HIGH Risk + HIGH Exposure", "HIGH Risk + LOW Exposure", "LOW Risk + HIGH Exposure", "LOW Risk + LOW Exposure"].map(seg => {
          const subset = prioritization
            .filter(p => p.segment === seg)
            .sort((a, b) => b.neg_sentiment_rate - a.neg_sentiment_rate);
          
          if (subset.length === 0) return null;

          return (
            <div key={seg} className="bg-[#1B1F2B] border border-white/5 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <SegmentBadge segment={seg} count={subset.length} />
              </div>
              <DataTable
                data={subset}
                columns={[
                  { key: "category", header: "Category", width: "200px" },
                  { key: "review_count", header: "Reviews", align: "right", format: formatters.number },
                  { key: "neg_sentiment_rate", header: "Neg Sentiment %", align: "right", format: (v) => `${(v * 100).toFixed(1)}%` },
                  { key: "total_value", header: "Total Value (R$)", align: "right", format: formatters.currency },
                ]}
                keyExtractor={(row) => row.category}
              />
            </div>
          );
        })}
      </div>

      {/* Full Category Metrics Table */}
      <SectionHeader>Full Category Metrics (High Confidence Only)</SectionHeader>
      <div className="bg-[#1B1F2B] border border-white/5 rounded-xl p-6">
        <DataTable
          data={highConf.sort((a, b) => b.neg_sentiment_rate - a.neg_sentiment_rate)}
          columns={[
            { key: "category", header: "Category", width: "180px" },
            { key: "review_count", header: "Reviews", align: "right", format: formatters.number },
            { key: "avg_review_score", header: "Avg Score", align: "right", format: formatters.score },
            { key: "neg_review_rate", header: "Neg Review %", align: "right", format: (v) => `${(v * 100).toFixed(1)}%` },
            { key: "neg_sentiment_rate", header: "Neg Sentiment %", align: "right", format: (v) => `${(v * 100).toFixed(1)}%` },
            { key: "avg_item_price", header: "Avg Price (R$)", align: "right", format: formatters.currency },
            { key: "avg_freight", header: "Avg Freight (R$)", align: "right", format: formatters.currency },
            { key: "late_delivery_rate", header: "Late %", align: "right", format: (v) => `${(v * 100).toFixed(1)}%` },
            { key: "top_complaint_topic", header: "Top Topic", width: "200px" },
            { key: "confidence", header: "Confidence", align: "center", render: (v) => (
              <span className={v === "HIGH" ? "text-[#00D4AA] font-medium" : "text-[#FF6B6B] font-medium"}>{v}</span>
            )},
          ]}
          keyExtractor={(row) => row.category}
        />
      </div>
    </div>
  );
}