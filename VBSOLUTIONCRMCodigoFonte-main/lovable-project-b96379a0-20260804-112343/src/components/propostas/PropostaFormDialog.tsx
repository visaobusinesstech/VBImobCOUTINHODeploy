import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { STATUS_PROPOSTA, FORMAS_PAGAMENTO, type Proposta } from "@/hooks/usePropostas";
import type { Imovel } from "@/hooks/useImoveis";
import { useDraft } from "@/hooks/useDraft";

interface LeadDefaults {
  lead_id: string;
  cliente_nome: string;
  cliente_telefone?: string;
  cliente_email?: string;
}

interface PropostaFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposta?: Proposta | null;
  imoveis: Imovel[];
  onSave: (data: Partial<Proposta>) => Promise<void>;
  saving: boolean;
  defaultImovelId?: string;
  leadDefaults?: LeadDefaults | null;
}

const defaultForm = {
  cliente_nome: "",
  cliente_telefone: "",
  cliente_email: "",
  valor: "",
  forma_pagamento: "a_vista",
  observacoes: "",
  status: "em_negociacao",
  imovel_id: "",
  condicoes_especiais: "",
  prazo_contrato: "",
};

function parseCurrency(value: string): number {
  const cleaned = value.replace(/[^\d.,]/g, "");
  if (!cleaned) return 0;
  const normalized = cleaned.replace(/\./g, "").replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function PropostaFormDialog({ open, onOpenChange, proposta, imoveis, onSave, saving, defaultImovelId, leadDefaults }: PropostaFormDialogProps) {
  const [form, setForm] = useState(defaultForm);
  const isNew = !proposta && !leadDefaults;
  const { clearDraft } = useDraft("proposta", form, setForm, { enabled: isNew, open });

  useEffect(() => {
    if (proposta) {
      setForm({
        cliente_nome: proposta.cliente_nome,
        cliente_telefone: proposta.cliente_telefone ?? "",
        cliente_email: proposta.cliente_email ?? "",
        valor: proposta.valor ? proposta.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "",
        forma_pagamento: proposta.forma_pagamento,
        observacoes: proposta.observacoes ?? "",
        status: proposta.status,
        imovel_id: proposta.imovel_id ?? "",
        condicoes_especiais: (proposta as any).condicoes_especiais ?? "",
        prazo_contrato: (proposta as any).prazo_contrato ?? "",
      });
    } else if (leadDefaults) {
      setForm({
        ...defaultForm,
        cliente_nome: leadDefaults.cliente_nome,
        cliente_telefone: leadDefaults.cliente_telefone || "",
        cliente_email: leadDefaults.cliente_email || "",
        imovel_id: defaultImovelId || "",
      });
    } else if (!open) {
      setForm({ ...defaultForm, imovel_id: defaultImovelId || "" });
    }
  }, [proposta, open, defaultImovelId, leadDefaults]);

  const set = (key: string, val: any) => setForm(p => ({ ...p, [key]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({
      cliente_nome: form.cliente_nome,
      cliente_telefone: form.cliente_telefone || null,
      cliente_email: form.cliente_email || null,
      valor: parseCurrency(form.valor),
      forma_pagamento: form.forma_pagamento,
      observacoes: form.observacoes || null,
      status: form.status,
      imovel_id: form.imovel_id || null,
      lead_id: leadDefaults?.lead_id || null,
      condicoes_especiais: form.condicoes_especiais || null,
      prazo_contrato: form.prazo_contrato || null,
    } as any);
    clearDraft();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">{proposta ? "Editar Proposta" : "Nova Proposta"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Imóvel</Label>
            <Select value={form.imovel_id} onValueChange={v => set("imovel_id", v)}>
              <SelectTrigger className="mt-1 bg-secondary border-border"><SelectValue placeholder="Selecione o imóvel" /></SelectTrigger>
              <SelectContent>
                {imoveis.map(i => (
                  <SelectItem key={i.id} value={i.id}>{i.titulo}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Nome do Cliente *</Label>
            <Input value={form.cliente_nome} onChange={e => set("cliente_nome", e.target.value)} required className="mt-1 bg-secondary border-border" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Telefone</Label>
              <Input value={form.cliente_telefone} onChange={e => set("cliente_telefone", e.target.value)} className="mt-1 bg-secondary border-border" />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={form.cliente_email} onChange={e => set("cliente_email", e.target.value)} className="mt-1 bg-secondary border-border" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Valor (R$) *</Label>
              <Input
                value={form.valor}
                inputMode="decimal"
                onChange={e => set("valor", e.target.value.replace(/[^\d.,]/g, ""))}
                placeholder="0,00"
                required
                className="mt-1 bg-secondary border-border"
              />
            </div>
            <div>
              <Label>Forma de Pagamento</Label>
              <Select value={form.forma_pagamento} onValueChange={v => set("forma_pagamento", v)}>
                <SelectTrigger className="mt-1 bg-secondary border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FORMAS_PAGAMENTO.map(f => <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => set("status", v)}>
                <SelectTrigger className="mt-1 bg-secondary border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_PROPOSTA.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Prazo do Contrato</Label>
              <Input value={form.prazo_contrato} onChange={e => set("prazo_contrato", e.target.value)} placeholder="Ex: 30 meses" className="mt-1 bg-secondary border-border" />
            </div>
          </div>
          <div>
            <Label>Condições Especiais de Negociação</Label>
            <Textarea value={form.condicoes_especiais} onChange={e => set("condicoes_especiais", e.target.value)} rows={2} placeholder="Ex: Entrada de 20% + financiamento, mobília inclusa..." className="mt-1 bg-secondary border-border resize-none" />
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea value={form.observacoes} onChange={e => set("observacoes", e.target.value)} rows={3} className="mt-1 bg-secondary border-border resize-none" />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {proposta ? "Salvar" : "Registrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
