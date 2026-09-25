import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { Loader2, RotateCcw, Save } from "lucide-react";

type Cfg = {
  peso_operacao: number;
  peso_contato_bom: number;
  peso_contato_parcial: number;
  peso_preco: number;
  peso_bairro: number;
  peso_cidade: number;
  peso_proprietario: number;
  peso_tipo: number;
  min_score_principal: number;
  alerta_score_alto: number;
};

const DEFAULTS: Cfg = {
  peso_operacao: 30,
  peso_contato_bom: 25,
  peso_contato_parcial: 10,
  peso_preco: 15,
  peso_bairro: 15,
  peso_cidade: 7,
  peso_proprietario: 10,
  peso_tipo: 5,
  min_score_principal: 40,
  alerta_score_alto: 70,
};

const FIELDS: { key: keyof Cfg; label: string; hint: string }[] = [
  { key: "peso_operacao", label: "Operação identificada (venda/aluguel/temporada)", hint: "Sinal mais forte de intenção comercial." },
  { key: "peso_contato_bom", label: "Contato com DDD completo (≥10 dígitos)", hint: "Telefone completo, fácil de acionar." },
  { key: "peso_contato_parcial", label: "Contato parcial (8–9 dígitos)", hint: "Número incompleto ou sem DDD." },
  { key: "peso_preco", label: "Preço informado", hint: "Permite comparar mercado e priorizar." },
  { key: "peso_bairro", label: "Bairro identificado", hint: "Localização precisa (peso maior)." },
  { key: "peso_cidade", label: "Só cidade identificada", hint: "Localização ampla (fallback)." },
  { key: "peso_proprietario", label: "Nome do proprietário", hint: "Reduz ambiguidade e agiliza abordagem." },
  { key: "peso_tipo", label: "Tipo do imóvel", hint: "Casa, apto, terreno, etc." },
];

export default function RadarZapScoringConfig() {
  const { imobiliariaId } = useAuth();
  const { toast } = useToast();
  const [cfg, setCfg] = useState<Cfg>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!imobiliariaId) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("radarzap_scoring_config")
        .select("*")
        .eq("imobiliaria_id", imobiliariaId)
        .maybeSingle();
      if (data) {
        setCfg({
          peso_operacao: data.peso_operacao,
          peso_contato_bom: data.peso_contato_bom,
          peso_contato_parcial: data.peso_contato_parcial,
          peso_preco: data.peso_preco,
          peso_bairro: data.peso_bairro,
          peso_cidade: data.peso_cidade,
          peso_proprietario: data.peso_proprietario,
          peso_tipo: data.peso_tipo,
          min_score_principal: data.min_score_principal,
          alerta_score_alto: (data as any).alerta_score_alto ?? 70,
        });
      }
      setLoading(false);
    })();
  }, [imobiliariaId]);

  const somaMax =
    cfg.peso_operacao +
    Math.max(cfg.peso_contato_bom, cfg.peso_contato_parcial) +
    cfg.peso_preco +
    Math.max(cfg.peso_bairro, cfg.peso_cidade) +
    cfg.peso_proprietario +
    cfg.peso_tipo;

  const salvar = async () => {
    if (!imobiliariaId) return;
    setSaving(true);
    const { error } = await supabase
      .from("radarzap_scoring_config")
      .upsert(
        { imobiliaria_id: imobiliariaId, ...cfg },
        { onConflict: "imobiliaria_id" }
      );
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Configuração salva", description: "Novos leads já usam esses pesos." });
    }
  };

  const restaurar = () => setCfg(DEFAULTS);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Scoring RadarZAP</h1>
        <p className="text-sm text-muted-foreground">
          Ajuste os pesos de cada critério e o score mínimo para que um lead seja considerado principal e vire card no pipeline.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Score mínimo para criar card no pipeline</CardTitle>
          <CardDescription>
            Leads principais só entram no pipeline se atingirem esse score (0 a 100). Padrão: 40.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Slider
              value={[cfg.min_score_principal]}
              min={0}
              max={100}
              step={1}
              onValueChange={(v) => setCfg({ ...cfg, min_score_principal: v[0] })}
              className="flex-1"
            />
            <Input
              type="number"
              min={0}
              max={100}
              value={cfg.min_score_principal}
              onChange={(e) =>
                setCfg({ ...cfg, min_score_principal: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })
              }
              className="w-20"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Score máximo possível com os pesos atuais: <strong>{somaMax}</strong>. Se o mínimo for maior que isso, nenhum card será criado.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Alerta de lead quente</CardTitle>
          <CardDescription>
            Quando um lead principal atingir esse score, você e o corretor responsável recebem uma notificação com resumo do imóvel. Defina 0 para desativar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-4">
            <Slider
              value={[cfg.alerta_score_alto]}
              min={0}
              max={100}
              step={1}
              onValueChange={(v) => setCfg({ ...cfg, alerta_score_alto: v[0] })}
              className="flex-1"
            />
            <Input
              type="number"
              min={0}
              max={100}
              value={cfg.alerta_score_alto}
              onChange={(e) =>
                setCfg({ ...cfg, alerta_score_alto: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })
              }
              className="w-20"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Padrão: 70. Cada lead dispara o alerta apenas uma vez (novo alerta só ocorre se ele cair abaixo e voltar a subir manualmente).
          </p>
        </CardContent>
      </Card>


      <Card>
        <CardHeader>
          <CardTitle>Pesos dos critérios</CardTitle>
          <CardDescription>
            Cada critério soma pontos ao score do lead. Ajuste conforme a estratégia da sua imobiliária.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {FIELDS.map((f) => (
            <div key={f.key} className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-sm">{f.label}</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={cfg[f.key]}
                  onChange={(e) =>
                    setCfg({ ...cfg, [f.key]: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })
                  }
                  className="w-20"
                />
              </div>
              <Slider
                value={[cfg[f.key]]}
                min={0}
                max={100}
                step={1}
                onValueChange={(v) => setCfg({ ...cfg, [f.key]: v[0] })}
              />
              <p className="text-xs text-muted-foreground">{f.hint}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={restaurar} disabled={saving}>
          <RotateCcw className="w-4 h-4 mr-1" /> Restaurar padrão
        </Button>
        <Button onClick={salvar} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
          Salvar
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        A alteração vale para novos leads e para atualizações de leads existentes. Leads já classificados mantêm o score anterior até serem atualizados.
      </p>
    </div>
  );
}
