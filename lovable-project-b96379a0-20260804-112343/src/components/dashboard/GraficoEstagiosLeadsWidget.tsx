import { useMemo } from "react";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { ESTAGIOS } from "@/hooks/useLeads";
import { Users } from "lucide-react";

interface Props {
  leads: { estagio: string }[];
}

const chartTooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "12px",
  color: "hsl(var(--foreground))",
  boxShadow: "0 8px 32px -8px rgba(0,0,0,0.12)",
  padding: "12px 16px",
  fontSize: "13px",
};

export function GraficoEstagiosLeadsWidget({ leads }: Props) {
  const data = useMemo(() => {
    const totalItem = {
      name: "Total Leads",
      value: leads.length,
      color: "hsl(220, 70%, 50%)",
    };

    const stageItems = ESTAGIOS.map((e) => ({
      name: e.title,
      value: leads.filter((l) => l.estagio === e.id).length,
      color: e.color,
    }));

    return [totalItem, ...stageItems];
  }, [leads]);

  const maxValue = useMemo(() => Math.max(...data.map((d) => d.value), 1), [data]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.48 }}
      className="glass-card p-4 md:p-5 glow-border"
    >
      <div className="flex items-center gap-2 mb-5">
        <Users className="h-5 w-5 text-primary" />
        <div>
          <h3 className="text-base font-semibold text-foreground">
            Distribuição de Leads por Estágio
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {leads.length} leads no período
          </p>
        </div>
      </div>

      {leads.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          Nenhum lead no período selecionado
        </p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Bar Chart */}
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data} layout="vertical" margin={{ left: 5, right: 20, top: 2, bottom: 2 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" opacity={0.4} horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
              <YAxis
                dataKey="name"
                type="category"
                width={110}
                tick={{ fontSize: 10, fill: "hsl(var(--foreground))" }}
              />
              <Tooltip
                contentStyle={chartTooltipStyle}
                formatter={(value: number, name: string) => [value, "Quantidade"]}
                cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }}
              />
              <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={18}>
                {data.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 content-start">
            {data.map((item) => (
              <div
                key={item.name}
                className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/30 px-2.5 py-1.5"
              >
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground truncate">{item.name}</p>
                  <p className="text-xs font-bold text-foreground">{item.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
