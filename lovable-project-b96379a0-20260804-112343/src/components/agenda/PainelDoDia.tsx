import { useMemo, useState } from "react";
import { format, parseISO, isPast, differenceInHours } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clock, MapPin, User, Check, AlertTriangle, ExternalLink, Mail, Phone, Flag, ChevronDown, ChevronUp, MessageSquare } from "lucide-react";
import type { Compromisso } from "@/hooks/useCompromissos";
import type { Followup } from "@/hooks/useFollowups";
import { TIPOS_COMPROMISSO } from "@/hooks/useCompromissos";
import { VisitaCheckin } from "./VisitaCheckin";
import { ConfirmacaoDialog } from "./ConfirmacaoDialog";

const PRIORIDADE_CONFIG = {
  alta: { label: "Alta", color: "hsl(0, 72%, 51%)", bg: "bg-destructive/10 text-destructive" },
  media: { label: "Média", color: "hsl(38, 92%, 50%)", bg: "bg-yellow-500/10 text-yellow-600" },
  baixa: { label: "Baixa", color: "hsl(142, 71%, 45%)", bg: "bg-green-500/10 text-green-600" },
};

interface Props {
  compromissos: Compromisso[];
  followups: Followup[];
  onComplete: (id: string, source: "compromisso" | "followup") => void;
  onEdit: (id: string, source: "compromisso" | "followup") => void;
  onRefetch?: () => void;
}

type StatusCor = "confirmado" | "aguardando" | "proximo";

function getStatusCor(c: Compromisso): StatusCor {
  if ((c as any).confirmado) return "confirmado";
  const horasRestantes = differenceInHours(parseISO(c.data_inicio), new Date());
  if (horasRestantes <= 2) return "proximo";
  return "aguardando";
}

const STATUS_STYLES: Record<StatusCor, string> = {
  confirmado: "border-l-4 border-l-green-500 bg-green-500/5",
  aguardando: "border-l-4 border-l-yellow-500 bg-yellow-500/5",
  proximo: "border-l-4 border-l-red-500 bg-red-500/5",
};

const STATUS_LABELS: Record<StatusCor, { label: string; className: string }> = {
  confirmado: { label: "✅ Confirmado", className: "text-green-600" },
  aguardando: { label: "⏳ Aguardando", className: "text-yellow-600" },
  proximo: { label: "🔴 Próximo!", className: "text-red-600" },
};

