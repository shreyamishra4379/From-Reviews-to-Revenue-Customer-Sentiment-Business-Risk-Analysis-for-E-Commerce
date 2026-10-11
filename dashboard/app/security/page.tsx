"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList, Cell } from "recharts";
import { ShieldCheck, ShieldAlert, CircleCheck, CircleX } from "lucide-react";
import { useData, Loading, ErrorState, PageHeader, Panel, Stats, Note } from "../components/ui";
import { categoryAxis, tooltip, barLabel, C } from "@/lib/chart";
import { int, pctOf, label } from "@/lib/format";

interface SecurityEvent { time: string; type: string; route: string; client: string; detail: string }
interface PentestResult { category: string; name: string; attack: string; passed: boolean; evidence: string }
interface SecurityData {
  integrity: { ok: boolean; algorithm: string; generated_at: string | null; checked: number; modified: string[]; missing: string[]; error?: string };
  events: SecurityEvent[];
  event_counts: Record<string, number>;
  pentest: { target: string; run_at: string; passed: number; total: number; results: PentestResult[] } | null;
  fraud_signals: {
    method: string; text_reviews: number; flagged_reviews: number; flagged_pct: number;
    flagged_avg_review_score: number; all_avg_review_score: number; flagged_negative_sentiment_pct: number;
    by_signal: { signal: string; reviews: number; avg_review_score: number; negative_sentiment_pct: number }[];
    top_sellers: { seller_id: string; reviews: number; flagged: number; rate_pct: number }[];
    top_categories: { category: string; reviews: number; flagged: number; rate_pct: number }[];
    seller_min_reviews: number; category_min_reviews: number;
    examples: { signal: string; review_score: number; text: string }[];
  } | null;
  controls: { rate_limits: { route: string; requests: number; window_seconds: number; max_kb: number }[]; ai_providers: string[] };
}

const EVENT_NAMES: Record<string, string> = {
  sql_blocked: "Blocked SQL statement",
  sql_sandbox_denied: "File or setting access denied",
  rate_limited: "Rate limit hit",
  request_too_large: "Oversized request",
  prompt_injection_suspected: "Possible prompt injection",
  integrity_mismatch: "Data file changed",
};

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" });

function Status({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: ok ? "var(--t5)" : "var(--t1)", fontWeight: 600 }}>
      {ok ? <CircleCheck size={15} /> : <CircleX size={15} />}{children}
    </span>
  );
}

