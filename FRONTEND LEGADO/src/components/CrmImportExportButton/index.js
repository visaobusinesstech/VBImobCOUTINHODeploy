import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  IconButton,
  Popover,
  Typography,
  makeStyles
} from "@material-ui/core";
import { X } from "lucide-react";
import { toast } from "react-toastify";
import crmIntegrationService from "../../services/crmIntegrationService";
import { dispatchCrmImported } from "../../hooks/useCrmImportRefresh";
import IntegrationBrandIcon, { getBrandVisual } from "../../pages/Connections/IntegrationBrandIcon";
import { CRM_SYNC_PROVIDERS, CRM_PAGE_CONFIG } from "../../config/crmIntegrationProviders";
import CrmImportExportHelpButton from "./CrmImportExportHelp";
import useAppTranslation from "../../hooks/useAppTranslation";

const NAVY = "#1e3a8a";
const NAVY_HOVER = "#1e40af";

const useStyles = makeStyles((theme) => {
  const isDark = theme.palette.type === "dark";
  const glassBg = isDark
    ? "linear-gradient(165deg, rgba(38,38,42,0.92) 0%, rgba(24,24,28,0.88) 100%)"
    : "linear-gradient(165deg, rgba(255,255,255,0.96) 0%, rgba(248,250,252,0.9) 100%)";
  const border = isDark ? "rgba(255,255,255,0.12)" : "rgba(15,23,42,0.08)";
  const muted = isDark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.04)";
  const depthShadow = isDark
    ? "0 0 0 1px rgba(255,255,255,0.06), 0 1px 2px rgba(0,0,0,0.35), 0 8px 24px rgba(0,0,0,0.45), 0 24px 48px rgba(0,0,0,0.4), 0 40px 80px rgba(0,0,0,0.25)"
    : "0 0 0 1px rgba(15,23,42,0.06), 0 2px 4px rgba(15,23,42,0.04), 0 12px 32px rgba(15,23,42,0.12), 0 28px 64px rgba(15,23,42,0.1), 0 48px 96px rgba(15,23,42,0.08)";

  return {
    trigger: {
      textTransform: "none",
      fontSize: 11,
      fontWeight: 500,
      lineHeight: 1.2,
      minWidth: 0,
      padding: "3px 8px",
      color: `${theme.palette.text.secondary} !important`,
      background: "transparent !important",
      boxShadow: "none !important",
      border: `1px solid ${border}`,
      borderRadius: 8,
      "&:hover": {
        background: `${muted} !important`,
        color: `${theme.palette.text.primary} !important`,
        borderColor: isDark ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.12)"
      }
    },
    popoverPaper: {
      width: 520,
      maxWidth: "calc(100vw - 24px)",
      maxHeight: "min(68vh, 380px)",
      borderRadius: 18,
      overflow: "hidden",
      background: glassBg,
      backdropFilter: "blur(28px) saturate(180%)",
      WebkitBackdropFilter: "blur(28px) saturate(180%)",
      border: `1px solid ${border}`,
      boxShadow: depthShadow,
      position: "relative",
      "&::before": {
        content: '""',
        position: "absolute",
        inset: 0,
        borderRadius: 18,
        pointerEvents: "none",
        background: isDark
          ? "linear-gradient(180deg, rgba(255,255,255,0.07) 0%, transparent 28%)"
          : "linear-gradient(180deg, rgba(255,255,255,0.92) 0%, transparent 36%)"
      }
    },
    header: {
      padding: "14px 16px 0",
      position: "relative",
      zIndex: 1,
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 6
    },
    title: {
      fontSize: 14,
      fontWeight: 600,
      letterSpacing: "-0.02em",
      color: theme.palette.text.primary
    },
    subtitle: { fontSize: 11, color: theme.palette.text.secondary, marginTop: 2 },
    closeBtn: { padding: 4, color: theme.palette.text.secondary },
    body: {
      padding: "12px 16px 16px",
      overflowY: "auto",
      maxHeight: "calc(min(68vh, 380px) - 120px)",
      position: "relative",
      zIndex: 1
    },
    hint: {
      padding: "8px 10px",
      borderRadius: 10,
      fontSize: 11,
      lineHeight: 1.45,
      color: theme.palette.text.secondary,
      background: muted
    },
    list: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 },
    card: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "9px 11px",
      borderRadius: 12,
      border: `1px solid ${border}`,
      background: isDark ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.65)",
      cursor: "pointer",
      width: "100%",
      textAlign: "left",
      boxShadow: isDark
        ? "0 1px 2px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.04)"
        : "0 1px 3px rgba(15,23,42,0.06), inset 0 1px 0 rgba(255,255,255,0.9)",
      transition: "transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease",
      "&:hover": {
        transform: "translateY(-1px)",
        boxShadow: isDark
          ? "0 4px 12px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)"
          : "0 4px 14px rgba(15,23,42,0.08), inset 0 1px 0 rgba(255,255,255,1)"
      }
    },
    cardDisabled: {
      opacity: 0.34,
      cursor: "default",
      pointerEvents: "none",
      boxShadow: "none",
      "&:hover": { transform: "none" }
    },
    cardActive: {
      borderColor: isDark ? "rgba(96,165,250,0.45)" : "rgba(30,58,138,0.32)",
      background: isDark ? "rgba(96,165,250,0.1)" : "rgba(30,58,138,0.05)",
      boxShadow: isDark
        ? "0 4px 16px rgba(30,58,138,0.25), inset 0 1px 0 rgba(255,255,255,0.08)"
        : "0 4px 16px rgba(30,58,138,0.12), inset 0 1px 0 rgba(255,255,255,1)"
    },
    cardTitle: { fontSize: 12, fontWeight: 600 },
    cardMeta: { fontSize: 10, color: theme.palette.text.secondary },
    sectionTitle: {
      fontSize: 10,
      fontWeight: 600,
      color: theme.palette.text.secondary,
      marginTop: 4,
      marginBottom: 4,
      letterSpacing: "0.03em"
    },
    footer: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      paddingTop: 8,
      marginTop: 8
    },
    cancelBtn: {
      textTransform: "none",
      fontSize: 11,
      color: `${theme.palette.text.secondary} !important`,
      padding: "2px 6px",
      minWidth: 0,
      minHeight: 28
    },
    primaryAction: {
      textTransform: "none",
      fontWeight: 600,
      fontSize: 11,
      borderRadius: 8,
      padding: "4px 12px",
      minHeight: 28,
      background: `${NAVY} !important`,
      color: "#fff !important",
      boxShadow: isDark
        ? "0 1px 2px rgba(0,0,0,0.3), 0 4px 12px rgba(30,58,138,0.45)"
        : "0 1px 2px rgba(15,23,42,0.08), 0 4px 14px rgba(30,58,138,0.28)",
      "&:hover": {
        background: `${NAVY_HOVER} !important`,
        boxShadow: isDark
          ? "0 2px 4px rgba(0,0,0,0.35), 0 6px 16px rgba(30,58,138,0.5)"
          : "0 2px 4px rgba(15,23,42,0.1), 0 6px 18px rgba(30,58,138,0.32)"
      },
      "&.Mui-disabled": {
        background: `${isDark ? "rgba(30,58,138,0.35)" : "rgba(30,58,138,0.25)"} !important`,
        color: "rgba(255,255,255,0.6) !important"
      }
    }
  };
});

