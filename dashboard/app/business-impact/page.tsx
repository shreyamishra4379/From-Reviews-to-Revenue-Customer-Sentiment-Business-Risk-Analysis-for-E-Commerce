"use client";
import { useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LabelList,
  ScatterChart, Scatter, ZAxis, ReferenceLine, Cell,
} from "recharts";
import { Wallet } from "lucide-react";
import type { BusinessImpact } from "../types";
import { useData, Loading, ErrorState, PageHeader, Panel, Stats, Note, Segmented } from "../components/ui";
import { axis, grid, tooltip, barLabel, C } from "@/lib/chart";
import { int, pct, brl, brlShort, label } from "@/lib/format";

const SEGMENTS = [
  { key: "HIGH Risk + HIGH Exposure", name: "Act first", desc: "High complaint rate and high order value", color: C.s1, text: "var(--t1)" },
  { key: "HIGH Risk + LOW Exposure", name: "Fix cheaply", desc: "High complaint rate, lower order value", color: C.s2, text: "var(--t2)" },
  { key: "LOW Risk + HIGH Exposure", name: "Protect", desc: "Lower complaint rate, high order value", color: C.cobalt, text: "var(--cobalt)" },
  { key: "LOW Risk + LOW Exposure", name: "Monitor", desc: "Lower complaint rate and order value", color: C.faint, text: "var(--muted)" },
] as const;
const segInfo = (k: string) => SEGMENTS.find(s => s.key === k) ?? SEGMENTS[3];

const FILTERS = ["all", ...SEGMENTS.map(s => s.key)] as const;
type Filter = (typeof FILTERS)[number];

