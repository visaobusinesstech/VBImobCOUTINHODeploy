import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useHistory } from "react-router-dom";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Tooltip,
  Typography,
  makeStyles,
} from "@material-ui/core";
import {
  Add,
  DeleteOutline,
  Launch,
  Link,
  Refresh,
  Visibility,
  VisibilityOff,
} from "@material-ui/icons";
import { toast } from "react-toastify";
import caktoIntegrationService from "../../../services/caktoIntegrationService";
import {
  getMetaAdsAnalytics,
  listMetaAdsCampaigns,
} from "../../../services/metaAdsService";
import { CONNECTIONS_FONT } from "../connectionsTypography";
import { useSetupHeaderActions } from "../ConnectionsChannelLayout";
import caktoIcon from "../../../assets/cakto-icon.png";

const CAKTO_GREEN = "#0B8F5A";
const CAKTO_GREEN_DARK = "#087a4c";
const CAKTO_PANEL_URL = "https://app.cakto.com.br";

const CAMPAIGN_FILTERS = [
  { key: "all", label: "Todas" },
  { key: "active", label: "Ativas" },
  { key: "paused", label: "Pausadas" },
  { key: "archived", label: "Arquivadas" },
  { key: "deleted", label: "Excluídas" },
];

const useStyles = makeStyles((theme) => {
  const isDark = theme.palette.type === "dark";
  const border = isDark ? "rgba(255,255,255,0.1)" : "rgba(15,23,42,0.08)";
  const inputBg = isDark ? "rgba(255,255,255,0.05)" : "rgba(15,23,42,0.02)";
  return {
    root: {
      fontFamily: CONNECTIONS_FONT,
      width: "100%",
      maxWidth: "100%",
      boxSizing: "border-box",
      display: "grid",
      gridTemplateColumns: "1fr",
      gap: theme.spacing(2.5),
      padding: theme.spacing(0, 0.5, 2),
      [theme.breakpoints.up("md")]: {
        gridTemplateColumns: "minmax(0, 1fr) minmax(280px, min(42vw, 400px))",
        padding: theme.spacing(0, 1, 2),
      },
    },
    formCol: {
      display: "flex",
      flexDirection: "column",
      gap: theme.spacing(2),
      minWidth: 0,
      paddingTop: theme.spacing(2),
    },
    asideCol: {
      minWidth: 0,
      paddingTop: theme.spacing(2),
    },
    wireframe: {
      position: "relative",
      overflow: "hidden",
      borderRadius: 20,
      border: `1px solid ${isDark ? "rgba(11,143,90,0.45)" : "rgba(11,143,90,0.28)"}`,
      background: isDark
        ? "linear-gradient(145deg, rgba(11,143,90,0.22) 0%, rgba(8,122,76,0.08) 55%, rgba(255,255,255,0.03) 100%)"
        : "linear-gradient(145deg, rgba(11,143,90,0.12) 0%, rgba(11,143,90,0.04) 50%, #ffffff 100%)",
      boxShadow: isDark
        ? "0 18px 48px rgba(0,0,0,0.28)"
        : "0 18px 48px rgba(11,143,90,0.12)",
      padding: theme.spacing(3, 2.5, 2.5),
      [theme.breakpoints.up("sm")]: {
        padding: theme.spacing(3.5, 3, 3),
      },
    },
    wireframeGlow: {
      position: "absolute",
      top: -60,
      right: -40,
      width: 180,
      height: 180,
      borderRadius: "50%",
      background: isDark ? "rgba(11,143,90,0.25)" : "rgba(11,143,90,0.15)",
      filter: "blur(40px)",
      pointerEvents: "none",
    },
    wireframeHeader: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      textAlign: "center",
      marginBottom: theme.spacing(2.5),
      position: "relative",
      zIndex: 1,
    },
    wireframeLogo: {
      width: 72,
      height: 72,
      borderRadius: 18,
      boxShadow: "0 10px 28px rgba(11,143,90,0.35)",
      marginBottom: theme.spacing(1.5),
    },
    wireframeTitle: {
      fontSize: "1.2rem",
      fontWeight: 800,
      letterSpacing: "-0.02em",
      color: isDark ? "#e8fff4" : "#064e32",
      marginBottom: 6,
    },
    wireframeSubtitle: {
      fontSize: "0.875rem",
      color: theme.palette.text.secondary,
      lineHeight: 1.55,
      maxWidth: 460,
    },
    wireframeBody: {
      display: "flex",
      flexDirection: "column",
      gap: theme.spacing(1.5),
      position: "relative",
      zIndex: 1,
    },
    wireframeFooter: {
      marginTop: theme.spacing(2),
      display: "flex",
      flexDirection: "column",
      gap: theme.spacing(1),
      position: "relative",
      zIndex: 1,
    },
    connectBtn: {
      textTransform: "none",
      fontWeight: 700,
      borderRadius: 12,
      padding: "11px 20px",
      background: `linear-gradient(135deg, ${CAKTO_GREEN} 0%, ${CAKTO_GREEN_DARK} 100%)`,
      color: "#fff",
      boxShadow: "0 8px 24px rgba(11,143,90,0.35)",
      "&:hover": {
        background: `linear-gradient(135deg, ${CAKTO_GREEN_DARK} 0%, #066b42 100%)`,
      },
    },
    panelLink: {
      textTransform: "none",
      fontWeight: 500,
      fontSize: "0.8125rem",
      color: CAKTO_GREEN,
    },
    field: {
      "& .MuiOutlinedInput-root": {
        borderRadius: 12,
        background: isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.92)",
        "& fieldset": { borderColor: isDark ? "rgba(11,143,90,0.35)" : "rgba(11,143,90,0.22)" },
        "&:hover fieldset": { borderColor: CAKTO_GREEN },
        "&.Mui-focused fieldset": { borderColor: CAKTO_GREEN },
      },
      "& .MuiInputLabel-root.Mui-focused": { color: CAKTO_GREEN },
    },
    connectedBadge: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "6px 12px",
      borderRadius: 999,
      background: isDark ? "rgba(11,143,90,0.2)" : "rgba(11,143,90,0.1)",
      color: CAKTO_GREEN,
      fontWeight: 700,
      fontSize: "0.8125rem",
      marginTop: theme.spacing(1),
    },
    section: {
      border: `1px solid ${border}`,
      borderRadius: 20,
      padding: theme.spacing(3.5),
      display: "flex",
      flexDirection: "column",
      gap: theme.spacing(3),
      background: isDark ? "rgba(255,255,255,0.03)" : "#fff",
    },
    sectionTitle: { fontWeight: 750, fontSize: "1.12rem", letterSpacing: "-0.02em" },
    mappingIntro: {
      fontSize: "0.875rem",
      color: theme.palette.text.secondary,
      lineHeight: 1.65,
      maxWidth: 720,
      marginTop: 6,
    },
    block: {
      display: "flex",
      flexDirection: "column",
      gap: theme.spacing(1.75),
      padding: theme.spacing(2.5),
      borderRadius: 16,
      border: `1px solid ${border}`,
      background: isDark ? "rgba(0,0,0,0.22)" : "rgba(15,23,42,0.02)",
    },
    blockTitle: {
      fontSize: "0.78rem",
      fontWeight: 750,
      letterSpacing: "0.06em",
      textTransform: "uppercase",
      color: isDark ? "rgba(248,250,252,0.55)" : "#64748b",
    },
    blockHint: {
      fontSize: "0.8125rem",
      color: theme.palette.text.secondary,
      lineHeight: 1.5,
      marginTop: -4,
    },
    toolbar: {
      display: "flex",
      flexWrap: "wrap",
      gap: theme.spacing(1),
      alignItems: "center",
    },
    filterChip: {
      fontWeight: 600,
      borderRadius: 8,
      height: 32,
    },
    bulkBox: {
      display: "grid",
      gridTemplateColumns: "1fr",
      gap: theme.spacing(2),
      [theme.breakpoints.up("md")]: {
        gridTemplateColumns: "1fr 1fr",
      },
    },
    bulkAction: {
      display: "flex",
      flexDirection: "column",
      gap: theme.spacing(1.25),
      padding: theme.spacing(2),
      borderRadius: 14,
      border: `1px dashed ${isDark ? "rgba(11,143,90,0.4)" : "rgba(11,143,90,0.28)"}`,
      background: isDark ? "rgba(11,143,90,0.08)" : "rgba(11,143,90,0.04)",
      minHeight: 148,
    },
    bulkLabel: {
      fontSize: "0.8rem",
      fontWeight: 750,
      letterSpacing: "0.02em",
      color: isDark ? "#86efac" : CAKTO_GREEN_DARK,
    },
    mappingList: {
      display: "flex",
      flexDirection: "column",
      gap: theme.spacing(1.75),
    },
    mappingRow: {
      display: "grid",
      gridTemplateColumns: "1fr",
      gap: theme.spacing(1.75),
      padding: theme.spacing(2.25),
      borderRadius: 14,
      border: `1px solid ${border}`,
      background: isDark ? "rgba(255,255,255,0.035)" : "#fff",
      [theme.breakpoints.up("sm")]: {
        gridTemplateColumns: "minmax(0,1fr) 28px minmax(0,1fr) auto",
        alignItems: "end",
      },
    },
    mappingArrow: {
      display: "none",
      textAlign: "center",
      fontWeight: 700,
      color: CAKTO_GREEN,
      paddingBottom: 10,
      [theme.breakpoints.up("sm")]: { display: "block" },
    },
    fieldLabel: {
      fontSize: "0.72rem",
      fontWeight: 700,
      letterSpacing: "0.04em",
      textTransform: "uppercase",
      color: theme.palette.text.secondary,
      marginBottom: 6,
    },
    saveBar: {
      display: "flex",
      flexWrap: "wrap",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing(1.5),
      paddingTop: theme.spacing(0.5),
    },
    statusChip: {
      height: 20,
      fontSize: "0.65rem",
      fontWeight: 700,
      marginLeft: 8,
      borderRadius: 6,
    },
    guideCard: {
      border: `1px solid ${border}`,
      borderRadius: 14,
      padding: theme.spacing(2.5),
      background: isDark ? "rgba(255,255,255,0.03)" : "#fff",
    },
    stepBadge: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: 28,
      height: 28,
      borderRadius: "50%",
      fontSize: "0.8rem",
      fontWeight: 750,
      background: isDark ? "rgba(255,255,255,0.1)" : "rgba(15,23,42,0.06)",
      color: theme.palette.text.secondary,
      flexShrink: 0,
      marginTop: 2,
    },
    stepBadgeActive: {
      background: isDark ? "rgba(11,143,90,0.28)" : "rgba(11,143,90,0.14)",
      color: isDark ? "#86efac" : CAKTO_GREEN_DARK,
    },
    stepRow: {
      display: "flex",
      alignItems: "flex-start",
      gap: theme.spacing(1.5),
    },
    emptyState: {
      padding: theme.spacing(3),
      borderRadius: 14,
      textAlign: "center",
      border: `1px dashed ${border}`,
      background: isDark ? "rgba(255,255,255,0.02)" : "rgba(15,23,42,0.02)",
    },
    mappingSectionHeader: {
      display: "flex",
      flexDirection: "column",
      gap: theme.spacing(0.75),
      flex: 1,
      minWidth: 0,
    },
    guideStep: {
      fontSize: "0.875rem",
      color: theme.palette.text.secondary,
      lineHeight: 1.55,
      marginBottom: theme.spacing(1),
    },
  };
});

