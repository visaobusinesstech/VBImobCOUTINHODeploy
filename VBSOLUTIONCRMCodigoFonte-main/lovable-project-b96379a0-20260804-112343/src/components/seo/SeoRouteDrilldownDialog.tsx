import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, CheckCircle2, RefreshCw, XCircle } from "lucide-react";
import {
  SeoRouteEntry,
  classifyDescription,
  classifyTitle,
  toAbsoluteUrl,
} from "@/lib/seoRegistry";
import { useSeoChecklist, SeoChecklistItem } from "@/hooks/useSeoChecklist";

type Level = "ok" | "warn" | "error";
interface TagCheck {
  key: string;
  label: string;
  expected: string;
  found: string;
  level: Level;
  msg: string;
}

interface Snapshot {
  title: string;
  description: string;
  canonical: string;
  ogTitle: string;
  ogDescription: string;
  ogUrl: string;
  ogType: string;
  ogImage: string;
  twitterCard: string;
  jsonLd: string[];
  robots: string;
}

function readHead(doc: Document): Snapshot {
  const meta = (sel: string) =>
    (doc.head.querySelector(sel) as HTMLMetaElement | null)?.content?.trim() || "";
  const link = (sel: string) =>
    (doc.head.querySelector(sel) as HTMLLinkElement | null)?.href?.trim() || "";
  const jsonLd = Array.from(
    doc.head.querySelectorAll('script[type="application/ld+json"]'),
  ).map((s) => (s.textContent || "").trim());
  return {
    title: doc.title?.trim() || "",
    description: meta('meta[name="description"]'),
    canonical: link('link[rel="canonical"]'),
    ogTitle: meta('meta[property="og:title"]'),
    ogDescription: meta('meta[property="og:description"]'),
    ogUrl: meta('meta[property="og:url"]'),
    ogType: meta('meta[property="og:type"]'),
    ogImage: meta('meta[property="og:image"]'),
    twitterCard: meta('meta[name="twitter:card"]'),
    robots: meta('meta[name="robots"]'),
    jsonLd,
  };
}

