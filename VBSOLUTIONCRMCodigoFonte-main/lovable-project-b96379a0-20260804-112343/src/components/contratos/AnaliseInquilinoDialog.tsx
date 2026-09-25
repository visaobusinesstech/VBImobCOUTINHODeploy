import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, ShieldCheck, ShieldAlert, ShieldX, AlertTriangle, CheckCircle, XCircle, Brain, User, Home, DollarSign, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import type { Contrato } from "@/hooks/useContratos";

interface AnaliseResult {
  score: number;
  risco: string;
  capacidade_pagamento_pct: number;
  resumo: string;
  recomendacao: string;
  pontos_positivos: string[];
  pontos_negativos: string[];
  analise_detalhada: {
    renda_vs_custo: string;
    garantia: string;
    perfil_profissional: string;
    recomendacoes_extras: string;
  };
}

const parseCurrency = (raw: string): number => {
  const cleaned = raw.replace(/[^\d.,]/g, "");
  if (!cleaned) return 0;
  const normalized = cleaned.replace(/\./g, "").replace(",", ".");
  const num = Number.parseFloat(normalized);
  return Number.isFinite(num) ? num : 0;
};

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const maskCpf = (v: string): string => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
};

const riscoConfig: Record<string, { color: string; bg: string; icon: any; label: string }> = {
  baixo: { color: "text-green-600", bg: "bg-green-500/10 border-green-500/20", icon: ShieldCheck, label: "Risco Baixo" },
  medio: { color: "text-yellow-600", bg: "bg-yellow-500/10 border-yellow-500/20", icon: AlertTriangle, label: "Risco Médio" },
  alto: { color: "text-orange-600", bg: "bg-orange-500/10 border-orange-500/20", icon: ShieldAlert, label: "Risco Alto" },
  critico: { color: "text-red-600", bg: "bg-red-500/10 border-red-500/20", icon: ShieldX, label: "Risco Crítico" },
};

