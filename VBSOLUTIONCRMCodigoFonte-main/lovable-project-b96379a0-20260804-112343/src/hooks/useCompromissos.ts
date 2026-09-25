import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useCurrentCorretor } from "@/hooks/useCurrentCorretor";

export interface Compromisso {
  id: string;
  imobiliaria_id: string;
  titulo: string;
  descricao: string | null;
  tipo: string;
  data_inicio: string;
  data_fim: string | null;
  local: string | null;
  lead_id: string | null;
  corretor_id: string | null;
  imovel_id: string | null;
  status: string;
  lembrete_whatsapp: boolean;
  telefone_lembrete: string | null;
  prioridade: string;
  email_cliente: string | null;
  google_maps_link: string | null;
  confirmado: boolean;
  lembrete_nivel: number;
  checkin_at: string | null;
  checkout_at: string | null;
  feedback_visita: string | null;
  feedback_ia: string | null;
  confirmacao_status: string;
  confirmacao_token: string | null;
  confirmacao_mensagem: string | null;
  cliente_resposta: string | null;
  data_reagendamento_sugerida: string | null;
  resultado_cliente: string | null;
  created_at: string;
  updated_at: string;
  lead_nome?: string | null;
  corretor_nome?: string | null;
}

export const TIPOS_COMPROMISSO = [
  { id: "visita", label: "🏠 Visita a Imóvel", color: "hsl(262, 83%, 58%)" },
  { id: "reuniao", label: "🤝 Reunião", color: "hsl(199, 89%, 48%)" },
  { id: "tarefa", label: "📋 Tarefa Interna", color: "hsl(38, 92%, 50%)" },
  { id: "ligacao", label: "📞 Ligação", color: "hsl(142, 71%, 45%)" },
  { id: "assinatura", label: "✍️ Assinatura", color: "hsl(0, 72%, 51%)" },
  { id: "outro", label: "📌 Outro", color: "hsl(220, 9%, 46%)" },
] as const;

export function useCompromissos(options: { enabled?: boolean } = {}) {
  const { enabled = true } = options;
  const { user, imobiliariaId } = useAuth();
  const { corretorId, isBroker, ready: corretorReady } = useCurrentCorretor();
  const { toast } = useToast();
  const [compromissos, setCompromissos] = useState<Compromisso[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCompromissos = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    if (!user || !corretorReady) return;
    setLoading(true);
    let q = supabase
      .from("compromissos")
      .select("*, leads(nome), corretores(nome)")
      .order("data_inicio", { ascending: true });
    if (isBroker && corretorId) q = q.eq("corretor_id", corretorId) as any;
    const { data, error } = await q;

    if (error) {
      toast({ title: "Erro ao carregar agenda", description: error.message, variant: "destructive" });
    } else {
      setCompromissos(
        (data ?? []).map((d: any) => ({
          ...d,
          lead_nome: d.leads?.nome ?? null,
          corretor_nome: d.corretores?.nome ?? null,
        }))
      );
    }
    setLoading(false);
  }, [enabled, user, corretorReady, isBroker, corretorId, toast]);

  useEffect(() => { fetchCompromissos(); }, [fetchCompromissos]);

  useEffect(() => {
    if (!enabled || !user || !imobiliariaId) return;
    const channel = supabase
      .channel(`compromissos-realtime:${imobiliariaId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "compromissos", filter: `imobiliaria_id=eq.${imobiliariaId}` }, () => fetchCompromissos())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [enabled, user, imobiliariaId, fetchCompromissos]);

  const createCompromisso = async (data: Partial<Compromisso>) => {
    if (!user) return null;
    const { data: result, error } = await supabase
      .from("compromissos")
      .insert({ ...data, imobiliaria_id: imobiliariaId } as any)
      .select()
      .single();
    if (error) {
      toast({ title: "Erro ao criar compromisso", description: error.message, variant: "destructive" });
      return null;
    }

    if (data.lead_id) {
      await supabase.from("lead_atividades").insert({
        lead_id: data.lead_id,
        imobiliaria_id: imobiliariaId,
        tipo: "agenda",
        titulo: "Compromisso agendado",
        descricao: `${data.titulo} em ${new Date(data.data_inicio!).toLocaleString("pt-BR")}`,
      });
    }

    toast({ title: "Compromisso agendado!" });
    return result;
  };

  const updateCompromisso = async (id: string, updates: Partial<Compromisso>) => {
    const { error } = await supabase.from("compromissos").update(updates as any).eq("id", id);
    if (error) {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
      return false;
    }
    return true;
  };

  const deleteCompromisso = async (id: string) => {
    const { error } = await supabase.from("compromissos").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
      return false;
    }
    toast({ title: "Compromisso removido!" });
    return true;
  };

  const hoje = new Date().toISOString().split("T")[0];
  const compromissosHoje = useMemo(() => compromissos.filter(c => c.data_inicio.startsWith(hoje)), [compromissos, hoje]);
  const pendentes = useMemo(() => compromissos.filter(c => c.status === "pendente"), [compromissos]);

  return { compromissos, loading, compromissosHoje, pendentes, createCompromisso, updateCompromisso, deleteCompromisso, refetch: fetchCompromissos };
}
