import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { CANAIS_ORIGEM } from "@/lib/canaisOrigem";
import {
  getFechamentoLeadComputedValues,
  parseCurrencyInput,
  sanitizeNumberInput,
  validateFechamentoLeadForm,
} from "@/lib/pipeline/fechamentoLeadValidation";
import type { Lead } from "@/hooks/useLeads";
const makeInitialForm = (lead: Lead | null) => ({
  tipo: lead?.tipo_operacao === "aluguel" ? "Locação" : "Venda",
  valor: lead?.valor || 0,
  valorDisplay: lead?.valor ? String(lead.valor) : "",
  canal_origem: lead?.canal_origem || "",
  comissao_percentual: 0,
  comissaoDisplay: "",
  comissao_valor: 0,
  comissaoValorDisplay: "",
  tem_parceria: false,
  parceiro_nome: "",
  parceiro_comissao_percentual: 0,
  parceiroDisplay: "",
  parceiro_comissao_valor: 0,
  parceiroValorDisplay: "",
  captador_nome: "",
  captador_telefone: "",
  captador_comissao_percentual: 0,
  captadorDisplay: "",
  captador_comissao_valor: 0,
  captadorValorDisplay: "",
  corretor_nome: lead?.corretor_nome || "",
  corretor_comissao_percentual: 0,
  corretorDisplay: "",
  corretor_comissao_valor: 0,
  corretorValorDisplay: "",
  imposto_tipo: "",
  imposto_percentual: 0,
  impostoDisplay: "",
  imposto_valor: 0,
  impostoValorDisplay: "",
  observacoes: "",
  data_inicio: new Date().toISOString().split("T")[0],
  data_fim: "",
});

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead | null;
  corretores: { id: string; nome: string }[];
  onConfirm: (data: Record<string, any>) => Promise<void>;
  saving: boolean;
}

