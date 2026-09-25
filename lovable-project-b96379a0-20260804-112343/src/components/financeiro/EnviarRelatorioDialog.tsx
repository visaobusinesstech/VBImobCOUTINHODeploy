import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Mail, FileDown, Loader2, Building2, User, Phone, Home, Calendar, Shield, ChevronsUpDown, Check, Files, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { Contrato } from "@/hooks/useContratos";
import type { Transacao } from "@/hooks/useTransacoes";
import type { Imovel } from "@/hooks/useImoveis";
import type { Proprietario } from "@/hooks/useProprietarios";
import { exportRelatorioAluguelPDF } from "@/lib/exportRelatorioAluguelPDF";
import {
  formatCurrencyBRL,
  getContratoImovel,
  getContratoImovelLabel,
  getTransacoesDoContrato,
  isActiveRentalContract,
  resumirTransacoesContrato,
  getContratoInquilino,
  getGarantiaLabel,
  getCustoMensalTotal,
  formatDateBR,
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

export function EnviarRelatorioDialog({
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
  const [selectedProprietario, setSelectedProprietario] = useState<string>("todos");
  const [selectedContratoId, setSelectedContratoId] = useState<string>("todas");
  const [unidadePopoverOpen, setUnidadePopoverOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [modoRelatorio, setModoRelatorio] = useState<"consolidado" | "separado">("consolidado");

  const contratosLocacao = useMemo(
    () => contratos.filter(isActiveRentalContract),
    [contratos]
  );

  const proprietarios = useMemo(() => {
    const map = new Map<string, { nome: string; telefone: string | null; email: string | null; contratos: Contrato[] }>();
    const proprietariosPorId = new Map(proprietariosData.map((item) => [item.id, item]));
    const proprietariosPorNome = new Map(
      proprietariosData.map((item) => [item.nome.trim().toLowerCase(), item]),
    );

    for (const c of contratosLocacao) {
      const nome = c.proprietario || "Sem proprietário";
      const proprietarioRelacionado =
        (c.proprietario_id ? proprietariosPorId.get(c.proprietario_id) : null) ||
        proprietariosPorNome.get(nome.trim().toLowerCase()) ||
        null;

      if (!map.has(nome)) {
        map.set(nome, {
          nome,
          telefone: proprietarioRelacionado?.telefone || c.proprietario_telefone || null,
          email: proprietarioRelacionado?.email || null,
          contratos: [],
        });
      }
      map.get(nome)!.contratos.push(c);
    }

    return Array.from(map.values());
  }, [contratosLocacao, proprietariosData]);

  const contratosFiltradosPorProprietario = useMemo(() => {
    if (selectedProprietario === "todos") return contratosLocacao;
    return contratosLocacao.filter((c) => (c.proprietario || "Sem proprietário") === selectedProprietario);
  }, [contratosLocacao, selectedProprietario]);

  const unidadesDisponiveis = useMemo(() => {
    return contratosFiltradosPorProprietario.map((contrato) => {
      const imovel = getContratoImovel(contrato, imoveis);
      const labelBase = getContratoImovelLabel(contrato, imovel);
      const label = contrato.numero_unidade
        ? `${labelBase} • Unidade ${contrato.numero_unidade}`
        : labelBase;

      return {
        id: contrato.id,
        label,
      };
    });
  }, [contratosFiltradosPorProprietario, imoveis]);

  const filteredContratos = useMemo(() => {
    if (selectedContratoId === "todas") return contratosFiltradosPorProprietario;
    return contratosFiltradosPorProprietario.filter((c) => c.id === selectedContratoId);
  }, [contratosFiltradosPorProprietario, selectedContratoId]);

  const selectedProp = proprietarios.find((p) => p.nome === selectedProprietario);
  const selectedUnidade = unidadesDisponiveis.find((item) => item.id === selectedContratoId);

  useEffect(() => {
    if (!open) {
      setSelectedProprietario("todos");
      setSelectedContratoId("todas");
      return;
    }

    setSelectedContratoId("todas");
  }, [selectedProprietario, open]);

  const pdfOptions = (contratosParaPDF: typeof filteredContratos) => ({
    contratos: contratosParaPDF,
    transacoes,
    imoveis: imoveis.map((im) => ({ id: im.id, titulo: im.titulo, endereco: im.endereco, bairro: im.bairro, cidade: im.cidade })),
    proprietarios: proprietariosData.map((item) => ({
      id: item.id,
      nome: item.nome,
      email: item.email,
      telefone: item.telefone,
      cpf_cnpj: item.cpf_cnpj,
    })),
    brandName,
    brandPhone,
    brandEmail,
    brandCreci,
  });

  const handleDownloadPDF = () => {
    if (filteredContratos.length === 0) {
      toast({ title: "Nenhum contrato encontrado", variant: "destructive" });
      return;
    }

    if (modoRelatorio === "separado") {
      // Generate one PDF per contract/unit
      let gerados = 0;
      filteredContratos.forEach((c) => {
        const unitLabel = c.numero_unidade || c.titulo || c.id.slice(0, 8);
        const result = exportRelatorioAluguelPDF({ ...pdfOptions([c]), filenameSuffix: unitLabel });
        if (result) gerados++;
      });
      if (gerados > 0) {
        toast({ title: `${gerados} PDF(s) gerado(s)`, description: "Um arquivo por unidade foi baixado." });
      } else {
        toast({ title: "Não foi possível gerar os PDFs", variant: "destructive" });
      }
    } else {
      const result = exportRelatorioAluguelPDF(pdfOptions(filteredContratos));
      if (!result) {
        toast({ title: "Não foi possível gerar o PDF", variant: "destructive" });
      } else {
        toast({ title: "PDF consolidado gerado com sucesso!" });
      }
    }
  };

  const handleSendWhatsApp = () => {
    const prop = selectedProp;
    const phone = prop?.telefone?.replace(/\D/g, "");

    const lines = filteredContratos.map((c) => {
      const imovel = getContratoImovel(c, imoveis);
      const txs = getTransacoesDoContrato({
        contrato: c,
        imovel,
        transacoes: transacoes.filter((t) => t.categoria === "aluguel" || t.categoria === "repasse"),
      });
      const resumo = resumirTransacoesContrato(txs);

      return `🏠 *${getContratoImovelLabel(c, imovel)}*\n`
        + `   Aluguel: ${formatCurrencyBRL(c.valor)}\n`
        + `   Recebido: ${formatCurrencyBRL(resumo.recebido)}\n`
        + `   Pendente: ${formatCurrencyBRL(resumo.pendente)}`;
    });

    const msg = `📊 *Relatório de Aluguéis*\n`
      + `${brandName ? `_${brandName}_\n` : ""}`
      + `📅 ${new Date().toLocaleDateString("pt-BR")}\n\n`
      + lines.join("\n\n")
      + `\n\n_O PDF detalhado foi gerado e pode ser enviado em anexo._`;

    const url = phone
      ? `https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;

    window.open(url, "_blank");
    handleDownloadPDF();
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
      const contractSummary = filteredContratos.map((c) => {
        const imovel = getContratoImovel(c, imoveis);
        const txs = getTransacoesDoContrato({
          contrato: c,
          imovel,
          transacoes: transacoes.filter((t) => t.categoria === "aluguel" || t.categoria === "repasse"),
        });
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
          data_relatorio: new Date().toLocaleDateString("pt-BR"),
        },
      });

      if (error) throw error;

      handleDownloadPDF();
      toast({ title: "Relatório enviado!", description: `E-mail enviado para ${prop.nome}` });
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Enviar Relatório ao Proprietário
          </DialogTitle>
          <DialogDescription>
            Gere e envie o relatório de aluguéis para o proprietário via WhatsApp ou E-mail
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Proprietário</label>
            <Select value={selectedProprietario} onValueChange={setSelectedProprietario}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um proprietário" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os proprietários</SelectItem>
                {proprietarios.map((p) => (
                  <SelectItem key={p.nome} value={p.nome}>
                    {p.nome} ({p.contratos.length} {p.contratos.length === 1 ? "imóvel" : "imóveis"})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Unidade</label>
            <Popover open={unidadePopoverOpen} onOpenChange={setUnidadePopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={unidadePopoverOpen} className="w-full justify-between font-normal">
                  {selectedContratoId === "todas"
                    ? "Todas as unidades"
                    : selectedUnidade?.label || "Selecione uma unidade"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full min-w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar unidade..." />
                  <CommandList>
                    <CommandEmpty>Nenhuma unidade encontrada.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="todas"
                        onSelect={() => { setSelectedContratoId("todas"); setUnidadePopoverOpen(false); }}
                      >
                        <Check className={cn("mr-2 h-4 w-4", selectedContratoId === "todas" ? "opacity-100" : "opacity-0")} />
                        Todas as unidades
                      </CommandItem>
                      {unidadesDisponiveis.map((unidade) => (
                        <CommandItem
                          key={unidade.id}
                          value={unidade.label}
                          onSelect={() => { setSelectedContratoId(unidade.id); setUnidadePopoverOpen(false); }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", selectedContratoId === unidade.id ? "opacity-100" : "opacity-0")} />
                          {unidade.label}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="bg-muted/50 rounded-lg p-3 space-y-3">
            <p className="text-sm font-medium text-foreground">Resumo do relatório</p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="gap-1">
                <Building2 className="h-3 w-3" />
                {filteredContratos.length} {filteredContratos.length === 1 ? "unidade" : "unidades"}
              </Badge>
              <Badge variant="outline" className="gap-1 text-primary border-primary/30">
                {formatCurrencyBRL(filteredContratos.reduce((s, c) => s + c.valor, 0))}/mês
              </Badge>
              {selectedUnidade && (
                <Badge variant="outline" className="gap-1">
                  <Home className="h-3 w-3" /> {selectedUnidade.label}
                </Badge>
              )}
              {selectedProp?.telefone && (
                <Badge variant="outline" className="gap-1">
                  <Phone className="h-3 w-3" /> {selectedProp.telefone}
                </Badge>
              )}
            </div>

            {filteredContratos.length > 0 && (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {filteredContratos.map((c) => {
                  const im = getContratoImovel(c, imoveis);
                  const txAluguel = transacoes.filter((t) => t.categoria === "aluguel" || t.categoria === "repasse");
                  const txs = getTransacoesDoContrato({ contrato: c, imovel: im, transacoes: txAluguel });
                  const resumo = resumirTransacoesContrato(txs);
                  const custo = getCustoMensalTotal(c);

                  return (
                    <div key={c.id} className="bg-background border border-border rounded-md p-2.5 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-foreground flex items-center gap-1">
                          <Home className="h-3 w-3 text-primary" />
                          {getContratoImovelLabel(c, im)}
                        </span>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {c.status === "vencendo" ? "Vencendo" : "Ativo"}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                        <span><User className="h-3 w-3 inline mr-1" />{getContratoInquilino(c)}</span>
                        <span>Aluguel: <strong className="text-foreground">{formatCurrencyBRL(custo.aluguel)}</strong></span>
                        <span><Calendar className="h-3 w-3 inline mr-1" />{formatDateBR(c.data_inicio)} a {formatDateBR(c.data_fim)}</span>
                        <span>Total/mês: <strong className="text-foreground">{formatCurrencyBRL(custo.total)}</strong></span>
                        <span><Shield className="h-3 w-3 inline mr-1" />{getGarantiaLabel(c)}</span>
                        <span>Venc: Dia {c.dia_vencimento_aluguel || 10}</span>
                      </div>
                      <div className="flex gap-3 text-[10px] pt-1 border-t border-border/50">
                        <span className="text-success font-medium">Recebido: {formatCurrencyBRL(resumo.recebido)}</span>
                        <span className="text-warning font-medium">Pendente: {formatCurrencyBRL(resumo.pendente)}</span>
                        <span className="text-muted-foreground">{resumo.totalTransacoes} transações</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Modo do relatório */}
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Modo do Relatório</label>
            <div className="flex gap-2">
              <button
                onClick={() => setModoRelatorio("consolidado")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors",
                  modoRelatorio === "consolidado"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border hover:bg-muted"
                )}
              >
                <FileText className="h-4 w-4" />
                Consolidado
              </button>
              <button
                onClick={() => setModoRelatorio("separado")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors",
                  modoRelatorio === "separado"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border hover:bg-muted"
                )}
              >
                <Files className="h-4 w-4" />
                Separado por Unidade
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {modoRelatorio === "consolidado"
                ? "Gera um único PDF com todas as unidades selecionadas"
                : "Gera um PDF individual para cada unidade"}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2">
            <Button onClick={handleDownloadPDF} variant="outline" className="gap-2 justify-start">
              <FileDown className="h-4 w-4" />
              {modoRelatorio === "consolidado" ? "Baixar PDF Consolidado" : `Baixar ${filteredContratos.length} PDF(s) Separados`}
            </Button>
            <Button onClick={handleSendWhatsApp} className="gap-2 justify-start bg-success text-success-foreground hover:bg-success/90">
              <MessageSquare className="h-4 w-4" />
              Enviar via WhatsApp
              {!selectedProp?.telefone && selectedProprietario !== "todos" && (
                <span className="text-xs opacity-70">(sem telefone)</span>
              )}
            </Button>
            <Button
              onClick={handleSendEmail}
              variant="outline"
              className="gap-2 justify-start"
              disabled={sending || selectedProprietario === "todos"}
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Enviar por E-mail
              {selectedProprietario === "todos" && (
                <span className="text-xs text-muted-foreground">(selecione um proprietário)</span>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
