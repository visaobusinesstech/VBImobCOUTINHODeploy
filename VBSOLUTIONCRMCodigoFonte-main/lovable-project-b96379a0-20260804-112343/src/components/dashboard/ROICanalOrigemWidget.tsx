import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentCorretor } from "@/hooks/useCurrentCorretor";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Crown } from "lucide-react";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface LeadCanal {
  canal_origem: string | null;
  estagio: string;
  valor: number;
}

const CANAL_COLORS = [
  "hsl(199, 89%, 48%)",
  "hsl(142, 71%, 45%)",
  "hsl(262, 83%, 58%)",
  "hsl(38, 92%, 50%)",
  "hsl(25, 95%, 53%)",
  "hsl(0, 72%, 51%)",
  "hsl(180, 70%, 45%)",
  "hsl(340, 82%, 52%)",
];

const chartTooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "12px",
  color: "hsl(var(--foreground))",
  boxShadow: "0 8px 32px -8px rgba(0,0,0,0.12)",
  padding: "12px 16px",
  fontSize: "13px",
};

export function ROICanalOrigemWidget() {
  const { user } = useAuth();
  const { corretorId, isBroker, ready } = useCurrentCorretor();
  const [leads, setLeads] = useState<LeadCanal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !ready) return;
    const fetch = async () => {
      let q = supabase.from("leads").select("canal_origem, estagio, valor");
      if (isBroker && corretorId) q = q.eq("corretor_id", corretorId) as any;
      const { data } = await q;
      setLeads((data ?? []) as LeadCanal[]);
      setLoading(false);
    };
    fetch();
  }, [user, ready, isBroker, corretorId]);


  const canalData = useMemo(() => {
    const map = new Map<string, { total: number; fechados: number; valorFechado: number }>();
    leads.forEach((l) => {
      const canal = l.canal_origem || "Não informado";
      const entry = map.get(canal) || { total: 0, fechados: 0, valorFechado: 0 };
      entry.total++;
      if (l.estagio === "fechado") {
        entry.fechados++;
        entry.valorFechado += Number(l.valor) || 0;
      }
      map.set(canal, entry);
    });
    return Array.from(map.entries())
      .map(([canal, stats], i) => ({
        canal: canal.length > 15 ? canal.substring(0, 14) + "…" : canal,
        canalFull: canal,
        ...stats,
        conversao: stats.total > 0 ? Math.round((stats.fechados / stats.total) * 100) : 0,
        color: CANAL_COLORS[i % CANAL_COLORS.length],
      }))
      .sort((a, b) => b.conversao - a.conversao || b.fechados - a.fechados);
  }, [leads]);

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

  if (loading || canalData.length === 0) return null;

  const melhorCanal = canalData[0];

  return (
    <Card className="glass-card glow-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-5 w-5 text-primary" />
            ROI por Canal de Origem
          </CardTitle>
          <Badge variant="outline" className="text-xs gap-1">
            {canalData.length} canais
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">Qual canal gera mais fechamentos</p>
      </CardHeader>
      <CardContent>
        {/* Best channel highlight */}
        {melhorCanal.conversao > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-3 rounded-xl bg-primary/5 border border-primary/20 flex items-center gap-3"
          >
            <Crown className="w-5 h-5 text-primary flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">
                Melhor canal: {melhorCanal.canalFull}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {melhorCanal.conversao}% de conversão • {melhorCanal.fechados} fechados •{" "}
                {formatCurrency(melhorCanal.valorFechado)}
              </p>
            </div>
          </motion.div>
        )}

        {/* Chart */}
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={canalData.slice(0, 8)} layout="vertical" barGap={0}>
            <XAxis
              type="number"
              className="fill-muted-foreground"
              fontSize={11}
              axisLine={false}
              tickLine={false}
              unit="%"
            />
            <YAxis
              dataKey="canal"
              type="category"
              className="fill-muted-foreground"
              fontSize={10}
              width={90}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={chartTooltipStyle}
              formatter={(value: number, name: string) => {
                if (name === "conversao") return [`${value}%`, "Conversão"];
                return [value, name];
              }}
              labelFormatter={(label) => {
                const item = canalData.find((d) => d.canal === label);
                return item ? `${item.canalFull} — ${item.total} leads, ${item.fechados} fechados` : label;
              }}
            />
            <Bar dataKey="conversao" name="conversao" radius={[0, 6, 6, 0]} barSize={20}>
              {canalData.slice(0, 8).map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* Table summary */}
        <div className="mt-4 space-y-1.5">
          {canalData.slice(0, 6).map((item, i) => (
            <motion.div
              key={item.canalFull}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 + i * 0.05 }}
              className="flex items-center gap-2 text-[11px]"
            >
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: item.color }} />
              <span className="text-foreground flex-1 truncate">{item.canalFull}</span>
              <span className="text-muted-foreground">{item.total} leads</span>
              <span className="font-bold" style={{ color: item.color }}>
                {item.conversao}%
              </span>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
