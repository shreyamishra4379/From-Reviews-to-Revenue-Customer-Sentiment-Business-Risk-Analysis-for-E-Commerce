# Dashboard

Next.js 15 + React 19 + Recharts app for the project: nine pages, the API routes behind them, an in-process DuckDB engine and the Ask AI assistant. It displays precomputed results only; no metric is calculated in JavaScript.

## Data flow

```
data/processed/ (Parquet, CSV, JSON)
   └─ python src/export_dashboard_data.py → dashboard/public/data/*.json (reconciled against the Parquet sources)
         └─ app/api/*/route.ts             → serve the JSON to the pages
sql/*.sql + sql/views.json
   └─ lib/sql.ts                           → DuckDB inside the server, read-only, sandboxed to data/processed/
```

## Run

From the project root, `python run.py` does everything. To run only the dashboard:

```bash
cd dashboard
npm install
npm run dev      # development, http://localhost:3000
npm run build && npm start   # production
```

## Layout

| Path | Contents |
|---|---|
| `app/` | Pages (Overview, Customer voice, Delivery, Categories, Business impact, Statistics, SQL workbench, Security, Ask AI) and `api/` routes |
| `app/components/` | Sidebar, theme switch, shared UI (panels, stats, notes, loading states) |
| `lib/sql.ts` | DuckDB connection, table views from `sql/views.json`, read-only validator |
| `lib/chart.ts`, `lib/format.ts` | Chart theme (CSS variables, light/dark) and number formatting |
| `lib/ai/` | Ask AI: Groq/Gemini providers, tools, system prompt |
| `lib/security/` | Rate limits, event log, prompt-injection detection, integrity check |

## Ask AI

Copy `.env.example` to `.env.local` and add `GROQ_API_KEY` (primary) and/or `GEMINI_API_KEY` (fallback). `.env.local` is gitignored and the keys never reach the browser.
