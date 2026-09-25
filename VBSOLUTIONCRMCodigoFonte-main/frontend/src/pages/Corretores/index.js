/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * Corretores — paridade funcional Lovable (Desempenho / Equipe / Atribuição).
 * Design: padrão VBSolution (realty-theme).
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Users,
  Trophy,
  TrendingUp,
  Star,
  Phone,
  Mail,
  Edit,
  Plus,
  Trash2,
  Search,
  X,
  BarChart3,
  MapPin,
  Loader2,
} from "lucide-react";
import MainContainer from "../../components/MainContainer";
import realtyService from "../../services/realtyService";
import toastError from "../../errors/toastError";
import { toast } from "react-toastify";
import {
  CORRETOR_MODULOS,
  emptyCorretorForm,
  filterCorretoresBySearch,
  initials,
  waLink,
} from "../../helpers/corretoresParity";
import DesempenhoTab from "./DesempenhoTab";
import AtribuicaoTab from "./AtribuicaoTab";
import { useUserUiPreferences } from "../../hooks/useUserUiPreferences";
import "./corretores.css";

const TAB_KEY = "corretores_active_tab";

const Corretores = () => {
  const { getPref, setPref, ready } = useUserUiPreferences();
  const [tab, setTab] = useState("desempenho");
  const [corretores, setCorretores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [editFields, setEditFields] = useState(emptyCorretorForm());
  const [saving, setSaving] = useState(false);
  const [permCorretor, setPermCorretor] = useState(null);
  const [permissoes, setPermissoes] = useState([]);

  useEffect(() => {
    if (!ready) return;
    setTab(getPref(TAB_KEY, "desempenho"));
  }, [ready, getPref]);

  const changeTab = (value) => {
    setTab(value);
    setPref(TAB_KEY, value);
  };

  const fetchCorretores = useCallback(async () => {
    setLoading(true);
    try {
      const res = await realtyService.listCorretores();
      setCorretores(res.corretores || []);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCorretores();
  }, [fetchCorretores]);

  const filteredCorretores = useMemo(
    () => filterCorretoresBySearch(corretores, searchQuery),
    [corretores, searchQuery]
  );

  const handleCreate = async () => {
    if (!editFields.nome?.trim()) return;
    setSaving(true);
    try {
      await realtyService.createCorretor({
        nome: editFields.nome,
        email: editFields.email || null,
        telefone: editFields.telefone || null,
        creci: editFields.creci || null,
      });
      toast.success("Corretor criado!");
      setShowCreate(false);
      setEditFields(emptyCorretorForm());
      await fetchCorretores();
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (c) => {
    setEditItem(c);
    setEditFields({
      nome: c.nome || "",
      email: c.email || "",
      telefone: c.telefone || "",
      creci: c.creci || "",
    });
  };

  const saveEdit = async () => {
    if (!editItem) return;
    if (!editFields.nome?.trim()) return;
    setSaving(true);
    try {
      await realtyService.updateCorretor(editItem.id, {
        nome: editFields.nome,
        email: editFields.email || null,
        telefone: editFields.telefone || null,
        creci: editFields.creci || null,
      });
      toast.success("Corretor atualizado!");
      setEditItem(null);
      await fetchCorretores();
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  const deleteCorretor = async (id) => {
    if (!window.confirm("Remover este corretor?")) return;
    try {
      await realtyService.deleteCorretor(id);
      toast.success("Corretor removido");
      await fetchCorretores();
    } catch (err) {
      toastError(err);
    }
  };

  const openPermissions = async (c) => {
    setPermCorretor(c);
    try {
      const res = await realtyService.listCorretorPermissoes(c.id);
      setPermissoes(res.permissoes || CORRETOR_MODULOS.map((m) => ({ modulo: m.key, ativo: true })));
    } catch (err) {
      toastError(err);
      setPermissoes(CORRETOR_MODULOS.map((m) => ({ modulo: m.key, ativo: true })));
    }
  };

  const togglePermission = async (modulo, ativo) => {
    if (!permCorretor) return;
    setPermissoes((prev) =>
      prev.map((p) => (p.modulo === modulo ? { ...p, ativo } : p))
    );
    try {
      await realtyService.upsertCorretorPermissao(permCorretor.id, modulo, ativo);
    } catch (err) {
      toastError(err);
    }
  };

  const formFields = (
    <>
      <label>
        Nome
        <input
          value={editFields.nome}
          onChange={(e) => setEditFields({ ...editFields, nome: e.target.value })}
          placeholder="Nome completo"
        />
      </label>
      <label>
        E-mail
        <input
          value={editFields.email}
          onChange={(e) => setEditFields({ ...editFields, email: e.target.value })}
          placeholder="email@exemplo.com"
        />
      </label>
      <label>
        Telefone
        <input
          value={editFields.telefone}
          onChange={(e) => setEditFields({ ...editFields, telefone: e.target.value })}
          placeholder="(11) 99999-0000"
        />
      </label>
      <label>
        CRECI
        <input
          value={editFields.creci}
          onChange={(e) => setEditFields({ ...editFields, creci: e.target.value })}
          placeholder="CRECI 00000-F"
        />
      </label>
    </>
  );

  return (
    <MainContainer>
      <div className="realty-page corretores-page">
        <div className="realty-page__header">
          <div>
            <h1 className="realty-page__title">Corretores</h1>
            <p className="realty-page__subtitle">
              Cadastre e acompanhe o desempenho da equipe
            </p>
          </div>
        </div>

        <div className="realty-tabs">
          {[
            { id: "desempenho", label: "Desempenho", icon: BarChart3 },
            { id: "equipe", label: "Equipe", icon: Users },
            { id: "atribuicao", label: "Atribuição", icon: MapPin },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              className={`realty-tab${tab === t.id ? " realty-tab--active" : ""}`}
              onClick={() => changeTab(t.id)}
            >
              <t.icon size={14} /> {t.label}
            </button>
          ))}
        </div>

        {tab === "desempenho" && <DesempenhoTab />}
        {tab === "atribuicao" && <AtribuicaoTab />}

        {tab === "equipe" && (
          <>
            <div className="corretores-equipe-actions">
              <button
                type="button"
                className="realty-page__btn"
                onClick={() => {
                  setEditFields(emptyCorretorForm());
                  setShowCreate(true);
                }}
              >
                <Plus size={16} /> Novo Corretor
              </button>
            </div>

            <div className="followup-kpi-grid">
              {[
                {
                  label: "Total Corretores",
                  value: corretores.length,
                  icon: Users,
                },
                {
                  label: "Ativos",
                  value: corretores.filter((c) => c.status === "ativo").length,
                  icon: Trophy,
                },
                { label: "Cadastrados hoje", value: "–", icon: TrendingUp },
                { label: "NPS Médio", value: "–", icon: Star },
              ].map((item, i) => (
                <motion.div
                  key={item.label}
                  className="followup-kpi"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <div className="followup-kpi__head">
                    <item.icon size={14} /> {item.label}
                  </div>
                  <strong>{item.value}</strong>
                </motion.div>
              ))}
            </div>

            <div className="corretores-search">
              <Search size={16} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por nome, e-mail ou telefone..."
              />
              {searchQuery && (
                <button type="button" onClick={() => setSearchQuery("")} aria-label="Limpar">
                  <X size={16} />
                </button>
              )}
            </div>

            {loading ? (
              <div className="corretores-loading">
                <Loader2 className="realty-spin" size={28} />
              </div>
            ) : filteredCorretores.length === 0 ? (
              <div className="realty-card corretores-empty">
                <Users size={40} />
                <p>
                  {corretores.length === 0
                    ? "Nenhum corretor cadastrado ainda."
                    : "Nenhum corretor encontrado."}
                </p>
                {corretores.length === 0 && (
                  <span>Clique em &quot;Novo Corretor&quot; para começar.</span>
                )}
              </div>
            ) : (
              <div className="realty-card corretores-table-wrap">
                <table className="corretores-table">
                  <thead>
                    <tr>
                      <th>Corretor</th>
                      <th>Contato</th>
                      <th>Status</th>
                      <th>Funções</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCorretores.map((c, i) => (
                      <motion.tr
                        key={c.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.03 }}
                      >
                        <td>
                          <div className="corretores-name-cell">
                            <div className="corretores-avatar">{initials(c.nome)}</div>
                            <span>{c.nome}</span>
                          </div>
                        </td>
                        <td>
                          <div className="corretores-contact">
                            {c.email && (
                              <a href={`mailto:${c.email}`}>
                                <Mail size={12} /> {c.email}
                              </a>
                            )}
                            {c.telefone && (
                              <a
                                href={waLink(c.telefone)}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <Phone size={12} /> {c.telefone}
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="corretores-status-cell">
                          <span
                            className={`corretores-status${
                              c.status === "ativo" ? " is-ativo" : ""
                            }`}
                          >
                            <i />
                            {c.status === "ativo" ? "Ativo" : "Inativo"}
                          </span>
                        </td>
                        <td className="corretores-status-cell">
                          <button
                            type="button"
                            className="corretores-link"
                            onClick={() => openPermissions(c)}
                          >
                            Gerenciar Funções
                          </button>
                        </td>
                        <td>
                          <div className="corretores-row-actions">
                            <button type="button" onClick={() => openEdit(c)} aria-label="Editar">
                              <Edit size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteCorretor(c.id)}
                              aria-label="Excluir"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {showCreate && (
          <div className="corretores-modal-backdrop" onClick={() => setShowCreate(false)}>
            <div
              className="corretores-modal"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
            >
              <h3>Novo Corretor</h3>
              <div className="realty-form">{formFields}</div>
              <div className="corretores-modal__footer">
                <button
                  type="button"
                  className="realty-page__btn realty-page__btn--ghost"
                  onClick={() => setShowCreate(false)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="realty-page__btn"
                  disabled={saving || !editFields.nome?.trim()}
                  onClick={handleCreate}
                >
                  {saving ? <Loader2 className="realty-spin" size={16} /> : null} Criar
                </button>
              </div>
            </div>
          </div>
        )}

        {editItem && (
          <div className="corretores-modal-backdrop" onClick={() => setEditItem(null)}>
            <div
              className="corretores-modal"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
            >
              <h3>Editar Corretor</h3>
              <div className="realty-form">{formFields}</div>
              <div className="corretores-modal__footer">
                <button
                  type="button"
                  className="realty-page__btn realty-page__btn--ghost"
                  onClick={() => setEditItem(null)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="realty-page__btn"
                  disabled={saving || !editFields.nome?.trim()}
                  onClick={saveEdit}
                >
                  {saving ? <Loader2 className="realty-spin" size={16} /> : null} Salvar
                </button>
              </div>
            </div>
          </div>
        )}

        {permCorretor && (
          <div className="corretores-modal-backdrop" onClick={() => setPermCorretor(null)}>
            <div
              className="corretores-modal"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
            >
              <h3>Funções — {permCorretor.nome}</h3>
              <p className="corretores-muted" style={{ marginBottom: 12 }}>
                Ative ou desative o acesso do corretor a cada módulo do sistema.
              </p>
              <div className="corretores-perms">
                {permissoes.map((p) => {
                  const info = CORRETOR_MODULOS.find((m) => m.key === p.modulo);
                  return (
                    <div key={p.modulo} className="corretores-perm-row">
                      <span>{info?.label || p.modulo}</span>
                      <label className="corretores-switch">
                        <input
                          type="checkbox"
                          checked={!!p.ativo}
                          onChange={(e) => togglePermission(p.modulo, e.target.checked)}
                        />
                        <span />
                      </label>
                    </div>
                  );
                })}
              </div>
              <div className="corretores-modal__footer">
                <button
                  type="button"
                  className="realty-page__btn"
                  onClick={() => setPermCorretor(null)}
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainContainer>
  );
};

export default Corretores;
