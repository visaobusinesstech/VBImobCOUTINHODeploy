import React, { useCallback, useEffect, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  Switch,
  TextField,
  Typography,
  makeStyles
} from "@material-ui/core";
import { Visibility, VisibilityOff } from "@material-ui/icons";
import { toast } from "react-toastify";
import {
  getMetaAdsInsightsConfig,
  saveMetaAdsInsightsConfig,
  probeMetaAdsInsights
} from "../../../services/metaAdsService";
import IntegrationApiKeyGuidePanel from "../IntegrationApiKeyGuidePanel";
import { useIntegrationTabStyles } from "../../Prompts/integrationTabStyles";
import { CONNECTIONS_FONT } from "../connectionsTypography";
import { getConnectionsSwitchDarkStyles } from "../connectionsTheme";
import { useSetupHeaderActions } from "../ConnectionsChannelLayout";

const useLayoutStyles = makeStyles((theme) => {
  const isDark = theme.palette.type === "dark";
  const border = isDark ? "rgba(255,255,255,0.1)" : "rgba(15,23,42,0.08)";
  const inputBg = isDark ? "rgba(255,255,255,0.05)" : "rgba(15,23,42,0.02)";
  return {
    root: {
      fontFamily: CONNECTIONS_FONT,
      width: "100%",
      maxWidth: "100%",
      boxSizing: "border-box",
      display: "flex",
      flexDirection: "column",
      padding: theme.spacing(0, 0.5, 2),
      [theme.breakpoints.up("md")]: { padding: theme.spacing(0, 1, 2) }
    },
    grid: {
      display: "grid",
      gridTemplateColumns: "1fr",
      gap: theme.spacing(2.5),
      [theme.breakpoints.up("md")]: {
        gridTemplateColumns: "minmax(0, 1fr) minmax(280px, min(42vw, 400px))",
        gap: theme.spacing(2, 3)
      },
      [theme.breakpoints.up("lg")]: {
        gridTemplateColumns: "minmax(320px, 1fr) minmax(300px, 420px)",
        gap: theme.spacing(2.5, 4)
      }
    },
    formCol: {
      display: "flex",
      flexDirection: "column",
      gap: theme.spacing(2),
      minWidth: 0,
      paddingTop: theme.spacing(0.5)
    },
    asideCol: { minWidth: 0, width: "100%" },
    intro: {
      display: "none"
    },
    fieldPretty: {
      "& .MuiOutlinedInput-root": {
        borderRadius: 12,
        background: inputBg,
        fontSize: "0.875rem",
        "& fieldset": { borderColor: border },
        "&.Mui-focused fieldset": { borderWidth: 1.5, borderColor: "#0081FB" }
      },
      "& .MuiOutlinedInput-input": { padding: "14px 14px" }
    },
    switchRowPretty: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: theme.spacing(1.25, 1.5),
      borderRadius: 12,
      background: isDark ? "rgba(255,255,255,0.03)" : "rgba(15,23,42,0.02)",
      border: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.05)"}`,
      ...getConnectionsSwitchDarkStyles(theme)
    },
    switchLabel: { fontSize: "0.875rem", fontWeight: 500 },
    switchHint: {
      fontSize: "0.75rem",
      color: theme.palette.text.secondary,
      marginTop: 2
    },
    footer: {
      display: "flex",
      justifyContent: "flex-end",
      gap: theme.spacing(1),
      paddingTop: theme.spacing(2.5),
      marginTop: theme.spacing(2),
      borderTop: isDark
        ? "1px solid rgba(255,255,255,0.06)"
        : "1px solid rgba(15,23,42,0.06)",
      [theme.breakpoints.up("md")]: { gridColumn: "1 / -1" }
    },
    saveBtn: {
      textTransform: "none",
      boxShadow: "none",
      borderRadius: 8,
      fontWeight: 500,
      fontSize: "0.8125rem",
      backgroundColor: "#0081FB",
      "&:hover": { backgroundColor: "#0064d1" }
    },
    cancelBtn: {
      textTransform: "none",
      borderRadius: 8,
      fontWeight: 500,
      fontSize: "0.8125rem"
    }
  };
});

