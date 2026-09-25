/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 *
 * Página Follow-up — paridade visual/funcional com Lovable (indicadores, filtros,
 * modal estilo campanha, templates + WhatsApp Web / API Oficial).
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Plus,
  Filter,
  Share2,
  Search,
  Clock,
  AlertTriangle,
  CalendarDays,
  Users,
  Check,
  Trash2,
  Edit2,
  MessageCircle,
  Phone,
  Mail,
  Loader2,
  X,
  Send,
  FileText,
  BarChart3,
  TrendingUp,
} from "lucide-react";
import MainContainer from "../../components/MainContainer";
import FollowupFormModal from "../../components/followups/FollowupFormModal";
import FollowupTemplateDialog from "../../components/followups/FollowupTemplateDialog";
import realtyService from "../../services/realtyService";
import leadsSalesService from "../../services/leadsSalesService";
import {
  FOLLOWUP_STATUS_OPTIONS,
  FOLLOWUP_TIPO_LABELS,
  FOLLOWUP_MENSAGENS_PRONTAS,
} from "../../helpers/realtyCrm";
import toastError from "../../errors/toastError";
import { toast } from "react-toastify";

const STORAGE_KEY = "followups:filters:v1";
const SEM_CONTATO_OPCOES = [3, 5, 7, 14, 30];

const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const isToday = (iso) => {
  if (!iso) return false;
  return startOfDay(iso).getTime() === startOfDay(new Date()).getTime();
};

const isPastDate = (iso) => {
  if (!iso) return false;
  return startOfDay(iso).getTime() < startOfDay(new Date()).getTime();
};

const isThisWeek = (iso) => {
  if (!iso) return false;
  const d = new Date(iso);
  const today = startOfDay(new Date());
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  return d >= weekStart && d < weekEnd;
};

const formatDateTime = (iso) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const clienteNome = (f) =>
  f.contratoId
    ? f.contratoTitulo || f.leadNome || `Contrato #${f.contratoId}`
    : f.leadNome || `Lead #${f.leadSaleId || f.id}`;

