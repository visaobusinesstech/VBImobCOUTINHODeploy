import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { MessageSquare, FileDown, Building2, User, Receipt, Files, FileText, ChevronsUpDown, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Transacao } from "@/hooks/useTransacoes";
import type { Contrato } from "@/hooks/useContratos";
import { exportRelatorioUnidadePDF } from "@/lib/exportRelatorioUnidadePDF";
import { cn } from "@/lib/utils";
import { isActiveRentalContract } from "@/lib/relatorioAluguelUtils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transacoes: Transacao[];
  contratos: Contrato[];
  brandName?: string;
  brandPhone?: string;
  brandEmail?: string;
  brandCreci?: string;
}

interface UnidadeResumo {
  id: string;
  label: string;
  numeroUnidade: string;
  proprietario: string | null;
  transacoes: Transacao[];
  receitas: number;
  despesas: number;
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const normalizeText = (value: string | null | undefined) =>
  (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const dedupeTransacoes = (items: Transacao[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.id}-${item.numero_unidade ?? "sem-unidade"}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export function RelatorioUnidadeDialog({
  open,
  onOpenChange,
  transacoes,
  contratos,
  brandName,
  brandPhone,
  brandEmail,
  brandCreci,
}: Props) {
  const { toast } = useToast();
  const [selectedUnidadeId, setSelectedUnidadeId] = useState<string>("todas");
  const [modoRelatorio, setModoRelatorio] = useState<"consolidado" | "separado">("consolidado");
  const [unidadePopoverOpen, setUnidadePopoverOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      setSelectedUnidadeId("todas");
      setModoRelatorio("consolidado");
      setUnidadePopoverOpen(false);
    }
  }, [open]);

  const unidades = useMemo(() => {
    const contratosLocacao = contratos.filter(isActiveRentalContract);
    const unidadesMap = new Map<string, UnidadeResumo>();

    contratosLocacao.forEach((contrato) => {
      const unitNumber = contrato.numero_unidade?.trim() || contrato.titulo?.trim() || "Sem Unidade";
      const unitId = contrato.numero_unidade?.trim() || contrato.imovel_id || contrato.id;
      const tituloNormalizado = normalizeText(contrato.titulo);
      const numeroNormalizado = normalizeText(contrato.numero_unidade);

      const relacionadas = dedupeTransacoes(
        transacoes
          .filter((transacao) => {
            const mesmaUnidade = Boolean(numeroNormalizado) && normalizeText(transacao.numero_unidade) === numeroNormalizado;
            const mesmoImovel = Boolean(contrato.imovel_id) && transacao.imovel_id === contrato.imovel_id;
            const descricao = normalizeText(transacao.descricao);
            const matchTitulo = tituloNormalizado.length >= 4 && descricao.includes(tituloNormalizado);
            return mesmaUnidade || mesmoImovel || (!transacao.imovel_id && matchTitulo);
          })
          .map((transacao) => ({
            ...transacao,
            numero_unidade: transacao.numero_unidade?.trim() || contrato.numero_unidade?.trim() || contrato.titulo,
            proprietario_nome: transacao.proprietario_nome || contrato.proprietario || null,
          })),
      );

      const existente = unidadesMap.get(unitId);
      const mergedTransacoes = dedupeTransacoes([...(existente?.transacoes ?? []), ...relacionadas]);
      const receitas = mergedTransacoes
        .filter((item) => item.tipo === "entrada")
        .reduce((total, item) => total + Number(item.valor || 0), 0);
      const despesas = mergedTransacoes
        .filter((item) => item.tipo === "saida")
        .reduce((total, item) => total + Number(item.valor || 0), 0);

      unidadesMap.set(unitId, {
        id: unitId,
        label: contrato.numero_unidade?.trim()
          ? `Unidade ${contrato.numero_unidade.trim()} • ${contrato.titulo}`
          : contrato.titulo,
        numeroUnidade: unitNumber,
        proprietario: existente?.proprietario || contrato.proprietario || mergedTransacoes[0]?.proprietario_nome || null,
        transacoes: mergedTransacoes,
        receitas,
        despesas,
      });
    });

    if (!unidadesMap.size) {
      const fallbackMap = new Map<string, UnidadeResumo>();
      transacoes.forEach((transacao) => {
        const unitNumber = transacao.numero_unidade?.trim() || "Sem Unidade";
        const existente = fallbackMap.get(unitNumber);
        const lista = [...(existente?.transacoes ?? []), transacao];
        const receitas = lista
          .filter((item) => item.tipo === "entrada")
          .reduce((total, item) => total + Number(item.valor || 0), 0);
        const despesas = lista
          .filter((item) => item.tipo === "saida")
          .reduce((total, item) => total + Number(item.valor || 0), 0);

        fallbackMap.set(unitNumber, {
          id: unitNumber,
          label: unitNumber,
          numeroUnidade: unitNumber,
          proprietario: transacao.proprietario_nome,
          transacoes: lista,
          receitas,
          despesas,
        });
      });

      return Array.from(fallbackMap.values()).sort((a, b) => a.label.localeCompare(b.label));
    }

    return Array.from(unidadesMap.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [contratos, transacoes]);

  const selectedInfo = useMemo(
    () => unidades.find((unidade) => unidade.id === selectedUnidadeId) ?? null,
    [selectedUnidadeId, unidades],
  );

  const transacoesConsolidadas = useMemo(
    () => dedupeTransacoes(unidades.flatMap((unidade) => unidade.transacoes)),
    [unidades],
  );

  const brandProps = { brandName, brandPhone, brandEmail, brandCreci };

  const handleDownloadPDF = () => {
    if (selectedUnidadeId === "todas" && modoRelatorio === "separado") {
      const unidadesComDados = unidades.filter((unidade) => unidade.transacoes.length > 0);
      let gerados = 0;

      unidadesComDados.forEach((unidade) => {
        const result = exportRelatorioUnidadePDF({
          transacoes: unidade.transacoes as any,
          ...brandProps,
          filenameSuffix: unidade.numeroUnidade,
        });
        if (result) gerados++;
      });

      if (gerados > 0) {
        toast({ title: `${gerados} PDF(s) gerado(s)`, description: "Um arquivo por unidade foi baixado." });
      } else {
        toast({ title: "Nenhuma unidade com transações encontradas", variant: "destructive" });
      }
      return;
    }

    const transacoesParaExportar = selectedInfo?.transacoes ?? transacoesConsolidadas;
    const result = exportRelatorioUnidadePDF({
      transacoes: transacoesParaExportar as any,
      ...brandProps,
      filenameSuffix: selectedInfo?.numeroUnidade,
    });

    if (result) {
      toast({ title: "PDF gerado com sucesso!" });
    } else {
      toast({ title: "Nenhuma transação encontrada", variant: "destructive" });
    }
  };

  const handleSendWhatsApp = () => {
    const unidadesParaEnviar = selectedInfo ? [selectedInfo] : unidades;

    const lines = unidadesParaEnviar.map((unidade) => {
      const saldo = unidade.receitas - unidade.despesas;
      return `🏠 *${unidade.label}*\n`
        + (unidade.proprietario ? `   Proprietário: ${unidade.proprietario}\n` : "")
        + `   Receitas: ${formatCurrency(unidade.receitas)}\n`
        + `   Despesas: ${formatCurrency(unidade.despesas)}\n`
        + `   Saldo: ${formatCurrency(saldo)}`;
    });

    handleDownloadPDF();

    const mensagem = `📊 *Relatório Financeiro por Unidade*\n`
      + `${brandName ? `_${brandName}_\n` : ""}`
      + `📅 ${new Date().toLocaleDateString("pt-BR")}\n\n`
      + lines.join("\n\n")
      + "\n\n_Anexe o PDF gerado na conversa._";

    window.open(`https://wa.me/?text=${encodeURIComponent(mensagem)}`, "_blank");
    toast({ title: "WhatsApp aberto!", description: "Anexe o PDF baixado na conversa." });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Receipt className="h-5 w-5 text-info" />
            Relatório por Unidade
          </DialogTitle>
          <DialogDescription>
            Escolha uma unidade específica para gerar ou compartilhar o relatório financeiro.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Unidade</label>
            <Popover open={unidadePopoverOpen} onOpenChange={setUnidadePopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={unidadePopoverOpen} className="w-full justify-between font-normal">
                  {selectedInfo?.label || `Todas as unidades (${unidades.length})`}
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
                        onSelect={() => {
                          setSelectedUnidadeId("todas");
                          setUnidadePopoverOpen(false);
                        }}
                      >
                        <Check className={cn("mr-2 h-4 w-4", selectedUnidadeId === "todas" ? "opacity-100" : "opacity-0")} />
                        Todas as unidades ({unidades.length})
                      </CommandItem>
                      {unidades.map((unidade) => (
                        <CommandItem
                          key={unidade.id}
                          value={`${unidade.label} ${unidade.proprietario ?? ""}`}
                          onSelect={() => {
                            setSelectedUnidadeId(unidade.id);
                            setUnidadePopoverOpen(false);
                          }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", selectedUnidadeId === unidade.id ? "opacity-100" : "opacity-0")} />
                          <div className="flex flex-col">
                            <span>{unidade.label}</span>
                            {unidade.proprietario && (
                              <span className="text-xs text-muted-foreground">{unidade.proprietario}</span>
                            )}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {selectedInfo && (
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-info" />
                <span className="font-semibold text-sm">{selectedInfo.label}</span>
              </div>
              {selectedInfo.proprietario && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <User className="h-3.5 w-3.5" />
                  {selectedInfo.proprietario}
                </div>
              )}
              <div className="grid grid-cols-3 gap-2 mt-2">
                <div className="text-center">
                  <p className="text-[11px] text-muted-foreground">Receitas</p>
                  <p className="text-xs font-semibold text-success">{formatCurrency(selectedInfo.receitas)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[11px] text-muted-foreground">Despesas</p>
                  <p className="text-xs font-semibold text-destructive">{formatCurrency(selectedInfo.despesas)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[11px] text-muted-foreground">Saldo</p>
                  <p className="text-xs font-semibold">{formatCurrency(selectedInfo.receitas - selectedInfo.despesas)}</p>
                </div>
              </div>
              <Badge variant="secondary" className="text-[10px]">
                {selectedInfo.transacoes.length} transação(ões)
              </Badge>
            </div>
          )}

          {selectedUnidadeId === "todas" && (
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Modo do Relatório</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setModoRelatorio("consolidado")}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors",
                    modoRelatorio === "consolidado"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border hover:bg-muted",
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
                      : "bg-background text-muted-foreground border-border hover:bg-muted",
                  )}
                >
                  <Files className="h-4 w-4" />
                  Separado por Unidade
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                {modoRelatorio === "consolidado"
                  ? "Gera um único PDF com todas as unidades encontradas"
                  : `Gera ${unidades.length} PDF(s) individuais, um por unidade`}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-2">
            <Button onClick={handleDownloadPDF} variant="outline" className="gap-2 justify-start">
              <FileDown className="h-4 w-4" />
              {selectedUnidadeId === "todas" && modoRelatorio === "separado"
                ? `Baixar ${unidades.length} PDF(s) Separados`
                : "Baixar PDF"}
            </Button>
            <Button onClick={handleSendWhatsApp} className="gap-2 justify-start bg-success text-success-foreground hover:bg-success/90">
              <MessageSquare className="h-4 w-4" />
              Enviar via WhatsApp
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
