import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import type { Transacao } from "@/hooks/useTransacoes";
import { CATEGORIAS, STATUS_OPTIONS, RECORRENCIA_OPTIONS } from "@/hooks/useTransacoes";
import { CANAIS_ORIGEM } from "@/lib/canaisOrigem";
import { useDraft } from "@/hooks/useDraft";

const formatCurrencyDisplay = (value: number): string => {
  if (!value) return "";
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
};

const sanitizeNumberInput = (raw: string) => raw.replace(/[^\d.,]/g, "");

const parseCurrencyInput = (raw: string): number => {
  const cleaned = sanitizeNumberInput(raw);
  if (!cleaned) return 0;

  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  const lastSeparatorIndex = Math.max(lastComma, lastDot);

  if (lastSeparatorIndex === -1) {
    const integerOnly = cleaned.replace(/\D/g, "");
    return integerOnly ? Number.parseFloat(integerOnly) : 0;
  }

  const integerPart = cleaned.slice(0, lastSeparatorIndex).replace(/\D/g, "") || "0";
  const decimalPartRaw = cleaned.slice(lastSeparatorIndex + 1).replace(/\D/g, "");

  if (decimalPartRaw.length === 0 || decimalPartRaw.length > 2) {
    const integerOnly = cleaned.replace(/\D/g, "");
    return integerOnly ? Number.parseFloat(integerOnly) : 0;
  }

  const normalized = `${integerPart}.${decimalPartRaw.padEnd(2, "0").slice(0, 2)}`;
  const num = Number.parseFloat(normalized);
  return Number.isFinite(num) ? num : 0;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transacao: Transacao | null;
  onSave: (data: Partial<Transacao>) => Promise<void>;
  saving: boolean;
}

const emptyTransacaoForm = {
  descricao: "",
  tipo: "entrada",
  categoria: "comissao",
  valor: 0,
  data: new Date().toISOString().split("T")[0],
  status: "pendente",
  observacoes: "",
  canal_origem: "",
  recorrencia: "",
  corretor_nome: "",
  parceiro_nome: "",
  captador_nome: "",
  comissao_percentual: 0,
  comissao_valor: 0,
  parceiro_comissao_percentual: 0,
  parceiro_comissao_valor: 0,
  captador_comissao_percentual: 0,
  captador_comissao_valor: 0,
  divisao_comissao: "",
  data_recebimento: "",
  numero_unidade: "",
  proprietario_nome: "",
  proprietario_telefone: "",
  proprietario_cpf: "",
  imposto_tipo: "",
  imposto_percentual: 0,
  imposto_valor: 0,
  valor_nao_tributavel: 0,
  valor_iptu: 0,
  valor_condominio: 0,
  taxa_extra: 0,
  taxa_extra_descricao: "",
};

