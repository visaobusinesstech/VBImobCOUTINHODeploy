import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Upload, FileText, X, Plus, Trash2 } from "lucide-react";
import { ContratoFileViewerDialog } from "@/components/contratos/ContratoFileViewerDialog";
import { ContratoDocChecklist } from "@/components/contratos/ContratoDocChecklist";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Contrato } from "@/hooks/useContratos";
import { STATUS_CONTRATO } from "@/hooks/useContratos";
import { useProprietarios } from "@/hooks/useProprietarios";
import { useContratoFileViewer } from "@/hooks/useContratoFileViewer";
import { useToast } from "@/hooks/use-toast";
import { CANAIS_ORIGEM } from "@/lib/canaisOrigem";
import { ContratoAnexosAnuaisSection } from "@/components/contratos/ContratoAnexosAnuaisSection";
import { ContratoComprovantesMensaisSection } from "@/components/contratos/ContratoComprovantesMensaisSection";
import {
  DEFAULT_CONTRATO_FILE_ACCEPT,
  getSafeFileExtension,
  VIDEO_CONTRATO_FILE_ACCEPT,
} from "@/lib/contratoFilePreview";
import { uploadContratoFilePrivate } from "@/lib/contratosStorage";

const formatCurrencyDisplay = (value: number): string => {
  if (!value) return "";
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
};

const sanitizeNumberInput = (raw: string) => raw.replace(/[^\d.,]/g, "");

const maskPhone = (v: string): string => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

const maskCpf = (v: string): string => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
};

const maskCpfCnpj = (v: string): string => {
  const d = v.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 11) return maskCpf(d);
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  if (d.length <= 13) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
};

const parseCurrencyInput = (raw: string): number => {
  const cleaned = sanitizeNumberInput(raw);
  if (!cleaned) return 0;

  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");

  let normalized = cleaned;

  if (hasComma) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (hasDot) {
    const parts = cleaned.split(".");
    if (parts.length > 2) {
      normalized = cleaned.replace(/\./g, "");
    } else {
      const lastPart = parts[parts.length - 1] || "";
      if (lastPart.length === 3) {
        normalized = cleaned.replace(/\./g, "");
      } else {
        normalized = cleaned;
      }
    }
  }

  const num = Number.parseFloat(normalized);
  return Number.isFinite(num) ? num : 0;
};

const formatPercentDisplay = (value: number): string => {
  if (!value) return "";
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contrato: Contrato | null;
  onSave: (data: Partial<Contrato>) => Promise<void>;
  saving: boolean;
}

const emptyContratoForm = {
  titulo: "", cliente: "", cliente_telefone: "", cliente_cpf: "", cliente_email: "", cliente_rg: "", tipo: "Venda", valor: 0, status: "rascunho",
  data_inicio: "", data_fim: "", inquilino: "", proprietario: "",
  vistoria_entrada: false, vistoria_video: false, apolice_seguro: false,
  observacoes: "", matricula: "", proprietario_id: "",
  indice_correcao: "IGPM", percentual_correcao: 0, data_proxima_correcao: "",
  dia_vencimento_aluguel: 10, data_vencimento_apolice: "", tipo_garantia: "seguro_fianca",
  contrato_anexo_url: "", apolice_anexo_url: "", vistoria_anexo_url: "",
  numero_agua: "", numero_luz: "", inscricao_iptu: "",
  canal_origem: "",
  parceria_envolvidos: [] as string[],
  proprietario_telefone: "", proprietario_cpf: "", proprietario_email: "", proprietario_rg: "",
  proprietario_banco: "", proprietario_agencia: "", proprietario_conta: "", proprietario_pix: "",
  comissao_percentual: 0, comissao_valor: 0,
  comissao_tipo: "mensal",
  tem_parceria: false, parceiro_nome: "", parceiro_comissao_percentual: 0, parceiro_comissao_valor: 0,
  captador_nome: "", captador_telefone: "", captador_comissao_percentual: 0, captador_comissao_valor: 0,
  imposto_tipo: "", imposto_percentual: 0, imposto_valor: 0,
  corretor_nome: "", corretor_comissao_percentual: 0, corretor_comissao_valor: 0,
  valor_iptu: 0, iptu_parcelado: false, valor_condominio: 0, condominio_inclui: "",
  inquilino_telefone: "", inquilino_cpf: "", inquilino_email: "", inquilino_rg: "",
  inquilino2_nome: "", inquilino2_cpf: "", inquilino2_telefone: "", inquilino2_email: "", inquilino2_rg: "",
  caucao_valor: 0, caucao_quantidade: 1,
  conjuge_proprietario: "", conjuge_cpf: "", conjuge_telefone: "", conjuge_email: "",
  fiador_matricula_url: "", caucao_comprovante_url: "", vistoria_video_url: "",
  aditivo_anexo_url: "", seguro_incendio_anexo_url: "", seguro_fianca_anexo_url: "",
  fiador_nome: "", fiador_cpf: "", fiador_telefone: "", fiador_email: "", fiador_estado_civil: "", fiador_endereco: "",
  fiador_renda_url: "",
  fiador2_nome: "", fiador2_cpf: "", fiador2_telefone: "", fiador2_email: "", fiador2_estado_civil: "", fiador2_endereco: "",
  fiador2_matricula_url: "", fiador2_renda_url: "",
  comprovante_agua_url: "", comprovante_luz_url: "",
  numero_unidade: "",
};

const CONTRATO_FORM_BACKUP_PREFIX = "contrato_form_backup_v2_";

type ContratoFormState = typeof emptyContratoForm;
type PersistedContratoForm = {
  form: ContratoFormState;
  valorDisplay: string;
  percentualDisplay: string;
  currencyDisplays: Record<string, string>;
};
type CurrencyFieldKey = "valor_iptu" | "valor_condominio" | "caucao_valor";
type FileUploadFieldKey =
  | "contrato_anexo_url"
  | "aditivo_anexo_url"
  | "vistoria_anexo_url"
  | "seguro_incendio_anexo_url"
  | "seguro_fianca_anexo_url"
  | "apolice_anexo_url"
  | "caucao_comprovante_url"
  | "vistoria_video_url"
  | "fiador_matricula_url"
  | "fiador_renda_url"
  | "fiador2_matricula_url"
  | "fiador2_renda_url"
  | "comprovante_agua_url"
  | "comprovante_luz_url";

const fileAcceptByField: Partial<Record<FileUploadFieldKey, string>> = {
  vistoria_video_url: VIDEO_CONTRATO_FILE_ACCEPT,
};

const getFileAccept = (urlKey: FileUploadFieldKey) => fileAcceptByField[urlKey] || DEFAULT_CONTRATO_FILE_ACCEPT;

const commissionRecalculationKeys: Array<keyof ContratoFormState> = [
  "valor",
  "tipo",
  "comissao_tipo",
  "comissao_percentual",
  "parceiro_comissao_percentual",
  "captador_comissao_percentual",
  "corretor_comissao_percentual",
  "imposto_percentual",
];

const getCommissionBaseValue = (state: ContratoFormState) =>
  state.tipo === "Locação" && state.comissao_tipo === "anual" ? state.valor * 12 : state.valor;

const recalculateCommissionState = (state: ContratoFormState): ContratoFormState => {
  const comissaoBase = getCommissionBaseValue(state);
  const comissaoValor = state.comissao_percentual > 0
    ? (comissaoBase * state.comissao_percentual) / 100
    : state.comissao_valor;

  return {
    ...state,
    comissao_valor: comissaoValor,
    parceiro_comissao_valor: state.parceiro_comissao_percentual > 0
      ? (comissaoValor * state.parceiro_comissao_percentual) / 100
      : state.parceiro_comissao_valor,
    captador_comissao_valor: state.captador_comissao_percentual > 0
      ? (comissaoValor * state.captador_comissao_percentual) / 100
      : state.captador_comissao_valor,
    corretor_comissao_valor: state.corretor_comissao_percentual > 0
      ? (comissaoValor * state.corretor_comissao_percentual) / 100
      : state.corretor_comissao_valor,
    imposto_valor: state.imposto_percentual > 0
      ? (comissaoValor * state.imposto_percentual) / 100
      : state.imposto_valor,
  };
};

