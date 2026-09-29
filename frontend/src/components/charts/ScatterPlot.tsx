"use client";

import {
  ScatterChart as RechartsScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { cn } from "@/lib/utils";

interface ScatterData {
  [key: string]: any;
}

interface ScatterPlotProps {
  data: ScatterData[];
  xKey: string;
  yKey: string;
  sizeKey?: string;
  colorKey?: string;
  labelKey?: string;
  colorScale?: Record<string, string>;
  height?: number;
  showGrid?: boolean;
  showLegend?: boolean;
  showTooltip?: boolean;
  xAxisLabel?: string;
  yAxisLabel?: string;
  xDomain?: [number, number];
  yDomain?: [number, number];
}

export function ScatterPlot({
  data,
  xKey,
  yKey,
  sizeKey,
  colorKey,
  labelKey,
  colorScale = {},
  height = 500,
  showGrid = true,
  showLegend = true,
  showTooltip = true,
  xAxisLabel,
  yAxisLabel,
  xDomain,
  yDomain,
}: ScatterPlotProps) {
  const defaultColors = ["#FF6B6B", "#FF9F43", "#54A0FF", "#00D4AA"];

  const getColor = (d: ScatterData) => {
    if (colorKey && d[colorKey] && colorScale[d[colorKey] as string]) {
      return colorScale[d[colorKey] as string];
    }
    return d.color || defaultColors[0];
  };

  const getSize = (d: ScatterData) => {
    if (sizeKey && d[sizeKey]) {
      const sizes = data.map(item => item[sizeKey] as number).filter(v => !isNaN(v));
      const max = Math.max(...sizes);
      const min = Math.min(...sizes);
      const val = d[sizeKey] as number;
      return 8 + (val - min) / (max - min) * 27;
    }
    return 12;
  };

  const handleTooltipFormatter = (value: number | undefined, name: string) => {
    if (name === yKey) return [`${((value ?? 0) * 100).toFixed(1)}%`, name];
    if (name === xKey) return [`R$ ${(value ?? 0).toLocaleString()}`, name];
    return [(value ?? 0).toLocaleString(), name];
  };

  const handleLabelFormatter = (label: React.ReactNode) => 
    labelKey ? data.find(d => d[labelKey] === label)?.[labelKey] || String(label) : String(label);

  // Transform data for scatter - use numeric keys for Recharts
  const scatterData = data.map(d => ({
    x: d[xKey],
    y: d[yKey],
    size: getSize(d),
    fill: getColor(d),
    label: labelKey ? d[labelKey] : "",
  }));

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsScatterChart
          data={scatterData}
          margin={{ top: 20, right: showLegend ? 120 : 30, left: yAxisLabel ? 60 : 40, bottom: xAxisLabel ? 60 : 40 }}
        >
          {showGrid && (
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0a" />
          )}
          <XAxis
            type="number"
            dataKey="x"
            domain={xDomain}
            tick={{ fill: "#8B8FA3", fontSize: 11 }}
            axisLine={{ stroke: "#ffffff0a" }}
            tickLine={false}
            tickFormatter={(v) => v >= 1000000 ? `R$ ${(v/1000000).toFixed(1)}M` : v >= 1000 ? `R$ ${(v/1000).toFixed(0)}k` : `R$ ${v}`}
          />
          <YAxis
            type="number"
            dataKey="y"
            domain={yDomain}
            tick={{ fill: "#8B8FA3", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${((v ?? 0) * 100).toFixed(1)}%`}
          />
          {showTooltip && (
            <Tooltip
              contentStyle={{
                backgroundColor: "#1B1F2B",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: "8px",
                color: "#FAFAFA",
              }}
              labelStyle={{ color: "#8B8FA3" }}
              // @ts-ignore
              formatter={handleTooltipFormatter}
              // @ts-ignore
              labelFormatter={handleLabelFormatter}
            />
          )}
          {showLegend && colorKey && (
            <Legend
              wrapperStyle={{ paddingTop: 10 }}
              formatter={(value) => <span style={{ color: "#C8CCD8" }}>{value}</span>}
            />
          )}
          <Scatter
            name="Categories"
            data={scatterData}
            fill="#00D4AA"
            shape="circle"
          />
        </RechartsScatterChart>
      </ResponsiveContainer>
    </div>
  );
}