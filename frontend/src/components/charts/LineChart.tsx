"use client";

import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Area,
} from "recharts";
import { cn } from "@/lib/utils";

interface LineChartData {
  [key: string]: any;
}

interface LineChartProps {
  data: LineChartData[];
  xKey: string;
  lines: Array<{
    key: string;
    label: string;
    color: string;
    type?: "line" | "area";
    strokeWidth?: number;
    dot?: boolean;
    yAxisId?: "left" | "right";
  }>;
  height?: number;
  showGrid?: boolean;
  showLegend?: boolean;
  showTooltip?: boolean;
  yAxisLeftLabel?: string;
  yAxisRightLabel?: string;
  xAxisLabel?: string;
  formatYValue?: (value: number) => string;
}

export function LineChart({
  data,
  xKey,
  lines,
  height = 400,
  showGrid = true,
  showLegend = true,
  showTooltip = true,
  yAxisLeftLabel,
  yAxisRightLabel,
  xAxisLabel,
  formatYValue,
}: LineChartProps) {
  const handleTooltipFormatter = (value: number | undefined, name: string) => {
    const line = lines.find(l => l.label === name);
    return [
      formatYValue && value !== undefined ? formatYValue(value) : value?.toLocaleString() ?? "",
      line?.label || name,
    ];
  };

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsLineChart
          data={data}
          margin={{ top: 20, right: 30, left: yAxisLeftLabel ? 60 : 40, bottom: xAxisLabel ? 60 : 40 }}
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
          {yAxisLeftLabel && (
            <YAxis
              yAxisId="left"
              tick={{ fill: "#8B8FA3", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={formatYValue || ((v) => v.toLocaleString())}
            >
              <text
                x={-40}
                y={0}
                fill="#8B8FA3"
                fontSize={11}
                textAnchor="middle"
                transform="rotate(-90)"
              >
                {yAxisLeftLabel}
              </text>
            </YAxis>
          )}
          {yAxisRightLabel && (
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fill: "#8B8FA3", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={formatYValue || ((v) => v.toLocaleString())}
            >
              <text
                x={40}
                y={0}
                fill="#8B8FA3"
                fontSize={11}
                textAnchor="middle"
                transform="rotate(90)"
              >
                {yAxisRightLabel}
              </text>
            </YAxis>
          )}
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
          {showLegend && (
            <Legend
              wrapperStyle={{ paddingTop: 10 }}
              formatter={(value) => <span style={{ color: "#C8CCD8" }}>{value}</span>}
            />
          )}
          {lines.map((line, index) => {
            if (line.type === "area") {
              return (
                <Area
                  key={line.key}
                  type="monotone"
                  dataKey={line.key}
                  stroke={line.color}
                  fill={line.color}
                  fillOpacity={0.1}
                  strokeWidth={line.strokeWidth || 2}
                  dot={line.dot}
                  yAxisId={line.yAxisId || "left"}
                />
              );
            }
            return (
              <Line
                key={line.key}
                type="monotone"
                dataKey={line.key}
                stroke={line.color}
                strokeWidth={line.strokeWidth || 2}
                dot={line.dot}
                yAxisId={line.yAxisId || "left"}
              />
            );
          })}
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  );
}