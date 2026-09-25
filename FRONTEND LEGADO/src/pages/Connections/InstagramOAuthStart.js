import React, { useEffect, useMemo, useState } from "react";
import { Box, Button, CircularProgress, Typography } from "@material-ui/core";
import { useLocation } from "react-router-dom";
import {
  IG_OAUTH_POPUP_NAME,
  buildInstagramFreshSessionStartUrl,
  buildInstagramLoginGateUrl,
  isSafeInstagramAuthorizeUrl,
} from "./instagramOAuthPopup";

/**
 * Página intermediária opcional do popup Instagram (troca de conta).
 * Por padrão o popup abre /oauth/authorize direto — esta página só aparece
 * se forceAccountPicker=true.
 *
 * NÃO redireciona automaticamente para logout (Instagram costuma cair no feed).
 */
export default function InstagramOAuthStart() {
  const location = useLocation();
  const [error, setError] = useState("");

  const authorizeUrl = useMemo(() => {
    try {
      const params = new URLSearchParams(location.search || "");
      return String(params.get("auth") || "").trim();
    } catch {
      return "";
    }
  }, [location.search]);

  const safe = isSafeInstagramAuthorizeUrl(authorizeUrl);

  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        window.name = IG_OAUTH_POPUP_NAME;
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!authorizeUrl) {
      setError("URL de autorização Instagram ausente.");
      return;
    }
    if (!safe) {
      setError("URL de autorização Instagram inválida.");
    }
  }, [authorizeUrl, safe]);

  const goAuthorize = () => {
    if (!safe) return;
    window.location.replace(authorizeUrl);
  };

  const goFresh = () => {
    if (!safe) return;
    window.location.replace(buildInstagramFreshSessionStartUrl(authorizeUrl));
  };

  const goCurrentSession = () => {
    if (!safe) return;
    window.location.replace(buildInstagramLoginGateUrl(authorizeUrl));
  };

  return (
    <Box
      minHeight="100vh"
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      style={{
        background: "#0b0b0b",
        color: "#fff",
        padding: 28,
        textAlign: "center",
        boxSizing: "border-box",
      }}
    >
      {!error ? (
        <CircularProgress color="inherit" size={28} style={{ marginBottom: 16 }} />
      ) : null}
      <Typography variant="h6" style={{ fontWeight: 700, marginBottom: 8 }}>
        Conectar Instagram Business
      </Typography>
      {error ? (
        <Typography variant="body2" style={{ opacity: 0.85, maxWidth: 360 }}>
          {error}
        </Typography>
      ) : (
        <>
          <Typography
            variant="body2"
            style={{ opacity: 0.85, maxWidth: 380, marginBottom: 20 }}
          >
            Escolha como continuar. O caminho mais confiável é autorizar direto
            (recomendado).
          </Typography>
          <Box
            display="flex"
            flexDirection="column"
            style={{ gap: 10, width: "100%", maxWidth: 320 }}
          >
            <Button variant="contained" color="primary" onClick={goAuthorize} fullWidth>
              Continuar (autorizar)
            </Button>
            <Button variant="outlined" color="inherit" onClick={goCurrentSession} fullWidth>
              Usar conta já logada no navegador
            </Button>
            <Button variant="text" color="inherit" onClick={goFresh} fullWidth>
              Entrar com outra conta
            </Button>
          </Box>
        </>
      )}
    </Box>
  );
}
