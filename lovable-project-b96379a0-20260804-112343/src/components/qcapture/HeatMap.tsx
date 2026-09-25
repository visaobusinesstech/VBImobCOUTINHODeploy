import { useMemo } from "react";
import { motion } from "framer-motion";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { AnaliseRegional } from "@/lib/qcaptureEngine";

interface HeatMapProps {
  regioes: AnaliseRegional[];
}

function getColor(oportunidade: string, liquidez: number): string {
  if (oportunidade === "alta") return `hsl(142 71% ${Math.max(30, 55 - liquidez * 0.2)}%)`;
  if (oportunidade === "moderada") return `hsl(45 93% ${Math.max(35, 52 - liquidez * 0.1)}%)`;
  return `hsl(0 84% ${Math.max(35, 55 - liquidez * 0.1)}%)`;
}

function getBgOpacity(oportunidade: string): number {
  return oportunidade === "alta" ? 0.9 : oportunidade === "moderada" ? 0.75 : 0.6;
}

export function HeatMap({ regioes }: HeatMapProps) {
  const gridItems = useMemo(() => {
    if (regioes.length === 0) return [];

    const maxOfertas = Math.max(...regioes.map(r => r.totalOfertas), 1);

    return regioes.map((r) => ({
      ...r,
      size: Math.max(40, Math.min(100, (r.totalOfertas / maxOfertas) * 100)),
      color: getColor(r.oportunidade, r.indiceLiquidez),
      opacity: getBgOpacity(r.oportunidade),
    }));
  }, [regioes]);

  if (gridItems.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        Cadastre imóveis com bairro para visualizar o mapa de calor.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: "hsl(142 71% 45%)" }} />
          Alta oportunidade
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: "hsl(45 93% 47%)" }} />
          Moderada
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: "hsl(0 84% 55%)" }} />
          Baixa
        </div>
        <div className="ml-auto text-[10px]">Tamanho = volume de ofertas</div>
      </div>

      {/* Heat Grid */}
      <TooltipProvider delayDuration={100}>
        <div className="flex flex-wrap gap-2 justify-center items-end min-h-[180px]">
          {gridItems.map((item, i) => (
            <Tooltip key={item.bairro}>
              <TooltipTrigger asChild>
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: i * 0.04, type: "spring", stiffness: 300, damping: 20 }}
                  className="relative rounded-lg cursor-pointer flex items-center justify-center text-white font-semibold transition-transform hover:scale-110 hover:z-10 shadow-md"
                  style={{
                    width: `${item.size}px`,
                    height: `${item.size}px`,
                    backgroundColor: item.color,
                    opacity: item.opacity,
                    fontSize: item.size > 60 ? "11px" : "9px",
                  }}
                >
                  <span className="text-center leading-tight px-1 truncate max-w-full drop-shadow-sm">
                    {item.bairro.length > 10 ? item.bairro.slice(0, 8) + "…" : item.bairro}
                  </span>

                  {/* Pulse for high opportunity */}
                  {item.oportunidade === "alta" && (
                    <motion.div
                      className="absolute inset-0 rounded-lg"
                      style={{ border: `2px solid ${item.color}` }}
                      animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0, 0.6] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    />
                  )}
                </motion.div>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs space-y-1 max-w-[200px]">
                <p className="font-bold text-sm">{item.bairro}</p>
                <p>Ofertas: <span className="font-semibold">{item.totalOfertas}</span></p>
                <p>R$/m² médio: <span className="font-semibold">{item.precoM2Medio.toLocaleString("pt-BR")}</span></p>
                <p>Liquidez: <span className="font-semibold">{item.indiceLiquidez}%</span></p>
                <p>Saturação: <span className="font-semibold">{item.indiceSaturacao}%</span></p>
                <p>Vacância: <span className="font-semibold">{item.indiceVacancia}%</span></p>
                <p className="pt-1 font-bold capitalize" style={{ color: item.color }}>
                  Oportunidade {item.oportunidade}
                </p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </TooltipProvider>
    </div>
  );
}