function emptyMapping() {
  return {
    caktoProductId: "",
    caktoProductName: "",
    caktoProductPrice: null,
    metaCampaignId: "",
    metaCampaignName: "",
    metaAdAccountId: "",
    inventoryId: null,
  };
}

function normalizeCampaignStatus(campaign) {
  return String(campaign?.effectiveStatus || campaign?.status || "").toUpperCase();
}

function normalizeCampaigns(raw) {
  return (Array.isArray(raw) ? raw : [])
    .map((campaign) => ({
      id: String(campaign?.id || ""),
      name: String(campaign?.name || campaign?.id || ""),
      status: String(campaign?.status || "").toUpperCase(),
      effectiveStatus: String(
        campaign?.effective_status || campaign?.effectiveStatus || campaign?.status || ""
      ).toUpperCase(),
    }))
    .filter((campaign) => campaign.id);
}

function campaignStatusLabel(status) {
  const s = String(status || "").toUpperCase();
  if (s === "ACTIVE") return "Ativa";
  if (["PAUSED", "CAMPAIGN_PAUSED", "ADSET_PAUSED"].includes(s)) return "Pausada";
  if (s === "ARCHIVED") return "Arquivada";
  if (s === "DELETED") return "Excluída";
  if (s === "PENDING_REVIEW") return "Em revisão";
  return s || "—";
}

