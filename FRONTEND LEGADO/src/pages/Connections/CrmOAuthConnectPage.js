import React, { useEffect, useState } from "react";
import { Box, CircularProgress, Typography, makeStyles } from "@material-ui/core";
import { useParams } from "react-router-dom";
import crmIntegrationService from "../../services/crmIntegrationService";
import api from "../../services/api";
import IntegrationBrandIcon, { getBrandVisual } from "./IntegrationBrandIcon";
import { getIntegrationByKey } from "./integrationCatalog";

const OAUTH_PROVIDERS = new Set(["hubspot", "pipedrive", "clickup", "notion", "supabase"]);

function resolveOAuthErrorMessage(integrationKey, err) {
  const status = err?.response?.status;
  const msg = String(err?.response?.data?.error || err?.response?.data?.message || "").trim();

  if (/não configurados|OAUTH_CLIENT_ID|CLIENT_SECRET|OAUTH_CLIENT/i.test(msg)) {
    if (integrationKey === "supabase") {
      return "Configure SUPABASE_OAUTH_CLIENT_ID e SUPABASE_OAUTH_CLIENT_SECRET no Railway (ou .env local) e reinicie o backend.";
    }
    if (integrationKey === "pipedrive") {
      return "Configure PIPEDRIVE_OAUTH_CLIENT_ID e PIPEDRIVE_OAUTH_CLIENT_SECRET no .env do backend (ou Railway) e reinicie o servidor.";
    }
    if (integrationKey === "hubspot") {
      return "Configure HUBSPOT_OAUTH_CLIENT_ID e HUBSPOT_OAUTH_CLIENT_SECRET no .env do backend (ou Railway) e reinicie o backend (npm run dev).";
    }
    if (integrationKey === "notion") {
      return "Configure NOTION_OAUTH_CLIENT_ID e NOTION_OAUTH_CLIENT_SECRET no .env do backend (ou Railway) e reinicie o servidor.";
    }
    return "OAuth deste provedor ainda não está configurado no servidor.";
  }
  if (msg === "ERR_NO_PERMISSION" || status === 403) {
    return "Apenas administradores podem conectar integrações.";
  }
  if (msg === "ERR_SESSION_EXPIRED" || status === 401) {
    return "Sessão expirada. Feche esta janela, faça login novamente e tente de novo.";
  }
  if (msg === "ERR_OAUTH_NOT_SUPPORTED") {
    return "OAuth não disponível para esta integração.";
  }
  if (msg === "Internal server error" || status === 500) {
    return "Erro interno ao iniciar OAuth. Verifique as variáveis no backend e reinicie o servidor.";
  }
  return msg || "Não foi possível conectar agora.";
}

const useStyles = makeStyles(() => ({
  root: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    background: "linear-gradient(160deg, #0f0f12 0%, #1a1a22 45%, #12121a 100%)",
    color: "#fafafa",
    fontFamily: "'Inter', system-ui, sans-serif",
    textAlign: "center"
  },
  logoRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 24
  },
  vbBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    background: "linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 800,
    fontSize: 16
  },
  title: { fontSize: 18, fontWeight: 600, marginBottom: 8 },
  sub: {
    fontSize: 13,
    color: "#a1a1aa",
    maxWidth: 340,
    lineHeight: 1.5,
    marginBottom: 20
  },
  error: { fontSize: 13, color: "#fca5a5", maxWidth: 360, lineHeight: 1.5 }
}));

export default function CrmOAuthConnectPage() {
  const { integrationKey } = useParams();
  const classes = useStyles();
  const [error, setError] = useState("");
  const integration = getIntegrationByKey(integrationKey);
  const visual = getBrandVisual(integration);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!OAUTH_PROVIDERS.has(integrationKey)) {
        setError("OAuth não disponível para esta integração.");
        return;
      }

      const rawToken = localStorage.getItem("token");
      if (!rawToken) {
        setError("Sessão expirada. Feche esta janela, faça login novamente e tente de novo.");
        return;
      }

      try {
        const parsed = JSON.parse(rawToken);
        api.defaults.headers.Authorization = `Bearer ${parsed}`;
      } catch {
        api.defaults.headers.Authorization = `Bearer ${rawToken}`;
      }

      await new Promise((resolve) => setTimeout(resolve, 80));

      try {
        const data = await crmIntegrationService.getOAuthAuthorizeUrl(integrationKey);
        if (cancelled) return;
        if (!data?.authorizeUrl) {
          setError("Não foi possível iniciar a autorização.");
          return;
        }
        window.location.replace(data.authorizeUrl);
      } catch (e) {
        if (cancelled) return;
        const friendly = resolveOAuthErrorMessage(integrationKey, e);
        setError(friendly);
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(
            {
              type: "crm-oauth-callback",
              status: "error",
              provider: integrationKey,
              message: friendly
            },
            window.location.origin
          );
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [integrationKey]);

  return (
    <Box className={classes.root}>
      <div className={classes.logoRow}>
        <span className={classes.vbBadge}>VB</span>
        <IntegrationBrandIcon brandKey={visual.brandKey} variant="hub" accentColor={visual.accent} plain />
      </div>
      <Typography className={classes.title}>
        {error ? `Conexão ${integration?.label || ""}` : `Conectando ${integration?.label || "CRM"}…`}
      </Typography>
      <Typography className={classes.sub}>
        {error
          ? "Esta janela pode ser fechada."
          : "VBSolution CRM · Autorize o acesso na próxima tela. Não feche esta janela até concluir."}
      </Typography>
      {error ? (
        <Typography className={classes.error}>{error}</Typography>
      ) : (
        <CircularProgress size={32} style={{ color: "#a1a1aa" }} />
      )}
    </Box>
  );
}
