// Number formatting shared by every page (en-US grouping, BRL for money).

export const int = (n: number) => Math.round(n).toLocaleString("en-US");

/** 0.183 -> "18.3%" */
export const pct = (fraction: number, digits = 1) => `${(fraction * 100).toFixed(digits)}%`;

/** 18.3 -> "18.3%" (value already in percent) */
export const pctOf = (percent: number, digits = 1) => `${percent.toFixed(digits)}%`;

// Non-breaking space keeps "R$" and the amount together in chart labels.
export const brl = (n: number, digits = 0) =>
  `R$ ${n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;

/** R$ 1.76M / R$ 88.1K */
export const brlShort = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1e6) return `R$ ${(n / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `R$ ${(n / 1e3).toFixed(a >= 1e5 ? 0 : 1)}K`;
  return `R$ ${n.toFixed(0)}`;
};

/** "bed_bath_table" -> "Bed bath table" */
export const label = (s: string) => {
  const t = s.replace(/_/g, " ").trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
};

export function pValue(p: number): string {
  if (p === 0) return "p < 1e-300";
  if (p < 0.0001) return `p = ${p.toExponential(1)}`;
  return `p = ${p.toFixed(4)}`;
}

const UF: Record<string, string> = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia", CE: "Ceará",
  DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás", MA: "Maranhão", MT: "Mato Grosso",
  MS: "Mato Grosso do Sul", MG: "Minas Gerais", PA: "Pará", PB: "Paraíba", PR: "Paraná",
  PE: "Pernambuco", PI: "Piauí", RJ: "Rio de Janeiro", RN: "Rio Grande do Norte",
  RS: "Rio Grande do Sul", RO: "Rondônia", RR: "Roraima", SC: "Santa Catarina",
  SP: "São Paulo", SE: "Sergipe", TO: "Tocantins",
};

/** "AL" -> "Alagoas" */
export const stateName = (code: string) => UF[code] ?? code;
