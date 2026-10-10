"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList } from "recharts";
import { Database, Play, PencilLine } from "lucide-react";
import { useData, Loading, ErrorState, PageHeader, Panel, Note } from "../components/ui";
import { axis, categoryAxis, tooltip, barLabel, C } from "@/lib/chart";
import { int } from "@/lib/format";

interface QueryMeta { file: string; name: string; sql: string }
interface ExecResult { columns: string[]; rows: (string | number | null)[][]; row_count: number; truncated: boolean }

const TABLES = ["fact_orders", "fact_order_items", "fact_order_reviews", "nlp_reviews",
  "dim_products", "dim_customers", "dim_sellers", "dim_payments", "dim_topics"];

const cell = (v: unknown) =>
  v === null || v === undefined ? "—"
  : typeof v === "number" ? (Number.isInteger(v) ? v.toLocaleString("en-US") : v.toLocaleString("en-US", { maximumFractionDigits: 4 }))
  : String(v);

export default function SqlWorkbenchPage() {
  const { data, error: listError } = useData<{ queries: QueryMeta[] }>("/api/sql");
  const queries = data?.queries ?? [];
  const [selected, setSelected] = useState<string | null>(null);
  const [custom, setCustom] = useState(false);
  const [customSql, setCustomSql] = useState("SELECT state, COUNT(*) AS customers\nFROM dim_customers\nGROUP BY state\nORDER BY customers DESC\nLIMIT 10");
  const [result, setResult] = useState<ExecResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { if (!selected && queries.length) setSelected(queries[0].file); }, [queries, selected]);
  const current = queries.find(q => q.file === selected);
  const sql = custom ? customSql : current?.sql ?? "";

  async function run() {
    if (!sql.trim() || running) return;
    setRunning(true); setError(null); setResult(null);
    try {
      const r = await fetch("/api/sql/execute", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sql }),
      });
      const d = await r.json();
      if (d.error) setError(d.error); else setResult(d);
    } catch (e) {
      setError(String(e));
    } finally {
      setRunning(false);
    }
  }

  // Chart: first text column against the first numeric column, if both exist.
  const chart = useMemo(() => {
    if (!result || result.columns.length < 2 || result.rows.length < 2) return null;
    const isNum = (ci: number) => result.rows.every(r => r[ci] === null || typeof r[ci] === "number");
    const textIdx = result.columns.findIndex((_, ci) => !isNum(ci));
    const numIdx = result.columns.findIndex((_, ci) => ci !== textIdx && isNum(ci));
    if (textIdx < 0 || numIdx < 0) return null;
    return {
      x: result.columns[textIdx], y: result.columns[numIdx],
      rows: result.rows.slice(0, 20).map(r => ({ label: String(r[textIdx] ?? "—").slice(0, 34), value: Number(r[numIdx] ?? 0) })),
    };
  }, [result]);

  const choose = (file: string) => { setSelected(file); setCustom(false); setResult(null); setError(null); };

  return (
    <>
      <PageHeader
        name="SQL workbench"
        icon={<Database size={16} />}
        finding="Every number in this dashboard can be checked with a query."
        lede={<>
          Run the project&apos;s {queries.length || 11} analytical queries, or write your own. Queries run in DuckDB
          inside the dashboard server, read-only, against the processed Parquet tables. Results are capped at 500 rows.
        </>}
      />

      <div className="workbench">
        <Panel title="Queries">
          {listError ? <ErrorState message={listError} /> : !data ? <Loading label="Loading queries" /> : (
            <div className="query-list">
              {queries.map(q => (
                <button key={q.file} aria-pressed={!custom && selected === q.file} onClick={() => choose(q.file)}>
                  <span className="n">{q.file.split("_")[0]}</span>{q.name}
                </button>
              ))}
              <button aria-pressed={custom} onClick={() => { setCustom(true); setResult(null); setError(null); setTimeout(() => textRef.current?.focus(), 30); }}
                style={{ marginTop: 6, borderTop: "1px solid var(--line-2)", borderRadius: 0, paddingTop: 10 }}>
                <PencilLine size={15} />Write your own
              </button>
            </div>
          )}
          <h3 className="panel-title" style={{ fontSize: "0.88rem", marginTop: 18, marginBottom: 6 }}>Tables</h3>
          <div className="tables-list">{TABLES.map(t => <code key={t}>{t}</code>)}</div>
        </Panel>

        <div>
          <Panel
            title={custom ? "Your query" : current?.name ?? "Select a query"}
            action={
              <button className="btn btn-primary" onClick={run} disabled={running || !sql.trim()}>
                {running ? <div className="spinner" style={{ width: 14, height: 14, borderTopColor: "#fff" }} /> : <Play size={15} />}
                {running ? "Running" : "Run query"}
              </button>
            }
            foot={custom ? "Ctrl + Enter runs the query. One SELECT or WITH statement; files outside the project data cannot be read." : undefined}
          >
            {custom ? (
              <textarea ref={textRef} className="code" rows={9} value={customSql} spellCheck={false}
                onChange={e => setCustomSql(e.target.value)}
                onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") run(); }}
                aria-label="SQL query" />
            ) : (
              <pre className="code">{sql || "Select a query from the list."}</pre>
            )}
          </Panel>

          {error && <div style={{ marginTop: 18 }}><Note tone="caution"><strong>The query failed.</strong> {error}</Note></div>}

          {result && (
            <>
              {chart && (
                <Panel title={`${chart.y} by ${chart.x}`} sub={result.rows.length > 20 ? "First 20 rows." : undefined}>
                  <ResponsiveContainer width="100%" height={Math.max(220, chart.rows.length * 26)}>
                    <BarChart data={chart.rows} layout="vertical" margin={{ top: 0, right: 80, left: 0, bottom: 0 }}>
                      <XAxis type="number" hide {...axis} />
                      <YAxis type="category" dataKey="label" width={210} {...categoryAxis} interval={0} />
                      <Tooltip {...tooltip} formatter={(v: any) => [cell(v), chart.y]} />
                      <Bar dataKey="value" fill={C.cobalt} radius={[0, 3, 3, 0]} barSize={16}>
                        <LabelList dataKey="value" position="right" style={barLabel} formatter={(v: any) => cell(v)} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Panel>
              )}
              <Panel
                title="Results"
                sub={`${int(result.row_count)} rows, ${result.columns.length} columns${result.truncated ? ". Showing the first 500 rows." : "."}`}
              >
                <div className="tbl-wrap" style={{ maxHeight: 480 }}>
                  <table>
                    <thead><tr>{result.columns.map(c => <th key={c}>{c}</th>)}</tr></thead>
                    <tbody>
                      {result.rows.map((row, i) => (
                        <tr key={i}>{row.map((v, j) => <td key={j} className={typeof v === "number" ? "num" : ""}>{cell(v)}</td>)}</tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
            </>
          )}
        </div>
      </div>
    </>
  );
}
