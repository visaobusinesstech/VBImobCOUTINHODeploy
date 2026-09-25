import { useMemo, useState } from "react";
import { Phone, MessageCircle, Mail, Home, Handshake, Pin, Check, Trash2, AlertTriangle, Clock, CalendarDays, ChevronDown, ChevronUp, Search, User } from "lucide-react";
import { formatDistanceToNow, isToday, isPast, parseISO, format, isTomorrow, isThisWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Followup } from "@/hooks/useFollowups";

const TIPO_ICONS: Record<string, React.ReactNode> = {
  ligacao: <Phone className="w-3.5 h-3.5" />,
  whatsapp: <MessageCircle className="w-3.5 h-3.5" />,
  email: <Mail className="w-3.5 h-3.5" />,
  visita: <Home className="w-3.5 h-3.5" />,
  reuniao: <Handshake className="w-3.5 h-3.5" />,
  outro: <Pin className="w-3.5 h-3.5" />,
};

const TIPO_LABELS: Record<string, string> = {
  ligacao: "Ligação",
  whatsapp: "WhatsApp",
  email: "E-mail",
  visita: "Visita",
  reuniao: "Reunião",
  outro: "Outro",
};

interface Props {
  followups: Followup[];
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
}

export function FollowupPanel({ followups, onComplete, onDelete }: Props) {
  const [search, setSearch] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    atrasados: true,
    hoje: true,
    amanha: true,
    semana: false,
    futuros: false,
  });

  const pendentes = useMemo(
    () => followups.filter(f => f.status === "pendente").sort((a, b) => a.data_followup.localeCompare(b.data_followup)),
    [followups]
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return pendentes;
    const q = search.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    return pendentes.filter(f => {
      const nome = (f.lead_nome || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const desc = (f.descricao || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const tel = (f.lead_telefone || "").replace(/\D/g, "");
      const qDigits = search.replace(/\D/g, "");
      return nome.includes(q) || desc.includes(q) || (qDigits && tel.includes(qDigits));
    });
  }, [pendentes, search]);

  const atrasados = filtered.filter(f => isPast(parseISO(f.data_followup)) && !isToday(parseISO(f.data_followup)));
  const hojeList = filtered.filter(f => isToday(parseISO(f.data_followup)));
  const amanhaList = filtered.filter(f => isTomorrow(parseISO(f.data_followup)));
  const semanaList = filtered.filter(f => {
    const d = parseISO(f.data_followup);
    return !isPast(d) && !isToday(d) && !isTomorrow(d) && isThisWeek(d, { locale: ptBR });
  });
  const futuros = filtered.filter(f => {
    const d = parseISO(f.data_followup);
    return !isPast(d) && !isToday(d) && !isTomorrow(d) && !isThisWeek(d, { locale: ptBR });
  });

  const toggleGroup = (key: string) => setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }));

  if (pendentes.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        <CalendarDays className="w-8 h-8 mx-auto mb-2 opacity-40" />
        Nenhum follow-up pendente. Todos os clientes estão em dia! 🎉
      </div>
    );
  }

  const renderCard = (f: Followup, variant: "danger" | "warning" | "default") => {
    const borderColors = {
      danger: "border-l-destructive",
      warning: "border-l-yellow-500",
      default: "border-l-primary/40",
    };
    const bgColors = {
      danger: "bg-destructive/5 hover:bg-destructive/10",
      warning: "bg-yellow-500/5 hover:bg-yellow-500/10",
      default: "bg-muted/20 hover:bg-muted/40",
    };

    return (
      <div
        key={f.id}
        className={`flex items-start gap-3 p-3 rounded-lg border border-border border-l-4 ${borderColors[variant]} ${bgColors[variant]} transition-all group`}
      >
        <div className="flex flex-col items-center gap-1 pt-0.5">
          <div className={`p-1.5 rounded-md ${variant === "danger" ? "bg-destructive/10 text-destructive" : variant === "warning" ? "bg-yellow-500/10 text-yellow-600" : "bg-primary/10 text-primary"}`}>
            {TIPO_ICONS[f.tipo] || TIPO_ICONS.outro}
          </div>
          <span className="text-[9px] font-medium text-muted-foreground uppercase">{TIPO_LABELS[f.tipo] || f.tipo}</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <User className="w-3 h-3 text-muted-foreground shrink-0" />
            <p className="text-sm font-semibold text-foreground truncate">{f.lead_nome}</p>
          </div>
          {f.descricao && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">{f.descricao}</p>
          )}
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <CalendarDays className="w-3 h-3" />
              {format(parseISO(f.data_followup), "dd/MM/yyyy")}
            </span>
            <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium ${variant === "danger" ? "bg-destructive/10 text-destructive" : variant === "warning" ? "bg-yellow-500/10 text-yellow-600" : "bg-muted text-muted-foreground"}`}>
              {formatDistanceToNow(parseISO(f.data_followup), { addSuffix: true, locale: ptBR })}
            </span>
          </div>

          {/* Quick actions row */}
          <div className="flex items-center gap-2 mt-2">
            {f.lead_telefone && (
              <>
                <a
                  href={`https://wa.me/55${f.lead_telefone.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md bg-green-500/10 text-green-600 hover:bg-green-500/20 transition-colors font-medium"
                >
                  <MessageCircle className="w-3 h-3" />WhatsApp
                </a>
                <a
                  href={`tel:${f.lead_telefone.replace(/\D/g, "")}`}
                  className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 transition-colors font-medium"
                >
                  <Phone className="w-3 h-3" />Ligar
                </a>
              </>
            )}
            {f.lead_email && (
              <a
                href={`mailto:${f.lead_email}`}
                className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md bg-purple-500/10 text-purple-600 hover:bg-purple-500/20 transition-colors font-medium"
              >
                <Mail className="w-3 h-3" />E-mail
              </a>
            )}
          </div>
        </div>

        <div className="flex flex-col items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button onClick={() => onComplete(f.id)} className="p-1.5 rounded-md hover:bg-primary/10 text-primary" title="Concluir">
            <Check className="w-4 h-4" />
          </button>
          <button onClick={() => onDelete(f.id)} className="p-1.5 rounded-md hover:bg-destructive/10 text-destructive" title="Excluir">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  const renderGroup = (
    key: string,
    title: string,
    items: Followup[],
    variant: "danger" | "warning" | "default",
    icon: React.ReactNode
  ) => {
    if (items.length === 0) return null;
    const isOpen = expandedGroups[key] !== false;

    return (
      <div className="space-y-2">
        <button
          onClick={() => toggleGroup(key)}
          className="flex items-center gap-2 w-full text-left group/header hover:opacity-80 transition-opacity"
        >
          {icon}
          <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">{title}</h4>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${variant === "danger" ? "bg-destructive/15 text-destructive" : variant === "warning" ? "bg-yellow-500/15 text-yellow-600" : "bg-secondary text-muted-foreground"}`}>
            {items.length}
          </span>
          <span className="ml-auto text-muted-foreground">
            {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </span>
        </button>
        {isOpen && (
          <div className="space-y-2">
            {items.map(f => renderCard(f, variant))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="flex flex-col items-center p-2 rounded-lg bg-destructive/5 border border-destructive/20">
          <span className="text-lg font-bold text-destructive">{atrasados.length}</span>
          <span className="text-[10px] text-destructive/80 font-medium">Atrasados</span>
        </div>
        <div className="flex flex-col items-center p-2 rounded-lg bg-yellow-500/5 border border-yellow-500/20">
          <span className="text-lg font-bold text-yellow-600">{hojeList.length}</span>
          <span className="text-[10px] text-yellow-600/80 font-medium">Hoje</span>
        </div>
        <div className="flex flex-col items-center p-2 rounded-lg bg-primary/5 border border-primary/20">
          <span className="text-lg font-bold text-primary">{amanhaList.length}</span>
          <span className="text-[10px] text-primary/80 font-medium">Amanhã</span>
        </div>
        <div className="flex flex-col items-center p-2 rounded-lg bg-muted border border-border">
          <span className="text-lg font-bold text-foreground">{semanaList.length + futuros.length}</span>
          <span className="text-[10px] text-muted-foreground font-medium">Futuros</span>
        </div>
      </div>

      {/* Search */}
      {pendentes.length > 5 && (
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar follow-up por nome ou telefone..."
            className="w-full h-8 pl-8 pr-3 rounded-md bg-background border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
        </div>
      )}

      {/* Groups */}
      {renderGroup("atrasados", "Atrasados", atrasados, "danger", <AlertTriangle className="w-4 h-4 text-destructive" />)}
      {renderGroup("hoje", "Hoje", hojeList, "warning", <Clock className="w-4 h-4 text-yellow-500" />)}
      {renderGroup("amanha", "Amanhã", amanhaList, "default", <CalendarDays className="w-4 h-4 text-primary" />)}
      {renderGroup("semana", "Esta semana", semanaList, "default", <CalendarDays className="w-4 h-4 text-muted-foreground" />)}
      {renderGroup("futuros", "Próximos", futuros, "default", <CalendarDays className="w-4 h-4 text-muted-foreground" />)}

      {filtered.length === 0 && search && (
        <p className="text-center text-xs text-muted-foreground py-4">Nenhum follow-up encontrado para "{search}"</p>
      )}
    </div>
  );
}
