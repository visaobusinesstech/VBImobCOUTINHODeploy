import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Target, Plus, Edit, Trash2, Check, X, Trophy, TrendingUp, DollarSign, Users, FileText, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from "recharts";

interface Meta {
  id: string;
  tipo: string;
  meta_valor: number;
}

const TIPOS_META = [
  { id: "leads_mes", label: "Leads / Mês", icon: Users, unit: "", color: "hsl(199, 89%, 48%)" },
  { id: "receita_mes", label: "Receita / Mês", icon: DollarSign, unit: "R$", color: "hsl(142, 71%, 45%)" },
  { id: "contratos_mes", label: "Contratos / Mês", icon: FileText, unit: "", color: "hsl(262, 83%, 58%)" },
  { id: "conversao", label: "Taxa Conversão %", icon: TrendingUp, unit: "%", color: "hsl(38, 92%, 50%)" },
];

const formatValue = (tipo: string, value: number) => {
  if (tipo === "receita_mes") {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);
  }
  if (tipo === "conversao") return `${value}%`;
  return String(value);
};

const formatCompactValue = (tipo: string, value: number) => {
  if (tipo === "receita_mes") {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
    return `R$${value}`;
  }
  if (tipo === "conversao") return `${value}%`;
  return String(value);
};

interface MetasWidgetProps {
  currentLeads: number;
  currentReceita: number;
  currentContratos: number;
  currentConversao: number;
}

function RadialGauge({ pct, color, size = 90 }: { pct: number; color: string; size?: number }) {
  const data = [{ value: Math.min(pct, 100), fill: color }];
  return (
    <ResponsiveContainer width={size} height={size}>
      <RadialBarChart
        cx="50%"
        cy="50%"
        innerRadius="70%"
        outerRadius="100%"
        barSize={8}
        data={data}
        startAngle={90}
        endAngle={-270}
      >
        <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
        <RadialBar
          background={{ fill: "hsl(var(--secondary))" }}
          dataKey="value"
          angleAxisId={0}
          cornerRadius={10}
        />
      </RadialBarChart>
    </ResponsiveContainer>
  );
}

