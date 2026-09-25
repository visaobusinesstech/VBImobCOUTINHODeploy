import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export type TipoEventoNutricao =
  | "abertura"
  | "clique"
  | "resposta"
  | "agendamento"
  | "fechamento";

export const TIPOS_EVENTO: { tipo: TipoEventoNutricao; label: string }[] = [
  { tipo: "abertura", label: "Abertura" },
  { tipo: "clique", label: "Clique" },
  { tipo: "resposta", label: "Resposta" },
  { tipo: "agendamento", label: "Agendamento" },
  { tipo: "fechamento", label: "Fechamento" },
];

export interface NutricaoEvento {
  id: string;
  fluxo_id: string;
  inscricao_id: string | null;
  envio_id: string | null;
  etapa_id: string | null;
  lead_id: string | null;
  tipo: TipoEventoNutricao;
  canal: string | null;
  valor: number | null;
  observacao: string | null;
  ocorrido_em: string;
}

export interface MetricasFluxo {
  fluxo_id: string;
  nome: string;
  ativo: boolean;
  inscritos: number;
  envios: number;
  enviados: number;
  aberturas: number;
  cliques: number;
  respostas: number;
  agendamentos: number;
  fechamentos: number;
  valorFechado: number;
  taxaAbertura: number;
  taxaClique: number;
  taxaResposta: number;
  taxaAgendamento: number;
  taxaFechamento: number;
  reativados: number;
  taxaReativacao: number;
}

export function useNutricaoMetricas(dias = 90) {
  const { user, imobiliariaId } = useAuth();
  const { toast } = useToast();
  const [eventos, setEventos] = useState<NutricaoEvento[]>([]);
  const [loading, setLoading] = useState(true);

  const desde = useMemo(
    () => new Date(Date.now() - dias * 86400000).toISOString(),
    [dias],
  );

  const fetchEventos = useCallback(async () => {
    if (!user || !imobiliariaId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("nutricao_eventos")
      .select("*")
      .gte("ocorrido_em", desde)
      .order("ocorrido_em", { ascending: false });
    if (error) {
      toast({ title: "Erro ao carregar métricas", description: error.message, variant: "destructive" });
    }
    setEventos((data ?? []) as NutricaoEvento[]);
    setLoading(false);
  }, [user, imobiliariaId, desde, toast]);

  useEffect(() => {
    fetchEventos();
  }, [fetchEventos]);

  const registrarEvento = useCallback(
    async (input: {
      fluxo_id: string;
      tipo: TipoEventoNutricao;
      envio_id?: string | null;
      inscricao_id?: string | null;
      etapa_id?: string | null;
      lead_id?: string | null;
      canal?: string | null;
      valor?: number | null;
      observacao?: string | null;
    }) => {
      if (!imobiliariaId) return false;
      const { error } = await supabase.from("nutricao_eventos").insert({
        imobiliaria_id: imobiliariaId,
        fluxo_id: input.fluxo_id,
        tipo: input.tipo,
        envio_id: input.envio_id ?? null,
        inscricao_id: input.inscricao_id ?? null,
        etapa_id: input.etapa_id ?? null,
        lead_id: input.lead_id ?? null,
        canal: input.canal ?? null,
        valor: input.valor ?? null,
        observacao: input.observacao ?? null,
      });
      if (error) {
        const duplicado = error.code === "23505";
        toast({
          title: duplicado ? "Evento já registrado" : "Erro ao registrar evento",
          description: duplicado ? "Esse tipo já foi marcado para esta mensagem." : error.message,
          variant: duplicado ? "default" : "destructive",
        });
        return false;
      }
      await fetchEventos();
      return true;
    },
    [imobiliariaId, toast, fetchEventos],
  );

  const removerEvento = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("nutricao_eventos").delete().eq("id", id);
      if (error) {
        toast({ title: "Erro ao remover evento", description: error.message, variant: "destructive" });
        return;
      }
      setEventos((prev) => prev.filter((e) => e.id !== id));
    },
    [toast],
  );

  return { eventos, loading, fetchEventos, registrarEvento, removerEvento };
}

const pct = (parte: number, total: number) => (total > 0 ? (parte / total) * 100 : 0);

export function calcularMetricas(
  fluxos: { id: string; nome: string; ativo: boolean }[],
  inscricoes: { fluxo_id: string; id: string }[],
  envios: { id: string; inscricao_id: string; status: string }[],
  eventos: NutricaoEvento[],
): MetricasFluxo[] {
  const fluxoPorInscricao = new Map(inscricoes.map((i) => [i.id, i.fluxo_id]));

  return fluxos.map((f) => {
    const insc = inscricoes.filter((i) => i.fluxo_id === f.id);
    const env = envios.filter((e) => fluxoPorInscricao.get(e.inscricao_id) === f.id);
    const enviados = env.filter((e) => e.status === "enviado").length;
    const ev = eventos.filter((e) => e.fluxo_id === f.id);
    const conta = (t: TipoEventoNutricao) => ev.filter((e) => e.tipo === t).length;

    const aberturas = conta("abertura");
    const cliques = conta("clique");
    const respostas = conta("resposta");
    const agendamentos = conta("agendamento");
    const fechamentos = conta("fechamento");
    const base = enviados || env.length;
    const leadsReativados = new Set(
      ev.filter((e) => e.tipo === "resposta" || e.tipo === "agendamento" || e.tipo === "fechamento")
        .map((e) => e.lead_id ?? e.inscricao_id ?? e.id),
    ).size;

    return {
      fluxo_id: f.id,
      nome: f.nome,
      ativo: f.ativo,
      inscritos: insc.length,
      envios: env.length,
      enviados,
      aberturas,
      cliques,
      respostas,
      agendamentos,
      fechamentos,
      valorFechado: ev
        .filter((e) => e.tipo === "fechamento")
        .reduce((s, e) => s + Number(e.valor ?? 0), 0),
      taxaAbertura: pct(aberturas, base),
      taxaClique: pct(cliques, base),
      taxaResposta: pct(respostas, base),
      taxaAgendamento: pct(agendamentos, base),
      taxaFechamento: pct(fechamentos, base),
      reativados: leadsReativados,
      taxaReativacao: pct(leadsReativados, insc.length),
    };
  });
}
