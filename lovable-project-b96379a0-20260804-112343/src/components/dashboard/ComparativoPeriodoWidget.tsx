import { useMemo } from "react";
import { TrendingUp, TrendingDown, Minus, ArrowRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface PeriodMetrics {
  label: string;
  receita: number;
  despesas: number;
  leads: number;
  contratos: number;
}

interface Props {
  current: PeriodMetrics;
  previous: PeriodMetrics;
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

function VariationBadge({ current, previous, isCurrency = false }: { current: number; previous: number; isCurrency?: boolean }) {
  if (previous === 0 && current === 0) {
    return <span className="text-xs text-muted-foreground flex items-center gap-1"><Minus className="w-3 h-3" /> Sem dados</span>;
  }
  const pctChange = previous === 0 ? 100 : ((current - previous) / Math.abs(previous)) * 100;
  const isPositive = pctChange >= 0;

  return (
    <span className={`text-xs font-semibold flex items-center gap-1 ${isPositive ? "text-green-500" : "text-red-500"}`}>
      {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
      {isPositive ? "+" : ""}{pctChange.toFixed(1)}%
    </span>
  );
}

const chartTooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "12px",
  color: "hsl(var(--foreground))",
  padding: "10px 14px",
  fontSize: "12px",
};

export function ComparativoPeriodoWidget({ current, previous }: Props) {
  const chartData = useMemo(() => [
    {
      name: "Receita",
      [previous.label]: previous.receita,
      [current.label]: current.receita,
    },
    {
      name: "Despesas",
      [previous.label]: previous.despesas,
      [current.label]: current.despesas,
    },
  ], [current, previous]);

  const metrics = [
    { label: "Receita", curr: current.receita, prev: previous.receita, isCurrency: true },
    { label: "Despesas", curr: current.despesas, prev: previous.despesas, isCurrency: true },
    { label: "Leads", curr: current.leads, prev: previous.leads },
    { label: "Contratos", curr: current.contratos, prev: previous.contratos },
  ];

  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">📊 Comparativo de Períodos</h3>
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          {previous.label} <ArrowRight className="w-3 h-3" /> {current.label}
        </span>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {metrics.map((m) => (
          <div key={m.label} className="p-3 rounded-lg bg-secondary/50 border border-border/50">
            <p className="text-[11px] text-muted-foreground mb-1">{m.label}</p>
            <p className="text-sm font-bold text-foreground">
              {m.isCurrency ? formatCurrency(m.curr) : m.curr}
            </p>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[10px] text-muted-foreground">
                Ant: {m.isCurrency ? formatCurrency(m.prev) : m.prev}
              </span>
              <VariationBadge current={m.curr} previous={m.prev} isCurrency={m.isCurrency} />
            </div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} barCategoryGap="20%">
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
            <YAxis
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip contentStyle={chartTooltipStyle} formatter={(v: number) => formatCurrency(v)} />
            <Legend wrapperStyle={{ fontSize: "11px" }} />
            <Bar dataKey={previous.label} fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} opacity={0.5} />
            <Bar dataKey={current.label} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
