"use client";

import { cn } from "@/lib/utils";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";

interface Column<T> {
  key: string;
  header: string;
  width?: string;
  align?: "left" | "center" | "right";
  format?: (value: any, row: T) => string;
  render?: (value: any, row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (row: T) => string;
  className?: string;
  striped?: boolean;
  hoverable?: boolean;
  emptyMessage?: string;
}

export function DataTable<T>({
  data,
  columns,
  keyExtractor,
  className,
  striped = true,
  hoverable = true,
  emptyMessage = "No data available",
}: DataTableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-[#8B8FA3]">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={cn("overflow-x-auto rounded-lg border border-white/5", className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-white/5 border-b border-white/5">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  "px-4 py-3 text-left font-medium text-[#8B8FA3] uppercase tracking-wider text-xs",
                  col.align === "center" && "text-center",
                  col.align === "right" && "text-right"
                )}
                style={{ width: col.width }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIdx) => (
            <tr
              key={keyExtractor(row)}
              className={cn(
                "border-b border-white/5 transition-colors",
                striped && rowIdx % 2 === 1 && "bg-white/5",
                hoverable && "hover:bg-white/10"
              )}
            >
              {columns.map((col) => {
                const value = row[col.key as keyof T];
                return (
                  <td
                    key={col.key}
                    className={cn(
                      "px-4 py-3 text-[#C8CCD8]",
                      col.align === "center" && "text-center",
                      col.align === "right" && "text-right"
                    )}
                  >
                    {col.render
                      ? col.render(value, row)
                      : col.format
                      ? col.format(value, row)
                      : String(value ?? "—")}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Helper formatters - handle string values from CSV
const toNum = (value: any): number => {
  const n = typeof value === "string" ? parseFloat(value) : Number(value);
  return isNaN(n) ? 0 : n;
};

export const formatters = {
  currency: (value: any) => formatCurrency(toNum(value)),
  number: (value: any) => formatNumber(toNum(value)),
  percent: (value: any) => formatPercent(toNum(value)),
  percent0: (value: any) => `${toNum(value).toFixed(0)}%`,
  score: (value: any) => toNum(value).toFixed(2),
  rate: (value: any) => `${(toNum(value) * 100).toFixed(1)}%`,
};