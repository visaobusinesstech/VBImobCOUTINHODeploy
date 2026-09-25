import { format, parseISO, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, Clock, MapPin, User, Trash2, Check, MessageCircle, Pencil, Flag, ExternalLink, ClipboardCheck, ThumbsUp, ThumbsDown, MoreHorizontal } from "lucide-react";
import type { Compromisso } from "@/hooks/useCompromissos";
import type { Followup } from "@/hooks/useFollowups";
import { TIPOS_COMPROMISSO } from "@/hooks/useCompromissos";

const FOLLOWUP_TIPOS: Record<string, { label: string; color: string }> = {
  ligacao: { label: "📞 Ligação", color: "hsl(142, 71%, 45%)" },
  whatsapp: { label: "💬 WhatsApp", color: "hsl(142, 71%, 45%)" },
  email: { label: "📧 E-mail", color: "hsl(199, 89%, 48%)" },
  visita: { label: "🏠 Visita", color: "hsl(262, 83%, 58%)" },
  reuniao: { label: "🤝 Reunião", color: "hsl(199, 89%, 48%)" },
  outro: { label: "📌 Outro", color: "hsl(220, 9%, 46%)" },
};

type UnifiedItem = 
  | { source: "compromisso"; item: Compromisso }
  | { source: "followup"; item: Followup };

interface Props {
  compromissos: Compromisso[];
  followups: Followup[];
  selectedDate?: string;
  onClearDate: () => void;
  onComplete: (id: string, source: "compromisso" | "followup") => void;
  onDelete: (id: string, source: "compromisso" | "followup") => void;
  onEdit: (id: string, source: "compromisso" | "followup") => void;
  onNewItem: () => void;
  onRegistrarVisita?: (c: Compromisso) => void;
}

