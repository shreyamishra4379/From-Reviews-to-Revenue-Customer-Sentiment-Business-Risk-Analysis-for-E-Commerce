"use client";
import { useEffect, useState, type ReactNode } from "react";
import { Info, TriangleAlert } from "lucide-react";

/** Fetch JSON from one of the dashboard API routes. */
export function useData<T>(url: string): { data: T | null; error: string | null } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(url)
      .then(async r => {
        if (!r.ok) throw new Error(`The data service returned ${r.status}. Re-run "python run.py" to rebuild the dashboard data.`);
        return r.json();
      })
      .then(d => alive && setData(d))
      .catch(e => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => { alive = false; };
  }, [url]);
  return { data, error };
}

export function Loading({ label = "Loading data" }: { label?: string }) {
  return <div className="state" role="status"><div className="spinner" />{label}</div>;
}

export function ErrorState({ message }: { message: string }) {
  return <div className="state error" role="alert"><TriangleAlert size={18} />{message}</div>;
}

export function PageHeader({ name, icon, finding, lede }: {
  name: string;
  icon?: ReactNode;
  finding: ReactNode;
  lede?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div className="page-name">{icon}{name}</div>
      <h1 className="page-finding">{finding}</h1>
      {lede && <p className="page-lede">{lede}</p>}
    </header>
  );
}

export function Panel({ title, sub, action, foot, children, className = "" }: {
  title?: ReactNode;
  sub?: ReactNode;
  action?: ReactNode;
  foot?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      {(title || action) && (
        <div className="panel-head">
          <div>
            {title && <h2 className="panel-title">{title}</h2>}
            {sub && <p className="panel-sub">{sub}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
      {foot && <p className="panel-foot">{foot}</p>}
    </section>
  );
}

export function Stats({ items }: {
  items: { value: ReactNode; label: ReactNode; detail?: ReactNode; tone?: "neg" | "pos" | "neu" }[];
}) {
  return (
    <div className="stats">
      {items.map((s, i) => (
        <div className="stat" key={i}>
          <div className={`stat-value ${s.tone ? `tone-${s.tone}` : ""}`}>{s.value}</div>
          <div className="stat-label">{s.label}</div>
          {s.detail && <div className="stat-detail">{s.detail}</div>}
        </div>
      ))}
    </div>
  );
}

export function Note({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "caution" }) {
  return (
    <div className={`note ${tone === "caution" ? "caution" : ""}`}>
      {tone === "caution" ? <TriangleAlert size={16} /> : <Info size={16} />}
      <div>{children}</div>
    </div>
  );
}

export function Segmented<T extends string>({ options, value, onChange, labelFor }: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  labelFor?: (v: T) => ReactNode;
}) {
  return (
    <div className="segmented" role="group">
      {options.map(o => (
        <button key={o} type="button" aria-pressed={o === value} onClick={() => onChange(o)}>
          {labelFor ? labelFor(o) : o}
        </button>
      ))}
    </div>
  );
}

/** Stacked 100% bar for negative / neutral / positive counts. */
export function SentimentMix({ neg, neu, pos }: { neg: number; neu: number; pos: number }) {
  const t = neg + neu + pos || 1;
  const w = (n: number) => `${(n / t) * 100}%`;
  return (
    <div className="mix" role="img" aria-label={`${Math.round(neg / t * 100)}% negative, ${Math.round(neu / t * 100)}% neutral, ${Math.round(pos / t * 100)}% positive`}>
      <span style={{ width: w(neg), background: "var(--neg)" }} />
      <span style={{ width: w(neu), background: "var(--neu)" }} />
      <span style={{ width: w(pos), background: "var(--pos)" }} />
    </div>
  );
}

export function SentimentLegend() {
  return (
    <div className="legend">
      <span><i style={{ background: "var(--neg)" }} />Negative</span>
      <span><i style={{ background: "var(--neu)" }} />Neutral</span>
      <span><i style={{ background: "var(--pos)" }} />Positive</span>
    </div>
  );
}

export function LowN() {
  return <span className="tag low-n" title="Too few reviews for a reliable rate">Low N</span>;
}
