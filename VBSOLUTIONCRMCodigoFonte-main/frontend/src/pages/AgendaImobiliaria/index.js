/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * Agenda Imobiliária — paridade funcional Lovable (inputs/opções/views).
 * Design: padrão VBSolution (realty-theme).
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Plus,
  Loader2,
  CalendarDays,
  List,
  CalendarRange,
  Filter,
  X,
  Home,
  Users,
  LayoutList,
  Clock,
  AlertTriangle,
  RefreshCw,
  UserPlus,
} from "lucide-react";
import { isPast, parseISO } from "date-fns";
import MainContainer from "../../components/MainContainer";
import realtyService from "../../services/realtyService";
import leadsSalesService from "../../services/leadsSalesService";
import api from "../../services/api";
import {
  TIPOS_COMPROMISSO,
  FOLLOWUP_AGENDA_TIPOS,
  COMPROMISSO_RESULTADO_OPTIONS,
} from "../../helpers/realtyCrm";
import toastError from "../../errors/toastError";
import { toast } from "react-toastify";
import AgendaCalendar from "./AgendaCalendar";
import AgendaWeek from "./AgendaWeek";
import AgendaList from "./AgendaList";
import PainelDoDia from "./PainelDoDia";
import CompromissoFormDialog from "./CompromissoFormDialog";
import FollowupAgendaDialog from "./FollowupAgendaDialog";
import RegistrarVisitaDialog from "./RegistrarVisitaDialog";
import "./agenda.css";

const FOLLOWUP_COLORS = {
  ligacao: "#22c55e",
  whatsapp: "#22c55e",
  email: "#0ea5e9",
  visita: "#7c3aed",
  reuniao: "#0ea5e9",
  outro: "#64748b",
};

const toDateStr = (iso) => {
  if (!iso) return "";
  const s = String(iso);
  if (s.length >= 10) return s.slice(0, 10);
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return "";
  }
};

const toIsoLocal = (dateStr, timeStr) => {
  if (!dateStr) return null;
  const t = timeStr || "09:00";
  return new Date(`${dateStr}T${t}:00`).toISOString();
};

