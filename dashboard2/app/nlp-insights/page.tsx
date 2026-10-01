"use client";
import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend, RadarChart, Radar, PolarGrid, PolarAngleAxis,
} from "recharts";

interface NLPData {
  total_reviews: number;
  reviews_with_text: number;
  text_coverage_pct: number;
  sentiment_distribution: Record<string, number>;
  agreement_rate_pct: number;
  per_score_agreement: { score: number; agreement_pct: number }[];
  review_score_distribution: Record<string, number>;
  aspects: {
    aspect: string; total_mentions: number;
    negative: number; neutral: number; positive: number;
    neg_pct: number; pos_pct: number;
  }[];
  topics: { topic_id: number; label: string; review_count: number; top_terms: string[] }[];
}

const fmt  = (n: number) => n.toLocaleString("en-IN");
const SENT_COLORS = { Positive: "#00D4AA", Negative: "#FF6B6B", Neutral: "#FFD93D" };
const SCORE_COLORS = ["#FF6B6B", "#FF9F43", "#FFD93D", "#54A0FF", "#00D4AA"];

function Loading() {
  return <div className="loading"><div className="spinner" /><span>Loading…</span></div>;
}

export default function NLPInsightsPage() {
  const [data, setData] = useState<NLPData | null>(null);

  useEffect(() => {
    fetch("/api/nlp-insights").then(r => r.json()).then(setData);
  }, []);

  if (!data) return <Loading />;

  const scoreData = Object.entries(data.review_score_distribution).map(([k, v]) => ({
    score: `Score ${k}`, count: v,
  }));

  const sentData = Object.entries(data.sentiment_distribution).map(([k, v]) => ({
    name: k, value: v,
  }));

  const agreeData = data.per_score_agreement.map(d => ({
    score: `Score ${d.score}`,
    pct: d.agreement_pct,
    fill: d.agreement_pct < 50 ? "#FF6B6B" : d.agreement_pct < 70 ? "#FFD93D" : "#00D4AA",
  }));

  const aspectData = [...data.aspects].sort((a, b) => a.neg_pct - b.neg_pct);

  // Stacked bar data for aspect sentiment breakdown
  const aspStackData = data.aspects.slice(0, 12).map(a => ({
    aspect: a.aspect.length > 22 ? a.aspect.slice(0, 20) + "…" : a.aspect,
    fullAspect: a.aspect,
    Negative: a.negative,
    Neutral: a.neutral,
    Positive: a.positive,
  }));

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">🧠 NLP Insights</h1>
        <p className="page-subtitle">
          XLM-RoBERTa sentiment analysis · {fmt(data.reviews_with_text)} reviews ({data.text_coverage_pct}% coverage) · Portuguese · No translation
        </p>
      </div>

      {/* Coverage KPIs */}
      <div className="kpi-grid" style={{ marginBottom: 24 }}>
        {[
          { val: fmt(data.total_reviews),      label: "Total Reviews",       sub: "fact_order_reviews" },
          { val: fmt(data.reviews_with_text),  label: "Reviews with Text",   sub: `${data.text_coverage_pct}% of total` },
          { val: `${data.agreement_rate_pct}%`,label: "NLP Agreement Rate",  sub: "Transformer vs Star Rating" },
          { val: `${data.aspects.length}`,     label: "Complaint Aspects",   sub: "Data-driven extraction" },
          { val: `${data.topics.length}`,      label: "Embedding Topics",    sub: "KMeans + Sentence Transformers" },
        ].map(k => (
          <div className="kpi-card" key={k.label}>
            <div className="kpi-value">{k.val}</div>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-sub">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Score distribution + Sentiment donut */}
      <div className="grid-2 mb">
        <div className="card">
          <div className="card-title">Review Score Distribution</div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={scoreData} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
              <XAxis dataKey="score" tick={{ fill: "#8B90A7", fontSize: 12 }} />
              <YAxis tick={{ fill: "#8B90A7", fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
              <Tooltip
                contentStyle={{ background: "#161B2C", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#F0F2FA" }}
                formatter={(v: number) => [fmt(v), "Reviews"]}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}
                label={{ position: "top", fill: "#8B90A7", fontSize: 10, formatter: (v: number) => fmt(v) }}>
                {scoreData.map((_, i) => <Cell key={i} fill={SCORE_COLORS[i]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="card-title">Transformer Sentiment Distribution</div>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={sentData} cx="50%" cy="50%"
                innerRadius={60} outerRadius={95} paddingAngle={3}
                dataKey="value"
                label={({ name, value, percent }) =>
                  `${name} ${fmt(value)} (${(percent * 100).toFixed(1)}%)`}
                labelLine={false}>
                {sentData.map((e, i) => (
                  <Cell key={i} fill={SENT_COLORS[e.name as keyof typeof SENT_COLORS] ?? "#8B90A7"} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: "#161B2C", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#F0F2FA" }}
                formatter={(v: number) => [fmt(v), "Reviews"]}
              />
              <Legend wrapperStyle={{ color: "#8B90A7", fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Agreement by score */}
      <div className="card mb">
        <div className="card-title">Sentiment Agreement by Star Rating</div>
        <div className="alert alert-info">
          <span className="alert-icon">ℹ️</span>
          <span>
            Score 3 reviews are inherently ambiguous — the model finds it hardest to agree here.
            Score 5 (clearly positive) and Score 1 (clearly negative) show the highest agreement rates.
          </span>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={agreeData} margin={{ top: 8, right: 24, left: -10, bottom: 0 }}>
            <XAxis dataKey="score" tick={{ fill: "#8B90A7", fontSize: 12 }} />
            <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fill: "#8B90A7", fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: "#161B2C", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#F0F2FA" }}
              formatter={(v: number) => [`${v.toFixed(1)}%`, "Agreement"]}
            />
            <Bar dataKey="pct" radius={[4, 4, 0, 0]}
              label={{ position: "top", fill: "#8B90A7", fontSize: 11, formatter: (v: number) => `${v.toFixed(1)}%` }}>
              {agreeData.map((e, i) => <Cell key={i} fill={e.fill} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Aspect negative rate */}
      <div className="card mb">
        <div className="card-title">Complaint Aspect Breakdown — Negative Rate %</div>
        <ResponsiveContainer width="100%" height={Math.max(280, aspectData.length * 42)}>
          <BarChart data={aspectData} layout="vertical" margin={{ top: 4, right: 90, left: 8, bottom: 4 }}>
            <XAxis type="number" domain={[0, 80]} tickFormatter={v => `${v}%`} tick={{ fill: "#8B90A7", fontSize: 11 }} />
            <YAxis type="category" dataKey="aspect" width={180} tick={{ fill: "#C8CCD8", fontSize: 12 }} />
            <Tooltip
              contentStyle={{ background: "#161B2C", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#F0F2FA" }}
              formatter={(v: number, _, props: { payload: { total_mentions: number } }) => [
                `${v.toFixed(1)}% (${fmt(props.payload.total_mentions)} mentions)`, "Negative Rate"
              ]}
            />
            <Bar dataKey="neg_pct" radius={[0, 4, 4, 0]}
              label={{ position: "right", fill: "#8B90A7", fontSize: 11, formatter: (v: number) => `${v.toFixed(1)}%` }}>
              {aspectData.map((e, i) => (
                <Cell key={i} fill={e.neg_pct > 60 ? "#FF6B6B" : e.neg_pct > 40 ? "#FFD93D" : "#00D4AA"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Stacked aspect breakdown */}
      <div className="card mb">
        <div className="card-title">Aspect Sentiment Mix (Negative / Neutral / Positive)</div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={aspStackData} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
            <XAxis type="number" tick={{ fill: "#8B90A7", fontSize: 11 }} />
            <YAxis type="category" dataKey="aspect" width={180} tick={{ fill: "#C8CCD8", fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: "#161B2C", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#F0F2FA" }}
              formatter={(v: number) => [fmt(v), ""]}
            />
            <Legend wrapperStyle={{ color: "#8B90A7", fontSize: 12 }} />
            <Bar dataKey="Negative" stackId="a" fill="#FF6B6B" />
            <Bar dataKey="Neutral"  stackId="a" fill="#FFD93D" />
            <Bar dataKey="Positive" stackId="a" fill="#00D4AA" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Topics table */}
      <div className="card">
        <div className="card-title">Discovered Topics — Embedding-Based (KMeans + Sentence Transformers)</div>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Topic</th>
                <th style={{ textAlign: "right" }}>Reviews</th>
                <th style={{ textAlign: "right" }}>% of Text Reviews</th>
                <th>Top Representative Terms</th>
              </tr>
            </thead>
            <tbody>
              {data.topics.map(t => (
                <tr key={t.topic_id}>
                  <td><strong style={{ color: "#00D4AA" }}>T{t.topic_id}</strong></td>
                  <td style={{ textAlign: "right" }}>{fmt(t.review_count)}</td>
                  <td style={{ textAlign: "right", color: "#8B90A7" }}>
                    {((t.review_count / data.reviews_with_text) * 100).toFixed(1)}%
                  </td>
                  <td style={{ color: "#8B90A7", fontSize: "0.82rem" }}>
                    {t.top_terms.join(" · ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
