import React, { useEffect, useState, useCallback } from "react";
import {
  Button,
  Box,
  Typography,
  CircularProgress,
  Dialog,
} from "@material-ui/core";
import { toast } from "react-toastify";
import ConnectionSetupFluid from "../ConnectionSetupFluid";
import IntegrationBrandIcon, { getBrandVisual } from "../IntegrationBrandIcon";
import { getIntegrationByKey } from "../integrationCatalog";
import {
  getAuthorizeUrl,
  getOAuthStatus,
} from "../../../services/googleWorkspaceService";
import toastError from "../../../errors/toastError";

export default function GoogleWorkspaceConnectForm({
  integrationKey,
  onCancel,
  onSaved,
  hidePageHeader = false,
}) {
  const integration = getIntegrationByKey(integrationKey);
  const visual = getBrandVisual(integration);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [configMessage, setConfigMessage] = useState("");
  const [oauthModalOpen, setOauthModalOpen] = useState(false);
  const [authorizeUrl, setAuthorizeUrl] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const status = await getOAuthStatus();
        if (!cancelled) {
          setConfigured(Boolean(status?.configured));
          setConfigMessage(status?.message || "");
        }
      } catch {
        if (!cancelled) {
          setConfigured(false);
          setConfigMessage("Não foi possível verificar OAuth no servidor.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const closeOAuthModal = useCallback(() => {
    setOauthModalOpen(false);
    setAuthorizeUrl("");
    setConnecting(false);
  }, []);

  const handleOAuthMessage = useCallback(
    (event) => {
      if (event.origin !== window.location.origin) return;
      const payload = event.data;
      if (!payload || payload.type !== "google-oauth-callback") return;

      closeOAuthModal();

      if (payload.status === "success") {
        toast.success(
          payload.email
            ? `Conta Google conectada: ${payload.email}`
            : "Conta Google conectada com sucesso."
        );
        onSaved();
      } else {
        toast.error(payload.message || "Falha ao conectar com o Google.");
      }
    },
    [onSaved, closeOAuthModal]
  );

  useEffect(() => {
    window.addEventListener("message", handleOAuthMessage);
    return () => window.removeEventListener("message", handleOAuthMessage);
  }, [handleOAuthMessage]);

  const connectWithGoogle = async () => {
    if (!configured) {
      toast.error(configMessage || "Não foi possível iniciar a conexão com o Google.");
      return;
    }
    setConnecting(true);
    setOauthModalOpen(true);
    try {
      const { authorizeUrl: url } = await getAuthorizeUrl(integrationKey);
      if (!url) {
        throw new Error("URL de autorização não retornada.");
      }
      setAuthorizeUrl(url);

      const w = 520;
      const h = 640;
      const left = Math.max(0, window.screenX + (window.outerWidth - w) / 2);
      const top = Math.max(0, window.screenY + (window.outerHeight - h) / 2);
      const popup = window.open(
        url,
        "google_oauth_vb",
        `width=${w},height=${h},left=${left},top=${top},scrollbars=yes,resizable=yes`
      );

      if (!popup) {
        toast.warning(
          "Permita popups ou use o botão abaixo para abrir a autorização Google."
        );
        return;
      }

      const timer = setInterval(() => {
        if (popup.closed) {
          clearInterval(timer);
          setConnecting(false);
          setOauthModalOpen(false);
          setAuthorizeUrl("");
        }
      }, 400);
    } catch (err) {
      setConnecting(false);
      setOauthModalOpen(false);
      toastError(err);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={6}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  const serviceLabel = integration?.label || "Google";

  return (
    <>
      <ConnectionSetupFluid
        fluid
        hidePageHeader={hidePageHeader}
        title={`Conectar ${serviceLabel}`}
        subtitle="OAuth Google — conta vinculada à sua organização."
        hint="Autorize com sua conta Google. A conexão fica vinculada à sua organização."
        footer={
          <>
            <Button onClick={onCancel} color="default">
              Cancelar
            </Button>
            <Button
              onClick={connectWithGoogle}
              color="primary"
              variant="contained"
              disableElevation
              disabled={connecting || !configured}
              startIcon={connecting && !oauthModalOpen ? <CircularProgress size={16} /> : null}
            >
              Conectar com Google
            </Button>
          </>
        }
      >
        <Box
          display="flex"
          flexDirection="column"
          alignItems="center"
          textAlign="center"
          py={4}
          px={2}
        >
          <Box mb={2.5}>
            <IntegrationBrandIcon
              brandKey={visual.brandKey}
              variant="hubBox"
              accentColor={visual.accent}
              plain
            />
          </Box>
          <Typography variant="h6" style={{ fontWeight: 600, marginBottom: 8 }}>
            {serviceLabel}
          </Typography>
          <Typography variant="body2" color="textSecondary" style={{ maxWidth: 420 }}>
            {integration?.description}
          </Typography>
        </Box>
      </ConnectionSetupFluid>

      <Dialog
        open={oauthModalOpen}
        onClose={closeOAuthModal}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          style: {
            borderRadius: 16,
            overflow: "hidden",
            textAlign: "center",
            padding: "8px 0 0",
          },
        }}
      >
        <Box px={3} py={3}>
          <Box display="flex" justifyContent="center" mb={2.5}>
            <IntegrationBrandIcon
              brandKey={visual.brandKey}
              variant="hubBox"
              plain
            />
          </Box>
          <Typography variant="h6" style={{ fontWeight: 600, marginBottom: 8 }}>
            Conectar {serviceLabel}
          </Typography>
          <Typography variant="body2" color="textSecondary" paragraph>
            Complete o login na janela do Google (centralizada). Ao terminar, esta
            tela fecha automaticamente.
          </Typography>
          <CircularProgress size={36} style={{ margin: "12px 0 20px" }} />
          {authorizeUrl ? (
            <Button
              href={authorizeUrl}
              target="google_oauth_vb"
              rel="noopener noreferrer"
              color="primary"
              variant="outlined"
              size="small"
              onClick={() => {}}
            >
              Reabrir autorização Google
            </Button>
          ) : null}
        </Box>
        <Box px={2} py={1.5} style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
          <Button onClick={closeOAuthModal} size="small" color="default">
            Cancelar
          </Button>
        </Box>
      </Dialog>
    </>
  );
}
