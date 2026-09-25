import React, { useCallback, useEffect, useState } from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Typography,
  makeStyles,
} from "@material-ui/core";
import { toast } from "react-toastify";
import crmIntegrationService from "../../../services/crmIntegrationService";
import { getIntegrationByKey } from "../integrationCatalog";
import { CONNECTIONS_FONT } from "../connectionsTypography";
import { useSetupHeaderActions } from "../ConnectionsChannelLayout";
import { supportsCrmOAuth, CRM_MODULES_DOC } from "../../../config/crmIntegrationProviders";
import { openCrmOAuthPopup, subscribeCrmOAuthCallback } from "../crmOAuthPopup";
import CrmIntegrationGuidePanel from "../CrmIntegrationGuidePanel";
import IntegrationBrandIcon, { getBrandVisual } from "../IntegrationBrandIcon";

const useLayoutStyles = makeStyles((theme) => {
  const isDark = theme.palette.type === "dark";
  return {
    root: {
      fontFamily: CONNECTIONS_FONT,
      width: "100%",
      maxWidth: "100%",
      boxSizing: "border-box",
      padding: theme.spacing(0, 0.5, 2),
      [theme.breakpoints.up("md")]: {
        padding: theme.spacing(0, 1, 2)
      }
    },
    grid: {
      display: "grid",
      gridTemplateColumns: "1fr",
      gap: theme.spacing(2.5),
      alignItems: "stretch",
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
      height: "100%",
      paddingTop: theme.spacing(2)
    },
    asideCol: {
      minWidth: 0,
      height: "100%",
      display: "flex",
      flexDirection: "column",
      paddingTop: theme.spacing(2),
      "& > *": {
        flex: 1,
        width: "100%"
      },
      [theme.breakpoints.up("md")]: {
        position: "sticky",
        top: theme.spacing(1)
      }
    },
    oauthBox: {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: theme.spacing(3),
      borderRadius: 16,
      border: `1px solid ${isDark ? "rgba(99,102,241,0.35)" : "rgba(99,102,241,0.25)"}`,
      background: isDark ? "rgba(99,102,241,0.08)" : "rgba(99,102,241,0.04)",
      textAlign: "center",
      minHeight: 0
    },
    oauthLogo: {
      display: "flex",
      justifyContent: "center",
      marginBottom: theme.spacing(2)
    },
    oauthTitle: { fontSize: "1.05rem", fontWeight: 700, marginBottom: 8 },
    oauthHint: {
      fontSize: "0.875rem",
      color: theme.palette.text.secondary,
      lineHeight: 1.5,
      marginBottom: 20,
      maxWidth: 420,
      marginLeft: "auto",
      marginRight: "auto"
    },
    oauthBtn: {
      textTransform: "none",
      fontWeight: 600,
      borderRadius: 10,
      padding: "10px 22px",
      boxShadow: "none"
    },
    connectedBox: {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      textAlign: "center",
      padding: theme.spacing(3),
      borderRadius: 16,
      border: `1px solid ${isDark ? "rgba(37,211,102,0.25)" : "rgba(37,211,102,0.3)"}`,
      background: isDark ? "rgba(37,211,102,0.08)" : "rgba(37,211,102,0.06)",
      minHeight: 0
    },
    connectedLogo: {
      display: "flex",
      justifyContent: "center",
      marginBottom: theme.spacing(2)
    },
    connectedTitle: { fontWeight: 700, fontSize: "0.9375rem", marginBottom: 6 },
    connectedMeta: { fontSize: "0.8125rem", color: theme.palette.text.secondary, lineHeight: 1.45 },
    disconnectBtn: {
      marginTop: 16,
      textTransform: "none",
      borderRadius: 8
    }
  };
});

