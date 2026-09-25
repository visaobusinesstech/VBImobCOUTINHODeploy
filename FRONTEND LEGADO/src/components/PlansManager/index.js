import React, { useState, useEffect } from "react";
import {
  makeStyles,
  Paper,
  Grid,
  TextField,
  Table,
  TableHead,
  TableBody,
  TableCell,
  TableRow,
  IconButton,
  Button,
  InputBase,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  Dialog,
  DialogActions,
  DialogContent,
  CircularProgress,
  Box,
  useMediaQuery,
} from "@material-ui/core";
import { useTheme } from "@material-ui/core/styles";
import { Formik, Form, Field } from "formik";
import ConfirmationModal from "../ConfirmationModal";
import {
  Edit as EditIcon,
  Search as SearchIcon,
  Add as AddIcon,
} from "@material-ui/icons";
import { toast } from "react-toastify";
import usePlans from "../../hooks/usePlans";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles((theme) => {
  const isDark = theme.palette.type === "dark";
  const border = isDark ? "rgba(255,255,255,0.08)" : "#eaedf0";
  const surfaceBg = isDark ? "rgba(255,255,255,0.03)" : "#ffffff";
  const hoverBg = isDark ? "rgba(255,255,255,0.05)" : "#f8f9fb";
  const font = '"Helvetica Neue", Helvetica, Arial, sans-serif';

  return {
    root: { width: "100%", fontFamily: font },
    mainPaper: { width: "100%", flex: 1, background: "transparent", boxShadow: "none" },

    /* ── Top bar (same as CompaniesManager) ── */
    topBar: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      marginBottom: 12,
      flexWrap: "wrap",
      [theme.breakpoints.down("xs")]: {
        flexDirection: "column",
        alignItems: "stretch",
        gap: 8,
      },
    },
    filterGroup: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      flexWrap: "wrap",
    },
    searchBox: {
      display: "flex",
      alignItems: "center",
      gap: 5,
      borderRadius: 7,
      background: isDark ? "rgba(255,255,255,0.06)" : "#f3f4f6",
      padding: "3px 8px",
      minWidth: 160,
      height: 30,
      flex: 1,
      maxWidth: 220,
      [theme.breakpoints.down("xs")]: { maxWidth: "100%", minWidth: 0 },
    },
    searchInput: {
      fontSize: 11.5,
      color: theme.palette.text.primary,
      flex: 1,
      "& input": { padding: 0, fontSize: 11.5 },
      "& input::placeholder": { color: isDark ? "rgba(255,255,255,0.35)" : "#9ca3af", opacity: 1 },
    },
    actionsGroup: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      [theme.breakpoints.down("xs")]: { justifyContent: "flex-end" },
    },
    addBtn: {
      height: 28,
      borderRadius: 7,
      textTransform: "none",
      fontSize: 11,
      fontWeight: 600,
      padding: "0 12px",
      boxShadow: "none",
      "&:hover": { boxShadow: "none" },
    },

    /* ── Table ── */
    tableWrap: {
      borderRadius: 10,
      border: `1px solid ${border}`,
      background: surfaceBg,
      overflowX: "auto",
      "&::-webkit-scrollbar": { height: 4 },
      "&::-webkit-scrollbar-thumb": {
        background: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)",
        borderRadius: 4,
      },
    },
    table: {
      minWidth: 900,
      "& .MuiTableCell-head": {
        fontSize: 10,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        color: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)",
        borderBottom: `1px solid ${border}`,
        padding: "6px 10px",
        whiteSpace: "nowrap",
        fontFamily: font,
        background: isDark ? "rgba(255,255,255,0.02)" : "#fafbfc",
      },
      "& .MuiTableCell-body": {
        fontSize: 12,
        color: theme.palette.text.primary,
        borderBottom: `1px solid ${border}`,
        padding: "6px 10px",
        fontFamily: font,
      },
    },
    tableRow: {
      cursor: "pointer",
      transition: "background 0.12s",
      "&:hover": { background: hoverBg },
    },
    editIcon: {
      fontSize: 14,
      color: isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.25)",
    },

    /* ── Tags ── */
    tag: {
      display: "inline-flex",
      alignItems: "center",
      height: 18,
      borderRadius: 5,
      padding: "0 6px",
      fontSize: 10,
      fontWeight: 600,
      letterSpacing: "0.02em",
      lineHeight: 1,
      whiteSpace: "nowrap",
      fontFamily: font,
    },
    tagYes: {
      background: isDark ? "rgba(16,185,129,0.15)" : "#ecfdf5",
      color: isDark ? "#6ee7b7" : "#059669",
    },
    tagNo: {
      background: isDark ? "rgba(239,68,68,0.15)" : "#fef2f2",
      color: isDark ? "#fca5a5" : "#dc2626",
    },
    tagNeutral: {
      background: isDark ? "rgba(255,255,255,0.06)" : "#f3f4f6",
      color: isDark ? "rgba(255,255,255,0.5)" : "#6b7280",
    },

    /* ── Mobile cards ── */
    cardList: { display: "flex", flexDirection: "column", gap: 8 },
    card: {
      borderRadius: 10,
      border: `1px solid ${border}`,
      background: surfaceBg,
      padding: "10px 12px",
      cursor: "pointer",
      transition: "background 0.12s",
      "&:active": { background: hoverBg },
    },
    cardHeader: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 6,
    },
    cardName: {
      fontSize: 13,
      fontWeight: 600,
      color: theme.palette.text.primary,
      flex: 1,
    },
    cardRow: {
      display: "flex",
      alignItems: "center",
      gap: 5,
      flexWrap: "wrap",
    },
    cardMeta: {
      fontSize: 10.5,
      color: isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.4)",
    },

    /* ── Modal ── */
    dialogPaper: {
      borderRadius: 14,
      maxHeight: "90vh",
      [theme.breakpoints.down("xs")]: { margin: 8, maxHeight: "96vh", borderRadius: 10 },
    },
    modalHeader: {
      padding: "14px 18px 6px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      [theme.breakpoints.down("xs")]: { padding: "12px 14px 4px" },
    },
    modalTitle: {
      fontSize: 14,
      fontWeight: 600,
      fontFamily: font,
      color: theme.palette.text.primary,
    },
    closeBtn: {
      width: 24,
      height: 24,
      borderRadius: "50%",
      border: "none",
      background: isDark ? "rgba(255,255,255,0.08)" : "#f3f4f6",
      color: theme.palette.text.secondary,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 12,
      lineHeight: 1,
      "&:hover": { background: isDark ? "rgba(255,255,255,0.14)" : "#e5e7eb" },
    },
    modalContent: {
      padding: "4px 18px 12px",
      "&::-webkit-scrollbar": { width: 3 },
      "&::-webkit-scrollbar-thumb": {
        background: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)",
        borderRadius: 3,
      },
      [theme.breakpoints.down("xs")]: { padding: "4px 14px 10px" },
    },
    section: {
      fontSize: 10,
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "0.07em",
      color: isDark ? "rgba(255,255,255,0.38)" : "rgba(0,0,0,0.35)",
      marginTop: 12,
      marginBottom: 6,
      fontFamily: font,
    },
    field: {
      "& .MuiOutlinedInput-root": { borderRadius: 7, fontSize: 12, height: 32 },
      "& .MuiOutlinedInput-input": { padding: "6px 10px", fontSize: 12 },
      "& .MuiInputLabel-outlined": { fontSize: 11, transform: "translate(10px, 9px) scale(1)" },
      "& .MuiInputLabel-outlined.MuiInputLabel-shrink": { transform: "translate(10px, -6px) scale(0.75)" },
    },
    sel: {
      "& .MuiOutlinedInput-root": { borderRadius: 7, fontSize: 12, height: 32 },
      "& .MuiSelect-outlined": { padding: "6px 10px", fontSize: 12 },
      "& .MuiInputLabel-outlined": { fontSize: 11, transform: "translate(10px, 9px) scale(1)" },
      "& .MuiInputLabel-outlined.MuiInputLabel-shrink": { transform: "translate(10px, -6px) scale(0.75)" },
    },
    toggleGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(145px, 1fr))",
      gap: 4,
      [theme.breakpoints.down("xs")]: { gridTemplateColumns: "1fr 1fr" },
    },
    toggleItem: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "2px 8px",
      borderRadius: 6,
      background: isDark ? "rgba(255,255,255,0.03)" : "#f9fafb",
      border: `1px solid ${isDark ? "rgba(255,255,255,0.05)" : "#f0f0f0"}`,
      minHeight: 28,
      "& .MuiSwitch-root": { transform: "scale(0.6)" },
    },
    toggleLabel: {
      fontSize: 10.5,
      fontWeight: 500,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      color: theme.palette.text.primary,
      fontFamily: font,
    },
    modalActions: {
      padding: "8px 18px 12px",
      gap: 6,
      [theme.breakpoints.down("xs")]: { padding: "8px 14px 10px" },
    },
    cancelBtn: {
      borderRadius: 7,
      textTransform: "none",
      fontSize: 12,
      fontWeight: 500,
      padding: "4px 14px",
      height: 30,
    },
    saveBtn: {
      borderRadius: 7,
      textTransform: "none",
      fontSize: 12,
      fontWeight: 600,
      padding: "4px 18px",
      height: 30,
      boxShadow: "none",
      "&:hover": { boxShadow: "none" },
    },
    deleteBtn: {
      borderRadius: 7,
      textTransform: "none",
      fontSize: 12,
      fontWeight: 500,
      padding: "4px 14px",
      height: 30,
    },
  };
});

