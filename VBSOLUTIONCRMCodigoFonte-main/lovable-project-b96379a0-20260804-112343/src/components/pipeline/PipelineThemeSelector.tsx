import { useEffect, useState } from "react";
import { Check, Palette, RotateCcw, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";


export type PipelineTheme = "premium" | "suave" | "azul" | "claro";

const STORAGE_KEY = "pipeline:tema:v1";

const TEMAS: { id: PipelineTheme; label: string; descricao: string; swatches: string[] }[] = [
  { id: "premium", label: "Editorial Navy", descricao: "Marinho + dourado (forte)", swatches: ["#0B1B34", "#C9A96A", "#F7F3EC"] },
  { id: "suave", label: "Cinza Sereno", descricao: "Neutro e discreto", swatches: ["#334155", "#94A3B8", "#F1F5F9"] },
  { id: "azul", label: "Azul Corporativo", descricao: "Suave e profissional", swatches: ["#1E3A5F", "#3B82F6", "#E0F2FE"] },
  { id: "claro", label: "Claro Minimal", descricao: "Quase branco, sem cor forte", swatches: ["#0F172A", "#334155", "#FFFFFF"] },
];

export const PIPELINE_TEMAS = TEMAS;

function readOverride(): PipelineTheme | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY) as PipelineTheme | null;
    if (v && TEMAS.some((t) => t.id === v)) return v;
  } catch {}
  return null;
}

function isValidTheme(v: string | undefined | null): v is PipelineTheme {
  return !!v && TEMAS.some((t) => t.id === v);
}

/**
 * Hook do tema do pipeline com fallback em cascata:
 * 1. Override individual salvo no navegador (localStorage)
 * 2. Tema padrão da imobiliária (tenantDefault)
 * 3. "premium" como último fallback
 */
export function usePipelineTheme(tenantDefault?: string | null) {
  const [override, setOverride] = useState<PipelineTheme | null>(() => readOverride());

  const effectiveDefault: PipelineTheme = isValidTheme(tenantDefault) ? tenantDefault : "premium";
  const theme: PipelineTheme = override ?? effectiveDefault;

  const setTheme = (t: PipelineTheme) => {
    setOverride(t);
    try { localStorage.setItem(STORAGE_KEY, t); } catch {}
  };

  const resetToTenantDefault = () => {
    setOverride(null);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  };

  return {
    theme,
    setTheme,
    resetToTenantDefault,
    hasOverride: override !== null,
    tenantDefault: effectiveDefault,
    themeClass: theme === "premium" ? "" : `pipeline-theme-${theme}`,
  };
}

