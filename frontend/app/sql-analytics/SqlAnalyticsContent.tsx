"use client";

import { useEffect, useState } from "react";
import { SectionHeader, InsightBox } from "@/components/ui/InsightBox";
import { DataTable, formatters } from "@/components/ui/DataTable";
import { getSqlQueries, executeSqlQuery } from "@/lib/api";

interface SqlQuery {
  filename: string;
  content: string;
}

export function SqlAnalyticsContent() {
  const [queries, setQueries] = useState<SqlQuery[]>([]);
  const [selectedQuery, setSelectedQuery] = useState<string>("");
  const [queryContent, setQueryContent] = useState<string>("");
  const [results, setResults] = useState<any[]>([]);
  const [rowCount, setRowCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadQueries() {
      try {
        const q = await getSqlQueries();
        setQueries(q || []);
        if (q && q.length > 0) {
          setSelectedQuery(q[0].filename);
          setQueryContent(q[0].content);
        }
      } catch (error) {
        console.error("Failed to load SQL queries:", error);
      } finally {
        setLoading(false);
      }
    }
    loadQueries();
  }, []);

  useEffect(() => {
    const q = queries.find(q => q.filename === selectedQuery);
    if (q) setQueryContent(q.content);
  }, [selectedQuery, queries]);

  const handleExecute = async () => {
    if (!queryContent.trim()) return;
    setExecuting(true);
    setError(null);
    try {
      const res = await executeSqlQuery(queryContent);
      if (res.error) {
        setError(res.error);
        setResults([]);
        setRowCount(0);
      } else {
        setResults(res.data || []);
        setRowCount(res.rowCount || 0);
      }
    } catch (err) {
      setError(String(err));
      setResults([]);
      setRowCount(0);
    } finally {
      setExecuting(false);
    }
  };

  if (loading) return null;

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">🗄️ SQL Analytics</h1>

      <InsightBox>
        11 validated SQL queries run against the Parquet data warehouse via DuckDB.
        All queries returned real results and can be connected to any BI tool.
      </InsightBox>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Query Selector */}
        <div className="lg:col-span-1 bg-[#1B1F2B] border border-white/5 rounded-xl p-6">
          <SectionHeader>Select Query</SectionHeader>
          <select
            value={selectedQuery}
            onChange={(e) => setSelectedQuery(e.target.value)}
            className="w-full bg-[#0E1117] border border-white/10 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#00D4AA]"
          >
            {queries.map(q => (
              <option key={q.filename} value={q.filename}>
                {q.filename}
              </option>
            ))}
          </select>
        </div>

        {/* Query Editor */}
        <div className="lg:col-span-2 bg-[#1B1F2B] border border-white/5 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <SectionHeader>Query Editor</SectionHeader>
            <button
              onClick={handleExecute}
              disabled={executing}
              className="px-4 py-2 bg-gradient-to-r from-[#00D4AA] to-[#7B61FF] text-[#0E1117] font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 transition-all"
            >
              {executing ? "Executing..." : "Execute Query"}
            </button>
          </div>
          <textarea
            value={queryContent}
            onChange={(e) => setQueryContent(e.target.value)}
            className="w-full h-48 bg-[#0E1117] border border-white/10 rounded-lg px-4 py-3 text-white text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-[#00D4AA]"
            spellCheck={false}
            placeholder="Select a query or write your own..."
          />
          {error && (
            <div className="mt-3 p-3 bg-[#FF6B6B]/20 border border-[#FF6B6B]/30 rounded-lg text-[#FF6B6B] text-sm">
              Error: {error}
            </div>
          )}
        </div>

        {/* Results */}
        <div className="lg:col-span-3 bg-[#1B1F2B] border border-white/5 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <SectionHeader>Results</SectionHeader>
            <span className="text-sm text-[#8B8FA3]">{rowCount.toLocaleString()} rows</span>
          </div>
          {results.length > 0 ? (
            <DataTable
              data={results.slice(0, 100)}
              columns={Object.keys(results[0]).map(key => ({
                key,
                header: key,
                align: "left" as const,
              }))}
              keyExtractor={(row) => String(row)}
            />
          ) : (
            <div className="text-center py-12 text-[#8B8FA3]">
              {executing ? "Executing query..." : "Select a query and click Execute to see results"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}