import React, { useMemo, useState } from "react";
import {
  Box,
  Button,
  Checkbox,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Popover,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  makeStyles,
} from "@material-ui/core";
import SettingsIcon from "@material-ui/icons/Settings";
import ArrowUpwardIcon from "@material-ui/icons/ArrowUpward";
import ShowChartIcon from "@material-ui/icons/ShowChart";
import ExpandMoreIcon from "@material-ui/icons/ExpandMore";
import RefreshIcon from "@material-ui/icons/Refresh";
import CheckCircleIcon from "@material-ui/icons/CheckCircle";
import GetAppIcon from "@material-ui/icons/GetApp";
import { toast } from "react-toastify";
import {
  budgetReais,
  money,
  numFmt,
  statusLabel,
} from "./formatters";
import {
  exportCurrentCsv,
  exportCurrentXlsx,
  exportTableCsv,
  exportTableXlsx,
} from "./exportHelpers";

const FONT =
  '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Inter, system-ui, sans-serif';

const COLS = [
  { id: "status", label: "Status" },
  { id: "name", label: "Campanha / Anúncio" },
  { id: "budget", label: "Orçamento" },
  { id: "updated", label: "Últ. atualização" },
  { id: "sales", label: "Vendas" },
  { id: "cpa", label: "CPA" },
  { id: "spend", label: "Gasto" },
  { id: "ctr", label: "CTR" },
  { id: "leads", label: "Leads" },
];

const useStyles = makeStyles((theme) => {
  const isDark = theme.palette.type === "dark";
  return {
    wrap: {
      fontFamily: FONT,
      borderRadius: 12,
      border: isDark
        ? "1px solid rgba(255,255,255,0.08)"
        : "1px solid rgba(15,23,42,0.08)",
      background: isDark
        ? theme.palette.dashboardCard || "#252526"
        : "#fff",
      overflow: "hidden",
    },
    tabs: {
      display: "flex",
      gap: 18,
      padding: "0 16px",
      borderBottom: isDark
        ? "1px solid rgba(255,255,255,0.08)"
        : "1px solid rgba(15,23,42,0.08)",
    },
    tab: {
      appearance: "none",
      background: "none",
      border: 0,
      cursor: "pointer",
      fontFamily: FONT,
      fontSize: 13,
      fontWeight: 500,
      padding: "12px 0 10px",
      color: isDark ? "rgba(248,250,252,0.55)" : "#64748b",
      borderBottom: "2px solid transparent",
      marginBottom: -1,
    },
    tabOn: {
      color: "#0081FB",
      borderBottomColor: "#0081FB",
    },
    toolbar: {
      display: "flex",
      flexWrap: "wrap",
      alignItems: "center",
      gap: 8,
      padding: "10px 12px",
    },
    iconBtn: {
      width: 32,
      height: 32,
      borderRadius: 8,
      border: isDark
        ? "1px solid rgba(255,255,255,0.1)"
        : "1px solid rgba(15,23,42,0.1)",
      background: isDark ? "rgba(255,255,255,0.03)" : "#fff",
    },
    pill: {
      height: 28,
      fontSize: 11,
      fontWeight: 600,
      background: "rgba(52,199,89,0.14)",
      color: isDark ? "#86efac" : "#15803d",
    },
    muted: {
      fontSize: 12,
      color: isDark ? "rgba(248,250,252,0.5)" : "#94a3b8",
    },
    refresh: {
      marginLeft: "auto",
      textTransform: "none",
      borderRadius: 8,
      fontWeight: 600,
      fontSize: 13,
      background: "#0081FB",
      color: "#fff",
      "&:hover": { background: "#0064d1" },
    },
    filters: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
      gap: 10,
      padding: "0 12px 12px",
    },
    field: {
      "& .MuiOutlinedInput-root": {
        borderRadius: 8,
        fontSize: 13,
        fontFamily: FONT,
      },
      "& .MuiInputLabel-outlined": { fontSize: 12 },
    },
    tableWrap: {
      overflowX: "auto",
    },
    head: {
      fontSize: 11,
      fontWeight: 650,
      letterSpacing: "0.04em",
      textTransform: "uppercase",
      color: isDark ? "rgba(248,250,252,0.5)" : "#8b93a7",
      whiteSpace: "nowrap",
    },
    cell: {
      fontSize: 13,
      fontFamily: FONT,
    },
    status: {
      fontSize: 11,
      fontWeight: 600,
      padding: "2px 8px",
      borderRadius: 99,
      display: "inline-block",
    },
    active: {
      background: "rgba(52,199,89,0.16)",
      color: isDark ? "#86efac" : "#15803d",
    },
    paused: {
      background: isDark ? "rgba(251,191,36,0.16)" : "#fef3c7",
      color: isDark ? "#fcd34d" : "#92400e",
    },
    help: {
      padding: "10px 16px 14px",
      fontSize: 12,
      color: "#0081FB",
      cursor: "pointer",
    },
    colPop: {
      padding: 12,
      minWidth: 200,
      fontFamily: FONT,
    },
  };
});