export default function MetaAdsInsightsSetupForm({ onCancel, onSaved }) {
  const layout = useLayoutStyles();
  const field = useIntegrationTabStyles();
  const registerHeaderActions = useSetupHeaderActions();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [probing, setProbing] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [accessToken, setAccessToken] = useState("");
  const [accessTokenMasked, setAccessTokenMasked] = useState("");
  const [tokenDirty, setTokenDirty] = useState(false);
  const [hasAccessToken, setHasAccessToken] = useState(false);
  const [accessTokenLast4, setAccessTokenLast4] = useState("");
  const [adAccountId, setAdAccountId] = useState("");
  const [businessId, setBusinessId] = useState("");
  const [appId, setAppId] = useState("");
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const cfg = await getMetaAdsInsightsConfig();
        if (cancelled) return;
        setAdAccountId(cfg.adAccountId || "");
        setBusinessId(cfg.businessId || "");
        setAppId(cfg.appId || "");
        setEnabled(cfg.enabled !== false);
        setHasAccessToken(Boolean(cfg.hasAccessToken));
        setAccessTokenLast4(cfg.accessTokenLast4 || "");
        const masked = cfg.accessTokenMasked || "";
        setAccessTokenMasked(masked);
        setAccessToken(masked);
        setTokenDirty(false);
      } catch {
        toast.error("Não foi possível carregar Meta Ads Insights.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = useCallback(async () => {
    try {
      setSaving(true);
      const raw = String(accessToken || "").trim();
      const looksMasked =
        hasAccessToken &&
        !tokenDirty &&
        (raw === accessTokenMasked || raw.includes("•"));
      const cfg = await saveMetaAdsInsightsConfig({
        adAccountId: adAccountId.trim(),
        businessId: businessId.trim(),
        appId: appId.trim(),
        accessToken: looksMasked || !raw ? undefined : raw,
        enabled
      });
      setHasAccessToken(Boolean(cfg.hasAccessToken));
      setAccessTokenLast4(cfg.accessTokenLast4 || "");
      const masked = cfg.accessTokenMasked || "";
      setAccessTokenMasked(masked);
      setAccessToken(masked);
      setTokenDirty(false);
      toast.success("Meta Ads Anúncios & Pixels salvo.");
      onSaved?.(cfg);
    } catch (e) {
      toast.error(e?.response?.data?.error || "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  }, [
    accessToken,
    accessTokenMasked,
    adAccountId,
    businessId,
    appId,
    enabled,
    hasAccessToken,
    tokenDirty,
    onSaved
  ]);

  const handleProbe = async () => {
    try {
      setProbing(true);
      if (tokenDirty && String(accessToken || "").trim() && !accessToken.includes("•")) {
        await saveMetaAdsInsightsConfig({
          adAccountId: adAccountId.trim(),
          businessId: businessId.trim(),
          appId: appId.trim(),
          accessToken: accessToken.trim(),
          enabled
        });
      }
      const result = await probeMetaAdsInsights();
      if (result?.ok) {
        toast.success(
          `Conexão OK · ${result.account?.name || result.account?.id || "conta"}`
        );
      } else {
        toast.error(result?.message || "Falha ao validar.");
      }
    } catch (e) {
      toast.error(e?.response?.data?.error || "Falha ao validar conexão.");
    } finally {
      setProbing(false);
    }
  };

  useEffect(() => {
    if (!registerHeaderActions) return undefined;
    registerHeaderActions(
      <Button
        variant="contained"
        color="primary"
        disableElevation
        disabled={saving || !adAccountId.trim()}
        onClick={handleSave}
        className={layout.saveBtn}
      >
        {saving ? "Salvando…" : "Salvar"}
      </Button>
    );
    return () => registerHeaderActions(null);
  }, [registerHeaderActions, saving, handleSave, layout.saveBtn, adAccountId]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={280}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  const fieldClass = `${field.inputDense} ${layout.fieldPretty}`;

  return (
    <Box className={layout.root}>
      <div className={layout.grid}>
        <div className={layout.formCol}>
          <Typography className={layout.intro}>
            Conecte a Marketing API da Meta para puxar campanhas, anúncios, pixels e
            métricas reais no dashboard Análises Ads. Esta integração é separada da
            Conversions API (envio de conversões). Use também o botão
            &quot;Conectar outra conta via OAuth&quot; na tela de administração para
            vincular contas extras.
          </Typography>

          <TextField
            className={fieldClass}
            label="Ad Account ID"
            variant="outlined"
            fullWidth
            value={adAccountId}
            onChange={(e) => setAdAccountId(e.target.value)}
            placeholder="act_1234567890"
            helperText="ID da conta de anúncios (aceita só números; o CRM prefixa act_)"
          />

          <TextField
            className={fieldClass}
            label="Access Token (Marketing API)"
            variant="outlined"
            fullWidth
            type={showToken || !tokenDirty ? "text" : "password"}
            value={accessToken}
            onFocus={() => {
              if (!tokenDirty && hasAccessToken && accessToken === accessTokenMasked) {
                setAccessToken("");
                setTokenDirty(true);
              }
            }}
            onChange={(e) => {
              setTokenDirty(true);
              setAccessToken(e.target.value);
            }}
            onBlur={() => {
              if (tokenDirty && !String(accessToken || "").trim() && accessTokenMasked) {
                setAccessToken(accessTokenMasked);
                setTokenDirty(false);
              }
            }}
            helperText={
              hasAccessToken
                ? tokenDirty
                  ? "Digite um novo token para substituir o atual."
                  : `Token conectado · termina em ${accessTokenLast4}`
                : "Token com permissões ads_read (System User ou Graph Explorer)"
            }
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    disabled={!tokenDirty}
                    onClick={() => setShowToken((s) => !s)}
                  >
                    {showToken ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                  </IconButton>
                </InputAdornment>
              )
            }}
          />

          <TextField
            className={fieldClass}
            label="App ID (opcional)"
            variant="outlined"
            fullWidth
            value={appId}
            onChange={(e) => setAppId(e.target.value)}
            helperText="ID do app em developers.facebook.com"
          />

          <TextField
            className={fieldClass}
            label="Business ID (opcional)"
            variant="outlined"
            fullWidth
            value={businessId}
            onChange={(e) => setBusinessId(e.target.value)}
            helperText="ID do portfólio Business Manager"
          />

          <div className={layout.switchRowPretty}>
            <div>
              <Typography className={layout.switchLabel}>Integração ativa</Typography>
              <Typography className={layout.switchHint}>
                Permite o dashboard Análises Ads consultar a Marketing API
              </Typography>
            </div>
            <Switch
              color="primary"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
          </div>
        </div>

        <div className={layout.asideCol}>
          <IntegrationApiKeyGuidePanel provider="meta-ads-insights" />
        </div>

        <div className={layout.footer}>
          <Button
            variant="outlined"
            disabled={probing || saving}
            onClick={handleProbe}
            className={layout.cancelBtn}
          >
            {probing ? "Validando…" : "Testar conexão"}
          </Button>
          {typeof onCancel === "function" ? (
            <Button variant="outlined" onClick={onCancel} className={layout.cancelBtn}>
              Cancelar
            </Button>
          ) : null}
          <Button
            variant="contained"
            color="primary"
            disableElevation
            disabled={saving || !adAccountId.trim()}
            onClick={handleSave}
            className={layout.saveBtn}
          >
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </div>
    </Box>
  );
}
