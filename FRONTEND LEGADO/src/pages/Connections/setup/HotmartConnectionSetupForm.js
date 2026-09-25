import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useHistory } from "react-router-dom";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
  makeStyles,
} from "@material-ui/core";
import {
  Add,
  DeleteOutline,
  Launch,
  Visibility,
  VisibilityOff,
} from "@material-ui/icons";
import { toast } from "react-toastify";
import hotmartIntegrationService from "../../../services/hotmartIntegrationService";
import {
  getMetaAdsAnalytics,
  listMetaAdsCampaigns,
} from "../../../services/metaAdsService";
import { CONNECTIONS_FONT } from "../connectionsTypography";
import { useSetupHeaderActions } from "../ConnectionsChannelLayout";
import hotmartIcon from "../../../assets/hotmart-icon.png";

const HOTMART_ORANGE = "#F04E23";
const HOTMART_ORANGE_DARK = "#D4431C";
const HOTMART_PANEL_URL = "https://app.hotmart.com";

const useStyles = makeStyles((theme) => {
  const isDark = theme.palette.type === "dark";
  const border = isDark ? "rgba(255,255,255,0.1)" : "rgba(15,23,42,0.08)";
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
      border: `1px solid ${isDark ? "rgba(240,78,35,0.45)" : "rgba(240,78,35,0.28)"}`,
      background: isDark
        ? "linear-gradient(145deg, rgba(240,78,35,0.22) 0%, rgba(212,67,28,0.08) 55%, rgba(255,255,255,0.03) 100%)"
        : "linear-gradient(145deg, rgba(240,78,35,0.12) 0%, rgba(240,78,35,0.04) 50%, #ffffff 100%)",
      boxShadow: isDark
        ? "0 18px 48px rgba(0,0,0,0.28)"
        : "0 18px 48px rgba(240,78,35,0.12)",
      padding: theme.spacing(3, 2.5, 2.5),
    },
    wireframeGlow: {
      position: "absolute",
      top: -60,
      right: -40,
      width: 180,
      height: 180,
      borderRadius: "50%",
      background: isDark ? "rgba(240,78,35,0.25)" : "rgba(240,78,35,0.15)",
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
      boxShadow: "0 10px 28px rgba(240,78,35,0.35)",
      marginBottom: theme.spacing(1.5),
    },
    wireframeTitle: {
      fontSize: "1.2rem",
      fontWeight: 800,
      letterSpacing: "-0.02em",
      color: isDark ? "#fff5f0" : "#7c2d12",
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
      background: `linear-gradient(135deg, ${HOTMART_ORANGE} 0%, ${HOTMART_ORANGE_DARK} 100%)`,
      color: "#fff",
      boxShadow: "0 8px 24px rgba(240,78,35,0.35)",
      "&:hover": {
        background: `linear-gradient(135deg, ${HOTMART_ORANGE_DARK} 0%, #b83818 100%)`,
      },
    },
    panelLink: {
      textTransform: "none",
      fontWeight: 500,
      fontSize: "0.8125rem",
      color: HOTMART_ORANGE,
    },
    field: {
      "& .MuiOutlinedInput-root": {
        borderRadius: 12,
        background: isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.92)",
        "& fieldset": {
          borderColor: isDark ? "rgba(240,78,35,0.35)" : "rgba(240,78,35,0.22)",
        },
        "&:hover fieldset": { borderColor: HOTMART_ORANGE },
        "&.Mui-focused fieldset": { borderColor: HOTMART_ORANGE },
      },
      "& .MuiInputLabel-root.Mui-focused": { color: HOTMART_ORANGE },
    },
    connectedBadge: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "6px 12px",
      borderRadius: 999,
      background: isDark ? "rgba(240,78,35,0.2)" : "rgba(240,78,35,0.1)",
      color: HOTMART_ORANGE,
      fontWeight: 700,
      fontSize: "0.8125rem",
      marginTop: theme.spacing(1),
    },
    section: {
      border: `1px solid ${border}`,
      borderRadius: 18,
      padding: theme.spacing(3),
      display: "flex",
      flexDirection: "column",
      gap: theme.spacing(2.5),
      background: isDark ? "rgba(255,255,255,0.03)" : "#fff",
    },
    sectionTitle: { fontWeight: 750, fontSize: "1.05rem", letterSpacing: "-0.02em" },
    mappingIntro: {
      fontSize: "0.875rem",
      color: theme.palette.text.secondary,
      lineHeight: 1.6,
      maxWidth: 640,
      marginTop: 4,
    },
    mappingRow: {
      display: "grid",
      gridTemplateColumns: "1fr",
      gap: theme.spacing(1.5),
      padding: theme.spacing(2),
      borderRadius: 14,
      border: `1px solid ${border}`,
      background: isDark ? "rgba(255,255,255,0.03)" : "rgba(15,23,42,0.02)",
      [theme.breakpoints.up("sm")]: {
        gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr) minmax(0,1.2fr) auto",
        alignItems: "center",
      },
    },
    guideCard: {
      border: `1px solid ${border}`,
      borderRadius: 14,
      padding: theme.spacing(2.5),
      background: isDark ? "rgba(255,255,255,0.03)" : "#fff",
    },
    guideStep: {
      fontSize: "0.875rem",
      color: theme.palette.text.secondary,
      lineHeight: 1.55,
      marginBottom: theme.spacing(1),
    },
    webhookBox: {
      padding: theme.spacing(1.5),
      borderRadius: 10,
      background: isDark ? "rgba(255,255,255,0.04)" : "rgba(240,78,35,0.06)",
      fontSize: "0.75rem",
      wordBreak: "break-all",
      fontFamily: "monospace",
      color: theme.palette.text.secondary,
    },
    emptyState: {
      padding: theme.spacing(2.5),
      borderRadius: 12,
      textAlign: "center",
      border: `1px dashed ${border}`,
      background: isDark ? "rgba(255,255,255,0.02)" : "rgba(15,23,42,0.02)",
    },
    mappingSectionHeader: {
      display: "flex",
      flexDirection: "column",
      gap: theme.spacing(0.75),
    },
    stepBadge: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: 22,
      height: 22,
      borderRadius: "50%",
      fontSize: "0.75rem",
      fontWeight: 700,
      background: isDark ? "rgba(240,78,35,0.25)" : "rgba(240,78,35,0.12)",
      color: HOTMART_ORANGE,
      flexShrink: 0,
    },
    stepRow: {
      display: "flex",
      alignItems: "flex-start",
      gap: theme.spacing(1.25),
    },
  };
});

