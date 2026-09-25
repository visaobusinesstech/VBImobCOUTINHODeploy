import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Play, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Config {
  ativo: boolean;
  dias_antes: number[];
  dias_apos: number[];
  canal_whatsapp: boolean;
  canal_email: boolean;
  canal_notificacao: boolean;
  mensagem_template: string;
  categorias: string[];
}

const DEFAULT: Config = {
  ativo: true,
  dias_antes: [5, 1],
  dias_apos: [1, 7],
  canal_whatsapp: true,
  canal_email: false,
  canal_notificacao: true,
  mensagem_template:
    "Olá {{nome}}, sua cobrança de {{descricao}} no valor de {{valor}} vence em {{data}}. Acesse o link para pagar: {{link}}",
  categorias: ["aluguel", "comissao", "despesa"],
};

const parseDays = (s: string) =>
  s.split(",").map((x) => parseInt(x.trim(), 10)).filter((x) => !isNaN(x) && x >= 0 && x <= 90);

export default function CobrancasConfigPanel() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [cfg, setCfg] = useState<Config>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [antesStr, setAntesStr] = useState("5, 1");
  const [aposStr, setAposStr] = useState("1, 7");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("cobrancas_lembretes_config")
        .select("*")
        .eq("imobiliaria_id", user.id)
        .maybeSingle();
      if (data) {
        setCfg(data as any);
        setAntesStr((data.dias_antes ?? []).join(", "));
        setAposStr((data.dias_apos ?? []).join(", "));
      }
      setLoading(false);
    })();
  }, [user]);

  const salvar = async () => {
    if (!user) return;
    setSaving(true);
    const payload = {
      imobiliaria_id: user.id,
      ...cfg,
      dias_antes: parseDays(antesStr),
      dias_apos: parseDays(aposStr),
    };
    const { error } = await supabase
      .from("cobrancas_lembretes_config")
      .upsert(payload, { onConflict: "imobiliaria_id" });
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Configuração salva" });
    }
  };

  const testar = async () => {
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("enviar-lembretes-cobranca", {
        body: {},
      });
      if (error) throw error;
      toast({
        title: "Execução concluída",
        description: `Enviados: ${data?.sent ?? 0} — Ignorados: ${data?.skipped ?? 0}`,
      });
    } catch (err) {
      toast({ title: "Erro", description: (err as Error).message, variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Automação de lembretes de cobrança</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label>Automação ativa</Label>
              <p className="text-xs text-muted-foreground">Envia lembretes automáticos diariamente às 08:00.</p>
            </div>
            <Switch checked={cfg.ativo} onCheckedChange={(v) => setCfg({ ...cfg, ativo: v })} />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Lembrar quantos dias antes do vencimento</Label>
              <Input value={antesStr} onChange={(e) => setAntesStr(e.target.value)} placeholder="5, 1" />
              <p className="text-xs text-muted-foreground">Ex.: 5, 1 = 5 dias antes e 1 dia antes.</p>
            </div>
            <div className="space-y-2">
              <Label>Cobrar quantos dias após atraso</Label>
              <Input value={aposStr} onChange={(e) => setAposStr(e.target.value)} placeholder="1, 7" />
              <p className="text-xs text-muted-foreground">Ex.: 1, 7 = no dia seguinte ao vencimento e 7 dias depois.</p>
            </div>
          </div>

          <div className="space-y-3">
            <Label>Canais</Label>
            <div className="grid grid-cols-3 gap-3">
              <label className="flex items-center gap-2 rounded-md border p-2">
                <Switch checked={cfg.canal_notificacao} onCheckedChange={(v) => setCfg({ ...cfg, canal_notificacao: v })} />
                <span className="text-sm">Notificação in-app</span>
              </label>
              <label className="flex items-center gap-2 rounded-md border p-2">
                <Switch checked={cfg.canal_whatsapp} onCheckedChange={(v) => setCfg({ ...cfg, canal_whatsapp: v })} />
                <span className="text-sm">WhatsApp</span>
              </label>
              <label className="flex items-center gap-2 rounded-md border p-2 opacity-60">
                <Switch checked={cfg.canal_email} onCheckedChange={(v) => setCfg({ ...cfg, canal_email: v })} disabled />
                <span className="text-sm">E-mail (em breve)</span>
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Template da mensagem</Label>
            <Textarea
              rows={4}
              value={cfg.mensagem_template}
              onChange={(e) => setCfg({ ...cfg, mensagem_template: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Variáveis: <code>{"{{nome}}"}</code>, <code>{"{{descricao}}"}</code>, <code>{"{{valor}}"}</code>,{" "}
              <code>{"{{data}}"}</code>, <code>{"{{link}}"}</code>, <code>{"{{dias}}"}</code>,{" "}
              <code>{"{{status}}"}</code>
            </p>
          </div>

          <div className="flex gap-2">
            <Button onClick={salvar} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar configuração
            </Button>
            <Button variant="outline" onClick={testar} disabled={testing}>
              {testing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
              Executar agora (teste)
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
