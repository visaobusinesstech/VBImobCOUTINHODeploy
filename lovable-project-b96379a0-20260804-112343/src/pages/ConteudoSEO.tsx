import React, { useState, useCallback, useEffect, useMemo } from "react";
import { useTabPersistence } from "@/hooks/useTabPersistence";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Sparkles, Copy, Check, FileText, Globe, Tags, Megaphone, Save, Download, ArrowUpFromLine, History, Trash2, Layers, CheckCircle2, XCircle, Circle, Lock, Settings2, Layout, Send, List as ListIcon, CalendarClock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHeader, TableRow, TableHead } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import { useImoveis } from "@/hooks/useImoveis";
import { useConteudosSEO } from "@/hooks/useConteudosSEO";
import { exportConteudoSEOPDF } from "@/lib/exportConteudoSEO";
import { useImobiliariaConfig } from "@/hooks/useImobiliariaConfig";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { WordPressManager } from "@/components/seo/WordPressManager";
import { ArticleTypeManager } from "@/components/seo/ArticleTypeManager";
import { PostBlogManager } from "@/components/seo/PostBlogManager";
import { AutoPublicacaoConfigPanel } from "@/components/seo/AutoPublicacaoConfigPanel";
import { AgendamentoPostsPanel } from "@/components/seo/AgendamentoPostsPanel";
import { EdicaoMassaPostsPanel } from "@/components/seo/EdicaoMassaPostsPanel";
import { PreviewPostDialog } from "@/components/seo/PreviewPostDialog";
import { BulkEditPreviewDialog } from "@/components/seo/BulkEditPreviewDialog";
import EstrategiaBlogIAPanel from "@/components/seo/EstrategiaBlogIAPanel";
import { Eye, Brain } from "lucide-react";


function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Button variant="ghost" size="sm" onClick={handleCopy} className="gap-1">
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? "Copiado" : "Copiar"}
    </Button>
  );
}

function ResultBlock({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold text-muted-foreground uppercase">{label}</Label>
        <CopyButton text={value} />
      </div>
      <div className="p-3 rounded-lg bg-secondary/40 text-sm whitespace-pre-wrap">{value}</div>
    </div>
  );
}

interface ResultActionsProps {
  tipo: string;
  result: any;
  selectedImovel?: string;
  onSave: () => void;
  onApply?: () => void;
  onExport: () => void;
  saving?: boolean;
  applying?: boolean;
}

function ResultActions({ tipo, onSave, onApply, onExport, saving, applying }: ResultActionsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" onClick={onSave} disabled={saving} className="gap-1.5">
        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
        Salvar
      </Button>
      {onApply && (
        <Button variant="outline" size="sm" onClick={onApply} disabled={applying} className="gap-1.5">
          {applying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowUpFromLine className="w-3.5 h-3.5" />}
          Aplicar no Imóvel
        </Button>
      )}
      <Button variant="outline" size="sm" onClick={onExport} className="gap-1.5">
        <Download className="w-3.5 h-3.5" />
        Exportar PDF
      </Button>
    </div>
  );
}