/* ── Toggle component ── */
function Toggle({ label, name, values, setFieldValue }) {
  const classes = useStyles();
  return (
    <div className={classes.toggleItem}>
      <span className={classes.toggleLabel}>{label}</span>
      <Switch
        size="small"
        checked={values[name] === true}
        onChange={(e) => setFieldValue(name, e.target.checked)}
        color="primary"
      />
    </div>
  );
}

function BoolTag({ value, classes }) {
  return value === false
    ? <span className={`${classes.tag} ${classes.tagNo}`}>{i18n.t("plans.form.no")}</span>
    : <span className={`${classes.tag} ${classes.tagYes}`}>{i18n.t("plans.form.yes")}</span>;
}

const TOGGLES = [
  { name: "useWhatsapp", label: "WhatsApp" },
  { name: "useWhatsappOfficial", label: "WA Oficial" },
  { name: "useFacebook", label: "Facebook" },
  { name: "useInstagram", label: "Instagram" },
  { name: "useCampaigns", label: i18n.t("plans.form.campaigns") },
  { name: "useSchedules", label: i18n.t("plans.form.schedules") },
  { name: "useInternalChat", label: "Chat Interno" },
  { name: "useExternalApi", label: "API Externa" },
  { name: "useKanban", label: "Kanban" },
  { name: "useOpenAi", label: "Talk.Ai" },
  { name: "useIntegrations", label: "Integrações" },
  { name: "wavoip", label: "Wavoip" },
];

