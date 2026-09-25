import React, { useEffect, useState } from "react";
import { Box, Button, CircularProgress, Typography } from "@material-ui/core";
import { useLocation } from "react-router-dom";
import api from "../../services/api";
import {
  IG_OAUTH_POPUP_NAME,
  IG_OAUTH_RESULT_KEY,
  IG_OAUTH_STATE_POPUP,
} from "./instagramOAuthPopup";

function isPopupContext(search) {
  try {
    const params = new URLSearchParams(search || "");
    const state = String(params.get("state") || "");
    if (state === IG_OAUTH_STATE_POPUP || state.includes(IG_OAUTH_STATE_POPUP)) {
      return true;
    }
    if (typeof window !== "undefined") {
      if (window.name === IG_OAUTH_POPUP_NAME) return true;
      if (window.opener && !window.opener.closed) return true;
      try {
        const ts = Number(localStorage.getItem("vbsolution_ig_oauth_popup_active") || 0);
        if (ts && Date.now() - ts < 15 * 60 * 1000) return true;
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }
  return false;
}

function notifyOpener(payload) {
  const full = {
    type: "instagram-oauth-callback",
    ...payload,
    ts: Date.now(),
  };
  try {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(full, window.location.origin);
    }
  } catch {
    // ignore
  }
  try {
    localStorage.setItem(IG_OAUTH_RESULT_KEY, JSON.stringify(full));
  } catch {
    // ignore
  }
}

function forceClosePopup() {
  const tryClose = () => {
    try {
      window.close();
    } catch {
      // ignore
    }
    try {
      window.open("", "_self");
      window.close();
    } catch {
      // ignore
    }
  };
  tryClose();
  [80, 250, 600, 1200, 2500].forEach((ms) => setTimeout(tryClose, ms));
}

/**
 * Callback Instagram Login.
 * SEMPRE troca o code aqui (cookies do CRM na mesma origem) e notifica o pai.
 * Depois fecha o popup — nunca navega para o hub do CRM.
 */
export default function InstagramOAuthCallback() {
  const location = useLocation();
  const [status, setStatus] = useState("Conectando Instagram…");
  const [done, setDone] = useState(false);
  const [doneError, setDoneError] = useState("");
  const isPopup = isPopupContext(location.search);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const params = new URLSearchParams(location.search);
      const code = params.get("code");
      const error = params.get("error");
      const errorReason = params.get("error_reason");
      const errorDesc = params.get("error_description");

      try {
        if (window.history?.replaceState) {
          window.history.replaceState({}, document.title, "/connections/instagram-oauth");
        }
      } catch {
        // ignore
      }

      if (error) {
        const msg =
          errorDesc || errorReason || "Login Instagram cancelado ou negado.";
        notifyOpener({ ok: false, error: msg });
        setDone(true);
        setDoneError(msg);
        setStatus(msg);
        if (isPopup) forceClosePopup();
        return;
      }

      if (!code) {
        const msg = "Código OAuth do Instagram ausente.";
        notifyOpener({ ok: false, error: msg });
        setDone(true);
        setDoneError(msg);
        setStatus(msg);
        if (isPopup) forceClosePopup();
        return;
      }

      const redirectUri = `${window.location.origin}/connections/instagram-oauth`;

      try {
        setStatus("Criando conexão Instagram…");
        const res = await api.post("/instagram/login", { code, redirectUri });
        if (cancelled) return;

        const count = Number(res?.data?.count) || 0;
        if (count < 1) {
          const msg = "Login ok, mas a conexão não foi salva.";
          notifyOpener({ ok: false, error: msg });
          setDone(true);
          setDoneError(msg);
          setStatus(msg);
          if (isPopup) forceClosePopup();
          return;
        }

        try {
          const list = await api.get("/whatsapp/");
          const items = Array.isArray(list?.data)
            ? list.data
            : list?.data?.whatsapps || list?.data?.records || [];
          const conn = items.find(
            (w) =>
              w?.channel === "instagram" &&
              String(w?.status || "").toUpperCase() === "CONNECTED"
          );
          if (conn?.id) {
            await api.post(`/whatsapp/${conn.id}/repair-meta-messenger`);
          }
        } catch {
          // ignore repair
        }

        // Notifica pai COM a conexão já criada (não só o code).
        notifyOpener({ ok: true, data: res.data, count });
        setDone(true);
        setStatus("Instagram conectado! Fechando…");
        if (isPopup) {
          forceClosePopup();
        }
      } catch (err) {
        if (cancelled) return;
        const msg =
          err?.response?.data?.error ||
          err?.message ||
          "Falha ao conectar Instagram Login.";
        notifyOpener({ ok: false, error: msg });
        setDone(true);
        setDoneError(msg);
        setStatus(msg);
        if (isPopup) forceClosePopup();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [location.search, isPopup]);

  return (
    <Box
      minHeight="100vh"
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      gridGap={16}
      style={{ background: "#0b0b0b", color: "#fff", padding: 24 }}
    >
      {!done ? <CircularProgress color="inherit" /> : null}
      <Typography variant="body1" align="center">
        {status}
      </Typography>
      {isPopup ? (
        <Typography variant="caption" style={{ opacity: 0.7 }} align="center">
          Use a conta Instagram Business desejada nesta janela (pode ser diferente da do navegador).
        </Typography>
      ) : null}
      {done ? (
        <>
          <Typography variant="caption" style={{ opacity: 0.75 }} align="center">
            {doneError
              ? "Feche e tente de novo no CRM."
              : "Conexão criada. Esta janela pode fechar."}
          </Typography>
          <Button variant="contained" color="primary" onClick={() => forceClosePopup()}>
            Fechar janela
          </Button>
        </>
      ) : null}
    </Box>
  );
}
