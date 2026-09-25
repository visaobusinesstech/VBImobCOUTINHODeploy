import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Sparkles, Tag, RefreshCw, Info } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CopyButton } from "./CopyButton";

interface KeywordItem {
  termo: string;
  prioridade?: "alta" | "media" | "baixa";
  onde_usar?: string;
  exemplo_frase?: string;
}
interface KeywordGroup {
  id: string;
  titulo: string;
  descricao?: string;
  intencao?: string;
  estagio_jornada?: string;
  aplicacao?: string;
  keywords: KeywordItem[];
}
interface Sugestao {
  keyword_principal?: { termo: string; justificativa?: string };
  grupos?: KeywordGroup[];
  tags_sugeridas?: string[];
  meta_description_sugerida?: string;
  recomendacoes_gerais?: string[];
}

interface Props {
  titulo: string;
  meta_description?: string;
  tags?: string[];
  introducao?: string;
  conclusao?: string;
  secoes?: Array<{ titulo?: string; conteudo?: string }>;
  nicho?: string;
  onApplyTags?: (tags: string[]) => void;
  onApplyMeta?: (meta: string) => void;
}

const prioColor: Record<string, string> = {
  alta: "bg-red-100 text-red-800 border-red-200",
  media: "bg-amber-100 text-amber-800 border-amber-200",
  baixa: "bg-slate-100 text-slate-700 border-slate-200",
};

