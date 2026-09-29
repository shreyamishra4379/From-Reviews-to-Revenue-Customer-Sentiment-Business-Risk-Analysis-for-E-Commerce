"use client";

import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { cn } from "@/lib/utils";

interface BarChartData {
  [key: string]: any;
}

interface BarChartProps {
  data: BarChartData[];
  xKey: string;
  yKey: string;
  colorKey?: string;
  colors?: string[];
  height?: number;
  showGrid?: boolean;
  showTooltip?: boolean;
  yAxisLabel?: string;
  xAxisLabel?: string;
  formatYValue?: (value: number) => string;
  onClick?: (data: BarChartData) => void;
}

export function BarChart({
  data,
  xKey,
  yKey,
  colorKey,
  colors = ["#00D4AA", "#7B61FF", "#FF6B6B", "#FFD93D", "#54A0FF"],
  height = 350,
  showGrid = true,
  showTooltip = true,
  yAxisLabel,
  xAxisLabel,
  formatYValue,
  onClick,
}: BarChartProps) {
  const getColor = (index: number) => {
    if (colorKey && data[index]) {
      const val = data[index][colorKey];
      if (typeof val === "number") {
        const max = Math.max(...data.map(d => d[colorKey] as number));
        const min = Math.min(...data.map(d => d[colorKey] as number));
        const ratio = (val - min) / (max - min);
        if (ratio < 0.33) return "#00D4AA";
        if (ratio < 0.66) return "#FFD93D";
        return "#FF6B6B";
      }
    }
    return colors[index % colors.length];
  };

  const handleTooltipFormatter = (value: number | undefined) => [
    formatYValue && value !== undefined ? formatYValue(value) : value?.toLocaleString() ?? "",
    yKey,
  ];

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart
          data={data}
          margin={{ top: 20, right: 30, left: 20, bottom: xAxisLabel ? 60 : 40 }}
          onClick={onClick ? (_event: any, payload: any) => onClick(payload?.payload || {}) : undefined}
        >
          {showGrid && (
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0a" vertical={false} />
          )}
          <XAxis
            dataKey={xKey}
            tick={{ fill: "#8B8FA3", fontSize: 11 }}
            axisLine={{ stroke: "#ffffff0a" }}
            tickLine={false}
            interval={0}
          />
          <YAxis
            tick={{ fill: "#8B8FA3", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={formatYValue || ((v) => v.toLocaleString())}
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
            />
          )}
          <Bar
            dataKey={yKey}
            radius={[6, 6, 0, 0]}
            maxBarSize={50}
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={getColor(index)} />
            ))}
          </Bar>
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}

interface HorizontalBarChartProps {
  data: BarChartData[];
  labelKey: string;
  valueKey: string;
  colors?: string[];
  height?: number;
  showGrid?: boolean;
  showTooltip?: boolean;
  xAxisLabel?: string;
  formatXValue?: (value: number) => string;
}

export function HorizontalBarChart({
  data,
  labelKey,
  valueKey,
  colors = ["#00D4AA", "#7B61FF", "#FF6B6B", "#FFD93D", "#54A0FF"],
  height = 400,
  showGrid = true,
  showTooltip = true,
  xAxisLabel,
  formatXValue,
}: HorizontalBarChartProps) {
  const getColor = (index: number) => {
    const val = data[index][valueKey];
    if (typeof val === "number") {
      const max = Math.max(...data.map(d => d[valueKey] as number));
      const min = Math.min(...data.map(d => d[valueKey] as number));
      const ratio = (val - min) / (max - min);
      if (ratio < 0.33) return "#00D4AA";
      if (ratio < 0.66) return "#FFD93D";
      return "#FF6B6B";
    }
    return colors[index % colors.length];
  };

  const handleTooltipFormatter = (value: number | undefined) => [
    formatXValue && value !== undefined ? formatXValue(value) : value?.toLocaleString() ?? "",
    valueKey,
  ];

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart
          data={data}
          layout="vertical"
          margin={{ top: 20, right: 30, left: 120, bottom: 40 }}
        >
          {showGrid && (
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0a" horizontal={false} />
          )}
          <XAxis
            type="number"
            tick={{ fill: "#8B8FA3", fontSize: 11 }}
            axisLine={{ stroke: "#ffffff0a" }}
            tickLine={false}
            tickFormatter={formatXValue || ((v) => v.toLocaleString())}
          />
          <YAxis
            dataKey={labelKey}
            type="category"
            tick={{ fill: "#8B8FA3", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={120}
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
            />
          )}
          <Bar
            dataKey={valueKey}
            radius={[0, 6, 6, 0]}
            maxBarSize={40}
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={getColor(index)} />
            ))}
          </Bar>
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}