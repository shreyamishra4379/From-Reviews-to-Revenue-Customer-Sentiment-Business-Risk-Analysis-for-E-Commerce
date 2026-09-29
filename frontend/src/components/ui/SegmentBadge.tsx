"use client";

import { cn } from "@/lib/utils";
import { SEGMENT_COLORS } from "@/lib/utils";

interface SegmentBadgeProps {
  segment: string;
  count?: number;
  className?: string;
}

export function SegmentBadge({ segment, count, className }: SegmentBadgeProps) {
  const color = SEGMENT_COLORS[segment as keyof typeof SEGMENT_COLORS] || "#8B8FA3";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold",
        "bg-opacity-20",
        className
      )}
      style={{ backgroundColor: color, color }}
    >
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
      {segment}
      {count !== undefined && (
        <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-mono" style={{ backgroundColor: color, color: "#0E1117" }}>
          {count}
        </span>
      )}
    </span>
  );
}

export function SegmentLegend({ className }: { className?: string }) {
  const segments = [
    { key: "HIGH Risk + HIGH Exposure", label: "Immediate Action" },
    { key: "HIGH Risk + LOW Exposure", label: "Monitor Closely" },
    { key: "LOW Risk + HIGH Exposure", label: "Protect & Maintain" },
    { key: "LOW Risk + LOW Exposure", label: "Low Priority" },
  ];

  return (
    <div className={cn("flex flex-wrap gap-3 text-sm", className)}>
      {segments.map(({ key, label }) => {
        const color = SEGMENT_COLORS[key as keyof typeof SEGMENT_COLORS];
        return (
          <span
            key={key}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full"
            style={{ backgroundColor: `${color}20`, color }}
          >
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
            <span className="font-medium">{label}</span>
          </span>
        );
      })}
    </div>
  );
}