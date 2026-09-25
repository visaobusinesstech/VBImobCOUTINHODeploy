import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Search, Download } from "lucide-react";
import { Input } from "@/components/ui/input";

type LogRow = {
  id: string;
  created_at: string;
  nome_predio: string | null;
  cidade: string | null;
  bairro: string | null;
  tipo_imovel: string | null;
  operacao: string | null;
  match_type: string | null;
  fallback_used: boolean | null;
  ads_count: number | null;
  suggestions_count: number | null;
  suggestions: any;
  firecrawl_error: string | null;
  duracao_ms: number | null;
};

type Portal = { dominio: string; ativo: boolean; regiao: string | null };

const matchColor: Record<string, string> = {
  exact: "bg-emerald-100 text-emerald-800 border-emerald-200",
  partial: "bg-sky-100 text-sky-800 border-sky-200",
  fallback: "bg-amber-100 text-amber-800 border-amber-200",
  none: "bg-red-100 text-red-800 border-red-200",
};

const domainOf = (url?: string) => {
  if (!url) return "";
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
};

export default function MatchingFallbackAuditPanel() {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<LogRow[]>([]);
  const [portais, setPortais] = useState<Portal[]>([]);
  const [q, setQ] = useState("");

  const load = async () => {
    setLoading(true);
    const [{ data: logs }, { data: pts }] = await Promise.all([
      supabase.from("matching_fallback_log")
        .select("id,created_at,nome_predio,cidade,bairro,tipo_imovel,operacao,match_type,fallback_used,ads_count,suggestions_count,suggestions,firecrawl_error,duracao_ms")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.from("captacao_portais_allowlist")
        .select("dominio,ativo,regiao")
        .order("dominio"),
    ]);
    setRows((logs as LogRow[]) || []);
    setPortais((pts as Portal[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) =>
      [r.nome_predio, r.cidade, r.bairro, r.match_type].filter(Boolean).some((v) => String(v).toLowerCase().includes(term))
    );
  }, [rows, q]);

  const resumo = useMemo(() => {
    const total = filtered.length;
    const byType = { exact: 0, partial: 0, fallback: 0, none: 0 } as Record<string, number>;
    let fallbackUsed = 0;
    const sims: number[] = [];
    const portalHits: Record<string, { allowlist: number; open: number }> = {};
    for (const r of filtered) {
      const mt = (r.match_type || "none") as string;
      byType[mt] = (byType[mt] || 0) + 1;
      if (r.fallback_used) fallbackUsed++;
      const sugs = Array.isArray(r.suggestions) ? r.suggestions : [];
      for (const s of sugs) {
        if (typeof s?.similarity === "number") sims.push(s.similarity);
        const d = domainOf(s?.url);
        if (!d) continue;
        const bucket = portalHits[d] || { allowlist: 0, open: 0 };
        if (s?.source === "open_search") bucket.open++; else bucket.allowlist++;
        portalHits[d] = bucket;
      }
    }
    return {
      total, byType, fallbackUsed,
      simMin: sims.length ? Math.min(...sims) : null,
      simMax: sims.length ? Math.max(...sims) : null,
      simAvg: sims.length ? sims.reduce((a, b) => a + b, 0) / sims.length : null,
      topPortais: Object.entries(portalHits)
        .sort((a, b) => (b[1].allowlist + b[1].open) - (a[1].allowlist + a[1].open))
        .slice(0, 8),
    };
  }, [filtered]);

  const ativos = portais.filter((p) => p.ativo).length;

  const exportCsv = () => {
    const esc = (v: any) => {
      const s = v == null ? "" : String(v);
      return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = [
      "created_at", "nome_predio", "bairro", "cidade", "tipo_imovel", "operacao",
      "row_match_type", "fallback_used", "ads_count", "suggestions_count",
      "titulo", "url", "portal_origem", "source", "match_type", "similarity", "preco",
    ];
    const lines: string[] = [header.join(",")];
    for (const r of filtered) {
      const sugs = Array.isArray(r.suggestions) ? r.suggestions : [];
      if (sugs.length === 0) {
        lines.push([
          r.created_at, r.nome_predio, r.bairro, r.cidade, r.tipo_imovel, r.operacao,
          r.match_type, r.fallback_used, r.ads_count ?? 0, r.suggestions_count ?? 0,
          "", "", "", "", "", "", "",
        ].map(esc).join(","));
        continue;
      }
      for (const s of sugs) {
        lines.push([
          r.created_at, r.nome_predio, r.bairro, r.cidade, r.tipo_imovel, r.operacao,
          r.match_type, r.fallback_used, r.ads_count ?? 0, r.suggestions_count ?? 0,
          s?.title ?? s?.titulo ?? "", s?.url ?? "", domainOf(s?.url),
          s?.source ?? "", s?.match_type ?? "", s?.similarity ?? "", s?.price ?? s?.preco ?? "",
        ].map(esc).join(","));
      }
    }
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `matching-fallback-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-3">
          <span>Auditoria de matching · últimas 100 buscas</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={exportCsv} disabled={loading || filtered.length === 0}>
              <Download className="mr-2 h-4 w-4" /> Exportar CSV
            </Button>
            <Button size="sm" variant="outline" onClick={load} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Recarregar
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
          <Kpi n={resumo.total} label="Buscas" />
          <Kpi n={resumo.byType.exact || 0} label="Exact" tone="emerald" />
          <Kpi n={resumo.byType.partial || 0} label="Partial" tone="sky" />
          <Kpi n={resumo.byType.fallback || 0} label="Fallback" tone="amber" />
          <Kpi n={resumo.byType.none || 0} label="Sem match" tone="red" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MiniStat label="Similarity mín" value={resumo.simMin != null ? resumo.simMin.toFixed(2) : "—"} />
          <MiniStat label="Similarity máx" value={resumo.simMax != null ? resumo.simMax.toFixed(2) : "—"} />
          <MiniStat label="Similarity média" value={resumo.simAvg != null ? resumo.simAvg.toFixed(2) : "—"} />
          <MiniStat label="Portais no allowlist" value={`${ativos}/${portais.length}`} />
        </div>

        {resumo.topPortais.length > 0 && (
          <div>
            <div className="text-sm font-medium mb-2">Portais mais retornados</div>
            <div className="flex flex-wrap gap-2">
              {resumo.topPortais.map(([dom, hits]) => {
                const isAllow = portais.some((p) => p.dominio === dom && p.ativo);
                return (
                  <Badge key={dom} variant="outline" className="gap-1.5">
                    <span className="font-medium">{dom}</span>
                    <span className="text-emerald-700">A:{hits.allowlist}</span>
                    <span className="text-sky-700">O:{hits.open}</span>
                    {!isAllow && <span className="text-slate-500">· fora do allowlist</span>}
                  </Badge>
                );
              })}
            </div>
            <div className="mt-1 text-xs text-slate-500">A = allowlist · O = busca aberta</div>
          </div>
        )}

        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input placeholder="Filtrar por prédio, cidade, bairro ou tipo de match…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-8" />
        </div>

        <div className="divide-y rounded-md border max-h-[520px] overflow-auto">
          {filtered.length === 0 && (
            <div className="p-4 text-sm text-slate-500 text-center">Nenhuma busca registrada ainda.</div>
          )}
          {filtered.map((r) => {
            const sugs = Array.isArray(r.suggestions) ? r.suggestions : [];
            const sims = sugs.map((s: any) => s?.similarity).filter((v: any) => typeof v === "number");
            const min = sims.length ? Math.min(...sims) : null;
            const max = sims.length ? Math.max(...sims) : null;
            const allowCount = sugs.filter((s: any) => s?.source !== "open_search").length;
            const openCount = sugs.filter((s: any) => s?.source === "open_search").length;
            const doms = Array.from(new Set(sugs.map((s: any) => domainOf(s?.url)).filter(Boolean)));
            const mt = r.match_type || "none";
            return (
              <div key={r.id} className="p-3 text-sm space-y-1.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="font-medium">
                    {r.nome_predio || "(sem prédio)"} <span className="text-slate-400">·</span>{" "}
                    <span className="text-slate-600">{[r.bairro, r.cidade].filter(Boolean).join(" / ") || "—"}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge className={matchColor[mt] || matchColor.none} variant="outline">{mt}</Badge>
                    {r.fallback_used && <Badge variant="outline" className="text-xs">fallback</Badge>}
                    <span className="text-xs text-slate-500">{new Date(r.created_at).toLocaleString("pt-BR")}</span>
                  </div>
                </div>
                <div className="text-xs text-slate-600 flex flex-wrap gap-x-4 gap-y-0.5">
                  <span>ads: <strong>{r.ads_count ?? 0}</strong></span>
                  <span>sugestões: <strong>{r.suggestions_count ?? sugs.length}</strong></span>
                  <span>allowlist: <strong className="text-emerald-700">{allowCount}</strong></span>
                  <span>busca aberta: <strong className="text-sky-700">{openCount}</strong></span>
                  <span>sim: <strong>{min != null ? min.toFixed(2) : "—"} – {max != null ? max.toFixed(2) : "—"}</strong></span>
                  {r.duracao_ms != null && <span>{r.duracao_ms} ms</span>}
                  {r.tipo_imovel && <span>{r.tipo_imovel}</span>}
                  {r.operacao && <span>{r.operacao}</span>}
                </div>
                {doms.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {doms.slice(0, 8).map((d) => (
                      <span key={d} className="text-[11px] rounded border bg-slate-50 px-1.5 py-0.5 text-slate-700">{d}</span>
                    ))}
                    {doms.length > 8 && <span className="text-[11px] text-slate-500">+{doms.length - 8}</span>}
                  </div>
                )}
                {r.firecrawl_error && (
                  <div className="text-xs text-red-700">Firecrawl: {r.firecrawl_error}</div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function Kpi({ n, label, tone = "slate" }: { n: number; label: string; tone?: "slate" | "emerald" | "sky" | "amber" | "red" }) {
  const map = {
    slate: "text-slate-700", emerald: "text-emerald-700",
    sky: "text-sky-700", amber: "text-amber-700", red: "text-red-700",
  } as const;
  return (
    <div className="rounded-md border p-3">
      <div className={`text-2xl font-semibold ${map[tone]}`}>{n}</div>
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-lg font-semibold text-slate-800">{value}</div>
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
    </div>
  );
}
