"use client";
import Link from "next/link";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid, LabelList } from "recharts";
import { MessageSquareText, PackageX, Boxes, Wallet } from "lucide-react";
import type { Overview } from "./types";
import { useData, Loading, ErrorState, PageHeader, Panel, Note, SentimentMix, SentimentLegend } from "./components/ui";
import { axis, grid, tooltip, STAR, barLabel } from "@/lib/chart";
import { int, pct, pctOf, brl, brlShort, label } from "@/lib/format";

function StarRuler({ ontime, late }: { ontime: number; late: number }) {
  const pos = (score: number) => `${((score - 1) / 4) * 100}%`;
  const seg = (a: string, b: string) => ({ background: `linear-gradient(90deg, ${a}, ${b})` });
  return (
    <div className="ruler" role="img" aria-label={`On a 1 to 5 star scale, late orders average ${late} and on-time orders average ${ontime}`}>
      {[{ v: late, t: "Late" }, { v: ontime, t: "On time" }].map(m => (
        <div className="ruler-mark" key={m.t} style={{ left: pos(m.v) }}>
          <div className="lbl">{m.t}<br /><strong>{m.v.toFixed(2)} ★</strong></div>
          <div className="pin" />
          <div className="dot" />
        </div>
      ))}
      <div className="ruler-track">
        <span style={seg(STAR[0], STAR[1])} />
        <span style={seg(STAR[1], STAR[2])} />
        <span style={seg(STAR[2], STAR[3])} />
        <span style={seg(STAR[3], STAR[4])} />
      </div>
      <div className="ruler-ticks">
        {[1, 2, 3, 4, 5].map(n => <span key={n}>{n} ★</span>)}
      </div>
    </div>
  );
}

