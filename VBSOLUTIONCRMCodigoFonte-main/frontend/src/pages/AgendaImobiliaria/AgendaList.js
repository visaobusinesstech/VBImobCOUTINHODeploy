/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 */

import React from "react";
import { format, parseISO, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarDays,
  Clock,
  MapPin,
  User,
  Trash2,
  Check,
  MessageCircle,
  Pencil,
  Flag,
  ExternalLink,
  ClipboardCheck,
  ThumbsUp,
  ThumbsDown,
  MoreHorizontal,
} from "lucide-react";
import { TIPOS_COMPROMISSO, FOLLOWUP_AGENDA_TIPOS } from "../../helpers/realtyCrm";

const FOLLOWUP_COLORS = {
  ligacao: "#22c55e",
  whatsapp: "#22c55e",
  email: "#0ea5e9",
  visita: "#7c3aed",
  reuniao: "#0ea5e9",
  outro: "#64748b",
};

const toDateStr = (iso) => (iso ? String(iso).slice(0, 10) : "");

export default function AgendaList({
  compromissos,
  followups,
  selectedDate,
  onClearDate,
  onComplete,
  onDelete,
  onEdit,
  onNewItem,
  onRegistrarVisita,
}) {
  const hoje = new Date().toISOString().split("T")[0];

  const unified = [
    ...compromissos.map((c) => ({ source: "compromisso", item: c })),
    ...followups.map((f) => ({ source: "followup", item: f })),
  ].sort((a, b) => {
    const dateA =
      a.source === "compromisso" ? String(a.item.dataInicio || "") : String(a.item.scheduledAt || "");
    const dateB =
      b.source === "compromisso" ? String(b.item.dataInicio || "") : String(b.item.scheduledAt || "");
    return dateA.localeCompare(dateB);
  });

  return (
    <div className="agenda-list">
      {selectedDate && (
        <div className="agenda-list__date-bar">
          <span>
            {format(parseISO(selectedDate), "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </span>
          <button type="button" onClick={onClearDate}>
            Ver todos pendentes
          </button>
        </div>
      )}

      {unified.length === 0 ? (
        <div className="agenda-empty">
          <CalendarDays size={36} style={{ opacity: 0.35, color: "#737d8c" }} />
          <p>{selectedDate ? "Nenhum item neste dia" : "Nenhum item pendente"}</p>
          <button type="button" className="realty-page__btn" onClick={onNewItem}>
            + Agendar compromisso
          </button>
        </div>
      ) : (
        unified.map((u) =>
          u.source === "compromisso" ? (
            <CompromissoRow
              key={`c-${u.item.id}`}
              c={u.item}
              hoje={hoje}
              onComplete={onComplete}
              onDelete={onDelete}
              onEdit={onEdit}
              onRegistrarVisita={onRegistrarVisita}
            />
          ) : (
            <FollowupRow
              key={`f-${u.item.id}`}
              f={u.item}
              hoje={hoje}
              onComplete={onComplete}
              onDelete={onDelete}
              onEdit={onEdit}
            />
          )
        )
      )}
    </div>
  );
}

function CompromissoRow({ c, hoje, onComplete, onDelete, onEdit, onRegistrarVisita }) {
  const info = TIPOS_COMPROMISSO.find((t) => t.id === c.tipo) || TIPOS_COMPROMISSO[5];
  let dataInicio;
  try {
    dataInicio = parseISO(String(c.dataInicio));
  } catch {
    dataInicio = new Date(c.dataInicio);
  }
  const isAtrasado =
    c.status === "pendente" &&
    isPast(dataInicio) &&
    toDateStr(c.dataInicio) !== hoje;
  const isConcluido = c.status === "concluido";

  return (
    <article
      className={`agenda-row${isConcluido ? " is-done" : ""}${isAtrasado ? " is-late" : ""}`}
    >
      <span className="agenda-row__dot" style={{ background: info.color }} />
      <div className="agenda-row__body">
        <div className="agenda-row__title">
          <h4 className={isConcluido ? "is-strike" : ""}>{c.title}</h4>
          <span className="realty-chip">
            {info.emoji} {info.label}
          </span>
          {c.prioridade === "alta" && (
            <span className="realty-chip realty-chip--danger">
              <Flag size={10} /> Alta
            </span>
          )}
          {c.prioridade === "baixa" && (
            <span className="realty-chip realty-chip--ok">
              <Flag size={10} /> Baixa
            </span>
          )}
          {isAtrasado && <span className="realty-chip realty-chip--danger">Atrasado</span>}
          {isConcluido && <span className="realty-chip realty-chip--ok">Concluído</span>}
          {c.confirmado && <span className="realty-chip realty-chip--ok">Confirmado</span>}
        </div>
        <div className="agenda-row__meta">
          <span>
            <Clock size={12} />
            {format(dataInicio, "dd/MM · HH:mm")}
            {c.dataFim && ` — ${format(parseISO(String(c.dataFim)), "HH:mm")}`}
          </span>
          {c.local && (
            <span>
              <MapPin size={12} />
              {c.local}
            </span>
          )}
          {c.googleMapsLink && (
            <a href={c.googleMapsLink} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={12} /> Mapa
            </a>
          )}
          {c.leadNome && (
            <span>
              <User size={12} />
              {c.leadNome}
            </span>
          )}
          {c.corretorNome && (
            <span>
              <User size={12} />
              {c.corretorNome}
            </span>
          )}
        </div>
        {c.description && <p className="agenda-row__desc">{c.description}</p>}
        {c.resultadoCliente && (
          <div className="agenda-row__result">
            {c.resultadoCliente === "gostou" && (
              <>
                <ThumbsUp size={12} /> Gostou do imóvel
              </>
            )}
            {c.resultadoCliente === "mais_opcoes" && (
              <>
                <MoreHorizontal size={12} /> Pediu mais opções
              </>
            )}
            {c.resultadoCliente === "nao_gostou" && (
              <>
                <ThumbsDown size={12} /> Não gostou
              </>
            )}
          </div>
        )}
        {c.feedbackVisita && <p className="agenda-row__desc">📝 {c.feedbackVisita}</p>}
        {c.lembreteWhatsapp && c.telefoneLembrete && (
          <a
            href={`https://wa.me/55${String(c.telefoneLembrete).replace(/\D/g, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="agenda-wa"
          >
            <MessageCircle size={12} /> WhatsApp
          </a>
        )}
      </div>
      <div className="agenda-row__actions">
        <button type="button" title="Editar" onClick={() => onEdit(c.id, "compromisso")}>
          <Pencil size={16} />
        </button>
        {c.status === "pendente" &&
          (c.tipo === "visita" || c.tipo === "reuniao") &&
          onRegistrarVisita && (
            <button
              type="button"
              title="Registrar visita realizada"
              onClick={() => onRegistrarVisita(c)}
            >
              <ClipboardCheck size={16} />
            </button>
          )}
        {c.status === "pendente" && (
          <button type="button" title="Concluir" onClick={() => onComplete(c.id, "compromisso")}>
            <Check size={16} />
          </button>
        )}
        <button type="button" title="Excluir" onClick={() => onDelete(c.id, "compromisso")}>
          <Trash2 size={16} />
        </button>
      </div>
    </article>
  );
}

function FollowupRow({ f, hoje, onComplete, onDelete, onEdit }) {
  const info = FOLLOWUP_AGENDA_TIPOS.find((t) => t.id === f.type) || { label: f.type || "Outro" };
  const color = FOLLOWUP_COLORS[f.type] || FOLLOWUP_COLORS.outro;
  const d = toDateStr(f.scheduledAt);
  const isAtrasado = f.status === "pendente" && d && d < hoje;
  const isConcluido = f.status === "concluido";

  return (
    <article
      className={`agenda-row${isConcluido ? " is-done" : ""}${isAtrasado ? " is-late" : ""}`}
    >
      <span className="agenda-row__dot" style={{ background: color }} />
      <div className="agenda-row__body">
        <div className="agenda-row__title">
          <h4 className={isConcluido ? "is-strike" : ""}>Follow-up: {f.leadNome || "Lead"}</h4>
          <span className="realty-chip">{info.label}</span>
          <span className="realty-chip">Follow-up</span>
          {isAtrasado && <span className="realty-chip realty-chip--danger">Atrasado</span>}
          {isConcluido && <span className="realty-chip realty-chip--ok">Concluído</span>}
        </div>
        <div className="agenda-row__meta">
          <span>
            <Clock size={12} />
            {d ? format(parseISO(d), "dd/MM/yyyy") : "—"}
          </span>
          {f.leadNome && (
            <span>
              <User size={12} />
              {f.leadNome}
            </span>
          )}
          {f.leadTelefone && (
            <a
              href={`https://wa.me/55${String(f.leadTelefone).replace(/\D/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="agenda-wa"
            >
              <MessageCircle size={12} /> WhatsApp
            </a>
          )}
        </div>
        {f.notes && <p className="agenda-row__desc">{f.notes}</p>}
      </div>
      <div className="agenda-row__actions">
        <button type="button" title="Editar" onClick={() => onEdit(f.id, "followup")}>
          <Pencil size={16} />
        </button>
        {f.status === "pendente" && (
          <button type="button" title="Concluir" onClick={() => onComplete(f.id, "followup")}>
            <Check size={16} />
          </button>
        )}
        <button type="button" title="Excluir" onClick={() => onDelete(f.id, "followup")}>
          <Trash2 size={16} />
        </button>
      </div>
    </article>
  );
}
