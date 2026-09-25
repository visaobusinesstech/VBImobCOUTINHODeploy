import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Settings2, RotateCcw, Save } from "lucide-react";
import {
  useMotivacaoConfig,
  useSalvarMotivacaoConfig,
  MOTIVACAO_CONFIG_PADRAO,
  type MotivacaoConfig,
} from "@/hooks/useMotivacaoConfig";

type Draft = Omit<MotivacaoConfig, "imobiliaria_id">;

function num(v: string, fallback: number) {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
}

export function MotivacaoConfigDialog() {
  const [open, setOpen] = useState(false);
  const { data: cfg } = useMotivacaoConfig();
  const salvar = useSalvarMotivacaoConfig();
  const [draft, setDraft] = useState<Draft>({ ...MOTIVACAO_CONFIG_PADRAO });

  useEffect(() => {
    if (cfg) {
      const { imobiliaria_id: _i, ...rest } = cfg;
      setDraft(rest);
    }
  }, [cfg, open]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const invalidLevels =
    draft.nivel_morno_min >= draft.nivel_quente_min ||
    draft.nivel_quente_min >= draft.nivel_fervendo_min;
  const invalidDias =
    draft.dias_tier1 >= draft.dias_tier2 || draft.dias_tier2 >= draft.dias_tier3;
  const invalidQueda = draft.queda_tier1 >= draft.queda_tier2;
  const invalid = invalidLevels || invalidDias || invalidQueda;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Settings2 className="w-3.5 h-3.5" /> Critérios do score
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurar critérios de Frio / Morno / Quente / Fervendo</DialogTitle>
          <DialogDescription>
            Ajuste os limites que compõem o score. Ao salvar, todos os proprietários são recalculados automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <section>
            <h4 className="text-sm font-semibold mb-2">⏱ Dias no mercado (peso alto)</h4>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Faixa 1 (dias)" value={draft.dias_tier1} onChange={(v) => set("dias_tier1", num(v, 60))} />
              <Field label="Faixa 2 (dias)" value={draft.dias_tier2} onChange={(v) => set("dias_tier2", num(v, 90))} />
              <Field label="Faixa 3 (dias)" value={draft.dias_tier3} onChange={(v) => set("dias_tier3", num(v, 180))} />
              <Field label="Bônus faixa 1" value={draft.bonus_tempo_tier1} onChange={(v) => set("bonus_tempo_tier1", num(v, 10))} />
              <Field label="Bônus faixa 2" value={draft.bonus_tempo_tier2} onChange={(v) => set("bonus_tempo_tier2", num(v, 25))} />
              <Field label="Bônus faixa 3" value={draft.bonus_tempo_tier3} onChange={(v) => set("bonus_tempo_tier3", num(v, 40))} />
            </div>
            {invalidDias && <p className="text-xs text-red-600 mt-1">Faixa 1 &lt; Faixa 2 &lt; Faixa 3.</p>}
          </section>

          <Separator />

          <section>
            <h4 className="text-sm font-semibold mb-2">📉 Queda de preço (%)</h4>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Queda mínima faixa 1 (%)" value={draft.queda_tier1} onChange={(v) => set("queda_tier1", num(v, 5))} step={0.5} />
              <Field label="Queda mínima faixa 2 (%)" value={draft.queda_tier2} onChange={(v) => set("queda_tier2", num(v, 10))} step={0.5} />
              <Field label="Bônus queda faixa 1" value={draft.bonus_queda_tier1} onChange={(v) => set("bonus_queda_tier1", num(v, 25))} />
              <Field label="Bônus queda faixa 2" value={draft.bonus_queda_tier2} onChange={(v) => set("bonus_queda_tier2", num(v, 35))} />
            </div>
            {invalidQueda && <p className="text-xs text-red-600 mt-1">Faixa 1 (%) deve ser menor que faixa 2.</p>}
          </section>

          <Separator />

          <section>
            <h4 className="text-sm font-semibold mb-2">🔁 Outros sinais</h4>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Bônus por republicação" value={draft.bonus_republicacao} onChange={(v) => set("bonus_republicacao", num(v, 20))} />
              <Field label="Bônus anúncio direto do dono (FSBO)" value={draft.bonus_fsbo} onChange={(v) => set("bonus_fsbo", num(v, 10))} />
            </div>
          </section>

          <Separator />

          <section>
            <h4 className="text-sm font-semibold mb-2">🎯 Limites de nível (score 0–100)</h4>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Morno a partir de" value={draft.nivel_morno_min} onChange={(v) => set("nivel_morno_min", num(v, 25))} />
              <Field label="Quente a partir de" value={draft.nivel_quente_min} onChange={(v) => set("nivel_quente_min", num(v, 50))} />
              <Field label="Fervendo a partir de" value={draft.nivel_fervendo_min} onChange={(v) => set("nivel_fervendo_min", num(v, 75))} />
            </div>
            {invalidLevels && <p className="text-xs text-red-600 mt-1">Morno &lt; Quente &lt; Fervendo.</p>}
          </section>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            className="gap-1.5"
            onClick={() => setDraft({ ...MOTIVACAO_CONFIG_PADRAO })}
          >
            <RotateCcw className="w-3.5 h-3.5" /> Restaurar padrão
          </Button>
          <Button
            className="gap-1.5"
            disabled={invalid || salvar.isPending}
            onClick={async () => {
              await salvar.mutateAsync(draft);
              setOpen(false);
            }}
          >
            <Save className="w-3.5 h-3.5" />
            {salvar.isPending ? "Salvando e recalculando…" : "Salvar e recalcular"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label, value, onChange, step = 1,
}: { label: string; value: number; onChange: (v: string) => void; step?: number }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        inputMode="decimal"
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
