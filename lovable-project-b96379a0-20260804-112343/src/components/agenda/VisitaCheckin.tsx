import { useState } from "react";
import { MapPin, Clock, LogIn, LogOut, Sparkles, Send, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Compromisso } from "@/hooks/useCompromissos";

interface Props {
  compromisso: Compromisso;
  onUpdate: () => void;
}

export function VisitaCheckin({ compromisso, onUpdate }: Props) {
  const [feedbackTexto, setFeedbackTexto] = useState((compromisso as any).feedback_visita || "");
  const [feedbackIA, setFeedbackIA] = useState((compromisso as any).feedback_ia || "");
  const [loadingCheckin, setLoadingCheckin] = useState(false);
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [loadingIA, setLoadingIA] = useState(false);

  const checkinAt = (compromisso as any).checkin_at;
  const checkoutAt = (compromisso as any).checkout_at;

  const handleCheckin = async () => {
    setLoadingCheckin(true);
    const { error } = await supabase
      .from("compromissos")
      .update({ checkin_at: new Date().toISOString() } as any)
      .eq("id", compromisso.id);

    if (error) {
      toast.error("Erro ao registrar check-in");
    } else {
      toast.success("📍 Check-in registrado!");
      onUpdate();
    }
    setLoadingCheckin(false);
  };

  const handleCheckout = async () => {
    setLoadingCheckout(true);
    const { error } = await supabase
      .from("compromissos")
      .update({ checkout_at: new Date().toISOString() } as any)
      .eq("id", compromisso.id);

    if (error) {
      toast.error("Erro ao registrar check-out");
    } else {
      toast.success("✅ Check-out registrado!");
      onUpdate();
    }
    setLoadingCheckout(false);
  };

  const handleFeedbackIA = async () => {
    if (!feedbackTexto.trim()) {
      toast.error("Escreva seu feedback antes de gerar a análise IA");
      return;
    }
    setLoadingIA(true);

    const { data, error } = await supabase.functions.invoke("feedback-visita-ia", {
      body: { compromisso_id: compromisso.id, feedback_visita: feedbackTexto },
    });

    if (error || data?.error) {
      toast.error(data?.error || "Erro ao gerar feedback IA");
    } else {
      setFeedbackIA(data.feedback_ia);
      toast.success("🤖 Análise IA gerada!");
      onUpdate();
    }
    setLoadingIA(false);
  };

  const duracao = checkinAt && checkoutAt
    ? Math.round((new Date(checkoutAt).getTime() - new Date(checkinAt).getTime()) / 60000)
    : null;

  return (
    <div className="space-y-3 border border-border rounded-lg p-4 bg-muted/20">
      <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <MapPin className="w-4 h-4 text-primary" />
        Check-in de Visita
      </h4>

      {/* Check-in / Check-out buttons */}
      <div className="flex items-center gap-3">
        {!checkinAt ? (
          <Button
            onClick={handleCheckin}
            disabled={loadingCheckin}
            size="sm"
            className="bg-green-600 hover:bg-green-700 text-white gap-2"
          >
            <LogIn className="w-4 h-4" />
            {loadingCheckin ? "Registrando..." : "Cheguei no imóvel"}
          </Button>
        ) : (
          <div className="flex items-center gap-2 text-xs text-green-600 bg-green-500/10 px-3 py-1.5 rounded-full">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Check-in: {format(new Date(checkinAt), "HH:mm", { locale: ptBR })}
          </div>
        )}

        {checkinAt && !checkoutAt && (
          <Button
            onClick={handleCheckout}
            disabled={loadingCheckout}
            size="sm"
            variant="outline"
            className="gap-2 border-orange-500 text-orange-600 hover:bg-orange-500/10"
          >
            <LogOut className="w-4 h-4" />
            {loadingCheckout ? "Registrando..." : "Saí do imóvel"}
          </Button>
        )}

        {checkoutAt && (
          <div className="flex items-center gap-2 text-xs text-orange-600 bg-orange-500/10 px-3 py-1.5 rounded-full">
            <LogOut className="w-3.5 h-3.5" />
            Check-out: {format(new Date(checkoutAt), "HH:mm", { locale: ptBR })}
          </div>
        )}

        {duracao !== null && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-secondary px-3 py-1.5 rounded-full">
            <Clock className="w-3.5 h-3.5" />
            {duracao} min
          </div>
        )}
      </div>

      {/* Post-visit feedback */}
      {checkoutAt && (
        <div className="space-y-3 pt-2 border-t border-border">
          <label className="text-xs font-medium text-foreground">Feedback pós-visita</label>
          <Textarea
            value={feedbackTexto}
            onChange={(e) => setFeedbackTexto(e.target.value)}
            placeholder="Como foi a visita? O cliente gostou? Alguma objeção? Interesse em proposta?"
            rows={3}
            className="text-sm"
          />
          <Button
            onClick={handleFeedbackIA}
            disabled={loadingIA || !feedbackTexto.trim()}
            size="sm"
            className="gap-2"
          >
            <Sparkles className="w-4 h-4" />
            {loadingIA ? "Analisando com IA..." : "Gerar Análise IA"}
          </Button>

          {feedbackIA && (
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm text-foreground whitespace-pre-wrap">
              <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-primary">
                <Sparkles className="w-3.5 h-3.5" />
                Análise Inteligente
              </div>
              {feedbackIA}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
