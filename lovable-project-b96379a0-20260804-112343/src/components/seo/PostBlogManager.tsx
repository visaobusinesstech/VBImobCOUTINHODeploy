
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Loader2, Sparkles, Send, Globe, Layout, 
  Plus, Trash2, StopCircle, CheckCircle2, 
  XCircle, Link as LinkIcon, FileText, 
  Quote, List as ListIcon, Image as ImageIcon,
  AlertTriangle, RotateCcw
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useConteudosSEO } from "@/hooks/useConteudosSEO";

interface QueueItem {
  id: string;
  titulo: string;
  lang: string;
  status: "pending" | "generating" | "done" | "error";
  error?: string;
  result?: any;
}

export function PostBlogManager() {
  const { toast } = useToast();
  const { salvarConteudo } = useConteudosSEO();
  
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [currentInput, setCurrentInput] = useState("");
  const [selectedItem, setSelectedItem] = useState<QueueItem | null>(null);
  
  const [sites, setSites] = useState<any[]>([]);
  const [selectedSite, setSelectedSite] = useState<string>("");
  const [articleTypes, setArticleTypes] = useState<any[]>([]);
  const [selectedArticleType, setSelectedArticleType] = useState<string>("default");
  const [hasKeys, setHasKeys] = useState({ ai: false, serper: false });
  const [isByok, setIsByok] = useState(false);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [shouldStop, setShouldStop] = useState(false);
  
  const [options, setOptions] = useState({
    buscarLinksInternos: false,
    citarFontes: false,
    listaFontes: false,
    enviarAposGerar: false,
    status: "draft",
    tipoArtigo: "blog_post",
    tamanho: "medio",
    tom: "informativo",
    pontoDeVista: "primeira_pessoa",
    gerarImagens: false
  });

  useEffect(() => {
    const fetchData = async () => {
      const { data: sitesData } = await supabase.from("wordpress_sites").select("id, name");
      setSites(sitesData || []);
      
      const { data: typesData } = await supabase.from("article_types").select("id, name, use_serper");
      setArticleTypes(typesData || []);

      const { data: configData } = await supabase.from("user_ai_config" as any).select("*").maybeSingle();
      const config = configData as any;
      if (config) {
        setIsByok(config.byok_active);
        setHasKeys({
          ai: !!(config.api_key_encrypted || (config.provider_keys && config.provider_keys[config.provider])),
          serper: !!config.serper_key_encrypted
        });
      }
    };
    fetchData();
    
    // Load queue from localStorage if exists
    const savedQueue = localStorage.getItem("blog_article_queue");
    if (savedQueue) {
      try {
        setQueue(JSON.parse(savedQueue));
      } catch (e) {
        console.error("Error parsing saved queue", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("blog_article_queue", JSON.stringify(queue));
  }, [queue]);

  const addToQueue = () => {
    if (!currentInput.trim()) return;
    const titles = currentInput.split("\n").filter(t => t.trim().length > 0);
    const newItems: QueueItem[] = titles.map(t => ({
      id: crypto.randomUUID(),
      titulo: t.trim(),
      lang: "pt-BR",
      status: "pending"
    }));
    setQueue([...queue, ...newItems]);
    setCurrentInput("");
  };

  const removeFromQueue = (id: string) => {
    setQueue(queue.filter(item => item.id !== id));
  };

  const resetQueue = () => {
    if (confirm("Deseja resetar toda a fila?")) {
      setQueue([]);
    }
  };

  const stopGeneration = () => {
    setShouldStop(true);
  };

  const processQueue = async () => {
    if (queue.filter(i => i.status === "pending").length === 0) {
      toast({ title: "Fila vazia", description: "Adicione artigos para gerar.", variant: "destructive" });
      return;
    }
    
    setIsGenerating(true);
    setShouldStop(false);
    
    const itemsToProcess = [...queue];
    
    for (let i = 0; i < itemsToProcess.length; i++) {
      if (shouldStop) break;
      if (itemsToProcess[i].status !== "pending") continue;
      
      const item = itemsToProcess[i];
      setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: "generating" } : q));
      
      try {
        const articleType = articleTypes.find(t => t.id === selectedArticleType);
        
        const { data, error } = await supabase.functions.invoke("gerar-conteudo-seo", {
          body: { 
            tipo: "post_blog", 
            dados: { 
              tema: item.titulo, 
              article_type_id: selectedArticleType,
              use_serper: articleType?.use_serper || options.citarFontes || options.listaFontes,
              options: {
                ...options,
                siteId: selectedSite
              }
            } 
          },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        const result = data.conteudo;
        
        // Save to history
        await salvarConteudo({ tipo: "post_blog", titulo: result.titulo || item.titulo, conteudo: result });

        // Post to WP if option enabled
        if (options.enviarAposGerar && selectedSite) {
          await supabase.functions.invoke("wordpress-post", {
            body: { 
              siteId: selectedSite,
              postData: {
                title: result.titulo,
                content: result.introducao + "\n\n" + 
                         result.secoes?.map((s: any) => `<h2>${s.subtitulo}</h2>\n\n${s.conteudo}`).join("\n\n") + 
                         "\n\n" + result.conclusao,
                excerpt: result.meta_description,
                slug: result.slug,
                status: options.status
              }
            }
          });
        }

        setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: "done", result } : q));
      } catch (e: any) {
        console.error(`Error generating ${item.titulo}:`, e);
        setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: "error", error: e.message } : q));
      }
      
      // Artificial delay
      await new Promise(r => setTimeout(r, 1000));
    }
    
    setIsGenerating(false);
    toast({ title: "Processamento concluído!" });
  };

  const pendingCount = queue.filter(i => i.status === "pending").length;
  const doneCount = queue.filter(i => i.status === "done").length;
  const progress = queue.length > 0 ? (doneCount / queue.length) * 100 : 0;

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      {/* Fila de Artigos */}
      <Card className="lg:col-span-5 flex flex-col h-[700px]">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-lg">Fila de Artigos</CardTitle>
            <CardDescription>Gerencie os tópicos a serem gerados</CardDescription>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline">{doneCount}/{queue.length}</Badge>
            <Button variant="ghost" size="sm" onClick={resetQueue} className="h-8 gap-1 text-xs">
              <RotateCcw className="w-3 h-3" /> Resetar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col gap-4 overflow-hidden">
          <div className="space-y-2">
            <Label className="text-xs">Adicionar Artigos (um por linha)</Label>
            <div className="flex gap-2">
              <Textarea 
                value={currentInput} 
                onChange={e => setCurrentInput(e.target.value)}
                placeholder="Ex: Melhores bairros do DF..."
                className="min-h-[80px] text-sm"
              />
              <Button onClick={addToQueue} size="icon" className="h-auto aspect-square">
                <Plus className="w-5 h-5" />
              </Button>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto border rounded-lg p-1 space-y-1 bg-secondary/10">
            {queue.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50 p-4 text-center">
                <FileText className="w-10 h-10 mb-2" />
                <p className="text-sm">Sua fila está vazia.</p>
              </div>
            ) : (
              queue.map((item) => (
                <div 
                  key={item.id} 
                  className={`flex items-center gap-2 p-2 rounded-md bg-card border group animate-in fade-in slide-in-from-left-2 cursor-pointer ${selectedItem?.id === item.id ? 'ring-2 ring-primary' : ''}`}
                  onClick={() => item.status === 'done' && setSelectedItem(item)}
                >
                  {item.status === "pending" && <div className="w-2 h-2 rounded-full bg-slate-300" />}
                  {item.status === "generating" && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                  {item.status === "done" && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                  {item.status === "error" && <XCircle className="w-4 h-4 text-destructive" />}
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.titulo}</p>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] h-4 px-1">{item.lang}</Badge>
                      {item.error && <span className="text-[10px] text-destructive truncate">{item.error}</span>}
                    </div>
                  </div>
                  
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => removeFromQueue(item.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Configuração */}
      <Card className="lg:col-span-7 flex flex-col h-[700px]">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Configuração</CardTitle>
              <CardDescription>Parâmetros de geração e publicação</CardDescription>
            </div>
            {isGenerating && (
              <Button variant="destructive" size="sm" onClick={stopGeneration} className="gap-2">
                <StopCircle className="w-4 h-4" /> PARAR
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto space-y-6">
          {(!hasKeys.ai || (!hasKeys.serper && (options.citarFontes || options.listaFontes))) && (
            <div className="p-4 border border-destructive/20 bg-destructive/5 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-destructive font-bold text-sm">
                <AlertTriangle className="w-4 h-4" /> Configuração Incompleta
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Você precisa configurar suas próprias chaves de API (Gemini e Serper) para gerar conteúdo. 
                Cada usuário deve usar sua própria chave para garantir privacidade e limites de uso.
              </p>
              <Button variant="link" size="sm" className="h-auto p-0 text-primary text-xs" onClick={() => window.location.href = "/configurar-ia"}>
                Configurar minhas chaves agora
              </Button>
            </div>
          )}

          {isGenerating && (
            <div className="space-y-2 p-4 border rounded-xl bg-primary/5 border-primary/20 animate-pulse">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-primary flex items-center gap-2">
                   <Loader2 className="w-3 h-3 animate-spin" /> Gerando artigos...
                </span>
                <span className="text-xs font-bold">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
              <div className="flex items-center gap-2 text-[10px] text-amber-600 font-bold bg-amber-50 p-2 rounded border border-amber-100">
                <AlertTriangle className="w-3 h-3" /> Não feche esta página! A geração será interrompida se sair.
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-xs font-bold uppercase text-muted-foreground tracking-wider">
                <Globe className="w-3 h-3" /> Site de Destino
              </Label>
              <Select value={selectedSite} onValueChange={setSelectedSite}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Selecione o site" />
                </SelectTrigger>
                <SelectContent>
                  {sites.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-xs font-bold uppercase text-muted-foreground tracking-wider">
                <Layout className="w-3 h-3" /> Modelo de Prompt
              </Label>
              <Select value={selectedArticleType} onValueChange={setSelectedArticleType}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Modelo padrão" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Padrão da Plataforma</SelectItem>
                  {articleTypes.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name} {t.use_serper ? "🌐" : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4">
             <Label className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Funcionalidades Extras</Label>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex items-center space-x-2 border rounded-lg p-3 hover:bg-secondary/20 transition-colors cursor-pointer" onClick={() => setOptions({...options, buscarLinksInternos: !options.buscarLinksInternos})}>
                  <Checkbox checked={options.buscarLinksInternos} />
                  <div className="grid gap-0.5 leading-none">
                    <Label className="text-sm flex items-center gap-1.5 cursor-pointer">
                      <LinkIcon className="w-3.5 h-3.5 text-blue-500" /> Buscar Links Internos
                    </Label>
                    <p className="text-[10px] text-muted-foreground">Encontra posts do seu site para linkar</p>
                  </div>
                </div>

                <div className="flex items-center space-x-2 border rounded-lg p-3 hover:bg-secondary/20 transition-colors cursor-pointer" onClick={() => setOptions({...options, citarFontes: !options.citarFontes})}>
                  <Checkbox checked={options.citarFontes} />
                  <div className="grid gap-0.5 leading-none">
                    <Label className="text-sm flex items-center gap-1.5 cursor-pointer">
                      <Quote className="w-3.5 h-3.5 text-green-500" /> Citar Fontes no Texto
                    </Label>
                    <p className="text-[10px] text-muted-foreground">Adiciona links das fontes dentro do artigo</p>
                  </div>
                </div>

                <div className="flex items-center space-x-2 border rounded-lg p-3 hover:bg-secondary/20 transition-colors cursor-pointer" onClick={() => setOptions({...options, listaFontes: !options.listaFontes})}>
                  <Checkbox checked={options.listaFontes} />
                  <div className="grid gap-0.5 leading-none">
                    <Label className="text-sm flex items-center gap-1.5 cursor-pointer">
                      <ListIcon className="w-3.5 h-3.5 text-purple-500" /> Lista de Fontes no Final
                    </Label>
                    <p className="text-[10px] text-muted-foreground">Adiciona seção "Fontes" ao final</p>
                  </div>
                </div>

                <div className="flex items-center space-x-2 border rounded-lg p-3 hover:bg-secondary/20 transition-colors cursor-pointer" onClick={() => setOptions({...options, enviarAposGerar: !options.enviarAposGerar})}>
                  <Checkbox checked={options.enviarAposGerar} />
                  <div className="grid gap-0.5 leading-none">
                    <Label className="text-sm flex items-center gap-1.5 cursor-pointer">
                      <Send className="w-3.5 h-3.5 text-primary" /> Publicação WP
                    </Label>
                    <p className="text-[10px] text-muted-foreground">Enviar automaticamente após gerar</p>
                  </div>
                </div>
             </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase">Status WP</Label>
              <Select value={options.status} onValueChange={v => setOptions({...options, status: v})}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Rascunho</SelectItem>
                  <SelectItem value="publish">Publicado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase">Tamanho</Label>
              <Select value={options.tamanho} onValueChange={v => setOptions({...options, tamanho: v})}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="curto">Curto (~500 pal.)</SelectItem>
                  <SelectItem value="medio">Médio (~1200 pal.)</SelectItem>
                  <SelectItem value="longo">Longo (~2500 pal.)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase">Tom</Label>
              <Select value={options.tom} onValueChange={v => setOptions({...options, tom: v})}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="informativo">Informativo</SelectItem>
                  <SelectItem value="persuasivo">Persuasivo</SelectItem>
                  <SelectItem value="descontraido">Descontraído</SelectItem>
                  <SelectItem value="profissional">Profissional</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase">Ponto de Vista</Label>
              <Select value={options.pontoDeVista} onValueChange={v => setOptions({...options, pontoDeVista: v})}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="primeira_pessoa">Primeira Pessoa (Eu/Nós)</SelectItem>
                  <SelectItem value="terceira_pessoa">Terceira Pessoa (Ele/Ela)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 flex flex-col justify-end pb-1">
              <div className="flex items-center gap-2 cursor-pointer" onClick={() => setOptions({...options, gerarImagens: !options.gerarImagens})}>
                <Checkbox checked={options.gerarImagens} />
                <Label className="text-xs font-bold text-muted-foreground uppercase cursor-pointer flex items-center gap-1">
                  <ImageIcon className="w-3 h-3" /> Gerar Imagens
                </Label>
              </div>
            </div>
          </div>

          <div className="pt-4 mt-auto">
            <Button 
              onClick={processQueue} 
              disabled={isGenerating || pendingCount === 0 || !hasKeys.ai || (!hasKeys.serper && (options.citarFontes || options.listaFontes))} 
              className="w-full h-12 text-lg gap-2 shadow-lg shadow-primary/20"
            >
              {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
              {!hasKeys.ai ? "Configure suas chaves para iniciar" : isGenerating ? `Processando (${doneCount}/${queue.length})...` : `INICIAR GERAÇÃO (${pendingCount})`}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Preview do Artigo Selecionado */}
      {selectedItem && selectedItem.result && (
        <Card className="lg:col-span-12">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-lg">Preview: {selectedItem.result.titulo}</CardTitle>
              <CardDescription>Visualize o conteúdo gerado</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSelectedItem(null)}>
              <XCircle className="w-4 h-4" /> Fechar
            </Button>
          </CardHeader>
          <CardContent className="space-y-4 max-h-[800px] overflow-y-auto">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Título SEO</Label>
                <div className="p-3 rounded-lg bg-secondary/30 text-sm font-medium">{selectedItem.result.titulo}</div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Slug</Label>
                <div className="p-3 rounded-lg bg-secondary/30 text-sm font-mono">{selectedItem.result.slug}</div>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Meta Description</Label>
              <div className="p-3 rounded-lg bg-secondary/30 text-sm italic">{selectedItem.result.meta_description}</div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Conteúdo</Label>
              <div className="p-6 rounded-xl border bg-card text-sm space-y-4 leading-relaxed">
                <p className="font-semibold text-base">{selectedItem.result.introducao}</p>
                {selectedItem.result.secoes?.map((s: any, idx: number) => (
                  <div key={idx} className="space-y-2">
                    <h2 className="text-xl font-bold pt-4">{s.subtitulo}</h2>
                    <p className="whitespace-pre-wrap">{s.conteudo}</p>
                  </div>
                ))}
                <p className="pt-4 border-t italic">{selectedItem.result.conclusao}</p>
                
                {selectedItem.result.fontes?.length > 0 && (
                  <div className="mt-8 pt-4 border-t">
                    <h3 className="text-sm font-bold uppercase text-muted-foreground mb-2">Fontes Consultadas</h3>
                    <ul className="space-y-1">
                      {selectedItem.result.fontes.map((f: any, idx: number) => (
                        <li key={idx}>
                          <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1.5">
                             <Globe className="w-3 h-3" /> {f.nome}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
