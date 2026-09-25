import { useEffect, useMemo, useState } from "react";
import { Activity, RefreshCw, Radio } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentCorretor } from "@/hooks/useCurrentCorretor";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Atividade {
  id: string;
  lead_id: string;
  tipo: string;
  titulo: string;
  descricao: string | null;
  created_at: string;
  ator_nome: string | null;
  ator_user_id: string | null;
}

interface Props {
  /** Leads visíveis para o usuário atual (já filtrados pelo hook/RLS). */
  leads: { id: string; nome: string; corretor_nome?: string | null }[];
}

const LIMITE = 80;

function tempoRelativo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
}

export function AcoesTempoRealPanel({ leads }: Props) {
  const { imobiliariaId, isMaster, user } = useAuth();
  const { corretorId, isBroker } = useCurrentCorretor();
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [loading, setLoading] = useState(true);
  const [ao, setAo] = useState(false);
  const [filtroAtor, setFiltroAtor] = useState<string>("todos");

  const leadMap = useMemo(() => new Map(leads.map((l) => [l.id, l])), [leads]);

  const carregar = async () => {
    if (!imobiliariaId) return;
    setLoading(true);
    const { data } = await supabase
      .from("lead_atividades")
      .select("id, lead_id, tipo, titulo, descricao, created_at, ator_nome, ator_user_id")
      .eq("imobiliaria_id", imobiliariaId)
      .order("created_at", { ascending: false })
      .limit(LIMITE * 3);
    setAtividades((data as any[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imobiliariaId]);

  useEffect(() => {
    if (!imobiliariaId) return;
    const channel = supabase
      .channel("acoes-tempo-real")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "lead_atividades", filter: `imobiliaria_id=eq.${imobiliariaId}` },
        (payload) => {
          setAtividades((prev) => [payload.new as Atividade, ...prev].slice(0, LIMITE * 3));
        }
      )
      .subscribe((status) => setAo(status === "SUBSCRIBED"));

    return () => {
      supabase.removeChannel(channel);
    };
  }, [imobiliariaId]);

  // Corretor só vê ações dos leads que enxerga; master vê tudo (inclusive as próprias).
  const visiveis = useMemo(() => {
    const base = isMaster || !isBroker ? atividades : atividades.filter((a) => leadMap.has(a.lead_id));
    const filtradas = filtroAtor === "todos" ? base : base.filter((a) => (a.ator_nome || "Sistema") === filtroAtor);
    return filtradas.slice(0, LIMITE);
  }, [atividades, isMaster, isBroker, leadMap, filtroAtor]);

  const atores = useMemo(() => {
    const set = new Set<string>();
    atividades.forEach((a) => set.add(a.ator_nome || "Sistema"));
    return Array.from(set).sort();
  }, [atividades]);

  return (
    <div className="mb-4 p-4 rounded-xl bg-muted/30 border border-border">
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Ações da equipe em tempo real</h3>
          <Badge variant={ao ? "default" : "secondary"} className="gap-1 text-[10px]">
            <Radio className="w-3 h-3" />{ao ? "Ao vivo" : "Conectando..."}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {(isMaster || !isBroker) && (
            <select
              value={filtroAtor}
              onChange={(e) => setFiltroAtor(e.target.value)}
              className="h-8 px-2 rounded-md bg-background border border-border text-xs text-foreground"
            >
              <option value="todos">Todos os usuários</option>
              {atores.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          )}
          <button onClick={carregar} className="pp-btn h-8 text-xs" disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />Atualizar
          </button>
        </div>
      </div>

      {visiveis.length === 0 ? (
        <p className="text-xs text-muted-foreground py-6 text-center">
          {loading ? "Carregando ações..." : "Nenhuma ação registrada ainda."}
        </p>
      ) : (
        <ScrollArea className="h-[320px] pr-2">
          <ul className="space-y-2">
            {visiveis.map((a) => {
              const lead = leadMap.get(a.lead_id);
              const ehVoce = a.ator_user_id && a.ator_user_id === user?.id;
              return (
                <li key={a.id} className="flex items-start gap-3 p-2.5 rounded-lg bg-background border border-border">
                  <span className="mt-1 w-2 h-2 rounded-full bg-primary shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-foreground truncate">
                        {a.ator_nome || "Sistema"}{ehVoce ? " (você)" : ""}
                      </span>
                      <Badge variant="outline" className="text-[10px]">{a.tipo}</Badge>
                      <span className="text-[10px] text-muted-foreground">{tempoRelativo(a.created_at)}</span>
                    </div>
                    <p className="text-xs text-foreground mt-0.5 break-words">{a.titulo}</p>
                    {a.descricao && <p className="text-[11px] text-muted-foreground break-words">{a.descricao}</p>}
                    {lead && <p className="text-[11px] text-muted-foreground mt-0.5">Lead: {lead.nome}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
        </ScrollArea>
      )}
    </div>
  );
}
