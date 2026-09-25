import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Save, ArrowRight, AlertCircle, AlertTriangle } from "lucide-react";

interface ConteudoRow {
  id: string;
  titulo?: string | null;
  status?: string | null;
  cidade?: string | null;
  bairro?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  registros: ConteudoRow[];
  onConfirm: (patch: Record<string, any>) => Promise<void>;
  loading?: boolean;
}

const emptyLabel = (v?: string | null) => (v && String(v).trim() ? v : "—");

// Regex: letras (incluindo acentos), espaços, hífen, apóstrofo, ponto. 2–80 chars.
const LOCAL_REGEX = /^[\p{L}][\p{L}\s'.\-]{1,79}$/u;
const MAX_LEN = 80;

function validaLocal(valor: string, campo: "Cidade" | "Bairro"): string | null {
  const v = valor.trim();
  if (!v) return null; // vazio = limpar (validado à parte)
  if (v.length < 2) return `${campo} muito curta (mín. 2 caracteres)`;
  if (v.length > MAX_LEN) return `${campo} muito longa (máx. ${MAX_LEN})`;
  if (!LOCAL_REGEX.test(v)) return `${campo} contém caracteres inválidos`;
  if (/\s{2,}/.test(v)) return `${campo} tem espaços duplicados`;
  return null;
}

export function BulkEditPreviewDialog({ open, onOpenChange, registros, onConfirm, loading }: Props) {
  const [status, setStatus] = useState<"" | "rascunho" | "publicado">("");
  const [cidade, setCidade] = useState("");
  const [bairro, setBairro] = useState("");
  const [aplicarStatus, setAplicarStatus] = useState(false);
  const [aplicarCidade, setAplicarCidade] = useState(false);
  const [aplicarBairro, setAplicarBairro] = useState(false);
  const [somenteMudancas, setSomenteMudancas] = useState(true);

  // ---- Validação global (dos inputs) ----
  const erroCidadeInput = aplicarCidade ? validaLocal(cidade, "Cidade") : null;
  const erroBairroInput = aplicarBairro ? validaLocal(bairro, "Bairro") : null;

  // Combinação inválida global: aplicar bairro (não-vazio) e ao mesmo tempo aplicar cidade limpando (vazio)
  const erroCombinacaoGlobal =
    aplicarBairro && bairro.trim() && aplicarCidade && !cidade.trim()
      ? "Não é possível definir Bairro e limpar Cidade na mesma operação"
      : null;

  const patch = useMemo(() => {
    const p: Record<string, any> = {};
    if (aplicarStatus && status) {
      p.status = status;
      p.publicado_em = status === "publicado" ? new Date().toISOString() : null;
    }
    if (aplicarCidade) p.cidade = cidade.trim() || null;
    if (aplicarBairro) p.bairro = bairro.trim() || null;
    return p;
  }, [aplicarStatus, aplicarCidade, aplicarBairro, status, cidade, bairro]);

  const temAlteracao = Object.keys(patch).length > 0;

  const preview = useMemo(() => {
    return registros.map((r) => {
      const changes: Array<{ campo: string; de: string; para: string; mudou: boolean }> = [];
      // Estado projetado após patch
      const cidadeFinal = aplicarCidade ? cidade.trim() : (r.cidade ?? "").trim();
      const bairroFinal = aplicarBairro ? bairro.trim() : (r.bairro ?? "").trim();

      if (aplicarStatus) {
        const de = r.status ?? "";
        const para = status;
        changes.push({ campo: "Status", de: emptyLabel(de), para: emptyLabel(para), mudou: de !== para });
      }
      if (aplicarCidade) {
        const de = r.cidade ?? "";
        const para = cidade.trim();
        changes.push({ campo: "Cidade", de: emptyLabel(de), para: emptyLabel(para), mudou: de !== para });
      }
      if (aplicarBairro) {
        const de = r.bairro ?? "";
        const para = bairro.trim();
        changes.push({ campo: "Bairro", de: emptyLabel(de), para: emptyLabel(para), mudou: de !== para });
      }

      // ---- Erros por linha ----
      const errosLinha: string[] = [];
      // Regra 1: bairro sem cidade (final)
      if (bairroFinal && !cidadeFinal) {
        errosLinha.push("Bairro exige uma Cidade definida");
      }
      // Regra 2: mesma cidade e bairro (duplicidade textual)
      if (cidadeFinal && bairroFinal && cidadeFinal.toLowerCase() === bairroFinal.toLowerCase()) {
        errosLinha.push("Cidade e Bairro não podem ser iguais");
      }
      // Regra 3: limpar cidade mantendo bairro existente
      if (aplicarCidade && !cidade.trim() && !aplicarBairro && (r.bairro ?? "").trim()) {
        errosLinha.push("Ao limpar Cidade, o Bairro existente ficaria órfão");
      }
      // Regra 4: publicar sem cidade/bairro final quando o registro é geo-dependente (título contém "em <cidade>")
      const projStatus = aplicarStatus ? status : (r.status ?? "");
      if (projStatus === "publicado" && !cidadeFinal && /\bem\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/.test(r.titulo ?? "")) {
        errosLinha.push("Publicação exige Cidade para conteúdo geolocalizado");
      }

      const algumMudou = changes.some((c) => c.mudou);
      return { row: r, changes, algumMudou, erros: errosLinha };
    });
  }, [registros, aplicarStatus, aplicarCidade, aplicarBairro, status, cidade, bairro]);

  const visiveis = somenteMudancas ? preview.filter((p) => p.algumMudou || p.erros.length) : preview;
  const totalAfetados = preview.filter((p) => p.algumMudou && p.erros.length === 0).length;
  const totalComErro = preview.filter((p) => p.erros.length > 0).length;
  const semEfeito = preview.length - totalAfetados - totalComErro;

  const bloqueado =
    !temAlteracao ||
    totalAfetados === 0 ||
    !!erroCidadeInput ||
    !!erroBairroInput ||
    !!erroCombinacaoGlobal ||
    totalComErro > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Edição em lote — {registros.length} registro(s)</DialogTitle>
          <DialogDescription>
            Escolha quais campos aplicar. A pré-visualização mostra o valor atual, o novo valor e possíveis erros de cada registro antes de confirmar.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox id="apl-status" checked={aplicarStatus} onCheckedChange={(v) => setAplicarStatus(!!v)} />
              <Label htmlFor="apl-status" className="text-sm cursor-pointer">Alterar Status</Label>
            </div>
            <Select value={status || "__none__"} onValueChange={(v: any) => setStatus(v === "__none__" ? "" : v)} disabled={!aplicarStatus}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Selecionar...</SelectItem>
                <SelectItem value="rascunho">Rascunho</SelectItem>
                <SelectItem value="publicado">Publicado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox id="apl-cidade" checked={aplicarCidade} onCheckedChange={(v) => setAplicarCidade(!!v)} />
              <Label htmlFor="apl-cidade" className="text-sm cursor-pointer">Alterar Cidade</Label>
            </div>
            <Input
              value={cidade}
              onChange={(e) => setCidade(e.target.value.slice(0, MAX_LEN))}
              placeholder="Ex: Brasília (vazio limpa)"
              disabled={!aplicarCidade}
              maxLength={MAX_LEN}
              className={"h-9 " + (erroCidadeInput ? "border-destructive focus-visible:ring-destructive" : "")}
            />
            {erroCidadeInput && <p className="text-[11px] text-destructive">{erroCidadeInput}</p>}
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox id="apl-bairro" checked={aplicarBairro} onCheckedChange={(v) => setAplicarBairro(!!v)} />
              <Label htmlFor="apl-bairro" className="text-sm cursor-pointer">Alterar Bairro</Label>
            </div>
            <Input
              value={bairro}
              onChange={(e) => setBairro(e.target.value.slice(0, MAX_LEN))}
              placeholder="Ex: Águas Claras (vazio limpa)"
              disabled={!aplicarBairro}
              maxLength={MAX_LEN}
              className={"h-9 " + (erroBairroInput ? "border-destructive focus-visible:ring-destructive" : "")}
            />
            {erroBairroInput && <p className="text-[11px] text-destructive">{erroBairroInput}</p>}
          </div>
        </div>

        {erroCombinacaoGlobal && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5" /> {erroCombinacaoGlobal}
          </div>
        )}

        {temAlteracao ? (
          <div className="rounded-md border bg-muted/30 p-2 flex items-center justify-between text-xs">
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="secondary">{totalAfetados} serão alterados</Badge>
              {totalComErro > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="w-3 h-3" /> {totalComErro} com erro
                </Badge>
              )}
              {semEfeito > 0 && <Badge variant="outline">{semEfeito} sem efeito (já iguais)</Badge>}
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={somenteMudancas} onCheckedChange={(v) => setSomenteMudancas(!!v)} />
              Mostrar somente com mudança/erro
            </label>
          </div>
        ) : (
          <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5" /> Marque ao menos um campo acima para pré-visualizar as alterações.
          </div>
        )}

        {temAlteracao && (
          <ScrollArea className="h-[340px] rounded-md border">
            <table className="w-full text-xs">
              <thead className="bg-muted sticky top-0">
                <tr className="text-left">
                  <th className="p-2 font-medium">Título</th>
                  <th className="p-2 font-medium">Campo</th>
                  <th className="p-2 font-medium">De</th>
                  <th className="p-2 font-medium w-6"></th>
                  <th className="p-2 font-medium">Para</th>
                </tr>
              </thead>
              <tbody>
                {visiveis.length === 0 && (
                  <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Nenhum registro sofrerá mudança com os valores atuais.</td></tr>
                )}
                {visiveis.map(({ row, changes, erros }) => {
                  const rowClass = erros.length ? "bg-destructive/5" : "";
                  const linhas = changes.length || 1;
                  return (
                    <>
                      {(changes.length ? changes : [{ campo: "—", de: "—", para: "—", mudou: false }]).map((c, i) => (
                        <tr key={row.id + c.campo + i} className={(i === 0 ? "border-t " : "") + rowClass}>
                          <td className="p-2 align-top max-w-[220px]" title={row.titulo || ""}>
                            {i === 0 && (
                              <div className="space-y-1">
                                <div className="truncate">{row.titulo || <span className="text-muted-foreground">sem título</span>}</div>
                                {erros.length > 0 && (
                                  <div className="space-y-0.5">
                                    {erros.map((e, k) => (
                                      <div key={k} className="flex items-start gap-1 text-[11px] text-destructive">
                                        <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                                        <span>{e}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="p-2 align-top"><Badge variant="outline" className="font-normal">{c.campo}</Badge></td>
                          <td className={"p-2 align-top " + (c.mudou ? "text-muted-foreground line-through" : "text-muted-foreground")}>{c.de}</td>
                          <td className="p-2 align-top"><ArrowRight className="w-3 h-3 text-muted-foreground" /></td>
                          <td className={"p-2 align-top " + (c.mudou ? "font-medium text-foreground" : "text-muted-foreground")}>{c.para}</td>
                        </tr>
                      ))}
                    </>
                  );
                })}
              </tbody>
            </table>
          </ScrollArea>
        )}

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
          <Button
            onClick={async () => { await onConfirm(patch); }}
            disabled={loading || bloqueado}
            title={totalComErro > 0 ? "Existem registros com erro. Ajuste os valores ou desmarque os campos." : undefined}
          >
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Confirmar alteração em {totalAfetados} registro(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