export default function CampaignAdsTable({
  data,
  campaignInsights,
  adInsights,
  currency,
  onRefresh,
  loading,
}) {
  const classes = useStyles();
  const [tab, setTab] = useState("campaigns");
  const [nameQ, setNameQ] = useState("");
  const [status, setStatus] = useState("");
  const [sortDir, setSortDir] = useState("desc");
  const [compact, setCompact] = useState(false);
  const [trackedOnly, setTrackedOnly] = useState(true);
  const [selected, setSelected] = useState({});
  const [cols, setCols] = useState(() =>
    Object.fromEntries(COLS.map((c) => [c.id, true]))
  );
  const [gearEl, setGearEl] = useState(null);
  const [moreEl, setMoreEl] = useState(null);

  const visibleCols = COLS.filter((c) => (compact ? ["status", "name", "spend", "leads"].includes(c.id) : cols[c.id]));

  const rows = useMemo(() => {
    const isAds = tab === "ads";
    const source = isAds ? adInsights : campaignInsights;
    const catalog = Array.isArray(data?.campaigns) ? data.campaigns : [];
    const adsCatalog = Array.isArray(data?.ads) ? data.ads : [];
    const q = nameQ.trim().toLowerCase();
    return (source || [])
      .map((row) => {
        const id = isAds ? row.id : row.campaignId;
        const meta = isAds
          ? adsCatalog.find((a) => String(a.id) === String(id))
          : catalog.find((c) => String(c.id) === String(id));
        const st = String(
          meta?.effective_status || meta?.status || "ACTIVE"
        ).toUpperCase();
        const leads = Number(row.leads) || 0;
        const spend = Number(row.spend) || 0;
        return {
          id,
          name: isAds ? row.name : row.campaignName,
          campaignName: row.campaignName,
          status: st,
          budget: budgetReais(meta?.daily_budget),
          updated: meta?.updated_time || data?.fetchedAt,
          sales: Number(row.purchases) || 0,
          cpa: leads > 0 ? spend / leads : null,
          spend,
          ctr: Number(row.ctr) || 0,
          leads,
        };
      })
      .filter((r) => (q ? String(r.name || "").toLowerCase().includes(q) : true))
      .filter((r) => (status ? r.status === status : true))
      .sort((a, b) =>
        sortDir === "asc" ? a.spend - b.spend : b.spend - a.spend
      );
  }, [
    tab,
    adInsights,
    campaignInsights,
    data,
    nameQ,
    status,
    sortDir,
  ]);

  const allChecked = rows.length > 0 && rows.every((r) => selected[r.id]);
  const toggleAll = () => {
    if (allChecked) {
      setSelected({});
      return;
    }
    setSelected(Object.fromEntries(rows.map((r) => [r.id, true])));
  };

  const copyNames = async () => {
    const names = rows
      .filter((r) => selected[r.id] || !Object.values(selected).some(Boolean))
      .map((r) => r.name)
      .join("\n");
    try {
      await navigator.clipboard.writeText(names || "");
      toast.success("Nomes copiados.");
    } catch {
      toast.error("Não foi possível copiar.");
    }
    setMoreEl(null);
  };

  return (
    <div className={classes.wrap}>
      <div className={classes.tabs} role="tablist">
        <button
          type="button"
          className={`${classes.tab} ${tab === "campaigns" ? classes.tabOn : ""}`}
          onClick={() => setTab("campaigns")}
        >
          Campanhas
        </button>
        <button
          type="button"
          className={`${classes.tab} ${tab === "ads" ? classes.tabOn : ""}`}
          onClick={() => setTab("ads")}
        >
          Anúncios
        </button>
      </div>

      <div className={classes.toolbar}>
        <Tooltip title="Colunas visíveis">
          <IconButton
            className={classes.iconBtn}
            size="small"
            onClick={(e) => setGearEl(e.currentTarget)}
          >
            <SettingsIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title={sortDir === "desc" ? "Ordenar gasto crescente" : "Ordenar gasto decrescente"}>
          <IconButton
            className={classes.iconBtn}
            size="small"
            onClick={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}
          >
            <ArrowUpwardIcon
              fontSize="small"
              style={{ transform: sortDir === "asc" ? "none" : "rotate(180deg)" }}
            />
          </IconButton>
        </Tooltip>
        <Tooltip title={compact ? "Visão completa" : "Visão compacta"}>
          <IconButton
            className={classes.iconBtn}
            size="small"
            onClick={() => setCompact((v) => !v)}
            style={compact ? { color: "#0081FB" } : undefined}
          >
            <ShowChartIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Exportar CSV da tabela visível">
          <IconButton
            className={classes.iconBtn}
            size="small"
            onClick={() => {
              try {
                exportTableCsv(rows, { tab, currency });
                toast.success("CSV da tabela baixado.");
              } catch (err) {
                toast.error(err?.message || "Falha ao exportar CSV.");
              }
            }}
          >
            <GetAppIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Mais ações">
          <IconButton
            className={classes.iconBtn}
            size="small"
            onClick={(e) => setMoreEl(e.currentTarget)}
          >
            <ExpandMoreIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Chip
          size="small"
          className={classes.pill}
          icon={<CheckCircleIcon style={{ fontSize: 14, color: "inherit" }} />}
          label={
            trackedOnly
              ? "Todas as vendas trackeadas"
              : "Incluir não rastreadas"
          }
          onClick={() => setTrackedOnly((v) => !v)}
        />
        <Typography className={classes.muted}>
          {data?.fetchedAt
            ? `Atualizado ${new Date(data.fetchedAt).toLocaleString("pt-BR")}`
            : "Atualizado agora mesmo"}
        </Typography>
        <Button
          className={classes.refresh}
          disableElevation
          variant="contained"
          startIcon={<RefreshIcon fontSize="small" />}
          disabled={loading}
          onClick={() => onRefresh?.()}
        >
          Atualizar
        </Button>
      </div>

      <div className={classes.filters}>
        <TextField
          className={classes.field}
          size="small"
          variant="outlined"
          label={tab === "ads" ? "Nome do anúncio" : "Nome da campanha"}
          placeholder="Filtrar por nome"
          value={nameQ}
          onChange={(e) => setNameQ(e.target.value)}
        />
        <TextField
          className={classes.field}
          size="small"
          variant="outlined"
          select
          label={tab === "ads" ? "Status do anúncio" : "Status da campanha"}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          SelectProps={{ displayEmpty: true }}
          InputLabelProps={{ shrink: true }}
        >
          <MenuItem value="">Qualquer</MenuItem>
          <MenuItem value="ACTIVE">Ativa</MenuItem>
          <MenuItem value="PAUSED">Pausada</MenuItem>
        </TextField>
      </div>

      <div className={classes.tableWrap}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  size="small"
                  color="primary"
                  checked={allChecked}
                  onChange={toggleAll}
                />
              </TableCell>
              {visibleCols.map((c) => (
                <TableCell key={c.id} className={classes.head} align={c.id === "name" || c.id === "status" ? "left" : "right"}>
                  {c.id === "name" ? (tab === "ads" ? "Anúncio" : "Campanha") : c.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={visibleCols.length + 1}>
                  <Typography variant="body2" color="textSecondary">
                    {tab === "ads"
                      ? "Nenhum anúncio no filtro."
                      : "0 campanhas no filtro."}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell padding="checkbox">
                    <Checkbox
                      size="small"
                      color="primary"
                      checked={Boolean(selected[r.id])}
                      onChange={() =>
                        setSelected((prev) => ({
                          ...prev,
                          [r.id]: !prev[r.id],
                        }))
                      }
                    />
                  </TableCell>
                  {visibleCols.map((c) => {
                    if (c.id === "status") {
                      return (
                        <TableCell key={c.id} className={classes.cell}>
                          <span
                            className={`${classes.status} ${
                              r.status === "ACTIVE" ? classes.active : classes.paused
                            }`}
                          >
                            {statusLabel(r.status)}
                          </span>
                        </TableCell>
                      );
                    }
                    if (c.id === "name") {
                      return (
                        <TableCell key={c.id} className={classes.cell}>
                          {r.name || r.id}
                          {tab === "ads" && r.campaignName ? (
                            <Typography variant="caption" display="block" color="textSecondary">
                              {r.campaignName}
                            </Typography>
                          ) : null}
                        </TableCell>
                      );
                    }
                    if (c.id === "budget") {
                      return (
                        <TableCell key={c.id} className={classes.cell} align="right">
                          {r.budget != null ? `${money(r.budget, currency)}/dia` : "N/A"}
                        </TableCell>
                      );
                    }
                    if (c.id === "updated") {
                      return (
                        <TableCell key={c.id} className={classes.cell} align="right">
                          {r.updated
                            ? new Date(r.updated).toLocaleString("pt-BR")
                            : "—"}
                        </TableCell>
                      );
                    }
                    if (c.id === "sales") {
                      return (
                        <TableCell key={c.id} className={classes.cell} align="right">
                          {numFmt(r.sales)}
                        </TableCell>
                      );
                    }
                    if (c.id === "cpa") {
                      return (
                        <TableCell key={c.id} className={classes.cell} align="right">
                          {r.cpa != null ? money(r.cpa, currency) : "N/A"}
                        </TableCell>
                      );
                    }
                    if (c.id === "spend") {
                      return (
                        <TableCell key={c.id} className={classes.cell} align="right">
                          {money(r.spend, currency)}
                        </TableCell>
                      );
                    }
                    if (c.id === "ctr") {
                      return (
                        <TableCell key={c.id} className={classes.cell} align="right">
                          {numFmt(r.ctr, 2)}%
                        </TableCell>
                      );
                    }
                    return (
                      <TableCell key={c.id} className={classes.cell} align="right">
                        {numFmt(r.leads)}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <Typography
        className={classes.help}
        onClick={() =>
          toast.info(
            "Campanhas vêm da Marketing API da conta conectada. Confira o período, o status e a Conta Meta Ads no filtro."
          )
        }
      >
        Por que as campanhas não estão aparecendo?
      </Typography>

      <Popover
        open={Boolean(gearEl)}
        anchorEl={gearEl}
        onClose={() => setGearEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        <Box className={classes.colPop}>
          {COLS.map((c) => (
            <MenuItem
              key={c.id}
              dense
              onClick={() => setCols((prev) => ({ ...prev, [c.id]: !prev[c.id] }))}
            >
              <Checkbox size="small" checked={Boolean(cols[c.id])} color="primary" />
              {c.label}
            </MenuItem>
          ))}
        </Box>
      </Popover>
      <Menu
        anchorEl={moreEl}
        open={Boolean(moreEl)}
        onClose={() => setMoreEl(null)}
      >
        <MenuItem
          onClick={() => {
            try {
              exportTableCsv(rows, { tab, currency });
              toast.success("CSV da tabela baixado.");
            } catch (err) {
              toast.error(err?.message || "Falha ao exportar CSV.");
            }
            setMoreEl(null);
          }}
        >
          Exportar CSV da tabela
        </MenuItem>
        <MenuItem
          onClick={() => {
            try {
              exportTableXlsx(rows, { tab, currency });
              toast.success("Excel da tabela baixado.");
            } catch (err) {
              toast.error(err?.message || "Falha ao exportar Excel.");
            }
            setMoreEl(null);
          }}
        >
          Exportar Excel da tabela
        </MenuItem>
        <MenuItem
          onClick={() => {
            try {
              exportCurrentCsv(data, {});
              toast.success("CSV completo baixado.");
            } catch (err) {
              toast.error(err?.message || "Falha ao exportar CSV.");
            }
            setMoreEl(null);
          }}
        >
          Exportar CSV completo
        </MenuItem>
        <MenuItem
          onClick={() => {
            try {
              exportCurrentXlsx(data, {});
              toast.success("Excel completo baixado.");
            } catch (err) {
              toast.error(err?.message || "Falha ao exportar Excel.");
            }
            setMoreEl(null);
          }}
        >
          Exportar Excel completo
        </MenuItem>
        <MenuItem onClick={copyNames}>Copiar nomes</MenuItem>
        <MenuItem
          onClick={() => {
            toggleAll();
            setMoreEl(null);
          }}
        >
          {allChecked ? "Limpar seleção" : "Selecionar todos"}
        </MenuItem>
      </Menu>
    </div>
  );
}
