import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, History, RotateCcw, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Versao {
  id: string;
  conteudo_id: string;
  titulo: string | null;
  slug: string | null;
  meta_description: string | null;
  origem: string;
  criado_por: string | null;
  criado_em: string;
}

interface Current {
  titulo: string;
  slug: string;
  meta: string;
}

interface Props {
  conteudoId: string | null;
  current: Current;
  onRevert: (v: { titulo: string; slug: string; meta_description: string }) => void;
}

function DiffLine({ label, before, after }: { label: string; before: string; after: string }) {
  const changed = (before || "") !== (after || "");
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
        {changed ? (
          <Badge variant="outline" className="text-[9px] border-amber-400 text-amber-700 bg-amber-50">alterado</Badge>
        ) : (
          <Badge variant="outline" className="text-[9px]">igual</Badge>
        )}
      </div>
      {changed ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
          <div className="rounded border border-red-200 bg-red-50/60 p-1.5">
            <div className="text-[9px] uppercase text-red-700 font-semibold mb-0.5">Versão antiga</div>
            <div className="text-red-900 break-words whitespace-pre-wrap">{before || <em className="text-muted-foreground">(vazio)</em>}</div>
          </div>
          <div className="rounded border border-emerald-200 bg-emerald-50/60 p-1.5">
            <div className="text-[9px] uppercase text-emerald-700 font-semibold mb-0.5">Atual (editor)</div>
            <div className="text-emerald-900 break-words whitespace-pre-wrap">{after || <em className="text-muted-foreground">(vazio)</em>}</div>
          </div>
        </div>
      ) : (
        <div className="text-xs text-muted-foreground break-words">{before || <em>(vazio)</em>}</div>
      )}
    </div>
  );
}

export function VersionHistoryPanel({ conteudoId, current, onRevert }: Props) {
  const [versoes, setVersoes] = useState<Versao[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [reverting, setReverting] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const carregar = async () => {
    if (!conteudoId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("conteudos_seo_versoes")
      .select("id,conteudo_id,titulo,slug,meta_description,origem,criado_por,criado_em")
      .eq("conteudo_id", conteudoId)
      .order("criado_em", { ascending: false })
      .limit(50);
    if (error) {
      toast.error("Erro ao carregar histórico", { description: error.message });
    } else {
      setVersoes(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conteudoId]);

  const currentPatch = useMemo(
    () => ({ titulo: current.titulo, slug: current.slug, meta_description: current.meta }),
    [current]
  );

  const handleRevert = (v: Versao) => {
    setReverting(v.id);
    try {
      onRevert({
        titulo: v.titulo || "",
        slug: v.slug || "",
        meta_description: v.meta_description || "",
      });
      toast.success("Versão restaurada no editor", {
        description: "Clique em \"Salvar alterações\" para persistir a reversão.",
      });
    } finally {
      setReverting(null);
    }
  };

  const handleDelete = async (v: Versao) => {
    if (!confirm("Excluir esta versão do histórico? Esta ação não pode ser desfeita.")) return;
    setDeleting(v.id);
    const { error } = await supabase.from("conteudos_seo_versoes").delete().eq("id", v.id);
    setDeleting(null);
    if (error) {
      toast.error("Erro ao excluir", { description: error.message });
      return;
    }
    setVersoes((prev) => prev.filter((x) => x.id !== v.id));
    toast.success("Versão removida do histórico");
  };

  if (!conteudoId) {
    return <p className="text-xs text-muted-foreground p-3">Salve o post primeiro para começar a registrar versões.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <History className="w-3.5 h-3.5" />
          <span>
            {loading ? "Carregando…" : `${versoes.length} versão(ões) salvas`}
            {versoes.length >= 50 && " (mostrando as 50 mais recentes)"}
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={carregar} disabled={loading} className="h-7 text-xs">
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Atualizar"}
        </Button>
      </div>

      {!loading && versoes.length === 0 && (
        <div className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
          Ainda não há versões salvas. Toda vez que você **Salvar alterações** com mudanças em título, slug ou meta, uma versão será registrada aqui automaticamente.
        </div>
      )}

      <ScrollArea className="max-h-[420px] pr-2">
        <div className="space-y-2">
          {versoes.map((v, idx) => {
            const isOpen = !!expanded[v.id];
            const changedFields = [
              (v.titulo || "") !== currentPatch.titulo && "título",
              (v.slug || "") !== currentPatch.slug && "slug",
              (v.meta_description || "") !== currentPatch.meta_description && "meta",
            ].filter(Boolean) as string[];

            return (
              <div key={v.id} className="rounded-lg border bg-background overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpanded((s) => ({ ...s, [v.id]: !s[v.id] }))}
                  className="w-full flex items-center justify-between gap-2 p-2.5 hover:bg-muted/40 transition-colors text-left"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {isOpen ? <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />}
                    <div className="min-w-0">
                      <div className="text-xs font-medium truncate">
                        v{versoes.length - idx} · {v.titulo || <em className="text-muted-foreground">(sem título)</em>}
                      </div>
                      <div className="text-[10px] text-muted-foreground flex items-center gap-2 flex-wrap">
                        <span>{formatDistanceToNow(new Date(v.criado_em), { addSuffix: true, locale: ptBR })}</span>
                        <span>·</span>
                        <span>{new Date(v.criado_em).toLocaleString("pt-BR")}</span>
                        {v.origem && v.origem !== "edicao_manual" && (
                          <Badge variant="outline" className="text-[9px]">{v.origem}</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {changedFields.length === 0 ? (
                      <Badge variant="secondary" className="text-[9px]">idêntica ao atual</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[9px] border-amber-400 text-amber-700 bg-amber-50">
                        {changedFields.length} diferença(s)
                      </Badge>
                    )}
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t p-3 space-y-3 bg-muted/10">
                    <DiffLine label="Título" before={v.titulo || ""} after={currentPatch.titulo} />
                    <DiffLine label="Slug" before={v.slug || ""} after={currentPatch.slug} />
                    <DiffLine label="Meta description" before={v.meta_description || ""} after={currentPatch.meta_description} />
                    <div className="flex items-center justify-end gap-2 pt-1 border-t">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-destructive hover:text-destructive"
                        disabled={deleting === v.id}
                        onClick={() => handleDelete(v)}
                      >
                        {deleting === v.id ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Trash2 className="w-3 h-3 mr-1" />}
                        Excluir
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        className="h-7 text-xs"
                        disabled={reverting === v.id || changedFields.length === 0}
                        title={changedFields.length === 0 ? "Nada a reverter — já está igual ao atual" : "Restaurar esta versão no editor"}
                        onClick={() => handleRevert(v)}
                      >
                        {reverting === v.id ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <RotateCcw className="w-3 h-3 mr-1" />}
                        Reverter para esta versão
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
