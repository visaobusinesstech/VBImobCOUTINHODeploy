import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useCurrentCorretor } from "@/hooks/useCurrentCorretor";

export interface Transacao {
  id: string;
  imobiliaria_id: string;
  descricao: string;
  tipo: string;
  categoria: string;
  valor: number;
  data: string;
  status: string;
  imovel_id: string | null;
  corretor_id: string | null;
  observacoes: string | null;
  canal_origem: string | null;
  recorrencia: string | null;
  corretor_nome: string | null;
  parceiro_nome: string | null;
  captador_nome: string | null;
  comissao_percentual: number | null;
  comissao_valor: number | null;
  parceiro_comissao_percentual: number | null;
  parceiro_comissao_valor: number | null;
  captador_comissao_percentual: number | null;
  captador_comissao_valor: number | null;
  divisao_comissao: string | null;
  data_recebimento: string | null;
  numero_unidade: string | null;
  proprietario_nome: string | null;
  proprietario_telefone: string | null;
  proprietario_cpf: string | null;
  imposto_tipo: string | null;
  imposto_percentual: number | null;
  imposto_valor: number | null;
  valor_nao_tributavel: number | null;
  valor_iptu: number | null;
  valor_condominio: number | null;
  taxa_extra: number | null;
  taxa_extra_descricao: string | null;
  created_at: string;
  updated_at: string;
}

export const RECORRENCIA_OPTIONS = [
  { id: "nenhuma", label: "Nenhuma" },
  { id: "mensal", label: "Mensal" },
  { id: "trimestral", label: "Trimestral" },
  { id: "semestral", label: "Semestral" },
  { id: "anual", label: "Anual" },
] as const;

export const CATEGORIAS = [
  { id: "comissao", label: "Comissão" },
  { id: "aluguel", label: "Aluguel" },
  { id: "repasse", label: "Repasse" },
  { id: "despesa", label: "Despesa" },
  { id: "combustivel", label: "Combustível Mensal" },
  { id: "manutencao_carro", label: "Manutenção Carro" },
  { id: "pagamento_imobiliaria", label: "Pagamentos Imobiliária" },
  { id: "pagamento_estagiaria", label: "Pagamentos Estagiária" },
  { id: "facebook_ads", label: "Facebook Ads" },
  { id: "google_ads", label: "Google Ads" },
  { id: "faixa", label: "Faixa" },
  { id: "material_marketing", label: "Material Marketing" },
  { id: "plataformas", label: "Plataformas" },
  { id: "outros", label: "Outros" },
] as const;

export const STATUS_OPTIONS = [
  { id: "pendente", label: "Pendente" },
  { id: "confirmado", label: "Confirmado" },
  { id: "atrasado", label: "Atrasado" },
  { id: "cancelado", label: "Cancelado" },
] as const;

