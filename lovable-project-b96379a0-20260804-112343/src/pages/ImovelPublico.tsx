import { useEffect, useState } from "react";
import { Seo } from "@/components/Seo";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, Bed, Bath, Car, Maximize, DoorOpen, ArrowLeft, Loader2, ImageOff, ChevronLeft, ChevronRight, MessageCircle, Send, Facebook, Instagram, Twitter, Linkedin, Copy, Share2, Music } from "lucide-react";
import { ShareMenu } from "@/components/imoveis/ShareMenu";
import { useToast } from "@/hooks/use-toast";
import { LeadCaptureDialog } from "@/components/portal/LeadCaptureDialog";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { getShareUrl, getOgShareUrl } from "@/lib/publicUrl";

const formatPreco = (preco: number, operacao: string) => {
  const formatted = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(preco);
  return operacao === "Aluguel" ? `${formatted}/mês` : formatted;
};

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const cleanTitulo = (titulo?: string | null, fallback = "Imóvel") => {
  const clean = (titulo || "")
    .replace(/\s*-\s*(DFimoveis\.com|OLX|ZAP\s*Im[oó]veis|Viva\s*Real|W\s*Im[oó]veis|Chave\s*na\s*M[aã]o|Im[oó]veis\s*Web|Netimóveis|imovelweb).*$/i, "")
    .replace(/\s*(à venda|para alugar|para venda|para locação|com \d+ quartos?|em [A-ZÀ-Ú][a-zà-ú]+.*$)/gi, "")
    .trim();

  return clean || fallback;
};

