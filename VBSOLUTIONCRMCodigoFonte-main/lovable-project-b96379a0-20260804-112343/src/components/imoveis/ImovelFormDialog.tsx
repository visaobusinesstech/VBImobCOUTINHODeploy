import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Upload, X, Loader2, FileText, Video, File, Sparkles, ChevronLeft, ChevronRight, Save, GripVertical, Building, Home, Landmark, Store, Mountain, Layers, Star } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Imovel } from "@/hooks/useImoveis";
import { useDraft } from "@/hooks/useDraft";
import { StepperCadastro } from "./StepperCadastro";
import { CardPreviewImovel } from "./CardPreviewImovel";

interface ImovelFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imovel?: Imovel | null;
  onSave: (data: Record<string, any>, newPhotos: File[], newDocs?: { matricula: File[]; iptu: File[]; outros: File[]; videos: File[] }) => Promise<boolean>;
  saving: boolean;
}

const tiposImovel = [
  { value: "Apartamento", icon: Building },
  { value: "Casa", icon: Home },
  { value: "Cobertura", icon: Layers },
  { value: "Studio", icon: Store },
  { value: "Loft", icon: Store },
  { value: "Terreno", icon: Mountain },
  { value: "Sala Comercial", icon: Landmark },
  { value: "Galpão", icon: Store },
];
const operacoes = ["Venda", "Aluguel", "Venda e Aluguel"];
const statusOptions = ["Ativo", "Reservado", "Vendido", "Inativo"];
const posicoesSolares = ["Norte", "Sul", "Leste", "Oeste", "Nascente", "Poente"];

const defaultForm = {
  titulo: "", tipo: "Apartamento", operacao: "Venda", preco: "",
  endereco: "", cidade: "", bairro: "", estado: "DF", cep: "",
  quartos: "0", banheiros: "0", suites: "0", vagas: "0", area: "",
  descricao: "", status: "Ativo", exclusivo: false, destaque: false,
  aceita_permuta: false, aceita_financiamento: false, tem_escritura: false,
  aceita_fgts: false,
  valor_condominio: "", valor_iptu: "", andar: "", posicao_solar: "",
  exclusividade_inicio: "", exclusividade_fim: "", comissao_percentual: "",
  foto_capa_index: 0,
  url_anuncio: "", portal_origem: "",
};

function sanitizeNumberInput(raw: string): string { return raw.replace(/[^\d.,]/g, ""); }

function parseCurrency(value: string): number {
  const cleaned = sanitizeNumberInput(value);
  if (!cleaned) return 0;
  let normalized = cleaned;
  if (cleaned.includes(",")) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (cleaned.includes(".")) {
    const parts = cleaned.split(".");
    const lastPart = parts[parts.length - 1] || "";
    if (parts.length > 1 && lastPart.length <= 2) {
      const decimal = parts.pop() || "0";
      normalized = `${parts.join("") || "0"}.${decimal}`;
    } else {
      normalized = cleaned.replace(/\./g, "");
    }
  }
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrencyDisplay(value: number): string {
  if (!value) return "";
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 80 : -80, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -80 : 80, opacity: 0 }),
};