function campaignStatusColor(status) {
  const s = String(status || "").toUpperCase();
  if (s === "ACTIVE") return "primary";
  if (["PAUSED", "CAMPAIGN_PAUSED", "ADSET_PAUSED"].includes(s)) return "default";
  if (s === "ARCHIVED") return "default";
  if (s === "DELETED") return "secondary";
  return "default";
}

function filterCampaignsByStatus(campaigns, filterKey) {
  if (filterKey === "all") return campaigns;
  return campaigns.filter((c) => {
    const s = normalizeCampaignStatus(c);
    if (filterKey === "active") return s === "ACTIVE";
    if (filterKey === "paused") {
      return ["PAUSED", "CAMPAIGN_PAUSED", "ADSET_PAUSED", "PENDING_REVIEW", "WITH_ISSUES"].includes(s);
    }
    if (filterKey === "archived") return s === "ARCHIVED";
    if (filterKey === "deleted") return s === "DELETED";
    return true;
  });
}

function buildMappingsPayload(mappings, products, campaigns) {
  return mappings
    .filter((m) => m.caktoProductId && m.metaCampaignId)
    .map((m) => {
      const product = products.find(
        (p) => String(p.id) === String(m.caktoProductId)
      );
      const campaign = campaigns.find(
        (c) => String(c.id) === String(m.metaCampaignId)
      );
      return {
        ...m,
        caktoProductId: String(m.caktoProductId),
        metaCampaignId: String(m.metaCampaignId),
        caktoProductName: product?.name || m.caktoProductName,
        caktoProductPrice: product?.price ?? m.caktoProductPrice,
        metaCampaignName: campaign?.name || m.metaCampaignName,
      };
    });
}

