import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Play } from "lucide-react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Seo } from "@/components/Seo";
import {
  SEO_ROUTES,
  classifyDescription,
  classifyTitle,
  toAbsoluteUrl,
} from "@/lib/seoRegistry";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FileCode2,
  Globe,
  RefreshCw,
  Search,
  ShieldOff,
} from "lucide-react";
import { SeoMonitoramentoTab } from "@/components/seo/SeoMonitoramentoTab";
import { SeoLighthouseTab } from "@/components/seo/SeoLighthouseTab";
import { SeoLighthouseConfigTab } from "@/components/seo/SeoLighthouseConfigTab";
import { SeoPostDeployPanel } from "@/components/seo/SeoPostDeployPanel";
import { SeoRouteDrilldownDialog } from "@/components/seo/SeoRouteDrilldownDialog";
import { SeoChecklistTab } from "@/components/seo/SeoChecklistTab";
import { Download, FileText } from "lucide-react";
import { toast } from "sonner";
import {
  fetchSeoReportData,
  exportSeoReportCsv,
  exportSeoReportPdf,
  downloadBlob,
} from "@/lib/exportSeoReport";

interface SitemapUrl {
  loc: string;
  changefreq?: string;
  priority?: string;
}

function parseSitemap(xml: string): SitemapUrl[] {
  const urls: SitemapUrl[] = [];
  const blocks = xml.match(/<url>[\s\S]*?<\/url>/g) || [];
  for (const b of blocks) {
    const loc = b.match(/<loc>([^<]+)<\/loc>/)?.[1];
    if (!loc) continue;
    urls.push({
      loc,
      changefreq: b.match(/<changefreq>([^<]+)<\/changefreq>/)?.[1],
      priority: b.match(/<priority>([^<]+)<\/priority>/)?.[1],
    });
  }
  return urls;
}