const Followups = () => {
  const saved = (() => {
    try {
      return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
    } catch {
      return {};
    }
  })();

  const [followups, setFollowups] = useState([]);
  const [leads, setLeads] = useState([]);
  const [contratos, setContratos] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [counts, setCounts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState(saved.search || "");
  const [filterStatus, setFilterStatus] = useState(saved.filterStatus || "todos");
  const [filterTipo, setFilterTipo] = useState(saved.filterTipo || "todos");
  const [filterPrazo, setFilterPrazo] = useState(saved.filterPrazo || "todos");
  const [filterAlvo, setFilterAlvo] = useState(saved.filterAlvo || "todos");
  const [semContatoDias, setSemContatoDias] = useState(
    SEM_CONTATO_OPCOES.includes(Number(saved.semContatoDias))
      ? Number(saved.semContatoDias)
      : 7
  );

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [quickMsgOpen, setQuickMsgOpen] = useState(false);
  const [selectedFu, setSelectedFu] = useState(null);
  const [concluirOpen, setConcluirOpen] = useState(false);
  const [resultadoText, setResultadoText] = useState("");

  const incluirInativos =
    filterPrazo === "inativos" ||
    filterStatus === "concluido" ||
    filterStatus === "perdido";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [fuData, leadData, contratoData, tplData, countsData] = await Promise.all([
        realtyService.listFollowups({ pageSize: 500 }),
        leadsSalesService.list({ pageSize: 500 }),
        realtyService.listContratos({ pageSize: 500 }),
        realtyService.listFollowupTemplates(),
        realtyService.getFollowupCounts({
          includeInactive: incluirInativos ? "true" : "false",
          semContatoDays: semContatoDias,
        }),
      ]);
      setFollowups(fuData.followups || []);
      setLeads(leadData.leads || []);
      setContratos(contratoData.contratos || []);
      setTemplates(tplData.templates || []);
      setCounts(countsData || null);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, [incluirInativos, semContatoDias]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          search,
          filterStatus,
          filterTipo,
          filterPrazo,
          filterAlvo,
          semContatoDias,
        })
      );
    } catch {
      /* ignore */
    }
  }, [search, filterStatus, filterTipo, filterPrazo, filterAlvo, semContatoDias]);

  const hasActiveFilters =
    filterStatus !== "todos" ||
    filterTipo !== "todos" ||
    filterPrazo !== "todos" ||
    filterAlvo !== "todos" ||
    search !== "";

  const filtered = useMemo(() => {
    let result = followups;
    const querendoInativos =
      incluirInativos ||
      (search && "inativo fechado perdido".includes(search.toLowerCase()));
    if (!querendoInativos) {
      result = result.filter((f) => !f.alvoInativo);
    }
    if (filterAlvo === "leads") result = result.filter((f) => !!f.leadSaleId);
    if (filterAlvo === "contratos") result = result.filter((f) => !!f.contratoId);
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(
        (f) =>
          (f.leadNome || "").toLowerCase().includes(s) ||
          (f.leadTelefone || "").includes(s) ||
          (f.contratoTitulo || "").toLowerCase().includes(s) ||
          (f.notes || "").toLowerCase().includes(s) ||
          (f.messageBody || "").toLowerCase().includes(s)
      );
    }
    if (filterStatus !== "todos") result = result.filter((f) => f.status === filterStatus);
    if (filterTipo !== "todos") result = result.filter((f) => f.type === filterTipo);
    if (filterPrazo === "hoje") result = result.filter((f) => isToday(f.scheduledAt));
    if (filterPrazo === "atrasados") {
      result = result.filter(
        (f) =>
          isPastDate(f.scheduledAt) &&
          !isToday(f.scheduledAt) &&
          (f.status === "pendente" || f.status === "aguardando")
      );
    }
    if (filterPrazo === "semana") result = result.filter((f) => isThisWeek(f.scheduledAt));
    if (filterPrazo === "inativos") result = result.filter((f) => f.alvoInativo);
    return [...result].sort(
      (a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt)
    );
  }, [followups, search, filterStatus, filterTipo, filterPrazo, filterAlvo, incluirInativos]);

  const clearFilters = () => {
    setFilterStatus("todos");
    setFilterTipo("todos");
    setFilterPrazo("todos");
    setFilterAlvo("todos");
    setSearch("");
    toast.success("Filtros limpos");
  };

  const handleSave = async (payload) => {
    setSaving(true);
    try {
      const { id, leadSaleIds, ...data } = payload;
      if (id) {
        await realtyService.updateFollowup(id, data);
        toast.success("Follow-up atualizado");
      } else if (Array.isArray(leadSaleIds) && leadSaleIds.length > 1) {
        let ok = 0;
        let warn = 0;
        for (const leadSaleId of leadSaleIds) {
          const result = await realtyService.createFollowup({ ...data, leadSaleId, contratoId: null });
          ok += 1;
          if (result?.dispatch && !result.dispatch.sent) warn += 1;
        }
        toast.success(
          warn > 0
            ? `${ok} follow-ups criados (${warn} com aviso no envio WhatsApp)`
            : `${ok} follow-ups agendados`
        );
      } else {
        const result = await realtyService.createFollowup({
          ...data,
          leadSaleId: data.leadSaleId || leadSaleIds?.[0] || null,
        });
        if (result?.dispatch?.sent) {
          toast.success(`Follow-up criado e enviado via ${result.dispatch.channel}`);
        } else if (result?.dispatch && !result.dispatch.sent) {
          toast.warning(
            `Follow-up criado. Envio WhatsApp: ${result.dispatch.error || "não enviado"}`
          );
        } else {
          toast.success("Follow-up agendado");
        }
      }
      setFormOpen(false);
      setEditing(null);
      await load();
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (f) => {
    if (!window.confirm("Excluir este follow-up?")) return;
    try {
      await realtyService.deleteFollowup(f.id);
      toast.success("Excluído");
      await load();
    } catch (err) {
      toastError(err);
    }
  };

  const confirmConcluir = async () => {
    if (!selectedFu) return;
    try {
      await realtyService.updateFollowup(selectedFu.id, {
        status: "concluido",
        result: resultadoText || selectedFu.result || "concluido",
        completedAt: new Date().toISOString(),
      });
      toast.success("Follow-up concluído!");
      setConcluirOpen(false);
      setSelectedFu(null);
      setResultadoText("");
      await load();
    } catch (err) {
      toastError(err);
    }
  };

  const handleSendWhatsApp = async (f, msg) => {
    try {
      const result = await realtyService.sendFollowupWhatsApp(f.id, {
        messageBody: msg || f.messageBody,
      });
      if (result.sent) {
        toast.success(`Enviado via ${result.channel}`);
      } else {
        toast.error(result.error || "Falha no envio");
      }
      setQuickMsgOpen(false);
      await load();
    } catch (err) {
      toastError(err);
    }
  };

  const handleEncerrarInativos = async () => {
    try {
      const res = await realtyService.concluirFollowupsInativos();
      toast.success(`${res.closed || 0} follow-up(s) encerrado(s)`);
      await load();
    } catch (err) {
      toastError(err);
    }
  };

  const statusLabel = (id) =>
    FOLLOWUP_STATUS_OPTIONS.find((s) => s.id === id)?.label || id || "—";

  const priorityBadge = (f) => {
    if (f.status !== "pendente" && f.status !== "aguardando") return null;
    if (isPastDate(f.scheduledAt) && !isToday(f.scheduledAt)) {
      return <span className="followup-priority followup-priority--atrasado">Atrasado</span>;
    }
    if (isToday(f.scheduledAt)) {
      return <span className="followup-priority followup-priority--hoje">Hoje</span>;
    }
    const days = Math.ceil(
      (startOfDay(f.scheduledAt) - startOfDay(new Date())) / (1000 * 60 * 60 * 24)
    );
    if (days <= 3) {
      return <span className="followup-priority followup-priority--proximo">Próximo</span>;
    }
    return <span className="followup-priority followup-priority--agendado">Agendado</span>;
  };

  const total = followups.length;
  const concluidos = followups.filter((f) => f.status === "concluido").length;
  const taxa =
    counts?.taxaConclusao != null
      ? counts.taxaConclusao
      : total > 0
        ? Math.round((concluidos / total) * 100)
        : 0;
  const pendentesCount =
    counts?.pendentes != null
      ? counts.pendentes
      : followups.filter(
          (f) =>
            (f.status === "pendente" || f.status === "aguardando") && !f.alvoInativo
        ).length;

  const inativosPendentes = followups.filter(
    (f) =>
      (f.status === "pendente" || f.status === "aguardando") && f.alvoInativo
  );

  return (
    <MainContainer>
      <div className="realty-page followup-page">
        <div className="realty-page__header">
          <div>
            <h1 className="realty-page__title">Follow-up</h1>
            <p className="realty-page__subtitle">
              Gerencie todos os retornos e acompanhamentos de clientes
            </p>
          </div>
          <div className="followup-header-actions">
            {inativosPendentes.length > 0 && (
              <button
                type="button"
                className="realty-page__btn realty-page__btn--ghost"
                onClick={handleEncerrarInativos}
              >
                <Check size={16} /> Encerrar inativos ({inativosPendentes.length})
              </button>
            )}
            <button
              type="button"
              className="realty-page__btn realty-page__btn--ghost"
              onClick={() => {
                setFilterPrazo("inativos");
                setShowFilters(true);
              }}
            >
              Ver inativos
            </button>
            <button
              type="button"
              className={`realty-page__btn${showFilters ? "" : " realty-page__btn--ghost"}`}
              onClick={() => setShowFilters((v) => !v)}
            >
              <Filter size={16} /> Filtros{hasActiveFilters ? " ●" : ""}
            </button>
            <button
              type="button"
              className="realty-page__btn realty-page__btn--ghost"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(window.location.href);
                  toast.success("Link copiado");
                } catch {
                  toast.error("Não foi possível copiar");
                }
              }}
            >
              <Share2 size={16} /> Compartilhar
            </button>
            <button
              type="button"
              className="realty-page__btn realty-page__btn--ghost"
              onClick={() => setTemplateOpen(true)}
            >
              <FileText size={16} /> Criar template de mensagem
            </button>
            <button
              type="button"
              className="realty-page__btn"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus size={16} /> Adicionar Follow-up
            </button>
          </div>
        </div>

        {/* Painel de prioridade */}
        <div className="followup-kpi-grid">
          <motion.button
            type="button"
            className="followup-kpi"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => {
              setFilterPrazo("hoje");
              setShowFilters(true);
            }}
          >
            <div className="followup-kpi__head">
              <Clock size={16} /> Hoje
            </div>
            <strong>{counts?.hoje ?? 0}</strong>
            <span>follow-ups para hoje</span>
          </motion.button>

          <motion.button
            type="button"
            className="followup-kpi followup-kpi--danger"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            onClick={() => {
              setFilterPrazo("atrasados");
              setShowFilters(true);
            }}
          >
            <div className="followup-kpi__head">
              <AlertTriangle size={16} /> Atrasados
            </div>
            <strong>{counts?.atrasados ?? 0}</strong>
            <span>precisam de atenção</span>
          </motion.button>

          <motion.button
            type="button"
            className="followup-kpi"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            onClick={() => {
              setFilterPrazo("semana");
              setShowFilters(true);
            }}
          >
            <div className="followup-kpi__head">
              <CalendarDays size={16} /> Esta Semana
            </div>
            <strong>{counts?.semana ?? 0}</strong>
            <span>agendados na semana</span>
          </motion.button>

          <motion.div
            className="followup-kpi followup-kpi--warn"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <div className="followup-kpi__head">
              <Users size={16} /> Sem Contato {semContatoDias}d+
              <select
                className="followup-kpi__select"
                value={semContatoDias}
                onChange={(e) => setSemContatoDias(Number(e.target.value))}
                onClick={(e) => e.stopPropagation()}
              >
                {SEM_CONTATO_OPCOES.map((d) => (
                  <option key={d} value={d}>
                    {d} dias
                  </option>
                ))}
              </select>
            </div>
            <strong>{counts?.sem_contato ?? 0}</strong>
            <span>clientes esquecidos</span>
          </motion.div>
        </div>

        {/* Filtros */}
        {showFilters && (
          <div className="followup-filters">
            <label>
              Buscar
              <div className="followup-filters__search">
                <Search size={14} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Nome, telefone..."
                />
              </div>
            </label>
            <label>
              Status
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                <option value="todos">Todos</option>
                {FOLLOWUP_STATUS_OPTIONS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Tipo
              <select value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)}>
                <option value="todos">Todos</option>
                {Object.entries(FOLLOWUP_TIPO_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Prazo
              <select value={filterPrazo} onChange={(e) => setFilterPrazo(e.target.value)}>
                <option value="todos">Todos</option>
                <option value="hoje">Hoje</option>
                <option value="atrasados">Atrasados</option>
                <option value="semana">Esta semana</option>
                <option value="inativos">Alvos inativos (fechado/cancelado)</option>
              </select>
            </label>
            <label>
              Vínculo
              <select value={filterAlvo} onChange={(e) => setFilterAlvo(e.target.value)}>
                <option value="todos">Leads e Contratos</option>
                <option value="leads">Somente Leads</option>
                <option value="contratos">Somente Contratos</option>
              </select>
            </label>
            <button
              type="button"
              className="realty-page__btn realty-page__btn--ghost"
              disabled={!hasActiveFilters}
              onClick={clearFilters}
            >
              <X size={14} /> Limpar filtros
            </button>
          </div>
        )}

        {/* Lista */}
        {loading ? (
          <div className="followup-empty">
            <Loader2 className="spin" size={32} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="followup-empty">
            <CalendarDays size={48} style={{ opacity: 0.3 }} />
            <p>
              {hasActiveFilters
                ? "Nenhum follow-up encontrado com esses filtros."
                : "Parabéns! Você não tem follow-ups pendentes no momento."}
            </p>
            {hasActiveFilters ? (
              <button type="button" className="realty-page__btn realty-page__btn--ghost" onClick={clearFilters}>
                Limpar filtros
              </button>
            ) : (
              <button
                type="button"
                className="realty-page__btn"
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                <Plus size={16} /> Criar primeiro follow-up
              </button>
            )}
          </div>
        ) : (
          <div className="followup-table-wrap">
            <table className="followup-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th className="hide-sm">Telefone</th>
                  <th>Tipo</th>
                  <th>Próximo Contato</th>
                  <th>Status</th>
                  <th>Prioridade</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((f) => (
                  <tr key={f.id}>
                    <td>
                      <strong>{clienteNome(f)}</strong>
                      {f.whatsappSent ? (
                        <span className="realty-chip" title="WhatsApp enviado">
                          WA ✓
                        </span>
                      ) : null}
                    </td>
                    <td className="hide-sm">{f.leadTelefone || "—"}</td>
                    <td>{FOLLOWUP_TIPO_LABELS[f.type] || f.type}</td>
                    <td>{formatDateTime(f.scheduledAt)}</td>
                    <td>
                      <span className="realty-chip">{statusLabel(f.status)}</span>
                    </td>
                    <td>{priorityBadge(f)}</td>
                    <td>
                      <div className="followup-row-actions">
                        {f.type === "whatsapp" && (
                          <button
                            type="button"
                            title="WhatsApp"
                            onClick={() => {
                              setSelectedFu(f);
                              setQuickMsgOpen(true);
                            }}
                          >
                            <MessageCircle size={15} />
                          </button>
                        )}
                        {f.leadTelefone && (
                          <a href={`tel:+55${String(f.leadTelefone).replace(/\D/g, "")}`} title="Ligar">
                            <Phone size={15} />
                          </a>
                        )}
                        {f.leadEmail && (
                          <a
                            href={`mailto:${f.leadEmail}?subject=Follow-up`}
                            title="E-mail"
                          >
                            <Mail size={15} />
                          </a>
                        )}
                        <button
                          type="button"
                          title="Concluir"
                          onClick={() => {
                            setSelectedFu(f);
                            setResultadoText(f.result || "");
                            setConcluirOpen(true);
                          }}
                        >
                          <Check size={15} />
                        </button>
                        <button
                          type="button"
                          title="Editar"
                          onClick={() => {
                            setEditing(f);
                            setFormOpen(true);
                          }}
                        >
                          <Edit2 size={15} />
                        </button>
                        <button type="button" title="Excluir" onClick={() => handleDelete(f)}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Performance */}
        <div className="followup-perf">
          <article>
            <BarChart3 size={16} />
            <div>
              <span>Follow-ups Feitos</span>
              <strong>{counts?.total ?? total}</strong>
            </div>
          </article>
          <article>
            <Check size={16} />
            <div>
              <span>Concluídos</span>
              <strong>{counts?.concluidos ?? concluidos}</strong>
            </div>
          </article>
          <article>
            <TrendingUp size={16} />
            <div>
              <span>Taxa Conclusão</span>
              <strong>{taxa}%</strong>
            </div>
          </article>
          <article>
            <Clock size={16} />
            <div>
              <span>Pendentes</span>
              <strong>{pendentesCount}</strong>
            </div>
          </article>
        </div>
      </div>

      <FollowupFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSave={handleSave}
        saving={saving}
        followup={editing}
        leads={leads}
        contratos={contratos}
        templates={templates}
      />

      <FollowupTemplateDialog
        open={templateOpen}
        onClose={() => setTemplateOpen(false)}
        onSaved={async () => {
          const data = await realtyService.listFollowupTemplates();
          setTemplates(data.templates || []);
        }}
      />

      {quickMsgOpen && selectedFu && (
        <div
          className="realty-modal-backdrop"
          onClick={() => setQuickMsgOpen(false)}
          role="presentation"
        >
          <div
            className="realty-card realty-modal followup-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
          >
            <h3>Mensagem rápida — {clienteNome(selectedFu)}</h3>
            <div className="followup-quick-list">
              {(selectedFu.messageBody
                ? [selectedFu.messageBody, ...FOLLOWUP_MENSAGENS_PRONTAS]
                : FOLLOWUP_MENSAGENS_PRONTAS
              )
                .filter((v, i, a) => a.indexOf(v) === i)
                .map((msg) => (
                  <button
                    key={msg}
                    type="button"
                    className="followup-quick-item"
                    onClick={() => handleSendWhatsApp(selectedFu, msg)}
                  >
                    <Send size={14} />
                    <span>{msg}</span>
                  </button>
                ))}
            </div>
            <div className="realty-proposta-form__actions">
              <button
                type="button"
                className="realty-page__btn realty-page__btn--ghost"
                onClick={() => setQuickMsgOpen(false)}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {concluirOpen && selectedFu && (
        <div
          className="realty-modal-backdrop"
          onClick={() => setConcluirOpen(false)}
          role="presentation"
        >
          <div
            className="realty-card realty-modal followup-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
          >
            <h3>Concluir follow-up</h3>
            <label className="realty-proposta-form">
              Resultado
              <textarea
                rows={3}
                value={resultadoText}
                onChange={(e) => setResultadoText(e.target.value)}
                placeholder="Como foi o retorno?"
              />
            </label>
            <div className="realty-proposta-form__actions">
              <button
                type="button"
                className="realty-page__btn realty-page__btn--ghost"
                onClick={() => setConcluirOpen(false)}
              >
                Cancelar
              </button>
              <button type="button" className="realty-page__btn" onClick={confirmConcluir}>
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}
    </MainContainer>
  );
};

export default Followups;
