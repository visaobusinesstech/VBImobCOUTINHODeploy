/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * Página Relacionamento — paridade funcional Lovable + design VBSolution.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Briefcase,
  Calendar,
  FileText,
  Filter,
  Heart,
  Loader2,
  Mail,
  MessageCircle,
  Phone,
  Plus,
  Search,
  Send,
  Trash2,
  Edit,
  X,
} from "lucide-react";
import MainContainer from "../../components/MainContainer";
import ClienteFormDialog from "../../components/relacionamento/ClienteFormDialog";
import SendMessageDialog from "../../components/relacionamento/SendMessageDialog";
import TemplatesDialog from "../../components/relacionamento/TemplatesDialog";
import realtyService from "../../services/realtyService";
import toastError from "../../errors/toastError";
import { toast } from "react-toastify";
import {
  EVENTO_FILTROS,
  clientesComEventoProximo,
  filterByEventos,
  formatFilhoDate,
  getDefaultTemplate,
  getWhatsAppLink,
  initials,
  proximoEvento,
  searchClientesMatch,
} from "../../helpers/relacionamentoCrm";

const Relacionamento = () => {
  const [clientes, setClientes] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroEventos, setFiltroEventos] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteItem, setDeleteItem] = useState(null);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [sendMsgClient, setSendMsgClient] = useState(null);
  const [sendPreTipo, setSendPreTipo] = useState(undefined);

  const loadClientes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await realtyService.listClientesRelacionamento();
      setClientes(data.clientes || []);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTemplates = useCallback(async () => {
    try {
      const data = await realtyService.listRelacionamentoTemplates();
      setTemplates(data.templates || []);
    } catch (err) {
      toastError(err);
    }
  }, []);

  useEffect(() => {
    loadClientes();
    loadTemplates();
  }, [loadClientes, loadTemplates]);

  const getTemplate = useCallback(
    (tipo) => {
      const found = templates.find((t) => t.tipo === tipo);
      return found?.mensagem || getDefaultTemplate(tipo);
    },
    [templates]
  );

  const toggleFiltroEvento = (tipo) => {
    setFiltroEventos((prev) =>
      prev.includes(tipo) ? prev.filter((t) => t !== tipo) : [...prev, tipo]
    );
  };

  const filtrar = useCallback(
    (lista) => {
      let resultado = lista.filter((c) => searchClientesMatch(c, busca));
      resultado = filterByEventos(resultado, filtroEventos);
      return resultado;
    },
    [busca, filtroEventos]
  );

  const ativos = useMemo(
    () => filtrar(clientes.filter((c) => c.ativo !== false)),
    [clientes, filtrar]
  );
  const inativos = useMemo(
    () => filtrar(clientes.filter((c) => c.ativo === false)),
    [clientes, filtrar]
  );

  const eventos7dias = useMemo(() => clientesComEventoProximo(clientes, 7), [clientes]);

  const openNew = () => {
    setEditItem(null);
    setFormOpen(true);
  };

  const openEdit = (c) => {
    setEditItem(c);
    setFormOpen(true);
  };

  const handleSave = async (payload) => {
    setSaving(true);
    try {
      if (editItem?.id) {
        await realtyService.updateClienteRelacionamento(editItem.id, payload);
        toast.success("Cliente atualizado!");
      } else {
        await realtyService.createClienteRelacionamento(payload);
        toast.success("Cliente adicionado!");
      }
      setFormOpen(false);
      setEditItem(null);
      await loadClientes();
    } catch (err) {
      const status = err?.response?.status;
      const warnings = err?.response?.data?.warnings;
      if (status === 409 && Array.isArray(warnings) && warnings.length) {
        warnings.forEach((w) => toast.error(w));
      } else {
        toastError(err);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    try {
      await realtyService.deleteClienteRelacionamento(deleteItem.id);
      toast.success("Cliente excluído!");
      setDeleteItem(null);
      await loadClientes();
    } catch (err) {
      toastError(err);
    }
  };

  const handleReativar = async (c) => {
    try {
      await realtyService.updateClienteRelacionamento(c.id, { ativo: true });
      toast.success("Cliente reativado!");
      await loadClientes();
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <MainContainer autoHeight>
      <div className="realty-page">
        <div className="realty-page__header">
          <div>
            <h1 className="realty-page__title">Relacionamento</h1>
            <p className="realty-page__subtitle">Central de relacionamento com clientes</p>
            <button type="button" className="realty-page__btn" onClick={openNew} style={{ marginTop: 10 }}>
              <Plus size={16} /> Novo Cliente
            </button>
          </div>
          <div className="realty-rel-header-actions">
            {!loading ? (
              <span className="realty-rel-chip">
                <Calendar size={14} />
                {eventos7dias} evento(s) em 7 dias
              </span>
            ) : null}
            <button
              type="button"
              className="realty-page__btn realty-page__btn--ghost"
              onClick={() => setTemplatesOpen(true)}
            >
              <FileText size={16} /> Templates
            </button>
          </div>
        </div>

        <div className="realty-page__toolbar">
          <div className="realty-prop-search-wrap">
            <Search size={16} className="realty-prop-search-icon" />
            <input
              className="realty-page__search"
              placeholder="Buscar cliente..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            {busca ? (
              <button type="button" className="realty-prop-search-clear" onClick={() => setBusca("")}>
                <X size={14} />
              </button>
            ) : null}
          </div>
        </div>

        <div className="realty-rel-filters">
          <Filter size={14} />
          <span>Eventos:</span>
          {EVENTO_FILTROS.map((ef) => (
            <button
              key={ef.tipo}
              type="button"
              className={`realty-rel-badge${
                filtroEventos.includes(ef.tipo) ? " realty-rel-badge--active" : ""
              }`}
              onClick={() => toggleFiltroEvento(ef.tipo)}
            >
              {ef.label}
            </button>
          ))}
          {filtroEventos.length > 0 ? (
            <button
              type="button"
              className="realty-rel-clear-filters"
              onClick={() => setFiltroEventos([])}
            >
              Limpar
            </button>
          ) : null}
        </div>

        {loading ? (
          <div className="realty-empty">
            <Loader2 size={28} className="realty-spin" />
          </div>
        ) : (
          <div className="realty-rel-sections">
            <section className="realty-card realty-rel-section">
              <div className="realty-rel-section__head">
                <Calendar size={16} />
                <h3>Clientes & Eventos</h3>
                <span className="realty-rel-count">{ativos.length} ativos</span>
              </div>
              {ativos.length === 0 ? (
                <p className="realty-empty-text">
                  Nenhum cliente cadastrado. Clique em &quot;Novo Cliente&quot;.
                </p>
              ) : (
                <div className="realty-rel-list">
                  {ativos.map((c) => (
                    <div key={c.id} className="realty-rel-row">
                      <div className="realty-rel-row__main">
                        <div className="realty-prop-avatar">{initials(c.nome)}</div>
                        <div className="realty-rel-row__info">
                          <p className="realty-rel-row__name">{c.nome}</p>
                          <p className="realty-rel-row__event">{proximoEvento(c)}</p>
                          {c.telefone ? (
                            <a
                              href={`https://wa.me/55${String(c.telefone).replace(/\D/g, "")}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="realty-prop-link-row"
                            >
                              <Phone size={12} /> {c.telefone}
                            </a>
                          ) : null}
                          {c.email ? (
                            <a href={`mailto:${c.email}`} className="realty-prop-link-row">
                              <Mail size={12} /> {c.email}
                            </a>
                          ) : null}
                          {c.profissao ? (
                            <span className="realty-prop-link-row realty-prop-link-row--accent">
                              <Briefcase size={12} /> {c.profissao}
                            </span>
                          ) : null}
                          {Array.isArray(c.filhos) && c.filhos.length > 0 ? (
                            <span className="realty-rel-filhos-preview">
                              {c.filhos
                                .map(
                                  (f) =>
                                    `${f.nome}${
                                      f.dataNascimento || f.data_nascimento
                                        ? ` (${formatFilhoDate(
                                            f.dataNascimento || f.data_nascimento
                                          )})`
                                        : ""
                                    }`
                                )
                                .join(", ")}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="realty-rel-row__actions">
                        <button
                          type="button"
                          className="realty-prop-icon-btn"
                          title="Editar"
                          onClick={() => openEdit(c)}
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          type="button"
                          className="realty-prop-icon-btn"
                          title="Enviar mensagem"
                          onClick={() => {
                            setSendPreTipo(undefined);
                            setSendMsgClient(c);
                          }}
                        >
                          <Send size={14} />
                        </button>
                        {c.telefone ? (
                          <a
                            className="realty-prop-icon-btn"
                            href={getWhatsAppLink(
                              c.telefone,
                              `Olá ${String(c.nome).split(" ")[0]}!`
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="WhatsApp"
                          >
                            <MessageCircle size={14} />
                          </a>
                        ) : null}
                        <button
                          type="button"
                          className="realty-prop-icon-btn realty-prop-icon-btn--danger"
                          title="Excluir"
                          onClick={() => setDeleteItem(c)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="realty-card realty-rel-section">
              <div className="realty-rel-section__head">
                <Heart size={16} />
                <h3>Clientes Inativos</h3>
                <span className="realty-rel-count">{inativos.length} para reativar</span>
              </div>
              {inativos.length === 0 ? (
                <p className="realty-empty-text">Nenhum cliente inativo.</p>
              ) : (
                <div className="realty-rel-list">
                  {inativos.map((c) => (
                    <div key={c.id} className="realty-rel-row">
                      <div className="realty-rel-row__main">
                        <div className="realty-prop-avatar realty-prop-avatar--muted">
                          {initials(c.nome)}
                        </div>
                        <div className="realty-rel-row__info">
                          <p className="realty-rel-row__name">{c.nome}</p>
                          <p className="realty-rel-row__event">{c.profissao || "Sem profissão"}</p>
                        </div>
                      </div>
                      <div className="realty-rel-row__actions">
                        <button
                          type="button"
                          className="realty-page__btn realty-page__btn--ghost"
                          onClick={() => {
                            setSendPreTipo("reativacao");
                            setSendMsgClient(c);
                          }}
                        >
                          <Send size={14} /> Reativar via msg
                        </button>
                        <button
                          type="button"
                          className="realty-page__btn"
                          onClick={() => handleReativar(c)}
                        >
                          Reativar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      <ClienteFormDialog
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o) setEditItem(null);
        }}
        cliente={editItem}
        onSave={handleSave}
        saving={saving}
      />

      {deleteItem ? (
        <div className="realty-modal-backdrop" role="presentation" onClick={(e) => e.stopPropagation()}>
          <div
            className="realty-modal realty-rel-modal realty-rel-modal--sm"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="realty-modal__head">
              <h3>Confirmar exclusão</h3>
              <button type="button" className="realty-modal__close" onClick={() => setDeleteItem(null)} aria-label="Fechar">
                <X size={18} />
              </button>
            </div>
            <p className="realty-empty-text" style={{ padding: "8px 20px 0", textAlign: "left" }}>
              Deseja realmente excluir este cliente?
            </p>
            <div className="realty-modal__footer">
              <button
                type="button"
                className="realty-page__btn realty-page__btn--ghost"
                onClick={() => setDeleteItem(null)}
              >
                Cancelar
              </button>
              <button type="button" className="realty-page__btn realty-page__btn--danger" onClick={handleDelete}>
                Excluir
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <TemplatesDialog
        open={templatesOpen}
        onOpenChange={setTemplatesOpen}
        templates={templates}
        onSaved={loadTemplates}
      />

      <SendMessageDialog
        open={!!sendMsgClient}
        onOpenChange={(o) => {
          if (!o) {
            setSendMsgClient(null);
            setSendPreTipo(undefined);
          }
        }}
        cliente={sendMsgClient}
        preSelectTipo={sendPreTipo}
        getTemplate={getTemplate}
      />
    </MainContainer>
  );
};

export default Relacionamento;
