import React from "react";
import { Tooltip, Typography } from "@material-ui/core";
import IntegrationBrandIcon, { getBrandVisual } from "../../pages/Connections/IntegrationBrandIcon";

const PROVIDER_LABELS = {
  hubspot: "HubSpot",
  clickup: "ClickUp",
  pipedrive: "Pipedrive",
  notion: "Notion"
};

export default function CrmSourceBadge({
  crmSource,
  variant = "table",
  showLabel = false,
  emptyLabel = "—",
  size = "table",
  opacity = 1
}) {
  if (!crmSource?.provider) {
    return showLabel ? (
      <Typography component="span" variant="caption" color="textSecondary">
        {emptyLabel}
      </Typography>
    ) : null;
  }

  const visual = getBrandVisual({ key: crmSource.provider });
  const label = PROVIDER_LABELS[crmSource.provider] || crmSource.provider;
  const iconVariant = variant === "table" && size === "table" ? "table" : variant || size;

  return (
    <Tooltip title={`Origem: ${label}`} arrow placement="top">
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: showLabel ? 6 : 0,
          verticalAlign: "middle",
          opacity
        }}
      >
        <IntegrationBrandIcon brandKey={visual.brandKey} variant={iconVariant} plain />
        {showLabel && (
          <Typography component="span" variant="caption" style={{ fontWeight: 600, fontSize: 11 }}>
            {label}
          </Typography>
        )}
      </span>
    </Tooltip>
  );
}
