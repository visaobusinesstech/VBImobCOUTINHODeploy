import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Bell, Send, Loader2, X } from "lucide-react";

const TIPOS = [
  { key: "etapa_avancada", label: "Etapa avançada" },
  { key: "resposta_recebida", label: "Resposta recebida" },
  { key: "sem_contato_max", label: "Sem contato (limite de tentativas)" },
];

interface Config {
  wa_enabled: boolean;
  email_enabled: boolean;
  destinatarios_wa: string[];
  destinatarios_email: string[];
  tipos_habilitados: string[];
}

const empty: Config = {
  wa_enabled: true,
  email_enabled: false,
  destinatarios_wa: [],
  destinatarios_email: [],
  tipos_habilitados: TIPOS.map((t) => t.key),
};

export function NotificacoesCondominioPanel() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [cfg, setCfg] = useState<Config>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [novoTel, setNovoTel] = useState("");
  const [novoEmail, setNovoEmail] = useState("");
  const [eventos, setEventos] = useState<any[]>([]);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("condominio_notificacoes_config")
      .select("*")
      .eq("imobiliaria_id", user.id)
      .maybeSingle();
    if (data) setCfg({ ...empty, ...data });
    const { data: evs } = await supabase
      .from("condominio_notificacoes_eventos")
      .select("*")
      .eq("imobiliaria_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);
    setEventos(evs ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user?.id]);

  const salvar = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("condominio_notificacoes_config")
      .upsert({ imobiliaria_id: user.id, ...cfg }, { onConflict: "imobiliaria_id" });
    setSaving(false);
    if (error) return toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    toast({ title: "Configuração salva" });
  };

  const enviarAgora = async () => {
    setDispatching(true);
    const { data, error } = await supabase.functions.invoke("condo-notificacoes-dispatch");
    setDispatching(false);
    if (error) return toast({ title: "Falha ao processar", description: error.message, variant: "destructive" });
    toast({ title: "Fila processada", description: `${data?.processed ?? 0} evento(s)` });
    load();
  };

  const addTel = () => {
    const t = novoTel.replace(/\D/g, "");
    if (t.length < 10) return toast({ title: "Telefone inválido", variant: "destructive" });
    setCfg({ ...cfg, destinatarios_wa: Array.from(new Set([...cfg.destinatarios_wa, t])) });
    setNovoTel("");
  };
  const addEmail = () => {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(novoEmail)) return toast({ title: "E-mail inválido", variant: "destructive" });
    setCfg({ ...cfg, destinatarios_email: Array.from(new Set([...cfg.destinatarios_email, novoEmail])) });
    setNovoEmail("");
  };

  const toggleTipo = (k: string, on: boolean) => {
    setCfg({
      ...cfg,
      tipos_habilitados: on
        ? Array.from(new Set([...cfg.tipos_habilitados, k]))
        : cfg.tipos_habilitados.filter((t) => t !== k),
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2"><Bell className="w-4 h-4" /> Notificações de Prospecção</CardTitle>
            <CardDescription>Avisos automáticos por WhatsApp e e-mail para etapas, respostas e falhas de contato.</CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={enviarAgora} disabled={dispatching}>
            {dispatching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Processar fila
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Carregando…</div>
          ) : (
            <>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>WhatsApp</Label>
                    <Switch checked={cfg.wa_enabled} onCheckedChange={(v) => setCfg({ ...cfg, wa_enabled: v })} />
                  </div>
                  <div className="flex gap-2">
                    <Input placeholder="Ex: 61999998888" value={novoTel} onChange={(e) => setNovoTel(e.target.value)} />
                    <Button onClick={addTel} variant="secondary">Adicionar</Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {cfg.destinatarios_wa.map((t) => (
                      <Badge key={t} variant="secondary" className="gap-1">
                        {t}
                        <button onClick={() => setCfg({ ...cfg, destinatarios_wa: cfg.destinatarios_wa.filter((x) => x !== t) })}><X className="w-3 h-3" /></button>
                      </Badge>
                    ))}
                    {cfg.destinatarios_wa.length === 0 && <span className="text-xs text-muted-foreground">Nenhum destinatário</span>}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>E-mail</Label>
                    <Switch checked={cfg.email_enabled} onCheckedChange={(v) => setCfg({ ...cfg, email_enabled: v })} />
                  </div>
                  <div className="flex gap-2">
                    <Input placeholder="voce@empresa.com" value={novoEmail} onChange={(e) => setNovoEmail(e.target.value)} />
                    <Button onClick={addEmail} variant="secondary">Adicionar</Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {cfg.destinatarios_email.map((t) => (
                      <Badge key={t} variant="secondary" className="gap-1">
                        {t}
                        <button onClick={() => setCfg({ ...cfg, destinatarios_email: cfg.destinatarios_email.filter((x) => x !== t) })}><X className="w-3 h-3" /></button>
                      </Badge>
                    ))}
                    {cfg.destinatarios_email.length === 0 && <span className="text-xs text-muted-foreground">Nenhum destinatário</span>}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Eventos habilitados</Label>
                <div className="grid sm:grid-cols-3 gap-2">
                  {TIPOS.map((t) => (
                    <label key={t.key} className="flex items-center gap-2 rounded-md border p-2 cursor-pointer">
                      <Checkbox
                        checked={cfg.tipos_habilitados.includes(t.key)}
                        onCheckedChange={(v) => toggleTipo(t.key, Boolean(v))}
                      />
                      <span className="text-sm">{t.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={salvar} disabled={saving}>
                  {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Salvar configuração
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Últimos eventos</CardTitle>
          <CardDescription>Eventos gerados automaticamente pelas prospecções.</CardDescription>
        </CardHeader>
        <CardContent>
          {eventos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum evento registrado ainda.</p>
          ) : (
            <div className="space-y-2">
              {eventos.map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-2 border rounded-md p-2 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant={e.status === "sent" ? "default" : e.status === "failed" ? "destructive" : "secondary"}>
                      {e.status}
                    </Badge>
                    <span className="font-medium truncate">{TIPOS.find((t) => t.key === e.tipo)?.label ?? e.tipo}</span>
                    <span className="text-muted-foreground truncate">— {e.condominio_nome ?? "—"}</span>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {new Date(e.created_at).toLocaleString("pt-BR")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
