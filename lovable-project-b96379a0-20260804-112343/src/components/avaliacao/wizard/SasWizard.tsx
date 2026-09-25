import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft, ChevronRight, Save, FileDown, Trash2,
  Building2, Search, Sliders, BarChart3, Loader2, Sparkles,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useImobiliariaConfig } from "@/hooks/useImobiliariaConfig";
import { supabase } from "@/integrations/supabase/client";
import { Step1Imovel } from "./Step1Imovel";
import { Step2Comparaveis } from "./Step2Comparaveis";
import { Step3Homogeneizacao } from "./Step3Homogeneizacao";
import { Step4Resultado } from "./Step4Resultado";
import { emptyWizardState, type WizardState } from "./types";
import type { ResultadoAvaliacao, FatoresHomogeneizacao } from "@/lib/avaliacao/engine";
import { exportLaudoWizardPDF } from "@/lib/avaliacao/exportLaudoWizardPDF";

const DRAFT_KEY = "sas-wizard-v1";

const STEPS = [
  { id: 1, label: "Imóvel", icon: Building2 },
  { id: 2, label: "Mercado", icon: Search },
  { id: 3, label: "Homogeneização", icon: Sliders },
  { id: 4, label: "Resultado", icon: BarChart3 },
];

interface Props {
  initial?: Partial<WizardState>;
}

