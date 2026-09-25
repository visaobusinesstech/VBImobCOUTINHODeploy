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
import { getMetaAdsConfig, saveMetaAdsConfig } from "../../../services/metaAdsService";
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
      [theme.breakpoints.up("md")]: {
        padding: theme.spacing(0, 1, 2)
      }
    },
    grid: {
      display: "grid",
      gridTemplateColumns: "1fr",
      gap: theme.spacing(2.5),
      flex: 1,
      width: "100%",
      alignItems: "start",
      [theme.breakpoints.up("md")]: {
        gridTemplateColumns: "minmax(0, 1fr) minmax(280px, min(42vw, 400px))",
        gap: theme.spacing(2, 3),
        alignItems: "start"
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
      width: "100%",
      paddingTop: theme.spacing(0.5),
    },
    asideCol: {
      minWidth: 0,
      width: "100%"
    },
    intro: {
      display: "none"
    },
    fieldPretty: {
      "& .MuiOutlinedInput-root": {
        borderRadius: 12,
        background: inputBg,
        fontSize: "0.875rem",
        transition: "border-color 0.15s ease, box-shadow 0.15s ease",
        "& fieldset": { borderColor: border },
        "&:hover fieldset": {
          borderColor: isDark ? "rgba(255,255,255,0.22)" : "rgba(15,23,42,0.18)"
        },
        "&.Mui-focused fieldset": {
          borderWidth: 1.5,
          borderColor: "#0081FB"
        },
        "&.Mui-focused": {
          boxShadow: isDark
            ? "0 0 0 3px rgba(0,129,251,0.22)"
            : "0 0 0 3px rgba(0,129,251,0.14)"
        }
      },
      "& .MuiOutlinedInput-input": {
        padding: "14px 14px"
      },
      "& .MuiInputLabel-outlined": {
        fontSize: "0.8125rem"
      },
      "& .MuiFormHelperText-root": {
        fontSize: "0.75rem",
        marginTop: 6
      }
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
    switchLabel: {
      fontSize: "0.875rem",
      fontWeight: 500,
      color: theme.palette.text.primary
    },
    switchHint: {
      fontSize: "0.75rem",
      color: theme.palette.text.secondary,
      marginTop: 2,
      lineHeight: 1.4
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
      [theme.breakpoints.up("md")]: {
        gridColumn: "1 / -1"
      }
    },
    saveBtn: {
      textTransform: "none",
      boxShadow: "none",
      borderRadius: 8,
      minWidth: 96,
      fontWeight: 500,
      fontSize: "0.8125rem",
      padding: theme.spacing(0.55, 1.5),
      fontFamily: CONNECTIONS_FONT,
      backgroundColor: "#0081FB",
      "&:hover": {
        backgroundColor: "#0064d1"
      }
    },
    cancelBtn: {
      textTransform: "none",
      borderRadius: 8,
      fontWeight: 500,
      fontSize: "0.8125rem",
      fontFamily: CONNECTIONS_FONT
    }
  };
});

/**
 * Setup Meta Ads — form à esquerda, documentação à direita (padrão Integrações).
 */
