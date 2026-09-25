import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FileDown, Mail, MessageSquare, Loader2, CalendarDays, Building2, User, Phone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Contrato } from "@/hooks/useContratos";
import type { Transacao } from "@/hooks/useTransacoes";
import type { Imovel } from "@/hooks/useImoveis";
import type { Proprietario } from "@/hooks/useProprietarios";
import { exportRelatorioMensalProprietarioPDF } from "@/lib/exportRelatorioMensalProprietarioPDF";
import {
  formatCurrencyBRL,
  isActiveRentalContract,
  getContratoImovel,
  getContratoImovelLabel,
  getTransacoesDoContrato,
  resumirTransacoesContrato,
} from "@/lib/relatorioAluguelUtils";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contratos: Contrato[];
  transacoes: Transacao[];
  imoveis: Imovel[];
  proprietarios: Proprietario[];
  brandName?: string;
  brandPhone?: string;
  brandEmail?: string;
  brandCreci?: string;
}

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export function RelatorioMensalProprietarioDialog({
  open,
  onOpenChange,
  contratos,
  transacoes,
  imoveis,
  proprietarios: proprietariosData,
  brandName,
  brandPhone,
  brandEmail,
  brandCreci,
}: Props) {
  const { toast } = useToast();
  const now = new Date();
  const [selectedProprietario, setSelectedProprietario] = useState<string>("todos");
  const [mesSelecionado, setMesSelecionado] = useState<string>(String(now.getMonth()));
  const [anoSelecionado, setAnoSelecionado] = useState<string>(String(now.getFullYear()));
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) {
      setSelectedProprietario("todos");
      setMesSelecionado(String(now.getMonth()));
      setAnoSelecionado(String(now.getFullYear()));
    }
  }, [open]);

  const contratosLocacao = useMemo(
    () => contratos.filter(isActiveRentalContract),
    [contratos]
  );

  const proprietariosComContratos = useMemo(() => {
    const map = new Map<string, { nome: string; telefone: string | null; email: string | null; contratos: Contrato[] }>();
    const porId = new Map(proprietariosData.map((p) => [p.id, p]));
    const porNome = new Map(proprietariosData.map((p) => [p.nome.trim().toLowerCase(), p]));

    for (const c of contratosLocacao) {
      const nome = c.proprietario || "Sem proprietário";
      const ref = (c.proprietario_id ? porId.get(c.proprietario_id) : null) || porNome.get(nome.trim().toLowerCase()) || null;

      if (!map.has(nome)) {
        map.set(nome, {
          nome,
          telefone: ref?.telefone || c.proprietario_telefone || null,
          email: ref?.email || null,
          contratos: [],
        });
      }
      map.get(nome)!.contratos.push(c);
    }

    return Array.from(map.values()).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [contratosLocacao, proprietariosData]);

  const selectedProp = proprietariosComContratos.find((p) => p.nome === selectedProprietario);
  const mesRef = `${MESES[Number(mesSelecionado)]} ${anoSelecionado}`;

  const filteredContratos = useMemo(() => {
    if (selectedProprietario === "todos") return contratosLocacao;
    return contratosLocacao.filter((c) => (c.proprietario || "Sem proprietário") === selectedProprietario);
  }, [contratosLocacao, selectedProprietario]);

  const resumoGeral = useMemo(() => {
    const txAluguel = transacoes.filter((t) => t.categoria === "aluguel" || t.categoria === "repasse");
    let recebido = 0, pendente = 0;
    filteredContratos.forEach((c) => {
      const imovel = getContratoImovel(c, imoveis);
      const txs = getTransacoesDoContrato({ contrato: c, imovel, transacoes: txAluguel });
      const r = resumirTransacoesContrato(txs);
      recebido += r.recebido;
      pendente += r.pendente + r.atrasado;
    });
    return { recebido, pendente, totalAluguel: filteredContratos.reduce((s, c) => s + c.valor, 0) };
  }, [filteredContratos, transacoes, imoveis]);

  const imoveisRef = useMemo(() =>
    imoveis.map((im) => ({ id: im.id, titulo: im.titulo, endereco: im.endereco, bairro: im.bairro, cidade: im.cidade })),
    [imoveis]
  );

  const handleDownloadPDF = () => {
    if (filteredContratos.length === 0) {
      toast({ title: "Nenhum contrato encontrado", variant: "destructive" });
      return;
    }

    if (selectedProprietario === "todos") {
      let gerados = 0;
      proprietariosComContratos.forEach((prop) => {
        const result = exportRelatorioMensalProprietarioPDF({
          contratos: prop.contratos,
          transacoes,
          imoveis: imoveisRef,
          proprietarioNome: prop.nome,
          proprietarioEmail: prop.email,
          proprietarioTelefone: prop.telefone,
          brandName, brandPhone, brandEmail, brandCreci,
          mesReferencia: mesRef,
        });
        if (result) gerados++;
      });
      toast({ title: `${gerados} relatório(s) gerado(s)` });
    } else {
      const result = exportRelatorioMensalProprietarioPDF({
        contratos: filteredContratos,
        transacoes,
        imoveis: imoveisRef,
        proprietarioNome: selectedProp?.nome || selectedProprietario,
        proprietarioEmail: selectedProp?.email,
        proprietarioTelefone: selectedProp?.telefone,
        brandName, brandPhone, brandEmail, brandCreci,
        mesReferencia: mesRef,
      });
      if (result) {
        toast({ title: "PDF gerado com sucesso!" });
      } else {
        toast({ title: "Nenhum contrato de locação ativo", variant: "destructive" });
      }
    }
  };

  const handleSendWhatsApp = () => {
    const prop = selectedProp;
    const phone = prop?.telefone?.replace(/\D/g, "");

    const lines = filteredContratos.map((c) => {
      const imovel = getContratoImovel(c, imoveis);
      const txAluguel = transacoes.filter((t) => t.categoria === "aluguel" || t.categoria === "repasse");
      const txs = getTransacoesDoContrato({ contrato: c, imovel, transacoes: txAluguel });
      const resumo = resumirTransacoesContrato(txs);
      return `🏠 *${getContratoImovelLabel(c, imovel)}*\n`
        + `   Aluguel: ${formatCurrencyBRL(c.valor)}\n`
        + `   Recebido: ${formatCurrencyBRL(resumo.recebido)}\n`
        + `   Pendente: ${formatCurrencyBRL(resumo.pendente)}`;
    });

    const msg = `📊 *Relatório Mensal - ${mesRef}*\n`
      + `${brandName ? `_${brandName}_\n` : ""}`
      + `Proprietário: *${prop?.nome || selectedProprietario}*\n\n`
      + lines.join("\n\n")
      + `\n\n_O PDF detalhado foi gerado e pode ser enviado em anexo._`;

    handleDownloadPDF();

    const url = phone
      ? `https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
    toast({ title: "WhatsApp aberto!", description: "Anexe o PDF baixado na conversa." });
  };

  const handleSendEmail = async () => {
    const prop = selectedProp;
    if (!prop) {
      toast({ title: "Selecione um proprietário", variant: "destructive" });
      return;
    }

    setSending(true);
    try {
      const txAluguel = transacoes.filter((t) => t.categoria === "aluguel" || t.categoria === "repasse");
      const contractSummary = filteredContratos.map((c) => {
        const imovel = getContratoImovel(c, imoveis);
        const txs = getTransacoesDoContrato({ contrato: c, imovel, transacoes: txAluguel });
        const resumo = resumirTransacoesContrato(txs);
        return {
          imovel: getContratoImovelLabel(c, imovel),
          aluguel: formatCurrencyBRL(c.valor),
          recebido: formatCurrencyBRL(resumo.recebido),
          pendente: formatCurrencyBRL(resumo.pendente),
          inquilino: c.inquilino || c.cliente,
        };
      });

      const { error } = await supabase.functions.invoke("enviar-relatorio-proprietario", {
        body: {
          proprietario_nome: prop.nome,
          proprietario_email: prop.email,
          proprietario_telefone: prop.telefone,
          contratos: contractSummary,
          brand_name: brandName,
          brand_email: brandEmail,
          brand_phone: brandPhone,
          data_relatorio: mesRef,
        },
      });

      if (error) throw error;
      handleDownloadPDF();
      toast({ title: "Relatório enviado!", description: `E-mail preparado para ${prop.nome}` });
    } catch (err: any) {
      console.error("Erro ao enviar relatório:", err);
      handleDownloadPDF();
      toast({
        title: "E-mail não configurado",
        description: "O PDF foi baixado. Configure um domínio de e-mail para envio automático.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const anos = Array.from({ length: 3 }, (_, i) => String(now.getFullYear() - i));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            Relatório Mensal do Proprietário
          </DialogTitle>
          <DialogDescription>
            Gere o relatório mensal com extrato financeiro, status dos imóveis, aluguéis recebidos e próximos vencimentos
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Mês / Ano */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Mês</label>
              <Select value={mesSelecionado} onValueChange={setMesSelecionado}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MESES.map((m, i) => (
                    <SelectItem key={i} value={String(i)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Ano</label>
              <Select value={anoSelecionado} onValueChange={setAnoSelecionado}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {anos.map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Proprietário */}
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Proprietário</label>
            <Select value={selectedProprietario} onValueChange={setSelectedProprietario}>
              <SelectTrigger><SelectValue placeholder="Selecione um proprietário" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">
                  Todos os proprietários ({proprietariosComContratos.length})
                </SelectItem>
                {proprietariosComContratos.map((p) => (
                  <SelectItem key={p.nome} value={p.nome}>
                    {p.nome} ({p.contratos.length} {p.contratos.length === 1 ? "imóvel" : "imóveis"})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Summary */}
          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <p className="text-sm font-semibold text-foreground">{mesRef}</p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="gap-1">
                <Building2 className="h-3 w-3" />
                {filteredContratos.length} {filteredContratos.length === 1 ? "unidade" : "unidades"}
              </Badge>
              <Badge variant="outline" className="gap-1 text-primary border-primary/30">
                {formatCurrencyBRL(resumoGeral.totalAluguel)}/mês
              </Badge>
              <Badge variant="outline" className="gap-1 text-success border-success/30">
                Recebido: {formatCurrencyBRL(resumoGeral.recebido)}
              </Badge>
              {resumoGeral.pendente > 0 && (
                <Badge variant="outline" className="gap-1 text-warning border-warning/30">
                  Pendente: {formatCurrencyBRL(resumoGeral.pendente)}
                </Badge>
              )}
            </div>
            {selectedProp && (
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground pt-1">
                <span className="flex items-center gap-1"><User className="h-3 w-3" />{selectedProp.nome}</span>
                {selectedProp.telefone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{selectedProp.telefone}</span>}
                {selectedProp.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{selectedProp.email}</span>}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="grid grid-cols-1 gap-2">
            <Button onClick={handleDownloadPDF} variant="outline" className="gap-2 justify-start">
              <FileDown className="h-4 w-4" />
              {selectedProprietario === "todos"
                ? `Baixar ${proprietariosComContratos.length} PDF(s)`
                : "Baixar PDF"}
            </Button>
            <Button onClick={handleSendWhatsApp} className="gap-2 justify-start bg-success text-success-foreground hover:bg-success/90">
              <MessageSquare className="h-4 w-4" />
              Enviar via WhatsApp
            </Button>
            <Button
              onClick={handleSendEmail}
              disabled={sending || selectedProprietario === "todos" || !selectedProp?.email}
              className="gap-2 justify-start"
              variant="outline"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Enviar por E-mail
              {selectedProprietario === "todos" && <span className="text-xs text-muted-foreground ml-1">(selecione um proprietário)</span>}
              {selectedProp && !selectedProp.email && <span className="text-xs text-muted-foreground ml-1">(sem e-mail)</span>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
