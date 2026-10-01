"use client";
import { useEffect, useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  ScatterChart, Scatter, CartesianGrid, ZAxis, Legend,
} from "recharts";
import type { CategoryIntelligence, CategoryRow } from "../types";

const fmt  = (n: number)  => n.toLocaleString("en-IN");
const fmtP = (n: number)  => `${(n * 100).toFixed(1)}%`;
const R    = (n: number)  => `R$ ${n.toFixed(2)}`;

function Loading() {
  return <div className="loading"><div className="spinner" /><span>Loading…</span></div>;
}

function cellColor(v: number) {
  if (v <= 0)  return "rgba(255,255,255,0.02)";
  if (v < 10)  return "rgba(0,212,170,0.2)";
  if (v < 25)  return "rgba(255,217,61,0.4)";
  if (v < 40)  return "rgba(255,159,67,0.5)";
  return "rgba(255,107,107,0.65)";
}

export default function CategoryDeepDivePage() {
  const [data, setData]       = useState<CategoryIntelligence | null>(null);
  const [filter, setFilter]   = useState<"all" | "high" | "low_n">("all");
  const [sortBy, setSortBy]   = useState<keyof CategoryRow>("neg_sentiment_rate");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [search, setSearch]   = useState("");

  useEffect(() => {
    fetch("/api/category-deep-dive").then(r => r.json()).then(setData);
  }, []);

  const cats = useMemo(() => {
    if (!data) return [];
    let rows = [...data.categories];
    if (filter === "high")   rows = rows.filter(r => r.confidence === "HIGH");
    if (filter === "low_n")  rows = rows.filter(r => r.low_n);
    if (search.trim())       rows = rows.filter(r => r.category.toLowerCase().includes(search.toLowerCase()));
    rows.sort((a, b) => {
      const av = a[sortBy] as number, bv = b[sortBy] as number;
      return sortDir === "desc" ? bv - av : av - bv;
    });
    return rows;
  }, [data, filter, sortBy, sortDir, search]);

  if (!data) return <Loading />;

  const top15Neg  = [...data.categories].sort((a, b) => b.neg_sentiment_rate - a.neg_sentiment_rate).slice(0, 15);
  const top15Late = [...data.categories].sort((a, b) => b.late_delivery_rate - a.late_delivery_rate).slice(0, 15);

  // Scatter: price vs neg sentiment (bubble = review_count)
  const scatterData = data.categories
    .filter(c => !c.low_n && c.review_count >= 100)
    .map(c => ({
      x: c.avg_item_price,
      y: +(c.neg_sentiment_rate * 100).toFixed(2),
      z: Math.max(c.review_count, 100),
      name: c.category,
      fill: c.neg_sentiment_rate > 0.35 ? "#FF6B6B" : c.neg_sentiment_rate > 0.2 ? "#FFD93D" : "#00D4AA",
    }));

  const hm = data.heatmap;

  function toggleSort(col: keyof CategoryRow) {
    if (sortBy === col) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortBy(col); setSortDir("desc"); }
  }

  const SortTh = ({ col, label }: { col: keyof CategoryRow; label: string }) => (
    <th onClick={() => toggleSort(col)}
      style={{ cursor: "pointer", userSelect: "none", color: sortBy === col ? "#00D4AA" : undefined }}>
      {label}{sortBy === col ? (sortDir === "desc" ? " ↓" : " ↑") : " ↕"}
    </th>
  );

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">🏢 Category Deep Dive</h1>
        <p className="page-subtitle">
          {data.categories.length} product categories · Low-N threshold: &lt;{data.low_n_threshold} reviews · Click headers to sort
        </p>
      </div>

      {/* Dual top-15 charts */}
      <div className="grid-2 mb">
        <div className="card">
          <div className="card-title">Top 15 — Negative Sentiment Rate</div>
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={top15Neg} layout="vertical" margin={{ top: 4, right: 70, left: 8, bottom: 4 }}>
              <XAxis type="number" tickFormatter={v => `${(v*100).toFixed(0)}%`} tick={{ fill: "#8B90A7", fontSize: 11 }} />
              <YAxis type="category" dataKey="category" width={190} tick={{ fill: "#C8CCD8", fontSize: 10 }} />
              <Tooltip
                contentStyle={{ background: "#161B2C", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#F0F2FA" }}
                formatter={(v: number, _, p: { payload: CategoryRow }) =>
                  [`${(v*100).toFixed(1)}% (${fmt(p.payload.review_count)} reviews)`, "Neg Sentiment"]}
              />
              <Bar dataKey="neg_sentiment_rate" radius={[0, 4, 4, 0]}
                label={{ position: "right", fill: "#8B90A7", fontSize: 10, formatter: (v: number) => fmtP(v) }}>
                {top15Neg.map((e, i) => (
                  <Cell key={i} fill={e.neg_sentiment_rate > 0.35 ? "#FF6B6B" : e.neg_sentiment_rate > 0.25 ? "#FFD93D" : "#00D4AA"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="card-title">Top 15 — Late Delivery Rate</div>
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={top15Late} layout="vertical" margin={{ top: 4, right: 70, left: 8, bottom: 4 }}>
              <XAxis type="number" tickFormatter={v => `${(v*100).toFixed(0)}%`} tick={{ fill: "#8B90A7", fontSize: 11 }} />
              <YAxis type="category" dataKey="category" width={190} tick={{ fill: "#C8CCD8", fontSize: 10 }} />
              <Tooltip
                contentStyle={{ background: "#161B2C", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#F0F2FA" }}
                formatter={(v: number) => [`${(v*100).toFixed(1)}%`, "Late Rate"]}
              />
              <Bar dataKey="late_delivery_rate" radius={[0, 4, 4, 0]}
                label={{ position: "right", fill: "#8B90A7", fontSize: 10, formatter: (v: number) => fmtP(v) }}>
                {top15Late.map((e, i) => (
                  <Cell key={i} fill={e.late_delivery_rate > 0.3 ? "#FF6B6B" : e.late_delivery_rate > 0.15 ? "#FFD93D" : "#00D4AA"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Scatter: avg price vs neg sentiment */}
      <div className="card mb">
        <div className="card-title">Price vs Negative Sentiment — Category Bubble Chart (N≥100)</div>
        <p style={{ fontSize: "0.8rem", color: "#8B90A7", marginBottom: 12 }}>
          Bubble size = review count. Colour: 🔴 High risk (&gt;35%) · 🟡 Medium · 🟢 Low.
        </p>
        <ResponsiveContainer width="100%" height={340}>
          <ScatterChart margin={{ top: 8, right: 24, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="x" name="Avg Price (R$)" type="number"
              label={{ value: "Avg Item Price (R$)", position: "insideBottom", offset: -10, fill: "#8B90A7", fontSize: 12 }}
              tick={{ fill: "#8B90A7", fontSize: 11 }} />
            <YAxis dataKey="y" name="Neg Sentiment %" type="number"
              label={{ value: "Neg Sentiment %", angle: -90, position: "insideLeft", fill: "#8B90A7", fontSize: 12 }}
              tick={{ fill: "#8B90A7", fontSize: 11 }} tickFormatter={v => `${v}%`} />
            <ZAxis dataKey="z" range={[30, 300]} />
            <Tooltip
              contentStyle={{ background: "#161B2C", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#F0F2FA" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div style={{ background: "#161B2C", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "10px 14px", fontSize: 13 }}>
                    <strong style={{ color: d.fill }}>{d.name}</strong><br />
                    <span style={{ color: "#8B90A7" }}>Avg Price:</span> R$ {d.x.toFixed(2)}<br />
                    <span style={{ color: "#8B90A7" }}>Neg Sentiment:</span> {d.y}%<br />
                    <span style={{ color: "#8B90A7" }}>Reviews:</span> {fmt(d.z)}
                  </div>
                );
              }}
            />
            <Scatter data={scatterData} fill="#00D4AA">
              {scatterData.map((e, i) => <Cell key={i} fill={e.fill} />)}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Heatmap */}
      {hm.categories.length > 0 && (
        <div className="card mb">
          <div className="card-title">Category × Complaint Aspect Heatmap (% of reviews)</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ minWidth: hm.aspects.length * 120 + 220 }}>
              <thead>
                <tr>
                  <th style={{ width: 220 }}>Category</th>
                  {hm.aspects.map(a => <th key={a} style={{ minWidth: 120, textAlign: "center" }}>{a}</th>)}
                </tr>
              </thead>
              <tbody>
                {hm.categories.map((cat, ri) => (
                  <tr key={cat}>
                    <td style={{ fontWeight: 500, fontSize: "0.82rem" }}>{cat}</td>
                    {hm.values[ri].map((v, ci) => (
                      <td key={ci} style={{
                        background: cellColor(v), textAlign: "center",
                        color: v > 15 ? "#F0F2FA" : "#8B90A7",
                        fontSize: "0.8rem", fontWeight: v > 20 ? 600 : 400,
                      }}>
                        {v > 0 ? `${v}%` : "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Full category table */}
      <div className="card">
        <div className="card-title">Full Category Metrics Table</div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
          {(["all", "high", "low_n"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: "5px 14px", borderRadius: 20, cursor: "pointer", fontSize: "0.8rem", fontWeight: 600,
              border: `1px solid ${filter === f ? "#00D4AA" : "rgba(255,255,255,0.1)"}`,
              background: filter === f ? "rgba(0,212,170,0.12)" : "transparent",
              color: filter === f ? "#00D4AA" : "#8B90A7", transition: "all 0.15s",
            }}>
              {f === "all" ? "All Categories" : f === "high" ? "High Confidence (N≥50)" : "⚠ Low-N (<50)"}
            </button>
          ))}
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search category…"
            style={{
              padding: "5px 12px", borderRadius: 20, border: "1px solid rgba(255,255,255,0.12)",
              background: "#161B2C", color: "#F0F2FA", fontSize: "0.82rem", outline: "none", minWidth: 180,
            }}
          />
          <span style={{ color: "#4A4F66", fontSize: "0.78rem", marginLeft: "auto" }}>
            {cats.length} / {data.categories.length} shown
          </span>
        </div>

        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ minWidth: 180 }}>Category</th>
                <SortTh col="review_count"       label="Reviews" />
                <SortTh col="avg_review_score"   label="Avg Score" />
                <SortTh col="neg_sentiment_rate" label="Neg Sentiment" />
                <SortTh col="neg_review_rate"    label="Neg Review %" />
                <SortTh col="avg_item_price"     label="Avg Price (R$)" />
                <SortTh col="avg_freight"        label="Avg Freight (R$)" />
                <SortTh col="late_delivery_rate" label="Late %" />
                <th>Top Topic</th>
                <th>Flag</th>
              </tr>
            </thead>
            <tbody>
              {cats.map((row, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 500, fontSize: "0.85rem" }}>{row.category}</td>
                  <td style={{ textAlign: "right" }}>{fmt(row.review_count)}</td>
                  <td style={{ textAlign: "right",
                    color: row.avg_review_score >= 4 ? "#00D4AA" : row.avg_review_score >= 3 ? "#FFD93D" : "#FF6B6B" }}>
                    {row.avg_review_score.toFixed(2)}
                  </td>
                  <td style={{ textAlign: "right",
                    color: row.neg_sentiment_rate > 0.35 ? "#FF6B6B" : row.neg_sentiment_rate > 0.2 ? "#FFD93D" : "#00D4AA" }}>
                    {fmtP(row.neg_sentiment_rate)}
                  </td>
                  <td style={{ textAlign: "right", color: "#8B90A7" }}>{fmtP(row.neg_review_rate)}</td>
                  <td style={{ textAlign: "right" }}>{R(row.avg_item_price)}</td>
                  <td style={{ textAlign: "right" }}>{R(row.avg_freight)}</td>
                  <td style={{ textAlign: "right",
                    color: row.late_delivery_rate > 0.3 ? "#FF6B6B" : row.late_delivery_rate > 0.15 ? "#FFD93D" : "#00D4AA" }}>
                    {fmtP(row.late_delivery_rate)}
                  </td>
                  <td style={{ color: "#8B90A7", fontSize: "0.78rem" }}>{row.top_complaint_topic || "—"}</td>
                  <td>
                    {row.low_n && <span className="badge badge-low-n">LOW-N</span>}
                    {!row.low_n && row.confidence === "HIGH" && <span className="badge badge-low" style={{ fontSize: "0.65rem" }}>HIGH-N</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: "0.72rem", color: "#4A4F66", marginTop: 10 }}>
          ⚠️ LOW-N = fewer than {data.low_n_threshold} reviews — treat percentages with caution. Click column headers to sort.
        </p>
      </div>
    </>
  );
}
