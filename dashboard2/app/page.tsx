"use client";
import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from "recharts";
import type { Overview } from "./types";

const fmt = (n: number) => n.toLocaleString("en-IN");
const R = (n: number) => `R$ ${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

const SCORE_COLORS = ["#FF6B6B", "#FF9F43", "#FFD93D", "#54A0FF", "#00D4AA"];
const SENT_COLORS  = { Positive: "#00D4AA", Negative: "#FF6B6B", Neutral: "#FFD93D" };

function Loading() {
  return <div className="loading"><div className="spinner" /><span>Loading data…</span></div>;
}

export default function OverviewPage() {
  const [data, setData] = useState<Overview | null>(null);

  useEffect(() => {
    fetch("/api/overview").then(r => r.json()).then(setData);
  }, []);

  if (!data) return <Loading />;

  const scoreData = Object.entries(data.review_score_distribution).map(([k, v]) => ({
    score: `Score ${k}`, count: v,
  }));

  const sentData = Object.entries(data.sentiment_distribution).map(([k, v]) => ({
    name: k, value: v,
  }));

  const corrData = data.correlations.map(c => ({
    pair: c.pair.length > 30 ? c.pair.slice(0, 28) + "…" : c.pair,
    fullPair: c.pair,
    rho: c.rho,
    fill: c.rho < 0 ? "#FF6B6B" : "#00D4AA",
  }));

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Customer Voice &amp; Business Impact</h1>
        <p className="page-subtitle">
          NLP-Driven Risk Assessment · Olist E-Commerce Dataset · BRL (R$) · Stages 1–4
        </p>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        {[
          { val: fmt(data.total_orders),         label: "Total Orders",        sub: "fact_orders" },
          { val: fmt(data.reviews_with_text),     label: "Reviews Analyzed",    sub: `${data.text_coverage_pct}% of ${fmt(data.total_reviews)} total` },
          { val: `${data.nlp_agreement_pct}%`,    label: "NLP Agreement",       sub: "Transformer vs Star Rating" },
          { val: `${data.complaint_topics_count}`,label: "Complaint Topics",    sub: "Data-driven discovery" },
          { val: `${data.ontime_vs_late.ontime_mean}`,  label: "On-Time Avg Score", sub: `vs Late: ${data.ontime_vs_late.late_mean}` },
        ].map(k => (
          <div className="kpi-card" key={k.label}>
            <div className="kpi-value">{k.val}</div>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-sub">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid-2 mb">
        <div className="card">
          <div className="card-title">Review Score Distribution</div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={scoreData} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
              <XAxis dataKey="score" tick={{ fill: "#8B90A7", fontSize: 12 }} />
              <YAxis tick={{ fill: "#8B90A7", fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: "#161B2C", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#F0F2FA" }}
                formatter={(v: number) => [fmt(v), "Reviews"]}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {scoreData.map((_, i) => <Cell key={i} fill={SCORE_COLORS[i]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="card-title">NLP Sentiment Distribution</div>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={sentData}
                cx="50%" cy="50%"
                innerRadius={65} outerRadius={100}
                paddingAngle={3}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
                labelLine={false}
              >
                {sentData.map((entry, i) => (
                  <Cell key={i} fill={SENT_COLORS[entry.name as keyof typeof SENT_COLORS] ?? "#8B90A7"} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: "#161B2C", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#F0F2FA" }}
                formatter={(v: number) => [fmt(v), "Reviews"]}
              />
              <Legend wrapperStyle={{ color: "#8B90A7", fontSize: 13 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Correlations */}
      <div className="card mb">
        <div className="card-title">Spearman Rank Correlations</div>
        <div className="alert alert-info">
          <span className="alert-icon">ℹ️</span>
          <span>All results are <strong>associations only</strong>. This project uses observational data and does not establish causation.</span>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={corrData} layout="vertical" margin={{ top: 4, right: 60, left: 8, bottom: 4 }}>
            <XAxis type="number" domain={[-1, 0.3]} tick={{ fill: "#8B90A7", fontSize: 11 }} />
            <YAxis type="category" dataKey="pair" width={240} tick={{ fill: "#C8CCD8", fontSize: 12 }} />
            <Tooltip
              contentStyle={{ background: "#161B2C", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#F0F2FA" }}
              formatter={(v: number) => [`ρ = ${v.toFixed(4)}`, "Spearman ρ"]}
              labelFormatter={(l: string) => l}
            />
            <Bar dataKey="rho" radius={[0, 4, 4, 0]}>
              {corrData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* On-time vs Late */}
      <div className="stat-row">
        {[
          { val: data.ontime_vs_late.ontime_mean, lbl: "On-Time Mean Score",  sub: `N = ${fmt(data.ontime_vs_late.ontime_n)}`, cls: "positive" },
          { val: data.ontime_vs_late.late_mean,   lbl: "Late Delivery Score",  sub: `N = ${fmt(data.ontime_vs_late.late_n)}`,   cls: "negative" },
          { val: "p < 0.0001",                    lbl: "Mann-Whitney U Test",  sub: "Highly significant",                        cls: "neutral"  },
        ].map(s => (
          <div className="stat-item" key={s.lbl}>
            <div className={`stat-val ${s.cls}`}>{s.val}</div>
            <div className="stat-lbl">{s.lbl}</div>
            <div className="stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>
    </>
  );
}
