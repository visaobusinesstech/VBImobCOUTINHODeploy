import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Calendar, DollarSign, RefreshCw, ChevronDown, ChevronUp, Bell } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

interface Contrato {
  id: string;
  titulo: string;
  cliente: string;
  inquilino: string | null;
  tipo: string;
  valor: number;
  data_fim: string | null;
  data_proxima_correcao: string | null;
  indice_correcao: string | null;
  percentual_correcao: number | null;
  status: string;
}

interface TransacaoAtrasada {
  id: string;
  descricao: string;
  valor: number;
  data: string;
  categoria: string;
}

interface Alerta {
  id: string;
  tipo: "reajuste" | "vencimento" | "inadimplencia";
  titulo: string;
  descricao: string;
  diasRestantes: number;
  urgencia: "info" | "atencao" | "importante" | "urgente" | "critico";
  valor: number;
}

function getUrgenciaColor(u: Alerta["urgencia"]) {
  switch (u) {
    case "critico": return "bg-red-600 text-white";
    case "urgente": return "bg-red-500 text-white";
    case "importante": return "bg-orange-500 text-white";
    case "atencao": return "bg-yellow-500 text-black";
    default: return "bg-blue-500 text-white";
  }
}

function getUrgenciaLabel(u: Alerta["urgencia"]) {
  switch (u) {
    case "critico": return "Crítico";
    case "urgente": return "Urgente";
    case "importante": return "Importante";
    case "atencao": return "Atenção";
    default: return "Info";
  }
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export function AlertasContratosWidget() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [atrasadas, setAtrasadas] = useState<TransacaoAtrasada[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);

    const [{ data: c }, { data: t }] = await Promise.all([
      supabase
        .from("contratos")
        .select("id, titulo, cliente, inquilino, tipo, valor, data_fim, data_proxima_correcao, indice_correcao, percentual_correcao, status")
        .in("status", ["ativo", "rascunho"]),
      supabase
        .from("transacoes")
        .select("id, descricao, valor, data, categoria")
        .eq("status", "atrasado")
        .eq("tipo", "entrada"),
    ]);

    setContratos((c as Contrato[]) || []);
    setAtrasadas((t as TransacaoAtrasada[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [user]);

  const alertas = useMemo<Alerta[]>(() => {
    const now = new Date();
    const list: Alerta[] = [];

    for (const c of contratos) {
      // Reajuste
      if (c.data_proxima_correcao) {
        const d = new Date(c.data_proxima_correcao + "T00:00:00");
        const diff = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (diff >= 0 && diff <= 30) {
          let urgencia: Alerta["urgencia"] = "info";
          if (diff <= 7) urgencia = "urgente";
          else if (diff <= 15) urgencia = "importante";
          else urgencia = "atencao";

          list.push({
            id: `reaj-${c.id}`,
            tipo: "reajuste",
            titulo: `Reajuste — ${c.titulo}`,
            descricao: `${c.inquilino || c.cliente} • ${c.indice_correcao || "IGPM"} (${c.percentual_correcao || 0}%) • ${d.toLocaleDateString("pt-BR")}`,
            diasRestantes: diff,
            urgencia,
            valor: c.valor,
          });
        }
      }

      // Vencimento
      if (c.data_fim) {
        const d = new Date(c.data_fim + "T00:00:00");
        const diff = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (diff <= 60) {
          let urgencia: Alerta["urgencia"] = "info";
          if (diff <= 0) urgencia = "critico";
          else if (diff <= 7) urgencia = "urgente";
          else if (diff <= 15) urgencia = "importante";
          else if (diff <= 30) urgencia = "atencao";

          list.push({
            id: `venc-${c.id}`,
            tipo: "vencimento",
            titulo: diff <= 0 ? `VENCIDO — ${c.titulo}` : `Vencimento — ${c.titulo}`,
            descricao: `${c.inquilino || c.cliente} • ${c.tipo} • ${diff <= 0 ? `Venceu há ${Math.abs(diff)} dias` : `Vence em ${diff} dias`} (${d.toLocaleDateString("pt-BR")})`,
            diasRestantes: diff,
            urgencia,
            valor: c.valor,
          });
        }
      }
    }

    // Inadimplência
    for (const t of atrasadas) {
      const d = new Date(t.data + "T00:00:00");
      const diasAtraso = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
      if (diasAtraso < 1) continue;

      let urgencia: Alerta["urgencia"] = "atencao";
      if (diasAtraso > 30) urgencia = "critico";
      else if (diasAtraso > 15) urgencia = "urgente";
      else if (diasAtraso > 7) urgencia = "importante";

      list.push({
        id: `inad-${t.id}`,
        tipo: "inadimplencia",
        titulo: `Inadimplência — ${t.descricao.substring(0, 40)}`,
        descricao: `${t.categoria} • Atrasado há ${diasAtraso} dias • Vencimento: ${d.toLocaleDateString("pt-BR")}`,
        diasRestantes: -diasAtraso,
        urgencia,
        valor: t.valor,
      });
    }

    // Sort by urgency
    const urgOrder = { critico: 0, urgente: 1, importante: 2, atencao: 3, info: 4 };
    list.sort((a, b) => urgOrder[a.urgencia] - urgOrder[b.urgencia]);

    return list;
  }, [contratos, atrasadas]);

  const handleRunAlertas = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("alertas-contratos");
      if (error) throw error;
      toast({ title: "Alertas verificados!", description: `${data?.alerts || 0} novos alertas gerados.` });
      await fetchData();
    } catch (err: any) {
      toast({ title: "Erro ao verificar alertas", description: err.message, variant: "destructive" });
    }
    setRunning(false);
  };

  const tipoIcon = (tipo: Alerta["tipo"]) => {
    switch (tipo) {
      case "reajuste": return <Calendar className="h-4 w-4" />;
      case "vencimento": return <AlertTriangle className="h-4 w-4" />;
      case "inadimplencia": return <DollarSign className="h-4 w-4" />;
    }
  };

  const visibleAlertas = expanded ? alertas : alertas.slice(0, 5);
  const totalInadimplencia = atrasadas.reduce((s, t) => s + Number(t.valor), 0);
  const countByType = {
    reajuste: alertas.filter(a => a.tipo === "reajuste").length,
    vencimento: alertas.filter(a => a.tipo === "vencimento").length,
    inadimplencia: alertas.filter(a => a.tipo === "inadimplencia").length,
  };

  if (loading) return null;
  if (alertas.length === 0) return null;

  return (
    <Card className="border-destructive/30 bg-destructive/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-5 w-5 text-destructive" />
            Alertas de Contratos
            <Badge variant="destructive" className="ml-1">{alertas.length}</Badge>
          </CardTitle>
          <Button variant="outline" size="sm" onClick={handleRunAlertas} disabled={running}>
            <RefreshCw className={`h-4 w-4 mr-1 ${running ? "animate-spin" : ""}`} />
            Verificar
          </Button>
        </div>
        <div className="flex gap-3 mt-2 flex-wrap">
          {countByType.reajuste > 0 && (
            <Badge variant="outline" className="text-xs gap-1">
              <Calendar className="h-3 w-3" /> {countByType.reajuste} Reajustes
            </Badge>
          )}
          {countByType.vencimento > 0 && (
            <Badge variant="outline" className="text-xs gap-1">
              <AlertTriangle className="h-3 w-3" /> {countByType.vencimento} Vencimentos
            </Badge>
          )}
          {countByType.inadimplencia > 0 && (
            <Badge variant="outline" className="text-xs gap-1 text-destructive border-destructive">
              <DollarSign className="h-3 w-3" /> {countByType.inadimplencia} Inadimplência ({formatCurrency(totalInadimplencia)})
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <AnimatePresence>
          {visibleAlertas.map((a, i) => (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ delay: i * 0.03 }}
              className="flex items-start gap-3 p-3 rounded-lg bg-background/80 border"
            >
              <div className="mt-0.5">{tipoIcon(a.tipo)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm truncate">{a.titulo}</span>
                  <Badge className={`text-[10px] px-1.5 py-0 ${getUrgenciaColor(a.urgencia)}`}>
                    {getUrgenciaLabel(a.urgencia)}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{a.descricao}</p>
                <p className="text-xs font-medium mt-0.5">{formatCurrency(a.valor)}</p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {alertas.length > 5 && (
          <Button variant="ghost" size="sm" className="w-full" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
            {expanded ? "Ver menos" : `Ver todos (${alertas.length})`}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
