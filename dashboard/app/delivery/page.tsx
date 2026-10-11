"use client";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid, LabelList,
  ComposedChart, Line,
} from "recharts";
import { Truck } from "lucide-react";
import type { DeliveryData } from "../types";
import { useData, Loading, ErrorState, PageHeader, Panel, Stats, Note } from "../components/ui";
import { axis, categoryAxis, grid, tooltip, C, barLabel, rateColor } from "@/lib/chart";
import { int, pct, pctOf, label, stateName } from "@/lib/format";

const MIN_MONTH_REVIEWS = 100;

export default function DeliveryPage() {
  const { data, error } = useData<DeliveryData>("/api/delivery");
  if (error) return <ErrorState message={error} />;
  if (!data) return <Loading />;

  const o = data.ontime_vs_late;
  const states = data.state_late_rates.map(s => ({ ...s, name: `${stateName(s.state)} (${s.state})` }));
  const cats = data.category_late_rates.map(c => ({ ...c, name: label(c.category) }));
  const worst = states[0];

  const aspects = data.aspect_by_delivery
    .filter(a => a.aspect !== "Uncategorized")
    .map(a => ({ ...a, total: a.on_time + a.late, late_share: (a.late / (a.on_time + a.late)) * 100 }))
    .sort((a, b) => b.late_share - a.late_share);
  const delivery = aspects.find(a => a.aspect === "Delivery/Logistics");

  const months = data.monthly_trends.map(m => ({
    ...m,
    reliable: m.review_count >= MIN_MONTH_REVIEWS,
    // no line point for months too small to give a stable rate
    neg: m.review_count >= MIN_MONTH_REVIEWS ? m.neg_sentiment_rate * 100 : null,
  }));

  return (
    <>
      <PageHeader
        name="Delivery"
        icon={<Truck size={16} />}
        finding={<>Two in three reviews of late orders are negative. For on-time orders it is fewer than one in five.</>}
        lede={<>
          Late means delivered after the estimated date shown to the customer. Orders that were never delivered are
          left out of every late rate. Rates below use only states and categories with at least 100 reviews.
        </>}
      />

      <Stats items={[
        { value: pct(o.late_neg_review_rate), label: "Late-order reviews that are negative", detail: `${int(o.late_n)} reviews`, tone: "neg" },
        { value: pct(o.ontime_neg_review_rate), label: "On-time reviews that are negative", detail: `${int(o.ontime_n)} reviews`, tone: "pos" },
        { value: `${o.late_mean.toFixed(2)} ★`, label: "Average score, late", detail: `On time: ${o.ontime_mean.toFixed(2)} ★` },
        { value: pctOf(worst.late_rate_pct), label: `Late rate in ${stateName(worst.state)}`, detail: "Highest of any state" },
      ]} />

      <div className="grid grid-2">
        <Panel title="States with the most late deliveries" sub="Share of reviewed, delivered orders that arrived late. Top 10 states.">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={states} layout="vertical" margin={{ top: 0, right: 52, left: 0, bottom: 0 }}>
              <XAxis type="number" hide domain={[0, "dataMax"]} />
              <YAxis type="category" dataKey="name" width={190} {...categoryAxis} />
              <Tooltip {...tooltip} formatter={(v: any, _: unknown, p: any) => [`${pctOf(v)} of ${int(p.payload.order_count)} reviewed orders`, "Late"]} />
              <Bar dataKey="late_rate_pct" radius={[0, 3, 3, 0]} barSize={18}>
                {states.map(s => <Cell key={s.state} fill={rateColor(s.late_rate_pct / 100, 0.1, 0.3)} />)}
                <LabelList dataKey="late_rate_pct" position="right" style={barLabel} formatter={(v: any) => pctOf(v)} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Categories with the most late deliveries" sub="Top 10 categories with at least 100 reviews.">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={cats} layout="vertical" margin={{ top: 0, right: 52, left: 0, bottom: 0 }}>
              <XAxis type="number" hide domain={[0, "dataMax"]} />
              <YAxis type="category" dataKey="name" width={190} {...categoryAxis} />
              <Tooltip {...tooltip} formatter={(v: any, _: unknown, p: any) => [`${pctOf(v)} of ${int(p.payload.order_count)} reviewed orders`, "Late"]} />
              <Bar dataKey="late_rate_pct" fill={C.bar} radius={[0, 3, 3, 0]} barSize={18}>
                <LabelList dataKey="late_rate_pct" position="right" style={barLabel} formatter={(v: any) => pctOf(v)} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      <Panel
        title="Which complaints come from late orders"
        sub={delivery
          ? `Among negative reviews, ${pctOf(delivery.late_share)} of delivery complaints come from late orders. Product-side complaints mostly come from orders that arrived on time.`
          : "Share of each aspect's negative reviews that come from late orders."}
      >
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={aspects} layout="vertical" margin={{ top: 0, right: 140, left: 0, bottom: 0 }}>
            <XAxis type="number" hide domain={[0, 100]} />
            <YAxis type="category" dataKey="aspect" width={160} {...categoryAxis} />
            <Tooltip {...tooltip} formatter={(v: any, _: unknown, p: any) => [`${pctOf(v)} (${int(p.payload.late)} of ${int(p.payload.total)})`, "From late orders"]} />
            <Bar dataKey="late_share" radius={[0, 3, 3, 0]} barSize={18}>
              {aspects.map(a => <Cell key={a.aspect} fill={rateColor(a.late_share / 100, 0.05, 0.35)} />)}
              <LabelList dataKey="late_share" position="right" style={barLabel}
                formatter={(v: any) => `${pctOf(v)} from late orders`} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Panel>

      <Panel
        title="Review volume and negative sentiment by month"
        sub={`Bars show text reviews per purchase month; the line shows the share with negative sentiment. Months with fewer than ${MIN_MONTH_REVIEWS} reviews are faded and their rates are unreliable.`}
      >
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={months} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid {...grid} />
            <XAxis dataKey="month" {...axis} interval={2} />
            <YAxis yAxisId="n" {...axis} width={48} tickFormatter={v => `${(v / 1000).toFixed(1)}K`} />
            <YAxis yAxisId="r" orientation="right" {...axis} width={44} domain={[0, 45]} ticks={[0, 15, 30, 45]} tickFormatter={v => `${v}%`} />
            <Tooltip {...tooltip} formatter={(v: any, name: any) =>
              name === "neg" ? [pctOf(v), "Negative sentiment"] : [int(v), "Text reviews"]} />
            <Bar yAxisId="n" dataKey="review_count" radius={[2, 2, 0, 0]}>
              {months.map(m => <Cell key={m.month} fill={m.reliable ? C.cobaltSoft : C.line2} />)}
            </Bar>
            <Line yAxisId="r" dataKey="neg" connectNulls={false} stroke={C.s1} strokeWidth={2} dot={{ r: 2.5, fill: C.s1 }} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </Panel>

      <div style={{ marginTop: 18 }}>
        <Note>These are associations in observational data. Late delivery is linked to lower ratings; the data cannot show that it causes them.</Note>
      </div>
    </>
  );
}
