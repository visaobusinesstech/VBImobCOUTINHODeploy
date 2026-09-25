import React, { useState } from "react";
import {
  Box,
  IconButton,
  Popover,
  Typography,
  CircularProgress,
} from "@material-ui/core";
import {
  CalendarToday,
  ExpandMore,
  FilterList,
  Refresh,
  Visibility,
  VisibilityOff,
} from "@material-ui/icons";
import { useTheme } from "@material-ui/core/styles";

function filterItemStyle(isDark) {
  return {
    display: "flex",
    alignItems: "center",
    gap: 4,
    cursor: "pointer",
    padding: "2px 8px",
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 500,
    color: isDark ? "rgba(255,255,255,0.62)" : "#64748B",
    transition: "background 0.15s",
    userSelect: "none",
  };
}

function popoverPaper(isDark) {
  return {
    padding: 12,
    borderRadius: 12,
    minWidth: 200,
    maxWidth: 280,
    background: isDark ? "#252526" : "#fff",
    border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid #E2E8F0",
    boxShadow: isDark
      ? "0 12px 40px rgba(0,0,0,0.45)"
      : "0 8px 32px rgba(15,23,42,0.12)",
  };
}

function OptionRow({ label, active, onClick, isDark }) {
  return (
    <Box
      onClick={onClick}
      style={{
        padding: "8px 10px",
        borderRadius: 8,
        cursor: "pointer",
        fontSize: 13,
        fontWeight: active ? 600 : 400,
        color: active ? (isDark ? "#fff" : "#0F172A") : isDark ? "#a1a1aa" : "#64748B",
        background: active
          ? isDark
            ? "rgba(59,130,246,0.18)"
            : "rgba(59,130,246,0.08)"
          : "transparent",
      }}
    >
      {label}
    </Box>
  );
}

