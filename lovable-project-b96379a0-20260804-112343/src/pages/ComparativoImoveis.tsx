import { useState, useMemo } from "react";
import { Seo } from "@/components/Seo";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useImoveis, type Imovel } from "@/hooks/useImoveis";
import {
  ArrowLeftRight,
  Plus,
  X,
  Bed,
  Bath,
  Car,
  Maximize,
  MapPin,
  Check,
  Minus,
  DollarSign,
  Loader2,
  Building2,
  Share2,
  ImageOff,
  FileDown,
} from "lucide-react";
import { useImobiliariaConfig } from "@/hooks/useImobiliariaConfig";
import { exportComparativoPDF } from "@/lib/exportComparativoPDF";

const formatCurrency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const MAX_COMPARE = 4;

function getBestIndex(values: (string | number | boolean | null | undefined)[], type: string, highlight?: "max" | "min"): number {
  if (!highlight) return -1;
  const nums = values.map(v => (v != null ? Number(v) : NaN));
  const validNums = nums.filter(n => !isNaN(n));
  if (validNums.length === 0) return -1;
  const target = highlight === "max" ? Math.max(...validNums) : Math.min(...validNums);
  return nums.findIndex(n => n === target);
}

function CompareRow({ label, values, type = "text", highlight }: { label: string; values: (string | number | boolean | null | undefined)[]; type?: "text" | "currency" | "boolean" | "area"; highlight?: "max" | "min" }) {
  const bestIdx = getBestIndex(values, type, highlight);
  return (
    <div className="grid border-b border-border" style={{ gridTemplateColumns: `180px repeat(${values.length}, 1fr)` }}>
      <div className="px-4 py-3 bg-muted/50 text-sm font-medium text-muted-foreground flex items-center">
        {label}
      </div>
      {values.map((val, i) => {
        const isBest = bestIdx === i && highlight;
        return (
          <div key={i} className={`px-4 py-3 text-sm flex items-center justify-center text-center transition-colors ${isBest ? "bg-primary/5 text-primary font-bold" : "text-foreground"}`}>
            {type === "boolean" ? (
              val ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Minus className="h-4 w-4 text-muted-foreground/40" />
              )
            ) : type === "currency" ? (
              <span className={isBest ? "font-bold" : "font-semibold"}>{val ? formatCurrency(Number(val)) : "—"}{isBest && " ✦"}</span>
            ) : type === "area" ? (
              <span>{val ? `${val} m²` : "—"}{isBest ? " ✦" : ""}</span>
            ) : (
              <span>{val || "—"}{isBest ? " ✦" : ""}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ScoreCard({ imovel }: { imovel: Imovel }) {
  const score = Math.min(100, Math.round(
    (imovel.quartos * 8) +
    (imovel.suites * 6) +
    (imovel.banheiros * 5) +
    (imovel.vagas * 7) +
    (imovel.area > 100 ? 15 : imovel.area > 60 ? 10 : 5) +
    (imovel.aceita_financiamento ? 10 : 0) +
    ((imovel as any).aceita_fgts ? 8 : 0) +
    (imovel.exclusivo ? 5 : 0) +
    (imovel.tem_escritura ? 10 : 0)
  ));
  const color = score >= 70 ? "text-green-500" : score >= 40 ? "text-yellow-500" : "text-red-500";
  return (
    <div className="flex items-center gap-1.5">
      <span className={`text-lg font-bold ${color}`}>{score}</span>
      <span className="text-[10px] text-muted-foreground">/100</span>
    </div>
  );
}

export default function ComparativoImoveis() {
  const { imoveis, loading } = useImoveis();
  const imobiliariaConfig = useImobiliariaConfig();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectorOpen, setSelectorOpen] = useState(false);

  const selected = useMemo(
    () => selectedIds.map((id) => imoveis.find((i) => i.id === id)).filter(Boolean) as Imovel[],
    [selectedIds, imoveis]
  );

  const available = useMemo(
    () => imoveis.filter((i) => i.status === "Ativo" && !selectedIds.includes(i.id)),
    [imoveis, selectedIds]
  );

  const addImovel = (id: string) => {
    if (selectedIds.length < MAX_COMPARE && !selectedIds.includes(id)) {
      setSelectedIds((prev) => [...prev, id]);
    }
  };

  const removeImovel = (id: string) => {
    setSelectedIds((prev) => prev.filter((x) => x !== id));
  };

  const getPhotoUrl = (imovel: Imovel) => {
    const idx = (imovel as any).foto_capa_index ?? 0;
    return imovel.fotos?.[idx] || imovel.fotos?.[0] || null;
  };

  const handleShare = async () => {
    if (selected.length < 2) return;
    const text = selected
      .map(
        (im, i) =>
          `*${i + 1}. ${im.titulo}*\n📍 ${im.bairro || "—"}, ${im.cidade || "—"}\n💰 ${formatCurrency(im.preco)}\n🛏 ${im.quartos}q | 🚿 ${im.banheiros}b | 🚗 ${im.vagas}v | 📐 ${im.area}m²`
      )
      .join("\n\n");
    const msg = `📊 *Comparativo de Imóveis*\n\n${text}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <Seo title="Comparativo de imóveis — radarimobtech" description="Compare até 4 imóveis lado a lado: preço, área, quartos, condomínio, IPTU e score de oportunidade." path="/comparativo" noindex />
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <ArrowLeftRight className="h-6 w-6 text-primary" />
              Comparativo de Imóveis
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Selecione até {MAX_COMPARE} imóveis para comparar lado a lado
            </p>
          </div>
          <div className="flex items-center gap-2">
            {selected.length >= 2 && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportComparativoPDF({ imoveis: selected, brandName: imobiliariaConfig.nome_empresa })}
                  className="gap-2"
                >
                  <FileDown className="h-4 w-4" />
                  Exportar PDF
                </Button>
                <Button variant="outline" size="sm" onClick={handleShare} className="gap-2">
                  <Share2 className="h-4 w-4" />
                  Compartilhar via WhatsApp
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Selector Cards */}
        <div className={`grid gap-4`} style={{ gridTemplateColumns: `repeat(${MAX_COMPARE}, 1fr)` }}>
          {Array.from({ length: MAX_COMPARE }).map((_, idx) => {
            const imovel = selected[idx];
            if (imovel) {
              const photo = getPhotoUrl(imovel);
              return (
                <Card key={imovel.id} className="bg-card border-border overflow-hidden relative group">
                  <button
                    onClick={() => removeImovel(imovel.id)}
                    className="absolute top-2 right-2 z-10 p-1 rounded-full bg-destructive/90 text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                  <div className="aspect-[4/3] bg-muted relative">
                    {photo ? (
                      <img src={photo} alt={imovel.titulo} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageOff className="h-8 w-8 text-muted-foreground/30" />
                      </div>
                    )}
                    <Badge className="absolute bottom-2 left-2 bg-primary/90 text-primary-foreground text-xs">
                      {imovel.operacao}
                    </Badge>
                  </div>
                  <CardContent className="p-3">
                    <p className="font-semibold text-foreground text-sm truncate">{imovel.titulo}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <MapPin className="h-3 w-3" />
                      {imovel.bairro || imovel.cidade || "—"}
                    </p>
                    <p className="text-sm font-bold text-primary mt-1">
                      {formatCurrency(imovel.preco)}
                    </p>
                  </CardContent>
                </Card>
              );
            }

            return (
              <Card
                key={`empty-${idx}`}
                className="bg-card border-border border-dashed flex items-center justify-center cursor-pointer hover:border-primary/50 transition-colors min-h-[200px]"
                onClick={() => setSelectorOpen(true)}
              >
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Plus className="h-8 w-8" />
                  <span className="text-xs">Adicionar imóvel</span>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Selector dropdown */}
        {selectorOpen && (
          <Card className="bg-card border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground">Selecione um imóvel</h3>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectorOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            {available.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhum imóvel disponível para adicionar.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[300px] overflow-y-auto">
                {available.map((im) => (
                  <button
                    key={im.id}
                    onClick={() => {
                      addImovel(im.id);
                      if (selectedIds.length + 1 >= MAX_COMPARE) setSelectorOpen(false);
                    }}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent text-left transition-colors"
                  >
                    <div className="w-12 h-12 rounded-md bg-muted overflow-hidden flex-shrink-0">
                      {im.fotos?.[0] ? (
                        <img src={im.fotos[0]} alt={`Foto de ${im.titulo || im.tipo || "imóvel"}`} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Building2 className="h-4 w-4 text-muted-foreground/30" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{im.titulo}</p>
                      <p className="text-xs text-muted-foreground">{im.tipo} • {formatCurrency(im.preco)}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* Comparison Table */}
        {selected.length >= 2 && (
          <Card className="bg-card border-border overflow-hidden">
            <div className="overflow-x-auto">
              {/* Score Row */}
              <div className="grid border-b-2 border-primary/20" style={{ gridTemplateColumns: `180px repeat(${selected.length}, 1fr)` }}>
                <div className="px-4 py-3 bg-primary/5 text-sm font-bold text-primary flex items-center">
                  ⭐ Score
                </div>
                {selected.map((im) => (
                  <div key={im.id} className="px-4 py-3 flex items-center justify-center bg-primary/5">
                    <ScoreCard imovel={im} />
                  </div>
                ))}
              </div>
              <CompareRow label="Tipo" values={selected.map((i) => i.tipo)} />
              <CompareRow label="Operação" values={selected.map((i) => i.operacao)} />
              <CompareRow label="Preço" values={selected.map((i) => i.preco)} type="currency" highlight="min" />
              <CompareRow label="Área" values={selected.map((i) => i.area)} type="area" highlight="max" />
              <CompareRow label="Preço/m²" values={selected.map((i) => i.area > 0 ? Math.round(i.preco / i.area) : null)} type="currency" highlight="min" />
              <CompareRow label="Quartos" values={selected.map((i) => i.quartos)} highlight="max" />
              <CompareRow label="Suítes" values={selected.map((i) => i.suites)} highlight="max" />
              <CompareRow label="Banheiros" values={selected.map((i) => i.banheiros)} highlight="max" />
              <CompareRow label="Vagas" values={selected.map((i) => i.vagas)} highlight="max" />
              <CompareRow label="Andar" values={selected.map((i) => (i as any).andar)} />
              <CompareRow label="Posição Solar" values={selected.map((i) => (i as any).posicao_solar)} />
              <CompareRow label="Bairro" values={selected.map((i) => i.bairro)} />
              <CompareRow label="Cidade" values={selected.map((i) => i.cidade)} />
              <CompareRow label="Condomínio" values={selected.map((i) => i.valor_condominio)} type="currency" highlight="min" />
              <CompareRow label="IPTU" values={selected.map((i) => i.valor_iptu)} type="currency" highlight="min" />
              <CompareRow label="Custo Total/mês" values={selected.map((i) => {
                if (i.operacao !== "Aluguel") return null;
                return i.preco + (i.valor_condominio || 0) + (i.valor_iptu || 0);
              })} type="currency" highlight="min" />
              <CompareRow label="Aceita Financiamento" values={selected.map((i) => i.aceita_financiamento)} type="boolean" />
              <CompareRow label="Aceita FGTS" values={selected.map((i) => (i as any).aceita_fgts)} type="boolean" />
              <CompareRow label="Aceita Permuta" values={selected.map((i) => i.aceita_permuta)} type="boolean" />
              <CompareRow label="Tem Escritura" values={selected.map((i) => i.tem_escritura)} type="boolean" />
              <CompareRow label="Exclusivo" values={selected.map((i) => i.exclusivo)} type="boolean" />
              {/* Legend */}
              <div className="px-4 py-2 bg-muted/30 text-xs text-muted-foreground flex items-center gap-2" style={{ gridColumn: `1 / -1` }}>
                <span className="text-primary font-semibold">✦</span> = Melhor valor na comparação
              </div>
            </div>
          </Card>
        )}

        {selected.length < 2 && (
          <div className="text-center py-12 text-muted-foreground">
            <ArrowLeftRight className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Selecione pelo menos 2 imóveis para iniciar a comparação</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
