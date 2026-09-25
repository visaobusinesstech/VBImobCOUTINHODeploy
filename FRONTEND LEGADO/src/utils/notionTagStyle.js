/** Tags opacas estilo Notion — fundo pastel sólido, texto com contraste legível */

const DEFAULT_RGB = { r: 145, g: 145, b: 142 };

const NOTION_NEUTRAL_LIGHT = { bg: "#e9e9e7", text: "#37352f" };
const NOTION_NEUTRAL_DARK = { bg: "#454545", text: "#ebebea" };

/** Texto escuro sobre fundo claro (ex.: Pagamento Pendente) */
const TEXT_ON_LIGHT = "#2f2f2b";
/** Texto claro sobre fundo escuro/saturado */
const TEXT_ON_DARK = "#f7f7f5";

export function hexToRgb(hex) {
  if (!hex || typeof hex !== "string") return DEFAULT_RGB;
  const raw = hex.replace("#", "").trim();
  if (raw.length !== 3 && raw.length !== 6) return DEFAULT_RGB;
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return DEFAULT_RGB;
  return {
    r: (n >> 16) & 255,
    g: (n >> 8) & 255,
    b: n & 255,
  };
}

function mix(a, b, t) {
  return Math.round(a + (b - a) * t);
}

function toHex(r, g, b) {
  const h = (n) => {
    const s = Math.max(0, Math.min(255, n)).toString(16);
    return s.length === 1 ? `0${s}` : s;
  };
  return `#${h(r)}${h(g)}${h(b)}`;
}

export function luminance(r, g, b) {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** Fundo claro → texto escuro; fundo escuro → texto claro */
export function contrastTextForBg(bgHex) {
  const { r, g, b } = hexToRgb(bgHex);
  return luminance(r, g, b) >= 0.62 ? TEXT_ON_LIGHT : TEXT_ON_DARK;
}

/**
 * Paleta Notion: fundo pastel; texto sempre legível conforme luminância do fundo.
 */
export function getNotionTagAppearance(hexColor, isDark = false) {
  const { r, g, b } = hexToRgb(hexColor);
  const lum = luminance(r, g, b);

  if (lum < 0.18) {
    const neutral = isDark ? NOTION_NEUTRAL_DARK : NOTION_NEUTRAL_LIGHT;
    return {
      backgroundColor: neutral.bg,
      color: neutral.text,
      border: "none",
    };
  }

  let backgroundColor;
  if (isDark) {
    // Escuro: fundo um pouco mais profundo, mas cores claras (amarelo/lima) continuam claras
    const bgR = mix(r, 40, lum > 0.72 ? 0.12 : 0.38);
    const bgG = mix(g, 40, lum > 0.72 ? 0.12 : 0.38);
    const bgB = mix(b, 40, lum > 0.72 ? 0.12 : 0.38);
    backgroundColor = toHex(bgR, bgG, bgB);
  } else {
    // Claro: ~86% branco no fundo (pastel Notion)
    backgroundColor = toHex(
      mix(r, 255, 0.86),
      mix(g, 255, 0.86),
      mix(b, 255, 0.86)
    );
  }

  return {
    backgroundColor,
    color: contrastTextForBg(backgroundColor),
    border: "none",
  };
}

/** Tags neutras (ex.: Agente IA) — cinza Notion padrão */
export function getNotionNeutralTagAppearance(isDark, accent = "#0ea5e9") {
  const { r, g, b } = hexToRgb(accent);
  const backgroundColor = isDark
    ? toHex(mix(r, 55, 0.28), mix(g, 55, 0.28), mix(b, 55, 0.28))
    : toHex(mix(r, 255, 0.84), mix(g, 255, 0.84), mix(b, 255, 0.84));

  return {
    backgroundColor,
    color: contrastTextForBg(backgroundColor),
    border: "none",
  };
}
