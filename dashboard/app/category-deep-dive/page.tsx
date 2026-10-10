"use client";
import { useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList,
  ScatterChart, Scatter, ZAxis, CartesianGrid,
} from "recharts";
import { Boxes } from "lucide-react";
import type { CategoryIntelligence, CategoryRow } from "../types";
import { useData, Loading, ErrorState, PageHeader, Panel, Segmented, LowN } from "../components/ui";
import { axis, categoryAxis, grid, tooltip, barLabel, rateColor, C } from "@/lib/chart";
import { int, pct, brl, label } from "@/lib/format";

const FILTERS = ["reliable", "all", "low"] as const;
type Filter = (typeof FILTERS)[number];

type SortKey = "category" | "review_count" | "avg_review_score" | "neg_sentiment_rate" | "neg_review_rate"
  | "avg_item_price" | "avg_freight" | "late_delivery_rate";

const COLUMNS: { key: SortKey; title: string; num: boolean; fmt: (r: CategoryRow) => string }[] = [
  { key: "category", title: "Category", num: false, fmt: r => label(r.category) },
  { key: "review_count", title: "Reviews", num: true, fmt: r => int(r.review_count) },
  { key: "avg_review_score", title: "Avg stars", num: true, fmt: r => r.avg_review_score.toFixed(2) },
  { key: "neg_sentiment_rate", title: "Negative text", num: true, fmt: r => pct(r.neg_sentiment_rate) },
  { key: "neg_review_rate", title: "1–2 star reviews", num: true, fmt: r => pct(r.neg_review_rate) },
  { key: "late_delivery_rate", title: "Late", num: true, fmt: r => pct(r.late_delivery_rate) },
  { key: "avg_item_price", title: "Avg item price", num: true, fmt: r => brl(r.avg_item_price, 2) },
  { key: "avg_freight", title: "Avg freight", num: true, fmt: r => brl(r.avg_freight, 2) },
];

function heatStyle(v: number) {
  const c = rateColor(v / 100, 0.2, 0.6);
  return { background: `${c}${v >= 50 ? "33" : "1F"}`, color: v >= 45 ? c : "var(--ink-2)", fontWeight: v >= 45 ? 600 : 400 };
}

