import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Building2, MapPin, Ruler, BedDouble, Info, Save, AlertCircle, RotateCcw, Trash2, FileText, CheckCircle2, Lightbulb, Eye, Pencil } from "lucide-react";
import { clearDraft } from "@/hooks/useDraft";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { OtimizarDescricaoIA } from "./OtimizarDescricaoIA";


const DRAFT_KEY = "sas-avaliacao-form";



import { AssistenteManualPanel } from "@/components/avaliacao/AssistenteManualPanel";

export interface SasFormData {
  codigo: string;
  proprietario: string;
  corretor_nome: string;
  corretor_creci: string;
  data_avaliacao: string;
  cep: string;
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  latitude: string;
  longitude: string;
  tipo: string;
  operacao: string;
  area_privativa: string;
  area_comum: string;
  area_construida: string;
  area_util: string;
  area_total: string;
  area_terreno: string;
  quartos: string;
  suites: string;
  banheiros: string;
  lavabos: string;
  vagas: string;
  andar: string;
  elevador: boolean;
  posicao_solar: string;
  vista_livre: boolean;
  vista_permanente: boolean;
  mobiliado: boolean;
  reformado: boolean;
  ano_construcao: string;
  estado_conservacao: string;
  preco: string;
  valor_condominio: string;
  valor_taxa_extra: string;
  taxa_extra_descricao: string;
  valor_iptu: string;
  descricao: string;
}


const empty = (): SasFormData => ({
  codigo: "",
  proprietario: "",
  corretor_nome: "",
  corretor_creci: "",
  data_avaliacao: new Date().toISOString().slice(0, 10),
  cep: "",
  endereco: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  estado: "DF",
  latitude: "",
  longitude: "",
  tipo: "Apartamento",
  operacao: "Venda",
  area_privativa: "",
  area_comum: "",
  area_construida: "",
  area_util: "",
  area_total: "",
  area_terreno: "",
  quartos: "",
  suites: "",
  banheiros: "",
  lavabos: "",
  vagas: "",
  andar: "",
  elevador: false,
  posicao_solar: "",
  vista_livre: false,
  vista_permanente: false,
  mobiliado: false,
  reformado: false,
  ano_construcao: "",
  estado_conservacao: "Bom",
  preco: "",
  valor_condominio: "",
  valor_taxa_extra: "",
  taxa_extra_descricao: "",
  valor_iptu: "",
  descricao: "",
});


const TIPOS = ["Casa", "Apartamento", "Cobertura", "Terreno", "Loja", "Sala Comercial", "Galpão", "Fazenda"];
const CONSERVACAO = ["Novo", "Excelente", "Bom", "Regular", "Necessita reforma"];

// ===== Máscaras =====
const maskCEP = (v: string) => v.replace(/\D/g, "").slice(0, 8).replace(/^(\d{5})(\d)/, "$1-$2");
const onlyDigits = (v: string) => v.replace(/\D/g, "");
const maskDecimal = (v: string) => {
  // permite apenas dígitos e uma vírgula/ponto, máx 2 decimais
  let s = v.replace(/[^\d.,]/g, "").replace(",", ".");
  const parts = s.split(".");
  if (parts.length > 2) s = parts[0] + "." + parts.slice(1).join("");
  const [int, dec] = s.split(".");
  return dec !== undefined ? `${int}.${dec.slice(0, 2)}` : int;
};
const maskMoney = (v: string) => maskDecimal(v);
const maskCRECI = (v: string) => v.toUpperCase().replace(/[^0-9A-Z\-/]/g, "").slice(0, 12);
const maskUF = (v: string) => v.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2);
const maskLatLng = (v: string) => v.replace(/[^\d.\-]/g, "").slice(0, 12);
const maskInt = (v: string, max = 4) => v.replace(/\D/g, "").slice(0, max);

const ANO_ATUAL = new Date().getFullYear();

// Helpers de análise/limites vivem em módulo próprio (testável) — ver src/lib/avaliacao/sasDescricaoAnalise.ts
import {
  TOPICOS_DESCRICAO,
  TOPICOS_TAXA_EXTRA,
  analisarTexto,
  LIMITES,
  atingiuMax,
  truncarAoMax,
  validarDescricao,
  validarTaxaExtra,
} from "@/lib/avaliacao/sasDescricaoAnalise";



interface FieldCtx {
  errors: Record<string, string>;
  touched: Record<string, boolean>;
}
const FieldStateCtx = createContext<FieldCtx>({ errors: {}, touched: {} });

const Section = ({ icon: Icon, title, hint, done, children }: any) => (
  <div className="space-y-3">
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Icon className="w-4 h-4 text-primary" />
        {title}
        {done && (
          <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" /> preenchido
          </span>
        )}
      </div>
    </div>
    {hint && (
      <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground leading-snug">
        <Lightbulb className="w-3 h-3 mt-0.5 flex-shrink-0 text-amber-500" />
        <span>{hint}</span>
      </p>
    )}
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">{children}</div>
    <Separator />
  </div>
);

