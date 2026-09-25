/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 *
 * Modal criar/editar Follow-up — stepper estilo Campanha:
 * 1) Destinatário  2) Mensagem (pronta / template / Meta)  3) Agendamento / recorrência
 */

import React, { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  FOLLOWUP_MENSAGENS_PRONTAS,
  FOLLOWUP_STATUS_OPTIONS,
  FOLLOWUP_TIPO_LABELS,
} from "../../helpers/realtyCrm";
import MetaOfficialTemplateSelector from "../MetaOfficial/MetaOfficialTemplateSelector";
import DestinatariosPicker, { normalizePhone } from "../DestinatariosPicker";
import api from "../../services/api";
import { toast } from "react-toastify";

const STEPS = ["Destinatário", "Mensagem", "Agendamento"];

const DAYS_OF_WEEK = [
  { value: 0, label: "Dom" },
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sáb" },
];

const RECURRENCE_TYPES = [
  { value: "daily", label: "Diário", unit: "dia(s)" },
  { value: "weekly", label: "Semanal", unit: "semana(s)" },
  { value: "biweekly", label: "Quinzenal", unit: "quinzena(s)" },
  { value: "monthly", label: "Mensal", unit: "mês(es)" },
  { value: "yearly", label: "Anual", unit: "ano(s)" },
];

const normalizeRecurrenceType = (raw) => {
  const t = String(raw || "daily").toLowerCase();
  if (t === "dias" || t === "dia" || t === "daily") return "daily";
  if (t === "semanas" || t === "semana" || t === "weekly") return "weekly";
  if (t === "biweekly" || t === "quinzenal" || t === "quinzena") return "biweekly";
  if (t === "meses" || t === "mes" || t === "monthly") return "monthly";
  if (t === "yearly" || t === "anual" || t === "ano" || t === "anos") return "yearly";
  return "daily";
};

const parseRecurrenceDays = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(Number).filter((n) => Number.isFinite(n));
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(Number).filter((n) => Number.isFinite(n));
  } catch {
    /* ignore */
  }
  return String(raw)
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n));
};

const previewNextDates = (scheduledAt, type, interval, count = 5) => {
  if (!scheduledAt) return [];
  const out = [];
  let cursor = new Date(scheduledAt);
  const step = Math.max(1, Number(interval) || 1);
  const t = normalizeRecurrenceType(type);
  for (let i = 0; i < count; i += 1) {
    const next = new Date(cursor);
    if (t === "weekly") next.setDate(next.getDate() + 7 * step);
    else if (t === "biweekly") next.setDate(next.getDate() + 14 * step);
    else if (t === "monthly") next.setMonth(next.getMonth() + step);
    else if (t === "yearly") next.setFullYear(next.getFullYear() + step);
    else next.setDate(next.getDate() + step);
    out.push(next);
    cursor = next;
  }
  return out;
};