export default function MetaAdsConnectionSetupForm({ onCancel, onSaved }) {
  const layout = useLayoutStyles();
  const field = useIntegrationTabStyles();
  const registerHeaderActions = useSetupHeaderActions();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [datasetId, setDatasetId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [testEventCode, setTestEventCode] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [hasAccessToken, setHasAccessToken] = useState(false);
  const [accessTokenLast4, setAccessTokenLast4] = useState("");
  const [accessTokenMasked, setAccessTokenMasked] = useState("");
  const [tokenDirty, setTokenDirty] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const cfg = await getMetaAdsConfig();
        if (cancelled) return;
        setDatasetId(cfg.datasetId || "");
        setTestEventCode(cfg.testEventCode || "");
        setEnabled(cfg.enabled !== false);
        setHasAccessToken(Boolean(cfg.hasAccessToken));
        setAccessTokenLast4(cfg.accessTokenLast4 || "");
        const masked =
          cfg.accessTokenMasked ||
          (cfg.hasAccessToken && cfg.accessTokenLast4
            ? `EAGE${"•".repeat(20)}${cfg.accessTokenLast4}`
            : "");
        setAccessTokenMasked(masked);
        setAccessToken(masked);
        setTokenDirty(false);
      } catch {
        toast.error("Não foi possível carregar Meta Ads.");
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
      const cfg = await saveMetaAdsConfig({
        datasetId: datasetId.trim(),
        accessToken: looksMasked || !raw ? undefined : raw,
        testEventCode: testEventCode.trim(),
        enabled
      });
      setHasAccessToken(Boolean(cfg.hasAccessToken));
      setAccessTokenLast4(cfg.accessTokenLast4 || "");
      const masked =
        cfg.accessTokenMasked ||
        (cfg.hasAccessToken && cfg.accessTokenLast4
          ? `EAGE${"•".repeat(20)}${cfg.accessTokenLast4}`
          : "");
      setAccessTokenMasked(masked);
      setAccessToken(masked);
      setTokenDirty(false);
      toast.success("Integração Meta Ads salva.");
      onSaved?.(cfg);
    } catch {
      toast.error("Falha ao salvar Meta Ads.");
    } finally {
      setSaving(false);
    }
  }, [
    datasetId,
    accessToken,
    accessTokenMasked,
    testEventCode,
    enabled,
    hasAccessToken,
    tokenDirty,
    onSaved
  ]);

  useEffect(() => {
    if (!registerHeaderActions) return undefined;
    registerHeaderActions(
      <Button
        variant="contained"
        color="primary"
        disableElevation
        disabled={saving || !datasetId.trim()}
        onClick={handleSave}
        className={layout.saveBtn}
      >
        {saving ? "Salvando…" : "Salvar"}
      </Button>
    );
    return () => registerHeaderActions(null);
  }, [registerHeaderActions, saving, handleSave, layout.saveBtn, datasetId]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={280} width="100%">
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
            Conecte o Dataset e o Access Token do Gerenciador de Eventos. Com isso o CRM
            identifica leads de Click-to-WhatsApp, exibe rastreio em tickets e Leads e Vendas,
            e pode devolver conversões para a Meta otimizar anúncios.
          </Typography>

          <TextField
            className={fieldClass}
            label="Dataset ID"
            variant="outlined"
            fullWidth
            value={datasetId}
            onChange={(e) => setDatasetId(e.target.value)}
            placeholder="1681460729620053"
            helperText="ID do conjunto de dados CRM no Events Manager"
          />

          <TextField
            className={fieldClass}
            label="Access Token (Conversions API)"
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
            placeholder="Cole o token gerado na API Conversões"
            helperText={
              hasAccessToken
                ? tokenDirty
                  ? "Digite o novo token para substituir o atual, ou deixe o campo e saia para manter o salvo."
                  : `Token conectado · termina em ${accessTokenLast4}`
                : "Configurações do dataset → API Conversões → Gerar token de acesso"
            }
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    onClick={() => setShowToken((s) => !s)}
                    aria-label={showToken ? "Ocultar token" : "Mostrar token"}
                    disabled={!tokenDirty}
                  >
                    {showToken ? (
                      <VisibilityOff fontSize="small" />
                    ) : (
                      <Visibility fontSize="small" />
                    )}
                  </IconButton>
                </InputAdornment>
              )
            }}
          />

          <TextField
            className={fieldClass}
            label="Test Event Code (opcional)"
            variant="outlined"
            fullWidth
            value={testEventCode}
            onChange={(e) => setTestEventCode(e.target.value)}
            helperText="Código da aba Testar eventos — só para homologação"
          />

          <div className={layout.switchRowPretty}>
            <div>
              <Typography className={layout.switchLabel}>
                Enviar conversões para a Meta
              </Typography>
              <Typography className={layout.switchHint}>
                Lead ao criar oportunidade e Purchase ao fechar venda
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
          <IntegrationApiKeyGuidePanel provider="meta-ads" />
        </div>

        <div className={layout.footer}>
          {typeof onCancel === "function" ? (
            <Button
              variant="outlined"
              onClick={onCancel}
              disabled={saving}
              className={layout.cancelBtn}
            >
              Cancelar
            </Button>
          ) : null}
          <Button
            variant="contained"
            color="primary"
            disableElevation
            disabled={saving || !datasetId.trim()}
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
