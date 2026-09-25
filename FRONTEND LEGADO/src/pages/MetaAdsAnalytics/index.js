import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useHistory } from "react-router-dom";
import {
  Box,
  Button,
  CircularProgress,
  Typography,
  makeStyles,
  useTheme,
} from "@material-ui/core";
import {
  AttachMoney,
  TrendingUp,
  ShowChart,
  ShoppingCart,
  People,
  Visibility as VisibilityIcon,
  TouchApp,
  AccountBalance,
  MonetizationOn,
  Assessment,
  LocalOffer,
  Receipt,
  Speed,
} from "@material-ui/icons";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import ActivitiesStyleLayout from "../../components/ActivitiesStyleLayout";
import WhatsappMetricCard, {
  dashboardIndicatorGridStyles,
  whatsappDashboardPalette,
} from "../../components/Dashboard/WhatsappMetricCard";
import MetaAdsBrandIcon from "../../components/MetaAdsBrandIcon";
import { AuthContext } from "../../context/Auth/AuthContext";
import {
  buildMockMetaAdsAnalytics,
  isMetaAdsAnalyticsMockAccount,
  MOCK_META_AD_ACCOUNTS,
} from "./mockAnalytics";
import MetaAdsChartPanel from "./MetaAdsChartPanel";
import ResumoFilterBar from "./ResumoFilterBar";
import MetaAdsGoalsSection from "./MetaAdsGoalsSection";
import CampaignAdsTable from "./CampaignAdsTable";
import { money, numFmt, pctFmt, shortLabel } from "./formatters";
import { evaluateGoalStatus, getGoalFieldForSource } from "./metaAdsGoalUtils";
import {
  getMetaAdsAnalytics,
  getMetaAdsGoals,
  getMetaAdsInsightsConfig,
  listMetaAdsAccounts,
} from "../../services/metaAdsService";

const META_VIEW_TABS = [
  { value: "meta-ads", label: "Meta Ads" },
  { value: "goals", label: "Metas" },
];

const DATE_PRESETS = [
  { value: "today", label: "Hoje" },
  { value: "yesterday", label: "Ontem" },
  { value: "last_7d", label: "Últimos 7 dias" },
  { value: "last_14d", label: "Últimos 14 dias" },
  { value: "last_30d", label: "Últimos 30 dias" },
  { value: "last_90d", label: "Últimos 90 dias" },
  { value: "this_month", label: "Este mês" },
  { value: "last_month", label: "Mês passado" },
];

const PIE_COLORS = ["#2563EB", "#60A5FA", "#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899"];

const MOCK_ACCOUNT_IDS = new Set(
  MOCK_META_AD_ACCOUNTS.map((a) => String(a.adAccountId || a.id))
);

const useStyles = makeStyles((theme) => ({
  pageRoot: {
    width: "100%",
    maxWidth: "100%",
    boxSizing: "border-box",
    padding: theme.spacing(1, 1.5, 3),
    minHeight: "100%",
  },
  indicatorGrid: dashboardIndicatorGridStyles(theme),
  sectionTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: theme.palette.text.primary,
    margin: "20px 0 10px",
  },
  chartsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
    width: "100%",
    marginBottom: 12,
    [theme.breakpoints.down("sm")]: {
      gridTemplateColumns: "1fr",
    },
  },
  chartFull: {
    gridColumn: "1 / -1",
  },
  pageHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
    flexWrap: "wrap",
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: 700,
    letterSpacing: "-0.02em",
  },
  pageSubtitle: {
    fontSize: 13,
    color: theme.palette.text.secondary,
    marginTop: 2,
  },
  emptyWrap: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: theme.spacing(8, 2),
    textAlign: "center",
  },
}));

function sumRows(rows) {
  const base = {
    spend: 0,
    impressions: 0,
    clicks: 0,
    reach: 0,
    leads: 0,
    purchases: 0,
  };
  for (const row of rows) {
    base.spend += Number(row.spend) || 0;
    base.impressions += Number(row.impressions) || 0;
    base.clicks += Number(row.clicks) || 0;
    base.reach += Number(row.reach) || 0;
    base.leads += Number(row.leads) || 0;
    base.purchases += Number(row.purchases) || 0;
  }
  const ctr =
    base.impressions > 0 ? (base.clicks / base.impressions) * 100 : 0;
  const cpc = base.clicks > 0 ? base.spend / base.clicks : 0;
  const cpm =
    base.impressions > 0 ? (base.spend / base.impressions) * 1000 : 0;
  return { ...base, ctr, cpc, cpm };
}

