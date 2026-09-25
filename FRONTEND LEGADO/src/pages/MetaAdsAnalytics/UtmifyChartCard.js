import React from "react";
import { Tooltip, makeStyles } from "@material-ui/core";
import InfoOutlinedIcon from "@material-ui/icons/InfoOutlined";
import { UTMIFY_FONT } from "./utmifyTheme";

const useStyles = makeStyles((theme) => {
  const isDark = theme.palette.type === "dark";
  return {
    card: {
      position: "relative",
      display: "flex",
      flexDirection: "column",
      minHeight: 280,
      minWidth: 0,
      padding: "14px 16px 16px",
      borderRadius: 10,
      background: isDark ? "#1c1f2e" : "#ffffff",
      border: isDark
        ? "1px solid rgba(255,255,255,0.07)"
        : "1px solid rgba(15,23,42,0.07)",
      boxShadow: isDark
        ? "0 1px 0 rgba(255,255,255,0.04), 0 8px 24px rgba(0,0,0,0.22)"
        : "0 1px 2px rgba(15,23,42,0.04)",
      fontFamily: UTMIFY_FONT,
      boxSizing: "border-box",
      transform: "translateY(0)",
      transition:
        "transform 180ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 180ms cubic-bezier(0.16, 1, 0.3, 1)",
      "&:hover": {
        transform: "translateY(-5px)",
        boxShadow: isDark
          ? "0 18px 40px rgba(0,0,0,0.48), 0 0 0 1px rgba(255,255,255,0.08), inset 0 1px 0 rgba(255,255,255,0.08)"
          : "0 16px 36px rgba(15,23,42,0.14), 0 0 0 1px rgba(15,23,42,0.06)",
      },
      "@media (prefers-reduced-motion: reduce)": {
        transition: "none",
        "&:hover": { transform: "none" },
      },
    },
    head: {
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 8,
      marginBottom: 10,
    },
    title: {
      fontSize: 13,
      fontWeight: 650,
      letterSpacing: "-0.02em",
      lineHeight: 1.3,
      color: isDark ? "rgba(248,250,252,0.72)" : "#64748b",
    },
    info: {
      color: isDark ? "rgba(226,232,240,0.38)" : "#b4bac8",
      fontSize: 14,
      cursor: "help",
      flexShrink: 0,
    },
    body: {
      flex: 1,
      minHeight: 220,
    },
    empty: {
      flex: 1,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: 180,
      fontSize: 13,
      color: isDark ? "rgba(226,232,240,0.45)" : "#94a3b8",
    },
    tip: {
      backgroundColor: isDark ? "#f1f5f9 !important" : "#0f172a !important",
      color: isDark ? "#0f172a !important" : "#f8fafc !important",
      fontSize: 12,
      fontWeight: 500,
      lineHeight: 1.45,
      padding: "8px 10px",
      maxWidth: 280,
      boxShadow: "0 10px 28px rgba(0,0,0,0.28)",
    },
  };
});

export default function UtmifyChartCard({ title, info, empty, children }) {
  const classes = useStyles();
  return (
    <article className={classes.card}>
      <div className={classes.head}>
        <span className={classes.title}>{title}</span>
        {info ? (
          <Tooltip title={info} placement="top" classes={{ tooltip: classes.tip }}>
            <InfoOutlinedIcon className={classes.info} fontSize="inherit" />
          </Tooltip>
        ) : null}
      </div>
      {empty ? <div className={classes.empty}>{empty}</div> : <div className={classes.body}>{children}</div>}
    </article>
  );
}