export default function SeoAuditoria() {
  const [sitemap, setSitemap] = useState<SitemapUrl[]>([]);
  const [loadingSitemap, setLoadingSitemap] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [q, setQ] = useState("");
  const [city, setCity] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [status, setStatus] = useState<"all" | "ok" | "warn" | "error">("all");
  const [validating, setValidating] = useState(false);
  const [drilldownRoute, setDrilldownRoute] = useState<(typeof SEO_ROUTES)[number] | null>(null);

  async function loadSitemap() {
    setLoadingSitemap(true);
    try {
      const res = await fetch("/sitemap.xml", { cache: "no-store" });
      const text = await res.text();
      setSitemap(parseSitemap(text));
    } catch {
      setSitemap([]);
    } finally {
      setLoadingSitemap(false);
    }
  }

  useEffect(() => {
    loadSitemap();
  }, []);

  const categories = useMemo(
    () => Array.from(new Set(SEO_ROUTES.map((r) => r.category))),
    [],
  );

  type Row = (typeof SEO_ROUTES)[number] & {
    _statusLevel: "ok" | "warn" | "error";
    _statusMsg: string;
  };

  const rows: Row[] = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const cityNeedle = city.trim().toLowerCase();
    return SEO_ROUTES.map((r) => {
      const t = classifyTitle(r.title);
      const d = classifyDescription(r.description);
      const level: "ok" | "warn" | "error" =
        t.level === "warn" && d.level === "warn"
          ? "error"
          : t.level === "warn" || d.level === "warn"
          ? "warn"
          : "ok";
      const msg =
        level === "ok"
          ? "Metadados OK"
          : [t.level !== "ok" ? `título: ${t.msg}` : null, d.level !== "ok" ? `desc: ${d.msg}` : null]
              .filter(Boolean)
              .join(" · ");
      return { ...r, _statusLevel: level, _statusMsg: msg } as Row;
    }).filter((r) => {
      if (needle) {
        const hit =
          r.path.toLowerCase().includes(needle) ||
          r.title.toLowerCase().includes(needle) ||
          r.description.toLowerCase().includes(needle);
        if (!hit) return false;
      }
      if (cityNeedle) {
        const inRoute = r.path.toLowerCase().includes(cityNeedle);
        const inTitle = r.title.toLowerCase().includes(cityNeedle);
        if (!inRoute && !inTitle) return false;
      }
      if (category !== "all" && r.category !== category) return false;
      if (status !== "all" && r._statusLevel !== status) return false;
      return true;
    });
  }, [q, city, category, status]);

  async function validateFailing() {
    const failing = rows.filter((r) => r._statusLevel !== "ok" && !r.dynamic).map((r) => r.path);
    if (!failing.length) {
      toast.info("Nenhuma rota com falha nos filtros atuais.");
      return;
    }
    const paths = failing.slice(0, 20);
    setValidating(true);
    toast.info(`Executando Lighthouse em ${paths.length} rota(s) com falha…`);
    const { data, error } = await supabase.functions.invoke("lighthouse-audit", {
      body: { paths },
    });
    setValidating(false);
    if (error) {
      toast.error("Falha ao validar: " + error.message);
      return;
    }
    const s = (data as { summary?: { total: number; ok: number } })?.summary;
    toast.success(`Validação concluída · ${s?.ok ?? 0}/${s?.total ?? 0} OK. Veja a aba Lighthouse.`);
  }



  const totals = useMemo(() => {
    let ok = 0;
    let warn = 0;
    SEO_ROUTES.forEach((r) => {
      const t = classifyTitle(r.title);
      const d = classifyDescription(r.description);
      if (t.level === "ok" && d.level === "ok") ok++;
      else warn++;
    });
    return {
      total: SEO_ROUTES.length,
      ok,
      warn,
      noindex: SEO_ROUTES.filter((r) => r.noindex).length,
      jsonLd: SEO_ROUTES.filter((r) => r.hasJsonLd).length,
      dynamic: SEO_ROUTES.filter((r) => r.dynamic).length,
    };
  }, []);

  const imoveisNoSitemap = sitemap.filter((u) => u.loc.includes("/imovel/")).length;
  const cidadesNoSitemap = sitemap.filter((u) => u.loc.includes("/anunciar-imovel/")).length;

  return (
    <DashboardLayout>
      <Seo
        title="Auditoria SEO — radarimobtech"
        description="Painel interno de auditoria SEO: rotas, metadados, canonical, JSON-LD e sitemap.xml."
        path="/seo-auditoria"
        noindex
      />

      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Auditoria SEO</h1>
            <p className="text-sm text-muted-foreground">
              Resultado do último scan + inspeção por rota. Fonte:{" "}
              <code>seoRegistry.ts</code> + <code>public/sitemap.xml</code>.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={loadSitemap} disabled={loadingSitemap}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loadingSitemap ? "animate-spin" : ""}`} />
              Recarregar sitemap
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={exporting}
              onClick={async () => {
                setExporting(true);
                try {
                  const data = await fetchSeoReportData(sitemap);
                  downloadBlob(exportSeoReportCsv(data), `seo-auditoria-${new Date().toISOString().slice(0, 10)}.csv`);
                  toast.success("CSV exportado");
                } catch (e) {
                  toast.error("Falha ao exportar CSV: " + (e as Error).message);
                } finally { setExporting(false); }
              }}
            >
              <Download className="h-4 w-4 mr-2" /> CSV
            </Button>
            <Button
              size="sm"
              disabled={exporting}
              onClick={async () => {
                setExporting(true);
                try {
                  const data = await fetchSeoReportData(sitemap);
                  downloadBlob(exportSeoReportPdf(data), `seo-auditoria-${new Date().toISOString().slice(0, 10)}.pdf`);
                  toast.success("PDF exportado");
                } catch (e) {
                  toast.error("Falha ao exportar PDF: " + (e as Error).message);
                } finally { setExporting(false); }
              }}
            >
              <FileText className="h-4 w-4 mr-2" /> PDF
            </Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <KPI label="Rotas registradas" value={totals.total} icon={<Globe className="h-4 w-4" />} />
          <KPI label="Metadata OK" value={totals.ok} tone="ok" icon={<CheckCircle2 className="h-4 w-4" />} />
          <KPI label="Avisos" value={totals.warn} tone="warn" icon={<AlertTriangle className="h-4 w-4" />} />
          <KPI label="Com JSON-LD" value={totals.jsonLd} icon={<FileCode2 className="h-4 w-4" />} />
          <KPI label="noindex" value={totals.noindex} icon={<ShieldOff className="h-4 w-4" />} />
          <KPI label="URLs no sitemap" value={sitemap.length} icon={<Globe className="h-4 w-4" />} />
        </div>

        <Tabs defaultValue="monitor">
          <TabsList>
            <TabsTrigger value="monitor">Monitoramento</TabsTrigger>
            <TabsTrigger value="lighthouse">Lighthouse</TabsTrigger>
            <TabsTrigger value="pos-deploy">Pós-publicação</TabsTrigger>
            <TabsTrigger value="lh-config">Config Lighthouse</TabsTrigger>
            <TabsTrigger value="rotas">Rotas & metadados</TabsTrigger>
            <TabsTrigger value="checklist">Checklist de correções</TabsTrigger>
            <TabsTrigger value="sitemap">Sitemap ({sitemap.length})</TabsTrigger>
            <TabsTrigger value="checks">Checagens gerais</TabsTrigger>
          </TabsList>


          <TabsContent value="monitor">
            <SeoMonitoramentoTab />
          </TabsContent>

          <TabsContent value="lighthouse">
            <SeoLighthouseTab />
          </TabsContent>

          <TabsContent value="pos-deploy">
            <SeoPostDeployPanel />
          </TabsContent>

          <TabsContent value="lh-config">
            <SeoLighthouseConfigTab />
          </TabsContent>


          <TabsContent value="checklist">
            <SeoChecklistTab />
          </TabsContent>

          <TabsContent value="rotas" className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[220px] max-w-sm">
                <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Buscar rota, título ou descrição…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
              <Input
                className="w-[180px]"
                placeholder="Cidade (ex.: brasilia)"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Tipo de rota" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as categorias</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="ok">OK</SelectItem>
                  <SelectItem value="warn">Alerta</SelectItem>
                  <SelectItem value="error">Erro</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" onClick={validateFailing} disabled={validating}>
                <Play className={`h-4 w-4 mr-2 ${validating ? "animate-pulse" : ""}`} />
                Validar falhas
              </Button>
              {(q || city || category !== "all" || status !== "all") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setQ(""); setCity(""); setCategory("all"); setStatus("all"); }}
                >
                  Limpar
                </Button>
              )}
              <span className="text-xs text-muted-foreground ml-auto">
                {rows.length} de {SEO_ROUTES.length}
              </span>
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[220px]">Rota</TableHead>
                      <TableHead className="w-[90px]">Status</TableHead>
                      <TableHead>Título</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="w-[160px]">Flags</TableHead>
                      <TableHead className="w-[60px] text-right">Abrir</TableHead>

                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => {
                      const t = classifyTitle(r.title);
                      const d = classifyDescription(r.description);
                      return (
                        <TableRow
                          key={r.path}
                          className="cursor-pointer hover:bg-muted/40"
                          onClick={() => setDrilldownRoute(r)}
                        >
                          <TableCell className="align-top">
                            <div className="font-mono text-xs">{r.path}</div>
                            <Badge variant="outline" className="mt-1 text-[10px]">
                              {r.category}
                            </Badge>
                          </TableCell>
                          <TableCell className="align-top">
                            <StatusBadge level={r._statusLevel} title={r._statusMsg} />
                          </TableCell>
                          <TableCell className="align-top">
                            <div className="text-sm line-clamp-2">{r.title}</div>
                            <StatusChip level={t.level} label={t.msg} />
                          </TableCell>
                          <TableCell className="align-top">
                            <div className="text-xs text-muted-foreground line-clamp-3">
                              {r.description}
                            </div>
                            <StatusChip level={d.level} label={d.msg} />
                          </TableCell>
                          <TableCell className="align-top space-y-1">
                            {r.dynamic && <Badge variant="secondary" className="text-[10px]">dinâmica</Badge>}
                            {r.hasJsonLd && <Badge variant="secondary" className="text-[10px]">JSON-LD</Badge>}
                            {r.hasImage && <Badge variant="secondary" className="text-[10px]">og:image</Badge>}
                            {r.noindex && <Badge className="text-[10px] bg-amber-600 hover:bg-amber-600">noindex</Badge>}
                            {r.notes && (
                              <div className="text-[10px] text-muted-foreground">{r.notes}</div>
                            )}
                          </TableCell>
                          <TableCell
                            className="align-top text-right"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() => setDrilldownRoute(r)}
                              >
                                Detalhar
                              </Button>
                              {!r.dynamic && (
                                <a
                                  href={toAbsoluteUrl(r.path)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex text-muted-foreground hover:text-foreground"
                                  aria-label={`Abrir ${r.path} em nova aba`}
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sitemap" className="space-y-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  sitemap.xml — {sitemap.length} URLs
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  {imoveisNoSitemap} imóveis · {cidadesNoSitemap} páginas de cidade ·{" "}
                  {sitemap.length - imoveisNoSitemap - cidadesNoSitemap} estáticas
                </p>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[520px] overflow-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background">
                      <TableRow>
                        <TableHead>URL</TableHead>
                        <TableHead className="w-[120px]">changefreq</TableHead>
                        <TableHead className="w-[100px]">priority</TableHead>
                        <TableHead className="w-[60px] text-right">Abrir</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sitemap.map((u) => (
                        <TableRow key={u.loc}>
                          <TableCell className="font-mono text-xs break-all">{u.loc}</TableCell>
                          <TableCell className="text-xs">{u.changefreq || "—"}</TableCell>
                          <TableCell className="text-xs">{u.priority || "—"}</TableCell>
                          <TableCell className="text-right">
                            <a
                              href={u.loc}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex text-muted-foreground hover:text-foreground"
                              aria-label={`Abrir ${u.loc}`}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="checks" className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <CheckCard
                ok
                title="react-helmet-async ativo"
                detail="HelmetProvider está em src/main.tsx — cada rota controla title/description/canonical/og:*."
              />
              <CheckCard
                ok
                title="Canonical dinâmico por rota"
                detail="index.html não fixa mais <link rel='canonical'>; o componente Seo emite canonical self-referencing."
              />
              <CheckCard
                ok
                title="Sitemap com imóveis"
                detail={`scripts/generate-sitemap.ts busca imóveis publicados no backend; ${imoveisNoSitemap} entradas /imovel/:id no último build.`}
              />
              <CheckCard
                ok
                title="robots.txt com Sitemap:"
                detail="public/robots.txt aponta para https://radarimobtech.shop/sitemap.xml."
              />
              <CheckCard
                ok
                title="llms.txt publicado"
                detail="public/llms.txt no formato spec com resumo, páginas públicas e cidades SEO."
              />
              <CheckCard
                ok
                title="JSON-LD nas páginas-chave"
                detail="Landing (Organization) e /imovel/:id (Product/Offer com endereço)."
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>
      <SeoRouteDrilldownDialog
        route={drilldownRoute}
        open={!!drilldownRoute}
        onOpenChange={(v) => !v && setDrilldownRoute(null)}
      />
    </DashboardLayout>
  );
}

function KPI({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon?: React.ReactNode;
  tone?: "ok" | "warn";
}) {
  const toneCls =
    tone === "ok"
      ? "text-emerald-600"
      : tone === "warn"
      ? "text-amber-600"
      : "text-foreground";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {icon}
          {label}
        </div>
        <div className={`text-2xl font-semibold mt-1 ${toneCls}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function StatusChip({ level, label }: { level: "ok" | "warn"; label: string }) {
  if (level === "ok") {
    return (
      <div className="mt-1 inline-flex items-center gap-1 text-[10px] text-emerald-700">
        <CheckCircle2 className="h-3 w-3" /> {label}
      </div>
    );
  }
  return (
    <div className="mt-1 inline-flex items-center gap-1 text-[10px] text-amber-700">
      <AlertTriangle className="h-3 w-3" /> {label}
    </div>
  );
}

function StatusBadge({ level, title }: { level: "ok" | "warn" | "error"; title: string }) {
  const cls =
    level === "ok"
      ? "bg-emerald-100 text-emerald-800 border-emerald-200"
      : level === "warn"
      ? "bg-amber-100 text-amber-800 border-amber-200"
      : "bg-red-100 text-red-800 border-red-200";
  const label = level === "ok" ? "OK" : level === "warn" ? "Alerta" : "Erro";
  return (
    <Badge variant="outline" className={`text-[10px] ${cls}`} title={title}>
      {label}
    </Badge>
  );
}




function CheckCard({ ok, title, detail }: { ok: boolean; title: string; detail: string }) {
  return (
    <Card>
      <CardContent className="p-4 flex gap-3">
        {ok ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5" />
        ) : (
          <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
        )}
        <div>
          <div className="font-medium text-sm">{title}</div>
          <div className="text-xs text-muted-foreground mt-1">{detail}</div>
        </div>
      </CardContent>
    </Card>
  );
}
