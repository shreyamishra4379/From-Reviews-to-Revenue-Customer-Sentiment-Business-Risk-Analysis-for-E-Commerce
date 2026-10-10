"use client";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ToolEvent {
  name: string;
  input: unknown;
  ok: boolean;
  summary: string;
  preview?: { columns: string[]; rows: unknown[][] };
}
interface Msg {
  role: "user" | "assistant";
  content: string;
  tools?: ToolEvent[];
  provider?: string;
  fallback?: boolean;
  error?: string;
  pending?: boolean;
}

const SUGGESTIONS = [
  "What are customers complaining about the most?",
  "How strongly is late delivery associated with review scores?",
  "Which categories should Olist fix first, and why?",
  "Which 5 states have the highest late-delivery rate?",
  "What does the scenario exposure model say at 5%?",
  "Explain how the sentiment analysis was done.",
];

const STORAGE_KEY = "ask-ai-chat";

// "avg_review_score" -> "Avg review score"
const prettyHeader = (c: string) => c.replace(/_/g, " ").replace(/^\w/, ch => ch.toUpperCase());

function prettyCell(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") {
    return Number.isInteger(v) ? v.toLocaleString("en-US") : v.toLocaleString("en-US", { maximumFractionDigits: 4 });
  }
  return String(v);
}

function ResultTable({ preview, total }: { preview: NonNullable<ToolEvent["preview"]>; total: string }) {
  if (preview.rows.length === 0) return <div className="chat-tool-empty">No rows returned.</div>;
  return (
    <div className="chat-result">
      <table>
        <thead><tr>{preview.columns.map(c => <th key={c}>{prettyHeader(c)}</th>)}</tr></thead>
        <tbody>
          {preview.rows.map((r, i) => (
            <tr key={i}>{r.map((v, j) => <td key={j} className={typeof v === "number" ? "num" : ""}>{prettyCell(v)}</td>)}</tr>
          ))}
        </tbody>
      </table>
      {total !== String(preview.rows.length) && (
        <div className="chat-tool-empty">Showing first {preview.rows.length} of {total} rows.</div>
      )}
    </div>
  );
}

function toolLabel(t: ToolEvent): string {
  if (t.name === "run_sql") return "Ran SQL";
  if (t.name === "get_project_results") {
    const s = (t.input as { section?: string })?.section;
    return `Read results${s ? `: ${s}` : ""}`;
  }
  return t.name;
}

export default function AskAIPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Restore the conversation for this browser (convenience only).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setMessages((JSON.parse(saved) as Msg[]).filter(m => !m.pending));
    } catch { /* storage unavailable */ }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.filter(m => !m.pending)));
    } catch { /* storage unavailable */ }
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const update = (fn: (m: Msg) => Msg) =>
    setMessages(prev => [...prev.slice(0, -1), fn(prev[prev.length - 1])]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    const history = [...messages.filter(m => m.content && !m.error), { role: "user" as const, content: question }];
    setMessages([...messages, { role: "user", content: question }, { role: "assistant", content: "", tools: [], pending: true }]);
    setInput("");
    setBusy(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history.map(({ role, content }) => ({ role, content })) }),
        signal: ctrl.signal,
      });
      if (!resp.ok || !resp.body) {
        const err = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
        update(m => ({ ...m, pending: false, error: err.error ?? `HTTP ${resp.status}` }));
        return;
      }
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const ev = JSON.parse(line);
          if (ev.type === "text") update(m => ({ ...m, content: m.content + ev.delta }));
          else if (ev.type === "tool") update(m => ({ ...m, tools: [...(m.tools ?? []), ev] }));
          else if (ev.type === "provider")
            update(m => ({ ...m, provider: `${ev.label} · ${ev.model}`, fallback: ev.fallback, tools: ev.fallback ? [] : m.tools }));
          else if (ev.type === "error") update(m => ({ ...m, error: ev.message }));
        }
      }
    } catch (e) {
      if (!ctrl.signal.aborted) update(m => ({ ...m, error: String(e) }));
    } finally {
      update(m => ({ ...m, pending: false, content: m.content.trim() }));
      setBusy(false);
      abortRef.current = null;
    }
  }

  return (
    <div className="chat-page">
      <div className="page-header">
        <h1 className="page-title">💬 Ask AI</h1>
        <p className="page-subtitle">
          Ask anything about the analysis. Answers are computed from the project&apos;s data with live SQL · Groq with Gemini fallback
        </p>
      </div>

      <div className="chat-scroll">
        {messages.length === 0 && (
          <div className="chat-empty">
            <p>Try one of these, or ask your own question:</p>
            <div className="chat-suggestions">
              {SUGGESTIONS.map(s => (
                <button key={s} className="chat-chip" onClick={() => send(s)}>{s}</button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`chat-msg ${m.role}`}>
            {m.role === "assistant" && (m.tools?.length ?? 0) > 0 && (
              <details className="chat-tools">
                <summary>{m.tools!.length} data lookup{m.tools!.length > 1 ? "s" : ""}</summary>
                {m.tools!.map((t, j) => (
                  <div key={j} className={`chat-tool ${t.ok ? "" : "failed"}`}>
                    <strong>{toolLabel(t)}</strong> — {t.summary}
                    {t.name === "run_sql" && (
                      <details className="chat-sql">
                        <summary>Show SQL</summary>
                        <pre>{String((t.input as { query?: string })?.query ?? "")}</pre>
                      </details>
                    )}
                    {t.preview && <ResultTable preview={t.preview} total={t.summary.replace(/ rows$/, "")} />}
                  </div>
                ))}
              </details>
            )}
            <div className="chat-bubble">
              {m.role === "assistant" ? (
                m.content
                  ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                  : m.pending && <span className="chat-typing">Thinking<span>.</span><span>.</span><span>.</span></span>
              ) : m.content}
              {m.error && <div className="chat-error">⚠️ {m.error}</div>}
            </div>
            {m.role === "assistant" && m.provider && !m.pending && (
              <div className="chat-meta">{m.fallback ? "Fallback · " : ""}{m.provider}</div>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <form className="chat-input" onSubmit={e => { e.preventDefault(); send(input); }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
          placeholder="Ask about complaints, delivery, categories, revenue exposure…"
          rows={2}
          disabled={busy}
        />
        <div className="chat-actions">
          {busy
            ? <button type="button" className="btn-secondary" onClick={() => abortRef.current?.abort()}>Stop</button>
            : messages.length > 0 && <button type="button" className="btn-secondary" onClick={() => setMessages([])}>New chat</button>}
          <button type="submit" className="btn-primary" disabled={busy || !input.trim()}>Send</button>
        </div>
      </form>
      <p className="chat-footnote">
        AI answers can be wrong — check the data lookups. Statistics are associations, not causes; exposure figures are scenario-based estimates.
      </p>
    </div>
  );
}
