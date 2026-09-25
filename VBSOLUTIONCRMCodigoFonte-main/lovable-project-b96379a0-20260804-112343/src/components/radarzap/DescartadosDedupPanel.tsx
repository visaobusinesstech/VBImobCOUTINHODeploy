import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Copy, ExternalLink, RefreshCw, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Criterio = "invite_local" | "invite_db" | "nome_local" | "nome_db";

interface DescartadoItem {
  invite_url: string;
  nome: string | null;
  criterio: Criterio;
  cidade: string;
  termo: string;
}

interface Props {
  ultimaBusca: any | null;
  onReprocessConcluido?: () => void;
}

const CRITERIOS: Record<Criterio, { label: string; hint: string; badge: string }> = {
  invite_local: {
    label: "Invite canônico (nesta busca)",
    hint: "Já apareceu com o mesmo link canônico em outra consulta desta execução.",
    badge: "border-blue-400 text-blue-700 bg-blue-50",
  },
  invite_db: {
    label: "Invite canônico (no banco)",
    hint: "Já existe um grupo cadastrado com o mesmo link canônico.",
    badge: "border-indigo-400 text-indigo-700 bg-indigo-50",
  },
  nome_local: {
    label: "Nome normalizado (nesta busca)",
    hint: "Mesmo nome (sem acentos, símbolos e maiúsculas) apareceu em outra consulta desta execução.",
    badge: "border-amber-400 text-amber-700 bg-amber-50",
  },
  nome_db: {
    label: "Nome normalizado (no banco)",
    hint: "Já existe um grupo cadastrado cujo nome, uma vez normalizado, é idêntico.",
    badge: "border-orange-400 text-orange-700 bg-orange-50",
  },
};

