import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import {
  exportProprietariosCSV,
  exportProprietariosPDF,
  type ProprietarioCaptadoExport,
  type ProprietariosExportFiltros,
} from "@/lib/exportProprietariosCaptados";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

const STATUS_OPCOES = [
  { value: "todos", label: "Todos" },
  { value: "aprovado", label: "Aprovado" },
  { value: "pendente_revisao", label: "Pendente de revisão" },
  { value: "rejeitado", label: "Rejeitado" },
];

export function ExportarProprietariosDialog({ open, onOpenChange }: Props) {
  const { imobiliariaId } = useAuth();
  const { toast } = useToast();
  const [tipoOperacao, setTipoOperacao] = useState<"venda" | "aluguel" | "ambos">("ambos");
  const [dataInicial, setDataInicial] = useState<string>("");
  const [dataFinal, setDataFinal] = useState<string>("");
  const [statusRevisao, setStatusRevisao] = useState<string>("todos");
  const [loading, setLoading] = useState<null | "csv" | "pdf">(null);

  const buildFiltrosMeta = (): ProprietariosExportFiltros => ({
    tipo_operacao: tipoOperacao,
    data_inicial: dataInicial || null,
    data_final: dataFinal || null,
    status_proprietario: statusRevisao === "todos" ? null : statusRevisao,
    responsavel: null,
  });

  const fetchDados = async (): Promise<ProprietarioCaptadoExport[] | null> => {
    if (!imobiliariaId) {
      toast({ title: "Sessão expirada", description: "Faça login novamente.", variant: "destructive" });
      return null;
    }
    if (dataInicial && dataFinal && dataInicial > dataFinal) {
      toast({ title: "Período inválido", description: "Data inicial deve ser anterior à data final.", variant: "destructive" });
      return null;
    }

    let q = supabase
      .from("lista_proprietarios_captacao")
      .select("id, nome_proprietario, operacao, created_at, url_anuncio, telefone, email, cidade, bairro, titulo_imovel, preco, q_score, status_revisao")
      .eq("imobiliaria_id", imobiliariaId)
      .order("created_at", { ascending: false })
      .limit(5000);

    if (tipoOperacao !== "ambos") {
      q = q.ilike("operacao", `${tipoOperacao}%`);
    }
    if (dataInicial) q = q.gte("created_at", `${dataInicial}T00:00:00`);
    if (dataFinal) q = q.lte("created_at", `${dataFinal}T23:59:59`);
    if (statusRevisao !== "todos") q = q.eq("status_revisao", statusRevisao);

    const { data, error } = await q;
    if (error) {
      toast({ title: "Erro ao buscar dados", description: error.message, variant: "destructive" });
      return null;
    }
    return (data ?? []) as ProprietarioCaptadoExport[];
  };

  const handleExport = async (formato: "csv" | "pdf") => {
    setLoading(formato);
    try {
      const dados = await fetchDados();
      if (!dados) return;
      if (dados.length === 0) {
        toast({ title: "Nenhum registro encontrado", description: "Ajuste os filtros e tente novamente." });
        return;
      }
      const filtros = buildFiltrosMeta();
      if (formato === "csv") exportProprietariosCSV(dados);
      else exportProprietariosPDF(dados, filtros);
      toast({
        title: `Exportação ${formato.toUpperCase()} concluída`,
        description: `${dados.length} registro(s) exportado(s).`,
      });
      onOpenChange(false);
    } finally {
      setLoading(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Exportar Relatório de Proprietários Captados
          </DialogTitle>
          <DialogDescription>
            Gere um relatório detalhado com filtros por operação, período e status. Formatos: CSV e PDF.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Tipo de operação</Label>
            <Select value={tipoOperacao} onValueChange={(v) => setTipoOperacao(v as typeof tipoOperacao)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ambos">Ambos (Venda + Aluguel)</SelectItem>
                <SelectItem value="venda">Somente Venda</SelectItem>
                <SelectItem value="aluguel">Somente Aluguel</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="data-inicial">Data inicial</Label>
              <Input id="data-inicial" type="date" value={dataInicial} onChange={(e) => setDataInicial(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="data-final">Data final</Label>
              <Input id="data-final" type="date" value={dataFinal} onChange={(e) => setDataFinal(e.target.value)} />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Status do proprietário</Label>
            <Select value={statusRevisao} onValueChange={setStatusRevisao}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPCOES.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <p className="text-xs text-muted-foreground">
            Limite de 5.000 registros por exportação. Dados escopados por RLS ao seu tenant.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading !== null}>
            Cancelar
          </Button>
          <Button variant="secondary" onClick={() => handleExport("csv")} disabled={loading !== null}>
            {loading === "csv" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
            <span className="ml-2">Exportar CSV</span>
          </Button>
          <Button onClick={() => handleExport("pdf")} disabled={loading !== null}>
            {loading === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            <span className="ml-2">Exportar PDF</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
