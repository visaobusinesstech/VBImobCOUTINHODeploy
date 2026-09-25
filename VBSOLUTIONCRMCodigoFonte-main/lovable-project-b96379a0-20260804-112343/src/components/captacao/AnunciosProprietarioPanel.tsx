import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  ExternalLink, Loader2, Phone, Mail, MessageCircle, Search, Trash2, Link2, RefreshCw,
} from "lucide-react";

type AnuncioCaptado = {
  id: string;
  origem: "captacao" | "legado";
  url_anuncio: string;
  portal: string | null;
  titulo: string | null;
  preco: number | null;
  bairro: string | null;
  cidade: string | null;
  telefone: string | null;
  email: string | null;
  anunciante_tipo: string;
  extraction_status: string;
  observacoes: string | null;
  created_at: string;
};

const fmtBRL = (v: number | null) =>
  (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export function AnunciosProprietarioPanel() {
  const { user } = useAuth();
  const [itens, setItens] = useState<AnuncioCaptado[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");

  const fetchItens = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);

    const [novos, legado] = await Promise.all([
      supabase
        .from("captacao_anuncios_extraidos" as any)
        .select("*")
        .eq("imobiliaria_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("contatos_landing")
        .select("id, nome, telefone, email, source_url, extraction_status, created_at")
        .not("source_url", "is", null)
        .order("created_at", { ascending: false }),
    ]);

    const lista: AnuncioCaptado[] = [];

    for (const r of ((novos.data as any[]) || [])) {
      lista.push({
        id: r.id,
        origem: "captacao",
        url_anuncio: r.url_anuncio,
        portal: r.portal,
        titulo: r.titulo,
        preco: r.preco,
        bairro: r.bairro,
        cidade: r.cidade,
        telefone: r.telefone,
        email: r.email,
        anunciante_tipo: r.anunciante_tipo,
        extraction_status: r.extraction_status,
        observacoes: r.observacoes,
        created_at: r.created_at,
      });
    }

    for (const r of ((legado.data as any[]) || [])) {
      lista.push({
        id: r.id,
        origem: "legado",
        url_anuncio: r.source_url,
        portal: (() => { try { return new URL(r.source_url).hostname.replace("www.", ""); } catch { return null; } })(),
        titulo: String(r.nome || "").replace(/^Extração:\s*/, ""),
        preco: null,
        bairro: null,
        cidade: null,
        telefone: r.telefone || null,
        email: r.email && r.email !== "sistema@radarimob.tech" ? r.email : null,
        anunciante_tipo: "indefinido",
        extraction_status: r.extraction_status || "pending",
        observacoes: "Registro antigo — anunciante não classificado",
        created_at: r.created_at,
      });
    }

    // Remove duplicados pelo link do anúncio, mantendo o registro mais recente
    const ordenada = lista.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    const vistos = new Set<string>();
    const unicos = ordenada.filter(i => {
      const chave = (i.url_anuncio || i.id).trim().toLowerCase();
      if (vistos.has(chave)) return false;
      vistos.add(chave);
      return true;
    });

    setItens(unicos);

    setLoading(false);
  }, [user?.id]);

  useEffect(() => { fetchItens(); }, [fetchItens]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return itens;
    return itens.filter(i =>
      (i.titulo || "").toLowerCase().includes(q) ||
      (i.url_anuncio || "").toLowerCase().includes(q) ||
      (i.telefone || "").includes(q) ||
      (i.portal || "").toLowerCase().includes(q)
    );
  }, [itens, busca]);

  const excluir = async (item: AnuncioCaptado) => {
    const tabela = item.origem === "captacao" ? "captacao_anuncios_extraidos" : "contatos_landing";
    const { error } = await supabase.from(tabela as any).delete().eq("id", item.id);
    if (error) {
      toast.error("Erro ao excluir registro");
      return;
    }
    setItens(prev => prev.filter(i => i.id !== item.id));
    toast.success("Registro removido");
  };

  const abrirWhatsapp = (telefone: string, titulo: string | null) => {
    const num = telefone.replace(/\D/g, "");
    const full = num.startsWith("55") ? num : `55${num}`;
    const msg = `Olá! Vi seu anúncio${titulo ? ` "${titulo}"` : ""} e gostaria de conversar sobre o imóvel.`;
    window.open(`https://wa.me/${full}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const abrirEmail = (email: string, titulo: string | null) => {
    const assunto = `Sobre seu anúncio${titulo ? `: ${titulo}` : ""}`;
    const corpo = `Olá! Vi seu anúncio${titulo ? ` "${titulo}"` : ""} e gostaria de conversar sobre o imóvel.`;
    window.open(`mailto:${email}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`, "_blank");
  };

  const [editandoContato, setEditandoContato] = useState<string | null>(null);
  const [contatoInput, setContatoInput] = useState("");

  const salvarContato = async (item: AnuncioCaptado) => {
    const valor = contatoInput.trim();
    if (!valor) return;
    const ehEmail = valor.includes("@");
    const telefone = ehEmail ? null : valor.replace(/\D/g, "");
    const email = ehEmail ? valor : null;

    const patch = ehEmail ? { email } : { telefone };
    const tabela = item.origem === "captacao" ? "captacao_anuncios_extraidos" : "contatos_landing";
    const { error } = await supabase.from(tabela as any).update(patch).eq("id", item.id);
    if (error) {
      toast.error("Não foi possível salvar o contato");
      return;
    }
    setItens(prev => prev.map(i => (i.id === item.id ? { ...i, ...patch } as AnuncioCaptado : i)));
    setEditandoContato(null);
    setContatoInput("");
    toast.success("Contato salvo no anúncio");
  };

  const comContato = itens.filter(i => i.telefone || i.email).length;


  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Link2 className="w-4 h-4 text-primary" />
            Anúncios captados — proprietário direto
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {filtrados.length} anúncios · {comContato} com contato público · link de origem sempre preservado (LGPD)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por título, link ou telefone..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              className="pl-9 h-9 w-[260px]"
            />
          </div>
          <Button variant="outline" size="sm" onClick={fetchItens} className="h-9">
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Atualizar
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtrados.length === 0 ? (
        <div className="text-center py-16">
          <Link2 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">Nenhum anúncio de proprietário direto captado ainda.</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Ao extrair um anúncio, só serão salvos aqui os que forem identificados como anúncio direto do dono.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtrados.map(item => (
            <div key={`${item.origem}-${item.id}`} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-sm text-foreground truncate">{item.titulo || "Anúncio"}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {item.portal && <Badge variant="secondary" className="text-[10px]">{item.portal}</Badge>}
                    <Badge
                      variant={item.anunciante_tipo === "proprietario" ? "default" : "outline"}
                      className="text-[10px]"
                    >
                      {item.anunciante_tipo === "proprietario" ? "Proprietário direto" : "Possível proprietário"}
                    </Badge>
                    {!item.telefone && !item.email && (
                      <Badge variant="outline" className="text-[10px]">Sem contato público</Badge>
                    )}

                    {item.extraction_status !== "completed" && (
                      <Badge variant="outline" className="text-[10px]">Extração {item.extraction_status}</Badge>
                    )}
                  </div>
                </div>
                {item.preco ? (
                  <span className="text-sm font-semibold text-foreground whitespace-nowrap">{fmtBRL(item.preco)}</span>
                ) : null}
              </div>

              <div className="mt-2 space-y-1">
                <a
                  href={item.url_anuncio}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline flex items-center gap-1 break-all"
                >
                  <ExternalLink className="w-3 h-3 shrink-0" />
                  {item.url_anuncio}
                </a>
                {(item.bairro || item.cidade) && (
                  <p className="text-xs text-muted-foreground">{[item.bairro, item.cidade].filter(Boolean).join(" · ")}</p>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                  {item.telefone ? (
                    <>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Phone className="w-3 h-3" />{item.telefone}
                      </span>
                      <Button
                        size="sm"
                        className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => abrirWhatsapp(item.telefone!, item.titulo)}
                      >
                        <MessageCircle className="w-3.5 h-3.5 mr-1" /> WhatsApp com mensagem pronta
                      </Button>
                    </>
                  ) : editandoContato === item.id ? (
                    <div className="flex items-center gap-1">
                      <Input
                        autoFocus
                        value={contatoInput}
                        onChange={e => setContatoInput(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") salvarContato(item); }}
                        placeholder="Telefone ou e-mail do anúncio"
                        className="h-7 text-xs w-[200px]"
                      />
                      <Button size="sm" className="h-7 text-xs" onClick={() => salvarContato(item)}>Salvar</Button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setEditandoContato(item.id); setContatoInput(""); }}
                      className="text-xs text-primary hover:underline"
                    >
                      Sem contato público — registrar contato do anúncio
                    </button>
                  )}

                  {item.email && (
                    <>
                      <a href={`mailto:${item.email}`} className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1">
                        <Mail className="w-3 h-3" />{item.email}
                      </a>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => abrirEmail(item.email!, item.titulo)}
                      >
                        <Mail className="w-3.5 h-3.5 mr-1" /> E-mail pronto
                      </Button>
                    </>
                  )}
                </div>

                {item.observacoes && (
                  <p className="text-[11px] text-muted-foreground/80">{item.observacoes}</p>
                )}
              </div>

              <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/40">
                <span className="text-[10px] text-muted-foreground/60">{fmtDate(item.created_at)}</span>
                <div className="flex items-center gap-1">
                  {item.telefone && (
                    <button
                      onClick={() => abrirWhatsapp(item.telefone!, item.titulo)}
                      className="w-7 h-7 rounded-lg bg-green-500/10 flex items-center justify-center text-green-600 hover:bg-green-500/20"
                      title="WhatsApp"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => excluir(item)}
                    className="w-7 h-7 rounded-lg bg-destructive/10 flex items-center justify-center text-destructive hover:bg-destructive/20"
                    title="Excluir"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AnunciosProprietarioPanel;
