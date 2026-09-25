import React from "react";
import { Button, CircularProgress, IconButton, makeStyles, Tooltip } from "@material-ui/core";
import RefreshIcon from "@material-ui/icons/Refresh";
import VisibilityOutlinedIcon from "@material-ui/icons/VisibilityOutlined";
import VisibilityOffOutlinedIcon from "@material-ui/icons/VisibilityOffOutlined";
import UtmifyFilterSelect from "./UtmifyFilterSelect";
import { UTMIFY_FONT } from "./utmifyTheme";

const useStyles = makeStyles((theme) => {
  const isDark = theme.palette.type === "dark";
  return {
    bar: {
      fontFamily: UTMIFY_FONT,
      borderRadius: 12,
      padding: "14px 16px 10px",
      marginBottom: 14,
      background: isDark
        ? theme.palette.dashboardCard || "#252526"
        : "#ffffff",
      border: isDark
        ? "1px solid rgba(255,255,255,0.07)"
        : "1px solid rgba(15,23,42,0.07)",
    },
    head: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      marginBottom: 14,
      flexWrap: "wrap",
    },
    title: {
      margin: 0,
      fontFamily: UTMIFY_FONT,
      fontSize: 18,
      fontWeight: 650,
      letterSpacing: "-0.03em",
      color: isDark ? "#ffffff" : "#0f172a",
    },
    right: {
      display: "flex",
      alignItems: "center",
      gap: 10,
    },
    updated: {
      fontSize: 12,
      fontWeight: 500,
      color: isDark ? "rgba(248,250,252,0.5)" : "#94a3b8",
    },
    refresh: {
      textTransform: "none",
      borderRadius: 8,
      fontWeight: 600,
      fontSize: 13,
      fontFamily: UTMIFY_FONT,
      background: "#005eff",
      color: "#fff",
      height: 36,
      padding: "0 14px",
      "&:hover": { background: "#0047cc" },
    },
    filters: {
      display: "grid",
      gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
      gap: 12,
      [theme.breakpoints.down("lg")]: {
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
      },
      [theme.breakpoints.down("sm")]: {
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
      },
    },
    moreWrap: {
      display: "flex",
      justifyContent: "flex-end",
      marginTop: 8,
    },
    more: {
      appearance: "none",
      background: "none",
      border: 0,
      cursor: "pointer",
      fontFamily: UTMIFY_FONT,
      fontSize: 12,
      fontWeight: 500,
      color: isDark ? "rgba(248,250,252,0.55)" : "#64748b",
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      padding: "6px 0 2px",
    },
    extra: {
      display: "grid",
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
      gap: 12,
      marginTop: 12,
      [theme.breakpoints.down("sm")]: {
        gridTemplateColumns: "1fr",
      },
    },
  };
});

function relativeUpdated(fetchedAt) {
  if (!fetchedAt) return "Atualizado agora mesmo";
  const ms = Date.now() - new Date(fetchedAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "Atualizado agora mesmo";
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "Atualizado agora mesmo";
  if (mins === 1) return "Atualizado há 1 minuto";
  if (mins < 60) return `Atualizado há ${mins} minutos`;
  const hours = Math.floor(mins / 60);
  if (hours === 1) return "Atualizado há 1 hora";
  return `Atualizado há ${hours} horas`;
}

export default function ResumoFilterBar({
  datePreset,
  onDatePreset,
  dateOptions,
  adAccountId,
  onAdAccount,
  adAccounts,
  caktoIntegrationId,
  onCaktoAccount,
  caktoAccounts = [],
  trafficSource,
  onTrafficSource,
  platform,
  onPlatform,
  salesPlatform,
  onSalesPlatform,
  product,
  onProduct,
  productOptions,
  moreFilters,
  onToggleMore,
  campaignId,
  onCampaign,
  campaigns,
  adId,
  onAd,
  ads,
  fetchedAt,
  loading,
  onRefresh,
  hideValues,
  onToggleHide,
}) {
  const classes = useStyles();
  return (
    <section className={classes.bar}>
      <div className={classes.head}>
        <h2 className={classes.title}>Resumo</h2>
        <div className={classes.right}>
          <span className={classes.updated}>{relativeUpdated(fetchedAt)}</span>
          {typeof onToggleHide === "function" ? (
            <Tooltip title={hideValues ? "Mostrar valores" : "Ocultar valores"}>
              <IconButton size="small" onClick={onToggleHide}>
                {hideValues ? (
                  <VisibilityOffOutlinedIcon fontSize="small" />
                ) : (
                  <VisibilityOutlinedIcon fontSize="small" />
                )}
              </IconButton>
            </Tooltip>
          ) : null}
          <Button
            className={classes.refresh}
            disableElevation
            variant="contained"
            startIcon={
              loading ? (
                <CircularProgress size={14} color="inherit" />
              ) : (
                <RefreshIcon fontSize="small" />
              )
            }
            disabled={loading}
            onClick={onRefresh}
          >
            Atualizar
          </Button>
        </div>
      </div>
      <div className={classes.filters}>
        <UtmifyFilterSelect
          label="Período de Visualização"
          info="Recorte enviado à Marketing API da Meta."
          value={datePreset}
          onChange={onDatePreset}
          hideEmpty
          options={dateOptions}
        />
        <UtmifyFilterSelect
          label="Conta Meta Ads"
          value={adAccountId}
          onChange={onAdAccount}
          options={adAccounts}
        />
        <UtmifyFilterSelect
          label="Conta Cakto"
          value={caktoIntegrationId}
          onChange={onCaktoAccount}
          emptyLabel="Todas as contas"
          options={caktoAccounts}
          info="Filtra vendas e métricas pela conta Cakto conectada (suporta várias)."
        />
        <UtmifyFilterSelect
          label="Fonte de Tráfego"
          value={trafficSource}
          onChange={onTrafficSource}
          options={[
            { value: "ads", label: "Anúncios pagos" },
            { value: "organic", label: "Orgânico" },
            { value: "direct", label: "Direto" },
          ]}
        />
        <UtmifyFilterSelect
          label="Canal Meta"
          value={platform}
          onChange={onPlatform}
          options={[
            { value: "facebook", label: "Facebook" },
            { value: "instagram", label: "Instagram" },
          ]}
        />
        <UtmifyFilterSelect
          label="Plataforma"
          value={salesPlatform}
          onChange={onSalesPlatform}
          emptyLabel="Todas"
          info="Checkout de onde vêm as vendas vinculadas às campanhas."
          options={[
            { value: "cakto", label: "Cakto" },
            { value: "hotmart", label: "Hotmart" },
            { value: "kiwify", label: "Kiwify (em breve)", disabled: true },
            { value: "kirvano", label: "Kirvano (em breve)", disabled: true },
          ]}
        />
        <UtmifyFilterSelect
          label="Produto"
          value={product}
          onChange={onProduct}
          options={productOptions}
        />
      </div>
      <div className={classes.moreWrap}>
        <button type="button" className={classes.more} onClick={onToggleMore}>
          Mais filtros {moreFilters ? "▴" : "▾"}
        </button>
      </div>
      {moreFilters ? (
        <div className={classes.extra}>
          <UtmifyFilterSelect
            label="Campanha"
            value={campaignId}
            onChange={onCampaign}
            emptyLabel="Todas as campanhas"
            options={campaigns}
          />
          <UtmifyFilterSelect
            label="Anúncio"
            value={adId}
            onChange={onAd}
            emptyLabel="Todos os anúncios"
            options={ads}
          />
        </div>
      ) : null}
    </section>
  );
}
