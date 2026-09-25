import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  History, 
  CalendarClock, 
  UserPlus, 
  ArrowRightLeft, 
  Ban, 
  FileText,
  MessageCircle,
  PlusCircle,
  Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Lead } from "@/hooks/useLeads";

interface Activity {
  id: string;
  tipo: string;
  titulo: string;
  descricao: string | null;
  created_at: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead | null;
}

const getActivityIcon = (tipo: string) => {
  switch (tipo) {
    case 'captacao': return <UserPlus className="w-4 h-4 text-blue-500" />;
    case 'estagio': return <ArrowRightLeft className="w-4 h-4 text-purple-500" />;
    case 'atribuicao': return <PlusCircle className="w-4 h-4 text-orange-500" />;
    case 'perda': return <Ban className="w-4 h-4 text-destructive" />;
    case 'anotacao': return <FileText className="w-4 h-4 text-gray-500" />;
    case 'followup': return <CalendarClock className="w-4 h-4 text-green-500" />;
    case 'whatsapp': return <MessageCircle className="w-4 h-4 text-green-600" />;
    default: return <History className="w-4 h-4 text-muted-foreground" />;
  }
};

type ParsedMeta = { origem?: string; destino?: string; executor?: string };

const parseMeta = (titulo: string, descricao: string): ParsedMeta => {
  const meta: ParsedMeta = {};
  // "Transferido de "X" para "Y"."
  const transfer = descricao.match(/de\s+"([^"]+)"\s+para\s+"([^"]+)"/i);
  if (transfer) {
    meta.origem = transfer[1];
    meta.destino = transfer[2];
  }
  // "Movido de "X" para "Y""
  const estagio = descricao.match(/Movido de\s+"([^"]+)"\s+para\s+"([^"]+)"/i);
  if (estagio) {
    meta.origem = estagio[1];
    meta.destino = estagio[2];
  }
  const exec = descricao.match(/Executado (?:por|em):\s*([^\n]+)/i);
  if (exec) meta.executor = exec[1].trim().replace(/\s*\(America\/Sao_Paulo\)\s*$/, "");
  // Auto-assign Ludmila
  if (/Atribui[cç][aã]o autom[aá]tica/i.test(titulo) && !meta.destino) {
    const m = titulo.match(/→\s*(.+)$/);
    if (m) meta.destino = m[1].trim();
    meta.executor = meta.executor || "Sistema (automático)";
  }
  return meta;
};


export function LeadHistoryDialog({ open, onOpenChange, lead }: Props) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && lead) {
      fetchActivities();
    }
  }, [open, lead]);

  const fetchActivities = async () => {
    if (!lead) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("lead_atividades")
        .select("*")
        .eq("lead_id", lead.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setActivities(data || []);
    } catch (err) {
      console.error("Error fetching activities:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            Histórico de Atividades
          </DialogTitle>
          <DialogDescription>
            Acompanhe toda a jornada de {lead?.nome || 'Lead'}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[400px] mt-4 pr-4">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : activities.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground py-10">
              <History className="w-10 h-10 mb-2 opacity-20" />
              <p className="text-sm">Nenhuma atividade registrada ainda.</p>
            </div>
          ) : (
            <div className="relative space-y-6 before:absolute before:inset-0 before:ml-5 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-border before:via-border/50 before:to-transparent">
              {activities.map((activity) => (
                <div key={activity.id} className="relative flex items-start gap-4">
                  <div className="z-10 flex h-10 w-10 items-center justify-center rounded-full bg-background border border-border shadow-sm shrink-0">
                    {getActivityIcon(activity.tipo)}
                  </div>
                  <div className="flex flex-col gap-1 min-w-0 flex-1 pt-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-sm font-semibold text-foreground truncate">
                        {activity.titulo}
                      </h4>
                      <time className="text-[10px] text-muted-foreground font-medium shrink-0">
                        {format(new Date(activity.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </time>
                    </div>
                    {activity.descricao && (() => {
                      const meta = parseMeta(activity.titulo, activity.descricao);
                      const hasBadges = meta.origem || meta.destino || meta.executor;
                      return (
                        <>
                          {hasBadges && (
                            <div className="flex flex-wrap gap-1.5 mt-1" data-testid="lead-history-badges">
                              {meta.origem && (
                                <Badge variant="outline" className="text-[10px] gap-1 border-slate-400/40">
                                  <span className="text-muted-foreground">Origem:</span>
                                  <span className="font-medium text-foreground">{meta.origem}</span>
                                </Badge>
                              )}
                              {meta.destino && (
                                <Badge variant="outline" className="text-[10px] gap-1 border-emerald-500/40 bg-emerald-500/5">
                                  <span className="text-muted-foreground">Destino:</span>
                                  <span className="font-medium text-emerald-700">{meta.destino}</span>
                                </Badge>
                              )}
                              {meta.executor && (
                                <Badge variant="outline" className="text-[10px] gap-1 border-blue-500/40 bg-blue-500/5">
                                  <span className="text-muted-foreground">Executor:</span>
                                  <span className="font-medium text-blue-700">{meta.executor}</span>
                                </Badge>
                              )}
                            </div>
                          )}
                          <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
                            {activity.descricao}
                          </p>
                        </>
                      );
                    })()}

                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
