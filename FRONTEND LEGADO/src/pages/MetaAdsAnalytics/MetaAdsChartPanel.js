import React from "react";
import { Box, Typography } from "@material-ui/core";

export function chartPanelStyle(palette, minHeight = 260) {
  return {
    borderRadius: 8,
    padding: 16,
    border: `1px solid ${palette.border}`,
    boxShadow: palette.shadow,
    background: palette.card,
    minHeight,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  };
}

export default function MetaAdsChartPanel({ title, subtitle, palette, children, empty, minHeight }) {
  const style = chartPanelStyle(palette, minHeight);
  return (
    <Box style={style}>
      <Typography style={{ fontWeight: 600, fontSize: 14, color: palette.text, marginBottom: subtitle ? 2 : 8 }}>
        {title}
      </Typography>
      {subtitle ? (
        <Typography style={{ fontSize: 11, color: palette.sub, marginBottom: 10 }}>
          {subtitle}
        </Typography>
      ) : null}
      {empty ? (
        <Box flex={1} display="flex" alignItems="center" justifyContent="center" minHeight={180}>
          <Typography style={{ fontSize: 13, color: palette.sub }}>{empty}</Typography>
        </Box>
      ) : (
        children
      )}
    </Box>
  );
}