function emptyMapping() {
  return {
    hotmartProductId: "",
    hotmartProductName: "",
    hotmartProductPrice: null,
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
  return s || "—";
}

function campaignStatusColor(status) {
  const s = String(status || "").toUpperCase();
  if (s === "ACTIVE") return "primary";
  if (s === "DELETED") return "secondary";
  return "default";
}

function buildMappingsPayload(mappings, campaigns) {
  return mappings
    .filter((m) => m.hotmartProductId && m.metaCampaignId)
    .map((m) => {
      const campaign = campaigns.find((c) => c.id === m.metaCampaignId);
      return {
        ...m,
        hotmartProductName: m.hotmartProductName || m.hotmartProductId,
        metaCampaignName: campaign?.name || m.metaCampaignName,
      };
    });
}

function CampaignMenuItem({ campaign }) {
  const status = normalizeCampaignStatus(campaign);
  return (
    <MenuItem value={campaign.id}>
      <Box display="flex" alignItems="center" width="100%" minWidth={0}>
        <Typography noWrap style={{ flex: 1, fontSize: "0.875rem" }}>
          {campaign.name}
        </Typography>
        <Chip
          size="small"
          label={campaignStatusLabel(status)}
          color={campaignStatusColor(status)}
          style={{ height: 20, fontSize: "0.65rem", fontWeight: 700, marginLeft: 8 }}
        />
      </Box>
    </MenuItem>
  );
}

function campaignSelectLabel(campaigns, id) {
  if (!id) return "Selecione";
  const found = (campaigns || []).find((c) => String(c.id) === String(id));
  if (!found) return String(id);
  const status = campaignStatusLabel(normalizeCampaignStatus(found));
  return `${found.name} (${status})`;
}

export default function HotmartConnectionSetupForm({
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
  const [basicToken, setBasicToken] = useState("");
  const [accountLabel, setAccountLabel] = useState("");
  const [mappings, setMappings] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [campaignLoadMessage, setCampaignLoadMessage] = useState("");
  const resolvedIntegrationId = integrationIdProp || integration?.id || null;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let data = null;
      if (integrationIdProp) {
        data = await hotmartIntegrationService.getConnection(integrationIdProp);
      } else if (!isNew) {
        const list = await hotmartIntegrationService.listConnections();
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
              hotmartProductId: String(m.hotmartProductId || ""),
              hotmartProductName: m.hotmartProductName || "",
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
  const products = integration?.products || [];

  const handleConnect = async () => {
    if (!clientId.trim()) {
      toast.error("Informe o Client ID da Hotmart.");
      return;
    }
    if (!connected && !clientSecret.trim()) {
      toast.error("Informe o Client Secret da Hotmart.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        clientId: clientId.trim(),
        accountLabel: accountLabel.trim() || undefined,
        mappings: buildMappingsPayload(mappings, campaigns),
      };
      if (resolvedIntegrationId) {
        payload.integrationId = resolvedIntegrationId;
      }
      if (clientSecret.trim()) {
        payload.clientSecret = clientSecret.trim();
      }
      if (basicToken.trim()) {
        payload.basicToken = basicToken.trim();
      }

      const data = await hotmartIntegrationService.connect(payload);
      if (!data?.id) {
        toast.error("Conexão não foi salva no servidor. Tente novamente.");
        return;
      }
      setIntegration(data);
      setClientSecret("");
      setBasicToken("");
      toast.success(
        connected ? "Conta Hotmart salva." : "Conta Hotmart conectada e salva."
      );
      if (data?.id) {
        history.replace({
          pathname: `/connections/hotmart/manage`,
          state: { hotmartConnection: data },
        });
        return;
      }
      if (typeof onSaved === "function") onSaved(data);
      await load();
    } catch (e) {
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        e?.message ||
        "Falha ao conectar Hotmart.";
      toast.error(msg);
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
      const payload = buildMappingsPayload(mappings, campaigns);
      const data = await hotmartIntegrationService.saveProductMappings(
        resolvedIntegrationId,
        payload
      );
      setIntegration(data);
      setMappings(
        (data?.productMappings || []).length
          ? data.productMappings.map((m) => ({
              ...m,
              hotmartProductId: String(m.hotmartProductId || ""),
              hotmartProductName: m.hotmartProductName || "",
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
    if (
      !window.confirm(
        "Desconectar esta conta Hotmart? Os vínculos com campanhas serão removidos."
      )
    ) {
      return;
    }
    setSaving(true);
    try {
      await hotmartIntegrationService.disconnect(resolvedIntegrationId);
      setIntegration(null);
      setClientId("");
      setClientSecret("");
      toast.success("Conta Hotmart desconectada.");
      if (typeof onSaved === "function") onSaved(null);
    } catch {
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
        if (patch.hotmartProductId != null) {
          const product = products.find(
            (p) => String(p.id) === String(patch.hotmartProductId)
          );
          next.hotmartProductId = String(patch.hotmartProductId || "");
          if (product) {
            next.hotmartProductName = product.name || row.hotmartProductName || "";
            next.hotmartProductPrice = product.price ?? row.hotmartProductPrice;
          }
        }
        return next;
      })
    );
  };

  const headerActions = useMemo(
    () => (
      <Box display="flex" gap={1} flexWrap="wrap">
        {connected ? (
          <Button size="small" color="secondary" onClick={handleDisconnect} disabled={saving}>
            Desconectar
          </Button>
        ) : null}
      </Box>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
            <img src={hotmartIcon} alt="Hotmart" className={classes.wireframeLogo} />
            <Typography className={classes.wireframeTitle}>
              {connected ? "Conta conectada" : "Passo 1 — Conectar conta"}
            </Typography>
            <Typography className={classes.wireframeSubtitle}>
              {connected
                ? "Credenciais salvas. Você pode atualizar o rótulo ou as chaves abaixo."
                : "Informe o Client ID e Client Secret da API Hotmart (Tools → Credentials). Vendas aprovadas alimentam ROI no Meta Ads Analytics."}
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
              placeholder="Ex.: Hotmart principal"
            />

            <TextField
              className={classes.field}
              label="Client ID (Hotmart API)"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              fullWidth
              variant="outlined"
              size="small"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              helperText="Painel Hotmart → Ferramentas → Credenciais"
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
                      {showSecret ? (
                        <VisibilityOff fontSize="small" />
                      ) : (
                        <Visibility fontSize="small" />
                      )}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              className={classes.field}
              label="Client Token / Basic (opcional)"
              type={showSecret ? "text" : "password"}
              value={basicToken}
              onChange={(e) => setBasicToken(e.target.value)}
              fullWidth
              variant="outlined"
              size="small"
              placeholder="Basic ZWNlMDljMDEt... (opcional)"
              helperText="Se o painel mostrar Client Token, cole aqui. Senão o CRM monta sozinho."
            />

            {connected && integration?.webhookUrl ? (
              <Box>
                <Typography variant="caption" color="textSecondary" display="block" gutterBottom>
                  Webhook — configure no painel Hotmart (PURCHASE_APPROVED):
                </Typography>
                <Box className={classes.webhookBox}>{integration.webhookUrl}</Box>
              </Box>
            ) : null}
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
              ) : (
                "Salvar e conectar"
              )}
            </Button>
            <Button
              className={classes.panelLink}
              startIcon={<Launch fontSize="small" />}
              href={`${HOTMART_PANEL_URL}/tools/credentials`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Obter credenciais no painel Hotmart
            </Button>
          </Box>
        </Box>

        {connected ? (
          <Box className={classes.section}>
            <Box className={classes.stepRow}>
              <Box className={classes.stepBadge}>2</Box>
              <Box className={classes.mappingSectionHeader} style={{ flex: 1 }}>
                <Typography className={classes.sectionTitle}>
                  Vincular produtos via Hotmart às campanhas
                </Typography>
                <Typography className={classes.mappingIntro}>
                  Informe o ID (ou ucode) e o nome do produto Hotmart e vincule a uma
                  campanha Meta Ads. Depois clique em <strong>Salvar vínculos</strong>.
                </Typography>
              </Box>
              <Button
                size="small"
                startIcon={<Add />}
                onClick={() => setMappings((prev) => [...prev, emptyMapping()])}
                style={{ textTransform: "none", flexShrink: 0 }}
              >
                Adicionar
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
                {mappings.map((row, index) => (
                  <Box key={`map-${index}`} className={classes.mappingRow}>
                    {products.length > 0 ? (
                      <TextField
                        select
                        className={classes.field}
                        label="Produto Hotmart"
                        value={row.hotmartProductId}
                        onChange={(e) =>
                          updateMapping(index, { hotmartProductId: e.target.value })
                        }
                        variant="outlined"
                        size="small"
                        fullWidth
                      >
                        <MenuItem value="">Selecione</MenuItem>
                        {products.map((p) => (
                          <MenuItem key={p.id} value={p.id}>
                            {p.name} ({p.id})
                          </MenuItem>
                        ))}
                      </TextField>
                    ) : (
                      <TextField
                        className={classes.field}
                        label="ID do produto Hotmart"
                        value={row.hotmartProductId}
                        onChange={(e) =>
                          updateMapping(index, { hotmartProductId: e.target.value })
                        }
                        variant="outlined"
                        size="small"
                        fullWidth
                        placeholder="ID ou ucode"
                      />
                    )}
                    <TextField
                      className={classes.field}
                      label="Nome do produto"
                      value={row.hotmartProductName || ""}
                      onChange={(e) =>
                        updateMapping(index, { hotmartProductName: e.target.value })
                      }
                      variant="outlined"
                      size="small"
                      fullWidth
                    />
                    <FormControl
                      variant="outlined"
                      size="small"
                      fullWidth
                      className={classes.field}
                    >
                      <InputLabel>Campanha Meta Ads</InputLabel>
                      <Select
                        value={row.metaCampaignId || ""}
                        onChange={(e) =>
                          updateMapping(index, { metaCampaignId: e.target.value })
                        }
                        label="Campanha Meta Ads"
                        renderValue={(selected) =>
                          campaignSelectLabel(campaigns, selected)
                        }
                      >
                        <MenuItem value="">Selecione</MenuItem>
                        {campaigns.map((c) => (
                          <CampaignMenuItem key={c.id} campaign={c} />
                        ))}
                      </Select>
                    </FormControl>
                    <IconButton
                      onClick={() =>
                        setMappings((prev) => prev.filter((_, i) => i !== index))
                      }
                      disabled={
                        mappings.length <= 1 &&
                        !row.hotmartProductId &&
                        !row.metaCampaignId
                      }
                      aria-label="Remover vínculo"
                    >
                      <DeleteOutline fontSize="small" />
                    </IconButton>
                  </Box>
                ))}

                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleSaveMappings}
                  disabled={saving}
                  style={{
                    textTransform: "none",
                    alignSelf: "flex-start",
                    fontWeight: 600,
                    borderRadius: 10,
                    background: HOTMART_ORANGE,
                  }}
                >
                  Salvar vínculos
                </Button>
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
            1. Abra o <strong>painel Hotmart</strong> → Ferramentas → Credenciais.
          </Typography>
          <Typography className={classes.guideStep}>
            2. Crie uma credencial e copie o <strong>Client ID</strong> e o{" "}
            <strong>Client Secret</strong>.
          </Typography>
          <Typography className={classes.guideStep}>
            3. Cole no formulário e clique em <strong>Salvar e conectar</strong>.
          </Typography>
          <Typography className={classes.guideStep}>
            4. Configure o webhook com a URL exibida (evento PURCHASE_APPROVED).
          </Typography>
          <Typography className={classes.guideStep}>
            5. Vincule produtos Hotmart às campanhas Meta Ads.
          </Typography>
          <Button
            size="small"
            startIcon={<Launch />}
            href="https://developers.hotmart.com/docs/en/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ textTransform: "none", marginTop: 8 }}
          >
            Documentação Hotmart API
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
