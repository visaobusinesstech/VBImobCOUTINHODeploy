import React, { useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Popover,
  Typography,
  makeStyles,
} from "@material-ui/core";
import GetAppIcon from "@material-ui/icons/GetApp";
import { toast } from "react-toastify";
import api from "../../services/api";
import {
  exportCurrentCsv,
  exportCurrentXlsx,
  exportWordDoc,
  fallbackStrategicHtml,
  kpisHtml,
  openPdfPrint,
} from "./exportHelpers";

const FONT =
  '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, system-ui, sans-serif';

const useStyles = makeStyles((theme) => {
  const isDark = theme.palette.type === "dark";
  return {
    trigger: {
      fontFamily: FONT,
      textTransform: "none",
      borderRadius: 6,
      height: 36,
      minWidth: 0,
      padding: "0 12px",
      fontSize: 13,
      fontWeight: 500,
      letterSpacing: "-0.01em",
      color: isDark ? "#f8fafc" : "#0f172a",
      border: isDark
        ? "1px solid rgba(255,255,255,0.2)"
        : "1px solid rgba(15,23,42,0.12)",
      background: "transparent",
    },
    paper: {
      width: 340,
      maxWidth: "calc(100vw - 24px)",
      borderRadius: 16,
      overflow: "hidden",
      fontFamily: FONT,
      background: isDark ? "rgba(28,28,30,0.92)" : "rgba(255,255,255,0.92)",
      backdropFilter: "saturate(180%) blur(22px)",
      WebkitBackdropFilter: "saturate(180%) blur(22px)",
      boxShadow: isDark
        ? "0 18px 48px rgba(0,0,0,0.5), 0 0 0 0.5px rgba(255,255,255,0.12)"
        : "0 18px 48px rgba(15,23,42,0.16), 0 0 0 0.5px rgba(0,0,0,0.06)",
    },
    inner: {
      padding: 14,
      display: "flex",
      flexDirection: "column",
      gap: 10,
    },
    kicker: {
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: "0.04em",
      textTransform: "uppercase",
      color: isDark ? "rgba(248,250,252,0.45)" : "#86868b",
    },
    option: {
      borderRadius: 12,
      padding: "12px 12px 10px",
      border: isDark
        ? "1px solid rgba(255,255,255,0.08)"
        : "1px solid rgba(0,0,0,0.06)",
      background: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.7)",
    },
    optionTitle: {
      fontSize: 13,
      fontWeight: 600,
      letterSpacing: "-0.02em",
      color: isDark ? "#f5f5f7" : "#1d1d1f",
      marginBottom: 4,
    },
    optionHint: {
      fontSize: 11.5,
      lineHeight: 1.4,
      color: isDark ? "rgba(245,245,247,0.55)" : "#6e6e73",
      marginBottom: 10,
    },
    row: {
      display: "flex",
      gap: 6,
      flexWrap: "wrap",
    },
    chip: {
      fontFamily: FONT,
      textTransform: "none",
      borderRadius: 8,
      fontSize: 12,
      fontWeight: 500,
      letterSpacing: "-0.01em",
      minWidth: 0,
      padding: "4px 10px",
    },
    primary: {
      background: "#0071e3",
      color: "#fff",
      "&:hover": { background: "#0077ed" },
    },
  };
});

export default function MetaAdsExportMenu({ data, filters }) {
  const classes = useStyles();
  const [anchor, setAnchor] = useState(null);
  const [busy, setBusy] = useState("");

  const run = async (key, fn, okMsg) => {
    if (!data) {
      toast.error("Não há dados para exportar.");
      return;
    }
    try {
      setBusy(key);
      await fn();
      toast.success(okMsg || "Arquivo gerado.");
    } catch (err) {
      toast.error(err?.message || "Falha ao exportar.");
    } finally {
      setBusy("");
    }
  };

  const generateStrategic = async () => {
    let html = fallbackStrategicHtml(data);
    try {
      const { data: res } = await api.post("/meta-ads/analytics/report", {
        datePreset: data?.datePreset,
        kpis: data?.kpis,
        account: data?.account,
        campaigns: (data?.campaignInsights || []).slice(0, 12),
      });
      if (res?.html) html = res.html;
    } catch {
      /* fallback local */
    }
    return html;
  };

  return (
    <>
      <Button
        className={classes.trigger}
        startIcon={<GetAppIcon style={{ fontSize: 16 }} />}
        onClick={(e) => setAnchor(e.currentTarget)}
      >
        Exportar
      </Button>
      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        PaperProps={{ className: classes.paper, elevation: 0 }}
      >
        <Box className={classes.inner}>
          <Typography className={classes.kicker}>Exportar</Typography>

          <div className={classes.option}>
            <div className={classes.optionTitle}>Dados atuais</div>
            <div className={classes.optionHint}>
              Snapshot dos indicadores, campanhas e anúncios visíveis agora.
            </div>
            <div className={classes.row}>
              <Button
                size="small"
                className={`${classes.chip} ${classes.primary}`}
                disabled={Boolean(busy)}
                onClick={() =>
                  run(
                    "pdf",
                    () => openPdfPrint("Analises Ads", kpisHtml(data)),
                    "PDF baixado."
                  )
                }
              >
                PDF
              </Button>
              <Button
                size="small"
                className={classes.chip}
                variant="outlined"
                disabled={Boolean(busy)}
                onClick={() =>
                  run(
                    "xlsx",
                    () => exportCurrentXlsx(data, filters),
                    "Excel baixado."
                  )
                }
              >
                Excel
              </Button>
              <Button
                size="small"
                className={classes.chip}
                variant="outlined"
                disabled={Boolean(busy)}
                onClick={() =>
                  run(
                    "csv",
                    () => exportCurrentCsv(data, filters),
                    "CSV baixado."
                  )
                }
              >
                CSV
              </Button>
            </div>
          </div>

          <div className={classes.option}>
            <div className={classes.optionTitle}>Relatório estratégico GPT</div>
            <div className={classes.optionHint}>
              Análise de verba, CPA, ROAS e recomendações gerada por modelo GPT.
            </div>
            <div className={classes.row}>
              <Button
                size="small"
                className={`${classes.chip} ${classes.primary}`}
                disabled={Boolean(busy)}
                onClick={() =>
                  run(
                    "gpt-pdf",
                    async () => {
                      const html = await generateStrategic();
                      await openPdfPrint("Relatorio estrategico Meta Ads", html);
                    },
                    "Relatório GPT em PDF baixado."
                  )
                }
              >
                {busy === "gpt-pdf" ? (
                  <CircularProgress size={12} color="inherit" />
                ) : (
                  "PDF"
                )}
              </Button>
              <Button
                size="small"
                className={classes.chip}
                variant="outlined"
                disabled={Boolean(busy)}
                onClick={() =>
                  run(
                    "gpt-doc",
                    async () => {
                      const html = await generateStrategic();
                      exportWordDoc(
                        `relatorio-estrategico-meta-${Date.now()}.doc`,
                        "Relatório estratégico Meta Ads",
                        html
                      );
                    },
                    "Word baixado."
                  )
                }
              >
                Word
              </Button>
            </div>
          </div>
        </Box>
      </Popover>
    </>
  );
}
