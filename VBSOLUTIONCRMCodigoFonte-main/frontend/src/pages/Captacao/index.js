/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 *
 * Captação de Imóveis — paridade de inputs/opções com Lovable Captacao.tsx
 * (canais porteiro/construtor/construtora/síndico/indicação + ViaCEP).
 * Visual: padrão VBSolution (realty-theme).
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useHistory } from "react-router-dom";
import MainContainer from "../../components/MainContainer";
import realtyService from "../../services/realtyService";
import toastError from "../../errors/toastError";
import { toast } from "react-toastify";
import {
  CAPTACAO_TIPOS,
  CAPTACAO_STATUS_OPTIONS,
  CAPTACAO_TIPOS_IMOVEL,
  CAPTACAO_OPERACOES,
  extractIndicadoPor,
  isCaptacaoSubmittable,
  computeCaptacaoKpis,
  buildCaptacaoSavePayload,
  captacaoRecordToForm,
  rankCaptacaoByOperacao,
} from "../../helpers/captacaoIndicacao";

const emptyForm = (tipo = "porteiro") => ({
  tipo,
  nomeContato: "",
  telefoneContato: "",
  emailContato: "",
  cep: "",
  enderecoImovel: "",
  bairro: "",
  cidade: "",
  estado: "SP",
  tipoImovel: "Apartamento",
  operacao: "Venda",
  nomeConstrutora: "",
  nomeCondominio: "",
  indicadoPor: "",
  aceitaCorretor: false,
  observacoes: "",
  status: "pendente",
});

const statusLabel = (id) =>
  CAPTACAO_STATUS_OPTIONS.find((s) => s.id === id)?.label || id || "—";

const statusChipClass = (id) => {
  switch (id) {
    case "pendente":
      return "realty-chip realty-chip--warn";
    case "em_andamento":
      return "realty-chip realty-chip--info";
    case "concluida":
      return "realty-chip realty-chip--ok";
    case "cancelada":
      return "realty-chip realty-chip--danger";
    default:
      return "realty-chip";
  }
};

const formatDateBR = (iso) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("pt-BR");
  } catch {
    return "—";
  }
};