export default function CategoriesPage() {
  const { data, error } = useData<CategoryIntelligence>("/api/category-deep-dive");
  const [filter, setFilter] = useState<Filter>("reliable");
  const [sortBy, setSortBy] = useState<SortKey>("neg_sentiment_rate");
  const [desc, setDesc] = useState(true);
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    if (!data) return [];
    let r = [...data.categories];
    if (filter === "reliable") r = r.filter(c => !c.low_n);
    if (filter === "low") r = r.filter(c => c.low_n);
    const q = search.trim().toLowerCase();
    if (q) r = r.filter(c => label(c.category).toLowerCase().includes(q));
    r.sort((a, b) => {
      const av = a[sortBy], bv = b[sortBy];
      const cmp = typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number);
      return desc ? -cmp : cmp;
    });
    return r;
  }, [data, filter, sortBy, desc, search]);

  if (error) return <ErrorState message={error} />;
  if (!data) return <Loading />;

  const n = data.low_n_threshold;
  const reliable = data.categories.filter(c => !c.low_n);
  const top15 = [...reliable].sort((a, b) => b.neg_sentiment_rate - a.neg_sentiment_rate).slice(0, 15)
    .map(c => ({ ...c, name: label(c.category), v: c.neg_sentiment_rate * 100 }));
  const worst = top15[0];
  const scatter = reliable.map(c => ({ x: c.avg_item_price, y: c.neg_sentiment_rate * 100, z: c.review_count, name: label(c.category) }));
  const hm = data.heatmap;

  const sort = (k: SortKey) => {
    if (k === sortBy) setDesc(d => !d);
    else { setSortBy(k); setDesc(k !== "category"); }
  };

  return (
    <>
      <PageHeader
        name="Categories"
        icon={<Boxes size={16} />}
        finding={<>{worst.name} has the highest complaint rate of any well-reviewed category: {pct(worst.neg_sentiment_rate)} of its text reviews are negative.</>}
        lede={<>
          {data.categories.length} product categories, of which {reliable.length} have at least {n} text reviews.
          Rankings use only those {reliable.length}, so a category with two unhappy reviews cannot top a chart.
        </>}
      />

      <div className="grid grid-2">
        <Panel title="Highest share of negative reviews" sub={`Top 15 categories with at least ${n} text reviews.`}>
          <ResponsiveContainer width="100%" height={420}>
            <BarChart data={top15} layout="vertical" margin={{ top: 0, right: 52, left: 0, bottom: 0 }}>
              <XAxis type="number" hide domain={[0, "dataMax"]} />
              <YAxis type="category" dataKey="name" width={200} {...categoryAxis} interval={0} />
              <Tooltip {...tooltip} formatter={(v: any, _: unknown, p: any) => [`${v.toFixed(1)}% of ${int(p.payload.review_count)} reviews`, "Negative"]} />
              <Bar dataKey="v" radius={[0, 3, 3, 0]} barSize={16}>
                {top15.map(c => <Cell key={c.category} fill={rateColor(c.neg_sentiment_rate, 0.2, 0.34)} />)}
                <LabelList dataKey="v" position="right" style={barLabel} formatter={(v: any) => `${v.toFixed(1)}%`} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Price and complaints" sub="Each dot is a category; size is review count. Pricier categories are not clearly more complained about.">
          <ResponsiveContainer width="100%" height={420}>
            <ScatterChart margin={{ top: 10, right: 16, left: 0, bottom: 24 }}>
              <CartesianGrid stroke={C.line2} />
              <XAxis type="number" dataKey="x" name="Avg item price" {...axis} tickFormatter={v => `R$ ${v}`}
                label={{ value: "Average item price (R$)", position: "insideBottom", offset: -14, fill: C.muted, fontSize: 12 }} />
              <YAxis type="number" dataKey="y" name="Negative" {...axis} width={44} tickFormatter={v => `${v}%`} />
              <ZAxis type="number" dataKey="z" range={[30, 420]} />
              <Tooltip {...tooltip} cursor={{ strokeDasharray: "3 3" }}
                content={({ payload }) => {
                  const p = payload?.[0]?.payload as { name: string; x: number; y: number; z: number } | undefined;
                  if (!p) return null;
                  return (
                    <div style={tooltip.contentStyle}>
                      <div style={{ padding: "6px 10px" }}>
                        <strong>{p.name}</strong><br />
                        {p.y.toFixed(1)}% negative, {brl(p.x, 2)} avg price<br />{int(p.z)} reviews
                      </div>
                    </div>
                  );
                }} />
              <Scatter data={scatter} fill={C.cobalt} fillOpacity={0.55} stroke={C.cobalt} />
            </ScatterChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      <Panel
        title="Complaint rate by category and aspect"
        sub="Share of reviews mentioning the aspect that are negative. The 20 categories with the most reviews."
      >
        <div className="tbl-wrap">
          <table className="heat">
            <thead>
              <tr><th>Category</th>{hm.aspects.map(a => <th key={a}>{a}</th>)}</tr>
            </thead>
            <tbody>
              {hm.categories.map((c, i) => (
                <tr key={c}>
                  <td>{label(c)}</td>
                  {hm.values[i].map((v, j) => <td key={j} style={heatStyle(v)}>{Math.round(v)}%</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel
        title="All categories"
        sub="Select a column heading to sort."
        action={
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <input className="input" type="search" placeholder="Find a category" value={search}
              onChange={e => setSearch(e.target.value)} aria-label="Find a category" />
            <Segmented options={FILTERS} value={filter} onChange={setFilter}
              labelFor={f => f === "reliable" ? `${n}+ reviews` : f === "all" ? "All" : `Under ${n} reviews`} />
          </div>
        }
        foot={`${rows.length} of ${data.categories.length} categories shown. Low N means fewer than ${n} text reviews; treat those rates with caution.`}
      >
        <div className="tbl-wrap" style={{ maxHeight: 520 }}>
          <table>
            <thead>
              <tr>
                {COLUMNS.map(col => (
                  <th key={col.key} className={`sortable ${col.num ? "num" : ""}`} onClick={() => sort(col.key)}
                    aria-sort={sortBy === col.key ? (desc ? "descending" : "ascending") : undefined}>
                    {col.title}{sortBy === col.key ? (desc ? " ↓" : " ↑") : ""}
                  </th>
                ))}
                <th>Top complaint</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.category}>
                  {COLUMNS.map(col => (
                    <td key={col.key} className={col.num ? "num" : ""}
                      style={col.key === "neg_sentiment_rate" && !r.low_n ? { color: rateColor(r.neg_sentiment_rate, 0.2, 0.34), fontWeight: 600 } : undefined}>
                      {col.fmt(r)}
                      {col.key === "category" && r.low_n && <> <LowN /></>}
                    </td>
                  ))}
                  <td style={{ color: "var(--muted)" }}>{r.top_complaint_topic || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