// Tab 1: Descrições de Imóveis
function DescricaoImovelTab() {
  const { toast } = useToast();
  const { imoveis } = useImoveis();
  const { salvarConteudo } = useConteudosSEO();
  const config = useImobiliariaConfig();
  const [selectedImovel, setSelectedImovel] = useState("");
  const [tom, setTom] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleGenerate = async () => {
    const imovel = imoveis.find(i => i.id === selectedImovel);
    if (!imovel) { toast({ title: "Selecione um imóvel", variant: "destructive" }); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("gerar-conteudo-seo", {
        body: { tipo: "descricao_imovel", dados: { ...imovel, tom } },
      });
      if (error) throw error;
      if (data?.error) { toast({ title: "Erro", description: data.error, variant: "destructive" }); return; }
      setResult(data.conteudo);
    } catch (e: any) {
      toast({ title: "Erro ao gerar", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  const handleSave = async () => {
    const imovel = imoveis.find(i => i.id === selectedImovel);
    setSaving(true);
    await salvarConteudo({
      tipo: "descricao_imovel",
      titulo: result?.titulo_seo || imovel?.titulo || "Descrição SEO",
      conteudo: result,
      imovel_id: selectedImovel,
    });
    setSaving(false);
  };

  const handleApply = async () => {
    if (!selectedImovel || !result) return;
    setApplying(true);
    try {
      const updates: any = {};
      if (result.titulo_seo) updates.titulo = result.titulo_seo;
      if (result.descricao_completa) updates.descricao = result.descricao_completa;

      const { error } = await supabase.from("imoveis").update(updates).eq("id", selectedImovel);
      if (error) throw error;
      toast({ title: "Imóvel atualizado!", description: "Título e descrição foram aplicados ao imóvel." });
    } catch (e: any) {
      toast({ title: "Erro ao aplicar", description: e.message, variant: "destructive" });
    } finally { setApplying(false); }
  };

  const handleExport = () => {
    exportConteudoSEOPDF({ tipo: "descricao_imovel", conteudo: result, brandName: config?.nome_empresa });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Configurar</CardTitle>
          <CardDescription>Selecione o imóvel para gerar textos SEO</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Imóvel</Label>
            <Select value={selectedImovel} onValueChange={setSelectedImovel}>
              <SelectTrigger><SelectValue placeholder="Selecione um imóvel" /></SelectTrigger>
              <SelectContent>
                {imoveis.map(im => (
                  <SelectItem key={im.id} value={im.id}>{im.titulo} - {im.bairro || im.cidade}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tom da escrita (opcional)</Label>
            <Input value={tom} onChange={e => setTom(e.target.value)} placeholder="Ex: sofisticado, acolhedor, moderno..." />
          </div>
          <Button onClick={handleGenerate} disabled={loading || !selectedImovel} className="w-full gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Gerar Descrição SEO
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Resultado</CardTitle>
              <ResultActions
                tipo="descricao_imovel"
                result={result}
                selectedImovel={selectedImovel}
                onSave={handleSave}
                onApply={handleApply}
                onExport={handleExport}
                saving={saving}
                applying={applying}
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-4 max-h-[600px] overflow-y-auto">
            <ResultBlock label="Título SEO" value={result.titulo_seo} />
            <ResultBlock label="Meta Description" value={result.meta_description} />
            <ResultBlock label="Headline Anúncio" value={result.headline_anuncio} />
            <ResultBlock label="Descrição Curta" value={result.descricao_curta} />
            <ResultBlock label="Descrição Completa" value={result.descricao_completa} />
            {result.palavras_chave?.length > 0 && (
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-muted-foreground uppercase">Palavras-chave</Label>
                <div className="flex flex-wrap gap-1">
                  {result.palavras_chave.map((kw: string, i: number) => <Badge key={i} variant="secondary">{kw}</Badge>)}
                </div>
              </div>
            )}
            {result.hashtags?.length > 0 && (
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-muted-foreground uppercase">Hashtags</Label>
                <div className="flex flex-wrap gap-1">
                  {result.hashtags.map((h: string, i: number) => <Badge key={i} variant="outline">{h}</Badge>)}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Tab 2: Posts para Blog
function PostBlogTab() {
  return <PostBlogManager />;
}


// Tab 3: Meta Tags
function MetaTagsTab() {
  const { toast } = useToast();
  const { salvarConteudo } = useConteudosSEO();
  const config = useImobiliariaConfig();
  const [pagina, setPagina] = useState("");
  const [descricaoPagina, setDescricaoPagina] = useState("");
  const [cidade, setCidade] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleGenerate = async () => {
    if (!pagina.trim()) { toast({ title: "Informe o nome da página", variant: "destructive" }); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("gerar-conteudo-seo", {
        body: { tipo: "meta_tags", dados: { pagina, descricao_pagina: descricaoPagina, cidade, empresa } },
      });
      if (error) throw error;
      if (data?.error) { toast({ title: "Erro", description: data.error, variant: "destructive" }); return; }
      setResult(data.conteudo);
    } catch (e: any) {
      toast({ title: "Erro ao gerar", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  const handleSave = async () => {
    setSaving(true);
    await salvarConteudo({ tipo: "meta_tags", titulo: result?.title || pagina, conteudo: result });
    setSaving(false);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Configurar Meta Tags</CardTitle>
          <CardDescription>Informe os dados da página</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Nome/Tipo da página *</Label>
            <Input value={pagina} onChange={e => setPagina(e.target.value)} placeholder="Ex: Página de imóveis à venda em Águas Claras" />
          </div>
          <div>
            <Label>Descrição da página</Label>
            <Textarea value={descricaoPagina} onChange={e => setDescricaoPagina(e.target.value)} placeholder="Descreva o conteúdo principal da página..." rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Cidade</Label>
              <Input value={cidade} onChange={e => setCidade(e.target.value)} placeholder="Ex: Brasília" />
            </div>
            <div>
              <Label>Nome da empresa</Label>
              <Input value={empresa} onChange={e => setEmpresa(e.target.value)} placeholder="Ex: Radar Imóveis" />
            </div>
          </div>
          <Button onClick={handleGenerate} disabled={loading || !pagina.trim()} className="w-full gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Gerar Meta Tags
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Meta Tags Geradas</CardTitle>
              <ResultActions tipo="meta_tags" result={result} onSave={handleSave}
                onExport={() => exportConteudoSEOPDF({ tipo: "meta_tags", conteudo: result, brandName: config?.nome_empresa })}
                saving={saving} />
            </div>
          </CardHeader>
          <CardContent className="space-y-4 max-h-[600px] overflow-y-auto">
            <ResultBlock label="Title" value={result.title} />
            <ResultBlock label="Meta Description" value={result.meta_description} />
            <ResultBlock label="OG Title" value={result.og_title} />
            <ResultBlock label="OG Description" value={result.og_description} />
            <ResultBlock label="H1 Sugerido" value={result.h1_sugerido} />
            <ResultBlock label="Schema Type" value={result.schema_type} />
            <ResultBlock label="Canonical" value={result.canonical_sugestao} />
            {result.keywords?.length > 0 && (
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-muted-foreground uppercase">Keywords</Label>
                <div className="flex flex-wrap gap-1">
                  {result.keywords.map((kw: string, i: number) => <Badge key={i} variant="secondary">{kw}</Badge>)}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Tab 4: Textos para Portais
function TextoPortalTab() {
  const { toast } = useToast();
  const { imoveis } = useImoveis();
  const { salvarConteudo } = useConteudosSEO();
  const config = useImobiliariaConfig();
  const [selectedImovel, setSelectedImovel] = useState("");
  const [diferenciais, setDiferenciais] = useState("");
  const [tom, setTom] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleGenerate = async () => {
    const imovel = imoveis.find(i => i.id === selectedImovel);
    if (!imovel) { toast({ title: "Selecione um imóvel", variant: "destructive" }); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("gerar-conteudo-seo", {
        body: { tipo: "texto_portal", dados: { ...imovel, diferenciais, tom } },
      });
      if (error) throw error;
      if (data?.error) { toast({ title: "Erro", description: data.error, variant: "destructive" }); return; }
      setResult(data.conteudo);
    } catch (e: any) {
      toast({ title: "Erro ao gerar", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  const handleSave = async () => {
    const imovel = imoveis.find(i => i.id === selectedImovel);
    setSaving(true);
    await salvarConteudo({ tipo: "texto_portal", titulo: imovel?.titulo || "Textos para Portais", conteudo: result, imovel_id: selectedImovel });
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Configurar</CardTitle>
          <CardDescription>Selecione o imóvel para gerar textos adaptados a cada portal</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Imóvel</Label>
            <Select value={selectedImovel} onValueChange={setSelectedImovel}>
              <SelectTrigger><SelectValue placeholder="Selecione um imóvel" /></SelectTrigger>
              <SelectContent>
                {imoveis.map(im => (
                  <SelectItem key={im.id} value={im.id}>{im.titulo} - {im.bairro || im.cidade}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Diferenciais do imóvel</Label>
            <Textarea value={diferenciais} onChange={e => setDiferenciais(e.target.value)} placeholder="Ex: vista panorâmica, piscina, reformado, próximo ao metrô..." rows={2} />
          </div>
          <div>
            <Label>Tom (opcional)</Label>
            <Input value={tom} onChange={e => setTom(e.target.value)} placeholder="Ex: profissional, urgente, premium..." />
          </div>
          <Button onClick={handleGenerate} disabled={loading || !selectedImovel} className="w-full gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Gerar Textos para Portais
          </Button>
        </CardContent>
      </Card>

      {result?.portais && (
        <>
          <div className="flex justify-end">
            <ResultActions tipo="texto_portal" result={result} onSave={handleSave}
              onExport={() => exportConteudoSEOPDF({ tipo: "texto_portal", conteudo: result, brandName: config?.nome_empresa })}
              saving={saving} />
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {result.portais.map((p: any, i: number) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Globe className="w-4 h-4 text-primary" />
                    {p.portal}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground">Título</Label>
                      <CopyButton text={p.titulo} />
                    </div>
                    <p className="text-sm font-medium">{p.titulo}</p>
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground">Descrição</Label>
                      <CopyButton text={p.descricao} />
                    </div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{p.descricao}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {result?.dicas_publicacao?.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">💡 Dicas de Publicação</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {result.dicas_publicacao.map((d: string, i: number) => <li key={i}>• {d}</li>)}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Tab: Geração em Lote
type BatchStatus = "pending" | "generating" | "done" | "error";
interface BatchItem {
  imovelId: string;
  titulo: string;
  bairro: string;
  status: BatchStatus;
  result?: any;
  error?: string;
}

function GeracaoLoteTab() {
  const { toast } = useToast();
  const { imoveis } = useImoveis();
  const { salvarConteudo } = useConteudosSEO();
  const config = useImobiliariaConfig();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [tom, setTom] = useState("");
  const [autoSave, setAutoSave] = useState(true);
  const [autoApply, setAutoApply] = useState(false);
  const [running, setRunning] = useState(false);
  const [batch, setBatch] = useState<BatchItem[]>([]);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === imoveis.length) setSelected(new Set());
    else setSelected(new Set(imoveis.map(i => i.id)));
  };

  const progress = batch.length > 0
    ? Math.round((batch.filter(b => b.status === "done" || b.status === "error").length / batch.length) * 100)
    : 0;

  const handleStart = useCallback(async () => {
    if (selected.size === 0) { toast({ title: "Selecione ao menos um imóvel", variant: "destructive" }); return; }
    setRunning(true);

    const items: BatchItem[] = Array.from(selected).map(id => {
      const im = imoveis.find(i => i.id === id);
      return { imovelId: id, titulo: im?.titulo || "", bairro: im?.bairro || im?.cidade || "", status: "pending" as BatchStatus };
    });
    setBatch(items);

    for (let idx = 0; idx < items.length; idx++) {
      setBatch(prev => prev.map((b, i) => i === idx ? { ...b, status: "generating" } : b));

      const imovel = imoveis.find(i => i.id === items[idx].imovelId);
      try {
        const { data, error } = await supabase.functions.invoke("gerar-conteudo-seo", {
          body: { tipo: "descricao_imovel", dados: { ...imovel, tom } },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        const result = data.conteudo;

        if (autoSave) {
          await salvarConteudo({
            tipo: "descricao_imovel",
            titulo: result?.titulo_seo || imovel?.titulo || "SEO Lote",
            conteudo: result,
            imovel_id: items[idx].imovelId,
          });
        }

        if (autoApply && result) {
          const updates: any = {};
          if (result.titulo_seo) updates.titulo = result.titulo_seo;
          if (result.descricao_completa) updates.descricao = result.descricao_completa;
          await supabase.from("imoveis").update(updates).eq("id", items[idx].imovelId);
        }

        setBatch(prev => prev.map((b, i) => i === idx ? { ...b, status: "done", result } : b));
      } catch (e: any) {
        setBatch(prev => prev.map((b, i) => i === idx ? { ...b, status: "error", error: e.message } : b));
      }

      // Small delay to avoid rate limiting
      if (idx < items.length - 1) await new Promise(r => setTimeout(r, 1500));
    }

    setRunning(false);
    toast({ title: "Geração em lote concluída!", description: `${items.length} imóveis processados.` });
  }, [selected, imoveis, tom, autoSave, autoApply, salvarConteudo, toast]);

  const exportAll = () => {
    const done = batch.filter(b => b.status === "done" && b.result);
    done.forEach(b => {
      exportConteudoSEOPDF({ tipo: "descricao_imovel", conteudo: b.result, brandName: config?.nome_empresa });
    });
    toast({ title: `${done.length} PDF(s) exportados!` });
  };

  const statusIcon = (s: BatchStatus) => {
    switch (s) {
      case "pending": return <Circle className="w-4 h-4 text-muted-foreground" />;
      case "generating": return <Loader2 className="w-4 h-4 animate-spin text-primary" />;
      case "done": return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case "error": return <XCircle className="w-4 h-4 text-destructive" />;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Geração em Lote</CardTitle>
          <CardDescription>Selecione múltiplos imóveis para gerar descrições SEO automaticamente</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Tom da escrita (aplicado a todos)</Label>
            <Input value={tom} onChange={e => setTom(e.target.value)} placeholder="Ex: sofisticado, acolhedor, moderno..." disabled={running} />
          </div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={autoSave} onCheckedChange={(v) => setAutoSave(!!v)} disabled={running} />
              Salvar automaticamente no histórico
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={autoApply} onCheckedChange={(v) => setAutoApply(!!v)} disabled={running} />
              Aplicar título/descrição no imóvel
            </label>
          </div>

          <div className="border rounded-lg max-h-[300px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox checked={selected.size === imoveis.length && imoveis.length > 0} onCheckedChange={toggleAll} disabled={running} />
                  </TableHead>
                  <TableHead>Imóvel</TableHead>
                  <TableHead>Bairro/Cidade</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Operação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {imoveis.map(im => (
                  <TableRow key={im.id} className="cursor-pointer" onClick={() => !running && toggleSelect(im.id)}>
                    <TableCell>
                      <Checkbox checked={selected.has(im.id)} onCheckedChange={() => toggleSelect(im.id)} disabled={running} />
                    </TableCell>
                    <TableCell className="font-medium">{im.titulo}</TableCell>
                    <TableCell className="text-muted-foreground">{im.bairro || im.cidade || "-"}</TableCell>
                    <TableCell><Badge variant="outline">{im.tipo}</Badge></TableCell>
                    <TableCell><Badge variant="secondary">{im.operacao}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{selected.size} imóvel(is) selecionado(s)</span>
            <Button onClick={handleStart} disabled={running || selected.size === 0} className="gap-2">
              {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {running ? "Gerando..." : `Gerar SEO para ${selected.size} imóvel(is)`}
            </Button>
          </div>
        </CardContent>
      </Card>

      {batch.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Progresso</CardTitle>
              {!running && batch.some(b => b.status === "done") && (
                <Button variant="outline" size="sm" onClick={exportAll} className="gap-1.5">
                  <Download className="w-3.5 h-3.5" />
                  Exportar todos em PDF
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={progress} className="h-2" />
            <p className="text-sm text-muted-foreground text-center">{progress}% concluído</p>

            <div className="space-y-2">
              {batch.map((b, i) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-secondary/30">
                  {statusIcon(b.status)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{b.titulo}</p>
                    <p className="text-xs text-muted-foreground">{b.bairro}</p>
                  </div>
                  {b.status === "done" && (
                    <Button variant="ghost" size="sm" onClick={() => exportConteudoSEOPDF({ tipo: "descricao_imovel", conteudo: b.result, brandName: config?.nome_empresa })}>
                      <Download className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  {b.status === "error" && (
                    <span className="text-xs text-destructive truncate max-w-[200px]">{b.error}</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Tab 5: Histórico
interface SavedFiltro {
  id: string;
  nome: string;
  filtros: {
    search: string; tipo: string; status: string; cidade: string; bairro: string;
    dataDe: string; dataAte: string; campoData: "created_at" | "publicado_em"; ordem: "desc" | "asc" | "relevance";
  };
}

// Normalize for accent-insensitive matching
const normalizeSearch = (s: string) =>
  (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

// Escape regex special chars in a user-provided term
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Highlight matched terms in text (accent-insensitive)
function Highlight({ text, terms }: { text: string; terms: string[] }) {
  if (!text) return null;
  const active = terms.map(t => t.trim()).filter(t => t.length > 0);
  if (active.length === 0) return <>{text}</>;

  const normalizedText = normalizeSearch(text);
  const pattern = new RegExp(`(${active.map(t => escapeRegExp(normalizeSearch(t))).join("|")})`, "gi");

  const parts: React.ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(normalizedText)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    parts.push(
      <mark key={match.index} className="bg-yellow-200 dark:bg-yellow-500/40 text-foreground rounded px-0.5">
        {text.slice(match.index, match.index + match[0].length)}
      </mark>
    );
    last = match.index + match[0].length;
    if (match[0].length === 0) pattern.lastIndex++;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

// Build a contextual snippet around the first occurrence of any term.
// Returns null when no term matches — caller should fall back to the fixed summary.
function buildSnippet(text: string, terms: string[], radius = 90): string | null {
  if (!text) return null;
  const active = terms.map(t => t.trim()).filter(Boolean);
  if (!active.length) return null;
  const norm = normalizeSearch(text);
  let best = -1;
  for (const t of active) {
    const idx = norm.indexOf(normalizeSearch(t));
    if (idx !== -1 && (best === -1 || idx < best)) best = idx;
  }
  if (best === -1) return null;
  const start = Math.max(0, best - radius);
  const end = Math.min(text.length, best + radius);
  let snippet = text.slice(start, end).replace(/\s+/g, " ").trim();
  if (start > 0) snippet = "… " + snippet;
  if (end < text.length) snippet = snippet + " …";
  return snippet;
}

// Collect searchable text fields for snippet extraction (order = priority)
function collectSearchableText(c: any): string[] {
  const co = c?.conteudo || {};
  const bodyParts: string[] = [];
  if (typeof co.introducao === "string") bodyParts.push(co.introducao);
  if (Array.isArray(co.secoes)) {
    for (const s of co.secoes) {
      if (s?.titulo) bodyParts.push(s.titulo);
      if (typeof s?.conteudo === "string") bodyParts.push(s.conteudo);
      if (Array.isArray(s?.bullets)) bodyParts.push(s.bullets.join(". "));
    }
  }
  if (typeof co.conclusao === "string") bodyParts.push(co.conclusao);
  if (typeof co.descricao_completa === "string") bodyParts.push(co.descricao_completa);
  if (typeof co.descricao_curta === "string") bodyParts.push(co.descricao_curta);
  if (typeof co.meta_description === "string") bodyParts.push(co.meta_description);
  if (Array.isArray(co.portais)) {
    for (const p of co.portais) if (typeof p?.descricao === "string") bodyParts.push(p.descricao);
  }
  return [
    c?.titulo || "",
    c?.slug || "",
    c?.meta_description || "",
    bodyParts.join(" \n "),
  ].filter(Boolean);
}

// Compute a relevance score for a content item given search terms
// Weights: título=10, slug=6, meta=4, palavras-chave/tags=5, resto do JSON=1
function computeRelevance(item: any, terms: string[]): number {
  if (terms.length === 0) return 0;
  const titulo = normalizeSearch(item.titulo || "");
  const slug = normalizeSearch(item.slug || "");
  const meta = normalizeSearch(item.meta_description || "");
  const keywords = normalizeSearch(
    [item.conteudo?.palavras_chave, item.conteudo?.keywords, item.conteudo?.tags]
      .flat().filter(Boolean).join(" ")
  );
  const rest = normalizeSearch(JSON.stringify(item.conteudo || {}));

  const count = (h: string, n: string) => {
    if (!n || !h) return 0;
    let c = 0, i = 0;
    while ((i = h.indexOf(n, i)) !== -1) { c++; i += n.length; }
    return c;
  };

  let score = 0;
  for (const raw of terms) {
    const t = normalizeSearch(raw);
    if (!t) continue;
    score += count(titulo, t) * 10;
    score += count(slug, t) * 6;
    score += count(meta, t) * 4;
    score += count(keywords, t) * 5;
    score += count(rest, t) * 1;
    // Bonus: title starts with the term
    if (titulo.startsWith(t)) score += 15;
  }
  return score;
}

const FILTROS_STORAGE_KEY = "conteudo-seo:filtros-salvos";
const FILTRO_ATIVO_KEY = "conteudo-seo:filtro-ativo";

function HistoricoTab() {
  const { conteudos, loading, deletarConteudo, atualizarEmMassa, reverterEdicaoLote, excluirEmMassa } = useConteudosSEO();
  const config = useImobiliariaConfig();
  const { toast } = useToast();

  const tipoLabels: Record<string, string> = {
    descricao_imovel: "Descrição de Imóvel",
    post_blog: "Post Blog",
    meta_tags: "Meta Tags",
    texto_portal: "Portais",
  };

  const [search, setSearch] = useState("");
  const [tipo, setTipo] = useState("todos");
  const [status, setStatus] = useState("todos");
  const [cidade, setCidade] = useState("");
  const [bairro, setBairro] = useState("");
  const [dataDe, setDataDe] = useState("");
  const [dataAte, setDataAte] = useState("");
  const [campoData, setCampoData] = useState<"created_at" | "publicado_em">("created_at");
  const [ordem, setOrdem] = useState<"desc" | "asc" | "relevance">("relevance");
  const [somenteMatch, setSomenteMatch] = useState(false);

  // Bulk selection
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<"rascunho" | "publicado" | "">("");
  const [bulkCidade, setBulkCidade] = useState("");
  const [bulkBairro, setBulkBairro] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [previewPost, setPreviewPost] = useState<any | null>(null);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);

  const toggleSelecionado = (id: string) => {
    setSelecionados(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };




  const [salvos, setSalvos] = useState<SavedFiltro[]>([]);
  const [filtroAtivoId, setFiltroAtivoId] = useState<string>("");
  const [novoNome, setNovoNome] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(FILTROS_STORAGE_KEY);
      const list: SavedFiltro[] = raw ? JSON.parse(raw) : [];
      setSalvos(list);
      const ativo = localStorage.getItem(FILTRO_ATIVO_KEY) || "";
      const found = list.find(f => f.id === ativo);
      if (found) {
        setFiltroAtivoId(ativo);
        const f = found.filtros;
        setSearch(f.search); setTipo(f.tipo); setStatus(f.status);
        setCidade(f.cidade); setBairro(f.bairro); setDataDe(f.dataDe);
        setDataAte(f.dataAte); setCampoData(f.campoData); setOrdem(f.ordem);
      }
    } catch { /* ignore */ }
  }, []);

  const persistSalvos = (list: SavedFiltro[]) => {
    setSalvos(list);
    try { localStorage.setItem(FILTROS_STORAGE_KEY, JSON.stringify(list)); } catch { /* ignore */ }
  };

  const currentFiltros = () => ({ search, tipo, status, cidade, bairro, dataDe, dataAte, campoData, ordem });

  const salvarFiltroAtual = () => {
    const nome = novoNome.trim();
    if (!nome) { toast({ title: "Informe um nome para o conjunto de filtros", variant: "destructive" }); return; }
    const novo: SavedFiltro = { id: crypto.randomUUID(), nome, filtros: currentFiltros() };
    persistSalvos([...salvos, novo]);
    setFiltroAtivoId(novo.id);
    try { localStorage.setItem(FILTRO_ATIVO_KEY, novo.id); } catch { /* ignore */ }
    setNovoNome("");
    toast({ title: "Filtro salvo", description: `"${nome}" pronto para reutilizar.` });
  };

  const atualizarFiltroAtivo = () => {
    if (!filtroAtivoId) return;
    const atual = salvos.find(s => s.id === filtroAtivoId);
    if (!atual) return;
    persistSalvos(salvos.map(s => s.id === filtroAtivoId ? { ...s, filtros: currentFiltros() } : s));
    toast({ title: "Filtro atualizado", description: `"${atual.nome}" foi sobrescrito.` });
  };

  const aplicarFiltro = (id: string) => {
    if (!id || id === "__none__") {
      setFiltroAtivoId("");
      try { localStorage.removeItem(FILTRO_ATIVO_KEY); } catch { /* ignore */ }
      return;
    }
    const found = salvos.find(s => s.id === id);
    if (!found) return;
    const f = found.filtros;
    setSearch(f.search); setTipo(f.tipo); setStatus(f.status);
    setCidade(f.cidade); setBairro(f.bairro); setDataDe(f.dataDe);
    setDataAte(f.dataAte); setCampoData(f.campoData); setOrdem(f.ordem);
    setFiltroAtivoId(id);
    try { localStorage.setItem(FILTRO_ATIVO_KEY, id); } catch { /* ignore */ }
  };

  const excluirFiltro = (id: string) => {
    persistSalvos(salvos.filter(s => s.id !== id));
    if (filtroAtivoId === id) {
      setFiltroAtivoId("");
      try { localStorage.removeItem(FILTRO_ATIVO_KEY); } catch { /* ignore */ }
    }
    toast({ title: "Filtro removido" });
  };

  const tiposDisponiveis = useMemo(
    () => Array.from(new Set(conteudos.map((c: any) => c.tipo))),
    [conteudos]
  );

  // Parse operators: "frase exata", -excluir, termos soltos.
  // Retorna termos positivos (include), frases exatas (phrases) e exclusões (exclude).
  const parsedQuery = useMemo(() => {
    const include: string[] = [];
    const phrases: string[] = [];
    const exclude: string[] = [];
    const src = search || "";
    // 1) extrair frases entre aspas (curvas ou retas), com prefixo opcional "-"
    const re = /(-)?"([^"]+)"|(-)?“([^”]+)”/g;
    let m: RegExpExecArray | null;
    let remaining = src;
    const replaced: string[] = [];
    while ((m = re.exec(src)) !== null) {
      const neg = m[1] || m[3];
      const phrase = (m[2] || m[4] || "").trim();
      if (!phrase) continue;
      if (neg) exclude.push(phrase);
      else phrases.push(phrase);
      replaced.push(m[0]);
    }
    for (const r of replaced) remaining = remaining.replace(r, " ");
    // 2) tokens restantes
    for (const rawTok of remaining.split(/\s+/)) {
      const tok = rawTok.trim();
      if (!tok) continue;
      if (tok.startsWith("-") && tok.length > 1) exclude.push(tok.slice(1));
      else if (tok.length >= 2) include.push(tok);
    }
    return { include, phrases, exclude };
  }, [search]);

  // Termos usados para highlight/relevance: positivos + frases + cidade/bairro
  const searchTerms = useMemo(() => {
    const extras = [cidade, bairro].map(s => s.trim()).filter(t => t.length >= 2);
    return [...parsedQuery.phrases, ...parsedQuery.include, ...extras];
  }, [parsedQuery, cidade, bairro]);

  const filtered = useMemo(() => {
    const c1 = normalizeSearch(cidade.trim());
    const b1 = normalizeSearch(bairro.trim());
    const de = dataDe ? new Date(dataDe + "T00:00:00").getTime() : null;
    const ate = dataAte ? new Date(dataAte + "T23:59:59").getTime() : null;

    const includeN = parsedQuery.include.map(normalizeSearch).filter(Boolean);
    const phrasesN = parsedQuery.phrases.map(normalizeSearch).filter(Boolean);
    const excludeN = parsedQuery.exclude.map(normalizeSearch).filter(Boolean);

    const list = conteudos.filter((c: any) => {
      if (tipo !== "todos" && c.tipo !== tipo) return false;
      if (status !== "todos" && (c.status || "rascunho") !== status) return false;

      const dref = c[campoData] ? new Date(c[campoData]).getTime() : null;
      if (de && (!dref || dref < de)) return false;
      if (ate && (!dref || dref > ate)) return false;

      const haystack = normalizeSearch(
        `${c.titulo || ""} ${c.slug || ""} ${c.meta_description || ""} ${JSON.stringify(c.conteudo || {})}`
      );

      // exclusões: qualquer match reprova
      for (const ex of excludeN) if (haystack.includes(ex)) return false;
      // frases exatas obrigatórias
      for (const ph of phrasesN) if (!haystack.includes(ph)) return false;
      // termos positivos: todos devem existir (AND)
      for (const t of includeN) if (!haystack.includes(t)) return false;

      if (c1 && !haystack.includes(c1)) return false;
      if (b1 && !haystack.includes(b1)) return false;
      return true;
    });

    // Attach relevance score
    const scored = list.map((c: any) => ({ ...c, __score: computeRelevance(c, searchTerms) }));

    const hasQuery = searchTerms.length > 0 || (parsedQuery?.phrases?.length ?? 0) > 0;
    const filteredByMatch = somenteMatch && hasQuery ? scored.filter((c: any) => c.__score > 0) : scored;

    filteredByMatch.sort((a: any, b: any) => {
      if (ordem === "relevance") {
        if (b.__score !== a.__score) return b.__score - a.__score;
        return new Date(b[campoData] || b.created_at).getTime() - new Date(a[campoData] || a.created_at).getTime();
      }
      const av = new Date(a[campoData] || a.created_at).getTime();
      const bv = new Date(b[campoData] || b.created_at).getTime();
      return ordem === "desc" ? bv - av : av - bv;
    });
    return filteredByMatch;
  }, [conteudos, parsedQuery, tipo, status, cidade, bairro, dataDe, dataAte, campoData, ordem, searchTerms, somenteMatch]);


  const limpar = () => {
    setSearch(""); setTipo("todos"); setStatus("todos"); setCidade("");
    setBairro(""); setDataDe(""); setDataAte(""); setCampoData("created_at"); setOrdem("relevance"); setSomenteMatch(false);
    setFiltroAtivoId("");
    try { localStorage.removeItem(FILTRO_ATIVO_KEY); } catch { /* ignore */ }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="text-base">Filtros</CardTitle>
              <CardDescription>Refine por status, cidade/bairro, palavra-chave e data.</CardDescription>
            </div>
            <div className="flex items-end gap-2 flex-wrap">
              <div className="min-w-[200px]">
                <Label className="text-xs">Filtros salvos</Label>
                <Select value={filtroAtivoId || "__none__"} onValueChange={aplicarFiltro}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Nenhum —</SelectItem>
                    {salvos.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {filtroAtivoId && (
                <>
                  <Button variant="outline" size="sm" onClick={atualizarFiltroAtivo} className="gap-1.5">
                    <Save className="w-3.5 h-3.5" /> Atualizar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => excluirFiltro(filtroAtivoId)} className="gap-1.5 text-destructive">
                    <Trash2 className="w-3.5 h-3.5" /> Excluir
                  </Button>
                </>
              )}
              <div className="flex items-end gap-1">
                <div>
                  <Label className="text-xs">Salvar como</Label>
                  <Input
                    value={novoNome}
                    onChange={e => setNovoNome(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") salvarFiltroAtual(); }}
                    placeholder="Nome do filtro"
                    className="h-9 w-[180px]"
                  />
                </div>
                <Button size="sm" onClick={salvarFiltroAtual} className="gap-1.5">
                  <Save className="w-3.5 h-3.5" /> Salvar
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="md:col-span-2">
              <Label className="text-xs">Palavra-chave</Label>
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder='ex.: "aluguel brasília" -kitnet financiamento' title='Operadores: "frase exata" para busca literal, -palavra para excluir, termos soltos combinam com AND' />
              <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                <input type="checkbox" checked={somenteMatch} onChange={e => setSomenteMatch(e.target.checked)} className="h-3.5 w-3.5" />
                Somente posts com correspondência à busca
              </label>
            </div>
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {tiposDisponiveis.map((t: string) => (
                    <SelectItem key={t} value={t}>{tipoLabels[t] || t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="rascunho">Rascunho</SelectItem>
                  <SelectItem value="publicado">Publicado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <div>
              <Label className="text-xs">Cidade</Label>
              <Input value={cidade} onChange={e => setCidade(e.target.value)} placeholder="Ex: Brasília" />
            </div>
            <div>
              <Label className="text-xs">Bairro</Label>
              <Input value={bairro} onChange={e => setBairro(e.target.value)} placeholder="Ex: Águas Claras" />
            </div>
            <div>
              <Label className="text-xs">Campo de data</Label>
              <Select value={campoData} onValueChange={(v: any) => setCampoData(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="created_at">Criação</SelectItem>
                  <SelectItem value="publicado_em">Publicação</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Ordenação</Label>
              <Select value={ordem} onValueChange={(v: any) => setOrdem(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="relevance">Relevância</SelectItem>
                  <SelectItem value="desc">Mais recentes</SelectItem>
                  <SelectItem value="asc">Mais antigos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-4 items-end">
            <div>
              <Label className="text-xs">De</Label>
              <Input type="date" value={dataDe} onChange={e => setDataDe(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Até</Label>
              <Input type="date" value={dataAte} onChange={e => setDataAte(e.target.value)} />
            </div>
            <div className="md:col-span-2 flex gap-2 justify-end">
              <span className="text-xs text-muted-foreground self-center mr-auto">
                {filtered.length} de {conteudos.length} resultado{conteudos.length === 1 ? "" : "s"}
              </span>
              <Button variant="outline" size="sm" onClick={limpar}>Limpar filtros</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk actions bar */}
      {filtered.length > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-3">
            <div className="flex flex-wrap items-center gap-2">
              <Checkbox
                checked={selecionados.size > 0 && filtered.every((c: any) => selecionados.has(c.id))}
                onCheckedChange={(v) => {
                  if (v) setSelecionados(new Set(filtered.map((c: any) => c.id)));
                  else setSelecionados(new Set());
                }}
              />
              <span className="text-xs font-medium">
                {selecionados.size} selecionado{selecionados.size === 1 ? "" : "s"}
              </span>
              {selecionados.size > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setSelecionados(new Set())} className="h-7 text-xs">
                  Limpar
                </Button>
              )}
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <Select value={bulkStatus || "__none__"} onValueChange={(v: any) => setBulkStatus(v === "__none__" ? "" : v)}>
                  <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue placeholder="Status..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— sem alterar —</SelectItem>
                    <SelectItem value="rascunho">Rascunho</SelectItem>
                    <SelectItem value="publicado">Publicado</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  value={bulkCidade}
                  onChange={(e) => setBulkCidade(e.target.value)}
                  placeholder="Cidade"
                  className="h-8 w-[130px] text-xs"
                />
                <Input
                  value={bulkBairro}
                  onChange={(e) => setBulkBairro(e.target.value)}
                  placeholder="Bairro"
                  className="h-8 w-[130px] text-xs"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={bulkLoading || selecionados.size === 0}
                  onClick={() => setBulkModalOpen(true)}
                  title="Abrir editor em lote com pré-visualização"
                >
                  <Layers className="w-3.5 h-3.5 mr-1" /> Editar em lote…
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={bulkLoading || selecionados.size === 0 || (!bulkStatus && !bulkCidade.trim() && !bulkBairro.trim())}
                  onClick={async () => {
                    setBulkLoading(true);
                    const patch: any = {};
                    if (bulkStatus) patch.status = bulkStatus;
                    if (bulkCidade.trim()) patch.cidade = bulkCidade.trim();
                    if (bulkBairro.trim()) patch.bairro = bulkBairro.trim();
                    await atualizarEmMassa(Array.from(selecionados), patch);
                    setBulkLoading(false);
                  }}
                >
                  {bulkLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Aplicar
                </Button>
                <Button
                  size="sm"
                  disabled={bulkLoading || selecionados.size === 0}
                  onClick={async () => {
                    setBulkLoading(true);
                    await atualizarEmMassa(Array.from(selecionados), { status: "publicado", publicado_em: new Date().toISOString() });
                    setBulkLoading(false);
                  }}
                >
                  <Send className="w-3.5 h-3.5 mr-1" /> Publicar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={bulkLoading || selecionados.size === 0}
                  onClick={async () => {
                    setBulkLoading(true);
                    await atualizarEmMassa(Array.from(selecionados), { status: "rascunho", publicado_em: null });
                    setBulkLoading(false);
                  }}
                >
                  <XCircle className="w-3.5 h-3.5 mr-1" /> Despublicar
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={bulkLoading || selecionados.size === 0}
                  onClick={async () => {
                    if (!window.confirm(`Excluir ${selecionados.size} registro(s)?`)) return;
                    setBulkLoading(true);
                    const { ok } = await excluirEmMassa(Array.from(selecionados));
                    if (ok) setSelecionados(new Set());
                    setBulkLoading(false);
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}



      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <History className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>Nenhum conteúdo corresponde aos filtros.</p>
          </CardContent>
        </Card>
      ) : (
        filtered.map((c: any) => (
          <Card key={c.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Checkbox
                    checked={selecionados.has(c.id)}
                    onCheckedChange={() => toggleSelecionado(c.id)}
                  />
                  <Badge variant="secondary">{tipoLabels[c.tipo] || c.tipo}</Badge>
                  <Badge variant={(c.status || "rascunho") === "publicado" ? "default" : "outline"}>
                    {c.status || "rascunho"}
                  </Badge>
                  {searchTerms.length > 0 && c.__score > 0 && (
                    <Badge variant="outline" className="border-primary/40 text-primary" title="Pontuação de relevância">
                      ★ {c.__score}
                    </Badge>
                  )}
                  <CardTitle className="text-base">
                    <Highlight text={c.titulo || ""} terms={searchTerms} />
                  </CardTitle>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">
                    {c.publicado_em
                      ? `Pub. ${format(new Date(c.publicado_em), "dd/MM/yy HH:mm", { locale: ptBR })}`
                      : format(new Date(c.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => setPreviewPost(c)} title="Preview">
                    <Eye className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => exportConteudoSEOPDF({ tipo: c.tipo, conteudo: c.conteudo, brandName: config?.nome_empresa })}>
                    <Download className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => deletarConteudo(c.id)} className="text-destructive hover:text-destructive">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {(() => {
                const fallback =
                  (c.tipo === "descricao_imovel" && c.conteudo?.descricao_curta) ||
                  (c.tipo === "post_blog" && c.conteudo?.introducao) ||
                  (c.tipo === "meta_tags" && c.conteudo?.meta_description) ||
                  (c.tipo === "texto_portal" && c.conteudo?.portais?.[0]?.descricao) ||
                  "";
                let snippet: string | null = null;
                if (searchTerms.length > 0) {
                  for (const src of collectSearchableText(c)) {
                    snippet = buildSnippet(src, searchTerms);
                    if (snippet) break;
                  }
                }
                const showingSnippet = !!snippet;
                return (
                  <div className={`text-sm ${showingSnippet ? "text-foreground" : "text-muted-foreground line-clamp-3"}`}>
                    {showingSnippet && (
                      <span className="text-[10px] uppercase tracking-wide text-primary/70 mr-1 font-medium">
                        Trecho ·
                      </span>
                    )}
                    <Highlight text={snippet || fallback} terms={searchTerms} />
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        ))
      )}

      <PreviewPostDialog
        open={!!previewPost}
        onOpenChange={(v) => { if (!v) setPreviewPost(null); }}
        post={previewPost}
        brandName={config?.nome_empresa}
        onSave={async ({ titulo, slug, meta_description }) => {
          if (!previewPost?.id) return;
          // Snapshot: guarda a versão ANTERIOR antes de sobrescrever, para permitir revert.
          const mudou =
            (previewPost.titulo || "") !== titulo ||
            (previewPost.slug || "") !== slug ||
            (previewPost.meta_description || "") !== meta_description;
          if (mudou && previewPost.imobiliaria_id) {
            const { data: authData } = await supabase.auth.getUser();
            await supabase.from("conteudos_seo_versoes").insert({
              conteudo_id: previewPost.id,
              imobiliaria_id: previewPost.imobiliaria_id,
              titulo: previewPost.titulo ?? null,
              slug: previewPost.slug ?? null,
              meta_description: previewPost.meta_description ?? null,
              origem: "edicao_manual",
              criado_por: authData?.user?.id ?? null,
            });
          }
          const { error } = await supabase
            .from("conteudos_seo")
            .update({ titulo, slug, meta_description, updated_at: new Date().toISOString() })
            .eq("id", previewPost.id);
          if (error) {
            toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
            return;
          }
          toast({ title: "Alterações salvas", description: "Versão anterior salva no histórico." });
          setPreviewPost({ ...previewPost, titulo, slug, meta_description });
        }}
        onTogglePublish={async (novoStatus) => {
          if (!previewPost?.id) return;
          const patch: any = {
            status: novoStatus,
            publicado_em: novoStatus === "publicado" ? new Date().toISOString() : null,
            updated_at: new Date().toISOString(),
          };
          const { error } = await supabase.from("conteudos_seo").update(patch).eq("id", previewPost.id);
          if (error) {
            toast({ title: "Erro ao atualizar publicação", description: error.message, variant: "destructive" });
            return;
          }
          toast({
            title: novoStatus === "publicado" ? "Post publicado" : "Post despublicado",
            description: novoStatus === "publicado" ? "Está visível agora." : "Voltou para rascunho.",
          });
          setPreviewPost({ ...previewPost, ...patch });
        }}
      />

      <BulkEditPreviewDialog
        open={bulkModalOpen}
        onOpenChange={setBulkModalOpen}
        loading={bulkLoading}
        registros={conteudos.filter((c: any) => selecionados.has(c.id)).map((c: any) => ({
          id: c.id, titulo: c.titulo, status: c.status, cidade: c.cidade, bairro: c.bairro,
        }))}
        onConfirm={async (patch) => {
          setBulkLoading(true);
          const ids = Array.from(selecionados);
          // snapshot dos campos que serão alterados, para permitir desfazer
          const camposAlterados = Object.keys(patch);
          const snapshots = conteudos
            .filter((c: any) => selecionados.has(c.id))
            .map((c: any) => {
              const snap: any = { id: c.id };
              if (camposAlterados.includes("status")) snap.status = c.status ?? null;
              if (camposAlterados.includes("publicado_em")) snap.publicado_em = c.publicado_em ?? null;
              if (camposAlterados.includes("cidade")) snap.cidade = c.cidade ?? null;
              if (camposAlterados.includes("bairro")) snap.bairro = c.bairro ?? null;
              return snap;
            });
          const { ok } = await atualizarEmMassa(ids, patch);
          setBulkLoading(false);
          if (ok) {
            setBulkModalOpen(false);
            sonnerToast.success(`Edição em lote aplicada em ${ok} registro(s)`, {
              description: "Você tem 15 segundos para desfazer.",
              duration: 15000,
              action: {
                label: "Desfazer",
                onClick: async () => {
                  await reverterEdicaoLote(snapshots);
                },
              },
            });
          }
        }}
      />
    </div>
  );
}


export default function ConteudoSEO() {
  const { plano, isMaster, trialDaysLeft, trialExpired } = useAuth();
  const inTrial = plano === "gratuito" && !trialExpired && trialDaysLeft !== null && trialDaysLeft > 0;
  const [seoTab, setSeoTab] = useTabPersistence("conteudoseo_active_tab", "descricao");
  const temAcesso = isMaster || ["profissional", "premium"].includes(plano) || inTrial;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Conteúdo SEO com IA</h1>
          <p className="text-muted-foreground">Gere textos otimizados para buscadores e portais imobiliários</p>
        </div>

        {!temAcesso ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center space-y-3">
            <Lock className="w-10 h-10 text-muted-foreground mx-auto" />
            <h3 className="text-lg font-semibold text-foreground">Funcionalidade exclusiva do plano PRO</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              O módulo de Conteúdo SEO com IA está disponível a partir do plano Corretor PRO.
              Solicite o upgrade ao administrador para desbloquear.
            </p>
          </div>
        ) : (
          <Tabs value={seoTab} onValueChange={setSeoTab} className="space-y-4">
            <TabsList className="grid w-full grid-cols-3 lg:grid-cols-10">
              <TabsTrigger value="descricao" className="gap-1.5"><FileText className="w-3.5 h-3.5" />Imóveis</TabsTrigger>
              <TabsTrigger value="lote" className="gap-1.5"><Layers className="w-3.5 h-3.5" />Lote</TabsTrigger>
              <TabsTrigger value="blog" className="gap-1.5"><Globe className="w-3.5 h-3.5" />Blog</TabsTrigger>
              <TabsTrigger value="estrategia" className="gap-1.5"><Brain className="w-3.5 h-3.5" />Estratégia IA</TabsTrigger>
              <TabsTrigger value="sites" className="gap-1.5"><Settings2 className="w-3.5 h-3.5" />Sites</TabsTrigger>
              <TabsTrigger value="modelos" className="gap-1.5"><Layout className="w-3.5 h-3.5" />Modelos</TabsTrigger>
              <TabsTrigger value="metatags" className="gap-1.5"><Tags className="w-3.5 h-3.5" />Meta Tags</TabsTrigger>
              <TabsTrigger value="portais" className="gap-1.5"><Megaphone className="w-3.5 h-3.5" />Portais</TabsTrigger>
              <TabsTrigger value="autopub" className="gap-1.5"><Send className="w-3.5 h-3.5" />Auto-publicação</TabsTrigger>
              <TabsTrigger value="agendamento" className="gap-1.5"><CalendarClock className="w-3.5 h-3.5" />Agendamento</TabsTrigger>
              <TabsTrigger value="edicaomassa" className="gap-1.5"><ListIcon className="w-3.5 h-3.5" />Edição em massa</TabsTrigger>
              <TabsTrigger value="historico" className="gap-1.5"><History className="w-3.5 h-3.5" />Histórico</TabsTrigger>
            </TabsList>

            <TabsContent value="descricao"><DescricaoImovelTab /></TabsContent>
            <TabsContent value="lote"><GeracaoLoteTab /></TabsContent>
            <TabsContent value="blog"><PostBlogTab /></TabsContent>
            <TabsContent value="estrategia"><EstrategiaBlogIAPanel /></TabsContent>
            <TabsContent value="sites"><WordPressManager /></TabsContent>
            <TabsContent value="modelos"><ArticleTypeManager /></TabsContent>
            <TabsContent value="metatags"><MetaTagsTab /></TabsContent>
            <TabsContent value="portais"><TextoPortalTab /></TabsContent>
            <TabsContent value="autopub"><AutoPublicacaoConfigPanel /></TabsContent>
            <TabsContent value="agendamento"><AgendamentoPostsPanel /></TabsContent>
            <TabsContent value="edicaomassa"><EdicaoMassaPostsPanel /></TabsContent>
            <TabsContent value="historico"><HistoricoTab /></TabsContent>
          </Tabs>

        )}
      </div>
    </DashboardLayout>
  );
}
