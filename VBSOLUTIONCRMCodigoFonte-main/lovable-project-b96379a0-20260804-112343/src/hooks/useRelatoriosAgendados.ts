import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface RelatorioAgendado {
  id: string;
  imobiliaria_id?: string;
  nome: string;
  tipo_relatorio: string;
  formato: "pdf" | "csv";
  periodo: string;
  frequencia: "diaria" | "semanal" | "mensal";
  dia_semana: number;
  dia_mes: number;
  hora: number;
  destinatarios: string[];
  enviar_para_permissao: string | null;
  incluir_corretores: boolean;
  ativo: boolean;
  ultima_execucao: string | null;
  proxima_execucao: string;
  created_at?: string;
}

export interface RelatorioExecucao {
  id: string;
  relatorio_id: string;
  status: string;
  formato: string | null;
  total_registros: number;
  destinatarios: string[];
  erro: string | null;
  executado_em: string;
}

export const TIPOS_RELATORIO = [
  { value: "leads", label: "Leads do CRM" },
  { value: "imoveis", label: "Imóveis da carteira" },
  { value: "financeiro", label: "Financeiro (transações)" },
  { value: "contratos", label: "Contratos" },
  { value: "captacao", label: "Captação (pipeline)" },
] as const;

export const PERIODOS = [
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "90d", label: "Últimos 90 dias" },
  { value: "mes_anterior", label: "Mês anterior" },
] as const;

export const FREQUENCIAS = [
  { value: "diaria", label: "Diária" },
  { value: "semanal", label: "Semanal" },
  { value: "mensal", label: "Mensal" },
] as const;

export const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export const NOVO_RELATORIO: Omit<RelatorioAgendado, "id" | "proxima_execucao"> = {
  nome: "",
  tipo_relatorio: "leads",
  formato: "pdf",
  periodo: "30d",
  frequencia: "semanal",
  dia_semana: 1,
  dia_mes: 1,
  hora: 8,
  destinatarios: [],
  enviar_para_permissao: null,
  incluir_corretores: false,
  ativo: true,
  ultima_execucao: null,
};

function calcularProxima(cfg: { frequencia: string; hora: number; dia_semana: number; dia_mes: number }) {
  const d = new Date();
  d.setSeconds(0, 0);
  d.setMinutes(0);
  d.setHours(cfg.hora);
  if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
  if (cfg.frequencia === "semanal") {
    while (d.getDay() !== cfg.dia_semana) d.setDate(d.getDate() + 1);
  } else if (cfg.frequencia === "mensal") {
    while (d.getDate() !== Math.min(cfg.dia_mes, 28)) d.setDate(d.getDate() + 1);
  }
  return d.toISOString();
}

export function useRelatoriosAgendados() {
  const { imobiliariaId } = useAuth();
  const { toast } = useToast();
  const [relatorios, setRelatorios] = useState<RelatorioAgendado[]>([]);
  const [execucoes, setExecucoes] = useState<RelatorioExecucao[]>([]);
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!imobiliariaId) return;
    setLoading(true);
    const [{ data: rels }, { data: execs }] = await Promise.all([
      supabase
        .from("relatorios_agendados")
        .select("*")
        .eq("imobiliaria_id", imobiliariaId)
        .order("created_at", { ascending: false }),
      supabase
        .from("relatorios_agendados_execucoes")
        .select("*")
        .eq("imobiliaria_id", imobiliariaId)
        .order("executado_em", { ascending: false })
        .limit(50),
    ]);
    setRelatorios((rels ?? []) as unknown as RelatorioAgendado[]);
    setExecucoes((execs ?? []) as unknown as RelatorioExecucao[]);
    setLoading(false);
  }, [imobiliariaId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const salvar = useCallback(
    async (cfg: Partial<RelatorioAgendado> & { id?: string }) => {
      if (!imobiliariaId) return false;
      const payload = {
        ...NOVO_RELATORIO,
        ...cfg,
        imobiliaria_id: imobiliariaId,
        proxima_execucao: calcularProxima({
          frequencia: cfg.frequencia ?? "semanal",
          hora: cfg.hora ?? 8,
          dia_semana: cfg.dia_semana ?? 1,
          dia_mes: cfg.dia_mes ?? 1,
        }),
      } as Record<string, unknown>;
      delete payload.ultima_execucao;

      const { error } = cfg.id
        ? await supabase.from("relatorios_agendados").update(payload as never).eq("id", cfg.id)
        : await supabase.from("relatorios_agendados").insert(payload as never);

      if (error) {
        toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
        return false;
      }
      toast({ title: cfg.id ? "Agendamento atualizado" : "Agendamento criado" });
      await carregar();
      return true;
    },
    [imobiliariaId, toast, carregar],
  );

  const alternarAtivo = useCallback(
    async (id: string, ativo: boolean) => {
      const { error } = await supabase.from("relatorios_agendados").update({ ativo } as never).eq("id", id);
      if (error) {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
        return;
      }
      await carregar();
    },
    [toast, carregar],
  );

  const remover = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("relatorios_agendados").delete().eq("id", id);
      if (error) {
        toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Agendamento excluído" });
      await carregar();
    },
    [toast, carregar],
  );

  const enviarAgora = useCallback(
    async (id: string) => {
      setEnviando(id);
      const { data, error } = await supabase.functions.invoke("relatorios-agendados-processar", {
        body: { relatorio_id: id },
      });
      setEnviando(null);
      if (error) {
        toast({ title: "Falha no envio", description: error.message, variant: "destructive" });
      } else {
        toast({
          title: "Relatório enviado",
          description: `${(data as { total?: number })?.total ?? 0} registro(s) enviados por e-mail.`,
        });
      }
      await carregar();
    },
    [toast, carregar],
  );

  return { relatorios, execucoes, loading, enviando, carregar, salvar, alternarAtivo, remover, enviarAgora };
}
