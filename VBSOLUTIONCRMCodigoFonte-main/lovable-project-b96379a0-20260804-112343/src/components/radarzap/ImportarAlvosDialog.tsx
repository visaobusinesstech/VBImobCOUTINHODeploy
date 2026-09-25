import { useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Upload, FileUp } from "lucide-react";
import { toast } from "sonner";

type Tipo = "cep" | "condominio";

interface Props {
  tipo: Tipo;
  atuaisCsv: string;
  onImportar: (mergedCsv: string) => void;
  trigger?: React.ReactNode;
}

const CONDO_MIN = 3;
const CONDO_MAX = 80;
const CONDO_REGEX = /^[\p{L}\p{N}\s\-'.&/º°ª]+$/u;

function splitTokens(raw: string): string[] {
  return raw
    .split(/[,;\n\r\t|]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function classificarCep(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 8) return { ok: false as const, motivo: "formato inválido (precisa de 8 dígitos)" };
  const fmt = `CEP ${digits.slice(0, 5)}-${digits.slice(5)}`;
  return { ok: true as const, valor: fmt, chave: digits };
}

function classificarCondo(raw: string) {
  if (raw.length < CONDO_MIN) return { ok: false as const, motivo: "muito curto (mín. 3)" };
  if (raw.length > CONDO_MAX) return { ok: false as const, motivo: "muito longo (máx. 80)" };
  if (!CONDO_REGEX.test(raw)) return { ok: false as const, motivo: "contém símbolos não permitidos" };
  return { ok: true as const, valor: raw, chave: raw.toLowerCase() };
}

export default function ImportarAlvosDialog({ tipo, atuaisCsv, onImportar, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [texto, setTexto] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const label = tipo === "cep" ? "CEPs" : "condomínios";
  const exemplo = tipo === "cep"
    ? "70000-000, 71900-100\n72000-000\n73000-100; 74000-200"
    : "Alphaville Brasília\nJardins Mangueiral, Life Park\nGrand Park Águas Claras";

  const preview = useMemo(() => {
    const tokens = splitTokens(texto);
    const atuais = splitTokens(atuaisCsv);
    const atuaisKeys = new Set(
      atuais
        .map((t) => (tipo === "cep" ? t.replace(/\D/g, "") : t.toLowerCase()))
        .filter(Boolean),
    );

    const validos: string[] = [];
    const invalidos: Array<{ raw: string; motivo: string }> = [];
    const duplicadosNoTexto: string[] = [];
    const jaExistentes: string[] = [];
    const seen = new Set<string>();

    for (const raw of tokens) {
      const r = tipo === "cep" ? classificarCep(raw) : classificarCondo(raw);
      if (!r.ok) { invalidos.push({ raw, motivo: r.motivo }); continue; }
      if (seen.has(r.chave)) { duplicadosNoTexto.push(r.valor); continue; }
      seen.add(r.chave);
      if (atuaisKeys.has(r.chave)) { jaExistentes.push(r.valor); continue; }
      validos.push(r.valor);
    }

    return { total: tokens.length, validos, invalidos, duplicadosNoTexto, jaExistentes };
  }, [texto, atuaisCsv, tipo]);

  const handleFile = async (f?: File | null) => {
    if (!f) return;
    if (f.size > 500_000) { toast.error("Arquivo muito grande (máx. 500KB)"); return; }
    const txt = await f.text();
    setTexto((prev) => (prev ? `${prev}\n${txt}` : txt));
  };

  const importar = () => {
    if (!preview.validos.length) {
      toast.error("Nenhum item novo válido para importar");
      return;
    }
    const atuais = splitTokens(atuaisCsv);
    const merged = [...atuais, ...preview.validos].join(", ");
    onImportar(merged);
    toast.success(`${preview.validos.length} ${label} adicionado(s)`);
    setTexto("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="h-7 text-xs">
            <Upload className="h-3 w-3 mr-1" /> Importar em massa
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar {label} em massa</DialogTitle>
          <DialogDescription>
            Cole texto ou envie um arquivo CSV/TXT. Aceita separadores por vírgula, ponto e vírgula, nova linha, tabulação ou barra.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt,text/csv,text/plain"
              className="hidden"
              onChange={(e) => { void handleFile(e.target.files?.[0]); e.currentTarget.value = ""; }}
            />
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <FileUp className="h-3.5 w-3.5 mr-1" /> Escolher arquivo CSV/TXT
            </Button>
            <span className="text-[11px] text-muted-foreground">até 500KB</span>
          </div>

          <Textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={exemplo}
            rows={7}
            className="font-mono text-xs"
          />

          <div className="rounded-md border p-2.5 space-y-1.5 text-xs bg-muted/30">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{preview.total} lidos</Badge>
              <Badge className="bg-emerald-600 hover:bg-emerald-600">{preview.validos.length} novos válidos</Badge>
              {preview.jaExistentes.length > 0 && (
                <Badge variant="outline" className="border-amber-400 text-amber-700">
                  {preview.jaExistentes.length} já existem
                </Badge>
              )}
              {preview.duplicadosNoTexto.length > 0 && (
                <Badge variant="outline" className="border-amber-400 text-amber-700">
                  {preview.duplicadosNoTexto.length} duplicados no texto
                </Badge>
              )}
              {preview.invalidos.length > 0 && (
                <Badge variant="destructive">{preview.invalidos.length} inválidos</Badge>
              )}
            </div>

            {preview.validos.length > 0 && (
              <details className="pt-1">
                <summary className="cursor-pointer text-emerald-700">Ver novos válidos ({preview.validos.length})</summary>
                <p className="mt-1 text-emerald-800 break-words">{preview.validos.join(", ")}</p>
              </details>
            )}
            {preview.jaExistentes.length > 0 && (
              <details>
                <summary className="cursor-pointer text-amber-700">Já existentes ({preview.jaExistentes.length})</summary>
                <p className="mt-1 text-amber-800 break-words">{preview.jaExistentes.join(", ")}</p>
              </details>
            )}
            {preview.duplicadosNoTexto.length > 0 && (
              <details>
                <summary className="cursor-pointer text-amber-700">Duplicados no texto ({preview.duplicadosNoTexto.length})</summary>
                <p className="mt-1 text-amber-800 break-words">{preview.duplicadosNoTexto.join(", ")}</p>
              </details>
            )}
            {preview.invalidos.length > 0 && (
              <details>
                <summary className="cursor-pointer text-destructive">Inválidos ({preview.invalidos.length})</summary>
                <ul className="mt-1 space-y-0.5">
                  {preview.invalidos.slice(0, 50).map((it, i) => (
                    <li key={i} className="text-destructive/90">
                      <code className="bg-background px-1 rounded">{it.raw || "(vazio)"}</code> — {it.motivo}
                    </li>
                  ))}
                  {preview.invalidos.length > 50 && (
                    <li className="text-muted-foreground">…e mais {preview.invalidos.length - 50}</li>
                  )}
                </ul>
              </details>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={importar} disabled={preview.validos.length === 0}>
            Adicionar {preview.validos.length > 0 ? `${preview.validos.length} ${label}` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
