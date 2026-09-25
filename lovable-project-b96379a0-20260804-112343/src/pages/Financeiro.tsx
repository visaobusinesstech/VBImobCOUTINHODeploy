import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useTabPersistence } from "@/hooks/useTabPersistence";
import { TableSkeleton } from "@/components/shared/PageSkeletons";
import { SectionHeader, MetricCard, useMask } from "@/components/shared/MetricCard";
import { motion } from "framer-motion";
import { DollarSign, TrendingUp, AlertTriangle, CheckCircle, ArrowUpRight, ArrowDownRight, Plus, Edit, Trash2, Loader2, Download, Megaphone, Users, PieChart, Search, X, RefreshCw, FileSignature, Handshake, UserPlus, Receipt, ChevronDown, Wallet, TrendingDown, Calendar, MessageSquare, Eye, EyeOff, Building2, BarChart3, FileWarning, FileSpreadsheet, CalendarDays, Shield, Link as LinkIcon, Bell } from "lucide-react";
import CobrancaLinkDialog from "@/components/financeiro/CobrancaLinkDialog";
import CobrancasConfigPanel from "@/components/financeiro/CobrancasConfigPanel";
import { exportToPDF } from "@/lib/exportPDF";
import { exportComissoesPDF } from "@/lib/exportComissoesPDF";
import { exportRelatorioAluguelPDF } from "@/lib/exportRelatorioAluguelPDF";
import { exportRelatorioVendaPDF } from "@/lib/exportRelatorioVendaPDF";
import { exportDREPDF } from "@/lib/exportDREPDF";
import { exportDREComparativoPDF } from "@/lib/exportDREComparativoPDF";
import { exportComissoesCorretorPDF } from "@/lib/exportComissoesCorretorPDF";
import { exportInadimplenciaPDF } from "@/lib/exportInadimplenciaPDF";
import { exportExtratoAluguelMensalPDF } from "@/lib/exportExtratoAluguelMensalPDF";
import { exportToExcel } from "@/lib/exportExcel";
import { useImoveis } from "@/hooks/useImoveis";
import React, { useState, useMemo, useEffect, useCallback } from "react";
import { startOfMonth, startOfQuarter, startOfYear, isAfter, parseISO } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart as RePieChart, Pie, Cell } from "recharts";
import { useTransacoes, type Transacao } from "@/hooks/useTransacoes";
import { useImobiliariaConfig } from "@/hooks/useImobiliariaConfig";
import { useContratos, type Contrato } from "@/hooks/useContratos";
import { useProprietarios } from "@/hooks/useProprietarios";
import { ContratoFormDialog } from "@/components/contratos/ContratoFormDialog";
import { TransacaoFormDialog } from "@/components/financeiro/TransacaoFormDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getCanalLabel } from "@/lib/canaisOrigem";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { EnviarRelatorioDialog } from "@/components/financeiro/EnviarRelatorioDialog";
import { RelatorioUnidadeDialog } from "@/components/financeiro/RelatorioUnidadeDialog";
import { RelatorioMensalProprietarioDialog } from "@/components/financeiro/RelatorioMensalProprietarioDialog";
import { useDialogPersistence } from "@/hooks/useDialogPersistence";
import { clearDraft } from "@/hooks/useDraft";

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const formatDate = (d: string) => {
  const date = new Date(d + "T00:00:00");
  return date.toLocaleDateString("pt-BR");
};

const statusColor = (s: string) => {
  if (s === "confirmado") return "text-success";
  if (s === "pendente") return "text-warning";
  if (s === "atrasado") return "text-destructive";
  return "text-muted-foreground";
};

const categoriaLabel: Record<string, string> = {
  comissao: "Comissão",
  aluguel: "Aluguel",
  repasse: "Repasse",
  despesa: "Despesa",
  combustivel: "Combustível Mensal",
  manutencao_carro: "Manutenção Carro",
  pagamento_imobiliaria: "Pagamentos Imobiliária",
  pagamento_estagiaria: "Pagamentos Estagiária",
  facebook_ads: "Facebook Ads",
  google_ads: "Google Ads",
  faixa: "Faixa",
  material_marketing: "Material Marketing",
  plataformas: "Plataformas",
  outros: "Outros",
};

const PIE_COLORS = ["hsl(var(--primary))", "hsl(var(--success))", "hsl(var(--warning))", "hsl(var(--destructive))", "hsl(var(--info))"];