const ImovelPublico = () => {
  const { id } = useParams<{ id: string }>();
  const [imovel, setImovel] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [fotoIdx, setFotoIdx] = useState(0);
  const [showCapture, setShowCapture] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetch = async () => {
      if (!id) return;
      const { data } = await supabase
        .from("imoveis")
        .select("id, titulo, tipo, operacao, preco, endereco, cidade, bairro, estado, cep, quartos, banheiros, suites, vagas, area, descricao, status, exclusivo, destaque, aceita_permuta, aceita_financiamento, aceita_fgts, tem_escritura, valor_condominio, valor_iptu, andar, posicao_solar, fotos, foto_capa_index, videos, imobiliaria_id")
        .eq("id", id)
        .eq("status", "Ativo")
        .single();
      setImovel(data);
      // Set dynamic OG meta tags for client-side
      if (data) {
        const fotos: string[] = data.fotos ?? [];
        const capaIdx = data.foto_capa_index ?? 0;
        const coverImg = fotos.length > 0 ? (fotos[capaIdx] || fotos[0]) : "";
        const local = [data.bairro, data.cidade].filter(Boolean).join(", ");
        const opLabel = data.operacao === "Aluguel" ? "para alugar" : "à venda";
        const baseTitle = cleanTitulo(data.titulo, data.tipo || "Imóvel");
        const ogTitle = `🏠 ${baseTitle} ${opLabel}${data.quartos > 0 ? ` com ${data.quartos} quartos` : ""}${local ? ` em ${local}` : ""}`;
        const ogDescription = [
          `💰 ${formatPreco(data.preco, data.operacao)}`,
          data.quartos > 0 ? `🛏 ${data.quartos} quartos` : null,
          data.area > 0 ? `📐 ${data.area}m²` : null,
          local ? `📍 ${local.toUpperCase()}` : null,
        ].filter(Boolean).join(" | ");

        document.title = ogTitle;
        const setMeta = (attr: string, key: string, content: string) => {
          let el = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
          if (!el) { el = document.createElement("meta"); el.setAttribute(attr, key); document.head.appendChild(el); }
          el.content = content;
        };
        setMeta("name", "description", ogDescription);
        setMeta("property", "og:title", ogTitle);
        setMeta("property", "og:description", ogDescription);
        setMeta("property", "og:url", getShareUrl(`/imovel/${data.id}`));
        if (coverImg) {
          setMeta("property", "og:image", coverImg);
          setMeta("name", "twitter:image", coverImg);
        }
        setMeta("name", "twitter:title", ogTitle);
        setMeta("name", "twitter:description", ogDescription);
        setMeta("name", "twitter:card", "summary_large_image");
      }
      setLoading(false);
    };
    fetch();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!imovel) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <ImageOff className="w-16 h-16 text-muted-foreground opacity-40" />
        <p className="text-muted-foreground">Imóvel não encontrado.</p>
        <Link to="/" className="text-primary hover:underline text-sm">Voltar ao início</Link>
      </div>
    );
  }

  const fotos: string[] = imovel.fotos ?? [];
  const capaIdx = imovel.foto_capa_index ?? 0;
  const coverImg = fotos.length > 0 ? (fotos[capaIdx] || fotos[0]) : undefined;
  const local = [imovel.endereco, imovel.bairro, imovel.cidade, imovel.estado].filter(Boolean).join(", ");
  const seoTitle = `${cleanTitulo(imovel.titulo, imovel.tipo || "Imóvel")} ${imovel.operacao === "Aluguel" ? "para alugar" : "à venda"}${imovel.bairro ? ` em ${imovel.bairro}` : ""} — radarimobtech`.slice(0, 70);
  const seoDesc = `${formatPreco(imovel.preco, imovel.operacao)}${imovel.quartos ? ` · ${imovel.quartos} quartos` : ""}${imovel.area ? ` · ${imovel.area}m²` : ""}${local ? ` · ${local}` : ""}. Veja fotos e fale direto com o anunciante.`.slice(0, 160);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: cleanTitulo(imovel.titulo, imovel.tipo || "Imóvel"),
    description: imovel.descricao || seoDesc,
    image: fotos.length > 0 ? fotos.slice(0, 6) : undefined,
    offers: {
      "@type": "Offer",
      price: imovel.preco,
      priceCurrency: "BRL",
      availability: "https://schema.org/InStock",
      url: `https://radarimobtech.shop/imovel/${imovel.id}`,
    },
    ...(local ? { address: { "@type": "PostalAddress", streetAddress: imovel.endereco || undefined, addressLocality: imovel.cidade || undefined, addressRegion: imovel.estado || undefined, postalCode: imovel.cep || undefined, addressCountry: "BR" } } : {}),
  };

  return (
    <div className="min-h-screen bg-background">
      <Seo title={seoTitle} description={seoDesc} path={`/imovel/${imovel.id}`} image={coverImg} type="product" jsonLd={jsonLd} />
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur border-b border-border">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </Link>
          <ShareMenu
            id={imovel.id}
            titulo={imovel.titulo}
            preco={imovel.preco}
            operacao={imovel.operacao}
            endereco={imovel.endereco}
            bairro={imovel.bairro}
            cidade={imovel.cidade}
            quartos={imovel.quartos}
            area={imovel.area}
            fotos={fotos}
          />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Gallery */}
        {fotos.length > 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="relative rounded-xl overflow-hidden bg-black/90 aspect-[16/10] md:aspect-[16/9] max-h-[75vh]"
          >
            <img
              key={fotos[fotoIdx]}
              src={fotos[fotoIdx]}
              alt={imovel.titulo}
              loading="eager"
              decoding="async"
              // @ts-expect-error - fetchpriority is valid HTML attribute
              fetchpriority="high"
              className="w-full h-full object-contain md:object-cover object-center transition-opacity duration-300"
              style={{ imageRendering: "auto" }}
            />
            {/* Preload adjacent images for smoother navigation */}
            {fotos.length > 1 && (
              <div className="hidden">
                <img src={fotos[(fotoIdx + 1) % fotos.length]} alt={`Foto ${(fotoIdx + 2)} do imóvel`} loading="eager" decoding="async" />
                <img src={fotos[(fotoIdx - 1 + fotos.length) % fotos.length]} alt={`Foto ${fotoIdx || fotos.length} do imóvel`} loading="eager" decoding="async" />
              </div>
            )}
            {fotos.length > 1 && (
              <>
                <button
                  onClick={() => setFotoIdx((p) => (p - 1 + fotos.length) % fotos.length)}
                  aria-label="Foto anterior"
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-background/80 backdrop-blur flex items-center justify-center text-foreground hover:bg-background transition-colors shadow-lg"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setFotoIdx((p) => (p + 1) % fotos.length)}
                  aria-label="Próxima foto"
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-background/80 backdrop-blur flex items-center justify-center text-foreground hover:bg-background transition-colors shadow-lg"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 rounded-full bg-background/70 backdrop-blur">
                  <div className="flex gap-1.5">
                    {fotos.slice(0, 8).map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setFotoIdx(i)}
                        aria-label={`Ir para foto ${i + 1}`}
                        className={`h-1.5 rounded-full transition-all ${i === fotoIdx ? "w-5 bg-primary" : "w-1.5 bg-foreground/40"}`}
                      />
                    ))}
                  </div>
                  <span className="text-[10px] font-medium text-foreground/80 tabular-nums">
                    {fotoIdx + 1}/{fotos.length}
                  </span>
                </div>
              </>
            )}
            {/* Badges */}
            <div className="absolute top-3 left-3 flex gap-1.5">
              <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold shadow-md ${imovel.operacao === "Venda" ? "bg-primary text-primary-foreground" : "bg-info text-info-foreground"}`}>
                {imovel.operacao}
              </span>
              {imovel.exclusivo && <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-success text-success-foreground shadow-md">Exclusivo</span>}
              {imovel.destaque && <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-warning text-warning-foreground shadow-md">Destaque</span>}
            </div>
          </motion.div>
        ) : (
          <div className="rounded-xl bg-muted aspect-[16/10] md:aspect-[16/9] flex items-center justify-center">
            <ImageOff className="w-16 h-16 text-muted-foreground opacity-30" />
          </div>
        )}


        {/* Thumbnails */}
        {fotos.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1 scroll-smooth snap-x">
            {fotos.map((url, i) => (
              <button
                key={i}
                onClick={() => setFotoIdx(i)}
                aria-label={`Ver foto ${i + 1}`}
                className={`flex-shrink-0 w-24 h-16 md:w-28 md:h-20 rounded-lg overflow-hidden border-2 transition-all snap-start ${i === fotoIdx ? "border-primary ring-2 ring-primary/20 opacity-100" : "border-transparent opacity-70 hover:opacity-100"}`}
              >
                <img src={url} alt={`Foto ${i + 1} do imóvel${imovel.titulo ? ` ${cleanTitulo(imovel.titulo)}` : ""}`} loading="lazy" decoding="async" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}



        {/* Info */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid md:grid-cols-3 gap-6">
          {/* Main */}
          <div className="md:col-span-2 space-y-5">
            <div>
              <h1 className="text-2xl font-bold text-foreground">{imovel.titulo}</h1>
              {local && (
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                  <MapPin className="w-4 h-4 flex-shrink-0" /> {local}
                </p>
              )}
            </div>

            {/* Stats */}
            <div className="flex flex-wrap gap-4">
              {[
                { icon: Bed, label: "Quartos", value: imovel.quartos },
                ...(imovel.suites > 0 ? [{ icon: DoorOpen, label: "Suítes", value: imovel.suites }] : []),
                { icon: Bath, label: "Banheiros", value: imovel.banheiros },
                { icon: Car, label: "Vagas", value: imovel.vagas },
                { icon: Maximize, label: "Área", value: `${imovel.area}m²` },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary text-sm">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                  <span className="text-foreground font-medium">{value}</span>
                  <span className="text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>

            {/* Tags */}
            {(imovel.aceita_permuta || imovel.aceita_financiamento || imovel.tem_escritura) && (
              <div className="flex flex-wrap gap-2">
                {imovel.aceita_permuta && <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-accent text-accent-foreground">Aceita Permuta</span>}
                {imovel.aceita_financiamento && <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-accent text-accent-foreground">Aceita Financiamento</span>}
                {imovel.tem_escritura && <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-accent text-accent-foreground">Possui Escritura</span>}
              </div>
            )}

            {/* Description */}
            {imovel.descricao && (
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-3">Descrição</h2>
                <p className="text-base text-muted-foreground whitespace-pre-line leading-relaxed">{imovel.descricao}</p>
              </div>
            )}

            {/* Extra details */}
            {(imovel.andar || imovel.posicao_solar) && (
              <div className="grid grid-cols-2 gap-3">
                {imovel.andar && (
                  <div className="px-3 py-2 rounded-lg bg-secondary">
                    <p className="text-xs text-muted-foreground">Andar</p>
                    <p className="text-sm font-medium text-foreground">{imovel.andar}</p>
                  </div>
                )}
                {imovel.posicao_solar && (
                  <div className="px-3 py-2 rounded-lg bg-secondary">
                    <p className="text-xs text-muted-foreground">Posição Solar</p>
                    <p className="text-sm font-medium text-foreground">{imovel.posicao_solar}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <p className="text-2xl font-bold text-primary">{formatPreco(imovel.preco, imovel.operacao)}</p>
              {imovel.valor_condominio > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Condomínio</span>
                  <span className="text-foreground font-medium">{formatCurrency(imovel.valor_condominio)}</span>
                </div>
              )}
              {imovel.valor_iptu > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">IPTU</span>
                  <span className="text-foreground font-medium">{formatCurrency(imovel.valor_iptu)}</span>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-border bg-card p-5 space-y-2">
              <p className="text-xs text-muted-foreground">Tipo</p>
              <p className="text-sm font-medium text-foreground">{imovel.tipo}</p>
              <p className="text-xs text-muted-foreground pt-1">Status</p>
              <p className="text-sm font-medium text-foreground">{imovel.status}</p>
            </div>

            {/* Share buttons */}
            {(() => {
              const publicUrl = id ? getOgShareUrl(id) : getShareUrl(`/imovel/${id}`);
              const local2 = [imovel.bairro, imovel.cidade].filter(Boolean).join(", ");
              const cleanedTitulo = cleanTitulo(imovel.titulo, imovel.tipo || "Imóvel");
              const operacaoLabel = imovel.operacao === "Aluguel" ? "para alugar" : "à venda";
              const shareText = [
                `🏠 ${cleanedTitulo} ${operacaoLabel}${imovel.quartos > 0 ? ` com ${imovel.quartos} quartos` : ""}${local2 ? ` em ${local2}` : ""}`,
                `💰 ${formatPreco(imovel.preco, imovel.operacao)}`,
                imovel.quartos > 0 ? `🛏 ${imovel.quartos} quartos` : null,
                imovel.area > 0 ? `📐 ${imovel.area}m²` : null,
                local2 ? `📍 ${local2.toUpperCase()}` : null,
                publicUrl,
              ].filter(Boolean).join("\n");
              const shareTextPlain = shareText;

              return (
                <div className="rounded-xl border border-border bg-card p-5 space-y-3">
                  <p className="text-xs font-semibold text-foreground">Compartilhar</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" size="sm" className="gap-2 justify-start" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank")}>
                      <MessageCircle className="w-4 h-4 text-green-500" /> WhatsApp
                    </Button>
                    <Button variant="outline" size="sm" className="gap-2 justify-start" onClick={() => window.open(`https://web.whatsapp.com/send?text=${encodeURIComponent(shareText)}`, "_blank")}>
                      <MessageCircle className="w-4 h-4 text-green-600" /> WhatsApp Web
                    </Button>
                    <Button variant="outline" size="sm" className="gap-2 justify-start" onClick={() => window.open(`https://t.me/share/url?url=${encodeURIComponent(publicUrl)}&text=${encodeURIComponent(shareTextPlain)}`, "_blank")}>
                      <Send className="w-4 h-4 text-blue-400" /> Telegram
                    </Button>
                    <Button variant="outline" size="sm" className="gap-2 justify-start" onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?quote=${encodeURIComponent(shareTextPlain)}&u=${encodeURIComponent(publicUrl)}`, "_blank")}>
                      <Facebook className="w-4 h-4 text-blue-500" /> Facebook
                    </Button>
                    <Button variant="outline" size="sm" className="gap-2 justify-start" onClick={async () => { await navigator.clipboard.writeText(shareTextPlain); toast({ title: "Texto copiado!", description: "Cole no Instagram ao criar seu post." }); window.open("https://www.instagram.com/", "_blank"); }}>
                      <Instagram className="w-4 h-4 text-pink-500" /> Instagram
                    </Button>
                    <Button variant="outline" size="sm" className="gap-2 justify-start" onClick={() => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareTextPlain)}`, "_blank")}>
                      <Twitter className="w-4 h-4" /> Twitter / X
                    </Button>
                    <Button variant="outline" size="sm" className="gap-2 justify-start" onClick={() => window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(publicUrl)}`, "_blank")}>
                      <Linkedin className="w-4 h-4 text-blue-700" /> LinkedIn
                    </Button>
                    <Button variant="outline" size="sm" className="gap-2 justify-start" onClick={async () => { await navigator.clipboard.writeText(shareTextPlain); toast({ title: "Texto copiado!", description: "Cole no TikTok ao criar seu vídeo." }); window.open("https://www.tiktok.com/upload", "_blank"); }}>
                      <Music className="w-4 h-4" /> TikTok
                    </Button>
                  </div>
                  <Button variant="ghost" size="sm" className="w-full gap-2" onClick={async () => { await navigator.clipboard.writeText(shareTextPlain); toast({ title: "Texto copiado!" }); }}>
                    <Copy className="w-4 h-4" /> Copiar texto do anúncio
                  </Button>
                </div>
              );
            })()}

            {/* CTA Lead Capture */}
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-5">
              <p className="text-sm text-muted-foreground mb-3">Gostou deste imóvel?</p>
              <Button className="w-full" onClick={() => setShowCapture(true)}>
                Tenho interesse
              </Button>
            </div>
          </div>
        </motion.div>
      </main>

      <LeadCaptureDialog
        open={showCapture}
        onOpenChange={setShowCapture}
        imovel={imovel}
      />
    </div>
  );
};

export default ImovelPublico;
