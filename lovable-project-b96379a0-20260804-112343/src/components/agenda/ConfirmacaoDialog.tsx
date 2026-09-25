import { useState } from "react";
import { Send, Loader2, MessageSquare, Copy, ExternalLink, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Compromisso } from "@/hooks/useCompromissos";

interface Props {
  compromisso: Compromisso;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSent: () => void;
}

export function ConfirmacaoDialog({ compromisso, open, onOpenChange, onSent }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ mensagem: string; whatsappLink: string | null; confirmationLink: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("gerar-confirmacao", {
      body: { compromisso_id: compromisso.id },
    });

    if (error || data?.error) {
      toast.error(data?.error || "Erro ao gerar confirmação");
    } else {
      setResult(data);
      toast.success("📨 Mensagem de confirmação gerada!");
    }
    setLoading(false);
  };

  const handleCopy = async () => {
    if (!result) return;
    const text = `${result.mensagem}\n\n📋 Confirme sua presença:\n${result.confirmationLink}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Mensagem copiada!");
    setTimeout(() => setCopied(false), 2000);
  };

  const confirmacaoStatus = (compromisso as any).confirmacao_status;
  const statusLabels: Record<string, { label: string; class: string }> = {
    pendente: { label: "⏳ Aguardando envio", class: "text-muted-foreground" },
    enviado: { label: "📨 Enviado", class: "text-blue-600" },
    confirmado: { label: "✅ Confirmado", class: "text-green-600" },
    cancelado: { label: "❌ Cancelado", class: "text-destructive" },
    reagendar: { label: "📅 Reagendamento solicitado", class: "text-orange-600" },
  };
  const statusInfo = statusLabels[confirmacaoStatus] || statusLabels.pendente;

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setResult(null); }}>
      <DialogContent className="bg-card border-border sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            Confirmação com Cliente
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border">
            <div>
              <p className="text-sm font-medium text-foreground">{compromisso.titulo}</p>
              <p className="text-xs text-muted-foreground">
                Status: <span className={statusInfo.class}>{statusInfo.label}</span>
              </p>
            </div>
          </div>

          {!result ? (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground mb-4">
                A IA irá gerar uma mensagem profissional de confirmação personalizada e criar um link para o cliente confirmar, cancelar ou reagendar.
              </p>
              <Button onClick={handleGenerate} disabled={loading} className="gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {loading ? "Gerando com IA..." : "Gerar Confirmação"}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm text-foreground whitespace-pre-wrap max-h-[200px] overflow-y-auto">
                {result.mensagem}
              </div>

              <div className="flex flex-col gap-2">
                {result.whatsappLink && (
                  <a
                    href={result.whatsappLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium text-sm transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Enviar via WhatsApp
                  </a>
                )}

                <Button variant="outline" onClick={handleCopy} className="gap-2">
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? "Copiado!" : "Copiar mensagem + link"}
                </Button>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                O cliente poderá confirmar, cancelar ou solicitar reagendamento pelo link.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { onOpenChange(false); if (result) onSent(); }}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
