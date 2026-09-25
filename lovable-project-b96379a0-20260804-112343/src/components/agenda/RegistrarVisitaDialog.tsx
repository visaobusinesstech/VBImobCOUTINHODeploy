import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Check, ThumbsUp, ThumbsDown, MoreHorizontal } from "lucide-react";

const RESULTADO_OPTIONS = [
  { value: "gostou", label: "Gostou do imóvel", icon: ThumbsUp, color: "text-green-600" },
  { value: "mais_opcoes", label: "Pediu mais opções", icon: MoreHorizontal, color: "text-yellow-600" },
  { value: "nao_gostou", label: "Não gostou", icon: ThumbsDown, color: "text-destructive" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titulo: string;
  leadNome?: string | null;
  onConfirm: (data: { feedback_visita: string; resultado_cliente: string }) => void;
}

export function RegistrarVisitaDialog({ open, onOpenChange, titulo, leadNome, onConfirm }: Props) {
  const [resultado, setResultado] = useState("gostou");
  const [feedback, setFeedback] = useState("");

  const handleConfirm = () => {
    onConfirm({
      feedback_visita: feedback,
      resultado_cliente: resultado,
    });
    setResultado("gostou");
    setFeedback("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Check className="w-4 h-4 text-primary" />
            Registrar Visita Realizada
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg bg-muted/30 p-3">
            <p className="text-sm font-medium text-foreground">{titulo}</p>
            {leadNome && <p className="text-xs text-muted-foreground mt-0.5">Cliente: {leadNome}</p>}
          </div>

          <div>
            <Label className="text-sm font-medium">Como foi a reação do cliente?</Label>
            <RadioGroup value={resultado} onValueChange={setResultado} className="mt-2 space-y-2">
              {RESULTADO_OPTIONS.map(opt => {
                const Icon = opt.icon;
                return (
                  <label
                    key={opt.value}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      resultado === opt.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                    }`}
                  >
                    <RadioGroupItem value={opt.value} />
                    <Icon className={`w-4 h-4 ${opt.color}`} />
                    <span className="text-sm text-foreground">{opt.label}</span>
                  </label>
                );
              })}
            </RadioGroup>
          </div>

          <div>
            <Label className="text-sm font-medium">Observações da visita</Label>
            <Textarea
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              placeholder="Ex: Cliente gostou da sala, mas achou o preço alto. Pediu para ver opções no mesmo bairro..."
              rows={4}
              className="mt-1"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleConfirm}>
            <Check className="w-4 h-4 mr-1" /> Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}