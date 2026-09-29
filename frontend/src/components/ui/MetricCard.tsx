"use client";

import { Card } from "./Card";
import { formatCurrency, formatNumber } from "@/lib/utils";

interface MetricCardProps {
  value: string | number;
  label: string;
  sublabel?: string;
  trend?: { value: number; label: string; positive?: boolean };
  formatter?: "currency" | "number" | "percent" | "none";
}

export function MetricCard({ value, label, sublabel, trend, formatter = "none" }: MetricCardProps) {
  const displayValue = typeof value === "number"
    ? formatter === "currency" ? formatCurrency(value)
    : formatter === "number" ? formatNumber(value)
    : formatter === "percent" ? `${value.toFixed(1)}%`
    : String(value)
    : value;

  return (
    <Card variant="metric" className="text-center">
      <div className="text-3xl font-extrabold bg-gradient-to-r from-[#00D4AA] to-[#7B61FF] bg-clip-text text-transparent">
        {displayValue}
      </div>
      <div className="text-xs text-[#8B8FA3] font-medium uppercase tracking-wider mt-2">
        {label}
      </div>
      {sublabel && (
        <div className="text-xs text-[#5A5F73] mt-1">{sublabel}</div>
      )}
      {trend && (
        <div className={`mt-2 text-xs font-medium ${trend.positive ? "text-[#00D4AA]" : "text-[#FF6B6B]"}`}>
          {trend.positive ? "▲" : "▼"} {trend.value.toFixed(1)}% {trend.label}
        </div>
      )}
    </Card>
  );
}