const Field = ({ label, name, children, full }: any) => {
  const { errors, touched } = useContext(FieldStateCtx);
  const hasErr = name && errors[name];
  const showErr = name && touched[name] && errors[name];
  return (
    <div
      id={name ? `field-${name}` : undefined}
      className={`space-y-1 ${full ? "sm:col-span-2 md:col-span-3" : ""} ${
        showErr
          ? "[&_input]:border-destructive [&_input]:focus-visible:ring-destructive [&_[role=combobox]]:border-destructive"
          : ""
      }`}
      data-invalid={hasErr ? "true" : undefined}
    >
      <Label className={`text-xs ${showErr ? "text-destructive" : ""}`}>{label}</Label>
      {children}
      {showErr && (
        <p className="text-[11px] text-destructive flex items-center gap-1">
          <AlertCircle className="w-3 h-3" /> {showErr}
        </p>
      )}
    </div>
  );
};


interface Props {
  onSubmit: (data: SasFormData) => void;
  onCancel?: () => void;
  initial?: Partial<SasFormData>;
  onForcadasChange?: (refs: any[]) => void;
}

export function SasAvaliacaoForm({ onSubmit, onCancel, initial, onForcadasChange }: Props) {
  const [d, setD] = useState<SasFormData>(() => {
    try {
      const raw = localStorage.getItem(`draft_v1_${DRAFT_KEY}`);
      if (raw) return { ...empty(), ...JSON.parse(raw), ...(initial || {}) };
    } catch { /* ignore */ }
    return { ...empty(), ...(initial || {}) };
  });
  const [draftRestored, setDraftRestored] = useState(() => {
    try { return Boolean(localStorage.getItem(`draft_v1_${DRAFT_KEY}`)); } catch { return false; }
  });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [previewOpen, setPreviewOpen] = useState(false);
  const [maxAlert, setMaxAlert] = useState<Record<string, boolean>>({});
  const flashMaxAlert = (field: string) => {
    setMaxAlert(p => ({ ...p, [field]: true }));
    window.setTimeout(() => setMaxAlert(p => ({ ...p, [field]: false })), 3500);
  };
  const manualTotal = useRef(Boolean(initial?.area_total));
  const manualUtil = useRef(Boolean(initial?.area_util));
  const set = <K extends keyof SasFormData>(k: K, v: SasFormData[K]) => setD(p => ({ ...p, [k]: v }));
  const touch = (k: string) => setTouched(p => ({ ...p, [k]: true }));

  // Auto-save rascunho (debounce 400ms)
  useEffect(() => {
    const t = setTimeout(() => {
      try { localStorage.setItem(`draft_v1_${DRAFT_KEY}`, JSON.stringify(d)); } catch { /* ignore */ }
    }, 400);
    return () => clearTimeout(t);
  }, [d]);

  const descartarRascunho = () => {
    clearDraft(DRAFT_KEY);
    setD({ ...empty(), ...(initial || {}) });
    setDraftRestored(false);
    setTouched({});
  };

  const num = (v: string) => (v === "" || isNaN(Number(v)) ? 0 : Number(v));

  const fmt = (n: number) => (n > 0 ? n.toFixed(2).replace(/\.00$/, "") : "");

  // ===== Cálculos automáticos =====
  // Área útil = privativa + comum (quando comum informada)
  // Área total = construída (ou útil) + terreno (quando aplicável)
  useEffect(() => {
    const priv = num(d.area_privativa);
    const comum = num(d.area_comum);
    const constr = num(d.area_construida);
    const terreno = num(d.area_terreno);

    setD(p => {
      const patch: Partial<SasFormData> = {};
      if (!manualUtil.current && (priv > 0 || comum > 0)) {
        patch.area_util = fmt(priv + comum);
      }
      if (!manualTotal.current) {
        const base = constr > 0 ? constr : priv + comum;
        const total = base + terreno;
        if (total > 0) patch.area_total = fmt(total);
      }
      return Object.keys(patch).length ? { ...p, ...patch } : p;
    });
  }, [d.area_privativa, d.area_comum, d.area_construida, d.area_terreno]);

  // ===== Validações =====
  const errors: Record<string, string> = {};
  if (!d.tipo) errors.tipo = "Selecione o tipo";
  if (!d.operacao) errors.operacao = "Selecione a operação";
  if (!d.bairro.trim()) errors.bairro = "Bairro é obrigatório";
  if (!d.cidade.trim()) errors.cidade = "Cidade é obrigatória";
  if (d.estado && d.estado.length !== 2) errors.estado = "UF deve ter 2 letras";
  if (d.cep && onlyDigits(d.cep).length !== 8) errors.cep = "CEP inválido";

  const priv = num(d.area_privativa);
  const comum = num(d.area_comum);
  const util = num(d.area_util);
  const constr = num(d.area_construida);
  const total = num(d.area_total);
  const terreno = num(d.area_terreno);
  const isTerreno = d.tipo === "Terreno";

  ["area_privativa", "area_comum", "area_util", "area_construida", "area_total", "area_terreno"].forEach((k) => {
    const v = Number((d as any)[k]);
    if ((d as any)[k] && (isNaN(v) || v < 0 || v > 1_000_000)) errors[k] = "Área inválida";
  });

  if (isTerreno) {
    if (terreno <= 0) errors.area_terreno = "Área do terreno é obrigatória";
  } else if (priv <= 0 && constr <= 0) {
    errors.area_privativa = "Informe área privativa ou construída (> 0)";
  }

  // Consistência
  const TOL = 0.5;
  if (priv > 0 && comum > 0 && util > 0 && Math.abs(util - (priv + comum)) > TOL) {
    errors.area_util = "Área útil deve ser igual a privativa + comum";
  }
  if (constr > 0 && priv > 0 && constr + TOL < priv) {
    errors.area_construida = "Construída não pode ser menor que privativa";
  }
  if (total > 0 && constr > 0 && total + TOL < constr) {
    errors.area_total = "Total não pode ser menor que construída";
  }
  if (total > 0 && priv > 0 && total + TOL < priv + comum) {
    errors.area_total = "Total não pode ser menor que privativa + comum";
  }

  const intFields: Array<[keyof SasFormData, number]> = [
    ["quartos", 30], ["suites", 30], ["banheiros", 30], ["lavabos", 10], ["vagas", 50],
  ];
  intFields.forEach(([k, max]) => {
    const v = (d as any)[k];
    if (v !== "" && (Number(v) < 0 || Number(v) > max)) errors[k as string] = `Entre 0 e ${max}`;
  });

  if (d.ano_construcao) {
    const a = Number(d.ano_construcao);
    if (isNaN(a) || a < 1900 || a > ANO_ATUAL + 5) errors.ano_construcao = `Ano entre 1900 e ${ANO_ATUAL + 5}`;
  }

  ["preco", "valor_condominio", "valor_taxa_extra", "valor_iptu"].forEach((k) => {
    const v = (d as any)[k];
    if (v !== "" && (isNaN(Number(v)) || Number(v) < 0)) errors[k] = "Valor inválido";
  });


  if (d.latitude && isNaN(Number(d.latitude))) errors.latitude = "Latitude inválida";
  if (d.longitude && isNaN(Number(d.longitude))) errors.longitude = "Longitude inválida";
  if (d.corretor_creci && d.corretor_creci.length < 4) errors.corretor_creci = "CRECI inválido";

  // Descrição do imóvel — obrigatória e dentro dos limites
  const vDesc = validarDescricao(d.descricao);
  if (!vDesc.valid && vDesc.erro) errors.descricao = vDesc.erro;

  // Descrição da taxa extra — obrigatória quando houver valor de taxa extra
  const vTaxa = validarTaxaExtra(d.taxa_extra_descricao, Number(d.valor_taxa_extra));
  if (!vTaxa.valid && vTaxa.erro) errors.taxa_extra_descricao = vTaxa.erro;

  const valid = Object.keys(errors).length === 0;

  const buscarCep = async () => {
    const cep = onlyDigits(d.cep);
    if (cep.length !== 8) return;
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const j = await r.json();
      if (!j.erro) {
        setD(p => ({
          ...p,
          endereco: j.logradouro || p.endereco,
          bairro: j.bairro || p.bairro,
          cidade: j.localidade || p.cidade,
          estado: j.uf || p.estado,
        }));
      }
    } catch { /* silencioso */ }
  };

  const fieldCtx = useMemo(() => ({ errors, touched }), [errors, touched]);



  const FIELD_LABELS: Record<string, string> = {
    tipo: "Tipo do imóvel",
    operacao: "Operação",
    bairro: "Bairro",
    cidade: "Cidade",
    estado: "Estado (UF)",
    cep: "CEP",
    corretor_creci: "CRECI",
    latitude: "Latitude",
    longitude: "Longitude",
    area_privativa: "Área privativa",
    area_comum: "Área comum",
    area_util: "Área útil",
    area_construida: "Área construída",
    area_total: "Área total",
    area_terreno: "Área do terreno",
    quartos: "Quartos",
    suites: "Suítes",
    banheiros: "Banheiros",
    lavabos: "Lavabos",
    vagas: "Vagas",
    ano_construcao: "Ano de construção",
    preco: "Preço pretendido",
    valor_condominio: "Condomínio",
    valor_taxa_extra: "Taxa extra do condomínio",
    taxa_extra_descricao: "Descrição da taxa extra",
    valor_iptu: "IPTU",
    descricao: "Descrição do imóvel",


  };

  const scrollToField = (name: string) => {
    const el = document.getElementById(`field-${name}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      const input = el.querySelector("input, [role=combobox]") as HTMLElement | null;
      input?.focus();
    }
  };


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const allTouched: Record<string, boolean> = {};
    Object.keys(errors).forEach(k => { allTouched[k] = true; });
    setTouched(p => ({ ...p, ...allTouched }));
    if (valid) {
      setPreviewOpen(true);
    } else {
      const first = Object.keys(errors)[0];
      if (first) setTimeout(() => scrollToField(first), 50);
    }
  };

  const confirmarEnvio = () => {
    clearDraft(DRAFT_KEY);
    setDraftRestored(false);
    setPreviewOpen(false);
    onSubmit(d);
  };


  // ===== Guia de preenchimento por seção =====
  const sectionDone = useMemo(() => {
    const nonEmpty = (v: string) => typeof v === "string" && v.trim().length > 0;
    return {
      identificacao: nonEmpty(d.proprietario) && nonEmpty(d.corretor_nome),
      localizacao: nonEmpty(d.bairro) && nonEmpty(d.cidade) && d.estado.length === 2,
      tipo: nonEmpty(d.tipo) && nonEmpty(d.operacao),
      dimensoes: isTerreno ? terreno > 0 : (priv > 0 || constr > 0),
      ambientes: nonEmpty(d.quartos) || nonEmpty(d.banheiros) || nonEmpty(d.vagas),
      adicionais: nonEmpty(d.preco) || nonEmpty(d.valor_condominio) || nonEmpty(d.valor_iptu),
      descricao: d.descricao.trim().length >= 30,
    };
  }, [d, isTerreno, priv, constr, terreno]);

  const totalSecoes = 7;
  const preenchidas = Object.values(sectionDone).filter(Boolean).length;
  const progresso = Math.round((preenchidas / totalSecoes) * 100);

  return (
    <FieldStateCtx.Provider value={fieldCtx}>
    <form onSubmit={handleSubmit} className="space-y-5">
      {draftRestored && (
        <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-foreground">
            <RotateCcw className="w-4 h-4 text-primary" />
            <span>Rascunho anterior restaurado automaticamente.</span>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={descartarRascunho} className="gap-1 text-destructive hover:text-destructive">
            <Trash2 className="w-3.5 h-3.5" /> Descartar
          </Button>
        </div>
      )}

      <AssistenteManualPanel
        onForcadasChange={onForcadasChange}
        dados={{
          tipo: d.tipo,
          operacao: d.operacao,
          bairro: d.bairro,
          cidade: d.cidade,
          estado: d.estado,
          cep: d.cep,
          area_privativa: d.area_privativa,
          area_construida: d.area_construida,
          area_terreno: d.area_terreno,
          quartos: d.quartos,
          banheiros: d.banheiros,
          vagas: d.vagas,
          preco: d.preco,
          descricao: d.descricao,
        }}
        onAplicar={(patch) => setD((p) => ({ ...p, ...patch }))}
      />



      {/* Barra de guia de preenchimento */}
      <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-foreground">Preenchimento guiado</span>
          <span className="text-muted-foreground">{preenchidas}/{totalSecoes} seções • {progresso}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-background overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${progresso}%` }}
          />
        </div>
        <p className="text-[11px] text-muted-foreground">
          Preencha as seções abaixo na ordem apresentada. Campos com <span className="text-destructive font-medium">*</span> são obrigatórios;
          áreas úteis e total são calculadas automaticamente a partir da privativa/comum.
        </p>
      </div>

      <Section icon={Info} title="1. Identificação" done={sectionDone.identificacao}
        hint="Informe quem é o proprietário, o corretor responsável e a data desta avaliação — esses dados aparecerão no laudo final.">



        <Field label="Código do imóvel" name="codigo">
          <Input value={d.codigo} onChange={(e) => set("codigo", e.target.value.slice(0, 30))} placeholder="Ex: AP-001" />
        </Field>
        <Field label="Proprietário" name="proprietario">
          <Input value={d.proprietario} onChange={(e) => set("proprietario", e.target.value.slice(0, 120))} placeholder="Nome completo" />
        </Field>
        <Field label="Data da avaliação" name="data_avaliacao">
          <Input type="date" value={d.data_avaliacao} onChange={(e) => set("data_avaliacao", e.target.value)} />
        </Field>
        <Field label="Corretor responsável" name="corretor_nome">
          <Input value={d.corretor_nome} onChange={(e) => set("corretor_nome", e.target.value.slice(0, 120))} placeholder="Nome do corretor" />
        </Field>
        <Field label="CRECI" name="corretor_creci">
          <Input
            value={d.corretor_creci}
            onChange={(e) => set("corretor_creci", maskCRECI(e.target.value))}
            onBlur={() => touch("corretor_creci")}
            placeholder="00000-F"
          />
        </Field>
      </Section>

      <Section icon={MapPin} title="2. Localização" done={sectionDone.localizacao}
        hint="Comece pelo CEP — o endereço, bairro, cidade e UF serão preenchidos automaticamente. Latitude/longitude são opcionais, mas melhoram a precisão da análise.">

        <Field label="CEP" name="cep">
          <Input
            value={d.cep}
            onChange={(e) => set("cep", maskCEP(e.target.value))}
            onBlur={() => { touch("cep"); buscarCep(); }}
            placeholder="00000-000"
            maxLength={9}
            inputMode="numeric"
          />
        </Field>
        <Field label="Endereço" name="endereco" full>
          <Input value={d.endereco} onChange={(e) => set("endereco", e.target.value.slice(0, 160))} placeholder="Rua, avenida, quadra..." />
        </Field>
        <Field label="Número" name="numero">
          <Input value={d.numero} onChange={(e) => set("numero", e.target.value.slice(0, 10))} inputMode="numeric" />
        </Field>
        <Field label="Complemento" name="complemento">
          <Input value={d.complemento} onChange={(e) => set("complemento", e.target.value.slice(0, 60))} placeholder="Apto, bloco..." />
        </Field>
        <Field label="Bairro *" name="bairro">
          <Input value={d.bairro} onChange={(e) => set("bairro", e.target.value.slice(0, 80))} onBlur={() => touch("bairro")} />
        </Field>
        <Field label="Cidade *" name="cidade">
          <Input value={d.cidade} onChange={(e) => set("cidade", e.target.value.slice(0, 80))} onBlur={() => touch("cidade")} />
        </Field>
        <Field label="Estado (UF)" name="estado">
          <Input value={d.estado} onChange={(e) => set("estado", maskUF(e.target.value))} onBlur={() => touch("estado")} maxLength={2} />
        </Field>
        <Field label="Latitude" name="latitude">
          <Input value={d.latitude} onChange={(e) => set("latitude", maskLatLng(e.target.value))} onBlur={() => touch("latitude")} placeholder="-15.7942" inputMode="decimal" />
        </Field>
        <Field label="Longitude" name="longitude">
          <Input value={d.longitude} onChange={(e) => set("longitude", maskLatLng(e.target.value))} onBlur={() => touch("longitude")} placeholder="-47.8822" inputMode="decimal" />
        </Field>
      </Section>

      <Section icon={Building2} title="3. Tipo do imóvel" done={sectionDone.tipo}
        hint="A escolha do tipo altera as regras de área — para 'Terreno' apenas a área do terreno é exigida.">

        <Field label="Tipo *" name="tipo">
          <Select value={d.tipo} onValueChange={(v) => set("tipo", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TIPOS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Operação" name="operacao">
          <Select value={d.operacao} onValueChange={(v) => set("operacao", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Venda">Venda</SelectItem>
              <SelectItem value="Locação">Locação</SelectItem>
              <SelectItem value="Venda e Locação">Venda e Locação</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Estado de conservação" name="estado_conservacao">
          <Select value={d.estado_conservacao} onValueChange={(v) => set("estado_conservacao", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CONSERVACAO.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
      </Section>

      <Section icon={Ruler} title="4. Dimensões (m²)" done={sectionDone.dimensoes}
        hint="Informe pelo menos a área privativa (ou construída). Útil e Total são calculadas — edite se quiser sobrescrever.">

        {([
          ["area_privativa", "Área privativa", false],
          ["area_comum", "Área comum", false],
          ["area_util", "Área útil (auto)", "util"],
          ["area_construida", "Área construída", false],
          ["area_total", "Área total (auto)", "total"],
          ["area_terreno", "Área do terreno", false],
        ] as const).map(([k, label, autoKey]) => (
          <Field key={k} label={label} name={k}>
            <Input
              value={(d as any)[k]}
              onChange={(e) => {
                if (autoKey === "total") manualTotal.current = true;
                if (autoKey === "util") manualUtil.current = true;
                set(k as keyof SasFormData, maskDecimal(e.target.value) as any);
              }}
              onBlur={() => touch(k)}
              inputMode="decimal"
              placeholder="0.00"
            />
          </Field>
        ))}
        <div className="sm:col-span-2 md:col-span-3 text-[11px] text-muted-foreground -mt-1">
          Útil e Total são calculados automaticamente. Edite para sobrescrever.
        </div>
      </Section>


      <Section icon={BedDouble} title="5. Ambientes" done={sectionDone.ambientes}
        hint="Quantitativos internos do imóvel. Deixe em branco o que não se aplica (ex.: suítes em imóveis compactos).">

        {(["quartos", "suites", "banheiros", "lavabos", "vagas"] as const).map((k) => (
          <Field key={k} label={k[0].toUpperCase() + k.slice(1)} name={k}>
            <Input
              value={(d as any)[k]}
              onChange={(e) => set(k, maskInt(e.target.value, 3) as any)}
              onBlur={() => touch(k)}
              inputMode="numeric"
              placeholder="0"
            />
          </Field>
        ))}
        <Field label="Ano de construção" name="ano_construcao">
          <Input
            value={d.ano_construcao}
            onChange={(e) => set("ano_construcao", maskInt(e.target.value, 4))}
            onBlur={() => touch("ano_construcao")}
            inputMode="numeric"
            placeholder="2018"
          />
        </Field>
      </Section>

      <Section icon={Info} title="6. Informações adicionais" done={sectionDone.adicionais}
        hint="Preço pretendido, custos mensais (condomínio/IPTU) e diferenciais como vista, mobília e reforma.">

        <Field label="Andar" name="andar">
          <Input value={d.andar} onChange={(e) => set("andar", e.target.value.slice(0, 6))} placeholder="Ex: 8" />
        </Field>
        <Field label="Posição solar" name="posicao_solar">
          <Select value={d.posicao_solar} onValueChange={(v) => set("posicao_solar", v)}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Nascente">Nascente</SelectItem>
              <SelectItem value="Poente">Poente</SelectItem>
              <SelectItem value="Norte">Norte</SelectItem>
              <SelectItem value="Sul">Sul</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Preço pretendido (R$)" name="preco">
          <Input value={d.preco} onChange={(e) => set("preco", maskMoney(e.target.value))} onBlur={() => touch("preco")} inputMode="decimal" placeholder="0.00" />
        </Field>
        <Field label="Condomínio (R$)" name="valor_condominio">
          <Input value={d.valor_condominio} onChange={(e) => set("valor_condominio", maskMoney(e.target.value))} onBlur={() => touch("valor_condominio")} inputMode="decimal" placeholder="0.00" />
        </Field>
        {Number(d.valor_condominio) > 0 && (
          <>
            <Field label="Taxa extra do condomínio (R$)" name="valor_taxa_extra">
              <Input
                value={d.valor_taxa_extra}
                onChange={(e) => set("valor_taxa_extra", maskMoney(e.target.value))}
                onBlur={() => touch("valor_taxa_extra")}
                inputMode="decimal"
                placeholder="Ex.: fundo de reserva, obra"
              />
            </Field>
            <Field label="Descrição da taxa extra" name="taxa_extra_descricao" full>
              {(() => {
                const MAX = 400;
                const MIN = 15;
                const len = d.taxa_extra_descricao.length;
                const trimmedLen = d.taxa_extra_descricao.trim().length;
                const atMax = len >= MAX;
                const nearMax = len >= MAX * 0.9 && !atMax;
                const belowMin = trimmedLen > 0 && trimmedLen < MIN;
                const analiseTx = analisarTexto(d.taxa_extra_descricao, TOPICOS_TAXA_EXTRA);
                return (
                  <>
                    {maxAlert.taxa_extra_descricao && (
                      <div role="alert" className="mb-1 flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-1.5 text-[11px] text-destructive font-medium">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Limite de {MAX} caracteres atingido na descrição da taxa extra.
                      </div>
                    )}
                    <Textarea
                      value={d.taxa_extra_descricao}
                      onChange={(e) => {
                        const next = e.target.value.slice(0, MAX);
                        if (e.target.value.length >= MAX && d.taxa_extra_descricao.length < MAX) {
                          flashMaxAlert("taxa_extra_descricao");
                        }
                        set("taxa_extra_descricao", next);
                      }}
                      onBlur={() => touch("taxa_extra_descricao")}
                      placeholder="Ex.: fundo de reserva mensal, taxa extraordinária de obra na fachada, rateio de reforma da piscina..."
                      rows={3}
                      maxLength={MAX}
                      aria-invalid={atMax}
                      className={`resize-y min-h-[70px] ${atMax ? "border-destructive focus-visible:ring-destructive" : nearMax ? "border-amber-500 focus-visible:ring-amber-500" : belowMin ? "border-amber-400" : ""}`}
                    />

                    <div className="flex items-center justify-between text-[11px] mt-1 gap-2">
                      <span className={
                        atMax ? "text-destructive font-medium flex items-center gap-1"
                        : belowMin ? "text-amber-600 dark:text-amber-400 flex items-center gap-1"
                        : "text-muted-foreground"
                      }>
                        {atMax && <><AlertCircle className="w-3 h-3" /> Limite máximo atingido.</>}
                        {!atMax && belowMin && <><AlertCircle className="w-3 h-3" /> Faltam {MIN - trimmedLen} caractere(s) — explique brevemente o motivo (obra, rateio, fundo de reserva).</>}
                        {!atMax && !belowMin && (trimmedLen === 0 ? "Detalhe o motivo da taxa extra." : "Descrição adequada.")}
                      </span>
                      <span className={atMax ? "text-destructive font-medium" : nearMax ? "text-amber-600 dark:text-amber-400 font-medium" : "text-muted-foreground"}>
                        {len}/{MAX}
                      </span>
                    </div>

                    {trimmedLen > 0 && analiseTx.faltando.length > 0 && (
                      <div className="mt-1.5 rounded-md border border-amber-500/30 bg-amber-500/5 p-2 space-y-1">
                        <div className="flex items-center gap-1 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                          <Lightbulb className="w-3 h-3" /> Ainda falta informar:
                        </div>
                        <ul className="space-y-0.5 pl-1">
                          {analiseTx.faltando.map(t => (
                            <li key={t.id} className="text-[10px] text-foreground">
                              <span className="font-medium">{t.label}:</span> <span className="text-muted-foreground">{t.hint}.</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                );
              })()}
            </Field>

          </>
        )}
        <Field label="IPTU mensal (R$)" name="valor_iptu">
          <Input value={d.valor_iptu} onChange={(e) => set("valor_iptu", maskMoney(e.target.value))} onBlur={() => touch("valor_iptu")} inputMode="decimal" placeholder="0.00" />
        </Field>

        <div className="sm:col-span-2 md:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-2 pt-1">
          {[
            ["elevador", "Elevador"],
            ["vista_livre", "Vista livre"],
            ["vista_permanente", "Vista permanente"],
            ["mobiliado", "Mobiliado"],
            ["reformado", "Reformado"],
          ].map(([k, label]) => (
            <label key={k} className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={(d as any)[k]}
                onCheckedChange={(v) => set(k as keyof SasFormData, Boolean(v) as any)}
              />
              {label}
            </label>
          ))}
        </div>
      </Section>

      <Section
        icon={FileText}
        title="7. Descrição do imóvel"
        done={sectionDone.descricao}
        hint="Descreva o imóvel em detalhes: acabamentos, diferenciais, localização, entorno, condição atual e qualquer informação relevante para a avaliação. Quanto mais rico o texto, melhor o laudo final. Mínimo recomendado: 30 caracteres."
      >
        <Field label="Descrição completa" name="descricao" full>
          {(() => {
            const MAX = 2000;
            const MIN_REC = 30;
            const IDEAL = 200;
            const len = d.descricao.length;
            const trimmedLen = d.descricao.trim().length;
            const atMax = len >= MAX;
            const nearMax = len >= MAX * 0.9 && !atMax;
            const belowMin = trimmedLen > 0 && trimmedLen < MIN_REC;
            const belowIdeal = trimmedLen >= MIN_REC && trimmedLen < IDEAL;
            const good = trimmedLen >= IDEAL && !atMax;
            const analise = analisarTexto(d.descricao, TOPICOS_DESCRICAO);
            return (
              <>
                {maxAlert.descricao && (
                  <div role="alert" className="mb-2 flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive font-medium">
                    <AlertCircle className="w-4 h-4" />
                    Limite de {MAX} caracteres atingido na descrição do imóvel.
                  </div>
                )}
                <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                  <span className="text-[11px] text-muted-foreground">
                    Deixe que a IA reescreva sua descrição usando os dados do imóvel — sem inventar fatos.
                  </span>
                  <OtimizarDescricaoIA
                    data={d}
                    onAceitar={(novaDescricao) => set("descricao", novaDescricao.slice(0, MAX))}
                  />
                </div>
                <Textarea
                  value={d.descricao}
                  onChange={(e) => {
                    const next = e.target.value.slice(0, MAX);
                    if (e.target.value.length >= MAX && d.descricao.length < MAX) {
                      flashMaxAlert("descricao");
                    }
                    set("descricao", next);
                  }}
                  onBlur={() => touch("descricao")}
                  placeholder={`Ex.: Apartamento de 3 quartos, sendo 1 suíte, com sala ampla em dois ambientes, cozinha planejada, área de serviço separada. Piso porcelanato, banheiros revestidos em cerâmica. Reformado em 2023 com nova pintura e bancadas de granito. Vista para área verde, andar alto, sol da manhã. Prédio com portaria 24h, salão de festas, piscina e academia. Excelente localização, próximo a supermercados, escolas e transporte público.`}
                  rows={10}
                  maxLength={MAX}
                  aria-invalid={atMax}
                  className={`resize-y min-h-[200px] text-sm leading-relaxed ${
                    atMax ? "border-destructive focus-visible:ring-destructive"
                    : nearMax ? "border-amber-500 focus-visible:ring-amber-500"
                    : belowMin ? "border-amber-400"
                    : ""
                  }`}
                />
                {/* Barra de qualidade */}
                <div className="h-1 rounded-full bg-muted mt-2 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      atMax ? "bg-destructive"
                      : good ? "bg-emerald-500"
                      : belowIdeal ? "bg-amber-500"
                      : belowMin ? "bg-amber-400"
                      : "bg-muted-foreground/30"
                    }`}
                    style={{ width: `${Math.min(100, (len / IDEAL) * 100)}%` }}
                  />
                </div>
                <div className="flex items-start justify-between text-[11px] mt-1 gap-2">
                  <span className={
                    atMax ? "text-destructive font-medium flex items-center gap-1"
                    : belowMin ? "text-amber-600 dark:text-amber-400 flex items-center gap-1"
                    : belowIdeal ? "text-amber-600 dark:text-amber-400 flex items-center gap-1"
                    : good ? "text-emerald-600 dark:text-emerald-400 flex items-center gap-1"
                    : "text-muted-foreground"
                  }>
                    {atMax && <><AlertCircle className="w-3 h-3" /> Limite máximo de {MAX} caracteres atingido.</>}
                    {!atMax && belowMin && <><AlertCircle className="w-3 h-3" /> Descrição muito curta — faltam {MIN_REC - trimmedLen} caractere(s) para o mínimo aceito.</>}
                    {!atMax && belowIdeal && <><Lightbulb className="w-3 h-3" /> Falta detalhamento — {IDEAL - trimmedLen} caractere(s) para atingir o padrão recomendado ({IDEAL}).</>}
                    {!atMax && good && <><CheckCircle2 className="w-3 h-3" /> Descrição com bom nível de detalhe ({analise.cobertos.length}/{TOPICOS_DESCRICAO.length} tópicos cobertos).</>}
                    {!atMax && trimmedLen === 0 && "Descreva o imóvel com detalhes — comece pelos ambientes e metragem."}
                  </span>
                  <span className={
                    atMax ? "text-destructive font-medium whitespace-nowrap"
                    : nearMax ? "text-amber-600 dark:text-amber-400 font-medium whitespace-nowrap"
                    : "text-muted-foreground whitespace-nowrap"
                  }>
                    {len}/{MAX}
                  </span>
                </div>

                {/* Análise de tópicos faltantes */}
                {trimmedLen > 0 && analise.faltando.length > 0 && (
                  <div className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-2.5 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                      <Lightbulb className="w-3.5 h-3.5" />
                      Para enriquecer a descrição, inclua também:
                    </div>
                    <ul className="space-y-1 pl-1">
                      {analise.faltando.map(t => (
                        <li key={t.id} className="flex items-start gap-1.5 text-[11px] text-foreground">
                          <span className="mt-1 w-1 h-1 rounded-full bg-amber-500 flex-shrink-0" />
                          <span><span className="font-medium">{t.label}:</span> <span className="text-muted-foreground">{t.hint}.</span></span>
                        </li>
                      ))}
                    </ul>
                    {analise.cobertos.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {analise.cobertos.map(t => (
                          <span key={t.id} className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="w-2.5 h-2.5" /> {t.label}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            );
          })()}
        </Field>
      </Section>



      {!valid && Object.keys(touched).length > 0 && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <div className="flex items-center gap-2 font-semibold text-destructive mb-2">
            <AlertCircle className="w-4 h-4" />
            {Object.keys(errors).length} {Object.keys(errors).length === 1 ? "campo precisa" : "campos precisam"} de atenção
          </div>
          <ul className="space-y-1 max-h-40 overflow-y-auto">
            {Object.entries(errors).map(([name, msg]) => (
              <li key={name}>
                <button
                  type="button"
                  onClick={() => scrollToField(name)}
                  className="text-left text-xs text-destructive hover:underline w-full"
                >
                  <span className="font-medium">{FIELD_LABELS[name] || name}:</span> {msg}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}


      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        )}
        <Button type="submit" disabled={!valid} className="gap-2">
          <Eye className="w-4 h-4" /> Revisar e enviar
        </Button>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-primary" /> Prévia da avaliação
            </DialogTitle>
            <DialogDescription>
              Revise as informações abaixo. Se algo estiver incorreto, volte para editar antes de confirmar.
            </DialogDescription>
          </DialogHeader>

          <PreviewResumo d={d} sectionDone={sectionDone} />

          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={() => setPreviewOpen(false)} className="gap-2">
              <Pencil className="w-4 h-4" /> Editar
            </Button>
            <Button type="button" onClick={confirmarEnvio} className="gap-2">
              <Save className="w-4 h-4" /> Confirmar e enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
    </FieldStateCtx.Provider>
  );
}

// ===== Componente de prévia =====
function PreviewResumo({ d, sectionDone }: { d: SasFormData; sectionDone: Record<string, boolean> }) {
  const dash = (v: string | number | boolean | undefined | null) => {
    if (typeof v === "boolean") return v ? "Sim" : "Não";
    if (v === undefined || v === null || v === "") return "—";
    return String(v);
  };
  const money = (v: string) => {
    const n = Number(v);
    if (!v || isNaN(n) || n <= 0) return "—";
    return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };
  const area = (v: string) => (v && Number(v) > 0 ? `${v} m²` : "—");

  const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="flex items-start justify-between gap-3 py-1.5 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-medium text-foreground text-right break-words max-w-[65%]">{value}</span>
    </div>
  );

  const Bloco = ({ title, done, children }: { title: string; done: boolean; children: React.ReactNode }) => (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold text-foreground">{title}</h4>
        {done ? (
          <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" /> preenchido
          </span>
        ) : (
          <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">incompleto</span>
        )}
      </div>
      <div className="space-y-0">{children}</div>
    </div>
  );

  const diferenciais = [
    d.elevador && "Elevador",
    d.vista_livre && "Vista livre",
    d.vista_permanente && "Vista permanente",
    d.mobiliado && "Mobiliado",
    d.reformado && "Reformado",
  ].filter(Boolean).join(", ") || "—";

  return (
    <div className="space-y-3">
      <Bloco title="1. Identificação" done={sectionDone.identificacao}>
        <Row label="Código" value={dash(d.codigo)} />
        <Row label="Proprietário" value={dash(d.proprietario)} />
        <Row label="Data da avaliação" value={dash(d.data_avaliacao)} />
        <Row label="Corretor" value={dash(d.corretor_nome)} />
        <Row label="CRECI" value={dash(d.corretor_creci)} />
      </Bloco>

      <Bloco title="2. Localização" done={sectionDone.localizacao}>
        <Row label="CEP" value={dash(d.cep)} />
        <Row label="Endereço" value={`${dash(d.endereco)}${d.numero ? `, ${d.numero}` : ""}${d.complemento ? ` - ${d.complemento}` : ""}`} />
        <Row label="Bairro" value={dash(d.bairro)} />
        <Row label="Cidade / UF" value={`${dash(d.cidade)}${d.estado ? ` / ${d.estado}` : ""}`} />
        {(d.latitude || d.longitude) && (
          <Row label="Coordenadas" value={`${dash(d.latitude)}, ${dash(d.longitude)}`} />
        )}
      </Bloco>

      <Bloco title="3. Tipo do imóvel" done={sectionDone.tipo}>
        <Row label="Tipo" value={dash(d.tipo)} />
        <Row label="Operação" value={dash(d.operacao)} />
        <Row label="Conservação" value={dash(d.estado_conservacao)} />
      </Bloco>

      <Bloco title="4. Dimensões" done={sectionDone.dimensoes}>
        <Row label="Área privativa" value={area(d.area_privativa)} />
        <Row label="Área comum" value={area(d.area_comum)} />
        <Row label="Área útil" value={area(d.area_util)} />
        <Row label="Área construída" value={area(d.area_construida)} />
        <Row label="Área total" value={area(d.area_total)} />
        <Row label="Área do terreno" value={area(d.area_terreno)} />
      </Bloco>

      <Bloco title="5. Ambientes" done={sectionDone.ambientes}>
        <Row label="Quartos" value={dash(d.quartos)} />
        <Row label="Suítes" value={dash(d.suites)} />
        <Row label="Banheiros" value={dash(d.banheiros)} />
        <Row label="Lavabos" value={dash(d.lavabos)} />
        <Row label="Vagas" value={dash(d.vagas)} />
        <Row label="Ano de construção" value={dash(d.ano_construcao)} />
      </Bloco>

      <Bloco title="6. Informações adicionais" done={sectionDone.adicionais}>
        <Row label="Andar" value={dash(d.andar)} />
        <Row label="Posição solar" value={dash(d.posicao_solar)} />
        <Row label="Preço pretendido" value={money(d.preco)} />
        <Row label="Condomínio" value={money(d.valor_condominio)} />
        {Number(d.valor_taxa_extra) > 0 && (
          <>
            <Row label="Taxa extra" value={money(d.valor_taxa_extra)} />
            <Row label="Descrição taxa extra" value={dash(d.taxa_extra_descricao)} />
          </>
        )}
        <Row label="IPTU mensal" value={money(d.valor_iptu)} />
        <Row label="Diferenciais" value={diferenciais} />
      </Bloco>

      <Bloco title="7. Descrição do imóvel" done={sectionDone.descricao}>
        <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">
          {d.descricao.trim() || <span className="text-muted-foreground">Nenhuma descrição informada.</span>}
        </p>
      </Bloco>
    </div>
  );
}
