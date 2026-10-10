import { readFileSync } from "fs";
import { join } from "path";
import { runSql } from "@/lib/sql";
import type { ToolSpec } from "./providers";

// Tools the assistant can call. Every number it reports should come from one of these.

const DATA = join(process.cwd(), "public", "data");
const MAX_SQL_ROWS_FOR_MODEL = 50;
const MAX_TOOL_CHARS = 12_000;

const SECTIONS = [
  "overview", "nlp_insights", "statistical_analysis", "delivery",
  "business_impact", "categories",
] as const;
type Section = (typeof SECTIONS)[number];

export const TOOL_SPECS: ToolSpec[] = [
  {
    type: "function",
    function: {
      name: "get_project_results",
      description:
        "Return the saved, validated results of the analysis for one section. Use this first for " +
        "headline numbers: overview (KPIs, correlations), nlp_insights (sentiment, agreement, aspects, " +
        "topics), statistical_analysis (Spearman, Mann-Whitney, Kruskal-Wallis, logistic regression), " +
        "delivery (late rates by state/category, aspects in late vs on-time complaints, monthly trend), " +
        "business_impact (scenario exposure sensitivity table, 2x2 prioritization), categories " +
        "(per-category metrics for categories with >= 100 reviews).",
      parameters: {
        type: "object",
        properties: { section: { type: "string", enum: [...SECTIONS] } },
        required: ["section"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_sql",
      description:
        "Run one read-only DuckDB SELECT over the project tables (schema in the system prompt) and " +
        `return up to ${MAX_SQL_ROWS_FOR_MODEL} rows. Use for anything the saved results do not cover. ` +
        "Always aggregate in SQL instead of fetching raw rows.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "A single SELECT or WITH statement" } },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
];

function readJson(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(DATA, `${name}.json`), "utf-8"));
}

function sectionData(section: Section): unknown {
  if (section !== "categories") return readJson(section);
  // Full file is ~30 KB; send only categories above the sample-size threshold.
  const d = readJson("category_intelligence") as {
    low_n_threshold: number;
    categories: { low_n: boolean; [k: string]: unknown }[];
  };
  return {
    low_n_threshold: d.low_n_threshold,
    note: `Only categories with >= ${d.low_n_threshold} text reviews. Rates are 0-1 fractions.`,
    categories: d.categories.filter(c => !c.low_n).map(({ low_n: _l, confidence: _c, ...rest }) => rest),
  };
}

function clip(text: string): string {
  return text.length > MAX_TOOL_CHARS
    ? `${text.slice(0, MAX_TOOL_CHARS)}\n...[truncated - narrow the request]`
    : text;
}

export interface ToolOutcome {
  ok: boolean;
  output: string;     // sent back to the model
  summary: string;    // shown in the UI
}

export function executeTool(name: string, rawArgs: string): ToolOutcome {
  let args: Record<string, unknown>;
  try {
    args = rawArgs ? JSON.parse(rawArgs) : {};
  } catch {
    return { ok: false, output: "Error: tool arguments were not valid JSON.", summary: "invalid arguments" };
  }

  try {
    if (name === "get_project_results") {
      const section = args.section as Section;
      if (!SECTIONS.includes(section)) throw new Error(`Unknown section "${String(args.section)}"`);
      return { ok: true, output: clip(JSON.stringify(sectionData(section))), summary: `results: ${section}` };
    }
    if (name === "run_sql") {
      const query = String(args.query ?? "").trim();
      if (!query) throw new Error("Empty query");
      const r = runSql(query, MAX_SQL_ROWS_FOR_MODEL);
      const out = { columns: r.columns, rows: r.rows, rows_returned: r.row_count, truncated: r.truncated };
      return { ok: true, output: clip(JSON.stringify(out)), summary: `${r.row_count}${r.truncated ? "+" : ""} rows` };
    }
    throw new Error(`Unknown tool "${name}"`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, output: `Error: ${msg}`, summary: msg.slice(0, 160) };
  }
}

let schemaCache: string | null = null;

/** Table/column list for the system prompt, read live from DuckDB once per server process. */
export function schemaText(): string {
  if (schemaCache) return schemaCache;
  const r = runSql(
    "SELECT table_name, string_agg(column_name || ' ' || data_type, ', ' ORDER BY ordinal_position) " +
    "FROM information_schema.columns GROUP BY 1 ORDER BY 1",
    100,
  );
  schemaCache = r.rows.map(([t, cols]) => `- ${t}(${cols})`).join("\n");
  return schemaCache;
}
