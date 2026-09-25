import React from "react";
import { useTheme } from "@material-ui/core/styles";
import { getLobeIconCDN } from "@lobehub/icons/es/features/getLobeIconCDN/index.js";
import { SiOpenai } from "react-icons/si";
import { getOpenAiIconColor } from "../pages/Connections/connectionsTheme";
import grokIconPng from "../assets/grok-icon.png";

function LobeBrandImg({ brandId, size = 24, style, className, title, onError }) {
  const src = getLobeIconCDN(brandId, {
    format: "svg",
    type: "color",
    cdn: "unpkg"
  });
  return (
    <img
      src={src}
      alt={title || brandId}
      width={size}
      height={size}
      className={className}
      onError={onError}
      style={{ display: "block", flexShrink: 0, objectFit: "contain", ...style }}
      loading="lazy"
      decoding="async"
    />
  );
}

/** Claude (@lobehub/icons). */
export function LobeClaudeIcon({ size = 24, style, className }) {
  return (
    <LobeBrandImg
      brandId="claude"
      size={size}
      style={style}
      className={className}
      title="Claude"
    />
  );
}

/** Gemini (@lobehub/icons). */
export function LobeGeminiIcon({ size = 24, style, className }) {
  return (
    <LobeBrandImg
      brandId="gemini"
      size={size}
      style={style}
      className={className}
      title="Gemini"
    />
  );
}

/** Grok / xAI — PNG local (logo branco em fundo preto). */
export function LobeGrokIcon({ size = 24, style, className }) {
  const theme = useTheme();
  const isDark = theme?.palette?.type === "dark";
  return (
    <img
      src={grokIconPng}
      alt="Grok"
      width={size}
      height={size}
      className={className}
      style={{
        display: "block",
        flexShrink: 0,
        objectFit: "contain",
        borderRadius: Math.max(4, Math.round(size * 0.18)),
        boxShadow: isDark ? "0 0 0 1px rgba(255,255,255,0.35)" : undefined,
        ...style
      }}
      loading="lazy"
      decoding="async"
    />
  );
}

/** OpenAI — preto no claro, branco no escuro. */
export function LobeOpenAIIcon({ size = 24, style, className }) {
  const theme = useTheme();
  const color = getOpenAiIconColor(theme);
  return (
    <SiOpenai
      size={size}
      color={color}
      className={className}
      style={{ display: "block", flexShrink: 0, ...style }}
    />
  );
}
