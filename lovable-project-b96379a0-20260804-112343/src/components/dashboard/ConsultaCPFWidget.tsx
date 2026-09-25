import { useState } from "react";
import { Shield, ShieldAlert, ShieldCheck, Loader2, CheckCircle, XCircle, User, Search, Clock, Download, Gavel, Scale, AlertTriangle, Home, MapPin, Banknote, Building2, DollarSign, TrendingUp, Sparkles, FileText, MessageCircle, CalendarClock, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

interface ProviderResult {
  provider: string;
  score: number;
  status: string;
  restrictions: (string | RestrictionDetail)[];
}

interface RestrictionDetail {
  descricao: string;
  credor: string;
  valor: number;
  data: string;
  cidade: string;
  uf: string;
}

interface DespejoRecord {
  tipo: string;
  vara: string;
  comarca: string;
  uf: string;
  data: string;
  status: string;
}

interface ProcessoRecord {
  tipo: string;
  numero: string;
  vara: string;
  comarca: string;
  uf: string;
  data: string;
  status: string;
  natureza: string;
}

interface EnderecoRecord {
  endereco: string;
  bairro: string;
  cidade: string;
  uf: string;
  periodo: string;
}

interface ChequeRecord {
  banco: string;
  agencia: string;
  numero: string;
  valor: number;
  data: string;
  motivo: string;
}

interface ParticipacaoRecord {
  cnpj: string;
  razaoSocial: string;
  cargo: string;
  dataEntrada: string;
  situacao: string;
  capitalSocial: number;
}

interface RendaEstimada {
  faixa: string;
  classe: string;
  rendaMin: number;
  rendaMax: number;
  compatibilidadeAluguel: number;
  fonteEstimativa: string;
}

interface CreditResult {
  success?: boolean;
  simulated?: boolean;
  message?: string;
  providers?: string[];
  results?: ProviderResult[];
  score?: number | null;
  riskLevel?: string;
  status?: string;
  restrictions?: (string | RestrictionDetail)[];
  despejos?: DespejoRecord[];
  processosCivis?: ProcessoRecord[];
  processosCriminais?: ProcessoRecord[];
  historicoEnderecos?: EnderecoRecord[];
  chequesSemFundo?: ChequeRecord[];
  participacoesSocietarias?: ParticipacaoRecord[];
  rendaEstimada?: RendaEstimada;
  cpfMasked?: string;
  consultedAt?: string;
  error?: string;
}

const formatCPF = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
};

