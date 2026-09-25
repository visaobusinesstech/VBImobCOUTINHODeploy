import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  MessageCircle,
  Plus,
  Trash2,
  RotateCcw,
  Save,
  Loader2,
  Eye,
  Copy,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWhatsappCaptacaoTemplate } from "@/hooks/useWhatsappCaptacaoTemplate";
import {
  DEFAULT_TEMPLATE_BODY,
  DEFAULT_TEMPLATE_VARIABLES,
  TemplateVariable,
  renderTemplate,
  normalizeVariableKey,
} from "@/lib/whatsappTemplate";

export default function WhatsappTemplatesCaptacao() {
  const { template, loading, saving, save } = useWhatsappCaptacaoTemplate();
  const { toast } = useToast();

  const [body, setBody] = useState("");
  const [vars, setVars] = useState<TemplateVariable[]>([]);
  const [previewValues, setPreviewValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (template) {
      setBody(template.template_body);
      setVars(template.variables);
      const seed: Record<string, string> = {};
      template.variables.forEach((v) => (seed[v.key] = v.exemplo || ""));
      setPreviewValues(seed);
    }
  }, [template]);

  const previewText = useMemo(() => renderTemplate(body, previewValues), [body, previewValues]);

  const insertVarAtCursor = (key: string) => {
    const placeholder = `{{${key}}}`;
    setBody((prev) => (prev ? `${prev}${prev.endsWith(" ") || prev.endsWith("\n") ? "" : " "}${placeholder}` : placeholder));
  };

  const addVariable = () => {
    setVars((prev) => [
      ...prev,
      { key: normalizeVariableKey(`variavel_${prev.length + 1}`), label: "Nova variável", exemplo: "" },
    ]);
  };

  const updateVariable = (idx: number, patch: Partial<TemplateVariable>) => {
    setVars((prev) =>
      prev.map((v, i) => {
        if (i !== idx) return v;
        const next = { ...v, ...patch };
        if (patch.key != null) next.key = normalizeVariableKey(patch.key);
        return next;
      })
    );
  };

  const removeVariable = (idx: number) => {
    setVars((prev) => prev.filter((_, i) => i !== idx));
  };

  const resetDefaults = () => {
    setBody(DEFAULT_TEMPLATE_BODY);
    setVars(DEFAULT_TEMPLATE_VARIABLES);
    const seed: Record<string, string> = {};
    DEFAULT_TEMPLATE_VARIABLES.forEach((v) => (seed[v.key] = v.exemplo || ""));
    setPreviewValues(seed);
    toast({ title: "Restaurado", description: "Template e variáveis voltaram ao padrão. Clique em Salvar para aplicar." });
  };

  const handleSave = async () => {
    const seen = new Set<string>();
    for (const v of vars) {
      if (!v.key) {
        toast({ title: "Variável inválida", description: "Todas as variáveis precisam de uma chave.", variant: "destructive" });
        return;
      }
      if (seen.has(v.key)) {
        toast({ title: "Chave duplicada", description: `A chave "${v.key}" está repetida.`, variant: "destructive" });
        return;
      }
      seen.add(v.key);
    }
    if (!body.trim()) {
      toast({ title: "Corpo vazio", description: "Escreva o corpo da mensagem antes de salvar.", variant: "destructive" });
      return;
    }
    await save(body, vars);
  };

  const copyPreview = async () => {
    try {
      await navigator.clipboard.writeText(previewText);
      toast({ title: "Copiado", description: "Pré-visualização copiada para a área de transferência." });
    } catch {
      toast({ title: "Não foi possível copiar", variant: "destructive" });
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto p-4 lg:p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <MessageCircle className="w-6 h-6 text-emerald-600" />
              Templates de WhatsApp – Captação
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Personalize a mensagem enviada aos proprietários e as variáveis dinâmicas. As configurações são isoladas por conta.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={resetDefaults} disabled={loading || saving}>
              <RotateCcw className="w-4 h-4 mr-1" /> Restaurar padrão
            </Button>
            <Button size="sm" onClick={handleSave} disabled={loading || saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
              Salvar
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Coluna esquerda: Editor + Variáveis */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Corpo da mensagem</CardTitle>
                  <CardDescription>
                    Use <code>{"{{chave}}"}</code> para inserir uma variável. Ex.: <code>{"{{saudacao}}"}</code>.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={10}
                    className="font-mono text-sm"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {vars.map((v) => (
                      <Button
                        key={v.key}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => insertVarAtCursor(v.key)}
                        className="h-7 text-xs"
                      >
                        + {`{{${v.key}}}`}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Variáveis dinâmicas</CardTitle>
                    <CardDescription>
                      Defina nome de exibição e chave (usada em <code>{"{{chave}}"}</code>).
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={addVariable}>
                    <Plus className="w-4 h-4 mr-1" /> Adicionar
                  </Button>
                </CardHeader>
                <CardContent className="space-y-3">
                  {vars.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhuma variável cadastrada.</p>
                  ) : (
                    vars.map((v, idx) => (
                      <div
                        key={idx}
                        className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] gap-2 p-3 rounded-md border bg-muted/30"
                      >
                        <div>
                          <Label className="text-xs">Nome de exibição</Label>
                          <Input
                            value={v.label}
                            onChange={(e) => updateVariable(idx, { label: e.target.value })}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Chave</Label>
                          <Input
                            value={v.key}
                            onChange={(e) => updateVariable(idx, { key: e.target.value })}
                            className="h-8 text-sm font-mono"
                            placeholder="ex: saudacao"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Valor de exemplo</Label>
                          <Input
                            value={v.exemplo || ""}
                            onChange={(e) => updateVariable(idx, { exemplo: e.target.value })}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="flex items-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeVariable(idx)}
                            className="h-8 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Coluna direita: Preview interativo */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Eye className="w-4 h-4" /> Pré-visualização interativa
                  </CardTitle>
                  <CardDescription>
                    Ajuste os valores de teste para cada variável e veja a mensagem final.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    {vars.map((v) => (
                      <div key={v.key} className="grid grid-cols-[140px_1fr] gap-2 items-center">
                        <Label className="text-xs truncate" title={v.label}>
                          {v.label}
                          <div className="text-[10px] text-muted-foreground font-mono">{`{{${v.key}}}`}</div>
                        </Label>
                        <Input
                          value={previewValues[v.key] ?? ""}
                          onChange={(e) =>
                            setPreviewValues((prev) => ({ ...prev, [v.key]: e.target.value }))
                          }
                          className="h-8 text-sm"
                          placeholder={v.exemplo || ""}
                        />
                      </div>
                    ))}
                  </div>

                  <Separator />

                  <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline" className="bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-200 border-emerald-300">
                        WhatsApp preview
                      </Badge>
                      <Button variant="ghost" size="sm" onClick={copyPreview} className="h-7">
                        <Copy className="w-3.5 h-3.5 mr-1" /> Copiar
                      </Button>
                    </div>
                    <pre className="whitespace-pre-wrap text-sm text-foreground font-sans">
{previewText || <span className="text-muted-foreground">A mensagem aparecerá aqui.</span>}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
