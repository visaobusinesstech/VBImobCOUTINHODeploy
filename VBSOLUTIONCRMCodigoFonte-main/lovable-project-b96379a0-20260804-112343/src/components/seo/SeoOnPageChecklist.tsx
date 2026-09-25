import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, AlertTriangle, XCircle, Info } from "lucide-react";
import { computeSeoChecks, type CheckItem, type CheckStatus } from "@/lib/seoChecklist";

export type { CheckItem, CheckStatus };

interface Props {
  titulo: string;
  slug: string;
  meta: string;
  introducao?: string;
  conclusao?: string;
  secoes?: Array<{ titulo?: string; conteudo?: string }>;
  tags?: string[];
  palavraChavePrincipal?: string;
}

const STATUS_META: Record<CheckStatus, { icon: any; color: string; label: string; score: number }> = {
  ok: { icon: CheckCircle2, color: "text-emerald-600", label: "OK", score: 1 },
  alerta: { icon: AlertTriangle, color: "text-amber-600", label: "Alerta", score: 0.5 },
  critico: { icon: XCircle, color: "text-red-600", label: "Crítico", score: 0 },
};

export function SeoOnPageChecklist({
  titulo, slug, meta, introducao = "", conclusao = "", secoes = [], tags = [], palavraChavePrincipal: kwInicial,
}: Props) {
  const [kw, setKw] = useState(kwInicial || (tags?.[0] ?? ""));

  const checks = useMemo<CheckItem[]>(
    () => computeSeoChecks({ titulo, slug, meta, introducao, conclusao, secoes, tags, palavraChavePrincipal: kw }),
    [titulo, slug, meta, introducao, conclusao, secoes, tags, kw]
  );

  const { score, contagem } = useMemo(() => {
    const somaPeso = checks.reduce((a, c) => a + c.peso, 0);
    const somaObtida = checks.reduce((a, c) => a + c.peso * STATUS_META[c.status].score, 0);
    const s = somaPeso > 0 ? Math.round((somaObtida / somaPeso) * 100) : 0;
    const cont = checks.reduce(
      (acc, c) => ({ ...acc, [c.status]: (acc as any)[c.status] + 1 }),
      { ok: 0, alerta: 0, critico: 0 } as Record<CheckStatus, number>
    );
    return { score: s, contagem: cont };
  }, [checks]);

  const scoreColor = score >= 85 ? "text-emerald-600" : score >= 60 ? "text-amber-600" : "text-red-600";
  const scoreLabel = score >= 85 ? "Pronto para publicar" : score >= 60 ? "Publicável com ajustes" : "Ajustes críticos necessários";

  const categorias = Array.from(new Set(checks.map((c) => c.categoria)));

  return (
    <div className="space-y-4">
      {/* Score header */}
      <div className="rounded-lg border p-4 bg-muted/20">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Score SEO On-Page</div>
            <div className={`text-4xl font-bold ${scoreColor}`}>{score}<span className="text-lg text-muted-foreground">/100</span></div>
            <div className={`text-xs mt-0.5 ${scoreColor}`}>{scoreLabel}</div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-600">{contagem.ok} OK</Badge>
            <Badge className="bg-amber-500 hover:bg-amber-500">{contagem.alerta} Alerta</Badge>
            <Badge variant="destructive">{contagem.critico} Crítico</Badge>
          </div>
        </div>
        <Progress value={score} className="mt-3 h-2" />

        <div className="mt-3 space-y-1">
          <Label htmlFor="chk-kw" className="text-xs flex items-center gap-1">
            <Info className="w-3 h-3" /> Palavra-chave principal (calibra a análise)
          </Label>
          <Input
            id="chk-kw" value={kw} onChange={(e) => setKw(e.target.value)}
            placeholder="ex: apartamento à venda águas claras"
            className="h-9"
          />
        </div>
      </div>

      {/* Checklist por categoria */}
      <div className="space-y-3">
        {categorias.map((cat) => (
          <div key={cat} className="rounded-lg border">
            <div className="px-3 py-2 text-xs font-semibold bg-muted/40 border-b uppercase tracking-wide">{cat}</div>
            <ul className="divide-y">
              {checks.filter((c) => c.categoria === cat).map((c) => {
                const M = STATUS_META[c.status];
                const Icon = M.icon;
                return (
                  <li key={c.id} className="p-3 flex gap-3 items-start">
                    <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${M.color}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{c.titulo}</span>
                        <Badge variant="outline" className="text-[10px]">peso {c.peso}</Badge>
                        <Badge variant="outline" className={`text-[10px] ${M.color} border-current`}>{M.label}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">{c.detalhe}</div>
                      {c.status !== "ok" && (
                        <div className="text-xs mt-1 text-foreground/80">→ {c.recomendacao}</div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
