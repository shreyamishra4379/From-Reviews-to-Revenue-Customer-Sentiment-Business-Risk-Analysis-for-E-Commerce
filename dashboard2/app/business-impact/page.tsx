"use client";
import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ScatterChart,
  Scatter, ZAxis, CartesianGrid, Legend,
} from "recharts";
import type { BusinessImpact } from "../types";

const R   = (n: number) => `R$ ${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const fmt = (n: number) => n.toLocaleString("en-IN");
const fmtP = (n: number) => `${(n * 100).toFixed(1)}%`;

const SEG_COLORS: Record<string, string> = {
  "HIGH Risk + HIGH Exposure": "#FF6B6B",
  "HIGH Risk + LOW Exposure":  "#FF9F43",
  "LOW Risk + HIGH Exposure":  "#54A0FF",
  "LOW Risk + LOW Exposure":   "#00D4AA",
};

function Loading() {
  return <div className="loading"><div className="spinner" /><span>Loading…</span></div>;
}

export default function BusinessImpactPage() {
  const [data, setData] = useState<BusinessImpact | null>(null);
  const [segFilter, setSegFilter] = useState<string>("all");

  useEffect(() => {
    fetch("/api/business-impact").then(r => r.json()).then(setData);
  }, []);

  if (!data) return <Loading />;

  const sensData = data.sensitivity_table.map(s => ({
    label: `${s.impact_pct}%`,
    exposure: s.exposure_BRL,
  }));

  const segments = Array.from(new Set(data.prioritization.map(p => p.segment)));

  const scatterData = data.prioritization
    .filter(p => segFilter === "all" || p.segment === segFilter)
    .map(p => ({
      x: p.total_value,
      y: +(p.neg_sentiment_rate * 100).toFixed(2),
      z: Math.max(p.review_count, 50),
      name: p.category,
      segment: p.segment,
      fill: SEG_COLORS[p.segment] ?? "#8B90A7",
      low_n: p.low_n,
    }));

  const prioFiltered = data.prioritization
    .filter(p => segFilter === "all" || p.segment === segFilter)
    .sort((a, b) => b.neg_sentiment_rate - a.neg_sentiment_rate);

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">💰 Business Impact</h1>
        <p className="page-subtitle">Scenario-based commercial exposure framework — Olist E-Commerce</p>
      </div>

      {/* Mandatory disclaimer */}
      <div className="alert alert-warning mb">
        <span className="alert-icon">⚠️</span>
        <span>
          <strong>Scenario-based estimate, not observed revenue loss.</strong><br />
          Formula: <code>commercial_exposure = affected_order_value × impact_assumption_pct</code>.<br />
          All figures are in BRL (R$). These are modelling scenarios, not confirmed financial losses.
        </span>
      </div>

      {/* At-risk KPIs */}
      <div className="kpi-grid" style={{ marginBottom: 24 }}>
        <div className="kpi-card">
          <div className="kpi-value">{R(data.affected_order_value_BRL)}</div>
          <div className="kpi-label">At-Risk Order Value</div>
          <div className="kpi-sub">Tied to negative NLP sentiment</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value">{fmt(data.affected_orders)}</div>
          <div className="kpi-label">Affected Orders</div>
          <div className="kpi-sub">Orders with negative sentiment</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value">{data.ontime_vs_late.ontime_mean}</div>
          <div className="kpi-label">On-Time Mean Score</div>
          <div className="kpi-sub">vs Late: {data.ontime_vs_late.late_mean}</div>
        </div>
      </div>

      {/* Sensitivity */}
      <div className="card mb">
        <div className="card-title">Sensitivity Table — Scenario-Based Exposure (R$)</div>
        <div className="disclaimer-strip">⚠️ Scenario-based estimate, not observed revenue loss &nbsp;|&nbsp; Currency: BRL (R$)</div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={sensData} margin={{ top: 8, right: 24, left: 20, bottom: 0 }}>
            <XAxis dataKey="label" tick={{ fill: "#8B90A7", fontSize: 12 }} label={{ value: "Impact Assumption", position: "insideBottom", offset: -4, fill: "#8B90A7", fontSize: 12 }} />
            <YAxis tickFormatter={v => `R$ ${(v / 1000).toFixed(0)}K`} tick={{ fill: "#8B90A7", fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: "#161B2C", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#F0F2FA" }}
              formatter={(v: number) => [R(v), "Scenario Exposure"]}
            />
            <Bar dataKey="exposure" radius={[4, 4, 0, 0]}
              label={{ position: "top", fill: "#8B90A7", fontSize: 10, formatter: (v: number) => `R$ ${(v/1000).toFixed(0)}K` }}>
              {sensData.map((_, i) => {
                const colors = ["#00D4AA", "#54A0FF", "#7B61FF", "#FFD93D", "#FF9F43", "#FF6B6B", "#FF4444"];
                return <Cell key={i} fill={colors[Math.min(i, colors.length - 1)]} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 2×2 scatter */}
      <div className="card mb">
        <div className="card-title">Business Prioritization — 2×2 Framework (Exposure × Risk)</div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
          {["all", ...segments].map(s => (
            <button
              key={s}
              onClick={() => setSegFilter(s)}
              style={{
                padding: "5px 14px",
                borderRadius: 20,
                border: `1px solid ${s === segFilter ? (SEG_COLORS[s] ?? "#00D4AA") : "rgba(255,255,255,0.1)"}`,
                background: s === segFilter ? `${(SEG_COLORS[s] ?? "#00D4AA")}22` : "transparent",
                color: s === segFilter ? (SEG_COLORS[s] ?? "#00D4AA") : "#8B90A7",
                cursor: "pointer",
                fontSize: "0.8rem",
                fontWeight: 600,
                transition: "all 0.15s",
              }}
            >
              {s === "all" ? "All Segments" : s}
            </button>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={380}>
          <ScatterChart margin={{ top: 8, right: 24, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="x" type="number" name="Total Revenue" tickFormatter={v => `R$ ${(v/1000).toFixed(0)}K`}
              tick={{ fill: "#8B90A7", fontSize: 11 }}
              label={{ value: "Total Order Value (R$)", position: "insideBottom", offset: -10, fill: "#8B90A7", fontSize: 12 }} />
            <YAxis dataKey="y" type="number" name="Neg Sentiment %" tickFormatter={v => `${v}%`}
              tick={{ fill: "#8B90A7", fontSize: 11 }}
              label={{ value: "Negative Sentiment %", angle: -90, position: "insideLeft", fill: "#8B90A7", fontSize: 12 }} />
            <ZAxis dataKey="z" range={[40, 400]} />
            <Tooltip
              contentStyle={{ background: "#161B2C", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#F0F2FA" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div style={{ background: "#161B2C", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "10px 14px", fontSize: 13 }}>
                    <strong style={{ color: SEG_COLORS[d.segment] ?? "#fff" }}>{d.name}</strong>
                    {d.low_n && <span className="badge badge-low-n" style={{ marginLeft: 8 }}>LOW-N</span>}
                    <br />
                    <span style={{ color: "#8B90A7" }}>Segment:</span> {d.segment}<br />
                    <span style={{ color: "#8B90A7" }}>Revenue:</span> {R(d.x)}<br />
                    <span style={{ color: "#8B90A7" }}>Neg Sentiment:</span> {d.y}%
                  </div>
                );
              }}
            />
            <Scatter data={scatterData} fill="#00D4AA">
              {scatterData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 8 }}>
          {Object.entries(SEG_COLORS).map(([seg, col]) => (
            <span key={seg} style={{ fontSize: "0.78rem", color: col }}>● {seg}</span>
          ))}
        </div>
      </div>

      {/* Prioritization table */}
      <div className="card mb">
        <div className="card-title">Category Prioritization Detail</div>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th>Segment</th>
                <th style={{ textAlign: "right" }}>Reviews</th>
                <th style={{ textAlign: "right" }}>Neg Sentiment</th>
                <th style={{ textAlign: "right" }}>Total Value (R$)</th>
                <th>Flag</th>
              </tr>
            </thead>
            <tbody>
              {prioFiltered.map((row, i) => (
                <tr key={i}>
                  <td>{row.category}</td>
                  <td style={{ color: SEG_COLORS[row.segment] ?? "#fff", fontWeight: 600, fontSize: "0.82rem" }}>
                    {row.segment}
                  </td>
                  <td style={{ textAlign: "right" }}>{fmt(row.review_count)}</td>
                  <td style={{ textAlign: "right", color: row.neg_sentiment_rate > 0.35 ? "#FF6B6B" : row.neg_sentiment_rate > 0.2 ? "#FFD93D" : "#00D4AA" }}>
                    {fmtP(row.neg_sentiment_rate)}
                  </td>
                  <td style={{ textAlign: "right" }}>{R(row.total_value)}</td>
                  <td>{row.low_n && <span className="badge badge-low-n">LOW-N</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: "0.72rem", color: "#4A4F66", marginTop: 10 }}>
          ⚠️ LOW-N flag = fewer than {data.low_n_threshold} reviews — interpret with caution. &nbsp;|&nbsp;
          Scenario-based estimate, not observed revenue loss. Currency: BRL (R$).
        </p>
      </div>

      {/* Statistical context */}
      <div className="card">
        <div className="card-title">Logistic Regression Context</div>
        <div className="alert alert-warning">
          <span className="alert-icon">⚠️</span>
          <span>{data.logistic_regression.disclaimer}</span>
        </div>
        <div className="stat-row">
          <div className="stat-item">
            <div className="stat-val neutral">{data.logistic_regression.pseudo_r2}</div>
            <div className="stat-lbl">Pseudo R²</div>
            <div className="stat-sub">Low — delay explains only part of variance</div>
          </div>
          <div className="stat-item">
            <div className="stat-val">{fmt(data.logistic_regression.n_obs)}</div>
            <div className="stat-lbl">Observations</div>
          </div>
        </div>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>Predictor</th><th style={{ textAlign: "right" }}>Coefficient</th><th style={{ textAlign: "right" }}>p-value</th></tr></thead>
            <tbody>
              {data.logistic_regression.coefficients.map(c => (
                <tr key={c.predictor}>
                  <td>{c.predictor}</td>
                  <td style={{ textAlign: "right", color: c.coef > 0 ? "#FF6B6B" : "#00D4AA" }}>{c.coef.toFixed(5)}</td>
                  <td style={{ textAlign: "right", color: "#8B90A7" }}>{c.p_value.toFixed(6)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