export function AnaliseInquilinoDialog({
  open,
  onOpenChange,
  contrato,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  contrato?: Contrato | null;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnaliseResult | null>(null);

  const [nome, setNome] = useState(contrato?.inquilino || "");
  const [cpf, setCpf] = useState(contrato?.inquilino_cpf || "");
  const [renda, setRenda] = useState("");
  const [profissao, setProfissao] = useState("");
  const [tipoGarantia, setTipoGarantia] = useState(contrato?.tipo_garantia || "fiador");
  const [fiadorNome, setFiadorNome] = useState(contrato?.fiador_nome || "");
  const [fiadorCpf, setFiadorCpf] = useState(contrato?.fiador_cpf || "");
  const [fiadorRenda, setFiadorRenda] = useState("");
  const [fiadorProfissao, setFiadorProfissao] = useState("");
  const [fiadorImovelProprio, setFiadorImovelProprio] = useState(false);
  const [seguradoraNome, setSeguradoraNome] = useState("");
  const [seguradoraApolice, setSeguradoraApolice] = useState("");
  const [caucaoValor, setCaucaoValor] = useState("");

  const valorAluguel = contrato?.valor || 0;
  const valorCondominio = contrato?.valor_condominio || 0;
  const valorIptu = contrato?.valor_iptu || 0;

  const handleAnalise = async () => {
    if (!nome.trim()) {
      toast({ title: "Preencha o nome do inquilino", variant: "destructive" });
      return;
    }
    if (valorAluguel <= 0) {
      toast({ title: "Valor do aluguel inválido", variant: "destructive" });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("analise-inquilino", {
        body: {
          inquilino_nome: nome.trim(),
          inquilino_cpf: cpf,
          inquilino_renda: parseCurrency(renda),
          inquilino_profissao: profissao,
          tipo_garantia: tipoGarantia,
          fiador_nome: fiadorNome,
          fiador_cpf: fiadorCpf,
          fiador_renda: parseCurrency(fiadorRenda),
          fiador_profissao: fiadorProfissao,
          fiador_imovel_proprio: fiadorImovelProprio,
          seguradora_nome: seguradoraNome,
          seguradora_apolice: seguradoraApolice,
          caucao_valor: parseCurrency(caucaoValor),
          valor_aluguel: valorAluguel,
          valor_condominio: valorCondominio,
          valor_iptu: valorIptu,
        },
      });

      if (error) throw error;
      setResult(data as AnaliseResult);

      // Save to database
      const imobiliariaId = user?.id;
      if (imobiliariaId) {
        await supabase.from("analise_inquilino" as any).insert({
          imobiliaria_id: imobiliariaId,
          contrato_id: contrato?.id || null,
          inquilino_nome: nome.trim(),
          inquilino_cpf: cpf,
          inquilino_renda: parseCurrency(renda),
          inquilino_profissao: profissao,
          tipo_garantia: tipoGarantia,
          fiador_nome: fiadorNome,
          fiador_cpf: fiadorCpf,
          fiador_renda: parseCurrency(fiadorRenda),
          fiador_profissao: fiadorProfissao,
          fiador_imovel_proprio: fiadorImovelProprio,
          seguradora_nome: seguradoraNome,
          seguradora_apolice: seguradoraApolice,
          caucao_valor: parseCurrency(caucaoValor),
          valor_aluguel: valorAluguel,
          valor_condominio: valorCondominio,
          valor_iptu: valorIptu,
          score_geral: data.score,
          risco: data.risco,
          capacidade_pagamento_pct: data.capacidade_pagamento_pct,
          analise_detalhada: data.analise_detalhada,
          resumo_ia: data.resumo,
          recomendacao_ia: data.recomendacao,
          pontos_positivos: data.pontos_positivos,
          pontos_negativos: data.pontos_negativos,
          status: "concluida",
        } as any);
      }

      toast({ title: "Análise concluída com sucesso!" });
    } catch (e: any) {
      console.error(e);
      toast({ title: e.message || "Erro ao processar análise", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const scoreColor = (score: number) => {
    if (score >= 800) return "text-green-600";
    if (score >= 600) return "text-yellow-600";
    if (score >= 400) return "text-orange-600";
    return "text-red-600";
  };

  const scoreBarColor = (score: number) => {
    if (score >= 800) return "bg-green-500";
    if (score >= 600) return "bg-yellow-500";
    if (score >= 400) return "bg-orange-500";
    return "bg-red-500";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            Análise de Inquilino com IA
          </DialogTitle>
        </DialogHeader>

        {!result ? (
          <div className="space-y-6">
            {/* Inquilino section */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                <User className="w-4 h-4 text-primary" /> Dados do Inquilino
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Nome *</Label>
                  <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome completo" />
                </div>
                <div>
                  <Label className="text-xs">CPF</Label>
                  <Input value={cpf} onChange={e => setCpf(maskCpf(e.target.value))} placeholder="000.000.000-00" />
                </div>
                <div>
                  <Label className="text-xs">Renda mensal (R$)</Label>
                  <Input value={renda} onChange={e => setRenda(e.target.value)} placeholder="5.000,00" />
                </div>
                <div>
                  <Label className="text-xs">Profissão</Label>
                  <Input value={profissao} onChange={e => setProfissao(e.target.value)} placeholder="Ex: Analista de TI" />
                </div>
              </div>
            </div>

            {/* Valores */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                <DollarSign className="w-4 h-4 text-primary" /> Valores do Imóvel
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-secondary/50">
                  <p className="text-[10px] text-muted-foreground uppercase">Aluguel</p>
                  <p className="text-sm font-bold text-foreground">{formatCurrency(valorAluguel)}</p>
                </div>
                <div className="p-3 rounded-lg bg-secondary/50">
                  <p className="text-[10px] text-muted-foreground uppercase">Condomínio</p>
                  <p className="text-sm font-bold text-foreground">{formatCurrency(valorCondominio)}</p>
                </div>
                <div className="p-3 rounded-lg bg-secondary/50">
                  <p className="text-[10px] text-muted-foreground uppercase">IPTU</p>
                  <p className="text-sm font-bold text-foreground">{formatCurrency(valorIptu)}</p>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                <p className="text-[10px] text-muted-foreground uppercase">Custo Total Mensal</p>
                <p className="text-lg font-bold text-primary">{formatCurrency(valorAluguel + valorCondominio + valorIptu)}</p>
              </div>
            </div>

            {/* Garantia */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                <Shield className="w-4 h-4 text-primary" /> Garantia
              </h3>
              <Select value={tipoGarantia} onValueChange={setTipoGarantia}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fiador">Fiador</SelectItem>
                  <SelectItem value="seguro_fianca">Seguro Fiança</SelectItem>
                  <SelectItem value="caucao">Caução</SelectItem>
                  <SelectItem value="titulo_capitalizacao">Título de Capitalização</SelectItem>
                  <SelectItem value="nenhuma">Sem garantia</SelectItem>
                </SelectContent>
              </Select>

              {tipoGarantia === "fiador" && (
                <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-secondary/30">
                  <div>
                    <Label className="text-xs">Nome do Fiador</Label>
                    <Input value={fiadorNome} onChange={e => setFiadorNome(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">CPF do Fiador</Label>
                    <Input value={fiadorCpf} onChange={e => setFiadorCpf(maskCpf(e.target.value))} />
                  </div>
                  <div>
                    <Label className="text-xs">Renda do Fiador (R$)</Label>
                    <Input value={fiadorRenda} onChange={e => setFiadorRenda(e.target.value)} placeholder="8.000,00" />
                  </div>
                  <div>
                    <Label className="text-xs">Profissão do Fiador</Label>
                    <Input value={fiadorProfissao} onChange={e => setFiadorProfissao(e.target.value)} />
                  </div>
                  <div className="col-span-2 flex items-center gap-2">
                    <Switch checked={fiadorImovelProprio} onCheckedChange={setFiadorImovelProprio} />
                    <Label className="text-xs">Fiador possui imóvel próprio</Label>
                  </div>
                </div>
              )}

              {tipoGarantia === "seguro_fianca" && (
                <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-secondary/30">
                  <div>
                    <Label className="text-xs">Seguradora</Label>
                    <Input value={seguradoraNome} onChange={e => setSeguradoraNome(e.target.value)} placeholder="Porto Seguro, Tokio Marine..." />
                  </div>
                  <div>
                    <Label className="text-xs">Nº Apólice</Label>
                    <Input value={seguradoraApolice} onChange={e => setSeguradoraApolice(e.target.value)} />
                  </div>
                </div>
              )}

              {tipoGarantia === "caucao" && (
                <div className="p-3 rounded-lg bg-secondary/30">
                  <Label className="text-xs">Valor da Caução (R$)</Label>
                  <Input value={caucaoValor} onChange={e => setCaucaoValor(e.target.value)} placeholder="6.000,00" />
                </div>
              )}
            </div>

            <button
              onClick={handleAnalise}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analisando com IA...
                </>
              ) : (
                <>
                  <Brain className="w-4 h-4" />
                  Analisar Inquilino
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Score */}
            <div className="text-center p-6 rounded-xl bg-secondary/30">
              <p className="text-xs text-muted-foreground uppercase mb-1">Score de Crédito</p>
              <p className={`text-5xl font-black ${scoreColor(result.score)}`}>{result.score}</p>
              <div className="w-full mt-3 h-3 rounded-full bg-secondary overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${scoreBarColor(result.score)}`}
                  style={{ width: `${(result.score / 1000) * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>0</span><span>200</span><span>400</span><span>600</span><span>800</span><span>1000</span>
              </div>
            </div>

            {/* Risk badge */}
            {(() => {
              const cfg = riscoConfig[result.risco] || riscoConfig.medio;
              const Icon = cfg.icon;
              return (
                <div className={`flex items-center gap-3 p-4 rounded-xl border ${cfg.bg}`}>
                  <Icon className={`w-8 h-8 ${cfg.color}`} />
                  <div>
                    <p className={`text-sm font-bold ${cfg.color}`}>{cfg.label}</p>
                    <p className="text-xs text-muted-foreground">{result.resumo}</p>
                  </div>
                </div>
              );
            })()}

            {/* Recomendação */}
            <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
              <p className="text-xs text-muted-foreground uppercase mb-1">Recomendação</p>
              <p className="text-sm font-medium text-foreground">{result.recomendacao}</p>
            </div>

            {/* Comprometimento de renda */}
            <div className="p-4 rounded-xl bg-secondary/30">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground">Comprometimento da Renda</p>
                <p className="text-sm font-bold text-foreground">{result.capacidade_pagamento_pct?.toFixed(1)}%</p>
              </div>
              <Progress value={Math.min(result.capacidade_pagamento_pct || 0, 100)} className="h-2" />
              <p className="text-[10px] text-muted-foreground mt-1">
                {(result.capacidade_pagamento_pct || 0) <= 30
                  ? "✅ Dentro do limite recomendado (até 30%)"
                  : (result.capacidade_pagamento_pct || 0) <= 40
                  ? "⚠️ Acima do recomendado (30-40%)"
                  : "❌ Comprometimento excessivo (acima de 40%)"}
              </p>
            </div>

            {/* Pontos */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <p className="text-xs font-semibold text-green-600 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> Pontos Positivos
                </p>
                {(result.pontos_positivos || []).map((p, i) => (
                  <p key={i} className="text-xs text-muted-foreground pl-4">• {p}</p>
                ))}
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-red-600 flex items-center gap-1">
                  <XCircle className="w-3 h-3" /> Pontos Negativos
                </p>
                {(result.pontos_negativos || []).map((p, i) => (
                  <p key={i} className="text-xs text-muted-foreground pl-4">• {p}</p>
                ))}
              </div>
            </div>

            {/* Análise detalhada */}
            {result.analise_detalhada && (
              <div className="space-y-3 p-4 rounded-xl bg-secondary/20">
                <p className="text-xs font-semibold text-foreground uppercase">Análise Detalhada</p>
                {Object.entries(result.analise_detalhada).map(([key, val]) => (
                  <div key={key}>
                    <p className="text-[10px] text-muted-foreground uppercase">
                      {key.replace(/_/g, " ")}
                    </p>
                    <p className="text-xs text-foreground">{val}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setResult(null)}
                className="flex-1 px-4 py-2.5 rounded-lg bg-secondary text-foreground text-sm font-medium hover:bg-secondary/80"
              >
                Nova Análise
              </button>
              <button
                onClick={() => onOpenChange(false)}
                className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
              >
                Fechar
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}