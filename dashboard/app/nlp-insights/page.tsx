"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid, LabelList } from "recharts";
import { MessageSquareText } from "lucide-react";
import type { NlpInsights } from "../types";
import { useData, Loading, ErrorState, PageHeader, Panel, Note, SentimentMix, SentimentLegend } from "../components/ui";
import { axis, categoryAxis, grid, tooltip, STAR, C, barLabel, rateColor } from "@/lib/chart";
import { int, pctOf } from "@/lib/format";

export default function CustomerVoicePage() {
  const { data, error } = useData<NlpInsights>("/api/nlp-insights");
  if (error) return <ErrorState message={error} />;
  if (!data) return <Loading />;

  const aspects = data.aspects.filter(a => a.aspect !== "Uncategorized");
  const uncategorized = data.aspects.find(a => a.aspect === "Uncategorized");
  const negTotal = aspects.reduce((s, a) => s + a.negative, 0);
  const byVolume = [...aspects].sort((a, b) => b.negative - a.negative)
    .map(a => ({ ...a, share: (a.negative / negTotal) * 100 }));
  const byRate = [...aspects].sort((a, b) => b.neg_pct - a.neg_pct);
  const top = byVolume[0];
  const sharpest = byRate[0];

  const agreement = data.per_score_agreement.map(r => ({ score: `${r.score} ★`, pct: r.agreement_pct, s: r.score }));
  const topics = [...data.topics].sort((a, b) => b.review_count - a.review_count);

  return (
    <>
      <PageHeader
        name="Customer voice"
        icon={<MessageSquareText size={16} />}
        finding={<>{top.aspect} draws the most complaints. {sharpest.aspect} is the most reliably negative.</>}
        lede={<>
          Aspects come from {int(data.reviews_with_text)} reviews with text ({pctOf(data.text_coverage_pct)} of all reviews),
          written in Portuguese and scored with a multilingual XLM-RoBERTa model. A review can mention several aspects.
        </>}
      />

      <div className="grid grid-2">
        <Panel title="Share of negative mentions" sub={`Which aspects appear in negative reviews. ${int(negTotal)} negative aspect mentions.`}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={byVolume} layout="vertical" margin={{ top: 0, right: 56, left: 0, bottom: 0 }}>
              <XAxis type="number" hide domain={[0, "dataMax"]} />
              <YAxis type="category" dataKey="aspect" width={150} {...categoryAxis} />
              <Tooltip {...tooltip} formatter={(v: any, _: unknown, p: any) => [`${int(p.payload.negative)} mentions (${pctOf(v)})`, "Negative"]} />
              <Bar dataKey="share" fill={C.ink2} radius={[0, 3, 3, 0]} barSize={18}>
                <LabelList dataKey="share" position="right" style={barLabel} formatter={(v: any) => pctOf(v)} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="How often a mention is negative" sub="Of all reviews that mention the aspect, the share with negative sentiment.">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={byRate} layout="vertical" margin={{ top: 0, right: 56, left: 0, bottom: 0 }}>
              <XAxis type="number" hide domain={[0, 100]} />
              <YAxis type="category" dataKey="aspect" width={150} {...categoryAxis} />
              <Tooltip {...tooltip} formatter={(v: any, _: unknown, p: any) => [`${pctOf(v)} of ${int(p.payload.total_mentions)} mentions`, "Negative"]} />
              <Bar dataKey="neg_pct" radius={[0, 3, 3, 0]} barSize={18}>
                {byRate.map(a => <Cell key={a.aspect} fill={rateColor(a.neg_pct / 100, 0.2, 0.55)} />)}
                <LabelList dataKey="neg_pct" position="right" style={barLabel} formatter={(v: any) => pctOf(v)} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      <Panel title="Sentiment mix by aspect" sub="Every aspect has well over 100 mentions, so none is flagged as low sample size." action={<SentimentLegend />}>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr><th>Aspect</th><th className="num">Mentions</th><th style={{ width: "46%" }}>Negative / neutral / positive</th><th className="num">Negative</th></tr>
            </thead>
            <tbody>
              {[...byRate, ...(uncategorized ? [uncategorized] : [])].map(a => (
                <tr key={a.aspect}>
                  <td>{a.aspect}</td>
                  <td className="num">{int(a.total_mentions)}</td>
                  <td style={{ verticalAlign: "middle" }}><SentimentMix neg={a.negative} neu={a.neutral} pos={a.positive} /></td>
                  <td className="num">{pctOf(a.neg_pct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <h2 className="section-title">Topics discovered in the text</h2>
      <Panel
        title="Eight topics from sentence embeddings"
        sub="Reviews were clustered with multilingual sentence embeddings and KMeans. Names are interpretations of each cluster's most distinctive Portuguese terms and sample reviews."
      >
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr><th>Topic</th><th className="num">Reviews</th><th className="num">Share</th><th>Most distinctive terms (Portuguese)</th></tr>
            </thead>
            <tbody>
              {topics.map(t => (
                <tr key={t.topic_id}>
                  <td style={{ fontWeight: 600 }}>{t.label}</td>
                  <td className="num">{int(t.review_count)}</td>
                  <td className="num">{pctOf((t.review_count / data.reviews_with_text) * 100)}</td>
                  <td style={{ color: "var(--muted)" }}>{t.top_terms.slice(0, 7).join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <h2 className="section-title">How well the text model matches star ratings</h2>
      <div className="grid grid-2-1">
        <Panel
          title="Agreement between text sentiment and stars"
          sub={`Overall ${pctOf(data.agreement_rate_pct)}. Three-star reviews are the most ambiguous; clear ratings agree most often.`}
        >
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={agreement} margin={{ top: 22, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid {...grid} />
              <XAxis dataKey="score" {...axis} />
              <YAxis {...axis} width={42} domain={[0, 100]} tickFormatter={v => `${v}%`} />
              <Tooltip {...tooltip} formatter={(v: any) => [pctOf(v), "Agreement"]} />
              <Bar dataKey="pct" radius={[3, 3, 0, 0]} maxBarSize={64}>
                {agreement.map(r => <Cell key={r.s} fill={STAR[r.s - 1]} />)}
                <LabelList dataKey="pct" position="top" style={barLabel} formatter={(v: any) => pctOf(v)} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Why they disagree">
          <p style={{ fontSize: "0.92rem", color: "var(--ink-2)" }}>
            Customers often rate the product but write about something else, for example a 5-star review that
            complains about delivery, or a 1-star review whose text is neutral. Some disagreement is also model error:
            the model was trained on tweets, not product reviews.
          </p>
        </Panel>
      </div>

      <div style={{ marginTop: 18 }}>
        <Note tone="caution">
          Company names inside the review text are anonymised as Game of Thrones houses (for example
          &ldquo;lannister&rdquo;), so some topic terms are store names rather than complaints.
        </Note>
      </div>
    </>
  );
}
