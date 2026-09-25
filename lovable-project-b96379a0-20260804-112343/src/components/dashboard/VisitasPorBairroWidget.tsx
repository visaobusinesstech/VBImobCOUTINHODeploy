import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin } from "lucide-react";
import { motion } from "framer-motion";

interface CompromissoLocal {
  tipo: string;
  local: string | null;
  status: string;
  data_inicio: string;
}

export function VisitasPorBairroWidget() {
  const { user } = useAuth();
  const [compromissos, setCompromissos] = useState<CompromissoLocal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data } = await supabase
        .from("compromissos")
        .select("tipo, local, status, data_inicio")
        .in("tipo", ["visita", "reuniao"])
        .order("data_inicio", { ascending: false });
      setCompromissos((data ?? []) as CompromissoLocal[]);
      setLoading(false);
    };
    fetch();
  }, [user]);

  const bairroData = useMemo(() => {
    const map = new Map<string, { total: number; concluidas: number }>();
    compromissos.forEach((c) => {
      const bairro = c.local?.trim() || "Não informado";
      const entry = map.get(bairro) || { total: 0, concluidas: 0 };
      entry.total++;
      if (c.status === "concluido") entry.concluidas++;
      map.set(bairro, entry);
    });
    return Array.from(map.entries())
      .map(([bairro, stats]) => ({ bairro, ...stats }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [compromissos]);

  const maxTotal = Math.max(...bairroData.map((d) => d.total), 1);

  if (loading || bairroData.length === 0) return null;

  const HEAT_COLORS = [
    "hsl(142, 71%, 45%)",
    "hsl(80, 60%, 50%)",
    "hsl(45, 93%, 47%)",
    "hsl(38, 92%, 50%)",
    "hsl(25, 95%, 53%)",
    "hsl(15, 90%, 50%)",
    "hsl(0, 72%, 51%)",
  ];

  const getHeatColor = (value: number) => {
    const pct = value / maxTotal;
    const idx = Math.min(Math.floor(pct * HEAT_COLORS.length), HEAT_COLORS.length - 1);
    return HEAT_COLORS[idx];
  };

  return (
    <Card className="glass-card glow-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="h-5 w-5 text-primary" />
            Visitas por Localidade
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            {compromissos.length} visitas
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">Mapa de calor das regiões mais visitadas</p>
      </CardHeader>
      <CardContent className="space-y-2">
        {bairroData.map((item, i) => {
          const widthPct = Math.max((item.total / maxTotal) * 100, 12);
          const color = getHeatColor(item.total);
          return (
            <motion.div
              key={item.bairro}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-medium text-foreground truncate max-w-[60%]">{item.bairro}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">
                    {item.concluidas}/{item.total} concluídas
                  </span>
                  <span className="text-xs font-bold" style={{ color }}>{item.total}</span>
                </div>
              </div>
              <div className="relative h-6 rounded-md bg-secondary/50 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${widthPct}%` }}
                  transition={{ duration: 0.6, delay: 0.1 + i * 0.05 }}
                  className="absolute inset-y-0 left-0 rounded-md flex items-center justify-end px-2"
                  style={{ background: `linear-gradient(135deg, ${color}cc, ${color})`, minWidth: "24px" }}
                >
                  <span className="text-[9px] font-bold text-white drop-shadow-sm">
                    {Math.round((item.total / compromissos.length) * 100)}%
                  </span>
                </motion.div>
              </div>
            </motion.div>
          );
        })}
      </CardContent>
    </Card>
  );
}
