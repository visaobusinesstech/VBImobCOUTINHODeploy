import React from "react";
import { MenuItem, Select, Tooltip, makeStyles } from "@material-ui/core";
import InfoOutlinedIcon from "@material-ui/icons/InfoOutlined";
import { UTMIFY_FONT } from "./utmifyTheme";

const useStyles = makeStyles((theme) => {
  const isDark = theme.palette.type === "dark";
  return {
    wrap: {
      display: "flex",
      flexDirection: "column",
      gap: 6,
      minWidth: 0,
      flex: "1 1 160px",
    },
    labelRow: {
      display: "flex",
      alignItems: "center",
      gap: 5,
      minHeight: 16,
    },
    label: {
      fontFamily: UTMIFY_FONT,
      fontSize: 12,
      fontWeight: 600,
      letterSpacing: "-0.01em",
      lineHeight: 1.2,
      color: isDark ? "rgba(226,232,240,0.58)" : "#8b93a7",
    },
    info: {
      fontSize: 13,
      color: isDark ? "rgba(226,232,240,0.38)" : "#b4bac8",
      cursor: "help",
    },
    select: {
      fontFamily: UTMIFY_FONT,
      height: 38,
      borderRadius: 8,
      background: isDark ? "rgba(12,14,22,0.55)" : "#fff",
      color: isDark ? "#f8fafc" : "#0f172a",
      fontSize: 13,
      fontWeight: 500,
      "& fieldset": {
        borderColor: isDark ? "rgba(255,255,255,0.14)" : "rgba(15,23,42,0.12)",
        borderRadius: 8,
      },
      "&:hover fieldset": {
        borderColor: isDark ? "rgba(255,255,255,0.28)" : "rgba(15,23,42,0.22)",
      },
      "&.Mui-focused fieldset": {
        borderColor: "#005eff",
        borderWidth: 1,
      },
      "& .MuiSelect-select": {
        padding: "8px 32px 8px 12px",
        fontFamily: UTMIFY_FONT,
        fontSize: 13,
        fontWeight: 500,
      },
    },
  };
});

export default function UtmifyFilterSelect({
  label,
  value,
  onChange,
  options,
  info,
  emptyLabel = "Qualquer",
  hideEmpty = false,
}) {
  const classes = useStyles();
  const items = hideEmpty
    ? options || []
    : [{ value: "", label: emptyLabel }, ...(options || [])];
  return (
    <div className={classes.wrap}>
      <div className={classes.labelRow}>
        <span className={classes.label}>{label}</span>
        {info ? (
          <Tooltip title={info} placement="top">
            <InfoOutlinedIcon className={classes.info} fontSize="inherit" />
          </Tooltip>
        ) : null}
      </div>
      <Select
        fullWidth
        variant="outlined"
        className={classes.select}
        value={value == null ? "" : value}
        onChange={(e) => onChange(e.target.value)}
        displayEmpty
        MenuProps={{
          PaperProps: {
            style: { borderRadius: 10, marginTop: 4 },
          },
        }}
      >
        {items.map((opt) => (
          <MenuItem
            key={String(opt.value)}
            value={opt.value}
            disabled={Boolean(opt.disabled)}
            style={{
              fontFamily: UTMIFY_FONT,
              fontSize: 13,
              opacity: opt.disabled ? 0.45 : 1,
              color: opt.disabled ? "#94a3b8" : undefined,
            }}
          >
            {opt.label}
          </MenuItem>
        ))}
      </Select>
    </div>
  );
}
