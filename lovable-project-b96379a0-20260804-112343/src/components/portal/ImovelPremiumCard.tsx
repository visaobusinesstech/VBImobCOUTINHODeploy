import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { MapPin, Bed, Bath, Car, Maximize, Building2, Globe, ExternalLink, Sparkles, ArrowRight, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const formatPreco = (preco: number, operacao: string) => {
  const formatted = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(preco || 0);
  return operacao === "Aluguel" ? `${formatted}/mês` : formatted;
};

const formatPrecoM2 = (preco: number, area: number) => {
  if (!preco || !area) return null;
  const v = Math.round(preco / area);
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
};

interface PremiumCardProps {
  imovel: any;
  variant: "meus" | "captacao";
  onInteresse?: (im: any) => void;
}

export function ImovelPremiumCard({ imovel, variant, onInteresse }: PremiumCardProps) {
  const isCaptacao = variant === "captacao";
  const foto = imovel.fotos?.[0];
  const fotosExtras = (imovel.fotos ?? []).slice(1, 4);
  const precoM2 = formatPrecoM2(imovel.preco, imovel.area);

  const handleCardClick = () => {
    if (isCaptacao && imovel.url_anuncio) {
      window.open(imovel.url_anuncio, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="group relative"
    >
      {/* Glow border */}
      <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-primary/40 via-blue-500/20 to-amber-400/30 opacity-0 group-hover:opacity-100 blur-sm transition-opacity duration-500 pointer-events-none" />

      <div
        className={`relative rounded-2xl overflow-hidden bg-card border border-border/60 shadow-[0_4px_24px_-8px_rgba(15,23,42,0.15)] hover:shadow-[0_24px_60px_-20px_rgba(15,23,42,0.35)] transition-all duration-500 ${isCaptacao && imovel.url_anuncio ? "cursor-pointer" : ""}`}
        onClick={isCaptacao ? handleCardClick : undefined}
      >
        {/* Premium ribbon */}
        <div className="absolute top-0 right-0 z-20">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-bl-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 text-slate-900 text-[10px] font-bold tracking-wider uppercase shadow-lg">
            <Sparkles className="w-3 h-3" />
            Premium
          </div>
        </div>

        {/* Hero image / gallery split */}
        <div className="relative grid grid-cols-4 grid-rows-2 gap-1 h-72 bg-muted">
          <div className="col-span-4 md:col-span-3 row-span-2 relative overflow-hidden">
            {foto ? (
              <img
                src={foto}
                alt={imovel.titulo}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover object-center transition-transform duration-[900ms] group-hover:scale-110"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900">
                {isCaptacao ? (
                  <Globe className="w-14 h-14 text-muted-foreground/40" />
                ) : (
                  <Building2 className="w-14 h-14 text-muted-foreground/40" />
                )}
              </div>
            )}
            {/* Cinematic overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/10 to-transparent pointer-events-none" />

            {/* Top badges */}
            <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
              {imovel.operacao && (
                <Badge className={`shadow-md ${imovel.operacao === "Venda" ? "bg-primary text-primary-foreground" : "bg-blue-500 text-white"}`}>
                  {imovel.operacao}
                </Badge>
              )}
              {imovel.exclusivo && (
                <Badge className="bg-emerald-600 text-white shadow-md gap-1">
                  <Star className="w-3 h-3 fill-current" /> Exclusivo
                </Badge>
              )}
              {isCaptacao && imovel.portal && (
                <Badge variant="secondary" className="backdrop-blur bg-white/85 dark:bg-slate-800/85 text-foreground">
                  {imovel.portal}
                </Badge>
              )}
            </div>

            {/* Bottom info on image */}
            <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
              <h3 className="font-serif text-xl md:text-2xl font-semibold leading-tight line-clamp-2 drop-shadow-md">
                {imovel.titulo}
              </h3>
              {(imovel.bairro || imovel.cidade) && (
                <p className="flex items-center gap-1.5 text-sm text-white/85 mt-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {[imovel.bairro, imovel.cidade].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>
          </div>

          {/* Right thumbnail column - desktop */}
          <div className="hidden md:flex col-span-1 row-span-2 flex-col gap-1">
            {[0, 1].map((idx) => {
              const f = fotosExtras[idx];
              return (
                <div key={idx} className="flex-1 relative overflow-hidden bg-muted">
                  {f ? (
                    <img src={f} alt="" loading="lazy" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900">
                      <Building2 className="w-6 h-6 text-muted-foreground/30" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div className="p-5 md:p-6 space-y-5">
          {/* Price row */}
          <div className="flex items-end justify-between gap-3 pb-4 border-b border-dashed border-border/70">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
                {imovel.operacao === "Aluguel" ? "Valor mensal" : "Valor de venda"}
              </p>
              <p className="font-serif text-3xl md:text-4xl font-bold text-foreground leading-none mt-1">
                {imovel.preco > 0 ? formatPreco(imovel.preco, imovel.operacao || "Venda") : "Sob consulta"}
              </p>
              {precoM2 && (
                <p className="text-xs text-muted-foreground mt-1.5">
                  {precoM2}/m² · área privativa
                </p>
              )}
            </div>
            {imovel.tipo && (
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">Tipo</p>
                <p className="text-sm font-semibold text-foreground mt-1">{imovel.tipo}</p>
              </div>
            )}
          </div>

          {/* Feature grid */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { icon: Bed, label: "Quartos", value: imovel.quartos },
              { icon: Bath, label: "Banheiros", value: imovel.banheiros },
              { icon: Car, label: "Vagas", value: imovel.vagas },
              { icon: Maximize, label: "Área", value: imovel.area ? `${imovel.area}m²` : null },
            ].map(({ icon: Icon, label, value }) => (
              <div
                key={label}
                className="flex flex-col items-center justify-center gap-1 py-3 rounded-xl bg-muted/40 border border-border/50"
              >
                <Icon className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-foreground leading-none">
                  {value && value !== 0 ? value : "—"}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="flex gap-2 pt-1">
            {isCaptacao ? (
              imovel.url_anuncio ? (
                <Button
                  className="w-full gap-2 bg-gradient-to-r from-slate-900 to-slate-700 hover:opacity-90 text-white"
                  onClick={(e) => { e.stopPropagation(); handleCardClick(); }}
                >
                  <ExternalLink className="w-4 h-4" />
                  Abrir anúncio original
                </Button>
              ) : (
                <Button variant="outline" className="w-full" disabled>
                  Anúncio indisponível
                </Button>
              )
            ) : (
              <>
                <Link to={`/imovel/${imovel.id}`} className="flex-1">
                  <Button variant="outline" className="w-full gap-1.5">
                    Ver detalhes <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </Link>
                <Button
                  className="flex-1 bg-gradient-to-r from-primary to-blue-600 hover:opacity-90"
                  onClick={() => onInteresse?.(imovel)}
                >
                  Tenho interesse
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </motion.article>
  );
}
