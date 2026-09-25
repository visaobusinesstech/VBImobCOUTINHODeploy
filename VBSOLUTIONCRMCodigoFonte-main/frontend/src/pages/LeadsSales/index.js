/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 *
 * Leads e Vendas = CRM Pipeline (paridade com Radarimobtech / Lovable)
 * Layout = ActivitiesStyleLayout (igual Atividades / Projetos).
 */

import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useHistory } from "react-router-dom";
import * as XLSX from "xlsx";
import {
  IconButton,
  Popover,
  Typography,
  Button,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from "@material-ui/core";
import {
  ViewWeek as KanbanIcon,
  List as ListIcon,
  Dashboard as DashboardIcon,
  Settings as SettingsIcon,
  GetApp as DownloadIcon,
  Publish as ImportIcon,
  SwapHoriz as TransferIcon,
  FlashOn as ScoringIcon,
  EventNote as FollowupIcon,
  ContactPhone as ContatosIcon,
  Notifications as NotifIcon,
  CompareArrows as CruzamentoIcon,
  Timeline as AcoesIcon,
  FilterList as FilterIcon,
  MoreVert as MoreIcon,
} from "@material-ui/icons";
import {
  Users,
  Target,
  Home,
  Key,
  FileText,
  CalendarDays,
  CalendarClock,
  TrendingUp,
  Flame,
  UserX,
  CircleDollarSign,
} from "lucide-react";
import ActivitiesStyleLayout from "../../components/ActivitiesStyleLayout";
import MetricCard from "../../components/propostas/MetricCard";
import leadsSalesService from "../../services/leadsSalesService";
import leadPipelinesService from "../../services/leadPipelinesService";
import realtyService from "../../services/realtyService";
import realtyIntelService from "../../services/realtyIntelService";
import api from "../../services/api";
import PipelineLeadFormDialog from "../../components/PipelineLeadFormDialog";
import PipelineEstagiosDialog from "../../components/PipelineEstagiosDialog";
import TransferLeadsDialog from "../../components/TransferLeadsDialog";
import toastError from "../../errors/toastError";
import { toast } from "react-toastify";
import { formatBRL, groupLeadsByStage } from "../../helpers/realtyCrm";
import { AuthContext } from "../../context/Auth/AuthContext";
import {
  PIPELINE_ESTAGIOS,
  MOTIVOS_PERDA,
  normalizeEstagio,
  normalizeSearchText,
  getCanalLabel,
} from "../../constants/pipelineCrm";

const isAluguelPurpose = (purpose = "") =>
  /alug|loca/i.test(String(purpose || ""));

const isContratoAluguel = (c) =>
  /alug|loca/i.test(`${c?.title || ""} ${c?.notes || ""} ${c?.status || ""}`);

const defaultStages = () =>
  PIPELINE_ESTAGIOS.map((e) => ({ key: e.id, label: e.title, color: e.color }));

const navBtnStyle = { color: "#6b7280", padding: 4, width: 32, height: 32 };

const LeadsSales = () => {
  const history = useHistory();
  const { user } = useContext(AuthContext);
  const isMaster =
    user?.profile === "admin" ||
    user?.profile === "super" ||
    user?.super === true ||
    Number(user?.id) === 1;

  const [viewMode, setViewMode] = useState("board");
  const [leads, setLeads] = useState([]);
  const [stages, setStages] = useState(defaultStages());
  const [pipelines, setPipelines] = useState([]);
  const [pipeline, setPipeline] = useState(null);
  const [pipelineId, setPipelineId] = useState("");
  const [users, setUsers] = useState([]);
  const [openCreate, setOpenCreate] = useState(false);
  const [editLead, setEditLead] = useState(null);
  const [defaultEstagio, setDefaultEstagio] = useState("novos");
  const [matches, setMatches] = useState([]);
  const [selectedLead, setSelectedLead] = useState(null);
  const [editarPipelineOpen, setEditarPipelineOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterEstagio, setFilterEstagio] = useState("todos");
  const [filterCorretor, setFilterCorretor] = useState("todos");
  const [filterValorMin, setFilterValorMin] = useState("");
  const [filterValorMax, setFilterValorMax] = useState("");
  const [pendingPerdido, setPendingPerdido] = useState(null);
  const [motivoPerda, setMotivoPerda] = useState("");
  const [motivoDetalhe, setMotivoDetalhe] = useState("");
  const [dragOverColumn, setDragOverColumn] = useState(null);
  const [loading, setLoading] = useState(true);
  const [leadScores, setLeadScores] = useState({});
  const [scoringLoading, setScoringLoading] = useState(false);
  const [importText, setImportText] = useState("");
  const [contratosDash, setContratosDash] = useState([]);
  const [opsKpis, setOpsKpis] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [anchorMais, setAnchorMais] = useState(null);

  const ensureRadarPipeline = useCallback(async (list) => {
    const arr = Array.isArray(list) ? list : [];
    const hasRadarStages = (p) =>
      (p.stages || []).some((s) => ["novos", "qualificados", "mandar_opcoes"].includes(s.key));

    let target = arr.find((p) => /crm|radar|pipeline/i.test(p.name || "")) || arr[0];

    if (!target || !hasRadarStages(target) || !(target.stages || []).length) {
      const stagesPayload = PIPELINE_ESTAGIOS.map((e, i) => ({
        key: e.id,
        label: e.title,
        color: e.color,
        order: i + 1,
      }));
      const payload = arr.length
        ? arr.map((p) => {
            if (target && String(p.id) === String(target.id)) {
              return {
                id: p.id,
                name: p.name || "CRM Pipeline",
                stages: stagesPayload,
              };
            }
            return {
              id: p.id,
              name: p.name,
              stages: (p.stages || []).map((s, i) => ({
                id: s.id,
                key: s.key,
                label: s.label || s.name,
                color: s.color || "#3B82F6",
                order: s.order || i + 1,
              })),
            };
          })
        : [{ name: "CRM Pipeline", stages: stagesPayload }];

      if (!arr.length) {
        await leadPipelinesService.bulkSave(payload);
      } else if (target && (!(target.stages || []).length || !hasRadarStages(target))) {
        await leadPipelinesService.bulkSave(payload);
      }
      const refreshed = await leadPipelinesService.list();
      return Array.isArray(refreshed) ? refreshed : refreshed.pipelines || [];
    }
    return arr;
  }, []);

  const loadPipelinesAndUsers = useCallback(async () => {
    try {
      const [pipeData, usersResp] = await Promise.all([
        leadPipelinesService.list(),
        api.get("/users", { params: { searchParam: "" } }),
      ]);
      let list = Array.isArray(pipeData) ? pipeData : pipeData.pipelines || [];
      list = await ensureRadarPipeline(list);
      setPipelines(list);
      const userList = usersResp?.data?.users || usersResp?.data || [];
      setUsers(Array.isArray(userList) ? userList : []);
      const first = list[0];
      if (first) {
        setPipeline(first);
        setPipelineId(String(first.id));
        const st = (first.stages || []).map((s) => ({
          key: normalizeEstagio(s.key || s.status),
          label: s.label || s.name || s.key,
          color: s.color,
        }));
        setStages(st.length ? st : defaultStages());
      } else {
        setStages(defaultStages());
      }
    } catch (err) {
      toastError(err);
      setStages(defaultStages());
    }
  }, [ensureRadarPipeline]);

  const load = useCallback(
    async (pid = pipelineId) => {
      try {
        setLoading(true);
        const data = await leadsSalesService.list({
          pageSize: 500,
          pageNumber: 1,
          pipelineId: pid || undefined,
        });
        const rows = (data.leads || []).map((l) => ({
          ...l,
          status: normalizeEstagio(l.status),
        }));
        setLeads(rows);
      } catch (err) {
        toastError(err);
      } finally {
        setLoading(false);
      }
    },
    [pipelineId]
  );

  useEffect(() => {
    loadPipelinesAndUsers();
  }, [loadPipelinesAndUsers]);

  useEffect(() => {
    if (pipelineId) load(pipelineId);
  }, [pipelineId, load]);

  useEffect(() => {
    if (viewMode !== "dashboard") return;
    let active = true;
    (async () => {
      try {
        const [contratosRes, dashRes] = await Promise.all([
          realtyService.listContratos({ pageSize: 500, pageNumber: 1 }).catch(() => ({})),
          realtyIntelService.dashboard().catch(() => null),
        ]);
        if (!active) return;
        const rows = contratosRes?.contratos || contratosRes?.rows || [];
        setContratosDash(Array.isArray(rows) ? rows : []);
        setOpsKpis(dashRes?.kpis || null);
      } catch (_) {
        if (active) {
          setContratosDash([]);
          setOpsKpis(null);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [viewMode]);

  const hasActiveFilters =
    filterEstagio !== "todos" ||
    filterCorretor !== "todos" ||
    filterValorMin !== "" ||
    filterValorMax !== "" ||
    searchQuery !== "";

  const clearFilters = () => {
    setFilterEstagio("todos");
    setFilterCorretor("todos");
    setFilterValorMin("");
    setFilterValorMax("");
    setSearchQuery("");
  };

  const filteredLeads = useMemo(() => {
    let result = leads;
    const rawQuery = searchQuery.trim();
    if (rawQuery) {
      const q = normalizeSearchText(rawQuery);
      const qDigits = rawQuery.replace(/\D/g, "");
      result = result.filter((l) => {
        const nome = normalizeSearchText(l.name);
        const email = normalizeSearchText(l.email);
        const phone = String(l.phone || "").replace(/\D/g, "");
        const interesse = normalizeSearchText(
          [l.description, l.interestType, l.interestNeighborhood, l.purpose, l.featuresDesired]
            .filter(Boolean)
            .join(" ")
        );
        const canal = normalizeSearchText(l.origin);
        const obs = normalizeSearchText(l.featuresDesired);
        const estagioTitle = normalizeSearchText(
          stages.find((s) => s.key === l.status)?.label || l.status
        );
        const corretor = normalizeSearchText(
          l.responsible?.name || users.find((u) => Number(u.id) === Number(l.responsibleId))?.name
        );
        return (
          nome.includes(q) ||
          email.includes(q) ||
          interesse.includes(q) ||
          canal.includes(q) ||
          obs.includes(q) ||
          estagioTitle.includes(q) ||
          corretor.includes(q) ||
          (qDigits && phone.includes(qDigits))
        );
      });
    }
    if (filterEstagio !== "todos") {
      result = result.filter((l) => String(l.status || "") === filterEstagio);
    }
    if (filterCorretor !== "todos") {
      if (filterCorretor === "__none__") {
        result = result.filter((l) => !l.responsibleId);
      } else {
        result = result.filter((l) => String(l.responsibleId) === String(filterCorretor));
      }
    }
    const min = parseFloat(String(filterValorMin).replace(",", "."));
    const max = parseFloat(String(filterValorMax).replace(",", "."));
    if (!Number.isNaN(min)) result = result.filter((l) => Number(l.value || 0) >= min);
    if (!Number.isNaN(max)) result = result.filter((l) => Number(l.value || 0) <= max);
    return result;
  }, [leads, searchQuery, filterEstagio, filterCorretor, filterValorMin, filterValorMax, stages, users]);

  const visibleStages =
    filterEstagio !== "todos" ? stages.filter((s) => s.key === filterEstagio) : stages;

  const grouped = useMemo(
    () => groupLeadsByStage(filteredLeads, visibleStages),
    [filteredLeads, visibleStages]
  );

  const totalValor = filteredLeads.reduce((sum, l) => sum + (Number(l.value) || 0), 0);
  const formatTotal = formatBRL(totalValor);

  const followupsPendentes = useMemo(() => {
    const now = Date.now();
    return filteredLeads
      .filter((l) => l.followUpAt)
      .map((l) => ({
        ...l,
        overdue: new Date(l.followUpAt).getTime() < now,
        today:
          new Date(l.followUpAt).toDateString() === new Date().toDateString(),
      }))
      .sort((a, b) => new Date(a.followUpAt) - new Date(b.followUpAt));
  }, [filteredLeads]);

  const atrasadosCount = followupsPendentes.filter((f) => f.overdue).length;
  const hojeCount = followupsPendentes.filter((f) => f.today && !f.overdue).length;

  const contatosSemResposta = useMemo(
    () =>
      filteredLeads.filter((l) =>
        ["nao_responde", "pediu_tempo", "qualificados", "novos"].includes(l.status)
      ),
    [filteredLeads]
  );

  const notificacoes = useMemo(() => {
    const items = [];
    followupsPendentes.filter((f) => f.overdue).forEach((l) => {
      items.push({
        id: `fu-${l.id}`,
        tipo: "Follow-up atrasado",
        texto: `${l.name} — ${new Date(l.followUpAt).toLocaleString("pt-BR")}`,
      });
    });
    filteredLeads
      .filter((l) => !l.responsibleId)
      .slice(0, 20)
      .forEach((l) => {
        items.push({ id: `sc-${l.id}`, tipo: "Sem corretor", texto: l.name });
      });
    return items;
  }, [followupsPendentes, filteredLeads]);

  const dashboardMetrics = useMemo(() => {
    const total = leads.length;
    const novos = leads.filter((l) => l.status === "novos").length;
    const fechadosList = leads.filter((l) => l.status === "fechado");
    const fechados = fechadosList.length;
    const perdidos = leads.filter((l) =>
      ["perdido", "desistiu", "comprou_outra"].includes(l.status)
    ).length;
    const conversao = total ? Math.round((fechados / total) * 1000) / 10 : 0;
    const porEstagio = stages.map((s) => ({
      key: s.key,
      label: s.label,
      color: s.color,
      count: leads.filter((l) => l.status === s.key).length,
      valor: leads
        .filter((l) => l.status === s.key)
        .reduce((a, l) => a + (Number(l.value) || 0), 0),
    }));
    const porCanal = {};
    leads.forEach((l) => {
      const c = getCanalLabel(l.origin) || "Não informado";
      porCanal[c] = (porCanal[c] || 0) + 1;
    });
    const canalRows = Object.entries(porCanal)
      .map(([canal, count]) => ({ canal, count }))
      .sort((a, b) => b.count - a.count);
    const openStatuses = ["fechado", "perdido", "desistiu", "comprou_outra"];
    const valorPipeline = leads
      .filter((l) => !openStatuses.includes(l.status))
      .reduce((a, l) => a + (Number(l.value) || 0), 0);

    const fechadosVenda = fechadosList.filter((l) => !isAluguelPurpose(l.purpose));
    const fechadosAluguel = fechadosList.filter((l) => isAluguelPurpose(l.purpose));
    const totalVendas = fechadosVenda.reduce((a, l) => a + (Number(l.value) || 0), 0);
    const totalAluguel = fechadosAluguel.reduce((a, l) => a + (Number(l.value) || 0), 0);

    const contratosAtivos = contratosDash.filter(
      (c) => !/cancel|rescind|inativ/i.test(String(c.status || ""))
    );
    const contratosVenda = contratosAtivos.filter((c) => !isContratoAluguel(c));
    const contratosAluguel = contratosAtivos.filter((c) => isContratoAluguel(c));
    const valorContratosVenda = contratosVenda.reduce((a, c) => a + (Number(c.value) || 0), 0);
    const valorContratosAluguel = contratosAluguel.reduce((a, c) => a + (Number(c.value) || 0), 0);

    const quentes = leads.filter((l) =>
      /quente|hot/i.test(String(l.temperature || ""))
    ).length;

    return {
      total,
      novos,
      fechados,
      perdidos,
      conversao,
      porEstagio,
      canalRows,
      valorPipeline,
      followups: followupsPendentes.length,
      followupsAtrasados: atrasadosCount,
      visitasHoje: opsKpis?.visitasHoje ?? 0,
      propostasAbertas: opsKpis?.propostasAbertas ?? 0,
      imoveisDisponiveis: opsKpis?.imoveisDisponiveis ?? 0,
      imoveis: opsKpis?.imoveis ?? 0,
      semCorretor: leads.filter((l) => !l.responsibleId).length,
      quentes,
      totalVendas: valorContratosVenda || totalVendas,
      totalAluguel: valorContratosAluguel || totalAluguel,
      contratosVenda: contratosVenda.length,
      contratosAluguel: contratosAluguel.length,
      contratosTotal: contratosAtivos.length,
    };
  }, [
    leads,
    stages,
    followupsPendentes.length,
    atrasadosCount,
    contratosDash,
    opsKpis,
  ]);

  const moveLead = async (lead, status, extra = {}) => {
    try {
      await leadsSalesService.update(lead.id, { status: normalizeEstagio(status), ...extra });
      toast.success("Lead movido");
      await load();
    } catch (err) {
      toastError(err);
    }
  };

  const confirmPerdido = async () => {
    if (!pendingPerdido) return;
    const label = MOTIVOS_PERDA.find((m) => m.id === motivoPerda)?.label || motivoPerda;
    const reason = [label, motivoDetalhe].filter(Boolean).join(" — ");
    await moveLead(pendingPerdido, "perdido", { lostReason: reason || "Perdido" });
    setPendingPerdido(null);
    setMotivoPerda("");
    setMotivoDetalhe("");
  };

  const openMatches = async (lead) => {
    setSelectedLead(lead);
    setViewMode("cruzamento");
    try {
      const data = await realtyService.matchImoveis(lead.id);
      setMatches(data.matches || []);
    } catch (err) {
      toastError(err);
    }
  };

  const vincular = async (imovelId) => {
    if (!selectedLead) return;
    try {
      await leadsSalesService.update(selectedLead.id, { imovelId });
      toast.success("Imóvel vinculado ao lead");
      setSelectedLead(null);
      await load();
    } catch (err) {
      toastError(err);
    }
  };

  const enviarWhatsApp = async () => {
    if (!selectedLead) return;
    try {
      const ids = matches.map((m) => m.imovelId);
      const data = await realtyService.sendMatchWhatsApp(selectedLead.id, ids);
      if (data.sent) toast.success("Opções enviadas no WhatsApp");
      else {
        toast.info(
          data.ticketId
            ? `Mensagem preparada (ticket #${data.ticketId}).`
            : "Vincule o lead a um ticket WhatsApp para disparo automático."
        );
      }
      if (data.ticketId) history.push(`/tickets/${data.ticketId}`);
      setSelectedLead(null);
      await load();
    } catch (err) {
      toastError(err);
    }
  };

  const onDragStart = (e, lead) => {
    e.dataTransfer.setData("text/plain", String(lead.id));
    e.dataTransfer.effectAllowed = "move";
  };

  const onDrop = async (e, stageKey) => {
    e.preventDefault();
    setDragOverColumn(null);
    const id = e.dataTransfer.getData("text/plain");
    const lead = leads.find((l) => String(l.id) === String(id));
    if (!lead || String(lead.status) === stageKey) return;
    if (stageKey === "perdido" || /perdido|lost|desistiu|comprou_outra/i.test(stageKey)) {
      setPendingPerdido(lead);
      setMotivoPerda("");
      setMotivoDetalhe("");
      return;
    }
    await moveLead(lead, stageKey);
  };

  const responsibleName = (lead) => {
    if (lead.responsible?.name) return lead.responsible.name;
    const u = users.find((x) => Number(x.id) === Number(lead.responsibleId));
    return u?.name || null;
  };

  const exportExcel = () => {
    const rows = filteredLeads.map((l) => ({
      Nome: l.name,
      Telefone: l.phone || "",
      Email: l.email || "",
      Interesse: l.description || "",
      Operação: l.purpose || "",
      Valor: Number(l.value) || 0,
      Estágio: stages.find((s) => s.key === l.status)?.label || l.status,
      Corretor: responsibleName(l) || "",
      Canal: l.origin || "",
      Bairro: l.interestNeighborhood || "",
      "Tipo imóvel": l.interestType || "",
      Observações: l.featuresDesired || "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Leads");
    XLSX.writeFile(wb, `leads-pipeline-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportPdf = () => {
    const w = window.open("", "_blank");
    if (!w) {
      toast.error("Permita pop-ups para exportar PDF");
      return;
    }
    const rows = filteredLeads
      .map(
        (l) =>
          `<tr><td>${l.name || ""}</td><td>${l.phone || ""}</td><td>${
            stages.find((s) => s.key === l.status)?.label || l.status
          }</td><td>${formatBRL(l.value)}</td><td>${responsibleName(l) || "—"}</td></tr>`
      )
      .join("");
    w.document.write(`<!DOCTYPE html><html><head><title>Relatório de Leads</title>
      <style>body{font-family:sans-serif;padding:24px}table{border-collapse:collapse;width:100%}
      th,td{border:1px solid #ddd;padding:8px;font-size:12px}th{background:#f3f4f6}</style></head>
      <body><h1>Relatório de Leads</h1>
      <p>${filteredLeads.length} leads · ${formatTotal} em pipeline</p>
      <table><thead><tr><th>Nome</th><th>Telefone</th><th>Estágio</th><th>Valor</th><th>Corretor</th></tr></thead>
      <tbody>${rows}</tbody></table></body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  const handleScoring = () => {
    setScoringLoading(true);
    try {
      const scores = {};
      filteredLeads.forEach((l) => {
        let score = 20;
        if (l.phone) score += 15;
        if (l.email) score += 10;
        if (Number(l.value) > 0) score += 15;
        if (l.interestNeighborhood) score += 10;
        if (l.interestType) score += 10;
        if (l.followUpAt) score += 10;
        if (l.responsibleId) score += 10;
        if (["visita", "proposta", "qualificados"].includes(l.status)) score += 15;
        if (["nao_responde", "perdido", "desistiu"].includes(l.status)) score -= 20;
        score = Math.max(0, Math.min(100, score));
        let classification = "Frio";
        let emoji = "❄️";
        if (score >= 70) {
          classification = "Quente";
          emoji = "🔥";
        } else if (score >= 40) {
          classification = "Morno";
          emoji = "🌤️";
        }
        scores[l.id] = { score, classification, emoji };
      });
      setLeadScores(scores);
      toast.success(`Lead Scoring concluído! ${Object.keys(scores).length} leads classificados`);
    } finally {
      setScoringLoading(false);
    }
  };

  const handleImport = async () => {
    const lines = importText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) {
      toast.error("Cole linhas no formato: Nome;Telefone;Email;Valor");
      return;
    }
    let ok = 0;
    for (const line of lines) {
      const [name, phone, email, value] = line.split(";").map((x) => (x || "").trim());
      if (!name) continue;
      try {
        await leadsSalesService.create({
          name,
          phone: phone || null,
          email: email || null,
          value: Number(String(value || "0").replace(",", ".")) || 0,
          status: "novos",
          purpose: "venda",
          pipelineId: pipelineId ? Number(pipelineId) : undefined,
        });
        ok += 1;
      } catch (_) {
        /* continue */
      }
    }
    toast.success(`${ok} lead(s) importado(s)`);
    setImportOpen(false);
    setImportText("");
    await load();
  };

  const openCreateAt = (estagio) => {
    setEditLead(null);
    setDefaultEstagio(estagio || "novos");
    setOpenCreate(true);
  };

  const selectPipeline = (id) => {
    setPipelineId(String(id));
    const p = pipelines.find((x) => String(x.id) === String(id));
    setPipeline(p || null);
    if (p?.stages?.length) {
      setStages(
        p.stages.map((s) => ({
          key: normalizeEstagio(s.key),
          label: s.label || s.name || s.key,
          color: s.color,
        }))
      );
    }
  };

  const moreOptions = useMemo(
    () => [
      {
        value: "followups",
        label:
          atrasadosCount + hojeCount > 0
            ? `Follow-ups (${atrasadosCount + hojeCount})`
            : "Follow-ups",
        icon: <FollowupIcon fontSize="small" />,
      },
      { value: "contatos", label: "Contatos", icon: <ContatosIcon fontSize="small" /> },
      {
        value: "notificacoes",
        label: notificacoes.length
          ? `Notificações (${notificacoes.length})`
          : "Notificações",
        icon: <NotifIcon fontSize="small" />,
      },
      {
        value: "cruzamento",
        label: "Demanda × Carteira",
        icon: <CruzamentoIcon fontSize="small" />,
      },
      { value: "acoes", label: "Ações em tempo real", icon: <AcoesIcon fontSize="small" /> },
    ],
    [atrasadosCount, hojeCount, notificacoes.length]
  );

  const isMoreView = moreOptions.some((o) => o.value === viewMode);

  const viewModes = useMemo(
    () => [
      { value: "board", label: "Quadro", icon: <KanbanIcon style={{ fontSize: 16 }} /> },
      { value: "list", label: "Lista", icon: <ListIcon style={{ fontSize: 16 }} /> },
      { value: "dashboard", label: "Dashboard", icon: <DashboardIcon style={{ fontSize: 16 }} /> },
    ],
    []
  );

  const navActions = (
    <>
      <IconButton
        title="Mais opções"
        size="small"
        style={{
          ...navBtnStyle,
          ...(isMoreView
            ? { color: "#2673d9", background: "rgba(38,115,217,0.1)" }
            : {}),
        }}
        onClick={(e) => setAnchorMais(e.currentTarget)}
      >
        <MoreIcon style={{ fontSize: 18 }} />
      </IconButton>
      <Menu
        anchorEl={anchorMais}
        open={Boolean(anchorMais)}
        onClose={() => setAnchorMais(null)}
        getContentAnchorEl={null}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        {moreOptions.map((opt) => (
          <MenuItem
            key={opt.value}
            selected={viewMode === opt.value}
            onClick={() => {
              setViewMode(opt.value);
              setAnchorMais(null);
            }}
          >
            <ListItemIcon style={{ minWidth: 36 }}>{opt.icon}</ListItemIcon>
            <ListItemText primary={opt.label} />
          </MenuItem>
        ))}
      </Menu>
      <IconButton
        title="Importar / Exportar"
        size="small"
        style={navBtnStyle}
        onClick={() => setImportOpen(true)}
      >
        <ImportIcon style={{ fontSize: 18 }} />
      </IconButton>
      {isMaster && (
        <IconButton
          title="Transferência de Leads"
          size="small"
          style={navBtnStyle}
          onClick={() => setTransferOpen(true)}
        >
          <TransferIcon style={{ fontSize: 18 }} />
        </IconButton>
      )}
      <IconButton title="Exportar PDF" size="small" style={navBtnStyle} onClick={exportPdf}>
        <DownloadIcon style={{ fontSize: 18 }} />
      </IconButton>
      <IconButton title="Exportar Excel" size="small" style={navBtnStyle} onClick={exportExcel}>
        <FileText size={16} />
      </IconButton>
      <IconButton
        title="Lead Scoring"
        size="small"
        style={navBtnStyle}
        onClick={handleScoring}
        disabled={scoringLoading || !leads.length}
      >
        <ScoringIcon style={{ fontSize: 18 }} />
      </IconButton>
      <IconButton
        title="Editar pipeline"
        size="small"
        style={navBtnStyle}
        onClick={() => setEditarPipelineOpen(true)}
      >
        <SettingsIcon style={{ fontSize: 18 }} />
      </IconButton>
    </>
  );

  const rightFilters = ({ classes: layout }) => (
    <>
      <div
        className={layout.filterItem}
        onClick={() => setShowFilters((v) => !v)}
        style={
          showFilters || hasActiveFilters
            ? { background: "rgba(38,115,217,0.1)", borderRadius: 8 }
            : undefined
        }
      >
        <FilterIcon className={layout.calendarIcon} style={{ fontSize: 12 }} />
        <Typography
          className={layout.filterLabel}
          style={
            showFilters || hasActiveFilters
              ? { color: "#2673d9", fontWeight: 600 }
              : undefined
          }
        >
          Filtros{hasActiveFilters ? " ●" : ""}
        </Typography>
      </div>
      {hasActiveFilters && (
        <div className={layout.filterItem} onClick={clearFilters}>
          <Typography className={layout.filterLabel} style={{ color: "#b91c1c" }}>
            Limpar
          </Typography>
        </div>
      )}
    </>
  );

  const initialsOf = (name) => {
    const parts = String(name || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (!parts.length) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  };

  const renderLeadCard = (lead, stage) => {
    const accent = stage?.color || "#6366f1";
    const responsavel = responsibleName(lead);
    const subtitle =
      [lead.description, lead.interestType, lead.interestNeighborhood]
        .filter(Boolean)
        .join(" · ") ||
      (lead.purpose === "aluguel" ? "Aluguel" : lead.purpose === "venda" ? "Venda" : "");
    const tag =
      lead.origin ||
      lead.interestType ||
      (leadScores[lead.id] ? leadScores[lead.id].classification : null) ||
      (lead.purpose === "aluguel" ? "Aluguel" : "Venda");

    return (
      <article
        key={lead.id}
        className="ls-card"
        draggable
        onDragStart={(e) => onDragStart(e, lead)}
        onClick={() => {
          setEditLead(lead);
          setOpenCreate(true);
        }}
        style={{ ["--ls-accent"]: accent }}
      >
        <div className="ls-card__accent" />
        <div className="ls-card__top">
          <div className="ls-card__avatar" style={{ background: `${accent}22`, color: accent }}>
            {initialsOf(lead.name)}
            <span className="ls-card__online" />
          </div>
          <div className="ls-card__identity">
            <strong className="ls-card__name">
              {leadScores[lead.id]?.emoji ? `${leadScores[lead.id].emoji} ` : ""}
              {lead.name}
            </strong>
            {subtitle ? <span className="ls-card__company">{subtitle}</span> : null}
          </div>
        </div>

        <div className="ls-card__phone">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1.1-.2 1.2.4 2.5.6 3.8.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.6.6 3.8.1.4 0 .8-.2 1.1L6.6 10.8z"
              fill="currentColor"
            />
          </svg>
          {lead.phone || "sem telefone"}
        </div>

        <div className="ls-card__value">{formatBRL(lead.value)}</div>

        {tag ? <span className="ls-card__tag">{tag}</span> : null}

        <div className="ls-card__footer">
          <span className="ls-card__owner">
            <span className="ls-card__ok" aria-hidden>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                <path
                  d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"
                  fill="#fff"
                />
              </svg>
            </span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M12 12a4 4 0 100-8 4 4 0 000 8zm0 2c-4 0-8 2-8 4v1h16v-1c0-2-4-4-8-4z"
                fill="currentColor"
              />
            </svg>
            {responsavel || "Sem corretor"}
          </span>
          <div className="ls-card__footer-actions" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="ls-card__icon-btn"
              title="Match imóveis"
              onClick={() => openMatches(lead)}
            >
              M
            </button>
            <button
              type="button"
              className="ls-card__icon-btn ls-card__icon-btn--wa"
              title="WhatsApp"
              onClick={async () => {
                try {
                  const data = await leadsSalesService.linkTicket(lead.id);
                  if (data.ticket?.uuid) history.push(`/tickets/${data.ticket.uuid}`);
                  else toast.info("Nenhum ticket WhatsApp para este telefone ainda.");
                } catch (err) {
                  toastError(err);
                }
              }}
            >
              W
            </button>
          </div>
        </div>

        <div className="ls-card__extra" onClick={(e) => e.stopPropagation()}>
          <label className="ls-card__followup">
            <span>Follow-up</span>
            <input
              type="datetime-local"
              defaultValue={
                lead.followUpAt
                  ? new Date(lead.followUpAt).toISOString().slice(0, 16)
                  : ""
              }
              onBlur={async (e) => {
                try {
                  await leadsSalesService.update(lead.id, {
                    followUpAt: e.target.value
                      ? new Date(e.target.value).toISOString()
                      : null,
                  });
                } catch (err) {
                  toastError(err);
                }
              }}
            />
          </label>
          <select
            className="ls-card__stage"
            value={lead.status || stage.key}
            onChange={(e) => {
              const next = e.target.value;
              if (next === "perdido" || /perdido|lost|desistiu|comprou_outra/i.test(next)) {
                setPendingPerdido(lead);
                setMotivoPerda("");
                setMotivoDetalhe("");
                return;
              }
              moveLead(lead, next);
            }}
          >
            {stages.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </article>
    );
  };

  return (
    <>
      <ActivitiesStyleLayout
        title={null}
        description={`${filteredLeads.length} leads · ${formatTotal} em pipeline`}
        onCreateClick={() => openCreateAt("novos")}
        createButtonText="Novo Lead"
        searchPlaceholder="Buscar lead por nome, telefone ou e-mail..."
        searchValue={searchQuery}
        onSearchChange={(value) => setSearchQuery(value || "")}
        navActions={navActions}
        viewModes={viewModes}
        currentViewMode={viewMode}
        onViewModeChange={setViewMode}
        rightFilters={rightFilters}
        enableTabsScroll={false}
        scrollContent={false}
        contentEdgeToEdge={viewMode === "dashboard" || viewMode === "board"}
        rootClassName="leads-sales-asl"
        helpTopic="leadsSales"
      >
        {showFilters && (
          <div className="realty-filters-panel leads-sales-filters">
            <label className="realty-filter-field">
              <span>Pipeline</span>
              <select
                value={pipelineId}
                onChange={(e) => selectPipeline(e.target.value)}
                aria-label="Pipeline"
              >
                {pipelines.length === 0 && <option value="">Pipeline padrão</option>}
                {pipelines.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name || `Pipeline ${p.id}`}
                  </option>
                ))}
              </select>
            </label>
            <label className="realty-filter-field">
              <span>Estágio</span>
              <select
                value={filterEstagio}
                onChange={(e) => setFilterEstagio(e.target.value)}
              >
                <option value="todos">Todos</option>
                {stages.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="realty-filter-field">
              <span>Corretor</span>
              <select
                value={filterCorretor}
                onChange={(e) => setFilterCorretor(e.target.value)}
              >
                <option value="todos">Todos</option>
                <option value="__none__">Sem corretor</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="realty-filter-field">
              <span>Valor mín.</span>
              <input
                type="number"
                min="0"
                step="1000"
                placeholder="0"
                value={filterValorMin}
                onChange={(e) => setFilterValorMin(e.target.value)}
              />
            </label>
            <label className="realty-filter-field">
              <span>Valor máx.</span>
              <input
                type="number"
                min="0"
                step="1000"
                placeholder="∞"
                value={filterValorMax}
                onChange={(e) => setFilterValorMax(e.target.value)}
              />
            </label>
            {hasActiveFilters && (
              <div className="realty-filter-field" style={{ justifyContent: "flex-end" }}>
                <span style={{ opacity: 0 }}>&nbsp;</span>
                <button
                  type="button"
                  className="realty-page__btn realty-page__btn--ghost"
                  onClick={clearFilters}
                  style={{ height: 38 }}
                >
                  Limpar
                </button>
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div className="pipeline-asl__loading">Carregando leads…</div>
        ) : (
          <>
            {viewMode === "board" && (
              <div className="ls-kanban">
                {visibleStages.map((stage) => {
                  const colLeads = grouped[stage.key] || [];
                  const colValor = colLeads.reduce((a, l) => a + (Number(l.value) || 0), 0);
                  const accent = stage.color || "#6366f1";
                  return (
                    <section
                      key={stage.key}
                      className={`ls-col${
                        dragOverColumn === stage.key ? " ls-col--drag" : ""
                      }`}
                      style={{ ["--ls-accent"]: accent }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOverColumn(stage.key);
                      }}
                      onDragLeave={() => setDragOverColumn(null)}
                      onDrop={(e) => onDrop(e, stage.key)}
                    >
                      <div className="ls-col__bar" />
                      <div className="ls-col__header">
                        <div className="ls-col__header-text">
                          <h4 className="ls-col__title">{stage.label}</h4>
                          <span className="ls-col__valor">{formatBRL(colValor)}</span>
                        </div>
                        <span className="ls-col__count">{colLeads.length}</span>
                      </div>
                      <div className="ls-col__list">
                        {colLeads.map((lead) => renderLeadCard(lead, stage))}
                      </div>
                      <button
                        type="button"
                        className="ls-col__add"
                        onClick={() => openCreateAt(stage.key)}
                      >
                        + Adicionar Lead
                      </button>
                    </section>
                  );
                })}
              </div>
            )}

            {viewMode === "list" && (
              <div className="pipeline-asl-panel">
                <div className="pipeline-asl-table-wrap">
                  <table className="pipeline-asl-table">
                    <thead>
                      <tr>
                        <th>Nome</th>
                        <th>Telefone</th>
                        <th>Estágio</th>
                        <th>Valor</th>
                        <th>Corretor</th>
                        <th>Canal</th>
                        <th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLeads.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ textAlign: "center", padding: 24 }}>
                            Nenhum lead encontrado
                          </td>
                        </tr>
                      ) : (
                        filteredLeads.map((l) => (
                          <tr key={l.id}>
                            <td>
                              <strong>{l.name}</strong>
                            </td>
                            <td>{l.phone || "—"}</td>
                            <td>
                              {stages.find((s) => s.key === l.status)?.label || l.status}
                            </td>
                            <td>{formatBRL(l.value)}</td>
                            <td>{responsibleName(l) || "—"}</td>
                            <td>{l.origin || "—"}</td>
                            <td>
                              <button
                                type="button"
                                className="realty-page__btn realty-page__btn--ghost"
                                style={{ height: 28, padding: "0 10px" }}
                                onClick={() => {
                                  setEditLead(l);
                                  setOpenCreate(true);
                                }}
                              >
                                Editar
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {viewMode === "followups" && (
              <div className="pipeline-asl-panel">
                <h3>
                  Follow-ups Pendentes
                  {atrasadosCount > 0 ? ` · ${atrasadosCount} atrasado(s)` : ""}
                </h3>
                {followupsPendentes.length === 0 ? (
                  <p>Nenhum follow-up agendado nos leads filtrados.</p>
                ) : (
                  <ul className="pipeline-crm__list">
                    {followupsPendentes.slice(0, 30).map((l) => (
                      <li key={l.id}>
                        <strong>{l.name}</strong> —{" "}
                        {new Date(l.followUpAt).toLocaleString("pt-BR")}
                        {l.overdue ? " · atrasado" : l.today ? " · hoje" : ""}
                        <button
                          type="button"
                          className="realty-page__btn realty-page__btn--ghost"
                          style={{ marginLeft: 8, height: 28, padding: "0 10px" }}
                          onClick={() => {
                            setEditLead(l);
                            setOpenCreate(true);
                          }}
                        >
                          Abrir
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {viewMode === "contatos" && (
              <div className="pipeline-asl-panel">
                <h3>Contatos — leads a acompanhar</h3>
                <ul className="pipeline-crm__list">
                  {contatosSemResposta.slice(0, 40).map((l) => (
                    <li key={l.id}>
                      <strong>{l.name}</strong> · {l.phone || "sem telefone"} ·{" "}
                      {stages.find((s) => s.key === l.status)?.label || l.status}
                    </li>
                  ))}
                  {!contatosSemResposta.length && <li>Nenhum contato pendente.</li>}
                </ul>
              </div>
            )}

            {viewMode === "notificacoes" && (
              <div className="pipeline-asl-panel">
                <h3>Notificações</h3>
                {notificacoes.length === 0 ? (
                  <p>Sem alertas no momento.</p>
                ) : (
                  <ul className="pipeline-crm__list">
                    {notificacoes.map((n) => (
                      <li key={n.id}>
                        <strong>{n.tipo}</strong>: {n.texto}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {viewMode === "acoes" && (
              <div className="pipeline-asl-panel">
                <h3>Ações em tempo real</h3>
                <p>
                  {
                    leads.filter((l) => {
                      const d = new Date(l.updatedAt || l.createdAt);
                      return Date.now() - d.getTime() < 24 * 60 * 60 * 1000;
                    }).length
                  }{" "}
                  lead(s) atualizados nas últimas 24h · {dashboardMetrics.semCorretor} sem
                  corretor · {dashboardMetrics.followups} follow-up(s) pendente(s).
                </p>
              </div>
            )}

            {viewMode === "cruzamento" && (
              <div className="pipeline-asl-panel">
                <h3>Demanda × Carteira</h3>
                <p>
                  Selecione um lead no kanban (Match) ou clique abaixo para cruzar perfil com
                  imóveis.
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                  {filteredLeads.slice(0, 15).map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      className="realty-page__btn realty-page__btn--ghost"
                      onClick={() => openMatches(l)}
                    >
                      Match: {l.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {viewMode === "dashboard" && (
              <div className="pipeline-crm__dashboard pipeline-asl-dashboard">
                <div className="realty-dash-section" style={{ marginTop: 0 }}>
                  <h3 className="realty-dash-section__title">Indicadores do funil</h3>
                  <p className="realty-dash-section__subtitle">
                    Métricas operacionais do pipeline CRM
                  </p>
                  <div className="pipeline-crm__metrics">
                    <MetricCard
                      title="Total Leads"
                      value={String(dashboardMetrics.total)}
                      change={`${dashboardMetrics.novos} novos`}
                      icon={Users}
                      delay={0}
                    />
                    <MetricCard
                      title="Leads Fechados"
                      value={String(dashboardMetrics.fechados)}
                      change={`${dashboardMetrics.conversao}% conversão`}
                      changeType="positive"
                      icon={Target}
                      delay={0.04}
                    />
                    <MetricCard
                      title="Valor em pipeline"
                      value={formatBRL(dashboardMetrics.valorPipeline)}
                      change={`${dashboardMetrics.semCorretor} sem corretor`}
                      changeType={dashboardMetrics.semCorretor ? "negative" : "neutral"}
                      icon={CircleDollarSign}
                      delay={0.08}
                    />
                    <MetricCard
                      title="Follow-ups / Perdidos"
                      value={`${dashboardMetrics.followups} / ${dashboardMetrics.perdidos}`}
                      change={
                        dashboardMetrics.followupsAtrasados
                          ? `${dashboardMetrics.followupsAtrasados} atrasado(s)`
                          : "Em dia"
                      }
                      changeType={
                        dashboardMetrics.followupsAtrasados ? "negative" : "positive"
                      }
                      icon={CalendarClock}
                      delay={0.12}
                    />
                  </div>
                </div>
                <div className="realty-dash-section">
                  <h3 className="realty-dash-section__title">Financeiro & contratos</h3>
                  <p className="realty-dash-section__subtitle">
                    Indicadores alinhados ao Radar Proptech
                  </p>
                  <div className="realty-metrics--3">
                    <MetricCard
                      title="Total Vendas"
                      value={formatBRL(dashboardMetrics.totalVendas)}
                      change={`${dashboardMetrics.contratosVenda} contratos venda`}
                      changeType="positive"
                      icon={Home}
                      delay={0.14}
                    />
                    <MetricCard
                      title="Total Aluguel"
                      value={formatBRL(dashboardMetrics.totalAluguel)}
                      change={`${dashboardMetrics.contratosAluguel} contratos aluguel`}
                      changeType="positive"
                      icon={Key}
                      delay={0.18}
                    />
                    <MetricCard
                      title="Contratos"
                      value={String(dashboardMetrics.contratosTotal)}
                      change={`${dashboardMetrics.contratosVenda} venda · ${dashboardMetrics.contratosAluguel} aluguel`}
                      icon={FileText}
                      delay={0.22}
                    />
                  </div>
                  <div className="pipeline-crm__metrics">
                    <MetricCard
                      title="Contratos Venda"
                      value={String(dashboardMetrics.contratosVenda)}
                      change={`de ${dashboardMetrics.contratosTotal} total`}
                      icon={FileText}
                      delay={0.24}
                    />
                    <MetricCard
                      title="Contratos Aluguel"
                      value={String(dashboardMetrics.contratosAluguel)}
                      change={`de ${dashboardMetrics.contratosTotal} total`}
                      icon={FileText}
                      delay={0.26}
                    />
                    <MetricCard
                      title="Conversão"
                      value={`${dashboardMetrics.conversao}%`}
                      change={`${dashboardMetrics.fechados} fechados`}
                      changeType="positive"
                      icon={TrendingUp}
                      delay={0.28}
                    />
                    <MetricCard
                      title="Leads quentes"
                      value={String(dashboardMetrics.quentes)}
                      change="Temperatura alta"
                      changeType={dashboardMetrics.quentes ? "positive" : "neutral"}
                      icon={Flame}
                      delay={0.3}
                    />
                  </div>
                  <div className="realty-metrics--3">
                    <MetricCard
                      title="Agenda hoje"
                      value={String(dashboardMetrics.visitasHoje)}
                      change="Visitas / compromissos"
                      changeType={dashboardMetrics.visitasHoje ? "negative" : "neutral"}
                      icon={CalendarDays}
                      delay={0.32}
                    />
                    <MetricCard
                      title="Propostas abertas"
                      value={String(dashboardMetrics.propostasAbertas)}
                      change="Em negociação"
                      icon={FileText}
                      delay={0.34}
                    />
                    <MetricCard
                      title="Sem corretor"
                      value={String(dashboardMetrics.semCorretor)}
                      change="Aguardando distribuição"
                      changeType={dashboardMetrics.semCorretor ? "negative" : "positive"}
                      icon={UserX}
                      delay={0.36}
                    />
                  </div>
                </div>
                <div className="realty-card realty-dash-section">
                  <h3>Funil por estágio</h3>
                  <div className="pipeline-crm__funnel">
                    {dashboardMetrics.porEstagio.map((s) => (
                      <div key={s.key} className="pipeline-crm__funnel-row">
                        <span
                          className="pipeline-crm__dot"
                          style={{ background: s.color || "#2673d9" }}
                        />
                        <span className="pipeline-crm__funnel-label">{s.label}</span>
                        <strong>{s.count}</strong>
                        <span className="pipeline-crm__funnel-valor">
                          {formatBRL(s.valor)}
                        </span>
                        <div className="pipeline-crm__bar-track">
                          <div
                            className="pipeline-crm__bar-fill"
                            style={{
                              width: `${
                                dashboardMetrics.total
                                  ? (s.count / dashboardMetrics.total) * 100
                                  : 0
                              }%`,
                              background: s.color || "#2673d9",
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="realty-card" style={{ marginTop: 16 }}>
                  <h3>ROI / volume por canal de origem</h3>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {dashboardMetrics.canalRows.map((r) => (
                      <span key={r.canal} className="realty-chip">
                        {r.canal}: {r.count}
                      </span>
                    ))}
                    {!dashboardMetrics.canalRows.length && <span>Sem dados de canal.</span>}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {selectedLead && (
          <div className="realty-modal-backdrop" onClick={() => setSelectedLead(null)}>
            <div className="realty-card realty-modal" onClick={(e) => e.stopPropagation()}>
              <h3>Imóveis para {selectedLead.name}</h3>
              {matches.length === 0 ? (
                <p>
                  Nenhum match. Cadastre imóveis com cidade/tipo próximos ao interesse do
                  lead.
                </p>
              ) : (
                <>
                  {matches.map((m) => (
                    <div key={m.imovelId} className="realty-lead" style={{ marginTop: 8 }}>
                      <strong>
                        {m.imovel?.title || `Imóvel #${m.imovelId}`} · score {m.score}
                      </strong>
                      <span>{(m.reasons || []).join(", ")}</span>
                      <button
                        type="button"
                        className="realty-page__btn"
                        style={{ marginTop: 8 }}
                        onClick={() => vincular(m.imovelId)}
                      >
                        Vincular
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="realty-page__btn"
                    style={{ marginTop: 16, width: "100%" }}
                    onClick={enviarWhatsApp}
                  >
                    Enviar opções no WhatsApp
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {pendingPerdido && (
          <div className="realty-modal-backdrop" onClick={() => setPendingPerdido(null)}>
            <div className="realty-card realty-modal" onClick={(e) => e.stopPropagation()}>
              <h3>Motivo da perda — {pendingPerdido.name}</h3>
              <div className="realty-form">
                <select value={motivoPerda} onChange={(e) => setMotivoPerda(e.target.value)}>
                  <option value="">Selecione o motivo</option>
                  {MOTIVOS_PERDA.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <textarea
                  rows={3}
                  placeholder="Detalhe (opcional)"
                  value={motivoDetalhe}
                  onChange={(e) => setMotivoDetalhe(e.target.value)}
                />
                <div className="realty-card__actions">
                  <button
                    type="button"
                    className="realty-page__btn realty-page__btn--ghost"
                    onClick={() => setPendingPerdido(null)}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="realty-page__btn"
                    disabled={!motivoPerda}
                    onClick={confirmPerdido}
                  >
                    Confirmar perdido
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {importOpen && (
          <div className="realty-modal-backdrop" onClick={() => setImportOpen(false)}>
            <div className="realty-card realty-modal" onClick={(e) => e.stopPropagation()}>
              <h3>Importar / Exportar</h3>
              <p>Cole uma linha por lead: Nome;Telefone;Email;Valor</p>
              <textarea
                rows={8}
                style={{ width: "100%" }}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder={"Maria Silva;(11) 99999-0000;maria@email.com;450000"}
              />
              <div className="realty-card__actions" style={{ marginTop: 12 }}>
                <button
                  type="button"
                  className="realty-page__btn realty-page__btn--ghost"
                  onClick={exportExcel}
                >
                  Baixar Excel
                </button>
                <button type="button" className="realty-page__btn" onClick={handleImport}>
                  Importar
                </button>
              </div>
            </div>
          </div>
        )}

        <PipelineLeadFormDialog
          open={openCreate}
          onClose={() => {
            setOpenCreate(false);
            setEditLead(null);
          }}
          lead={editLead}
          defaultEstagio={defaultEstagio}
          stages={stages}
          users={users}
          pipelineId={pipelineId}
          canAssignCorretor={isMaster || user?.profile === "admin"}
          onSaved={() => load()}
        />

        <PipelineEstagiosDialog
          open={editarPipelineOpen}
          onClose={() => setEditarPipelineOpen(false)}
          pipeline={pipeline}
          onSaved={async () => {
            await loadPipelinesAndUsers();
            await load();
          }}
        />

        <TransferLeadsDialog
          open={transferOpen}
          onClose={() => setTransferOpen(false)}
          leads={filteredLeads}
          users={users}
          onDone={() => load()}
        />
      </ActivitiesStyleLayout>
    </>
  );
};

export default LeadsSales;