export default function DescartadosDedupPanel({ ultimaBusca, onReprocessConcluido }: Props) {
  const [filtro, setFiltro] = useState<"todos" | Criterio>("todos");
  const [busca, setBusca] = useState("");
  const [reprocessando, setReprocessando] = useState<string | null>(null);
  const [reprocessandoLote, setReprocessandoLote] = useState(false);

  const items: DescartadoItem[] = useMemo(() => {
    const tel = Array.isArray(ultimaBusca?.telemetria) ? ultimaBusca.telemetria : [];
    const out: DescartadoItem[] = [];
    for (const t of tel) {
      const arr = Array.isArray(t?.descartados_dedup) ? t.descartados_dedup : [];
      for (const d of arr) out.push(d as DescartadoItem);
    }
    return out;
  }, [ultimaBusca]);

  const contagem = useMemo(() => {
    const c: Record<Criterio, number> = { invite_local: 0, invite_db: 0, nome_local: 0, nome_db: 0 };
    for (const i of items) c[i.criterio] = (c[i.criterio] ?? 0) + 1;
    return c;
  }, [items]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return items.filter((i) => {
      if (filtro !== "todos" && i.criterio !== filtro) return false;
      if (!q) return true;
      return (
        i.invite_url.toLowerCase().includes(q) ||
        (i.nome ?? "").toLowerCase().includes(q) ||
        i.cidade.toLowerCase().includes(q) ||
        i.termo.toLowerCase().includes(q)
      );
    });
  }, [items, filtro, busca]);

  if (!ultimaBusca) return null;

  const exportarCsv = () => {
    if (!filtrados.length) return toast.info("Nada para exportar");
    const esc = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const linhas = [
      ["criterio", "invite_url", "nome", "cidade", "termo"].join(","),
      ...filtrados.map((i) => [i.criterio, i.invite_url, i.nome ?? "", i.cidade, i.termo].map(esc).join(",")),
    ];
    const blob = new Blob(["\ufeff" + linhas.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `radarzap-descartados-dedup-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const reprocessar = async (alvos: DescartadoItem[]) => {
    if (!alvos.length) return;
    const invites = Array.from(new Set(alvos.map((a) => a.invite_url)));
    // Agrupa por (cidade, termo) para reexecutar exatamente as queries de origem
    const pares = new Map<string, { cidade: string; termo: string }>();
    for (const a of alvos) {
      const k = `${a.cidade}||${a.termo}`;
      if (!pares.has(k)) pares.set(k, { cidade: a.cidade, termo: a.termo });
    }
    const retry_queries = Array.from(pares.values());
    const cidades = Array.from(new Set(alvos.map((a) => a.cidade)));
    const termoExtra: string = String(ultimaBusca?.telemetria?.[0]?.query ?? "").includes(" ")
      ? "" // não temos como recuperar termoExtra com precisão; deixamos vazio para não distorcer
      : "";
    try {
      const { data, error } = await supabase.functions.invoke("radarzap-descobrir-grupos", {
        body: {
          cidades,
          termo: termoExtra,
          retry_queries,
          retry_of_run_id: ultimaBusca?.run_id ?? null,
          reprocessar_invites: invites,
        },
      });
      if (error) throw error;
      const atualizados = (data as any)?.reprocessados_atualizados ?? 0;
      const inseridos = (data as any)?.inseridos ?? 0;
      toast.success(
        `Reprocessado ignorando deduplicação: ${atualizados} atualizado(s)${inseridos ? ` · ${inseridos} novo(s)` : ""}`,
      );
      onReprocessConcluido?.();
    } catch (e: any) {
      toast.error(`Falha ao reprocessar: ${e?.message ?? String(e)}`);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldAlert className="h-4 w-4" />
          Grupos descartados por deduplicação ({items.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum grupo foi descartado por deduplicação nesta execução.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {(["todos", "invite_local", "invite_db", "nome_local", "nome_db"] as const).map((k) => {
                const ativo = filtro === k;
                const label = k === "todos" ? "Todos" : CRITERIOS[k].label;
                const count = k === "todos" ? items.length : contagem[k];
                return (
                  <Button
                    key={k}
                    size="sm"
                    variant={ativo ? "default" : "outline"}
                    onClick={() => setFiltro(k)}
                    className="h-8"
                  >
                    {label} <span className="ml-1 text-xs opacity-70">({count})</span>
                  </Button>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              <Input
                placeholder="Buscar por nome, URL, cidade ou termo…"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="max-w-md"
              />
              <Button size="sm" variant="outline" onClick={exportarCsv}>Exportar CSV</Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={reprocessandoLote || filtrados.length === 0}
                onClick={async () => {
                  setReprocessandoLote(true);
                  try { await reprocessar(filtrados); } finally { setReprocessandoLote(false); }
                }}
                title="Ignora deduplicação e recaptura os grupos filtrados"
              >
                <RefreshCw className={`h-3.5 w-3.5 mr-1 ${reprocessandoLote ? "animate-spin" : ""}`} />
                Reprocessar filtrados ({filtrados.length})
              </Button>
              <span className="text-xs text-muted-foreground">{filtrados.length} exibidos</span>
            </div>

            <ScrollArea className="max-h-[420px] rounded border">
              <ul className="divide-y">
                {filtrados.map((i, idx) => {
                  const meta = CRITERIOS[i.criterio];
                  return (
                    <li key={`${i.invite_url}-${idx}`} className="p-3 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={meta.badge} title={meta.hint}>
                          {meta.label}
                        </Badge>
                        {i.cidade && <Badge variant="outline">{i.cidade}</Badge>}
                        {i.termo && <Badge variant="secondary">{i.termo}</Badge>}
                      </div>
                      <div className="font-medium text-sm truncate">
                        {i.nome || <span className="text-muted-foreground italic">sem nome</span>}
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <a
                          href={i.invite_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-muted-foreground hover:underline truncate flex items-center gap-1 min-w-0"
                        >
                          <span className="truncate">{i.invite_url}</span>
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={() => {
                            navigator.clipboard.writeText(i.invite_url);
                            toast.success("Link copiado");
                          }}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 ml-auto text-xs"
                          disabled={reprocessando === i.invite_url}
                          onClick={async () => {
                            setReprocessando(i.invite_url);
                            try { await reprocessar([i]); } finally { setReprocessando(null); }
                          }}
                          title="Ignora deduplicação e recaptura este grupo"
                        >
                          <RefreshCw className={`h-3 w-3 mr-1 ${reprocessando === i.invite_url ? "animate-spin" : ""}`} />
                          Reprocessar
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">{meta.hint}</p>
                    </li>
                  );
                })}
              </ul>
            </ScrollArea>
          </>
        )}
      </CardContent>
    </Card>
  );
}
