/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 *
 * Modal Nova/Editar Proposta — paridade com Radarimobtech / Lovable.
 */

import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  STATUS_PROPOSTA,
  FORMAS_PAGAMENTO,
  parseCurrencyInput,
  formatCurrencyInput,
} from "../../helpers/realtyCrm";

const defaultForm = {
  imovelId: "",
  clienteNome: "",
  clienteTelefone: "",
  clienteEmail: "",
  value: "",
  paymentMethod: "a_vista",
  status: "em_negociacao",
  prazoContrato: "",
  conditions: "",
  notes: "",
  leadSaleId: "",
};

const PropostaFormDialog = ({
  open,
  onClose,
  proposta,
  imoveis = [],
  onSave,
  saving = false,
}) => {
  const [form, setForm] = useState(defaultForm);

  useEffect(() => {
    if (!open) return;
    if (proposta) {
      setForm({
        imovelId: proposta.imovelId != null ? String(proposta.imovelId) : "",
        clienteNome: proposta.clienteNome || proposta.title || "",
        clienteTelefone: proposta.clienteTelefone || "",
        clienteEmail: proposta.clienteEmail || "",
        value: formatCurrencyInput(proposta.value),
        paymentMethod: proposta.paymentMethod || "a_vista",
        status: proposta.status || "em_negociacao",
        prazoContrato: proposta.prazoContrato || "",
        conditions: proposta.conditions || "",
        notes: proposta.notes || "",
        leadSaleId: proposta.leadSaleId != null ? String(proposta.leadSaleId) : "",
      });
    } else {
      setForm({ ...defaultForm });
    }
  }, [open, proposta]);

  if (!open) return null;

  const set = (key, val) => setForm((prev) => ({ ...prev, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    await onSave({
      imovelId: form.imovelId ? Number(form.imovelId) : null,
      clienteNome: form.clienteNome.trim(),
      title: form.clienteNome.trim(),
      clienteTelefone: form.clienteTelefone.trim() || null,
      clienteEmail: form.clienteEmail.trim() || null,
      value: parseCurrencyInput(form.value),
      paymentMethod: form.paymentMethod,
      status: form.status,
      prazoContrato: form.prazoContrato.trim() || null,
      conditions: form.conditions.trim() || null,
      notes: form.notes.trim() || null,
      leadSaleId: form.leadSaleId ? Number(form.leadSaleId) : null,
    });
  };

  return (
    <div className="realty-modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="realty-card realty-modal realty-modal--proposta"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="proposta-dialog-title"
      >
        <h3 id="proposta-dialog-title">{proposta ? "Editar Proposta" : "Nova Proposta"}</h3>
        <form className="realty-proposta-form" onSubmit={handleSubmit}>
          <label>
            Imóvel
            <select
              value={form.imovelId}
              onChange={(e) => set("imovelId", e.target.value)}
            >
              <option value="">Selecione o imóvel</option>
              {imoveis.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.title || `Imóvel #${i.id}`}
                </option>
              ))}
            </select>
          </label>

          <label>
            Nome do Cliente *
            <input
              value={form.clienteNome}
              onChange={(e) => set("clienteNome", e.target.value)}
              required
            />
          </label>

          <div className="realty-proposta-form__row">
            <label>
              Telefone
              <input
                value={form.clienteTelefone}
                onChange={(e) => set("clienteTelefone", e.target.value)}
              />
            </label>
            <label>
              Email
              <input
                type="email"
                value={form.clienteEmail}
                onChange={(e) => set("clienteEmail", e.target.value)}
              />
            </label>
          </div>

          <div className="realty-proposta-form__row">
            <label>
              Valor (R$) *
              <input
                value={form.value}
                inputMode="decimal"
                placeholder="0,00"
                required
                onChange={(e) =>
                  set("value", e.target.value.replace(/[^\d.,]/g, ""))
                }
              />
            </label>
            <label>
              Forma de Pagamento
              <select
                value={form.paymentMethod}
                onChange={(e) => set("paymentMethod", e.target.value)}
              >
                {FORMAS_PAGAMENTO.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="realty-proposta-form__row">
            <label>
              Status
              <select
                value={form.status}
                onChange={(e) => set("status", e.target.value)}
              >
                {STATUS_PROPOSTA.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Prazo do Contrato
              <input
                value={form.prazoContrato}
                placeholder="Ex: 30 meses"
                onChange={(e) => set("prazoContrato", e.target.value)}
              />
            </label>
          </div>

          <label>
            Condições Especiais de Negociação
            <textarea
              rows={2}
              value={form.conditions}
              placeholder="Ex: Entrada de 20% + financiamento, mobília inclusa..."
              onChange={(e) => set("conditions", e.target.value)}
            />
          </label>

          <label>
            Observações
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </label>

          <div className="realty-proposta-form__actions">
            <button
              type="button"
              className="realty-page__btn realty-page__btn--ghost"
              onClick={onClose}
              disabled={saving}
            >
              Cancelar
            </button>
            <button type="submit" className="realty-page__btn" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 size={14} className="animate-spin" style={{ marginRight: 6 }} />
                  {proposta ? "Salvar" : "Registrar"}
                </>
              ) : proposta ? (
                "Salvar"
              ) : (
                "Registrar"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PropostaFormDialog;
