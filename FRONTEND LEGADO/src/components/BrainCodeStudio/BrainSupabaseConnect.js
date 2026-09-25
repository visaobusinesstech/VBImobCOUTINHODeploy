import React, { useCallback, useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import {
  Box,
  Button,
  CircularProgress,
  Popover,
  Typography,
  makeStyles,
  Portal,
  useTheme
} from "@material-ui/core";
import { Link2 } from "lucide-react";
import { SiSupabase } from "react-icons/si";
import { toast } from "react-toastify";
import crmIntegrationService from "../../services/crmIntegrationService";
import { openCrmOAuthPopup, subscribeCrmOAuthCallback } from "../../pages/Connections/crmOAuthPopup";

const useStyles = makeStyles((theme) => {
  const isDark = theme.palette.type === "dark";
  const border = isDark ? "rgba(255,255,255,0.12)" : "rgba(15,23,42,0.12)";
  return {
    paper: {
      width: 400,
      maxWidth: "calc(100vw - 24px)",
      maxHeight: "calc(100vh - 96px)",
      overflow: "auto",
      borderRadius: 14,
      background: isDark ? "rgba(54, 54, 64, 0.98)" : "rgba(255,255,255,0.98)",
      color: isDark ? "#f4f4f5" : undefined,
      border: isDark ? `1px solid ${border}` : "1px solid rgba(15,23,42,0.08)",
      boxShadow: isDark
        ? "0 16px 40px rgba(0,0,0,0.45), 0 0 0 0.5px rgba(255,255,255,0.08)"
        : "0 16px 40px rgba(15,23,42,0.12), 0 0 0 0.5px rgba(0,0,0,0.06)"
    },
    panelHeader: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "12px 14px 8px",
      fontSize: 14,
      fontWeight: 600
    },
    panelBody: {
      padding: "0 14px 10px"
    },
    panelFooter: {
      display: "flex",
      justifyContent: "flex-end",
      gap: 8,
      padding: "10px 14px 12px",
      borderTop: `1px solid ${border}`
    },
    overlay: {
      position: "fixed",
      inset: 0,
      zIndex: 1299,
      backgroundColor: isDark ? "rgba(0, 0, 0, 0.22)" : "rgba(15, 23, 42, 0.16)",
      pointerEvents: "auto"
    },
    connectBtn: {
      textTransform: "none",
      borderRadius: 10,
      fontWeight: 600,
      fontSize: 12,
      padding: "6px 12px",
      border: `1px solid ${border}`,
      color: isDark ? "#fafafa" : theme.palette.text.primary,
      background: isDark ? "rgba(255,255,255,0.04)" : "#fff",
      "&:hover": {
        background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.03)"
      }
    },
    connectBtnEnabled: {
      textTransform: "none",
      borderRadius: 10,
      fontWeight: 600,
      fontSize: 12,
      padding: "6px 12px",
      border: isDark ? "1px solid rgba(62,207,142,0.22)" : "1px solid rgba(62,207,142,0.2)",
      color: isDark ? "#86efac" : "#047857",
      background: isDark ? "rgba(62,207,142,0.1)" : "rgba(62,207,142,0.1)",
      boxShadow: "none",
      "&:hover": {
        background: isDark ? "rgba(62,207,142,0.14)" : "rgba(62,207,142,0.14)"
      }
    },
    primaryBtn: {
      textTransform: "none",
      borderRadius: 10,
      fontWeight: 600,
      background: "#3ECF8E !important",
      color: "#0f172a !important",
      "&:hover": {
        background: "#2eb87a !important"
      },
      "&.Mui-disabled": {
        background: isDark ? "rgba(255,255,255,0.08) !important" : "rgba(0,0,0,0.08) !important",
        color: isDark ? "rgba(255,255,255,0.35) !important" : "rgba(0,0,0,0.35) !important"
      }
    },
    connectBox: {
      border: `1px dashed ${border}`,
      borderRadius: 12,
      padding: theme.spacing(2),
      textAlign: "center",
      marginBottom: theme.spacing(1),
      background: isDark ? "rgba(255,255,255,0.03)" : "rgba(15,23,42,0.02)"
    },
    connectedBox: {
      border: `1px solid ${isDark ? "rgba(62,207,142,0.3)" : "rgba(62,207,142,0.35)"}`,
      borderRadius: 12,
      padding: theme.spacing(1.5, 2),
      marginBottom: theme.spacing(1),
      background: isDark ? "rgba(62,207,142,0.08)" : "rgba(62,207,142,0.06)"
    }
  };
});

export function BrainSupabaseConnectButton({ onClick, buttonRef, connected = false }) {
  const classes = useStyles();
  const theme = useTheme();
  const iconColor = connected
    ? theme.palette.type === "dark"
      ? "#86efac"
      : "#3ECF8E"
    : "#3ECF8E";

  return (
    <Button
      ref={buttonRef}
      size="small"
      className={connected ? classes.connectBtnEnabled : classes.connectBtn}
      startIcon={<SiSupabase size={14} color={iconColor} />}
      onClick={onClick}
    >
      {connected ? "Supabase Habilitado" : "Conecte ao Supabase"}
    </Button>
  );
}