function analyze(route: SeoRouteEntry, snap: Snapshot): TagCheck[] {
  const checks: TagCheck[] = [];
  const expectedUrl = toAbsoluteUrl(route.path);

  // title
  const t = classifyTitle(snap.title || "");
  checks.push({
    key: "title",
    label: "<title>",
    expected: route.dynamic ? "gerado em runtime (não vazio, 20–70 chars)" : route.title,
    found: snap.title || "(vazio)",
    level: !snap.title ? "error" : t.level,
    msg: !snap.title ? "Nenhum <title> encontrado" : t.msg,
  });

  // description
  const d = classifyDescription(snap.description || "");
  checks.push({
    key: "description",
    label: 'meta[name="description"]',
    expected: route.dynamic ? "gerado em runtime (80–170 chars)" : route.description,
    found: snap.description || "(vazio)",
    level: !snap.description ? "error" : d.level,
    msg: !snap.description ? "Description ausente" : d.msg,
  });

  // canonical
  const canonicalOk =
    !!snap.canonical &&
    (snap.canonical === expectedUrl ||
      snap.canonical.replace(/\/$/, "") === expectedUrl.replace(/\/$/, "") ||
      (route.dynamic && snap.canonical.startsWith("https://")));
  checks.push({
    key: "canonical",
    label: 'link[rel="canonical"]',
    expected: route.dynamic ? `${toAbsoluteUrl("")}<slug>` : expectedUrl,
    found: snap.canonical || "(ausente)",
    level: !snap.canonical ? "error" : canonicalOk ? "ok" : "warn",
    msg: !snap.canonical
      ? "Canonical ausente"
      : canonicalOk
      ? "Auto-referente"
      : "Diverge da URL esperada",
  });

  // og:title
  checks.push({
    key: "og:title",
    label: 'og:title',
    expected: route.dynamic ? "= <title> dinâmico" : route.title,
    found: snap.ogTitle || "(ausente)",
    level: !snap.ogTitle ? "error" : snap.ogTitle === snap.title ? "ok" : "warn",
    msg: !snap.ogTitle
      ? "og:title ausente"
      : snap.ogTitle === snap.title
      ? "Coincide com <title>"
      : "Diverge do <title>",
  });

  // og:description
  checks.push({
    key: "og:description",
    label: "og:description",
    expected: route.dynamic ? "= description dinâmica" : route.description,
    found: snap.ogDescription || "(ausente)",
    level: !snap.ogDescription
      ? "error"
      : snap.ogDescription === snap.description
      ? "ok"
      : "warn",
    msg: !snap.ogDescription
      ? "og:description ausente"
      : snap.ogDescription === snap.description
      ? "Coincide com description"
      : "Diverge da description",
  });

  // og:url
  const ogUrlOk =
    !!snap.ogUrl &&
    (snap.ogUrl === expectedUrl ||
      snap.ogUrl.replace(/\/$/, "") === expectedUrl.replace(/\/$/, "") ||
      (route.dynamic && snap.ogUrl.startsWith("https://")));
  checks.push({
    key: "og:url",
    label: "og:url",
    expected: canonicalOk ? snap.canonical : expectedUrl,
    found: snap.ogUrl || "(ausente)",
    level: !snap.ogUrl ? "error" : ogUrlOk ? "ok" : "warn",
    msg: !snap.ogUrl
      ? "og:url ausente"
      : ogUrlOk
      ? "Auto-referente"
      : "Diverge do canonical",
  });

  // og:type
  checks.push({
    key: "og:type",
    label: "og:type",
    expected: "website ou article",
    found: snap.ogType || "(ausente)",
    level: !snap.ogType ? "warn" : "ok",
    msg: snap.ogType ? "OK" : "og:type ausente (recomendado)",
  });

  // og:image
  if (route.hasImage) {
    checks.push({
      key: "og:image",
      label: "og:image",
      expected: "URL absoluta https://…",
      found: snap.ogImage || "(ausente)",
      level: !snap.ogImage ? "error" : snap.ogImage.startsWith("https://") ? "ok" : "warn",
      msg: !snap.ogImage
        ? "og:image esperado mas ausente"
        : snap.ogImage.startsWith("https://")
        ? "URL absoluta"
        : "URL não absoluta (crawlers não resolvem)",
    });
  } else {
    checks.push({
      key: "og:image",
      label: "og:image",
      expected: "opcional (hosting injeta preview)",
      found: snap.ogImage || "(ausente — hosting injeta)",
      level: "ok",
      msg: "Não obrigatório para esta rota",
    });
  }

  // twitter:card
  checks.push({
    key: "twitter:card",
    label: "twitter:card",
    expected: "summary_large_image",
    found: snap.twitterCard || "(ausente)",
    level: snap.twitterCard ? "ok" : "warn",
    msg: snap.twitterCard ? "OK" : "twitter:card ausente (recomendado)",
  });

  // JSON-LD
  const jsonLdValid = snap.jsonLd.filter((s) => {
    try {
      JSON.parse(s);
      return true;
    } catch {
      return false;
    }
  });
  if (route.hasJsonLd) {
    checks.push({
      key: "jsonld",
      label: 'script[type="application/ld+json"]',
      expected: "≥ 1 bloco JSON válido",
      found: `${snap.jsonLd.length} bloco(s), ${jsonLdValid.length} válido(s)`,
      level:
        snap.jsonLd.length === 0
          ? "error"
          : jsonLdValid.length < snap.jsonLd.length
          ? "warn"
          : "ok",
      msg:
        snap.jsonLd.length === 0
          ? "JSON-LD esperado mas ausente"
          : jsonLdValid.length < snap.jsonLd.length
          ? "Há JSON-LD inválido"
          : "Válido",
    });
  } else {
    checks.push({
      key: "jsonld",
      label: 'script[type="application/ld+json"]',
      expected: "opcional",
      found: `${snap.jsonLd.length} bloco(s)`,
      level: "ok",
      msg: "Não obrigatório para esta rota",
    });
  }

  // robots (checa noindex esperado)
  const hasNoindex = /noindex/i.test(snap.robots);
  if (route.noindex) {
    checks.push({
      key: "robots",
      label: 'meta[name="robots"]',
      expected: "noindex",
      found: snap.robots || "(ausente)",
      level: hasNoindex ? "ok" : "error",
      msg: hasNoindex ? "noindex aplicado" : "Rota deveria ser noindex",
    });
  } else if (snap.robots) {
    checks.push({
      key: "robots",
      label: 'meta[name="robots"]',
      expected: "sem noindex",
      found: snap.robots,
      level: hasNoindex ? "error" : "ok",
      msg: hasNoindex ? "noindex não deveria estar presente" : "OK",
    });
  }

  return checks;
}

