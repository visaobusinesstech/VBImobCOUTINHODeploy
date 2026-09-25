import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Collapse,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
  makeStyles
} from "@material-ui/core";
import ExpandMoreIcon from "@material-ui/icons/ExpandMore";
import ExpandLessIcon from "@material-ui/icons/ExpandLess";
import TimelineIcon from "@material-ui/icons/Timeline";
import PersonOutlineIcon from "@material-ui/icons/PersonOutline";
import InventoryIcon from "@material-ui/icons/CategoryOutlined";
import AttachMoneyIcon from "@material-ui/icons/AttachMoney";
import PublicIcon from "@material-ui/icons/Public";
import NotesIcon from "@material-ui/icons/Notes";
import leadsSalesService from "../../services/leadsSalesService";
import leadPipelinesService from "../../services/leadPipelinesService";
import inventoryService from "../../services/inventoryService";
import toastError from "../../errors/toastError";
import { toast } from "react-toastify";
import { AuthContext } from "../../context/Auth/AuthContext";
import { socketManager } from "../../context/Socket/SocketContext";
import {
  ORIGIN_CHANNELS,
  resolveOriginChannelId,
  resolveOriginLabel,
  stripProductMetaFromDescription
} from "../CreateLeadSaleModal/leadWizardConstants";

const DEFAULT_STAGES = [
  { key: "novo", label: "Novo Lead", color: "#6366F1" },
  { key: "qualificacao", label: "Qualificação", color: "#0EA5E9" },
  { key: "proposta", label: "Proposta", color: "#8B5CF6" },
  { key: "negociacao", label: "Negociação", color: "#F97316" },
  { key: "fechado", label: "Fechado", color: "#22C55E" }
];

const SECTIONS = [
  { id: "personal", label: "Dados pessoais", Icon: PersonOutlineIcon },
  { id: "inventory", label: "Inventário", Icon: InventoryIcon },
  { id: "value", label: "Valor", Icon: AttachMoneyIcon },
  { id: "origin", label: "Origem", Icon: PublicIcon },
  { id: "description", label: "Descrição", Icon: NotesIcon }
];

const useStyles = makeStyles((theme) => ({
  root: {
    marginTop: theme.spacing(1.5),
    marginBottom: theme.spacing(1.5),
    padding: theme.spacing(1.5),
    borderRadius: 10,
    border: `1px solid ${theme.palette.divider}`
  },
  titleRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: theme.spacing(1)
  },
  title: {
    fontSize: 14,
    fontWeight: 600,
    letterSpacing: "-0.01em"
  },
  pathWrap: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 4,
    marginBottom: theme.spacing(1)
  },
  stagePill: {
    border: "none",
    cursor: "pointer",
    borderRadius: 999,
    padding: "4px 10px",
    fontSize: 11,
    fontWeight: 500,
    backgroundColor:
      theme.palette.type === "dark" ? "rgba(255,255,255,0.06)" : "#f1f5f9",
    color: theme.palette.text.secondary,
    transition: "all 0.15s ease"
  },
  stagePillActive: {
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(99,102,241,0.35)"
        : "rgba(99,102,241,0.15)",
    color: theme.palette.type === "dark" ? "#c7d2fe" : "#4338ca",
    fontWeight: 700,
    boxShadow: "0 0 0 1px rgba(99,102,241,0.35)"
  },
  stagePillDone: {
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(34,197,94,0.18)"
        : "rgba(34,197,94,0.12)",
    color: theme.palette.type === "dark" ? "#86efac" : "#15803d"
  },
  arrow: {
    fontSize: 11,
    color: theme.palette.text.secondary,
    opacity: 0.6
  },
  sectionBtn: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 8,
    padding: "8px 10px",
    marginTop: theme.spacing(1),
    background:
      theme.palette.type === "dark" ? "rgba(255,255,255,0.04)" : "#fafafa",
    cursor: "pointer",
    textAlign: "left"
  },
  sectionLabel: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 13,
    fontWeight: 600
  },
  field: {
    marginTop: theme.spacing(1.25)
  },
  registerBtn: {
    textTransform: "none",
    borderRadius: 8,
    fontWeight: 500
  },
  saveRow: {
    marginTop: theme.spacing(1.5),
    display: "flex",
    justifyContent: "flex-end"
  }
}));

