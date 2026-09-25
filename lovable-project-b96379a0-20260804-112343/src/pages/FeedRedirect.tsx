import { useEffect } from "react";
import { useParams } from "react-router-dom";

/**
 * Alias amigável para o feed: /rss, /atom, /feed
 * Também suporta rotas dedicadas por categoria/cidade:
 *   /rss/categoria/:tipo
 *   /atom/categoria/:tipo
 *   /rss/cidade/:cidade
 *   /atom/cidade/:cidade
 *   /rss/categoria/:tipo/cidade/:cidade
 *   /atom/categoria/:tipo/cidade/:cidade
 *
 * Redireciona para o edge function blog-rss preservando filtros (?tipo=, ?cidade=).
 * O componente é montado em rotas SPA; para .xml estáticos veja public/rss.xml e public/atom.xml.
 */
export default function FeedRedirect({ format }: { format: "rss" | "atom" }) {
  const { tipo, cidade } = useParams<{ tipo?: string; cidade?: string }>();

  useEffect(() => {
    const supabaseUrl =
      import.meta.env.VITE_SUPABASE_URL || "https://ugxnxztecfsklijmhhmo.supabase.co";
    const params = new URLSearchParams(window.location.search);
    if (format === "atom") params.set("format", "atom");
    else params.delete("format");
    if (tipo) params.set("tipo", decodeURIComponent(tipo));
    if (cidade) params.set("cidade", decodeURIComponent(cidade));
    const qs = params.toString();
    const target = `${supabaseUrl}/functions/v1/blog-rss${qs ? `?${qs}` : ""}`;
    window.location.replace(target);
  }, [format, tipo, cidade]);

  return (
    <div style={{ padding: 24, fontFamily: "system-ui, sans-serif", color: "#475569" }}>
      Redirecionando para o feed {format.toUpperCase()}
      {tipo ? ` — categoria: ${decodeURIComponent(tipo)}` : ""}
      {cidade ? ` — cidade: ${decodeURIComponent(cidade)}` : ""}…
    </div>
  );
}