const Captacao = () => {
  const history = useHistory();
  const [captacoes, setCaptacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("porteiro");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm("porteiro"));
  const [saving, setSaving] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await realtyService.listCaptacoes({ pageSize: 500 });
      setCaptacoes(data.captacoes || []);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const construtoras = useMemo(() => {
    const set = new Set();
    captacoes.forEach((c) => {
      if (c.nomeConstrutora) set.add(c.nomeConstrutora);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [captacoes]);

  const counts = useMemo(() => {
    const acc = {};
    CAPTACAO_TIPOS.forEach((t) => {
      acc[t.id] = captacoes.filter((c) => c.tipo === t.id).length;
    });
    return acc;
  }, [captacoes]);

  const filtered = useMemo(
    () => captacoes.filter((c) => c.tipo === activeTab),
    [captacoes, activeTab]
  );

  const kpis = useMemo(() => computeCaptacaoKpis(captacoes), [captacoes]);

  const rankingVenda = useMemo(
    () => rankCaptacaoByOperacao(captacoes, "Venda"),
    [captacoes]
  );
  const rankingLocacao = useMemo(
    () => rankCaptacaoByOperacao(captacoes, "Locação"),
    [captacoes]
  );

  const tipoLabel =
    CAPTACAO_TIPOS.find((t) => t.id === activeTab)?.label || activeTab;
  const formTipo = form.tipo || activeTab;
  const formTipoLabel =
    CAPTACAO_TIPOS.find((t) => t.id === formTipo)?.label || formTipo;

  const setField = (name, value) => setForm((f) => ({ ...f, [name]: value }));

  const buscarCep = async (cepVal) => {
    const clean = String(cepVal || "").replace(/\D/g, "");
    if (clean.length !== 8) return;
    setBuscandoCep(true);
    try {
      const resp = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const data = await resp.json();
      if (!data.erro) {
        setForm((f) => ({
          ...f,
          enderecoImovel: data.logradouro || f.enderecoImovel,
          bairro: data.bairro || f.bairro,
          cidade: data.localidade || f.cidade,
          estado: data.uf || f.estado || "SP",
        }));
      }
    } catch {
      /* silent — paridade Lovable */
    } finally {
      setBuscandoCep(false);
    }
  };

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm(activeTab));
    setFormOpen(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm(captacaoRecordToForm(item, activeTab));
    setFormOpen(true);
  };

  const closeForm = () => {
    if (saving) return;
    setFormOpen(false);
    setEditing(null);
  };

  const save = async (e) => {
    e.preventDefault();
    const tipo = form.tipo || activeTab;
    if (!isCaptacaoSubmittable({ tipo, nome: form.nomeContato, indicadoPor: form.indicadoPor })) {
      if (!String(form.nomeContato || "").trim()) {
        toast.error(`Informe o nome do ${formTipoLabel.toLowerCase()}`);
      } else if (tipo === "indicacao") {
        toast.error("Informe quem indicou");
      }
      return;
    }
    setSaving(true);
    try {
      const payload = buildCaptacaoSavePayload(form, activeTab);
      if (editing?.id) {
        await realtyService.updateCaptacao(editing.id, payload);
        toast.success("Captação atualizada!");
      } else {
        await realtyService.createCaptacao(payload);
        toast.success("Captação registrada!");
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

  const remove = async (item) => {
    if (!window.confirm(`Excluir captação de "${item.nomeContato}"? Esta ação não pode ser desfeita.`)) {
      return;
    }
    try {
      await realtyService.deleteCaptacao(item.id);
      toast.success("Captação excluída!");
      await load();
    } catch (err) {
      toastError(err);
    }
  };

  const renderRanking = (data, title) => {
    if (!data.length) return null;
    const maxCount = Math.max(...data.map((d) => d.count), 1);
    return (
      <article className="realty-card" style={{ padding: 16 }}>
        <h4 style={{ margin: "0 0 12px", fontSize: 14 }}>{title}</h4>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {data.slice(0, 8).map((item, i) => (
            <div key={item.canal} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, width: 20, color: "#737d8c" }}>
                {i + 1}.
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 2,
                    gap: 8,
                  }}
                >
                  <span style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {item.canal}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#2673d9" }}>
                    {item.count}
                  </span>
                </div>
                <div
                  style={{
                    height: 6,
                    background: "#e8eef6",
                    borderRadius: 999,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${(item.count / maxCount) * 100}%`,
                      background: "#2673d9",
                      borderRadius: 999,
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </article>
    );
  };

  const canSubmit = isCaptacaoSubmittable({
    tipo: formTipo,
    nome: form.nomeContato,
    indicadoPor: form.indicadoPor,
  });

  return (
    <MainContainer autoHeight>
      <div className="realty-page">
        <div className="realty-page__header">
          <div>
            <h1 className="realty-page__title">Captação de Imóveis</h1>
            <p className="realty-page__subtitle">
              {captacoes.length} captação{captacoes.length === 1 ? "" : "ões"} registrada
              {captacoes.length === 1 ? "" : "s"} — canais porteiro, construtor, construtora,
              síndico e indicação.
            </p>
          </div>
          <div className="realty-page__header-actions">
            <button
              type="button"
              className="realty-page__btn realty-page__btn--ghost"
              onClick={() => history.push("/proprietarios")}
            >
              Lista de Proprietários
            </button>
            <button type="button" className="realty-page__btn realty-page__btn--ghost" onClick={load}>
              {loading ? "Atualizando…" : "Atualizar"}
            </button>
            <button type="button" className="realty-page__btn" onClick={openNew}>
              Nova Captação
            </button>
          </div>
        </div>

        {captacoes.length > 0 && (
          <div className="realty-page__grid" style={{ marginBottom: 16 }}>
            <article className="realty-card">
              <p style={{ margin: 0, fontSize: 12 }}>Total</p>
              <h2 style={{ margin: "6px 0 0", fontSize: 28 }}>{kpis.total}</h2>
            </article>
            <article className="realty-card">
              <p style={{ margin: 0, fontSize: 12 }}>Pendentes</p>
              <h2 style={{ margin: "6px 0 0", fontSize: 28 }}>{kpis.pendentes}</h2>
            </article>
            <article className="realty-card">
              <p style={{ margin: 0, fontSize: 12 }}>Em andamento</p>
              <h2 style={{ margin: "6px 0 0", fontSize: 28 }}>{kpis.andamento}</h2>
            </article>
            <article className="realty-card">
              <p style={{ margin: 0, fontSize: 12 }}>Concluídas</p>
              <h2 style={{ margin: "6px 0 0", fontSize: 28 }}>{kpis.concluidas}</h2>
            </article>
            <article className="realty-card">
              <p style={{ margin: 0, fontSize: 12 }}>Conversão</p>
              <h2 style={{ margin: "6px 0 0", fontSize: 28 }}>{kpis.taxa}%</h2>
            </article>
          </div>
        )}

        {captacoes.length > 0 && (rankingVenda.length > 0 || rankingLocacao.length > 0) && (
          <div
            className="realty-page__grid"
            style={{ marginBottom: 16, gridTemplateColumns: "1fr 1fr" }}
          >
            {renderRanking(rankingVenda, "Ranking Captação — Venda")}
            {renderRanking(rankingLocacao, "Ranking Captação — Locação")}
          </div>
        )}

        <div className="realty-tabs" style={{ marginBottom: 16, flexWrap: "wrap" }}>
          {CAPTACAO_TIPOS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`realty-tab${activeTab === t.id ? " realty-tab--active" : ""}`}
              onClick={() => setActiveTab(t.id)}
            >
              {t.label}
              {counts[t.id] > 0 ? ` (${counts[t.id]})` : ""}
            </button>
          ))}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <p style={{ margin: 0, fontSize: 13, color: "#737d8c" }}>
            {filtered.length} captação{filtered.length === 1 ? "" : "ões"} via{" "}
            {tipoLabel.toLowerCase()}
          </p>
          <button type="button" className="realty-page__btn" onClick={openNew}>
            Nova Captação
          </button>
        </div>

        {loading && <div className="realty-empty">Carregando…</div>}

        {!loading && filtered.length === 0 && (
          <div className="realty-empty">
            <p>Nenhuma captação via {tipoLabel.toLowerCase()} registrada.</p>
            <button
              type="button"
              className="realty-page__btn realty-page__btn--ghost"
              style={{ marginTop: 12 }}
              onClick={openNew}
            >
              Registrar primeira captação
            </button>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="realty-card" style={{ overflowX: "auto", padding: 0 }}>
            <table className="realty-table" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "10px 12px", fontSize: 12 }}>Nome</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", fontSize: 12 }}>Telefone</th>
                  {(activeTab === "construtora" || activeTab === "construtor") && (
                    <th style={{ textAlign: "left", padding: "10px 12px", fontSize: 12 }}>
                      Construtora
                    </th>
                  )}
                  {activeTab === "sindico" && (
                    <th style={{ textAlign: "left", padding: "10px 12px", fontSize: 12 }}>
                      Condomínio
                    </th>
                  )}
                  {activeTab === "indicacao" && (
                    <th style={{ textAlign: "left", padding: "10px 12px", fontSize: 12 }}>
                      Indicado por
                    </th>
                  )}
                  <th style={{ textAlign: "left", padding: "10px 12px", fontSize: 12 }}>Endereço</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", fontSize: 12 }}>Bairro</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", fontSize: 12 }}>Status</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", fontSize: 12 }}>Data</th>
                  <th style={{ width: 120, padding: "10px 12px" }} />
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} style={{ borderTop: "1px solid #e8eef6" }}>
                    <td style={{ padding: "10px 12px", fontWeight: 600 }}>{c.nomeContato}</td>
                    <td style={{ padding: "10px 12px" }}>{c.telefoneContato || "—"}</td>
                    {(activeTab === "construtora" || activeTab === "construtor") && (
                      <td style={{ padding: "10px 12px" }}>{c.nomeConstrutora || "—"}</td>
                    )}
                    {activeTab === "sindico" && (
                      <td style={{ padding: "10px 12px" }}>{c.nomeCondominio || "—"}</td>
                    )}
                    {activeTab === "indicacao" && (
                      <td style={{ padding: "10px 12px", fontSize: 12 }}>
                        {extractIndicadoPor(c.observacoes) || "—"}
                      </td>
                    )}
                    <td
                      style={{
                        padding: "10px 12px",
                        maxWidth: 200,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {c.enderecoImovel || "—"}
                    </td>
                    <td style={{ padding: "10px 12px" }}>{c.bairro || "—"}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <span className={statusChipClass(c.status)}>{statusLabel(c.status)}</span>
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: 12, color: "#737d8c" }}>
                      {formatDateBR(c.createdAt)}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <div className="realty-card__actions" style={{ justifyContent: "flex-end" }}>
                        <button
                          type="button"
                          className="realty-page__btn realty-page__btn--ghost"
                          onClick={() => openEdit(c)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="realty-page__btn realty-page__btn--ghost"
                          onClick={() => remove(c)}
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {formOpen && (
          <div className="realty-modal-backdrop" onClick={closeForm}>
            <form
              className="realty-card realty-modal realty-form"
              onClick={(e) => e.stopPropagation()}
              onSubmit={save}
              style={{ maxWidth: 560, maxHeight: "90vh", overflowY: "auto" }}
            >
              <h3>
                {editing ? "Editar" : "Nova"} Captação via {formTipoLabel}
              </h3>

              <label>
                Nome do {formTipoLabel} *
                <input
                  value={form.nomeContato}
                  onChange={(e) => setField("nomeContato", e.target.value)}
                  placeholder={`Nome do ${formTipoLabel.toLowerCase()}`}
                  maxLength={100}
                  required
                />
              </label>

              {formTipo === "construtora" && (
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: 10,
                    borderRadius: 8,
                    background: "#f0fdf4",
                    border: "1px solid #bbf7d0",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={form.aceitaCorretor}
                    onChange={(e) => setField("aceitaCorretor", e.target.checked)}
                  />
                  <span style={{ fontSize: 12 }}>
                    Aceita qualquer corretor/imobiliária para vender ou alugar
                  </span>
                </label>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <label>
                  Telefone
                  <input
                    value={form.telefoneContato}
                    onChange={(e) => setField("telefoneContato", e.target.value)}
                    placeholder="(00) 00000-0000"
                  />
                </label>
                <label>
                  Email
                  <input
                    type="email"
                    value={form.emailContato}
                    onChange={(e) => setField("emailContato", e.target.value)}
                    placeholder="email@exemplo.com"
                  />
                </label>
              </div>

              {(formTipo === "construtora" || formTipo === "construtor") && (
                <label>
                  Nome da Construtora
                  <input
                    value={form.nomeConstrutora}
                    onChange={(e) => setField("nomeConstrutora", e.target.value)}
                    placeholder="Buscar ou digitar nome da construtora..."
                    list="captacao-construtoras-list"
                  />
                  <datalist id="captacao-construtoras-list">
                    {construtoras.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </label>
              )}

              {formTipo === "sindico" && (
                <label>
                  Nome do Condomínio
                  <input
                    value={form.nomeCondominio}
                    onChange={(e) => setField("nomeCondominio", e.target.value)}
                    placeholder="Nome do condomínio"
                  />
                </label>
              )}

              {formTipo === "indicacao" && (
                <div
                  style={{
                    padding: 12,
                    borderRadius: 8,
                    background: "#e8f0fc",
                    border: "1px solid #c5d8f5",
                    marginBottom: 4,
                  }}
                >
                  <label style={{ margin: 0 }}>
                    Indicado por *
                    <input
                      value={form.indicadoPor}
                      onChange={(e) => setField("indicadoPor", e.target.value)}
                      placeholder="Nome de quem indicou (cliente, parceiro, corretor...)"
                      required
                    />
                  </label>
                  <p style={{ margin: "6px 0 0", fontSize: 11, color: "#737d8c" }}>
                    Registramos a fonte da indicação para você reconhecer e recompensar quem traz
                    negócios.
                  </p>
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
                <label>
                  CEP
                  <input
                    value={form.cep}
                    onChange={(e) => {
                      const v = e.target.value;
                      setField("cep", v);
                      if (String(v).replace(/\D/g, "").length === 8) buscarCep(v);
                    }}
                    placeholder="70000-000"
                    maxLength={9}
                  />
                  {buscandoCep && (
                    <span style={{ fontSize: 11, color: "#737d8c" }}>Buscando CEP…</span>
                  )}
                </label>
                <label>
                  Endereço do Imóvel
                  <input
                    value={form.enderecoImovel}
                    onChange={(e) => setField("enderecoImovel", e.target.value)}
                    placeholder="Endereço"
                  />
                </label>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <label>
                  Bairro
                  <input
                    value={form.bairro}
                    onChange={(e) => setField("bairro", e.target.value)}
                    placeholder="Bairro"
                  />
                </label>
                <label>
                  Cidade
                  <input
                    value={form.cidade}
                    onChange={(e) => setField("cidade", e.target.value)}
                    placeholder="Cidade"
                  />
                </label>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <label>
                  Tipo
                  <select
                    value={form.tipoImovel}
                    onChange={(e) => setField("tipoImovel", e.target.value)}
                  >
                    {CAPTACAO_TIPOS_IMOVEL.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Operação
                  <select
                    value={form.operacao}
                    onChange={(e) => setField("operacao", e.target.value)}
                  >
                    {CAPTACAO_OPERACOES.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Status
                  <select value={form.status} onChange={(e) => setField("status", e.target.value)}>
                    {CAPTACAO_STATUS_OPTIONS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label>
                Observações
                <textarea
                  rows={3}
                  value={form.observacoes}
                  onChange={(e) => setField("observacoes", e.target.value)}
                  placeholder="Informações adicionais..."
                />
              </label>

              <div className="realty-card__actions">
                <button
                  type="button"
                  className="realty-page__btn realty-page__btn--ghost"
                  onClick={closeForm}
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button type="submit" className="realty-page__btn" disabled={saving || !canSubmit}>
                  {saving
                    ? "Salvando…"
                    : editing
                      ? "Salvar Alterações"
                      : "Registrar Captação"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </MainContainer>
  );
};

export default Captacao;