export default function CrmIntegrationSetupForm({ integrationKey, onSaved }) {
  const integration = getIntegrationByKey(integrationKey);
  const visual = getBrandVisual(integration);
  const classes = useLayoutStyles();
  const registerHeaderActions = useSetupHeaderActions();
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [accountLabel, setAccountLabel] = useState("");
  const hasOAuth = supportsCrmOAuth(integrationKey);

  const load = useCallback(async () => {
    try {
      const row = await crmIntegrationService.getProvider(integrationKey);
      setConnected(Boolean(row?.connected));
      setAccountLabel(row?.accountLabel || "");
    } catch {
      setConnected(false);
    }
  }, [integrationKey]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!hasOAuth) return undefined;
    return subscribeCrmOAuthCallback(async (payload) => {
      if (payload.provider && payload.provider !== integrationKey) return;
      setOauthLoading(false);
      if (payload.status === "success") {
        toast.success(`${integration?.label} conectado.`);
        await load();
        onSaved?.();
      } else if (payload.message) {
        toast.error(payload.message);
      }
    });
  }, [integrationKey, integration?.label, load, onSaved, hasOAuth]);

  const handleOAuthConnect = () => {
    setOauthLoading(true);
    const { ok, reason, popup } = openCrmOAuthPopup(integrationKey);
    if (!ok) {
      setOauthLoading(false);
      if (reason === "blocked") {
        toast.warn("Permita pop-ups neste site para conectar via OAuth.");
      }
      return;
    }
    const poll = window.setInterval(() => {
      if (!popup || popup.closed) {
        window.clearInterval(poll);
        setOauthLoading(false);
      }
    }, 600);
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      await crmIntegrationService.disconnect(integrationKey);
      setConnected(false);
      setAccountLabel("");
      toast.info("Integração desconectada.");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.error || "Erro ao desconectar.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!registerHeaderActions) return undefined;
    registerHeaderActions(
      connected ? (
        <Chip
          size="small"
          label="Conectado"
          style={{ background: "rgba(37,211,102,0.15)", color: "#15803d" }}
        />
      ) : null
    );
    return () => registerHeaderActions(null);
  }, [registerHeaderActions, connected]);

  if (!hasOAuth) {
    return (
      <Box className={classes.root}>
        <Typography color="textSecondary" style={{ padding: 24, textAlign: "center" }}>
          {integration?.label} não usa OAuth. Configure em Integrações → Administrar.
        </Typography>
      </Box>
    );
  }

  const formBody = connected ? (
    <Box className={classes.connectedBox}>
      <Box className={classes.connectedLogo}>
        <IntegrationBrandIcon
          brandKey={visual.brandKey}
          variant="hubBox"
          accentColor={visual.accent}
          plain
        />
      </Box>
      <Typography className={classes.connectedTitle}>
        Conta {integration?.label} conectada
      </Typography>
      <Typography className={classes.connectedMeta}>
        {accountLabel ? (
          <>
            <strong>{accountLabel}</strong>
            <br />
          </>
        ) : null}
        Sua organização está autorizada. Use <strong>Importar</strong> em {CRM_MODULES_DOC} para
        trazer leads, atividades, projetos e demais dados de {integration?.label}.
      </Typography>
      <Button
        variant="outlined"
        color="secondary"
        className={classes.disconnectBtn}
        onClick={handleDisconnect}
        disabled={loading}
      >
        {loading ? "Desconectando…" : "Desconectar conta"}
      </Button>
    </Box>
  ) : (
    <Box className={classes.oauthBox}>
      <Box className={classes.oauthLogo}>
        <IntegrationBrandIcon
          brandKey={visual.brandKey}
          variant="hubBox"
          accentColor={visual.accent}
          plain
        />
      </Box>
      <Typography className={classes.oauthTitle}>
        Conectar {integration?.label}
      </Typography>
      <Typography className={classes.oauthHint}>
        Autorize o acesso à conta {integration?.label} da sua organização em um popup seguro.
        Os tokens ficam criptografados e isolados por workspace.
      </Typography>
      <Button
        variant="contained"
        color="primary"
        disableElevation
        className={classes.oauthBtn}
        onClick={handleOAuthConnect}
        disabled={loading || oauthLoading}
        startIcon={oauthLoading ? <CircularProgress size={18} color="inherit" /> : null}
      >
        {oauthLoading ? "Aguardando autorização…" : `Conectar conta ${integration?.label}`}
      </Button>
    </Box>
  );

  return (
    <Box className={classes.root}>
      <div className={classes.grid}>
        <div className={classes.formCol}>{formBody}</div>
        <div className={classes.asideCol}>
          <CrmIntegrationGuidePanel providerKey={integrationKey} oauthOnly />
        </div>
      </div>
    </Box>
  );
}
