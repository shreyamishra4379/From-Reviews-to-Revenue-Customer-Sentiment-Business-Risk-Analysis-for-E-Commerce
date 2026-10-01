"use client";
import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import type { DeliveryData } from "../types";

const fmt  = (n: number) => n.toLocaleString("en-IN");
const fmtP = (n: number) => `${n.toFixed(1)}%`;

function Loading() {
  return <div className="loading"><div className="spinner" /><span>Loading…</span></div>;
}

export default function DeliveryPage() {
  const [data, setData] = useState<DeliveryData | null>(null);

  useEffect(() => {
    fetch("/api/delivery").then(r => r.json()).then(setData);
  }, []);

  if (!data) return <Loading />;

  const stateData = data.state_late_rates.map(d => ({
    state: d.state,
    late: d.late_rate_pct,
    fill: d.late_rate_pct > 25 ? "#FF6B6B" : d.late_rate_pct > 15 ? "#FFD93D" : "#00D4AA",
  }));

  const catLateData = [...data.category_late_rates]
    .sort((a, b) => b.late_rate_pct - a.late_rate_pct)
    .slice(0, 20);

  const aspData = data.aspect_by_delivery;

  const monthlyData = data.monthly_trends.map(d => ({
    month: d.month,
    reviews: d.review_count,
    neg_pct: +(d.neg_sentiment_rate * 100).toFixed(2),
  }));

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">🚚 Delivery Analysis</h1>
        <p className="page-subtitle">Late delivery impact on customer sentiment and complaint patterns</p>
      </div>

      {/* Late by state */}
      <div className="card mb">
        <div className="card-title">Late Delivery Rate by State</div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={stateData} margin={{ top: 8, right: 24, left: -10, bottom: 0 }}>
            <XAxis dataKey="state" tick={{ fill: "#8B90A7", fontSize: 11 }} />
            <YAxis tickFormatter={v => `${v}%`} tick={{ fill: "#8B90A7", fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: "#161B2C", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#F0F2FA" }}
              formatter={(v: number) => [fmtP(v), "Late Rate"]}
            />
            <Bar dataKey="late" radius={[4, 4, 0, 0]}>
              {stateData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Late by category */}
      <div className="card mb">
        <div className="card-title">Late Delivery Rate by Category (Top 20)</div>
        <ResponsiveContainer width="100%" height={Math.max(300, catLateData.length * 32)}>
          <BarChart data={catLateData} layout="vertical" margin={{ top: 4, right: 70, left: 8, bottom: 4 }}>
            <XAxis type="number" tickFormatter={v => `${v}%`} tick={{ fill: "#8B90A7", fontSize: 11 }} />
            <YAxis type="category" dataKey="category" width={220} tick={{ fill: "#C8CCD8", fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: "#161B2C", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#F0F2FA" }}
              formatter={(v: number) => [fmtP(v), "Late Rate"]}
            />
            <Bar dataKey="late_rate_pct" radius={[0, 4, 4, 0]}
              label={{ position: "right", fill: "#8B90A7", fontSize: 11, formatter: (v: number) => fmtP(v) }}>
              {catLateData.map((entry, i) => {
                const c = entry.late_rate_pct > 30 ? "#FF6B6B" : entry.late_rate_pct > 20 ? "#FFD93D" : "#00D4AA";
                return <Cell key={i} fill={c} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Aspect by delivery status */}
      {aspData.length > 0 && (
        <div className="card mb">
          <div className="card-title">Complaint Aspects: Late vs On-Time Deliveries</div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={aspData} margin={{ top: 8, right: 24, left: 8, bottom: 40 }}>
              <XAxis dataKey="aspect" tick={{ fill: "#8B90A7", fontSize: 11 }} angle={-20} textAnchor="end" />
              <YAxis tick={{ fill: "#8B90A7", fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: "#161B2C", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#F0F2FA" }}
              />
              <Bar dataKey="on_time" name="On-Time" fill="#00D4AA" radius={[4, 4, 0, 0]} />
              <Bar dataKey="late"    name="Late"    fill="#FF6B6B" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Monthly trends */}
      <div className="card">
        <div className="card-title">Monthly Review Volume &amp; Negative Sentiment Rate</div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={monthlyData} margin={{ top: 8, right: 24, left: -10, bottom: 0 }}>
            <XAxis dataKey="month" tick={{ fill: "#8B90A7", fontSize: 10 }} angle={-30} textAnchor="end" height={50} />
            <YAxis yAxisId="left" tick={{ fill: "#8B90A7", fontSize: 11 }} />
            <YAxis yAxisId="right" orientation="right" tickFormatter={v => `${v}%`} tick={{ fill: "#FFD93D", fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: "#161B2C", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#F0F2FA" }}
            />
            <Bar yAxisId="left" dataKey="reviews" name="Reviews" fill="rgba(0,212,170,0.3)" radius={[2, 2, 0, 0]} />
            <Bar yAxisId="right" dataKey="neg_pct" name="Neg Sentiment %" fill="#FFD93D" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <p style={{ fontSize: "0.75rem", color: "#4A4F66", marginTop: 8, textAlign: "center" }}>
          Note: Right axis (yellow) = Negative Sentiment % · Left axis (teal) = Review Count
        </p>
      </div>
    </>
  );
}
