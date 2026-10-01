"use client";
import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  ReferenceLine, CartesianGrid,
} from "recharts";

interface StatData {
  disclaimer: string;
  correlations: { pair: string; rho: number; p_value: number; p_label: string; significant: boolean }[];
  ontime_vs_late: { ontime_mean: number; late_mean: number; ontime_n: number; late_n: number; test: string; p_label: string; significant: boolean };
  price_bands: { H_stat: number; p_value: number; bands: { band: string; mean_score: number; n: number }[] };
  logistic_regression: { pseudo_r2: number; n_obs: number; disclaimer: string; coefficients: { predictor: string; coef: number; p_value: number }[] };
}

const fmt = (n: number) => n.toLocaleString("en-IN");

function Loading() {
  return <div className="loading"><div className="spinner" /><span>Loading…</span></div>;
}

export default function StatisticalAnalysisPage() {
  const [data, setData] = useState<StatData | null>(null);

  useEffect(() => {
    fetch("/api/statistical-analysis").then(r => r.json()).then(setData);
  }, []);

  if (!data) return <Loading />;

  const corrData = data.correlations.map(c => ({
    pair: c.pair.length > 35 ? c.pair.slice(0, 33) + "…" : c.pair,
    fullPair: c.pair,
    rho: c.rho,
    p_label: c.p_label,
    significant: c.significant,
    fill: c.rho < -0.3 ? "#FF6B6B" : c.rho < 0 ? "#FF9F43" : "#00D4AA",
  }));

  const bandData = data.price_bands.bands.map(b => ({
    band: b.band,
    score: b.mean_score,
    n: b.n,
    fill: b.mean_score >= 3.8 ? "#00D4AA" : b.mean_score >= 3.5 ? "#FFD93D" : "#FF6B6B",
  }));

  const coefData = data.logistic_regression.coefficients.map(c => ({
    pred: c.predictor,
    coef: c.coef,
    pval: c.p_value,
    fill: c.coef > 0 ? "#FF6B6B" : "#00D4AA",
  }));

  const otl = data.ontime_vs_late;

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">📈 Statistical Analysis</h1>
        <p className="page-subtitle">
          Spearman correlations · Mann-Whitney U tests · Kruskal-Wallis · Logistic regression
        </p>
      </div>

      <div className="alert alert-warning mb">
        <span className="alert-icon">⚠️</span>
        <span>
          <strong>{data.disclaimer}</strong><br />
          Statistical significance (p &lt; 0.05) does not imply causation. All tests are non-parametric due to non-normal distributions.
        </span>
      </div>

      {/* Correlations */}
      <div className="card mb">
        <div className="card-title">Spearman Rank Correlations</div>
        <p style={{ fontSize: "0.82rem", color: "#8B90A7", marginBottom: 16 }}>
          Non-parametric correlation between ordinal/continuous variables. ρ range: −1 to +1.
        </p>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={corrData} layout="vertical" margin={{ top: 4, right: 80, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis type="number" domain={[-1, 0.3]} tick={{ fill: "#8B90A7", fontSize: 11 }} />
            <YAxis type="category" dataKey="pair" width={260} tick={{ fill: "#C8CCD8", fontSize: 11 }} />
            <ReferenceLine x={0} stroke="rgba(255,255,255,0.2)" strokeDasharray="4 4" />
            <Tooltip
              contentStyle={{ background: "#161B2C", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#F0F2FA" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div style={{ background: "#161B2C", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "10px 14px", fontSize: 13 }}>
                    <strong>{d.fullPair}</strong><br />
                    <span style={{ color: "#8B90A7" }}>ρ = </span><span style={{ color: d.fill }}>{d.rho.toFixed(4)}</span><br />
                    <span style={{ color: "#8B90A7" }}>p-value: </span>{d.p_label}
                  </div>
                );
              }}
            />
            <Bar dataKey="rho" radius={[0, 4, 4, 0]}
              label={{ position: "right", fill: "#8B90A7", fontSize: 11, formatter: (v: number) => `ρ=${v.toFixed(3)} *` }}>
              {corrData.map((e, i) => <Cell key={i} fill={e.fill} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div style={{ fontSize: "0.75rem", color: "#4A4F66", marginTop: 8 }}>
          * All correlations significant at p &lt; 0.05. p-values: Delivery Delay vs Score p&lt;1e-300, Price vs Score p&lt;1e-300, Complaint vs Rating ~0.0001.
        </div>
      </div>

      {/* On-time vs Late */}
      <div className="card mb">
        <div className="card-title">On-Time vs Late Delivery — Review Scores ({otl.test})</div>
        <div className="stat-row">
          {[
            { val: otl.ontime_mean, lbl: "On-Time Mean Score", sub: `N = ${fmt(otl.ontime_n)}`, cls: "positive" },
            { val: otl.late_mean,   lbl: "Late Delivery Score", sub: `N = ${fmt(otl.late_n)}`,   cls: "negative" },
            { val: `${(otl.ontime_mean - otl.late_mean).toFixed(2)}`, lbl: "Score Difference", sub: "On-time minus late", cls: "neutral" },
            { val: otl.p_label,     lbl: `${otl.test} p-value`, sub: "Highly significant", cls: "positive" },
          ].map(s => (
            <div className="stat-item" key={s.lbl}>
              <div className={`stat-val ${s.cls}`}>{s.val}</div>
              <div className="stat-lbl">{s.lbl}</div>
              <div className="stat-sub">{s.sub}</div>
            </div>
          ))}
        </div>
        <div className="alert alert-info" style={{ marginTop: 4, marginBottom: 0 }}>
          <span className="alert-icon">ℹ️</span>
          <span>Late deliveries are <strong>associated</strong> with significantly lower review scores. This is a correlation, not proof that late delivery <em>causes</em> lower scores.</span>
        </div>
      </div>

      {/* Price bands */}
      <div className="card mb">
        <div className="card-title">Price Band vs Mean Review Score (Kruskal-Wallis)</div>
        <p style={{ fontSize: "0.82rem", color: "#8B90A7", marginBottom: 12 }}>
          H = {data.price_bands.H_stat.toFixed(2)} · p = {data.price_bands.p_value.toExponential(2)} · Significant difference across bands
        </p>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={bandData} margin={{ top: 8, right: 24, left: -10, bottom: 40 }}>
            <XAxis dataKey="band" tick={{ fill: "#8B90A7", fontSize: 11 }} angle={-12} textAnchor="end" height={55} />
            <YAxis domain={[3.3, 3.9]} tick={{ fill: "#8B90A7", fontSize: 11 }} />
            <ReferenceLine y={3.5} stroke="#4A4F66" strokeDasharray="4 4" label={{ value: "3.5", fill: "#4A4F66", fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: "#161B2C", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#F0F2FA" }}
              formatter={(v: number, _, props: { payload: { n: number } }) => [`${v.toFixed(3)} (N=${fmt(props.payload.n)})`, "Mean Score"]}
            />
            <Bar dataKey="score" radius={[4, 4, 0, 0]}
              label={{ position: "top", fill: "#8B90A7", fontSize: 11, formatter: (v: number) => v.toFixed(2) }}>
              {bandData.map((e, i) => <Cell key={i} fill={e.fill} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Logistic Regression */}
      <div className="card">
        <div className="card-title">Logistic Regression — P(Negative Review)</div>
        <div className="alert alert-warning">
          <span className="alert-icon">⚠️</span>
          <span>{data.logistic_regression.disclaimer}</span>
        </div>
        <div className="stat-row" style={{ marginBottom: 16 }}>
          <div className="stat-item">
            <div className="stat-val neutral">{data.logistic_regression.pseudo_r2}</div>
            <div className="stat-lbl">McFadden Pseudo R²</div>
            <div className="stat-sub">Low — many unmeasured factors</div>
          </div>
          <div className="stat-item">
            <div className="stat-val">{fmt(data.logistic_regression.n_obs)}</div>
            <div className="stat-lbl">Observations</div>
            <div className="stat-sub">Joined orders + reviews</div>
          </div>
        </div>

        {/* Coefficient chart */}
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={coefData} layout="vertical" margin={{ top: 4, right: 80, left: 8, bottom: 4 }}>
            <XAxis type="number" tick={{ fill: "#8B90A7", fontSize: 11 }} />
            <YAxis type="category" dataKey="pred" width={160} tick={{ fill: "#C8CCD8", fontSize: 12 }} />
            <ReferenceLine x={0} stroke="rgba(255,255,255,0.2)" strokeDasharray="4 4" />
            <Tooltip
              contentStyle={{ background: "#161B2C", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#F0F2FA" }}
              formatter={(v: number) => [v.toFixed(5), "Coefficient"]}
            />
            <Bar dataKey="coef" radius={[0, 4, 4, 0]}
              label={{ position: "right", fill: "#8B90A7", fontSize: 11, formatter: (v: number) => v.toFixed(4) }}>
              {coefData.map((e, i) => <Cell key={i} fill={e.fill} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        <div className="tbl-wrap" style={{ marginTop: 16 }}>
          <table>
            <thead>
              <tr>
                <th>Predictor</th>
                <th style={{ textAlign: "right" }}>Coefficient</th>
                <th style={{ textAlign: "right" }}>p-value</th>
                <th>Interpretation</th>
              </tr>
            </thead>
            <tbody>
              {data.logistic_regression.coefficients.map(c => (
                <tr key={c.predictor}>
                  <td>{c.predictor}</td>
                  <td style={{ textAlign: "right", color: c.coef > 0 ? "#FF6B6B" : "#00D4AA", fontVariantNumeric: "tabular-nums" }}>
                    {c.coef.toFixed(5)}
                  </td>
                  <td style={{ textAlign: "right", color: c.p_value < 0.05 ? "#00D4AA" : "#8B90A7" }}>
                    {c.p_value.toFixed(6)}
                  </td>
                  <td style={{ fontSize: "0.8rem", color: "#8B90A7" }}>
                    {c.coef > 0
                      ? "↑ associated with higher P(negative)"
                      : "↓ associated with lower P(negative)"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: "0.72rem", color: "#4A4F66", marginTop: 10 }}>
          Outcome: 1 = negative review, 0 = positive/neutral. Association only — not causal.
        </p>
      </div>
    </>
  );
}
