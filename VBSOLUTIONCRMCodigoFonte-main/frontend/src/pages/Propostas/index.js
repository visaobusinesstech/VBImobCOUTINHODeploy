/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 *
 * Página Propostas — paridade visual e funcional com Radarimobtech / Lovable.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  FileText,
  Handshake,
  XCircle,
  CheckCircle,
  Plus,
  Edit,
  Trash2,
  Loader2,
  AlertTriangle,
  Search,
  Download,
  FileDown,
} from "lucide-react";
import MainContainer from "../../components/MainContainer";
import MetricCard from "../../components/propostas/MetricCard";
import PropostaFormDialog from "../../components/propostas/PropostaFormDialog";
import realtyService from "../../services/realtyService";
import {
  formatBRL,
  STATUS_PROPOSTA,
  FORMAS_PAGAMENTO,
} from "../../helpers/realtyCrm";
import {
  exportPropostasPDF,
  exportPropostaIndividualPDF,
} from "../../helpers/exportPropostaPDF";
import toastError from "../../errors/toastError";
import { toast } from "react-toastify";

const statusBadgeClass = {
  em_negociacao: "realty-list-row__badge--negociacao",
  aceita: "realty-list-row__badge--aceita",
  recusada: "realty-list-row__badge--recusada",
  cancelada: "realty-list-row__badge--cancelada",
};

const statusLabel = (id) =>
  STATUS_PROPOSTA.find((s) => s.id === id)?.label || id || "—";

const formaPgtoLabel = (id) =>
  FORMAS_PAGAMENTO.find((f) => f.id === id)?.label || id || "—";

const formatDate = (d) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
};

const getClienteNome = (p) => p.clienteNome || p.title || `Proposta #${p.id}`;

