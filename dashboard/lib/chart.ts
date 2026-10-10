// Chart theme. Recharts takes colors as props, so the palette from globals.css is
// mirrored here as literals. Keep the two in sync.

export const C = {
  ink: "#13223A",
  ink2: "#2F3C52",
  muted: "#5A6578",
  faint: "#8A93A3",
  line: "#D9DEE6",
  line2: "#E8EBF0",
  cobalt: "#1F49B6",
  cobaltSoft: "#A9BBEA",
  yellow: "#FFD84D",
  s1: "#B42318",
  s2: "#DC6B2F",
  s3: "#CA9A1C",
  s4: "#5E9A57",
  s5: "#1E7552",
};

/** Star rating 1..5 -> color */
export const STAR = [C.s1, C.s2, C.s3, C.s4, C.s5];

export const SENTIMENT: Record<string, string> = {
  Negative: C.s1,
  Neutral: C.s3,
  Positive: C.s5,
};

/** Map a 0-1 "badness" rate onto the star scale (high rate = red). */
export function rateColor(rate: number, low = 0.15, high = 0.35): string {
  const t = Math.min(1, Math.max(0, (rate - low) / (high - low)));
  return STAR[4 - Math.round(t * 4)];
}

export const axis = {
  tick: { fill: C.muted, fontSize: 12 },
  axisLine: { stroke: C.line },
  tickLine: false as const,
};

export const categoryAxis = {
  tick: { fill: C.ink2, fontSize: 12 },
  axisLine: false as const,
  tickLine: false as const,
};

export const grid = { stroke: C.line2, strokeDasharray: "0", vertical: false };

export const tooltip = {
  contentStyle: {
    background: "#FFFFFF",
    border: `1px solid ${C.line}`,
    borderRadius: 6,
    color: C.ink,
    fontSize: 13,
    boxShadow: "0 4px 14px rgba(19,34,58,0.08)",
  },
  labelStyle: { color: C.ink, fontWeight: 600, marginBottom: 2 },
  itemStyle: { color: C.ink2 },
  cursor: { fill: "rgba(31,73,182,0.06)" },
};

export const barLabel = { fill: C.ink2, fontSize: 12 };