const AgendaImobiliaria = () => {
  const [compromissos, setCompromissos] = useState([]);
  const [followups, setFollowups] = useState([]);
  const [leads, setLeads] = useState([]);
  const [corretores, setCorretores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [view, setView] = useState("list");
  const [tab, setTab] = useState("todos");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(undefined);
  const [filterTipo, setFilterTipo] = useState("all");
  const [filterCorretor, setFilterCorretor] = useState("all");
  const [filterLead, setFilterLead] = useState("all");

  const [compromissoOpen, setCompromissoOpen] = useState(false);
  const [editingCompromisso, setEditingCompromisso] = useState(null);
  const [followupOpen, setFollowupOpen] = useState(false);
  const [editingFollowup, setEditingFollowup] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [visitaDialogOpen, setVisitaDialogOpen] = useState(false);
  const [visitaTarget, setVisitaTarget] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, fRes, lRes, uRes] = await Promise.all([
        realtyService.listCompromissos({ pageSize: 500 }),
        realtyService.listFollowups({ pageSize: 500 }),
        leadsSalesService.list({ pageSize: 500 }),
        api.get("/users", { params: { searchParam: "" } }).catch(() => ({ data: {} })),
      ]);
      setCompromissos(cRes.compromissos || []);
      setFollowups(fRes.followups || []);
      setLeads(lRes.leads || []);
      const users = uRes?.data?.users || uRes?.data || [];
      setCorretores(Array.isArray(users) ? users : []);
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
    filterTipo !== "all" || filterCorretor !== "all" || filterLead !== "all";

  const allTipos = useMemo(() => {
    const tipos = new Set();
    compromissos.forEach((c) => tipos.add(c.tipo));
    followups.forEach((f) => tipos.add(f.type));
    return Array.from(tipos).filter(Boolean);
  }, [compromissos, followups]);

  const allLeads = useMemo(() => {
    const map = new Map();
    compromissos.forEach((c) => {
      if (c.leadSaleId && c.leadNome) map.set(String(c.leadSaleId), c.leadNome);
    });
    followups.forEach((f) => {
      if (f.leadSaleId && f.leadNome) map.set(String(f.leadSaleId), f.leadNome);
    });
    leads.forEach((l) => {
      if (l.id && l.name && !map.has(String(l.id))) map.set(String(l.id), l.name);
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [compromissos, followups, leads]);

  const filteredCompromissos = useMemo(() => {
    return compromissos.filter((c) => {
      if (tab === "visitas" && c.tipo !== "visita") return false;
      if (tab === "followups") return false;
      if (filterTipo !== "all" && c.tipo !== filterTipo) return false;
      if (filterCorretor !== "all" && String(c.userId) !== String(filterCorretor)) return false;
      if (filterLead !== "all" && String(c.leadSaleId) !== String(filterLead)) return false;
      return true;
    });
  }, [compromissos, filterTipo, filterCorretor, filterLead, tab]);

  const filteredFollowups = useMemo(() => {
    return followups.filter((f) => {
      if (tab === "visitas") return false;
      if (filterTipo !== "all" && f.type !== filterTipo) return false;
      if (filterCorretor !== "all") return false;
      if (filterLead !== "all" && String(f.leadSaleId) !== String(filterLead)) return false;
      return true;
    });
  }, [followups, filterTipo, filterCorretor, filterLead, tab]);

  const handleSaveCompromisso = async (data) => {
    setSaving(true);
    try {
      const payload = {
        title: data.title,
        description: data.description || null,
        tipo: data.tipo,
        dataInicio: data.dataInicio,
        dataFim: data.dataFim || null,
        local: data.local || null,
        leadSaleId: data.leadSaleId || null,
        userId: data.userId || null,
        lembreteWhatsapp: Boolean(data.lembreteWhatsapp),
        telefoneLembrete: data.telefoneLembrete || null,
        prioridade: data.prioridade || "media",
        emailCliente: data.emailCliente || null,
        googleMapsLink: data.googleMapsLink || null,
      };
      if (data.id) {
        await realtyService.updateCompromisso(data.id, payload);
        toast.success("Compromisso atualizado");
      } else {
        await realtyService.createCompromisso({ ...payload, status: "pendente" });
        toast.success("Compromisso agendado");
      }
      setCompromissoOpen(false);
      setEditingCompromisso(null);
      await load();
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveFollowup = async (data) => {
    setSaving(true);
    try {
      const payload = {
        leadSaleId: data.leadSaleId || null,
        contratoId: data.contratoId || null,
        type: data.type,
        scheduledAt: data.scheduledAt,
        notes: data.notes || null,
        result: data.result || null,
        status: data.status || "pendente",
      };
      if (data.id) {
        await realtyService.updateFollowup(data.id, payload);
        toast.success("Follow-up atualizado");
      } else {
        await realtyService.createFollowup(payload);
        toast.success("Follow-up agendado");
      }
      setFollowupOpen(false);
      setEditingFollowup(null);
      await load();
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (id, source) => {
    if (source === "compromisso") {
      const c = compromissos.find((x) => String(x.id) === String(id));
      if (c) {
        setEditingCompromisso(c);
        setCompromissoOpen(true);
      }
    } else {
      const f = followups.find((x) => String(x.id) === String(id));
      if (f) {
        setEditingFollowup(f);
        setFollowupOpen(true);
      }
    }
  };

  const handleComplete = async (id, source) => {
    try {
      if (source === "compromisso") {
        await realtyService.updateCompromisso(id, { status: "concluido" });
      } else {
        await realtyService.updateFollowup(id, {
          status: "concluido",
          completedAt: new Date().toISOString(),
        });
      }
      toast.success("Marcado como concluído");
      await load();
    } catch (err) {
      toastError(err);
    }
  };

  const handleRegistrarVisita = (c) => {
    setVisitaTarget(c);
    setVisitaDialogOpen(true);
  };

  const handleVisitaConfirm = async (data) => {
    if (!visitaTarget) return;
    try {
      await realtyService.updateCompromisso(visitaTarget.id, {
        status: "concluido",
        feedbackVisita: data.feedbackVisita,
        resultadoCliente: data.resultadoCliente,
      });
      toast.success("Visita registrada com sucesso");
      setVisitaTarget(null);
      setVisitaDialogOpen(false);
      await load();
    } catch (err) {
      toastError(err);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.source === "compromisso") {
        await realtyService.deleteCompromisso(deleteTarget.id);
      } else {
        await realtyService.deleteFollowup(deleteTarget.id);
      }
      toast.success("Removido");
      setDeleteTarget(null);
      await load();
    } catch (err) {
      toastError(err);
    }
  };

  const onRequestDelete = (id, source) => {
    if (source === "compromisso") {
      const c = compromissos.find((x) => String(x.id) === String(id));
      setDeleteTarget({ id, source, titulo: c?.title || "Item" });
    } else {
      const f = followups.find((x) => String(x.id) === String(id));
      setDeleteTarget({
        id,
        source,
        titulo: `Follow-up: ${f?.leadNome || "Item"}`,
      });
    }
  };

  const handleDropItem = async (itemId, source, newDate, newHour) => {
    try {
      if (source === "compromisso") {
        const c = compromissos.find((x) => String(x.id) === String(itemId));
        if (!c) return;
        const old = c.dataInicio ? String(c.dataInicio) : "";
        let oldMinutes = "00";
        try {
          const d = new Date(old);
          if (!Number.isNaN(d.getTime())) {
            oldMinutes = String(d.getMinutes()).padStart(2, "0");
          } else if (old.includes("T") && old.length >= 16) {
            oldMinutes = old.slice(14, 16);
          }
        } catch {
          /* keep 00 */
        }
        const newDataInicio = toIsoLocal(
          newDate,
          `${String(newHour).padStart(2, "0")}:${oldMinutes}`
        );
        await realtyService.updateCompromisso(itemId, { dataInicio: newDataInicio });
        toast.success(
          `Compromisso reagendado para ${newDate} às ${String(newHour).padStart(2, "0")}:${oldMinutes}`
        );
      } else {
        await realtyService.updateFollowup(itemId, {
          scheduledAt: toIsoLocal(newDate, "09:00"),
        });
        toast.success(`Follow-up reagendado para ${newDate}`);
      }
      await load();
    } catch (err) {
      toastError(err);
    }
  };

  const calendarItems = useMemo(() => {
    const cItems = filteredCompromissos.map((c) => {
      const info = TIPOS_COMPROMISSO.find((t) => t.id === c.tipo) || TIPOS_COMPROMISSO[5];
      return {
        id: `c-${c.id}`,
        titulo: c.title,
        tipo: c.tipo,
        data: c.dataInicio,
        color: info.color,
        source: "compromisso",
      };
    });
    const fItems = filteredFollowups.map((f) => ({
      id: `f-${f.id}`,
      titulo: `FU: ${f.leadNome || "Lead"}`,
      tipo: f.type,
      data: f.scheduledAt,
      color: FOLLOWUP_COLORS[f.type] || FOLLOWUP_COLORS.outro,
      source: "followup",
    }));
    return [...cItems, ...fItems];
  }, [filteredCompromissos, filteredFollowups]);

  const hoje = new Date().toISOString().split("T")[0];
  const pendentesC = filteredCompromissos.filter((c) => c.status === "pendente");
  const pendentesF = filteredFollowups.filter((f) => f.status === "pendente");
  const hojeTotalC = pendentesC.filter((c) => toDateStr(c.dataInicio) === hoje).length;
  const hojeTotalF = pendentesF.filter((f) => toDateStr(f.scheduledAt) === hoje).length;
  const hojeTotal = hojeTotalC + hojeTotalF;
  const atrasadosC = pendentesC.filter((c) => {
    if (!c.dataInicio) return false;
    try {
      return isPast(parseISO(String(c.dataInicio))) && toDateStr(c.dataInicio) !== hoje;
    } catch {
      return false;
    }
  }).length;
  const atrasadosF = pendentesF.filter((f) => {
    const d = toDateStr(f.scheduledAt);
    return d && d < hoje;
  }).length;
  const atrasadosTotal = atrasadosC + atrasadosF;

  const visitasPendentes = compromissos.filter(
    (c) => c.tipo === "visita" && c.status === "pendente"
  ).length;
  const followupsPendentes = followups.filter((f) => f.status === "pendente").length;

  const tipoLabel = (tipo) => {
    const t = TIPOS_COMPROMISSO.find((x) => x.id === tipo);
    if (t) return `${t.emoji} ${t.label}`;
    const fu = FOLLOWUP_AGENDA_TIPOS.find((x) => x.id === tipo);
    if (fu) return fu.label;
    return tipo;
  };

  const openCreate = () => {
    setEditingCompromisso(null);
    setCompromissoOpen(true);
  };

  const openCreateFollowup = () => {
    setEditingFollowup(null);
    setFollowupOpen(true);
  };

  const clearFilters = () => {
    setFilterTipo("all");
    setFilterCorretor("all");
    setFilterLead("all");
  };

  return (
    <MainContainer>
      <div className="realty-page agenda-page">
        <div className="realty-page__header">
          <div>
            <h1 className="realty-page__title">Agenda imobiliária</h1>
            <p className="realty-page__subtitle">
              Compromissos, visitas e follow-ups em um só lugar
            </p>
          </div>
          <div className="agenda-header-actions">
            <button
              type="button"
              className="realty-page__btn realty-page__btn--ghost"
              onClick={load}
              disabled={loading}
              title="Atualizar"
            >
              <RefreshCw size={16} className={loading ? "agenda-spin" : undefined} />
              Atualizar
            </button>
            <button
              type="button"
              className={`realty-page__btn${showFilters || hasActiveFilters ? "" : " realty-page__btn--ghost"}`}
              onClick={() => setShowFilters((v) => !v)}
            >
              <Filter size={16} /> Filtros{hasActiveFilters ? " ●" : ""}
            </button>
            <div className="agenda-view-toggle" role="group" aria-label="Visualização">
              <button
                type="button"
                className={view === "list" ? "is-active" : ""}
                onClick={() => setView("list")}
                title="Lista"
              >
                <List size={14} />
                <span>Lista</span>
              </button>
              <button
                type="button"
                className={view === "week" ? "is-active" : ""}
                onClick={() => setView("week")}
                title="Semana"
              >
                <CalendarRange size={14} />
                <span>Semana</span>
              </button>
              <button
                type="button"
                className={view === "calendar" ? "is-active" : ""}
                onClick={() => setView("calendar")}
                title="Mês"
              >
                <CalendarDays size={14} />
                <span>Mês</span>
              </button>
            </div>
            <button
              type="button"
              className="realty-page__btn realty-page__btn--ghost"
              onClick={openCreateFollowup}
            >
              <UserPlus size={16} /> Follow-up
            </button>
            <button type="button" className="realty-page__btn" onClick={openCreate}>
              <Plus size={16} /> Novo compromisso
            </button>
          </div>
        </div>

        <div className="agenda-kpi-grid">
          <motion.button
            type="button"
            className="agenda-kpi"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => {
              setTab("todos");
              setView("list");
              setSelectedDate(hoje);
            }}
          >
            <div className="agenda-kpi__head">
              <Clock size={16} /> Hoje
            </div>
            <strong>{hojeTotal}</strong>
            <span>pendentes para hoje</span>
          </motion.button>
          <motion.button
            type="button"
            className="agenda-kpi agenda-kpi--danger"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04 }}
            onClick={() => {
              setTab("todos");
              setView("list");
              setSelectedDate(undefined);
            }}
          >
            <div className="agenda-kpi__head">
              <AlertTriangle size={16} /> Atrasados
            </div>
            <strong>{atrasadosTotal}</strong>
            <span>precisam de atenção</span>
          </motion.button>
          <motion.button
            type="button"
            className="agenda-kpi"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            onClick={() => {
              setTab("visitas");
              setView("list");
            }}
          >
            <div className="agenda-kpi__head">
              <Home size={16} /> Visitas
            </div>
            <strong>{visitasPendentes}</strong>
            <span>visitas pendentes</span>
          </motion.button>
          <motion.button
            type="button"
            className="agenda-kpi"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            onClick={() => {
              setTab("followups");
              setView("list");
            }}
          >
            <div className="agenda-kpi__head">
              <Users size={16} /> Follow-ups
            </div>
            <strong>{followupsPendentes}</strong>
            <span>retornos pendentes</span>
          </motion.button>
        </div>

        <div className="agenda-tabs realty-tabs">
          <button
            type="button"
            className={`realty-tab${tab === "todos" ? " realty-tab--active" : ""}`}
            onClick={() => setTab("todos")}
          >
            <LayoutList size={15} /> Todos
          </button>
          <button
            type="button"
            className={`realty-tab${tab === "visitas" ? " realty-tab--active" : ""}`}
            onClick={() => setTab("visitas")}
          >
            <Home size={15} /> Visitas agendadas
            {visitasPendentes > 0 && <span className="agenda-badge">{visitasPendentes}</span>}
          </button>
          <button
            type="button"
            className={`realty-tab${tab === "followups" ? " realty-tab--active" : ""}`}
            onClick={() => setTab("followups")}
          >
            <Users size={15} /> Follow-ups
            {followupsPendentes > 0 && <span className="agenda-badge">{followupsPendentes}</span>}
          </button>
        </div>

        {showFilters && (
          <div className="agenda-filters">
            <label>
              Tipo
              <select value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)}>
                <option value="all">Todos os tipos</option>
                {allTipos.map((t) => (
                  <option key={t} value={t}>
                    {tipoLabel(t)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Corretor
              <select value={filterCorretor} onChange={(e) => setFilterCorretor(e.target.value)}>
                <option value="all">Todos os corretores</option>
                {corretores.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Lead
              <select value={filterLead} onChange={(e) => setFilterLead(e.target.value)}>
                <option value="all">Todos os leads</option>
                {allLeads.map(([id, nome]) => (
                  <option key={id} value={id}>
                    {nome}
                  </option>
                ))}
              </select>
            </label>
            {hasActiveFilters && (
              <button type="button" className="agenda-clear-filters" onClick={clearFilters}>
                <X size={14} /> Limpar filtros
              </button>
            )}
          </div>
        )}

        <div className="agenda-content">
          {loading ? (
            <div className="agenda-empty">
              <Loader2 className="agenda-spin" size={28} />
              <p>Carregando agenda…</p>
            </div>
          ) : (
            <>
              {view === "list" && !selectedDate && (
                <PainelDoDia
                  compromissos={filteredCompromissos}
                  followups={filteredFollowups}
                  onComplete={handleComplete}
                  onEdit={handleEdit}
                  onRefetch={load}
                />
              )}
              {view === "calendar" ? (
                <AgendaCalendar
                  items={calendarItems}
                  currentMonth={currentMonth}
                  setCurrentMonth={setCurrentMonth}
                  selectedDate={selectedDate}
                  onSelectDate={(d) => {
                    setSelectedDate(d);
                    setView("list");
                  }}
                />
              ) : view === "week" ? (
                <AgendaWeek
                  items={calendarItems}
                  currentWeek={currentWeek}
                  setCurrentWeek={setCurrentWeek}
                  onSelectDate={(d) => {
                    setSelectedDate(d);
                    setView("list");
                  }}
                  onDropItem={handleDropItem}
                />
              ) : (
                <AgendaList
                  compromissos={
                    selectedDate
                      ? filteredCompromissos.filter((c) => toDateStr(c.dataInicio) === selectedDate)
                      : pendentesC
                  }
                  followups={
                    selectedDate
                      ? filteredFollowups.filter((f) => toDateStr(f.scheduledAt) === selectedDate)
                      : pendentesF
                  }
                  selectedDate={selectedDate}
                  onClearDate={() => setSelectedDate(undefined)}
                  onComplete={handleComplete}
                  onDelete={onRequestDelete}
                  onEdit={handleEdit}
                  onNewItem={openCreate}
                  onRegistrarVisita={handleRegistrarVisita}
                />
              )}
            </>
          )}
        </div>

        <CompromissoFormDialog
          open={compromissoOpen}
          onOpenChange={(o) => {
            setCompromissoOpen(o);
            if (!o) setEditingCompromisso(null);
          }}
          leads={leads}
          corretores={corretores}
          defaultDate={selectedDate}
          onSave={handleSaveCompromisso}
          saving={saving}
          editingCompromisso={editingCompromisso}
        />

        <FollowupAgendaDialog
          open={followupOpen}
          onOpenChange={(o) => {
            setFollowupOpen(o);
            if (!o) setEditingFollowup(null);
          }}
          leads={leads}
          onSave={handleSaveFollowup}
          saving={saving}
          editingFollowup={editingFollowup}
        />

        <RegistrarVisitaDialog
          open={visitaDialogOpen}
          onOpenChange={setVisitaDialogOpen}
          titulo={visitaTarget?.title || ""}
          leadNome={visitaTarget?.leadNome}
          onConfirm={handleVisitaConfirm}
          resultadoOptions={COMPROMISSO_RESULTADO_OPTIONS}
        />

        {deleteTarget && (
          <div className="realty-modal-backdrop" onClick={() => setDeleteTarget(null)}>
            <div className="realty-card realty-modal" onClick={(e) => e.stopPropagation()}>
              <h3>Excluir item?</h3>
              <p>&quot;{deleteTarget.titulo}&quot; será removido permanentemente.</p>
              <div className="realty-card__actions">
                <button
                  type="button"
                  className="realty-page__btn realty-page__btn--ghost"
                  onClick={() => setDeleteTarget(null)}
                >
                  Cancelar
                </button>
                <button type="button" className="realty-page__btn realty-page__btn--danger" onClick={handleDelete}>
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

export default AgendaImobiliaria;
export { AgendaImobiliaria, toIsoLocal, toDateStr };