const Propostas = () => {
  const [propostas, setPropostas] = useState([]);
  const [imoveis, setImoveis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [propData, imovData] = await Promise.all([
        realtyService.listPropostas({ pageSize: 200 }),
        realtyService.listImoveis({ pageSize: 200 }),
      ]);
      setPropostas(propData.propostas || []);
      setImoveis(imovData.imoveis || []);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const getImovelTitulo = useCallback(
    (id) => {
      if (!id) return "—";
      const found = imoveis.find((i) => Number(i.id) === Number(id));
      return found?.title || "—";
    },
    [imoveis]
  );

  const filtered = useMemo(() => {
    let list = propostas;
    if (filterStatus !== "todos") {
      list = list.filter((p) => p.status === filterStatus);
    }
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter((p) => {
        const nome = getClienteNome(p).toLowerCase();
        const tel = String(p.clienteTelefone || "").toLowerCase();
        const email = String(p.clienteEmail || "").toLowerCase();
        const imovel = getImovelTitulo(p.imovelId).toLowerCase();
        return (
          nome.includes(s) ||
          tel.includes(s) ||
          email.includes(s) ||
          imovel.includes(s)
        );
      });
    }
    return list;
  }, [propostas, filterStatus, search, getImovelTitulo]);

  const metrics = useMemo(
    () => ({
      total: propostas.length,
      emNegociacao: propostas.filter((p) => p.status === "em_negociacao").length,
      aceitas: propostas.filter((p) => p.status === "aceita").length,
      recusadas: propostas.filter((p) => p.status === "recusada").length,
      valorTotal: propostas
        .filter((p) => p.status === "em_negociacao")
        .reduce((s, p) => s + Number(p.value || 0), 0),
    }),
    [propostas]
  );

  const imoveisComPropostaAtiva = useMemo(() => {
    const ids = new Set();
    propostas
      .filter((p) => p.status === "em_negociacao" && p.imovelId)
      .forEach((p) => ids.add(Number(p.imovelId)));
    return ids;
  }, [propostas]);

  const openCreate = () => {
    setEditItem(null);
    setFormOpen(true);
  };

  const openEdit = (item) => {
    setEditItem(item);
    setFormOpen(true);
  };

  const handleSave = async (data) => {
    setSaving(true);
    try {
      if (editItem) {
        await realtyService.updateProposta(editItem.id, data);
        toast.success("Proposta atualizada");
      } else {
        await realtyService.createProposta(data);
        toast.success("Proposta registrada");
      }
      setFormOpen(false);
      setEditItem(null);
      await load();
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    try {
      await realtyService.deleteProposta(deleteItem.id);
      toast.success("Proposta excluída");
      setDeleteItem(null);
      await load();
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <MainContainer>
      <div className="realty-page">
        <div className="realty-page__header">
          <div>
            <h2 className="realty-page__title">Propostas</h2>
            <p className="realty-page__subtitle">
              Controle de propostas e negociações
            </p>
          </div>
          <div className="realty-page__header-actions">
            <button
              type="button"
              className="realty-page__btn realty-page__btn--ghost"
              disabled={filtered.length === 0}
              onClick={() =>
                exportPropostasPDF({
                  propostas: filtered,
                  imoveis,
                  filterLabel:
                    filterStatus !== "todos"
                      ? `Filtro: ${statusLabel(filterStatus)}`
                      : undefined,
                })
              }
            >
              <Download size={16} style={{ marginRight: 6 }} />
              PDF
            </button>
            <button
              type="button"
              className="realty-page__btn"
              onClick={openCreate}
            >
              <Plus size={16} style={{ marginRight: 6 }} />
              Nova Proposta
            </button>
          </div>
        </div>

        {imoveisComPropostaAtiva.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="realty-alert-warn"
          >
            <AlertTriangle size={16} />
            <span>
              {imoveisComPropostaAtiva.size} imóve
              {imoveisComPropostaAtiva.size > 1 ? "is" : "l"} com proposta em
              negociação ativa
            </span>
          </motion.div>
        )}

        <div className="realty-metrics">
          <MetricCard
            title="Total"
            value={String(metrics.total)}
            icon={FileText}
            delay={0}
          />
          <MetricCard
            title="Em Negociação"
            value={String(metrics.emNegociacao)}
            icon={Handshake}
            delay={0.08}
          />
          <MetricCard
            title="Aceitas"
            value={String(metrics.aceitas)}
            icon={CheckCircle}
            delay={0.16}
          />
          <MetricCard
            title="Recusadas"
            value={String(metrics.recusadas)}
            icon={XCircle}
            delay={0.24}
          />
          <MetricCard
            title="Valor em Negociação"
            value={formatBRL(metrics.valorTotal)}
            icon={FileText}
            delay={0.32}
          />
        </div>

        <div className="realty-page__toolbar">
          <div className="realty-search-wrap">
            <Search size={16} />
            <input
              className="realty-page__search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por cliente ou imóvel..."
            />
          </div>
          <select
            className="realty-page__search realty-page__select"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="todos">Todos os status</option>
            {STATUS_PROPOSTA.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="realty-empty">
            <Loader2
              size={32}
              className="animate-spin"
              style={{ color: "#2673d9", marginBottom: 8 }}
            />
            <p>Carregando propostas...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="realty-empty">
            <FileText
              size={40}
              style={{ opacity: 0.35, marginBottom: 8 }}
            />
            <p>Nenhuma proposta encontrada.</p>
            <button
              type="button"
              className="realty-page__btn"
              style={{ marginTop: 12 }}
              onClick={openCreate}
            >
              Registrar primeira proposta
            </button>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="realty-list-card"
          >
            <div className="realty-list-rows">
              {filtered.map((p) => {
                const badgeMod =
                  statusBadgeClass[p.status] ||
                  "realty-list-row__badge--muted";
                return (
                  <div key={p.id} className="realty-list-row">
                    <div className="realty-list-row__avatar">
                      P{p.numeroProposta || p.id}
                    </div>
                    <div className="realty-list-row__body">
                      <p className="realty-list-row__name">
                        {getClienteNome(p)}
                      </p>
                      <div className="realty-list-row__meta">
                        <span>{getImovelTitulo(p.imovelId)}</span>
                        <span>·</span>
                        <span>{formaPgtoLabel(p.paymentMethod)}</span>
                        <span>·</span>
                        <span>{formatDate(p.createdAt)}</span>
                      </div>
                    </div>
                    <span className={`realty-list-row__badge ${badgeMod}`}>
                      {statusLabel(p.status)}
                    </span>
                    <p className="realty-list-row__valor">
                      {formatBRL(p.value)}
                    </p>
                    <div className="realty-list-row__actions">
                      <button
                        type="button"
                        className="realty-icon-btn"
                        title="Exportar PDF"
                        onClick={() =>
                          exportPropostaIndividualPDF({
                            proposta: p,
                            imovelTitulo: getImovelTitulo(p.imovelId),
                          })
                        }
                      >
                        <FileDown size={14} />
                      </button>
                      <button
                        type="button"
                        className="realty-icon-btn"
                        title="Editar"
                        onClick={() => openEdit(p)}
                      >
                        <Edit size={14} />
                      </button>
                      <button
                        type="button"
                        className="realty-icon-btn realty-icon-btn--danger"
                        title="Excluir"
                        onClick={() => setDeleteItem(p)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </div>

      <PropostaFormDialog
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditItem(null);
        }}
        proposta={editItem}
        imoveis={imoveis}
        onSave={handleSave}
        saving={saving}
      />

      {deleteItem ? (
        <div
          className="realty-modal-backdrop"
          onClick={() => setDeleteItem(null)}
          role="presentation"
        >
          <div
            className="realty-card realty-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <h3>Excluir proposta?</h3>
            <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 16px" }}>
              Tem certeza que deseja excluir a proposta de &quot;
              {getClienteNome(deleteItem)}&quot;?
            </p>
            <div className="realty-proposta-form__actions">
              <button
                type="button"
                className="realty-page__btn realty-page__btn--ghost"
                onClick={() => setDeleteItem(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="realty-page__btn"
                style={{ background: "#dc2626" }}
                onClick={handleDelete}
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </MainContainer>
  );
};

export default Propostas;