export function KeywordsSuggestPanel({
  titulo, meta_description, tags, introducao, conclusao, secoes, nicho,
  onApplyTags, onApplyMeta,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Sugestao | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canGenerate = (titulo || "").trim().length >= 3;
  const totalKeywords = useMemo(
    () => (data?.grupos || []).reduce((n, g) => n + (g.keywords?.length || 0), 0),
    [data]
  );

  async function gerar() {
    if (!canGenerate) return;
    setLoading(true); setError(null);
    try {
      const { data: resp, error: err } = await supabase.functions.invoke("sugerir-keywords-seo", {
        body: { titulo, meta_description, tags, introducao, conclusao, secoes, nicho, idioma: "pt-BR" },
      });
      if (err) throw err;
      if ((resp as any)?.error) throw new Error((resp as any).error);
      setData(resp as Sugestao);
      toast.success("Sugestões geradas");
    } catch (e: any) {
      const msg = e?.message || "Falha ao gerar sugestões";
      setError(msg);
      toast.error(msg);
    } finally { setLoading(false); }
  }

  if (!data && !loading) {
    return (
      <div className="border rounded-lg p-6 text-center space-y-3">
        <Sparkles className="w-8 h-8 mx-auto text-primary" />
        <h4 className="font-semibold">Sugestão de palavras-chave com IA</h4>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Analisa título + conteúdo e retorna keywords secundárias, long-tail, LSI, perguntas
          (PAA), entidades relacionadas e modificadores — agrupados por intenção e estágio da jornada.
        </p>
        <Button onClick={gerar} disabled={!canGenerate}>
          <Sparkles className="w-4 h-4 mr-2" /> Analisar e sugerir
        </Button>
        {!canGenerate && <p className="text-xs text-muted-foreground">Título é obrigatório.</p>}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="border rounded-lg p-8 text-center space-y-2">
        <Loader2 className="w-6 h-6 mx-auto animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Analisando conteúdo e explorando vocabulário SEO…</p>
      </div>
    );
  }

  const allTermos = (data?.grupos || []).flatMap((g) => g.keywords.map((k) => k.termo));

  return (
    <div className="space-y-4">
      {/* Header + ações globais */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className="text-[10px]">{totalKeywords} keywords</Badge>
          <Badge variant="outline" className="text-[10px]">{data?.grupos?.length || 0} grupos</Badge>
          {data?.keyword_principal?.termo && (
            <Badge className="text-[10px] bg-primary/10 text-primary border-primary/30">
              Principal: {data.keyword_principal.termo}
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          <CopyButton
            value={allTermos.join(", ")}
            label="Todas as keywords"
            buttonText="Copiar todas"
            variant="outline"
            size="sm"
          />
          <Button variant="outline" size="sm" onClick={gerar} disabled={loading}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Regenerar
          </Button>
        </div>
      </div>

      {data?.keyword_principal?.justificativa && (
        <div className="flex gap-2 text-xs bg-muted/40 border rounded-md p-2">
          <Info className="w-3.5 h-3.5 mt-0.5 text-primary shrink-0" />
          <span className="text-muted-foreground"><b className="text-foreground">Por que essa keyword principal?</b> {data.keyword_principal.justificativa}</span>
        </div>
      )}

      {/* Meta sugerida */}
      {data?.meta_description_sugerida && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              Meta description sugerida
              <div className="flex gap-1">
                <CopyButton value={data.meta_description_sugerida} label="Meta sugerida" />
                {onApplyMeta && (
                  <Button size="sm" variant="secondary" className="h-7 text-xs"
                    onClick={() => { onApplyMeta(data.meta_description_sugerida!); toast.success("Meta aplicada ao editor"); }}>
                    Aplicar
                  </Button>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-sm text-muted-foreground">{data.meta_description_sugerida}</p>
            <p className="text-[10px] text-muted-foreground mt-1">{data.meta_description_sugerida.length} chars</p>
          </CardContent>
        </Card>
      )}

      {/* Tags sugeridas */}
      {data?.tags_sugeridas?.length ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              <span className="flex items-center gap-1.5"><Tag className="w-3.5 h-3.5" /> Tags sugeridas</span>
              <div className="flex gap-1">
                <CopyButton value={data.tags_sugeridas.join(", ")} label="Tags" />
                {onApplyTags && (
                  <Button size="sm" variant="secondary" className="h-7 text-xs"
                    onClick={() => { onApplyTags(data.tags_sugeridas!); toast.success("Tags aplicadas ao editor"); }}>
                    Aplicar
                  </Button>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 flex flex-wrap gap-1.5">
            {data.tags_sugeridas.map((t) => (
              <Badge key={t} variant="outline" className="text-[11px]">{t}</Badge>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {/* Grupos */}
      <div className="space-y-3">
        {(data?.grupos || []).map((g) => (
          <Card key={g.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-start justify-between gap-2 flex-wrap">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span>{g.titulo}</span>
                    {g.intencao && <Badge variant="secondary" className="text-[10px] capitalize">{g.intencao}</Badge>}
                    {g.estagio_jornada && <Badge variant="outline" className="text-[10px] capitalize">{g.estagio_jornada}</Badge>}
                    <Badge variant="outline" className="text-[10px]">{g.keywords.length} termos</Badge>
                  </div>
                  {g.descricao && <p className="text-xs text-muted-foreground font-normal">{g.descricao}</p>}
                  {g.aplicacao && (
                    <p className="text-[11px] text-primary font-normal">
                      <b>Onde aplicar:</b> {g.aplicacao}
                    </p>
                  )}
                </div>
                <CopyButton value={g.keywords.map((k) => k.termo).join(", ")} label={`Keywords: ${g.titulo}`} />
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="border rounded-md divide-y">
                {g.keywords.map((k, i) => (
                  <div key={i} className="p-2 flex items-start gap-2 text-sm">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium break-words">{k.termo}</span>
                        {k.prioridade && (
                          <Badge className={`text-[9px] border ${prioColor[k.prioridade] || ""}`}>
                            {k.prioridade}
                          </Badge>
                        )}
                        {k.onde_usar && (
                          <span className="text-[10px] text-muted-foreground">→ {k.onde_usar}</span>
                        )}
                      </div>
                      {k.exemplo_frase && (
                        <p className="text-xs text-muted-foreground italic">"{k.exemplo_frase}"</p>
                      )}
                    </div>
                    <CopyButton value={k.termo} label={k.termo} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recomendações */}
      {data?.recomendacoes_gerais?.length ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Recomendações gerais</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
              {data.recomendacoes_gerais.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
