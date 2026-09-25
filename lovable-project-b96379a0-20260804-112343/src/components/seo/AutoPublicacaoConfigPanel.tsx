import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Save, Zap } from "lucide-react";

const TIPOS = [
  { value: "blog", label: "Posts de Blog" },
  { value: "descricao", label: "Descrições de Imóvel" },
  { value: "metatags", label: "Meta Tags" },
  { value: "portais", label: "Textos p/ Portais" },
];

interface Config {
  id?: string;
  ativo: boolean;
  tipos_permitidos: string[];
  min_palavras: number;
  exigir_meta_description: boolean;
  exigir_titulo_min: number;
  atraso_horas: number;
  max_por_dia: number;
  janela_inicio: number;
  janela_fim: number;
  bloquear_publicacao_seo_critico: boolean;
}

const DEFAULT: Config = {
  ativo: false,
  tipos_permitidos: ["blog"],
  min_palavras: 300,
  exigir_meta_description: true,
  exigir_titulo_min: 30,
  atraso_horas: 24,
  max_por_dia: 5,
  janela_inicio: 8,
  janela_fim: 20,
  bloquear_publicacao_seo_critico: false,
};

export function AutoPublicacaoConfigPanel() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cfg, setCfg] = useState<Config>(DEFAULT);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("conteudo_seo_autopublish_config" as any)
        .select("*")
        .eq("imobiliaria_id", user.id)
        .maybeSingle();
      if (data) setCfg({ ...DEFAULT, ...(data as any) });
      setLoading(false);
    })();
  }, [user]);

  const salvar = async () => {
    if (!user) return;
    setSaving(true);
    const payload = { ...cfg, imobiliaria_id: user.id };
    const { error } = await supabase
      .from("conteudo_seo_autopublish_config" as any)
      .upsert(payload as any, { onConflict: "imobiliaria_id" });
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Configuração salva", description: "Regras de auto-publicação atualizadas." });
    }
  };

  const executarAgora = async () => {
    const { data, error } = await supabase.rpc("aplicar_autopublicacao_seo" as any);
    if (error) {
      toast({ title: "Falha ao executar", description: error.message, variant: "destructive" });
    } else {
      const n = Array.isArray(data) ? (data[0] as any)?.publicados ?? 0 : 0;
      toast({ title: "Execução concluída", description: `${n} rascunho(s) publicado(s).` });
    }
  };

  const toggleTipo = (t: string) => {
    setCfg((c) => ({
      ...c,
      tipos_permitidos: c.tipos_permitidos.includes(t)
        ? c.tipos_permitidos.filter((x) => x !== t)
        : [...c.tipos_permitidos, t],
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-4 h-4" /> Publicação automática de conteúdo SEO
            </CardTitle>
            <CardDescription>
              Rascunhos que atenderem às regras são publicados sozinhos. Roda a cada 30 min.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={cfg.ativo} onCheckedChange={(v) => setCfg({ ...cfg, ativo: v })} />
            <span className="text-sm font-medium">{cfg.ativo ? "Ativo" : "Pausado"}</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <div>
          <Label className="mb-2 block">Tipos de conteúdo elegíveis</Label>
          <div className="grid grid-cols-2 gap-2">
            {TIPOS.map((t) => (
              <label key={t.value} className="flex items-center gap-2 text-sm cursor-pointer rounded border p-2 hover:bg-secondary/50">
                <Checkbox
                  checked={cfg.tipos_permitidos.includes(t.value)}
                  onCheckedChange={() => toggleTipo(t.value)}
                />
                {t.label}
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Mínimo de palavras</Label>
            <Input type="number" min={50} value={cfg.min_palavras}
              onChange={(e) => setCfg({ ...cfg, min_palavras: Number(e.target.value) })} />
            <p className="text-xs text-muted-foreground mt-1">Rascunhos menores continuam como rascunho.</p>
          </div>
          <div>
            <Label>Mínimo de caracteres no título</Label>
            <Input type="number" min={10} value={cfg.exigir_titulo_min}
              onChange={(e) => setCfg({ ...cfg, exigir_titulo_min: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Atraso antes de publicar (horas)</Label>
            <Input type="number" min={0} value={cfg.atraso_horas}
              onChange={(e) => setCfg({ ...cfg, atraso_horas: Number(e.target.value) })} />
            <p className="text-xs text-muted-foreground mt-1">Tempo mínimo em rascunho — janela para você revisar.</p>
          </div>
          <div>
            <Label>Máximo de publicações automáticas por dia</Label>
            <Input type="number" min={1} value={cfg.max_por_dia}
              onChange={(e) => setCfg({ ...cfg, max_por_dia: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Janela horária — início</Label>
            <Input type="number" min={0} max={23} value={cfg.janela_inicio}
              onChange={(e) => setCfg({ ...cfg, janela_inicio: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Janela horária — fim</Label>
            <Input type="number" min={0} max={23} value={cfg.janela_fim}
              onChange={(e) => setCfg({ ...cfg, janela_fim: Number(e.target.value) })} />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Checkbox checked={cfg.exigir_meta_description}
            onCheckedChange={(v) => setCfg({ ...cfg, exigir_meta_description: Boolean(v) })} />
          Exigir <strong>meta description</strong> preenchida (mín. 50 caracteres)
        </label>

        <div className="rounded-lg border border-red-200 bg-red-50/40 p-3 space-y-2">
          <label className="flex items-start gap-3 text-sm cursor-pointer">
            <Switch
              checked={cfg.bloquear_publicacao_seo_critico}
              onCheckedChange={(v) => setCfg({ ...cfg, bloquear_publicacao_seo_critico: v })}
            />
            <span>
              <strong className="block">Bloquear publicação com itens críticos no checklist SEO</strong>
              <span className="text-xs text-muted-foreground">
                Quando ativo, o botão "Publicar" fica desabilitado enquanto houver itens marcados como
                <strong> Crítico</strong> na aba Checklist do preview. Vale para publicação manual e automática.
              </span>
            </span>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
          <Button onClick={salvar} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar regras
          </Button>
          <Button variant="outline" onClick={executarAgora} className="gap-2">
            <Zap className="w-4 h-4" /> Executar agora
          </Button>
          <span className="text-xs text-muted-foreground ml-auto">
            Fuso: America/Sao_Paulo · Execução automática: a cada 30 min
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
