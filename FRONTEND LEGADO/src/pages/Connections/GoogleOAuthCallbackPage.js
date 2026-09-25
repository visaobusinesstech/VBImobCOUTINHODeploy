import React, { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Box, CircularProgress, Typography } from "@material-ui/core";

/**
 * Callback OAuth Google — notifica janela pai (modal iframe) ou popup e fecha.
 */
export default function GoogleOAuthCallbackPage() {
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const status = params.get("status") || "error";
    const integrationKey = params.get("integrationKey") || "";
    const email = params.get("email") || "";
    const message = params.get("message") || "";

    const payload = {
      type: "google-oauth-callback",
      status,
      integrationKey,
      email,
      message,
    };

    const origin = window.location.origin;

    if (window.parent && window.parent !== window) {
      window.parent.postMessage(payload, origin);
    }

    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(payload, origin);
      window.close();
      return;
    }

    if (window.parent && window.parent !== window) {
      return;
    }
  }, [location.search]);

  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      minHeight="100vh"
      p={3}
      style={{ background: "#fff" }}
    >
      <CircularProgress size={32} />
      <Typography variant="body2" color="textSecondary" style={{ marginTop: 16 }}>
        Finalizando conexão Google…
      </Typography>
    </Box>
  );
}
