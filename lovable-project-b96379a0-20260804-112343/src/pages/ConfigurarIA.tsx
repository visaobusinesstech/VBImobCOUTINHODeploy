import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useMemo, useState } from "react";
import {
  Sparkles, Shield, Eye, EyeOff, Search,
  Check, ChevronRight, Loader2, ExternalLink, Cpu, Zap, Globe, Save,
  AlertTriangle, BarChart3, Mail, Star, HelpCircle, Settings2, CheckCircle2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AI_MODELS, firstModel } from "@/config/ai-models";
import { ByokDiagnosticoPanel, type LastTestResult } from "@/components/configurar-ia/ByokDiagnosticoPanel";
import { RotacaoChavesPanel } from "@/components/configurar-ia/RotacaoChavesPanel";
import { TestHistoricoPanel } from "@/components/configurar-ia/TestHistoricoPanel";

type Provider = "openai" | "anthropic" | "google" | "groq" | "openrouter" | "deepseek" | "lovable";

interface ProviderInfo {
  id: Provider;
  name: string;
  defaultModel: string;
  models: string[];
  description: string;
  helpUrl?: string;
  helpLabel?: string;
  recommended?: boolean;
  badge?: string;
}

const PROVIDERS: ProviderInfo[] = [
  { id: "google", name: "Google Gemini", defaultModel: firstModel("google"), models: AI_MODELS.google, description: "1.500 req/dia grátis. Não precisa cartão.", helpUrl: "https://aistudio.google.com/app/apikey", helpLabel: "Pegar chave no Google AI Studio", recommended: true, badge: "Recomendado · Grátis" },
  { id: "groq", name: "Groq", defaultModel: firstModel("groq"), models: AI_MODELS.groq, description: "Ultra rápido e gratuito.", helpUrl: "https://console.groq.com/keys" },
  { id: "deepseek", name: "DeepSeek", defaultModel: firstModel("deepseek"), models: AI_MODELS.deepseek, description: "Melhor custo-benefício.", helpUrl: "https://platform.deepseek.com/api_keys" },
  { id: "openrouter", name: "OpenRouter", defaultModel: firstModel("openrouter"), models: AI_MODELS.openrouter, description: "Vários modelos em um só lugar.", helpUrl: "https://openrouter.ai/keys" },
  { id: "anthropic", name: "Anthropic Claude", defaultModel: firstModel("anthropic"), models: AI_MODELS.anthropic, description: "Modelos Claude.", helpUrl: "https://console.anthropic.com/" },
  { id: "openai", name: "OpenAI", defaultModel: firstModel("openai"), models: AI_MODELS.openai, description: "Modelos GPT oficiais.", helpUrl: "https://platform.openai.com/api-keys" },
];

const QUICK_STEPS: Record<string, { title: string; url: string; steps: string[] }> = {
  google: {
    title: "Como pegar sua chave grátis (2 minutos)",
    url: "https://aistudio.google.com/app/apikey",
    steps: [
      'Clique em "Abrir Google AI Studio" abaixo.',
      "Faça login com sua conta Google.",
      'Clique em "Create API Key" e copie a chave (começa com "AIza").',
      "Cole no campo abaixo e clique em Testar.",
    ],
  },
};

