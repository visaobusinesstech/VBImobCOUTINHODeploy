/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 *
 * Contratos — gestão completa (layout Lovable + design VBSolution).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  FileSignature,
  Clock,
  CheckCircle,
  AlertTriangle,
  Plus,
  Edit,
  Trash2,
  Loader2,
  Camera,
  Video,
  Shield,
  XCircle,
  Download,
  Filter,
  X,
  FileText,
  CalendarClock,
  Search,
  TrendingUp,
  Power,
  PowerOff,
  Pen,
  FileSpreadsheet,
  ShieldAlert,
  ClipboardCheck,
  Upload,
  Brain,
  Bell,
} from "lucide-react";
import * as XLSX from "xlsx";
import MainContainer from "../../components/MainContainer";
import ContratoFormDialog from "../../components/contratos/ContratoFormDialog";
import ImportContratosDialog from "../../components/contratos/ImportContratosDialog";
import ContratoFileViewerDialog from "../../components/contratos/ContratoFileViewerDialog";
import realtyService from "../../services/realtyService";
import {
  STATUS_CONTRATO,
  getCanalLabel,
  getDocCompleteness,
  formatBRL,
  mediaUrl,
  normalizeContratoStatus,
} from "../../helpers/realtyCrm";
import {
  buildContratoExportRows,
  CONTRATO_EXPORT_COLUMNS,
} from "../../helpers/contratosSpreadsheet";
import {
  getContratoFileName,
  getContratoFilePreviewKind,
  buildContratoOfficePreviewUrl,
} from "../../helpers/contratoFilePreview";
import toastError from "../../errors/toastError";
import { toast } from "react-toastify";
import { useUserUiPreferences } from "../../hooks/useUserUiPreferences";

const formatDate = (d) => {
  if (!d) return "—";
  const raw = String(d).slice(0, 10);
  return new Date(`${raw}T00:00:00`).toLocaleDateString("pt-BR");
};

const STATUS_CONFIG = {
  assinado: { icon: CheckCircle, color: "#15803d", bg: "#dcfce7", label: "Assinado" },
  ativo: { icon: Power, color: "#15803d", bg: "#dcfce7", label: "Ativo" },
  inativo: { icon: PowerOff, color: "#64748b", bg: "#f1f5f9", label: "Inativo" },
  aguardando: { icon: Clock, color: "#b45309", bg: "#fef3c7", label: "Aguardando" },
  rascunho: { icon: FileSignature, color: "#1e4bb8", bg: "#e8f0fc", label: "Rascunho" },
  vencendo: { icon: AlertTriangle, color: "#dc2626", bg: "#fee2e2", label: "Vencendo" },
  cancelado: { icon: XCircle, color: "#64748b", bg: "#f1f5f9", label: "Cancelado" },
};

const TABS = [
  { id: "todos", label: "Todos", icon: FileSignature },
  { id: "venda", label: "Venda", icon: FileSignature },
  { id: "locacao", label: "Locação", icon: Shield },
  { id: "ranking", label: "Ranking Canais", icon: TrendingUp },
  { id: "credito", label: "Restrição CPF", icon: ShieldAlert, soon: true },
  { id: "assinatura", label: "Assinatura Digital", icon: Pen, soon: true },
  { id: "analise_inquilino", label: "Análise Inquilino", icon: Brain, soon: true },
];

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const d = new Date(`${String(dateStr).slice(0, 10)}T00:00:00`);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - now.getTime()) / 86400000);
}

