import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { homogeneizar, FATORES_DEFAULT, valorBase, type ComparavelInput, type FatoresHomogeneizacao } from "@/lib/avaliacao/engine";

interface Props {
  comparaveis: ComparavelInput[];
  fatores: Record<string, FatoresHomogeneizacao>;
  onChange: (next: Record<string, FatoresHomogeneizacao>) => void;
}

const FATOR_KEYS: Array<{ key: keyof FatoresHomogeneizacao; label: string }> = [
  { key: "localizacao", label: "Localização" },
  { key: "area", label: "Área" },
  { key: "conservacao", label: "Conservação" },
  { key: "padrao", label: "Padrão" },
  { key: "idade", label: "Idade" },
  { key: "garagem", label: "Garagem" },
  { key: "infraestrutura", label: "Infraestrutura" },
  { key: "vista", label: "Vista" },
  { key: "liquidez", label: "Liquidez" },
  { key: "outros", label: "Outros" },
];

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

/** Input que aceita ajuste percentual (-20 = -20%) e converte para multiplicador. */
function PctInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const pct = ((value || 1) - 1) * 100;
  return (
    <div className="relative">
      <Input
        inputMode="decimal"
        value={pct === 0 ? "0" : pct.toFixed(1).replace(/\.0$/, "")}
        onChange={(e) => {
          const raw = e.target.value.replace(",", ".");
          const num = parseFloat(raw);
          onChange(isNaN(num) ? 1 : 1 + num / 100);
        }}
        className="h-8 text-xs pr-6"
      />
      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">%</span>
    </div>
  );
}

export function Step3Homogeneizacao({ comparaveis, fatores, onChange }: Props) {
  const safeFatores = useMemo(() => {
    const next: Record<string, FatoresHomogeneizacao> = {};
    comparaveis.forEach((c) => {
      next[c.id] = fatores[c.id] ?? { ...FATORES_DEFAULT };
    });
    return next;
  }, [comparaveis, fatores]);

  const updateFator = (id: string, key: keyof FatoresHomogeneizacao, v: number) => {
    const cur = safeFatores[id] ?? { ...FATORES_DEFAULT };
    onChange({ ...fatores, [id]: { ...cur, [key]: v } });
  };

  if (comparaveis.length === 0) {
    return <p className="text-sm text-muted-foreground italic">Adicione comparáveis na etapa anterior.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground">
        Ajuste percentual aplicado a cada comparável. <strong>0% = neutro</strong>, <strong>+10%</strong> aumenta o
        valor do comparável em 10% para refletir vantagem do avaliando.
      </div>

      <div className="space-y-3">
        {comparaveis.map((c, i) => {
          const fat = safeFatores[c.id];
          const h = homogeneizar(c, fat);
          const vb = valorBase(c);
          return (
            <Card key={c.id} className="border-border/60">
              <CardContent className="pt-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold text-sm">Comparável #{i + 1}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.endereco || c.bairro || "—"} · {c.area} m² · {fmt(vb)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline">Bruto {fmt(h.preco_m2_bruto)}/m²</Badge>
                    <Badge>Hom. {fmt(h.preco_m2_homogeneizado)}/m²</Badge>
                    <Badge variant="secondary">Fator total {h.fator_total.toFixed(3)}</Badge>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                  {FATOR_KEYS.map(({ key, label }) => (
                    <div key={key} className="space-y-1">
                      <Label className="text-[11px]">{label}</Label>
                      <PctInput value={fat[key]} onChange={(v) => updateFator(c.id, key, v)} />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
