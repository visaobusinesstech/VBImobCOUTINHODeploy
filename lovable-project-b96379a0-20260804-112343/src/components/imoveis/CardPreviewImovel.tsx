import { MapPin, Bed, Bath, Car, Maximize, ImageOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface CardPreviewImovelProps {
  form: Record<string, any>;
  previews: string[];
  existingFotos: string[];
}

const formatPreco = (value: string | number) => {
  const num = typeof value === "string" ? parseFloat(value.replace(/\./g, "").replace(",", ".")) : value;
  if (!num || isNaN(num)) return "R$ —";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(num);
};

export function CardPreviewImovel({ form, previews, existingFotos }: CardPreviewImovelProps) {
  const allPhotos = [...existingFotos, ...previews];
  const coverIndex = Math.min(form.foto_capa_index ?? 0, allPhotos.length - 1);
  const coverPhoto = allPhotos[Math.max(0, coverIndex)];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border bg-card overflow-hidden shadow-lg"
    >
      {/* Cover */}
      <div className="relative aspect-[16/10] bg-secondary">
        <AnimatePresence mode="wait">
          {coverPhoto ? (
            <motion.img
              key={coverPhoto}
              src={coverPhoto}
              alt="Preview"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full h-full object-cover"
            />
          ) : (
            <motion.div
              key="placeholder"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="w-full h-full flex flex-col items-center justify-center text-muted-foreground"
            >
              <ImageOff className="w-10 h-10 mb-2 opacity-30" />
              <span className="text-xs">Adicione fotos na etapa 3</span>
            </motion.div>
          )}
        </AnimatePresence>
        {allPhotos.length > 1 && (
          <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full">
            {allPhotos.length} fotos
          </div>
        )}
        {form.tipo && (
          <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-[10px] font-semibold px-2.5 py-1 rounded-full">
            {form.tipo}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4 space-y-3">
        <div>
          <h3 className="font-semibold text-foreground text-sm leading-tight truncate">
            {form.titulo || "Título do imóvel"}
          </h3>
          {(form.bairro || form.cidade) && (
            <div className="flex items-center gap-1 mt-1 text-muted-foreground">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              <span className="text-xs truncate">
                {[form.bairro, form.cidade, form.estado].filter(Boolean).join(", ")}
              </span>
            </div>
          )}
        </div>

        <div className="text-lg font-bold text-primary">
          {formatPreco(form.preco)}
          {form.operacao === "Aluguel" && <span className="text-xs font-normal text-muted-foreground">/mês</span>}
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {parseInt(form.quartos) > 0 && (
            <div className="flex items-center gap-1">
              <Bed className="w-3.5 h-3.5" />
              <span>{form.quartos}</span>
            </div>
          )}
          {parseInt(form.banheiros) > 0 && (
            <div className="flex items-center gap-1">
              <Bath className="w-3.5 h-3.5" />
              <span>{form.banheiros}</span>
            </div>
          )}
          {parseInt(form.vagas) > 0 && (
            <div className="flex items-center gap-1">
              <Car className="w-3.5 h-3.5" />
              <span>{form.vagas}</span>
            </div>
          )}
          {parseFloat(form.area) > 0 && (
            <div className="flex items-center gap-1">
              <Maximize className="w-3.5 h-3.5" />
              <span>{form.area}m²</span>
            </div>
          )}
        </div>

        {form.descricao && (
          <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
            {form.descricao}
          </p>
        )}
      </div>
    </motion.div>
  );
}
