import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { FileText, ImageIcon, Loader2, Lock, Users } from "lucide-react";
import type { NotaEvento } from "@/components/qcapture/EventoNotasBlock";

function fmtTamanho(bytes: number | null) {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const ehImagem = (tipo: string | null, nome: string | null) =>
  (tipo ?? "").startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(nome ?? "");

interface Props {
  notas: NotaEvento[];
  currentUserId: string | null;
}

/** Lista os anexos que entram no PDF, com miniatura quando o arquivo é imagem. */
export function AnexosPreviewPanel({ notas, currentUserId }: Props) {
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(false);

  const anexos = useMemo(
    () =>
      notas.filter(
        (n) =>
          !!n.anexo_path &&
          (n.visibilidade !== "privada" || (currentUserId && n.autor_id === currentUserId)),
      ),
    [notas, currentUserId],
  );

  useEffect(() => {
    let ativo = true;
    const imagens = anexos.filter((n) => ehImagem(n.anexo_tipo, n.anexo_nome));
    if (imagens.length === 0) {
      setThumbs({});
      return;
    }
    setCarregando(true);
    (async () => {
      const { data } = await supabase.storage
        .from("historico-anexos")
        .createSignedUrls(imagens.map((n) => n.anexo_path as string), 300);
      if (!ativo) return;
      const map: Record<string, string> = {};
      (data ?? []).forEach((d, i) => {
        if (d.signedUrl) map[imagens[i].id] = d.signedUrl;
      });
      setThumbs(map);
      setCarregando(false);
    })();
    return () => {
      ativo = false;
    };
  }, [anexos]);

  if (anexos.length === 0) {
    return (
      <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
        Nenhum anexo nas notas incluídas neste PDF.
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-card p-3">
      <div className="mb-2 flex items-center gap-2">
        <h4 className="text-sm font-semibold">Anexos incluídos ({anexos.length})</h4>
        {carregando && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {anexos.map((n) => {
          const url = thumbs[n.id];
          const img = ehImagem(n.anexo_tipo, n.anexo_nome);
          return (
            <a
              key={n.id}
              href={url}
              target="_blank"
              rel="noreferrer"
              className="flex gap-2 rounded-md border p-2 transition-colors hover:bg-muted/50"
            >
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
                {img && url ? (
                  <img
                    src={url}
                    alt={n.anexo_nome ?? "Anexo"}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : img ? (
                  <ImageIcon className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <FileText className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium" title={n.anexo_nome ?? ""}>
                  {n.anexo_nome ?? "Anexo"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {fmtTamanho(n.anexo_tamanho) || "—"}
                  {n.anexo_tipo ? ` · ${n.anexo_tipo}` : ""}
                </p>
                <Badge variant="outline" className="mt-1 gap-1 text-[10px]">
                  {n.visibilidade === "privada" ? (
                    <>
                      <Lock className="h-2.5 w-2.5" /> Privada
                    </>
                  ) : (
                    <>
                      <Users className="h-2.5 w-2.5" /> Time
                    </>
                  )}
                </Badge>
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
