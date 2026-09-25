import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Loader2, TrendingUp, LineChart as LineIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

type ContratoRow = {
  id: string;
  tipo: string | null;
  status: string | null;
  valor: number | null;
  data_inicio: string | null;
  data_fim: string | null;
};

const MESES_ABREV = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const HORIZONTES = [6, 12, 24] as const;
type Horizonte = (typeof HORIZONTES)[number];

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
const fmtBRLCompact = (v: number) =>
  new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(v);

function isLocacao(tipo: string | null): boolean {
  const t = (tipo || "").toLowerCase();
  return t.includes("loca") || t.includes("alug");
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function PrevisaoReceitaWidget() {
  const { imobiliariaId } = useAuth();
  const [contratos, setContratos] = useState<ContratoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [horizonte, setHorizonte] = useState<Horizonte>(12);

  useEffect(() => {
    if (!imobiliariaId) return;
    let cancel = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("contratos")
        .select("id, tipo, status, valor, data_inicio, data_fim")
        .eq("imobiliaria_id", imobiliariaId)
        .in("status", ["ativo", "assinado"]);
      if (cancel) return;
      setContratos(((data as any) ?? []) as ContratoRow[]);
      setLoading(false);
    })();
    return () => {
      cancel = true;
    };
  }, [imobiliariaId]);

  const { chartData, totalPrevisto, mediaMensal, contratosLocacao, contratosVenda } = useMemo(() => {
    const hoje = new Date();
    hoje.setDate(1);
    hoje.setHours(0, 0, 0, 0);

    const buckets: { key: string; label: string; locacao: number; venda: number }[] = [];
    for (let i = 0; i < horizonte; i++) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
      buckets.push({
        key: monthKey(d),
        label: `${MESES_ABREV[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`,
        locacao: 0,
        venda: 0,
      });
    }
    const idx = new Map(buckets.map((b, i) => [b.key, i]));

    let nLoc = 0;
    let nVen = 0;

    for (const c of contratos) {
      const valor = Number(c.valor) || 0;
      if (valor <= 0) continue;
      if (isLocacao(c.tipo)) {
        nLoc++;
        // Aluguel = receita recorrente enquanto contrato ativo
        const fim = c.data_fim ? new Date(c.data_fim) : null;
        const inicio = c.data_inicio ? new Date(c.data_inicio) : hoje;
        for (const b of buckets) {
          const [y, m] = b.key.split("-").map(Number);
          const bucketDate = new Date(y, m - 1, 1);
          if (inicio > new Date(y, m - 1, 28)) continue;
          if (fim && fim < bucketDate) continue;
          b.locacao += valor;
        }
      } else {
        nVen++;
        // Venda = receita pontual (data_fim se houver, senão data_inicio, senão mês atual)
        const ref = c.data_fim ? new Date(c.data_fim) : c.data_inicio ? new Date(c.data_inicio) : hoje;
        const k = monthKey(new Date(ref.getFullYear(), ref.getMonth(), 1));
        const i = idx.get(k);
        if (i != null) buckets[i].venda += valor;
      }
    }

    const chart = buckets.map((b) => ({
      mes: b.label,
      Locação: Math.round(b.locacao),
      Venda: Math.round(b.venda),
      Total: Math.round(b.locacao + b.venda),
    }));
    const total = chart.reduce((s, r) => s + r.Total, 0);
    return {
      chartData: chart,
      totalPrevisto: total,
      mediaMensal: chart.length ? total / chart.length : 0,
      contratosLocacao: nLoc,
      contratosVenda: nVen,
    };
  }, [contratos, horizonte]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.34 }}
      className="glass-card p-5 md:p-6 glow-border"
    >
      <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h3 className="text-base md:text-lg font-semibold text-foreground">Previsão de Receita</h3>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Projeção baseada em {contratosLocacao} locações + {contratosVenda} vendas ativas
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border p-0.5 bg-background/50">
          {HORIZONTES.map((h) => (
            <button
              key={h}
              onClick={() => setHorizonte(h)}
              className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                horizonte === h
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {h}m
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
        <div className="rounded-lg border border-border p-3 bg-background/40">
          <p className="text-[11px] text-muted-foreground">Total previsto ({horizonte}m)</p>
          <p className="text-lg font-bold text-foreground mt-1">{fmtBRL(totalPrevisto)}</p>
        </div>
        <div className="rounded-lg border border-border p-3 bg-background/40">
          <p className="text-[11px] text-muted-foreground">Média mensal</p>
          <p className="text-lg font-bold text-foreground mt-1">{fmtBRL(mediaMensal)}</p>
        </div>
        <div className="rounded-lg border border-border p-3 bg-background/40 col-span-2 md:col-span-1">
          <p className="text-[11px] text-muted-foreground">Próximo mês</p>
          <p className="text-lg font-bold text-foreground mt-1">
            {fmtBRL(chartData[0]?.Total ?? 0)}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="h-[280px] flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : chartData.every((r) => r.Total === 0) ? (
        <div className="h-[280px] flex flex-col items-center justify-center text-center gap-2">
          <LineIcon className="w-6 h-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Sem contratos ativos para projetar receita.</p>
        </div>
      ) : (
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="locGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(199, 89%, 48%)" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="hsl(199, 89%, 48%)" stopOpacity={0.5} />
                </linearGradient>
                <linearGradient id="venGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(45, 93%, 47%)" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="hsl(45, 93%, 47%)" stopOpacity={0.5} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickFormatter={(v) => fmtBRLCompact(Number(v))}
                width={60}
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(value: number, name) => [fmtBRL(Number(value)), name]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Locação" stackId="a" fill="url(#locGrad)" radius={[0, 0, 0, 0]} />
              <Bar dataKey="Venda" stackId="a" fill="url(#venGrad)" radius={[6, 6, 0, 0]} />
              <Line
                type="monotone"
                dataKey="Total"
                stroke="hsl(142, 71%, 45%)"
                strokeWidth={2.5}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </motion.div>
  );
}
