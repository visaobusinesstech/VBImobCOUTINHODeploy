import { pctFmt } from "./formatters";

export const GOAL_FIELDS = [
  { key: "revenue", label: "Faturamento líquido", format: "money", source: "crmRevenueFromAds" },
  { key: "valorGanho", label: "Valor ganho (bruto)", format: "money", source: "valorGanho" },
  { key: "spend", label: "Gasto com anúncios", format: "money", source: "spend", inverse: true },
  { key: "roas", label: "ROAS", format: "num", source: "roas" },
  { key: "roi", label: "ROI", format: "pct", source: "roi" },
  { key: "lucro", label: "Lucro", format: "money", source: "lucro" },
  { key: "lucroLiquido", label: "Lucro líquido", format: "money", source: "lucroLiquido" },
  { key: "lucroTotal", label: "Lucro total", format: "money", source: "lucroTotal" },
  { key: "leads", label: "Leads Meta", format: "int", source: "metaLeadsReported" },
  { key: "purchases", label: "Vendas / Purchases", format: "int", source: "metaPurchasesReported" },
  { key: "impressions", label: "Impressões", format: "int", source: "impressions" },
  { key: "clicks", label: "Cliques", format: "int", source: "clicks" },
  { key: "margem", label: "Margem", format: "pct", source: "margem" },
  { key: "cpa", label: "CPA", format: "money", source: "cpa", inverse: true },
  { key: "fees", label: "Taxas Cakto", format: "money", source: "fees", inverse: true },
  { key: "productCosts", label: "Custos de produto", format: "money", source: "productCosts", inverse: true },
];

const GOAL_BY_SOURCE = GOAL_FIELDS.reduce((acc, f) => {
  acc[f.source] = f;
  return acc;
}, {});

export function getGoalFieldForSource(source) {
  return GOAL_BY_SOURCE[source] || null;
}

/** good = verde, medium = neutro, bad = vermelho */
export function evaluateGoalStatus(actual, goal, { inverse = false } = {}) {
  const a = Number(actual) || 0;
  const g = Number(goal) || 0;
  if (g <= 0) return { status: "none", hint: null, deltaPct: null };

  if (inverse) {
    if (a <= g) {
      const saved = g > 0 ? ((g - a) / g) * 100 : 0;
      return {
        status: "good",
        hint: saved > 2 ? `${pctFmt(saved, 0)}% abaixo da meta` : "Dentro da meta",
        deltaPct: -saved,
      };
    }
    const over = ((a - g) / g) * 100;
    if (over <= 12) {
      return {
        status: "medium",
        hint: `${pctFmt(over, 0)}% acima da meta`,
        deltaPct: over,
      };
    }
    return {
      status: "bad",
      hint: `${pctFmt(over, 0)}% acima da meta`,
      deltaPct: over,
    };
  }

  const ratio = g > 0 ? a / g : 0;
  const delta = (ratio - 1) * 100;

  if (ratio >= 1) {
    return {
      status: "good",
      hint: delta > 2 ? `${pctFmt(delta, 0)}% acima da meta` : "Na meta",
      deltaPct: delta,
    };
  }
  if (ratio >= 0.85) {
    return {
      status: "medium",
      hint: `${pctFmt(Math.abs(delta), 0)}% abaixo da meta`,
      deltaPct: delta,
    };
  }
  return {
    status: "bad",
    hint: `${pctFmt(Math.abs(delta), 0)}% abaixo da meta`,
    deltaPct: delta,
  };
}

export function progressPct(actual, goal, inverse) {
  const a = Number(actual) || 0;
  const g = Number(goal) || 0;
  if (g <= 0) return a > 0 ? 100 : 0;
  if (inverse) {
    if (a <= g) return 100;
    return Math.max(0, Math.min(100, (g / a) * 100));
  }
  return Math.max(0, Math.min(100, (a / g) * 100));
}

export function goalStatusColor(status, palette, isDark) {
  if (status === "good") return palette.green;
  if (status === "bad") return palette.red;
  if (status === "medium") return isDark ? "#e4e4e7" : palette.text;
  return palette.text;
}

export function goalStatusBg(status, palette, isDark) {
  if (status === "good") {
    return isDark ? "rgba(52, 211, 153, 0.12)" : "rgba(16, 185, 129, 0.08)";
  }
  if (status === "bad") {
    return isDark ? "rgba(248, 113, 113, 0.12)" : "rgba(239, 68, 68, 0.08)";
  }
  return isDark ? palette.card : "#FFFFFF";
}

export function goalStatusBorder(status, palette) {
  if (status === "good") return palette.green;
  if (status === "bad") return palette.red;
  return palette.border;
}
