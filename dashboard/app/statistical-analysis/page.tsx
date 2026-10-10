"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid, LabelList, ReferenceLine } from "recharts";
import { Sigma } from "lucide-react";
import type { StatisticalAnalysis } from "../types";
import { useData, Loading, ErrorState, PageHeader, Panel, Stats, Note } from "../components/ui";
import { axis, categoryAxis, grid, tooltip, barLabel, C } from "@/lib/chart";
import { int, pValue } from "@/lib/format";

const PREDICTORS: Record<string, string> = {
  delay_days: "Delay, per day",
  freight_value: "Freight, per R$ 1",
  price: "Order price, per R$ 1",
};

function strength(rho: number) {
  const a = Math.abs(rho);
  if (a >= 0.7) return "very strong";
  if (a >= 0.4) return "strong";
  if (a >= 0.2) return "weak to moderate";
  if (a >= 0.1) return "weak";
  return "very weak";
}

export default function StatisticsPage() {
  const { data, error } = useData<StatisticalAnalysis>("/api/statistical-analysis");
  if (error) return <ErrorState message={error} />;
  if (!data) return <Loading />;

  const reviewLevel = data.correlations.filter(c => (c.n ?? 0) > 1000);
  const categoryLevel = data.correlations.filter(c => (c.n ?? 0) <= 1000);
  const delay = data.correlations.find(c => c.pair.startsWith("Delivery Delay"));
  const o = data.ontime_vs_late;
  const bands = data.price_bands.bands.map(b => ({ ...b, name: b.band === "<50" ? "Under R$ 50" : b.band === ">500" ? "Over R$ 500" : `R$ ${b.band.replace("-", "–")}` }));
  const lr = data.logistic_regression;
  const coefs = lr.coefficients.filter(c => c.predictor !== "const");

  return (
    <>
      <PageHeader
        name="Statistics"
        icon={<Sigma size={16} />}
        finding={<>The longer an order runs late, the lower its rating tends to be. Price and freight matter far less.</>}
        lede={<>
          Each test uses one row per text review on a delivered order, with price and freight summed to the order,
          so multi-item orders are not counted twice. Tests are non-parametric because star ratings are ordinal.
        </>}
      />

      <Note>{data.disclaimer} A significant p-value here mostly reflects the large sample; look at the size of the effect.</Note>

      <div className="grid grid-2">
        <Panel title="Spearman correlation with review score" sub={`One row per review, N = ${int(reviewLevel[0]?.n ?? 0)}. Negative means higher values go with lower scores.`}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={reviewLevel} layout="vertical" margin={{ top: 0, right: 60, left: 0, bottom: 0 }}>
              <XAxis type="number" domain={[-0.3, 0.05]} {...axis} tickFormatter={v => v.toFixed(2)} />
              <YAxis type="category" dataKey="pair" width={200} {...categoryAxis}
                tickFormatter={(v: string) => v.replace(" vs Review Score", "")} />
              <ReferenceLine x={0} stroke={C.faint} />
              <Tooltip {...tooltip} formatter={(v: any, _: unknown, p: any) => [`ρ = ${v.toFixed(3)}, ${p.payload.p_label}`, "Spearman"]} />
              <Bar dataKey="rho" barSize={20}>
                {reviewLevel.map(c => <Cell key={c.pair} fill={c.rho < 0 ? C.s1 : C.s5} />)}
                <LabelList dataKey="rho" position="left" style={barLabel} formatter={(v: any) => v.toFixed(3)} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {delay && <p className="panel-foot">Delivery delay: ρ = {delay.rho.toFixed(3)}, a {strength(delay.rho)} negative association ({pValue(delay.p_value)}).</p>}
        </Panel>
        <Panel title="Category-level correlations" sub={`Across the ${categoryLevel[0]?.n ?? 0} categories with at least 100 reviews.`}>
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>Pair</th><th className="num">ρ</th><th className="num">p-value</th></tr></thead>
              <tbody>
                {categoryLevel.map(c => (
                  <tr key={c.pair}><td>{c.pair}</td><td className="num">{c.rho.toFixed(3)}</td><td className="num">{pValue(c.p_value)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="panel-foot">
            The complaint-rate row is close to definitional: both measures come from the same star ratings. The
            negative-sentiment row is the informative one, because sentiment comes from the text.
          </p>
        </Panel>
      </div>

      <h2 className="section-title">On-time versus late deliveries</h2>
      <Stats items={[
        { value: `${o.ontime_mean.toFixed(2)} ★`, label: "Average score, on time", detail: `${int(o.ontime_n)} reviews`, tone: "pos" },
        { value: `${o.late_mean.toFixed(2)} ★`, label: "Average score, late", detail: `${int(o.late_n)} reviews`, tone: "neg" },
        { value: `${(o.ontime_mean - o.late_mean).toFixed(2)} ★`, label: "Difference", detail: "On time minus late" },
        { value: o.p_label ?? "", label: "Mann-Whitney U, one-sided", detail: o.significant ? "Significant at p < 0.05" : "Not significant" },
      ]} />

      <div className="grid grid-2">
        <Panel title="Average score by order price" sub={`Kruskal-Wallis H = ${data.price_bands.H_stat.toFixed(1)}, ${pValue(data.price_bands.p_value)}. Pricier orders score slightly lower.`}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={bands} margin={{ top: 22, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid {...grid} />
              <XAxis dataKey="name" {...axis} />
              <YAxis {...axis} width={36} domain={[3, 4.2]} tickFormatter={v => v.toFixed(1)} />
              <Tooltip {...tooltip} formatter={(v: any, _: unknown, p: any) => [`${v.toFixed(2)} ★ (${int(p.payload.n)} reviews)`, "Average"]} />
              <Bar dataKey="mean_score" fill={C.ink2} radius={[3, 3, 0, 0]} maxBarSize={64}>
                <LabelList dataKey="mean_score" position="top" style={barLabel} formatter={(v: any) => `${v.toFixed(2)} ★`} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="panel-foot">The y-axis starts at 3 stars to make the small differences visible.</p>
        </Panel>
        <Panel title="Logistic regression: chance of a 1–2 star review" sub={`N = ${int(lr.n_obs)}, McFadden pseudo R² = ${lr.pseudo_r2.toFixed(3)}. These factors explain only a small part of negative reviews.`}>
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>Predictor</th><th className="num">Odds ratio</th><th className="num">p-value</th><th>Reading</th></tr></thead>
              <tbody>
                {coefs.map(c => {
                  const or = lr.odds_ratios?.[c.predictor] ?? Math.exp(c.coef);
                  const sig = c.p_value < 0.05;
                  return (
                    <tr key={c.predictor}>
                      <td>{PREDICTORS[c.predictor] ?? c.predictor}</td>
                      <td className="num">{or.toFixed(3)}</td>
                      <td className="num">{pValue(c.p_value)}</td>
                      <td style={{ color: sig ? "var(--ink-2)" : "var(--muted)" }}>
                        {!sig ? "No detectable association" : `${((or - 1) * 100).toFixed(1)}% higher odds`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="panel-foot">{lr.disclaimer}</p>
        </Panel>
      </div>
    </>
  );
}
