/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * Formulário Novo/Editar Compromisso — campos 1:1 com Lovable CompromissoFormDialog.
 */

import React, { useEffect, useState } from "react";
import {
  TIPOS_COMPROMISSO,
  COMPROMISSO_PRIORIDADE_OPTIONS,
} from "../../helpers/realtyCrm";

const toDatePart = (iso) => {
  if (!iso) return new Date().toISOString().slice(0, 10);
  const s = String(iso);
  if (s.length >= 10) return s.slice(0, 10);
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
};

const toTimePart = (iso, fallback) => {
  if (!iso) return fallback;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return fallback;
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch {
    return fallback;
  }
};

const emptyForm = (defaultDate) => ({
  titulo: "",
  tipo: "reuniao",
  dataInicio: defaultDate || new Date().toISOString().slice(0, 10),
  horaInicio: "09:00",
  horaFim: "10:00",
  local: "",
  descricao: "",
  leadId: "__none__",
  corretorId: "__none__",
  lembreteWhatsapp: false,
  telefoneLembrete: "",
  prioridade: "media",
  emailCliente: "",
  googleMapsLink: "",
});

export default function CompromissoFormDialog({
  open,
  onOpenChange,
  leads,
  corretores,
  defaultDate,
  onSave,
  saving,
  editingCompromisso,
}) {
  const [form, setForm] = useState(emptyForm(defaultDate));
  const isEditing = !!editingCompromisso;

  useEffect(() => {
    if (!open) return;
    if (editingCompromisso) {
      setForm({
        titulo: editingCompromisso.title || "",
        tipo: editingCompromisso.tipo || "reuniao",
        dataInicio: toDatePart(editingCompromisso.dataInicio),
        horaInicio: toTimePart(editingCompromisso.dataInicio, "09:00"),
        horaFim: toTimePart(editingCompromisso.dataFim, "10:00"),
        local: editingCompromisso.local || "",
        descricao: editingCompromisso.description || "",
        leadId: editingCompromisso.leadSaleId
          ? String(editingCompromisso.leadSaleId)
          : "__none__",
        corretorId: editingCompromisso.userId
          ? String(editingCompromisso.userId)
          : "__none__",
        lembreteWhatsapp: Boolean(editingCompromisso.lembreteWhatsapp),
        telefoneLembrete: editingCompromisso.telefoneLembrete || "",
        prioridade: editingCompromisso.prioridade || "media",
        emailCliente: editingCompromisso.emailCliente || "",
        googleMapsLink: editingCompromisso.googleMapsLink || "",
      });
    } else {
      setForm(emptyForm(defaultDate));
    }
  }, [open, defaultDate, editingCompromisso]);

  if (!open) return null;

  const set = (key, val) => setForm((p) => ({ ...p, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.titulo || !form.dataInicio) return;
    const dataInicio = new Date(`${form.dataInicio}T${form.horaInicio}:00`).toISOString();
    const dataFim = new Date(`${form.dataInicio}T${form.horaFim}:00`).toISOString();
    await onSave({
      ...(isEditing ? { id: editingCompromisso.id } : {}),
      title: form.titulo,
      tipo: form.tipo,
      dataInicio,
      dataFim,
      local: form.local || null,
      description: form.descricao || null,
      leadSaleId:
        !form.leadId || form.leadId === "__none__" ? null : Number(form.leadId),
      userId:
        !form.corretorId || form.corretorId === "__none__"
          ? null
          : Number(form.corretorId),
      lembreteWhatsapp: form.lembreteWhatsapp,
      telefoneLembrete: form.telefoneLembrete || null,
      prioridade: form.prioridade,
      emailCliente: form.emailCliente || null,
      googleMapsLink: form.googleMapsLink || null,
    });
  };

  return (
    <div className="realty-modal-backdrop" onClick={() => onOpenChange(false)}>
      <form
        className="realty-card realty-modal realty-form agenda-form"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h3>{isEditing ? "Editar Compromisso" : "Novo Compromisso"}</h3>

        <label>
          Título
          <input
            required
            value={form.titulo}
            onChange={(e) => set("titulo", e.target.value)}
            placeholder="Ex: Visita ao apartamento..."
          />
        </label>

        <div className="agenda-form__row">
          <label>
            Tipo
            <select value={form.tipo} onChange={(e) => set("tipo", e.target.value)}>
              {TIPOS_COMPROMISSO.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.emoji} {t.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Data
            <input
              type="date"
              required
              value={form.dataInicio}
              onChange={(e) => set("dataInicio", e.target.value)}
            />
          </label>
        </div>

        <div className="agenda-form__row">
          <label>
            Hora início
            <input
              type="time"
              value={form.horaInicio}
              onChange={(e) => set("horaInicio", e.target.value)}
            />
          </label>
          <label>
            Hora fim
            <input
              type="time"
              value={form.horaFim}
              onChange={(e) => set("horaFim", e.target.value)}
            />
          </label>
        </div>

        <div className="agenda-form__row">
          <label>
            Local
            <input
              value={form.local}
              onChange={(e) => set("local", e.target.value)}
              placeholder="Endereço ou link da reunião..."
            />
          </label>
          <label>
            Prioridade
            <select
              value={form.prioridade}
              onChange={(e) => set("prioridade", e.target.value)}
            >
              {COMPROMISSO_PRIORIDADE_OPTIONS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id === "alta" ? "🔴" : p.id === "baixa" ? "🟢" : "🟡"} {p.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label>
          Link Google Maps (opcional)
          <input
            value={form.googleMapsLink}
            onChange={(e) => set("googleMapsLink", e.target.value)}
            placeholder="https://maps.google.com/..."
          />
        </label>

        <label>
          E-mail do cliente (opcional)
          <input
            type="email"
            value={form.emailCliente}
            onChange={(e) => set("emailCliente", e.target.value)}
            placeholder="cliente@email.com"
          />
        </label>

        <div className="agenda-form__row">
          <label>
            Lead (opcional)
            <select value={form.leadId} onChange={(e) => set("leadId", e.target.value)}>
              <option value="__none__">Nenhum</option>
              {leads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Corretor (opcional)
            <select
              value={form.corretorId}
              onChange={(e) => set("corretorId", e.target.value)}
            >
              <option value="__none__">Nenhum</option>
              {corretores.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label>
          Observações
          <textarea
            rows={2}
            value={form.descricao}
            onChange={(e) => set("descricao", e.target.value)}
            placeholder="Detalhes do compromisso..."
          />
        </label>

        <div className="agenda-switch-row">
          <div>
            <strong>Lembrete WhatsApp</strong>
            <p>Enviar link de lembrete via WhatsApp</p>
          </div>
          <label className="agenda-switch">
            <input
              type="checkbox"
              checked={form.lembreteWhatsapp}
              onChange={(e) => set("lembreteWhatsapp", e.target.checked)}
            />
            <span />
          </label>
        </div>

        {form.lembreteWhatsapp && (
          <label>
            Telefone para lembrete
            <input
              value={form.telefoneLembrete}
              onChange={(e) => set("telefoneLembrete", e.target.value)}
              placeholder="(11) 99999-9999"
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
            disabled={saving || !form.titulo || !form.dataInicio}
          >
            {saving ? "Salvando..." : isEditing ? "Salvar" : "Agendar"}
          </button>
        </div>
      </form>
    </div>
  );
}
