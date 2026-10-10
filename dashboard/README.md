# Dashboard

Next.js 15 + React 19 + Recharts front end for the project. It displays precomputed results only; no metric is calculated in JavaScript.

## Data flow

```
data/processed/ (Parquet, CSV, JSON)
   └─ python export_dashboard_data.py   → dashboard/public/data/*.json (reconciled against the Parquet sources)
         └─ app/api/*/route.ts          → serve the JSON to the pages
sql/*.sql
   └─ app/api/sql/execute/route.ts      → Python + DuckDB, read-only, sandboxed to data/processed/
```

## Run

From the project root, refresh the JSON first, then start the app:

```bash
python export_dashboard_data.py
cd dashboard
npm install
npm run dev      # http://localhost:3000
```

`npm run build && npm start` runs the production build. The SQL Analytics page needs Python with `duckdb` on the PATH, because it calls `src/analytics/validate_sql.py`.

## Pages

Overview · NLP Insights · Statistical Analysis · Delivery Analysis · Business Impact · Category Deep Dive · SQL Analytics · Ask AI

## Ask AI

Copy `.env.example` to `.env.local` and add `GROQ_API_KEY` (primary) and/or `GEMINI_API_KEY` (fallback). The chat route is `app/api/chat/route.ts`; providers, tools and the system prompt are in `lib/ai/`.