export function SeoRouteDrilldownDialog({
  route,
  open,
  onOpenChange,
}: {
  route: SeoRouteEntry | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!open || !route) return;
    setSnap(null);
    setError(null);
    setLoading(true);
  }, [open, route, reloadKey]);

  function onIframeLoad() {
    if (!iframeRef.current) return;
    try {
      const doc = iframeRef.current.contentDocument;
      if (!doc) {
        setError("Não foi possível ler o head da rota (contentDocument bloqueado).");
        setLoading(false);
        return;
      }
      // pequeno delay para Helmet hidratar
      setTimeout(() => {
        try {
          const s = readHead(doc);
          setSnap(s);
          setLoading(false);
        } catch (e) {
          setError((e as Error).message);
          setLoading(false);
        }
      }, 800);
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
  }

  const checks = route && snap ? analyze(route, snap) : [];
  const { items: checklist, upsert } = useSeoChecklist(route?.path ?? null);
  const failing = checks.filter((c) => {
    if (c.level === "ok") return false;
    const cli = checklist.find((i) => i.tag_key === c.key);
    return !cli?.resolved;
  }).length;

  // Para rotas dinâmicas usamos um exemplo (:id → primeira URL do sitemap que casa),
  // mas por padrão só validamos rotas estáticas — o dialog avisa.
  const previewPath = route?.dynamic ? null : route?.path ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Drill-down SEO
            {route && (
              <Badge variant="outline" className="font-mono text-xs">
                {route.path}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Comparação tag-a-tag entre o que o registry espera e o que a rota entrega.
            Marque cada item como resolvido e registre observações.
          </DialogDescription>
        </DialogHeader>

        {route?.dynamic ? (
          <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Esta rota é <strong>dinâmica</strong> — os valores de título, description e canonical
            são gerados em runtime a partir dos dados carregados. Abra uma instância específica
            (ex.: <code className="font-mono">/imovel/&lt;id&gt;</code>) diretamente no navegador
            para inspecionar as tags.
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                {loading
                  ? "Carregando rota em iframe e lendo head…"
                  : error
                  ? "Falha ao ler head."
                  : `${checks.length - failing} OK/resolvido · ${failing} pendente`}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setReloadKey((k) => k + 1)}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                Revalidar
              </Button>
            </div>

            {/* iframe oculto que renderiza a rota real */}
            {previewPath && (
              <iframe
                key={reloadKey}
                ref={iframeRef}
                src={previewPath}
                onLoad={onIframeLoad}
                title="seo-drilldown"
                sandbox="allow-same-origin allow-scripts"
                style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
              />
            )}

            {error && (
              <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                {error}
              </div>
            )}

            {snap && (
              <div className="space-y-2">
                {checks.map((c) => (
                  <CheckRow
                    key={c.key}
                    check={c}
                    checklist={checklist.find((i) => i.tag_key === c.key)}
                    onToggle={(resolved) => upsert(c.key, { resolved })}
                    onNotesBlur={(notes) => upsert(c.key, { notes })}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CheckRow({
  check,
  checklist,
  onToggle,
  onNotesBlur,
}: {
  check: TagCheck;
  checklist?: SeoChecklistItem;
  onToggle: (resolved: boolean) => void;
  onNotesBlur: (notes: string) => void;
}) {
  const [notes, setNotes] = useState(checklist?.notes ?? "");
  useEffect(() => {
    setNotes(checklist?.notes ?? "");
  }, [checklist?.notes]);

  const resolved = !!checklist?.resolved;
  const effectiveLevel = resolved && check.level !== "ok" ? "ok" : check.level;
  const Icon =
    effectiveLevel === "ok" ? CheckCircle2 : effectiveLevel === "warn" ? AlertTriangle : XCircle;
  const tone =
    effectiveLevel === "ok"
      ? "text-emerald-700 border-emerald-200 bg-emerald-50"
      : effectiveLevel === "warn"
      ? "text-amber-800 border-amber-200 bg-amber-50"
      : "text-red-800 border-red-200 bg-red-50";
  return (
    <div className={`rounded border p-3 ${tone}`}>
      <div className="flex items-start gap-2">
        <Icon className="h-4 w-4 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <code className="text-xs font-mono">{check.label}</code>
            <span className="text-[11px]">{check.msg}</span>
            {resolved && checklist?.resolved_at && (
              <Badge variant="outline" className="text-[10px]">
                Resolvido em {new Date(checklist.resolved_at).toLocaleString("pt-BR")}
              </Badge>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
            <div>
              <div className="text-[10px] uppercase tracking-wide opacity-70">Esperado</div>
              <div className="font-mono break-all whitespace-pre-wrap bg-background/60 rounded px-2 py-1 border">
                {check.expected}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide opacity-70">Encontrado</div>
              <div className="font-mono break-all whitespace-pre-wrap bg-background/60 rounded px-2 py-1 border">
                {check.found}
              </div>
            </div>
          </div>

          {check.level !== "ok" || resolved ? (
            <div className="flex items-start gap-2 pt-1">
              <label className="flex items-center gap-2 text-xs cursor-pointer whitespace-nowrap pt-2">
                <Checkbox
                  checked={resolved}
                  onCheckedChange={(v) => onToggle(v === true)}
                />
                Resolvido
              </label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={() => {
                  if ((checklist?.notes ?? "") !== notes) onNotesBlur(notes);
                }}
                placeholder="Observações da correção (opcional)…"
                className="min-h-[40px] text-xs bg-background/60"
                rows={2}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
