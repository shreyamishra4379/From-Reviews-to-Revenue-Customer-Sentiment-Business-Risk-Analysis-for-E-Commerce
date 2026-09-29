"use client";

import { useEffect, useState } from "react";
import { SectionHeader, InsightBox } from "@/components/ui/InsightBox";
import { BarChart, HorizontalBarChart } from "@/components/charts/BarChart";
import { DataTable, formatters } from "@/components/ui/DataTable";
import { getStage4Metrics } from "@/lib/api";

interface DeliveryMetrics {
  top_late_states: Array<{ state: string; late_rate: number; n: number }>;
  top_late_categories: Array<{ category: string; late_rate: number; n: number }>;
  aspect_by_delivery: Array<{
    extracted_aspects: string;
    on_time: number;
    late: number;
    total: number;
    late_share: number;
  }>;
}

interface Stage4Metrics {
  delivery_analysis: DeliveryMetrics;
  statistical_analysis: {
    ontime_vs_late: {
      ontime_mean: number;
      late_mean: number;
      ontime_n: number;
      late_n: number;
    };
  };
}

export function DeliveryContent() {
  const [data, setData] = useState<Stage4Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const s4 = await getStage4Metrics();
        setData(s4);
      } catch (error) {
        console.error("Failed to load delivery data:", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading || !data) return null;

  const { delivery_analysis, statistical_analysis } = data;
  const { top_late_states, top_late_categories, aspect_by_delivery } = delivery_analysis;
  const { ontime_vs_late } = statistical_analysis;

  // Filter to main aspects
  const mainAspects = [
    'Delivery/Logistics', 'Product Quality', 'Customer Service',
    'Wrong/Missing Item', 'Packaging', 'Price/Value', 'Description Mismatch', 'Uncategorized'
  ];
  const aspectData = aspect_by_delivery
    .filter(a => mainAspects.includes(a.extracted_aspects))
    .sort((a, b) => b.late - a.late);

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">🚚 Delivery Analysis</h1>

      {/* On-time vs Late Summary */}
      <SectionHeader>On-Time vs Late Delivery Impact on Review Scores</SectionHeader>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-[#1B1F2B] border border-white/5 rounded-xl p-5 text-center">
          <div className="text-3xl font-bold text-[#00D4AA]">{ontime_vs_late.ontime_mean.toFixed(2)}</div>
          <div className="text-sm text-[#8B8FA3] mt-1">On-Time Mean Score</div>
          <div className="text-xs text-[#5A5F73] mt-1">N = {ontime_vs_late.ontime_n.toLocaleString()}</div>
        </div>
        <div className="bg-[#1B1F2B] border border-white/5 rounded-xl p-5 text-center">
          <div className="text-3xl font-bold text-[#FF6B6B]">{ontime_vs_late.late_mean.toFixed(2)}</div>
          <div className="text-sm text-[#8B8FA3] mt-1">Late Mean Score</div>
          <div className="text-xs text-[#5A5F73] mt-1">N = {ontime_vs_late.late_n.toLocaleString()}</div>
        </div>
        <div className="bg-[#1B1F2B] border border-white/5 rounded-xl p-5 text-center">
          <div className="text-3xl font-bold text-[#7B61FF]">{"p < 0.0001"}</div>
          <div className="text-sm text-[#8B8FA3] mt-1">Mann-Whitney U Test</div>
          <div className="text-xs text-[#5A5F73] mt-1">Highly significant difference</div>
        </div>
      </div>

      {/* Late Delivery Rate by State */}
      <SectionHeader>Late Delivery Rate by State (N≥100)</SectionHeader>
      <div className="bg-[#1B1F2B] border border-white/5 rounded-xl p-6 mb-8">
        <HorizontalBarChart
          data={top_late_states.slice(0, 15).map(s => ({
            state: s.state,
            late_rate: s.late_rate * 100,
            n: s.n,
          }))}
          labelKey="state"
          valueKey="late_rate"
          height={450}
          formatXValue={(v) => `${v.toFixed(1)}%`}
        />
      </div>

      {/* Late Delivery Rate by Category */}
      <SectionHeader>Late Delivery Rate by Category (N≥100)</SectionHeader>
      <div className="bg-[#1B1F2B] border border-white/5 rounded-xl p-6 mb-8">
        <HorizontalBarChart
          data={top_late_categories.slice(0, 15).map(c => ({
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

      {/* Complaint Aspects: Late vs On-Time */}
      <SectionHeader>Complaint Aspects: Late vs On-Time (Negative Reviews Only)</SectionHeader>
      <InsightBox>
        Shows which complaint aspects are more prevalent in late vs on-time deliveries.
        Higher late counts indicate aspects that are exacerbated by delivery delays.
      </InsightBox>
      <div className="bg-[#1B1F2B] border border-white/5 rounded-xl p-6 mb-8">
        <BarChart
          data={aspectData.map(a => ({
            aspect: a.extracted_aspects,
            on_time: a.on_time,
            late: a.late,
            late_share: a.late_share,
          }))}
          xKey="aspect"
          yKey="late"
          height={400}
          formatYValue={(v) => v.toLocaleString()}
        />
      </div>

      {/* Aspect Detail Table */}
      <SectionHeader>Aspect Breakdown by Delivery Status</SectionHeader>
      <div className="bg-[#1B1F2B] border border-white/5 rounded-xl p-6">
        <DataTable
          data={aspectData}
          columns={[
            { key: "extracted_aspects", header: "Aspect", width: "200px" },
            { key: "on_time", header: "On-Time", align: "right", format: formatters.number },
            { key: "late", header: "Late", align: "right", format: formatters.number },
            { key: "total", header: "Total", align: "right", format: formatters.number },
            { key: "late_share", header: "Late Share %", align: "right", format: (v) => `${v.toFixed(1)}%` },
          ]}
          keyExtractor={(row) => row.extracted_aspects}
        />
      </div>
    </div>
  );
}