export default function MetaAdsAnalytics() {
  const classes = useStyles();
  const theme = useTheme();
  const history = useHistory();
  const { user } = useContext(AuthContext);
  const palette = useMemo(() => whatsappDashboardPalette(theme), [theme]);
  const isDark = theme.palette.type === "dark";
  const useMockAnalytics = isMetaAdsAnalyticsMockAccount(user?.email);

  const [datePreset, setDatePreset] = useState("last_30d");
  const [campaignId, setCampaignId] = useState("");
  const [adId, setAdId] = useState("");
  const [adAccountId, setAdAccountId] = useState("");
  const [caktoIntegrationId, setCaktoIntegrationId] = useState("");
  const [platform, setPlatform] = useState("");
  const [salesPlatform, setSalesPlatform] = useState("");
  const [trafficSource, setTrafficSource] = useState("");
  const [product, setProduct] = useState("");
  const [moreFilters, setMoreFilters] = useState(false);
  const [hideValues, setHideValues] = useState(false);
  const [adAccounts, setAdAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [configuring, setConfiguring] = useState(true);
  const [configured, setConfigured] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("meta-ads");
  const [goals, setGoals] = useState({});
  const [goalsLoading, setGoalsLoading] = useState(true);

  const loadConfig = useCallback(async () => {
    if (useMockAnalytics) {
      setConfigured(true);
      setConfiguring(false);
      setError("");
      return;
    }
    try {
      const cfg = await getMetaAdsInsightsConfig();
      const hasConfig = Boolean(cfg?.configured);
      const isEnabled = cfg?.enabled !== false;
      setConfigured(hasConfig && isEnabled);
      if (!hasConfig) {
        setConfigured(false);
      } else if (!isEnabled) {
        setConfigured(false);
        setError("Integração Meta Ads Anúncios & Pixels está pausada.");
      }
    } catch {
      setConfigured(false);
    } finally {
      setConfiguring(false);
    }
  }, [useMockAnalytics]);

  const loadAnalytics = useCallback(
    async ({ refresh = false, silent = false } = {}) => {
      if (!silent) setLoading(true);
      if (!silent) setError("");
      try {
        if (useMockAnalytics) {
          const selected = String(adAccountId || "");
          const useMockPayload = !selected || MOCK_ACCOUNT_IDS.has(selected);
          if (useMockPayload) {
            setData(buildMockMetaAdsAnalytics(datePreset, adAccountId));
            return;
          }
        }
        const cacheKey = `meta-ads-analytics:${datePreset}:${adAccountId || "default"}:${caktoIntegrationId || "all"}`;
        // Paint instantâneo no F5 com último payload bom do browser
        if (!refresh && !silent) {
          try {
            const raw = window.sessionStorage.getItem(cacheKey);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (parsed?.kpis) setData(parsed);
            }
          } catch {
            // ignore
          }
        }
        const payload = await getMetaAdsAnalytics({
          datePreset,
          // Só força Meta no botão manual; polling/F5 usam cache do backend
          refresh: refresh ? "1" : undefined,
          adAccountId: adAccountId || undefined,
          caktoIntegrationId: caktoIntegrationId || undefined,
        });
        setData(payload);
        setError("");
        try {
          window.sessionStorage.setItem(cacheKey, JSON.stringify(payload));
        } catch {
          // ignore quota
        }
      } catch (err) {
        const msg =
          err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Não foi possível carregar as análises Ads.";
        setError(String(msg));
        // Nunca zerar o dashboard se já houver dados (ou snapshot local)
        if (!silent) {
          setData((prev) => {
            if (prev) return prev;
            try {
              const cacheKey = `meta-ads-analytics:${datePreset}:${adAccountId || "default"}:${caktoIntegrationId || "all"}`;
              const raw = window.sessionStorage.getItem(cacheKey);
              if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed?.kpis) return parsed;
              }
            } catch {
              // ignore
            }
            return prev;
          });
        }
        if (String(msg).toLowerCase().includes("configure")) {
          setConfigured(false);
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [datePreset, useMockAnalytics, adAccountId, caktoIntegrationId]
  );

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getMetaAdsGoals();
        if (!cancelled) setGoals(res?.goals || {});
      } catch {
        if (!cancelled) setGoals({});
      } finally {
        if (!cancelled) setGoalsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mockList = useMockAnalytics
        ? MOCK_META_AD_ACCOUNTS.map((a) => ({
            ...a,
            adAccountId: a.adAccountId || a.id,
            source: "mock",
          }))
        : [];
      let extras = [];
      try {
        const res = await listMetaAdsAccounts();
        extras = Array.isArray(res?.accounts) ? res.accounts : [];
      } catch {
        extras = [];
      }
      if (cancelled) return;
      const seen = new Set();
      const merged = [];
      [...mockList, ...extras].forEach((a) => {
        const id = String(a.adAccountId || a.id || "");
        if (!id || seen.has(id)) return;
        seen.add(id);
        merged.push({ ...a, adAccountId: id });
      });
      setAdAccounts(merged);
    })();
    return () => {
      cancelled = true;
    };
  }, [useMockAnalytics]);

  useEffect(() => {
    if (configuring) return;
    if (!configured) {
      setLoading(false);
      return;
    }
    loadAnalytics();
  }, [configured, configuring, loadAnalytics]);

  useEffect(() => {
    if (configuring || !configured) return undefined;
    // Soft refresh (com cache) — NÃO forceRefresh (estoura rate limit da Meta)
    const tick = () => loadAnalytics({ refresh: false, silent: true });
    const id = window.setInterval(tick, 3 * 60 * 1000);
    const onFocus = () => {
      if (document.visibilityState === "visible") tick();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [configured, configuring, loadAnalytics]);

  useEffect(() => {
    setCampaignId("");
    setAdId("");
  }, [datePreset, adAccountId]);

  const currency = data?.account?.currency || "BRL";
  const campaignInsights = useMemo(
    () => (Array.isArray(data?.campaignInsights) ? data.campaignInsights : []),
    [data]
  );
  const adInsights = useMemo(
    () => (Array.isArray(data?.adInsights) ? data.adInsights : []),
    [data]
  );
  const adsCatalog = useMemo(
    () => (Array.isArray(data?.ads) ? data.ads : []),
    [data]
  );
  const campaignsCatalog = useMemo(() => {
    const fromInsights = campaignInsights.map((c) => ({
      id: c.campaignId,
      name: c.campaignName || c.campaignId,
    }));
    const fromList = (Array.isArray(data?.campaigns) ? data.campaigns : []).map(
      (c) => ({ id: c.id, name: c.name || c.id })
    );
    const map = new Map();
    [...fromInsights, ...fromList].forEach((c) => {
      if (c.id) map.set(String(c.id), c);
    });
    return Array.from(map.values());
  }, [campaignInsights, data]);

  const adsForFilter = useMemo(() => {
    const fromInsights = adInsights.map((a) => ({
      id: a.id,
      name: a.name || a.id,
      campaignId: a.campaignId,
    }));
    const fromList = adsCatalog.map((a) => ({
      id: a.id,
      name: a.name || a.id,
      campaignId: a.campaign_id || a.campaignId,
    }));
    const map = new Map();
    [...fromInsights, ...fromList].forEach((a) => {
      if (!a.id) return;
      if (campaignId && String(a.campaignId || "") !== String(campaignId)) return;
      map.set(String(a.id), a);
    });
    return Array.from(map.values());
  }, [adInsights, adsCatalog, campaignId]);

  useEffect(() => {
    if (adId && !adsForFilter.some((a) => String(a.id) === String(adId))) {
      setAdId("");
    }
  }, [adsForFilter, adId]);

  const filteredCampaignInsights = useMemo(() => {
    let rows = campaignInsights;
    if (adId) {
      const ad = adInsights.find((a) => String(a.id) === String(adId));
      if (!ad) return [];
      rows = [
        {
          campaignId: ad.campaignId,
          campaignName: ad.campaignName || ad.name,
          impressions: ad.impressions,
          clicks: ad.clicks,
          spend: ad.spend,
          cpc: ad.cpc,
          ctr: ad.ctr,
          cpm: ad.cpm,
          reach: ad.reach,
          leads: ad.leads,
          purchases: ad.purchases,
        },
      ];
    } else if (campaignId) {
      rows = rows.filter((c) => String(c.campaignId) === String(campaignId));
    }
    const catalog = Array.isArray(data?.campaigns) ? data.campaigns : [];
    if (platform || product || salesPlatform) {
      rows = rows.filter((c) => {
        const meta = catalog.find((m) => String(m.id) === String(c.campaignId));
        if (platform) {
          const p = String(meta?.platform || "").toLowerCase();
          if (p && p !== platform) return false;
        }
        if (product) {
          const prod = String(meta?.product || meta?.objective || "");
          if (prod && prod !== product) return false;
        }
        if (salesPlatform) {
          const src = String(
            c.salesPlatform ||
              c.productSource ||
              meta?.salesPlatform ||
              meta?.checkoutPlatform ||
              meta?.productSource ||
              ""
          ).toLowerCase();
          // Sem marcação na campanha: Cakto é o padrão quando há conta Cakto ativa.
          if (salesPlatform === "cakto") {
            if (src && src !== "cakto") return false;
          } else if (salesPlatform === "hotmart") {
            if (src !== "hotmart") return false;
          } else {
            return false;
          }
        }
        return true;
      });
    }
    if (trafficSource && trafficSource !== "ads") {
      return [];
    }
    return rows;
  }, [
    adId,
    campaignId,
    adInsights,
    campaignInsights,
    data,
    product,
    platform,
    salesPlatform,
    trafficSource,
  ]);

  const filteredAdInsights = useMemo(() => {
    let rows = adInsights;
    if (campaignId) {
      rows = rows.filter((a) => String(a.campaignId) === String(campaignId));
    }
    if (adId) {
      rows = rows.filter((a) => String(a.id) === String(adId));
    }
    return rows;
  }, [adInsights, campaignId, adId]);

  const filteredKpis = useMemo(() => {
    const base = data?.kpis || {};
    const scoped = adId
      ? filteredAdInsights
      : campaignId
        ? filteredCampaignInsights
        : null;
    if (!scoped) return base;
    const s = sumRows(scoped);
    return {
      ...base,
      spend: s.spend,
      impressions: s.impressions,
      clicks: s.clicks,
      reach: s.reach,
      ctr: s.ctr,
      cpc: s.cpc,
      cpm: s.cpm,
      metaLeadsReported: s.leads,
      metaPurchasesReported: s.purchases,
    };
  }, [data, campaignId, adId, filteredAdInsights, filteredCampaignInsights]);

  const kpis = useMemo(() => {
    const base = filteredKpis || {};
    const spend = Number(base.spend) || 0;
    const revenue = Number(base.crmRevenueFromAds ?? base.valorRecebido) || 0;
    const gross = Number(base.valorGanho) || revenue;
    const leads = Number(base.metaLeadsReported) || 0;
    const purchases = Number(base.metaPurchasesReported) || 0;
    const lucro = base.lucro != null ? Number(base.lucro) : revenue - spend;
    const lucroTotal = base.lucroTotal != null ? Number(base.lucroTotal) : gross - spend - (Number(base.fees) || 0);
    const lucroLiquido = base.lucroLiquido != null ? Number(base.lucroLiquido) : lucro - (Number(base.productCosts) || 0);
    const roi = base.roi != null ? Number(base.roi) : spend > 0 ? (lucro / spend) * 100 : 0;
    const roas = base.roas != null ? Number(base.roas) : spend > 0 && revenue > 0 ? revenue / spend : 0;
    const margem = base.margem != null ? Number(base.margem) : revenue > 0 ? (lucro / revenue) * 100 : 0;
    const cpa = base.cpa != null ? Number(base.cpa) : leads > 0 ? spend / leads : purchases > 0 ? spend / purchases : 0;
    const fees = Number(base.fees) || 0;
    const refunds = Number(base.refunds) || 0;
    const pendingSales = Number(base.pendingSales) || 0;
    const productCosts = Number(base.productCosts) || 0;
    const metaAdsTax = Number(base.metaAdsTax) || spend * 0.05;
    const salesTax = Number(base.salesTax) || gross * 0.06;
    const totalTax = Number(base.totalTax) || metaAdsTax + salesTax;
    const extraExpenses = Number(base.extraExpenses) || productCosts;
    const refundRate = base.refundRate != null ? Number(base.refundRate) : gross > 0 ? (refunds / gross) * 100 : 0;
  const caktoOrders = Number(base.caktoOrders) || (Array.isArray(data?.cakto?.analyticsByCampaign)
    ? data.cakto.analyticsByCampaign.reduce((a, r) => a + (Number(r.order_count) || 0), 0)
    : purchases);
    return {
      ...base,
      crmRevenueFromAds: revenue,
      valorGanho: gross,
      valorRecebido: revenue,
      lucro,
      lucroTotal,
      lucroLiquido,
      roi,
      roas,
      margem,
      cpa,
      fees,
      refunds,
      pendingSales,
      productCosts,
      metaAdsTax,
      salesTax,
      totalTax,
      extraExpenses,
      refundRate,
      caktoOrders,
    };
  }, [filteredKpis, data]);

  const fmt = (v, formatter) => (hideValues ? "••••" : formatter(v));

  const indicatorMetrics = useMemo(
    () => [
      { title: "Faturamento Líquido", value: fmt(kpis.crmRevenueFromAds, (v) => money(v, currency)), subtitle: kpis.caktoConnected ? "Cakto" : "CRM", icon: <AttachMoney style={{ fontSize: 26 }} />, accent: palette.green, goalSource: "crmRevenueFromAds" },
      { title: "Gastos com anúncios", value: fmt(kpis.spend, (v) => money(v, currency)), subtitle: "Meta Ads", icon: <LocalOffer style={{ fontSize: 26 }} />, accent: palette.red, goalSource: "spend" },
      { title: "ROAS", value: fmt(kpis.roas, (v) => numFmt(v, 2)), subtitle: "Retorno", icon: <TrendingUp style={{ fontSize: 26 }} />, accent: palette.blue, goalSource: "roas" },
      { title: "Lucro", value: fmt(kpis.lucro, (v) => money(v, currency)), subtitle: "Receita − gasto", icon: <ShowChart style={{ fontSize: 26 }} />, accent: palette.green, goalSource: "lucro" },
      { title: "Lucro total", value: fmt(kpis.lucroTotal, (v) => money(v, currency)), subtitle: "Bruto − gastos", icon: <Assessment style={{ fontSize: 26 }} />, accent: "#8B5CF6", goalSource: "lucroTotal" },
      { title: "Lucro líquido", value: fmt(kpis.lucroLiquido, (v) => money(v, currency)), subtitle: "Após custos", icon: <AttachMoney style={{ fontSize: 26 }} />, accent: "#059669", goalSource: "lucroLiquido" },
      { title: "ROI", value: fmt(kpis.roi, (v) => pctFmt(v, 1)), subtitle: "Retorno invest.", icon: <Speed style={{ fontSize: 26 }} />, accent: palette.blueDark, goalSource: "roi" },
      { title: "Reembolsos", value: fmt(kpis.refunds, (v) => money(v, currency)), subtitle: "Cakto", icon: <Receipt style={{ fontSize: 26 }} />, accent: palette.red },
      { title: "Margem", value: fmt(kpis.margem, (v) => pctFmt(v, 1)), subtitle: "Lucro / receita", icon: <TrendingUp style={{ fontSize: 26 }} />, accent: palette.green, goalSource: "margem" },
      { title: "Despesas adicionais", value: fmt(kpis.extraExpenses, (v) => money(v, currency)), subtitle: "Custos extras", icon: <Receipt style={{ fontSize: 26 }} />, accent: "#64748B" },
      { title: "Imposto sobre vendas", value: fmt(kpis.salesTax, (v) => money(v, currency)), subtitle: "Est. 6%", icon: <AccountBalance style={{ fontSize: 26 }} />, accent: "#94A3B8" },
      { title: "Taxa reembolso", value: fmt(kpis.refundRate, (v) => pctFmt(v, 1)), subtitle: "Sobre bruto", icon: <LocalOffer style={{ fontSize: 26 }} />, accent: palette.amber },
      { title: "Taxas Cakto", value: fmt(kpis.fees, (v) => money(v, currency)), subtitle: "Gateway", icon: <MonetizationOn style={{ fontSize: 26 }} />, accent: "#6366F1", goalSource: "fees" },
      { title: "CPA", value: fmt(kpis.cpa, (v) => money(v, currency)), subtitle: "Custo por conversão", icon: <People style={{ fontSize: 26 }} />, accent: palette.blue, goalSource: "cpa" },
      { title: "Impressões", value: fmt(kpis.impressions, numFmt), subtitle: `Alcance ${numFmt(kpis.reach)}`, icon: <VisibilityIcon style={{ fontSize: 26 }} />, accent: palette.blueLight, goalSource: "impressions" },
      { title: "Cliques", value: fmt(kpis.clicks, numFmt), subtitle: `CTR ${numFmt(kpis.ctr, 2)}%`, icon: <TouchApp style={{ fontSize: 26 }} />, accent: palette.blueDark, goalSource: "clicks" },
      { title: "CPC médio", value: fmt(kpis.cpc, (v) => money(v, currency)), subtitle: `CPM ${money(kpis.cpm, currency)}`, icon: <Speed style={{ fontSize: 26 }} />, accent: "#0EA5E9" },
      { title: "Vendas / Pedidos", value: fmt(kpis.caktoOrders || kpis.metaPurchasesReported, numFmt), subtitle: kpis.caktoConnected ? "Cakto + Meta" : "Meta", icon: <ShoppingCart style={{ fontSize: 26 }} />, accent: "#10B981", goalKey: "purchases" },
      { title: "Imposto Meta Ads", value: fmt(kpis.metaAdsTax, (v) => money(v, currency)), subtitle: "Est. 5% ISS", icon: <AccountBalance style={{ fontSize: 26 }} />, accent: "#94A3B8" },
      { title: "Imposto total", value: fmt(kpis.totalTax, (v) => money(v, currency)), subtitle: "Meta + vendas", icon: <Receipt style={{ fontSize: 26 }} />, accent: "#64748B" },
    ],
    [kpis, currency, hideValues, palette]
  );

  const enrichedIndicatorMetrics = useMemo(
    () =>
      indicatorMetrics.map((m) => {
        const field = m.goalKey
          ? { key: m.goalKey, source: "metaPurchasesReported", inverse: false }
          : m.goalSource
            ? getGoalFieldForSource(m.goalSource)
            : null;
        if (!field) {
          return { ...m, goalStatus: "none", goalHint: null };
        }
        const actual =
          m.goalKey === "purchases"
            ? Number(kpis.caktoOrders || kpis.metaPurchasesReported) || 0
            : Number(kpis[field.source]) || 0;
        const goal = goals[field.key];
        const evalStatus = evaluateGoalStatus(actual, goal, { inverse: field.inverse });
        return {
          ...m,
          goalStatus: evalStatus.status,
          goalHint: evalStatus.hint,
        };
      }),
    [indicatorMetrics, goals, kpis]
  );

  const productOptions = useMemo(() => {
    const set = new Set();
    (Array.isArray(data?.campaigns) ? data.campaigns : []).forEach((c) => {
      if (c.product) set.add(c.product);
      else if (c.objective) set.add(c.objective);
    });
    return Array.from(set);
  }, [data]);

  const spendByCampaignChart = useMemo(
    () =>
      filteredCampaignInsights.slice(0, 10).map((row) => ({
        name: shortLabel(row.campaignName || row.campaignId),
        spend: Number(row.spend) || 0,
        clicks: Number(row.clicks) || 0,
        leads: Number(row.leads) || 0,
        ctr: Number(row.ctr) || 0,
      })),
    [filteredCampaignInsights]
  );

  const dailyChart = useMemo(() => {
    const rows = Array.isArray(data?.dailyInsights) ? data.dailyInsights : [];
    const spendGoal = Number(goals.spend) || 0;
    const revenueGoal = Number(goals.revenue) || 0;
    const n = rows.length || 1;
    const dailySpendTarget = spendGoal > 0 ? spendGoal / n : 0;
    const dailyRevenueTarget = revenueGoal > 0 ? revenueGoal / n : 0;
    return rows.map((row, idx) => ({
      date: row.date
        ? new Date(`${row.date}T12:00:00`).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
          })
        : "—",
      spend: Number(row.spend) || 0,
      clicks: Number(row.clicks) || 0,
      impressions: Number(row.impressions) || 0,
      leads: Number(row.leads) || 0,
      spendGoalDaily: dailySpendTarget || null,
      spendGoalCumulative: spendGoal > 0 ? dailySpendTarget * (idx + 1) : null,
      revenueGoalCumulative: revenueGoal > 0 ? dailyRevenueTarget * (idx + 1) : null,
    }));
  }, [data, goals.spend, goals.revenue]);

  const funnelChart = useMemo(() => {
    const impressions = Number(kpis.impressions) || 0;
    const clicks = Number(kpis.clicks) || 0;
    const leads = Number(kpis.metaLeadsReported) || 0;
    const impressionGoal = Number(goals.impressions) || 0;
    const clickGoal = Number(goals.clicks) || 0;
    const leadGoal = Number(goals.leads) || 0;
    return [
      { name: "Impressões", value: impressions, goal: impressionGoal || null },
      { name: "Cliques", value: clicks, goal: clickGoal || null },
      { name: "Leads Meta", value: leads, goal: leadGoal || null },
    ];
  }, [kpis, goals.impressions, goals.clicks, goals.leads]);

  const spendShareChart = useMemo(() => {
    const rows = filteredCampaignInsights
      .filter((r) => Number(r.spend) > 0)
      .slice(0, 7)
      .map((r) => ({
        name: shortLabel(r.campaignName || r.campaignId, 20),
        value: Number(r.spend) || 0,
      }));
    return rows;
  }, [filteredCampaignInsights]);

  const efficiencyChart = useMemo(
    () =>
      filteredCampaignInsights.slice(0, 8).map((row) => ({
        name: shortLabel(row.campaignName || row.campaignId, 22),
        cpc: Number(row.cpc) || 0,
        ctr: Number(row.ctr) || 0,
        spend: Number(row.spend) || 0,
      })),
    [filteredCampaignInsights]
  );

  const selectedAccount =
    adAccounts.find(
      (a) => String(a.adAccountId || a.id) === String(adAccountId)
    ) ||
    adAccounts.find((a) => a.primary) ||
    adAccounts[0];
  const accountLabel =
    data?.account?.name ||
    selectedAccount?.name ||
    "Conta Meta Ads";
  const appLabel =
    data?.account?.appName ||
    data?.account?.businessName ||
    (typeof window !== "undefined" && window.localStorage.getItem("appName")) ||
    "VB Solution";

  const caktoAccounts = useMemo(() => {
    const list = data?.cakto?.connections || [];
    return list.map((c) => ({
      value: String(c.id),
      label: c.accountLabel || `Cakto #${c.id}`,
    }));
  }, [data?.cakto?.connections]);

  const selectedCaktoLabel = useMemo(() => {
    if (!caktoIntegrationId) return null;
    return caktoAccounts.find((c) => c.value === String(caktoIntegrationId))?.label;
  }, [caktoAccounts, caktoIntegrationId]);

  const exportPayload = useMemo(
    () => (data ? { ...data, kpis } : null),
    [data, kpis]
  );

  const goSetup = () => history.push("/connections/meta-ads/manage");

  const axisTick = {
    fontSize: 11,
    fill: isDark ? "#cbd5e1" : "#64748b",
  };
  const chartTooltipStyle = {
    borderRadius: 10,
    border: `1px solid ${palette.border}`,
    background: isDark ? palette.card : "#fff",
    color: palette.text,
    fontSize: 12,
    boxShadow: palette.shadow,
  };

  return (
    <ActivitiesStyleLayout
      description="Dashboard Meta Ads"
      viewModes={configured ? META_VIEW_TABS : []}
      currentViewMode={activeTab}
      onViewModeChange={setActiveTab}
      disableFilterBar
      hideDefaultRightFilters
      hideSearch
      hideNavDivider
      hideHeaderDivider
      hideCreateButton
      hidePageHelp
      pageScroll
      fillViewport={false}
      scrollContent={false}
      contentEdgeToEdge={false}
      rootBackground={palette.bg}
    >
      <Box className={classes.pageRoot} style={{ background: palette.bg, minHeight: "100%" }}>
        {(configuring || (loading && !data && configured && activeTab === "meta-ads")) && (
          <Box className={classes.emptyWrap}>
            <CircularProgress size={32} />
            <Typography variant="body2" color="textSecondary">
              Carregando dados da Marketing API…
            </Typography>
          </Box>
        )}

        {!configuring && configured && (data || activeTab === "goals") ? (
          <>
            {activeTab === "meta-ads" && data ? (
              <>
            <ResumoFilterBar
              datePreset={datePreset}
              onDatePreset={setDatePreset}
              dateOptions={DATE_PRESETS}
              adAccountId={adAccountId}
              onAdAccount={setAdAccountId}
              adAccounts={adAccounts.map((acc) => ({
                value: String(acc.adAccountId || acc.id),
                label: acc.name || acc.adAccountId,
              }))}
              caktoIntegrationId={caktoIntegrationId}
              onCaktoAccount={setCaktoIntegrationId}
              caktoAccounts={caktoAccounts}
              trafficSource={trafficSource}
              onTrafficSource={setTrafficSource}
              platform={platform}
              onPlatform={setPlatform}
              salesPlatform={salesPlatform}
              onSalesPlatform={setSalesPlatform}
              product={product}
              onProduct={setProduct}
              productOptions={productOptions.map((p) => ({ value: p, label: p }))}
              moreFilters={moreFilters}
              onToggleMore={() => setMoreFilters((v) => !v)}
              campaignId={campaignId}
              onCampaign={(v) => {
                setCampaignId(v);
                setAdId("");
              }}
              campaigns={campaignsCatalog.map((c) => ({
                value: String(c.id),
                label: c.name,
              }))}
              adId={adId}
              onAd={setAdId}
              ads={adsForFilter.map((a) => ({
                value: String(a.id),
                label: a.name,
              }))}
              fetchedAt={data?.fetchedAt}
              loading={loading}
              onRefresh={() => loadAnalytics({ refresh: true })}
              hideValues={hideValues}
              onToggleHide={() => setHideValues((v) => !v)}
            />

            {(data?.stale || error) && (
              <Typography
                variant="body2"
                style={{
                  marginBottom: 12,
                  padding: "10px 14px",
                  borderRadius: 10,
                  background: isDark ? "rgba(245,158,11,0.12)" : "rgba(245,158,11,0.1)",
                  color: isDark ? "#fbbf24" : "#b45309",
                }}
              >
                {data?.stale
                  ? "Exibindo último snapshot salvo — a Meta estava lenta ou com limite de requisições. Os números continuam disponíveis."
                  : error}
              </Typography>
            )}

            <Box className={classes.pageHeader}>
              <Box>
                <Typography className={classes.pageTitle}>Meta Ads Analytics</Typography>
                <Typography className={classes.pageSubtitle}>
                  {accountLabel} · {appLabel}
                  {kpis.caktoConnected
                    ? selectedCaktoLabel
                      ? ` · Cakto: ${selectedCaktoLabel}`
                      : caktoAccounts.length > 1
                        ? " · Cakto: todas as contas"
                        : " · Cakto conectada"
                    : ""}
                </Typography>
              </Box>
            </Box>

            <Typography className={classes.sectionTitle}>Indicadores</Typography>
            <div className={classes.indicatorGrid}>
              {enrichedIndicatorMetrics.map((m) => (
                <WhatsappMetricCard
                  key={m.title}
                  palette={palette}
                  isDark={isDark}
                  title={m.title}
                  value={m.value}
                  subtitle={m.subtitle}
                  icon={m.icon}
                  accent={m.accent}
                  goalStatus={m.goalStatus}
                  goalHint={m.goalHint}
                />
              ))}
            </div>

            <Typography className={classes.sectionTitle}>Análise de dados</Typography>
            <div className={classes.chartsGrid}>
              <MetaAdsChartPanel
                title="Evolução diária · gasto e cliques"
                subtitle={
                  Number(goals.spend) > 0
                    ? "Linha tracejada = meta acumulada de gasto no período"
                    : "Série diária da Marketing API"
                }
                palette={palette}
                empty={
                  dailyChart.length === 0 || campaignId || adId
                    ? "Limpe filtros de campanha/anúncio para ver a série diária."
                    : null
                }
              >
                <ResponsiveContainer width="100%" height={220}>
                  <ComposedChart data={dailyChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={palette.border} />
                    <XAxis dataKey="date" tick={axisTick} />
                    <YAxis yAxisId="left" tick={axisTick} width={48} />
                    <YAxis yAxisId="right" orientation="right" tick={axisTick} width={40} />
                    <RTooltip contentStyle={chartTooltipStyle} formatter={(v, name) => {
                      if (name === "Gasto" || name === "Meta gasto (acum.)") return money(v, currency);
                      return numFmt(v);
                    }} />
                    <Legend />
                    <Area yAxisId="left" type="monotone" dataKey="spend" name="Gasto" fill="rgba(37,99,235,0.2)" stroke={palette.blueDark} strokeWidth={2} />
                    {Number(goals.spend) > 0 ? (
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="spendGoalCumulative"
                        name="Meta gasto (acum.)"
                        stroke={palette.amber}
                        strokeWidth={2}
                        strokeDasharray="6 4"
                        dot={false}
                      />
                    ) : null}
                    {Number(goals.spend) > 0 ? (
                      <ReferenceLine
                        yAxisId="left"
                        y={dailyChart[0]?.spendGoalDaily}
                        stroke={palette.green}
                        strokeDasharray="4 4"
                        label={{ value: "Meta/dia", fill: palette.sub, fontSize: 10 }}
                      />
                    ) : null}
                    <Line yAxisId="right" type="monotone" dataKey="clicks" name="Cliques" stroke={palette.blueLight} strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </MetaAdsChartPanel>

              <MetaAdsChartPanel
                title="Funil · impressões → cliques → leads"
                subtitle={
                  Number(goals.impressions) > 0 || Number(goals.clicks) > 0
                    ? "Barras claras = meta do período"
                    : null
                }
                palette={palette}
              >
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={funnelChart} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={palette.border} horizontal={false} />
                    <XAxis type="number" tick={axisTick} />
                    <YAxis type="category" dataKey="name" width={88} tick={axisTick} />
                    <RTooltip contentStyle={chartTooltipStyle} formatter={(v) => numFmt(v)} />
                    <Bar dataKey="value" name="Atual" radius={[0, 6, 6, 0]}>
                      {funnelChart.map((row, i) => {
                        const evalStatus = evaluateGoalStatus(row.value, row.goal);
                        const fill =
                          evalStatus.status === "good"
                            ? palette.green
                            : evalStatus.status === "bad"
                              ? palette.red
                              : PIE_COLORS[i % PIE_COLORS.length];
                        return <Cell key={i} fill={fill} />;
                      })}
                    </Bar>
                    <Bar dataKey="goal" name="Meta" fill="rgba(148,163,184,0.35)" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </MetaAdsChartPanel>

              <MetaAdsChartPanel
                title="Distribuição de verba"
                palette={palette}
                empty={spendShareChart.length === 0 ? "Sem gasto no filtro atual." : null}
              >
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={spendShareChart} dataKey="value" nameKey="name" innerRadius={48} outerRadius={78} paddingAngle={2}>
                      {spendShareChart.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <RTooltip contentStyle={chartTooltipStyle} formatter={(v) => money(v, currency)} />
                    <Legend wrapperStyle={{ fontSize: 11, color: palette.sub }} />
                  </PieChart>
                </ResponsiveContainer>
              </MetaAdsChartPanel>

              <MetaAdsChartPanel
                title="Gasto por campanha"
                palette={palette}
                empty={spendByCampaignChart.length === 0 ? "Sem insights de campanha." : null}
              >
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={spendByCampaignChart} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={palette.border} />
                    <XAxis dataKey="name" tick={{ ...axisTick, fontSize: 10 }} interval={0} />
                    <YAxis tick={axisTick} width={48} />
                    <RTooltip contentStyle={chartTooltipStyle} formatter={(v) => money(v, currency)} />
                    <Bar dataKey="spend" name="Gasto" fill={palette.blueDark} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </MetaAdsChartPanel>

              <div className={classes.chartFull}>
                <MetaAdsChartPanel
                  title="Eficiência · CPC × CTR por campanha"
                  palette={palette}
                  minHeight={300}
                  empty={efficiencyChart.length === 0 ? "Sem dados de eficiência." : null}
                >
                  <ResponsiveContainer width="100%" height={260}>
                    <ComposedChart data={efficiencyChart} margin={{ top: 8, right: 16, left: 0, bottom: 12 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={palette.border} />
                      <XAxis dataKey="name" tick={{ ...axisTick, fontSize: 11 }} interval={0} height={48} />
                      <YAxis yAxisId="left" tick={axisTick} width={52} />
                      <YAxis yAxisId="right" orientation="right" tick={axisTick} width={44} />
                      <RTooltip
                        contentStyle={chartTooltipStyle}
                        formatter={(v, name) => (name === "cpc" || name === "CPC" ? money(v, currency) : `${numFmt(v, 2)}%`)}
                      />
                      <Legend wrapperStyle={{ fontSize: 12, color: palette.sub }} />
                      <Bar yAxisId="left" dataKey="cpc" name="CPC" fill="#8B5CF6" radius={[4, 4, 0, 0]} maxBarSize={48} />
                      {Number(goals.cpa) > 0 ? (
                        <ReferenceLine
                          yAxisId="left"
                          y={Number(goals.cpa)}
                          stroke={palette.amber}
                          strokeDasharray="5 4"
                          label={{ value: "Meta CPA", fill: palette.sub, fontSize: 10 }}
                        />
                      ) : null}
                      <Line yAxisId="right" type="monotone" dataKey="ctr" name="CTR %" stroke={palette.green} strokeWidth={2} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </MetaAdsChartPanel>
              </div>
            </div>

            {error ? (
              <Typography color="error" variant="body2" style={{ marginBottom: 12 }}>
                {error}
              </Typography>
            ) : null}

            <CampaignAdsTable
              data={exportPayload}
              campaignInsights={filteredCampaignInsights}
              adInsights={filteredAdInsights}
              currency={currency}
              loading={loading}
              onRefresh={() => loadAnalytics({ refresh: true })}
            />
              </>
            ) : activeTab === "goals" ? (
              <MetaAdsGoalsSection
                kpis={kpis}
                currency={currency}
                palette={palette}
                isDark={isDark}
                hideValues={hideValues}
                goals={goals}
                setGoals={setGoals}
                loading={goalsLoading}
                onGoalsSaved={setGoals}
              />
            ) : null}
          </>
        ) : null}

        {!configuring && configured && !data && !loading && (
          <Box className={classes.emptyWrap}>
            <MetaAdsBrandIcon size={48} />
            <Typography variant="h6" style={{ fontWeight: 600 }}>
              Carregando indicadores…
            </Typography>
            <Typography variant="body2" color="textSecondary" style={{ maxWidth: 440 }}>
              {error ||
                "Buscando o último snapshot da Marketing API. Se a Meta estiver lenta, o CRM usa o cache automaticamente."}
            </Typography>
            <Box
              display="flex"
              flexWrap="wrap"
              justifyContent="center"
              style={{ gap: 8 }}
            >
              <Button
                variant="contained"
                color="primary"
                onClick={() => loadAnalytics({ refresh: false })}
                style={{ textTransform: "none" }}
              >
                Tentar novamente
              </Button>
              <Button
                variant="outlined"
                onClick={() => loadAnalytics({ refresh: true })}
                style={{ textTransform: "none" }}
              >
                Forçar atualização Meta
              </Button>
              <Button
                variant="outlined"
                onClick={goSetup}
                style={{ textTransform: "none" }}
              >
                Abrir integração
              </Button>
            </Box>
          </Box>
        )}

        {!configuring && !configured && (
          <Box className={classes.emptyWrap}>
            <MetaAdsBrandIcon size={48} />
            <Typography variant="h6" style={{ fontWeight: 600 }}>
              Conecte Anúncios &amp; Pixels
            </Typography>
            <Typography variant="body2" color="textSecondary" style={{ maxWidth: 420 }}>
              Configure a Marketing API em Integrações → Meta Ads → aba{" "}
              <strong>Anúncios &amp; Pixels</strong> para ver campanhas, pixels e indicadores reais.
            </Typography>
            {error ? (
              <Typography variant="body2" color="error">
                {error}
              </Typography>
            ) : null}
            <Button variant="contained" color="primary" onClick={goSetup} style={{ textTransform: "none" }}>
              Abrir Integração
            </Button>
          </Box>
        )}
      </Box>
    </ActivitiesStyleLayout>
  );
}
