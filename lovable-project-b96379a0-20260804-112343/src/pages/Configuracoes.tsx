import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { SectionHeader } from "@/components/shared/MetricCard";
import { Building2, Upload, Loader2, Save, Camera, ToggleRight, UserX, Video, Sparkles, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WhatsappConfigSection } from "@/components/configuracoes/WhatsappConfigSection";
import { MinhaContaSection } from "@/components/configuracoes/MinhaContaSection";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { MODULOS, useModuloConfig } from "@/hooks/useModuloConfig";

interface Config {
  nome_empresa: string;
  cnpj: string;
  creci: string;
  endereco: string;
  cidade: string;
  estado: string;
  cep: string;
  telefone: string;
  email: string;
  logo_url: string;
  nomes_excluidos_importacao: string[];
  video_demo_url: string;
  extraction_max_retries: number;
  extraction_retry_delay_ms: number;
  sem_contato_days: number;
  sla_primeiro_contato_horas: number;
  sla_recontato_dias: number;
  auto_assign_ludmila_estagios: string[];
  auto_assign_ludmila_janela_horas: number | null; // null = dia BRT
  pipeline_tema_default: "premium" | "suave" | "azul" | "claro";
  retention_firecrawl_cache_dias: number;
  retention_lista_proprietarios_dias: number;
}


const PIPELINE_ESTAGIOS = [
  "novos","contato","qualificados","mandar_opcoes",
  "visita","proposta","pediu_tempo","nao_responde","fechado",
  "perdido","desistiu","comprou_outra",
];

const EMPTY: Config = {
  nome_empresa: "",
  cnpj: "",
  creci: "",
  endereco: "",
  cidade: "",
  estado: "SP",
  cep: "",
  telefone: "",
  email: "",
  logo_url: "",
  nomes_excluidos_importacao: [],
  video_demo_url: "",
  extraction_max_retries: 2,
  extraction_retry_delay_ms: 2000,
  sem_contato_days: 7,
  sla_primeiro_contato_horas: 24,
  sla_recontato_dias: 7,
  auto_assign_ludmila_estagios: ["novos"],
  auto_assign_ludmila_janela_horas: null,
  pipeline_tema_default: "premium",
  retention_firecrawl_cache_dias: 7,
  retention_lista_proprietarios_dias: 90,
};



function getEmbedUrl(url: string): string {
  // YouTube
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]+)/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  return url;
}