export default function MetaAdsFilterNav({
  datePreset,
  dateOptions,
  onDatePreset,
  adAccountId,
  adAccounts,
  onAdAccount,
  caktoIntegrationId,
  caktoAccounts,
  onCaktoAccount,
  campaignId,
  campaigns,
  onCampaign,
  adId,
  ads,
  onAd,
  product,
  productOptions,
  onProduct,
  hideValues,
  onToggleHide,
  loading,
  onRefresh,
  fetchedAt,
}) {
  const theme = useTheme();
  const isDark = theme.palette.type === "dark";
  const [anchorPeriod, setAnchorPeriod] = useState(null);
  const [anchorAccount, setAnchorAccount] = useState(null);
  const [anchorCakto, setAnchorCakto] = useState(null);
  const [anchorCampaign, setAnchorCampaign] = useState(null);
  const [anchorAd, setAnchorAd] = useState(null);
  const [anchorProduct, setAnchorProduct] = useState(null);
  const [anchorMore, setAnchorMore] = useState(null);

  const periodLabel =
    dateOptions.find((o) => o.value === datePreset)?.label || "Período";
  const accountLabel =
    adAccounts.find((a) => String(a.value) === String(adAccountId))?.label ||
    "Conta Ads";
  const caktoLabel =
    caktoAccounts?.find((a) => String(a.value) === String(caktoIntegrationId))?.label ||
    (caktoAccounts?.length ? "Conta Cakto" : null);
  const campaignLabel =
    campaigns.find((c) => String(c.value) === String(campaignId))?.label ||
    "Campanha";
  const adLabel = ads.find((a) => String(a.value) === String(adId))?.label || "Anúncio";
  const productLabel =
    productOptions.find((p) => p.value === product)?.label || "Produto";

  const item = filterItemStyle(isDark);
  const chevron = { fontSize: 14, color: isDark ? "rgba(255,255,255,0.45)" : "#94A3B8" };

  return (
    <Box display="flex" alignItems="center" gap={0.5} flexWrap="wrap">
      <Box style={item} onClick={(e) => setAnchorPeriod(e.currentTarget)}>
        <CalendarToday style={{ fontSize: 13, marginRight: 2 }} />
        <span>{periodLabel}</span>
        <ExpandMore style={chevron} />
      </Box>
      <Box style={item} onClick={(e) => setAnchorAccount(e.currentTarget)}>
        <span>{accountLabel}</span>
        <ExpandMore style={chevron} />
      </Box>
      {caktoAccounts?.length ? (
        <Box style={item} onClick={(e) => setAnchorCakto(e.currentTarget)}>
          <span>{caktoIntegrationId ? caktoLabel : "Cakto (todas)"}</span>
          <ExpandMore style={chevron} />
        </Box>
      ) : null}
      <Box style={item} onClick={(e) => setAnchorCampaign(e.currentTarget)}>
        <span>{campaignId ? campaignLabel : "Campanha"}</span>
        <ExpandMore style={chevron} />
      </Box>
      <Box style={item} onClick={(e) => setAnchorMore(e.currentTarget)}>
        <FilterList style={{ fontSize: 13, marginRight: 2 }} />
        <span>Mais filtros</span>
        <ExpandMore style={chevron} />
      </Box>

      <IconButton size="small" onClick={onToggleHide} title="Ocultar valores">
        {hideValues ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
      </IconButton>
      <IconButton size="small" onClick={onRefresh} disabled={loading} title="Atualizar">
        {loading ? <CircularProgress size={16} /> : <Refresh fontSize="small" />}
      </IconButton>

      {fetchedAt ? (
        <Typography variant="caption" style={{ fontSize: 10, color: isDark ? "#71717a" : "#94A3B8", marginLeft: 4 }}>
          {new Date(fetchedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </Typography>
      ) : null}

      <Popover
        open={Boolean(anchorPeriod)}
        anchorEl={anchorPeriod}
        onClose={() => setAnchorPeriod(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        PaperProps={{ style: popoverPaper(isDark) }}
      >
        {dateOptions.map((opt) => (
          <OptionRow
            key={opt.value}
            label={opt.label}
            active={datePreset === opt.value}
            isDark={isDark}
            onClick={() => {
              onDatePreset(opt.value);
              setAnchorPeriod(null);
            }}
          />
        ))}
      </Popover>

      <Popover
        open={Boolean(anchorAccount)}
        anchorEl={anchorAccount}
        onClose={() => setAnchorAccount(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        PaperProps={{ style: popoverPaper(isDark) }}
      >
        <OptionRow
          label="Todas as contas"
          active={!adAccountId}
          isDark={isDark}
          onClick={() => {
            onAdAccount("");
            setAnchorAccount(null);
          }}
        />
        {adAccounts.map((acc) => (
          <OptionRow
            key={acc.value}
            label={acc.label}
            active={String(adAccountId) === String(acc.value)}
            isDark={isDark}
            onClick={() => {
              onAdAccount(acc.value);
              setAnchorAccount(null);
            }}
          />
        ))}
      </Popover>

      {caktoAccounts?.length ? (
        <Popover
          open={Boolean(anchorCakto)}
          anchorEl={anchorCakto}
          onClose={() => setAnchorCakto(null)}
          anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
          PaperProps={{ style: popoverPaper(isDark) }}
        >
          <OptionRow
            label="Todas as contas Cakto"
            active={!caktoIntegrationId}
            isDark={isDark}
            onClick={() => {
              onCaktoAccount("");
              setAnchorCakto(null);
            }}
          />
          {caktoAccounts.map((acc) => (
            <OptionRow
              key={acc.value}
              label={acc.label}
              active={String(caktoIntegrationId) === String(acc.value)}
              isDark={isDark}
              onClick={() => {
                onCaktoAccount(acc.value);
                setAnchorCakto(null);
              }}
            />
          ))}
        </Popover>
      ) : null}

      <Popover
        open={Boolean(anchorCampaign)}
        anchorEl={anchorCampaign}
        onClose={() => setAnchorCampaign(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        PaperProps={{ style: { ...popoverPaper(isDark), maxHeight: 320, overflowY: "auto" } }}
      >
        <OptionRow
          label="Todas as campanhas"
          active={!campaignId}
          isDark={isDark}
          onClick={() => {
            onCampaign("");
            setAnchorCampaign(null);
          }}
        />
        {campaigns.map((c) => (
          <OptionRow
            key={c.value}
            label={c.label}
            active={String(campaignId) === String(c.value)}
            isDark={isDark}
            onClick={() => {
              onCampaign(c.value);
              setAnchorCampaign(null);
            }}
          />
        ))}
      </Popover>

      <Popover
        open={Boolean(anchorMore)}
        anchorEl={anchorMore}
        onClose={() => setAnchorMore(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        PaperProps={{ style: popoverPaper(isDark) }}
      >
        <Typography style={{ fontSize: 11, fontWeight: 600, color: isDark ? "#a1a1aa" : "#64748B", marginBottom: 6 }}>
          Anúncio
        </Typography>
        <OptionRow
          label="Todos"
          active={!adId}
          isDark={isDark}
          onClick={() => {
            onAd("");
            setAnchorMore(null);
          }}
        />
        {ads.slice(0, 20).map((a) => (
          <OptionRow
            key={a.value}
            label={a.label}
            active={String(adId) === String(a.value)}
            isDark={isDark}
            onClick={() => {
              onAd(a.value);
              setAnchorMore(null);
            }}
          />
        ))}
        <Box mt={1.5}>
          <Typography style={{ fontSize: 11, fontWeight: 600, color: isDark ? "#a1a1aa" : "#64748B", marginBottom: 6 }}>
            Produto / Objetivo
          </Typography>
          <OptionRow
            label="Todos"
            active={!product}
            isDark={isDark}
            onClick={() => {
              onProduct("");
              setAnchorMore(null);
            }}
          />
          {productOptions.map((p) => (
            <OptionRow
              key={p.value}
              label={p.label}
              active={product === p.value}
              isDark={isDark}
              onClick={() => {
                onProduct(p.value);
                setAnchorMore(null);
              }}
            />
          ))}
        </Box>
      </Popover>
    </Box>
  );
}
