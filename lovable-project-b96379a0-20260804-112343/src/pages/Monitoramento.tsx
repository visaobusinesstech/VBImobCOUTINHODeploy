import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Plus, PlayCircle, Radio, Globe2, MessageSquare, ExternalLink, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { TesteCredenciaisButton } from "@/components/monitoramento/TesteCredenciaisButton";

type Tipo = "telegram_channel" | "portal_crawler" | "facebook_apify";

const TIPO_META: Record<Tipo, { label: string; Icon: any; hint: string }> = {
  telegram_channel:  { label: "Telegram (canal público)", Icon: MessageSquare, hint: "Webhook em tempo real. Requer conector Telegram e canal público." },
  portal_crawler:    { label: "Portal imobiliário",       Icon: Globe2,        hint: "Firecrawl agendado. Sem custo de conector adicional." },
  facebook_apify:    { label: "Facebook (Apify)",         Icon: Radio,         hint: "Apify Actor. Requer conector Apify linkado." },
};

export default function Monitoramento() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tipo>("portal_crawler");
  const [fontes, setFontes] = useState<any[]>([]);
  const [capturas, setCapturas] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningId, setRunningId] = useState<string | null>(null);

  const carregar = async () => {
    setLoading(true);
    const [f, c, l] = await Promise.all([
      supabase.from("monitoramento_fontes" as any).select("*").order("created_at", { ascending: false }),
      supabase.from("monitoramento_capturas" as any).select("*").order("captado_em", { ascending: false }).limit(50),
      supabase.from("monitoramento_execucoes_log" as any).select("*").order("iniciado_em", { ascending: false }).limit(20),
    ]);
    setFontes((f.data as any) ?? []);
    setCapturas((c.data as any) ?? []);
    setLogs((l.data as any) ?? []);
    setLoading(false);
  };
  useEffect(() => { carregar(); }, []);

  const fontesFiltradas = useMemo(() => fontes.filter(f => f.tipo === tab), [fontes, tab]);
  const capturasFiltradas = useMemo(() => capturas.filter(c => c.tipo_fonte === tab), [capturas, tab]);
  const logsFiltrados = useMemo(() => logs.filter(l => l.tipo_fonte === tab), [logs, tab]);

  const executarAgora = async (fonteId: string) => {
    setRunningId(fonteId);
    try {
      const fn = tab === "portal_crawler" ? "monitor-portais-crawl"
              : tab === "facebook_apify"   ? "monitor-facebook-apify"
              : null;
      if (!fn) { toast({ title: "Telegram é tempo real", description: "As mensagens chegam via webhook automaticamente." }); return; }
      const { error } = await supabase.functions.invoke(fn, { body: { fonte_id: fonteId } });
      if (error) throw error;
      toast({ title: "Execução iniciada" });
      await carregar();
    } catch (e: any) {
      toast({ title: "Falha ao executar", description: e?.message ?? String(e), variant: "destructive" });
    } finally { setRunningId(null); }
  };

  const toggleAtivo = async (f: any) => {
    await supabase.from("monitoramento_fontes" as any).update({ ativo: !f.ativo }).eq("id", f.id);
    carregar();
  };

  return (
    <div className="container mx-auto p-4 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Monitoramento de fontes públicas</h1>
          <p className="text-sm text-muted-foreground">
            Rastreamento contínuo e ético de canais públicos para captação de proprietários diretos. Todo dado guarda a URL pública original (LGPD Art. 7º, IV).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TesteCredenciaisButton />
          <NovaFonteDialog imobiliariaId={user?.id ?? ""} onCreated={carregar} tipoInicial={tab} />
        </div>
      </div>

      <Tabs value={tab} onValueChange={v => setTab(v as Tipo)}>
        <TabsList>
          {(Object.keys(TIPO_META) as Tipo[]).map(t => {
            const M = TIPO_META[t];
            return <TabsTrigger key={t} value={t}><M.Icon className="w-4 h-4 mr-1" />{M.label.split(" ")[0]}</TabsTrigger>;
          })}
        </TabsList>

        {(Object.keys(TIPO_META) as Tipo[]).map(t => (
          <TabsContent key={t} value={t} className="space-y-4">
            <Alert>
              <ShieldCheck className="w-4 h-4" />
              <AlertDescription className="text-xs">{TIPO_META[t].hint}</AlertDescription>
            </Alert>

            <Card>
              <CardHeader><CardTitle className="text-base">Fontes configuradas</CardTitle></CardHeader>
              <CardContent>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> :
                  fontesFiltradas.length === 0 ? (
                    <div className="text-sm text-muted-foreground">Nenhuma fonte cadastrada — clique em <b>Nova fonte</b>.</div>
                  ) : (
                    <div className="divide-y">
                      {fontesFiltradas.map(f => (
                        <div key={f.id} className="py-2 flex items-start justify-between gap-3 flex-wrap">
                          <div className="min-w-0">
                            <div className="font-medium text-sm">{f.nome}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {(f.cidades_alvo ?? []).join(", ") || "Sem cidades alvo"} · {(f.operacao_alvo ?? []).join("/") || "venda/locação"}
                            </div>
                            {f.fonte_url_publica && (
                              <a href={f.fonte_url_publica} target="_blank" rel="noreferrer" className="text-[11px] text-primary hover:underline inline-flex items-center gap-1">
                                <ExternalLink className="w-3 h-3" /> Fonte pública
                              </a>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={f.ativo ? "default" : "outline"}>{f.ativo ? "Ativa" : "Pausada"}</Badge>
                            <Badge variant="secondary" className="text-[10px]">{f.total_capturas ?? 0} capturas</Badge>
                            <Button size="sm" variant="outline" onClick={() => toggleAtivo(f)}>{f.ativo ? "Pausar" : "Ativar"}</Button>
                            {t !== "telegram_channel" && (
                              <Button size="sm" onClick={() => executarAgora(f.id)} disabled={runningId === f.id}>
                                {runningId === f.id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <PlayCircle className="w-3 h-3 mr-1" />}
                                Executar agora
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader><CardTitle className="text-base">Últimas capturas</CardTitle></CardHeader>
                <CardContent className="text-sm space-y-2 max-h-[420px] overflow-auto">
                  {capturasFiltradas.length === 0 ? <div className="text-muted-foreground">Sem capturas ainda.</div> :
                    capturasFiltradas.map(c => (
                      <div key={c.id} className="border rounded p-2 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-medium text-sm truncate">{c.titulo ?? c.external_id}</div>
                          <Badge variant={c.status === "processado" ? "default" : c.status === "erro" ? "destructive" : "secondary"} className="text-[10px]">{c.status}</Badge>
                        </div>
                        {c.texto && <div className="text-xs text-muted-foreground line-clamp-2">{c.texto}</div>}
                        {c.url_origem && (
                          <a href={c.url_origem} target="_blank" rel="noreferrer" className="text-[11px] text-primary hover:underline inline-flex items-center gap-1">
                            <ExternalLink className="w-3 h-3" /> Fonte pública original
                          </a>
                        )}
                        <div className="text-[10px] text-muted-foreground">{new Date(c.captado_em).toLocaleString("pt-BR")}</div>
                      </div>
                    ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">Execuções recentes</CardTitle></CardHeader>
                <CardContent className="text-sm max-h-[420px] overflow-auto">
                  {logsFiltrados.length === 0 ? <div className="text-muted-foreground">Sem execuções ainda.</div> :
                    <div className="divide-y">
                      {logsFiltrados.map(l => (
                        <div key={l.id} className="py-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span>{new Date(l.iniciado_em).toLocaleString("pt-BR")}</span>
                            <Badge variant={l.status === "ok" ? "default" : l.status === "erro" ? "destructive" : "secondary"} className="text-[10px]">{l.status}</Badge>
                          </div>
                          <div className="text-muted-foreground">novos {l.itens_novos} · dup {l.itens_duplicados} · desc {l.itens_descartados} · {l.duracao_ms ?? "?"}ms</div>
                          {l.erro && <div className="text-destructive line-clamp-2">{l.erro}</div>}
                        </div>
                      ))}
                    </div>}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function NovaFonteDialog({ imobiliariaId, onCreated, tipoInicial }: { imobiliariaId: string; onCreated: () => void; tipoInicial: Tipo }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({
    tipo: tipoInicial, nome: "", cidades: "", bairros: "",
    fonte_url_publica: "", operacao_alvo: ["venda","locacao"],
    portais: "vivareal.com.br, zapimoveis.com.br, olx.com.br, dfimoveis.com.br",
    telegram_chat_id: "", apify_actor_id: "", apify_input: "{}",
  });
  useEffect(() => setForm((f: any) => ({ ...f, tipo: tipoInicial })), [tipoInicial]);

  const salvar = async () => {
    if (!imobiliariaId) { toast({ title: "Sessão inválida", variant: "destructive" }); return; }
    if (!form.nome.trim()) { toast({ title: "Nome obrigatório", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const config: any = {};
      if (form.tipo === "portal_crawler") {
        config.portais = form.portais.split(",").map((s: string) => s.trim()).filter(Boolean);
      }
      if (form.tipo === "telegram_channel") {
        config.chat_id = form.telegram_chat_id.trim();
      }
      if (form.tipo === "facebook_apify") {
        config.actor_id = form.apify_actor_id.trim();
        try { config.input = JSON.parse(form.apify_input || "{}"); } catch { throw new Error("Input JSON inválido"); }
      }
      const payload = {
        imobiliaria_id: imobiliariaId,
        tipo: form.tipo,
        nome: form.nome.trim(),
        cidades_alvo: form.cidades.split(",").map((s: string) => s.trim()).filter(Boolean),
        bairros_alvo: form.bairros.split(",").map((s: string) => s.trim()).filter(Boolean),
        operacao_alvo: form.operacao_alvo,
        fonte_url_publica: form.fonte_url_publica.trim() || null,
        config, ativo: true,
      };
      const { error } = await supabase.from("monitoramento_fontes" as any).insert(payload);
      if (error) throw error;
      toast({ title: "Fonte criada" });
      setOpen(false); onCreated();
    } catch (e: any) {
      toast({ title: "Erro", description: e?.message ?? String(e), variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-1" /> Nova fonte</Button></DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Nova fonte de monitoramento</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Tipo</Label>
            <Select value={form.tipo} onValueChange={v => setForm({ ...form, tipo: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(TIPO_META) as Tipo[]).map(t => (
                  <SelectItem key={t} value={t}>{TIPO_META[t].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Nome</Label><Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} /></div>
          <div><Label>Cidades alvo (separadas por vírgula)</Label><Input value={form.cidades} onChange={e => setForm({ ...form, cidades: e.target.value })} placeholder="Brasília, Taguatinga" /></div>
          <div><Label>Bairros alvo (opcional)</Label><Input value={form.bairros} onChange={e => setForm({ ...form, bairros: e.target.value })} /></div>
          <div><Label>URL pública da fonte (obrigatório para LGPD)</Label><Input value={form.fonte_url_publica} onChange={e => setForm({ ...form, fonte_url_publica: e.target.value })} placeholder="https://..." /></div>

          {form.tipo === "portal_crawler" && (
            <div><Label>Portais (site: ...)</Label><Textarea rows={2} value={form.portais} onChange={e => setForm({ ...form, portais: e.target.value })} /></div>
          )}
          {form.tipo === "telegram_channel" && (
            <div><Label>Chat ID do canal (ex: @meucanal ou -100...)</Label><Input value={form.telegram_chat_id} onChange={e => setForm({ ...form, telegram_chat_id: e.target.value })} /></div>
          )}
          {form.tipo === "facebook_apify" && (
            <>
              <div><Label>Actor ID (username~actor-name)</Label><Input value={form.apify_actor_id} onChange={e => setForm({ ...form, apify_actor_id: e.target.value })} placeholder="apify~facebook-marketplace-scraper" /></div>
              <div><Label>Input (JSON)</Label><Textarea rows={4} value={form.apify_input} onChange={e => setForm({ ...form, apify_input: e.target.value })} /></div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button onClick={salvar} disabled={saving}>{saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