const formatPreviewDate = (d) =>
  d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const toLocalInput = (iso) => {
  if (!iso) {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  }
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

const emptyForm = {
  alvo: "lead",
  leadSaleId: "",
  contratoId: "",
  type: "whatsapp",
  status: "pendente",
  scheduledAt: toLocalInput(),
  notes: "",
  result: "",
  messageMode: "pronta",
  messageBody: FOLLOWUP_MENSAGENS_PRONTAS[0],
  messageTemplateId: "",
  whatsappId: "",
  metaTemplateQuickMessageId: null,
  metaTemplateVariables: null,
  sendNow: false,
  recurrenceEnabled: false,
  recurrenceType: "daily",
  recurrenceInterval: 1,
  recurrenceDaysOfWeek: [],
};

const FollowupFormModal = ({
  open,
  onClose,
  onSave,
  saving = false,
  followup = null,
  leads = [],
  contratos = [],
  templates = [],
}) => {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(emptyForm);
  const [whatsapps, setWhatsapps] = useState([]);
  const [metaTemplateSelection, setMetaTemplateSelection] = useState(null);
  const [selectedRecipients, setSelectedRecipients] = useState([]);
  const [showRecurrencePreview, setShowRecurrencePreview] = useState(false);

  useEffect(() => {
    if (!open) return;
    api
      .get("/whatsapp", { params: { session: 0 } })
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : res.data?.whatsapps || [];
        setWhatsapps(
          list.filter((w) => w.channel === "whatsapp" || w.channel === "whatsapp_oficial")
        );
      })
      .catch(() => setWhatsapps([]));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setShowRecurrencePreview(false);
    if (followup) {
      const metaSel = followup.metaTemplateQuickMessageId
        ? { quickMessageId: followup.metaTemplateQuickMessageId }
        : null;
      setMetaTemplateSelection(metaSel);
      setForm({
        alvo: followup.contratoId ? "contrato" : "lead",
        leadSaleId: followup.leadSaleId != null ? String(followup.leadSaleId) : "",
        contratoId: followup.contratoId != null ? String(followup.contratoId) : "",
        type: followup.type || "whatsapp",
        status: followup.status || "pendente",
        scheduledAt: toLocalInput(followup.scheduledAt),
        notes: followup.notes || "",
        result: followup.result || "",
        messageMode: followup.messageMode || "pronta",
        messageBody: followup.messageBody || FOLLOWUP_MENSAGENS_PRONTAS[0],
        messageTemplateId:
          followup.messageTemplateId != null ? String(followup.messageTemplateId) : "",
        whatsappId: followup.whatsappId != null ? String(followup.whatsappId) : "",
        metaTemplateQuickMessageId: followup.metaTemplateQuickMessageId || null,
        metaTemplateVariables: followup.metaTemplateVariables
          ? (() => {
              try {
                return JSON.parse(followup.metaTemplateVariables);
              } catch {
                return null;
              }
            })()
          : null,
        sendNow: false,
        recurrenceEnabled: !!followup.recurrenceEnabled,
        recurrenceType: normalizeRecurrenceType(followup.recurrenceType),
        recurrenceInterval: followup.recurrenceInterval || 1,
        recurrenceDaysOfWeek: parseRecurrenceDays(followup.recurrenceDays),
      });
      if (followup.leadSaleId) {
        const lead = (leads || []).find((l) => Number(l.id) === Number(followup.leadSaleId));
        setSelectedRecipients([
          {
            id: lead?.contactId || followup.leadSaleId,
            contactId: lead?.contactId || null,
            leadSaleId: followup.leadSaleId,
            name: lead?.name || followup.leadNome || `Lead #${followup.leadSaleId}`,
            number: lead?.phone || "",
            email: lead?.email || "",
            tags: [],
            source: "lead",
          },
        ]);
      } else {
        setSelectedRecipients([]);
      }
    } else {
      setMetaTemplateSelection(null);
      setForm({ ...emptyForm, scheduledAt: toLocalInput() });
      setSelectedRecipients([]);
    }
  }, [open, followup, leads]);

  const selectedWa = useMemo(
    () => whatsapps.find((w) => Number(w.id) === Number(form.whatsappId)),
    [whatsapps, form.whatsappId]
  );
  const isOficial = selectedWa?.channel === "whatsapp_oficial";

  if (!open) return null;

  const set = (key, val) => setForm((prev) => ({ ...prev, [key]: val }));

  const activeContratos = contratos.filter(
    (c) =>
      !["inativo", "cancelado", "encerrado", "finalizado", "distratado"].includes(
        String(c.status || "").toLowerCase()
      )
  );

  const resolveLeadId = (recipient) => {
    if (recipient?.leadSaleId) return Number(recipient.leadSaleId);
    const byContact = (leads || []).find(
      (l) => recipient?.contactId && Number(l.contactId) === Number(recipient.contactId)
    );
    if (byContact) return Number(byContact.id);
    const phone = normalizePhone(recipient?.number);
    if (phone) {
      const byPhone = (leads || []).find((l) => normalizePhone(l.phone) === phone);
      if (byPhone) return Number(byPhone.id);
    }
    return null;
  };

  const validateStep = (overrides = {}) => {
    const snapshot = { ...form, ...overrides };
    if (step === 0) {
      if (snapshot.alvo === "lead") {
        if (!selectedRecipients.length) {
          toast.error("Selecione ao menos um destinatário");
          return false;
        }
        const unresolved = selectedRecipients.filter((r) => !resolveLeadId(r));
        if (unresolved.length === selectedRecipients.length) {
          toast.error(
            "Nenhum contato selecionado está vinculado a um lead. Vincule o contato a um lead ou escolha público-alvo."
          );
          return false;
        }
        if (unresolved.length > 0) {
          toast.warning(
            `${unresolved.length} contato(s) sem lead serão ignorados.`
          );
        }
      }
      if (snapshot.alvo === "contrato" && !snapshot.contratoId) {
        toast.error("Selecione o contrato destinatário");
        return false;
      }
    }
    if (step === 1 && snapshot.type === "whatsapp") {
      if (!snapshot.whatsappId) {
        toast.error("Selecione a conexão WhatsApp");
        return false;
      }
      if (isOficial && !(metaTemplateSelection?.quickMessageId || snapshot.metaTemplateQuickMessageId)) {
        toast.error("WhatsApp API Oficial exige template Meta aprovado (igual às campanhas)");
        return false;
      }
      if (!isOficial && snapshot.messageMode === "template" && !snapshot.messageTemplateId) {
        toast.error("Selecione um template de mensagem");
        return false;
      }
      if (!isOficial && snapshot.messageMode !== "template" && !String(snapshot.messageBody || "").trim()) {
        toast.error("Informe a mensagem");
        return false;
      }
    }
    if (step === 2) {
      if (!snapshot.sendNow && !snapshot.scheduledAt) {
        toast.error("Informe data/hora do follow-up ou escolha Enviar agora");
        return false;
      }
      if (snapshot.recurrenceEnabled && !snapshot.recurrenceType) {
        toast.error("Selecione o tipo de recorrência");
        return false;
      }
      if (
        snapshot.recurrenceEnabled &&
        snapshot.recurrenceType === "weekly" &&
        !(snapshot.recurrenceDaysOfWeek || []).length
      ) {
        toast.error("Selecione ao menos um dia da semana");
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (!validateStep()) return;
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };

  const buildPayloadBase = () => {
    let messageBody = form.messageBody;
    if (form.messageMode === "template" && form.messageTemplateId) {
      const tpl = templates.find((t) => Number(t.id) === Number(form.messageTemplateId));
      if (tpl) messageBody = tpl.message;
    }

    const metaId =
      metaTemplateSelection?.quickMessageId || form.metaTemplateQuickMessageId || null;
    const metaVars =
      metaTemplateSelection?.variables || form.metaTemplateVariables || null;

    return {
      type: form.type,
      status: form.status,
      scheduledAt: form.sendNow
        ? new Date().toISOString()
        : new Date(form.scheduledAt).toISOString(),
      notes: form.notes || null,
      result: form.result || null,
      messageMode: isOficial ? "meta_template" : form.messageMode,
      messageBody: isOficial ? messageBody || null : messageBody,
      messageTemplateId:
        !isOficial && form.messageMode === "template" && form.messageTemplateId
          ? Number(form.messageTemplateId)
          : null,
      whatsappId: form.whatsappId ? Number(form.whatsappId) : null,
      metaTemplateQuickMessageId: isOficial ? metaId : null,
      metaTemplateVariables:
        isOficial && metaVars
          ? typeof metaVars === "string"
            ? metaVars
            : JSON.stringify(metaVars)
          : null,
      sendNow: !!form.sendNow,
      recurrenceEnabled: !!form.recurrenceEnabled,
      recurrenceType: form.recurrenceEnabled ? form.recurrenceType : null,
      recurrenceInterval: form.recurrenceEnabled ? Number(form.recurrenceInterval) || 1 : null,
      recurrenceDays:
        form.recurrenceEnabled && form.recurrenceType === "weekly"
          ? JSON.stringify(form.recurrenceDaysOfWeek || [])
          : null,
    };
  };

  const handleSubmit = async (e, { forceSendNow } = {}) => {
    if (e?.preventDefault) e.preventDefault();
    const sendNow = forceSendNow != null ? !!forceSendNow : !!form.sendNow;
    if (!validateStep({ sendNow })) return;

    const base = {
      ...buildPayloadBase(),
      sendNow,
      scheduledAt: sendNow
        ? new Date().toISOString()
        : new Date(form.scheduledAt || Date.now()).toISOString(),
    };

    if (followup?.id) {
      const leadSaleId =
        form.alvo === "lead"
          ? resolveLeadId(selectedRecipients[0]) || Number(form.leadSaleId) || null
          : null;
      await onSave({
        id: followup.id,
        ...base,
        leadSaleId,
        contratoId: form.alvo === "contrato" ? Number(form.contratoId) : null,
      });
      return;
    }

    if (form.alvo === "contrato") {
      await onSave({
        ...base,
        leadSaleId: null,
        contratoId: Number(form.contratoId),
      });
      return;
    }

    const leadIds = [
      ...new Set(
        selectedRecipients.map(resolveLeadId).filter((id) => id != null && Number.isFinite(id))
      ),
    ];

    await onSave({
      ...base,
      leadSaleIds: leadIds,
      leadSaleId: leadIds[0] || null,
      contratoId: null,
    });
  };

  const recurrenceUnit =
    RECURRENCE_TYPES.find((t) => t.value === form.recurrenceType)?.unit || "dia(s)";
  const previewDates = showRecurrencePreview
    ? previewNextDates(form.scheduledAt || new Date(), form.recurrenceType, form.recurrenceInterval)
    : [];

  const toggleWeekDay = (day) => {
    const current = form.recurrenceDaysOfWeek || [];
    if (current.includes(day)) {
      set(
        "recurrenceDaysOfWeek",
        current.filter((d) => d !== day)
      );
    } else {
      set("recurrenceDaysOfWeek", [...current, day].sort((a, b) => a - b));
    }
  };

  return (
    <div className="realty-modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="realty-card realty-modal followup-modal followup-modal--wide"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <h3>{followup ? "Editar Follow-up" : "Adicionar Follow-up"}</h3>

        <div className="followup-stepper">
          {STEPS.map((label, idx) => (
            <button
              key={label}
              type="button"
              className={`followup-stepper__item${idx === step ? " is-active" : ""}${
                idx < step ? " is-done" : ""
              }`}
              onClick={() => setStep(idx)}
            >
              <span>{idx + 1}</span>
              {label}
            </button>
          ))}
        </div>

        <form className="realty-proposta-form" onSubmit={handleSubmit}>
          {step === 0 && (
            <>
              <div className="followup-tabs">
                <button
                  type="button"
                  className={form.alvo === "lead" ? "is-active" : ""}
                  onClick={() => set("alvo", "lead")}
                >
                  Contatos / Leads
                </button>
                <button
                  type="button"
                  className={form.alvo === "contrato" ? "is-active" : ""}
                  onClick={() => set("alvo", "contrato")}
                >
                  Contrato
                </button>
              </div>

              {form.alvo === "lead" ? (
                <>
                  <p className="followup-modal__hint">
                    Mesmo modelo das campanhas: filtre por fila, lista, tag ou público-alvo e
                    selecione os contatos.
                  </p>
                  <DestinatariosPicker
                    value={selectedRecipients}
                    onChange={setSelectedRecipients}
                    leads={leads}
                    multiSelect={!followup}
                  />
                </>
              ) : (
                <label>
                  Destinatário (Contrato) *
                  <select
                    value={form.contratoId}
                    onChange={(e) => set("contratoId", e.target.value)}
                    required
                  >
                    <option value="">Selecione o contrato</option>
                    {activeContratos.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title || `Contrato #${c.id}`} · {c.status}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <div className="realty-proposta-form__row">
                <label>
                  Tipo
                  <select value={form.type} onChange={(e) => set("type", e.target.value)}>
                    {Object.entries(FOLLOWUP_TIPO_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Status
                  <select value={form.status} onChange={(e) => set("status", e.target.value)}>
                    {FOLLOWUP_STATUS_OPTIONS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              {form.type === "whatsapp" ? (
                <>
                  <label>
                    Conexão WhatsApp *
                    <select
                      value={form.whatsappId}
                      onChange={(e) => {
                        set("whatsappId", e.target.value);
                        set("metaTemplateQuickMessageId", null);
                        setMetaTemplateSelection(null);
                      }}
                    >
                      <option value="">Selecione</option>
                      {whatsapps.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name || `WhatsApp #${w.id}`} ·{" "}
                          {w.channel === "whatsapp_oficial" ? "API Oficial" : "WhatsApp Web"}
                          {w.status ? ` (${w.status})` : ""}
                        </option>
                      ))}
                    </select>
                  </label>

                  {isOficial ? (
                    <div className="followup-meta-box">
                      <p className="followup-modal__hint">
                        API Oficial usa os mesmos gatilhos das campanhas: template Meta aprovado.
                      </p>
                      <MetaOfficialTemplateSelector
                        whatsappId={form.whatsappId ? Number(form.whatsappId) : null}
                        value={metaTemplateSelection}
                        onChange={(sel) => {
                          setMetaTemplateSelection(sel);
                          set(
                            "metaTemplateQuickMessageId",
                            sel?.quickMessageId || null
                          );
                          if (sel?.variables) set("metaTemplateVariables", sel.variables);
                        }}
                        showSync
                      />
                    </div>
                  ) : (
                    <>
                      <label>
                        Tipo de mensagem
                        <select
                          value={form.messageMode}
                          onChange={(e) => {
                            const mode = e.target.value;
                            set("messageMode", mode);
                            if (mode === "pronta" && !form.messageBody) {
                              set("messageBody", FOLLOWUP_MENSAGENS_PRONTAS[0]);
                            }
                          }}
                        >
                          <option value="pronta">Mensagem pronta</option>
                          <option value="template">Template salvo</option>
                          <option value="livre">Mensagem livre</option>
                        </select>
                      </label>

                      {form.messageMode === "pronta" && (
                        <label>
                          Mensagem pronta
                          <select
                            value={form.messageBody}
                            onChange={(e) => set("messageBody", e.target.value)}
                          >
                            {FOLLOWUP_MENSAGENS_PRONTAS.map((m) => (
                              <option key={m} value={m}>
                                {m.slice(0, 80)}
                                {m.length > 80 ? "…" : ""}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}

                      {form.messageMode === "template" && (
                        <label>
                          Template *
                          <select
                            value={form.messageTemplateId}
                            onChange={(e) => {
                              set("messageTemplateId", e.target.value);
                              const tpl = templates.find(
                                (t) => Number(t.id) === Number(e.target.value)
                              );
                              if (tpl) set("messageBody", tpl.message);
                            }}
                          >
                            <option value="">Selecione o template</option>
                            {templates
                              .filter((t) => t.active !== false)
                              .map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.title}
                                </option>
                              ))}
                          </select>
                        </label>
                      )}

                      <label>
                        Mensagem
                        <textarea
                          rows={4}
                          value={form.messageBody}
                          onChange={(e) => set("messageBody", e.target.value)}
                          placeholder="Olá {nome}, ..."
                        />
                      </label>
                    </>
                  )}
                </>
              ) : (
                <label>
                  Observação / briefing
                  <textarea
                    rows={4}
                    value={form.notes}
                    onChange={(e) => set("notes", e.target.value)}
                  />
                </label>
              )}
            </>
          )}

          {step === 2 && (
            <div className="followup-schedule">
              <div className="followup-schedule__mode">
                <button
                  type="button"
                  className={`followup-schedule__mode-card${!form.sendNow ? " is-active" : ""}`}
                  onClick={() => set("sendNow", false)}
                >
                  <strong>Agendar</strong>
                  <span>Define data e hora para o follow-up</span>
                </button>
                {form.type === "whatsapp" && (
                  <button
                    type="button"
                    className={`followup-schedule__mode-card${form.sendNow ? " is-active" : ""}`}
                    onClick={() => {
                      set("sendNow", true);
                      set("scheduledAt", toLocalInput());
                    }}
                  >
                    <strong>Enviar agora</strong>
                    <span>Dispara imediatamente via WhatsApp</span>
                  </button>
                )}
              </div>

              <label className={form.sendNow ? "is-dimmed" : ""}>
                Data e hora {form.sendNow ? "(agora)" : "*"}
                <input
                  type="datetime-local"
                  value={form.scheduledAt}
                  onChange={(e) => {
                    set("scheduledAt", e.target.value);
                    set("sendNow", false);
                  }}
                  disabled={form.sendNow}
                  required={!form.sendNow}
                />
              </label>

              <div className="followup-recurrence-card">
                <div className="followup-recurrence-card__head">
                  <div>
                    <strong>Configuração de Recorrência</strong>
                    <p>Agenda o próximo follow-up ao concluir (mesmo modelo das campanhas)</p>
                  </div>
                  <label className="followup-switch">
                    <input
                      type="checkbox"
                      checked={form.recurrenceEnabled}
                      onChange={(e) => {
                        set("recurrenceEnabled", e.target.checked);
                        if (!e.target.checked) setShowRecurrencePreview(false);
                      }}
                    />
                    <span />
                    Habilitar recorrência
                  </label>
                </div>

                {form.recurrenceEnabled && (
                  <div className="followup-recurrence-card__body">
                    <div className="realty-proposta-form__row">
                      <label>
                        Tipo de Recorrência
                        <select
                          value={form.recurrenceType}
                          onChange={(e) => {
                            set("recurrenceType", e.target.value);
                            if (e.target.value !== "weekly") set("recurrenceDaysOfWeek", []);
                          }}
                        >
                          {RECURRENCE_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Intervalo
                        <input
                          type="number"
                          min={1}
                          value={form.recurrenceInterval}
                          onChange={(e) => set("recurrenceInterval", e.target.value)}
                        />
                        <span className="followup-field-hint">
                          A cada {form.recurrenceInterval || 1} {recurrenceUnit}
                        </span>
                      </label>
                    </div>

                    {form.recurrenceType === "weekly" && (
                      <div className="followup-weekdays">
                        <span className="followup-weekdays__label">Dias da semana</span>
                        <div className="followup-weekdays__row">
                          {DAYS_OF_WEEK.map((day) => {
                            const active = (form.recurrenceDaysOfWeek || []).includes(day.value);
                            return (
                              <button
                                key={day.value}
                                type="button"
                                className={`followup-weekday${active ? " is-active" : ""}`}
                                onClick={() => toggleWeekDay(day.value)}
                              >
                                {day.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <button
                      type="button"
                      className="realty-page__btn realty-page__btn--ghost followup-preview-btn"
                      onClick={() => setShowRecurrencePreview((v) => !v)}
                      disabled={!form.recurrenceType || !form.scheduledAt}
                    >
                      {showRecurrencePreview ? "Ocultar" : "Visualizar"} próximas execuções
                    </button>

                    {showRecurrencePreview && previewDates.length > 0 && (
                      <ul className="followup-preview-list">
                        {previewDates.map((d, idx) => (
                          <li key={idx}>
                            <strong>{idx + 1}ª execução</strong>
                            <span>{formatPreviewDate(d)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>

              <label>
                Observações
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={(e) => set("notes", e.target.value)}
                />
              </label>

              {followup && (
                <label>
                  Resultado
                  <input
                    value={form.result}
                    onChange={(e) => set("result", e.target.value)}
                  />
                </label>
              )}
            </div>
          )}

          <div className="realty-proposta-form__actions">
            <button type="button" className="realty-page__btn realty-page__btn--ghost" onClick={onClose}>
              Cancelar
            </button>
            {step > 0 && (
              <button
                type="button"
                className="realty-page__btn realty-page__btn--ghost"
                onClick={() => setStep((s) => s - 1)}
              >
                Voltar
              </button>
            )}
            {step < STEPS.length - 1 ? (
              <button type="button" className="realty-page__btn" onClick={handleNext}>
                Próximo
              </button>
            ) : (
              <>
                {form.type === "whatsapp" && (
                  <button
                    type="button"
                    className="realty-page__btn realty-page__btn--outline"
                    disabled={saving}
                    onClick={(e) => handleSubmit(e, { forceSendNow: true })}
                  >
                    {saving ? <Loader2 size={16} className="spin" /> : null}
                    Enviar Agora
                  </button>
                )}
                <button
                  type="button"
                  className="realty-page__btn"
                  disabled={saving}
                  onClick={(e) => handleSubmit(e, { forceSendNow: false })}
                >
                  {saving ? <Loader2 size={16} className="spin" /> : null}
                  {followup
                    ? "Salvar agendamento"
                    : selectedRecipients.length > 1 && form.alvo === "lead"
                      ? `Agendar ${selectedRecipients.length} follow-ups`
                      : "Agendar"}
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default FollowupFormModal;
