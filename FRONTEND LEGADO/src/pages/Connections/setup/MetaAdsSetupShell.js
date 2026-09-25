import React, { useCallback, useEffect, useMemo } from "react";
import { useHistory, useLocation } from "react-router-dom";
import { Box, Typography, makeStyles } from "@material-ui/core";
import MetaAdsConnectionSetupForm from "./MetaAdsConnectionSetupForm";
import MetaAdsInsightsSetupForm from "./MetaAdsInsightsSetupForm";
import { useSetupHeaderCenter } from "../ConnectionsChannelLayout";
import { CONNECTIONS_FONT } from "../connectionsTypography";

const SECTIONS = [
  {
    id: "capi",
    label: "Gerenciador de Eventos",
    short: "Eventos",
    hint: "Conversions API · Dataset · envio de conversões"
  },
  {
    id: "insights",
    label: "Anúncios & Pixels",
    short: "Anúncios",
    hint: "Marketing API · campanhas, pixels e insights"
  }
];

const useStyles = makeStyles((theme) => {
  const isDark = theme.palette.type === "dark";
  return {
    root: {
      fontFamily: CONNECTIONS_FONT,
      width: "100%",
      display: "flex",
      flexDirection: "column",
      gap: theme.spacing(1.5),
      animation: "$rise 0.32s cubic-bezier(0.16, 1, 0.3, 1)"
    },
    "@keyframes rise": {
      from: { opacity: 0, transform: "translateY(6px)" },
      to: { opacity: 1, transform: "translateY(0)" }
    },
    "@media (prefers-reduced-motion: reduce)": {
      root: { animation: "none" }
    },
    segment: {
      display: "inline-flex",
      alignItems: "center",
      gap: 2,
      padding: 3,
      borderRadius: 10,
      background: isDark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.05)",
      border: `1px solid ${
        isDark ? "rgba(255,255,255,0.1)" : "rgba(15,23,42,0.08)"
      }`,
      maxWidth: "100%"
    },
    tab: {
      appearance: "none",
      border: 0,
      cursor: "pointer",
      fontFamily: CONNECTIONS_FONT,
      fontSize: "0.75rem",
      fontWeight: 500,
      lineHeight: 1.2,
      letterSpacing: "-0.01em",
      padding: "7px 12px",
      borderRadius: 8,
      color: isDark ? "rgba(248,250,252,0.62)" : "#64748B",
      background: "transparent",
      whiteSpace: "nowrap",
      transition:
        "background 0.18s cubic-bezier(0.16, 1, 0.3, 1), color 0.18s ease, box-shadow 0.18s ease",
      "&:hover": {
        color: isDark ? "#F8FAFC" : "#0F172A",
        background: isDark ? "rgba(255,255,255,0.05)" : "rgba(15,23,42,0.04)"
      },
      [theme.breakpoints.up("sm")]: {
        fontSize: "0.8125rem",
        padding: "8px 14px"
      }
    },
    tabActive: {
      color: isDark ? "#F8FAFC" : "#0F172A",
      background: isDark ? "rgba(0,129,251,0.28)" : "#FFFFFF",
      boxShadow: isDark
        ? "0 0 0 1px rgba(0,129,251,0.4), 0 1px 2px rgba(0,0,0,0.25)"
        : "0 1px 2px rgba(15,23,42,0.08), 0 0 0 1px rgba(0,129,251,0.22)"
    },
    tabLabelFull: {
      display: "none",
      [theme.breakpoints.up("md")]: {
        display: "inline"
      }
    },
    tabLabelShort: {
      display: "inline",
      [theme.breakpoints.up("md")]: {
        display: "none"
      }
    },
    pageIntro: {
      display: "flex",
      flexDirection: "column",
      gap: 4,
      padding: theme.spacing(0.5, 0.5, 0),
      [theme.breakpoints.up("md")]: {
        padding: theme.spacing(0.75, 1, 0)
      }
    },
    pageKicker: {
      fontSize: "0.6875rem",
      fontWeight: 600,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      color: "#0081FB"
    },
    pageHint: {
      fontSize: "0.875rem",
      lineHeight: 1.5,
      color: theme.palette.text.secondary,
      maxWidth: "68ch"
    },
    body: {
      minWidth: 0,
      width: "100%"
    }
  };
});

function resolveSection(search) {
  const params = new URLSearchParams(search || "");
  const raw = String(
    params.get("section") || params.get("tab") || "capi"
  ).toLowerCase();
  if (
    raw === "insights" ||
    raw === "pixels" ||
    raw === "anuncios" ||
    raw === "ads"
  ) {
    return "insights";
  }
  return "capi";
}

function MetaAdsSectionTabs({ section, onChange, classes }) {
  return (
    <Box className={classes.segment} role="tablist" aria-label="Tipo de conexão Meta">
      {SECTIONS.map((s) => {
        const isActive = s.id === section;
        return (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`${classes.tab} ${isActive ? classes.tabActive : ""}`}
            onClick={() => onChange(s.id)}
          >
            <span className={classes.tabLabelFull}>{s.label}</span>
            <span className={classes.tabLabelShort}>{s.short}</span>
          </button>
        );
      })}
    </Box>
  );
}

/**
 * Shell único Meta Ads: tabs na faixa superior (com Salvar/Administrar).
 */
export default function MetaAdsSetupShell({ onCancel, onSaved }) {
  const classes = useStyles();
  const history = useHistory();
  const location = useLocation();
  const registerHeaderCenter = useSetupHeaderCenter();
  const section = useMemo(
    () => resolveSection(location.search),
    [location.search]
  );

  const setSection = useCallback(
    (id) => {
      const params = new URLSearchParams(location.search || "");
      params.set("section", id);
      history.replace({
        pathname: location.pathname,
        search: `?${params.toString()}`
      });
    },
    [history, location.pathname, location.search]
  );

  useEffect(() => {
    if (!registerHeaderCenter) return undefined;
    registerHeaderCenter(
      <MetaAdsSectionTabs
        section={section}
        onChange={setSection}
        classes={classes}
      />
    );
    return () => registerHeaderCenter(null);
  }, [registerHeaderCenter, section, setSection, classes]);

  const active = SECTIONS.find((s) => s.id === section) || SECTIONS[0];

  return (
    <Box className={classes.root}>
      <Box className={classes.pageIntro}>
        <Typography className={classes.pageKicker}>
          {section === "insights" ? "Marketing API" : "Conversions API"}
        </Typography>
        <Typography className={classes.pageHint}>{active.hint}</Typography>
      </Box>

      <Box className={classes.body}>
        {section === "insights" ? (
          <MetaAdsInsightsSetupForm onCancel={onCancel} onSaved={onSaved} />
        ) : (
          <MetaAdsConnectionSetupForm onCancel={onCancel} onSaved={onSaved} />
        )}
      </Box>
    </Box>
  );
}