export function ImovelFormDialog({ open, onOpenChange, imovel, onSave, saving }: ImovelFormDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docMatriculaRef = useRef<HTMLInputElement>(null);
  const docIptuRef = useRef<HTMLInputElement>(null);
  const docOutrosRef = useRef<HTMLInputElement>(null);
  const docVideosRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState(defaultForm);
  const isNew = !imovel;
  const { clearDraft } = useDraft("imovel", form, setForm, { enabled: isNew, open });

  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  const [existingFotos, setExistingFotos] = useState<string[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [cepLoading, setCepLoading] = useState(false);
  const [gerandoDescricao, setGerandoDescricao] = useState(false);

  const [existingMatricula, setExistingMatricula] = useState<string[]>([]);
  const [existingIptu, setExistingIptu] = useState<string[]>([]);
  const [existingOutros, setExistingOutros] = useState<string[]>([]);
  const [existingVideos, setExistingVideos] = useState<string[]>([]);
  const [newMatricula, setNewMatricula] = useState<File[]>([]);
  const [newIptu, setNewIptu] = useState<File[]>([]);
  const [newOutros, setNewOutros] = useState<File[]>([]);
  const [newVideos, setNewVideos] = useState<File[]>([]);

  useEffect(() => {
    if (imovel) {
      setForm({
        titulo: imovel.titulo, tipo: imovel.tipo, operacao: imovel.operacao,
        preco: imovel.preco ? formatCurrencyDisplay(imovel.preco) : "",
        endereco: imovel.endereco ?? "", cidade: imovel.cidade ?? "",
        bairro: imovel.bairro ?? "", estado: imovel.estado ?? "DF",
        cep: imovel.cep ?? "", quartos: String(imovel.quartos),
        banheiros: String(imovel.banheiros), suites: String(imovel.suites),
        vagas: String(imovel.vagas), area: String(imovel.area),
        descricao: imovel.descricao ?? "", status: imovel.status,
        exclusivo: imovel.exclusivo, destaque: imovel.destaque,
        aceita_permuta: imovel.aceita_permuta, aceita_financiamento: imovel.aceita_financiamento,
        tem_escritura: imovel.tem_escritura,
        aceita_fgts: (imovel as any).aceita_fgts ?? false,
        valor_condominio: imovel.valor_condominio ? formatCurrencyDisplay(imovel.valor_condominio) : "",
        valor_iptu: imovel.valor_iptu ? formatCurrencyDisplay(imovel.valor_iptu) : "",
        andar: imovel.andar ?? "", posicao_solar: imovel.posicao_solar ?? "",
        exclusividade_inicio: (imovel as any).exclusividade_inicio ?? "",
        exclusividade_fim: (imovel as any).exclusividade_fim ?? "",
        comissao_percentual: (imovel as any).comissao_percentual ? String((imovel as any).comissao_percentual) : "",
        foto_capa_index: (imovel as any).foto_capa_index ?? 0,
        url_anuncio: (imovel as any).url_anuncio ?? "",
        portal_origem: (imovel as any).portal_origem ?? "",
      });
      setExistingFotos(imovel.fotos ?? []);
      setExistingMatricula((imovel as any).documentos_matricula ?? []);
      setExistingIptu((imovel as any).documentos_iptu ?? []);
      setExistingOutros((imovel as any).documentos_outros ?? []);
      setExistingVideos((imovel as any).videos ?? []);
    }
    setNewFiles([]); setPreviews([]); setNewMatricula([]); setNewIptu([]); setNewOutros([]); setNewVideos([]);
    setCurrentStep(0); setCompletedSteps(new Set()); setDirection(0);
  }, [imovel, open]);

  const set = (key: string, val: any) => setForm((p) => ({ ...p, [key]: val }));

  const handleCurrencyChange = (field: string, rawValue: string) => set(field, sanitizeNumberInput(rawValue));
  const handleCurrencyFocus = (field: string) => {
    const currentValue = String((form as Record<string, unknown>)[field] ?? "");
    if (parseCurrency(currentValue) === 0) set(field, "");
  };
  const handleCurrencyBlur = (field: string) => {
    const currentValue = String((form as Record<string, unknown>)[field] ?? "");
    set(field, formatCurrencyDisplay(parseCurrency(currentValue)));
  };

  // Auto-save simulation
  useEffect(() => {
    if (!open || !isNew) return;
    setAutoSaveStatus("saving");
    const timer = setTimeout(() => setAutoSaveStatus("saved"), 600);
    const resetTimer = setTimeout(() => setAutoSaveStatus("idle"), 3000);
    return () => { clearTimeout(timer); clearTimeout(resetTimer); };
  }, [form, open, isNew]);

  const fetchCep = useCallback(async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, "");
    if (cleanCep.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setForm((p) => ({ ...p, endereco: data.logradouro || p.endereco, bairro: data.bairro || p.bairro, cidade: data.localidade || p.cidade, estado: data.uf || p.estado }));
      }
    } catch { /* ignore */ }
    setCepLoading(false);
  }, []);

  const handleCepChange = (value: string) => {
    let masked = value.replace(/\D/g, "").slice(0, 8);
    if (masked.length > 5) masked = masked.slice(0, 5) + "-" + masked.slice(5);
    set("cep", masked);
    if (masked.replace(/\D/g, "").length === 8) fetchCep(masked);
  };

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files);
    setNewFiles((prev) => [...prev, ...arr]);
    arr.forEach((f) => {
      const reader = new FileReader();
      reader.onload = (e) => setPreviews((p) => [...p, e.target?.result as string]);
      reader.readAsDataURL(f);
    });
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  }, []);

  const removeExisting = (idx: number) => {
    setExistingFotos((p) => p.filter((_, i) => i !== idx));
    // Adjust foto_capa_index when removing an existing photo
    setForm((prev) => {
      const capaIdx = prev.foto_capa_index || 0;
      if (idx === capaIdx) return { ...prev, foto_capa_index: 0 };
      if (idx < capaIdx) return { ...prev, foto_capa_index: capaIdx - 1 };
      return prev;
    });
  };
  const removeNew = (idx: number) => {
    const existingCount = existingFotos.length;
    const absoluteIdx = existingCount + idx;
    setNewFiles((p) => p.filter((_, i) => i !== idx));
    setPreviews((p) => p.filter((_, i) => i !== idx));
    // Adjust foto_capa_index when removing a new photo
    setForm((prev) => {
      const capaIdx = prev.foto_capa_index || 0;
      if (absoluteIdx === capaIdx) return { ...prev, foto_capa_index: 0 };
      if (absoluteIdx < capaIdx) return { ...prev, foto_capa_index: capaIdx - 1 };
      return prev;
    });
  };

  const getFileName = (url: string) => {
    try { return decodeURIComponent(url.split("/").pop() || url).split("?")[0]; }
    catch { return url.split("/").pop() || url; }
  };

  const goToStep = (step: number) => {
    setDirection(step > currentStep ? 1 : -1);
    setCompletedSteps(prev => { const s = new Set(prev); s.add(currentStep); return s; });
    setCurrentStep(step);
  };

  const nextStep = () => { if (currentStep < 4) goToStep(currentStep + 1); };
  const prevStep = () => { if (currentStep > 0) goToStep(currentStep - 1); };

  const handleSubmit = async () => {
    const payload = {
      titulo: form.titulo, tipo: form.tipo, operacao: form.operacao,
      preco: parseCurrency(form.preco),
      endereco: form.endereco || null, cidade: form.cidade || null,
      bairro: form.bairro || null, estado: form.estado || null,
      cep: form.cep?.replace(/\D/g, "") || null,
      quartos: parseInt(form.quartos) || 0, banheiros: parseInt(form.banheiros) || 0,
      suites: parseInt(form.suites) || 0, vagas: parseInt(form.vagas) || 0,
      area: parseFloat(form.area) || 0,
      descricao: form.descricao || null, status: form.status,
      exclusivo: form.exclusivo, destaque: form.destaque,
      aceita_permuta: form.aceita_permuta, aceita_financiamento: form.aceita_financiamento,
      tem_escritura: form.tem_escritura, aceita_fgts: form.aceita_fgts,
      valor_condominio: parseCurrency(form.valor_condominio),
      valor_iptu: parseCurrency(form.valor_iptu),
      andar: form.andar || null, posicao_solar: form.posicao_solar || null,
      exclusividade_inicio: form.exclusividade_inicio || null,
      exclusividade_fim: form.exclusividade_fim || null,
      comissao_percentual: parseFloat(form.comissao_percentual) || 0,
      foto_capa_index: form.foto_capa_index || 0,
      url_anuncio: form.url_anuncio?.trim() || null,
      portal_origem: form.portal_origem?.trim() || null,
      _existingFotos: existingFotos,
      _existingMatricula: existingMatricula,
      _existingIptu: existingIptu,
      _existingOutros: existingOutros,
      _existingVideos: existingVideos,
    };
    const saved = await onSave(payload, newFiles, { matricula: newMatricula, iptu: newIptu, outros: newOutros, videos: newVideos });
    if (saved) {
      clearDraft();
    }
  };

  const gerarDescricao = async () => {
    setGerandoDescricao(true);
    try {
      const { data, error } = await supabase.functions.invoke("gerar-descricao-imovel", {
        body: {
          imovel: {
            titulo: form.titulo, tipo: form.tipo, operacao: form.operacao,
            area: form.area, quartos: form.quartos, suites: form.suites,
            banheiros: form.banheiros, vagas: form.vagas, andar: form.andar,
            posicao_solar: form.posicao_solar, bairro: form.bairro,
            cidade: form.cidade, estado: form.estado,
            valor_condominio: form.valor_condominio, valor_iptu: form.valor_iptu,
            aceita_financiamento: form.aceita_financiamento, aceita_fgts: form.aceita_fgts,
            aceita_permuta: form.aceita_permuta, tem_escritura: form.tem_escritura,
            exclusivo: form.exclusivo,
          },
        },
      });
      if (error) throw error;
      if (data?.descricao) { set("descricao", data.descricao); toast.success("Descrição gerada com sucesso!"); }
      else if (data?.error) toast.error(data.error);
    } catch (err: any) { toast.error(err?.message || "Erro ao gerar descrição"); }
    finally { setGerandoDescricao(false); }
  };

  const inputClass = "mt-1.5 rounded-xl bg-secondary/50 border-border/60 py-3 px-4 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200";
  const labelClass = "text-xs font-medium text-muted-foreground uppercase tracking-wide";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-5xl w-[95vw] max-h-[92vh] overflow-hidden p-0">
        {/* Header */}
        <div className="px-6 pt-5 pb-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-foreground">{imovel ? "Editar Imóvel" : "Novo Imóvel"}</h2>
            {autoSaveStatus !== "idle" && isNew && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-1.5 text-xs text-muted-foreground"
              >
                {autoSaveStatus === "saving" && <Loader2 className="w-3 h-3 animate-spin" />}
                {autoSaveStatus === "saved" && <Save className="w-3 h-3 text-green-500" />}
                <span>{autoSaveStatus === "saving" ? "Salvando..." : "Salvo automaticamente"}</span>
              </motion.div>
            )}
          </div>
          <StepperCadastro currentStep={currentStep} onStepClick={goToStep} completedSteps={completedSteps} />
        </div>

        {/* Content area */}
        <div className="flex flex-col lg:flex-row gap-0 overflow-hidden" style={{ height: "calc(92vh - 160px)" }}>
          {/* Form */}
          <div className="flex-1 overflow-y-auto px-6 pb-6">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={currentStep}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="space-y-5 min-h-0"
              >
                {currentStep === 0 && (
                  <Step1Basico form={form} set={set} inputClass={inputClass} labelClass={labelClass} cepLoading={cepLoading} handleCepChange={handleCepChange} />
                )}
                {currentStep === 1 && (
                  <Step2Detalhes form={form} set={set} inputClass={inputClass} labelClass={labelClass} gerandoDescricao={gerandoDescricao} onGerarDescricao={gerarDescricao} handleCurrencyChange={handleCurrencyChange} handleCurrencyFocus={handleCurrencyFocus} handleCurrencyBlur={handleCurrencyBlur} />
                )}
                {currentStep === 2 && (
                  <Step3Midia form={form} set={set} existingFotos={existingFotos} previews={previews} fileInputRef={fileInputRef} handleFiles={handleFiles} handleDrop={handleDrop} removeExisting={removeExisting} removeNew={removeNew} existingMatricula={existingMatricula} existingIptu={existingIptu} existingOutros={existingOutros} existingVideos={existingVideos} newMatricula={newMatricula} newIptu={newIptu} newOutros={newOutros} newVideos={newVideos} setExistingMatricula={setExistingMatricula} setExistingIptu={setExistingIptu} setExistingOutros={setExistingOutros} setExistingVideos={setExistingVideos} setNewMatricula={setNewMatricula} setNewIptu={setNewIptu} setNewOutros={setNewOutros} setNewVideos={setNewVideos} docMatriculaRef={docMatriculaRef} docIptuRef={docIptuRef} docOutrosRef={docOutrosRef} docVideosRef={docVideosRef} getFileName={getFileName} />
                )}
                {currentStep === 3 && (
                  <Step4Financeiro form={form} set={set} inputClass={inputClass} labelClass={labelClass} handleCurrencyChange={handleCurrencyChange} handleCurrencyFocus={handleCurrencyFocus} handleCurrencyBlur={handleCurrencyBlur} />
                )}
                {currentStep === 4 && (
                  <Step5Publicar form={form} set={set} />
                )}
              </motion.div>
            </AnimatePresence>

            {/* Navigation buttons */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
              <Button type="button" variant="ghost" onClick={currentStep === 0 ? () => onOpenChange(false) : prevStep} className="gap-2">
                <ChevronLeft className="w-4 h-4" />
                {currentStep === 0 ? "Cancelar" : "Voltar"}
              </Button>
              <div className="flex gap-2">
                {currentStep < 4 ? (
                  <Button type="button" onClick={nextStep} className="gap-2 hover:scale-105 transition-transform">
                    Próximo <ChevronRight className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button type="button" onClick={handleSubmit} disabled={saving} className="gap-2 hover:scale-105 transition-transform">
                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                    {imovel ? "Salvar Alterações" : "Publicar Imóvel"}
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Preview sidebar (desktop) */}
          <div className="hidden lg:block w-[300px] border-l border-border bg-secondary/30 p-4 overflow-y-auto flex-shrink-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-3">Preview</p>
            <CardPreviewImovel form={form} previews={previews} existingFotos={existingFotos} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Step 1: Básico ─────
function Step1Basico({ form, set, inputClass, labelClass, cepLoading, handleCepChange }: any) {
  return (
    <div className="space-y-5">
      <div>
        <Label className={labelClass}>Tipo do Imóvel</Label>
        <div className="grid grid-cols-4 gap-2 mt-2">
          {tiposImovel.map(({ value, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => set("tipo", value)}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all duration-200 hover:scale-105 ${
                form.tipo === value ? "border-primary bg-primary/5 text-primary" : "border-border bg-card text-muted-foreground hover:border-primary/30"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{value}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label className={labelClass}>Finalidade</Label>
        <div className="flex gap-2 mt-2">
          {operacoes.map((op) => (
            <button
              key={op}
              type="button"
              onClick={() => set("operacao", op)}
              className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-medium transition-all duration-200 hover:scale-105 ${
                form.operacao === op ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:border-primary/30"
              }`}
            >
              {op}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label className={labelClass}>Título do Imóvel</Label>
        <Input value={form.titulo} onChange={(e) => set("titulo", e.target.value)} placeholder="Ex: Apartamento 3 quartos no Sudoeste" required className={inputClass} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label className={labelClass}>CEP</Label>
          <div className="relative">
            <Input value={form.cep} onChange={(e) => handleCepChange(e.target.value)} placeholder="00000-000" className={inputClass + " pr-8"} />
            {cepLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/4 w-4 h-4 animate-spin text-muted-foreground" />}
          </div>
        </div>
        <div>
          <Label className={labelClass}>Endereço</Label>
          <Input value={form.endereco} onChange={(e) => set("endereco", e.target.value)} className={inputClass} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label className={labelClass}>Bairro</Label>
          <Input value={form.bairro} onChange={(e) => set("bairro", e.target.value)} className={inputClass} />
        </div>
        <div>
          <Label className={labelClass}>Cidade</Label>
          <Input value={form.cidade} onChange={(e) => set("cidade", e.target.value)} className={inputClass} />
        </div>
        <div>
          <Label className={labelClass}>Estado</Label>
          <Input value={form.estado} onChange={(e) => set("estado", e.target.value)} className={inputClass} />
        </div>
      </div>
    </div>
  );
}

// ─── Step 2: Detalhes ─────
function Step2Detalhes({ form, set, inputClass, labelClass, gerandoDescricao, onGerarDescricao, handleCurrencyChange, handleCurrencyFocus, handleCurrencyBlur }: any) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div>
          <Label className={labelClass}>Preço (R$)</Label>
          <Input value={form.preco} inputMode="decimal" onFocus={() => handleCurrencyFocus("preco")} onChange={(e) => handleCurrencyChange("preco", e.target.value)} onBlur={() => handleCurrencyBlur("preco")} placeholder="0,00" required className={inputClass} />
        </div>
        <div>
          <Label className={labelClass}>Área (m²)</Label>
          <Input type="number" value={form.area} onChange={(e) => set("area", e.target.value)} className={inputClass} />
        </div>
        <div>
          <Label className={labelClass}>Andar</Label>
          <Input value={form.andar} onChange={(e) => set("andar", e.target.value)} placeholder="Ex: 12º" className={inputClass} />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { key: "quartos", label: "Quartos" },
          { key: "suites", label: "Suítes" },
          { key: "banheiros", label: "Banheiros" },
          { key: "vagas", label: "Vagas" },
        ].map(({ key, label }) => (
          <div key={key}>
            <Label className={labelClass}>{label}</Label>
            <div className="flex items-center gap-2 mt-1.5">
              <button type="button" onClick={() => set(key, String(Math.max(0, parseInt(form[key]) - 1)))} className="w-9 h-9 rounded-xl border border-border bg-card flex items-center justify-center text-lg font-medium hover:bg-secondary transition-colors">−</button>
              <span className="w-8 text-center font-semibold text-foreground">{form[key]}</span>
              <button type="button" onClick={() => set(key, String(parseInt(form[key]) + 1))} className="w-9 h-9 rounded-xl border border-border bg-card flex items-center justify-center text-lg font-medium hover:bg-secondary transition-colors">+</button>
            </div>
          </div>
        ))}
      </div>

      <div>
        <Label className={labelClass}>Posição Solar</Label>
        <Select value={form.posicao_solar} onValueChange={(v) => set("posicao_solar", v)}>
          <SelectTrigger className={inputClass}><SelectValue placeholder="Selecione" /></SelectTrigger>
          <SelectContent>{posicoesSolares.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <Label className={labelClass}>Descrição</Label>
          <Button type="button" variant="outline" size="sm" disabled={gerandoDescricao} onClick={onGerarDescricao} className="gap-1.5 text-xs rounded-xl hover:scale-105 transition-transform">
            {gerandoDescricao ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {gerandoDescricao ? "Gerando..." : "Gerar com IA"}
          </Button>
        </div>
        <Textarea value={form.descricao} onChange={(e) => set("descricao", e.target.value)} rows={5} className={inputClass + " resize-none"} placeholder="Clique em 'Gerar com IA' para criar uma descrição persuasiva..." />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 pt-2">
        {[
          { key: "exclusivo", label: "Exclusivo" },
          { key: "destaque", label: "Destaque" },
          { key: "aceita_permuta", label: "Aceita Permuta" },
          { key: "aceita_financiamento", label: "Financiamento" },
          { key: "aceita_fgts", label: "Aceita FGTS" },
          { key: "tem_escritura", label: "Tem Escritura" },
        ].map(({ key, label }) => (
          <div key={key} className="flex items-center gap-2.5">
            <Switch checked={form[key]} onCheckedChange={(v) => set(key, v)} />
            <Label className="text-sm text-foreground cursor-pointer">{label}</Label>
          </div>
        ))}
      </div>

      {form.exclusivo && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="border border-border rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-primary uppercase tracking-wide">Detalhes da Exclusividade</p>
          <div className="grid grid-cols-3 gap-3">
            <div><Label className={labelClass}>Início</Label><Input type="date" value={form.exclusividade_inicio} onChange={e => set("exclusividade_inicio", e.target.value)} className={inputClass} /></div>
            <div><Label className={labelClass}>Fim</Label><Input type="date" value={form.exclusividade_fim} onChange={e => set("exclusividade_fim", e.target.value)} className={inputClass} /></div>
            <div><Label className={labelClass}>Comissão %</Label><Input type="number" step="0.1" value={form.comissao_percentual} onChange={e => set("comissao_percentual", e.target.value)} placeholder="6.0" className={inputClass} /></div>
          </div>
        </motion.div>
      )}
      <div className="border border-border rounded-xl p-4 space-y-3">
        <p className="text-xs font-semibold text-primary uppercase tracking-wide">Anúncio Online (opcional)</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <Label className={labelClass}>Link do Anúncio (URL)</Label>
            <Input type="url" value={form.url_anuncio} onChange={e => set("url_anuncio", e.target.value)} placeholder="https://www.zapimoveis.com.br/imovel/..." className={inputClass} />
          </div>
          <div>
            <Label className={labelClass}>Portal de Origem</Label>
            <select value={form.portal_origem} onChange={e => set("portal_origem", e.target.value)} className={inputClass}>
              <option value="">Selecione...</option>
              <option value="ZAP Imóveis">ZAP Imóveis</option>
              <option value="VivaReal">VivaReal</option>
              <option value="OLX">OLX</option>
              <option value="Imovelweb">Imovelweb</option>
              <option value="Wimoveis">Wimoveis</option>
              <option value="DF Imóveis">DF Imóveis</option>
              <option value="ImovelP">ImovelP</option>
              <option value="Aluga Mais">Aluga Mais</option>
              <option value="Captei">Captei</option>
              <option value="Site Próprio">Site Próprio</option>
              <option value="Outro">Outro</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Step 3: Mídia ─────
function Step3Midia({ form, set, existingFotos, previews, fileInputRef, handleFiles, handleDrop, removeExisting, removeNew, existingMatricula, existingIptu, existingOutros, existingVideos, newMatricula, newIptu, newOutros, newVideos, setExistingMatricula, setExistingIptu, setExistingOutros, setExistingVideos, setNewMatricula, setNewIptu, setNewOutros, setNewVideos, docMatriculaRef, docIptuRef, docOutrosRef, docVideosRef, getFileName }: any) {
  return (
    <div className="space-y-5">
      <div>
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">Fotos do Imóvel</Label>
        <p className="text-[11px] text-muted-foreground mb-3">Clique em ⭐ para definir a foto de capa</p>

        {/* Drag & drop zone */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="border-2 border-dashed border-border rounded-2xl p-6 text-center hover:border-primary/50 transition-colors cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Arraste fotos aqui ou <span className="text-primary font-medium">clique para selecionar</span></p>
          <p className="text-[10px] text-muted-foreground/60 mt-1">JPG, PNG até 10MB</p>
        </div>
        <input ref={fileInputRef} type="file" multiple accept="image/*" className="hidden" onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />

        {/* Photo grid */}
        {(existingFotos.length > 0 || previews.length > 0) && (
          <div className="flex flex-wrap gap-2.5 mt-4">
            {existingFotos.map((url: string, i: number) => {
              const isCapa = form.foto_capa_index === i;
              return (
                <div key={`e-${i}`} className={`relative w-24 h-24 rounded-xl overflow-hidden border-2 transition-all group ${isCapa ? "border-primary ring-2 ring-primary/30 shadow-lg" : "border-border hover:border-primary/40"}`}>
                  <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
                  {isCapa && <span className="absolute bottom-0 left-0 right-0 bg-primary text-primary-foreground text-[9px] text-center py-0.5 font-semibold">CAPA</span>}
                  <button type="button" onClick={(e) => { e.stopPropagation(); set("foto_capa_index", i); }} title="Definir como capa" className={`absolute top-1 left-1 w-6 h-6 rounded-full flex items-center justify-center transition-all ${isCapa ? "bg-primary text-primary-foreground" : "bg-black/40 text-white/70 hover:text-yellow-400 hover:bg-black/60"}`}>
                    <Star className={`w-3 h-3 ${isCapa ? "fill-current" : ""}`} />
                  </button>
                  <button type="button" onClick={(e) => { e.stopPropagation(); removeExisting(i); }} title="Excluir foto" className="absolute top-1 right-1 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 hover:scale-110 transition-all">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
            {previews.map((src: string, i: number) => {
              const absoluteIdx = existingFotos.length + i;
              const isCapa = form.foto_capa_index === absoluteIdx;
              return (
                <div key={`n-${i}`} className={`relative w-24 h-24 rounded-xl overflow-hidden border-2 transition-all group ${isCapa ? "border-primary ring-2 ring-primary/30 shadow-lg" : "border-primary/30 hover:border-primary/50"}`}>
                  <img src={src} alt="" className="w-full h-full object-cover" />
                  {isCapa && <span className="absolute bottom-0 left-0 right-0 bg-primary text-primary-foreground text-[9px] text-center py-0.5 font-semibold">CAPA</span>}
                  <button type="button" onClick={(e) => { e.stopPropagation(); set("foto_capa_index", absoluteIdx); }} title="Definir como capa" className={`absolute top-1 left-1 w-6 h-6 rounded-full flex items-center justify-center transition-all ${isCapa ? "bg-primary text-primary-foreground" : "bg-black/40 text-white/70 hover:text-yellow-400 hover:bg-black/60"}`}>
                    <Star className={`w-3 h-3 ${isCapa ? "fill-current" : ""}`} />
                  </button>
                  <button type="button" onClick={(e) => { e.stopPropagation(); removeNew(i); }} title="Excluir foto" className="absolute top-1 right-1 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 hover:scale-110 transition-all">
                    <X className="w-3 h-3" />
                  </button>
                  <span className="absolute top-1 right-8 bg-primary/80 text-primary-foreground text-[8px] px-1 py-0.5 rounded font-medium">Nova</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Documents */}
      <div className="space-y-3 pt-2">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Documentos</Label>
        <DocSection label="Matrícula do Imóvel" icon={<FileText className="w-4 h-4 text-primary" />} existing={existingMatricula} newFiles={newMatricula} onRemoveExisting={(i: number) => setExistingMatricula((p: string[]) => p.filter((_: string, idx: number) => idx !== i))} onRemoveNew={(i: number) => setNewMatricula((p: File[]) => p.filter((_: File, idx: number) => idx !== i))} onAdd={() => docMatriculaRef.current?.click()} getFileName={getFileName} />
        <input ref={docMatriculaRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" className="hidden" onChange={(e) => { if (e.target.files) setNewMatricula((p: File[]) => [...p, ...Array.from(e.target.files!)]); e.target.value = ""; }} />

        <DocSection label="Documentos de IPTU" icon={<File className="w-4 h-4 text-primary" />} existing={existingIptu} newFiles={newIptu} onRemoveExisting={(i: number) => setExistingIptu((p: string[]) => p.filter((_: string, idx: number) => idx !== i))} onRemoveNew={(i: number) => setNewIptu((p: File[]) => p.filter((_: File, idx: number) => idx !== i))} onAdd={() => docIptuRef.current?.click()} getFileName={getFileName} />
        <input ref={docIptuRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" className="hidden" onChange={(e) => { if (e.target.files) setNewIptu((p: File[]) => [...p, ...Array.from(e.target.files!)]); e.target.value = ""; }} />

        <DocSection label="Vídeos" icon={<Video className="w-4 h-4 text-primary" />} existing={existingVideos} newFiles={newVideos} onRemoveExisting={(i: number) => setExistingVideos((p: string[]) => p.filter((_: string, idx: number) => idx !== i))} onRemoveNew={(i: number) => setNewVideos((p: File[]) => p.filter((_: File, idx: number) => idx !== i))} onAdd={() => docVideosRef.current?.click()} getFileName={getFileName} />
        <input ref={docVideosRef} type="file" multiple accept="video/*" className="hidden" onChange={(e) => { if (e.target.files) setNewVideos((p: File[]) => [...p, ...Array.from(e.target.files!)]); e.target.value = ""; }} />

        <DocSection label="Outros Documentos" icon={<File className="w-4 h-4 text-primary" />} existing={existingOutros} newFiles={newOutros} onRemoveExisting={(i: number) => setExistingOutros((p: string[]) => p.filter((_: string, idx: number) => idx !== i))} onRemoveNew={(i: number) => setNewOutros((p: File[]) => p.filter((_: File, idx: number) => idx !== i))} onAdd={() => docOutrosRef.current?.click()} getFileName={getFileName} />
        <input ref={docOutrosRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" className="hidden" onChange={(e) => { if (e.target.files) setNewOutros((p: File[]) => [...p, ...Array.from(e.target.files!)]); e.target.value = ""; }} />
      </div>
    </div>
  );
}

// ─── Step 4: Financeiro ─────
function Step4Financeiro({ form, set, inputClass, labelClass, handleCurrencyChange, handleCurrencyFocus, handleCurrencyBlur }: any) {
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">Valores financeiros do imóvel (opcionais)</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label className={labelClass}>Condomínio (R$)</Label>
          <Input value={form.valor_condominio} inputMode="decimal" onFocus={() => handleCurrencyFocus("valor_condominio")} onChange={(e) => handleCurrencyChange("valor_condominio", e.target.value)} onBlur={() => handleCurrencyBlur("valor_condominio")} placeholder="0,00" className={inputClass} />
        </div>
        <div>
          <Label className={labelClass}>IPTU (R$)</Label>
          <Input value={form.valor_iptu} inputMode="decimal" onFocus={() => handleCurrencyFocus("valor_iptu")} onChange={(e) => handleCurrencyChange("valor_iptu", e.target.value)} onBlur={() => handleCurrencyBlur("valor_iptu")} placeholder="0,00" className={inputClass} />
        </div>
      </div>

      <div>
        <Label className={labelClass}>Comissão (%)</Label>
        <Input type="number" step="0.1" value={form.comissao_percentual} onChange={e => set("comissao_percentual", e.target.value)} placeholder="6.0" className={inputClass} />
      </div>
    </div>
  );
}

// ─── Step 5: Publicar ─────
function Step5Publicar({ form, set }: any) {
  return (
    <div className="space-y-6">
      <div className="text-center py-4">
        <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
          <Home className="w-8 h-8 text-primary" />
        </motion.div>
        <h3 className="text-lg font-bold text-foreground">Tudo pronto para publicar!</h3>
        <p className="text-sm text-muted-foreground mt-1">Revise o status e publique seu imóvel</p>
      </div>

      <div>
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status do Imóvel</Label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
          {statusOptions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => set("status", s)}
              className={`py-3 rounded-xl border-2 text-sm font-medium transition-all duration-200 hover:scale-105 ${
                form.status === s ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:border-primary/30"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="bg-secondary/50 rounded-2xl p-4 space-y-2 text-sm">
        <p className="font-semibold text-foreground">Resumo</p>
        <div className="grid grid-cols-2 gap-2 text-muted-foreground">
          <span>Tipo:</span><span className="text-foreground font-medium">{form.tipo}</span>
          <span>Operação:</span><span className="text-foreground font-medium">{form.operacao}</span>
          <span>Título:</span><span className="text-foreground font-medium truncate">{form.titulo || "—"}</span>
          <span>Preço:</span><span className="text-foreground font-medium">{form.preco || "—"}</span>
          <span>Localização:</span><span className="text-foreground font-medium truncate">{[form.bairro, form.cidade].filter(Boolean).join(", ") || "—"}</span>
        </div>
      </div>
    </div>
  );
}

// ─── DocSection ─────
function DocSection({ label, icon, existing, newFiles, onRemoveExisting, onRemoveNew, onAdd, getFileName }: {
  label: string; icon: React.ReactNode; existing: string[]; newFiles: File[];
  onRemoveExisting: (i: number) => void; onRemoveNew: (i: number) => void; onAdd: () => void; getFileName: (url: string) => string;
}) {
  return (
    <div className="border border-border rounded-xl p-3 space-y-2">
      <div className="flex items-center gap-2">
        {icon}
        <p className="text-xs font-semibold text-foreground">{label}</p>
      </div>
      <div className="space-y-1">
        {existing.map((url: string, i: number) => (
          <div key={`e-${i}`} className="flex items-center gap-2 text-xs bg-secondary/50 rounded-lg px-2 py-1.5">
            <FileText className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            <a href={url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate flex-1">{getFileName(url)}</a>
            <button type="button" onClick={() => onRemoveExisting(i)} className="text-muted-foreground hover:text-destructive flex-shrink-0"><X className="w-3.5 h-3.5" /></button>
          </div>
        ))}
        {newFiles.map((f: File, i: number) => (
          <div key={`n-${i}`} className="flex items-center gap-2 text-xs bg-primary/5 border border-primary/20 rounded-lg px-2 py-1.5">
            <FileText className="w-3.5 h-3.5 text-primary flex-shrink-0" />
            <span className="truncate flex-1 text-foreground">{f.name}</span>
            <span className="text-muted-foreground text-[10px] flex-shrink-0">Novo</span>
            <button type="button" onClick={() => onRemoveNew(i)} className="text-muted-foreground hover:text-destructive flex-shrink-0"><X className="w-3.5 h-3.5" /></button>
          </div>
        ))}
      </div>
      <button type="button" onClick={onAdd} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors">
        <Upload className="w-3.5 h-3.5" /> Adicionar arquivo
      </button>
    </div>
  );
}