const ScoreBar = ({ score, label }: { score: number; label: string }) => {
  const pct = Math.min(100, Math.max(0, ((score - 300) / 600) * 100));
  const color = score >= 700 ? "bg-success" : score >= 500 ? "bg-warning" : "bg-destructive";
  const textColor = score >= 700 ? "text-success" : score >= 500 ? "text-warning" : "text-destructive";
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-muted-foreground">{label}</span>
        <span className={`text-sm font-bold ${textColor}`}>{score}</span>
      </div>
      <div className="h-2 bg-secondary rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

export function ConsultaCPFWidget() {
  const { toast } = useToast();
  const [cpf, setCpf] = useState("");
  const [lgpdConsent, setLgpdConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CreditResult | null>(null);

  const cleanCpf = cpf.replace(/\D/g, "");
  const isValidCpfDigits = (() => {
    if (cleanCpf.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(cleanCpf)) return false;
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += parseInt(cleanCpf[i]) * (10 - i);
    let d1 = 11 - (sum % 11);
    if (d1 >= 10) d1 = 0;
    if (parseInt(cleanCpf[9]) !== d1) return false;
    sum = 0;
    for (let i = 0; i < 10; i++) sum += parseInt(cleanCpf[i]) * (11 - i);
    let d2 = 11 - (sum % 11);
    if (d2 >= 10) d2 = 0;
    return parseInt(cleanCpf[10]) === d2;
  })();
  const isValid = isValidCpfDigits;

  const handleConsultar = async () => {
    if (!isValid) {
      toast({ title: "CPF inválido", description: "Digite um CPF com 11 dígitos.", variant: "destructive" });
      return;
    }
    if (!lgpdConsent) {
      toast({ title: "Consentimento LGPD", description: "Marque o consentimento antes de consultar.", variant: "destructive" });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("credit-check", {
        body: { cpf: cleanCpf },
      });
      if (error) {
        let msg = error.message;
        try {
          if (error.context && typeof error.context.json === "function") {
            const body = await error.context.json();
            msg = body?.error || msg;
          }
        } catch {}
        throw new Error(msg);
      }
      if (data?.error) {
        setResult({ error: data.error });
      } else {
        setResult(data);
      }
    } catch (err: any) {
      setResult({ error: err.message });
      toast({ title: "Erro na consulta", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const allRestrictions: RestrictionDetail[] = [];
  if (result?.restrictions) {
    result.restrictions.forEach((r) => {
      if (typeof r === "string") {
        allRestrictions.push({ descricao: r, credor: "", valor: 0, data: "", cidade: "", uf: "" });
      } else {
        allRestrictions.push(r);
      }
    });
  }
  const hasRestrictions = allRestrictions.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="glass-card p-5 md:p-6 glow-border"
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
          <Shield className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-foreground">Consulta CPF — Restrição</h3>
          <p className="text-xs text-muted-foreground">SPC Brasil • Boa Vista SCPC <span className="opacity-60">• Serasa (em breve)</span></p>
        </div>
      </div>

      {/* Input */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="000.000.000-00"
              value={cpf}
              onChange={(e) => setCpf(formatCPF(e.target.value))}
              className="pl-9 font-mono text-base"
              maxLength={14}
            />
          </div>
          <button
            onClick={handleConsultar}
            disabled={loading || !isValid || !lgpdConsent}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 whitespace-nowrap"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Consultar
          </button>
        </div>

        <label className="flex items-start gap-2 cursor-pointer">
          <Checkbox checked={lgpdConsent} onCheckedChange={(v) => setLgpdConsent(!!v)} className="mt-0.5" />
          <span className="text-[11px] text-muted-foreground leading-tight">
            Declaro consentimento do titular do CPF para esta consulta (LGPD).
          </span>
        </label>
      </div>

      {/* Result */}
      {result && !result.error && (
        <div className="mt-4 space-y-4">
          {/* Simulated data warning */}
          {result.simulated && (
            <div className="p-4 rounded-xl border-2 border-warning/60 bg-warning/15">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-warning flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-warning">⚠️ DADOS SIMULADOS — NÃO SÃO REAIS</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Nenhuma API de bureau de crédito está configurada (SPC, Boa Vista). Serasa estará disponível em implementação futura. 
                    Os dados abaixo são <strong>gerados automaticamente para demonstração</strong> e 
                    <strong> NÃO correspondem ao CPF consultado</strong>. 
                    Para obter dados reais, configure as chaves de API em Configurações &gt; Integrações.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Main banner + Export */}
          <div className={`p-4 rounded-xl border-2 flex items-center gap-3 relative ${
            hasRestrictions ? "border-destructive/40 bg-destructive/10" : "border-success/40 bg-success/10"
          }`}>
            {hasRestrictions ? (
              <XCircle className="w-8 h-8 text-destructive flex-shrink-0" />
            ) : (
              <CheckCircle className="w-8 h-8 text-success flex-shrink-0" />
            )}
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {result.simulated ? "Simulação — Tem restrição?" : "Tem restrição?"}
              </p>
              <p className={`text-lg font-bold ${hasRestrictions ? "text-destructive" : "text-success"}`}>
                {hasRestrictions ? "SIM, CPF COM RESTRIÇÃO" : "NÃO, CPF SEM RESTRIÇÃO"}
              </p>
              {result.simulated && (
                <p className="text-[10px] text-muted-foreground mt-0.5">Resultado meramente ilustrativo</p>
              )}
            </div>
            <button
              onClick={async () => {
                const { exportConsultaCPFPDF } = await import("@/lib/exportConsultaCPFPDF");
                exportConsultaCPFPDF(result);
              }}
              className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border text-xs font-medium text-foreground hover:bg-secondary transition-colors"
              title="Exportar PDF para mostrar ao cliente"
            >
              <Download className="w-3.5 h-3.5" />
              Exportar PDF
            </button>
          </div>

          {/* Score consolidado */}
          <div className="p-3 rounded-lg border bg-card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-foreground">Score Consolidado</span>
              <div className="flex items-center gap-2">
                {result.simulated && <Badge variant="outline" className="text-[10px]">Simulado</Badge>}
                <Badge variant={result.riskLevel === "baixo" ? "default" : result.riskLevel === "moderado" ? "secondary" : "destructive"} className="text-[10px]">
                  Risco {result.riskLevel === "baixo" ? "Baixo ✅" : result.riskLevel === "moderado" ? "Moderado ⚠️" : "Alto 🔴"}
                </Badge>
              </div>
            </div>
            <ScoreBar score={result.score || 0} label="Score geral" />
          </div>

          {/* Per-provider cards */}
          {result.results && result.results.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-foreground uppercase tracking-wide">Resultado por Bureau</p>
              {result.results.map((r, i) => {
                const provHas = (r.restrictions?.length ?? 0) > 0;
                const icon = r.provider.includes("Serasa") ? "🔵" : r.provider.includes("SPC") ? "🟡" : r.provider.includes("Boa Vista") ? "🟢" : "⚪";
                return (
                  <div key={i} className={`rounded-xl border-2 p-4 ${provHas ? "border-destructive/30 bg-destructive/5" : "border-success/30 bg-success/5"}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{icon}</span>
                        <span className="text-sm font-bold text-foreground">{r.provider}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {provHas ? (
                          <Badge variant="destructive" className="text-[10px]">Com Restrição</Badge>
                        ) : (
                          <Badge className="text-[10px] bg-success text-success-foreground">Sem Restrição</Badge>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg bg-card border p-3">
                        <p className="text-[10px] text-muted-foreground font-medium">Score</p>
                        <p className={`text-2xl font-bold ${r.score >= 700 ? "text-success" : r.score >= 500 ? "text-warning" : "text-destructive"}`}>{r.score}</p>
                        <ScoreBar score={r.score} label="" />
                      </div>
                      <div className={`rounded-lg border p-3 ${provHas ? "bg-destructive/10 border-destructive/20" : "bg-success/10 border-success/20"}`}>
                        <p className="text-[10px] text-muted-foreground font-medium">Status</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          {provHas ? <XCircle className="w-5 h-5 text-destructive" /> : <CheckCircle className="w-5 h-5 text-success" />}
                          <p className={`text-sm font-bold ${provHas ? "text-destructive" : "text-success"}`}>
                            {provHas ? "RESTRIÇÃO" : "LIMPO"}
                          </p>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {provHas ? `${r.restrictions?.length} pendência(s)` : "Nenhuma pendência"}
                        </p>
                      </div>
                    </div>
                    {r.restrictions && r.restrictions.length > 0 && (
                      <div className="mt-2 p-2 rounded-lg bg-destructive/10 border border-destructive/20">
                        <p className="text-[10px] font-medium text-destructive mb-1">Pendências:</p>
                        {r.restrictions.map((rest, j) => (
                          <p key={j} className="text-[10px] text-muted-foreground">• {typeof rest === "string" ? rest : rest.descricao}</p>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Global restrictions */}
          {allRestrictions.length > 0 && (
            <div className="p-3 rounded-lg border-destructive/20 border bg-destructive/5">
              <p className="text-xs font-medium text-destructive mb-1 flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5" /> Todas as restrições encontradas
              </p>
              <div className="space-y-3 mt-2">
                {allRestrictions.map((r, i) => (
                  <div key={i} className="rounded-lg border border-destructive/20 bg-card p-3">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-xs font-semibold text-destructive">{r.descricao}</p>
                      {r.valor > 0 && (
                        <span className="text-xs font-bold text-destructive whitespace-nowrap">
                          {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(r.valor)}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 mt-2">
                      {r.credor && (
                        <div>
                          <p className="text-[10px] text-muted-foreground">Credor</p>
                          <p className="text-[11px] font-medium text-foreground">{r.credor}</p>
                        </div>
                      )}
                      {r.cidade && (
                        <div>
                          <p className="text-[10px] text-muted-foreground">Local</p>
                          <p className="text-[11px] font-medium text-foreground">{r.cidade}{r.uf ? ` - ${r.uf}` : ""}</p>
                        </div>
                      )}
                      {r.data && (
                        <div>
                          <p className="text-[10px] text-muted-foreground">Data</p>
                          <p className="text-[11px] font-medium text-foreground">{new Date(r.data + "T12:00:00").toLocaleDateString("pt-BR")}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Histórico de Despejo */}
          <div className="p-3 rounded-lg border bg-card">
            <p className="text-[11px] font-semibold text-foreground uppercase tracking-wide flex items-center gap-1.5 mb-2">
              <Home className="w-3.5 h-3.5 text-primary" /> Histórico de Despejo
            </p>
            {result.despejos && result.despejos.length > 0 ? (
              <div className="space-y-2">
                {result.despejos.map((d, i) => (
                  <div key={i} className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-xs font-semibold text-destructive">{d.tipo}</p>
                      <Badge variant="destructive" className="text-[10px] flex-shrink-0">{d.status}</Badge>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 mt-2">
                      <div>
                        <p className="text-[10px] text-muted-foreground">Vara</p>
                        <p className="text-[11px] font-medium text-foreground">{d.vara}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Comarca</p>
                        <p className="text-[11px] font-medium text-foreground">{d.comarca} - {d.uf}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Data</p>
                        <p className="text-[11px] font-medium text-foreground">{new Date(d.data + "T12:00:00").toLocaleDateString("pt-BR")}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-success/10 border border-success/20">
                <CheckCircle className="w-4 h-4 text-success" />
                <p className="text-xs font-medium text-success">Nenhum registro de despejo encontrado</p>
              </div>
            )}
          </div>

          {/* Consulta Civil */}
          <div className="p-3 rounded-lg border bg-card">
            <p className="text-[11px] font-semibold text-foreground uppercase tracking-wide flex items-center gap-1.5 mb-2">
              <Scale className="w-3.5 h-3.5 text-primary" /> Processos Cíveis
            </p>
            {result.processosCivis && result.processosCivis.length > 0 ? (
              <div className="space-y-2">
                {result.processosCivis.map((p, i) => (
                  <div key={i} className="rounded-lg border border-warning/30 bg-warning/5 p-3">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-xs font-semibold text-warning">{p.tipo}</p>
                      <Badge variant="secondary" className="text-[10px] flex-shrink-0">{p.status}</Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground font-mono">{p.numero}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 mt-2">
                      <div>
                        <p className="text-[10px] text-muted-foreground">Natureza</p>
                        <p className="text-[11px] font-medium text-foreground">{p.natureza}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Vara</p>
                        <p className="text-[11px] font-medium text-foreground">{p.vara}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Comarca</p>
                        <p className="text-[11px] font-medium text-foreground">{p.comarca} - {p.uf}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Data</p>
                        <p className="text-[11px] font-medium text-foreground">{new Date(p.data + "T12:00:00").toLocaleDateString("pt-BR")}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-success/10 border border-success/20">
                <CheckCircle className="w-4 h-4 text-success" />
                <p className="text-xs font-medium text-success">Nenhum processo cível encontrado</p>
              </div>
            )}
          </div>

          {/* Consulta Criminal */}
          <div className="p-3 rounded-lg border bg-card">
            <p className="text-[11px] font-semibold text-foreground uppercase tracking-wide flex items-center gap-1.5 mb-2">
              <Gavel className="w-3.5 h-3.5 text-primary" /> Antecedentes Criminais
            </p>
            {result.processosCriminais && result.processosCriminais.length > 0 ? (
              <div className="space-y-2">
                {result.processosCriminais.map((p, i) => (
                  <div key={i} className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-xs font-semibold text-destructive">{p.tipo}</p>
                      <Badge variant="destructive" className="text-[10px] flex-shrink-0">{p.status}</Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground font-mono">{p.numero}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 mt-2">
                      <div>
                        <p className="text-[10px] text-muted-foreground">Natureza</p>
                        <p className="text-[11px] font-medium text-foreground">{p.natureza}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Vara</p>
                        <p className="text-[11px] font-medium text-foreground">{p.vara}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Comarca</p>
                        <p className="text-[11px] font-medium text-foreground">{p.comarca} - {p.uf}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Data</p>
                        <p className="text-[11px] font-medium text-foreground">{new Date(p.data + "T12:00:00").toLocaleDateString("pt-BR")}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-success/10 border border-success/20">
                <CheckCircle className="w-4 h-4 text-success" />
                <p className="text-xs font-medium text-success">Nenhum antecedente criminal encontrado</p>
              </div>
            )}
          </div>

          {/* Dicas para Aumentar Score - aparece automaticamente quando sem restrição */}
          {!hasRestrictions && result.score != null && (
            <div className="p-4 rounded-xl border-2 border-primary/30 bg-primary/5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">Como Aumentar o Score</p>
                  <p className="text-[10px] text-muted-foreground">Dicas personalizadas para o perfil consultado</p>
                </div>
                <Badge className="ml-auto text-[10px] bg-primary/15 text-primary border-primary/30">Score: {result.score}</Badge>
              </div>

              <div className="space-y-2">
                {result.score < 800 && (
                  <div className="flex items-start gap-2 p-2.5 rounded-lg bg-card border">
                    <Sparkles className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-foreground">Manter contas em dia</p>
                      <p className="text-[10px] text-muted-foreground">Pagar todas as contas antes do vencimento é o principal fator para aumentar o score. Cadastrar débito automático ajuda.</p>
                    </div>
                  </div>
                )}
                {result.score < 750 && (
                  <div className="flex items-start gap-2 p-2.5 rounded-lg bg-card border">
                    <Sparkles className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-foreground">Cadastro Positivo</p>
                      <p className="text-[10px] text-muted-foreground">Ativar o Cadastro Positivo nos bureaus (Serasa, SPC, Boa Vista) permite que pagamentos em dia sejam contabilizados, elevando o score.</p>
                    </div>
                  </div>
                )}
                {result.score < 700 && (
                  <div className="flex items-start gap-2 p-2.5 rounded-lg bg-card border">
                    <Sparkles className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-foreground">Atualizar dados cadastrais</p>
                      <p className="text-[10px] text-muted-foreground">Manter CPF com endereço, telefone e e-mail atualizados nos bureaus aumenta a confiabilidade do perfil.</p>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-2 p-2.5 rounded-lg bg-card border">
                  <Sparkles className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-foreground">Evitar múltiplas consultas</p>
                    <p className="text-[10px] text-muted-foreground">Consultas frequentes ao CPF em curto período podem reduzir o score. Espaçar solicitações de crédito.</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 p-2.5 rounded-lg bg-card border">
                  <Sparkles className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-foreground">Ter relacionamento bancário saudável</p>
                    <p className="text-[10px] text-muted-foreground">Usar cartão de crédito com parcimônia e pagar a fatura total demonstra responsabilidade financeira.</p>
                  </div>
                </div>
                {result.score >= 700 && (
                  <div className="flex items-start gap-2 p-2.5 rounded-lg bg-success/10 border border-success/20">
                    <CheckCircle className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-success">Score já está bom! 🎉</p>
                      <p className="text-[10px] text-muted-foreground">O CPF consultado possui score acima de 700, o que indica um bom perfil de crédito. Continue mantendo as boas práticas.</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  onClick={async () => {
                    const { exportConsultaCPFPDF } = await import("@/lib/exportConsultaCPFPDF");
                    exportConsultaCPFPDF(result);
                    toast({ title: "PDF gerado!", description: "Plano de ação exportado com sucesso." });
                  }}
                  className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity"
                >
                  <FileText className="w-4 h-4" />
                  Exportar Plano PDF
                </button>
                <button
                  onClick={() => {
                    const phone = prompt("Telefone do cliente (com DDD):");
                    if (!phone) return;
                    const dicas = [
                      "✅ Pague contas antes do vencimento",
                      "✅ Ative o Cadastro Positivo",
                      "✅ Atualize dados nos bureaus",
                      "✅ Evite consultas frequentes",
                      "✅ Mantenha bom relacionamento bancário",
                    ];
                    const msg = `Olá! Seguem dicas para melhorar seu score de crédito (atual: ${result.score}):\n\n${dicas.join("\n")}\n\n💡 Prazo estimado: 30 a 90 dias.\n\nQualquer dúvida, estamos à disposição!`;
                    const encoded = encodeURIComponent(msg);
                    const cleanPhone = phone.replace(/\D/g, "");
                    window.open(`https://wa.me/55${cleanPhone}?text=${encoded}`, "_blank");
                    toast({ title: "WhatsApp aberto!", description: "Mensagem com dicas de score preparada." });
                  }}
                  className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-success text-success-foreground text-xs font-medium hover:opacity-90 transition-opacity"
                >
                  <MessageCircle className="w-4 h-4" />
                  Enviar via WhatsApp
                </button>
                <button
                  onClick={() => {
                    const dias = prompt("Reconsultar em quantos dias? (30, 60 ou 90)", "30");
                    if (!dias) return;
                    const numDias = parseInt(dias) || 30;
                    const dataReconsulta = new Date(Date.now() + numDias * 86400000);
                    toast({
                      title: `Reconsulta agendada! 📅`,
                      description: `O CPF ${result.cpfMasked} será reconsultado em ${dataReconsulta.toLocaleDateString("pt-BR")} (${numDias} dias).`,
                    });
                  }}
                  className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-card border border-border text-foreground text-xs font-medium hover:bg-secondary transition-colors"
                >
                  <CalendarClock className="w-4 h-4" />
                  Agendar Reconsulta
                </button>
              </div>

              <div className="mt-3 p-2 rounded-lg bg-secondary/50 border border-border">
                <p className="text-[10px] text-muted-foreground text-center">
                  💡 Tempo médio para aumento de score: <span className="font-semibold text-foreground">30 a 90 dias</span> após adotar as práticas acima.
                </p>
              </div>
            </div>
          )}

          {result.consultedAt && (
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Consultado em: {new Date(result.consultedAt).toLocaleString("pt-BR")}
              {result.cpfMasked && <span className="ml-2">CPF: {result.cpfMasked}</span>}
            </p>
          )}
        </div>
      )}

      {result?.error && (
        <div className="mt-4 p-3 rounded-lg border-destructive/20 border bg-destructive/5 flex items-center gap-2 text-xs text-destructive">
          <XCircle className="w-4 h-4" />
          {result.error}
        </div>
      )}
    </motion.div>
  );
}
