// Chart theme. Colors are CSS variables from globals.css (browsers resolve var()
// in SVG presentation attributes), so every chart follows the light/dark theme.
// Don't build colors by string concatenation (e.g. adding an alpha suffix) —
// use color-mix() instead.

export const C = {
  ink: "var(--ink)",
  ink2: "var(--ink-2)",
  muted: "var(--muted)",
  faint: "var(--faint)",
  line: "var(--line)",
  line2: "var(--line-2)",
  cobalt: "var(--cobalt)",
  cobaltSoft: "var(--chart-soft)",
  bar: "var(--bar)",
  yellow: "var(--yellow)",
  s1: "var(--s1)",
  s2: "var(--s2)",
  s3: "var(--s3)",
  s4: "var(--s4)",
  s5: "var(--s5)",
};

/** Star rating 1..5 -> color (for fills: bars, dots, swatches) */
export const STAR = [C.s1, C.s2, C.s3, C.s4, C.s5];

/** Same hues darkened for text, so labels pass 4.5:1 contrast in both themes. */
export const STAR_TEXT = ["var(--t1)", "var(--t2)", "var(--t3)", "var(--t4)", "var(--t5)"];

export const SENTIMENT: Record<string, string> = {
  Negative: C.s1,
  Neutral: C.s3,
  Positive: C.s5,
};

/** Map a 0-1 "badness" rate onto the star scale (high rate = red). */
export function rateColor(rate: number, low = 0.15, high = 0.35): string {
  return STAR[rateStep(rate, low, high)];
}

/** Text-safe version of rateColor. */
export function rateTextColor(rate: number, low = 0.15, high = 0.35): string {
  return STAR_TEXT[rateStep(rate, low, high)];
}

function rateStep(rate: number, low: number, high: number): number {
  const t = Math.min(1, Math.max(0, (rate - low) / (high - low)));
  return 4 - Math.round(t * 4);
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
    background: "var(--surface)",
    border: `1px solid ${C.line}`,
    borderRadius: 6,
    color: C.ink,
    fontSize: 13,
    boxShadow: "var(--tooltip-shadow)",
  },
  labelStyle: { color: C.ink, fontWeight: 600, marginBottom: 2 },
  itemStyle: { color: C.ink2 },
  cursor: { fill: "var(--cobalt-soft)" },
};

export const barLabel = { fill: C.ink2, fontSize: 12 };
