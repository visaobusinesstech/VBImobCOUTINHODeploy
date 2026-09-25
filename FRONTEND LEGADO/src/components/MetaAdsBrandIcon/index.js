import React from "react";
import metaAdsIcon from "../../assets/meta-ads-icon-transparent.png";

/**
 * Ícone oficial Meta Ads (símbolo ∞ da Meta) — asset fornecido pelo produto.
 */
export default function MetaAdsBrandIcon({ size = 24, color }) {
  const s = Number(size) || 24;
  // color prop ignorado: o asset oficial já traz o azul Meta (#0081FB).
  // Em fundos azuis (badge), usa brightness para ficar branco.
  const forceWhite = Boolean(
    color &&
      String(color).toLowerCase() !== "#0081fb" &&
      (String(color).toLowerCase() === "#fff" ||
        String(color).toLowerCase() === "#ffffff" ||
        String(color).toLowerCase() === "white")
  );

  return (
    <img
      src={metaAdsIcon}
      alt=""
      width={s}
      height={s}
      draggable={false}
      aria-hidden
      style={{
        display: "block",
        flexShrink: 0,
        width: s,
        height: s,
        objectFit: "contain",
        ...(forceWhite
          ? {
              filter: "brightness(0) invert(1)",
              WebkitFilter: "brightness(0) invert(1)"
            }
          : null)
      }}
    />
  );
}