export function MetasWidget({ currentLeads, currentReceita, currentContratos, currentConversao }: MetasWidgetProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [metas, setMetas] = useState<Meta[]>([]);
  const [editing, setEditing] = useState(false);
  const [newTipo, setNewTipo] = useState("leads_mes");
  const [newValor, setNewValor] = useState("");
  const [adding, setAdding] = useState(false);

  const fetchMetas = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("metas_dashboard")
      .select("id, tipo, meta_valor")
      .eq("ativo", true)
      .order("created_at");
    setMetas((data as any) ?? []);
  }, [user]);

  useEffect(() => { fetchMetas(); }, [fetchMetas]);

  const getCurrentValue = (tipo: string) => {
    switch (tipo) {
      case "leads_mes": return currentLeads;
      case "receita_mes": return currentReceita;
      case "contratos_mes": return currentContratos;
      case "conversao": return currentConversao;
      default: return 0;
    }
  };

  const handleAdd = async () => {
    const val = parseFloat(newValor);
    if (!val || val <= 0) return;
    const { error } = await supabase.from("metas_dashboard").insert({
      imobiliaria_id: user!.id,
      tipo: newTipo,
      meta_valor: val,
    } as any);
    if (error) {
      toast({ title: "Erro ao criar meta", variant: "destructive" });
    } else {
      toast({ title: "Meta criada! 🎯" });
      setNewValor("");
      setAdding(false);
      fetchMetas();
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from("metas_dashboard").delete().eq("id", id);
    fetchMetas();
  };

  if (metas.length === 0 && !adding) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.37 }}>
        <button
          onClick={() => setAdding(true)}
          className="w-full flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-border hover:border-primary/40 transition-colors text-muted-foreground hover:text-primary"
        >
          <Target className="w-5 h-5" />
          <span className="text-sm font-medium">Definir Metas do Mês</span>
          <Plus className="w-4 h-4" />
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.37 }} className="glass-card p-5 md:p-6 glow-border">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Target className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">Metas do Mês</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {metas.filter(m => getCurrentValue(m.tipo) >= m.meta_valor).length}/{metas.length} atingidas
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setEditing(!editing)}
            className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            title={editing ? "Concluir" : "Editar metas"}
          >
            {editing ? <Check className="w-4 h-4" /> : <Edit className="w-4 h-4" />}
          </button>
          {!adding && (
            <button
              onClick={() => setAdding(true)}
              className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              title="Adicionar meta"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <AnimatePresence>
          {metas.map((meta, idx) => {
            const tipoConfig = TIPOS_META.find(t => t.id === meta.tipo);
            const Icon = tipoConfig?.icon || Target;
            const color = tipoConfig?.color || "hsl(var(--primary))";
            const current = getCurrentValue(meta.tipo);
            const pct = meta.meta_valor > 0 ? Math.min(Math.round((current / meta.meta_valor) * 100), 100) : 0;
            const atingiu = pct >= 100;
            const quaseAtingiu = pct >= 80 && pct < 100;

            return (
              <motion.div
                key={meta.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: idx * 0.05 }}
                className={`relative flex flex-col items-center p-4 rounded-xl border transition-all ${
                  atingiu ? "bg-primary/5 border-primary/30" :
                  quaseAtingiu ? "bg-amber-500/5 border-amber-500/30" :
                  "bg-secondary/30 border-border"
                }`}
              >
                {editing && (
                  <button
                    onClick={() => handleDelete(meta.id)}
                    className="absolute top-2 right-2 p-1 rounded hover:bg-destructive/10 text-destructive z-10"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}

                <div className="relative">
                  <RadialGauge pct={pct} color={color} />
                  <div className="absolute inset-0 flex items-center justify-center flex-col">
                    <span className={`text-lg font-bold ${atingiu ? "text-primary" : quaseAtingiu ? "text-amber-500" : "text-foreground"}`}>
                      {pct}%
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 mt-1">
                  <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-foreground">{tipoConfig?.label || meta.tipo}</span>
                </div>

                <div className="flex items-center gap-1 mt-1">
                  <span className={`text-sm font-bold ${atingiu ? "text-primary" : "text-foreground"}`}>
                    {formatCompactValue(meta.tipo, current)}
                  </span>
                  <span className="text-[10px] text-muted-foreground">/ {formatCompactValue(meta.tipo, meta.meta_valor)}</span>
                </div>

                {atingiu && (
                  <div className="flex items-center gap-1 mt-1">
                    <Trophy className="w-3 h-3 text-amber-500" />
                    <span className="text-[10px] font-semibold text-primary">Atingida! 🎉</span>
                  </div>
                )}
                {quaseAtingiu && (
                  <span className="text-[10px] font-medium text-amber-500 mt-1">
                    ⚡ Faltam {formatCompactValue(meta.tipo, meta.meta_valor - current)}
                  </span>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {adding && (
        <div className="p-3 rounded-xl bg-secondary/50 border border-border space-y-2 mt-4">
          <div className="flex gap-2">
            <select
              value={newTipo}
              onChange={e => setNewTipo(e.target.value)}
              className="flex-1 h-8 rounded-md bg-background border border-border text-xs text-foreground px-2 focus:outline-none focus:ring-1 focus:ring-primary/30"
            >
              {TIPOS_META.map(t => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
            <input
              type="number"
              value={newValor}
              onChange={e => setNewValor(e.target.value)}
              placeholder="Valor da meta"
              className="w-28 h-8 rounded-md bg-background border border-border text-xs text-foreground px-2 focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
          </div>
          <div className="flex justify-end gap-1">
            <button
              onClick={() => { setAdding(false); setNewValor(""); }}
              className="px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:bg-secondary transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleAdd}
              disabled={!newValor || parseFloat(newValor) <= 0}
              className="px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40"
            >
              Salvar Meta
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
