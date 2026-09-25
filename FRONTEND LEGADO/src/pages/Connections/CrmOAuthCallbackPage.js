import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  Box,
  Button,
  CircularProgress,
  Typography,
  makeStyles
} from "@material-ui/core";
import { CheckCircle, XCircle } from "lucide-react";
import crmIntegrationService from "../../services/crmIntegrationService";
import api from "../../services/api";

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
  pickerRoot: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    padding: "28px 24px",
    background: "linear-gradient(160deg, #0f0f12 0%, #1a1a22 45%, #12121a 100%)",
    color: "#fafafa",
    fontFamily: "'Inter', system-ui, sans-serif"
  },
  iconOk: { color: "#4ade80", marginBottom: 16 },
  iconErr: { color: "#f87171", marginBottom: 16 },
  title: { fontSize: 18, fontWeight: 600, marginBottom: 8 },
  sub: {
    fontSize: 13,
    color: "#a1a1aa",
    maxWidth: 320,
    lineHeight: 1.5
  },
  pickerTitle: {
    fontSize: 17,
    fontWeight: 700,
    marginBottom: 6,
    letterSpacing: "-0.02em"
  },
  pickerSub: {
    fontSize: 13,
    color: "#a1a1aa",
    lineHeight: 1.5,
    marginBottom: 20
  },
  orgLabel: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    color: "#71717a",
    margin: "16px 0 8px",
    textAlign: "left"
  },
  projectList: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    flex: 1,
    overflowY: "auto",
    paddingRight: 2
  },
  projectBtn: {
    textAlign: "left",
    justifyContent: "flex-start",
    textTransform: "none",
    borderRadius: 12,
    padding: "12px 14px",
    border: "1px solid rgba(255,255,255,0.1)",
    color: "#fafafa",
    background: "rgba(255,255,255,0.04)",
    "&:hover": {
      background: "rgba(62,207,142,0.12)",
      borderColor: "rgba(62,207,142,0.35)"
    }
  },
  projectName: { fontWeight: 600, fontSize: 14, display: "block" },
  projectRef: { fontSize: 12, color: "#a1a1aa", marginTop: 2, display: "block" }
}));

function ensureApiAuth() {
  const rawToken = localStorage.getItem("token");
  if (!rawToken) return false;
  try {
    const parsed = JSON.parse(rawToken);
    api.defaults.headers.Authorization = `Bearer ${parsed}`;
  } catch {
    api.defaults.headers.Authorization = `Bearer ${rawToken}`;
  }
  return true;
}

function postOAuthMessage(payload) {
  const target =
    window.opener && !window.opener.closed
      ? window.opener
      : window.parent && window.parent !== window
        ? window.parent
        : null;
  if (!target) return;

  const targetOrigins = new Set([
    window.location.origin,
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://vbsolution.com.br",
    "https://www.vbsolution.com.br",
    "https://vbsolution.vercel.app"
  ]);

  targetOrigins.forEach((origin) => {
    try {
      target.postMessage(payload, origin);
    } catch {
      /* ignore */
    }
  });
}

