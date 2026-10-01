"use client";
import { useEffect, useState, useRef } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

interface QueryMeta {
  file: string;
  name: string;
  sql: string;
}

interface ExecResult {
  columns: string[];
  rows: (string | number | null)[][];
  row_count: number;
  truncated: boolean;
  error?: string;
}

const CHART_COLORS = [
  "#00D4AA", "#7B61FF", "#FF6B6B", "#FFD93D", "#FF9F43",
  "#54A0FF", "#5F27CD", "#10AC84", "#EE5A24", "#B53471",
];

function Loading({ msg = "Loading…" }: { msg?: string }) {
  return <div className="loading"><div className="spinner" /><span>{msg}</span></div>;
}

function NumBadge({ n }: { n: number }) {
  return (
    <span style={{
      background: "rgba(0,212,170,0.12)", border: "1px solid rgba(0,212,170,0.25)",
      borderRadius: 20, padding: "2px 10px", fontSize: "0.78rem", color: "#00D4AA",
      fontWeight: 600, marginLeft: 8,
    }}>{n.toLocaleString()} rows</span>
  );
}

export default function SQLAnalyticsPage() {
  const [queries, setQueries]           = useState<QueryMeta[]>([]);
  const [selected, setSelected]         = useState<QueryMeta | null>(null);
  const [customSql, setCustomSql]       = useState("");
  const [useCustom, setUseCustom]       = useState(false);
  const [result, setResult]             = useState<ExecResult | null>(null);
  const [running, setRunning]           = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [loadingQueries, setLoadingQ]   = useState(true);
  const textareaRef                     = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch("/api/sql")
      .then(r => r.json())
      .then(d => {
        setQueries(d.queries ?? []);
        if (d.queries?.length) setSelected(d.queries[0]);
      })
      .finally(() => setLoadingQ(false));
  }, []);

  const activeSql = useCustom ? customSql : (selected?.sql ?? "");

  async function runQuery() {
    const sql = activeSql.trim();
    if (!sql) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const resp = await fetch("/api/sql/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql }),
      });
      const data: ExecResult = await resp.json();
      if (data.error) { setError(data.error); }
      else             { setResult(data); }
    } catch (e) {
      setError(String(e));
    } finally {
      setRunning(false);
    }
  }

  // Build chart data from result (first string col as X, first number col as Y)
  const chartData = (() => {
    if (!result || result.columns.length < 2) return null;
    const catIdx = result.columns.findIndex((_, ci) =>
      result.rows.some(r => isNaN(Number(r[ci])))
    );
    const numIdx = result.columns.findIndex((_, ci) =>
      ci !== catIdx && result.rows.every(r => !isNaN(Number(r[ci])))
    );
    if (catIdx === -1 || numIdx === -1) return null;
    return result.rows.slice(0, 30).map((row, i) => ({
      label: String(row[catIdx] ?? "").slice(0, 30),
      value: Number(row[numIdx]) || 0,
      fill: CHART_COLORS[i % CHART_COLORS.length],
    }));
  })();

  const isHorizontal = (chartData?.length ?? 0) > 8;

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">🗄️ SQL Analytics</h1>
        <p className="page-subtitle">
          11 validated queries · Executed live via DuckDB against Parquet data warehouse · No metric logic in JS
        </p>
      </div>

      <div className="alert alert-info">
        <span className="alert-icon">ℹ️</span>
        <span>
          Queries are executed server-side by Python + DuckDB against <code>data/processed/*.parquet</code>.
          All results are read-only. Max 500 rows returned.
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 20 }}>
        {/* Left: Query list */}
        <div>
          <div className="card" style={{ padding: "12px 8px" }}>
            <div style={{
              padding: "4px 14px 12px",
              fontSize: "0.72rem", fontWeight: 700, color: "#4A4F66",
              textTransform: "uppercase", letterSpacing: 1,
            }}>
              Predefined Queries
            </div>

            {loadingQueries
              ? <Loading msg="Loading queries…" />
              : queries.map(q => (
                <button key={q.file}
                  onClick={() => { setSelected(q); setUseCustom(false); setResult(null); setError(null); }}
                  style={{
                    width: "100%", textAlign: "left", padding: "9px 14px",
                    borderRadius: 8, border: "none", cursor: "pointer", fontSize: "0.84rem",
                    fontWeight: selected?.file === q.file && !useCustom ? 600 : 400,
                    background: selected?.file === q.file && !useCustom
                      ? "linear-gradient(135deg, rgba(0,212,170,0.15), rgba(123,97,255,0.15))"
                      : "transparent",
                    color: selected?.file === q.file && !useCustom ? "#00D4AA" : "#C8CCD8",
                    borderLeft: selected?.file === q.file && !useCustom
                      ? "2px solid #00D4AA" : "2px solid transparent",
                    marginBottom: 2, display: "block", transition: "all 0.12s",
                  }}
                >
                  <span style={{ color: "#4A4F66", fontWeight: 500, marginRight: 6, fontSize: "0.78rem" }}>
                    {q.file.split("_")[0]}
                  </span>
                  {q.name}
                </button>
              ))
            }

            <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", margin: "8px 0" }} />

            <button
              onClick={() => { setUseCustom(true); setResult(null); setError(null); setTimeout(() => textareaRef.current?.focus(), 50); }}
              style={{
                width: "100%", textAlign: "left", padding: "9px 14px",
                borderRadius: 8, border: "none", cursor: "pointer", fontSize: "0.84rem",
                background: useCustom ? "linear-gradient(135deg, rgba(123,97,255,0.15), rgba(0,212,170,0.15))" : "transparent",
                color: useCustom ? "#7B61FF" : "#8B90A7",
                borderLeft: useCustom ? "2px solid #7B61FF" : "2px solid transparent",
                transition: "all 0.12s",
              }}
            >
              ✏️ Custom Query
            </button>
          </div>

          {/* Available tables */}
          <div className="card" style={{ marginTop: 12, padding: "12px 14px" }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#4A4F66", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
              Available Tables
            </div>
            {["fact_orders", "fact_order_items", "fact_order_reviews", "nlp_reviews",
              "dim_products", "dim_customers", "dim_sellers", "dim_payments"].map(t => (
              <div key={t} style={{
                padding: "4px 0", fontSize: "0.8rem", color: "#8B90A7",
                display: "flex", alignItems: "center", gap: 6,
              }}>
                <span style={{ color: "#00D4AA", fontSize: "0.7rem" }}>▸</span>
                <code style={{ color: "#C8CCD8" }}>{t}</code>
              </div>
            ))}
          </div>
        </div>

        {/* Right: SQL editor + results */}
        <div>
          {/* SQL editor */}
          <div className="card mb">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div className="card-title" style={{ margin: 0 }}>
                {useCustom ? "✏️ Custom SQL" : `📄 ${selected?.name ?? "Select a query"}`}
              </div>
              <button
                onClick={runQuery}
                disabled={running || !activeSql.trim()}
                style={{
                  padding: "8px 22px", borderRadius: 8, border: "none",
                  background: running || !activeSql.trim()
                    ? "rgba(255,255,255,0.06)"
                    : "linear-gradient(135deg, #00D4AA, #7B61FF)",
                  color: running || !activeSql.trim() ? "#4A4F66" : "#0A0D14",
                  fontWeight: 700, fontSize: "0.9rem", cursor: running ? "wait" : "pointer",
                  transition: "all 0.15s", display: "flex", alignItems: "center", gap: 8,
                }}
              >
                {running ? <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Running…</> : "▶  Run Query"}
              </button>
            </div>

            {useCustom ? (
              <textarea
                ref={textareaRef}
                value={customSql}
                onChange={e => setCustomSql(e.target.value)}
                placeholder="SELECT * FROM fact_orders LIMIT 10;"
                rows={8}
                style={{
                  width: "100%", background: "#0A0D14", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 8, padding: 14, color: "#F0F2FA",
                  fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
                  fontSize: "0.85rem", lineHeight: 1.6, resize: "vertical", outline: "none",
                }}
                onKeyDown={e => { if (e.ctrlKey && e.key === "Enter") runQuery(); }}
              />
            ) : (
              <pre style={{
                background: "#0A0D14", borderRadius: 8, padding: 14, margin: 0,
                color: "#C8CCD8", fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
                fontSize: "0.85rem", lineHeight: 1.6, overflowX: "auto",
                whiteSpace: "pre-wrap", border: "1px solid rgba(255,255,255,0.07)",
              }}>
                {activeSql || "Select a query from the left panel"}
              </pre>
            )}
            {useCustom && (
              <p style={{ fontSize: "0.72rem", color: "#4A4F66", marginTop: 6 }}>
                Ctrl+Enter to run · SELECT / WITH queries only · Max 500 rows returned
              </p>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="card mb error-box" style={{ padding: 16 }}>
              <strong style={{ color: "#FF6B6B" }}>❌ Query Error</strong>
              <pre style={{ marginTop: 8, fontSize: "0.82rem", whiteSpace: "pre-wrap", color: "#FFCDD2", lineHeight: 1.5 }}>
                {error}
              </pre>
            </div>
          )}

          {/* Running spinner */}
          {running && <Loading msg="Executing query via DuckDB…" />}

          {/* Results */}
          {result && !running && (
            <>
              {/* Success badge */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <span style={{ color: "#00D4AA", fontWeight: 700, fontSize: "0.9rem" }}>
                  ✅ Query executed successfully
                </span>
                <NumBadge n={result.row_count} />
                {result.truncated && (
                  <span className="badge badge-low-n">Showing first 500</span>
                )}
              </div>

              {/* Auto chart */}
              {chartData && chartData.length > 1 && (
                <div className="card mb">
                  <div className="card-title">Query Result Chart (first 30 rows)</div>
                  <ResponsiveContainer width="100%" height={isHorizontal ? Math.max(280, chartData.length * 28) : 280}>
                    {isHorizontal ? (
                      <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 70, left: 8, bottom: 4 }}>
                        <XAxis type="number" tick={{ fill: "#8B90A7", fontSize: 11 }} />
                        <YAxis type="category" dataKey="label" width={200} tick={{ fill: "#C8CCD8", fontSize: 11 }} />
                        <Tooltip
                          contentStyle={{ background: "#161B2C", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#F0F2FA" }}
                          formatter={(v: number) => [typeof v === "number" && Number.isInteger(v) ? v.toLocaleString() : v.toFixed(3), result.columns[1]]}
                        />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]}
                          label={{ position: "right", fill: "#8B90A7", fontSize: 10 }}>
                          {chartData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                        </Bar>
                      </BarChart>
                    ) : (
                      <BarChart data={chartData} margin={{ top: 4, right: 16, left: 8, bottom: 40 }}>
                        <XAxis dataKey="label" tick={{ fill: "#8B90A7", fontSize: 11 }} angle={-20} textAnchor="end" height={60} />
                        <YAxis tick={{ fill: "#8B90A7", fontSize: 11 }} />
                        <Tooltip
                          contentStyle={{ background: "#161B2C", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#F0F2FA" }}
                        />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                          {chartData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                        </Bar>
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </div>
              )}

              {/* Data table */}
              <div className="card">
                <div className="card-title">Results Table</div>
                <div className="tbl-wrap">
                  <table>
                    <thead>
                      <tr>
                        {result.columns.map(c => <th key={c}>{c}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {result.rows.map((row, ri) => (
                        <tr key={ri}>
                          {row.map((cell, ci) => {
                            const num = typeof cell === "number" || (typeof cell === "string" && !isNaN(Number(cell)) && cell !== "");
                            const val = num ? Number(cell) : String(cell ?? "—");
                            return (
                              <td key={ci} style={{
                                textAlign: num ? "right" : "left",
                                color: typeof val === "number" && val < 0 ? "#FF6B6B"
                                     : typeof val === "string" && val === "—" ? "#4A4F66"
                                     : undefined,
                                fontVariantNumeric: "tabular-nums",
                              }}>
                                {typeof val === "number"
                                  ? Number.isInteger(val) ? val.toLocaleString() : val.toFixed(4)
                                  : val}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p style={{ fontSize: "0.72rem", color: "#4A4F66", marginTop: 10 }}>
                  {result.columns.length} columns · {result.row_count.toLocaleString()} rows
                  {result.truncated ? " (truncated to 500)" : ""}
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
