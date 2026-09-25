import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Loader2, Plus, RotateCcw, Save, Sparkles, X } from "lucide-react";

const DEFAULT_TOKENS = [
  "grupo","whatsapp","wpp","zap","oficial","link","convite","entrar","join",
];
const DEFAULT_MIN = 3;

// Replicação client-side da normalização usada no edge function
// (supabase/functions/_shared/firecrawlParser.ts). Mantenha sincronizado.
function normalizarNomeGrupo(
  nome: string | null | undefined,
  opts?: { tokens?: string[]; minLength?: number },
): string | null {
  if (!nome) return null;
  const tokens = (opts?.tokens && opts.tokens.length ? opts.tokens : DEFAULT_TOKENS)
    .map((t) =>
      String(t)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, ""),
    )
    .filter((t) => t.length > 0);
  const minLength = Math.max(1, Math.min(10, opts?.minLength ?? DEFAULT_MIN));
  const semAcento = nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  let base = semAcento.toLowerCase().replace(/[^a-z0-9]+/g, " ");
  if (tokens.length) {
    const re = new RegExp(
      `\\b(${tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`,
      "g",
    );
    base = base.replace(re, " ");
  }
  base = base.replace(/\s+/g, " ").trim();
  if (base.length < minLength) return null;
  return base;
}

const SAMPLE_DEFAULT = [
  "Grupo Whatsapp Oficial Sudoeste",
  "GRUPO Águas Claras - Oficial",
  "Zap Moradores Noroeste",
  "Wpp Convite Entrar Lago Sul",
  "Águas Claras (WhatsApp)",
  "Condomínio Águas Claras",
].join("\n");

