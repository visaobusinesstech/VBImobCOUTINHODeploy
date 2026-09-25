import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, RotateCcw, Sparkles } from "lucide-react";
import { useTemplatesMensagem, TEMPLATE_TIPOS } from "@/hooks/useTemplatesMensagem";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TemplatesDialog({ open, onOpenChange }: Props) {
  const { templates, loading, upsert, getTemplate } = useTemplatesMensagem();
  const { toast } = useToast();
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);
  const [aiOptions, setAiOptions] = useState<Record<string, string[]>>({});
  const [promptInput, setPromptInput] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      const vals: Record<string, string> = {};
      TEMPLATE_TIPOS.forEach(t => {
        vals[t.value] = getTemplate(t.value);
      });
      setEditValues(vals);
    }
  }, [open, templates]);

  const handleSave = async (tipo: string) => {
    setSaving(tipo);
    await upsert(tipo, editValues[tipo]);
    setSaving(null);
  };

  const handleReset = (tipo: string) => {
    const def = TEMPLATE_TIPOS.find(t => t.value === tipo)?.defaultMsg || "";
    setEditValues(prev => ({ ...prev, [tipo]: def }));
  };

  const selectOption = (tipo: string, msg: string) => {
    setEditValues(prev => ({ ...prev, [tipo]: msg }));
  };

  const generateWithAI = async (tipo: string) => {
    setGenerating(tipo);
    try {
      const { data, error } = await supabase.functions.invoke("gerar-mensagens-ia", {
        body: { tipo, contexto: promptInput[tipo] || "" },
      });

      if (error) throw error;
      if (data?.error) {
        toast({ title: "Erro ao gerar", description: data.error, variant: "destructive" });
      } else if (data?.mensagens) {
        setAiOptions(prev => ({ ...prev, [tipo]: data.mensagens }));
        setExpanded(tipo);
      }
    } catch (e: any) {
      toast({ title: "Erro ao gerar mensagens", description: e.message, variant: "destructive" });
    }
    setGenerating(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Templates de Mensagens</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground">
              Personalize as mensagens automáticas. Variáveis: <Badge variant="secondary">{"{nome}"}</Badge> <Badge variant="secondary">{"{profissao}"}</Badge> <Badge variant="secondary">{"{filho}"}</Badge>
            </p>

            {TEMPLATE_TIPOS.map(tipo => {
              const allOptions = [
                ...tipo.opcoes,
                ...(aiOptions[tipo.value] || []),
              ];

              return (
                <div key={tipo.value} className="space-y-2 p-4 rounded-lg bg-secondary/30">
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <Label className="text-sm font-semibold">{tipo.label}</Label>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setExpanded(expanded === tipo.value ? null : tipo.value)}
                      >
                        {expanded === tipo.value ? "Fechar opções" : "Ver opções"}
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => handleReset(tipo.value)} title="Restaurar padrão">
                        <RotateCcw className="w-3.5 h-3.5" />
                      </Button>
                      <Button type="button" size="sm" onClick={() => handleSave(tipo.value)} disabled={saving === tipo.value}>
                        {saving === tipo.value ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Save className="w-3.5 h-3.5 mr-1" />}
                        Salvar
                      </Button>
                    </div>
                  </div>

                  <Textarea
                    value={editValues[tipo.value] || ""}
                    onChange={e => setEditValues(prev => ({ ...prev, [tipo.value]: e.target.value }))}
                    rows={3}
                    className="text-sm"
                  />

                  {expanded === tipo.value && (
                    <div className="space-y-2 pt-2 border-t border-border">
                      {/* AI Generation */}
                      <div className="flex gap-2 items-end">
                        <div className="flex-1">
                          <Label className="text-xs text-muted-foreground">Descreva o tom ou estilo desejado (opcional)</Label>
                          <Input
                            value={promptInput[tipo.value] || ""}
                            onChange={e => setPromptInput(prev => ({ ...prev, [tipo.value]: e.target.value }))}
                            placeholder="Ex: tom mais formal, com foco em gratidão..."
                            className="text-sm"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="default"
                          size="sm"
                          onClick={() => generateWithAI(tipo.value)}
                          disabled={generating === tipo.value}
                          className="gap-1 whitespace-nowrap"
                        >
                          {generating === tipo.value ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="w-3.5 h-3.5" />
                          )}
                          Gerar com IA
                        </Button>
                      </div>

                      <p className="text-xs text-muted-foreground font-medium">Clique para usar:</p>
                      <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                        {allOptions.map((opcao, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => selectOption(tipo.value, opcao)}
                            className={`w-full text-left text-xs p-2 rounded-md transition-colors ${
                              editValues[tipo.value] === opcao
                                ? "bg-primary/20 text-primary border border-primary/30"
                                : "bg-background hover:bg-accent text-foreground"
                            }`}
                          >
                            {opcao}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