const formatMoney = (value) => {
  const n = Number(value || 0);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

const emptyForm = (contact) => ({
  name: contact?.name || "",
  phone: contact?.number || "",
  email: contact?.email || "",
  companyName: "",
  product: "",
  inventoryId: "",
  value: "",
  origin: "",
  description: ""
});

const ContactKanbanSalesPanel = ({ contact, ticket }) => {
  const classes = useStyles();
  const { user } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lead, setLead] = useState(null);
  const [pipelines, setPipelines] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [pipelineId, setPipelineId] = useState("");
  const [openSection, setOpenSection] = useState("personal");
  const [form, setForm] = useState(() => emptyForm(contact));

  const contactId = contact?.id;

  const selectedPipeline = useMemo(
    () =>
      pipelines.find(
        (p) => Number(p.id) === Number(lead?.pipelineId || pipelineId)
      ),
    [pipelines, lead, pipelineId]
  );

  const stages = useMemo(() => {
    const fromPipe = selectedPipeline?.stages;
    if (Array.isArray(fromPipe) && fromPipe.length) {
      return fromPipe
        .slice()
        .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
        .map((s) => ({
          key: s.key,
          label: s.label || s.key,
          color: s.color || "#6366F1"
        }));
    }
    return DEFAULT_STAGES;
  }, [selectedPipeline]);

  const currentStageIndex = useMemo(() => {
    const idx = stages.findIndex((s) => String(s.key) === String(lead?.status));
    return idx >= 0 ? idx : 0;
  }, [stages, lead]);

  const hydrateFormFromLead = useCallback(
    (found, contactSrc) => {
      if (!found) {
        setForm(emptyForm(contactSrc));
        return;
      }
      const products = Array.isArray(found.products) ? found.products : [];
      const firstProduct =
        products[0]?.name ||
        products[0]?.title ||
        (typeof products[0] === "string" ? products[0] : "") ||
        "";
      setForm({
        name: found.name || contactSrc?.name || "",
        phone: found.phone || contactSrc?.number || "",
        email: found.email || contactSrc?.email || "",
        companyName: found.companyName || "",
        product: firstProduct,
        inventoryId: products[0]?.id != null ? String(products[0].id) : "",
        value: found.value != null ? String(found.value) : "",
        origin:
          resolveOriginChannelId(found.origin) ||
          resolveOriginLabel(found.origin) ||
          found.origin ||
          "",
        description: stripProductMetaFromDescription(found.description || "")
      });
      if (found.pipelineId) setPipelineId(String(found.pipelineId));
    },
    []
  );

  const loadData = useCallback(async () => {
    if (!contactId) {
      setLead(null);
      setForm(emptyForm(contact));
      return;
    }
    setLoading(true);
    try {
      const [pipes, leadsRes, invData] = await Promise.all([
        leadPipelinesService.list(),
        leadsSalesService.list({ contactId, limit: 1 }),
        inventoryService.list({ searchParam: "", pageNumber: 1 }).catch(() => ({}))
      ]);
      const pipeList = Array.isArray(pipes)
        ? pipes
        : Array.isArray(pipes?.pipelines)
          ? pipes.pipelines
          : [];
      setPipelines(pipeList);
      setInventoryItems(
        Array.isArray(invData?.inventory) ? invData.inventory : []
      );
      const leads = Array.isArray(leadsRes?.leads)
        ? leadsRes.leads
        : Array.isArray(leadsRes)
          ? leadsRes
          : [];
      const found = leads[0] || null;
      setLead(found);
      hydrateFormFromLead(found, contact);
      if (!found && pipeList[0]?.id) {
        setPipelineId(String(pipeList[0].id));
      }
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, [contactId, contact, hydrateFormFromLead]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const onLeadEvent = (event) => {
      const saved = event?.detail;
      if (!saved) return;
      if (
        contactId &&
        Number(saved.contactId) === Number(contactId)
      ) {
        setLead(saved);
        hydrateFormFromLead(saved, contact);
      } else {
        loadData();
      }
    };
    window.addEventListener("lead-sale-upserted", onLeadEvent);
    return () => window.removeEventListener("lead-sale-upserted", onLeadEvent);
  }, [contactId, contact, hydrateFormFromLead, loadData]);

  useEffect(() => {
    if (!user?.companyId) return undefined;
    const socket = socketManager.GetSocket();
    const channel = `company-${user.companyId}-leads-sales`;
    const onLeadSocket = (data) => {
      if (!data?.lead) return;
      if (
        contactId &&
        Number(data.lead.contactId) === Number(contactId)
      ) {
        setLead(data.lead);
        hydrateFormFromLead(data.lead, contact);
      }
    };
    socket.on(channel, onLeadSocket);
    return () => {
      socket.off(channel, onLeadSocket);
    };
  }, [user?.companyId, contactId, contact, hydrateFormFromLead]);

  const buildProductsPayload = () => {
    const valueNum = Number(String(form.value || "0").replace(",", "."));
    if (form.inventoryId) {
      const item = inventoryItems.find(
        (i) => String(i.id) === String(form.inventoryId)
      );
      if (item) {
        return [
          {
            id: item.id,
            name: item.name || form.product || "Produto",
            price: Number.isFinite(valueNum) ? valueNum : Number(item.price) || 0,
            qty: 1,
            currency: "BRL"
          }
        ];
      }
    }
    if (form.product) {
      return [
        {
          name: form.product,
          quantity: 1,
          qty: 1,
          price: Number.isFinite(valueNum) ? valueNum : 0
        }
      ];
    }
    return lead?.products || [];
  };

  const ensureLead = async () => {
    if (lead?.id) return lead;
    const name =
      (form.name || "").trim() ||
      contact?.name ||
      ticket?.contact?.name ||
      "Lead";
    const created = await leadsSalesService.create({
      name,
      phone: form.phone || contact?.number || "",
      email: form.email || contact?.email || "",
      companyName: (form.companyName || "").trim() || null,
      contactId,
      pipelineId: pipelineId ? Number(pipelineId) : undefined,
      status: stages[0]?.key || "novo",
      value: Number(String(form.value || "0").replace(",", ".")) || 0,
      origin:
        resolveOriginLabel(form.origin) ||
        (form.origin || "").trim() ||
        "Tickets",
      description: form.description || "",
      products: buildProductsPayload(),
      date: new Date().toISOString()
    });
    setLead(created);
    try {
      window.dispatchEvent(
        new CustomEvent("lead-sale-upserted", { detail: created })
      );
    } catch (_) {
      /* ignore */
    }
    return created;
  };

  const handleSelectStage = async (key) => {
    try {
      setSaving(true);
      const current = await ensureLead();
      if (!current?.id) return;
      if (String(current.status) === String(key)) return;
      const updated = await leadsSalesService.update(current.id, { status: key });
      setLead(updated);
      toast.success("Etapa atualizada");
      try {
        window.dispatchEvent(
          new CustomEvent("lead-sale-upserted", { detail: updated })
        );
      } catch (_) {
        /* ignore */
      }
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!contactId) return;
    const name = (form.name || "").trim();
    if (!name && !lead?.id) {
      toast.error("Informe o nome do lead.");
      setOpenSection("personal");
      return;
    }
    setSaving(true);
    try {
      const valueNum = Number(String(form.value || "0").replace(",", "."));
      const payload = {
        name: name || lead?.name || contact?.name || "Lead",
        phone: (form.phone || "").replace(/\D/g, "") || null,
        email: (form.email || "").trim() || null,
        companyName: (form.companyName || "").trim() || null,
        value: Number.isFinite(valueNum) ? valueNum : 0,
        origin:
          resolveOriginLabel(form.origin) ||
          (form.origin || "").trim() ||
          null,
        description: form.description || "",
        products: buildProductsPayload(),
        contactId,
        pipelineId: pipelineId ? Number(pipelineId) : lead?.pipelineId || undefined
      };
      let saved;
      if (lead?.id) {
        saved = await leadsSalesService.update(lead.id, payload);
      } else {
        saved = await leadsSalesService.create({
          ...payload,
          status: stages[0]?.key || "novo",
          date: new Date().toISOString()
        });
      }
      setLead(saved);
      hydrateFormFromLead(saved, contact);
      toast.success("Dados do lead salvos");
      try {
        window.dispatchEvent(
          new CustomEvent("lead-sale-upserted", { detail: saved })
        );
      } catch (_) {
        /* ignore */
      }
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  const toggleSection = (id) => {
    setOpenSection((prev) => (prev === id ? null : id));
  };

  if (!contactId) return null;

  return (
    <Paper className={classes.root} elevation={0}>
      <Box className={classes.titleRow}>
        <TimelineIcon fontSize="small" color="primary" />
        <Typography className={classes.title}>Funil de vendas</Typography>
      </Box>

      {loading ? (
        <Box display="flex" justifyContent="center" py={2}>
          <CircularProgress size={22} />
        </Box>
      ) : (
        <>
          {!lead ? (
            <FormControl
              fullWidth
              margin="dense"
              variant="outlined"
              className={classes.field}
              size="small"
            >
              <InputLabel>Pipeline</InputLabel>
              <Select
                label="Pipeline"
                value={pipelineId}
                onChange={(e) => setPipelineId(e.target.value)}
              >
                {pipelines.map((p) => (
                  <MenuItem key={p.id} value={String(p.id)}>
                    {p.name}
                  </MenuItem>
                ))}
                {!pipelines.length && (
                  <MenuItem value="">Pipeline padrão</MenuItem>
                )}
              </Select>
            </FormControl>
          ) : null}

          <Box className={classes.pathWrap}>
            {stages.map((stage, idx) => (
              <React.Fragment key={stage.key}>
                <button
                  type="button"
                  className={`${classes.stagePill} ${
                    lead && idx === currentStageIndex
                      ? classes.stagePillActive
                      : lead && idx < currentStageIndex
                        ? classes.stagePillDone
                        : ""
                  }`}
                  onClick={() => handleSelectStage(stage.key)}
                  disabled={saving}
                >
                  {stage.label}
                </button>
                {idx < stages.length - 1 ? (
                  <span className={classes.arrow}>→</span>
                ) : null}
              </React.Fragment>
            ))}
          </Box>

          {lead ? (
            <Typography variant="caption" color="textSecondary">
              {stages[currentStageIndex]?.label || lead.status}
              {lead.value ? ` · ${formatMoney(lead.value)}` : ""}
            </Typography>
          ) : (
            <Typography variant="caption" color="textSecondary">
              Preencha os campos abaixo para criar o lead deste contato.
            </Typography>
          )}

          {SECTIONS.map(({ id, label, Icon }) => (
            <React.Fragment key={id}>
              <button
                type="button"
                className={classes.sectionBtn}
                onClick={() => toggleSection(id)}
              >
                <span className={classes.sectionLabel}>
                  <Icon fontSize="small" />
                  {label}
                </span>
                {openSection === id ? (
                  <ExpandLessIcon fontSize="small" />
                ) : (
                  <ExpandMoreIcon fontSize="small" />
                )}
              </button>
              <Collapse in={openSection === id}>
                <Box px={0.5} pb={0.5}>
                  {id === "personal" && (
                    <>
                      <TextField
                        className={classes.field}
                        label="Nome"
                        fullWidth
                        size="small"
                        variant="outlined"
                        value={form.name}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, name: e.target.value }))
                        }
                      />
                      <TextField
                        className={classes.field}
                        label="Telefone"
                        fullWidth
                        size="small"
                        variant="outlined"
                        value={form.phone}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, phone: e.target.value }))
                        }
                      />
                      <TextField
                        className={classes.field}
                        label="E-mail"
                        fullWidth
                        size="small"
                        variant="outlined"
                        value={form.email}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, email: e.target.value }))
                        }
                      />
                      <TextField
                        className={classes.field}
                        label="Empresa"
                        fullWidth
                        size="small"
                        variant="outlined"
                        value={form.companyName}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            companyName: e.target.value
                          }))
                        }
                      />
                    </>
                  )}
                  {id === "inventory" && (
                    <>
                      <FormControl
                        fullWidth
                        margin="dense"
                        variant="outlined"
                        size="small"
                        className={classes.field}
                      >
                        <InputLabel>Item do inventário</InputLabel>
                        <Select
                          label="Item do inventário"
                          value={form.inventoryId}
                          onChange={(e) => {
                            const idVal = e.target.value;
                            const item = inventoryItems.find(
                              (i) => String(i.id) === String(idVal)
                            );
                            setForm((f) => ({
                              ...f,
                              inventoryId: idVal,
                              product: item?.name || f.product,
                              value:
                                item?.price != null
                                  ? String(item.price)
                                  : f.value
                            }));
                          }}
                        >
                          <MenuItem value="">
                            <em>Nenhum</em>
                          </MenuItem>
                          {inventoryItems.map((item) => (
                            <MenuItem key={item.id} value={String(item.id)}>
                              {item.name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <TextField
                        className={classes.field}
                        label="Produto / serviço"
                        fullWidth
                        size="small"
                        variant="outlined"
                        value={form.product}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, product: e.target.value }))
                        }
                      />
                    </>
                  )}
                  {id === "value" && (
                    <TextField
                      className={classes.field}
                      label="Valor da venda"
                      fullWidth
                      size="small"
                      variant="outlined"
                      value={form.value}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, value: e.target.value }))
                      }
                    />
                  )}
                  {id === "origin" && (
                    <FormControl
                      fullWidth
                      margin="dense"
                      variant="outlined"
                      size="small"
                      className={classes.field}
                    >
                      <InputLabel>Canal de origem</InputLabel>
                      <Select
                        label="Canal de origem"
                        value={
                          resolveOriginChannelId(form.origin) || form.origin || ""
                        }
                        onChange={(e) =>
                          setForm((f) => ({ ...f, origin: e.target.value }))
                        }
                      >
                        <MenuItem value="">
                          <em>Não informado</em>
                        </MenuItem>
                        {ORIGIN_CHANNELS.map((ch) => (
                          <MenuItem key={ch.id} value={ch.id}>
                            {ch.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                  {id === "description" && (
                    <TextField
                      className={classes.field}
                      label="Descrição / anotações"
                      fullWidth
                      size="small"
                      variant="outlined"
                      multiline
                      rows={3}
                      value={form.description}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          description: e.target.value
                        }))
                      }
                    />
                  )}
                </Box>
              </Collapse>
            </React.Fragment>
          ))}

          <Box className={classes.saveRow}>
            <Button
              color="primary"
              variant="contained"
              size="small"
              className={classes.registerBtn}
              disabled={saving}
              onClick={handleSave}
            >
              {saving ? <CircularProgress size={18} color="inherit" /> : null}
              {lead?.id ? "Salvar alterações" : "Criar lead"}
            </Button>
          </Box>
        </>
      )}
    </Paper>
  );
};

export default ContactKanbanSalesPanel;
