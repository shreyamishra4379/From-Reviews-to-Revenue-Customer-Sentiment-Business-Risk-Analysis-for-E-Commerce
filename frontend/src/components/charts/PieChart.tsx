"use client";

import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { cn } from "@/lib/utils";

interface PieChartData {
  name: string;
  value: number;
  color?: string;
}

interface PieChartProps {
  data: PieChartData[];
  height?: number;
  innerRadius?: number;
  outerRadius?: number;
  showLegend?: boolean;
  showTooltip?: boolean;
}

export function PieChart({
  data,
  height = 350,
  innerRadius = 60,
  outerRadius = 100,
  showLegend = false,
  showTooltip = true,
}: PieChartProps) {
  const defaultColors = ["#00D4AA", "#FF6B6B", "#FFD93D", "#7B61FF", "#54A0FF"];
  
  const coloredData = data.map((d, i) => ({
    ...d,
    color: d.color || defaultColors[i % defaultColors.length],
  }));

  const handleTooltipFormatter = (value: number | undefined) => [
    value !== undefined ? value.toLocaleString() : "",
    "",
  ];

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsPieChart>
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
              wrapperStyle={{ paddingTop: 20 }}
              formatter={(value) => <span style={{ color: "#C8CCD8" }}>{value}</span>}
            />
          )}
          <Pie
            data={coloredData}
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={2}
            dataKey="value"
            nameKey="name"
            label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(1)}%`}
            labelLine={false}
          >
            {coloredData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
        </RechartsPieChart>
      </ResponsiveContainer>
    </div>
  );
}