const INITIAL_PLAN = {
  name: "", users: 0, connections: 0, queues: 0, amount: 0,
  useWhatsapp: true, useFacebook: true, useInstagram: true,
  useCampaigns: true, useSchedules: true, useInternalChat: true,
  useExternalApi: true, useKanban: true, useOpenAi: true,
  useIntegrations: true, isPublic: true, useWhatsappOfficial: false,
  trial: false, trialDays: 3, recurrence: "monthly", wavoip: false,
};

/* ══════════════════════════════════════════════════════════
   Modal — Criar / Editar Plano
   ══════════════════════════════════════════════════════════ */
export function PlanModal({ open, onClose, plan, onSave, onDelete, loading }) {
  const classes = useStyles();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("xs"));

  const [record, setRecord] = useState(INITIAL_PLAN);

  useEffect(() => {
    if (plan && open) {
      setRecord({
        ...INITIAL_PLAN,
        ...plan,
        useWhatsapp: plan.useWhatsapp !== false,
        useWhatsappOfficial: plan.useWhatsappOfficial !== false,
        useFacebook: plan.useFacebook !== false,
        useInstagram: plan.useInstagram !== false,
        useCampaigns: plan.useCampaigns !== false,
        useSchedules: plan.useSchedules !== false,
        useInternalChat: plan.useInternalChat !== false,
        useExternalApi: plan.useExternalApi !== false,
        useKanban: plan.useKanban !== false,
        useOpenAi: plan.useOpenAi !== false,
        useIntegrations: plan.useIntegrations !== false,
        wavoip: plan.wavoip !== false,
        amount: plan.amount?.toLocaleString("pt-br", { minimumFractionDigits: 2 }) || 0,
      });
    } else {
      setRecord(INITIAL_PLAN);
    }
  }, [plan, open]);

  const handleClose = () => { onClose(); setRecord(INITIAL_PLAN); };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      fullScreen={fullScreen}
      scroll="paper"
      classes={{ paper: classes.dialogPaper }}
    >
      <div className={classes.modalHeader}>
        <span className={classes.modalTitle}>
          {plan ? "Editar Plano" : "Novo Plano"}
        </span>
        <button type="button" className={classes.closeBtn} onClick={handleClose}>✕</button>
      </div>

      <Formik
        initialValues={record}
        enableReinitialize
        onSubmit={(values, actions) => {
          onSave(values);
          actions.setSubmitting(false);
        }}
      >
        {({ values, setFieldValue, isSubmitting }) => (
          <Form>
            <DialogContent className={classes.modalContent} dividers={false}>

              <div className={classes.section} style={{ marginTop: 4 }}>Dados do Plano</div>
              <Grid container spacing={1}>
                <Grid item xs={12} sm={6}>
                  <Field as={TextField} label="Nome" name="name"
                    variant="outlined" fullWidth className={classes.field} />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Field as={TextField} label="Usuários" name="users" type="number"
                    variant="outlined" fullWidth className={classes.field} />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Field as={TextField} label="Conexões" name="connections" type="number"
                    variant="outlined" fullWidth className={classes.field} />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Field as={TextField} label="Filas" name="queues" type="number"
                    variant="outlined" fullWidth className={classes.field} />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Field as={TextField} label="Valor" name="amount" type="text"
                    variant="outlined" fullWidth className={classes.field} />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <FormControl variant="outlined" fullWidth className={classes.sel}>
                    <InputLabel>Público</InputLabel>
                    <Field as={Select} label="Público" name="isPublic">
                      <MenuItem value={true}>Sim</MenuItem>
                      <MenuItem value={false}>Não</MenuItem>
                    </Field>
                  </FormControl>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <FormControl variant="outlined" fullWidth className={classes.sel}>
                    <InputLabel>Trial</InputLabel>
                    <Field as={Select} label="Trial" name="trial">
                      <MenuItem value={true}>Sim</MenuItem>
                      <MenuItem value={false}>Não</MenuItem>
                    </Field>
                  </FormControl>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Field as={TextField} label="Dias trial" name="trialDays" type="number"
                    variant="outlined" fullWidth className={classes.field}
                    inputProps={{ min: 1 }} disabled={!values.trial} />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <FormControl variant="outlined" fullWidth className={classes.sel}>
                    <InputLabel>Recorrência</InputLabel>
                    <Field as={Select} label="Recorrência" name="recurrence">
                      <MenuItem value="monthly">Mensal</MenuItem>
                      <MenuItem value="bimonthly">Bimestral</MenuItem>
                      <MenuItem value="quarterly">Trimestral</MenuItem>
                      <MenuItem value="semiannual">Semestral</MenuItem>
                      <MenuItem value="yearly">Anual</MenuItem>
                    </Field>
                  </FormControl>
                </Grid>
              </Grid>

              <div className={classes.section}>Recursos</div>
              <div className={classes.toggleGrid}>
                {TOGGLES.map((t) => (
                  <Toggle key={t.name} label={t.label} name={t.name}
                    values={values} setFieldValue={setFieldValue} />
                ))}
              </div>
            </DialogContent>

            <DialogActions className={classes.modalActions}>
              {plan && plan.id && (
                <Button onClick={() => onDelete(plan)} color="secondary"
                  variant="outlined" className={classes.deleteBtn} disabled={isSubmitting || loading}>
                  Excluir
                </Button>
              )}
              <div style={{ flex: 1 }} />
              <Button onClick={handleClose} disabled={isSubmitting || loading}
                variant="outlined" className={classes.cancelBtn}>
                Cancelar
              </Button>
              <Button type="submit" color="primary" disabled={isSubmitting || loading}
                variant="contained" className={classes.saveBtn}>
                {(isSubmitting || loading) ? <CircularProgress size={16} /> : "Salvar"}
              </Button>
            </DialogActions>
          </Form>
        )}
      </Formik>
    </Dialog>
  );
}

