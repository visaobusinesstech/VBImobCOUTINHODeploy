/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * Painel do dia + check-in + confirmação — paridade Lovable.
 */

import React, { useMemo, useState } from "react";
import { format, parseISO, differenceInHours } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Clock,
  MapPin,
  User,
  Check,
  ExternalLink,
  Flag,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  LogIn,
  LogOut,
  Copy,
  Loader2,
} from "lucide-react";
import { TIPOS_COMPROMISSO } from "../../helpers/realtyCrm";
import realtyService from "../../services/realtyService";
import toastError from "../../errors/toastError";
import { toast } from "react-toastify";

const PRIORIDADE = {
  alta: { label: "Alta", className: "prio-alta" },
  media: { label: "Média", className: "prio-media" },
  baixa: { label: "Baixa", className: "prio-baixa" },
};

function getStatusCor(c) {
  if (c.confirmado) return "confirmado";
  try {
    const horas = differenceInHours(parseISO(String(c.dataInicio)), new Date());
    if (horas <= 2) return "proximo";
  } catch {
    /* ignore */
  }
  return "aguardando";
}

const STATUS_LABELS = {
  confirmado: "✅ Confirmado",
  aguardando: "⏳ Aguardando",
  proximo: "🔴 Próximo!",
};

export default function PainelDoDia({
  compromissos,
  followups,
  onComplete,
  onEdit,
  onRefetch,
}) {
  const [expandedCheckin, setExpandedCheckin] = useState(null);
  const [confirmacaoTarget, setConfirmacaoTarget] = useState(null);
  const hoje = new Date().toISOString().split("T")[0];
  const agora = new Date();

  const compromissosHoje = useMemo(
    () =>
      compromissos
        .filter(
          (c) =>
            String(c.dataInicio || "").startsWith(hoje) && c.status === "pendente"
        )
        .sort((a, b) => String(a.dataInicio).localeCompare(String(b.dataInicio))),
    [compromissos, hoje]
  );

  const followupsHoje = useMemo(
    () =>
      followups.filter(
        (f) =>
          String(f.scheduledAt || "").startsWith(hoje) && f.status === "pendente"
      ),
    [followups, hoje]
  );

  const amanha = new Date(agora.getTime() + 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];
  const proximos24h = useMemo(
    () =>
      compromissos
        .filter((c) => {
          const d = String(c.dataInicio || "").slice(0, 10);
          return d > hoje && d <= amanha && c.status === "pendente";
        })
        .sort((a, b) => String(a.dataInicio).localeCompare(String(b.dataInicio))),
    [compromissos, hoje, amanha]
  );

  const confirmados = compromissosHoje.filter((c) => c.confirmado).length;
  const pendentes = compromissosHoje.length - confirmados;
  const totalHoje = compromissosHoje.length + followupsHoje.length;

  if (totalHoje === 0 && proximos24h.length === 0) return null;

  return (
    <div className="agenda-painel">
      <div className="agenda-painel__head">
        <h2>
          Agenda de hoje
          <span>
            {format(agora, "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </span>
        </h2>
        <div className="agenda-painel__stats">
          <span>
            <i className="dot ok" /> {confirmados} confirmado{confirmados !== 1 ? "s" : ""}
          </span>
          <span>
            <i className="dot warn" /> {pendentes} aguardando
          </span>
          <span>
            <i className="dot info" /> {followupsHoje.length} follow-up
            {followupsHoje.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      <div className="agenda-painel__list">
        {compromissosHoje.map((c) => {
          const info = TIPOS_COMPROMISSO.find((t) => t.id === c.tipo) || TIPOS_COMPROMISSO[5];
          const status = getStatusCor(c);
          const prio = PRIORIDADE[c.prioridade] || PRIORIDADE.media;
          const isVisita = c.tipo === "visita";
          const isExpanded = expandedCheckin === c.id;

          return (
            <div key={c.id}>
              <div
                className={`agenda-painel__card status-${status}`}
                onClick={() => onEdit(c.id, "compromisso")}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && onEdit(c.id, "compromisso")}
              >
                <div className="agenda-painel__time">
                  <strong>{format(parseISO(String(c.dataInicio)), "HH:mm")}</strong>
                  {c.dataFim && (
                    <small>até {format(parseISO(String(c.dataFim)), "HH:mm")}</small>
                  )}
                </div>
                <span className="agenda-painel__bar" style={{ background: info.color }} />
                <div className="agenda-painel__info">
                  <div className="agenda-row__title">
                    <h4>{c.title}</h4>
                    <span className="realty-chip">
                      {info.emoji} {info.label}
                    </span>
                    <span className={`realty-chip ${prio.className}`}>
                      <Flag size={10} /> {prio.label}
                    </span>
                  </div>
                  <div className="agenda-row__meta">
                    {c.leadNome && (
                      <span>
                        <User size={12} /> {c.leadNome}
                      </span>
                    )}
                    {c.local && (
                      <span>
                        <MapPin size={12} /> {c.local}
                      </span>
                    )}
                    {c.googleMapsLink && (
                      <a
                        href={c.googleMapsLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink size={12} /> Mapa
                      </a>
                    )}
                  </div>
                </div>
                <div className="agenda-painel__right" onClick={(e) => e.stopPropagation()}>
                  {c.checkinAt && !c.checkoutAt && (
                    <span className="realty-chip realty-chip--ok">No local</span>
                  )}
                  {c.checkoutAt && <span className="realty-chip">Visitado</span>}
                  {c.lembreteNivel > 0 && (
                    <span className="realty-chip">🔔 {c.lembreteNivel}/5</span>
                  )}
                  <span className={`agenda-status-label status-${status}`}>
                    {STATUS_LABELS[status]}
                  </span>
                  {(c.emailCliente || c.telefoneLembrete) && (
                    <button
                      type="button"
                      title="Confirmar com cliente"
                      onClick={() => setConfirmacaoTarget(c)}
                    >
                      <MessageSquare size={16} />
                    </button>
                  )}
                  {isVisita && (
                    <button
                      type="button"
                      title="Check-in de visita"
                      onClick={() => setExpandedCheckin(isExpanded ? null : c.id)}
                    >
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  )}
                  {c.status === "pendente" && (
                    <button
                      type="button"
                      title="Concluir"
                      onClick={() => onComplete(c.id, "compromisso")}
                    >
                      <Check size={16} />
                    </button>
                  )}
                </div>
              </div>
              {isVisita && isExpanded && (
                <VisitaCheckin compromisso={c} onUpdate={onRefetch} />
              )}
            </div>
          );
        })}

        {followupsHoje.map((f) => (
          <div
            key={f.id}
            className="agenda-painel__card status-followup"
            onClick={() => onEdit(f.id, "followup")}
            role="button"
            tabIndex={0}
          >
            <div className="agenda-painel__time">
              <small>Follow-up</small>
            </div>
            <span className="agenda-painel__bar" style={{ background: "#3b82f6" }} />
            <div className="agenda-painel__info">
              <h4>{f.leadNome || "Lead"}</h4>
              <p>{f.notes || f.type}</p>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onComplete(f.id, "followup");
              }}
            >
              <Check size={16} />
            </button>
          </div>
        ))}
      </div>

      {proximos24h.length > 0 && (
        <div className="agenda-proximos">
          <h3>
            <Clock size={14} /> Próximas 24 horas ({proximos24h.length})
          </h3>
          {proximos24h.map((c) => {
            const info = TIPOS_COMPROMISSO.find((t) => t.id === c.tipo) || TIPOS_COMPROMISSO[5];
            return (
              <button
                key={c.id}
                type="button"
                className="agenda-proximos__item"
                onClick={() => onEdit(c.id, "compromisso")}
              >
                <span>{format(parseISO(String(c.dataInicio)), "HH:mm")}</span>
                <i style={{ background: info.color }} />
                <strong>{c.title}</strong>
                {c.leadNome && <em>{c.leadNome}</em>}
              </button>
            );
          })}
        </div>
      )}

      {confirmacaoTarget && (
        <ConfirmacaoDialog
          compromisso={confirmacaoTarget}
          onClose={() => setConfirmacaoTarget(null)}
          onSent={() => {
            setConfirmacaoTarget(null);
            onRefetch?.();
          }}
        />
      )}
    </div>
  );
}

function VisitaCheckin({ compromisso, onUpdate }) {
  const [loadingIn, setLoadingIn] = useState(false);
  const [loadingOut, setLoadingOut] = useState(false);
  const [feedback, setFeedback] = useState(compromisso.feedbackVisita || "");

  const handleCheckin = async () => {
    setLoadingIn(true);
    try {
      await realtyService.updateCompromisso(compromisso.id, {
        checkinAt: new Date().toISOString(),
      });
      toast.success("Check-in registrado");
      onUpdate?.();
    } catch (err) {
      toastError(err);
    } finally {
      setLoadingIn(false);
    }
  };

  const handleCheckout = async () => {
    setLoadingOut(true);
    try {
      await realtyService.updateCompromisso(compromisso.id, {
        checkoutAt: new Date().toISOString(),
        feedbackVisita: feedback || null,
      });
      toast.success("Check-out registrado");
      onUpdate?.();
    } catch (err) {
      toastError(err);
    } finally {
      setLoadingOut(false);
    }
  };

  return (
    <div className="agenda-checkin">
      <div className="agenda-checkin__actions">
        {!compromisso.checkinAt ? (
          <button
            type="button"
            className="realty-page__btn"
            disabled={loadingIn}
            onClick={handleCheckin}
          >
            {loadingIn ? <Loader2 size={14} className="agenda-spin" /> : <LogIn size={14} />}
            Check-in no local
          </button>
        ) : !compromisso.checkoutAt ? (
          <>
            <label>
              Feedback da visita
              <textarea
                rows={2}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Como foi a visita?"
              />
            </label>
            <button
              type="button"
              className="realty-page__btn"
              disabled={loadingOut}
              onClick={handleCheckout}
            >
              {loadingOut ? <Loader2 size={14} className="agenda-spin" /> : <LogOut size={14} />}
              Check-out
            </button>
          </>
        ) : (
          <p className="agenda-checkin__done">Visita com check-in e check-out registrados.</p>
        )}
      </div>
    </div>
  );
}

function ConfirmacaoDialog({ compromisso, onClose, onSent }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const data = await realtyService.gerarConfirmacaoCompromisso(compromisso.id);
      setResult(data);
      toast.success("Mensagem de confirmação gerada");
      onSent?.();
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    const text = `${result.mensagem}\n\nConfirme sua presença:\n${result.confirmationLink || ""}`;
    await navigator.clipboard.writeText(text);
    toast.success("Mensagem copiada");
  };

  return (
    <div className="realty-modal-backdrop" onClick={onClose}>
      <div className="realty-card realty-modal realty-form" onClick={(e) => e.stopPropagation()}>
        <h3>
          <MessageSquare size={16} /> Confirmação com Cliente
        </h3>
        <div className="agenda-visita-summary">
          <strong>{compromisso.title}</strong>
          <p>Status: {compromisso.confirmacaoStatus || "pendente"}</p>
        </div>
        {!result ? (
          <div style={{ textAlign: "center", padding: "12px 0" }}>
            <p style={{ fontSize: 13, color: "#737d8c", marginBottom: 12 }}>
              Gera mensagem profissional de confirmação e link para o cliente confirmar,
              cancelar ou reagendar.
            </p>
            <button
              type="button"
              className="realty-page__btn"
              disabled={loading}
              onClick={handleGenerate}
            >
              {loading ? <Loader2 size={14} className="agenda-spin" /> : <MessageSquare size={14} />}
              Gerar confirmação
            </button>
          </div>
        ) : (
          <div>
            <label>
              Mensagem
              <textarea rows={5} readOnly value={result.mensagem || ""} />
            </label>
            <div className="realty-card__actions">
              <button type="button" className="realty-page__btn realty-page__btn--ghost" onClick={handleCopy}>
                <Copy size={14} /> Copiar
              </button>
              {result.whatsappLink && (
                <a
                  className="realty-page__btn"
                  href={result.whatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Abrir WhatsApp
                </a>
              )}
            </div>
          </div>
        )}
        <div className="realty-card__actions">
          <button type="button" className="realty-page__btn realty-page__btn--ghost" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
