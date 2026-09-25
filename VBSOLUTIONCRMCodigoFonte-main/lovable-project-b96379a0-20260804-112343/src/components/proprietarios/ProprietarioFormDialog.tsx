import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Upload, FileText, X, Plus, Trash2, Cake } from "lucide-react";
import type { Proprietario, ProprietarioFamiliar } from "@/hooks/useProprietarios";
import { useDraft } from "@/hooks/useDraft";

import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proprietario: Proprietario | null;
  onSave: (data: Partial<Proprietario>) => Promise<void>;
  saving: boolean;
}

const ESTADOS_CIVIS = ["Solteiro(a)", "Casado(a)", "Divorciado(a)", "Viúvo(a)", "União Estável", "Separado(a)"];
const CANAIS_ORIGEM_PROP = ["Indicação", "Porteiro", "Placa", "Internet", "Redes Sociais", "Portal Imobiliário", "Construtora", "Síndico", "Outro"];

const emptyProprietarioForm = {
  nome: "", cpf_cnpj: "", telefone: "", email: "", endereco: "", cidade: "", estado: "DF", cep: "",
  banco: "", agencia: "", conta: "", pix: "", tipo: "ambos", observacoes: "",
  estado_civil: "", canal_origem: "", conjuge_nome: "", conjuge_cpf: "",
  contrato_administracao: false, comissao_acordada: 0, exclusividade: false,
  exclusividade_inicio: "", exclusividade_fim: "",
  saldo_devedor: false, parcela_atraso_financiamento: false, parcela_atraso_condominio: false,
  parcela_atraso_iptu: false, quitado: false, averbacao: false,
  dados_imovel_endereco: "", dados_imovel_tipo: "", dados_imovel_area: 0,
  exclusividade_contrato_url: "",
  inscricao_iptu: "", matricula: "", certidao_onus_url: "",
  // Datas de relacionamento
  data_nascimento: "", data_casamento: "", data_compra_imovel: "", conjuge_data_nascimento: "",
};

type FamiliarForm = ProprietarioFamiliar;
const RELACOES = ["filho", "filha", "pai", "mãe", "irmão", "irmã", "neto", "neta", "outro"];