/** MenuItem só com texto — Chip/Box dentro do Select do MUI v4 impede o valor aparecer. */
function campaignMenuLabel(campaign) {
  const status = campaignStatusLabel(normalizeCampaignStatus(campaign));
  return `${campaign.name} — ${status}`;
}

function campaignSelectLabel(campaigns, id) {
  if (id == null || id === "") return "Selecione a campanha Meta Ads";
  const found = (campaigns || []).find((c) => String(c.id) === String(id));
  if (!found) return String(id);
  return campaignMenuLabel(found);
}

function CampaignSelect({
  label,
  value,
  onChange,
  campaigns,
  className,
  disabled = false,
}) {
  const safeValue = value == null ? "" : String(value);
  const hasLabel = Boolean(label);
  return (
    <FormControl
      variant="outlined"
      size="small"
      fullWidth
      className={className}
      disabled={disabled}
    >
      {hasLabel ? <InputLabel>{label}</InputLabel> : null}
      <Select
        label={hasLabel ? label : undefined}
        value={safeValue}
        displayEmpty
        onChange={(e) => onChange(String(e.target.value || ""))}
        renderValue={(selected) => campaignSelectLabel(campaigns, selected)}
        MenuProps={{
          PaperProps: { style: { maxHeight: 360 } },
          getContentAnchorEl: null,
          anchorOrigin: { vertical: "bottom", horizontal: "left" },
          transformOrigin: { vertical: "top", horizontal: "left" },
        }}
      >
        <MenuItem value="">
          <em>Selecione</em>
        </MenuItem>
        {(campaigns || []).map((c) => (
          <MenuItem key={String(c.id)} value={String(c.id)}>
            {campaignMenuLabel(c)}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

export default function CaktoConnectionSetupForm({
  integrationId: integrationIdProp,
  isNew = false,
  onSaved,
  hidePageHeader,
}) {
  const classes = useStyles();
  const history = useHistory();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [integration, setIntegration] = useState(null);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [accountLabel, setAccountLabel] = useState("");
  const [mappings, setMappings] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [campaignLoadMessage, setCampaignLoadMessage] = useState("");
  const [campaignFilter, setCampaignFilter] = useState("all");
  const [bulkCampaignId, setBulkCampaignId] = useState("");
  const [bulkProductId, setBulkProductId] = useState("");
  const resolvedIntegrationId = integrationIdProp || integration?.id || null;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let data = null;
      if (integrationIdProp) {
        data = await caktoIntegrationService.getConnection(integrationIdProp);
      } else if (!isNew) {
        const list = await caktoIntegrationService.listConnections();
        const connected = (list?.connections || []).find((c) => c.connected);
        data = connected || null;
      }
      setIntegration(data);
      setAccountLabel(data?.accountLabel || "");
      setClientId("");
      setMappings(
        (data?.productMappings || []).length
          ? data.productMappings.map((m) => ({
              ...m,
              caktoProductId: String(m.caktoProductId || ""),
              metaCampaignId: String(m.metaCampaignId || ""),
              metaCampaignName: m.metaCampaignName || "",
            }))
          : [emptyMapping()]
      );

      let rawCampaigns = [];
      let emptyMessage = "";
      try {
        const response = await listMetaAdsCampaigns();
        rawCampaigns = Array.isArray(response?.campaigns) ? response.campaigns : [];
        emptyMessage = response?.message || "";
      } catch (error) {
        emptyMessage =
          error?.response?.data?.message ||
          "A leitura direta das campanhas Meta Ads não respondeu.";
      }

      if (!rawCampaigns.length) {
        try {
          const analytics = await getMetaAdsAnalytics({ datePreset: "last_30d" });
          rawCampaigns = Array.isArray(analytics?.campaigns) ? analytics.campaigns : [];
        } catch (error) {
          if (!emptyMessage) {
            emptyMessage =
              error?.response?.data?.message ||
              "Não foi possível consultar as campanhas da conta Meta Ads.";
          }
        }
      }

      const campaignList = normalizeCampaigns(rawCampaigns);
      setCampaigns(campaignList);
      setCampaignLoadMessage(
        campaignList.length
          ? ""
          : emptyMessage ||
              "Nenhuma campanha foi encontrada na conta de anúncios conectada."
      );
    } catch {
      setIntegration(null);
    } finally {
      setLoading(false);
    }
  }, [integrationIdProp, isNew]);

  useEffect(() => {
    load();
  }, [load]);

  const connected = Boolean(integration?.connected);
  const products = (integration?.products || []).map((p) => ({
    ...p,
    id: String(p?.id ?? ""),
  }));

  const filteredCampaigns = useMemo(
    () => filterCampaignsByStatus(campaigns, campaignFilter),
    [campaigns, campaignFilter]
  );

  const handleConnect = async () => {
    if (!clientId.trim()) {
      toast.error("Informe o Client ID da Cakto.");
      return;
    }
    if (!connected && !clientSecret.trim()) {
      toast.error("Informe o Client Secret da Cakto.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        clientId: clientId.trim(),
        accountLabel: accountLabel.trim() || undefined,
        mappings: buildMappingsPayload(mappings, products, campaigns),
      };
      if (resolvedIntegrationId) {
        payload.integrationId = resolvedIntegrationId;
      }
      if (clientSecret.trim()) {
        payload.clientSecret = clientSecret.trim();
      }

      const data = await caktoIntegrationService.oauthAuthorize(payload);
      if (!data?.id) {
        toast.error("Conexão não foi salva no servidor. Tente novamente.");
        return;
      }
      setIntegration(data);
      setClientSecret("");
      toast.success(
        connected
          ? "Conta Cakto salva. Sincronização de produtos em segundo plano."
          : "Conta Cakto conectada e salva. Produtos sincronizam em segundo plano."
      );
      if (data?.id) {
        history.replace(`/connections/cakto/manage`);
        return;
      }
      if (typeof onSaved === "function") onSaved(data);
      await load();
    } catch (e) {
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        e?.message ||
        "Falha ao conectar Cakto.";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleSyncProducts = async () => {
    if (!resolvedIntegrationId) {
      toast.error("Conecte a conta antes de sincronizar produtos.");
      return;
    }
    setSaving(true);
    try {
      const data = await caktoIntegrationService.syncProducts(resolvedIntegrationId);
      setIntegration(data);
      toast.success("Produtos sincronizados da Cakto.");
    } catch (e) {
      toast.error(e?.response?.data?.error || "Falha ao sincronizar produtos.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveMappings = async () => {
    if (!resolvedIntegrationId) {
      toast.error("Conecte a conta antes de salvar vínculos.");
      return;
    }
    setSaving(true);
    try {
      const payload = buildMappingsPayload(mappings, products, campaigns);
      const data = await caktoIntegrationService.saveProductMappings(
        resolvedIntegrationId,
        payload
      );
      setIntegration(data);
      setMappings(
        (data?.productMappings || []).length
          ? data.productMappings.map((m) => ({
              ...m,
              caktoProductId: String(m.caktoProductId || ""),
              metaCampaignId: String(m.metaCampaignId || ""),
              metaCampaignName: m.metaCampaignName || "",
            }))
          : [emptyMapping()]
      );
      toast.success("Vínculos produto ↔ campanha salvos.");
      if (typeof onSaved === "function") onSaved(data);
    } catch (e) {
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        "Falha ao salvar vínculos.";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!resolvedIntegrationId) return;
    if (!window.confirm("Desconectar esta conta Cakto? Os vínculos com campanhas serão removidos.")) return;
    setSaving(true);
    try {
      await caktoIntegrationService.disconnect(resolvedIntegrationId);
      setIntegration(null);
      setClientId("");
      setClientSecret("");
      toast.success("Conta Cakto desconectada.");
      if (typeof onSaved === "function") onSaved(null);
    } catch (e) {
      toast.error("Falha ao desconectar.");
    } finally {
      setSaving(false);
    }
  };

  const updateMapping = (index, patch) => {
    setMappings((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        const next = { ...row, ...patch };
        if (patch.metaCampaignId != null) {
          const campaign = campaigns.find(
            (c) => String(c.id) === String(patch.metaCampaignId)
          );
          next.metaCampaignId = String(patch.metaCampaignId || "");
          next.metaCampaignName = campaign?.name || "";
        }
        if (patch.caktoProductId != null) {
          const product = products.find(
            (p) => String(p.id) === String(patch.caktoProductId)
          );
          next.caktoProductId = String(patch.caktoProductId || "");
          next.caktoProductName = product?.name || row.caktoProductName || "";
          next.caktoProductPrice = product?.price ?? row.caktoProductPrice;
        }
        return next;
      })
    );
  };

  const handleLinkAllProductsToCampaign = () => {
    if (!bulkCampaignId) {
      toast.error("Selecione a campanha para vincular todos os produtos.");
      return;
    }
    if (!products.length) {
      toast.error("Nenhum produto Cakto sincronizado.");
      return;
    }
    const campaign = campaigns.find(
      (c) => String(c.id) === String(bulkCampaignId)
    );
    const newMappings = products.map((p) => ({
      ...emptyMapping(),
      caktoProductId: String(p.id),
      caktoProductName: p.name,
      caktoProductPrice: p.price,
      metaCampaignId: String(bulkCampaignId),
      metaCampaignName: campaign?.name || "",
    }));
    setMappings(newMappings);
    toast.success(
      `${products.length} produto(s) vinculado(s) à campanha. Clique em Salvar vínculos.`
    );
  };

  const handleLinkProductToAllCampaigns = () => {
    if (!bulkProductId) {
      toast.error("Selecione o produto para vincular às campanhas.");
      return;
    }
    if (!filteredCampaigns.length) {
      toast.error("Nenhuma campanha no filtro atual.");
      return;
    }
    const product = products.find(
      (p) => String(p.id) === String(bulkProductId)
    );
    const newRows = filteredCampaigns.map((c) => ({
      ...emptyMapping(),
      caktoProductId: String(bulkProductId),
      caktoProductName: product?.name,
      caktoProductPrice: product?.price,
      metaCampaignId: String(c.id),
      metaCampaignName: c.name,
    }));
    setMappings((prev) => {
      const rest = prev.filter((m) => m.caktoProductId !== bulkProductId);
      return [...rest, ...newRows];
    });
    toast.success(
      `Produto vinculado a ${filteredCampaigns.length} campanha(s) (${CAMPAIGN_FILTERS.find((f) => f.key === campaignFilter)?.label}). Salve para confirmar.`
    );
  };

  const headerActions = useMemo(
    () => (
      <Box display="flex" gap={1} flexWrap="wrap">
        {connected ? (
          <>
            <Button
              size="small"
              startIcon={<Refresh />}
              onClick={handleSyncProducts}
              disabled={saving}
            >
              Sincronizar produtos
            </Button>
            <Button size="small" color="secondary" onClick={handleDisconnect} disabled={saving}>
              Desconectar
            </Button>
          </>
        ) : null}
      </Box>
    ),
    [connected, saving]
  );

  useSetupHeaderActions(headerActions, [connected, saving]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={6}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  return (
    <Box className={classes.root}>
      <Box className={classes.formCol}>
        <Box className={classes.wireframe}>
          <Box className={classes.wireframeGlow} />
          <Box className={classes.wireframeHeader}>
            <img src={caktoIcon} alt="Cakto" className={classes.wireframeLogo} />
            <Typography className={classes.wireframeTitle}>
              {connected ? "Conta conectada" : "Passo 1 — Conectar conta"}
            </Typography>
            <Typography className={classes.wireframeSubtitle}>
              {connected
                ? "Credenciais salvas. Você pode atualizar o rótulo ou as chaves abaixo."
                : "Informe o Client ID e Client Secret da API Cakto. Vendas aprovadas alimentam ROI, ROAS e lucro no Meta Ads Analytics."}
            </Typography>
            {connected ? (
              <Box className={classes.connectedBadge}>
                ✓ {integration?.accountLabel || "Conectado"}
              </Box>
            ) : null}
          </Box>

          <Box className={classes.wireframeBody}>
            <TextField
              className={classes.field}
              label="Rótulo da conta (opcional)"
              value={accountLabel}
              onChange={(e) => setAccountLabel(e.target.value)}
              fullWidth
              variant="outlined"
              size="small"
              placeholder="Ex.: Cakto principal"
            />

            <TextField
              className={classes.field}
              label="Client ID (Cakto API)"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              fullWidth
              variant="outlined"
              size="small"
              placeholder="wks..."
              helperText="Painel Cakto → Integrações → Cakto API → Criar Chave"
            />

            <TextField
              className={classes.field}
              label="Client Secret"
              type={showSecret ? "text" : "password"}
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              fullWidth
              variant="outlined"
              size="small"
              placeholder={connected ? "Deixe em branco para manter o atual" : ""}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setShowSecret((v) => !v)}>
                      {showSecret ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Box>

          <Box className={classes.wireframeFooter}>
            <Button
              variant="contained"
              className={classes.connectBtn}
              onClick={handleConnect}
              disabled={saving}
              fullWidth
            >
              {saving ? (
                <CircularProgress size={22} color="inherit" />
              ) : connected ? (
                "Salvar e conectar"
              ) : (
                "Salvar e conectar"
              )}
            </Button>
            <Button
              className={classes.panelLink}
              startIcon={<Launch fontSize="small" />}
              href={`${CAKTO_PANEL_URL}/dashboard/integrations/cakto-api`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Obter credenciais no painel Cakto
            </Button>
          </Box>
        </Box>

        {connected ? (
          <Box className={classes.section}>
            <Box className={classes.stepRow}>
              <Box className={`${classes.stepBadge} ${classes.stepBadgeActive}`}>2</Box>
              <Box className={classes.mappingSectionHeader}>
                <Typography className={classes.sectionTitle}>
                  Vincular produtos via Cakto às campanhas
                </Typography>
                <Typography className={classes.mappingIntro}>
                  Monte o vínculo produto → campanha para o Meta Ads calcular faturamento,
                  lucro e ROAS. Use um atalho em lote ou crie linhas manuais. No final,
                  clique em <strong>Salvar vínculos</strong>.
                </Typography>
              </Box>
              <Button
                size="small"
                variant="outlined"
                startIcon={<Add />}
                onClick={() => setMappings((prev) => [...prev, emptyMapping()])}
                style={{ textTransform: "none", flexShrink: 0, borderRadius: 10, fontWeight: 600 }}
              >
                Nova linha
              </Button>
            </Box>

            {!campaigns.length ? (
              <Box className={classes.emptyState}>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  Nenhuma campanha Meta Ads encontrada.
                </Typography>
                <Typography variant="caption" color="textSecondary" display="block">
                  {campaignLoadMessage}
                </Typography>
                <Button
                  size="small"
                  color="primary"
                  startIcon={<Launch fontSize="small" />}
                  onClick={() => history.push("/connections/meta-ads/new?section=insights")}
                  style={{ textTransform: "none", marginTop: 12 }}
                >
                  Abrir configuração Meta Ads
                </Button>
              </Box>
            ) : (
              <>
                <Box className={classes.block}>
                  <Typography className={classes.blockTitle}>1 · Filtrar campanhas</Typography>
                  <Typography className={classes.blockHint}>
                    Escolha o status usado nos atalhos em lote abaixo.
                  </Typography>
                  <Box className={classes.toolbar}>
                    {CAMPAIGN_FILTERS.map((f) => (
                      <Chip
                        key={f.key}
                        label={f.label}
                        clickable
                        size="small"
                        color={campaignFilter === f.key ? "primary" : "default"}
                        onClick={() => setCampaignFilter(f.key)}
                        className={classes.filterChip}
                      />
                    ))}
                    <Typography
                      variant="caption"
                      color="textSecondary"
                      style={{ marginLeft: "auto", fontWeight: 600 }}
                    >
                      {filteredCampaigns.length} campanha(s)
                    </Typography>
                  </Box>
                </Box>

                <Box className={classes.block}>
                  <Typography className={classes.blockTitle}>2 · Atalhos em lote</Typography>
                  <Typography className={classes.blockHint}>
                    Preenche as linhas de vínculo de uma vez. Depois ainda é preciso salvar.
                  </Typography>
                  {filteredCampaigns.length === 0 ? (
                    <Box className={classes.emptyState}>
                      <Typography variant="body2" color="textSecondary">
                        Nenhuma campanha neste filtro. Tente &quot;Todas&quot;.
                      </Typography>
                    </Box>
                  ) : (
                    <Box className={classes.bulkBox}>
                      <Box className={classes.bulkAction}>
                        <Typography className={classes.bulkLabel}>
                          Todos os produtos → 1 campanha
                        </Typography>
                        <CampaignSelect
                          label="Campanha Meta Ads"
                          value={bulkCampaignId}
                          onChange={setBulkCampaignId}
                          campaigns={filteredCampaigns}
                          className={classes.field}
                        />
                        <Button
                          variant="contained"
                          color="primary"
                          size="small"
                          startIcon={<Link />}
                          onClick={handleLinkAllProductsToCampaign}
                          disabled={!bulkCampaignId || !products.length}
                          style={{ textTransform: "none", fontWeight: 700, borderRadius: 10, alignSelf: "flex-start" }}
                        >
                          Aplicar atalho
                        </Button>
                      </Box>

                      <Box className={classes.bulkAction}>
                        <Typography className={classes.bulkLabel}>
                          1 produto → todas as campanhas do filtro
                        </Typography>
                        <FormControl
                          variant="outlined"
                          size="small"
                          fullWidth
                          className={classes.field}
                        >
                          <InputLabel>Produto Cakto</InputLabel>
                          <Select
                            value={bulkProductId}
                            onChange={(e) => setBulkProductId(String(e.target.value || ""))}
                            label="Produto Cakto"
                            displayEmpty
                            renderValue={(selected) => {
                              if (!selected) return "Selecione o produto";
                              const p = products.find((x) => String(x.id) === String(selected));
                              return p
                                ? `${p.name} — R$ ${Number(p.price || 0).toFixed(2)}`
                                : String(selected);
                            }}
                          >
                            <MenuItem value="">
                              <em>Selecione</em>
                            </MenuItem>
                            {products.map((p) => (
                              <MenuItem key={p.id} value={p.id}>
                                {p.name} — R$ {Number(p.price || 0).toFixed(2)}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                        <Button
                          variant="contained"
                          color="primary"
                          size="small"
                          startIcon={<Link />}
                          onClick={handleLinkProductToAllCampaigns}
                          disabled={!bulkProductId || !filteredCampaigns.length}
                          style={{ textTransform: "none", fontWeight: 700, borderRadius: 10, alignSelf: "flex-start" }}
                        >
                          Aplicar atalho
                        </Button>
                      </Box>
                    </Box>
                  )}
                </Box>

                <Box className={classes.block}>
                  <Typography className={classes.blockTitle}>3 · Vínculos individuais</Typography>
                  <Typography className={classes.blockHint}>
                    Produto Cakto à esquerda → campanha Meta Ads à direita.
                  </Typography>

                  {mappings.length === 0 ||
                  (mappings.length === 1 &&
                    !mappings[0].caktoProductId &&
                    !mappings[0].metaCampaignId) ? (
                    <Box className={classes.emptyState}>
                      <Typography variant="body2" color="textSecondary">
                        Nenhum vínculo ainda. Use um atalho acima ou clique em Nova linha.
                      </Typography>
                    </Box>
                  ) : null}

                  <Box className={classes.mappingList}>
                    {mappings.map((row, index) => (
                      <Box key={`map-${index}`} className={classes.mappingRow}>
                        <Box>
                          <Typography className={classes.fieldLabel}>Produto Cakto</Typography>
                          <FormControl
                            variant="outlined"
                            size="small"
                            fullWidth
                            className={classes.field}
                          >
                            <Select
                              value={String(row.caktoProductId || "")}
                              displayEmpty
                              onChange={(e) =>
                                updateMapping(index, {
                                  caktoProductId: String(e.target.value || ""),
                                })
                              }
                              renderValue={(selected) => {
                                if (!selected) return "Selecione o produto";
                                const p = products.find(
                                  (x) => String(x.id) === String(selected)
                                );
                                return p
                                  ? `${p.name} — R$ ${Number(p.price || 0).toFixed(2)}`
                                  : String(selected);
                              }}
                            >
                              <MenuItem value="">
                                <em>Selecione</em>
                              </MenuItem>
                              {products.map((p) => (
                                <MenuItem key={p.id} value={p.id}>
                                  {p.name} — R$ {Number(p.price || 0).toFixed(2)}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </Box>

                        <Typography className={classes.mappingArrow}>→</Typography>

                        <Box>
                          <Typography className={classes.fieldLabel}>Campanha Meta Ads</Typography>
                          <CampaignSelect
                            label=""
                            value={row.metaCampaignId}
                            onChange={(id) =>
                              updateMapping(index, { metaCampaignId: id })
                            }
                            campaigns={campaigns}
                            className={classes.field}
                          />
                        </Box>

                        <IconButton
                          onClick={() =>
                            setMappings((prev) => prev.filter((_, i) => i !== index))
                          }
                          disabled={
                            mappings.length <= 1 &&
                            !row.caktoProductId &&
                            !row.metaCampaignId
                          }
                          aria-label="Remover vínculo"
                        >
                          <DeleteOutline fontSize="small" />
                        </IconButton>
                      </Box>
                    ))}
                  </Box>
                </Box>

                <Box className={classes.saveBar}>
                  <Typography variant="caption" color="textSecondary">
                    {
                      mappings.filter((m) => m.caktoProductId && m.metaCampaignId)
                        .length
                    }{" "}
                    vínculo(s) prontos para salvar
                  </Typography>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={handleSaveMappings}
                    disabled={saving}
                    style={{
                      textTransform: "none",
                      fontWeight: 700,
                      borderRadius: 10,
                      padding: "10px 18px",
                    }}
                  >
                    {saving ? (
                      <CircularProgress size={20} color="inherit" />
                    ) : (
                      "Salvar vínculos"
                    )}
                  </Button>
                </Box>
              </>
            )}
          </Box>
        ) : null}
      </Box>

      <Box className={classes.asideCol}>
        <Box className={classes.guideCard}>
          <Typography className={classes.sectionTitle} gutterBottom>
            Como conectar
          </Typography>
          <Typography className={classes.guideStep}>
            1. Clique em <strong>Obter credenciais no painel Cakto</strong> (abre em nova aba).
          </Typography>
          <Typography className={classes.guideStep}>
            2. Vá em <strong>Integrações → Cakto API</strong> e crie uma chave com escopos{" "}
            <code>read write products orders webhooks</code>.
          </Typography>
          <Typography className={classes.guideStep}>
            3. Copie o <strong>Client ID</strong> e o <strong>Client Secret</strong> e cole no bloco
            de conexão ao lado.
          </Typography>
          <Typography className={classes.guideStep}>
            4. Clique em <strong>Salvar e conectar</strong>. O CRM registra o webhook e sincroniza
            produtos no inventário.
          </Typography>
          <Typography className={classes.guideStep}>
            5. Vincule produtos às campanhas Meta — use os atalhos em massa ou vínculos manuais.
          </Typography>
          <Button
            size="small"
            startIcon={<Launch />}
            href="https://docs.cakto.com.br/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ textTransform: "none", marginTop: 8 }}
          >
            Documentação Cakto API
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
