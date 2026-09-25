import { useState, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useImoveis } from "@/hooks/useImoveis";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Link2, CheckCircle, AlertTriangle, Package, X, Star, Trash2, ImageIcon } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { handleAiError } from "@/lib/ai/aiErrorHandler";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ImportState = "idle" | "extracting" | "preview" | "batch_detected" | "batch_importing" | "done";

export function ImportarViaLinkDialog({ open, onOpenChange }: Props) {
  const [url, setUrl] = useState("");
  const [state, setState] = useState<ImportState>("idle");
  const [extracted, setExtracted] = useState<any>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [coverIndex, setCoverIndex] = useState(0);
  const [removedPhotos, setRemovedPhotos] = useState<Set<number>>(new Set());
  const [photoInfo, setPhotoInfo] = useState<any>(null);
  const [uploadingManual, setUploadingManual] = useState(false);
  const { createImovel, refetch: refetchImoveis, uploadFotos } = useImoveis();
  const { imobiliariaId } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Batch state
  const [propertyUrls, setPropertyUrls] = useState<string[]>([]);
  const [batchProgress, setBatchProgress] = useState(0);
  const [batchTotal, setBatchTotal] = useState(0);
  const [batchSuccess, setBatchSuccess] = useState(0);
  const [batchErrors, setBatchErrors] = useState(0);
  const cancelRef = useRef(false);

  const reset = () => {
    setUrl("");
    setState("idle");
    setExtracted(null);
    setPhotoInfo(null);
    setError("");
    setSaving(false);
    setCoverIndex(0);
    setRemovedPhotos(new Set());
    setPropertyUrls([]);
    setBatchProgress(0);
    setBatchTotal(0);
    setBatchSuccess(0);
    setBatchErrors(0);
    cancelRef.current = false;
  };

  const handleExtract = async () => {
    if (!url.trim()) return;
    setState("extracting");
    setError("");
    setExtracted(null);
    setCoverIndex(0);
    setRemovedPhotos(new Set());
    try {
      const { invokeWithRetry } = await import("@/lib/retryExtracao");
      const { data, error: fnErr } = await invokeWithRetry(
        () => supabase.functions.invoke("extrair-dados-anuncio", { body: { url: url.trim() } }),
        { onRetry: ({ attempt, delayMs }) => console.warn(`[import-link] retry ${attempt} em ${Math.round(delayMs)}ms`) },
      );
      if (handleAiError(data, fnErr, navigate)) {
        setState("idle");
        return;
      }
      if (fnErr) {
        let payload: any = null;
        if ((fnErr as any)?.context?.json) {
          try { payload = await (fnErr as any).context.json(); } catch {}
        }
        const msg = payload?.error || fnErr.message;
        const parts = [msg];
        if (payload?.stage) parts.push(`[etapa: ${payload.stage}]`);
        if (payload?.http_status) parts.push(`[HTTP ${payload.http_status}]`);
        if (payload?.hint) parts.push(`\n💡 ${payload.hint}`);
        if (payload?.correlation_id) parts.push(`\nID: ${payload.correlation_id}`);
        throw new Error(parts.join(" "));
      }
      if (data?.error) {
        const parts = [data.error];
        if (data?.stage) parts.push(`[etapa: ${data.stage}]`);
        if (data?.http_status) parts.push(`[HTTP ${data.http_status}]`);
        if (data?.hint) parts.push(`\n💡 ${data.hint}`);
        if (data?.correlation_id) parts.push(`\nID: ${data.correlation_id}`);
        setError(parts.join(" "));
        setState("idle");
        return;
      }

      if (data?.is_listing && data?.property_urls?.length > 0) {
        setPropertyUrls(data.property_urls);
        setBatchTotal(data.property_urls.length);
        setState("batch_detected");
        return;
      }

      if (data?.dados) {
        setExtracted(normalizeExtractedData(data.dados));
        setPhotoInfo(data.photo_extraction || null);
        setState("preview");
      } else {
        setError("Não foi possível extrair dados deste anúncio.");
        setState("idle");
      }
    } catch (err: any) {
      setError(err.message || "Erro ao processar o link.");
      setState("idle");
    }
  };

  const getFilteredPhotos = () => {
    if (!extracted?.fotos) return [];
    return extracted.fotos.filter((_: string, i: number) => !removedPhotos.has(i));
  };

  const handleRemovePhoto = (idx: number) => {
    setRemovedPhotos(prev => {
      const next = new Set(prev);
      next.add(idx);
      return next;
    });
    // Adjust cover index if needed
    if (idx === coverIndex) {
      const remaining = extracted.fotos
        .map((_: string, i: number) => i)
        .filter((i: number) => !removedPhotos.has(i) && i !== idx);
      setCoverIndex(remaining[0] ?? 0);
    }
  };

  const handleSetCover = (idx: number) => {
    setCoverIndex(idx);
  };

  const handleSave = async () => {
    if (!extracted || !imobiliariaId) return;
    setSaving(true);
    try {
      const filteredPhotos = getFilteredPhotos();
      // Reorder photos so cover is first
      const originalCoverIdx = extracted.fotos.indexOf(filteredPhotos.find((_: string, i: number) => {
        // Find which filtered photo corresponds to the coverIndex in original array
        let count = 0;
        for (let j = 0; j < extracted.fotos.length; j++) {
          if (removedPhotos.has(j)) continue;
          if (j === coverIndex) return i === count;
          count++;
        }
        return false;
      }));
      
      // Simpler approach: reorder so the selected cover photo is first
      const coverPhoto = extracted.fotos[coverIndex];
      const orderedPhotos = coverPhoto
        ? [coverPhoto, ...filteredPhotos.filter((p: string) => p !== coverPhoto)]
        : filteredPhotos;

      const result = await createImovel({
        titulo: extracted.titulo || "Imóvel importado",
        tipo: extracted.tipo || "Apartamento",
        operacao: extracted.operacao || "Venda",
        bairro: extracted.bairro || null,
        cidade: extracted.cidade || "Brasília",
        estado: extracted.estado || "DF",
        cep: extracted.cep || null,
        endereco: extracted.endereco || null,
        preco: extracted.preco || 0,
        area: extracted.area || 0,
        quartos: extracted.quartos || 0,
        suites: extracted.suites || 0,
        banheiros: extracted.banheiros || 0,
        vagas: extracted.vagas || 0,
        valor_condominio: extracted.valor_condominio || 0,
        valor_iptu: extracted.valor_iptu || 0,
        andar: extracted.andar || null,
        descricao: sanitizeImportedDescription(extracted.descricao),
        status: "Ativo",
        fotos: orderedPhotos,
        foto_capa_index: 0, // Cover is always first after reorder
      });
      if (result) {
        toast({ title: "Imóvel importado com sucesso!" });
        onOpenChange(false);
        reset();
      }
    } catch {
      toast({ title: "Erro ao salvar imóvel", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleBatchImport = useCallback(async () => {
    if (!imobiliariaId || propertyUrls.length === 0) return;
    cancelRef.current = false;
    setState("batch_importing");
    setBatchProgress(0);
    setBatchSuccess(0);
    setBatchErrors(0);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < propertyUrls.length; i++) {
      if (cancelRef.current) break;

      const propUrl = propertyUrls[i];
      setBatchProgress(i + 1);

      try {
        const { invokeWithRetry } = await import("@/lib/retryExtracao");
        const { data, error: fnErr } = await invokeWithRetry(
          () => supabase.functions.invoke("extrair-dados-anuncio", { body: { url: propUrl, mode: "single" } }),
          { maxAttempts: 3, onRetry: ({ attempt, delayMs }) => console.warn(`[import-link-batch] retry ${attempt} em ${Math.round(delayMs)}ms`) },
        );


        // Se o gate de IA falhar, abortar o lote inteiro (não faz sentido continuar
        // tentando com a mesma conta sem IA/token inválido).
        if (data?.error_code === "no_ai_connected" || data?.error_code === "invalid_provider_token" || data?.error_code === "invalid_token") {
          handleAiError(data, fnErr, navigate);
          break;
        }

        if (fnErr || data?.error || !data?.dados) {
          console.warn(`Skipped: ${propUrl}`, fnErr || data?.error);
          errorCount++;
          setBatchErrors(errorCount);
          continue;
        }

        const normalized = normalizeExtractedData(data.dados);

        const result = await createImovel({
          titulo: normalized.titulo || "Imóvel importado",
          tipo: normalized.tipo || "Apartamento",
          operacao: normalized.operacao || "Venda",
          bairro: normalized.bairro || null,
          cidade: normalized.cidade || "Brasília",
          estado: normalized.estado || "DF",
          cep: normalized.cep || null,
          endereco: normalized.endereco || null,
          preco: normalized.preco || 0,
          area: normalized.area || 0,
          quartos: normalized.quartos || 0,
          suites: normalized.suites || 0,
          banheiros: normalized.banheiros || 0,
          vagas: normalized.vagas || 0,
          valor_condominio: normalized.valor_condominio || 0,
          valor_iptu: normalized.valor_iptu || 0,
          andar: normalized.andar || null,
          descricao: sanitizeImportedDescription(normalized.descricao),
          status: "Ativo",
          fotos: normalized.fotos?.length > 0 ? normalized.fotos : [],
        }, { silent: true });

        if (result) {
          successCount++;
          setBatchSuccess(successCount);
        } else {
          errorCount++;
          setBatchErrors(errorCount);
        }
      } catch (err) {
        console.error(`Error importing ${propUrl}:`, err);
        errorCount++;
        setBatchErrors(errorCount);
      }

      if (i < propertyUrls.length - 1 && !cancelRef.current) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    setState("done");
    await refetchImoveis();
    toast({
      title: `Importação concluída!`,
      description: `${successCount} importados, ${errorCount} com erro/duplicado${cancelRef.current ? " (cancelado)" : ""}`,
    });
  }, [imobiliariaId, propertyUrls, createImovel, refetchImoveis, toast]);

  const handleCancel = () => {
    cancelRef.current = true;
  };

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-primary" />
            Importar Imóvel via Link
          </DialogTitle>
          <DialogDescription>
            Cole o link de qualquer portal (OLX, ZAP, VivaReal, etc.). Se for uma página de listagem com múltiplos imóveis, todos serão importados automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto flex-1" style={{ WebkitOverflowScrolling: 'touch' }}>
          {/* URL Input */}
          {(state === "idle" || state === "extracting") && (
            <div>
              <Label>URL do anúncio ou listagem</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  placeholder="https://www.olx.com.br/..."
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  className="flex-1"
                  onKeyDown={e => e.key === "Enter" && handleExtract()}
                />
                <Button onClick={handleExtract} disabled={state === "extracting" || !url.trim()}>
                  {state === "extracting" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Extrair"}
                </Button>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Batch detected */}
          {state === "batch_detected" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20 text-primary text-sm">
                <Package className="w-5 h-5 shrink-0" />
                <div>
                  <p className="font-semibold">Página de listagem detectada!</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Encontramos <strong className="text-foreground">{propertyUrls.length}</strong> imóveis nesta página.
                  </p>
                </div>
              </div>

              <div className="max-h-40 overflow-y-auto rounded-lg border border-border bg-secondary/50 p-3 space-y-1">
                {propertyUrls.map((u, i) => (
                  <p key={i} className="text-xs text-muted-foreground truncate">
                    {i + 1}. {u}
                  </p>
                ))}
              </div>

              <div className="flex gap-2">
                <Button onClick={handleBatchImport} className="flex-1">
                  <Package className="w-4 h-4 mr-2" />
                  Importar todos ({propertyUrls.length})
                </Button>
                <Button variant="outline" onClick={reset}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {/* Batch importing */}
          {state === "batch_importing" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20 text-sm">
                <Loader2 className="w-5 h-5 animate-spin text-primary shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold text-foreground">Importando imóveis...</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {batchProgress} de {batchTotal} processados
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={handleCancel} className="shrink-0">
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <Progress value={(batchProgress / batchTotal) * 100} className="h-2" />

              <div className="flex gap-4 text-sm">
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-foreground font-medium">{batchSuccess}</span>
                  <span className="text-muted-foreground">importados</span>
                </div>
                {batchErrors > 0 && (
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-destructive" />
                    <span className="text-foreground font-medium">{batchErrors}</span>
                    <span className="text-muted-foreground">erros</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Done */}
          {state === "done" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-4 rounded-lg bg-success/10 border border-success/20 text-sm">
                <CheckCircle className="w-6 h-6 text-green-500 shrink-0" />
                <div>
                  <p className="font-semibold text-foreground">Importação concluída!</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {batchSuccess} imóveis importados com sucesso
                    {batchErrors > 0 ? `, ${batchErrors} com erro` : ""}
                  </p>
                </div>
              </div>
              <Button onClick={() => { reset(); onOpenChange(false); }} className="w-full">
                Fechar
              </Button>
            </div>
          )}

          {/* Single property preview */}
          {state === "preview" && extracted && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 rounded-lg bg-success/10 border border-success/20 text-success text-sm">
                <CheckCircle className="w-4 h-4 shrink-0" />
                Dados extraídos com sucesso! Confira e salve.
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground">Título</Label>
                  <p className="font-medium text-foreground">{extracted.titulo || "—"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Tipo</Label>
                  <p className="text-foreground">{extracted.tipo || "—"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Operação</Label>
                  <p className="text-foreground">{extracted.operacao || "—"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Preço</Label>
                  <p className="font-bold text-foreground">{formatCurrency(extracted.preco)}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Área</Label>
                  <p className="text-foreground">{extracted.area ? `${extracted.area}m²` : "—"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Quartos</Label>
                  <p className="text-foreground">{extracted.quartos ?? "—"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Banheiros</Label>
                  <p className="text-foreground">{extracted.banheiros ?? "—"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Vagas</Label>
                  <p className="text-foreground">{extracted.vagas ?? "—"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Bairro</Label>
                  <p className="text-foreground">{extracted.bairro || "—"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Cidade</Label>
                  <p className="text-foreground">{extracted.cidade || "—"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Estado</Label>
                  <p className="text-foreground">{extracted.estado || "—"}</p>
                </div>
              </div>

              {/* Photo gallery with cover selector — or manual upload fallback */}
              {extracted.fotos?.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5" />
                      Fotos do imóvel
                    </Label>
                    <Badge variant="secondary" className="text-[10px]">
                      {getFilteredPhotos().length} foto(s)
                    </Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Clique na ⭐ para escolher a foto de capa. Clique no 🗑️ para remover fotos indesejadas.
                  </p>
                  <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto rounded-lg border border-border p-2 bg-muted/30">
                    {extracted.fotos.map((foto: string, idx: number) => {
                      if (removedPhotos.has(idx)) return null;
                      const isCover = idx === coverIndex;
                      return (
                        <div
                          key={idx}
                          className={cn(
                            "relative group rounded-lg overflow-hidden border-2 transition-all cursor-pointer aspect-square",
                            isCover
                              ? "border-primary ring-2 ring-primary/30"
                              : "border-transparent hover:border-muted-foreground/30"
                          )}
                        >
                          <img
                            src={foto}
                            alt={`Foto ${idx + 1}`}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = "none";
                            }}
                          />
                          {isCover && (
                            <div className="absolute top-1 left-1">
                              <Badge className="text-[8px] px-1 py-0 bg-primary text-primary-foreground">
                                CAPA
                              </Badge>
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleSetCover(idx); }}
                              className={cn(
                                "p-1.5 rounded-full transition-colors",
                                isCover ? "bg-primary text-primary-foreground" : "bg-white/90 text-foreground hover:bg-primary hover:text-primary-foreground"
                              )}
                              title="Definir como capa"
                            >
                              <Star className="w-3.5 h-3.5" fill={isCover ? "currentColor" : "none"} />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleRemovePhoto(idx); }}
                              className="p-1.5 rounded-full bg-white/90 text-destructive hover:bg-destructive hover:text-white transition-colors"
                              title="Remover foto"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="space-y-2 rounded-lg border-2 border-dashed border-amber-400/50 bg-amber-50 dark:bg-amber-950/20 p-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                        Nenhuma foto foi extraída automaticamente
                      </p>
                      <p className="text-xs text-amber-800 dark:text-amber-300">
                        {photoInfo?.blocked
                          ? "O portal bloqueou a coleta de imagens (proteção anti-bot). Faça o upload manual das fotos abaixo."
                          : "Este anúncio não expôs as imagens publicamente (renderização 100% via JavaScript ou CDN protegido). Adicione as fotos manualmente para salvar o imóvel completo."}
                      </p>
                    </div>
                  </div>
                  <label className="flex items-center justify-center gap-2 w-full mt-2 py-3 rounded-md border border-amber-500/60 bg-white dark:bg-background hover:bg-amber-100 dark:hover:bg-amber-950/40 cursor-pointer transition-colors text-sm font-medium text-amber-900 dark:text-amber-100">
                    {uploadingManual ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                    <span>{uploadingManual ? "Enviando..." : "Escolher fotos do dispositivo"}</span>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      className="hidden"
                      disabled={uploadingManual}
                      onChange={async (e) => {
                        const files = Array.from(e.target.files || []);
                        if (files.length === 0) return;
                        setUploadingManual(true);
                        try {
                          const uploaded = await uploadFotos(files);
                          if (uploaded.length > 0) {
                            setExtracted((prev: any) => ({
                              ...prev,
                              fotos: [...(prev?.fotos || []), ...uploaded],
                            }));
                            setCoverIndex(0);
                            toast({ title: `${uploaded.length} foto(s) adicionada(s)` });
                          }
                        } finally {
                          setUploadingManual(false);
                          e.target.value = "";
                        }
                      }}
                    />
                  </label>
                  {photoInfo?.strategy_stats && (
                    <p className="text-[10px] text-amber-700 dark:text-amber-400 font-mono">
                      Estratégias tentadas: {Object.entries(photoInfo.strategy_stats).map(([k, v]) => `${k}=${v}`).join(" · ")}
                    </p>
                  )}
                </div>
              )}

              <Button onClick={handleSave} disabled={saving} className="w-full">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Salvar na Minha Carteira
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function normalizeExtractedData(data: any) {
  return {
    ...data,
    descricao: sanitizeImportedDescription(data?.descricao),
    fotos: Array.isArray(data?.fotos)
      ? Array.from(
          new Set(
            data.fotos.filter(
              (foto: unknown) => typeof foto === "string" && /^https?:\/\//i.test(foto),
            ),
          ),
        )
      : [],
  };
}

function sanitizeImportedDescription(value: unknown): string | null {
  if (value === null || value === undefined) return null;

  const cleaned = String(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gi, "$1")
    .replace(/https?:\/\/[^\s)]+/gi, " ")
    .replace(/\bwww\.[^\s]+/gi, " ")
    .replace(/\b(?:olx|zapimoveis|vivareal|imovelweb|wimoveis|quintoandar|netimoveis|chavenaomao|chavenamao)\b/gi, " ")
    .replace(/\b(?:url do an[uú]ncio|url do anuncio|link do im[oó]vel|copiar link|ver telefone|fale conosco|acesse o portal)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned.length >= 30 ? cleaned : null;
}