const normalizeMoney = (value: unknown): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  if (typeof value === "string") {
    const raw = value.trim();
    if (!raw) return 0;

    const asNumber = Number(raw);
    if (Number.isFinite(asNumber)) return asNumber;

    const brNormalized = raw.replace(/\./g, "").replace(",", ".");
    const parsed = Number(brNormalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
};

const normalizeTransacao = (item: any): Transacao => ({
  ...item,
  valor: normalizeMoney(item?.valor),
});

export function useTransacoes(options: { enabled?: boolean } = {}) {
  const { enabled = true } = options;
  const { user, imobiliariaId } = useAuth();
  const { corretorId, isBroker, ready: corretorReady } = useCurrentCorretor();
  const { toast } = useToast();
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchingRef = useRef(false);

  const fetchTransacoes = useCallback(async (attempt = 1) => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    if (!user || !corretorReady || fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      let q = supabase
        .from("transacoes")
        .select("*")
        .order("data", { ascending: false })
        .abortSignal(controller.signal);
      if (isBroker && corretorId) q = q.eq("corretor_id", corretorId) as any;
      const { data, error } = await q;
      clearTimeout(timeout);
      if (error) throw error;
      setTransacoes(((data as any[]) ?? []).map(normalizeTransacao));
    } catch (err: any) {
      clearTimeout(timeout);
      if (err.name === "AbortError" && attempt < 3) {
        fetchingRef.current = false;
        return fetchTransacoes(attempt + 1);
      }
      if (err.name === "AbortError") {
        toast({ title: "Conexão lenta", description: "Não foi possível carregar transações. Tente novamente.", variant: "destructive" });
      } else {
        toast({ title: "Erro ao carregar transações", description: err.message, variant: "destructive" });
      }
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [enabled, user, corretorReady, isBroker, corretorId, toast]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    if (user && corretorReady) fetchTransacoes();
  }, [enabled, user, corretorReady, fetchTransacoes]);

  const createTransacao = async (t: Partial<Transacao>) => {
    if (!user) return null;

    const payload = {
      ...t,
      valor: normalizeMoney(t.valor),
      imobiliaria_id: imobiliariaId,
    };

    const { data, error } = await supabase
      .from("transacoes")
      .insert(payload as any)
      .select()
      .single();

    if (error) {
      toast({ title: "Erro ao criar transação", description: error.message, variant: "destructive" });
      return null;
    }

    toast({ title: "Transação registrada!" });
    await fetchTransacoes();
    return normalizeTransacao(data);
  };

  const updateTransacao = async (id: string, updates: Partial<Transacao>) => {
    const payload = updates.valor === undefined
      ? updates
      : { ...updates, valor: normalizeMoney(updates.valor) };

    const { error } = await supabase
      .from("transacoes")
      .update(payload as any)
      .eq("id", id);

    if (error) {
      toast({ title: "Erro ao atualizar transação", description: error.message, variant: "destructive" });
      return false;
    }

    toast({ title: "Transação atualizada!" });
    await fetchTransacoes();
    return true;
  };

  const deleteTransacao = async (id: string) => {
    const { error } = await supabase.from("transacoes").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir transação", description: error.message, variant: "destructive" });
      return false;
    }
    toast({ title: "Transação excluída!" });
    await fetchTransacoes();
    return true;
  };

  const metricas = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Helper to parse date string as local (avoids UTC offset issues)
    const parseLocal = (dateStr: string) => new Date(dateStr + "T00:00:00");

    const mesAtual = transacoes.filter(t => {
      const d = parseLocal(t.data);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const receitaMes = mesAtual.filter(t => t.tipo === "entrada" && t.status === "confirmado").reduce((s, t) => s + t.valor, 0);
    const despesasMes = mesAtual.filter(t => t.tipo === "saida").reduce((s, t) => s + t.valor, 0);
    const despesasMesConfirmadas = mesAtual.filter(t => t.tipo === "saida" && t.status === "confirmado").reduce((s, t) => s + t.valor, 0);
    const saldoMes = receitaMes - despesasMesConfirmadas;
    const aluguelConfirmados = mesAtual.filter(t => t.tipo === "entrada" && t.status === "confirmado" && t.categoria === "aluguel");
    const receitaMesAluguel = aluguelConfirmados.reduce((s, t) => s + t.valor, 0);
    const receitaMesAluguelTotal = mesAtual.filter(t => t.tipo === "entrada" && t.categoria === "aluguel").reduce((s, t) => s + t.valor, 0);
    const receitaMesAluguelLiquida = aluguelConfirmados.reduce((s, t) => s + (t.comissao_valor || 0) - (t.parceiro_comissao_valor || 0) - (t.captador_comissao_valor || 0) - (t.imposto_valor || 0), 0);
    const receitaMesVenda = mesAtual.filter(t => t.tipo === "entrada" && t.status === "confirmado" && t.categoria === "comissao").reduce((s, t) => s + t.valor, 0);
    const aReceber = transacoes.filter(t => t.tipo === "entrada" && t.status === "pendente").reduce((s, t) => s + t.valor, 0);
    const inadimplencia = transacoes.filter(t => t.status === "atrasado").reduce((s, t) => s + t.valor, 0);
    const inadimplenciaCount = transacoes.filter(t => t.status === "atrasado").length;
    const inadimplenciaItens = transacoes.filter(t => t.status === "atrasado");
    const comissoesPagas = mesAtual.filter(t => t.categoria === "comissao" && t.status === "confirmado").reduce((s, t) => s + t.valor, 0);

    // Despesas por categoria do mês
    const despesasPorCategoria: { categoria: string; valor: number }[] = [];
    const catMap = new Map<string, number>();
    mesAtual.filter(t => t.tipo === "saida").forEach(t => {
      catMap.set(t.categoria, (catMap.get(t.categoria) || 0) + t.valor);
    });
    catMap.forEach((valor, categoria) => despesasPorCategoria.push({ categoria, valor }));
    despesasPorCategoria.sort((a, b) => b.valor - a.valor);

    // Entradas pendentes do mês
    const entradasPendentesMes = mesAtual.filter(t => t.tipo === "entrada" && t.status === "pendente").reduce((s, t) => s + t.valor, 0);

    // Transações com comissão no mês
    const transacoesComComissaoMes = mesAtual.filter(t => (t.comissao_valor || 0) > 0 || (t.parceiro_comissao_valor || 0) > 0 || (t.captador_comissao_valor || 0) > 0);
    const totalComissaoTransacoesMes = transacoesComComissaoMes.reduce((s, t) => s + (t.comissao_valor || 0), 0);

    // Monthly chart data (last 6 months)
    const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const chartData: { mes: string; receita: number; despesa: number }[] = [];
    const aluguelChartData: { mes: string; total: number; confirmado: number; liquido: number; qtd: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const m = d.getMonth();
      const y = d.getFullYear();
      const monthTx = transacoes.filter(t => {
        const td = parseLocal(t.data);
        return td.getMonth() === m && td.getFullYear() === y;
      });
      chartData.push({
        mes: meses[m],
        receita: monthTx.filter(t => t.tipo === "entrada").reduce((s, t) => s + t.valor, 0),
        despesa: monthTx.filter(t => t.tipo === "saida").reduce((s, t) => s + t.valor, 0),
      });
      const aluguelMonth = monthTx.filter(t => t.tipo === "entrada" && t.categoria === "aluguel");
      const aluguelConf = aluguelMonth.filter(t => t.status === "confirmado");
      aluguelChartData.push({
        mes: meses[m],
        total: aluguelMonth.reduce((s, t) => s + t.valor, 0),
        confirmado: aluguelConf.reduce((s, t) => s + t.valor, 0),
        liquido: aluguelConf.reduce((s, t) => s + (t.comissao_valor || 0) - (t.parceiro_comissao_valor || 0) - (t.captador_comissao_valor || 0) - (t.imposto_valor || 0), 0),
        qtd: aluguelMonth.length,
      });
    }

    return {
      receitaMes, despesasMes, despesasMesConfirmadas, saldoMes,
      receitaMesAluguel, receitaMesAluguelTotal, receitaMesAluguelLiquida, receitaMesVenda,
      aReceber, inadimplencia, inadimplenciaCount, inadimplenciaItens, comissoesPagas,
      despesasPorCategoria, entradasPendentesMes,
      totalComissaoTransacoesMes,
      chartData, aluguelChartData,
    };
  }, [transacoes]);

  return { transacoes, loading, metricas, createTransacao, updateTransacao, deleteTransacao, refetch: fetchTransacoes };
}

