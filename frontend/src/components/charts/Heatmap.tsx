"use client";

import { cn } from "@/lib/utils";

interface HeatmapData {
  row: string;
  col: string;
  value: number;
}

interface HeatmapProps {
  data: HeatmapData[];
  rows: string[];
  cols: string[];
  height?: number;
  colorScale?: string[];
  showValues?: boolean;
  formatValue?: (value: number) => string;
}

export function Heatmap({
  data,
  rows,
  cols,
  height = 600,
  colorScale = ["#0E1117", "#1B4332", "#FFD93D", "#FF6B6B"],
  showValues = true,
  formatValue = (v) => `${(v * 100).toFixed(1)}%`,
}: HeatmapProps) {
  const cellWidth = 100;
  const cellHeight = 30;
  const width = cols.length * cellWidth + 150;

  // Create a map for quick lookup
  const dataMap = new Map<string, number>();
  data.forEach(d => {
    dataMap.set(`${d.row}|${d.col}`, d.value);
  });

  // Find min/max for color scaling
  const values = data.map(d => d.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);

  const getColor = (value: number) => {
    if (value === 0) return colorScale[0];
    const ratio = (value - minVal) / (maxVal - minVal) || 0;
    const idx = ratio * (colorScale.length - 1);
    const idx0 = Math.floor(idx);
    const idx1 = Math.min(idx0 + 1, colorScale.length - 1);
    const t = idx - idx0;
    
    // Simple interpolation
    const c0 = hexToRgb(colorScale[idx0]);
    const c1 = hexToRgb(colorScale[idx1]);
    if (!c0 || !c1) return colorScale[idx0];
    
    const r = Math.round(c0.r + (c1.r - c0.r) * t);
    const g = Math.round(c0.g + (c1.g - c0.g) * t);
    const b = Math.round(c0.b + (c1.b - c0.b) * t);
    return `rgb(${r},${g},${b})`;
  };

  const getTextColor = (bgColor: string) => {
    const rgb = hexToRgb(bgColor);
    if (!rgb) return "#FAFAFA";
    const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
    return luminance > 0.5 ? "#0E1117" : "#FAFAFA";
  };

  return (
    <div className="overflow-x-auto">
      <div style={{ width, height }} className="relative">
        {/* Column headers */}
        <div className="absolute top-0 left-0 flex" style={{ left: 150 }}>
          {cols.map((col, i) => (
            <div
              key={col}
              className="px-2 py-1 text-xs font-medium text-[#8B8FA3] text-center whitespace-nowrap"
              style={{ width: cellWidth, transform: "rotate(-45deg)", transformOrigin: "left top" }}
            >
              {col}
            </div>
          ))}
        </div>

        {/* Row headers & cells */}
        <div className="absolute top-20 left-0">
          {rows.map((row, rowIdx) => (
            <div key={row} className="flex items-center" style={{ height: cellHeight }}>
              <div className="w-36 pr-2 text-right text-xs text-[#C8CCD8] truncate" title={row}>
                {row}
              </div>
              <div className="flex" style={{ left: 150 }}>
                {cols.map((col, colIdx) => {
                  const value = dataMap.get(`${row}|${col}`) || 0;
                  const bgColor = getColor(value);
                  const textColor = getTextColor(bgColor);
                  return (
                    <div
                      key={col}
                      className="flex items-center justify-center text-xs font-medium"
                      style={{
                        width: cellWidth,
                        height: cellHeight,
                        backgroundColor: bgColor,
                        color: textColor,
                        border: "1px solid rgba(255,255,255,0.05)",
                      }}
                    >
                      {showValues && value > 0 && formatValue(value)}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Color legend */}
        <div className="absolute bottom-0 left-0 flex items-center gap-2 px-4 py-2 text-xs text-[#8B8FA3]" style={{ left: 150 }}>
          <span>Low</span>
          <div className="flex" style={{ width: 120 }}>
            {colorScale.map((color, i) => (
              <div
                key={i}
                className="h-3"
                style={{
                  flex: 1,
                  background: `linear-gradient(90deg, ${color} 0%, ${colorScale[Math.min(i + 1, colorScale.length - 1)]} 100%)`,
                }}
              />
            ))}
          </div>
          <span>High</span>
        </div>
      </div>
    </div>
  );
}

function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}