const Financeiro = () => {
  const { transacoes, loading, metricas, createTransacao, updateTransacao, deleteTransacao, refetch } = useTransacoes();
  const { contratos, loading: loadingContratos, updateContrato, refetch: refetchContratos } = useContratos();
  const [finTab, setFinTab] = useTabPersistence("financeiro_active_tab", "mensal");
  const { proprietarios } = useProprietarios();
  const { imoveis } = useImoveis();
  const imobiliariaConfig = useImobiliariaConfig();
  const { toast } = useToast();
  const { masked: maskValues, setMasked: setMaskValues } = useMask();
  const [deleteItem, setDeleteItem] = useState<Transacao | null>(null);
  const [cobrancaTx, setCobrancaTx] = useState<Transacao | null>(null);
  const [configCobrancasOpen, setConfigCobrancasOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingContrato, setSavingContrato] = useState(false);
  const [corretores, setCorretores] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [generatingRecorrentes, setGeneratingRecorrentes] = useState(false);
  const [filtroTipoContrato, setFiltroTipoContrato] = useState<"todos" | "Venda" | "Locação">("todos");
  const [filtroPeriodoComissao, setFiltroPeriodoComissao] = useState<"todos" | "mes" | "trimestre" | "ano">("todos");
  const [comissoesOpen, setComissoesOpen] = useState(true);
  const [filtroPeriodoExtrato, setFiltroPeriodoExtrato] = useState<"mes" | "trimestre" | "semestre" | "ano">("mes");
  const [openContratoDetails, setOpenContratoDetails] = useState<Set<string>>(new Set());
  const [showAllCorretores, setShowAllCorretores] = useState(false);
  const [relatorioVendaDialogOpen, setRelatorioVendaDialogOpen] = useState(false);
  const [relatorioUnidadeDialogOpen, setRelatorioUnidadeDialogOpen] = useState(false);
  const [relatorioMensalProprietarioOpen, setRelatorioMensalProprietarioOpen] = useState(false);
  const transacaoDialog = useDialogPersistence<Transacao>({
    storageKey: "financeiro_transacao_dialog_state",
    items: transacoes,
    getId: (item) => item.id,
    restoreOnMount: false,
  });
  const contratoDialog = useDialogPersistence<Contrato>({
    storageKey: "financeiro_contrato_dialog_state",
    items: contratos,
    getId: (item) => item.id,
  });
  const relatorioDialog = useDialogPersistence({
    storageKey: "financeiro_relatorio_aluguel_dialog_state",
  });

  const fmt = (v: number) => maskValues ? "•••••" : formatCurrency(v);
  const fmtQtd = (v: number) => maskValues ? "••" : String(v);

  const handleGerarRecorrentes = useCallback(async () => {
    setGeneratingRecorrentes(true);
    try {
      const { data, error } = await supabase.functions.invoke("gerar-transacoes-recorrentes", { body: {} });
      if (error) throw error;
      toast({ title: "Transações recorrentes", description: data?.message || `${data?.created ?? 0} transações geradas` });
      if (data?.created > 0) await refetch();
    } catch (err: any) {
      toast({ title: "Erro ao gerar recorrentes", description: err.message, variant: "destructive" });
    } finally {
      setGeneratingRecorrentes(false);
    }
  }, [toast, refetch]);

  useEffect(() => {
    supabase.from("corretores").select("id, nome").then(({ data }) => setCorretores(data ?? []));
  }, []);

  // Receita vs Despesa por canal
  const canalChartData = useMemo(() => {
    const map = new Map<string, { receita: number; despesa: number }>();
    transacoes.forEach(t => {
      const canal = t.canal_origem || "nao_informado";
      const existing = map.get(canal) || { receita: 0, despesa: 0 };
      if (t.tipo === "entrada") {
        existing.receita += t.valor;
      } else {
        existing.despesa += t.valor;
      }
      map.set(canal, existing);
    });
    return Array.from(map.entries())
      .map(([canal, data]) => ({
        canal: canal === "nao_informado" ? "Não informado" : getCanalLabel(canal),
        receita: data.receita,
        despesa: data.despesa,
        resultado: data.receita - data.despesa,
      }))
      .sort((a, b) => b.resultado - a.resultado);
  }, [transacoes]);

  // Revenue split by category (venda vs aluguel vs comissão)
  const receitaPorCategoria = useMemo(() => {
    const cats = new Map<string, number>();
    transacoes.filter(t => t.tipo === "entrada" && t.status === "confirmado").forEach(t => {
      const cat = categoriaLabel[t.categoria] || t.categoria;
      cats.set(cat, (cats.get(cat) || 0) + t.valor);
    });
    return Array.from(cats.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [transacoes]);


  // Monthly revenue (current year)
  const receitaMensal = useMemo(() => {
    const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const year = new Date().getFullYear();
    return meses.map((mes, i) => {
      const monthTx = transacoes.filter(t => {
        const d = new Date(t.data);
        return d.getMonth() === i && d.getFullYear() === year && t.tipo === "entrada" && t.status === "confirmado";
      });
      const comissao = monthTx.filter(t => t.categoria === "comissao").reduce((s, t) => s + t.valor, 0);
      const aluguel = monthTx.filter(t => t.categoria === "aluguel").reduce((s, t) => s + t.valor, 0);
      const outros = monthTx.filter(t => t.categoria !== "comissao" && t.categoria !== "aluguel").reduce((s, t) => s + t.valor, 0);
      return { mes, comissao, aluguel, outros };
    });
  }, [transacoes]);

  // Annual totals
  const receitaAnual = useMemo(() => {
    const year = new Date().getFullYear();
    const anoTx = transacoes.filter(t => new Date(t.data).getFullYear() === year && t.tipo === "entrada" && t.status === "confirmado");
    return {
      total: anoTx.reduce((s, t) => s + t.valor, 0),
      comissao: anoTx.filter(t => t.categoria === "comissao").reduce((s, t) => s + t.valor, 0),
      aluguel: anoTx.filter(t => t.categoria === "aluguel").reduce((s, t) => s + t.valor, 0),
    };
  }, [transacoes]);

  // Contract metrics by type
  const contratoMetrics = useMemo(() => {
    const ativos = contratos.filter(c => c.status !== "cancelado");
    const vendas = ativos.filter(c => c.tipo === "Venda");
    const locacoes = ativos.filter(c => c.tipo === "Locação");

    // Status groups
    const statusRecebido = ["ativo", "assinado"];
    const statusAReceber = ["rascunho", "aguardando", "vencendo"];

    // Comissão bruta (total) de cada tipo
    const comissaoBrutaVenda = vendas.reduce((s, c) => s + Number(c.comissao_valor || 0), 0);
    const comissaoBrutaAluguel = locacoes.reduce((s, c) => s + Number(c.comissao_valor || 0), 0);

    // Comissão recebida (contratos finalizados/ativos)
    const comissaoRecebidaVenda = vendas
      .filter(c => statusRecebido.includes(c.status))
      .reduce((s, c) => s + Number(c.comissao_valor || 0), 0);
    const comissaoRecebidaAluguel = locacoes
      .filter(c => statusRecebido.includes(c.status))
      .reduce((s, c) => s + Number(c.comissao_valor || 0), 0);

    // Comissão a receber (pendentes)
    const comissaoAReceberVenda = vendas
      .filter(c => statusAReceber.includes(c.status))
      .reduce((s, c) => s + Number(c.comissao_valor || 0), 0);
    const comissaoAReceberAluguel = locacoes
      .filter(c => statusAReceber.includes(c.status))
      .reduce((s, c) => s + Number(c.comissao_valor || 0), 0);


    return {
      qtdVenda: vendas.length,
      qtdAluguel: locacoes.length,
      totalVenda: vendas.reduce((s, c) => s + Number(c.valor || 0), 0),
      totalAluguel: locacoes.reduce((s, c) => s + Number(c.valor || 0), 0),
      comissaoVenda: comissaoBrutaVenda,
      comissaoAluguel: comissaoBrutaAluguel,
      comissaoRecebidaVenda,
      comissaoRecebidaAluguel,
      comissaoAReceberVenda,
      comissaoAReceberAluguel,
    };
  }, [contratos]);

  // Contract commission summary
  const comissoesContratos = useMemo(() => {
    let ativos = contratos.filter(c => c.status !== "cancelado");
    if (filtroTipoContrato !== "todos") {
      ativos = ativos.filter(c => c.tipo === filtroTipoContrato);
    }
    if (filtroPeriodoComissao !== "todos") {
      const now = new Date();
      let cutoff: Date;
      if (filtroPeriodoComissao === "mes") cutoff = startOfMonth(now);
      else if (filtroPeriodoComissao === "trimestre") cutoff = startOfQuarter(now);
      else cutoff = startOfYear(now);
      ativos = ativos.filter(c => {
        if (!c.data_inicio) return false;
        return isAfter(parseISO(c.data_inicio), cutoff) || parseISO(c.data_inicio).getTime() === cutoff.getTime();
      });
    }
    // Use comissao_valor stored on the contract (already calculated on save)
    const totalComissao = ativos.reduce((s, c) => s + (c.comissao_valor || 0), 0);
    const totalCorretorComissao = ativos.reduce((s, c) => s + (c.corretor_comissao_valor || 0), 0);
    const totalCaptadorComissao = ativos.reduce((s, c) => s + (c.captador_comissao_valor || 0), 0);
    const totalParceiroComissao = ativos.reduce((s, c) => s + (c.parceiro_comissao_valor || 0), 0);
    const contratosRecebidos = ativos.filter(c => ["ativo", "assinado"].includes(c.status));
    const totalImpostos = contratosRecebidos.reduce((s, c) => s + (c.imposto_valor || 0), 0);
    const comParcerias = ativos.filter(c => c.tem_parceria);
    const comCaptador = ativos.filter(c => c.captador_nome);
    const comCorretor = ativos.filter(c => c.corretor_nome);
    const liquido = totalComissao - totalCaptadorComissao - totalParceiroComissao - totalImpostos;
    return {
      totalComissao,
      totalCorretorComissao,
      totalCaptadorComissao,
      totalParceiroComissao,
      totalImpostos,
      liquido,
      qtdContratos: ativos.length,
      contratosAtivos: ativos,
      comParcerias,
      comCaptador,
      comCorretor,
    };
  }, [contratos, filtroTipoContrato, filtroPeriodoComissao]);

  const openCreate = () => {
    clearDraft("transacao");
    transacaoDialog.openCreate();
  };

  const handleSaveContrato = async (data: Partial<Contrato>) => {
    if (!contratoDialog.selectedItem) return;
    setSavingContrato(true);
    try {
      await updateContrato(contratoDialog.selectedItem.id, data);
      contratoDialog.handleOpenChange(false);
    } finally {
      setSavingContrato(false);
    }
  };

  const handleSave = async (data: Partial<Transacao>) => {
    setSaving(true);
    try {
      if (transacaoDialog.selectedItem) {
        await updateTransacao(transacaoDialog.selectedItem.id, data);
      } else {
        await createTransacao(data);
      }
      transacaoDialog.handleOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    await deleteTransacao(deleteItem.id);
    setDeleteItem(null);
  };

  const handleExportFinanceiro = () => {
    exportToPDF({
      brandName: imobiliariaConfig.nome_empresa || undefined,
      title: "Relatório Financeiro",
      subtitle: `${transacoes.length} transações • Gerado em ${new Date().toLocaleDateString("pt-BR")}`,
      columns: [
        { header: "Data", dataKey: "data" },
        { header: "Descrição", dataKey: "descricao" },
        { header: "Tipo", dataKey: "tipo" },
        { header: "Categoria", dataKey: "categoria" },
        { header: "Valor", dataKey: "valor" },
        { header: "Status", dataKey: "status" },
      ],
      data: transacoes.map(t => ({
        data: formatDate(t.data),
        descricao: t.descricao,
        tipo: t.tipo === "entrada" ? "Entrada" : "Saída",
        categoria: categoriaLabel[t.categoria] || t.categoria,
        valor: formatCurrency(t.valor),
        status: t.status.charAt(0).toUpperCase() + t.status.slice(1),
      })),
      summary: [
        { label: "Receita do Mês", value: formatCurrency(metricas.receitaMes) },
        { label: "A Receber", value: formatCurrency(metricas.aReceber) },
        { label: "Inadimplência", value: formatCurrency(metricas.inadimplencia) },
        { label: "Comissões Pagas", value: formatCurrency(metricas.comissoesPagas) },
      ],
    });
  };

  const imoveisRef = useMemo(() => imoveis.map((im) => ({
    id: im.id,
    titulo: im.titulo,
    endereco: im.endereco,
    bairro: im.bairro,
    cidade: im.cidade,
  })), [imoveis]);

  const brandProps = useMemo(() => ({
    brandName: imobiliariaConfig.nome_empresa || undefined,
    brandPhone: imobiliariaConfig.telefone || undefined,
    brandEmail: imobiliariaConfig.email || undefined,
    brandCreci: imobiliariaConfig.creci || undefined,
  }), [imobiliariaConfig]);

  const handleExportRelatorioAluguel = () => {
    const result = exportRelatorioAluguelPDF({
      contratos,
      transacoes,
      imoveis: imoveisRef,
      proprietarios,
      ...brandProps,
    });
    if (!result) {
      toast({ title: "Nenhum contrato de locação ativo encontrado", variant: "destructive" });
    }
  };

  const handleExportRelatorioVenda = () => {
    const result = exportRelatorioVendaPDF({
      contratos,
      transacoes,
      imoveis: imoveisRef,
      ...brandProps,
    });
    if (!result) {
      toast({ title: "Nenhum contrato de venda encontrado", variant: "destructive" });
    }
  };

  const handleExportDRE = () => {
    const result = exportDREPDF({
      transacoes: transacoes as any,
      brandName: brandProps.brandName,
      brandCreci: brandProps.brandCreci,
    });
    if (!result) {
      toast({ title: "Nenhuma transação confirmada encontrada", variant: "destructive" });
    }
  };

  const handleExportDREComparativo = () => {
    const now = new Date();
    const mesAtual = now.getMonth();
    const anoAtual = now.getFullYear();

    const mesAnterior = mesAtual === 0 ? 11 : mesAtual - 1;
    const anoAnterior = mesAtual === 0 ? anoAtual - 1 : anoAtual;

    const MESES_LABEL = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

    const txMesAtual = (transacoes || []).filter((t: any) => {
      const d = new Date(t.data);
      return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
    });

    const txMesAnterior = (transacoes || []).filter((t: any) => {
      const d = new Date(t.data);
      return d.getMonth() === mesAnterior && d.getFullYear() === anoAnterior;
    });

    const result = exportDREComparativoPDF({
      periods: [
        { label: `${MESES_LABEL[mesAnterior]}/${anoAnterior}`, transacoes: txMesAnterior as any },
        { label: `${MESES_LABEL[mesAtual]}/${anoAtual}`, transacoes: txMesAtual as any },
      ],
      brandName: brandProps.brandName,
      brandCreci: brandProps.brandCreci,
    });

    if (!result) {
      toast({ title: "É necessário pelo menos 2 períodos com dados", variant: "destructive" });
    }
  };

  const handleExportComissoesCorretor = () => {
    const result = exportComissoesCorretorPDF({
      contratos: contratos as any,
      brandName: brandProps.brandName,
      brandCreci: brandProps.brandCreci,
    });
    if (!result) {
      toast({ title: "Nenhum contrato com corretor encontrado", variant: "destructive" });
    }
  };

  const handleExportInadimplencia = () => {
    // Build inadimplencia items from transactions
    const inadimplentes = (transacoes || [])
      .filter((t: any) => t.tipo === "entrada" && (t.status === "atrasado" || t.status === "pendente"))
      .map((t: any) => ({
        contrato_id: t.id,
        titulo: t.descricao,
        inquilino: t.corretor_nome || "—",
        inquilino_telefone: null,
        proprietario: null,
        valor_aluguel: t.valor,
        dia_vencimento: 10,
        meses_atrasados: 1,
        valor_total_divida: t.valor,
        dias_atraso: Math.max(0, Math.round((Date.now() - new Date(t.data).getTime()) / 86400000)),
        status_gravidade: "leve" as const,
        ultimo_pagamento: null,
      }));
    const result = exportInadimplenciaPDF({
      inadimplentes,
      contratosAtivos: inadimplentes.length,
      brandName: brandProps.brandName,
      brandCreci: brandProps.brandCreci,
    });
    if (!result) {
      toast({ title: "Nenhuma transação pendente ou atrasada", variant: "destructive" });
    }
  };

  const handleExportRelatorioUnidade = () => {
    setRelatorioUnidadeDialogOpen(true);
  };

  const handleExportExtratoMensal = () => {
    const result = exportExtratoAluguelMensalPDF({
      contratos,
      transacoes,
      imoveis: imoveisRef,
      proprietarios,
      ...brandProps,
      brandCnpj: imobiliariaConfig.cnpj || undefined,
    });
    if (!result) {
      toast({ title: "Nenhum contrato de locação ativo encontrado", variant: "destructive" });
    }
  };

  const handleExportExcel = () => {
    const result = exportToExcel({
      fileName: `Financeiro_${new Date().toISOString().split("T")[0]}`,
      sheetName: "Transações",
      columns: [
        { header: "Data", key: "data" },
        { header: "Descrição", key: "descricao" },
        { header: "Tipo", key: "tipo" },
        { header: "Categoria", key: "categoria" },
        { header: "Valor", key: "valor" },
        { header: "Status", key: "status" },
        { header: "Corretor", key: "corretor" },
      ],
      data: transacoes.map((t) => ({
        data: formatDate(t.data),
        descricao: t.descricao,
        tipo: t.tipo === "entrada" ? "Entrada" : "Saída",
        categoria: categoriaLabel[t.categoria] || t.categoria,
        valor: t.valor,
        status: t.status,
        corretor: t.corretor_nome || "",
      })),
    });
    if (!result) {
      toast({ title: "Nenhuma transação para exportar", variant: "destructive" });
    } else {
      toast({ title: "Excel exportado com sucesso!" });
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-3 mb-6">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="flex flex-col gap-2">
            <div>
              <h2 className="text-xl font-bold text-foreground">Financeiro</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Controle financeiro completo</p>
            </div>
            <button onClick={openCreate} className="self-start flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm">
              <Plus className="w-4 h-4" />Nova Transação
            </button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setMaskValues(!maskValues)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-secondary text-foreground text-sm font-medium hover:bg-secondary/80 transition-colors border border-border"
              title={maskValues ? "Mostrar valores" : "Ocultar valores"}
            >
              {maskValues ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
            <button
              onClick={handleGerarRecorrentes}
              disabled={generatingRecorrentes}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-secondary text-foreground text-sm font-medium hover:bg-secondary/80 transition-colors border border-border disabled:opacity-50"
            >
              {generatingRecorrentes ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              <span className="hidden sm:inline">Gerar Recorrentes</span>
            </button>
            <button
              onClick={() => setConfigCobrancasOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-secondary text-foreground text-sm font-medium hover:bg-secondary/80 transition-colors border border-border"
              title="Automação de lembretes e link de pagamento"
            >
              <Bell className="w-4 h-4" />
              <span className="hidden sm:inline">Cobranças</span>
            </button>
          </div>
        </div>
        {/* Relatórios */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mr-1">Relatórios:</span>
          <button onClick={handleExportFinanceiro} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-secondary text-foreground text-sm font-medium hover:bg-secondary/80 transition-colors border border-border">
            <Download className="w-4 h-4" />PDF
          </button>
          <button onClick={relatorioDialog.openCreate} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
            <Building2 className="w-4 h-4" />Aluguéis
          </button>
          <button onClick={handleExportRelatorioVenda} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-success text-success-foreground text-sm font-medium hover:bg-success/90 transition-colors">
            <Handshake className="w-4 h-4" />Vendas
          </button>
          <button onClick={handleExportRelatorioUnidade} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-info text-info-foreground text-sm font-medium hover:bg-info/90 transition-colors shadow-sm">
            <Receipt className="w-4 h-4" />Por Unidade
          </button>
          <button onClick={handleExportDRE} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-secondary text-foreground text-sm font-medium hover:bg-secondary/80 transition-colors border border-border">
            <BarChart3 className="w-4 h-4" />DRE
          </button>
          <button onClick={handleExportDREComparativo} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors border border-primary/20">
            <TrendingUp className="w-4 h-4" />DRE Comparativo
          </button>
          <button onClick={handleExportComissoesCorretor} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-secondary text-foreground text-sm font-medium hover:bg-secondary/80 transition-colors border border-border">
            <Users className="w-4 h-4" />Comissões
          </button>
           <button onClick={handleExportInadimplencia} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-destructive/10 text-destructive text-sm font-medium hover:bg-destructive/20 transition-colors border border-destructive/20">
            <FileWarning className="w-4 h-4" />Inadimplência
          </button>
          <button onClick={() => setRelatorioMensalProprietarioOpen(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-warning/10 text-warning text-sm font-medium hover:bg-warning/20 transition-colors border border-warning/20">
            <CalendarDays className="w-4 h-4" />Mensal Proprietário
           </button>
          <button onClick={handleExportExtratoMensal} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors border border-primary/20">
            <FileSignature className="w-4 h-4" />Extrato Mensal
          </button>
          <button onClick={handleExportExcel} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-secondary text-foreground text-sm font-medium hover:bg-secondary/80 transition-colors border border-border">
            <FileSpreadsheet className="w-4 h-4" />Excel
          </button>
        </div>
      </div>

      {/* Valores de Venda e Aluguel */}
      <SectionHeader title="Vendas" subtitle="Valores e comissões de contratos de venda" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <MetricCard title="Valor Total Vendas" value={fmt(contratoMetrics.totalVenda)} icon={DollarSign} delay={0} tooltip="Soma dos valores dos contratos de venda" />
        <MetricCard title="Comissão Venda" value={fmt(contratoMetrics.comissaoVenda)} icon={Handshake} delay={0.02} tooltip="Total bruto de comissões de contratos de venda" />
        <MetricCard title="Recebida Venda" value={fmt(contratoMetrics.comissaoRecebidaVenda)} icon={CheckCircle} delay={0.04} tooltip="Comissão de vendas já recebidas" change="Recebido" changeType="positive" />
        <MetricCard title="A Receber Venda" value={fmt(contratoMetrics.comissaoAReceberVenda)} icon={Calendar} delay={0.06} tooltip="Comissão de vendas pendentes" change="Pendente" changeType="neutral" />
      </div>

      <SectionHeader title="Aluguéis" subtitle="Valores e comissões de contratos de locação" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <MetricCard title="Valor Total Aluguéis" value={fmt(contratoMetrics.totalAluguel)} icon={DollarSign} delay={0} tooltip="Soma dos valores dos contratos de locação" />
        <MetricCard title="Comissão Aluguel" value={fmt(contratoMetrics.comissaoAluguel)} icon={Handshake} delay={0.02} tooltip="Total bruto de comissões de contratos de locação" />
        <MetricCard title="Recebida Aluguel" value={fmt(contratoMetrics.comissaoRecebidaAluguel)} icon={CheckCircle} delay={0.04} tooltip="Comissão de aluguéis já recebidas" change="Recebido" changeType="positive" />
        <MetricCard title="A Receber Aluguel" value={fmt(contratoMetrics.comissaoAReceberAluguel)} icon={Calendar} delay={0.06} tooltip="Comissão de aluguéis pendentes" change="Pendente" changeType="neutral" />
      </div>

      {/* Transaction Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-6">
        <MetricCard title="Receita do Mês" value={fmt(metricas.receitaMes)} icon={DollarSign} delay={0.12} tooltip="Total de entradas confirmadas no mês atual" />
        <MetricCard title="Despesas do Mês" value={fmt(metricas.despesasMes)} icon={TrendingDown} delay={0.14} tooltip="Total de saídas registradas no mês atual" />
        <MetricCard
          title="Saldo do Mês"
          value={fmt(metricas.saldoMes)}
          icon={Wallet}
          delay={0.16}
          tooltip="Receita confirmada menos despesas confirmadas do mês"
          change={maskValues ? undefined : (metricas.saldoMes >= 0 ? "Positivo" : "Negativo")}
          changeType={metricas.saldoMes >= 0 ? "positive" : "negative"}
        />
        <MetricCard title="A Receber" value={fmt(metricas.aReceber)} icon={TrendingUp} delay={0.18} tooltip="Entradas pendentes aguardando confirmação" />
        <MetricCard
          title="Inadimplência"
          value={fmt(metricas.inadimplencia)}
          change={maskValues ? undefined : (metricas.inadimplenciaCount > 0 ? `${metricas.inadimplenciaCount} atrasadas` : undefined)}
          changeType="negative"
          icon={AlertTriangle}
          delay={0.2}
          tooltip="Transações com status atrasado"
        />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <MetricCard title="Aluguel Líquido" value={fmt(metricas.receitaMesAluguelLiquida)} icon={CheckCircle} delay={0.22} tooltip="Comissão líquida de aluguel: comissão menos parceiro, captador e impostos" />
        <MetricCard title="Comissões Pagas" value={fmt(metricas.comissoesPagas)} icon={CheckCircle} delay={0.24} tooltip="Total de comissões confirmadas e pagas no mês" />
        <MetricCard title="Pendentes Mês" value={fmt(metricas.entradasPendentesMes)} icon={Calendar} delay={0.26} tooltip="Entradas pendentes de confirmação no mês atual" />
        <MetricCard title="Despesas Confirmadas" value={fmt(metricas.despesasMesConfirmadas)} icon={TrendingDown} delay={0.28} tooltip="Saídas confirmadas no mês" />
      </div>

      {/* Despesas por Categoria do Mês */}
      {metricas.despesasPorCategoria.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="glass-card p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown className="w-4 h-4 text-destructive" />
            <h3 className="text-sm font-semibold text-foreground">Despesas por Categoria (Mês Atual)</h3>
            <span className="text-xs text-muted-foreground">Total: {formatCurrency(metricas.despesasMes)}</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {metricas.despesasPorCategoria.map(d => (
              <div key={d.categoria} className="p-3 rounded-lg bg-destructive/5 border border-destructive/10 text-center">
                <p className="text-[10px] font-medium text-muted-foreground uppercase truncate">{categoriaLabel[d.categoria] || d.categoria}</p>
                <p className="text-sm font-bold text-destructive">{formatCurrency(d.valor)}</p>
                <p className="text-[9px] text-muted-foreground">{metricas.despesasMes > 0 ? ((d.valor / metricas.despesasMes) * 100).toFixed(1) : 0}%</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Inadimplência detalhada */}
      {metricas.inadimplenciaItens && metricas.inadimplenciaItens.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            <h3 className="text-sm font-semibold text-foreground">Valores em Atraso ({metricas.inadimplenciaCount})</h3>
          </div>
          <div className="space-y-1.5">
            {metricas.inadimplenciaItens.slice(0, 10).map((t: any) => (
              <div key={t.id} className="flex items-center justify-between p-2 rounded-lg bg-destructive/5 border border-destructive/10">
                <div>
                  <p className="text-sm font-medium text-foreground">{t.descricao}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(t.data)} · {categoriaLabel[t.categoria] || t.categoria}</p>
                </div>
                <p className="text-sm font-semibold text-destructive">{formatCurrency(t.valor)}</p>
              </div>
            ))}
            {metricas.inadimplenciaItens.length > 10 && (
              <p className="text-xs text-muted-foreground text-center pt-1">+ {metricas.inadimplenciaItens.length - 10} mais...</p>
            )}
          </div>
        </motion.div>
      )}

      {/* Commission summary moved inside transactions below */}

      {loading ? (
        <TableSkeleton />
      ) : (
        <>
          {/* Monthly Chart */}
          {metricas.chartData.some(d => d.receita > 0 || d.despesa > 0) && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass-card p-5 mb-6">
              <h3 className="text-sm font-semibold text-foreground mb-4">Receita vs Despesa (últimos 6 meses)</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={metricas.chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--foreground))" }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Legend />
                  <Bar dataKey="receita" name="Receita" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} barSize={24} />
                  <Bar dataKey="despesa" name="Despesa" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </motion.div>
          )}

          {/* Chart: Receita vs Despesa por Canal */}
          {canalChartData.length > 0 && canalChartData.some(d => d.receita > 0 || d.despesa > 0) && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="glass-card p-5 mb-6">
              <div className="flex items-center gap-2 mb-4">
                <Megaphone className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Receita vs Despesa por Canal de Origem</h3>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={canalChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="canal" stroke="hsl(var(--muted-foreground))" fontSize={11} width={110} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--foreground))" }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Legend />
                  <Bar dataKey="receita" name="Receita" fill="hsl(var(--success))" radius={[0, 4, 4, 0]} barSize={18} />
                  <Bar dataKey="despesa" name="Despesa" fill="hsl(var(--destructive))" radius={[0, 4, 4, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
              {/* Resultado por canal */}
              <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-2">
                {canalChartData.filter(d => d.receita > 0 || d.despesa > 0).map((item) => (
                  <div key={item.canal} className="p-2 rounded-lg bg-secondary/30 text-center">
                    <p className="text-[11px] text-muted-foreground font-medium">{item.canal}</p>
                    <p className={`text-sm font-bold ${item.resultado >= 0 ? "text-success" : "text-destructive"}`}>
                      {item.resultado >= 0 ? "+" : ""}{formatCurrency(item.resultado)}
                    </p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Revenue Report Section */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="glass-card p-5 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <PieChart className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Relatório de Receita</h3>
            </div>
            
            {/* Annual Summary */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="p-3 rounded-lg bg-primary/10 text-center">
                <p className="text-[10px] font-medium text-muted-foreground uppercase">Receita Anual</p>
                <p className="text-lg font-bold text-primary">{formatCurrency(receitaAnual.total)}</p>
              </div>
              <div className="p-3 rounded-lg bg-success/10 text-center">
                <p className="text-[10px] font-medium text-muted-foreground uppercase">Comissões (Vendas)</p>
                <p className="text-lg font-bold text-success">{formatCurrency(receitaAnual.comissao)}</p>
              </div>
              <div className="p-3 rounded-lg bg-info/10 text-center">
                <p className="text-[10px] font-medium text-muted-foreground uppercase">Aluguel</p>
                <p className="text-lg font-bold text-info">{formatCurrency(receitaAnual.aluguel)}</p>
              </div>
            </div>

            <Tabs value={finTab} onValueChange={setFinTab} className="w-full">
              <TabsList className="w-full grid grid-cols-2">
                <TabsTrigger value="mensal">Mensal</TabsTrigger>
                <TabsTrigger value="categoria">Por Categoria</TabsTrigger>
              </TabsList>

              <TabsContent value="mensal" className="mt-4">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={receitaMensal}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--foreground))" }} formatter={(value: number) => formatCurrency(value)} />
                    <Legend />
                    <Bar dataKey="comissao" name="Comissão" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} barSize={16} stackId="a" />
                    <Bar dataKey="aluguel" name="Aluguel" fill="hsl(var(--info))" radius={[4, 4, 0, 0]} barSize={16} stackId="a" />
                    <Bar dataKey="outros" name="Outros" fill="hsl(var(--warning))" radius={[4, 4, 0, 0]} barSize={16} stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              </TabsContent>

              <TabsContent value="categoria" className="mt-4">
                {receitaPorCategoria.length > 0 ? (
                  <div className="flex flex-col md:flex-row items-center gap-6">
                    <ResponsiveContainer width={200} height={200}>
                      <RePieChart>
                        <Pie data={receitaPorCategoria} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={false}>
                          {receitaPorCategoria.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      </RePieChart>
                    </ResponsiveContainer>
                    <div className="flex-1 space-y-2">
                      {receitaPorCategoria.map((item, i) => (
                        <div key={item.name} className="flex items-center justify-between p-2 rounded-lg bg-secondary/30">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                            <span className="text-sm text-foreground">{item.name}</span>
                          </div>
                          <span className="text-sm font-semibold text-foreground">{formatCurrency(item.value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhuma receita confirmada registrada.</p>
                )}
              </TabsContent>

            </Tabs>
          </motion.div>

          {/* Mini Relatório Mensal de Aluguel */}
          {metricas.aluguelChartData.some(d => d.total > 0) && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65 }} className="glass-card p-5 mb-6">
              <div className="flex items-center gap-2 mb-4">
                <Receipt className="w-4 h-4 text-info" />
                <h3 className="text-sm font-semibold text-foreground">Evolução de Aluguel (últimos 6 meses)</h3>
              </div>

              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="p-3 rounded-lg bg-info/10 text-center">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase">Média Mensal Total</p>
                  <p className="text-lg font-bold text-info">
                    {formatCurrency(metricas.aluguelChartData.reduce((s, d) => s + d.total, 0) / Math.max(metricas.aluguelChartData.filter(d => d.total > 0).length, 1))}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-success/10 text-center">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase">Média Confirmado</p>
                  <p className="text-lg font-bold text-success">
                    {formatCurrency(metricas.aluguelChartData.reduce((s, d) => s + d.confirmado, 0) / Math.max(metricas.aluguelChartData.filter(d => d.confirmado > 0).length, 1))}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-primary/10 text-center">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase">Média Líquido</p>
                  <p className="text-lg font-bold text-primary">
                    {formatCurrency(metricas.aluguelChartData.reduce((s, d) => s + d.liquido, 0) / Math.max(metricas.aluguelChartData.filter(d => d.liquido > 0).length, 1))}
                  </p>
                </div>
              </div>

              {/* Chart */}
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={metricas.aluguelChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--foreground))" }}
                    formatter={(value: number, name: string) => [formatCurrency(value), name]}
                  />
                  <Legend />
                  <Bar dataKey="total" name="Total" fill="hsl(var(--info))" radius={[4, 4, 0, 0]} barSize={18} />
                  <Bar dataKey="confirmado" name="Confirmado" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} barSize={18} />
                  <Bar dataKey="liquido" name="Líquido" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>

              {/* Monthly details */}
              <div className="mt-4 grid grid-cols-3 md:grid-cols-6 gap-2">
                {metricas.aluguelChartData.map((d) => (
                  <div key={d.mes} className="p-2 rounded-lg bg-secondary/30 text-center">
                    <p className="text-[11px] text-muted-foreground font-medium">{d.mes}</p>
                    <p className="text-sm font-bold text-foreground">{formatCurrency(d.confirmado)}</p>
                    <p className="text-[10px] text-muted-foreground">{d.qtd} transações</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {(() => {
            // Period filter for extrato
            const now = new Date();
            let periodStart: Date;
            if (filtroPeriodoExtrato === "mes") periodStart = startOfMonth(now);
            else if (filtroPeriodoExtrato === "trimestre") periodStart = startOfQuarter(now);
            else if (filtroPeriodoExtrato === "semestre") periodStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);
            else periodStart = startOfYear(now);

            let filteredTransacoes = transacoes.filter(t => {
              const td = parseISO(t.data);
              return isAfter(td, periodStart) || td.getTime() === periodStart.getTime();
            });

            if (searchQuery.trim()) {
              const q = searchQuery.toLowerCase();
              filteredTransacoes = filteredTransacoes.filter(t =>
                t.descricao.toLowerCase().includes(q) ||
                (t.observacoes && t.observacoes.toLowerCase().includes(q)) ||
                (t.canal_origem && getCanalLabel(t.canal_origem).toLowerCase().includes(q)) ||
                (categoriaLabel[t.categoria] || t.categoria).toLowerCase().includes(q)
              );
            }

            const extratoReceita = filteredTransacoes.filter(t => t.tipo === "entrada" && t.status === "confirmado").reduce((s, t) => s + t.valor, 0);
            const extratoDespesa = filteredTransacoes.filter(t => t.tipo === "saida" && t.status === "confirmado").reduce((s, t) => s + t.valor, 0);
            const extratoSaldo = extratoReceita - extratoDespesa;

            const PERIODO_EXTRATO_LABELS: Record<string, string> = { mes: "Mês Atual", trimestre: "Trimestre", semestre: "Semestre", ano: "Ano" };

            return (
              <>
                {/* Search bar + Period filter */}
                <div className="flex flex-col sm:flex-row gap-2 mb-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Buscar por descrição, categoria ou canal..."
                      className="w-full h-10 pl-10 pr-10 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                    />
                    {searchQuery && (
                      <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {(["mes", "trimestre", "semestre", "ano"] as const).map(p => (
                      <button
                        key={p}
                        onClick={() => setFiltroPeriodoExtrato(p)}
                        className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                          filtroPeriodoExtrato === p ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {PERIODO_EXTRATO_LABELS[p]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Extrato Summary */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="p-3 rounded-lg bg-success/10 text-center">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase">Receita ({PERIODO_EXTRATO_LABELS[filtroPeriodoExtrato]})</p>
                    <p className="text-lg font-bold text-success">{formatCurrency(extratoReceita)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-destructive/10 text-center">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase">Despesa ({PERIODO_EXTRATO_LABELS[filtroPeriodoExtrato]})</p>
                    <p className="text-lg font-bold text-destructive">{formatCurrency(extratoDespesa)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-secondary text-center border border-border">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase">Saldo ({PERIODO_EXTRATO_LABELS[filtroPeriodoExtrato]})</p>
                    <p className={`text-lg font-bold ${extratoSaldo >= 0 ? "text-success" : "text-destructive"}`}>{formatCurrency(extratoSaldo)}</p>
                  </div>
                </div>

                {filteredTransacoes.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-40" />
                    <p className="text-sm">{transacoes.length === 0 ? "Nenhuma transação registrada ainda." : "Nenhuma transação encontrada no período."}</p>
                    {transacoes.length === 0 && <button onClick={openCreate} className="mt-3 text-sm text-primary hover:underline">Registrar primeira transação</button>}
                  </div>
                ) : (
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass-card p-5">
                    <h3 className="text-sm font-semibold text-foreground mb-4">Extrato - {PERIODO_EXTRATO_LABELS[filtroPeriodoExtrato]} ({filteredTransacoes.length} transações)</h3>
                    <div className="space-y-2">
                      {filteredTransacoes.map((t) => (
                        <div key={t.id} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 group hover:bg-secondary/50 transition-colors">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${t.tipo === "entrada" ? "bg-success/10" : "bg-destructive/10"}`}>
                            {t.tipo === "entrada" ? <ArrowUpRight className="w-4 h-4 text-success" /> : <ArrowDownRight className="w-4 h-4 text-destructive" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{t.descricao}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                              <span>{formatDate(t.data)}</span>
                              <span>·</span>
                              <span>{categoriaLabel[t.categoria] || t.categoria}</span>
                              {t.recorrencia && t.recorrencia !== "nenhuma" && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-semibold">
                                  <RefreshCw className="w-2.5 h-2.5" />
                                  {t.recorrencia === "mensal" ? "Mensal" : t.recorrencia === "trimestral" ? "Trimestral" : t.recorrencia === "semestral" ? "Semestral" : "Anual"}
                                </span>
                              )}
                              {t.canal_origem && <><span>·</span><span>{getCanalLabel(t.canal_origem)}</span></>}
                              {t.data_recebimento && <><span>·</span><span className="text-success">📅 Recebido: {formatDate(t.data_recebimento)}</span></>}
                              {t.corretor_nome && <><span>·</span><span className="text-primary">🏷 {t.corretor_nome}</span></>}
                              {t.parceiro_nome && <><span>·</span><span className="text-warning">🤝 {t.parceiro_nome}</span></>}
                              {t.captador_nome && <><span>·</span><span className="text-info">🎯 {t.captador_nome}</span></>}
                              {t.divisao_comissao && <><span>·</span><span>📊 {t.divisao_comissao}</span></>}
                            </div>
                            {/* Comissão details */}
                            {((t.comissao_valor || 0) > 0 || (t.parceiro_comissao_valor || 0) > 0 || (t.captador_comissao_valor || 0) > 0) && (
                              <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground flex-wrap">
                                {(t.comissao_valor || 0) > 0 && <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary">Com: {t.comissao_percentual || 0}% = {formatCurrency(t.comissao_valor || 0)}</span>}
                                {(t.parceiro_comissao_valor || 0) > 0 && <span className="px-1.5 py-0.5 rounded bg-warning/10 text-warning">Parc: {t.parceiro_comissao_percentual || 0}% = {formatCurrency(t.parceiro_comissao_valor || 0)}</span>}
                                {(t.captador_comissao_valor || 0) > 0 && <span className="px-1.5 py-0.5 rounded bg-info/10 text-info">Capt: {t.captador_comissao_percentual || 0}% = {formatCurrency(t.captador_comissao_valor || 0)}</span>}
                              </div>
                            )}
                            {/* Observações */}
                            {t.observacoes && (
                              <p className="text-[10px] text-muted-foreground mt-1 italic truncate max-w-md flex items-center gap-1">
                                <MessageSquare className="w-2.5 h-2.5 shrink-0" />
                                {t.observacoes}
                              </p>
                            )}
                            {/* Aluguel: líquido e comissão */}
                            {t.categoria === "aluguel" && t.tipo === "entrada" && ((t.comissao_valor || 0) > 0 || (t.parceiro_comissao_valor || 0) > 0 || (t.captador_comissao_valor || 0) > 0) && (
                              <div className="flex items-center gap-2 mt-1 text-[10px] flex-wrap">
                                <span className="px-1.5 py-0.5 rounded bg-success/10 text-success font-medium">
                                  Líquido: {formatCurrency(t.valor - (t.comissao_valor || 0) - (t.parceiro_comissao_valor || 0) - (t.captador_comissao_valor || 0))}
                                </span>
                                {(t.comissao_valor || 0) > 0 && <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary">Com: {formatCurrency(t.comissao_valor || 0)}</span>}
                                {(t.parceiro_comissao_valor || 0) > 0 && <span className="px-1.5 py-0.5 rounded bg-warning/10 text-warning">Parc: {formatCurrency(t.parceiro_comissao_valor || 0)}</span>}
                                {(t.captador_comissao_valor || 0) > 0 && <span className="px-1.5 py-0.5 rounded bg-info/10 text-info">Capt: {formatCurrency(t.captador_comissao_valor || 0)}</span>}
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            <p className={`text-sm font-semibold ${t.tipo === "entrada" ? "text-success" : "text-foreground"}`}>
                              {t.tipo === "saida" ? "- " : ""}{formatCurrency(t.valor)}
                            </p>
                            <span className={`text-[10px] font-medium capitalize ${statusColor(t.status)}`}>{t.status}</span>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => setCobrancaTx(t)} title="Cobrança / link de pagamento" className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-primary transition-colors">
                              <LinkIcon className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => transacaoDialog.openEdit(t)} className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-primary transition-colors">
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => setDeleteItem(t)} className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Resumo de Comissões dos Contratos - dentro do mesmo card */}
                    {!loadingContratos && (
                      <div className="mt-6 pt-6 border-t border-border">
                        <button
                          onClick={() => setComissoesOpen(!comissoesOpen)}
                          className="flex items-center gap-2 w-full text-left mb-2 group"
                        >
                          <FileSignature className="w-4 h-4 text-primary" />
                          <h3 className="text-sm font-semibold text-foreground">Resumo de Comissões dos Contratos</h3>
                          <span className="text-xs text-muted-foreground">
                            {comissoesContratos.qtdContratos} contrato{comissoesContratos.qtdContratos !== 1 ? "s" : ""}
                            {(() => {
                              const ativos = comissoesContratos.contratosAtivos.filter(c => c.status === "ativo" || c.status === "assinado").length;
                              const inativos = comissoesContratos.contratosAtivos.filter(c => c.status === "inativo").length;
                              return ` · ${ativos} ativo${ativos !== 1 ? "s" : ""}${inativos > 0 ? ` · ${inativos} inativo${inativos !== 1 ? "s" : ""}` : ""}`;
                            })()}
                          </span>
                          <ChevronDown className={`w-4 h-4 ml-auto text-muted-foreground transition-transform duration-200 ${comissoesOpen ? "rotate-180" : ""}`} />
                        </button>

                        {comissoesOpen && (
                          <div className="mt-3">
                            <div className="flex items-center gap-1 mb-4 flex-wrap">
                              {(["todos", "Venda", "Locação"] as const).map(tipo => (
                                <button
                                  key={tipo}
                                  onClick={() => setFiltroTipoContrato(tipo)}
                                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                                    filtroTipoContrato === tipo
                                      ? "bg-primary text-primary-foreground"
                                      : "bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground"
                                  }`}
                                >
                                  {tipo === "todos" ? "Todos" : tipo}
                                </button>
                              ))}
                              <span className="mx-1" />
                              {([
                                { id: "todos" as const, label: "Todos" },
                                { id: "mes" as const, label: "Mês" },
                                { id: "trimestre" as const, label: "Trimestre" },
                                { id: "ano" as const, label: "Ano" },
                              ]).map(p => (
                                <button
                                  key={p.id}
                                  onClick={() => setFiltroPeriodoComissao(p.id)}
                                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                                    filtroPeriodoComissao === p.id
                                      ? "bg-accent text-accent-foreground"
                                      : "bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground"
                                  }`}
                                >
                                  {p.label}
                                </button>
                              ))}
                              <button
                                onClick={() => exportComissoesPDF({
                                  contratos: comissoesContratos.contratosAtivos,
                                  resumo: comissoesContratos,
                                  filtroTipo: `${filtroTipoContrato}${filtroPeriodoComissao !== "todos" ? ` (${filtroPeriodoComissao === "mes" ? "Mês atual" : filtroPeriodoComissao === "trimestre" ? "Trimestre atual" : "Ano atual"})` : ""}`,
                                  brandName: imobiliariaConfig.nome_empresa || undefined,
                                  getCanalLabel,
                                })}
                                disabled={comissoesContratos.qtdContratos === 0}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors disabled:opacity-40 ml-auto"
                                title="Exportar comissões em PDF"
                              >
                                <Download className="w-3 h-3" />
                                PDF
                              </button>
                            </div>

                    {comissoesContratos.qtdContratos === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <FileSignature className="w-10 h-10 mx-auto mb-2 opacity-40" />
                        <p className="text-sm">Nenhum contrato cadastrado ainda.</p>
                        <p className="text-xs mt-1">Cadastre contratos para ver o resumo de comissões aqui.</p>
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
                          <div className="p-3 rounded-lg bg-primary/10 text-center">
                            <p className="text-[10px] font-medium text-muted-foreground uppercase">Comissão Total</p>
                            <p className="text-base font-bold text-primary">{formatCurrency(comissoesContratos.totalComissao)}</p>
                          </div>
                          <div className="p-3 rounded-lg bg-success/10 text-center">
                            <p className="text-[10px] font-medium text-muted-foreground uppercase">Corretor</p>
                            <p className="text-base font-bold text-success">{formatCurrency(comissoesContratos.totalCorretorComissao)}</p>
                          </div>
                          <div className="p-3 rounded-lg bg-info/10 text-center">
                            <p className="text-[10px] font-medium text-muted-foreground uppercase">Captador</p>
                            <p className="text-base font-bold text-info">{formatCurrency(comissoesContratos.totalCaptadorComissao)}</p>
                          </div>
                          <div className="p-3 rounded-lg bg-warning/10 text-center">
                            <p className="text-[10px] font-medium text-muted-foreground uppercase">Parceiro</p>
                            <p className="text-base font-bold text-warning">{formatCurrency(comissoesContratos.totalParceiroComissao)}</p>
                          </div>
                          <div className="p-3 rounded-lg bg-destructive/10 text-center">
                            <p className="text-[10px] font-medium text-muted-foreground uppercase">Impostos</p>
                            <p className="text-base font-bold text-destructive">{formatCurrency(comissoesContratos.totalImpostos)}</p>
                          </div>
                          <div className="p-3 rounded-lg bg-secondary text-center border border-border">
                            <p className="text-[10px] font-medium text-muted-foreground uppercase">Líquido Imob.</p>
                            <p className={`text-base font-bold ${comissoesContratos.liquido >= 0 ? "text-success" : "text-destructive"}`}>{formatCurrency(comissoesContratos.liquido)}</p>
                          </div>
                        </div>

                        {/* Pie chart - divisão das comissões */}
                        {comissoesContratos.totalComissao > 0 && (() => {
                          const pieData = [
                            { name: "Corretor", value: comissoesContratos.totalCorretorComissao },
                            { name: "Captador", value: comissoesContratos.totalCaptadorComissao },
                            { name: "Parceiro", value: comissoesContratos.totalParceiroComissao },
                            { name: "Impostos", value: comissoesContratos.totalImpostos },
                            { name: "Líquido Imob.", value: Math.max(0, comissoesContratos.liquido) },
                          ].filter(d => d.value > 0);
                          const COMM_COLORS = ["hsl(var(--success))", "hsl(var(--info))", "hsl(var(--warning))", "hsl(var(--destructive))", "hsl(var(--primary))"];
                          return (
                            <div className="flex flex-col md:flex-row items-center gap-4 mb-4 p-4 rounded-lg bg-secondary/20 border border-border">
                              <div className="w-full md:w-1/2 flex justify-center" style={{ height: 200 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                  <RePieChart>
                                    <Pie
                                      data={pieData}
                                      cx="50%"
                                      cy="50%"
                                      innerRadius={50}
                                      outerRadius={80}
                                      paddingAngle={3}
                                      dataKey="value"
                                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                      labelLine={false}
                                      style={{ fontSize: 10 }}
                                    >
                                      {pieData.map((_, idx) => (
                                        <Cell key={idx} fill={COMM_COLORS[["Corretor","Captador","Parceiro","Impostos","Líquido Imob."].indexOf(pieData[idx].name)]} />
                                      ))}
                                    </Pie>
                                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                                  </RePieChart>
                                </ResponsiveContainer>
                              </div>
                              <div className="w-full md:w-1/2 space-y-1.5">
                                <p className="text-xs font-semibold text-foreground mb-2">Divisão da Comissão Total</p>
                                {pieData.map((d, i) => (
                                  <div key={d.name} className="flex items-center gap-2 text-xs">
                                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COMM_COLORS[["Corretor","Captador","Parceiro","Impostos","Líquido Imob."].indexOf(d.name)] }} />
                                    <span className="text-muted-foreground">{d.name}</span>
                                    <span className="ml-auto font-medium text-foreground">{formatCurrency(d.value)}</span>
                                    <span className="text-muted-foreground">({((d.value / comissoesContratos.totalComissao) * 100).toFixed(1)}%)</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()}

                        {/* Ranking de corretores por comissão */}
                        {(() => {
                          const corretorMap = new Map<string, number>();
                          comissoesContratos.contratosAtivos.forEach(c => {
                            if (c.corretor_nome) {
                              corretorMap.set(c.corretor_nome, (corretorMap.get(c.corretor_nome) || 0) + (c.corretor_comissao_valor || 0));
                            }
                          });
                          const ranking = Array.from(corretorMap.entries())
                            .map(([nome, valor]) => ({ nome, valor }))
                            .sort((a, b) => b.valor - a.valor);
                          if (ranking.length <= 1) return null;
                          const maxVal = ranking[0]?.valor || 1;
                          return (
                            <div className="mb-4 p-4 rounded-lg bg-secondary/20 border border-border">
                              <p className="text-xs font-semibold text-foreground mb-3 flex items-center gap-1.5">
                                <Users className="w-3.5 h-3.5 text-primary" />
                                Ranking de Corretores por Comissão
                              </p>
                            {(() => {
                              const visibleRanking = showAllCorretores ? ranking : ranking.slice(0, 3);
                              return (
                                <>
                                  <div className="space-y-2">
                                    {visibleRanking.map((r, i) => (
                                      <div key={r.nome} className="flex items-center gap-2">
                                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                                          i === 0 ? "bg-warning/20 text-warning" : i === 1 ? "bg-muted text-muted-foreground" : i === 2 ? "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400" : "bg-secondary text-muted-foreground"
                                        }`}>
                                          {i + 1}
                                        </span>
                                        <span className="text-xs text-foreground font-medium truncate flex-1">{r.nome}</span>
                                        <div className="w-24 h-2 rounded-full bg-secondary overflow-hidden">
                                          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(r.valor / maxVal) * 100}%` }} />
                                        </div>
                                        <span className="text-xs font-semibold text-foreground w-24 text-right">{formatCurrency(r.valor)}</span>
                                      </div>
                                    ))}
                                  </div>
                                  {ranking.length > 3 && (
                                    <button
                                      onClick={() => setShowAllCorretores(!showAllCorretores)}
                                      className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-primary hover:underline transition-colors"
                                    >
                                      <Eye className="w-3 h-3" />
                                      {showAllCorretores ? "Ocultar detalhes" : `Ver todos (${ranking.length})`}
                                    </button>
                                  )}
                                </>
                              );
                            })()}
                            </div>
                          );
                        })()}

                        <div className="space-y-2">
                          {comissoesContratos.contratosAtivos.map(c => {
                            const detailOpen = openContratoDetails.has(c.id);
                            const toggleDetail = () => setOpenContratoDetails(prev => { const n = new Set(prev); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return n; });
                            return (
                            <div key={c.id} className="p-3 rounded-lg bg-secondary/30 border border-border">
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-sm font-semibold text-foreground truncate">{c.titulo}</p>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{c.tipo}</span>
                                  <button
                                    onClick={toggleDetail}
                                    className="w-6 h-6 rounded-full flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                                    title={detailOpen ? "Ocultar detalhes" : "Visualizar detalhes"}
                                  >
                                    {detailOpen ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                  </button>
                                  <button
                                    onClick={() => contratoDialog.openEdit(c)}
                                    className="w-6 h-6 rounded-full flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                                    title="Editar contrato"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                              {/* Summary line always visible */}
                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                <span>Comissão: <strong className="text-foreground">{formatCurrency(c.comissao_valor || 0)}</strong></span>
                                <span>Líquido: <strong className={`${(c.comissao_valor || 0) - (c.corretor_comissao_valor || 0) - (c.parceiro_comissao_valor || 0) - (c.captador_comissao_valor || 0) - (c.imposto_valor || 0) >= 0 ? "text-success" : "text-destructive"}`}>{formatCurrency((c.comissao_valor || 0) - (c.corretor_comissao_valor || 0) - (c.parceiro_comissao_valor || 0) - (c.captador_comissao_valor || 0) - (c.imposto_valor || 0))}</strong></span>
                                {c.corretor_nome && <span>Corretor: {c.corretor_nome}</span>}
                              </div>
                              {detailOpen && (
                              <div className="space-y-3 mt-3 pt-3 border-t border-border">
                                <p className="text-xs font-semibold text-foreground flex items-center gap-1">💰 Comissão e Divisão</p>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                                  <div className="p-2 rounded bg-primary/5">
                                    <p className="text-muted-foreground">% Comissão Total</p>
                                    <p className="font-semibold text-foreground">{c.comissao_percentual || 0}%</p>
                                  </div>
                                  <div className="p-2 rounded bg-primary/5">
                                    <p className="text-muted-foreground">Valor Comissão</p>
                                    <p className="font-semibold text-foreground">{formatCurrency(c.comissao_valor || 0)}</p>
                                  </div>
                                  <div className="p-2 rounded bg-primary/5">
                                    <p className="text-muted-foreground">Valor Contrato</p>
                                    <p className="font-semibold text-foreground">{formatCurrency(c.valor || 0)}</p>
                                  </div>
                                </div>

                                <p className="text-xs font-semibold text-foreground flex items-center gap-1">👤 Corretor Responsável</p>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                                  <div className="p-2 rounded bg-success/5">
                                    <p className="text-muted-foreground">Nome</p>
                                    <p className="font-semibold text-foreground">{c.corretor_nome || <span className="italic text-muted-foreground">—</span>}</p>
                                  </div>
                                  <div className="p-2 rounded bg-success/5">
                                    <p className="text-muted-foreground">% Comissão p/ Corretor</p>
                                    <p className="font-semibold text-foreground">{c.corretor_comissao_percentual || 0}%</p>
                                  </div>
                                  <div className="p-2 rounded bg-success/5">
                                    <p className="text-muted-foreground">Valor Corretor</p>
                                    <p className="font-semibold text-foreground">{formatCurrency(c.corretor_comissao_valor || 0)}</p>
                                  </div>
                                </div>

                                <p className="text-xs font-semibold text-foreground flex items-center gap-1">🤝 Parceria</p>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                                  <div className="p-2 rounded bg-warning/5">
                                    <p className="text-muted-foreground">Tem Parceria?</p>
                                    <p className="font-semibold text-foreground">{c.tem_parceria ? "Sim" : "Não"}</p>
                                  </div>
                                  {c.tem_parceria && (
                                    <>
                                      <div className="p-2 rounded bg-warning/5">
                                        <p className="text-muted-foreground">Parceiro</p>
                                        <p className="font-semibold text-foreground">{c.parceiro_nome || <span className="italic text-muted-foreground">—</span>}</p>
                                      </div>
                                      <div className="p-2 rounded bg-warning/5">
                                        <p className="text-muted-foreground">Valor Parceria</p>
                                        <p className="font-semibold text-foreground">{formatCurrency(c.parceiro_comissao_valor || 0)}</p>
                                      </div>
                                    </>
                                  )}
                                </div>

                                <p className="text-xs font-semibold text-foreground flex items-center gap-1">🎯 Captador</p>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                                  <div className="p-2 rounded bg-info/5">
                                    <p className="text-muted-foreground">Nome Captador</p>
                                    <p className="font-semibold text-foreground">{c.captador_nome || <span className="italic text-muted-foreground">—</span>}</p>
                                  </div>
                                  <div className="p-2 rounded bg-info/5">
                                    <p className="text-muted-foreground">Valor Captador</p>
                                    <p className="font-semibold text-foreground">{formatCurrency(c.captador_comissao_valor || 0)}</p>
                                  </div>
                                </div>

                                <p className="text-xs font-semibold text-foreground flex items-center gap-1">🏛️ Impostos</p>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                                  <div className="p-2 rounded bg-destructive/5">
                                    <p className="text-muted-foreground">Tipo</p>
                                    <p className="font-semibold text-foreground">{c.imposto_tipo || <span className="italic text-muted-foreground">Nenhum</span>}</p>
                                  </div>
                                  <div className="p-2 rounded bg-destructive/5">
                                    <p className="text-muted-foreground">Valor Imposto</p>
                                    <p className="font-semibold text-foreground">{formatCurrency(c.imposto_valor || 0)}</p>
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  <div className="p-2 rounded bg-secondary">
                                    <p className="text-muted-foreground">📡 Canal de Origem</p>
                                    <p className="font-semibold text-foreground">{c.canal_origem ? getCanalLabel(c.canal_origem) : <span className="italic text-muted-foreground">—</span>}</p>
                                  </div>
                                </div>

                                <p className="text-xs font-semibold text-foreground flex items-center gap-1">🏠 Proprietário</p>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                                  <div className="p-2 rounded bg-primary/5">
                                    <p className="text-muted-foreground">Nome</p>
                                    <p className="font-semibold text-foreground">{c.proprietario || <span className="italic text-muted-foreground">—</span>}</p>
                                  </div>
                                  <div className="p-2 rounded bg-primary/5">
                                    <p className="text-muted-foreground">CPF</p>
                                    <p className="font-semibold text-foreground">{c.proprietario_cpf || <span className="italic text-muted-foreground">—</span>}</p>
                                  </div>
                                  <div className="p-2 rounded bg-primary/5">
                                    <p className="text-muted-foreground">RG</p>
                                    <p className="font-semibold text-foreground">{c.proprietario_rg || <span className="italic text-muted-foreground">—</span>}</p>
                                  </div>
                                  <div className="p-2 rounded bg-primary/5">
                                    <p className="text-muted-foreground">Email</p>
                                    <p className="font-semibold text-foreground">{c.proprietario_email || <span className="italic text-muted-foreground">—</span>}</p>
                                  </div>
                                  <div className="p-2 rounded bg-primary/5">
                                    <p className="text-muted-foreground">Telefone</p>
                                    <p className="font-semibold text-foreground">{c.proprietario_telefone || <span className="italic text-muted-foreground">—</span>}</p>
                                  </div>
                                </div>

                                <p className="text-xs font-semibold text-foreground flex items-center gap-1">🏦 Dados Bancários do Proprietário</p>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                                  <div className="p-2 rounded bg-success/5">
                                    <p className="text-muted-foreground">Banco</p>
                                    <p className="font-semibold text-foreground">{c.proprietario_banco || <span className="italic text-muted-foreground">—</span>}</p>
                                  </div>
                                  <div className="p-2 rounded bg-success/5">
                                    <p className="text-muted-foreground">Agência</p>
                                    <p className="font-semibold text-foreground">{c.proprietario_agencia || <span className="italic text-muted-foreground">—</span>}</p>
                                  </div>
                                  <div className="p-2 rounded bg-success/5">
                                    <p className="text-muted-foreground">Conta</p>
                                    <p className="font-semibold text-foreground">{c.proprietario_conta || <span className="italic text-muted-foreground">—</span>}</p>
                                  </div>
                                  <div className="p-2 rounded bg-success/5">
                                    <p className="text-muted-foreground">PIX</p>
                                    <p className="font-semibold text-foreground">{c.proprietario_pix || <span className="italic text-muted-foreground">—</span>}</p>
                                  </div>
                                </div>

                                {c.tipo === "Locação" && (
                                  <>
                                    <p className="text-xs font-semibold text-foreground flex items-center gap-1">🔑 Inquilino</p>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                                      <div className="p-2 rounded bg-info/5">
                                        <p className="text-muted-foreground">Nome</p>
                                        <p className="font-semibold text-foreground">{c.inquilino || c.cliente || <span className="italic text-muted-foreground">—</span>}</p>
                                      </div>
                                      <div className="p-2 rounded bg-info/5">
                                        <p className="text-muted-foreground">CPF</p>
                                        <p className="font-semibold text-foreground">{c.inquilino_cpf || <span className="italic text-muted-foreground">—</span>}</p>
                                      </div>
                                      <div className="p-2 rounded bg-info/5">
                                        <p className="text-muted-foreground">RG</p>
                                        <p className="font-semibold text-foreground">{c.inquilino_rg || <span className="italic text-muted-foreground">—</span>}</p>
                                      </div>
                                      <div className="p-2 rounded bg-info/5">
                                        <p className="text-muted-foreground">Email</p>
                                        <p className="font-semibold text-foreground">{c.inquilino_email || <span className="italic text-muted-foreground">—</span>}</p>
                                      </div>
                                      <div className="p-2 rounded bg-info/5">
                                        <p className="text-muted-foreground">Telefone</p>
                                        <p className="font-semibold text-foreground">{c.inquilino_telefone || <span className="italic text-muted-foreground">—</span>}</p>
                                      </div>
                                    </div>
                                  </>
                                )}

                                {c.tipo === "Venda" && (
                                  <>
                                    <p className="text-xs font-semibold text-foreground flex items-center gap-1">🛒 Comprador</p>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                                      <div className="p-2 rounded bg-info/5">
                                        <p className="text-muted-foreground">Nome</p>
                                        <p className="font-semibold text-foreground">{c.cliente || <span className="italic text-muted-foreground">—</span>}</p>
                                      </div>
                                      <div className="p-2 rounded bg-info/5">
                                        <p className="text-muted-foreground">CPF</p>
                                        <p className="font-semibold text-foreground">{c.cliente_cpf || <span className="italic text-muted-foreground">—</span>}</p>
                                      </div>
                                      <div className="p-2 rounded bg-info/5">
                                        <p className="text-muted-foreground">RG</p>
                                        <p className="font-semibold text-foreground">{c.cliente_rg || <span className="italic text-muted-foreground">—</span>}</p>
                                      </div>
                                      <div className="p-2 rounded bg-info/5">
                                        <p className="text-muted-foreground">Email</p>
                                        <p className="font-semibold text-foreground">{c.cliente_email || <span className="italic text-muted-foreground">—</span>}</p>
                                      </div>
                                      <div className="p-2 rounded bg-info/5">
                                        <p className="text-muted-foreground">Telefone</p>
                                        <p className="font-semibold text-foreground">{c.cliente_telefone || <span className="italic text-muted-foreground">—</span>}</p>
                                      </div>
                                    </div>
                                  </>
                                )}
                              </div>
                              )}
                            </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                          </div>
                        )}
                      </div>
                    )}

                  </motion.div>
                )}
              </>
            );
          })()}
        </>
      )}

      {/* Form Dialog */}
      <TransacaoFormDialog
        key={transacaoDialog.selectedItem?.id ?? "nova-transacao"}
        open={transacaoDialog.open}
        onOpenChange={transacaoDialog.handleOpenChange}
        transacao={transacaoDialog.selectedItem}
        onSave={handleSave}
        saving={saving}
      />

      {/* Contrato Edit Dialog */}
      <ContratoFormDialog
        open={contratoDialog.open}
        onOpenChange={contratoDialog.handleOpenChange}
        contrato={contratoDialog.selectedItem}
        onSave={handleSaveContrato}
        saving={savingContrato}
      />

      <AlertDialog open={!!deleteItem} onOpenChange={(open) => !open && setDeleteItem(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir transação?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{deleteItem?.descricao}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {cobrancaTx && (
        <CobrancaLinkDialog
          open={!!cobrancaTx}
          onOpenChange={(o) => !o && setCobrancaTx(null)}
          transacao={cobrancaTx as any}
          onChanged={refetch}
        />
      )}

      <Dialog open={configCobrancasOpen} onOpenChange={setConfigCobrancasOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Automação de cobranças</DialogTitle>
          </DialogHeader>
          <CobrancasConfigPanel />
        </DialogContent>
      </Dialog>

      <EnviarRelatorioDialog
        open={relatorioDialog.open}
        onOpenChange={relatorioDialog.handleOpenChange}
        contratos={contratos}
        transacoes={transacoes}
        imoveis={imoveis}
        proprietarios={proprietarios}
        brandName={imobiliariaConfig.nome_empresa || undefined}
        brandPhone={imobiliariaConfig.telefone || undefined}
        brandEmail={imobiliariaConfig.email || undefined}
        brandCreci={imobiliariaConfig.creci || undefined}
      />

      <RelatorioUnidadeDialog
        open={relatorioUnidadeDialogOpen}
        onOpenChange={setRelatorioUnidadeDialogOpen}
        transacoes={transacoes}
        contratos={contratos}
        brandName={imobiliariaConfig.nome_empresa || undefined}
        brandPhone={imobiliariaConfig.telefone || undefined}
        brandEmail={imobiliariaConfig.email || undefined}
        brandCreci={imobiliariaConfig.creci || undefined}
      />
      <RelatorioMensalProprietarioDialog
        open={relatorioMensalProprietarioOpen}
        onOpenChange={setRelatorioMensalProprietarioOpen}
        contratos={contratos}
        transacoes={transacoes}
        imoveis={imoveis}
        proprietarios={proprietarios}
        brandName={imobiliariaConfig.nome_empresa || undefined}
        brandPhone={imobiliariaConfig.telefone || undefined}
        brandEmail={imobiliariaConfig.email || undefined}
        brandCreci={imobiliariaConfig.creci || undefined}
      />
    </DashboardLayout>
  );
};

export default Financeiro;
