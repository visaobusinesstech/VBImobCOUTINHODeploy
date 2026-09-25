import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  FormControl,
  MenuItem,
  Select,
  Typography,
  makeStyles
} from "@material-ui/core";
import { Upload } from "lucide-react";
import { useHistory } from "react-router-dom";
import { toast } from "react-toastify";
import crmIntegrationService from "../../services/crmIntegrationService";
import {
  CRM_SYNC_PROVIDERS,
  CRM_PAGE_CONFIG
} from "../../config/crmIntegrationProviders";
import IntegrationBrandIcon, { getBrandVisual } from "../../pages/Connections/IntegrationBrandIcon";

const NAVY = "#1e3a8a";

const useStyles = makeStyles((theme) => ({
  root: {
    marginTop: theme.spacing(1.5),
    padding: theme.spacing(1.5),
    borderRadius: 10,
    border: `1px solid ${theme.palette.divider}`,
    background: theme.palette.type === "dark" ? "rgba(255,255,255,0.03)" : "rgba(15,23,42,0.02)"
  },
  label: {
    fontSize: 11,
    fontWeight: 600,
    color: theme.palette.text.secondary,
    marginBottom: 8
  },
  row: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" },
  select: { minWidth: 160, fontSize: 13 },
  btn: {
    textTransform: "none",
    fontWeight: 600,
    borderRadius: 8,
    fontSize: 12,
    color: `${NAVY} !important`,
    borderColor: `${NAVY} !important`
  },
  hint: { fontSize: 10.5, color: theme.palette.text.secondary, marginTop: 6, lineHeight: 1.4 }
}));

/**
 * Exporta um registro salvo para CRM já conectado em Integrações (API direta, sem Brain AI).
 */
export default function CrmExportToConnected({
  pageKey,
  recordId,
  recordLabel,
  compact = false
}) {
  const classes = useStyles();
  const history = useHistory();
  const pageConfig = CRM_PAGE_CONFIG[pageKey] || CRM_PAGE_CONFIG.leads;
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [connected, setConnected] = useState([]);
  const [provider, setProvider] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await crmIntegrationService.getStatus();
      const list = (data?.connected || []).filter(
        (key) => CRM_SYNC_PROVIDERS.some((p) => p.key === key && !p.importOnly)
      );
      setConnected(list);
      if (list.length) setProvider((prev) => (list.includes(prev) ? prev : list[0]));
    } catch {
      setConnected([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (recordId) load();
  }, [recordId, load]);

  const providerOptions = useMemo(
    () => CRM_SYNC_PROVIDERS.filter((p) => connected.includes(p.key)),
    [connected]
  );

  const handleExport = async () => {
    if (!recordId || !provider) return;
    setExporting(true);
    try {
      const data = await crmIntegrationService.sync({
        provider,
        direction: "out",
        pageKey,
        internalIds: [Number(recordId)]
      });
      const summary = crmIntegrationService.summarizeImportResults(data);
      const message = crmIntegrationService.buildExportToast(summary, pageConfig.entity);
      if (summary.errors.length) toast.warn(message);
      else toast.success(message);
    } catch (err) {
      toast.error(err?.response?.data?.error || "Falha ao exportar para o CRM.");
    } finally {
      setExporting(false);
    }
  };

  if (!recordId) return null;

  if (loading) {
    return (
      <Box className={classes.root}>
        <CircularProgress size={16} />
      </Box>
    );
  }

  if (!connected.length) {
    return (
      <Box className={classes.root}>
        <Typography className={classes.label}>Exportar para CRM</Typography>
        <Typography className={classes.hint}>
          Nenhum CRM conectado. Configure em{" "}
          <Button
            size="small"
            style={{ textTransform: "none", padding: 0, minWidth: 0, fontSize: "inherit" }}
            onClick={() => history.push("/connections")}
          >
            Integrações → Conexões
          </Button>
          .
        </Typography>
      </Box>
    );
  }

  return (
    <Box className={classes.root}>
      {!compact && (
        <>
          <Typography className={classes.label}>Exportar para CRM conectado</Typography>
          {recordLabel ? (
            <Typography className={classes.hint} style={{ marginTop: 0, marginBottom: 8 }}>
              {recordLabel}
            </Typography>
          ) : null}
        </>
      )}
      <div className={classes.row}>
        <FormControl variant="outlined" size="small" className={classes.select}>
          <Select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            displayEmpty
            renderValue={(val) => {
              const p = CRM_SYNC_PROVIDERS.find((x) => x.key === val);
              if (!p) return "CRM";
              const v = getBrandVisual({ key: val });
              return (
                <Box display="flex" alignItems="center" gap={1}>
                  <IntegrationBrandIcon brandKey={v.brandKey} variant="table" plain />
                  <span>{p.label}</span>
                </Box>
              );
            }}
          >
            {providerOptions.map((p) => {
              const v = getBrandVisual({ key: p.key });
              return (
                <MenuItem key={p.key} value={p.key}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <IntegrationBrandIcon brandKey={v.brandKey} variant="table" plain />
                    {p.label}
                  </Box>
                </MenuItem>
              );
            })}
          </Select>
        </FormControl>
        <Button
          variant="outlined"
          size="small"
          className={classes.btn}
          disabled={exporting || !provider}
          onClick={handleExport}
          startIcon={exporting ? <CircularProgress size={14} /> : <Upload size={14} />}
        >
          {exporting ? "Exportando…" : "Exportar"}
        </Button>
      </div>
      {!compact && (
        <Typography className={classes.hint}>
          Sincronização direta pela API — não usa Agente IA / Brain.
        </Typography>
      )}
    </Box>
  );
}
