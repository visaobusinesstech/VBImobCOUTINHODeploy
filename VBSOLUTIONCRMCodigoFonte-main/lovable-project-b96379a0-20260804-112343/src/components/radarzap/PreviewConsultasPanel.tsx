import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ChevronDown, ChevronRight, Copy, Eye, AlertTriangle, Info } from "lucide-react";
import { toast } from "sonner";

const CATEGORIAS = [
  { termo: "condomínio", cat: "condominio" },
  { termo: "imóveis", cat: "bairro" },
  { termo: "aluguel", cat: "bairro" },
  { termo: "venda de imóveis", cat: "bairro" },
  { termo: "moradores", cat: "bairro" },
];

// Limites para alerta (soft) e bloqueio visual (hard)
const LIMITE_ALERTA = 100;
const LIMITE_MAX = 250;

type Tipo = "Cidade" | "CEP" | "Condomínio";
type Grupo = { tipo: Tipo; alvo: string; queries: string[] };

interface Props {
  cidades: string[];
  ceps: string[];
  condominios: string[];
  termoExtra?: string;
}

function normalizar(tipo: Tipo, s: string): string {
  const base = s.trim();
  if (!base) return "";
  if (tipo === "CEP") return base.replace(/\D/g, "");
  return base
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function dedupList(tipo: Tipo, itens: string[]) {
  const seen = new Map<string, string>(); // chave normalizada -> primeiro valor original
  let duplicados = 0;
  let vazios = 0;
  for (const raw of itens) {
    const key = normalizar(tipo, raw);
    if (!key) { vazios++; continue; }
    if (seen.has(key)) { duplicados++; continue; }
    seen.set(key, raw.trim());
  }
  return { unicos: Array.from(seen.values()), duplicados, vazios };
}

function buildQueries(alvo: string, termoExtra?: string): string[] {
  const extra = termoExtra?.trim() ? ` ${termoExtra.trim()}` : "";
  return CATEGORIAS.map(({ termo }) => `site:chat.whatsapp.com ${termo} ${alvo}${extra}`);
}

export default function PreviewConsultasPanel({ cidades, ceps, condominios, termoExtra }: Props) {
  const [aberto, setAberto] = useState(false);
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  const dedup = useMemo(() => ({
    Cidade: dedupList("Cidade", cidades),
    CEP: dedupList("CEP", ceps),
    Condomínio: dedupList("Condomínio", condominios),
  }), [cidades, ceps, condominios]);

  const grupos = useMemo<Grupo[]>(() => {
    const g: Grupo[] = [];
    for (const c of dedup.Cidade.unicos) g.push({ tipo: "Cidade", alvo: c, queries: buildQueries(c, termoExtra) });
    for (const c of dedup.CEP.unicos) g.push({ tipo: "CEP", alvo: c, queries: buildQueries(c, termoExtra) });
    for (const c of dedup.Condomínio.unicos) g.push({ tipo: "Condomínio", alvo: c, queries: buildQueries(c, termoExtra) });
    return g;
  }, [dedup, termoExtra]);

  // Dedup global de queries (mesma query pode nascer de alvos diferentes com espaço/caps)
  const queriesGlobais = useMemo(() => {
    const seen = new Set<string>();
    let dup = 0;
    for (const g of grupos) {
      for (const q of g.queries) {
        const k = q.trim().toLowerCase().replace(/\s+/g, " ");
        if (seen.has(k)) dup++; else seen.add(k);
      }
    }
    return { total: seen.size, duplicadas: dup };
  }, [grupos]);

  const totalBrutas = grupos.length * CATEGORIAS.length;
  const totalEfetivas = queriesGlobais.total;
  const totalDuplicadasEntrada =
    dedup.Cidade.duplicados + dedup.CEP.duplicados + dedup.Condomínio.duplicados;
  const totalVazios =
    dedup.Cidade.vazios + dedup.CEP.vazios + dedup.Condomínio.vazios;

  const acimaAlerta = totalEfetivas > LIMITE_ALERTA;
  const acimaMax = totalEfetivas > LIMITE_MAX;

  const toggle = (key: string) => {
    setExpandidos((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const copiarTodas = async () => {
    const set = new Set<string>();
    for (const g of grupos) for (const q of g.queries) set.add(q);
    await navigator.clipboard.writeText(Array.from(set).join("\n"));
    toast.success(`${set.size} consultas efetivas copiadas`);
  };

  if (!grupos.length && totalVazios === 0 && totalDuplicadasEntrada === 0) return null;

  const corTipo: Record<Tipo, string> = {
    Cidade: "bg-blue-50 text-blue-700 border-blue-200",
    CEP: "bg-emerald-50 text-emerald-700 border-emerald-200",
    Condomínio: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
  };

  return (
    <div className="rounded-md border bg-muted/30">
      <div className="flex items-center justify-between p-2.5 gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          className="flex items-center gap-2 text-sm font-medium hover:opacity-80"
        >
          {aberto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <Eye className="h-4 w-4" />
          Pré-visualização das consultas
          <Badge variant="secondary" className="ml-1">
            {totalEfetivas} efetivas • {grupos.length} alvos
          </Badge>
          {totalDuplicadasEntrada > 0 && (
            <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700 bg-amber-50">
              {totalDuplicadasEntrada} alvo(s) duplicado(s) ignorado(s)
            </Badge>
          )}
        </button>
        {aberto && grupos.length > 0 && (
          <Button size="sm" variant="ghost" onClick={copiarTodas} className="h-7 text-xs">
            <Copy className="h-3 w-3 mr-1" /> Copiar todas
          </Button>
        )}
      </div>

      {/* Resumo por tipo — sempre visível para dar ciência antes de iniciar */}
      <div className="border-t px-3 py-2 grid grid-cols-3 gap-2 text-xs">
        {(["Cidade", "CEP", "Condomínio"] as Tipo[]).map((t) => {
          const d = dedup[t];
          const efetivas = d.unicos.length * CATEGORIAS.length;
          return (
            <div key={t} className="rounded border bg-background p-2">
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className={`text-[10px] ${corTipo[t]}`}>{t}</Badge>
              </div>
              <div className="mt-1 text-[13px]">
                <span className="font-semibold">{d.unicos.length}</span>{" "}
                alvo(s) únicos · <span className="font-semibold">{efetivas}</span> consulta(s)
              </div>
              {(d.duplicados > 0 || d.vazios > 0) && (
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {d.duplicados > 0 && <>ignorados {d.duplicados} duplicado(s){d.vazios > 0 ? " · " : ""}</>}
                  {d.vazios > 0 && <>{d.vazios} vazio(s)</>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {(totalBrutas !== totalEfetivas || totalDuplicadasEntrada > 0) && (
        <div className="px-3 pb-2">
          <Alert className="py-2">
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              De <b>{totalBrutas}</b> consultas brutas restaram <b>{totalEfetivas}</b> efetivas após
              deduplicação (
              {totalDuplicadasEntrada > 0 && <>{totalDuplicadasEntrada} alvo(s) repetido(s)</>}
              {queriesGlobais.duplicadas > 0 && (
                <>
                  {totalDuplicadasEntrada > 0 ? ", " : ""}
                  {queriesGlobais.duplicadas} consulta(s) idênticas
                </>
              )}
              ).
            </AlertDescription>
          </Alert>
        </div>
      )}

      {(acimaAlerta || acimaMax) && (
        <div className="px-3 pb-2">
          <Alert variant={acimaMax ? "destructive" : "default"} className="py-2">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              {acimaMax ? (
                <>Você ultrapassou o limite recomendado de <b>{LIMITE_MAX}</b> consultas efetivas ({totalEfetivas}).
                  Considere dividir em execuções menores para evitar custos altos e bloqueios do provedor.</>
              ) : (
                <>Você está acima do alerta de <b>{LIMITE_ALERTA}</b> consultas efetivas ({totalEfetivas}).
                  A execução vai gerar volume alto de chamadas.</>
              )}
            </AlertDescription>
          </Alert>
        </div>
      )}

      {aberto && (
        <div className="border-t divide-y">
          <div className="px-3 py-2 text-[11px] text-muted-foreground bg-background/50">
            Cada alvo gera <b>{CATEGORIAS.length} consultas</b> (uma por categoria) no formato <code>site:chat.whatsapp.com</code>.
          </div>
          {grupos.map((g) => {
            const key = `${g.tipo}:${g.alvo}`;
            const open = expandidos.has(key);
            return (
              <div key={key} className="px-3 py-2">
                <button
                  type="button"
                  onClick={() => toggle(key)}
                  className="flex items-center gap-2 w-full text-left"
                >
                  {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  <Badge variant="outline" className={`text-[10px] ${corTipo[g.tipo]}`}>{g.tipo}</Badge>
                  <span className="text-sm font-medium truncate">{g.alvo}</span>
                  <span className="text-[11px] text-muted-foreground ml-auto">{g.queries.length} consultas</span>
                </button>
                {open && (
                  <ul className="mt-1.5 ml-6 space-y-1">
                    {g.queries.map((q, i) => (
                      <li key={i} className="flex items-center gap-2 text-[12px] font-mono bg-background rounded px-2 py-1 border">
                        <span className="text-muted-foreground">{i + 1}.</span>
                        <span className="flex-1 truncate">{q}</span>
                        <button
                          type="button"
                          onClick={async () => {
                            await navigator.clipboard.writeText(q);
                            toast.success("Consulta copiada");
                          }}
                          className="text-muted-foreground hover:text-foreground"
                          title="Copiar"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
