import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentCorretor } from "@/hooks/useCurrentCorretor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Badge } from "@/components/ui/badge";
import { Trophy, Medal, Star, Flame, Target, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface CorretorMeta {
  id: string;
  nome: string;
  leadsAtribuidos: number;
  leadsFechados: number;
  visitas: number;
  contratos: number;
  valorContratos: number;
  pontuacao: number;
}

const PONTOS = { fechamento: 10, contrato: 8, visita: 2, lead: 1 };

export function MetasCorretorWidget() {
  const { user } = useAuth();
  const { corretorId, isBroker, ready } = useCurrentCorretor();
  const [corretores, setCorretores] = useState<{ id: string; nome: string }[]>([]);
  const [leads, setLeads] = useState<{ corretor_id: string | null; estagio: string }[]>([]);
  const [compromissos, setCompromissos] = useState<{ corretor_id: string | null; tipo: string; status: string }[]>([]);
  const [contratos, setContratos] = useState<{ corretor_id: string | null; valor: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!user || !ready) return;
    const fetch = async () => {
      const now = new Date();
      const mesInicio = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      // Corretor comum vê apenas o próprio desempenho.
      let corretoresQ = supabase.from("corretores").select("id, nome").eq("status", "ativo");
      let leadsQ = supabase.from("leads").select("corretor_id, estagio").gte("created_at", mesInicio);
      let compQ = supabase.from("compromissos").select("corretor_id, tipo, status").gte("data_inicio", mesInicio);
      let contQ = supabase.from("contratos").select("corretor_id, valor").gte("created_at", mesInicio);
      if (isBroker && corretorId) {
        corretoresQ = corretoresQ.eq("id", corretorId) as any;
        leadsQ = leadsQ.eq("corretor_id", corretorId) as any;
        compQ = compQ.eq("corretor_id", corretorId) as any;
        contQ = contQ.eq("corretor_id", corretorId) as any;
      }

      const [cRes, lRes, compRes, contRes] = await Promise.all([corretoresQ, leadsQ, compQ, contQ]);

      setCorretores((cRes.data ?? []) as any);
      setLeads((lRes.data ?? []) as any);
      setCompromissos((compRes.data ?? []) as any);
      setContratos((contRes.data ?? []) as any);
      setLoading(false);
    };
    fetch();
  }, [user, ready, isBroker, corretorId]);


  const ranking = useMemo<CorretorMeta[]>(() => {
    return corretores
      .map((c) => {
        const cLeads = leads.filter((l) => l.corretor_id === c.id);
        const leadsFechados = cLeads.filter((l) => l.estagio === "fechado").length;
        const visitas = compromissos.filter(
          (comp) => comp.corretor_id === c.id && comp.tipo === "visita" && comp.status === "concluido"
        ).length;
        const cContratos = contratos.filter((ct) => ct.corretor_id === c.id);
        const valorContratos = cContratos.reduce((s, ct) => s + Number(ct.valor || 0), 0);
        const pontuacao =
          leadsFechados * PONTOS.fechamento +
          cContratos.length * PONTOS.contrato +
          visitas * PONTOS.visita +
          cLeads.length * PONTOS.lead;

        return {
          id: c.id,
          nome: c.nome,
          leadsAtribuidos: cLeads.length,
          leadsFechados,
          visitas,
          contratos: cContratos.length,
          valorContratos,
          pontuacao,
        };
      })
      .sort((a, b) => b.pontuacao - a.pontuacao);
  }, [corretores, leads, compromissos, contratos]);

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

  if (loading || ranking.length === 0) return null;

  const getRankIcon = (i: number) => {
    if (i === 0) return <Trophy className="w-5 h-5 text-yellow-500" />;
    if (i === 1) return <Medal className="w-5 h-5 text-gray-400" />;
    if (i === 2) return <Medal className="w-5 h-5 text-amber-700" />;
    return <Star className="w-4 h-4 text-muted-foreground" />;
  };

  const getRankBg = (i: number) => {
    if (i === 0) return "bg-yellow-500/5 border-yellow-500/20";
    if (i === 1) return "bg-gray-400/5 border-gray-400/20";
    if (i === 2) return "bg-amber-700/5 border-amber-700/20";
    return "bg-secondary/50 border-border";
  };

  const maxPontuacao = Math.max(...ranking.map((r) => r.pontuacao), 1);
  const visible = expanded ? ranking : ranking.slice(0, 3);

  return (
    <Card className="glass-card glow-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Flame className="h-5 w-5 text-orange-500" />
            Ranking de Corretores
            <Badge variant="outline" className="text-[10px] ml-1">Este mês</Badge>
          </CardTitle>
          <Target className="w-4 h-4 text-muted-foreground" />
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          Gamificação: Fechamento={PONTOS.fechamento}pt • Contrato={PONTOS.contrato}pt • Visita={PONTOS.visita}pt • Lead={PONTOS.lead}pt
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        <AnimatePresence>
          {visible.map((corretor, i) => {
            const progressPct = Math.max((corretor.pontuacao / maxPontuacao) * 100, 5);
            return (
              <motion.div
                key={corretor.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ delay: i * 0.08 }}
                className={`p-3 rounded-xl border transition-all ${getRankBg(i)}`}
              >
                <div className="flex items-center gap-3">
                  {getRankIcon(i)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-foreground truncate">{corretor.nome}</span>
                      <span className="text-sm font-bold text-primary">{corretor.pontuacao}pts</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="text-[10px] text-muted-foreground">
                        📋 {corretor.leadsAtribuidos} leads
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        ✅ {corretor.leadsFechados} fechados
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        🏠 {corretor.visitas} visitas
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        📝 {corretor.contratos} contratos
                      </span>
                      {corretor.valorContratos > 0 && (
                        <span className="text-[10px] font-medium text-primary">
                          {formatCurrency(corretor.valorContratos)}
                        </span>
                      )}
                    </div>
                    <div className="relative h-2 rounded-full bg-secondary/50 mt-2 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPct}%` }}
                        transition={{ duration: 0.8, delay: 0.2 + i * 0.1 }}
                        className="absolute inset-y-0 left-0 rounded-full"
                        style={{
                          background:
                            i === 0
                              ? "linear-gradient(90deg, hsl(45, 93%, 47%), hsl(38, 92%, 50%))"
                              : i === 1
                              ? "linear-gradient(90deg, hsl(0, 0%, 65%), hsl(0, 0%, 55%))"
                              : "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--primary)))",
                        }}
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {ranking.length > 3 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-center gap-1 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {expanded ? "Ver menos" : `Ver todos (${ranking.length})`}
          </button>
        )}
      </CardContent>
    </Card>
  );
}
