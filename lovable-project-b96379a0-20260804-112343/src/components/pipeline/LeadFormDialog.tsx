import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import type { Lead, Corretor } from "@/hooks/useLeads";
import { ESTAGIOS } from "@/hooks/useLeads";
import { CANAIS_ORIGEM } from "@/lib/canaisOrigem";
import { LeadMatchingPanel } from "@/components/pipeline/LeadMatchingPanel";
import { useDraft } from "@/hooks/useDraft";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead | null;
  onSave: (data: Partial<Lead>) => Promise<void>;
  saving: boolean;
  defaultEstagio?: string;
  corretores: Corretor[];
  /** Somente o admin master pode direcionar leads para corretores. */
  canAssignCorretor?: boolean;
}

const formatCurrency = (value: number) => {
  if (!value) return "";
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
};

const parseCurrency = (raw: string): number => {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return 0;
  return parseInt(digits, 10) / 100;
};

const TIPOS_IMOVEL = [
  "Apartamento", "Casa", "Terreno", "Sala Comercial", "Loja", "Cobertura", "Kitnet", "Lote", "Outro",
];

const getEmptyForm = (defaultEstagio?: string) => ({
  nome: "",
  telefone: "",
  email: "",
  interesse: "",
  valor: 0,
  estagio: defaultEstagio || "novos",
  corretor_id: "" as string | null,
  observacoes: "",
  tipo_operacao: "venda",
  canal_origem: "",
  bairro_interesse: "",
  tipo_imovel_interesse: "",
});

export function LeadFormDialog({ open, onOpenChange, lead, onSave, saving, defaultEstagio, corretores, canAssignCorretor = true }: Props) {
  const [form, setForm] = useState(getEmptyForm(defaultEstagio));
  const [valorDisplay, setValorDisplay] = useState("");
  
  const isNew = !lead;
  const { clearDraft: clearHookDraft } = useDraft("pipeline_new_lead", form, (data) => {
    setForm(data);
    setValorDisplay(formatCurrency(data.valor || 0));
  }, { enabled: isNew, open });

  useEffect(() => {
    if (lead) {
      setForm({
        nome: lead.nome,
        telefone: lead.telefone || "",
        email: lead.email || "",
        interesse: lead.interesse || "",
        valor: lead.valor,
        estagio: lead.estagio,
        corretor_id: lead.corretor_id || "",
        observacoes: lead.observacoes || "",
        tipo_operacao: lead.tipo_operacao || "venda",
        canal_origem: lead.canal_origem || "",
        bairro_interesse: lead.bairro_interesse || "",
        tipo_imovel_interesse: lead.tipo_imovel_interesse || "",
      });
      setValorDisplay(formatCurrency(lead.valor));
    } else if (!open) {
      const empty = getEmptyForm(defaultEstagio);
      setForm(empty);
      setValorDisplay("");
    }
  }, [lead, open, defaultEstagio]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome.trim()) return;
    const payload = { 
      ...form, 
      corretor_id: form.corretor_id || null, 
      canal_origem: form.canal_origem || null, 
      bairro_interesse: form.bairro_interesse || null, 
      tipo_imovel_interesse: form.tipo_imovel_interesse || null 
    };
    await onSave(payload);
    clearHookDraft();
  };

  const set = (key: string, value: any) => setForm(prev => ({ ...prev, [key]: value }));

  const handleValorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const parsed = parseCurrency(e.target.value);
    set("valor", parsed);
    setValorDisplay(formatCurrency(parsed));
  };

  const safeOpenChange = (value: boolean) => {
    if (!value && document.hidden) return;
    onOpenChange(value);
  };

  return (
    <Dialog open={open} onOpenChange={safeOpenChange}>
      <DialogContent className="bg-card border-border max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle>{lead ? "Editar Lead" : "Novo Lead"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="space-y-2.5 overflow-y-auto flex-1 pr-1 -mr-1 pb-2" style={{ WebkitOverflowScrolling: 'touch' }}>
            <div>
              <Label className="text-xs">Nome *</Label>
              <Input value={form.nome} onChange={e => set("nome", e.target.value)} placeholder="Nome do lead" required className="h-9" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Telefone</Label>
                <Input value={form.telefone} onChange={e => set("telefone", e.target.value)} placeholder="(11) 99999-0000" className="h-9" />
              </div>
              <div>
                <Label className="text-xs">E-mail</Label>
                <Input type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="email@exemplo.com" className="h-9" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Interesse</Label>
                <Input value={form.interesse} onChange={e => set("interesse", e.target.value)} placeholder="Ex: Apt 3 quartos" className="h-9" />
              </div>
              <div>
                <Label className="text-xs">Tipo de Operação</Label>
                <Select value={form.tipo_operacao} onValueChange={v => set("tipo_operacao", v)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="venda">Venda</SelectItem>
                    <SelectItem value="aluguel">Aluguel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Valor (R$)</Label>
                <Input value={valorDisplay} onChange={handleValorChange} placeholder="0,00" inputMode="numeric" className="h-9" />
              </div>
              <div>
                <Label className="text-xs">Estágio</Label>
                <Select value={form.estagio} onValueChange={v => set("estagio", v)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ESTAGIOS.map(e => <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Corretor</Label>
                <Select value={form.corretor_id || "_none"} onValueChange={v => set("corretor_id", v === "_none" ? "" : v)} disabled={!canAssignCorretor}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Sem corretor" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Sem corretor</SelectItem>
                    {corretores.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
                {!canAssignCorretor && (
                  <p className="text-[11px] text-muted-foreground mt-1">Apenas o admin master pode direcionar leads.</p>
                )}
              </div>
              <div>
                <Label className="text-xs">Canal de Origem</Label>
                <Select value={form.canal_origem || "_none"} onValueChange={v => set("canal_origem", v === "_none" ? "" : v)}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Não informado" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Não informado</SelectItem>
                    {CANAIS_ORIGEM.map(c => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Bairro de Interesse</Label>
                <Input value={form.bairro_interesse} onChange={e => set("bairro_interesse", e.target.value)} placeholder="Ex: Águas Claras" className="h-9" />
              </div>
              <div>
                <Label className="text-xs">Tipo de Imóvel</Label>
                <Select value={form.tipo_imovel_interesse || "_none"} onValueChange={v => set("tipo_imovel_interesse", v === "_none" ? "" : v)}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Não informado" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Não informado</SelectItem>
                    {TIPOS_IMOVEL.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Observações</Label>
              <Textarea value={form.observacoes} onChange={e => set("observacoes", e.target.value)} placeholder="Anotações sobre o lead..." rows={2} />
            </div>

            {lead && (
              <LeadMatchingPanel lead={lead} />
            )}
          </div>

          <button
            type="submit"
            disabled={saving || !form.nome.trim()}
            className="w-full shrink-0 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 mt-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {lead ? "Salvar Alterações" : "Adicionar Lead"}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

