import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Search, ExternalLink, Globe, Sparkles, UserPlus, Linkedin, Instagram, Building, Briefcase, Link as LinkIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export function WebResearchDialog() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("Pesquisa Inteligente");
  const [currentQuery, setCurrentQuery] = useState("");
  const [source, setSource] = useState<string>("general");
  const [targetId, setTargetId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [researchData, setResearchData] = useState<{ summary: string; results: any[]; cached?: boolean; enrichment?: any } | null>(null);

  useEffect(() => {
    const handleLeadResearch = (e: any) => {
      const lead = e.detail;
      const query = `${lead.nome} ${lead.interesse || ""} ${lead.bairro_interesse || ""}`.trim();
      setTitle(`Enriquecimento: ${lead.nome}`);
      setCurrentQuery(query);
      setSource("lead");
      setTargetId(lead.id);
      setOpen(true);
      performResearch(query, false, "lead");
    };

    const handleMarketResearch = (e: any) => {
      const { query } = e.detail;
      setTitle("Notícias e Tendências");
      setCurrentQuery(query);
      setSource("market");
      setOpen(true);
      performResearch(query, false, "market");
    };

    const handlePropertyResearch = (e: any) => {
      const imovel = e.detail;
      const query = `${imovel.titulo} ${imovel.endereco || ""} ${imovel.bairro || ""} ${imovel.cidade || ""} valor mercado anúncios`.trim();
      setTitle(`Análise de Mercado: ${imovel.titulo}`);
      setCurrentQuery(query);
      setSource("property");
      setOpen(true);
      performResearch(query, false, "property");
    };

    const handleOwnerResearch = (e: any) => {
      const owner = e.detail;
      const query = `${owner.nome} ${owner.cidade || ""} consulta jurídica processos notícias`.trim();
      setTitle(`Diligência: ${owner.nome}`);
      setCurrentQuery(query);
      setSource("owner");
      setOpen(true);
      performResearch(query, false, "owner");
    };

    window.addEventListener("open-lead-research", handleLeadResearch);
    window.addEventListener("open-market-research", handleMarketResearch);
    window.addEventListener("open-property-research", handlePropertyResearch);
    window.addEventListener("open-owner-research", handleOwnerResearch);
    
    return () => {
      window.removeEventListener("open-lead-research", handleLeadResearch);
      window.removeEventListener("open-market-research", handleMarketResearch);
      window.removeEventListener("open-property-research", handlePropertyResearch);
      window.removeEventListener("open-owner-research", handleOwnerResearch);
    };
  }, []);

  const performResearch = async (query: string, refresh = false, overrideSource?: string) => {
    if (!user || !query) return;
    setLoading(true);
    if (refresh) setResearchData(null);
    
    const finalSource = overrideSource || source;
    
    try {
      const { data, error } = await supabase.functions.invoke("web-research", {
        body: { query, userId: user.id, refresh, source: finalSource }
      });

      if (error) {
        if (data?.needsConfig) {
          toast.error("Serper não configurado", {
            description: "Vá em Configurações > IA para adicionar sua chave Serper."
          });
        } else {
          throw error;
        }
        setOpen(false);
        return;
      }

      setResearchData(data);
    } catch (err: any) {
      console.error("Research failed:", err);
      toast.error("Falha na pesquisa: " + err.message);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const applyEnrichment = async () => {
    if (!targetId || !researchData?.enrichment) return;
    setApplying(true);
    try {
      const { enrichment } = researchData;
      let observations = "";
      if (enrichment.contexto) observations += `\n🔍 Contexto Público: ${enrichment.contexto}`;
      if (enrichment.empresa) observations += `\n🏢 Empresa: ${enrichment.empresa}`;
      if (enrichment.cargo) observations += `\n💼 Cargo: ${enrichment.cargo}`;
      if (enrichment.site) observations += `\n🌐 Site: ${enrichment.site}`;
      if (enrichment.redes_sociais && Array.isArray(enrichment.redes_sociais)) {
        observations += `\n📱 Redes: ${enrichment.redes_sociais.join(", ")}`;
      }

      if (observations) {
        const { data: lead } = await supabase.from("leads").select("observacoes").eq("id", targetId).single();
        const newObs = lead?.observacoes ? `${lead.observacoes}\n${observations}` : observations;

        const { error } = await supabase
          .from("leads")
          .update({ observacoes: newObs })
          .eq("id", targetId);

        if (error) throw error;
        toast.success("Lead enriquecido com sucesso!", {
          description: "Os dados foram adicionados às observações do lead."
        });
      }
    } catch (err: any) {
      console.error("Failed to apply enrichment:", err);
      toast.error("Erro ao aplicar enriquecimento: " + err.message);
    } finally {
      setApplying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="w-5 h-5 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription>
            Buscando informações em tempo real na web (via Serper).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Consultando Serper e analisando com IA...</p>
            </div>
          ) : researchData ? (
            <>
              {researchData.summary && (
                <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2 text-primary font-semibold text-sm">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      Resumo Inteligente
                    </div>
                    {researchData.cached && (
                      <span className="text-[10px] bg-primary/10 px-2 py-0.5 rounded-full font-normal">
                        Resultados em Cache
                      </span>
                    )}
                  </div>
                  <div className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
                    {researchData.summary}
                  </div>
                </div>
              )}

              {source === 'lead' && researchData.enrichment && (
                <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-blue-600 font-semibold text-sm">
                      <UserPlus className="w-4 h-4" />
                      Dados de Enriquecimento
                    </div>
                    <Button 
                      size="sm" 
                      onClick={applyEnrichment} 
                      disabled={applying}
                      className="h-8 text-xs bg-blue-600 hover:bg-blue-700"
                    >
                      {applying ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <UserPlus className="w-3 h-3 mr-1" />}
                      Salvar no Lead
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {researchData.enrichment.empresa && (
                      <div className="flex items-center gap-2 text-xs text-foreground/80">
                        <Building className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="font-medium">Empresa:</span> {researchData.enrichment.empresa}
                      </div>
                    )}
                    {researchData.enrichment.cargo && (
                      <div className="flex items-center gap-2 text-xs text-foreground/80">
                        <Briefcase className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="font-medium">Cargo:</span> {researchData.enrichment.cargo}
                      </div>
                    )}
                    {researchData.enrichment.site && (
                      <div className="flex items-center gap-2 text-xs text-foreground/80">
                        <LinkIcon className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="font-medium">Site:</span> 
                        <a href={researchData.enrichment.site} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline truncate">
                          {researchData.enrichment.site}
                        </a>
                      </div>
                    )}
                  </div>

                  {researchData.enrichment.redes_sociais && researchData.enrichment.redes_sociais.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {researchData.enrichment.redes_sociais.map((link: string, i: number) => {
                        const isLinkedIn = link.includes('linkedin');
                        const isInsta = link.includes('instagram');
                        return (
                          <a 
                            key={i} 
                            href={link} 
                            target="_blank" 
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] bg-white border px-2 py-1 rounded-full hover:bg-accent transition-colors"
                          >
                            {isLinkedIn ? <Linkedin className="w-3 h-3 text-blue-700" /> : 
                             isInsta ? <Instagram className="w-3 h-3 text-pink-600" /> : 
                             <Globe className="w-3 h-3" />}
                            {isLinkedIn ? 'LinkedIn' : isInsta ? 'Instagram' : 'Social'}
                          </a>
                        );
                      })}
                    </div>
                  )}
                  
                  {researchData.enrichment.contexto && (
                    <div className="text-xs italic text-muted-foreground bg-white/50 p-2 rounded border border-dashed">
                      "{researchData.enrichment.contexto}"
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                  <Globe className="w-4 h-4" />
                  Fontes Encontradas
                </div>
                <div className="grid gap-3">
                  {researchData.results.map((res, i) => (
                    <a
                      key={i}
                      href={res.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group p-3 rounded-lg border border-border/50 hover:border-primary/30 hover:bg-accent/50 transition-all"
                    >
                      <h4 className="text-sm font-medium text-blue-600 group-hover:underline flex items-center gap-1">
                        {res.title}
                        <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {res.snippet}
                      </p>
                      <span className="text-[10px] text-muted-foreground/60 mt-2 block">
                        {new URL(res.link).hostname}
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <p className="text-center text-muted-foreground py-8">Nenhum dado encontrado para "{currentQuery}".</p>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>Fechar</Button>
          <Button 
            variant="secondary" 
            onClick={() => performResearch(currentQuery, true)}
            disabled={loading}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Search className="w-4 h-4 mr-2" />}
            Atualizar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