export function PainelDoDia({ compromissos, followups, onComplete, onEdit, onRefetch }: Props) {
  const [expandedCheckin, setExpandedCheckin] = useState<string | null>(null);
  const [confirmacaoCompromisso, setConfirmacaoCompromisso] = useState<Compromisso | null>(null);
  const hoje = new Date().toISOString().split("T")[0];
  const agora = new Date();

  const compromissosHoje = useMemo(() =>
    compromissos
      .filter(c => c.data_inicio.startsWith(hoje) && c.status === "pendente")
      .sort((a, b) => a.data_inicio.localeCompare(b.data_inicio)),
    [compromissos, hoje]
  );

  const followupsHoje = useMemo(() =>
    followups.filter(f => f.data_followup === hoje && f.status === "pendente"),
    [followups, hoje]
  );

  // Próximas 24h (excluindo hoje)
  const amanha = new Date(agora.getTime() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const proximos24h = useMemo(() =>
    compromissos.filter(c => {
      const d = c.data_inicio.slice(0, 10);
      return d > hoje && d <= amanha && c.status === "pendente";
    }).sort((a, b) => a.data_inicio.localeCompare(b.data_inicio)),
    [compromissos, hoje, amanha]
  );

  const confirmados = compromissosHoje.filter(c => (c as any).confirmado).length;
  const pendentes = compromissosHoje.length - confirmados;
  const totalHoje = compromissosHoje.length + followupsHoje.length;

  if (totalHoje === 0 && proximos24h.length === 0) {
    return null;
  }

  return (
    <div className="mb-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          📅 Agenda Inteligente de Hoje
          <span className="text-sm font-normal text-muted-foreground">
            {format(agora, "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </span>
        </h2>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
            {confirmados} confirmado{confirmados !== 1 ? "s" : ""}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
            {pendentes} aguardando
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            {followupsHoje.length} follow-up{followupsHoje.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Compromissos de hoje */}
      <div className="grid gap-2">
        {compromissosHoje.map(c => {
          const info = TIPOS_COMPROMISSO.find(t => t.id === c.tipo) || TIPOS_COMPROMISSO[5];
          const status = getStatusCor(c);
          const prioridade = (c as any).prioridade || "media";
          const prioConfig = PRIORIDADE_CONFIG[prioridade as keyof typeof PRIORIDADE_CONFIG] || PRIORIDADE_CONFIG.media;

          const isVisita = c.tipo === "visita";
          const isExpanded = expandedCheckin === c.id;

          return (
            <div key={c.id} className="space-y-0">
              <div
                onClick={() => onEdit(c.id, "compromisso")}
                className={`flex items-center gap-4 p-3 rounded-lg border border-border cursor-pointer hover:shadow-md transition-all ${STATUS_STYLES[status]}`}
              >
                <div className="text-center min-w-[50px]">
                  <p className="text-lg font-bold text-foreground leading-none">
                    {format(parseISO(c.data_inicio), "HH:mm")}
                  </p>
                  {c.data_fim && (
                    <p className="text-[10px] text-muted-foreground">
                      até {format(parseISO(c.data_fim), "HH:mm")}
                    </p>
                  )}
                </div>

                <div className="w-1 h-10 rounded-full" style={{ backgroundColor: info.color }} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-semibold text-foreground truncate">{c.titulo}</h4>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">{info.label}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${prioConfig.bg}`}>
                      <Flag className="w-2.5 h-2.5 inline mr-0.5" />{prioConfig.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    {c.lead_nome && <span className="flex items-center gap-1"><User className="w-3 h-3" />{c.lead_nome}</span>}
                    {c.local && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{c.local}</span>}
                    {(c as any).google_maps_link && (
                      <a
                        href={(c as any).google_maps_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="flex items-center gap-1 text-primary hover:underline"
                      >
                        <ExternalLink className="w-3 h-3" />Mapa
                      </a>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {c.checkin_at && !c.checkout_at && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-600 font-medium">
                      📍 No local
                    </span>
                  )}
                  {c.checkout_at && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground font-medium">
                      ✅ Visitado
                    </span>
                  )}
                  {(c as any).lembrete_nivel > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium" title="Nível de lembrete enviado">
                      🔔 {(c as any).lembrete_nivel}/5
                    </span>
                  )}
                  <span className={`text-[10px] font-medium ${STATUS_LABELS[status].className}`}>
                    {STATUS_LABELS[status].label}
                  </span>
                  {(c.email_cliente || c.telefone_lembrete) && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmacaoCompromisso(c); }}
                      className="p-1.5 rounded-md hover:bg-primary/10 text-primary"
                      title="Confirmar com cliente"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </button>
                  )}
                  {isVisita && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setExpandedCheckin(isExpanded ? null : c.id); }}
                      className="p-1.5 rounded-md hover:bg-primary/10 text-primary"
                      title="Check-in de visita"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  )}
                  {c.status === "pendente" && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onComplete(c.id, "compromisso"); }}
                      className="p-1.5 rounded-md hover:bg-primary/10 text-primary"
                      title="Concluir"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              {isVisita && isExpanded && (
                <div className="ml-4 mt-1">
                  <VisitaCheckin compromisso={c} onUpdate={() => onRefetch?.()} />
                </div>
              )}
            </div>
          );
        })}

        {/* Follow-ups de hoje */}
        {followupsHoje.map(f => (
          <div
            key={f.id}
            onClick={() => onEdit(f.id, "followup")}
            className="flex items-center gap-4 p-3 rounded-lg border border-border border-l-4 border-l-blue-500 bg-blue-500/5 cursor-pointer hover:shadow-md transition-all"
          >
            <div className="text-center min-w-[50px]">
              <p className="text-xs font-medium text-muted-foreground">Follow-up</p>
            </div>
            <div className="w-1 h-10 rounded-full bg-blue-500" />
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-foreground">{f.lead_nome}</h4>
              <p className="text-xs text-muted-foreground">{f.descricao || f.tipo}</p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onComplete(f.id, "followup"); }}
              className="p-1.5 rounded-md hover:bg-primary/10 text-primary"
            >
              <Check className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Próximas 24h */}
      {proximos24h.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            Próximas 24 horas ({proximos24h.length})
          </h3>
          <div className="grid gap-1.5">
            {proximos24h.map(c => {
              const info = TIPOS_COMPROMISSO.find(t => t.id === c.tipo) || TIPOS_COMPROMISSO[5];
              return (
                <div
                  key={c.id}
                  onClick={() => onEdit(c.id, "compromisso")}
                  className="flex items-center gap-3 p-2.5 rounded-lg border border-border bg-card/50 cursor-pointer hover:bg-muted/30 transition-colors"
                >
                  <span className="text-sm font-medium text-foreground min-w-[40px]">
                    {format(parseISO(c.data_inicio), "HH:mm")}
                  </span>
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: info.color }} />
                  <span className="text-sm text-foreground truncate">{c.titulo}</span>
                  {c.lead_nome && <span className="text-xs text-muted-foreground ml-auto">{c.lead_nome}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {confirmacaoCompromisso && (
        <ConfirmacaoDialog
          compromisso={confirmacaoCompromisso}
          open={!!confirmacaoCompromisso}
          onOpenChange={(o) => { if (!o) setConfirmacaoCompromisso(null); }}
          onSent={() => { setConfirmacaoCompromisso(null); onRefetch?.(); }}
        />
      )}
    </div>
  );
}