export function ProprietarioFormDialog({ open, onOpenChange, proprietario, onSave, saving }: Props) {
  const [form, setForm] = useState(emptyProprietarioForm);
  const [familiares, setFamiliares] = useState<FamiliarForm[]>([]);
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const exclusividadeInputRef = useRef<HTMLInputElement>(null);
  const certidaoInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const isNew = !proprietario;
  const { clearDraft } = useDraft("proprietario", form, setForm, { enabled: isNew, open });

  const handleFileUpload = async (file: File, field: string, folder: string) => {
    setUploadingField(field);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");
      const path = `${user.id}/${folder}/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage
        .from("proprietarios")
        .upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = await supabase.storage
        .from("proprietarios")
        .createSignedUrl(path, 31536000);
      if (!data?.signedUrl) throw new Error("Falha ao gerar URL do arquivo");
      set(field, data.signedUrl);
      toast({ title: "Arquivo enviado com sucesso!" });
    } catch (err: any) {
      toast({ title: "Erro no upload", description: err.message, variant: "destructive" });
    } finally {
      setUploadingField(null);
    }
  };

  const handleOpenFile = async (urlOrPath: string) => {
    try {
      let path = urlOrPath;
      const markers = ["/object/public/proprietarios/", "/object/sign/proprietarios/"];
      for (const m of markers) {
        const idx = urlOrPath.indexOf(m);
        if (idx !== -1) {
          let extracted = urlOrPath.substring(idx + m.length);
          const qIdx = extracted.indexOf("?");
          if (qIdx !== -1) extracted = extracted.substring(0, qIdx);
          path = decodeURIComponent(extracted);
          break;
        }
      }
      const { data, error } = await supabase.storage.from("proprietarios").createSignedUrl(path, 3600);
      window.open(error || !data?.signedUrl ? urlOrPath : data.signedUrl, "_blank", "noopener,noreferrer");
    } catch {
      window.open(urlOrPath, "_blank", "noopener,noreferrer");
    }
  };


  useEffect(() => {
    if (proprietario) {
      setForm({
        nome: proprietario.nome, cpf_cnpj: proprietario.cpf_cnpj || "", telefone: proprietario.telefone || "",
        email: proprietario.email || "", endereco: proprietario.endereco || "", cidade: proprietario.cidade || "",
        estado: proprietario.estado || "DF", cep: proprietario.cep || "", banco: proprietario.banco || "",
        agencia: proprietario.agencia || "", conta: proprietario.conta || "", pix: proprietario.pix || "",
        tipo: proprietario.tipo, observacoes: proprietario.observacoes || "",
        estado_civil: proprietario.estado_civil || "",
        canal_origem: proprietario.canal_origem || "",
        conjuge_nome: proprietario.conjuge_nome || "",
        conjuge_cpf: proprietario.conjuge_cpf || "",
        contrato_administracao: (proprietario as any).contrato_administracao || false,
        comissao_acordada: proprietario.comissao_acordada || 0,
        exclusividade: (proprietario as any).exclusividade || false,
        exclusividade_inicio: (proprietario as any).exclusividade_inicio || "",
        exclusividade_fim: (proprietario as any).exclusividade_fim || "",
        saldo_devedor: (proprietario as any).saldo_devedor || false,
        parcela_atraso_financiamento: (proprietario as any).parcela_atraso_financiamento || false,
        parcela_atraso_condominio: (proprietario as any).parcela_atraso_condominio || false,
        parcela_atraso_iptu: (proprietario as any).parcela_atraso_iptu || false,
        quitado: (proprietario as any).quitado || false,
        averbacao: (proprietario as any).averbacao || false,
        dados_imovel_endereco: (proprietario as any).dados_imovel_endereco || "",
        dados_imovel_tipo: (proprietario as any).dados_imovel_tipo || "",
        dados_imovel_area: (proprietario as any).dados_imovel_area || 0,
        exclusividade_contrato_url: (proprietario as any).exclusividade_contrato_url || "",
        inscricao_iptu: (proprietario as any).inscricao_iptu || "",
        matricula: (proprietario as any).matricula || "",
        certidao_onus_url: (proprietario as any).certidao_onus_url || "",
        data_nascimento: (proprietario as any).data_nascimento || "",
        data_casamento: (proprietario as any).data_casamento || "",
        data_compra_imovel: (proprietario as any).data_compra_imovel || "",
        conjuge_data_nascimento: (proprietario as any).conjuge_data_nascimento || "",
      });
      setFamiliares(((proprietario as any).familiares || []).map((f: any) => ({
        id: f.id, nome: f.nome || "", data_nascimento: f.data_nascimento || "", relacao: f.relacao || "filho",
      })));
    } else if (!open) {
      setForm(emptyProprietarioForm);
      setFamiliares([]);
    }
  }, [proprietario, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome.trim()) return;
    const payload: any = { ...form };
    for (const key of Object.keys(payload)) {
      if (payload[key] === "") payload[key] = null;
    }
    payload.nome = form.nome;
    payload.tipo = form.tipo;
    payload.familiares = familiares
      .filter(f => f.nome && f.nome.trim())
      .map(f => ({ ...f, data_nascimento: f.data_nascimento || null }));
    await onSave(payload);
    clearDraft();
    try { localStorage.removeItem("proprietario_form_backup"); } catch { /* ignore */ }
  };

  const addFamiliar = () => setFamiliares(prev => [...prev, { nome: "", data_nascimento: "", relacao: "filho" }]);
  const removeFamiliar = (idx: number) => setFamiliares(prev => prev.filter((_, i) => i !== idx));
  const updateFamiliar = (idx: number, patch: Partial<FamiliarForm>) =>
    setFamiliares(prev => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)));

  const set = (key: string, value: any) => setForm(prev => ({ ...prev, [key]: value }));

  const safeOpenChange = (value: boolean) => {
    if (!value && document.hidden) return;
    onOpenChange(value);
  };

  useEffect(() => {
    if (open) {
      try {
        localStorage.setItem("proprietario_form_backup", JSON.stringify(form));
      } catch { /* ignore */ }
    }
  }, [form, open]);

  useEffect(() => {
    if (open && isNew) {
      try {
        const backup = localStorage.getItem("proprietario_form_backup");
        if (backup) {
          const parsed = JSON.parse(backup);
          if (parsed.nome) setForm(prev => ({ ...prev, ...parsed }));
        }
      } catch { /* ignore */ }
    }
  }, [open, isNew]);

  const renderFileUpload = (
    label: string,
    field: string,
    folder: string,
    inputRef: React.RefObject<HTMLInputElement>,
    viewLabel: string,
    uploadLabel: string
  ) => (
    <div>
      <Label>📎 {label}</Label>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) handleFileUpload(file, field, folder);
          e.target.value = "";
        }}
      />
      {(form as any)[field] ? (
        <div className="flex items-center gap-2 mt-1 p-2 rounded-lg bg-primary/5 border border-primary/20">
          <FileText className="w-4 h-4 text-primary shrink-0" />
          <button
            type="button"
            onClick={() => void handleOpenFile((form as any)[field])}
            className="text-xs text-primary hover:underline truncate flex-1 text-left"
          >
            {viewLabel}
          </button>
          <button
            type="button"
            onClick={() => set(field, "")}
            className="text-muted-foreground hover:text-destructive"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploadingField === field}
          className="w-full mt-1 flex items-center justify-center gap-2 p-3 rounded-lg border-2 border-dashed border-border hover:border-primary/50 text-muted-foreground hover:text-primary transition-colors text-sm min-h-[44px]"
        >
          {uploadingField === field ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
          ) : (
            <><Upload className="w-4 h-4" /> {uploadLabel}</>
          )}
        </button>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={safeOpenChange}>
      <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto w-[95vw] sm:w-auto">
        <DialogHeader>
          <DialogTitle>{proprietario ? "Editar Proprietário" : "Novo Proprietário"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="col-span-1 sm:col-span-2"><Label>Nome *</Label><Input value={form.nome} onChange={e => set("nome", e.target.value)} required className="min-h-[44px]" /></div>
            <div><Label>CPF/CNPJ</Label><Input value={form.cpf_cnpj} onChange={e => set("cpf_cnpj", e.target.value)} className="min-h-[44px]" /></div>
            <div>
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={v => set("tipo", v)}>
                <SelectTrigger className="min-h-[44px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="venda">Venda</SelectItem>
                  <SelectItem value="aluguel">Aluguel</SelectItem>
                  <SelectItem value="ambos">Ambos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Estado Civil</Label>
              <Select value={form.estado_civil || "none"} onValueChange={v => set("estado_civil", v === "none" ? "" : v)}>
                <SelectTrigger className="min-h-[44px]"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Não informado</SelectItem>
                  {ESTADOS_CIVIS.map(ec => <SelectItem key={ec} value={ec}>{ec}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Canal de Origem</Label>
              <Select value={form.canal_origem || "none"} onValueChange={v => set("canal_origem", v === "none" ? "" : v)}>
                <SelectTrigger className="min-h-[44px]"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Não informado</SelectItem>
                  {CANAIS_ORIGEM_PROP.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Cônjuge */}
          {(form.estado_civil === "Casado(a)" || form.estado_civil === "União Estável") && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-lg bg-secondary/30">
              <div className="col-span-1 sm:col-span-2"><p className="text-xs font-semibold text-foreground">👫 Cônjuge / Companheiro(a)</p></div>
              <div><Label>Nome</Label><Input value={form.conjuge_nome} onChange={e => set("conjuge_nome", e.target.value)} placeholder="Nome do cônjuge" className="min-h-[44px]" /></div>
              <div><Label>CPF</Label><Input value={form.conjuge_cpf} onChange={e => set("conjuge_cpf", e.target.value)} placeholder="000.000.000-00" className="min-h-[44px]" /></div>
              <div><Label>Data de Nascimento do Cônjuge</Label><Input type="date" value={form.conjuge_data_nascimento} onChange={e => set("conjuge_data_nascimento", e.target.value)} className="min-h-[44px]" /></div>
            </div>
          )}

          {/* Datas comemorativas & relacionamento */}
          <div className="p-3 rounded-lg border border-primary/20 bg-primary/5 space-y-3">
            <div className="flex items-center gap-2">
              <Cake className="h-4 w-4 text-primary" />
              <p className="text-xs font-semibold text-foreground">Datas de Relacionamento (para lembretes automáticos)</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label>Data de Nascimento</Label>
                <Input type="date" value={form.data_nascimento} onChange={e => set("data_nascimento", e.target.value)} className="min-h-[44px]" />
              </div>
              <div>
                <Label>Data de Casamento</Label>
                <Input type="date" value={form.data_casamento} onChange={e => set("data_casamento", e.target.value)} className="min-h-[44px]" />
              </div>
              <div>
                <Label>Aniversário da Compra do Imóvel</Label>
                <Input type="date" value={form.data_compra_imovel} onChange={e => set("data_compra_imovel", e.target.value)} className="min-h-[44px]" />
              </div>
            </div>

            {/* Familiares (filhos e outros) */}
            <div className="space-y-2 pt-2 border-t border-primary/10">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Familiares (filhos, parentes)</Label>
                <button
                  type="button"
                  onClick={addFamiliar}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  <Plus className="h-3.5 w-3.5" /> Adicionar
                </button>
              </div>
              {familiares.length === 0 && (
                <p className="text-xs text-muted-foreground italic">Nenhum familiar cadastrado. Clique em "Adicionar" para incluir aniversários de filhos ou parentes.</p>
              )}
              {familiares.map((f, idx) => (
                <div key={f.id ?? `new-${idx}`} className="grid grid-cols-1 sm:grid-cols-[1fr_140px_130px_auto] gap-2 items-end p-2 rounded-md bg-background border">
                  <div>
                    <Label className="text-xs">Nome</Label>
                    <Input
                      value={f.nome}
                      onChange={e => updateFamiliar(idx, { nome: e.target.value })}
                      placeholder="Ex: João (filho)"
                      className="min-h-[40px]"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Data Nasc.</Label>
                    <Input
                      type="date"
                      value={f.data_nascimento || ""}
                      onChange={e => updateFamiliar(idx, { data_nascimento: e.target.value })}
                      className="min-h-[40px]"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Relação</Label>
                    <Select value={f.relacao || "filho"} onValueChange={v => updateFamiliar(idx, { relacao: v })}>
                      <SelectTrigger className="min-h-[40px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {RELACOES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFamiliar(idx)}
                    className="inline-flex items-center justify-center h-10 w-10 rounded-md text-destructive hover:bg-destructive/10"
                    title="Remover"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label>Telefone</Label><Input value={form.telefone} onChange={e => set("telefone", e.target.value)} className="min-h-[44px]" /></div>
            <div><Label>E-mail</Label><Input type="email" value={form.email} onChange={e => set("email", e.target.value)} className="min-h-[44px]" /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="col-span-1 sm:col-span-2"><Label>Endereço</Label><Input value={form.endereco} onChange={e => set("endereco", e.target.value)} className="min-h-[44px]" /></div>
            <div><Label>CEP</Label><Input value={form.cep} onChange={e => set("cep", e.target.value)} className="min-h-[44px]" /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label>Cidade</Label><Input value={form.cidade} onChange={e => set("cidade", e.target.value)} className="min-h-[44px]" /></div>
            <div><Label>Estado</Label><Input value={form.estado} onChange={e => set("estado", e.target.value)} className="min-h-[44px]" /></div>
          </div>

          <p className="text-xs font-semibold text-muted-foreground pt-2">Dados Bancários</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div><Label>Banco</Label><Input value={form.banco} onChange={e => set("banco", e.target.value)} className="min-h-[44px]" /></div>
            <div><Label>Agência</Label><Input value={form.agencia} onChange={e => set("agencia", e.target.value)} className="min-h-[44px]" /></div>
            <div><Label>Conta</Label><Input value={form.conta} onChange={e => set("conta", e.target.value)} className="min-h-[44px]" /></div>
          </div>
          <div><Label>Chave PIX</Label><Input value={form.pix} onChange={e => set("pix", e.target.value)} className="min-h-[44px]" /></div>

          {/* Contrato de Administração / Comissão / Exclusividade */}
          <div className="space-y-3 p-3 rounded-lg bg-secondary/30">
            <p className="text-xs font-semibold text-foreground">📋 Gestão do Proprietário</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex items-center gap-2 min-h-[44px]">
                <input type="checkbox" checked={form.contrato_administracao} onChange={e => set("contrato_administracao", e.target.checked)}
                  className="w-5 h-5 rounded border-border text-primary focus:ring-primary" />
                <Label className="text-sm">Contrato de Administração</Label>
              </div>
              <div className="flex items-center gap-2 min-h-[44px]">
                <input type="checkbox" checked={form.exclusividade} onChange={e => set("exclusividade", e.target.checked)}
                  className="w-5 h-5 rounded border-border text-primary focus:ring-primary" />
                <Label className="text-sm">Exclusividade</Label>
              </div>
              <div>
                <Label>Comissão Acordada (%)</Label>
                <Input type="number" step="0.1" min={0} max={100} value={form.comissao_acordada || ""} onChange={e => set("comissao_acordada", Number(e.target.value) || 0)} placeholder="0" className="min-h-[44px]" />
              </div>
            </div>
            {form.exclusividade && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Início Exclusividade</Label>
                  <Input type="date" value={form.exclusividade_inicio} onChange={e => set("exclusividade_inicio", e.target.value)} className="min-h-[44px]" />
                </div>
                <div>
                  <Label>Fim Exclusividade</Label>
                  <Input type="date" value={form.exclusividade_fim} onChange={e => set("exclusividade_fim", e.target.value)} className="min-h-[44px]" />
                </div>
              </div>
            )}

            {/* Upload de Contrato de Exclusividade */}
            {renderFileUpload(
              "Anexar Contrato de Exclusividade",
              "exclusividade_contrato_url",
              "exclusividade",
              exclusividadeInputRef,
              "Ver contrato anexado",
              "Anexar contrato de exclusividade"
            )}
          </div>

          {/* Dados do Imóvel */}
          <div className="space-y-3 p-3 rounded-lg bg-secondary/30">
            <p className="text-xs font-semibold text-foreground">🏠 Dados do Imóvel</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="col-span-1 sm:col-span-2"><Label>Endereço do Imóvel</Label><Input value={form.dados_imovel_endereco} onChange={e => set("dados_imovel_endereco", e.target.value)} placeholder="Endereço completo" className="min-h-[44px]" /></div>
              <div><Label>Tipo</Label>
                <Select value={form.dados_imovel_tipo || "none"} onValueChange={v => set("dados_imovel_tipo", v === "none" ? "" : v)}>
                  <SelectTrigger className="min-h-[44px]"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Não informado</SelectItem>
                    <SelectItem value="Apartamento">Apartamento</SelectItem>
                    <SelectItem value="Casa">Casa</SelectItem>
                    <SelectItem value="Terreno">Terreno</SelectItem>
                    <SelectItem value="Comercial">Comercial</SelectItem>
                    <SelectItem value="Cobertura">Cobertura</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Área (m²)</Label><Input type="number" value={form.dados_imovel_area || ""} onChange={e => set("dados_imovel_area", Number(e.target.value) || 0)} className="min-h-[44px]" /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label>Inscrição IPTU</Label><Input value={form.inscricao_iptu} onChange={e => set("inscricao_iptu", e.target.value)} placeholder="Nº da inscrição" className="min-h-[44px]" /></div>
              <div><Label>Matrícula</Label><Input value={form.matricula} onChange={e => set("matricula", e.target.value)} placeholder="Nº da matrícula" className="min-h-[44px]" /></div>
            </div>

            {/* Upload Certidão de Ônus */}
            {renderFileUpload(
              "Certidão de Ônus Reais",
              "certidao_onus_url",
              "certidao_onus",
              certidaoInputRef,
              "Ver certidão anexada",
              "Anexar certidão de ônus"
            )}
          </div>

          {/* Status Financeiro do Imóvel */}
          <div className="space-y-3 p-3 rounded-lg bg-secondary/30">
            <p className="text-xs font-semibold text-foreground">💰 Status Financeiro do Imóvel</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { key: "saldo_devedor", label: "Tem Saldo Devedor" },
                { key: "quitado", label: "Quitado" },
                { key: "averbacao", label: "Fez Averbação" },
                { key: "parcela_atraso_financiamento", label: "Parcela em Atraso (Financiamento)" },
                { key: "parcela_atraso_condominio", label: "Parcela em Atraso (Condomínio)" },
                { key: "parcela_atraso_iptu", label: "Parcela em Atraso (IPTU)" },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center gap-2 min-h-[44px]">
                  <input type="checkbox" checked={(form as any)[key]} onChange={e => set(key, e.target.checked)}
                    className="w-5 h-5 rounded border-border text-primary focus:ring-primary" />
                  <Label className="text-sm">{label}</Label>
                </div>
              ))}
            </div>
          </div>

          <div><Label>Observações</Label><Textarea value={form.observacoes} onChange={e => set("observacoes", e.target.value)} rows={2} /></div>

          <button type="submit" disabled={saving || !form.nome.trim() || !!uploadingField}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 min-h-[48px]">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {proprietario ? "Salvar Alterações" : "Cadastrar Proprietário"}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
