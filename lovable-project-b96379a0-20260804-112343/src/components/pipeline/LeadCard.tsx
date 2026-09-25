import { memo } from "react";
import { Send, ChevronLeft, ChevronRight } from "lucide-react";
import { User, Clock, MoreHorizontal, Phone, Edit, Trash2, Ban, CalendarClock, Calendar, Home, Key, FileText, MessageCircle, CheckCircle2, MapPin, Building2, Handshake, History as HistoryIcon, Search } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { UserCog } from "lucide-react";
import type { Corretor } from "@/hooks/useLeads";
import type { Lead } from "@/hooks/useLeads";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

function extractDataContato(obs: string | null): string | null {
  if (!obs) return null;
  const match = obs.match(/📅 Contato em: (\d{2}\/\d{2}\/\d{4})/);
  return match ? match[1] : null;
}

function getInitials(nome: string): string {
  const parts = nome.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface LeadScore {
  score: number;
  classification: string;
  emoji: string;
}

interface Props {
  lead: Lead;
  onEdit: (lead: Lead) => void;
  onDelete: (lead: Lead) => void;
  onFollowup?: (lead: Lead) => void;
  onSchedule?: (lead: Lead) => void;
  onProposta?: (lead: Lead) => void;
  onFechar?: (lead: Lead) => void;
  onShowHistory?: (lead: Lead) => void;
  onAdvance?: (lead: Lead) => void;
  onBack?: (lead: Lead) => void;
  nextStageTitle?: string | null;
  prevStageTitle?: string | null;


  propostasCount?: number;
  leadScore?: LeadScore | null;
  followupAtrasado?: boolean;
  onDragStart: (e: React.DragEvent, lead: Lead) => void;
  isMaster?: boolean;
  corretores?: Corretor[];
  onAssignCorretor?: (lead: Lead, corretorId: string | null) => void;
  stageColor?: string;
}

const formatValor = (v: number) => {
  const formatted = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
  // split "R$" from the number so we can style the currency mark
  return formatted;
};

function LeadCardComponent({ lead, onEdit, onDelete, onFollowup, onSchedule, onProposta, onFechar, onShowHistory, onAdvance, onBack, nextStageTitle, prevStageTitle, propostasCount, leadScore, followupAtrasado, onDragStart, isMaster, corretores, onAssignCorretor, stageColor }: Props) {
  const tempo = formatDistanceToNow(new Date(lead.created_at), { addSuffix: true, locale: ptBR });
  const dataContato = extractDataContato(lead.observacoes);
  const initials = getInitials(lead.nome);

  const temperatura = leadScore?.classification;
  const tempChipClass =
    temperatura === "quente"
      ? "pp-chip"
      : temperatura === "morno"
      ? "pp-chip pp-chip-gold"
      : "pp-chip";
  const tempIcon = temperatura === "quente" ? "🔥" : temperatura === "morno" ? "✦" : temperatura === "frio" ? "❄" : "•";

  const valorFormatado = lead.valor > 0 ? formatValor(lead.valor) : null;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, lead)}
      className="cursor-grab active:cursor-grabbing"
    >
      <article
        onClick={() => onEdit(lead)}
        className="pp-card group cursor-pointer"
      >
        <div className="p-3.5 space-y-3">
          {/* Header */}
          <div className="flex items-start gap-3">
            <div className="pp-avatar shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-[11px]">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <h4 className="pp-name text-[15px] leading-tight truncate">{lead.nome}</h4>
              </div>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                {lead.tipo_operacao && (
                  <span className="pp-chip pp-chip-navy">
                    {lead.tipo_operacao === "aluguel" ? <Key className="w-2.5 h-2.5" /> : <Home className="w-2.5 h-2.5" />}
                    {lead.tipo_operacao === "aluguel" ? "Aluguel" : "Venda"}
                  </span>
                )}
                {leadScore && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className={tempChipClass}>
                        <span aria-hidden="true">{tempIcon}</span>
                        <span className="tracking-wider">{leadScore.score}</span>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top"><p>Temperatura: {temperatura}</p></TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>
            {(onBack || onAdvance) && (
              <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                {onBack && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => onBack(lead)}
                        disabled={!prevStageTitle}
                        className="p-1 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        aria-label="Voltar etapa"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom"><p>{prevStageTitle ? `Voltar para ${prevStageTitle}` : "Primeira etapa"}</p></TooltipContent>
                  </Tooltip>
                )}
                {onAdvance && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => onAdvance(lead)}
                        disabled={!nextStageTitle}
                        className="p-1 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        aria-label="Avançar etapa"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom"><p>{nextStageTitle ? `Avançar para ${nextStageTitle}` : "Última etapa"}</p></TooltipContent>
                  </Tooltip>
                )}
              </div>
            )}
            <DropdownMenu>

              <DropdownMenuTrigger asChild>
                <button
                  onClick={(e) => e.stopPropagation()}
                  className="shrink-0 p-1 -m-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted opacity-70 group-hover:opacity-100 transition-all"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem onClick={() => onEdit(lead)}>
                  <Edit className="w-3.5 h-3.5 mr-2" />Editar
                </DropdownMenuItem>
                {isMaster && corretores && onAssignCorretor && (
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <UserCog className="w-3.5 h-3.5 mr-2" />Atribuir corretor
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="max-h-72 overflow-y-auto">
                      <DropdownMenuItem onClick={() => onAssignCorretor(lead, null)}>
                        <span className="text-muted-foreground">Sem corretor</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {corretores.map((c) => (
                        <DropdownMenuItem
                          key={c.id}
                          onClick={() => onAssignCorretor(lead, c.id)}
                          className={lead.corretor_id === c.id ? "bg-primary/10 font-medium" : ""}
                        >
                          {c.nome}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                )}
                {onFollowup && (
                  <DropdownMenuItem onClick={() => onFollowup(lead)}>
                    <CalendarClock className="w-3.5 h-3.5 mr-2" />Follow-up
                  </DropdownMenuItem>
                )}
                {onSchedule && (
                  <DropdownMenuItem onClick={() => onSchedule(lead)}>
                    <Calendar className="w-3.5 h-3.5 mr-2" />Agendar Compromisso
                  </DropdownMenuItem>
                )}
                {onProposta && (
                  <DropdownMenuItem onClick={() => onProposta(lead)}>
                    <FileText className="w-3.5 h-3.5 mr-2" />Nova Proposta
                  </DropdownMenuItem>
                )}
                {onFechar && lead.estagio !== "fechado" && (
                  <DropdownMenuItem onClick={() => onFechar(lead)} className="text-primary">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-2" />Fechar Lead
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => onShowHistory?.(lead)}>
                  <HistoryIcon className="w-3.5 h-3.5 mr-2" />Ver Histórico
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDelete(lead)} className="text-destructive">
                  <Trash2 className="w-3.5 h-3.5 mr-2" />Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Value (editorial) */}
          {valorFormatado && (
            <div>
              <div className="text-[9px] font-semibold tracking-wider text-muted-foreground uppercase mb-0.5">
                {lead.tipo_operacao === "aluguel" ? "Aluguel · Mensal" : "Valor de referência"}
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="pp-price text-[20px] leading-none">
                  <span className="pp-currency">R$</span>
                  {valorFormatado.replace(/R\$\s?/, "")}
                </span>
                {lead.tipo_operacao === "aluguel" && <span className="text-[10px] text-muted-foreground">/mês</span>}
              </div>
            </div>
          )}

          {/* Interest line */}
          {lead.interesse && (
            <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2 border-l-2 border-border pl-2">
              "{lead.interesse}"
            </p>
          )}

          {/* Interest tags */}
          {(lead.bairro_interesse || lead.tipo_imovel_interesse) && (
            <div className="flex items-center gap-1 flex-wrap">
              {lead.bairro_interesse && (
                <span className="pp-chip">
                  <MapPin className="w-2.5 h-2.5" />{lead.bairro_interesse}
                </span>
              )}
              {lead.tipo_imovel_interesse && (
                <span className="pp-chip">
                  <Building2 className="w-2.5 h-2.5" />{lead.tipo_imovel_interesse}
                </span>
              )}
            </div>
          )}

          {/* Status pills */}
          {(propostasCount && propostasCount > 0) || dataContato || (lead.estagio === "perdido" && lead.motivo_perda) ? (
            <div className="flex items-center gap-1.5 flex-wrap">
              {propostasCount && propostasCount > 0 ? (
                <span className="pp-chip pp-chip-gold">
                  <FileText className="w-2.5 h-2.5" />{propostasCount} proposta{propostasCount > 1 ? "s" : ""}
                </span>
              ) : null}
              {dataContato && (
                <span className="pp-chip">
                  <MessageCircle className="w-2.5 h-2.5" />{dataContato}
                </span>
              )}
              {lead.estagio === "perdido" && lead.motivo_perda && (
                <span className="pp-chip">
                  <Ban className="w-2.5 h-2.5 shrink-0" />
                  <span className="truncate max-w-[140px]">{lead.motivo_perda}</span>
                </span>
              )}
            </div>
          ) : null}

          <div className="pp-divider" />

          {/* Quick actions bar */}
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {lead.telefone && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <a
                    href={`https://wa.me/55${lead.telefone.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="pp-action-btn pp-action-gold"
                    aria-label="WhatsApp"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                  </a>
                </TooltipTrigger>
                <TooltipContent side="bottom"><p>WhatsApp · {lead.telefone}</p></TooltipContent>
              </Tooltip>
            )}
            {lead.telefone && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <a
                    href={`tel:${lead.telefone.replace(/\D/g, "")}`}
                    className="pp-action-btn"
                    aria-label="Ligar"
                  >
                    <Phone className="w-3.5 h-3.5" />
                  </a>
                </TooltipTrigger>
                <TooltipContent side="bottom"><p>Ligar</p></TooltipContent>
              </Tooltip>
            )}
            {lead.email && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <a
                    href={`mailto:${lead.email}`}
                    className="pp-action-btn"
                    aria-label="E-mail"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </a>
                </TooltipTrigger>
                <TooltipContent side="bottom"><p>E-mail · {lead.email}</p></TooltipContent>
              </Tooltip>
            )}
            {onProposta && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onProposta(lead)}
                    className="pp-action-btn"
                    aria-label="Proposta"
                  >
                    <Handshake className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom"><p>Nova proposta</p></TooltipContent>
              </Tooltip>
            )}
            {onFollowup && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onFollowup(lead)}
                    className="pp-action-btn"
                    aria-label="Follow-up"
                  >
                    <CalendarClock className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom"><p>Agendar follow-up</p></TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => {
                    const event = new CustomEvent("open-lead-research", { detail: lead });
                    window.dispatchEvent(event);
                  }}
                  className="pp-action-btn ml-auto"
                  aria-label="Pesquisa"
                >
                  <Search className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom"><p>Pesquisa Inteligente</p></TooltipContent>
            </Tooltip>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-0.5">
            <div className="flex items-center gap-1 min-w-0">
              <User className="w-3 h-3 shrink-0" />
              <span className="truncate font-medium">{lead.corretor_nome || "Sem corretor"}</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Clock className="w-3 h-3" />
              <span>{tempo}</span>
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}

export const LeadCard = memo(LeadCardComponent, (prev, next) => {
  return (
    prev.lead === next.lead &&
    prev.propostasCount === next.propostasCount &&
    prev.leadScore === next.leadScore &&
    prev.followupAtrasado === next.followupAtrasado &&
    prev.stageColor === next.stageColor &&
    prev.isMaster === next.isMaster &&
    prev.corretores === next.corretores &&
    prev.onEdit === next.onEdit &&
    prev.onDelete === next.onDelete &&
    prev.onFollowup === next.onFollowup &&
    prev.onSchedule === next.onSchedule &&
    prev.onProposta === next.onProposta &&
    prev.onFechar === next.onFechar &&
    prev.onShowHistory === next.onShowHistory &&
    prev.onAdvance === next.onAdvance &&
    prev.onBack === next.onBack &&
    prev.nextStageTitle === next.nextStageTitle &&
    prev.prevStageTitle === next.prevStageTitle &&

    prev.onDragStart === next.onDragStart &&
    prev.onAssignCorretor === next.onAssignCorretor
  );
});