const Configuracoes = () => {
  const { user, isMaster } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [config, setConfig] = useState<Config>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { config: moduloConfig, toggleModulo } = useModuloConfig();

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("imobiliaria_config")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setConfig({
          nome_empresa: data.nome_empresa || "",
          cnpj: data.cnpj || "",
          creci: (data as any).creci || "",
          endereco: data.endereco || "",
          cidade: data.cidade || "",
          estado: data.estado || "SP",
          cep: data.cep || "",
          telefone: data.telefone || "",
          email: data.email || "",
          logo_url: data.logo_url || "",
          nomes_excluidos_importacao: (data as any).nomes_excluidos_importacao || [],
          video_demo_url: (data as any).video_demo_url || "",
          extraction_max_retries: (data as any).extraction_max_retries ?? 2,
          extraction_retry_delay_ms: (data as any).extraction_retry_delay_ms ?? 2000,
          sem_contato_days: (data as any).sem_contato_days ?? 7,
          sla_primeiro_contato_horas: (data as any).sla_primeiro_contato_horas ?? 24,
          sla_recontato_dias: (data as any).sla_recontato_dias ?? 7,
          auto_assign_ludmila_estagios: (data as any).auto_assign_ludmila_estagios ?? ["novos"],
          auto_assign_ludmila_janela_horas: (data as any).auto_assign_ludmila_janela_horas ?? null,
          pipeline_tema_default: ((data as any).pipeline_tema_default as Config["pipeline_tema_default"]) || "premium",
          retention_firecrawl_cache_dias: (data as any).retention_firecrawl_cache_dias ?? 7,
          retention_lista_proprietarios_dias: (data as any).retention_lista_proprietarios_dias ?? 90,
        });


      }
      setLoading(false);
    };
    load();
  }, [user]);

  const handleCepBlur = async () => {
    const cep = config.cep.replace(/\D/g, "");
    if (cep.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setConfig(prev => ({
          ...prev,
          endereco: data.logradouro || prev.endereco,
          cidade: data.localidade || prev.cidade,
          estado: data.uf || prev.estado,
        }));
      }
    } catch { /* ignore */ }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from("imobiliaria_config")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      const payload = {
        ...config,
        extraction_max_retries: config.extraction_max_retries,
        extraction_retry_delay_ms: config.extraction_retry_delay_ms
      };

      if (existing) {
        const { error } = await supabase
          .from("imobiliaria_config")
          .update(payload as any)
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("imobiliaria_config")
          .insert({ ...payload, user_id: user.id } as any);

        if (error) throw error;
      }
      toast({ title: "Configurações salvas!" });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/logo.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("logos")
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("logos").getPublicUrl(path);
      const cacheBuster = `?t=${Date.now()}`;
      setConfig(prev => ({ ...prev, logo_url: urlData.publicUrl + cacheBuster }));
      toast({ title: "Logo enviado!" });
    } catch (err: any) {
      toast({ title: "Erro no upload", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const set = (key: keyof Config, value: string) => setConfig(prev => ({ ...prev, [key]: value }));

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <SectionHeader
        title="Configurações"
        subtitle="Dados da sua imobiliária"
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary font-bold shadow-sm"
              onClick={() => navigate("/configurar-ia")}
            >
              <Sparkles className="w-4 h-4" />
              Configurar IA
            </Button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar
            </button>
          </div>
        }
      />

      {/* Configuração de IA em Destaque no Topo */}
      <div className="mb-6 glass-card p-6 space-y-4 border-primary/20 bg-primary/5 shadow-md shadow-primary/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">Conectar sua própria IA (Modo Ilimitado / BYOK)</h3>
              <p className="text-sm text-muted-foreground">
                Cada usuário deve configurar sua própria chave da OpenAI ou Google Gemini para garantir total privacidade e uso ilimitado.
              </p>
            </div>
          </div>
          <Button 
            variant="default" 
            className="gap-2 font-bold px-6 shadow-sm shadow-primary/20"
            onClick={() => navigate("/configurar-ia")}
          >
            <span>Configurar Provedores e Chaves</span>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="mb-6">
        <MinhaContaSection />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Logo */}
        <div className="glass-card p-5 flex flex-col items-center gap-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Camera className="w-4 h-4 text-primary" />Logo da Imobiliária
          </h3>
          <div
            onClick={() => fileRef.current?.click()}
            className="w-32 h-32 rounded-xl border-2 border-dashed border-border hover:border-primary/50 flex items-center justify-center cursor-pointer transition-colors overflow-hidden bg-muted/30"
          >
            {uploading ? (
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            ) : config.logo_url ? (
              <img src={config.logo_url} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <div className="text-center">
                <Upload className="w-6 h-6 text-muted-foreground mx-auto mb-1" />
                <span className="text-[11px] text-muted-foreground">Enviar logo</span>
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
          <p className="text-[11px] text-muted-foreground text-center">Clique para enviar ou alterar o logo</p>
        </div>

        {/* Company data */}
        <div className="lg:col-span-2 glass-card p-5 space-y-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" />Dados da Empresa
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Nome da Imobiliária</Label>
              <Input value={config.nome_empresa} onChange={e => set("nome_empresa", e.target.value)} placeholder="Ex: ImobPro Imóveis" />
            </div>
            <div>
              <Label>CNPJ</Label>
              <Input value={config.cnpj} onChange={e => set("cnpj", e.target.value)} placeholder="00.000.000/0001-00" />
            </div>
            <div>
              <Label>CRECI</Label>
              <Input value={config.creci} onChange={e => set("creci", e.target.value)} placeholder="CRECI 00000-F" />
            </div>
            <div>
              <Label>E-mail</Label>
              <Input type="email" value={config.email} onChange={e => set("email", e.target.value)} placeholder="contato@imobiliaria.com" />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input value={config.telefone} onChange={e => set("telefone", e.target.value)} placeholder="(11) 99999-0000" />
            </div>
          </div>

          <h3 className="text-sm font-semibold text-foreground pt-2">Endereço</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>CEP</Label>
              <Input value={config.cep} onChange={e => set("cep", e.target.value)} onBlur={handleCepBlur} placeholder="00000-000" />
            </div>
            <div className="md:col-span-2">
              <Label>Endereço</Label>
              <Input value={config.endereco} onChange={e => set("endereco", e.target.value)} placeholder="Rua, número, complemento" />
            </div>
            <div>
              <Label>Cidade</Label>
              <Input value={config.cidade} onChange={e => set("cidade", e.target.value)} placeholder="São Paulo" />
            </div>
            <div>
              <Label>Estado</Label>
              <Input value={config.estado} onChange={e => set("estado", e.target.value)} placeholder="SP" maxLength={2} />
            </div>
          </div>
        </div>
      </div>

      {/* Exclusion names for import */}
      <div className="mt-6 glass-card p-5 space-y-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <UserX className="w-4 h-4 text-primary" />Nomes Excluídos na Importação
        </h3>
        <p className="text-xs text-muted-foreground">
          Nomes listados abaixo serão ignorados automaticamente ao importar leads (um por linha). Corretores cadastrados já são excluídos automaticamente.
        </p>
        <Textarea
          value={config.nomes_excluidos_importacao.join("\n")}
          onChange={e => setConfig(prev => ({
            ...prev,
            nomes_excluidos_importacao: e.target.value.split("\n").map(n => n.trim()).filter(Boolean),
          }))}
          placeholder={"Ex:\nJOÃO DA SILVA\nMARIA SANTOS"}
          rows={4}
        />
      </div>

      {/* Video de Demonstração e Configuração de Extração */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-5 space-y-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Video className="w-4 h-4 text-primary" />Vídeo de Demonstração (Landing Page)
          </h3>
          <p className="text-xs text-muted-foreground">
            Cole o link de um vídeo do YouTube, Vimeo ou qualquer URL de vídeo público.
          </p>
          <div className="space-y-4">
            <Label>URL do Vídeo</Label>
            <Input
              value={config.video_demo_url}
              onChange={e => set("video_demo_url", e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
            />
            {config.video_demo_url && (
              <div className="rounded-lg overflow-hidden border border-border aspect-video">
                <iframe
                  src={getEmbedUrl(config.video_demo_url)}
                  className="w-full h-full"
                  allow="autoplay; fullscreen"
                  allowFullScreen
                  title="Preview do vídeo"
                />
              </div>
            )}
          </div>
        </div>

        <div className="glass-card p-5 space-y-4 border border-border/50 bg-secondary/10">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />Configurações de Extração com IA
          </h3>
          <p className="text-xs text-muted-foreground">
            Ajuste o comportamento do sistema ao extrair dados de anúncios via link.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="space-y-2">
              <Label className="text-[11px] uppercase font-bold text-muted-foreground">Tentativas Máximas</Label>
              <div className="flex items-center gap-2">
                <Input 
                  type="number" 
                  min={0} 
                  max={5} 
                  value={config.extraction_max_retries} 
                  onChange={e => setConfig(prev => ({ ...prev, extraction_max_retries: parseInt(e.target.value) || 0 }))} 
                  className="w-20 h-8 text-sm"
                />
                <span className="text-[10px] text-muted-foreground">tentativas extras</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] uppercase font-bold text-muted-foreground">Intervalo (ms)</Label>
              <div className="flex items-center gap-2">
                <Input 
                  type="number" 
                  min={500} 
                  step={500}
                  value={config.extraction_retry_delay_ms} 
                  onChange={e => setConfig(prev => ({ ...prev, extraction_retry_delay_ms: parseInt(e.target.value) || 500 }))} 
                  className="w-24 h-8 text-sm"
                />
                <span className="text-[10px] text-muted-foreground">espera</span>
          </div>
          <div className="pt-4 border-t border-border/50 space-y-2">
            <Label className="text-[11px] uppercase font-bold text-muted-foreground">
              Sem Contato (dias) — Follow-ups
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={90}
                value={config.sem_contato_days}
                onChange={e => setConfig(prev => ({
                  ...prev,
                  sem_contato_days: Math.max(1, Math.min(90, parseInt(e.target.value) || 7)),
                }))}
                className="w-24 h-8 text-sm"
              />
              <span className="text-[11px] text-muted-foreground">
                dias sem interação para o card "Sem Contato" no painel de Follow-ups
              </span>
          </div>

          <div className="pt-4 border-t border-border/50 space-y-3">
            <Label className="text-[11px] uppercase font-bold text-muted-foreground">
              SLA de Contato — Aba "Contatos" do CRM
            </Label>
            <p className="text-[11px] text-muted-foreground -mt-1">
              Define as regras que classificam um lead como <b>Atrasado</b>, <b>A contatar</b> ou <b>Contatado</b>.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px]">Prazo para primeiro contato (horas)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={168}
                    value={config.sla_primeiro_contato_horas}
                    onChange={e => setConfig(prev => ({
                      ...prev,
                      sla_primeiro_contato_horas: Math.max(1, Math.min(168, parseInt(e.target.value) || 24)),
                    }))}
                    className="w-24 h-8 text-sm"
                  />
                  <span className="text-[11px] text-muted-foreground">
                    após a criação do lead
                  </span>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Prazo para recontato (dias)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={90}
                    value={config.sla_recontato_dias}
                    onChange={e => setConfig(prev => ({
                      ...prev,
                      sla_recontato_dias: Math.max(1, Math.min(90, parseInt(e.target.value) || 7)),
                    }))}
                    className="w-24 h-8 text-sm"
                  />
                  <span className="text-[11px] text-muted-foreground">
                    desde o último contato registrado
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-border/50 space-y-3">
            <Label className="text-[11px] uppercase font-bold text-muted-foreground">
              🗄️ Retenção de Dados (LGPD)
            </Label>
            <p className="text-[11px] text-muted-foreground -mt-1">
              Define por quantos dias os dados coletados ficam armazenados antes de serem apagados automaticamente. A rotina roda diariamente às 03:15 (UTC).
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-[11px]">Cache de busca pública (Firecrawl)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    value={config.retention_firecrawl_cache_dias}
                    onChange={e => setConfig(prev => ({
                      ...prev,
                      retention_firecrawl_cache_dias: Math.max(1, Math.min(365, parseInt(e.target.value) || 7)),
                    }))}
                    className="w-24 h-8 text-sm"
                  />
                  <span className="text-[11px] text-muted-foreground">dias (compartilhado — usa o menor valor entre tenants)</span>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Lista de proprietários captados</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={3650}
                    value={config.retention_lista_proprietarios_dias}
                    onChange={e => setConfig(prev => ({
                      ...prev,
                      retention_lista_proprietarios_dias: Math.max(1, Math.min(3650, parseInt(e.target.value) || 90)),
                    }))}
                    className="w-24 h-8 text-sm"
                  />
                  <span className="text-[11px] text-muted-foreground">dias antes da exclusão automática</span>
                </div>
              </div>
            </div>
          </div>



          {isMaster && (
            <div className="pt-4 border-t border-border/50 space-y-3">
              <Label className="text-[11px] uppercase font-bold text-muted-foreground">
                Tema padrão do Pipeline
              </Label>
              <p className="text-[11px] text-muted-foreground -mt-1">
                Define a aparência inicial do CRM para novos usuários da imobiliária. Cada corretor pode escolher outro tema no botão "Tema" do pipeline; a escolha individual sobrescreve este padrão no navegador dele.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                {([
                  { id: "premium", label: "Editorial Navy", desc: "Marinho + dourado", sw: ["#0B1B34", "#C9A96A", "#F7F3EC"] },
                  { id: "suave", label: "Cinza Sereno", desc: "Neutro e discreto", sw: ["#334155", "#94A3B8", "#F1F5F9"] },
                  { id: "azul", label: "Azul Corporativo", desc: "Suave e profissional", sw: ["#1E3A5F", "#3B82F6", "#E0F2FE"] },
                  { id: "claro", label: "Claro Minimal", desc: "Quase branco", sw: ["#0F172A", "#334155", "#FFFFFF"] },
                ] as const).map((t) => {
                  const active = config.pipeline_tema_default === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setConfig(prev => ({ ...prev, pipeline_tema_default: t.id }))}
                      className={`text-left rounded-lg border p-3 transition-all ${active ? "border-primary ring-2 ring-primary/20 bg-primary/5" : "border-border hover:border-primary/40"}`}
                    >
                      <div className="flex items-center gap-1.5 mb-2">
                        {t.sw.map(c => (
                          <span key={c} className="w-4 h-4 rounded-full border border-black/10" style={{ background: c }} />
                        ))}
                      </div>
                      <div className="text-[12px] font-semibold text-foreground">{t.label}</div>
                      <div className="text-[10px] text-muted-foreground">{t.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}


          </div>

          {isMaster && (
            <div className="pt-4 border-t border-border/50 space-y-3">
              <Label className="text-[11px] uppercase font-bold text-muted-foreground">
                Atribuição automática à Ludmila — Regra "Novos Leads"
              </Label>
              <div>
                <div className="text-[11px] text-muted-foreground mb-2">
                  Estágios do pipeline que contam como "novos leads":
                </div>
                <div className="flex flex-wrap gap-2">
                  {PIPELINE_ESTAGIOS.map(est => {
                    const checked = config.auto_assign_ludmila_estagios.includes(est);
                    return (
                      <button
                        type="button"
                        key={est}
                        onClick={() => setConfig(prev => ({
                          ...prev,
                          auto_assign_ludmila_estagios: checked
                            ? prev.auto_assign_ludmila_estagios.filter(x => x !== est)
                            : [...prev.auto_assign_ludmila_estagios, est],
                        }))}
                        className={`px-2 py-1 rounded-md text-[11px] border transition-colors ${
                          checked
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background border-border/60 text-muted-foreground hover:bg-muted/40"
                        }`}
                      >
                        {est}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground mb-2">
                  Janela de tempo que define "hoje":
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    className="h-8 rounded-md border border-border/60 bg-background px-2 text-sm"
                    value={config.auto_assign_ludmila_janela_horas ?? "day"}
                    onChange={e => {
                      const v = e.target.value;
                      setConfig(prev => ({
                        ...prev,
                        auto_assign_ludmila_janela_horas: v === "day" ? null : parseInt(v),
                      }));
                    }}
                  >
                    <option value="day">Dia do calendário (America/Sao_Paulo)</option>
                    <option value="1">Última 1 hora</option>
                    <option value="6">Últimas 6 horas</option>
                    <option value="12">Últimas 12 horas</option>
                    <option value="24">Últimas 24 horas</option>
                    <option value="48">Últimas 48 horas</option>
                    <option value="72">Últimas 72 horas</option>
                    <option value="168">Últimos 7 dias</option>
                  </select>
                  <span className="text-[11px] text-muted-foreground">
                    Define quando um lead ainda é considerado "de hoje" para a regra
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
          </div>
        </div>
      </div>

      {/* WhatsApp API Config */}
      <div className="mt-6">
        <WhatsappConfigSection />
      </div>

      {/* WhatsApp Templates Captação */}
      <div className="mt-6 glass-card p-5 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            Templates de WhatsApp – Captação
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Personalize o corpo da mensagem e as variáveis dinâmicas ({"{{saudacao}}"}, {"{{descricao}}"}, {"{{url_anuncio}}"}...) usadas ao contatar proprietários.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate("/whatsapp-templates-captacao")}>
          Gerenciar templates <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>

      {/* Module Toggles - Master only */}
      {isMaster && (
      <div className="mt-6 glass-card p-5 space-y-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <ToggleRight className="w-4 h-4 text-primary" />Módulos do Sistema
        </h3>
        <p className="text-xs text-muted-foreground">Ative ou desative módulos para todos os usuários.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {MODULOS.map((modulo) => (
            <div
              key={modulo.id}
              className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                moduloConfig[modulo.id] ? "border-primary/30 bg-primary/5" : "border-border bg-secondary/30 opacity-60"
              }`}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{modulo.label}</p>
                <p className="text-[11px] text-muted-foreground">{modulo.desc}</p>
              </div>
              <Switch
                checked={moduloConfig[modulo.id]}
                onCheckedChange={(checked) => toggleModulo(modulo.id, checked)}
              />
            </div>
          ))}
        </div>
      </div>
      )}
    </DashboardLayout>
  );
};

export default Configuracoes;