export function TransacaoFormDialog({ open, onOpenChange, transacao, onSave, saving }: Props) {
  const [valorDisplay, setValorDisplay] = useState("");
  const [form, setForm] = useState(emptyTransacaoForm);
  const isNew = !transacao;
  const { clearDraft } = useDraft("transacao", form, setForm, { enabled: isNew, open });

  useEffect(() => {
    if (transacao) {
      setForm({
        descricao: transacao.descricao,
        tipo: transacao.tipo,
        categoria: transacao.categoria,
        valor: transacao.valor,
        data: transacao.data,
        status: transacao.status,
        observacoes: transacao.observacoes || "",
        canal_origem: transacao.canal_origem || "",
        recorrencia: transacao.recorrencia || (transacao.tipo === "saida" ? "mensal" : ""),
        corretor_nome: transacao.corretor_nome || "",
        parceiro_nome: transacao.parceiro_nome || "",
        captador_nome: transacao.captador_nome || "",
        comissao_percentual: transacao.comissao_percentual || 0,
        comissao_valor: transacao.comissao_valor || 0,
        parceiro_comissao_percentual: transacao.parceiro_comissao_percentual || 0,
        parceiro_comissao_valor: transacao.parceiro_comissao_valor || 0,
        captador_comissao_percentual: transacao.captador_comissao_percentual || 0,
        captador_comissao_valor: transacao.captador_comissao_valor || 0,
        divisao_comissao: transacao.divisao_comissao || "",
        data_recebimento: transacao.data_recebimento || "",
        numero_unidade: transacao.numero_unidade || "",
        proprietario_nome: transacao.proprietario_nome || "",
        proprietario_telefone: transacao.proprietario_telefone || "",
        proprietario_cpf: transacao.proprietario_cpf || "",
        imposto_tipo: transacao.imposto_tipo || "",
        imposto_percentual: transacao.imposto_percentual || 0,
        imposto_valor: transacao.imposto_valor || 0,
        valor_nao_tributavel: transacao.valor_nao_tributavel || 0,
        valor_iptu: transacao.valor_iptu || 0,
        valor_condominio: transacao.valor_condominio || 0,
        taxa_extra: transacao.taxa_extra || 0,
        taxa_extra_descricao: transacao.taxa_extra_descricao || "",
      });
      setValorDisplay(formatCurrencyDisplay(transacao.valor));
    } else if (open) {
      setForm({ ...emptyTransacaoForm, data: new Date().toISOString().split("T")[0] });
      setValorDisplay("");
    }
  }, [transacao, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.descricao.trim()) return;
    const payload = {
      ...form,
      canal_origem: form.canal_origem || null,
      recorrencia: form.recorrencia || null,
      corretor_nome: form.corretor_nome || null,
      parceiro_nome: form.parceiro_nome || null,
      captador_nome: form.captador_nome || null,
      divisao_comissao: form.divisao_comissao || null,
      data_recebimento: form.data_recebimento || null,
      numero_unidade: form.numero_unidade || null,
      proprietario_nome: form.proprietario_nome || null,
      proprietario_telefone: form.proprietario_telefone || null,
      proprietario_cpf: form.proprietario_cpf || null,
      imposto_tipo: form.imposto_tipo || null,
      imposto_percentual: form.imposto_percentual || 0,
      imposto_valor: form.imposto_valor || 0,
      valor_nao_tributavel: form.valor_nao_tributavel || 0,
      valor_iptu: form.valor_iptu || 0,
      valor_condominio: form.valor_condominio || 0,
      taxa_extra: form.taxa_extra || 0,
      taxa_extra_descricao: form.taxa_extra_descricao || null,
    };
    await onSave(payload);
    clearDraft();
  };

  const set = (key: string, value: any) => setForm(prev => ({ ...prev, [key]: value }));

  const fmtCur = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const isComissao = form.categoria === "comissao";
  const comissaoCalc = form.valor > 0 && form.comissao_percentual > 0
    ? (form.valor * form.comissao_percentual) / 100
    : form.comissao_valor;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{transacao ? "Editar Transação" : "Nova Transação"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Descrição *</Label>
            <Input value={form.descricao} onChange={e => set("descricao", e.target.value)} placeholder="Ex: Comissão - Apt Vila Mariana" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={v => {
                set("tipo", v);
                if (v === "saida" && !form.recorrencia) set("recorrencia", "mensal");
                if (v === "entrada" && form.recorrencia === "mensal") set("recorrencia", "");
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrada">Entrada</SelectItem>
                  <SelectItem value="saida">Saída</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={form.categoria} onValueChange={v => set("categoria", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map(c => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Valor (R$)</Label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={valorDisplay}
                onFocus={() => { if (form.valor === 0) setValorDisplay(""); }}
                onChange={e => {
                  const nextValue = sanitizeNumberInput(e.target.value);
                  setValorDisplay(nextValue);
                  set("valor", parseCurrencyInput(nextValue));
                }}
                onBlur={() => setValorDisplay(form.valor ? formatCurrencyDisplay(form.valor) : "")}
              />
            </div>
            <div>
              <Label>Data</Label>
              <Input type="date" value={form.data} onChange={e => set("data", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Recorrência</Label>
              <Select value={form.recorrencia || "nenhuma"} onValueChange={v => set("recorrencia", v === "nenhuma" ? "" : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RECORRENCIA_OPTIONS.map(r => <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Canal de Origem</Label>
              <Select value={form.canal_origem || "_none"} onValueChange={v => set("canal_origem", v === "_none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Não informado" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Não informado</SelectItem>
                  {CANAIS_ORIGEM.map(c => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data Recebimento</Label>
              <Input type="date" value={form.data_recebimento} onChange={e => set("data_recebimento", e.target.value)} />
            </div>
          </div>

          {/* Corretor e Parceiro */}
          {/* Dados da Unidade e Proprietário */}
          <div className="space-y-3 p-3 rounded-lg bg-secondary/30">
            <p className="text-xs font-semibold text-foreground">🏠 Dados da Unidade e Proprietário</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nº Unidade</Label>
                <Input value={form.numero_unidade} onChange={e => set("numero_unidade", e.target.value)} placeholder="Ex: Apt 101" />
              </div>
              <div>
                <Label>Proprietário</Label>
                <Input value={form.proprietario_nome} onChange={e => set("proprietario_nome", e.target.value)} placeholder="Nome do proprietário" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Telefone Proprietário</Label>
                <Input value={form.proprietario_telefone} onChange={e => set("proprietario_telefone", e.target.value)} placeholder="(00) 00000-0000" />
              </div>
              <div>
                <Label>CPF/CNPJ Proprietário</Label>
                <Input value={form.proprietario_cpf} onChange={e => set("proprietario_cpf", e.target.value)} placeholder="000.000.000-00" />
              </div>
            </div>
          </div>

          {/* Impostos e Taxas */}
          <div className="space-y-3 p-3 rounded-lg bg-secondary/30">
            <p className="text-xs font-semibold text-foreground">📋 Impostos e Taxas</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Tipo Imposto</Label>
                <Select value={form.imposto_tipo || "_none"} onValueChange={v => set("imposto_tipo", v === "_none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Nenhum</SelectItem>
                    <SelectItem value="irrf">IRRF</SelectItem>
                    <SelectItem value="iss">ISS</SelectItem>
                    <SelectItem value="pis_cofins">PIS/COFINS</SelectItem>
                    <SelectItem value="csll">CSLL</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>% Imposto</Label>
                <Input type="text" inputMode="decimal" placeholder="0,00"
                  value={form.imposto_percentual || ""}
                  onChange={e => {
                    const pct = parseCurrencyInput(sanitizeNumberInput(e.target.value));
                    set("imposto_percentual", pct);
                    set("imposto_valor", (form.valor * pct) / 100);
                  }} />
              </div>
              <div>
                <Label>Valor Imposto</Label>
                <Input type="text" inputMode="decimal" placeholder="0,00"
                  value={form.imposto_valor || ""}
                  onChange={e => {
                    const val = parseCurrencyInput(sanitizeNumberInput(e.target.value));
                    set("imposto_valor", val);
                    set("imposto_percentual", form.valor > 0 ? (val / form.valor) * 100 : 0);
                  }} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valor Não Tributável</Label>
                <Input type="text" inputMode="decimal" placeholder="0,00"
                  value={form.valor_nao_tributavel || ""}
                  onChange={e => set("valor_nao_tributavel", parseCurrencyInput(sanitizeNumberInput(e.target.value)))} />
              </div>
              <div>
                <Label>IPTU (R$)</Label>
                <Input type="text" inputMode="decimal" placeholder="0,00"
                  value={form.valor_iptu || ""}
                  onChange={e => set("valor_iptu", parseCurrencyInput(sanitizeNumberInput(e.target.value)))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Condomínio (R$)</Label>
                <Input type="text" inputMode="decimal" placeholder="0,00"
                  value={form.valor_condominio || ""}
                  onChange={e => set("valor_condominio", parseCurrencyInput(sanitizeNumberInput(e.target.value)))} />
              </div>
              <div>
                <Label>Taxa Extra (R$)</Label>
                <Input type="text" inputMode="decimal" placeholder="0,00"
                  value={form.taxa_extra || ""}
                  onChange={e => set("taxa_extra", parseCurrencyInput(sanitizeNumberInput(e.target.value)))} />
              </div>
            </div>
            {(form.taxa_extra > 0) && (
              <div>
                <Label>Descrição Taxa Extra</Label>
                <Input value={form.taxa_extra_descricao} onChange={e => set("taxa_extra_descricao", e.target.value)} placeholder="Ex: Pintura, reforma..." />
              </div>
            )}
          </div>

          <div className="space-y-3 p-3 rounded-lg bg-secondary/30">
            <p className="text-xs font-semibold text-foreground">👤 Corretor e Parceiro</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Corretor</Label>
                <Input value={form.corretor_nome} onChange={e => set("corretor_nome", e.target.value)} placeholder="Nome do corretor" />
              </div>
              <div>
                <Label>Parceiro</Label>
                <Input value={form.parceiro_nome} onChange={e => set("parceiro_nome", e.target.value)} placeholder="Nome do parceiro" />
              </div>
            </div>
            <div>
              <Label>Captador</Label>
              <Input value={form.captador_nome} onChange={e => set("captador_nome", e.target.value)} placeholder="Nome do captador (se houver)" />
            </div>
          </div>

          {/* Comissão e Divisão */}
          {form.tipo === "entrada" && (
            <div className="space-y-3 p-3 rounded-lg bg-secondary/30">
              <p className="text-xs font-semibold text-foreground">💰 Comissão e Divisão</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>% Comissão</Label>
                  <Input type="text" inputMode="decimal" placeholder="0,00"
                    value={form.comissao_percentual || ""}
                    onChange={e => {
                      const pct = parseCurrencyInput(sanitizeNumberInput(e.target.value));
                      set("comissao_percentual", pct);
                      set("comissao_valor", (form.valor * pct) / 100);
                    }} />
                </div>
                <div>
                  <Label>Valor Comissão</Label>
                  <Input type="text" inputMode="decimal" placeholder="0,00"
                    value={form.comissao_valor || ""}
                    onChange={e => {
                      const val = parseCurrencyInput(sanitizeNumberInput(e.target.value));
                      set("comissao_valor", val);
                      set("comissao_percentual", form.valor > 0 ? (val / form.valor) * 100 : 0);
                    }} />
                </div>
                <div className="flex items-end">
                  <p className="text-sm font-medium text-primary pb-2">{comissaoCalc > 0 ? fmtCur(comissaoCalc) : "—"}</p>
                </div>
              </div>
              {form.parceiro_nome && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>% Parceiro</Label>
                    <Input type="text" inputMode="decimal" placeholder="0,00"
                      value={form.parceiro_comissao_percentual || ""}
                      onChange={e => {
                        const pct = parseCurrencyInput(sanitizeNumberInput(e.target.value));
                        set("parceiro_comissao_percentual", pct);
                        set("parceiro_comissao_valor", (comissaoCalc * pct) / 100);
                      }} />
                  </div>
                  <div>
                    <Label>Valor Parceiro</Label>
                    <Input type="text" inputMode="decimal" placeholder="0,00"
                      value={form.parceiro_comissao_valor || ""}
                      onChange={e => set("parceiro_comissao_valor", parseCurrencyInput(sanitizeNumberInput(e.target.value)))} />
                  </div>
                </div>
              )}
              {form.captador_nome && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>% Captador</Label>
                    <Input type="text" inputMode="decimal" placeholder="0,00"
                      value={form.captador_comissao_percentual || ""}
                      onChange={e => {
                        const pct = parseCurrencyInput(sanitizeNumberInput(e.target.value));
                        set("captador_comissao_percentual", pct);
                        set("captador_comissao_valor", (comissaoCalc * pct) / 100);
                      }} />
                  </div>
                  <div>
                    <Label>Valor Captador</Label>
                    <Input type="text" inputMode="decimal" placeholder="0,00"
                      value={form.captador_comissao_valor || ""}
                      onChange={e => set("captador_comissao_valor", parseCurrencyInput(sanitizeNumberInput(e.target.value)))} />
                  </div>
                </div>
              )}
              <div>
                <Label>Divisão de Comissão (observação)</Label>
                <Input value={form.divisao_comissao} onChange={e => set("divisao_comissao", e.target.value)} placeholder="Ex: 50/50 com parceiro..." />
              </div>
            </div>
          )}

          <div>
            <Label>Observações</Label>
            <Textarea value={form.observacoes} onChange={e => set("observacoes", e.target.value)} placeholder="Anotações..." rows={2} />
          </div>
          <button
            type="submit"
            disabled={saving || !form.descricao.trim()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {transacao ? "Salvar Alterações" : "Registrar Transação"}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
