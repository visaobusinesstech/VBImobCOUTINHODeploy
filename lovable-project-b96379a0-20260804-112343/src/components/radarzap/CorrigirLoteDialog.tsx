import { useMemo, useState } from "react";
import { Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type Tipo = "cep" | "condominio";

type Linha = {
  original: string;
  corrigido: string;
  status: "ok" | "inalterado" | "duplicado" | "invalido" | "vazio";
  motivo?: string;
};

const CONDO_REGEX = /^[\p{L}\p{N}\s\-'.&/]+$/u;
const CONDO_MIN = 3;
const CONDO_MAX = 80;

function corrigirCep(raw: string): { corrigido: string; motivo?: string; ok: boolean } {
  const trimmed = raw.trim();
  if (!trimmed) return { corrigido: "", motivo: "Linha vazia", ok: false };
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 0) return { corrigido: trimmed, motivo: "Sem dígitos", ok: false };
  if (digits.length > 8) return { corrigido: trimmed, motivo: `Sobram ${digits.length - 8} dígito(s)`, ok: false };
  const padded = digits.padStart(8, "0");
  return { corrigido: `${padded.slice(0, 5)}-${padded.slice(5)}`, ok: true };
}

function corrigirCondo(raw: string): { corrigido: string; motivo?: string; ok: boolean } {
  const trimmed = raw.trim();
  if (!trimmed) return { corrigido: "", motivo: "Linha vazia", ok: false };
  // remove símbolos não permitidos, colapsa espaços
  const limpo = trimmed.replace(/[^\p{L}\p{N}\s\-'.&/]/gu, " ").replace(/\s+/g, " ").trim();
  if (limpo.length < CONDO_MIN) return { corrigido: limpo, motivo: `Muito curto (mín ${CONDO_MIN})`, ok: false };
  if (limpo.length > CONDO_MAX) return { corrigido: limpo.slice(0, CONDO_MAX), motivo: `Cortado para ${CONDO_MAX} caracteres`, ok: true };
  if (!CONDO_REGEX.test(limpo)) return { corrigido: limpo, motivo: "Contém símbolos não permitidos", ok: false };
  return { corrigido: limpo, ok: true };
}

function parseEntrada(txt: string): string[] {
  return txt
    .split(/[\n,;]/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function CorrigirLoteDialog({
  tipo,
  atuaisCsv,
  onAplicar,
}: {
  tipo: Tipo;
  atuaisCsv: string;
  onAplicar: (csv: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [entrada, setEntrada] = useState("");

  const linhas: Linha[] = useMemo(() => {
    const itens = parseEntrada(entrada);
    if (!itens.length) return [];
    const seen = new Set<string>();
    return itens.map((original) => {
      const { corrigido, motivo, ok } = tipo === "cep" ? corrigirCep(original) : corrigirCondo(original);
      if (!ok) return { original, corrigido, status: "invalido" as const, motivo };
      const key = tipo === "cep" ? corrigido.replace(/\D/g, "") : corrigido.toLowerCase();
      if (seen.has(key)) return { original, corrigido, status: "duplicado" as const, motivo: "Já presente na lista" };
      seen.add(key);
      const inalterado = original.trim() === corrigido;
      return { original, corrigido, status: inalterado ? "inalterado" : "ok", motivo };
    });
  }, [entrada, tipo]);

  const stats = useMemo(() => {
    const s = { ok: 0, inalterado: 0, duplicado: 0, invalido: 0 };
    for (const l of linhas) s[l.status as keyof typeof s] = (s[l.status as keyof typeof s] || 0) + 1;
    return s;
  }, [linhas]);

  const carregarAtuais = () => {
    setEntrada(atuaisCsv.split(",").map((s) => s.trim()).filter(Boolean).join("\n"));
  };

  const aplicar = () => {
    const validos = linhas.filter((l) => l.status === "ok" || l.status === "inalterado").map((l) => l.corrigido);
    if (!validos.length) {
      toast.error("Nenhum item válido para aplicar");
      return;
    }
    onAplicar(validos.join(", "));
    toast.success(`${validos.length} ${tipo === "cep" ? "CEP(s)" : "condomínio(s)"} aplicado(s)`);
    setOpen(false);
    setEntrada("");
  };

  const rotulo = tipo === "cep" ? "CEPs" : "condomínios";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-[11px]">
          <Wrench className="h-3 w-3 mr-1" />
          Corrigir em lote
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Corrigir {rotulo} em lote</DialogTitle>
          <DialogDescription>
            Cole a lista (uma por linha ou separada por vírgula). Corrigimos formatação, removemos símbolos inválidos e detectamos duplicatas. Veja a pré-visualização antes de aplicar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs text-muted-foreground">Lista para corrigir</label>
            <Button type="button" size="sm" variant="outline" className="h-7 text-[11px]" onClick={carregarAtuais} disabled={!atuaisCsv.trim()}>
              Carregar atuais
            </Button>
          </div>
          <Textarea
            rows={6}
            value={entrada}
            onChange={(e) => setEntrada(e.target.value)}
            placeholder={tipo === "cep" ? "70000-000\n1310100\n71 900 100" : "Alphaville, Brasília\nJardins Mangueiral!\nSetor Sudoeste"}
          />

          {linhas.length > 0 && (
            <>
              <div className="flex flex-wrap gap-2 text-[11px]">
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Corrigidos: {stats.ok}</Badge>
                <Badge variant="outline">Inalterados: {stats.inalterado}</Badge>
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Duplicados: {stats.duplicado}</Badge>
                <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">Inválidos: {stats.invalido}</Badge>
              </div>

              <div className="max-h-72 overflow-auto rounded border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40 sticky top-0">
                    <tr>
                      <th className="text-left px-2 py-1.5 font-medium">Original</th>
                      <th className="text-left px-2 py-1.5 font-medium">Corrigido</th>
                      <th className="text-left px-2 py-1.5 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhas.map((l, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-2 py-1 font-mono">{l.original || <span className="opacity-50">(vazio)</span>}</td>
                        <td className="px-2 py-1 font-mono">
                          {l.corrigido && l.corrigido !== l.original ? (
                            <span className="text-emerald-700">{l.corrigido}</span>
                          ) : (
                            l.corrigido || <span className="opacity-50">—</span>
                          )}
                        </td>
                        <td className="px-2 py-1">
                          {l.status === "ok" && <span className="text-emerald-700">Corrigido</span>}
                          {l.status === "inalterado" && <span className="text-muted-foreground">Inalterado</span>}
                          {l.status === "duplicado" && <span className="text-amber-700">Duplicado</span>}
                          {l.status === "invalido" && (
                            <span className="text-destructive">Inválido{l.motivo ? ` — ${l.motivo}` : ""}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button type="button" onClick={aplicar} disabled={!linhas.some((l) => l.status === "ok" || l.status === "inalterado")}>
            Aplicar {stats.ok + stats.inalterado > 0 ? `(${stats.ok + stats.inalterado})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