const getContratoFormBackupKey = (contratoId?: string | null) =>
  `${CONTRATO_FORM_BACKUP_PREFIX}${contratoId ?? "novo"}`;

const readContratoFormBackup = (contratoId?: string | null): PersistedContratoForm | null => {
  try {
    const raw = localStorage.getItem(getContratoFormBackupKey(contratoId));
    if (!raw) return null;
    return JSON.parse(raw) as PersistedContratoForm;
  } catch {
    return null;
  }
};

const clearContratoFormBackup = (contratoId?: string | null) => {
  try {
    localStorage.removeItem(getContratoFormBackupKey(contratoId));
    localStorage.removeItem("draft_v1_contrato");
  } catch {
    // ignore
  }
};

export function ContratoFormDialog({ open, onOpenChange, contrato, onSave, saving }: Props) {
  const { proprietarios } = useProprietarios();
  const { toast } = useToast();
  const { viewerState, openContratoFileViewer, closeContratoFileViewer } = useContratoFileViewer();
  const [uploading, setUploading] = useState<string | null>(null);
  const [valorDisplay, setValorDisplay] = useState("");
  const [percentualDisplay, setPercentualDisplay] = useState("");
  const [currencyDisplays, setCurrencyDisplays] = useState<Record<string, string>>({});
  const [form, setForm] = useState(emptyContratoForm);

  useEffect(() => {
    if (!open) {
      setForm(emptyContratoForm);
      setValorDisplay("");
      setPercentualDisplay("");
      setCurrencyDisplays({});
      return;
    }

    const persisted = readContratoFormBackup(contrato?.id);
    if (persisted?.form) {
      setForm(recalculateCommissionState({ ...emptyContratoForm, ...persisted.form }));
      setValorDisplay(persisted.valorDisplay || "");
      setPercentualDisplay(persisted.percentualDisplay || "");
      setCurrencyDisplays(persisted.currencyDisplays || {});
      return;
    }

    if (contrato) {
      setForm(recalculateCommissionState({
        titulo: contrato.titulo, cliente: contrato.cliente, cliente_telefone: (contrato as any).cliente_telefone || "", cliente_cpf: (contrato as any).cliente_cpf || "", cliente_email: (contrato as any).cliente_email || "", cliente_rg: (contrato as any).cliente_rg || "", tipo: contrato.tipo,
        valor: contrato.valor, status: contrato.status,
        data_inicio: contrato.data_inicio || "", data_fim: contrato.data_fim || "",
        inquilino: contrato.inquilino || "", proprietario: contrato.proprietario || "",
        vistoria_entrada: contrato.vistoria_entrada, vistoria_video: contrato.vistoria_video,
        apolice_seguro: contrato.apolice_seguro, observacoes: contrato.observacoes || "",
        matricula: contrato.matricula || "",
        proprietario_id: contrato.proprietario_id || "",
        indice_correcao: contrato.indice_correcao || "IGPM",
        percentual_correcao: contrato.percentual_correcao || 0,
        data_proxima_correcao: contrato.data_proxima_correcao || "",
        dia_vencimento_aluguel: contrato.dia_vencimento_aluguel || 10,
        data_vencimento_apolice: contrato.data_vencimento_apolice || "",
        tipo_garantia: contrato.tipo_garantia || "seguro_fianca",
        contrato_anexo_url: contrato.contrato_anexo_url || "",
        apolice_anexo_url: contrato.apolice_anexo_url || "",
        vistoria_anexo_url: contrato.vistoria_anexo_url || "",
        numero_agua: contrato.numero_agua || "",
        numero_luz: contrato.numero_luz || "",
        inscricao_iptu: contrato.inscricao_iptu || "",
        canal_origem: contrato.canal_origem || "",
        parceria_envolvidos: (contrato as any).parceria_envolvidos || [],
        proprietario_telefone: contrato.proprietario_telefone || "",
        proprietario_cpf: contrato.proprietario_cpf || "",
        proprietario_email: (contrato as any).proprietario_email || "",
        proprietario_rg: (contrato as any).proprietario_rg || "",
        proprietario_banco: (contrato as any).proprietario_banco || "",
        proprietario_agencia: (contrato as any).proprietario_agencia || "",
        proprietario_conta: (contrato as any).proprietario_conta || "",
        proprietario_pix: (contrato as any).proprietario_pix || "",
        comissao_percentual: contrato.comissao_percentual || 0,
        comissao_valor: contrato.comissao_valor || 0,
        comissao_tipo: (contrato as any).comissao_tipo || "mensal",
        tem_parceria: contrato.tem_parceria || false,
        parceiro_nome: contrato.parceiro_nome || "",
        parceiro_comissao_percentual: contrato.parceiro_comissao_percentual || 0,
        parceiro_comissao_valor: contrato.parceiro_comissao_valor || 0,
        captador_nome: contrato.captador_nome || "",
        captador_telefone: contrato.captador_telefone || "",
        captador_comissao_percentual: contrato.captador_comissao_percentual || 0,
        captador_comissao_valor: contrato.captador_comissao_valor || 0,
        imposto_tipo: contrato.imposto_tipo || "",
        imposto_percentual: contrato.imposto_percentual || 0,
        imposto_valor: contrato.imposto_valor || 0,
        corretor_nome: contrato.corretor_nome || "",
        corretor_comissao_percentual: contrato.corretor_comissao_percentual || 0,
        corretor_comissao_valor: contrato.corretor_comissao_valor || 0,
        valor_iptu: (contrato as any).valor_iptu || 0,
        iptu_parcelado: (contrato as any).iptu_parcelado || false,
        valor_condominio: (contrato as any).valor_condominio || 0,
        condominio_inclui: (contrato as any).condominio_inclui || "",
        inquilino_telefone: (contrato as any).inquilino_telefone || "",
        inquilino_cpf: (contrato as any).inquilino_cpf || "",
        inquilino_email: (contrato as any).inquilino_email || "",
        inquilino_rg: (contrato as any).inquilino_rg || "",
        inquilino2_nome: (contrato as any).inquilino2_nome || "",
        inquilino2_cpf: (contrato as any).inquilino2_cpf || "",
        inquilino2_telefone: (contrato as any).inquilino2_telefone || "",
        inquilino2_email: (contrato as any).inquilino2_email || "",
        inquilino2_rg: (contrato as any).inquilino2_rg || "",
        caucao_valor: (contrato as any).caucao_valor || 0,
        caucao_quantidade: (contrato as any).caucao_quantidade || 1,
        conjuge_proprietario: (contrato as any).conjuge_proprietario || "",
        conjuge_cpf: (contrato as any).conjuge_cpf || "",
        conjuge_telefone: (contrato as any).conjuge_telefone || "",
        conjuge_email: (contrato as any).conjuge_email || "",
        fiador_matricula_url: (contrato as any).fiador_matricula_url || "",
        caucao_comprovante_url: (contrato as any).caucao_comprovante_url || "",
        vistoria_video_url: (contrato as any).vistoria_video_url || "",
        aditivo_anexo_url: (contrato as any).aditivo_anexo_url || "",
        seguro_incendio_anexo_url: (contrato as any).seguro_incendio_anexo_url || "",
        seguro_fianca_anexo_url: (contrato as any).seguro_fianca_anexo_url || "",
        fiador_nome: (contrato as any).fiador_nome || "",
        fiador_cpf: (contrato as any).fiador_cpf || "",
        fiador_telefone: (contrato as any).fiador_telefone || "",
        fiador_email: (contrato as any).fiador_email || "",
        fiador_estado_civil: (contrato as any).fiador_estado_civil || "",
        fiador_endereco: (contrato as any).fiador_endereco || "",
        fiador_renda_url: (contrato as any).fiador_renda_url || "",
        fiador2_nome: (contrato as any).fiador2_nome || "",
        fiador2_cpf: (contrato as any).fiador2_cpf || "",
        fiador2_telefone: (contrato as any).fiador2_telefone || "",
        fiador2_email: (contrato as any).fiador2_email || "",
        fiador2_estado_civil: (contrato as any).fiador2_estado_civil || "",
        fiador2_endereco: (contrato as any).fiador2_endereco || "",
        fiador2_matricula_url: (contrato as any).fiador2_matricula_url || "",
        fiador2_renda_url: (contrato as any).fiador2_renda_url || "",
        comprovante_agua_url: (contrato as any).comprovante_agua_url || "",
        comprovante_luz_url: (contrato as any).comprovante_luz_url || "",
        numero_unidade: (contrato as any).numero_unidade || "",
      }));
      setValorDisplay(formatCurrencyDisplay(contrato.valor));
      setPercentualDisplay(formatPercentDisplay(contrato.percentual_correcao || 0));
      setCurrencyDisplays({});
    }
  }, [contrato, open]);

  useEffect(() => {
    if (!open) return;
    try {
      localStorage.setItem(
        getContratoFormBackupKey(contrato?.id),
        JSON.stringify({ form, valorDisplay, percentualDisplay, currencyDisplays }),
      );
    } catch {
      // ignore quota errors
    }
  }, [open, contrato?.id, form, valorDisplay, percentualDisplay, currencyDisplays]);

  const handleGenericFileUpload = async (file: File, urlKey: string) => {
    if (!contrato?.id) {
      toast({
        title: "Salve o contrato antes de anexar",
        description: "Os anexos só podem ser enviados depois que o contrato for criado.",
        variant: "destructive",
      });
      return;
    }

    setUploading(urlKey);
    try {
      const ext = getSafeFileExtension(file);
      const path = `${contrato.id}/${urlKey}_${Date.now()}.${ext}`;

      const storedPath = await uploadContratoFilePrivate(file, path);
      if (!storedPath) {
        throw new Error("Falha ao enviar arquivo");
      }

      // Persist the storage path so links can always be renewed later
      const { error: updateError } = await supabase
        .from("contratos")
        .update({ [urlKey]: path } as any)
        .eq("id", contrato.id);

      if (updateError) {
        console.error("Erro ao salvar URL do anexo:", updateError);
        throw new Error(updateError.message);
      }

      set(urlKey as keyof ContratoFormState, storedPath);
      toast({ title: "Arquivo enviado e salvo!" });
    } catch (err: any) {
      console.error("Upload error:", err);
      toast({
        title: "Erro no upload",
        description: err?.message || "Não foi possível enviar o arquivo.",
        variant: "destructive",
      });
    } finally {
      setUploading(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.titulo.trim()) return;
    const normalizedForm = recalculateCommissionState(form);
    const comissaoValor = normalizedForm.comissao_valor || 0;
    const parceiroValor = normalizedForm.parceiro_comissao_valor || 0;
    const captadorValor = normalizedForm.captador_comissao_valor || 0;
    const corretorValor = normalizedForm.corretor_comissao_valor || 0;
    const impostoValorTotal = normalizedForm.imposto_valor || 0;
    const impostoValor = normalizedForm.tem_parceria ? impostoValorTotal / 2 : impostoValorTotal;

    const payload: any = {
      ...normalizedForm,
      data_inicio: normalizedForm.data_inicio || null,
      data_fim: normalizedForm.data_fim || null,
      inquilino: normalizedForm.inquilino || null,
      cliente_telefone: normalizedForm.cliente_telefone || null,
      cliente_cpf: normalizedForm.cliente_cpf || null,
      cliente_email: normalizedForm.cliente_email || null,
      cliente_rg: normalizedForm.cliente_rg || null,
      proprietario: normalizedForm.proprietario || null,
      observacoes: normalizedForm.observacoes || null,
      matricula: normalizedForm.matricula || null,
      proprietario_id: normalizedForm.proprietario_id || null,
      data_proxima_correcao: normalizedForm.data_proxima_correcao || null,
      data_vencimento_apolice: normalizedForm.data_vencimento_apolice || null,
      contrato_anexo_url: normalizedForm.contrato_anexo_url || null,
      apolice_anexo_url: normalizedForm.apolice_anexo_url || null,
      vistoria_anexo_url: normalizedForm.vistoria_anexo_url || null,
      numero_agua: normalizedForm.numero_agua || null,
      numero_luz: normalizedForm.numero_luz || null,
      inscricao_iptu: normalizedForm.inscricao_iptu || null,
      valor_iptu: normalizedForm.valor_iptu || 0,
      iptu_parcelado: normalizedForm.iptu_parcelado,
      valor_condominio: normalizedForm.valor_condominio || 0,
      condominio_inclui: normalizedForm.condominio_inclui || null,
      inquilino_telefone: normalizedForm.inquilino_telefone || null,
      inquilino_cpf: normalizedForm.inquilino_cpf || null,
      inquilino_email: normalizedForm.inquilino_email || null,
      inquilino_rg: normalizedForm.inquilino_rg || null,
      inquilino2_nome: normalizedForm.inquilino2_nome || null,
      inquilino2_cpf: normalizedForm.inquilino2_cpf || null,
      inquilino2_telefone: normalizedForm.inquilino2_telefone || null,
      inquilino2_email: normalizedForm.inquilino2_email || null,
      inquilino2_rg: normalizedForm.inquilino2_rg || null,
      canal_origem: normalizedForm.canal_origem || null,
      parceria_envolvidos: normalizedForm.parceria_envolvidos?.length ? normalizedForm.parceria_envolvidos : null,
      proprietario_telefone: normalizedForm.proprietario_telefone || null,
      proprietario_cpf: normalizedForm.proprietario_cpf || null,
      proprietario_email: normalizedForm.proprietario_email || null,
      proprietario_rg: normalizedForm.proprietario_rg || null,
      proprietario_banco: normalizedForm.proprietario_banco || null,
      proprietario_agencia: normalizedForm.proprietario_agencia || null,
      proprietario_conta: normalizedForm.proprietario_conta || null,
      proprietario_pix: normalizedForm.proprietario_pix || null,
      parceiro_nome: normalizedForm.parceiro_nome || null,
      captador_nome: normalizedForm.captador_nome || null,
      captador_telefone: normalizedForm.captador_telefone || null,
      imposto_tipo: normalizedForm.imposto_tipo || null,
      corretor_nome: normalizedForm.corretor_nome || null,
      comissao_valor: comissaoValor,
      comissao_tipo: normalizedForm.comissao_tipo || "mensal",
      parceiro_comissao_valor: parceiroValor,
      captador_comissao_valor: captadorValor,
      corretor_comissao_valor: corretorValor,
      imposto_valor: impostoValor,
      conjuge_proprietario: normalizedForm.conjuge_proprietario || null,
      conjuge_cpf: normalizedForm.conjuge_cpf || null,
      conjuge_telefone: normalizedForm.conjuge_telefone || null,
      conjuge_email: normalizedForm.conjuge_email || null,
      fiador_matricula_url: normalizedForm.fiador_matricula_url || null,
      caucao_comprovante_url: normalizedForm.caucao_comprovante_url || null,
      vistoria_video_url: normalizedForm.vistoria_video_url || null,
      aditivo_anexo_url: normalizedForm.aditivo_anexo_url || null,
      seguro_incendio_anexo_url: normalizedForm.seguro_incendio_anexo_url || null,
      seguro_fianca_anexo_url: normalizedForm.seguro_fianca_anexo_url || null,
      fiador_nome: normalizedForm.fiador_nome || null,
      fiador_cpf: normalizedForm.fiador_cpf || null,
      fiador_telefone: normalizedForm.fiador_telefone || null,
      fiador_email: normalizedForm.fiador_email || null,
      fiador_estado_civil: normalizedForm.fiador_estado_civil || null,
      fiador_endereco: normalizedForm.fiador_endereco || null,
      fiador_renda_url: normalizedForm.fiador_renda_url || null,
      fiador2_nome: normalizedForm.fiador2_nome || null,
      fiador2_cpf: normalizedForm.fiador2_cpf || null,
      fiador2_telefone: normalizedForm.fiador2_telefone || null,
      fiador2_email: normalizedForm.fiador2_email || null,
      fiador2_estado_civil: normalizedForm.fiador2_estado_civil || null,
      fiador2_endereco: normalizedForm.fiador2_endereco || null,
      fiador2_matricula_url: normalizedForm.fiador2_matricula_url || null,
      fiador2_renda_url: normalizedForm.fiador2_renda_url || null,
      comprovante_agua_url: normalizedForm.comprovante_agua_url || null,
      comprovante_luz_url: normalizedForm.comprovante_luz_url || null,
      numero_unidade: normalizedForm.numero_unidade || null,
    };
    await onSave(payload);
    clearContratoFormBackup(contrato?.id);
  };

  const set = <K extends keyof ContratoFormState>(key: K, value: ContratoFormState[K]) => setForm(prev => {
    const next = { ...prev, [key]: value } as ContratoFormState;
    return commissionRecalculationKeys.includes(key) ? recalculateCommissionState(next) : next;
  });

  const handleProprietarioChange = (value: string) => {
    const proprietarioId = value === "none" ? "" : value;

    if (!proprietarioId) {
      set("proprietario_id", "");
      return;
    }

    const selectedProprietario = proprietarios.find((item) => item.id === proprietarioId);

    if (!selectedProprietario) {
      set("proprietario_id", proprietarioId);
      return;
    }

    setForm((prev) => ({
      ...prev,
      proprietario_id: proprietarioId,
      proprietario: selectedProprietario.nome || "",
      proprietario_telefone: selectedProprietario.telefone ? maskPhone(selectedProprietario.telefone) : "",
      proprietario_cpf: selectedProprietario.cpf_cnpj ? maskCpfCnpj(selectedProprietario.cpf_cnpj) : "",
      proprietario_email: selectedProprietario.email || "",
      proprietario_banco: selectedProprietario.banco || "",
      proprietario_agencia: selectedProprietario.agencia || "",
      proprietario_conta: selectedProprietario.conta || "",
      proprietario_pix: selectedProprietario.pix || "",
    }));
  };
  
  const getCurrDisplay = (key: string, numVal: number) => currencyDisplays[key] !== undefined ? currencyDisplays[key] : (numVal ? formatCurrencyDisplay(numVal) : "");
  const setCurrDisplay = (key: string, raw: string) => setCurrencyDisplays(prev => ({ ...prev, [key]: raw }));
  const clearCurrDisplay = (key: string) => setCurrencyDisplays(prev => { const n = { ...prev }; delete n[key]; return n; });
  const currencyInputProps = (key: CurrencyFieldKey, numVal: number) => ({
    type: "text" as const,
    inputMode: "decimal" as const,
    placeholder: "0,00",
    value: getCurrDisplay(key, numVal),
    onFocus: (e: React.FocusEvent<HTMLInputElement>) => {
      if (numVal === 0) {
        setCurrDisplay(key, "");
        return;
      }
      setCurrDisplay(key, sanitizeNumberInput(getCurrDisplay(key, numVal)));
      requestAnimationFrame(() => e.target.select());
    },
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const nextValue = sanitizeNumberInput(e.target.value);
      setCurrDisplay(key, nextValue);
      set(key, parseCurrencyInput(nextValue));
    },
    onBlur: () => clearCurrDisplay(key),
  });

  const isLocacao = form.tipo === "Locação";
  const calculatedForm = recalculateCommissionState(form);
  const comissaoValorCalc = calculatedForm.comissao_valor || 0;
  const parceiroValorCalc = calculatedForm.parceiro_comissao_valor || 0;
  const captadorValorCalc = calculatedForm.captador_comissao_valor || 0;
  const corretorValorCalc = calculatedForm.corretor_comissao_valor || 0;
  const impostoValorCalcTotal = calculatedForm.imposto_valor || 0;
  const impostoValorCalc = calculatedForm.tem_parceria ? impostoValorCalcTotal / 2 : impostoValorCalcTotal;
  const fmtCur = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const handleOpenArquivo = async (pathOrUrl: string, sourceField: FileUploadFieldKey) => {
    await openContratoFileViewer(
      pathOrUrl,
      undefined,
      contrato?.id
        ? {
            contractId: contrato.id,
            sourceTable: "contratos",
            sourceField,
            recordId: contrato.id,
          }
        : undefined,
    );
  };

  const FileUploadField = ({ label, urlKey }: { label: string; urlKey: FileUploadFieldKey }) => {
    const url = (form as any)[urlKey];
    const canUpload = Boolean(contrato?.id);

    return (
      <div className="space-y-1">
        <Label className="text-sm">{label}</Label>
        {url ? (
          <div className="flex min-h-[44px] items-center gap-2 rounded-lg border border-success/20 bg-success/5 p-2">
            <FileText className="h-4 w-4 flex-shrink-0 text-success" />
            <button type="button" onClick={() => void handleOpenArquivo(url, urlKey)} className="flex-1 truncate text-left text-xs text-primary hover:underline">
              Visualizar arquivo
            </button>
            <button
              type="button"
              aria-label={`Remover ${label}`}
              onClick={() => set(urlKey, "")}
              className="p-1 text-muted-foreground transition-all duration-200 hover:text-destructive"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <label
            className={`flex min-h-[44px] items-center gap-2 rounded-lg border border-dashed border-border p-3 transition-all duration-200 ${
              canUpload ? "cursor-pointer hover:border-primary/50" : "cursor-not-allowed opacity-60"
            }`}
          >
            {uploading === urlKey ? (
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            ) : (
              <Upload className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="text-xs text-muted-foreground">
              {canUpload ? "Clique para enviar" : "Salve o contrato para anexar"}
            </span>
            <input
              type="file"
              className="hidden"
              accept={getFileAccept(urlKey)}
              disabled={!canUpload || uploading === urlKey}
              onChange={e => { const f = e.target.files?.[0]; if (f) void handleGenericFileUpload(f, urlKey); e.target.value = ""; }}
            />
          </label>
        )}
      </div>
    );
  };

  const safeOpenChange = (value: boolean) => {
    if (!value && document.hidden) return;
    if (!value) clearContratoFormBackup(contrato?.id);
    onOpenChange(value);
  };

  return (
    <Dialog open={open} onOpenChange={safeOpenChange}>
      <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-auto">
        <DialogHeader>
          <DialogTitle>{contrato ? "Editar Contrato" : "Novo Contrato"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Título *</Label>
              <Input value={form.titulo} onChange={e => set("titulo", e.target.value)} placeholder="Ex: Contrato de Venda - Apt Vila Mariana" required />
            </div>
            <div>
              <Label>Nº Apartamento / Unidade</Label>
              <Input value={form.numero_unidade} onChange={e => set("numero_unidade", e.target.value)} placeholder="Ex: 101, Bloco A" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Cliente *</Label>
              <Input value={form.cliente} onChange={e => set("cliente", e.target.value)} placeholder="Nome do cliente" required />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={v => set("tipo", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Venda">Venda</SelectItem>
                  <SelectItem value="Locação">Locação</SelectItem>
                  <SelectItem value="Administração">Administração de Imóveis</SelectItem>
                  <SelectItem value="Exclusividade">Exclusividade (Venda)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <Label>Telefone Cliente</Label>
              <Input value={form.cliente_telefone} onChange={e => set("cliente_telefone", maskPhone(e.target.value))} placeholder="(00) 00000-0000" />
            </div>
            <div>
               <Label>CPF Cliente</Label>
               <Input value={form.cliente_cpf} onChange={e => set("cliente_cpf", maskCpf(e.target.value))} placeholder="000.000.000-00" />
             </div>
             <div>
               <Label>RG Cliente</Label>
               <Input value={form.cliente_rg} onChange={e => set("cliente_rg", e.target.value)} placeholder="Nº RG" />
             </div>
             <div>
               <Label>E-mail Cliente</Label>
               <Input type="email" value={form.cliente_email} onChange={e => set("cliente_email", e.target.value)} placeholder="cliente@email.com" />
             </div>
           </div>
           <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
             <div>
               <Label>Valor (R$)</Label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={valorDisplay}
                  onFocus={e => {
                    if (form.valor === 0) {
                      setValorDisplay("");
                      return;
                    }
                    setValorDisplay(sanitizeNumberInput(formatCurrencyDisplay(form.valor)));
                    requestAnimationFrame(() => e.target.select());
                  }}
                onChange={e => {
                  const nextValue = sanitizeNumberInput(e.target.value);
                  setValorDisplay(nextValue);
                  set("valor", parseCurrencyInput(nextValue));
                }}
                onBlur={() => setValorDisplay(form.valor ? formatCurrencyDisplay(form.valor) : "")}
              />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_CONTRATO.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Matrícula</Label>
              <Input value={form.matricula} onChange={e => set("matricula", e.target.value)} placeholder="Nº matrícula" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label>Nº Cliente Água</Label>
              <Input value={form.numero_agua} onChange={e => set("numero_agua", e.target.value)} placeholder="Nº conta água" />
            </div>
            <div>
              <Label>Nº Cliente Luz</Label>
              <Input value={form.numero_luz} onChange={e => set("numero_luz", e.target.value)} placeholder="Nº conta luz" />
            </div>
            <div>
              <Label>Inscrição IPTU</Label>
              <Input value={form.inscricao_iptu} onChange={e => set("inscricao_iptu", e.target.value)} placeholder="Nº inscrição IPTU" />
            </div>
          </div>
          <div className="space-y-3 p-3 rounded-lg bg-secondary/30">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-foreground">📄 Comprovantes de Transferência</p>
              <p className="text-xs text-muted-foreground">Anexe aqui os comprovantes de transferência de água e luz.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FileUploadField label="Comprovante Transferência Água" urlKey="comprovante_agua_url" />
              <FileUploadField label="Comprovante Transferência Luz" urlKey="comprovante_luz_url" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Data Início</Label>
              <Input type="date" value={form.data_inicio} onChange={e => set("data_inicio", e.target.value)} />
            </div>
            <div>
              <Label>Data Fim</Label>
              <Input type="date" value={form.data_fim} onChange={e => set("data_fim", e.target.value)} />
            </div>
          </div>

          <div className="space-y-3 p-3 rounded-lg bg-secondary/30">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-foreground">👤 Dados do Proprietário</p>
              {isLocacao && (
                <p className="text-xs text-muted-foreground">
                  Ao vincular um proprietário, os dados bancários do aluguel também são preenchidos automaticamente.
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Proprietário vinculado</Label>
                <Select value={form.proprietario_id || "none"} onValueChange={handleProprietarioChange}>
                  <SelectTrigger><SelectValue placeholder="Selecione um proprietário" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {proprietarios.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Proprietário (manual)</Label>
                <Input value={form.proprietario} onChange={e => set("proprietario", e.target.value)} placeholder="Nome do proprietário" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <Label>Telefone Proprietário</Label>
                <Input value={form.proprietario_telefone} onChange={e => set("proprietario_telefone", maskPhone(e.target.value))} placeholder="(00) 00000-0000" />
              </div>
              <div>
                <Label>CPF/CNPJ Proprietário</Label>
                <Input value={form.proprietario_cpf} onChange={e => set("proprietario_cpf", maskCpfCnpj(e.target.value))} placeholder="000.000.000-00" />
              </div>
              <div>
                <Label>RG Proprietário</Label>
                <Input value={form.proprietario_rg} onChange={e => set("proprietario_rg", e.target.value)} placeholder="Nº RG" />
              </div>
              <div>
                <Label>E-mail Proprietário</Label>
                <Input type="email" value={form.proprietario_email} onChange={e => set("proprietario_email", e.target.value)} placeholder="proprietario@email.com" />
              </div>
            </div>
          </div>

          {/* Dados Bancários do Proprietário */}
          <div className="space-y-3 p-3 rounded-lg bg-secondary/30">
            <p className="text-xs font-semibold text-foreground">🏦 Dados Bancários do Proprietário</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <Label>Banco</Label>
                <Input value={form.proprietario_banco} onChange={e => set("proprietario_banco", e.target.value)} placeholder="Nome do banco" />
              </div>
              <div>
                <Label>Agência</Label>
                <Input value={form.proprietario_agencia} onChange={e => set("proprietario_agencia", e.target.value)} placeholder="0000" />
              </div>
              <div>
                <Label>Conta</Label>
                <Input value={form.proprietario_conta} onChange={e => set("proprietario_conta", e.target.value)} placeholder="00000-0" />
              </div>
              <div>
                <Label>Chave PIX</Label>
                <Input value={form.proprietario_pix} onChange={e => set("proprietario_pix", e.target.value)} placeholder="CPF, e-mail, telefone ou chave aleatória" />
              </div>
            </div>
          </div>

          {/* Cônjuge do Proprietário */}
          <div className="space-y-3 p-3 rounded-lg bg-secondary/30">
            <p className="text-xs font-semibold text-foreground">👫 Cônjuge / Outro Proprietário</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nome do Cônjuge</Label>
                <Input value={form.conjuge_proprietario} onChange={e => set("conjuge_proprietario", e.target.value)} placeholder="Nome completo" />
              </div>
              <div>
                <Label>CPF do Cônjuge</Label>
                <Input value={form.conjuge_cpf} onChange={e => set("conjuge_cpf", maskCpf(e.target.value))} placeholder="000.000.000-00" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Telefone do Cônjuge</Label>
                <Input value={form.conjuge_telefone} onChange={e => set("conjuge_telefone", maskPhone(e.target.value))} placeholder="(00) 00000-0000" />
              </div>
              <div>
                <Label>E-mail do Cônjuge</Label>
                <Input type="email" value={form.conjuge_email} onChange={e => set("conjuge_email", e.target.value)} placeholder="conjuge@email.com" />
              </div>
            </div>
          </div>

          {/* Anexos - sempre visíveis */}
          <div className="space-y-3 p-3 rounded-lg bg-secondary/30">
            <p className="text-xs font-semibold text-foreground">📎 Anexos do Contrato</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <FileUploadField label="Contrato (PDF)" urlKey="contrato_anexo_url" />
              <FileUploadField label="Aditivo Contratual" urlKey="aditivo_anexo_url" />
              <FileUploadField label="Vistoria" urlKey="vistoria_anexo_url" />
            </div>
            {isLocacao && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
                  <FileUploadField label="Apólice Seguro Incêndio" urlKey="seguro_incendio_anexo_url" />
                  <FileUploadField label="Seguro Fiança (anexo)" urlKey="seguro_fianca_anexo_url" />
                  <FileUploadField label="Apólice Geral" urlKey="apolice_anexo_url" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
                  <FileUploadField label="Comprovante de Caução" urlKey="caucao_comprovante_url" />
                  <FileUploadField label="Vídeo de Vistoria (anexo)" urlKey="vistoria_video_url" />
                </div>
              </>
            )}
            {!isLocacao && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                <FileUploadField label="Apólice" urlKey="apolice_anexo_url" />
              </div>
            )}
          </div>

          {/* IPTU e Condomínio - sempre visíveis */}
          <div className="space-y-3 p-3 rounded-lg bg-secondary/30">
            <p className="text-xs font-semibold text-foreground">🏛️ IPTU e Condomínio</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Valor IPTU (R$)</Label>
                <Input {...currencyInputProps("valor_iptu", form.valor_iptu)} />
              </div>
              <div className="flex items-center gap-2 pt-5">
                <Switch checked={form.iptu_parcelado} onCheckedChange={v => set("iptu_parcelado", v)} />
                <Label className="text-sm">{form.iptu_parcelado ? "Parcelado 6x" : "À vista"}</Label>
              </div>
              {form.iptu_parcelado && form.valor_iptu > 0 && (
                <div className="flex items-end">
                  <p className="text-sm text-muted-foreground pb-2">Parcela: {fmtCur(form.valor_iptu / 6)}</p>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valor Condomínio (R$)</Label>
                <Input {...currencyInputProps("valor_condominio", form.valor_condominio)} />
              </div>
              <div>
                <Label>O que inclui</Label>
                <Input value={form.condominio_inclui} onChange={e => set("condominio_inclui", e.target.value)} placeholder="Água, gás, portaria..." />
              </div>
            </div>
          </div>

          <ContratoComprovantesMensaisSection
            contratoId={contrato?.id}
            startYear={form.data_inicio ? new Date(`${form.data_inicio}T00:00:00`).getFullYear() : null}
          />

          {isLocacao && (
            <>
              <p className="text-xs font-semibold text-foreground pt-1">Dados da Locação</p>

              <ContratoAnexosAnuaisSection
                contratoId={contrato?.id}
                startYear={form.data_inicio ? new Date(`${form.data_inicio}T00:00:00`).getFullYear() : null}
              />

              <div>
                <Label>Inquilino (Locatário)</Label>
                <Input value={form.inquilino} onChange={e => set("inquilino", e.target.value)} placeholder="Nome do inquilino" />
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <Label>Telefone Locatário</Label>
                  <Input value={form.inquilino_telefone} onChange={e => set("inquilino_telefone", maskPhone(e.target.value))} placeholder="(00) 00000-0000" />
                </div>
                <div>
                  <Label>CPF Locatário</Label>
                  <Input value={form.inquilino_cpf} onChange={e => set("inquilino_cpf", maskCpf(e.target.value))} placeholder="000.000.000-00" />
                </div>
                <div>
                  <Label>RG Locatário</Label>
                  <Input value={form.inquilino_rg} onChange={e => set("inquilino_rg", e.target.value)} placeholder="Nº RG" />
                </div>
                <div>
                  <Label>E-mail Locatário</Label>
                  <Input type="email" value={form.inquilino_email} onChange={e => set("inquilino_email", e.target.value)} placeholder="inquilino@email.com" />
                </div>
              </div>

              {/* Inquilino 2 */}
              <div className="space-y-3 p-3 rounded-lg bg-secondary/30">
                <p className="text-xs font-semibold text-foreground">👤 Inquilino 2 (opcional)</p>
                <div>
                  <Label>Nome do Inquilino 2</Label>
                  <Input value={form.inquilino2_nome} onChange={e => set("inquilino2_nome", e.target.value)} placeholder="Nome completo" />
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <Label>Telefone</Label>
                    <Input value={form.inquilino2_telefone} onChange={e => set("inquilino2_telefone", maskPhone(e.target.value))} placeholder="(00) 00000-0000" />
                  </div>
                  <div>
                    <Label>CPF</Label>
                    <Input value={form.inquilino2_cpf} onChange={e => set("inquilino2_cpf", maskCpf(e.target.value))} placeholder="000.000.000-00" />
                  </div>
                  <div>
                    <Label>RG</Label>
                    <Input value={form.inquilino2_rg} onChange={e => set("inquilino2_rg", e.target.value)} placeholder="Nº RG" />
                  </div>
                  <div>
                    <Label>E-mail</Label>
                    <Input type="email" value={form.inquilino2_email} onChange={e => set("inquilino2_email", e.target.value)} placeholder="inquilino2@email.com" />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Dia Vencimento</Label>
                  <Input type="number" min={1} max={31} value={form.dia_vencimento_aluguel || ""} onChange={e => set("dia_vencimento_aluguel", Number(e.target.value) || 0)} placeholder="10" />
                </div>
                <div>
                  <Label>Índice Correção</Label>
                  <Select value={form.indice_correcao} onValueChange={v => set("indice_correcao", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="IGPM">IGP-M</SelectItem>
                      <SelectItem value="IPCA">IPCA</SelectItem>
                      <SelectItem value="INPC">INPC</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>% Correção</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={percentualDisplay}
                    onFocus={() => { if (form.percentual_correcao === 0) setPercentualDisplay(""); }}
                    onChange={e => {
                      const nextValue = sanitizeNumberInput(e.target.value);
                      setPercentualDisplay(nextValue);
                      set("percentual_correcao", parseCurrencyInput(nextValue));
                    }}
                    onBlur={() => setPercentualDisplay(form.percentual_correcao ? formatPercentDisplay(form.percentual_correcao) : "")}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Próxima Correção</Label>
                  <Input type="date" value={form.data_proxima_correcao} onChange={e => set("data_proxima_correcao", e.target.value)} />
                </div>
                <div>
                  <Label>Venc. Apólice Garantia</Label>
                  <Input type="date" value={form.data_vencimento_apolice} onChange={e => set("data_vencimento_apolice", e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Tipo de Garantia</Label>
                <Select value={form.tipo_garantia} onValueChange={v => set("tipo_garantia", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="seguro_fianca">Seguro Fiança</SelectItem>
                    <SelectItem value="caucao">Caução</SelectItem>
                    <SelectItem value="fiador">Fiador</SelectItem>
                    <SelectItem value="titulo_capitalizacao">Título de Capitalização</SelectItem>
                    <SelectItem value="renda_locatario">Apenas Renda do Locatário</SelectItem>
                  </SelectContent>
              </Select>
              </div>
              {form.tipo_garantia === "caucao" && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Valor da Caução (R$)</Label>
                      <Input {...currencyInputProps("caucao_valor", form.caucao_valor)} />
                    </div>
                    <div>
                      <Label>Quantidade (meses)</Label>
                      <Input type="number" min={1} max={12} value={form.caucao_quantidade || 1}
                        onChange={e => set("caucao_quantidade", Number(e.target.value) || 1)} />
                    </div>
                  </div>
                  <FileUploadField label="Comprovante de Caução" urlKey="caucao_comprovante_url" />
                </div>
              )}
              {form.tipo_garantia === "fiador" && (
                <>
                <div className="space-y-3 p-3 rounded-lg bg-secondary/30">
                  <p className="text-xs font-semibold text-foreground">🛡️ Dados do Fiador 1</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Nome do Fiador</Label>
                      <Input value={form.fiador_nome} onChange={e => set("fiador_nome", e.target.value)} placeholder="Nome completo" />
                    </div>
                    <div>
                      <Label>CPF do Fiador</Label>
                      <Input value={form.fiador_cpf} onChange={e => set("fiador_cpf", maskCpf(e.target.value))} placeholder="000.000.000-00" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Telefone</Label>
                      <Input value={form.fiador_telefone} onChange={e => set("fiador_telefone", maskPhone(e.target.value))} placeholder="(00) 00000-0000" />
                    </div>
                    <div>
                      <Label>E-mail</Label>
                      <Input type="email" value={form.fiador_email} onChange={e => set("fiador_email", e.target.value)} placeholder="fiador@email.com" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Estado Civil</Label>
                      <Select value={form.fiador_estado_civil || "none"} onValueChange={v => set("fiador_estado_civil", v === "none" ? "" : v)}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Não informado</SelectItem>
                          <SelectItem value="solteiro">Solteiro(a)</SelectItem>
                          <SelectItem value="casado">Casado(a)</SelectItem>
                          <SelectItem value="divorciado">Divorciado(a)</SelectItem>
                          <SelectItem value="viuvo">Viúvo(a)</SelectItem>
                          <SelectItem value="uniao_estavel">União Estável</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Endereço</Label>
                      <Input value={form.fiador_endereco} onChange={e => set("fiador_endereco", e.target.value)} placeholder="Endereço do fiador" />
                    </div>
                  </div>
                  <FileUploadField label="Matrícula/Escritura do Fiador 1" urlKey="fiador_matricula_url" />
                  <FileUploadField label="Comprovante de Renda - Fiador 1" urlKey="fiador_renda_url" />
                </div>

                <div className="space-y-3 p-3 rounded-lg bg-secondary/30">
                  <p className="text-xs font-semibold text-foreground">🛡️ Dados do Fiador 2</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Nome do Fiador 2</Label>
                      <Input value={form.fiador2_nome} onChange={e => set("fiador2_nome", e.target.value)} placeholder="Nome completo" />
                    </div>
                    <div>
                      <Label>CPF do Fiador 2</Label>
                      <Input value={form.fiador2_cpf} onChange={e => set("fiador2_cpf", maskCpf(e.target.value))} placeholder="000.000.000-00" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Telefone</Label>
                      <Input value={form.fiador2_telefone} onChange={e => set("fiador2_telefone", maskPhone(e.target.value))} placeholder="(00) 00000-0000" />
                    </div>
                    <div>
                      <Label>E-mail</Label>
                      <Input type="email" value={form.fiador2_email} onChange={e => set("fiador2_email", e.target.value)} placeholder="fiador2@email.com" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Estado Civil</Label>
                      <Select value={form.fiador2_estado_civil || "none"} onValueChange={v => set("fiador2_estado_civil", v === "none" ? "" : v)}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Não informado</SelectItem>
                          <SelectItem value="solteiro">Solteiro(a)</SelectItem>
                          <SelectItem value="casado">Casado(a)</SelectItem>
                          <SelectItem value="divorciado">Divorciado(a)</SelectItem>
                          <SelectItem value="viuvo">Viúvo(a)</SelectItem>
                          <SelectItem value="uniao_estavel">União Estável</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Endereço</Label>
                      <Input value={form.fiador2_endereco} onChange={e => set("fiador2_endereco", e.target.value)} placeholder="Endereço do fiador 2" />
                    </div>
                  </div>
                  <FileUploadField label="Matrícula/Escritura do Fiador 2" urlKey="fiador2_matricula_url" />
                  <FileUploadField label="Comprovante de Renda - Fiador 2" urlKey="fiador2_renda_url" />
                </div>
                </>
              )}
              <div className="space-y-3 p-3 rounded-lg bg-secondary/30">
                <p className="text-xs font-semibold text-foreground">Documentação da Locação</p>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Vistoria de entrada</Label>
                  <Switch checked={form.vistoria_entrada} onCheckedChange={v => set("vistoria_entrada", v)} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Vídeo de vistoria</Label>
                  <Switch checked={form.vistoria_video} onCheckedChange={v => set("vistoria_video", v)} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Apólice de seguro</Label>
                  <Switch checked={form.apolice_seguro} onCheckedChange={v => set("apolice_seguro", v)} />
                </div>
              </div>
            </>
          )}

          {/* Comissão e Financeiro */}
          <div className="space-y-3 p-3 rounded-lg bg-secondary/30">
            <p className="text-xs font-semibold text-foreground">💰 Comissão e Divisão</p>
            {isLocacao && (
              <div className="mb-2">
                <Label>Tipo de Comissão</Label>
                <Select value={form.comissao_tipo} onValueChange={v => set("comissao_tipo", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mensal">Mensal (sobre cada aluguel)</SelectItem>
                    <SelectItem value="anual">Anual (sobre 12 meses)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>% Comissão Total</Label>
                <Input type="text" inputMode="decimal" placeholder="6,00"
                  value={form.comissao_percentual || ""}
                  onChange={e => {
                    const pct = parseCurrencyInput(sanitizeNumberInput(e.target.value));
                    set("comissao_percentual", pct);
                    set("comissao_valor", (form.valor * pct) / 100);
                  }} />
              </div>
              <div>
                <Label>ou Valor (R$)</Label>
                <Input type="text" inputMode="decimal" placeholder="0,00"
                  value={getCurrDisplay("comissao_valor", calculatedForm.comissao_valor)}
                  onFocus={e => {
                    if (calculatedForm.comissao_valor === 0) {
                      setCurrDisplay("comissao_valor", "");
                      return;
                    }
                    setCurrDisplay("comissao_valor", sanitizeNumberInput(getCurrDisplay("comissao_valor", calculatedForm.comissao_valor)));
                    requestAnimationFrame(() => e.target.select());
                  }}
                  onChange={e => {
                    const raw = sanitizeNumberInput(e.target.value);
                    setCurrDisplay("comissao_valor", raw);
                    const val = parseCurrencyInput(raw);
                    set("comissao_valor", val);
                    set("comissao_percentual", getCommissionBaseValue(form) > 0 ? (val / getCommissionBaseValue(form)) * 100 : 0);
                  }}
                  onBlur={() => clearCurrDisplay("comissao_valor")} />
              </div>
              <div className="flex items-end">
                <p className="text-sm font-medium text-primary pb-2">{comissaoValorCalc > 0 ? fmtCur(comissaoValorCalc) : "—"}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Corretor Responsável</Label>
                <Input value={form.corretor_nome} onChange={e => set("corretor_nome", e.target.value)} placeholder="Nome" />
              </div>
              <div>
                <Label>% Comissão p/ Corretor</Label>
                <Input type="text" inputMode="decimal" placeholder="50"
                  value={form.corretor_comissao_percentual || ""}
                  onChange={e => {
                    const pct = parseCurrencyInput(sanitizeNumberInput(e.target.value));
                    const base = form.comissao_valor || comissaoValorCalc;
                    set("corretor_comissao_percentual", pct);
                    set("corretor_comissao_valor", (base * pct) / 100);
                  }} />
              </div>
              <div>
                <Label>ou Valor (R$)</Label>
                <Input type="text" inputMode="decimal" placeholder="0,00"
                  value={getCurrDisplay("corretor_comissao_valor", calculatedForm.corretor_comissao_valor)}
                  onFocus={() => { if (calculatedForm.corretor_comissao_valor === 0) setCurrDisplay("corretor_comissao_valor", ""); }}
                  onChange={e => {
                    const raw = sanitizeNumberInput(e.target.value);
                    setCurrDisplay("corretor_comissao_valor", raw);
                    const val = parseCurrencyInput(raw);
                    const base = comissaoValorCalc;
                    set("corretor_comissao_valor", val);
                    set("corretor_comissao_percentual", base > 0 ? (val / base) * 100 : 0);
                  }}
                  onBlur={() => clearCurrDisplay("corretor_comissao_valor")} />
                {corretorValorCalc > 0 && <p className="text-xs text-muted-foreground mt-1">{fmtCur(corretorValorCalc)}</p>}
              </div>
            </div>
            <div className="flex items-center justify-between pt-1">
              <Label className="text-sm">🤝 Parceria</Label>
              <Switch checked={form.tem_parceria} onCheckedChange={v => set("tem_parceria", v)} />
            </div>
            {form.tem_parceria && (
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Nome do Parceiro</Label>
                  <Input value={form.parceiro_nome} onChange={e => set("parceiro_nome", e.target.value)} placeholder="Imobiliária/Corretor parceiro" />
                </div>
                <div>
                  <Label>% Comissão p/ Parceiro</Label>
                  <Input type="text" inputMode="decimal" placeholder="50"
                    value={form.parceiro_comissao_percentual || ""}
                    onChange={e => {
                      const pct = parseCurrencyInput(sanitizeNumberInput(e.target.value));
                      const base = form.comissao_valor || comissaoValorCalc;
                      set("parceiro_comissao_percentual", pct);
                      set("parceiro_comissao_valor", (base * pct) / 100);
                    }} />
                </div>
                <div>
                  <Label>ou Valor (R$)</Label>
                  <Input type="text" inputMode="decimal" placeholder="0,00"
                    value={getCurrDisplay("parceiro_comissao_valor", calculatedForm.parceiro_comissao_valor)}
                    onFocus={() => { if (calculatedForm.parceiro_comissao_valor === 0) setCurrDisplay("parceiro_comissao_valor", ""); }}
                    onChange={e => {
                      const raw = sanitizeNumberInput(e.target.value);
                      setCurrDisplay("parceiro_comissao_valor", raw);
                      const val = parseCurrencyInput(raw);
                      const base = comissaoValorCalc;
                      set("parceiro_comissao_valor", val);
                      set("parceiro_comissao_percentual", base > 0 ? (val / base) * 100 : 0);
                    }}
                    onBlur={() => clearCurrDisplay("parceiro_comissao_valor")} />
                  {parceiroValorCalc > 0 && <p className="text-xs text-muted-foreground mt-1">{fmtCur(parceiroValorCalc)}</p>}
                </div>
              </div>
            )}
            <p className="text-xs font-semibold text-foreground pt-2">🎯 Captador</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <Label>Nome</Label>
                <Input value={form.captador_nome} onChange={e => set("captador_nome", e.target.value)} placeholder="Captador" />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input value={form.captador_telefone} onChange={e => set("captador_telefone", e.target.value)} placeholder="(00) 00000-0000" />
              </div>
              <div>
                <Label>% Comissão</Label>
                <Input type="text" inputMode="decimal" placeholder="10"
                  value={form.captador_comissao_percentual || ""}
                  onChange={e => {
                    const pct = parseCurrencyInput(sanitizeNumberInput(e.target.value));
                    const base = form.comissao_valor || comissaoValorCalc;
                    set("captador_comissao_percentual", pct);
                    set("captador_comissao_valor", (base * pct) / 100);
                  }} />
              </div>
              <div>
                <Label>ou Valor (R$)</Label>
                <Input type="text" inputMode="decimal" placeholder="0,00"
                  value={getCurrDisplay("captador_comissao_valor", calculatedForm.captador_comissao_valor)}
                  onFocus={() => { if (calculatedForm.captador_comissao_valor === 0) setCurrDisplay("captador_comissao_valor", ""); }}
                  onChange={e => {
                    const raw = sanitizeNumberInput(e.target.value);
                    setCurrDisplay("captador_comissao_valor", raw);
                    const val = parseCurrencyInput(raw);
                    const base = comissaoValorCalc;
                    set("captador_comissao_valor", val);
                    set("captador_comissao_percentual", base > 0 ? (val / base) * 100 : 0);
                  }}
                  onBlur={() => clearCurrDisplay("captador_comissao_valor")} />
                {captadorValorCalc > 0 && <p className="text-xs text-muted-foreground mt-1">{fmtCur(captadorValorCalc)}</p>}
              </div>
            </div>
            <p className="text-xs font-semibold text-foreground pt-2">🏛️ Impostos</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <Label>Tipo</Label>
                <Select value={form.imposto_tipo || "none"} onValueChange={v => set("imposto_tipo", v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    <SelectItem value="ISS">ISS</SelectItem>
                    <SelectItem value="IRPF">IRPF</SelectItem>
                    <SelectItem value="IRPJ">IRPJ</SelectItem>
                    <SelectItem value="CSLL">CSLL</SelectItem>
                    <SelectItem value="PIS_COFINS">PIS/COFINS</SelectItem>
                    <SelectItem value="SIMPLES">Simples Nacional</SelectItem>
                    <SelectItem value="OUTRO">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>% Imposto</Label>
                <Input type="text" inputMode="decimal" placeholder="6,00"
                  value={form.imposto_percentual || ""}
                  onChange={e => {
                    const pct = parseCurrencyInput(sanitizeNumberInput(e.target.value));
                    const base = form.comissao_valor || comissaoValorCalc;
                    set("imposto_percentual", pct);
                    set("imposto_valor", (base * pct) / 100);
                  }} />
              </div>
              <div>
                <Label>ou Valor (R$)</Label>
                <Input type="text" inputMode="decimal" placeholder="0,00"
                  value={getCurrDisplay("imposto_valor", calculatedForm.imposto_valor)}
                  onFocus={() => { if (calculatedForm.imposto_valor === 0) setCurrDisplay("imposto_valor", ""); }}
                  onChange={e => {
                    const raw = sanitizeNumberInput(e.target.value);
                    setCurrDisplay("imposto_valor", raw);
                    const val = parseCurrencyInput(raw);
                    const base = comissaoValorCalc;
                    set("imposto_valor", val);
                    set("imposto_percentual", base > 0 ? (val / base) * 100 : 0);
                  }}
                  onBlur={() => clearCurrDisplay("imposto_valor")} />
              </div>
              <div className="flex items-end">
                <p className="text-sm text-destructive pb-2">{impostoValorCalc > 0 ? <>-{fmtCur(impostoValorCalc)}{form.tem_parceria && <span className="text-xs ml-1">(÷2)</span>}</> : "—"}</p>
              </div>
            </div>
          </div>

          <div>
            <Label>Canal de Origem</Label>
            <Select value={form.canal_origem || "none"} onValueChange={v => set("canal_origem", v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Selecione o canal" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Não informado</SelectItem>
                {CANAIS_ORIGEM.map(c => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {form.canal_origem === "parceria_corretor" && (
            <div className="space-y-2 p-3 rounded-lg bg-secondary/30">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-foreground">🤝 Envolvidos na Parceria</p>
                <button
                  type="button"
                  onClick={() => set("parceria_envolvidos", [...(form.parceria_envolvidos || []), ""])}
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <Plus className="h-3 w-3" /> Adicionar
                </button>
              </div>
              {(form.parceria_envolvidos || []).length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhum envolvido adicionado. Clique em "Adicionar".</p>
              )}
              {(form.parceria_envolvidos || []).map((nome: string, idx: number) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-medium w-4">{idx + 1}.</span>
                  <Input
                    value={nome}
                    onChange={e => {
                      const updated = [...(form.parceria_envolvidos || [])];
                      updated[idx] = e.target.value;
                      set("parceria_envolvidos", updated);
                    }}
                    placeholder={`Nome do envolvido ${idx + 1}`}
                    className="flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const updated = (form.parceria_envolvidos || []).filter((_: string, i: number) => i !== idx);
                      set("parceria_envolvidos", updated);
                    }}
                    className="text-destructive hover:text-destructive/80"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Checklist automático de documentação */}
          <ContratoDocChecklist tipo={form.tipo} form={form as any} />

          <div>
            <Label>Observações</Label>
            <Textarea value={form.observacoes} onChange={e => set("observacoes", e.target.value)} placeholder="Anotações..." rows={2} />
          </div>

          <button type="submit" disabled={saving || !form.titulo.trim() || !!uploading}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 min-h-[48px]">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {contrato ? "Salvar Alterações" : "Criar Contrato"}
          </button>
        </form>
      </DialogContent>

      <ContratoFileViewerDialog
        open={viewerState.open}
        loading={viewerState.loading}
        file={viewerState.file}
        onOpenChange={(value) => {
          if (!value) closeContratoFileViewer();
        }}
      />
    </Dialog>
  );
}
