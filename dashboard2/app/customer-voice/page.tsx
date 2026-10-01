"use client";
import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import type { CustomerVoice } from "../types";

const fmt = (n: number) => n.toLocaleString("en-IN");

function Loading() {
  return <div className="loading"><div className="spinner" /><span>Loading…</span></div>;
}

export default function CustomerVoicePage() {
  const [data, setData] = useState<CustomerVoice | null>(null);

  useEffect(() => {
    fetch("/api/customer-voice").then(r => r.json()).then(setData);
  }, []);

  if (!data) return <Loading />;

  const agreementData = data.per_score_agreement.map(d => ({
    score: `Score ${d.score}`,
    pct: d.agreement_pct,
    fill: d.agreement_pct < 50 ? "#FF6B6B" : d.agreement_pct < 70 ? "#FFD93D" : "#00D4AA",
  }));

  const aspectData = [...data.aspects].sort((a, b) => a.neg_pct - b.neg_pct);

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">🧠 Customer Voice</h1>
        <p className="page-subtitle">
          XLM-RoBERTa sentiment analysis on {fmt(data.aspects.reduce((s, a) => s + a.total_mentions, 0))} reviews · Portuguese · No translation
        </p>
      </div>

      {/* Sentiment agreement by score */}
      <div className="card mb">
        <div className="card-title">Sentiment Agreement by Star Rating</div>
        <div className="alert alert-info">
          <span className="alert-icon">ℹ️</span>
          <span>Score 3 reviews are inherently ambiguous. Score 5 reviews agree at the highest rate, indicating the model handles clear sentiment well.</span>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={agreementData} margin={{ top: 8, right: 24, left: -10, bottom: 0 }}>
            <XAxis dataKey="score" tick={{ fill: "#8B90A7", fontSize: 12 }} />
            <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fill: "#8B90A7", fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: "#161B2C", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#F0F2FA" }}
              formatter={(v: number) => [`${v.toFixed(1)}%`, "Agreement"]}
            />
            <Bar dataKey="pct" radius={[4, 4, 0, 0]} label={{ position: "top", fill: "#8B90A7", fontSize: 11, formatter: (v: number) => `${v.toFixed(1)}%` }}>
              {agreementData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Complaint Aspects */}
      <div className="card mb">
        <div className="card-title">Complaint Aspect Breakdown — Negative Rate</div>
        <ResponsiveContainer width="100%" height={Math.max(280, aspectData.length * 44)}>
          <BarChart data={aspectData} layout="vertical" margin={{ top: 4, right: 90, left: 8, bottom: 4 }}>
            <XAxis type="number" domain={[0, 80]} tickFormatter={v => `${v}%`} tick={{ fill: "#8B90A7", fontSize: 11 }} />
            <YAxis type="category" dataKey="aspect" width={180} tick={{ fill: "#C8CCD8", fontSize: 12 }} />
            <Tooltip
              contentStyle={{ background: "#161B2C", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#F0F2FA" }}
              formatter={(v: number, name: string, props: { payload: { total_mentions: number } }) => [
                `${v.toFixed(1)}% (${fmt(props.payload.total_mentions)} mentions)`,
                "Negative Rate",
              ]}
            />
            <Bar dataKey="neg_pct" radius={[0, 4, 4, 0]}
              label={{ position: "right", fill: "#8B90A7", fontSize: 11, formatter: (v: number) => `${v.toFixed(1)}%` }}>
              {aspectData.map((entry, i) => {
                const c = entry.neg_pct > 60 ? "#FF6B6B" : entry.neg_pct > 40 ? "#FFD93D" : "#00D4AA";
                return <Cell key={i} fill={c} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Topics */}
      <div className="card">
        <div className="card-title">Discovered Topics — Embedding-Based (KMeans + Sentence Transformers)</div>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Topic</th>
                <th style={{ textAlign: "right" }}>Reviews</th>
                <th>Representative Terms</th>
              </tr>
            </thead>
            <tbody>
              {data.topics.map(t => (
                <tr key={t.topic_id}>
                  <td><strong>T{t.topic_id}</strong></td>
                  <td style={{ textAlign: "right", color: "#00D4AA" }}>{fmt(t.review_count)}</td>
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
