/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * Follow-up na agenda — campos 1:1 com Lovable FollowupFormDialog (lead).
 */

import React, { useEffect, useState } from "react";
import { FOLLOWUP_AGENDA_TIPOS } from "../../helpers/realtyCrm";

export default function FollowupAgendaDialog({
  open,
  onOpenChange,
  leads,
  onSave,
  saving,
  editingFollowup,
}) {
  const [leadId, setLeadId] = useState("");
  const [data, setData] = useState("");
  const [tipo, setTipo] = useState("ligacao");
  const [descricao, setDescricao] = useState("");
  const [resultado, setResultado] = useState("");
  const isEditing = !!editingFollowup;

  useEffect(() => {
    if (!open) return;
    if (editingFollowup) {
      setLeadId(editingFollowup.leadSaleId ? String(editingFollowup.leadSaleId) : "");
      const d = editingFollowup.scheduledAt
        ? String(editingFollowup.scheduledAt).slice(0, 10)
        : new Date().toISOString().slice(0, 10);
      setData(d);
      setTipo(editingFollowup.type || "ligacao");
      setDescricao(editingFollowup.notes || "");
      setResultado(editingFollowup.result || "");
    } else {
      setLeadId("");
      setData(new Date().toISOString().slice(0, 10));
      setTipo("ligacao");
      setDescricao("");
      setResultado("");
    }
  }, [open, editingFollowup]);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!leadId || !data) return;
    await onSave({
      ...(isEditing ? { id: editingFollowup.id } : {}),
      leadSaleId: Number(leadId),
      scheduledAt: new Date(`${data}T09:00:00`).toISOString(),
      type: tipo,
      notes: descricao || null,
      result: resultado || null,
      status: editingFollowup?.status || "pendente",
    });
  };

  return (
    <div className="realty-modal-backdrop" onClick={() => onOpenChange(false)}>
      <form
        className="realty-card realty-modal realty-form agenda-form"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h3>{isEditing ? "Editar Follow-up" : "Agendar Follow-up"}</h3>

        <label>
          Lead
          <select required value={leadId} onChange={(e) => setLeadId(e.target.value)}>
            <option value="">Selecione o lead</option>
            {leads.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>

        <div className="agenda-form__row">
          <label>
            Data
            <input type="date" required value={data} onChange={(e) => setData(e.target.value)} />
          </label>
          <label>
            Tipo
            <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
              {FOLLOWUP_AGENDA_TIPOS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label>
          Observação
          <textarea
            rows={2}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Lembrete sobre o contato..."
          />
        </label>

        {isEditing && (
          <label>
            O que foi feito? (Resultado)
            <textarea
              rows={3}
              value={resultado}
              onChange={(e) => setResultado(e.target.value)}
              placeholder="Descreva o que foi realizado neste follow-up..."
            />
          </label>
        )}

        <div className="realty-card__actions">
          <button
            type="button"
            className="realty-page__btn realty-page__btn--ghost"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="realty-page__btn"
            disabled={saving || !leadId || !data}
          >
            {saving ? "Salvando..." : isEditing ? "Salvar" : "Agendar"}
          </button>
        </div>
      </form>
    </div>
  );
}