export function AgendaList({ compromissos, followups, selectedDate, onClearDate, onComplete, onDelete, onEdit, onNewItem, onRegistrarVisita }: Props) {
  const hoje = new Date().toISOString().split("T")[0];

  // Merge and sort
  const unified: UnifiedItem[] = [
    ...compromissos.map(c => ({ source: "compromisso" as const, item: c })),
    ...followups.map(f => ({ source: "followup" as const, item: f })),
  ].sort((a, b) => {
    const dateA = a.source === "compromisso" ? a.item.data_inicio : (a.item as Followup).data_followup;
    const dateB = b.source === "compromisso" ? b.item.data_inicio : (b.item as Followup).data_followup;
    return dateA.localeCompare(dateB);
  });

  // Filter
  const filtered = selectedDate
    ? unified.filter(u => {
        const d = u.source === "compromisso" ? u.item.data_inicio : (u.item as Followup).data_followup;
        return d.startsWith(selectedDate);
      })
    : unified.filter(u => {
        return u.source === "compromisso" ? u.item.status === "pendente" : (u.item as Followup).status === "pendente";
      });

  return (
    <div className="space-y-4">
      {selectedDate && (
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-medium text-foreground">
            {format(parseISO(selectedDate), "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </span>
          <button onClick={onClearDate} className="text-xs text-muted-foreground hover:text-foreground underline">
            Ver todos pendentes
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <CalendarDays className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">{selectedDate ? "Nenhum item neste dia" : "Nenhum item pendente"}</p>
          <button onClick={onNewItem} className="mt-3 text-sm text-primary hover:underline">+ Agendar compromisso</button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(u => {
            if (u.source === "compromisso") {
              return <CompromissoRow key={`c-${u.item.id}`} c={u.item} hoje={hoje} onComplete={onComplete} onDelete={onDelete} onEdit={onEdit} onRegistrarVisita={onRegistrarVisita} />;
            }
            return <FollowupRow key={`f-${u.item.id}`} f={u.item as Followup} hoje={hoje} onComplete={onComplete} onDelete={onDelete} onEdit={onEdit} />;
          })}
        </div>
      )}
    </div>
  );
}

function CompromissoRow({ c, hoje, onComplete, onDelete, onEdit, onRegistrarVisita }: { c: Compromisso; hoje: string; onComplete: Props["onComplete"]; onDelete: Props["onDelete"]; onEdit: Props["onEdit"]; onRegistrarVisita?: Props["onRegistrarVisita"] }) {
  const info = TIPOS_COMPROMISSO.find(t => t.id === c.tipo) || TIPOS_COMPROMISSO[5];
  const dataInicio = parseISO(c.data_inicio);
  const isAtrasado = isPast(dataInicio) && c.status === "pendente" && !c.data_inicio.startsWith(hoje);
  const isConcluido = c.status === "concluido";

  return (
    <div className={`flex items-start gap-4 p-4 rounded-xl border transition-all group ${
      isConcluido ? "border-border/30 bg-muted/10 opacity-60" :
      isAtrasado ? "border-destructive/30 bg-destructive/5" :
      "border-border bg-card hover:border-primary/30"
    }`}>
      <div className="mt-1 w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: info.color }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h4 className={`text-sm font-semibold ${isConcluido ? "line-through text-muted-foreground" : "text-foreground"}`}>{c.titulo}</h4>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{info.label}</span>
          {c.prioridade === "alta" && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium"><Flag className="w-2.5 h-2.5 inline mr-0.5" />Alta</span>}
          {c.prioridade === "baixa" && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-600 font-medium"><Flag className="w-2.5 h-2.5 inline mr-0.5" />Baixa</span>}
          {isAtrasado && <span className="text-[10px] px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium">Atrasado</span>}
          {isConcluido && <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">Concluído</span>}
          {c.confirmado && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-600 font-medium">✅ Confirmado</span>}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {format(dataInicio, "dd/MM · HH:mm")}
            {c.data_fim && ` — ${format(parseISO(c.data_fim), "HH:mm")}`}
          </span>
          {c.local && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{c.local}</span>}
          {c.google_maps_link && (
            <a href={c.google_maps_link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline" onClick={e => e.stopPropagation()}>
              <ExternalLink className="w-3 h-3" />Mapa
            </a>
          )}
          {c.lead_nome && <span className="flex items-center gap-1"><User className="w-3 h-3" />{c.lead_nome}</span>}
          {c.corretor_nome && <span className="flex items-center gap-1"><User className="w-3 h-3" />{c.corretor_nome}</span>}
        </div>
        {c.descricao && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{c.descricao}</p>}
        {c.resultado_cliente && (
          <div className="flex items-center gap-1.5 mt-1.5">
            {c.resultado_cliente === "gostou" && <><ThumbsUp className="w-3 h-3 text-green-600" /><span className="text-[11px] text-green-600 font-medium">Gostou do imóvel</span></>}
            {c.resultado_cliente === "mais_opcoes" && <><MoreHorizontal className="w-3 h-3 text-yellow-600" /><span className="text-[11px] text-yellow-600 font-medium">Pediu mais opções</span></>}
            {c.resultado_cliente === "nao_gostou" && <><ThumbsDown className="w-3 h-3 text-destructive" /><span className="text-[11px] text-destructive font-medium">Não gostou</span></>}
          </div>
        )}
        {c.feedback_visita && <p className="text-xs text-muted-foreground mt-1 italic line-clamp-2">📝 {c.feedback_visita}</p>}
        {c.lembrete_whatsapp && c.telefone_lembrete && (
          <a href={`https://wa.me/55${c.telefone_lembrete.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline mt-1">
            <MessageCircle className="w-3 h-3" />WhatsApp
          </a>
        )}
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => onEdit(c.id, "compromisso")} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground" title="Editar">
          <Pencil className="w-4 h-4" />
        </button>
        {c.status === "pendente" && (c.tipo === "visita" || c.tipo === "reuniao") && onRegistrarVisita && (
          <button onClick={() => onRegistrarVisita(c)} className="p-1.5 rounded-md hover:bg-primary/10 text-primary" title="Registrar visita realizada">
            <ClipboardCheck className="w-4 h-4" />
          </button>
        )}
        {c.status === "pendente" && (
          <button onClick={() => onComplete(c.id, "compromisso")} className="p-1.5 rounded-md hover:bg-primary/10 text-primary" title="Concluir">
            <Check className="w-4 h-4" />
          </button>
        )}
        <button onClick={() => onDelete(c.id, "compromisso")} className="p-1.5 rounded-md hover:bg-destructive/10 text-destructive" title="Excluir">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function FollowupRow({ f, hoje, onComplete, onDelete, onEdit }: { f: Followup; hoje: string; onComplete: Props["onComplete"]; onDelete: Props["onDelete"]; onEdit: Props["onEdit"] }) {
  const info = FOLLOWUP_TIPOS[f.tipo] || FOLLOWUP_TIPOS.outro;
  const isAtrasado = f.status === "pendente" && new Date(f.data_followup) < new Date(hoje);
  const isConcluido = f.status === "concluido";

  return (
    <div className={`flex items-start gap-4 p-4 rounded-xl border transition-all group ${
      isConcluido ? "border-border/30 bg-muted/10 opacity-60" :
      isAtrasado ? "border-destructive/30 bg-destructive/5" :
      "border-border bg-card hover:border-primary/30"
    }`}>
      <div className="mt-1 w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: info.color }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h4 className={`text-sm font-semibold ${isConcluido ? "line-through text-muted-foreground" : "text-foreground"}`}>
            Follow-up: {f.lead_nome}
          </h4>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{info.label}</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent text-accent-foreground font-medium">Follow-up</span>
          {isAtrasado && <span className="text-[10px] px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium">Atrasado</span>}
          {isConcluido && <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">Concluído</span>}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {format(parseISO(f.data_followup), "dd/MM/yyyy")}
          </span>
          {f.lead_nome && <span className="flex items-center gap-1"><User className="w-3 h-3" />{f.lead_nome}</span>}
          {f.lead_telefone && (
            <a href={`https://wa.me/55${f.lead_telefone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
              <MessageCircle className="w-3 h-3" />WhatsApp
            </a>
          )}
        </div>
        {f.descricao && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{f.descricao}</p>}
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => onEdit(f.id, "followup")} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground" title="Editar">
          <Pencil className="w-4 h-4" />
        </button>
        {f.status === "pendente" && (
          <button onClick={() => onComplete(f.id, "followup")} className="p-1.5 rounded-md hover:bg-primary/10 text-primary" title="Concluir">
            <Check className="w-4 h-4" />
          </button>
        )}
        <button onClick={() => onDelete(f.id, "followup")} className="p-1.5 rounded-md hover:bg-destructive/10 text-destructive" title="Excluir">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