export default function BusinessImpactPage() {
  const { data, error } = useData<BusinessImpact>("/api/business-impact");
  const [filter, setFilter] = useState<Filter>("all");

  const rows = useMemo(() => {
    if (!data) return [];
    const r = filter === "all" ? data.prioritization : data.prioritization.filter(p => p.segment === filter);
    return [...r].sort((a, b) =>
      SEGMENTS.findIndex(s => s.key === a.segment) - SEGMENTS.findIndex(s => s.key === b.segment)
      || b.neg_sentiment_rate - a.neg_sentiment_rate);
  }, [data, filter]);

  if (error) return <ErrorState message={error} />;
  if (!data) return <Loading />;

  const t = data.prioritization_thresholds;
  const at5 = data.sensitivity_table.find(r => r.impact_pct === 5);
  const actFirst = data.prioritization.filter(p => p.segment === SEGMENTS[0].key);
  const sens = data.sensitivity_table.map(r => ({ ...r, name: `${r.impact_pct}%` }));
  const points = data.prioritization.map(p => ({
    x: p.total_value, y: p.neg_sentiment_rate * 100, z: p.review_count, name: label(p.category), seg: p.segment,
  }));

  return (
    <>
      <PageHeader
        name="Business impact"
        icon={<Wallet size={16} />}
        finding={<>{brlShort(data.affected_order_value_BRL)} of order value sits in orders whose review text is negative.</>}
        lede={<>
          That is the value of {int(data.affected_orders)} orders, not money lost. The data has no returns, refunds,
          costs or repeat purchases, so the exposure below is a scenario: order value multiplied by an assumed impact rate.
        </>}
      />

      <Note tone="caution">Scenario-based estimates, not observed revenue loss. All amounts in R$.</Note>

      <Stats items={[
        { value: brl(data.affected_order_value_BRL), label: "Order value with a negative review", detail: `${int(data.affected_orders)} orders` },
        { value: at5 ? brl(at5.exposure_BRL) : "—", label: "Exposure at a 5% impact assumption", detail: "Scenario, not observed" },
        { value: String(actFirst.length), label: "Categories to act on first", detail: "Above median on both risk and value", tone: "neg" },
      ]} />

      <div className="grid grid-2-1">
        <Panel title="Where each category sits" sub={`Split at the medians: ${pct(t.median_neg_sentiment_rate)} negative and ${brlShort(t.median_total_value_BRL)} of item value. Bubble size is review count.`}>
          <ResponsiveContainer width="100%" height={380}>
            <ScatterChart margin={{ top: 10, right: 16, left: 4, bottom: 26 }}>
              <CartesianGrid stroke={C.line2} />
              <XAxis type="number" dataKey="x" scale="log" domain={[8000, 800000]} ticks={[10000, 30000, 100000, 300000]} {...axis}
                tickFormatter={v => brlShort(v)}
                label={{ value: "Item value in reviewed orders (log scale)", position: "insideBottom", offset: -16, fill: C.muted, fontSize: 12 }} />
              <YAxis type="number" dataKey="y" {...axis} width={44} tickFormatter={v => `${v}%`} domain={[10, "auto"]} />
              <ZAxis type="number" dataKey="z" range={[30, 380]} />
              <ReferenceLine x={t.median_total_value_BRL} stroke={C.faint} strokeDasharray="4 4" />
              <ReferenceLine y={t.median_neg_sentiment_rate * 100} stroke={C.faint} strokeDasharray="4 4" />
              <Tooltip {...tooltip} content={({ payload }) => {
                const p = payload?.[0]?.payload as (typeof points)[number] | undefined;
                if (!p) return null;
                return (
                  <div style={{ ...tooltip.contentStyle, padding: "6px 10px" }}>
                    <strong>{p.name}</strong><br />{segInfo(p.seg).name}<br />
                    {p.y.toFixed(1)}% negative, {brl(p.x)} item value<br />{int(p.z)} reviews
                  </div>
                );
              }} />
              <Scatter data={points}>
                {points.map(p => <Cell key={p.name} fill={segInfo(p.seg).color} fillOpacity={0.7} />)}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
          <div className="legend" style={{ marginTop: 6 }}>
            {SEGMENTS.map(s => <span key={s.key}><i style={{ background: s.color, borderRadius: "50%" }} />{s.name}</span>)}
          </div>
        </Panel>
        <Panel title="Exposure under different assumptions" sub="Order value with a negative review, times the assumed share that is lost.">
          <ResponsiveContainer width="100%" height={380}>
            <BarChart data={sens} margin={{ top: 22, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid {...grid} />
              <XAxis dataKey="name" {...axis} />
              <YAxis {...axis} width={72} tickFormatter={v => brlShort(v)} />
              <Tooltip {...tooltip} formatter={(v: any) => [brl(v), "Scenario exposure"]} labelFormatter={l => `${l} impact assumption`} />
              <Bar dataKey="exposure_BRL" fill={C.bar} radius={[3, 3, 0, 0]} maxBarSize={48}>
                <LabelList dataKey="exposure_BRL" position="top" style={barLabel} formatter={(v: any) => brlShort(v)} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      <Panel
        title="Prioritization by category"
        sub={`${data.prioritization.length} categories with at least ${data.low_n_threshold} text reviews.`}
        action={<Segmented options={FILTERS} value={filter} onChange={setFilter}
          labelFor={f => f === "all" ? "All" : segInfo(f).name} />}
      >
        <div className="tbl-wrap" style={{ maxHeight: 520 }}>
          <table>
            <thead>
              <tr>
                <th>Category</th><th>Group</th><th className="num">Reviews</th>
                <th className="num">Negative text</th><th className="num">1–2 star reviews</th><th className="num">Item value</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const s = segInfo(r.segment);
                return (
                  <tr key={r.category}>
                    <td>{label(r.category)}</td>
                    <td><span className="tag" style={{ color: s.text }} title={s.desc}>{s.name}</span></td>
                    <td className="num">{int(r.review_count)}</td>
                    <td className="num">{pct(r.neg_sentiment_rate)}</td>
                    <td className="num">{pct(r.neg_review_rate)}</td>
                    <td className="num">{brl(r.total_value)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
