import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useMemo } from "react";
import { useTabPersistence } from "@/hooks/useTabPersistence";
import { useCaptacoes, type Captacao } from "@/hooks/useCaptacoes";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, Pencil, Loader2, Building2, HardHat, UserCheck, DoorOpen, Brain, Sparkles, Crosshair, Radar, Home, BarChart3, UserPlus, TrendingUp, Clock, CheckCircle2, Target, Flame } from "lucide-react";
import { ProprietariosQuentesPanel } from "@/components/captacao/ProprietariosQuentesPanel";
import { FiltroIAProprietariosPanel } from "@/components/captacao/FiltroIAProprietariosPanel";
import { AlertasCaptacaoPanel } from "@/components/captacao/AlertasCaptacaoPanel";
import { ExplicabilidadeScorePanel } from "@/components/captacao/ExplicabilidadeScorePanel";
import { RelatorioPerformancePanel } from "@/components/captacao/RelatorioPerformancePanel";
import { CalibracaoFiltroIAPanel } from "@/components/captacao/CalibracaoFiltroIAPanel";
import { CalibracaoStatusHistoricoPanel } from "@/components/captacao/CalibracaoStatusHistoricoPanel";

import { FlaskConical } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { CaptacaoInteligenteTab } from "@/components/captacao/CaptacaoInteligenteTab";
import { HistoricoExecucoesCaptacao } from "@/components/captacao/HistoricoExecucoesCaptacao";
import { ProprietarioDiretoTab } from "@/components/captacao/ProprietarioDiretoTab";
import { ListaProprietariosDialog } from "@/components/captacao/ListaProprietariosDialog";
import ColetaCandidatosPanel from "@/components/captacao/ColetaCandidatosPanel";
import AprovacaoLGPDPanel from "@/components/captacao/AprovacaoLGPDPanel";
import { ListChecks, ShieldCheck } from "lucide-react";
import { useDialogPersistence } from "@/hooks/useDialogPersistence";
import { useToast } from "@/hooks/use-toast";
import { QCaptureTab } from "@/components/captacao/QCaptureTab";
import { VacanciaBSBPanel } from "@/components/inteligencia/VacanciaBSBPanel";
import { useImoveis } from "@/hooks/useImoveis";
import { PortalScraperPanel } from "@/components/qcapture/PortalScraperPanel";
import { useAuth } from "@/contexts/AuthContext";
import {
  extractIndicadoPor,
  stripIndicadoPor,
  buildObservacoes,
  isCaptacaoSubmittable,
  computeCaptacaoKpis,
} from "@/lib/captacaoIndicacao";

const TIPOS = [
  { id: "porteiro", label: "Porteiro", icon: DoorOpen },
  { id: "construtor", label: "Construtor", icon: HardHat },
  { id: "construtora", label: "Construtora", icon: Building2 },
  { id: "sindico", label: "Síndico", icon: UserCheck },
  { id: "indicacao", label: "Indicação", icon: UserPlus },
] as const;