const PAGE_ENTITY_LABELS = {
  activities: "Atividades",
  projects: "Projetos",
  leads: "Leads e deals",
  inventory: "Produtos",
  calendar: "Compromissos",
  companies: "Contatos",
  converted_leads: "Empresas"
};

export default function CrmImportExportButton({ pageKey = "leads" }) {
  const { t } = useAppTranslation();
  const classes = useStyles();
  const anchorRef = useRef(null);
  const pageConfig = CRM_PAGE_CONFIG[pageKey] || CRM_PAGE_CONFIG.leads;
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState(null);
  const [provider, setProvider] = useState("");

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const data = await crmIntegrationService.getStatus();
      setStatus(data);
      const connected = new Set(data?.connected || []);
      Object.entries(data?.providers || {}).forEach(([key, meta]) => {
        if (meta?.connected) connected.add(key);
      });
      const firstConnected = CRM_SYNC_PROVIDERS.find((p) => connected.has(p.key));
      if (firstConnected) setProvider(firstConnected.key);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    loadStatus();
  }, [open, loadStatus]);

  const connectedSet = useMemo(() => {
    const set = new Set(status?.connected || []);
    Object.entries(status?.providers || {}).forEach(([key, meta]) => {
      if (meta?.connected) set.add(key);
    });
    return set;
  }, [status]);

  const runImport = async () => {
    if (!provider || !connectedSet.has(provider)) {
      toast.warn("Conecte o CRM em Integrações → Conexões.");
      return;
    }
    setSyncing(true);
    try {
      const data = await crmIntegrationService.sync({
        provider,
        direction: "in",
        pageKey
      });
      const summary = crmIntegrationService.summarizeImportResults(data);
      const message = crmIntegrationService.buildImportToast(summary, pageConfig.entity);
      if (summary.errors.length) toast.warn(message);
      else toast.success(message);
      dispatchCrmImported({ pageKey, provider, direction: "in", summary, results: data?.results });
      if (pageKey === "activities") {
        const projectRows = (data?.results || []).filter((row) => row?.entityType === "projects");
        const projectSummary = crmIntegrationService.summarizeImportResults({ results: projectRows });
        if (projectSummary.created || projectSummary.updated) {
          dispatchCrmImported({
            pageKey: "projects",
            provider,
            direction: "in",
            summary: projectSummary,
            results: projectRows
          });
        }
      }
      setOpen(false);
    } catch (err) {
      toast.error(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          "Falha ao importar dados."
      );
    } finally {
      setSyncing(false);
    }
  };

  return (
    <>
      <Button
        ref={anchorRef}
        className={classes.trigger}
        size="small"
        disableElevation
        disableRipple
        onClick={() => setOpen(true)}
      >
        {t("modules.common.import")}
      </Button>

      <Popover
        open={open}
        anchorEl={anchorRef.current}
        onClose={() => !syncing && setOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        marginThreshold={8}
        PaperProps={{ className: classes.popoverPaper, elevation: 0 }}
        BackdropProps={{ invisible: true }}
      >
        <div className={classes.header}>
          <Box flex={1} minWidth={0}>
            <Typography className={classes.title}>
              {pageKey === "projects" ? t("modules.projects.import.title") : t("modules.common.import")}
            </Typography>
            <Typography className={classes.subtitle}>
              {PAGE_ENTITY_LABELS[pageKey] || pageConfig.entity}
            </Typography>
          </Box>
          <Box display="flex" alignItems="center">
            <CrmImportExportHelpButton />
            <IconButton
              size="small"
              className={classes.closeBtn}
              onClick={() => setOpen(false)}
              disabled={syncing}
            >
              <X size={14} />
            </IconButton>
          </Box>
        </div>

        <div className={classes.body}>
          <div className={classes.hint}>
            {t("modules.projects.import.authHint")}
          </div>

          <Typography className={classes.sectionTitle}>{t("modules.projects.import.connectedCrm")}</Typography>
          <div className={classes.list}>
            {CRM_SYNC_PROVIDERS.map((p) => {
              const connected = connectedSet.has(p.key);
              const selected = provider === p.key;
              const visual = getBrandVisual({ key: p.key });
              return (
                <div
                  key={p.key}
                  className={`${classes.card} ${!connected ? classes.cardDisabled : ""} ${
                    selected && connected ? classes.cardActive : ""
                  }`}
                  onClick={() => connected && setProvider(p.key)}
                  role="button"
                  tabIndex={connected ? 0 : -1}
                >
                  <IntegrationBrandIcon brandKey={visual.brandKey} variant="table" plain />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className={classes.cardTitle}>{p.label}</div>
                    <div className={classes.cardMeta}>
                      {connected ? t("modules.projects.import.connected") : "—"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {loading && (
            <Typography style={{ fontSize: 10, marginTop: 8, opacity: 0.7 }}>{t("modules.common.loading")}</Typography>
          )}

          {!loading && connectedSet.size === 0 && (
            <Typography style={{ fontSize: 11, marginTop: 10, opacity: 0.75, lineHeight: 1.45 }}>
              {t("modules.projects.import.noCrm")}
            </Typography>
          )}

          <div className={classes.footer}>
            <Button onClick={() => setOpen(false)} disabled={syncing} className={classes.cancelBtn}>
              {t("modules.common.cancel")}
            </Button>
            <Button
              variant="contained"
              className={classes.primaryAction}
              disableElevation
              disabled={syncing || !provider || !connectedSet.has(provider)}
              onClick={runImport}
            >
              {syncing ? t("modules.projects.import.importing") : t("modules.projects.import.importAll")}
            </Button>
          </div>
        </div>
      </Popover>
    </>
  );
}