export default function NormalizacaoTokensPanel() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tokens, setTokens] = useState<string[]>(DEFAULT_TOKENS);
  const [minLength, setMinLength] = useState<number>(DEFAULT_MIN);
  const [novoToken, setNovoToken] = useState("");
  const [amostra, setAmostra] = useState(SAMPLE_DEFAULT);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("radarzap_normalizacao_config")
        .select("tokens_ruidosos, min_length")
        .eq("imobiliaria_id", user.id)
        .maybeSingle();
      if (error) {
        toast.error("Falha ao carregar configuração", { description: error.message });
      } else if (data) {
        setTokens(Array.isArray(data.tokens_ruidosos) ? data.tokens_ruidosos : DEFAULT_TOKENS);
        setMinLength(typeof data.min_length === "number" ? data.min_length : DEFAULT_MIN);
      }
      setLoading(false);
    })();
  }, [user?.id]);

  const addToken = () => {
    const t = novoToken.trim().toLowerCase();
    if (!t) return;
    if (tokens.includes(t)) {
      toast.info("Token já está na lista");
      return;
    }
    setTokens((prev) => [...prev, t]);
    setNovoToken("");
  };

  const removeToken = (t: string) => setTokens((prev) => prev.filter((x) => x !== t));

  const resetDefaults = () => {
    setTokens([...DEFAULT_TOKENS]);
    setMinLength(DEFAULT_MIN);
  };

  const salvar = async () => {
    if (!user?.id) return;
    setSaving(true);
    const { error } = await supabase
      .from("radarzap_normalizacao_config")
      .upsert(
        {
          imobiliaria_id: user.id,
          tokens_ruidosos: tokens,
          min_length: minLength,
        },
        { onConflict: "imobiliaria_id" },
      );
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar", { description: error.message });
    } else {
      toast.success("Configuração salva. Aplicada nas próximas descobertas.");
    }
  };

  // Simulação: normaliza cada linha da amostra e agrupa por chave para mostrar duplicados.
  const simulacao = useMemo(() => {
    const linhas = amostra
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const rows = linhas.map((nome) => ({
      nome,
      norm: normalizarNomeGrupo(nome, { tokens, minLength }),
    }));
    const grupos = new Map<string, number>();
    for (const r of rows) {
      if (!r.norm) continue;
      grupos.set(r.norm, (grupos.get(r.norm) ?? 0) + 1);
    }
    const duplicados = Array.from(grupos.entries()).filter(([, n]) => n > 1);
    const descartados = rows.filter((r) => r.norm === null).length;
    return { rows, duplicados, descartados, total: rows.length, unicos: grupos.size };
  }, [amostra, tokens, minLength]);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tokens ruidosos da normalização</CardTitle>
          <p className="text-xs text-muted-foreground">
            Palavras removidas antes de comparar nomes de grupos na deduplicação. Ex.: "grupo",
            "whatsapp", "oficial". Aplica-se apenas à sua imobiliária.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2 min-h-[40px]">
                {tokens.length === 0 && (
                  <span className="text-xs text-muted-foreground">Nenhum token — nomes não terão remoção.</span>
                )}
                {tokens.map((t) => (
                  <Badge key={t} variant="secondary" className="gap-1 pr-1">
                    {t}
                    <button
                      onClick={() => removeToken(t)}
                      className="ml-1 rounded-sm hover:bg-muted p-0.5"
                      aria-label={`Remover ${t}`}
                      type="button"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>

              <div className="flex gap-2">
                <Input
                  placeholder="novo token (ex.: brasilia)"
                  value={novoToken}
                  onChange={(e) => setNovoToken(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addToken();
                    }
                  }}
                />
                <Button type="button" onClick={addToken} variant="secondary">
                  <Plus className="h-4 w-4 mr-1" /> Adicionar
                </Button>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-3 items-end">
                <div>
                  <Label htmlFor="min-length" className="text-xs">Tamanho mínimo do nome normalizado</Label>
                  <Input
                    id="min-length"
                    type="number"
                    min={1}
                    max={10}
                    value={minLength}
                    onChange={(e) => setMinLength(Math.max(1, Math.min(10, Number(e.target.value) || DEFAULT_MIN)))}
                  />
                </div>
                <div className="text-xs text-muted-foreground">
                  Nomes que ficarem abaixo desse tamanho após remover tokens são descartados da chave de dedup.
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button onClick={salvar} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                  Salvar
                </Button>
                <Button type="button" variant="outline" onClick={resetDefaults}>
                  <RotateCcw className="h-4 w-4 mr-1" /> Restaurar padrão
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Testar efeito na deduplicação
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Cole nomes de grupos (um por linha) e veja como ficam após a normalização, quantos
            colapsam em duplicados e quantos são descartados por ficarem curtos demais.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            rows={7}
            value={amostra}
            onChange={(e) => setAmostra(e.target.value)}
            className="font-mono text-xs"
          />

          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline">Total: {simulacao.total}</Badge>
            <Badge variant="outline">Chaves únicas: {simulacao.unicos}</Badge>
            <Badge variant="secondary">Duplicados: {simulacao.duplicados.length}</Badge>
            <Badge variant="destructive">Descartados: {simulacao.descartados}</Badge>
          </div>

          <div className="rounded-md border max-h-64 overflow-auto text-xs">
            <table className="w-full">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="text-left px-2 py-1 font-medium">Original</th>
                  <th className="text-left px-2 py-1 font-medium">Chave normalizada</th>
                </tr>
              </thead>
              <tbody>
                {simulacao.rows.map((r, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-2 py-1">{r.nome}</td>
                    <td className="px-2 py-1 font-mono">
                      {r.norm ? (
                        <span>{r.norm}</span>
                      ) : (
                        <span className="text-destructive">— descartado —</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {simulacao.duplicados.length > 0 && (
            <div className="text-xs">
              <div className="font-medium mb-1">Chaves que colapsariam (dedup):</div>
              <ul className="list-disc pl-4 space-y-0.5">
                {simulacao.duplicados.map(([k, n]) => (
                  <li key={k}>
                    <span className="font-mono">{k}</span> — {n} ocorrências
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