function ThemePreviewCard({
  theme,
  label,
  descricao,
  isSelected,
  isCurrent,
  isTenantDefault,
  onSelect,
}: {
  theme: PipelineTheme;
  label: string;
  descricao: string;
  isSelected: boolean;
  isCurrent: boolean;
  isTenantDefault: boolean;
  onSelect: () => void;
}) {
  const themeClass = theme === "premium" ? "pipeline-premium" : `pipeline-premium pipeline-theme-${theme}`;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`text-left rounded-xl border-2 overflow-hidden transition-all ${
        isSelected ? "border-primary ring-4 ring-primary/20 scale-[1.01]" : "border-border hover:border-primary/40"
      }`}
    >
      {/* Header do card com título + badges */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-foreground">{label}</span>
          {isTenantDefault && (
            <span className="text-[8px] font-bold tracking-wider uppercase text-[color:var(--pp-gold-2,#B08E4C)] border border-current rounded px-1 py-[1px]">
              Padrão
            </span>
          )}
          {isCurrent && (
            <span className="text-[8px] font-bold tracking-wider uppercase text-emerald-700 border border-emerald-600 rounded px-1 py-[1px]">
              Atual
            </span>
          )}
        </div>
        {isSelected && <Check className="w-4 h-4 text-primary" />}
      </div>

      {/* Preview real do pipeline */}
      <div className={themeClass}>
        <div
          className="p-3 min-h-[220px]"
          style={{ background: "var(--pp-bg)" }}
        >
          {/* mini toolbar */}
          <div className="flex items-center gap-1.5 mb-3">
            <span className="pp-btn pp-btn-primary text-[9px] px-2 py-1">Novo Lead</span>
            <span className="pp-btn text-[9px] px-2 py-1">Filtros</span>
            <span className="pp-btn text-[9px] px-2 py-1">PDF</span>
          </div>

          {/* mini coluna kanban */}
          <div className="pp-column p-2 rounded-lg">
            <div className="pp-column-header text-[10px] font-bold tracking-widest uppercase px-2 py-1.5 rounded flex items-center justify-between mb-2">
              <span>Novos Leads</span>
              <span className="text-[9px] opacity-80">3</span>
            </div>

            {/* mini lead card */}
            <div className="pp-card p-2.5 rounded-md mb-1.5">
              <div className="flex items-center justify-between mb-1">
                <div className="text-[11px] font-semibold" style={{ color: "var(--pp-navy)" }}>Ana Souza</div>
                <span className="pp-chip text-[8px] px-1.5 py-0.5 rounded">Quente</span>
              </div>
              <div className="text-[9px]" style={{ color: "var(--pp-slate)" }}>Apto 3 quartos · Asa Sul</div>
              <div className="text-[11px] font-bold mt-1" style={{ color: "var(--pp-gold-2)", fontFamily: "'Playfair Display', serif" }}>
                R$ 850.000
              </div>
            </div>

            <div className="pp-card p-2.5 rounded-md">
              <div className="text-[11px] font-semibold" style={{ color: "var(--pp-navy)" }}>Carlos Mendes</div>
              <div className="text-[9px]" style={{ color: "var(--pp-slate)" }}>Casa · Lago Sul</div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-3 py-2 border-t border-border bg-background">
        <div className="text-[10px] text-muted-foreground">{descricao}</div>
      </div>
    </button>
  );
}

export function PipelineThemeSelector({
  value,
  onChange,
  tenantDefault,
  hasOverride,
  onResetToTenantDefault,
}: {
  value: PipelineTheme;
  onChange: (t: PipelineTheme) => void;
  tenantDefault?: PipelineTheme;
  hasOverride?: boolean;
  onResetToTenantDefault?: () => void;
}) {
  const atual = TEMAS.find((t) => t.id === value) ?? TEMAS[0];
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<PipelineTheme>(value);

  useEffect(() => {
    if (open) setPreview(value);
  }, [open, value]);

  const handleAplicar = () => {
    onChange(preview);
    setOpen(false);
  };

  const handleResetar = () => {
    onResetToTenantDefault?.();
    setOpen(false);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[11px] font-semibold tracking-wide bg-white/70 hover:bg-white transition-colors"
        style={{ borderColor: "var(--pp-line-strong, rgba(0,0,0,0.15))", color: "var(--pp-navy, #0B1B34)" }}
        aria-label="Escolher tema do pipeline"
      >
        <Palette className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Tema:</span> {atual.label}
        {hasOverride && <span className="text-[9px] font-bold text-[color:var(--pp-gold-2,#B08E4C)]">•</span>}
        <div className="flex gap-0.5 ml-1">
          {atual.swatches.map((c) => (
            <span key={c} className="w-2.5 h-2.5 rounded-full border border-black/10" style={{ background: c }} />
          ))}
        </div>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" /> Pré-visualização de tema
            </DialogTitle>
            <DialogDescription>
              Clique em um tema para pré-visualizar. A mudança só é aplicada ao clicar em <b>Aplicar tema</b>.
              {tenantDefault && (
                <> Padrão da imobiliária: <b>{TEMAS.find(t => t.id === tenantDefault)?.label}</b>.</>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
            {TEMAS.map((t) => (
              <ThemePreviewCard
                key={t.id}
                theme={t.id}
                label={t.label}
                descricao={t.descricao}
                isSelected={preview === t.id}
                isCurrent={value === t.id}
                isTenantDefault={t.id === tenantDefault}
                onSelect={() => setPreview(t.id)}
              />
            ))}
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:justify-between sm:items-center">
            <div>
              {hasOverride && onResetToTenantDefault && (
                <Button variant="ghost" size="sm" onClick={handleResetar} className="text-[11px]">
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                  Usar padrão da imobiliária
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button size="sm" onClick={handleAplicar} disabled={preview === value}>
                Aplicar tema
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