function SupabaseProjectPicker({ pickToken, projectCount, onDone }) {
  const classes = useStyles();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState("");
  const [error, setError] = useState("");
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!ensureApiAuth()) {
        setError("Sessão expirada. Feche esta janela, faça login novamente e tente de novo.");
        setLoading(false);
        return;
      }
      try {
        const data = await crmIntegrationService.getSupabasePendingProjects(pickToken);
        if (cancelled) return;
        setProjects(Array.isArray(data?.projects) ? data.projects : []);
      } catch (e) {
        if (cancelled) return;
        setError(
          e?.response?.data?.error ||
            e?.response?.data?.message ||
            "Não foi possível carregar os projetos."
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [pickToken]);

  const grouped = useMemo(() => {
    const map = new Map();
    projects.forEach((project) => {
      const key =
        project.organizationName ||
        project.organizationId ||
        "Projetos disponíveis";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(project);
    });
    return Array.from(map.entries());
  }, [projects]);

  const handleSelect = async (projectRef) => {
    setSubmitting(projectRef);
    setError("");
    try {
      const data = await crmIntegrationService.finalizeSupabaseProject(pickToken, projectRef);
      postOAuthMessage({
        type: "crm-oauth-callback",
        status: "success",
        provider: "supabase",
        name: data?.accountLabel || "",
        workspace: data?.workspaceId || projectRef
      });
      onDone(true);
      try {
        window.close();
      } catch {
        /* ignore */
      }
    } catch (e) {
      setError(
        e?.response?.data?.error ||
          e?.response?.data?.message ||
          "Não foi possível vincular o projeto."
      );
    } finally {
      setSubmitting("");
    }
  };

  if (loading) {
    return (
      <Box className={classes.pickerRoot} style={{ alignItems: "center", justifyContent: "center" }}>
        <CircularProgress size={32} style={{ color: "#3ECF8E", marginBottom: 16 }} />
        <Typography className={classes.pickerSub}>Carregando projetos Supabase…</Typography>
      </Box>
    );
  }

  return (
    <Box className={classes.pickerRoot}>
      <Typography className={classes.pickerTitle}>Escolha o projeto Supabase</Typography>
      <Typography className={classes.pickerSub}>
        Encontramos {projectCount || projects.length} projeto(s) na conta autorizada. Selecione qual
        deseja vincular ao VBSolution e ao Brain.AI IDE Build.
      </Typography>
      {error ? (
        <Typography style={{ color: "#fca5a5", fontSize: 13, marginBottom: 12 }}>{error}</Typography>
      ) : null}
      <div className={classes.projectList}>
        {grouped.map(([orgName, rows]) => (
          <div key={orgName}>
            <Typography className={classes.orgLabel}>{orgName}</Typography>
            {rows.map((project) => (
              <Button
                key={project.ref}
                fullWidth
                className={classes.projectBtn}
                disabled={Boolean(submitting)}
                onClick={() => handleSelect(project.ref)}
              >
                {submitting === project.ref ? (
                  <CircularProgress size={18} style={{ color: "#3ECF8E", marginRight: 10 }} />
                ) : null}
                <span>
                  <span className={classes.projectName}>{project.name}</span>
                  <span className={classes.projectRef}>{project.ref}.supabase.co</span>
                </span>
              </Button>
            ))}
          </div>
        ))}
      </div>
    </Box>
  );
}

export default function CrmOAuthCallbackPage() {
  const location = useLocation();
  const classes = useStyles();
  const [done, setDone] = useState(false);

  const params = new URLSearchParams(location.search);
  const status = params.get("status") || "error";
  const provider = params.get("provider") || "";
  const name = params.get("name") || "";
  const pickToken = params.get("pickToken") || "";
  const projectCount = Number(params.get("count") || 0);
  const isSuccess = status === "success";
  const isProjectPicker = status === "select_project" && provider === "supabase" && pickToken;
  const errorMessage = params.get("message") || "";

  useEffect(() => {
    if (isProjectPicker) return undefined;

    const q = new URLSearchParams(location.search);
    const workspace = q.get("workspace") || "";
    const message = q.get("message") || "";

    const payload = {
      type: "crm-oauth-callback",
      status,
      provider,
      name,
      workspace,
      message
    };

    const delay = status === "success" ? 900 : 2200;

    const timer = setTimeout(() => {
      postOAuthMessage(payload);
      setDone(true);
      try {
        window.close();
      } catch {
        /* ignore */
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [location.search, isProjectPicker, status, provider, name]);

  if (isProjectPicker) {
    return <SupabaseProjectPicker pickToken={pickToken} projectCount={projectCount} onDone={setDone} />;
  }

  return (
    <Box className={classes.root}>
      {isSuccess ? (
        <CheckCircle size={48} className={classes.iconOk} />
      ) : (
        <XCircle size={48} className={classes.iconErr} />
      )}
      <Typography className={classes.title}>
        {isSuccess
          ? name
            ? `${name} conectado`
            : "Integração conectada"
          : "Não foi possível conectar"}
      </Typography>
      <Typography className={classes.sub}>
        {isSuccess
          ? done
            ? "Pode fechar esta janela."
            : "VBSolution CRM · Finalizando…"
          : errorMessage || "Verifique em Integrações e tente novamente."}
      </Typography>
    </Box>
  );
}