// Keep old export name for backward compat
export const PlanManagerForm = PlanModal;

/* ══════════════════════════════════════════════════════════
   Mobile Card
   ══════════════════════════════════════════════════════════ */
function PlanCard({ row, classes, onSelect }) {
  return (
    <div className={classes.card} onClick={() => onSelect(row)}>
      <div className={classes.cardHeader}>
        <span className={classes.cardName}>{row.name || "—"}</span>
        <span className={`${classes.tag} ${classes.tagNeutral}`}>
          {i18n.t("plans.form.money")} {row.amount ? row.amount.toLocaleString("pt-br", { minimumFractionDigits: 2 }) : "0.00"}
        </span>
      </div>
      <div className={classes.cardRow}>
        <span className={classes.cardMeta}>{row.users || 0} usr</span>
        <span className={classes.cardMeta}>{row.connections || 0} cnx</span>
        <span className={classes.cardMeta}>{row.queues || 0} filas</span>
        {row.trial && <span className={`${classes.tag} ${classes.tagYes}`}>Trial {row.trialDays}d</span>}
        <BoolTag value={row.isPublic} classes={classes} />
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Table Grid
   ══════════════════════════════════════════════════════════ */
export function PlansManagerGrid(props) {
  const { records, onSelect } = props;
  const classes = useStyles();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("xs"));

  if (isMobile) {
    return (
      <div className={classes.cardList}>
        {records.map((row) => (
          <PlanCard key={row.id} row={row} classes={classes} onSelect={onSelect} />
        ))}
        {records.length === 0 && (
          <div style={{ textAlign: "center", padding: 24, opacity: 0.5, fontSize: 12 }}>
            Nenhum plano encontrado.
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={classes.tableWrap}>
      <Table className={classes.table} padding="none" aria-label="plans table">
        <TableHead>
          <TableRow>
            <TableCell style={{ width: 36 }}></TableCell>
            <TableCell align="left">Nome</TableCell>
            <TableCell align="center">Usuários</TableCell>
            <TableCell align="center">Conexões</TableCell>
            <TableCell align="center">Filas</TableCell>
            <TableCell align="center">Valor</TableCell>
            <TableCell align="center">Público</TableCell>
            <TableCell align="center">Trial</TableCell>
            <TableCell align="center">WhatsApp</TableCell>
            <TableCell align="center">WA Oficial</TableCell>
            <TableCell align="center">Facebook</TableCell>
            <TableCell align="center">Instagram</TableCell>
            <TableCell align="center">{i18n.t("plans.form.campaigns")}</TableCell>
            <TableCell align="center">{i18n.t("plans.form.schedules")}</TableCell>
            <TableCell align="center">Chat Int.</TableCell>
            <TableCell align="center">API Ext.</TableCell>
            <TableCell align="center">Kanban</TableCell>
            <TableCell align="center">Talk.Ai</TableCell>
            <TableCell align="center">Integrações</TableCell>
            <TableCell align="center">Wavoip</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {records.map((row) => (
            <TableRow key={row.id} className={classes.tableRow} onClick={() => onSelect(row)}>
              <TableCell align="center" style={{ width: 36 }}>
                <IconButton size="small" style={{ padding: 3 }}>
                  <EditIcon className={classes.editIcon} />
                </IconButton>
              </TableCell>
              <TableCell align="left" style={{ fontWeight: 500 }}>{row.name || "—"}</TableCell>
              <TableCell align="center">{row.users || "—"}</TableCell>
              <TableCell align="center">{row.connections || "—"}</TableCell>
              <TableCell align="center">{row.queues || "—"}</TableCell>
              <TableCell align="center" style={{ whiteSpace: "nowrap" }}>
                R$ {row.amount ? row.amount.toLocaleString("pt-br", { minimumFractionDigits: 2 }) : "0.00"}
              </TableCell>
              <TableCell align="center"><BoolTag value={row.isPublic} classes={classes} /></TableCell>
              <TableCell align="center">
                {row.trial
                  ? <span className={`${classes.tag} ${classes.tagYes}`}>{row.trialDays}d</span>
                  : <span className={`${classes.tag} ${classes.tagNeutral}`}>—</span>}
              </TableCell>
              <TableCell align="center"><BoolTag value={row.useWhatsapp} classes={classes} /></TableCell>
              <TableCell align="center"><BoolTag value={row.useWhatsappOfficial} classes={classes} /></TableCell>
              <TableCell align="center"><BoolTag value={row.useFacebook} classes={classes} /></TableCell>
              <TableCell align="center"><BoolTag value={row.useInstagram} classes={classes} /></TableCell>
              <TableCell align="center"><BoolTag value={row.useCampaigns} classes={classes} /></TableCell>
              <TableCell align="center"><BoolTag value={row.useSchedules} classes={classes} /></TableCell>
              <TableCell align="center"><BoolTag value={row.useInternalChat} classes={classes} /></TableCell>
              <TableCell align="center"><BoolTag value={row.useExternalApi} classes={classes} /></TableCell>
              <TableCell align="center"><BoolTag value={row.useKanban} classes={classes} /></TableCell>
              <TableCell align="center"><BoolTag value={row.useOpenAi} classes={classes} /></TableCell>
              <TableCell align="center"><BoolTag value={row.useIntegrations} classes={classes} /></TableCell>
              <TableCell align="center"><BoolTag value={row.wavoip} classes={classes} /></TableCell>
            </TableRow>
          ))}
          {records.length === 0 && (
            <TableRow>
              <TableCell colSpan={20} align="center" style={{ padding: 28, opacity: 0.5, fontSize: 12 }}>
                Nenhum plano encontrado.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Main Component
   ══════════════════════════════════════════════════════════ */
export default function PlansManager() {
  const classes = useStyles();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("xs"));
  const { list, save, update, remove } = usePlans();

  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    setLoading(true);
    try {
      const planList = await list();
      setRecords(planList);
    } catch {
      toast.error("Não foi possível carregar a lista de planos");
    }
    setLoading(false);
  };

  const handleSubmit = async (data) => {
    setLoading(true);
    try {
      if (data.id !== undefined) {
        await update(data);
      } else {
        await save(data);
      }
      await loadPlans();
      setModalOpen(false);
      setSelectedPlan(null);
      toast.success("Operação realizada com sucesso!");
    } catch {
      toast.error("Erro ao salvar. Verifique se já existe um plano com o mesmo nome.");
    }
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!selectedPlan?.id) return;
    setLoading(true);
    try {
      await remove(selectedPlan.id);
      await loadPlans();
      setShowConfirmDialog(false);
      setModalOpen(false);
      setSelectedPlan(null);
      toast.success("Plano removido com sucesso!");
    } catch {
      toast.error("Não foi possível remover o plano");
    }
    setLoading(false);
  };

  const handleSelect = (data) => {
    setSelectedPlan(data);
    setModalOpen(true);
  };

  const handleAdd = () => {
    setSelectedPlan(null);
    setModalOpen(true);
  };

  const handleDeleteRequest = (plan) => {
    setSelectedPlan(plan);
    setShowConfirmDialog(true);
  };

  const filteredRecords = searchText.trim()
    ? records.filter((r) => (r.name || "").toLowerCase().includes(searchText.toLowerCase()))
    : records;

  return (
    <Paper className={classes.mainPaper} elevation={0}>
      {/* ── Top Bar ── */}
      <div className={classes.topBar}>
        <div className={classes.filterGroup}>
          <div className={classes.searchBox}>
            <SearchIcon style={{ fontSize: 14, opacity: 0.4 }} />
            <InputBase
              placeholder="Buscar plano..."
              className={classes.searchInput}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </div>
        </div>
        <div className={classes.actionsGroup}>
          <Button
            variant="contained"
            color="primary"
            className={classes.addBtn}
            onClick={handleAdd}
            startIcon={!isMobile ? <AddIcon style={{ fontSize: 13 }} /> : undefined}
          >
            {isMobile ? <AddIcon style={{ fontSize: 16 }} /> : "Novo Plano"}
          </Button>
        </div>
      </div>

      {/* ── Modal ── */}
      <PlanModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setSelectedPlan(null); }}
        plan={selectedPlan}
        onSave={handleSubmit}
        onDelete={handleDeleteRequest}
        loading={loading}
      />

      {/* ── Table / Cards ── */}
      <PlansManagerGrid records={filteredRecords} onSelect={handleSelect} />

      <ConfirmationModal
        title="Exclusão de Plano"
        open={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
        onConfirm={() => handleDelete()}
      >
        Deseja realmente excluir este plano?
      </ConfirmationModal>
    </Paper>
  );
}