export function FechamentoLeadDialog({ open, onOpenChange, lead, corretores, onConfirm, saving }: Props) {
  const [form, setForm] = useState(makeInitialForm(lead));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [hasSubmitted, setHasSubmitted] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(makeInitialForm(lead));
      setErrors({});
      setHasSubmitted(false);
    }
  }, [open, lead]);

  useEffect(() => {
    if (!hasSubmitted) return;
    setErrors(validateFechamentoLeadForm(form));
  }, [form, hasSubmitted]);

  const set = (key: string, value: any) => setForm(prev => ({ ...prev, [key]: value }));

  const { comissaoValor, parceiroValor, captadorValor, corretorValor, impostoValor, liquidoImobiliaria } = getFechamentoLeadComputedValues(form);
  const partnershipErrors = Boolean(errors.parceiro_nome || errors.parceiro_comissao);

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setHasSubmitted(true);
    const newErrors = validateFechamentoLeadForm(form);
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});
    await onConfirm({
      titulo: `Contrato ${form.tipo} - ${lead?.nome}`,
      cliente: lead?.nome || "",
      tipo: form.tipo,
      valor: form.valor,
      status: "rascunho",
      data_inicio: form.data_inicio || null,
      data_fim: form.data_fim || null,
      canal_origem: form.canal_origem || null,
      comissao_percentual: form.comissao_percentual,
      comissao_valor: comissaoValor,
      tem_parceria: form.tem_parceria,
      parceiro_nome: form.parceiro_nome || null,
      parceiro_comissao_percentual: form.parceiro_comissao_percentual,
      parceiro_comissao_valor: parceiroValor,
      captador_nome: form.captador_nome || null,
      captador_telefone: form.captador_telefone || null,
      captador_comissao_percentual: form.captador_comissao_percentual,
      captador_comissao_valor: captadorValor,
      corretor_nome: form.corretor_nome || null,
      corretor_comissao_percentual: form.corretor_comissao_percentual,
      corretor_comissao_valor: corretorValor,
      imposto_tipo: form.imposto_tipo || null,
      imposto_percentual: form.imposto_percentual,
      imposto_valor: impostoValor,
      observacoes: form.observacoes
        ? `${form.observacoes}\n\nOrigem: ${lead?.canal_origem || "—"} | Interesse: ${lead?.interesse || "—"} | Tel: ${lead?.telefone || "—"} | Email: ${lead?.email || "—"}`
        : `Origem: ${lead?.canal_origem || "—"} | Interesse: ${lead?.interesse || "—"} | Tel: ${lead?.telefone || "—"} | Email: ${lead?.email || "—"}`,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            🎉 Fechamento — {lead?.nome}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Tipo e Valor */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Tipo *</Label>
              <Select value={form.tipo} onValueChange={v => set("tipo", v)}>
                <SelectTrigger className={errors.tipo ? "border-destructive" : undefined}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Venda">Venda</SelectItem>
                  <SelectItem value="Locação">Locação</SelectItem>
                </SelectContent>
              </Select>
              {errors.tipo && <p className="text-xs text-destructive mt-1">{errors.tipo}</p>}
            </div>
            <div>
              <Label>Valor (R$) *</Label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                className={errors.valor ? "border-destructive" : ""}
                value={form.valorDisplay}
                onChange={e => {
                  const v = sanitizeNumberInput(e.target.value);
                  set("valorDisplay", v);
                  set("valor", parseCurrencyInput(v));
                  if (errors.valor) setErrors(prev => { const n = { ...prev }; delete n.valor; return n; });
                }}
              />
              {errors.valor && <p className="text-xs text-destructive mt-1">{errors.valor}</p>}
            </div>
            <div>
              <Label>Canal de Origem</Label>
              <Select value={form.canal_origem || "none"} onValueChange={v => set("canal_origem", v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Não informado</SelectItem>
                  {CANAIS_ORIGEM.map(c => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Datas */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Data Início</Label>
              <Input type="date" value={form.data_inicio} onChange={e => set("data_inicio", e.target.value)} />
            </div>
            <div>
              <Label>Data Fim</Label>
              <Input type="date" value={form.data_fim} onChange={e => set("data_fim", e.target.value)} />
            </div>
          </div>

          {/* Comissão */}
          <div className={`space-y-3 p-3 rounded-lg ${errors.comissao ? "bg-destructive/10 border border-destructive/30" : "bg-secondary/30"}`}>
            <p className="text-xs font-semibold text-foreground">💰 Comissão *</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>% Comissão Total</Label>
                <Input type="text" inputMode="decimal" placeholder="6,00"
                  className={errors.comissao ? "border-destructive" : ""}
                  value={form.comissaoDisplay}
                  onChange={e => {
                    const v = sanitizeNumberInput(e.target.value);
                    set("comissaoDisplay", v);
                    const pct = parseCurrencyInput(v);
                    set("comissao_percentual", pct);
                    const val = (form.valor * pct) / 100;
                    set("comissao_valor", val);
                    set("comissaoValorDisplay", val ? String(val) : "");
                    if (errors.comissao) setErrors(prev => { const n = { ...prev }; delete n.comissao; return n; });
                  }} />
              </div>
              <div>
                <Label>ou Valor (R$)</Label>
                <Input type="text" inputMode="decimal" placeholder="0,00"
                  className={errors.comissao ? "border-destructive" : ""}
                  value={form.comissaoValorDisplay}
                  onChange={e => {
                    const v = sanitizeNumberInput(e.target.value);
                    set("comissaoValorDisplay", v);
                    const val = parseCurrencyInput(v);
                    set("comissao_valor", val);
                    set("comissao_percentual", form.valor > 0 ? (val / form.valor) * 100 : 0);
                    set("comissaoDisplay", form.valor > 0 ? String(((val / form.valor) * 100).toFixed(2)).replace(".", ",") : "");
                    if (errors.comissao) setErrors(prev => { const n = { ...prev }; delete n.comissao; return n; });
                  }} />
              </div>
              <div className="flex items-end">
                <p className="text-sm font-medium text-primary pb-2">{fmt(comissaoValor)}</p>
              </div>
            </div>
            {errors.comissao && <p className="text-xs text-destructive">{errors.comissao}</p>}
          </div>

          {/* Corretor */}
          <div className="space-y-3 p-3 rounded-lg bg-secondary/30">
            <p className="text-xs font-semibold text-foreground">👤 Corretor Responsável</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Nome do Corretor</Label>
                <Input value={form.corretor_nome} onChange={e => set("corretor_nome", e.target.value)} placeholder="Nome" />
              </div>
              <div>
                <Label>% da Comissão</Label>
                <Input type="text" inputMode="decimal" placeholder="50"
                  value={form.corretorDisplay}
                  onChange={e => {
                    const v = sanitizeNumberInput(e.target.value);
                    set("corretorDisplay", v);
                    const pct = parseCurrencyInput(v);
                    set("corretor_comissao_percentual", pct);
                    const val = (comissaoValor * pct) / 100;
                    set("corretor_comissao_valor", val);
                    set("corretorValorDisplay", val ? String(val) : "");
                  }} />
              </div>
              <div>
                <Label>ou Valor (R$)</Label>
                <Input type="text" inputMode="decimal" placeholder="0,00"
                  value={form.corretorValorDisplay}
                  onChange={e => {
                    const v = sanitizeNumberInput(e.target.value);
                    set("corretorValorDisplay", v);
                    const val = parseCurrencyInput(v);
                    set("corretor_comissao_valor", val);
                    set("corretor_comissao_percentual", comissaoValor > 0 ? (val / comissaoValor) * 100 : 0);
                    set("corretorDisplay", comissaoValor > 0 ? String(((val / comissaoValor) * 100).toFixed(2)).replace(".", ",") : "");
                  }} />
                {corretorValor > 0 && <p className="text-xs text-muted-foreground mt-1">{fmt(corretorValor)}</p>}
              </div>
            </div>
          </div>

          {/* Parceria */}
          <div className={`space-y-3 p-3 rounded-lg ${partnershipErrors ? "bg-destructive/10 border border-destructive/30" : "bg-secondary/30"}`}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-foreground">🤝 Parceria com outra Imobiliária/Corretor</p>
              <Switch checked={form.tem_parceria} onCheckedChange={v => set("tem_parceria", v)} />
            </div>
            {form.tem_parceria && (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Nome do Parceiro</Label>
                    <Input
                      className={errors.parceiro_nome ? "border-destructive" : ""}
                      value={form.parceiro_nome}
                      onChange={e => set("parceiro_nome", e.target.value)}
                      placeholder="Imobiliária / Corretor parceiro"
                    />
                    {errors.parceiro_nome && <p className="text-xs text-destructive mt-1">{errors.parceiro_nome}</p>}
                  </div>
                  <div>
                    <Label>% da Comissão</Label>
                    <Input type="text" inputMode="decimal" placeholder="50"
                      className={errors.parceiro_comissao ? "border-destructive" : ""}
                      value={form.parceiroDisplay}
                      onChange={e => {
                        const v = sanitizeNumberInput(e.target.value);
                        set("parceiroDisplay", v);
                        const pct = parseCurrencyInput(v);
                        set("parceiro_comissao_percentual", pct);
                        const val = (comissaoValor * pct) / 100;
                        set("parceiro_comissao_valor", val);
                        set("parceiroValorDisplay", val ? String(val) : "");
                      }} />
                  </div>
                  <div>
                    <Label>ou Valor (R$)</Label>
                    <Input type="text" inputMode="decimal" placeholder="0,00"
                      className={errors.parceiro_comissao ? "border-destructive" : ""}
                      value={form.parceiroValorDisplay}
                      onChange={e => {
                        const v = sanitizeNumberInput(e.target.value);
                        set("parceiroValorDisplay", v);
                        const val = parseCurrencyInput(v);
                        set("parceiro_comissao_valor", val);
                        set("parceiro_comissao_percentual", comissaoValor > 0 ? (val / comissaoValor) * 100 : 0);
                        set("parceiroDisplay", comissaoValor > 0 ? String(((val / comissaoValor) * 100).toFixed(2)).replace(".", ",") : "");
                      }} />
                    {parceiroValor > 0 && <p className="text-xs text-muted-foreground mt-1">{fmt(parceiroValor)}</p>}
                  </div>
                </div>
                {errors.parceiro_comissao && <p className="text-xs text-destructive">{errors.parceiro_comissao}</p>}
              </>
            )}
          </div>

          {/* Captador */}
          <div className="space-y-3 p-3 rounded-lg bg-secondary/30">
            <p className="text-xs font-semibold text-foreground">🎯 Captador</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <Label>Nome</Label>
                <Input value={form.captador_nome} onChange={e => set("captador_nome", e.target.value)} placeholder="Nome do captador" />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input value={form.captador_telefone} onChange={e => set("captador_telefone", e.target.value)} placeholder="(00) 00000-0000" />
              </div>
              <div>
                <Label>% da Comissão</Label>
                <Input type="text" inputMode="decimal" placeholder="10"
                  value={form.captadorDisplay}
                  onChange={e => {
                    const v = sanitizeNumberInput(e.target.value);
                    set("captadorDisplay", v);
                    const pct = parseCurrencyInput(v);
                    set("captador_comissao_percentual", pct);
                    const val = (comissaoValor * pct) / 100;
                    set("captador_comissao_valor", val);
                    set("captadorValorDisplay", val ? String(val) : "");
                  }} />
              </div>
              <div>
                <Label>ou Valor (R$)</Label>
                <Input type="text" inputMode="decimal" placeholder="0,00"
                  value={form.captadorValorDisplay}
                  onChange={e => {
                    const v = sanitizeNumberInput(e.target.value);
                    set("captadorValorDisplay", v);
                    const val = parseCurrencyInput(v);
                    set("captador_comissao_valor", val);
                    set("captador_comissao_percentual", comissaoValor > 0 ? (val / comissaoValor) * 100 : 0);
                    set("captadorDisplay", comissaoValor > 0 ? String(((val / comissaoValor) * 100).toFixed(2)).replace(".", ",") : "");
                  }} />
                {captadorValor > 0 && <p className="text-xs text-muted-foreground mt-1">{fmt(captadorValor)}</p>}
              </div>
            </div>
          </div>

          {/* Impostos */}
          <div className="space-y-3 p-3 rounded-lg bg-secondary/30">
            <p className="text-xs font-semibold text-foreground">🏛️ Impostos</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <Label>Tipo de Imposto</Label>
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
                  value={form.impostoDisplay}
                  onChange={e => {
                    const v = sanitizeNumberInput(e.target.value);
                    set("impostoDisplay", v);
                    const pct = parseCurrencyInput(v);
                    set("imposto_percentual", pct);
                    const val = (comissaoValor * pct) / 100;
                    set("imposto_valor", val);
                    set("impostoValorDisplay", val ? String(val) : "");
                  }} />
              </div>
              <div>
                <Label>ou Valor (R$)</Label>
                <Input type="text" inputMode="decimal" placeholder="0,00"
                  value={form.impostoValorDisplay}
                  onChange={e => {
                    const v = sanitizeNumberInput(e.target.value);
                    set("impostoValorDisplay", v);
                    const val = parseCurrencyInput(v);
                    set("imposto_valor", val);
                    set("imposto_percentual", comissaoValor > 0 ? (val / comissaoValor) * 100 : 0);
                    set("impostoDisplay", comissaoValor > 0 ? String(((val / comissaoValor) * 100).toFixed(2)).replace(".", ",") : "");
                  }} />
              </div>
              <div className="flex items-end">
                <p className="text-sm text-destructive pb-2">{impostoValor > 0 ? `-${fmt(impostoValor)}` : "—"}</p>
              </div>
            </div>
          </div>

          {/* Resumo */}
          {comissaoValor > 0 && (
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
              <p className="text-xs font-semibold text-foreground mb-2">📊 Resumo Financeiro</p>
              <div className="grid grid-cols-2 gap-1 text-xs">
                <span className="text-muted-foreground">Comissão Total:</span>
                <span className="text-right font-medium">{fmt(comissaoValor)}</span>
                {corretorValor > 0 && <>
                  <span className="text-muted-foreground">→ Corretor:</span>
                  <span className="text-right">-{fmt(corretorValor)}</span>
                </>}
                {parceiroValor > 0 && <>
                  <span className="text-muted-foreground">→ Parceiro:</span>
                  <span className="text-right">-{fmt(parceiroValor)}</span>
                </>}
                {captadorValor > 0 && <>
                  <span className="text-muted-foreground">→ Captador:</span>
                  <span className="text-right">-{fmt(captadorValor)}</span>
                </>}
                {impostoValor > 0 && <>
                  <span className="text-muted-foreground">→ Imposto{form.tem_parceria ? " (÷2 parceria)" : ""}:</span>
                  <span className="text-right text-destructive">-{fmt(impostoValor)}</span>
                </>}
                <span className="font-semibold text-foreground border-t border-border pt-1 mt-1">Líquido Imobiliária:</span>
                <span className={`text-right font-bold border-t border-border pt-1 mt-1 ${liquidoImobiliaria >= 0 ? "text-primary" : "text-destructive"}`}>
                  {fmt(liquidoImobiliaria)}
                </span>
              </div>
            </div>
          )}

          <div>
            <Label>Observações</Label>
            <Textarea value={form.observacoes} onChange={e => set("observacoes", e.target.value)} placeholder="Anotações adicionais..." rows={2} />
          </div>

          <button type="submit" disabled={saving}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Fechar Lead e Gerar Contrato
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
