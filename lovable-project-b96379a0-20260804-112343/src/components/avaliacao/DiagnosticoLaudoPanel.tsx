import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Bug, Copy, Download, ChevronDown, ChevronRight, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { DiagnosticoLaudo } from "@/lib/avaliacao/diagnosticoLaudo";

interface Props {
  diagnostico: DiagnosticoLaudo;
  origem?: string;
  onFechar?: () => void;
}

/** Painel de diagnóstico: payload completo do laudo + campos mapeados/descartados. */
export function DiagnosticoLaudoPanel({ diagnostico, origem, onFechar }: Props) {
  const { toast } = useToast();
  const [filtro, setFiltro] = useState("");
  const [mostrarPayload, setMostrarPayload] = useState(false);

  const json = useMemo(() => JSON.stringify(diagnostico.payload, null, 2), [diagnostico.payload]);

  const campos = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    if (!q) return diagnostico.campos;
    return diagnostico.campos.filter(
      (c) =>
        c.campo.toLowerCase().includes(q) ||
        c.rotulo.toLowerCase().includes(q) ||
        (c.motivo || "").toLowerCase().includes(q),
    );
  }, [diagnostico.campos, filtro]);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(json);
      toast({ title: "Payload copiado" });
    } catch {
      toast({ title: "Não foi possível copiar", variant: "destructive" });
    }
  };

  const baixar = () => {
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `diagnostico-laudo-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const fmt = (v: unknown) => {
    if (Array.isArray(v)) return `${v.length} item(ns)`;
    if (typeof v === "object" && v !== null) return JSON.stringify(v).slice(0, 120);
    return String(v);
  };

  return (
    <Card className="border-violet-500/40 bg-violet-500/5">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Bug className="w-4 h-4 text-violet-500" />
            Modo diagnóstico do laudo
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={copiar}>
              <Copy className="w-3.5 h-3.5 mr-1" /> Copiar payload
            </Button>
            <Button size="sm" variant="outline" onClick={baixar}>
              <Download className="w-3.5 h-3.5 mr-1" /> Baixar JSON
            </Button>
            {onFechar && (
              <Button size="sm" variant="ghost" onClick={onFechar}>
                Desativar
              </Button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <Badge variant="secondary">Campos mapeados: {diagnostico.totais.camposMapeados}</Badge>
          <Badge variant="secondary">Campos descartados: {diagnostico.totais.camposDescartados}</Badge>
          <Badge variant="secondary">Comparáveis usados: {diagnostico.totais.comparaveisUsados}</Badge>
          <Badge variant="secondary">Comparáveis descartados: {diagnostico.totais.comparaveisDescartados}</Badge>
          {origem && <Badge variant="outline">Origem: {origem}</Badge>}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <Input
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          placeholder="Filtrar campo, rótulo ou motivo..."
          className="h-8"
        />

        <div className="rounded-md border border-border/60 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-2 font-medium">Campo</th>
                <th className="text-left p-2 font-medium">Status</th>
                <th className="text-left p-2 font-medium">Valor / Motivo</th>
              </tr>
            </thead>
            <tbody>
              {campos.map((c) => (
                <tr key={c.campo} className="border-t border-border/40">
                  <td className="p-2 align-top">
                    <span className="font-mono">{c.campo}</span>
                    <div className="text-muted-foreground">{c.grupo} · {c.rotulo}</div>
                  </td>
                  <td className="p-2 align-top">
                    <Badge
                      variant="outline"
                      className={
                        c.status === "mapeado"
                          ? "border-emerald-500/50 text-emerald-600"
                          : "border-amber-500/50 text-amber-600"
                      }
                    >
                      {c.status}
                    </Badge>
                  </td>
                  <td className="p-2 align-top break-all">
                    {c.status === "mapeado" ? fmt(c.valor) : <span className="text-muted-foreground">{c.motivo}</span>}
                  </td>
                </tr>
              ))}
              {campos.length === 0 && (
                <tr>
                  <td colSpan={3} className="p-3 text-center text-muted-foreground">Nenhum campo encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="rounded-md border border-border/60 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-2 font-medium">Referência</th>
                <th className="text-left p-2 font-medium">Fonte</th>
                <th className="text-left p-2 font-medium">Preço / Área</th>
                <th className="text-left p-2 font-medium">Status / Motivo</th>
              </tr>
            </thead>
            <tbody>
              {diagnostico.comparaveis.map((c, i) => (
                <tr key={`${c.id}-${i}`} className="border-t border-border/40">
                  <td className="p-2 align-top">
                    <div className="truncate max-w-[220px]">{c.titulo}</div>
                    <div className="font-mono text-muted-foreground">{c.id || "sem id"}</div>
                  </td>
                  <td className="p-2 align-top">{c.fonte}</td>
                  <td className="p-2 align-top">
                    {c.preco ? `R$ ${c.preco.toLocaleString("pt-BR")}` : "—"} / {c.area ? `${c.area} m²` : "—"}
                  </td>
                  <td className="p-2 align-top">
                    <Badge
                      variant="outline"
                      className={
                        c.status === "mapeado"
                          ? "border-emerald-500/50 text-emerald-600"
                          : "border-amber-500/50 text-amber-600"
                      }
                    >
                      {c.status === "mapeado" ? "usado" : "descartado"}
                    </Badge>
                    {c.motivo && <div className="text-muted-foreground mt-1">{c.motivo}</div>}
                  </td>
                </tr>
              ))}
              {diagnostico.comparaveis.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-3 text-center text-muted-foreground">Nenhuma referência no payload.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {diagnostico.comparaveisSelecao && diagnostico.comparaveisSelecao.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5 text-blue-500" />
              Análise de Similaridade (Amostragem Gamma)
            </h4>
            <div className="rounded-md border border-border/60 overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="text-left p-2 font-medium">Imóvel</th>
                    <th className="text-right p-2 font-medium">Total</th>
                    <th className="text-right p-2 font-medium">Área (x2)</th>
                    <th className="text-right p-2 font-medium">R$/m²</th>
                    <th className="text-right p-2 font-medium">Bairro</th>
                    <th className="text-center p-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {diagnostico.comparaveisSelecao.map((s) => (
                    <tr key={s.id} className={`border-t border-border/40 ${s.selecionado ? 'bg-emerald-500/5' : ''}`}>
                      <td className="p-2 font-medium truncate max-w-[200px]">{s.titulo}</td>
                      <td className="p-2 text-right font-bold text-violet-600">{s.score.toFixed(2)}</td>
                      <td className="p-2 text-right text-muted-foreground">{s.componentes.area.toFixed(2)}</td>
                      <td className="p-2 text-right text-muted-foreground">{s.componentes.pm2.toFixed(2)}</td>
                      <td className="p-2 text-right text-muted-foreground">{s.componentes.bairro > 0 ? `+${s.componentes.bairro}` : "0"}</td>
                      <td className="p-2 text-center">
                        {s.selecionado ? (
                          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none scale-75">Selecionado</Badge>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">Fora</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="p-2 bg-muted/20 text-[10px] text-muted-foreground italic">
                * Scores menores indicam maior similaridade. Penalidade de +5 para bairros diferentes.
              </div>
            </div>
          </div>
        )}

        <div>
          <Button size="sm" variant="ghost" onClick={() => setMostrarPayload((v) => !v)}>
            {mostrarPayload ? <ChevronDown className="w-3.5 h-3.5 mr-1" /> : <ChevronRight className="w-3.5 h-3.5 mr-1" />}
            Payload completo enviado ao laudo
          </Button>
          {mostrarPayload && (
            <pre className="mt-2 max-h-96 overflow-auto rounded-md bg-muted/40 p-3 text-[11px] leading-relaxed">
              {json}
            </pre>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default DiagnosticoLaudoPanel;