export default function BrainSupabaseConnectDialog({
  open,
  anchorEl,
  onClose,
  projectTitle,
  fileCount = 0
}) {
  const classes = useStyles();
  const history = useHistory();
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [accountLabel, setAccountLabel] = useState("");
  const [projectUrl, setProjectUrl] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const row = await crmIntegrationService.getProvider("supabase");
      setConnected(Boolean(row?.connected));
      setAccountLabel(row?.accountLabel || "");
      setProjectUrl(row?.metadata?.projectUrl || row?.workspaceId || "");
    } catch {
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    load();
  }, [open, load]);

  useEffect(() => {
    if (!open) return undefined;
    return subscribeCrmOAuthCallback((payload) => {
      if (payload.provider && payload.provider !== "supabase") return;
      setOauthLoading(false);
      if (payload.status === "success") {
        toast.success("Supabase conectado.");
        load();
      } else if (payload.message) {
        toast.error(payload.message);
      }
    });
  }, [open, load]);

  const handleOAuthConnect = () => {
    setOauthLoading(true);
    const { ok, reason, popup } = openCrmOAuthPopup("supabase");
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

  return (
    <>
      {open ? (
        <Portal>
          <Box className={classes.overlay} onClick={onClose} aria-hidden />
        </Portal>
      ) : null}
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={onClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        marginThreshold={12}
        hideBackdrop
        style={{ zIndex: 1300 }}
        PaperProps={{ className: classes.paper }}
      >
        <Box className={classes.panelHeader}>
          <SiSupabase size={16} color="#3ECF8E" />
          Conecte ao Supabase
        </Box>
        <Box className={classes.panelBody}>
          <Typography
            variant="body2"
            color="textSecondary"
            paragraph
            style={{ fontSize: 11, marginBottom: 10, lineHeight: 1.45 }}
          >
            Publique o projeto <strong>{projectTitle || "Brain AI"}</strong> ({fileCount}{" "}
            arquivo(s)) no Supabase da organização: Postgres, auth e storage.
          </Typography>

          {loading ? (
            <Box display="flex" justifyContent="center" py={2}>
              <CircularProgress size={22} style={{ color: "#3ECF8E" }} />
            </Box>
          ) : connected ? (
            <Box className={classes.connectedBox}>
              <Typography variant="body2" style={{ fontWeight: 600, marginBottom: 4 }}>
                {accountLabel || "Projeto Supabase"}
              </Typography>
              {projectUrl ? (
                <Typography variant="caption" color="textSecondary" display="block" style={{ lineHeight: 1.45 }}>
                  {projectUrl}
                </Typography>
              ) : null}
              <Typography variant="caption" color="textSecondary" display="block" style={{ marginTop: 8, lineHeight: 1.45 }}>
                Conta vinculada via OAuth. O Brain IDE Build pode consultar o banco e publicar no
                projeto conectado.
              </Typography>
            </Box>
          ) : (
            <Box className={classes.connectBox}>
              <SiSupabase size={28} color="#3ECF8E" style={{ marginBottom: 8 }} />
              <Typography variant="body2" style={{ fontWeight: 600, marginBottom: 4 }}>
                Conectar projeto Supabase
              </Typography>
              <Typography
                variant="caption"
                color="textSecondary"
                display="block"
                style={{ marginBottom: 12, lineHeight: 1.45 }}
              >
                Autorize o acesso aos projetos da sua organização no Supabase. Um popup OAuth abrirá
                para você escolher a conta e os projetos.
              </Typography>
              <Button
                size="small"
                className={classes.primaryBtn}
                onClick={handleOAuthConnect}
                disabled={oauthLoading}
                startIcon={
                  oauthLoading ? <CircularProgress size={14} color="inherit" /> : <SiSupabase size={13} />
                }
              >
                {oauthLoading ? "Aguardando autorização…" : "Conectar via OAuth"}
              </Button>
            </Box>
          )}

          <Box display="flex" alignItems="center" style={{ gap: 8, marginTop: 8 }}>
            <Link2 size={14} style={{ opacity: 0.55, flexShrink: 0 }} />
            <Typography variant="caption" color="textSecondary" style={{ fontSize: 11, lineHeight: 1.45 }}>
              Configure também em Integrações → Supabase → Administrar.
            </Typography>
          </Box>
        </Box>
        <Box className={classes.panelFooter}>
          <Button onClick={onClose} size="small" style={{ textTransform: "none", fontSize: 12 }}>
            Fechar
          </Button>
          <Button
            size="small"
            className={classes.connectBtn}
            onClick={() => {
              onClose();
              history.push("/connections/supabase/manage");
            }}
          >
            Ver em Integrações
          </Button>
        </Box>
      </Popover>
    </>
  );
}