export function SasWizard({ initial }: Props) {
  const { toast } = useToast();
  const { imobiliariaId, user } = useAuth();
  const imobConfig = useImobiliariaConfig();

  const [step, setStep] = useState(1);
  const [exportando, setExportando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const [state, setState] = useState<WizardState>(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) return { ...emptyWizardState(), ...JSON.parse(raw), ...(initial || {}) };
    } catch { /* ignore */ }
    return { ...emptyWizardState(), ...(initial || {}) };
  });

  // Autosave
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(state));
        setSavedAt(new Date());
      } catch { /* ignore */ }
    }, 600);
    return () => clearTimeout(t);
  }, [state]);

  const progress = useMemo(() => {
    let done = 0;
    if (state.imovel.tipo && state.imovel.bairro && state.imovel.cidade && state.imovel.area_construida) done += 25;
    if (state.comparaveis.length >= 1) done += 25;
    if (state.comparaveis.length >= 3) done += 15;
    if (state.resultado && state.resultado.amostraValida > 0) done += 20;
    if (state.iaAnalise) done += 15;
    return Math.min(100, done);
  }, [state]);

  const update = <K extends keyof WizardState>(key: K, patch: any) => {
    setState((p) => ({ ...p, [key]: { ...(p[key] as any), ...patch } }));
  };

  const setImovel = (patch: Partial<WizardState["imovel"]>) => update("imovel", patch);
  const setComparaveis = (next: WizardState["comparaveis"]) => setState((p) => ({ ...p, comparaveis: next }));
  const setFatores = (next: Record<string, FatoresHomogeneizacao>) => setState((p) => ({ ...p, fatores: next }));
  const setResultado = (r: ResultadoAvaliacao) => setState((p) => (p.resultado === r ? p : { ...p, resultado: r }));
  const setIA = (ia: NonNullable<WizardState["iaAnalise"]>) => setState((p) => ({ ...p, iaAnalise: ia }));

  const podeAvancar = useMemo(() => {
    if (step === 1) {
      const i = state.imovel;
      return Boolean(i.tipo && i.bairro && i.cidade && Number(i.area_construida) > 0);
    }
    if (step === 2) return state.comparaveis.length >= 1;
    return true;
  }, [step, state]);

  const limpar = () => {
    if (!confirm("Limpar todos os dados do wizard? Esta ação não pode ser desfeita.")) return;
    localStorage.removeItem(DRAFT_KEY);
    setState(emptyWizardState());
    setStep(1);
  };

  const salvarHistorico = async () => {
    if (!imobiliariaId || !state.resultado) {
      toast({ title: "Calcule o resultado", description: "Avance até a etapa 4.", variant: "destructive" });
      return;
    }
    setSalvando(true);
    try {
      const area = Number(state.imovel.area_construida) || 0;
      const { error } = await supabase.from("avaliacoes_historico").insert({
        imobiliaria_id: imobiliariaId,
        titulo: `${state.imovel.tipo} — ${state.imovel.bairro || state.imovel.cidade}`,
        tipo: state.imovel.tipo,
        bairro: state.imovel.bairro || null,
        cidade: state.imovel.cidade || null,
        area,
        valor_ideal: state.resultado.valorFinal.sugerido,
        valor_minimo: state.resultado.valorFinal.minimo,
        valor_maximo: state.resultado.valorFinal.maximo,
        preco_m2_estimado: state.resultado.precoM2.mediana || state.resultado.precoM2.media,
        dados_completos: state as any,
      } as any);
      if (error) throw error;
      toast({ title: "Avaliação salva", description: "Disponível no histórico." });
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e?.message, variant: "destructive" });
    } finally {
      setSalvando(false);
    }
  };

  const exportar = async () => {
    if (!state.resultado) {
      toast({ title: "Calcule o resultado primeiro", variant: "destructive" });
      return;
    }
    setExportando(true);
    try {
      await exportLaudoWizardPDF({
        state,
        imobiliaria: {
          nome: imobConfig.nome_empresa || "Avaliação Profissional",
          creci: imobConfig.creci || "",
          telefone: imobConfig.telefone || "",
          email: imobConfig.email || "",
          cnpj: imobConfig.cnpj || "",
          logo_url: imobConfig.logo_url || null,
        },
        usuario: { nome: (user?.user_metadata as any)?.nome || user?.email || "Avaliador", email: user?.email || "" },
      });
      toast({ title: "Laudo gerado", description: "PDF profissional baixado." });
    } catch (e: any) {
      toast({ title: "Erro ao gerar PDF", description: e?.message, variant: "destructive" });
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Stepper */}
      <Card className="bg-card border-border">
        <CardContent className="pt-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-1 md:gap-2 flex-wrap">
              {STEPS.map((s, i) => {
                const active = step === s.id;
                const done = step > s.id;
                const Icon = s.icon;
                return (
                  <button
                    key={s.id}
                    onClick={() => setStep(s.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs transition-all border ${
                      active
                        ? "bg-primary text-primary-foreground border-primary"
                        : done
                        ? "bg-primary/10 text-primary border-primary/30"
                        : "bg-muted/40 text-muted-foreground border-transparent hover:bg-muted"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span className="font-medium">{i + 1}. {s.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {savedAt && (
                <Badge variant="outline" className="gap-1">
                  <Save className="w-3 h-3" /> Salvo {savedAt.toLocaleTimeString("pt-BR")}
                </Badge>
              )}
              <Button variant="ghost" size="sm" onClick={limpar} className="gap-1 text-destructive">
                <Trash2 className="w-3.5 h-3.5" /> Limpar
              </Button>
            </div>
          </div>
          <Progress value={progress} className="h-2" />
        </CardContent>
      </Card>

      {/* Conteúdo */}
      <Card className="bg-card border-border">
        <CardContent className="pt-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {step === 1 && <Step1Imovel data={state.imovel} onChange={setImovel} />}
              {step === 2 && <Step2Comparaveis comparaveis={state.comparaveis} onChange={setComparaveis} />}
              {step === 3 && <Step3Homogeneizacao comparaveis={state.comparaveis} fatores={state.fatores} onChange={setFatores} />}
              {step === 4 && <Step4Resultado state={state} onResult={setResultado} onIA={setIA} />}
            </motion.div>
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* Navegação */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="outline" onClick={() => setStep(Math.max(1, step - 1))} disabled={step === 1} className="gap-2">
          <ChevronLeft className="w-4 h-4" /> Voltar
        </Button>

        <div className="flex flex-wrap gap-2">
          {step === 4 && (
            <>
              <Button onClick={salvarHistorico} variant="outline" disabled={salvando} className="gap-2">
                {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar no histórico
              </Button>
              <Button onClick={exportar} disabled={exportando} className="gap-2">
                {exportando ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                Gerar laudo PDF
              </Button>
            </>
          )}
          {step < 4 && (
            <Button onClick={() => setStep(step + 1)} disabled={!podeAvancar} className="gap-2">
              Avançar <ChevronRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
