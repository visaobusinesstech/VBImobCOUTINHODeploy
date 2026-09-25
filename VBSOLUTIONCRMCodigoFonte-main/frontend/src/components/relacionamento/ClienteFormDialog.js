/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * Formulário Novo/Editar Cliente — paridade Lovable Relacionamento (inputs + UX).
 * Visual: design system realty VBSolution (fundo sólido, sem transparência).
 */

import React, { useEffect, useState } from "react";
import { Baby, Loader2, Plus, Trash2, X } from "lucide-react";
import {
  buildClientePayload,
  clienteFromApi,
  emptyClienteForm,
} from "../../helpers/relacionamentoCrm";

const ClienteFormDialog = ({ open, onOpenChange, cliente, onSave, saving }) => {
  const [form, setForm] = useState(emptyClienteForm());
  const isEdit = !!cliente?.id;

  useEffect(() => {
    if (!open) return;
    if (cliente) setForm(clienteFromApi(cliente));
    else setForm(emptyClienteForm());
  }, [open, cliente]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  if (!open) return null;

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const addFilho = () =>
    setForm((f) => ({ ...f, filhos: [...f.filhos, { nome: "", dataNascimento: "" }] }));

  const removeFilho = (i) =>
    setForm((f) => ({ ...f, filhos: f.filhos.filter((_, idx) => idx !== i) }));

  const updateFilho = (i, key, val) =>
    setForm((f) => ({
      ...f,
      filhos: f.filhos.map((fi, idx) => (idx === i ? { ...fi, [key]: val } : fi)),
    }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.nome.trim()) return;
    onSave(buildClientePayload(form));
  };

  const close = () => onOpenChange(false);

  return (
    <div
      className="realty-modal-backdrop"
      role="presentation"
      /* Paridade Lovable: não fecha ao clicar fora (preserva dados do form) */
      onClick={(e) => e.stopPropagation()}
    >
      <form
        className="realty-modal realty-form realty-rel-modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rel-cliente-dialog-title"
      >
        <div className="realty-modal__head">
          <h3 id="rel-cliente-dialog-title">{isEdit ? "Editar Cliente" : "Novo Cliente"}</h3>
          <button type="button" className="realty-modal__close" onClick={close} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <div className="realty-rel-form">
          <label className="realty-rel-form__field">
            <span>Nome *</span>
            <input
              value={form.nome}
              onChange={(e) => set("nome", e.target.value)}
              placeholder="Nome completo"
              required
              autoFocus
            />
          </label>

          <div className="realty-prop-grid realty-prop-grid--2">
            <label className="realty-rel-form__field">
              <span>Telefone</span>
              <input
                value={form.telefone}
                onChange={(e) => set("telefone", e.target.value)}
                placeholder="(11) 99999-0000"
                inputMode="tel"
              />
            </label>
            <label className="realty-rel-form__field">
              <span>E-mail</span>
              <input
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="email@exemplo.com"
              />
            </label>
          </div>

          <div className="realty-prop-grid realty-prop-grid--2">
            <label className="realty-rel-form__field">
              <span>Data de Nascimento</span>
              <input
                type="date"
                value={form.aniversario}
                onChange={(e) => set("aniversario", e.target.value)}
              />
            </label>
            <label className="realty-rel-form__field">
              <span>Data de Casamento</span>
              <input
                type="date"
                value={form.dataCasamento}
                onChange={(e) => set("dataCasamento", e.target.value)}
              />
            </label>
          </div>

          <div className="realty-prop-grid realty-prop-grid--2">
            <label className="realty-rel-form__field">
              <span>Profissão</span>
              <input
                value={form.profissao}
                onChange={(e) => set("profissao", e.target.value)}
                placeholder="Ex: Engenheiro"
              />
            </label>
            <label className="realty-rel-form__field">
              <span>Dia da Profissão</span>
              <input
                type="date"
                value={form.dataProfissao}
                onChange={(e) => set("dataProfissao", e.target.value)}
              />
            </label>
          </div>

          <div className="realty-prop-grid realty-prop-grid--2">
            <label className="realty-rel-form__field">
              <span>Data de Mudança</span>
              <input
                type="date"
                value={form.dataMudanca}
                onChange={(e) => set("dataMudanca", e.target.value)}
              />
            </label>
            <label className="realty-rel-form__field">
              <span>Data de Compra do Imóvel</span>
              <input
                type="date"
                value={form.dataCompraImovel}
                onChange={(e) => set("dataCompraImovel", e.target.value)}
              />
            </label>
          </div>

          <div className="realty-rel-filhos">
            <div className="realty-rel-filhos__head">
              <span className="realty-rel-label" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Baby size={14} /> Filhos
              </span>
              <button type="button" className="realty-page__btn realty-page__btn--ghost" onClick={addFilho}>
                <Plus size={14} /> Adicionar
              </button>
            </div>
            {form.filhos.map((f, i) => (
              <div key={i} className="realty-rel-filho-row">
                <label className="realty-rel-form__field">
                  <span className="realty-rel-form__hint">Nome</span>
                  <input
                    value={f.nome}
                    onChange={(e) => updateFilho(i, "nome", e.target.value)}
                    placeholder="Nome do filho"
                  />
                </label>
                <label className="realty-rel-form__field">
                  <span className="realty-rel-form__hint">Data de Nascimento</span>
                  <input
                    type="date"
                    value={f.dataNascimento}
                    onChange={(e) => updateFilho(i, "dataNascimento", e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className="realty-prop-icon-btn realty-prop-icon-btn--danger"
                  onClick={() => removeFilho(i)}
                  title="Remover"
                  aria-label="Remover filho"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          <label className="realty-rel-form__field">
            <span>Observações</span>
            <input
              value={form.observacoes}
              onChange={(e) => set("observacoes", e.target.value)}
              placeholder="Anotações..."
            />
          </label>
        </div>

        <div className="realty-modal__footer">
          <button type="button" className="realty-page__btn realty-page__btn--ghost" onClick={close}>
            Cancelar
          </button>
          <button type="submit" className="realty-page__btn" disabled={saving || !form.nome.trim()}>
            {saving ? <Loader2 size={16} className="realty-spin" /> : null}
            {isEdit ? "Salvar" : "Adicionar"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ClienteFormDialog;
