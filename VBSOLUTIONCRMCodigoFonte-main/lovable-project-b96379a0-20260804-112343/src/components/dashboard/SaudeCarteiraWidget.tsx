import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, AlertTriangle, CheckCircle2, Clock, TrendingDown } from "lucide-react";
import { motion } from "framer-motion";

interface ImovelStatus {
  id: string;
  status: string;
  created_at: string;
  updated_at: string;
  preco: number;
}

export function SaudeCarteiraWidget() {
  const { user } = useAuth();
  const [imoveis, setImoveis] = useState<ImovelStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data } = await supabase
        .from("imoveis")
        .select("id, status, created_at, updated_at, preco");
      setImoveis((data ?? []) as ImovelStatus[]);
      setLoading(false);
    };
    fetch();
  }, [user]);

  const stats = useMemo(() => {
    const total = imoveis.length;
    if (total === 0) return null;

    const now = new Date();
    const ativos = imoveis.filter((i) => i.status === "Ativo");
    const vendidos = imoveis.filter((i) => i.status === "Vendido" || i.status === "Alugado");
    const inativos = imoveis.filter((i) => i.status === "Inativo" || i.status === "Suspenso");

    // Parados: ativos sem atualização há 60+ dias
    const parados60 = ativos.filter((i) => {
      const days = (now.getTime() - new Date(i.updated_at).getTime()) / (1000 * 60 * 60 * 24);
      return days >= 60;
    });
    const parados120 = ativos.filter((i) => {
      const days = (now.getTime() - new Date(i.updated_at).getTime()) / (1000 * 60 * 60 * 24);
      return days >= 120;
    });

    // Score de saúde: (ativos movimentando + vendidos) / total
    const ativosMovimentando = ativos.length - parados60.length;
    const score = Math.round(((ativosMovimentando + vendidos.length) / total) * 100);

    return {
      total,
      ativos: ativos.length,
      vendidos: vendidos.length,
      inativos: inativos.length,
      parados60: parados60.length,
      parados120: parados120.length,
      ativosMovimentando,
      score,
      valorAtivos: ativos.reduce((s, i) => s + Number(i.preco || 0), 0),
      valorParados: parados60.reduce((s, i) => s + Number(i.preco || 0), 0),
    };
  }, [imoveis]);

  if (loading || !stats) return null;

  const getScoreColor = (score: number) => {
    if (score >= 70) return "hsl(142, 71%, 45%)";
    if (score >= 40) return "hsl(38, 92%, 50%)";
    return "hsl(0, 72%, 51%)";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 70) return "Saudável";
    if (score >= 40) return "Atenção";
    return "Crítico";
  };

  const scoreColor = getScoreColor(stats.score);
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (stats.score / 100) * circumference;

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

  const segments = [
    { label: "Ativos", value: stats.ativosMovimentando, color: "hsl(142, 71%, 45%)", icon: CheckCircle2 },
    { label: "Parados 60d+", value: stats.parados60, color: "hsl(38, 92%, 50%)", icon: Clock },
    { label: "Parados 120d+", value: stats.parados120, color: "hsl(0, 72%, 51%)", icon: AlertTriangle },
    { label: "Vendidos/Alugados", value: stats.vendidos, color: "hsl(199, 89%, 48%)", icon: CheckCircle2 },
    { label: "Inativos", value: stats.inativos, color: "hsl(0, 0%, 55%)", icon: TrendingDown },
  ];

  return (
    <Card className="glass-card glow-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-5 w-5 text-primary" />
            Saúde da Carteira
          </CardTitle>
          <Badge
            className="text-xs font-bold"
            style={{ backgroundColor: `${scoreColor}20`, color: scoreColor, border: `1px solid ${scoreColor}40` }}
          >
            {getScoreLabel(stats.score)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-6">
          {/* Score gauge */}
          <div className="relative w-28 h-28 flex-shrink-0">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              <circle cx="50" cy="50" r="45" fill="none" stroke="hsl(var(--secondary))" strokeWidth="8" />
              <motion.circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke={scoreColor}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset }}
                transition={{ duration: 1.2, ease: "easeOut" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-foreground">{stats.score}%</span>
              <span className="text-[10px] text-muted-foreground">{stats.total} imóveis</span>
            </div>
          </div>

          {/* Breakdown */}
          <div className="flex-1 space-y-2">
            {segments.filter((s) => s.value > 0).map((seg, i) => (
              <motion.div
                key={seg.label}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.08 }}
                className="flex items-center gap-2"
              >
                <seg.icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: seg.color }} />
                <span className="text-[11px] text-foreground flex-1">{seg.label}</span>
                <span className="text-xs font-bold" style={{ color: seg.color }}>
                  {seg.value}
                </span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Valor em risco */}
        {stats.valorParados > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="mt-4 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-medium text-foreground">Valor parado (60d+)</span>
              </div>
              <span className="text-sm font-bold text-amber-600">{formatCurrency(stats.valorParados)}</span>
            </div>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