export default function OverviewPage() {
  const { data, error } = useData<Overview>("/api/overview");
  if (error) return <ErrorState message={error} />;
  if (!data) return <Loading />;

  const o = data.ontime_vs_late;
  const h = data.headlines;
  const top = h.top_aspects_by_negative[0];
  const first = h.act_first.categories[0];
  const scores = Object.entries(data.review_score_distribution).map(([k, v]) => ({ score: `${k} ★`, n: v }));
  const totalReviews = scores.reduce((s, r) => s + r.n, 0);
  const sent = data.sentiment_distribution;

  return (
    <>
      <PageHeader
        name="Overview"
        finding={<>Late orders average {o.late_mean.toFixed(1)} stars. Orders that arrive on time average {o.ontime_mean.toFixed(1)}.</>}
        lede={<>
          In {int(o.ontime_n + o.late_n)} text reviews of delivered orders, {pct(o.late_neg_review_rate)} of reviews on late
          orders are negative (1–2 stars), compared with {pct(o.ontime_neg_review_rate)} when the order arrives on time.
          Delivery timing is the clearest operational signal in the data. It is an association, not proof of cause.
        </>}
      />

      <section className="panel ruler-panel">
        <div className="ruler-area">
          <h2 className="panel-title">Average review score by delivery timing</h2>
          <p className="panel-sub">Text reviews on delivered orders, one row per review.</p>
          <StarRuler ontime={o.ontime_mean} late={o.late_mean} />
          <div className="ruler-legend">
            <div><strong className="tone-neg">{pct(o.late_neg_review_rate)}</strong>of late-order reviews are negative ({int(o.late_n)} reviews)</div>
            <div><strong className="tone-pos">{pct(o.ontime_neg_review_rate)}</strong>of on-time reviews are negative ({int(o.ontime_n)} reviews)</div>
          </div>
        </div>
        <dl className="ruler-facts facts">
          <dt>Orders</dt>
          <dd>{int(data.total_orders)}</dd>
          <dt>Reviews</dt>
          <dd>{int(data.total_reviews)} <small>{int(data.reviews_with_text)} with text ({pctOf(data.text_coverage_pct)})</small></dd>
          <dt>Delivered orders that arrived late</dt>
          <dd>{pctOf(h.late_delivery.late_pct)} <small>{int(h.late_delivery.late_orders)} of {int(h.late_delivery.delivered_orders)}</small></dd>
          <dt>Sentiment model agrees with the star rating</dt>
          <dd>{pctOf(data.nlp_agreement_pct)} <small>of text reviews</small></dd>
        </dl>
      </section>

      <h2 className="section-title">What the data shows</h2>
      <div className="findings">
        <Link className="finding" href="/nlp-insights">
          <h3><MessageSquareText size={16} />Most complaints</h3>
          <p>{top.aspect} is the most common complaint: {pctOf(top.share_of_negative_pct)} of negative aspect mentions ({int(top.negative)}).</p>
          <span className="go">See customer voice</span>
        </Link>
        <Link className="finding" href="/nlp-insights">
          <h3><PackageX size={16} />Most reliably negative</h3>
          <p>When a review mentions a {h.highest_negative_rate_aspect.aspect.toLowerCase()}, it is negative {pctOf(h.highest_negative_rate_aspect.neg_pct)} of the time.</p>
          <span className="go">See aspect breakdown</span>
        </Link>
        <Link className="finding" href="/category-deep-dive">
          <h3><Boxes size={16} />Where to act first</h3>
          <p>{h.act_first.count} categories pair high complaint rates with high order value, led by {label(first.category).toLowerCase()} at {pct(first.neg_sentiment_rate)} negative.</p>
          <span className="go">See categories</span>
        </Link>
        <Link className="finding" href="/business-impact">
          <h3><Wallet size={16} />Order value at stake</h3>
          <p>{brlShort(h.exposure.affected_order_value_BRL)} of order value sits in {int(h.exposure.affected_orders)} orders with a negative review. A 5% impact scenario puts {brl(h.exposure.at_5_pct_BRL)} at risk.</p>
          <span className="go">See business impact</span>
        </Link>
      </div>

      <h2 className="section-title">How customers rate and write about their orders</h2>
      <div className="grid grid-2">
        <Panel title="Star ratings" sub={`All ${int(totalReviews)} reviews. Most customers give 5 stars, so complaints are a minority.`}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={scores} margin={{ top: 22, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid {...grid} />
              <XAxis dataKey="score" {...axis} />
              <YAxis {...axis} width={48} tickFormatter={v => `${v / 1000}K`} />
              <Tooltip {...tooltip} formatter={(v: any) => [int(v), "Reviews"]} />
              <Bar dataKey="n" radius={[3, 3, 0, 0]} maxBarSize={64}>
                {scores.map((_, i) => <Cell key={i} fill={STAR[i]} />)}
                <LabelList dataKey="n" position="top" style={barLabel} formatter={(v: any) => pct(v / totalReviews, 0)} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="What the review text says" sub={`XLM-RoBERTa sentiment on the ${int(data.reviews_with_text)} reviews that include text.`}>
          <div style={{ marginTop: 28 }}>
            <SentimentMix neg={sent.Negative} neu={sent.Neutral} pos={sent.Positive} />
          </div>
          <div className="grid grid-3" style={{ marginTop: 18, gap: 12 }}>
            {(["Negative", "Neutral", "Positive"] as const).map(k => (
              <div key={k}>
                <div className={`stat-value tone-${k === "Negative" ? "neg" : k === "Neutral" ? "neu" : "pos"}`}>{pct(sent[k] / data.reviews_with_text)}</div>
                <div className="stat-label">{k}</div>
                <div className="stat-detail">{int(sent[k])} reviews</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 22 }}><SentimentLegend /></div>
        </Panel>
      </div>

      <div style={{ marginTop: 18 }}>
        <Note>
          Money is in Brazilian reais (R$). Statistics describe associations in observational data, not causes.
          Text-based results cover the {pctOf(data.text_coverage_pct)} of reviews that include written comments.
        </Note>
      </div>
    </>
  );
}