const STATUS_OPTIONS = [
  { id: "pendente", label: "Pendente", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
  { id: "em_andamento", label: "Em andamento", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  { id: "concluida", label: "Concluída", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  { id: "cancelada", label: "Cancelada", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
];

function CaptacaoFormDialog({
  open, onOpenChange, tipo, onSave, editItem, saving, construtoras,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tipo: string;
  onSave: (data: Partial<Captacao>) => void;
  editItem: Captacao | null;
  saving: boolean;
  construtoras: string[];
}) {
  const [nome, setNome] = useState(editItem?.nome_contato || "");
  const [telefone, setTelefone] = useState(editItem?.telefone_contato || "");
  const [email, setEmail] = useState(editItem?.email_contato || "");
  const [endereco, setEndereco] = useState(editItem?.endereco_imovel || "");
  const [bairro, setBairro] = useState(editItem?.bairro || "");
  const [cidade, setCidade] = useState(editItem?.cidade || "");
  const [cep, setCep] = useState("");
  const [tipoImovel, setTipoImovel] = useState(editItem?.tipo_imovel || "Apartamento");
  const [operacao, setOperacao] = useState(editItem?.operacao || "Venda");
  const [construtora, setConstrutora] = useState(editItem?.nome_construtora || "");
  const [condominio, setCondominio] = useState(editItem?.nome_condominio || "");
  const [obs, setObs] = useState(() => stripIndicadoPor(editItem?.observacoes));
  const [indicadoPor, setIndicadoPor] = useState(() => extractIndicadoPor(editItem?.observacoes) || "");
  const [status, setStatus] = useState(editItem?.status || "pendente");
  const [construtoraSearch, setConstrutoraSearch] = useState("");
  const [aceitaCorretor, setAceitaCorretor] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);

  const buscarCep = async (cepVal: string) => {
    const clean = cepVal.replace(/\D/g, "");
    if (clean.length !== 8) return;
    setBuscandoCep(true);
    try {
      const resp = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const data = await resp.json();
      if (!data.erro) {
        setEndereco(data.logradouro || "");
        setBairro(data.bairro || "");
        setCidade(data.localidade || "");
      }
    } catch { /* silent */ } finally { setBuscandoCep(false); }
  };
  
  const filteredConstrutoras = construtoras.filter(c =>
    c.toLowerCase().includes(construtoraSearch.toLowerCase())
  );

  const handleSubmit = () => {
    if (!isCaptacaoSubmittable({ tipo, nome, indicadoPor })) return;
    const obsFinal = buildObservacoes(tipo, indicadoPor, obs);
    onSave({
      tipo,
      nome_contato: nome.trim(),
      telefone_contato: telefone || null,
      email_contato: email || null,
      endereco_imovel: endereco || null,
      bairro: bairro || null,
      cidade: cidade || null,
      tipo_imovel: tipoImovel,
      operacao,
      nome_construtora: construtora || null,
      nome_condominio: condominio || null,
      observacoes: obsFinal || null,
      status,
    });
  };

  const tipoLabel = TIPOS.find(t => t.id === tipo)?.label || tipo;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editItem ? "Editar" : "Nova"} Captação via {tipoLabel}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Nome do {tipoLabel} *</Label>
              <Input value={nome} onChange={e => setNome(e.target.value)} placeholder={`Nome do ${tipoLabel.toLowerCase()}`} />
            </div>
            {tipo === "construtora" && (
              <div className="col-span-2">
                <div className="flex items-center gap-2 p-2 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                  <input
                    type="checkbox"
                    id="aceita-corretor"
                    checked={aceitaCorretor}
                    onChange={e => setAceitaCorretor(e.target.checked)}
                    className="rounded"
                  />
                  <Label htmlFor="aceita-corretor" className="text-xs cursor-pointer">
                    ✅ Aceita qualquer corretor/imobiliária para vender ou alugar
                  </Label>
                </div>
              </div>
            )}
            <div>
              <Label>Telefone</Label>
              <Input value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(00) 00000-0000" />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="email@exemplo.com" />
            </div>
          </div>

          {(tipo === "construtora" || tipo === "construtor") && (
            <div>
              <Label>Nome da Construtora</Label>
              <Input
                value={construtora}
                onChange={e => { setConstrutora(e.target.value); setConstrutoraSearch(e.target.value); }}
                placeholder="Buscar ou digitar nome da construtora..."
                list="construtoras-list"
              />
              {construtoraSearch && filteredConstrutoras.length > 0 && (
                <datalist id="construtoras-list">
                  {filteredConstrutoras.map(c => <option key={c} value={c} />)}
                </datalist>
              )}
            </div>
          )}

          {tipo === "sindico" && (
            <div className="space-y-3">
              <div>
                <Label>Nome do Condomínio</Label>
                <Input value={condominio} onChange={e => setCondominio(e.target.value)} placeholder="Nome do condomínio" />
              </div>
            </div>
          )}

          {tipo === "indicacao" && (
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-2">
              <Label className="text-primary font-semibold">Indicado por *</Label>
              <Input
                value={indicadoPor}
                onChange={e => setIndicadoPor(e.target.value)}
                placeholder="Nome de quem indicou (cliente, parceiro, corretor...)"
              />
              <p className="text-[11px] text-muted-foreground">
                Registramos a fonte da indicação para você reconhecer e recompensar quem traz negócios.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 grid grid-cols-3 gap-3">
              <div className="col-span-1">
                <Label>CEP</Label>
                <div className="relative">
                  <Input
                    value={cep}
                    onChange={e => {
                      setCep(e.target.value);
                      if (e.target.value.replace(/\D/g, "").length === 8) buscarCep(e.target.value);
                    }}
                    placeholder="70000-000"
                    maxLength={9}
                  />
                  {buscandoCep && <Loader2 className="w-4 h-4 animate-spin absolute right-3 top-3 text-muted-foreground" />}
                </div>
              </div>
              <div className="col-span-2">
                <Label>Endereço do Imóvel</Label>
                <Input value={endereco} onChange={e => setEndereco(e.target.value)} placeholder="Endereço" />
              </div>
            </div>
            <div>
              <Label>Bairro</Label>
              <Input value={bairro} onChange={e => setBairro(e.target.value)} placeholder="Bairro" />
            </div>
            <div>
              <Label>Cidade</Label>
              <Input value={cidade} onChange={e => setCidade(e.target.value)} placeholder="Cidade" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Tipo</Label>
              <Select value={tipoImovel} onValueChange={setTipoImovel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Apartamento", "Casa", "Terreno", "Comercial", "Cobertura", "Kitnet", "Galpão", "Sala Comercial", "Loja", "Flat", "Sobrado", "Chácara", "Fazenda", "Ponto Comercial", "Prédio", "Conjunto de Salas"].map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Operação</Label>
              <Select value={operacao} onValueChange={setOperacao}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Venda">Venda</SelectItem>
                  <SelectItem value="Locação">Locação</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Observações</Label>
            <Textarea value={obs} onChange={e => setObs(e.target.value)} placeholder="Informações adicionais..." rows={3} />
          </div>

          <Button onClick={handleSubmit} disabled={saving || !isCaptacaoSubmittable({ tipo, nome, indicadoPor })} className="w-full">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {editItem ? "Salvar Alterações" : "Registrar Captação"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type MatchType = "exact" | "partial" | "fallback";

type SugestaoIA = {
  nome_contato: string;
  endereco: string;
  bairro: string;
  tipo_imovel: string;
  operacao: string;
  motivo: string;
  acao_recomendada: string;
  score: number;
  link_anuncio?: string;
  portal_origem?: string;
  match_type?: MatchType | string | null;
  similarity?: number | null;
  source?: "allowlist" | "open_search" | string | null;
};

const MATCH_TYPE_ORDER: Record<string, number> = { exact: 0, partial: 1, fallback: 2 };

function normalizeMatchType(value: SugestaoIA["match_type"]): MatchType {
  const v = (value ?? "").toString().toLowerCase();
  if (v === "partial" || v === "match_parcial" || v === "parcial") return "partial";
  if (v === "fallback") return "fallback";
  return "exact";
}

function normalizeSimilarity(value: SugestaoIA["similarity"]): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  return value > 1 ? value / 100 : value;
}

function sortSugestoesByMatch(list: SugestaoIA[]): SugestaoIA[] {
  return [...list].sort((a, b) => {
    const ra = MATCH_TYPE_ORDER[normalizeMatchType(a.match_type)] ?? 99;
    const rb = MATCH_TYPE_ORDER[normalizeMatchType(b.match_type)] ?? 99;
    if (ra !== rb) return ra - rb;
    const sa = normalizeSimilarity(a.similarity);
    const sb = normalizeSimilarity(b.similarity);
    if (sb !== sa) return sb - sa;
    return (b.score ?? 0) - (a.score ?? 0);
  });
}

function CaptacaoTab({ tipo, captacoes, loading, onCreate, onUpdate, onDelete, construtoras }: {
  tipo: string;
  captacoes: Captacao[];
  loading: boolean;
  onCreate: (data: Partial<Captacao>) => Promise<void>;
  onUpdate: (id: string, data: Partial<Captacao>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  construtoras: string[];
}) {
  const [deleteItem, setDeleteItem] = useState<Captacao | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingIA, setLoadingIA] = useState(false);
  const [sugestoes, setSugestoes] = useState<SugestaoIA[]>([]);
  const [showSugestoes, setShowSugestoes] = useState(false);
  const [dicaCanal, setDicaCanal] = useState<string | null>(null);
  const [matchFilter, setMatchFilter] = useState<"all" | "exact" | "partial" | "fallback" | "none">("all");

  const matchCounts = useMemo(() => {
    const c = { all: sugestoes.length, exact: 0, partial: 0, fallback: 0, none: 0 };
    for (const s of sugestoes) {
      if (s.match_type == null || s.match_type === "") { c.none++; continue; }
      const mt = normalizeMatchType(s.match_type);
      c[mt]++;
    }
    return c;
  }, [sugestoes]);

  const sugestoesVisiveis = useMemo(() => {
    if (matchFilter === "all") return sugestoes;
    if (matchFilter === "none") return sugestoes.filter(s => s.match_type == null || s.match_type === "");
    return sugestoes.filter(s => s.match_type != null && s.match_type !== "" && normalizeMatchType(s.match_type) === matchFilter);
  }, [sugestoes, matchFilter]);
  const { toast } = useToast();

  const filtered = captacoes.filter(c => c.tipo === tipo);
  const tipoLabel = TIPOS.find(t => t.id === tipo)?.label || tipo;
  const dialog = useDialogPersistence<Captacao>({
    storageKey: `captacao_dialog_state_${tipo}`,
    items: filtered,
    getId: (item) => item.id,
  });

  const handleSave = async (data: Partial<Captacao>) => {
    setSaving(true);
    try {
      if (dialog.selectedItem) {
        await onUpdate(dialog.selectedItem.id, data);
      } else {
        await onCreate(data);
      }
      dialog.handleOpenChange(false);
    } catch {
      // Toast exibido pelo hook
    } finally {
      setSaving(false);
    }
  };

  const gerarSugestoesIA = async () => {
    setLoadingIA(true);
    try {
      const { data, error } = await supabase.functions.invoke("captacao-inteligente", {
        body: {
          action: "sugestoes_canal",
          params: {
            canal: tipo,
            cidade: "Brasília",
            estado: "DF",
            captacoes_existentes: filtered.length,
          },
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.success) {
        setSugestoes(sortSugestoesByMatch(data.data.sugestoes ?? []));
        setDicaCanal(data.data.dica_canal || null);
        setShowSugestoes(true);
        toast({ title: "Sugestões geradas!", description: `${data.data.sugestoes.length} sugestões via ${tipoLabel}` });
      }
    } catch (e: any) {
      toast({ title: "Erro ao gerar sugestões", description: e.message, variant: "destructive" });
    } finally {
      setLoadingIA(false);
    }
  };

  const captarSugestao = async (s: SugestaoIA) => {
    try {
      await onCreate({
        tipo,
        nome_contato: s.nome_contato,
        endereco_imovel: s.endereco,
        bairro: s.bairro,
        cidade: "Brasília",
        estado: "DF",
        tipo_imovel: s.tipo_imovel,
        operacao: s.operacao,
        observacoes: `🤖 Sugerido por IA\nScore: ${s.score}/100\nMotivo: ${s.motivo}\nAção: ${s.acao_recomendada}${s.link_anuncio ? `\n🔗 Anúncio: ${s.link_anuncio}` : ""}${s.portal_origem ? `\n🌐 Portal: ${s.portal_origem}` : ""}`,
        status: "pendente",
      });
    } catch {
      // Toast exibido pelo hook
    }
  };

  return (
    <div className="space-y-4">
      {/* AI Suggestions Panel */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm font-semibold">IA Avançada — {tipoLabel}</p>
                <p className="text-xs text-muted-foreground">Gere sugestões automáticas de captação via {tipoLabel.toLowerCase()}</p>
              </div>
            </div>
            <Button size="sm" onClick={gerarSugestoesIA} disabled={loadingIA} variant="outline" className="border-primary/30">
              {loadingIA ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Gerando...</>
              ) : (
                <><Sparkles className="w-4 h-4 mr-1" /> Gerar Sugestões com IA</>
              )}
            </Button>
          </div>

          <AnimatePresence>
            {showSugestoes && sugestoes.length > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                {dicaCanal && (
                  <div className="mt-4 p-3 rounded-lg bg-accent/50 border border-accent">
                    <p className="text-xs font-semibold text-accent-foreground flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-primary" />
                      Dica Estratégica — {tipoLabel}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{dicaCanal}</p>
                  </div>
                )}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {([
                    { key: "all", label: "Todos" },
                    { key: "exact", label: "Exact" },
                    { key: "partial", label: "Partial" },
                    { key: "fallback", label: "Fallback" },
                    { key: "none", label: "Sem match" },
                  ] as const).map(f => {
                    const active = matchFilter === f.key;
                    const count = matchCounts[f.key];
                    const disabled = count === 0 && f.key !== "all";
                    return (
                      <button
                        key={f.key}
                        type="button"
                        onClick={() => !disabled && setMatchFilter(f.key)}
                        disabled={disabled}
                        className={`h-7 px-2.5 rounded-full text-[11px] font-medium border transition-colors ${
                          active
                            ? "bg-primary text-primary-foreground border-primary"
                            : disabled
                              ? "bg-muted/40 text-muted-foreground/50 border-transparent cursor-not-allowed"
                              : "bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                        }`}
                      >
                        {f.label} <span className={`ml-1 tabular-nums ${active ? "opacity-90" : "opacity-70"}`}>({count})</span>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 space-y-2 max-h-[400px] overflow-y-auto pr-1">
                  {sugestoesVisiveis.length === 0 ? (
                    <div className="p-6 text-center text-xs text-muted-foreground border border-dashed border-border rounded-lg">
                      Nenhuma sugestão neste filtro. Volte para <strong>Todos</strong> para ver as {sugestoes.length} sugestões.
                    </div>
                  ) : sugestoesVisiveis.map((s, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center gap-3 p-3 rounded-lg bg-background border border-border hover:border-primary/30 transition-colors"
                    >
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                        {s.score}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{s.nome_contato}</p>
                        <p className="text-xs text-muted-foreground truncate">{s.endereco} — {s.bairro}</p>
                        <p className="text-xs text-muted-foreground italic mt-0.5">💡 {s.motivo}</p>
                        {s.link_anuncio && (
                          <a
                            href={s.link_anuncio}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-primary hover:underline truncate block mt-0.5"
                            title={s.link_anuncio}
                          >
                            🔗 Anúncio de referência {s.portal_origem ? `(${s.portal_origem})` : ""}
                          </a>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="secondary" className="text-[10px]">{s.tipo_imovel}</Badge>
                        {(() => {
                          const src = (s.source ?? "").toString().toLowerCase();
                          if (src === "allowlist") {
                            return (
                              <Badge
                                variant="outline"
                                className="text-[10px] border-emerald-400 text-emerald-700 bg-emerald-50"
                                title={`Portal do allowlist${s.portal_origem ? `: ${s.portal_origem}` : ""} — busca com filtro site:`}
                              >
                                Allowlist{s.portal_origem ? ` · ${s.portal_origem}` : ""}
                              </Badge>
                            );
                          }
                          if (src === "open_search") {
                            return (
                              <Badge
                                variant="outline"
                                className="text-[10px] border-sky-400 text-sky-700 bg-sky-50"
                                title={`Encontrado em busca aberta (sem site:)${s.portal_origem ? ` — portal: ${s.portal_origem}` : ""}`}
                              >
                                Busca aberta{s.portal_origem ? ` · ${s.portal_origem}` : ""}
                              </Badge>
                            );
                          }
                          return null;
                        })()}
                        {(() => {
                          const mt = normalizeMatchType(s.match_type);
                          const sim = normalizeSimilarity(s.similarity);
                          const simLabel = sim > 0 ? ` · ${Math.round(sim * 100)}%` : "";
                          if (mt === "partial") {
                            return (
                              <Badge
                                variant="outline"
                                className="text-[10px] border-amber-400 text-amber-700 bg-amber-50"
                                title={`Correspondência parcial${simLabel ? ` (similaridade ${simLabel.replace(" · ", "")})` : ""}`}
                              >
                                Match parcial{simLabel}
                              </Badge>
                            );
                          }
                          if (mt === "fallback") {
                            return (
                              <Badge
                                variant="outline"
                                className="text-[10px] border-slate-300 text-slate-600 bg-slate-50"
                                title={`Fallback${simLabel ? ` (similaridade ${simLabel.replace(" · ", "")})` : ""}`}
                              >
                                Fallback{simLabel}
                              </Badge>
                            );
                          }
                          return null;
                        })()}
                        <Button size="sm" className="h-7 text-xs" onClick={() => captarSugestao(s)}>
                          <Plus className="w-3 h-3 mr-1" /> Captar
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </div>
                <Button variant="ghost" size="sm" className="mt-2 w-full text-xs" onClick={() => setShowSugestoes(false)}>
                  Fechar sugestões
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{filtered.length} captações via {tipoLabel.toLowerCase()}</p>
        <Button size="sm" onClick={dialog.openCreate}>
          <Plus className="w-4 h-4 mr-1" /> Nova Captação
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>Nenhuma captação via {tipoLabel.toLowerCase()} registrada.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={dialog.openCreate}>
            <Plus className="w-4 h-4 mr-1" /> Registrar primeira captação
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Telefone</TableHead>
                {(tipo === "construtora" || tipo === "construtor") && <TableHead>Construtora</TableHead>}
                {tipo === "sindico" && <TableHead>Condomínio</TableHead>}
                {tipo === "indicacao" && <TableHead>Indicado por</TableHead>}
                <TableHead>Endereço</TableHead>
                <TableHead>Bairro</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(c => {
                const statusObj = STATUS_OPTIONS.find(s => s.id === c.status);
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.nome_contato}</TableCell>
                    <TableCell>{c.telefone_contato || "—"}</TableCell>
                    {(tipo === "construtora" || tipo === "construtor") && <TableCell>{c.nome_construtora || "—"}</TableCell>}
                    {tipo === "sindico" && <TableCell>{c.nome_condominio || "—"}</TableCell>}
                    {tipo === "indicacao" && (
                      <TableCell className="text-xs">
                        {extractIndicadoPor(c.observacoes) || "—"}
                      </TableCell>
                    )}
                    <TableCell className="max-w-[200px] truncate">{c.endereco_imovel || "—"}</TableCell>
                    <TableCell>{c.bairro || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={statusObj?.color || ""}>
                        {statusObj?.label || c.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(c.created_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => dialog.openEdit(c)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteItem(c)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <CaptacaoFormDialog
        key={`${tipo}-${dialog.selectedItem?.id ?? "novo"}-${dialog.open ? "aberto" : "fechado"}`}
        open={dialog.open}
        onOpenChange={dialog.handleOpenChange}
        tipo={tipo}
        onSave={handleSave}
        editItem={dialog.selectedItem}
        saving={saving}
        construtoras={construtoras}
      />

      <AlertDialog open={!!deleteItem} onOpenChange={() => setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir captação?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              if (!deleteItem) return;
              try {
                await onDelete(deleteItem.id);
                setDeleteItem(null);
              } catch {
                // Toast exibido pelo hook
              }
            }}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function Captacao() {
  const { captacoes, loading, createCaptacao, updateCaptacao, deleteCaptacao, construtoras } = useCaptacoes();
  const { imoveis } = useImoveis();
  const { user, isMaster, loading: authLoading } = useAuth();
  const canSeeAlude = isMaster || (user?.email?.toLowerCase().includes("victor") ?? false);
  const [activeTab, setActiveTab] = useTabPersistence("captacao_active_tab", "ia_inteligente");
  const [listaDialogOpen, setListaDialogOpen] = useState(false);

  const counts = TIPOS.reduce((acc, t) => {
    acc[t.id] = captacoes.filter(c => c.tipo === t.id).length;
    return acc;
  }, {} as Record<string, number>);

  // Rankings de captação por canal (tipo) separados por operação
  const buildRanking = (operacao: string) => {
    const map = new Map<string, number>();
    captacoes.filter(c => c.operacao === operacao).forEach(c => {
      const canal = TIPOS.find(t => t.id === c.tipo)?.label || c.tipo;
      map.set(canal, (map.get(canal) || 0) + 1);
    });
    return Array.from(map.entries()).map(([canal, count]) => ({ canal, count })).sort((a, b) => b.count - a.count);
  };

  const rankingVenda = buildRanking("Venda");
  const rankingAluguel = buildRanking("Aluguel");

  const renderRanking = (data: { canal: string; count: number }[], title: string) => {
    if (data.length === 0) return null;
    const maxCount = Math.max(...data.map(d => d.count), 1);
    return (
      <div className="glass-card p-4">
        <h4 className="text-sm font-semibold text-foreground mb-3">{title}</h4>
        <div className="space-y-2">
          {data.slice(0, 8).map((item, i) => (
            <div key={item.canal} className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}.</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs text-foreground truncate">{item.canal}</span>
                  <span className="text-xs font-bold text-primary">{item.count}</span>
                </div>
                <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(item.count / maxCount) * 100}%` }}
                    transition={{ delay: i * 0.05 + 0.2 }}
                    className="h-full bg-primary rounded-full"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">Captação de Imóveis</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{captacoes.length} captações registradas</p>
        </div>
        {!authLoading && isMaster && (
          <Button
            onClick={() => setListaDialogOpen(true)}
            className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground shadow-lg shadow-primary/20 gap-2"
            size="lg"
          >
            <ListChecks className="w-5 h-5" />
            Lista de Proprietários (Venda / Aluguel)
            <Badge variant="secondary" className="ml-1 bg-primary-foreground/20 text-primary-foreground border-0">IA</Badge>
          </Button>
        )}
      </div>

      <ListaProprietariosDialog open={listaDialogOpen} onOpenChange={setListaDialogOpen} />

      {/* KPIs gerais */}
      {captacoes.length > 0 && (() => {
        const { total, pendentes, andamento, concluidas, taxa } = computeCaptacaoKpis(captacoes);
        const kpis = [
          { label: "Total", value: total, icon: Target, color: "text-foreground", bg: "bg-secondary" },
          { label: "Pendentes", value: pendentes, icon: Clock, color: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-50 dark:bg-yellow-900/20" },
          { label: "Em andamento", value: andamento, icon: TrendingUp, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-900/20" },
          { label: "Concluídas", value: concluidas, icon: CheckCircle2, color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-900/20" },
          { label: "Conversão", value: `${taxa}%`, icon: BarChart3, color: "text-primary", bg: "bg-primary/10" },
        ];
        return (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            {kpis.map((k, i) => (
              <motion.div
                key={k.label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`glass-card p-3 flex items-center gap-3 ${k.bg}`}
              >
                <div className={`p-2 rounded-lg bg-background/60 ${k.color}`}>
                  <k.icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] text-muted-foreground uppercase tracking-wide">{k.label}</div>
                  <div className={`text-lg font-bold leading-tight ${k.color}`}>{k.value}</div>
                </div>
              </motion.div>
            ))}
          </div>
        );
      })()}

      {/* Rankings de Captação */}
      {captacoes.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {renderRanking(rankingVenda, "🏆 Ranking Captação - Venda")}
          {renderRanking(rankingAluguel, "🏆 Ranking Captação - Aluguel")}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="quentes" className="flex items-center gap-1.5 text-orange-600">
            <Flame className="w-4 h-4" />
            🔥 Proprietários Quentes
          </TabsTrigger>
          <TabsTrigger value="ia_filtra" className="flex items-center gap-1.5 text-primary">
            <Brain className="w-4 h-4" />
            🧠 IA Filtra
          </TabsTrigger>
          <TabsTrigger value="alertas" className="flex items-center gap-1.5 text-orange-600">
            <Flame className="w-4 h-4" />
            🚨 Alertas
          </TabsTrigger>
          <TabsTrigger value="explicabilidade" className="flex items-center gap-1.5 text-primary">
            <BarChart3 className="w-4 h-4" />
            🔍 Explicabilidade
          </TabsTrigger>
          <TabsTrigger value="calibracao_ia" className="flex items-center gap-1.5 text-primary">
            <FlaskConical className="w-4 h-4" />
            🧪 Calibração IA
          </TabsTrigger>
          <TabsTrigger value="ia_inteligente" className="flex items-center gap-1.5 text-primary">
            <Brain className="w-4 h-4" />
            IA Inteligente
          </TabsTrigger>
          <TabsTrigger value="proprietario_direto" className="flex items-center gap-1.5">
            <Crosshair className="w-4 h-4" />
            Direto com Proprietário
          </TabsTrigger>
          <TabsTrigger value="coleta_candidatos" className="flex items-center gap-1.5 text-primary">
            <UserPlus className="w-4 h-4" />
            Coleta LGPD
          </TabsTrigger>
          <TabsTrigger value="aprovacao_lgpd" className="flex items-center gap-1.5 text-primary">
            <ShieldCheck className="w-4 h-4" />
            Aprovação LGPD
          </TabsTrigger>
          <TabsTrigger value="qcapture" className="flex items-center gap-1.5">
            <Radar className="w-4 h-4" />
            Q-Capture
          </TabsTrigger>
          {canSeeAlude && (
            <TabsTrigger value="alude" className="flex items-center gap-1.5 text-primary">
              <Home className="w-4 h-4" />
              Alude
            </TabsTrigger>
          )}
          <TabsTrigger value="imovel_proprietario" className="flex items-center gap-1.5 text-primary">
            <Home className="w-4 h-4" />
            Imóvel do Proprietário
          </TabsTrigger>
          <TabsTrigger value="vacancia_bsb" className="flex items-center gap-1.5 text-info">
            <Home className="w-4 h-4" />
            Vacância BSB
          </TabsTrigger>
          <TabsTrigger value="relatorio" className="flex items-center gap-1.5 text-primary">
            <BarChart3 className="w-4 h-4" />
            Relatório
          </TabsTrigger>
          <TabsTrigger value="historico_execucoes" className="flex items-center gap-1.5 text-primary">
            <Clock className="w-4 h-4" />
            Histórico
          </TabsTrigger>
          {TIPOS.map(t => (
            <TabsTrigger key={t.id} value={t.id} className="flex items-center gap-1.5">
              <t.icon className="w-4 h-4" />
              {t.label}
              {counts[t.id] > 0 && (
                <span className="ml-1 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-bold">
                  {counts[t.id]}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="quentes">
          <ProprietariosQuentesPanel />
        </TabsContent>

        <TabsContent value="ia_filtra">
          <FiltroIAProprietariosPanel />
        </TabsContent>

        <TabsContent value="explicabilidade">
          <ExplicabilidadeScorePanel />
        </TabsContent>

        <TabsContent value="calibracao_ia" className="space-y-4">
          <CalibracaoStatusHistoricoPanel />
          <CalibracaoFiltroIAPanel />
        </TabsContent>


        <TabsContent value="alertas">
          <AlertasCaptacaoPanel />
        </TabsContent>

        <TabsContent value="ia_inteligente">
          <CaptacaoInteligenteTab onConvertToCaptacao={createCaptacao} />
        </TabsContent>


        <TabsContent value="proprietario_direto">
          <ProprietarioDiretoTab />
        </TabsContent>

        <TabsContent value="qcapture">
          <QCaptureTab />
        </TabsContent>

        <TabsContent value="coleta_candidatos">
          <ColetaCandidatosPanel />
        </TabsContent>

        <TabsContent value="aprovacao_lgpd">
          <AprovacaoLGPDPanel />
        </TabsContent>


        {canSeeAlude && (
          <TabsContent value="alude">
            <PortalScraperPanel
              presetPortal="alude"
              title="Plataforma Alude"
              description="Busca dedicada na plataforma Alude para captação direta com proprietários."
            />
          </TabsContent>
        )}

        <TabsContent value="imovel_proprietario">
          <PortalScraperPanel
            presetPortal="imovel_proprietario"
            title="Imóvel do Proprietário"
            description="Busca dedicada por anúncios diretos de proprietários (sem intermediação de imobiliária)."
          />
        </TabsContent>

        <TabsContent value="vacancia_bsb">
          <VacanciaBSBPanel imoveis={imoveis} />
        </TabsContent>

        <TabsContent value="relatorio">
          <RelatorioPerformancePanel />
        </TabsContent>

        <TabsContent value="historico_execucoes">
          <HistoricoExecucoesCaptacao />
        </TabsContent>


        {TIPOS.map(t => (
          <TabsContent key={t.id} value={t.id}>
            <CaptacaoTab
              tipo={t.id}
              captacoes={captacoes}
              loading={loading}
              onCreate={createCaptacao}
              onUpdate={updateCaptacao}
              onDelete={deleteCaptacao}
              construtoras={construtoras}
            />
          </TabsContent>
        ))}
      </Tabs>
    </DashboardLayout>
  );
}