export default function ConfigurarIA() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [provider, setProvider] = useState<Provider>("google");
  const [apiKey, setApiKey] = useState("");
  const [serperKey, setSerperKey] = useState("");
  const [providerKeys, setProviderKeys] = useState<Record<string, string>>({});
  const [model, setModel] = useState("");
  const [modelArticle, setModelArticle] = useState("");
  const [modelImage, setModelImage] = useState("");
  const [isByokActive, setIsByokActive] = useState(true);
  const [timezone, setTimezone] = useState("Brasília (UTC-3)");
  const [serperConfig, setSerperConfig] = useState<any>({
    real_estate: { enabled: true, portals: ["zapimoveis.com.br", "vivareal.com.br", "olx.com.br", "imovelweb.com.br"] },
    owner_diligence: { enabled: true, portals: ["jusbrasil.com.br", "escavador.com", "linkedin.com", "facebook.com", "instagram.com"] }
  });
  const [serperUsage, setSerperUsage] = useState({ count: 0, limit: 100, alert_email: "", alert_threshold: 80 });

  const [showKey, setShowKey] = useState(false);
  const [showSerperKey, setShowSerperKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [chainStatus, setChainStatus] = useState<null | { ok: boolean; activeModel?: string; preferredModel?: string; fallbackUsed?: boolean; chain?: string[]; message?: string; checkedAt?: string; }>(null);
  const [testingChain, setTestingChain] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [lastTest, setLastTest] = useState<LastTestResult>(null);
  const [lastSerperTest, setLastSerperTest] = useState<LastTestResult>(null);
  const [byokInvalidFlag, setByokInvalidFlag] = useState(false);

  useEffect(() => {
    if (!user) return;
    try {
      const ai = localStorage.getItem(`byok:lastTest:ai:${user.id}:${provider}`);
      setLastTest(ai ? JSON.parse(ai) : null);
      const s = localStorage.getItem(`byok:lastTest:serper:${user.id}:`);
      setLastSerperTest(s ? JSON.parse(s) : null);
      const chain = localStorage.getItem(`byok:lastTest:chain:${user.id}:`);
      if (chain) setChainStatus(JSON.parse(chain));
      setByokInvalidFlag(localStorage.getItem(`byok:invalid:${user.id}`) === "1");
    } catch { /* ignore */ }
  }, [user, provider]);

  const current = useMemo(() => PROVIDERS.find(p => p.id === provider) || PROVIDERS[0], [provider]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("user_ai_config" as any).select("*").eq("user_id", user.id).maybeSingle();
      if (data) {
        const savedProvider = (data as any).provider as Provider || "google";
        setProvider(savedProvider);
        const pInfo = PROVIDERS.find(p => p.id === savedProvider) || PROVIDERS[0];
        setModel((data as any).model || pInfo.defaultModel);
        setModelArticle((data as any).model_article || pInfo.defaultModel);
        setModelImage((data as any).model_image || "imagen-4.0-fast-generate-001");
        setTimezone((data as any).timezone || "Brasília (UTC-3)");
        setIsByokActive((data as any).byok_active ?? true);
        const pKeys = (data as any).provider_keys || {};
        setProviderKeys(pKeys);
        if (pKeys[savedProvider]) setApiKey(pKeys[savedProvider]);
        setSerperKey((data as any).serper_key_encrypted || "");
        if ((data as any).serper_config) setSerperConfig((data as any).serper_config);
        setHasSaved(true);
        setUpdatedAt((data as any).updated_at || null);
      }

      const startOfMonth = new Date();
      startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);
      const [usageRes, limitRes] = await Promise.all([
        supabase.from("serper_audit_logs").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", startOfMonth.toISOString()),
        supabase.from("serper_usage_limits").select("*").eq("user_id", user.id).maybeSingle()
      ]);
      if (!usageRes.error || !limitRes.error) {
        setSerperUsage({
          count: usageRes.count || 0,
          limit: limitRes.data?.monthly_limit || 100,
          alert_email: limitRes.data?.alert_email || "",
          alert_threshold: limitRes.data?.alert_threshold_percent || 80
        });
      }
      setLoading(false);
    })();
  }, [user]);

  const validateProviderKey = (_p: Provider, key: string) => (!key || !key.trim()) ? "Informe a chave de API." : null;
  const validateSerperKey = (key: string) => (!key || !key.trim()) ? "Informe a chave Serper." : null;

  const logTestToDb = async (row: { kind: "ai" | "serper" | "chain"; provider?: string | null; model?: string | null; status: "success" | "error"; message?: string | null; active_model?: string | null; fallback_used?: boolean | null; duration_ms?: number | null; }) => {
    if (!user) return;
    try {
      await supabase.from("ai_config_test_log" as any).insert({ user_id: user.id, ...row, message: row.message ? String(row.message).slice(0, 500) : null });
      window.dispatchEvent(new CustomEvent("ai-test-log-updated"));
    } catch { /* ignore */ }
  };

  const persistTest = (kind: "ai" | "serper" | "chain", value: any) => {
    if (!user) return;
    try { localStorage.setItem(`byok:lastTest:${kind}:${user.id}:${kind === "ai" ? provider : ""}`, JSON.stringify(value)); } catch { /* ignore */ }
  };

  const clearInvalidFlag = () => {
    if (!user) return;
    try { localStorage.removeItem(`byok:invalid:${user.id}`); } catch { /* ignore */ }
    setByokInvalidFlag(false);
  };

  const handleTest = async () => {
    if (provider !== "lovable") {
      const err = validateProviderKey(provider, apiKey);
      if (err) { toast({ title: "Chave inválida", description: err, variant: "destructive" }); return; }
    }
    setTesting(true);
    const t0 = performance.now();
    try {
      const { data, error } = await supabase.functions.invoke("test-ai-config", { body: { provider, apiKey: apiKey.trim(), model: model || current.defaultModel } });
      if (error) throw new Error(error.message || "Erro ao conectar.");
      if (data?.success === false || data?.error) throw new Error(data.error || data.message || "Falha ao testar a chave.");
      const result: LastTestResult = { status: "success", message: data?.message, model: model || current.defaultModel, checkedAt: new Date().toISOString() };
      setLastTest(result); persistTest("ai", result); clearInvalidFlag();
      const dur = Math.round(performance.now() - t0);
      if (user) await supabase.from("user_ai_config" as any).update({ last_health_check_at: result.checkedAt, last_health_check_status: "ok", last_health_check_message: (data?.message || "").slice(0, 500) }).eq("user_id", user.id);
      await logTestToDb({ kind: "ai", provider, model: result.model, status: "success", message: data?.message, duration_ms: dur });
      toast({ title: "Funcionou! ✓", description: "Sua chave está ativa e pronta para uso." });
    } catch (error: any) {
      const result: LastTestResult = { status: "error", message: error.message, model: model || current.defaultModel, checkedAt: new Date().toISOString() };
      setLastTest(result); persistTest("ai", result);
      if (user) await supabase.from("user_ai_config" as any).update({ last_health_check_at: result.checkedAt, last_health_check_status: "invalid", last_health_check_message: (error.message || "").slice(0, 500) }).eq("user_id", user.id);
      await logTestToDb({ kind: "ai", provider, model: result.model, status: "error", message: error.message, duration_ms: Math.round(performance.now() - t0) });
      toast({ title: "Falha no teste", description: error.message, variant: "destructive" });
    } finally { setTesting(false); }
  };

  const handleTestSerper = async () => {
    const err = validateSerperKey(serperKey);
    if (err) { toast({ title: "Chave Serper inválida", description: err, variant: "destructive" }); return; }
    setTesting(true);
    const t0 = performance.now();
    try {
      const { data, error } = await supabase.functions.invoke("test-ai-config", { body: { provider: "serper", apiKey: serperKey.trim() } });
      if (error) throw new Error(error.message || "Erro ao conectar.");
      if (data?.success === false || data?.error) throw new Error(data.error || data.message || "Falha ao testar.");
      const result: LastTestResult = { status: "success", message: data?.message, checkedAt: new Date().toISOString() };
      setLastSerperTest(result); persistTest("serper", result);
      await logTestToDb({ kind: "serper", provider: "serper", status: "success", message: data?.message, duration_ms: Math.round(performance.now() - t0) });
      toast({ title: "Serper OK!", description: data.message });
    } catch (error: any) {
      const result: LastTestResult = { status: "error", message: error.message, checkedAt: new Date().toISOString() };
      setLastSerperTest(result); persistTest("serper", result);
      await logTestToDb({ kind: "serper", provider: "serper", status: "error", message: error.message, duration_ms: Math.round(performance.now() - t0) });
      toast({ title: "Falha no teste Serper", description: error.message, variant: "destructive" });
    } finally { setTesting(false); }
  };

  const handleTestChain = async () => {
    setTestingChain(true);
    const t0 = performance.now();
    try {
      const { data, error } = await supabase.functions.invoke("test-ai-chain", { body: {} });
      if (error) throw new Error(error.message || "Erro na cadeia");
      const status = { ok: !!data?.success, activeModel: data?.active_model, preferredModel: data?.preferred_model, fallbackUsed: data?.fallback_used, chain: data?.chain, message: data?.message, checkedAt: data?.checked_at || new Date().toISOString() };
      setChainStatus(status); persistTest("chain", status);
      await logTestToDb({ kind: "chain", provider, model: data?.preferred_model, status: data?.success ? "success" : "error", message: data?.message, active_model: data?.active_model, fallback_used: !!data?.fallback_used, duration_ms: Math.round(performance.now() - t0) });
      if (data?.success) toast({ title: data.fallback_used ? "Cadeia OK (fallback)" : "Cadeia OK", description: `Modelo ativo: ${data.active_model}` });
      else toast({ title: "Nenhum modelo respondeu", description: data?.message || "Falha", variant: "destructive" });
    } catch (e: any) {
      await logTestToDb({ kind: "chain", provider, status: "error", message: e.message, duration_ms: Math.round(performance.now() - t0) });
      toast({ title: "Erro ao testar cadeia", description: e.message, variant: "destructive" });
    } finally { setTestingChain(false); }
  };

  const handleSave = async () => {
    if (!user) return;
    if (isByokActive && provider !== "lovable") {
      const errKey = validateProviderKey(provider, apiKey);
      if (errKey) { toast({ title: "Chave inválida", description: errKey, variant: "destructive" }); return; }
    }
    if (serperKey) {
      const errSerper = validateSerperKey(serperKey);
      if (errSerper) { toast({ title: "Chave Serper inválida", description: errSerper, variant: "destructive" }); return; }
    }

    setSaving(true);
    const newAiKey = apiKey.trim();
    const newSerperKey = serperKey.trim();
    const updatedProviderKeys = { ...providerKeys, [provider]: newAiKey };
    setProviderKeys(updatedProviderKeys);

    const aiKeyChanged = newAiKey && newAiKey !== (providerKeys[provider] || "");
    const rotationPatch: Record<string, any> = {};
    if (aiKeyChanged) {
      rotationPatch.api_key_rotated_at = new Date().toISOString();
      rotationPatch.last_health_check_status = null;
      rotationPatch.last_health_check_message = null;
    }

    const { error } = await supabase.from("user_ai_config" as any).upsert({
      user_id: user.id, provider,
      api_key_encrypted: newAiKey || null,
      api_key_iv: newAiKey ? "manual" : null,
      provider_keys: updatedProviderKeys,
      serper_key_encrypted: newSerperKey || null,
      serper_key_iv: newSerperKey ? "manual" : null,
      model: model || current.defaultModel,
      model_article: modelArticle || current.defaultModel,
      model_image: modelImage || "imagen-4.0-fast-generate-001",
      timezone, byok_active: isByokActive, serper_config: serperConfig,
      ...rotationPatch, updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

    await supabase.from("serper_usage_limits").upsert({
      user_id: user.id, monthly_limit: serperUsage.limit,
      alert_email: serperUsage.alert_email,
      alert_threshold_percent: serperUsage.alert_threshold,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

    setSaving(false);
    if (error) { toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" }); return; }
    setHasSaved(true);
    toast({ title: "Salvo ✓", description: "Suas configurações foram atualizadas." });
  };

  if (loading) {
    return <DashboardLayout><div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></DashboardLayout>;
  }

  const isConnected = hasSaved && lastTest?.status === "success" && !!apiKey.trim();
  const quick = QUICK_STEPS[provider];

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6 py-6 px-4">
        {/* Header simples */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Conectar sua IA</h1>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Cole sua chave do Google Gemini (grátis) e comece a usar. Leva menos de 2 minutos.
          </p>
          {isConnected && (
            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" /> IA conectada e funcionando
            </Badge>
          )}
        </div>

        {/* Passo a passo simples */}
        {quick && !isConnected && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-primary fill-primary" />
                <p className="font-semibold text-sm">{quick.title}</p>
              </div>
              <ol className="space-y-2 text-sm">
                {quick.steps.map((s, i) => (
                  <li key={i} className="flex gap-2.5">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary text-primary-foreground text-[11px] font-bold flex items-center justify-center">{i + 1}</span>
                    <span className="leading-relaxed">{s}</span>
                  </li>
                ))}
              </ol>
              <Button asChild variant="outline" size="sm" className="w-full">
                <a href={quick.url} target="_blank" rel="noreferrer">
                  Abrir Google AI Studio <ExternalLink className="w-3.5 h-3.5 ml-2" />
                </a>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Card principal – provider recomendado + chave */}
        <Card className="border-border/60 shadow-sm">
          <CardContent className="p-6 space-y-5">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Provedor</Label>
                {provider !== "google" && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-primary" onClick={() => { setProvider("google"); setModel(firstModel("google")); setApiKey(providerKeys["google"] || ""); }}>
                    Usar recomendado (Google Gemini)
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg border-2 border-primary/40 bg-primary/5">
                <Cpu className="w-5 h-5 text-primary" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{current.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{current.description}</p>
                </div>
                {current.recommended && (
                  <Badge className="bg-emerald-500 text-white text-[10px]">Grátis</Badge>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Sua chave de API</Label>
                {current.helpUrl && (
                  <a href={current.helpUrl} target="_blank" rel="noreferrer" className="text-xs text-primary flex items-center gap-1 hover:underline">
                    Pegar chave <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
              <div className="relative">
                <Input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder="Cole aqui sua chave (ex: AIza...)"
                  className="font-mono text-sm pr-10 h-11"
                />
                <Button variant="ghost" size="sm" onClick={() => setShowKey(!showKey)} className="h-8 w-8 p-0 absolute right-1 top-1/2 -translate-y-1/2">
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
              {lastTest && (
                <div className={cn("text-xs flex items-center gap-1.5", lastTest.status === "success" ? "text-emerald-600" : "text-destructive")}>
                  {lastTest.status === "success" ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                  {lastTest.status === "success" ? "Chave válida e ativa" : lastTest.message}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={handleTest} disabled={testing || !apiKey.trim()} className="h-11">
                {testing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
                Testar chave
              </Button>
              <Button onClick={handleSave} disabled={saving} className="h-11 font-semibold">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                Salvar
              </Button>
            </div>

            <div className="flex items-start gap-2 text-[11px] text-muted-foreground bg-muted/40 rounded-lg p-2.5">
              <Shield className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <span>Sua chave é criptografada e privada. Somente você tem acesso — nem outros usuários, nem administradores.</span>
            </div>
          </CardContent>
        </Card>

        {/* Ajuda rápida */}
        <details className="rounded-lg border border-border/60 bg-muted/20">
          <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium flex items-center gap-2 [&::-webkit-details-marker]:hidden">
            <HelpCircle className="w-4 h-4 text-primary" />
            Preciso de ajuda para pegar minha chave
            <ChevronRight className="w-4 h-4 ml-auto transition-transform" />
          </summary>
          <div className="px-4 pb-4 text-xs text-muted-foreground space-y-2">
            <p>1. Acesse <a href={current.helpUrl} target="_blank" rel="noreferrer" className="text-primary underline">{current.helpUrl}</a></p>
            <p>2. Faça login com sua conta.</p>
            <p>3. Crie uma nova chave e copie o valor gerado.</p>
            <p>4. Volte aqui, cole no campo acima e clique em Testar.</p>
          </div>
        </details>

        {/* AVANÇADO */}
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="avancado" className="border rounded-lg bg-card">
            <AccordionTrigger className="px-4 hover:no-underline">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Settings2 className="w-4 h-4 text-muted-foreground" />
                Configurações avançadas
                <span className="text-xs text-muted-foreground font-normal">(opcional)</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4 space-y-6">

              {/* BYOK Toggle */}
              <Card className="border-border/60">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-semibold">Modo Ilimitado (BYOK)</Label>
                    <p className="text-xs text-muted-foreground">
                      {isByokActive ? "Usa sua chave pessoal (recomendado)." : "Usa créditos da plataforma (limitado)."}
                    </p>
                  </div>
                  <Switch checked={isByokActive} onCheckedChange={setIsByokActive} />
                </CardContent>
              </Card>

              {/* Outros provedores */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Trocar de provedor</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {PROVIDERS.map(p => (
                    <button key={p.id}
                      onClick={() => { setProvider(p.id); setModel(p.defaultModel); setModelArticle(p.defaultModel); setApiKey(providerKeys[p.id] || ""); }}
                      className={cn("flex flex-col items-start p-2.5 rounded-lg border-2 transition-all text-left relative", provider === p.id ? "border-primary bg-primary/5" : "border-border hover:border-border/80")}>
                      {p.recommended && <Star className="absolute top-1.5 right-1.5 w-3 h-3 text-emerald-500 fill-emerald-500" />}
                      <span className="font-semibold text-[12px]">{p.name}</span>
                      <span className="text-[10px] text-muted-foreground line-clamp-2">{p.description}</span>
                      {provider === p.id && <Check className="absolute bottom-1.5 right-1.5 w-3 h-3 text-primary" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Modelos */}
              <Card className="border-border/60">
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Zap className="w-4 h-4 text-primary" /> Modelos</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[11px] font-bold uppercase text-muted-foreground">Modelo padrão</Label>
                      <select value={model || current.defaultModel} onChange={e => setModel(e.target.value)} className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm outline-none">
                        {current.models.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-bold uppercase text-muted-foreground">Modelo de artigo</Label>
                      <select value={modelArticle || current.defaultModel} onChange={e => setModelArticle(e.target.value)} className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm outline-none">
                        {current.models.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold uppercase text-muted-foreground">Modelo de imagem</Label>
                    <Input value={modelImage || "imagen-4.0-fast-generate-001"} onChange={e => setModelImage(e.target.value)} className="h-9" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold uppercase text-muted-foreground">Fuso horário</Label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <select value={timezone} onChange={e => setTimezone(e.target.value)} className="w-full h-9 pl-9 pr-3 rounded-lg border border-input bg-background text-sm outline-none">
                        <option>Brasília (UTC-3)</option>
                        <option>Lisboa (UTC+0)</option>
                        <option>Nova York (UTC-5)</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-2.5">
                    <div className="space-y-0.5">
                      <p className="text-xs font-semibold">Resiliência de modelos</p>
                      <p className="text-[10px] text-muted-foreground">Testa fallback caso o preferido falhe.</p>
                    </div>
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleTestChain} disabled={testingChain}>
                      {testingChain ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                      Testar cadeia
                    </Button>
                  </div>
                  {chainStatus && (
                    <div className="text-[11px] space-y-1 rounded-lg bg-muted/40 p-2">
                      {chainStatus.ok ? (
                        <div className={cn("font-semibold", chainStatus.fallbackUsed ? "text-amber-600" : "text-emerald-600")}>
                          {chainStatus.fallbackUsed ? "⚠ Fallback em uso" : "✓ OK"} · {chainStatus.activeModel}
                        </div>
                      ) : <div className="text-destructive">{chainStatus.message}</div>}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Serper */}
              <Card className="border-border/60">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><Search className="w-4 h-4 text-primary" /> Pesquisa Serper (Google)</CardTitle>
                  <CardDescription className="text-xs">Opcional. Permite pesquisar dados atuais no Google.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold">Chave Serper</Label>
                      <a href="https://serper.dev" target="_blank" rel="noreferrer" className="text-xs text-primary flex items-center gap-1 hover:underline">
                        Pegar chave <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <div className="relative">
                      <Input type={showSerperKey ? "text" : "password"} value={serperKey} onChange={e => setSerperKey(e.target.value)} placeholder="Sua chave Serper" className="font-mono text-sm pr-20 h-9" />
                      <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setShowSerperKey(!showSerperKey)} className="h-7 w-7 p-0">
                          {showSerperKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </Button>
                        <Button variant="secondary" size="sm" className="h-7 text-[10px] px-2" onClick={handleTestSerper} disabled={testing}>
                          {testing ? <Loader2 className="w-3 h-3 animate-spin" /> : "Testar"}
                        </Button>
                      </div>
                    </div>
                    {lastSerperTest && (
                      <p className={cn("text-[11px]", lastSerperTest.status === "success" ? "text-emerald-600" : "text-destructive")}>
                        {lastSerperTest.status === "success" ? "✓ Serper OK" : lastSerperTest.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2 pt-2 border-t">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold">Inteligência de Imóveis</Label>
                      <Switch checked={serperConfig.real_estate?.enabled} onCheckedChange={(val) => setSerperConfig({ ...serperConfig, real_estate: { ...serperConfig.real_estate, enabled: val } })} />
                    </div>
                    {serperConfig.real_estate?.enabled && (
                      <Input value={serperConfig.real_estate?.portals?.join(", ")} onChange={(e) => setSerperConfig({ ...serperConfig, real_estate: { ...serperConfig.real_estate, portals: e.target.value.split(",").map(p => p.trim()).filter(p => p) } })} placeholder="Portais (separados por vírgula)" className="text-xs h-8" />
                    )}
                  </div>

                  <div className="space-y-2 pt-2 border-t">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold">Diligência de Proprietários</Label>
                      <Switch checked={serperConfig.owner_diligence?.enabled} onCheckedChange={(val) => setSerperConfig({ ...serperConfig, owner_diligence: { ...serperConfig.owner_diligence, enabled: val } })} />
                    </div>
                    {serperConfig.owner_diligence?.enabled && (
                      <Input value={serperConfig.owner_diligence?.portals?.join(", ")} onChange={(e) => setSerperConfig({ ...serperConfig, owner_diligence: { ...serperConfig.owner_diligence, portals: e.target.value.split(",").map(p => p.trim()).filter(p => p) } })} placeholder="Portais (separados por vírgula)" className="text-xs h-8" />
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Limites Serper */}
              <Card className="border-border/60">
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="w-4 h-4 text-primary" /> Limites e alertas Serper</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">Limite mensal</Label>
                    <div className="flex items-center gap-2">
                      <Input type="number" className="w-20 h-8 text-xs" value={serperUsage.limit} onChange={(e) => setSerperUsage({ ...serperUsage, limit: parseInt(e.target.value) || 0 })} />
                      <span className="text-[10px] text-muted-foreground">unid.</span>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="text-muted-foreground">Consumo</span>
                      <span className="font-bold">{serperUsage.count} / {serperUsage.limit}</span>
                    </div>
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <div className={cn("h-full", (serperUsage.count / serperUsage.limit) > 0.9 ? "bg-destructive" : (serperUsage.count / serperUsage.limit) > 0.7 ? "bg-amber-500" : "bg-primary")} style={{ width: `${Math.min(100, (serperUsage.count / (serperUsage.limit || 1)) * 100)}%` }} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-semibold flex items-center gap-1"><Mail className="w-3 h-3" /> E-mail alerta</Label>
                      <Input placeholder="seu@email.com" className="h-8 text-xs" value={serperUsage.alert_email} onChange={(e) => setSerperUsage({ ...serperUsage, alert_email: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-semibold">Disparar em</Label>
                      <select className="w-full h-8 px-2 rounded-lg border border-input bg-background text-xs outline-none" value={serperUsage.alert_threshold} onChange={(e) => setSerperUsage({ ...serperUsage, alert_threshold: parseInt(e.target.value) })}>
                        <option value={50}>50%</option><option value={70}>70%</option><option value={80}>80%</option><option value={90}>90%</option><option value={100}>100%</option>
                      </select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Diagnóstico */}
              <ByokDiagnosticoPanel provider={provider} providerLabel={current.name} model={model || current.defaultModel} apiKeyPresent={!!apiKey.trim()} serperKeyPresent={!!serperKey.trim()} isByokActive={isByokActive} hasSaved={hasSaved} updatedAt={updatedAt} lastTest={lastTest} lastSerperTest={lastSerperTest} chainStatus={chainStatus} byokInvalidFlag={byokInvalidFlag} />

              {/* Rotação */}
              {user && hasSaved && (
                <RotacaoChavesPanel userId={user.id} provider={provider} providerLabel={current.name} hasAiKey={!!apiKey.trim()} hasSerperKey={!!serperKey.trim()} />
              )}

              {/* Histórico */}
              {user && <TestHistoricoPanel userId={user.id} />}

              <Button className="w-full" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                Salvar configurações avançadas
              </Button>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </DashboardLayout>
  );
}
