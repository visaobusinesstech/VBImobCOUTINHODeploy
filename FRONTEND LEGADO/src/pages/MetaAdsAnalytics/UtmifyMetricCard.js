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
      justifyContent: "flex-start",
      minHeight: 96,
      padding: "12px 14px 14px",
      borderRadius: 10,
      background: isDark ? "#1c1f2e" : "#ffffff",
      border: isDark
        ? "1px solid rgba(255,255,255,0.07)"
        : "1px solid rgba(15,23,42,0.07)",
      boxShadow: isDark
        ? "0 1px 0 rgba(255,255,255,0.04), 0 6px 18px rgba(0,0,0,0.18)"
        : "0 1px 2px rgba(15,23,42,0.04)",
      fontFamily: UTMIFY_FONT,
      boxSizing: "border-box",
      minWidth: 0,
      transform: "translateY(0)",
      transition:
        "transform 180ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 180ms cubic-bezier(0.16, 1, 0.3, 1)",
      "&:hover": {
        transform: "translateY(-5px)",
        boxShadow: isDark
          ? "0 18px 40px rgba(0,0,0,0.48), 0 0 0 1px rgba(255,255,255,0.08), inset 0 1px 0 rgba(255,255,255,0.1)"
          : "0 16px 36px rgba(15,23,42,0.14), 0 0 0 1px rgba(15,23,42,0.06)",
      },
      "@media (prefers-reduced-motion: reduce)": {
        transition: "none",
        "&:hover": { transform: "none" },
      },
    },
    tall: {
      minHeight: 204,
      height: "100%",
    },
    head: {
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 8,
      marginBottom: 10,
    },
    title: {
      fontSize: 12,
      fontWeight: 650,
      letterSpacing: "-0.01em",
      lineHeight: 1.3,
      color: isDark ? "rgba(226,232,240,0.62)" : "#8b93a7",
    },
    info: {
      color: isDark ? "rgba(226,232,240,0.38)" : "#b4bac8",
      fontSize: 14,
      cursor: "help",
      flexShrink: 0,
      marginTop: 1,
    },
    value: {
      fontSize: 22,
      fontWeight: 700,
      letterSpacing: "-0.03em",
      lineHeight: 1.15,
      color: isDark ? "#ffffff" : "#0f172a",
      fontVariantNumeric: "tabular-nums",
    },
    hidden: {
      filter: "blur(7px)",
      userSelect: "none",
    },
    hint: {
      marginTop: 6,
      fontSize: 11,
      fontWeight: 500,
      color: isDark ? "rgba(226,232,240,0.45)" : "#94a3b8",
      letterSpacing: "-0.01em",
    },
    bodyFill: {
      flex: 1,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: 80,
      fontSize: 13,
      color: isDark ? "rgba(226,232,240,0.45)" : "#94a3b8",
    },
    rows: {
      display: "flex",
      flexDirection: "column",
      gap: 8,
      marginTop: 4,
    },
    row: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      fontSize: 12,
    },
    rowName: {
      color: isDark ? "rgba(226,232,240,0.7)" : "#64748b",
      minWidth: 0,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      fontWeight: 500,
    },
    rowVal: {
      fontWeight: 700,
      fontVariantNumeric: "tabular-nums",
      color: isDark ? "#ffffff" : "#0f172a",
      flexShrink: 0,
    },
    bar: {
      height: 4,
      borderRadius: 99,
      background: isDark ? "rgba(255,255,255,0.08)" : "#eef2f7",
      overflow: "hidden",
      marginTop: 4,
    },
    barFill: {
      height: "100%",
      borderRadius: 99,
      background: "#005eff",
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

export default function UtmifyMetricCard({
  title,
  value,
  hint,
  info,
  tall,
  children,
  emptyText,
  rows,
  hideValues,
}) {
  const classes = useStyles();
  const mask = hideValues ? classes.hidden : "";
  return (
    <article className={`${classes.card} ${tall ? classes.tall : ""}`}>
      <div className={classes.head}>
        <span className={classes.title}>{title}</span>
        {info ? (
          <Tooltip
            title={info}
            placement="top"
            classes={{ tooltip: classes.tip }}
          >
            <InfoOutlinedIcon className={classes.info} fontSize="inherit" />
          </Tooltip>
        ) : null}
      </div>
      {children}
      {!children && Array.isArray(rows) && rows.length > 0 ? (
        <div className={`${classes.rows} ${mask}`}>
          {rows.map((row) => (
            <div key={row.name}>
              <div className={classes.row}>
                <span className={classes.rowName}>{row.name}</span>
                <span className={classes.rowVal}>{row.value}</span>
              </div>
              {row.pct != null ? (
                <div className={classes.bar}>
                  <div
                    className={classes.barFill}
                    style={{ width: `${Math.max(0, Math.min(100, row.pct))}%` }}
                  />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
      {!children && (!rows || rows.length === 0) && emptyText ? (
        <div className={classes.bodyFill}>{emptyText}</div>
      ) : null}
      {!children && !emptyText && !rows ? (
        <>
          <div className={`${classes.value} ${mask}`}>{value}</div>
          {hint ? <div className={`${classes.hint} ${mask}`}>{hint}</div> : null}
        </>
      ) : null}
    </article>
  );
}