export default function SecurityPage() {
  const { data, error } = useData<SecurityData>("/api/security");
  if (error) return <ErrorState message={error} />;
  if (!data) return <Loading />;

  const { integrity: integ, pentest, fraud_signals: fraud, controls } = data;
  const sql = controls.rate_limits.find(r => r.route.includes("sql"));
  const chat = controls.rate_limits.find(r => r.route.includes("chat"));

  const CONTROLS = [
    { control: "Read-only SQL validator", protects: "SQL injection, destructive statements (DROP, DELETE, COPY, ATTACH)", layer: "API" },
    { control: "DuckDB file sandbox", protects: "Reading system files, raw data or the API key file through SQL", layer: "Database" },
    { control: `Rate limits: ${sql?.requests ?? 30} SQL and ${chat?.requests ?? 10} AI requests per minute per client`, protects: "Request flooding, running up AI costs", layer: "API" },
    { control: `Request size limits: ${sql?.max_kb ?? 16} KB SQL, ${chat?.max_kb ?? 64} KB chat`, protects: "Memory exhaustion with oversized payloads", layer: "API" },
    { control: "Content Security Policy and security headers", protects: "Cross-site scripting, clickjacking, MIME sniffing", layer: "Browser" },
    { control: "API keys server-side only, redacted from logs", protects: "Leaking Groq or Gemini keys to the browser or log files", layer: "Server" },
    { control: "Prompt-injection detection", protects: "Attempts to override the assistant's rules or extract configuration", layer: "AI" },
    { control: `${integ.algorithm} data fingerprints`, protects: "Silent tampering with result files after the analysis", layer: "Data" },
  ];

  const signals = fraud?.by_signal ?? [];

  return (
    <>
      <PageHeader
        name="Security"
        icon={integ.ok ? <ShieldCheck size={16} /> : <ShieldAlert size={16} />}
        finding={integ.ok
          ? <>All {integ.checked} result files match their fingerprints{pentest ? <>, and {pentest.passed} of {pentest.total} simulated attacks were blocked.</> : "."}</>
          : <>{integ.modified.length + integ.missing.length} result files no longer match their fingerprints.</>}
        lede={<>
          How the dashboard protects its data and its users, what the last penetration test found, and what
          has been blocked since the server started. The fraud section at the bottom looks at trust in the
          marketplace itself, through what customers wrote.
        </>}
      />

      <Stats items={[
        { value: `${integ.checked - integ.modified.length - integ.missing.length} / ${integ.checked}`, label: "Result files verified", detail: `${integ.algorithm} fingerprints`, tone: integ.ok ? "pos" : "neg" },
        { value: pentest ? `${pentest.passed} / ${pentest.total}` : "Not run", label: "Penetration test checks passed", detail: pentest ? `Run ${when(pentest.run_at)}` : "python src/security/pentest.py", tone: pentest ? (pentest.passed === pentest.total ? "pos" : "neg") : undefined },
        { value: int(data.events.length), label: "Security events this session", detail: "Since the server started" },
        { value: fraud ? int(fraud.flagged_reviews) : "—", label: "Reviews mentioning fraud or fakes", detail: fraud ? `${pctOf(fraud.flagged_pct, 2)} of text reviews` : undefined, tone: "neg" },
      ]} />

      <Panel title="Controls in place" sub="Each layer works on its own, so one failure does not expose the data.">
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>Control</th><th>Protects against</th><th>Layer</th><th>Status</th></tr></thead>
            <tbody>
              {CONTROLS.map(c => (
                <tr key={c.control}>
                  <td style={{ fontWeight: 600 }}>{c.control}</td>
                  <td style={{ color: "var(--ink-2)" }}>{c.protects}</td>
                  <td style={{ color: "var(--muted)" }}>{c.layer}</td>
                  <td><Status ok>Active</Status></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid grid-2-1">
        <Panel
          title="Penetration test"
          sub={pentest ? `Last run ${when(pentest.run_at)} against ${pentest.target}.` : undefined}
          foot={pentest ? "Re-run with: python src/security/pentest.py" : undefined}
        >
          {!pentest ? (
            <p style={{ color: "var(--muted)" }}>No report yet. Start the dashboard, then run <code>python src/security/pentest.py</code> to attack it and record the results here.</p>
          ) : (
            <div className="tbl-wrap" style={{ maxHeight: 420 }}>
              <table>
                <thead><tr><th>Attack</th><th>Category</th><th>Result</th></tr></thead>
                <tbody>
                  {pentest.results.map(r => (
                    <tr key={r.category + r.name} title={r.evidence}>
                      <td>{r.name}</td>
                      <td style={{ color: "var(--muted)" }}>{r.category}</td>
                      <td><Status ok={r.passed}>{r.passed ? (r.category === "Control" ? "Works" : "Blocked") : "Not blocked"}</Status></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
        <Panel title="Data integrity" sub={integ.generated_at ? `Fingerprints taken ${when(integ.generated_at)}, checked again every minute.` : undefined}>
          {integ.error ? <Note tone="caution">{integ.error}</Note> : integ.ok ? (
            <p style={{ color: "var(--ink-2)" }}>
              <Status ok>Verified</Status><br /><br />
              Every processed table, aggregate and dashboard file still has the {integ.algorithm} hash recorded when the
              analysis ran, so the numbers on these pages are the numbers the pipeline produced.
            </p>
          ) : (
            <>
              <Status ok={false}>Changed since the analysis</Status>
              <ul style={{ margin: "10px 0 0 18px", fontSize: "0.86rem" }}>
                {[...integ.modified.map(f => `${f} (modified)`), ...integ.missing.map(f => `${f} (missing)`)].map(f => <li key={f}><code>{f}</code></li>)}
              </ul>
              <p className="panel-foot">If you re-ran the pipeline on purpose, record new fingerprints with <code>python src/security/integrity.py --write</code>.</p>
            </>
          )}
        </Panel>
      </div>

      <Panel title="Security events" sub="Blocked or flagged requests since the server started. Clients are anonymised; full history is in dashboard/logs/security.log.">
        {data.events.length > 0 && (
          <div className="legend" style={{ marginBottom: 12, fontSize: "0.86rem", color: "var(--ink-2)" }}>
            {Object.entries(data.event_counts).filter(([, n]) => n > 0).map(([type, n]) => (
              <span key={type}><strong>{int(n)}</strong> {(EVENT_NAMES[type] ?? type).toLowerCase()}</span>
            ))}
          </div>
        )}
        {data.events.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>Nothing has been blocked since the server started. Running the penetration test will generate events here.</p>
        ) : (
          <div className="tbl-wrap" style={{ maxHeight: 380 }}>
            <table>
              <thead><tr><th>Time</th><th>Event</th><th>Route</th><th>Client</th><th>Detail</th></tr></thead>
              <tbody>
                {data.events.map((e, i) => (
                  <tr key={i}>
                    <td style={{ whiteSpace: "nowrap" }}>{when(e.time)}</td>
                    <td style={{ whiteSpace: "nowrap", fontWeight: 600 }}>{EVENT_NAMES[e.type] ?? e.type}</td>
                    <td><code>{e.route}</code></td>
                    <td style={{ color: "var(--muted)", whiteSpace: "nowrap" }}>{e.client}</td>
                    <td style={{ color: "var(--ink-2)", maxWidth: 420, overflowWrap: "anywhere" }}>{e.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {fraud && (
        <>
          <h2 className="section-title">Fraud and counterfeit signals in reviews</h2>
          <Note tone="caution">
            {fraud.method} A flagged review is a customer&apos;s claim, so treat these as leads for investigation.
          </Note>
          <Stats items={[
            { value: int(fraud.flagged_reviews), label: "Flagged text reviews", detail: `${pctOf(fraud.flagged_pct, 2)} of ${int(fraud.text_reviews)}` },
            { value: `${fraud.flagged_avg_review_score.toFixed(2)} ★`, label: "Average score when flagged", detail: `All text reviews: ${fraud.all_avg_review_score.toFixed(2)} ★`, tone: "neg" },
            { value: pctOf(fraud.flagged_negative_sentiment_pct), label: "Flagged reviews with negative text", tone: "neg" },
          ]} />
          <div className="grid grid-2">
            <Panel title="What customers report" sub="Reviews per signal type. One review can match more than one type.">
              <ResponsiveContainer width="100%" height={170}>
                <BarChart data={signals} layout="vertical" margin={{ top: 0, right: 48, left: 0, bottom: 0 }}>
                  <XAxis type="number" hide domain={[0, "dataMax"]} />
                  <YAxis type="category" dataKey="signal" width={190} {...categoryAxis} />
                  <Tooltip {...tooltip} formatter={(v: any, _: unknown, p: any) => [`${int(v)} reviews, average ${p.payload.avg_review_score} ★`, "Flagged"]} />
                  <Bar dataKey="reviews" radius={[0, 3, 3, 0]} barSize={20}>
                    {signals.map((s, i) => <Cell key={s.signal} fill={[C.s1, C.s2, C.s3][i] ?? C.bar} />)}
                    <LabelList dataKey="reviews" position="right" style={barLabel} formatter={(v: any) => int(v)} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="tbl-wrap" style={{ marginTop: 10 }}>
                <table>
                  <thead><tr><th>Category</th><th className="num">Text reviews</th><th className="num">Flagged</th><th className="num">Rate</th></tr></thead>
                  <tbody>
                    {fraud.top_categories.slice(0, 5).map(c => (
                      <tr key={c.category}><td>{label(c.category)}</td><td className="num">{int(c.reviews)}</td><td className="num">{int(c.flagged)}</td><td className="num">{pctOf(c.rate_pct, 2)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="panel-foot">Categories with at least {fraud.category_min_reviews} text reviews.</p>
            </Panel>
            <Panel title="Sellers to review first" sub={`Highest share of flagged reviews among sellers with at least ${fraud.seller_min_reviews} text reviews. Seller IDs are anonymised in the dataset.`}>
              <div className="tbl-wrap">
                <table>
                  <thead><tr><th>Seller</th><th className="num">Text reviews</th><th className="num">Flagged</th><th className="num">Rate</th></tr></thead>
                  <tbody>
                    {fraud.top_sellers.map(s => (
                      <tr key={s.seller_id}>
                        <td><code title={s.seller_id}>{s.seller_id.slice(0, 10)}…</code></td>
                        <td className="num">{int(s.reviews)}</td>
                        <td className="num">{int(s.flagged)}</td>
                        <td className="num" style={{ color: s.rate_pct >= 10 ? "var(--t1)" : undefined, fontWeight: s.rate_pct >= 10 ? 600 : 400 }}>{pctOf(s.rate_pct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>
          <Panel title="Examples" sub="Original Portuguese text, as written. Store names were anonymised by Olist.">
            <div className="grid grid-3" style={{ gap: 12 }}>
              {fraud.examples.slice(0, 6).map((e, i) => (
                <blockquote key={i} style={{ borderLeft: "3px solid var(--line)", paddingLeft: 12, margin: 0 }}>
                  <div style={{ fontSize: "0.78rem", color: "var(--muted)", marginBottom: 4 }}>{e.signal}, {e.review_score} ★</div>
                  <div style={{ fontFamily: "var(--serif)", fontSize: "1.02rem", lineHeight: 1.4 }} lang="pt">&ldquo;{e.text}&rdquo;</div>
                </blockquote>
              ))}
            </div>
          </Panel>
        </>
      )}
    </>
  );
}
