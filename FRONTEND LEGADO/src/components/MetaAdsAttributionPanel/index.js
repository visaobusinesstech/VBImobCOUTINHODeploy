import React from "react";
import { Box, Typography, Chip, makeStyles, Link } from "@material-ui/core";

const useStyles = makeStyles((theme) => ({
  root: {
    marginTop: theme.spacing(1.5),
    marginBottom: theme.spacing(1),
    padding: theme.spacing(1.25),
    borderRadius: 8,
    border: `1px solid ${
      theme.palette.type === "dark" ? "rgba(0,129,251,0.35)" : "rgba(0,129,251,0.25)"
    }`,
    background:
      theme.palette.type === "dark"
        ? "rgba(0,129,251,0.12)"
        : "rgba(0,129,251,0.06)"
  },
  titleRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
    flexWrap: "wrap"
  },
  title: {
    fontWeight: 700,
    fontSize: 13
  },
  row: {
    display: "flex",
    gap: 6,
    fontSize: 12,
    marginBottom: 4,
    lineHeight: 1.35
  },
  label: {
    color: theme.palette.text.secondary,
    minWidth: 88,
    flexShrink: 0
  },
  value: {
    wordBreak: "break-word"
  },
  chipMeta: {
    backgroundColor: "#0081FB",
    color: "#fff",
    fontWeight: 600,
    height: 22
  },
  chipIg: {
    backgroundColor: "#E4405F",
    color: "#fff",
    fontWeight: 600,
    height: 22
  },
  chipGoogle: {
    backgroundColor: "#4285F4",
    color: "#fff",
    fontWeight: 600,
    height: 22
  }
}));

export function hasAdsAttribution(attribution) {
  if (!attribution || typeof attribution !== "object") return false;
  const platform = String(attribution.platform || "").toLowerCase();
  return (
    platform.includes("ads") ||
    Boolean(attribution.ctwa_clid || attribution.fbclid || attribution.gclid) ||
    String(attribution.sourceType || "").toLowerCase() === "ad" ||
    ["paid", "cpc"].includes(String(attribution.medium || "").toLowerCase())
  );
}

export function resolveAttribution(...candidates) {
  for (const c of candidates) {
    if (hasAdsAttribution(c)) return c;
    if (c && typeof c === "object" && (c.utm_source || c.campaign || c.adId)) {
      return c;
    }
  }
  return null;
}

function platformChip(classes, platform) {
  const p = String(platform || "").toLowerCase();
  if (p === "instagram_ads") {
    return <Chip size="small" label="Instagram Ads" className={classes.chipIg} />;
  }
  if (p === "google_ads") {
    return <Chip size="small" label="Google Ads" className={classes.chipGoogle} />;
  }
  return (
    <Chip size="small" label="Meta Ads" className={classes.chipMeta} />
  );
}

function Row({ classes, label, children }) {
  if (!children) return null;
  return (
    <div className={classes.row}>
      <span className={classes.label}>{label}</span>
      <span className={classes.value}>{children}</span>
    </div>
  );
}

/**
 * Painel compacto de rastreio de anúncios (ticket / lead / contato).
 */
export default function MetaAdsAttributionPanel({
  attribution,
  dense = false,
  title = "Rastreio de anúncio"
}) {
  const classes = useStyles();
  if (!attribution || typeof attribution !== "object") return null;
  if (!hasAdsAttribution(attribution) && !attribution.utm_source && !attribution.headline) {
    return null;
  }

  return (
    <Box className={classes.root} style={dense ? { marginTop: 8, padding: 10 } : undefined}>
      <div className={classes.titleRow}>
        <Typography className={classes.title}>{title}</Typography>
        {platformChip(classes, attribution.platform)}
      </div>
      <Row classes={classes} label="Campanha">
        {attribution.campaign || attribution.utm_campaign || null}
      </Row>
      <Row classes={classes} label="Anúncio / ID">
        {attribution.adId || attribution.utm_content || null}
      </Row>
      <Row classes={classes} label="Headline">
        {attribution.headline || null}
      </Row>
      <Row classes={classes} label="CTWA">
        {attribution.ctwa_clid || null}
      </Row>
      <Row classes={classes} label="fbclid">
        {attribution.fbclid || null}
      </Row>
      <Row classes={classes} label="gclid">
        {attribution.gclid || null}
      </Row>
      <Row classes={classes} label="UTM">
        {[attribution.utm_source, attribution.utm_medium, attribution.utm_campaign]
          .filter(Boolean)
          .join(" / ") || null}
      </Row>
      <Row classes={classes} label="URL">
        {attribution.sourceUrl || attribution.landingUrl ? (
          <Link
            href={attribution.sourceUrl || attribution.landingUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 12 }}
          >
            Abrir criativo / destino
          </Link>
        ) : null}
      </Row>
      <Row classes={classes} label="Capturado">
        {attribution.capturedAt
          ? new Date(attribution.capturedAt).toLocaleString("pt-BR")
          : null}
      </Row>
    </Box>
  );
}
