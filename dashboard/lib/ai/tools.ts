import { readFileSync } from "fs";
import { join } from "path";
import { runSql } from "@/lib/sql";
import type { ToolSpec } from "./providers";

// Tools the assistant can call. Every number it reports should come from one of these.

const DATA = join(process.cwd(), "public", "data");
// Kept small: Groq free tier allows ~8K tokens per minute across all requests.
const MAX_SQL_ROWS_FOR_MODEL = 25;
const MAX_TOOL_CHARS = 9_000;

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

type AspectRow = { aspect: string; total_mentions: number; negative: number; neg_pct: number };

function sectionData(section: Section): unknown {
  if (section === "nlp_insights") {
    // Give the model explicit rankings so it never has to compare numbers itself
    // (the stored list is ordered by negative *rate*, which is easy to misread as volume).
    const d = readJson("nlp_insights") as { aspects: AspectRow[]; [k: string]: unknown };
    const real = d.aspects.filter(a => a.aspect !== "Uncategorized");
    const negTotal = real.reduce((s, a) => s + a.negative, 0);
    return {
      ...d,
      aspects_ranked_by_negative_mentions: [...real]
        .sort((a, b) => b.negative - a.negative)
        .map((a, i) => ({
          rank: i + 1, aspect: a.aspect, negative_mentions: a.negative,
          share_of_negative_aspect_mentions_pct: +(a.negative / negTotal * 100).toFixed(1),
        })),
      aspects_ranked_by_negative_rate: [...real]
        .sort((a, b) => b.neg_pct - a.neg_pct)
        .map((a, i) => ({ rank: i + 1, aspect: a.aspect, neg_pct: a.neg_pct, total_mentions: a.total_mentions })),
      note: "Aspect mentions overlap (one review can mention several). 'Uncategorized' is excluded from the rankings.",
    };
  }
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
  preview?: { columns: string[]; rows: unknown[][] };  // first rows of a SQL result, for the UI
}

const PREVIEW_ROWS = 10;

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
      return {
        ok: true,
        output: clip(JSON.stringify(out)),
        summary: `${r.row_count}${r.truncated ? "+" : ""} rows`,
        preview: { columns: r.columns, rows: r.rows.slice(0, PREVIEW_ROWS) },
      };
    }
    throw new Error(`Unknown tool "${name}"`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, output: `Error: ${msg}`, summary: msg.slice(0, 160) };
  }
}

let factsCache: string | null = null;

/** Headline row counts, computed live so the model never confuses e.g. reviews with customers. */
export function datasetFacts(): string {
  if (factsCache) return factsCache;
  const r = runSql(
    "SELECT (SELECT COUNT(*) FROM fact_orders), " +
    "(SELECT COUNT(DISTINCT customer_unique_id) FROM dim_customers), " +
    "(SELECT COUNT(*) FROM fact_order_items), " +
    "(SELECT COUNT(*) FROM fact_order_reviews), " +
    "(SELECT COUNT(*) FROM nlp_reviews), " +
    "(SELECT COUNT(*) FROM dim_products), " +
    "(SELECT COUNT(*) FROM dim_sellers), " +
    "(SELECT COUNT(*) FROM fact_orders WHERE order_delivered_customer_date IS NOT NULL)",
    1,
  );
  const [orders, customers, items, reviews, textReviews, products, sellers, delivered] =
    (r.rows[0] as number[]).map(n => n.toLocaleString("en-US"));
  factsCache = [
    `- Orders: ${orders} (one customer_id per order, so dim_customers also has ${orders} rows)`,
    `- Unique customers (customer_unique_id): ${customers}`,
    `- Order items: ${items}; products: ${products}; sellers: ${sellers}`,
    `- Reviews: ${reviews}; reviews with text (nlp_reviews): ${textReviews}`,
    `- Orders with a delivery date: ${delivered}`,
  ].join("\n");
  return factsCache;
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