function normSearch(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function digitsOnly(s) {
  return String(s || "").replace(/\D/g, "");
}

function isVendaTipo(tipo) {
  return tipo === "Venda" || tipo === "Exclusividade" || tipo === "Exclusividade (Venda)";
}

function isLocacaoTipo(tipo) {
  return tipo === "Locação" || tipo === "Administração" || tipo === "Administração de Imóveis";
}

const DocStatusBadge = ({ contrato }) => {
  const { done, total, missing } = getDocCompleteness(contrato);
  const allDone = missing.length === 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const tone = allDone ? "ok" : pct >= 60 ? "warn" : "bad";
  return (
    <span
      title={allDone ? "Documentação completa" : `Pendente: ${missing.join(", ")}`}
      className={`realty-contrato-doc-badge is-${tone}`}
    >
      <ClipboardCheck size={12} />
      {done}/{total}
    </span>
  );
};

const MetricsSummary = ({ items }) => {
  if (!items.length) return null;

  const total = items.length;
  const ativos = items.filter((c) => {
    const s = normalizeContratoStatus(c.status);
    return s === "ativo" || s === "assinado";
  }).length;
  const inativos = items.filter((c) => normalizeContratoStatus(c.status) === "inativo").length;
  const aguardando = items.filter((c) => normalizeContratoStatus(c.status) === "aguardando").length;
  const rascunhos = items.filter((c) => normalizeContratoStatus(c.status) === "rascunho").length;

  const contratosVendaList = items.filter((c) => isVendaTipo(c.tipo));
  const contratosAluguelList = items.filter((c) => isLocacaoTipo(c.tipo));
  const valorVenda = contratosVendaList.reduce((s, c) => s + (Number(c.value) || 0), 0);
  const comissaoVenda = contratosVendaList.reduce((s, c) => s + (Number(c.comissaoValor) || 0), 0);
  const valorAluguel = contratosAluguelList.reduce((s, c) => s + (Number(c.value) || 0), 0);
  const comissaoAluguel = contratosAluguelList.reduce((s, c) => s + (Number(c.comissaoValor) || 0), 0);
  const comissaoTotal = items.reduce((s, c) => s + (Number(c.comissaoValor) || 0), 0);
  const corretorTotal = items.reduce((s, c) => s + (Number(c.corretorComissaoValor) || 0), 0);
  const parceiroCaptador = items.reduce(
    (s, c) => s + (Number(c.parceiroComissaoValor) || 0) + (Number(c.captadorComissaoValor) || 0),
    0
  );
  const liquidoImob = comissaoTotal - corretorTotal - parceiroCaptador;

  const chartData = [
    ...(valorVenda > 0 || comissaoVenda > 0
      ? [{ name: "Venda", valor: valorVenda, comissao: comissaoVenda }]
      : []),
    ...(valorAluguel > 0 || comissaoAluguel > 0
      ? [{ name: "Aluguel", valor: valorAluguel, comissao: comissaoAluguel }]
      : []),
  ];

  const chartVendaContratos = contratosVendaList
    .filter((c) => (Number(c.value) || 0) > 0 || (Number(c.comissaoValor) || 0) > 0)
    .slice(0, 10)
    .map((c) => ({
      name: (c.title || "—").length > 15 ? `${(c.title || "").slice(0, 15)}…` : c.title || "—",
      valor: Number(c.value) || 0,
      comissao: Number(c.comissaoValor) || 0,
    }));

  const vencendoContratos = items.filter((c) => {
    const d = daysUntil(c.endDate);
    return d !== null && d >= 0 && d <= 30;
  });
  const vencendoApolices = items.filter((c) => {
    const d = daysUntil(c.dataVencimentoApolice);
    return d !== null && d >= 0 && d <= 30;
  });

  const metrics = [
    { label: "Total", value: String(total) },
    { label: "Contratos Venda", value: String(contratosVendaList.length), tone: "primary" },
    { label: "Contratos Aluguel", value: String(contratosAluguelList.length), tone: "info" },
    { label: "Ativos", value: String(ativos), tone: "ok" },
    { label: "Inativos", value: String(inativos) },
    { label: "Aguardando", value: String(aguardando), tone: "warn" },
    { label: "Rascunhos", value: String(rascunhos), tone: "info" },
    { label: "Valor Venda", value: formatBRL(valorVenda), tone: "primary" },
    { label: "Comissão Venda", value: formatBRL(comissaoVenda), tone: "ok" },
    { label: "Valor Aluguel", value: formatBRL(valorAluguel), tone: "info" },
    { label: "Comissão Aluguel", value: formatBRL(comissaoAluguel), tone: "ok" },
    { label: "Comissão Total", value: formatBRL(comissaoTotal), tone: "ok" },
    {
      label: "Líquido Imob.",
      value: formatBRL(liquidoImob),
      tone: liquidoImob >= 0 ? "ok" : "bad",
    },
  ];

  return (
    <div className="realty-contrato-metrics-block">
      {(vencendoContratos.length > 0 || vencendoApolices.length > 0) && (
        <div className="realty-contrato-alert-grid">
          {vencendoContratos.length > 0 && (
            <div className="realty-contrato-alert-card is-danger">
              <h4>
                <Bell size={12} /> Contratos vencendo (próximos 30 dias)
              </h4>
              <ul>
                {vencendoContratos.slice(0, 3).map((c) => (
                  <li key={c.id}>
                    <span>{c.title}</span>
                    <em>{daysUntil(c.endDate)} dias</em>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {vencendoApolices.length > 0 && (
            <div className="realty-contrato-alert-card is-warn">
              <h4>
                <ShieldAlert size={12} /> Apólices vencendo (próximos 30 dias)
              </h4>
              <ul>
                {vencendoApolices.slice(0, 3).map((c) => (
                  <li key={c.id}>
                    <span>{c.title}</span>
                    <em>{daysUntil(c.dataVencimentoApolice)} dias</em>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="realty-contrato-metrics">
        {metrics.map((m) => (
          <div key={m.label} className={`realty-contrato-metric${m.tone ? ` is-${m.tone}` : ""}`}>
            <span>{m.label}</span>
            <strong>{m.value}</strong>
          </div>
        ))}
      </div>

      {chartData.length > 0 && (
        <div className="realty-contrato-charts">
          <div className="realty-contrato-chart-card">
            <h4>Valor vs Comissão por Tipo</h4>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} barGap={8}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e6ee" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#737d8c" }} />
                <YAxis
                  tick={{ fontSize: 10, fill: "#737d8c" }}
                  tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip formatter={(v) => formatBRL(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="valor" name="Valor Total" fill="#2673d9" radius={[4, 4, 0, 0]} />
                <Bar dataKey="comissao" name="Comissão" fill="#16a34a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {chartVendaContratos.length > 0 && (
            <div className="realty-contrato-chart-card">
              <h4>Valor vs Comissão por Contrato (Venda)</h4>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartVendaContratos} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e6ee" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 9, fill: "#737d8c" }}
                    angle={-20}
                    textAnchor="end"
                    height={50}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#737d8c" }}
                    tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip formatter={(v) => formatBRL(v)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="valor" name="Valor Venda" fill="#2673d9" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="comissao" name="Comissão" fill="#16a34a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const Contratos = () => {
  const { getPref, setPref, ready } = useUserUiPreferences();
  const [contratos, setContratos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState("todos");
  const [filterTipo, setFilterTipo] = useState("todos");
  const [filterPeriodo, setFilterPeriodo] = useState("todos");
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("todos");
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerFile, setViewerFile] = useState(null);
  const didInitialRenderRef = useRef(false);

  useEffect(() => {
    didInitialRenderRef.current = true;
  }, []);

  useEffect(() => {
    if (!ready) return;
    setActiveTab(getPref("contratos_active_tab", "todos"));
  }, [ready, getPref]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await realtyService.listContratos({ pageSize: 500 });
      setContratos(data.contratos || []);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const hasActiveFilters =
    filterStatus !== "todos" || filterTipo !== "todos" || filterPeriodo !== "todos";

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setPref("contratos_active_tab", tab);
  };

  const alertas = useMemo(() => {
    const items = [];
    contratos.forEach((c) => {
      if (normalizeContratoStatus(c.status) === "cancelado") return;

      const diasContrato = daysUntil(c.endDate);
      if (diasContrato !== null && diasContrato >= 0 && diasContrato <= 30) {
        items.push({
          contrato: c,
          tipo: "contrato",
          dias: diasContrato,
          mensagem: `Contrato "${c.title}" vence em ${diasContrato} dias (${formatDate(c.endDate)})`,
        });
      }

      const diasApolice = daysUntil(c.dataVencimentoApolice);
      if (diasApolice !== null && diasApolice >= 0 && diasApolice <= 30) {
        items.push({
          contrato: c,
          tipo: "apolice",
          dias: diasApolice,
          mensagem: `Apólice de "${c.title}" vence em ${diasApolice} dias`,
        });
      }
    });
    return items.sort((a, b) => a.dias - b.dias);
  }, [contratos]);

  const filtered = useMemo(() => {
    let result = contratos;

    if (searchQuery.trim()) {
      const q = normSearch(searchQuery);
      const qDigits = digitsOnly(q);
      result = result.filter((c) => {
        const phoneMatch =
          qDigits.length > 0 &&
          [
            c.proprietarioTelefone,
            c.inquilinoTelefone,
            c.clienteTelefone,
            c.fiadorTelefone,
          ].some((p) => digitsOnly(p).includes(qDigits));
        const cpfMatch =
          qDigits.length > 0 &&
          [c.proprietarioCpf, c.inquilinoCpf, c.clienteCpf, c.fiadorCpf].some((p) =>
            digitsOnly(p).includes(qDigits)
          );
        return (
          normSearch(c.title).includes(q) ||
          normSearch(c.cliente).includes(q) ||
          normSearch(c.inquilino).includes(q) ||
          normSearch(c.proprietario).includes(q) ||
          normSearch(c.corretorNome).includes(q) ||
          normSearch(c.fiadorNome).includes(q) ||
          normSearch(c.parceiroNome).includes(q) ||
          normSearch(c.captadorNome).includes(q) ||
          normSearch(c.notes).includes(q) ||
          normSearch(c.matricula).includes(q) ||
          normSearch(c.numeroAgua).includes(q) ||
          normSearch(c.numeroLuz).includes(q) ||
          normSearch(c.inscricaoIptu).includes(q) ||
          normSearch(c.numeroUnidade).includes(q) ||
          normSearch(c.codigoContrato).includes(q) ||
          phoneMatch ||
          cpfMatch
        );
      });
    }

    if (filterStatus !== "todos") {
      result = result.filter((c) => normalizeContratoStatus(c.status) === filterStatus);
    }
    if (filterTipo !== "todos") {
      result = result.filter((c) => c.tipo === filterTipo);
    }
    if (filterPeriodo !== "todos") {
      const now = new Date();
      result = result.filter((c) => {
        if (!c.startDate) return false;
        const d = new Date(`${String(c.startDate).slice(0, 10)}T00:00:00`);
        if (filterPeriodo === "30d") return now.getTime() - d.getTime() <= 30 * 86400000;
        if (filterPeriodo === "90d") return now.getTime() - d.getTime() <= 90 * 86400000;
        if (filterPeriodo === "ano") return d.getFullYear() === now.getFullYear();
        return true;
      });
    }

    return result;
  }, [contratos, filterStatus, filterTipo, filterPeriodo, searchQuery]);

  const vendas = useMemo(() => filtered.filter((c) => c.tipo === "Venda"), [filtered]);
  const locacoes = useMemo(() => filtered.filter((c) => c.tipo === "Locação"), [filtered]);

  const rankingCanais = useMemo(() => {
    const map = new Map();
    contratos.forEach((c) => {
      const canal = c.canalOrigem || "nao_informado";
      const existing = map.get(canal) || { count: 0, valor: 0 };
      map.set(canal, {
        count: existing.count + 1,
        valor: existing.valor + (Number(c.value) || 0),
      });
    });
    return Array.from(map.entries())
      .map(([canal, data]) => ({
        canal,
        label: canal === "nao_informado" ? "Não informado" : getCanalLabel(canal),
        ...data,
      }))
      .sort((a, b) => b.count - a.count);
  }, [contratos]);

  const openCreate = () => {
    setEditItem(null);
    setFormOpen(true);
  };

  const openEdit = (contrato) => {
    setEditItem(contrato);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditItem(null);
  };

  const handleSave = async (payload) => {
    setSaving(true);
    try {
      if (editItem?.id) {
        await realtyService.updateContrato(editItem.id, payload);
        toast.success("Contrato atualizado");
      } else {
        await realtyService.createContrato(payload);
        toast.success("Contrato cadastrado");
      }
      closeForm();
      await load();
    } catch (err) {
      toastError(err);
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (c) => {
    const current = normalizeContratoStatus(c.status);
    const newStatus = current === "inativo" ? "ativo" : "inativo";
    try {
      await realtyService.updateContrato(c.id, { status: newStatus });
      toast.success(newStatus === "inativo" ? "Contrato inativado" : "Contrato ativado");
      await load();
    } catch (err) {
      toastError(err);
    }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    try {
      await realtyService.deleteContrato(deleteItem.id);
      toast.success("Contrato excluído");
      setDeleteItem(null);
      await load();
    } catch (err) {
      toastError(err);
    }
  };

  const openAnexo = (pathOrUrl, fileName) => {
    if (!pathOrUrl) return;
    setViewerLoading(true);
    setViewerOpen(true);
    const resolved = mediaUrl(pathOrUrl);
    const previewKind = getContratoFilePreviewKind(resolved);
    setViewerFile({
      url: resolved,
      name: fileName || getContratoFileName(resolved, "Anexo"),
      previewKind,
      officePreviewUrl:
        previewKind === "office" ? buildContratoOfficePreviewUrl(resolved) : undefined,
    });
    setViewerLoading(false);
  };

  const closeViewer = () => {
    setViewerOpen(false);
    setViewerFile(null);
    setViewerLoading(false);
  };

  const handleExportExcel = () => {
    if (filtered.length === 0) {
      toast.error("Nenhum contrato para exportar");
      return;
    }
    try {
      const rows = buildContratoExportRows(filtered);
      const sheetRows = rows.map((row) => {
        const mapped = {};
        CONTRATO_EXPORT_COLUMNS.forEach((col) => {
          mapped[col.header] = row[col.key];
        });
        return mapped;
      });
      const sheet = XLSX.utils.json_to_sheet(sheetRows);
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, sheet, "Contratos");
      XLSX.writeFile(book, `Contratos_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success(
        `${filtered.length} contrato${filtered.length > 1 ? "s" : ""} exportado${
          filtered.length > 1 ? "s" : ""
        }!`
      );
    } catch (err) {
      toastError(err);
    }
  };

  const handleExportPdf = () => {
    if (filtered.length === 0) {
      toast.error("Nenhum contrato para exportar");
      return;
    }
    const rows = filtered
      .map((c) => {
        const status = STATUS_CONFIG[normalizeContratoStatus(c.status)] || STATUS_CONFIG.rascunho;
        return `<tr>
          <td>${c.title || "—"}</td>
          <td>${c.cliente || "—"}</td>
          <td>${c.tipo || "—"}</td>
          <td>${status.label}</td>
          <td>${formatBRL(c.value)}</td>
          <td>${formatDate(c.startDate)}</td>
          <td>${formatDate(c.endDate)}</td>
        </tr>`;
      })
      .join("");
    const win = window.open("", "_blank", "noopener,noreferrer,width=980,height=720");
    if (!win) {
      toast.error("Permita pop-ups para imprimir o PDF");
      return;
    }
    win.document.write(`<!DOCTYPE html><html><head><title>Contratos</title>
      <style>
        body{font-family:"Plus Jakarta Sans",Inter,Arial,sans-serif;color:#2b3340;padding:24px}
        h1{font-size:20px;margin:0 0 4px;color:#2673d9}
        .sub{color:#737d8c;font-size:12px;margin-bottom:16px}
        table{width:100%;border-collapse:collapse;font-size:12px}
        th,td{border:1px solid #e2e6ee;padding:8px;text-align:left}
        th{background:#f7f9fc}
      </style></head><body>
      <h1>Relatório de Contratos</h1>
      <div class="sub">${filtered.length} contratos · Gerado em ${new Date().toLocaleDateString("pt-BR")}</div>
      <table><thead><tr>
        <th>Título</th><th>Cliente</th><th>Tipo</th><th>Status</th><th>Valor</th><th>Início</th><th>Fim</th>
      </tr></thead><tbody>${rows}</tbody></table>
      </body></html>`);
    win.document.close();
    setTimeout(() => {
      win.focus();
      win.print();
    }, 250);
  };

  const handleImport = async (items) => {
    let success = 0;
    let errors = 0;
    const BATCH_SIZE = 10;

    for (let index = 0; index < items.length; index += BATCH_SIZE) {
      const batch = items.slice(index, index + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((item) => realtyService.createContrato(item))
      );
      results.forEach((result) => {
        if (result.status === "fulfilled" && result.value) success += 1;
        else errors += 1;
      });
    }

    if (success > 0) await load();
    return { success, errors };
  };

  const getMotion = (i, axis = "y") => {
    if (didInitialRenderRef.current) {
      return { initial: false, animate: { opacity: 1, x: 0, y: 0 }, transition: { duration: 0 } };
    }
    return {
      initial: { opacity: 0, [axis]: axis === "x" ? -16 : 16 },
      animate: { opacity: 1, x: 0, y: 0 },
      transition: { delay: Math.min(i * 0.03, 0.3) },
    };
  };

  const renderActions = (c) => {
    const status = normalizeContratoStatus(c.status);
    return (
      <div className="realty-contrato-card__actions">
        <button
          type="button"
          title={status === "inativo" ? "Ativar contrato" : "Inativar contrato"}
          className={status === "inativo" ? "is-muted" : "is-ok"}
          onClick={() => toggleStatus(c)}
        >
          {status === "inativo" ? <PowerOff size={14} /> : <Power size={14} />}
        </button>
        <button type="button" title="Editar" onClick={() => openEdit(c)}>
          <Edit size={14} />
        </button>
        <button type="button" title="Excluir" onClick={() => setDeleteItem(c)}>
          <Trash2 size={14} />
        </button>
      </div>
    );
  };

  const renderContratoRow = (c, i) => {
    const statusKey = normalizeContratoStatus(c.status);
    const config = STATUS_CONFIG[statusKey] || STATUS_CONFIG.rascunho;
    const StatusIcon = config.icon;
    const hasAnexo = c.contratoAnexoUrl || c.apoliceAnexoUrl || c.vistoriaAnexoUrl;

    return (
      <motion.article key={c.id} {...getMotion(i, "x")} className="realty-contrato-row">
        <div
          className="realty-contrato-row__icon"
          style={{ background: config.bg, color: config.color }}
        >
          <StatusIcon size={18} />
        </div>
        <div className="realty-contrato-row__body">
          <div className="realty-contrato-row__title">
            <h3>
              {c.title}
              {c.numeroUnidade ? ` · Unid. ${c.numeroUnidade}` : ""}
            </h3>
            {c.codigoContrato ? (
              <span className="realty-chip">{c.codigoContrato}</span>
            ) : null}
            {hasAnexo ? <FileText size={14} style={{ color: "#2673d9" }} /> : null}
            <DocStatusBadge contrato={c} />
          </div>
          <p>
            {c.cliente || "—"} · {formatDate(c.startDate)}
            {c.corretorNome ? ` · ${c.corretorNome}` : ""}
            {c.canalOrigem ? ` · ${getCanalLabel(c.canalOrigem)}` : ""}
          </p>
          {(Number(c.comissaoValor) || 0) > 0 && (
            <p className="realty-contrato-row__money">
              Comissão: {formatBRL(c.comissaoValor)} ({c.comissaoPercentual || 0}%)
              {(Number(c.corretorComissaoValor) || 0) > 0
                ? ` · Corretor: ${formatBRL(c.corretorComissaoValor)}`
                : ""}
            </p>
          )}
          {(c.numeroAgua || c.numeroLuz || c.inscricaoIptu) && (
            <p className="realty-contrato-row__meta">
              {[
                c.numeroAgua ? `Água: ${c.numeroAgua}` : null,
                c.numeroLuz ? `Luz: ${c.numeroLuz}` : null,
                c.inscricaoIptu ? `IPTU: ${c.inscricaoIptu}` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
          {(c.contratoAnexoUrl || c.apoliceAnexoUrl || c.vistoriaAnexoUrl) && (
            <div className="realty-contrato-anexos">
              {c.contratoAnexoUrl && (
                <button
                  type="button"
                  onClick={() => openAnexo(c.contratoAnexoUrl, `${c.title} - contrato`)}
                >
                  <FileText size={12} /> Contrato
                </button>
              )}
              {c.apoliceAnexoUrl && (
                <button
                  type="button"
                  onClick={() => openAnexo(c.apoliceAnexoUrl, `${c.title} - apólice`)}
                >
                  <FileText size={12} /> Apólice
                </button>
              )}
              {c.vistoriaAnexoUrl && (
                <button
                  type="button"
                  onClick={() => openAnexo(c.vistoriaAnexoUrl, `${c.title} - vistoria`)}
                >
                  <FileText size={12} /> Vistoria
                </button>
              )}
            </div>
          )}
        </div>
        <strong className="realty-contrato-row__value">{formatBRL(c.value)}</strong>
        <span
          className="realty-contrato-status"
          style={{ background: config.bg, color: config.color }}
        >
          {config.label}
        </span>
        {renderActions(c)}
      </motion.article>
    );
  };

  const renderLocacaoCard = (c, i) => {
    const statusKey = normalizeContratoStatus(c.status);
    const config = STATUS_CONFIG[statusKey] || STATUS_CONFIG.rascunho;
    const liquido = (Number(c.value) || 0) - (Number(c.comissaoValor) || 0);

    return (
      <motion.article key={c.id} {...getMotion(i, "y")} className="realty-contrato-card">
        <div className="realty-contrato-card__head">
          <div>
            <h3>{c.title}</h3>
            {c.codigoContrato ? (
              <span className="realty-chip">{c.codigoContrato}</span>
            ) : null}
            <DocStatusBadge contrato={c} />
            <p>
              {c.inquilino || c.cliente || "—"} · {formatBRL(c.value)}/mês · Venc. dia{" "}
              {c.diaVencimentoAluguel || 10} · {formatDate(c.startDate)} a {formatDate(c.endDate)}
              {c.corretorNome ? ` · ${c.corretorNome}` : ""}
            </p>
            {(Number(c.comissaoValor) || 0) > 0 && (
              <p className="realty-contrato-row__money">
                Líquido: {formatBRL(liquido)} · Comissão: {formatBRL(c.comissaoValor)} (
                {c.comissaoPercentual || 0}%)
              </p>
            )}
            {c.matricula && (
              <p className="realty-contrato-row__meta">
                Matrícula: {c.matricula} · Correção: {c.indiceCorrecao || "IGP-M"}{" "}
                {c.percentualCorrecao || 0}%
              </p>
            )}
          </div>
          <div className="realty-contrato-card__head-right">
            <span
              className="realty-contrato-status"
              style={{ background: config.bg, color: config.color }}
            >
              {config.label}
            </span>
            {renderActions(c)}
          </div>
        </div>

        <div className="realty-contrato-tiles">
          <div className={`realty-contrato-tile${c.vistoriaEntrada ? " is-done" : ""}`}>
            <Camera size={18} />
            <span>Vistoria</span>
            <em>{c.vistoriaEntrada ? "✓ Realizada" : "Pendente"}</em>
          </div>
          <div className={`realty-contrato-tile${c.vistoriaVideo ? " is-done" : ""}`}>
            <Video size={18} />
            <span>Vídeo</span>
            <em>{c.vistoriaVideo ? "✓ Enviado" : "Pendente"}</em>
          </div>
          <div className={`realty-contrato-tile${c.apoliceSeguro ? " is-done" : ""}`}>
            <Shield size={18} />
            <span>Seguro</span>
            <em>{c.apoliceSeguro ? "✓ Ativa" : "Pendente"}</em>
          </div>
        </div>

        {(c.contratoAnexoUrl || c.apoliceAnexoUrl || c.vistoriaAnexoUrl) && (
          <div className="realty-contrato-anexos">
            {c.contratoAnexoUrl && (
              <button
                type="button"
                onClick={() => openAnexo(c.contratoAnexoUrl, `${c.title} - contrato`)}
              >
                <FileText size={12} /> Contrato
              </button>
            )}
            {c.apoliceAnexoUrl && (
              <button
                type="button"
                onClick={() => openAnexo(c.apoliceAnexoUrl, `${c.title} - apólice`)}
              >
                <FileText size={12} /> Apólice
              </button>
            )}
            {c.vistoriaAnexoUrl && (
              <button
                type="button"
                onClick={() => openAnexo(c.vistoriaAnexoUrl, `${c.title} - vistoria`)}
              >
                <FileText size={12} /> Vistoria
              </button>
            )}
          </div>
        )}
      </motion.article>
    );
  };

  const renderEmpty = (message, cta) => (
    <div className="realty-empty">
      <FileSignature size={40} style={{ opacity: 0.35 }} />
      <p>{message}</p>
      {cta}
    </div>
  );

  const renderSoon = (Icon, title, description) => (
    <div className="realty-empty realty-contrato-soon">
      <Icon size={40} style={{ opacity: 0.35 }} />
      <h3>{title}</h3>
      <p>{description}</p>
      <span className="realty-chip">Em breve</span>
    </div>
  );

  const clearFilters = () => {
    setFilterStatus("todos");
    setFilterTipo("todos");
    setFilterPeriodo("todos");
  };

  return (
    <MainContainer autoHeight>
      <div className="realty-page realty-contrato-page">
        <div className="realty-carteira-header">
          <div>
            <div className="realty-carteira-eyebrow">Gestão Imobiliária</div>
            <h1 className="realty-page__title">Contratos</h1>
            <p className="realty-page__subtitle">
              {contratos.length} contrato{contratos.length !== 1 ? "s" : ""} · Vendas, locações e
              documentação.
            </p>
          </div>
          <div className="realty-carteira-actions">
            <button
              type="button"
              className="realty-page__btn realty-page__btn--ghost"
              disabled={!filtered.length}
              onClick={handleExportPdf}
            >
              <Download size={16} /> PDF
            </button>
            <button
              type="button"
              className="realty-page__btn realty-page__btn--ghost"
              disabled={!filtered.length}
              onClick={handleExportExcel}
            >
              <FileSpreadsheet size={16} /> Excel
            </button>
            <button
              type="button"
              className="realty-page__btn realty-page__btn--ghost"
              onClick={() => setImportOpen(true)}
            >
              <Upload size={16} /> Importar
            </button>
            <button
              type="button"
              className={`realty-page__btn${
                showFilters || hasActiveFilters ? "" : " realty-page__btn--ghost"
              }`}
              onClick={() => setShowFilters((v) => !v)}
            >
              <Filter size={14} /> Filtros
              {hasActiveFilters ? <span className="realty-carteira-badge">●</span> : null}
            </button>
            <button type="button" className="realty-page__btn" onClick={openCreate}>
              <Plus size={16} /> Novo Contrato
            </button>
          </div>
        </div>

        <div className="realty-search-wrap realty-contrato-search">
          <Search size={16} />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por título, cliente, inquilino, proprietário, corretor, CPF, telefone..."
          />
        </div>

        {alertas.length > 0 && (
          <div className="realty-contrato-banner-list">
            {alertas.slice(0, 5).map((a, i) => (
              <motion.div
                key={`${a.tipo}-${a.contrato.id}-${i}`}
                {...getMotion(i, "y")}
                className={`realty-contrato-banner${a.dias <= 3 ? " is-danger" : " is-warn"}`}
              >
                <CalendarClock size={16} />
                <span>{a.mensagem}</span>
                <button type="button" onClick={() => openEdit(a.contrato)}>
                  Ver
                </button>
              </motion.div>
            ))}
          </div>
        )}

        {showFilters && (
          <div className="realty-contrato-filters">
            <label className="realty-filter-field">
              Status
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                <option value="todos">Todos</option>
                {STATUS_CONTRATO.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="realty-filter-field">
              Tipo
              <select value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)}>
                <option value="todos">Todos</option>
                <option value="Venda">Venda</option>
                <option value="Locação">Locação</option>
              </select>
            </label>
            <label className="realty-filter-field">
              Período
              <select value={filterPeriodo} onChange={(e) => setFilterPeriodo(e.target.value)}>
                <option value="todos">Todos</option>
                <option value="30d">Últimos 30 dias</option>
                <option value="90d">Últimos 90 dias</option>
                <option value="ano">Este ano</option>
              </select>
            </label>
            {hasActiveFilters && (
              <button type="button" className="realty-contrato-clear" onClick={clearFilters}>
                <X size={12} /> Limpar
              </button>
            )}
          </div>
        )}

        <nav className="realty-carteira-tabs realty-contrato-tabs">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            let count = null;
            if (tab.id === "todos") count = filtered.length;
            if (tab.id === "venda") count = vendas.length;
            if (tab.id === "locacao") count = locacoes.length;
            return (
              <button
                key={tab.id}
                type="button"
                className={`realty-carteira-tab${activeTab === tab.id ? " is-active" : ""}`}
                onClick={() => handleTabChange(tab.id)}
              >
                <Icon size={14} />
                {tab.label}
                {count !== null ? ` (${count})` : ""}
              </button>
            );
          })}
        </nav>

        {loading ? (
          <div className="realty-empty">
            <Loader2 size={32} className="realty-imovel-spin" style={{ color: "#2673d9" }} />
            <p>Carregando contratos...</p>
          </div>
        ) : (
          <>
            {activeTab === "todos" && (
              <>
                <MetricsSummary items={filtered} />
                {filtered.length === 0
                  ? renderEmpty(
                      hasActiveFilters
                        ? "Nenhum contrato encontrado com esses filtros."
                        : "Nenhum contrato cadastrado ainda.",
                      hasActiveFilters ? (
                        <button
                          type="button"
                          className="realty-page__btn"
                          style={{ marginTop: 12 }}
                          onClick={clearFilters}
                        >
                          Limpar filtros
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="realty-page__btn"
                          style={{ marginTop: 12 }}
                          onClick={openCreate}
                        >
                          Criar primeiro contrato
                        </button>
                      )
                    )
                  : (
                    <div className="realty-contrato-list">{filtered.map(renderContratoRow)}</div>
                  )}
              </>
            )}

            {activeTab === "venda" && (
              <>
                <MetricsSummary items={vendas} />
                {vendas.length === 0
                  ? renderEmpty(
                      "Nenhum contrato de venda.",
                      <button
                        type="button"
                        className="realty-page__btn"
                        style={{ marginTop: 12 }}
                        onClick={openCreate}
                      >
                        Criar contrato de venda
                      </button>
                    )
                  : (
                    <div className="realty-contrato-list">{vendas.map(renderContratoRow)}</div>
                  )}
              </>
            )}

            {activeTab === "locacao" && (
              <>
                <MetricsSummary items={locacoes} />
                {locacoes.length === 0
                  ? renderEmpty(
                      "Nenhum contrato de locação.",
                      <button
                        type="button"
                        className="realty-page__btn"
                        style={{ marginTop: 12 }}
                        onClick={openCreate}
                      >
                        Criar contrato de locação
                      </button>
                    )
                  : (
                    <div className="realty-contrato-locacao-list">
                      {locacoes.map(renderLocacaoCard)}
                    </div>
                  )}
              </>
            )}

            {activeTab === "ranking" &&
              (rankingCanais.length === 0 ? (
                renderEmpty("Nenhum contrato cadastrado para gerar ranking.")
              ) : (
                <div className="realty-contrato-ranking">
                  <p className="realty-page__subtitle" style={{ marginBottom: 12 }}>
                    Ranking de contratos por canal de origem
                  </p>
                  {rankingCanais.map((item, i) => {
                    const maxCount = rankingCanais[0]?.count || 1;
                    const pct = Math.round((item.count / maxCount) * 100);
                    return (
                      <motion.div
                        key={item.canal}
                        {...getMotion(i, "x")}
                        className="realty-contrato-ranking-item"
                      >
                        <div className="realty-contrato-ranking-item__top">
                          <div className="realty-contrato-ranking-item__left">
                            <span className="realty-contrato-rank">{i + 1}º</span>
                            <div>
                              <strong>{item.label}</strong>
                              <p>
                                {item.count} contrato{item.count !== 1 ? "s" : ""} ·{" "}
                                {formatBRL(item.valor)}
                              </p>
                            </div>
                          </div>
                          <em>{item.count}</em>
                        </div>
                        <div className="realty-contrato-ranking-bar">
                          <motion.div
                            initial={didInitialRenderRef.current ? false : { width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={
                              didInitialRenderRef.current
                                ? { duration: 0 }
                                : { duration: 0.6, delay: i * 0.05 }
                            }
                          />
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ))}

            {activeTab === "credito" &&
              renderSoon(
                ShieldAlert,
                "Restrição CPF",
                "Consulta de restrição, score e pendências por contrato estará disponível em breve."
              )}

            {activeTab === "assinatura" &&
              renderSoon(
                Pen,
                "Assinatura Digital",
                "Envio de contratos para assinatura digital com validade jurídica em breve."
              )}

            {activeTab === "analise_inquilino" &&
              renderSoon(
                Brain,
                "Análise de Inquilino",
                "Análise de perfil, capacidade de pagamento e garantia com IA em breve."
              )}
          </>
        )}

        <ContratoFormDialog
          open={formOpen}
          onClose={closeForm}
          onOpenChange={(open) => {
            if (!open) closeForm();
            else setFormOpen(true);
          }}
          contrato={editItem}
          onSave={handleSave}
          saving={saving}
        />

        <ImportContratosDialog
          open={importOpen}
          onClose={() => setImportOpen(false)}
          onOpenChange={setImportOpen}
          onImport={handleImport}
        />

        <ContratoFileViewerDialog
          open={viewerOpen}
          loading={viewerLoading}
          file={viewerFile}
          onClose={closeViewer}
        />

        {deleteItem && (
          <div className="realty-modal-backdrop" onClick={() => setDeleteItem(null)}>
            <div
              className="realty-modal"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
            >
              <h2>Excluir contrato?</h2>
              <p className="realty-page__subtitle">
                Tem certeza que deseja excluir &quot;{deleteItem.title}&quot;? Esta ação não pode
                ser desfeita.
              </p>
              <div className="realty-imovel-dialog-actions">
                <button
                  type="button"
                  className="realty-page__btn realty-page__btn--ghost"
                  onClick={() => setDeleteItem(null)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="realty-page__btn realty-page__btn--danger"
                  onClick={handleDelete}
                >
                  Excluir
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainContainer>
  );
};

export default Contratos;
