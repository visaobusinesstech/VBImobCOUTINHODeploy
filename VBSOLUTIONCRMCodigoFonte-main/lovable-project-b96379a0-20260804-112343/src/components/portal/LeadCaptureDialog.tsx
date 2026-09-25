import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Loader2 } from "lucide-react";

interface LeadCaptureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imovel: any;
}

export function LeadCaptureDialog({ open, onOpenChange, imovel }: LeadCaptureDialogProps) {
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !telefone.trim()) return;
    setLoading(true);

    try {
      // Find the owner (imobiliaria_id) of this property to assign the lead
      const imobiliaria_id = imovel?.imobiliaria_id;
      if (!imobiliaria_id) throw new Error("Imóvel sem imobiliária");

      const interesse = imovel ? `${imovel.tipo} - ${imovel.titulo}` : "";

      const { error } = await supabase.from("leads").insert({
        imobiliaria_id,
        nome: nome.trim(),
        telefone: telefone.trim(),
        email: email.trim() || null,
        interesse,
        observacoes: mensagem.trim() ? `[Portal Público] ${mensagem.trim()}` : "[Portal Público] Lead capturado automaticamente",
        estagio: "novos",
        posicao: 0,
        valor: imovel?.preco || 0,
      } as any);

      if (error) throw error;
      setSuccess(true);
    } catch (err) {
      console.error("Erro ao capturar lead:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setNome("");
      setTelefone("");
      setEmail("");
      setMensagem("");
      setSuccess(false);
    }
    onOpenChange(open);
  };

  if (!imovel) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        {success ? (
          <div className="flex flex-col items-center py-8 gap-4 text-center">
            <CheckCircle2 className="w-16 h-16 text-success" />
            <h3 className="text-xl font-bold text-foreground">Interesse registrado!</h3>
            <p className="text-sm text-muted-foreground">Em breve um corretor entrará em contato com você.</p>
            <Button onClick={() => handleClose(false)} className="mt-2">Fechar</Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Tenho interesse neste imóvel</DialogTitle>
              <DialogDescription className="text-sm">
                {imovel.titulo} — {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(imovel.preco)}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-2">
              <div>
                <Label htmlFor="nome">Nome *</Label>
                <Input id="nome" value={nome} onChange={e => setNome(e.target.value)} placeholder="Seu nome completo" required />
              </div>
              <div>
                <Label htmlFor="telefone">Telefone *</Label>
                <Input id="telefone" value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(61) 99999-9999" required />
              </div>
              <div>
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" />
              </div>
              <div>
                <Label htmlFor="mensagem">Mensagem (opcional)</Label>
                <Textarea id="mensagem" value={mensagem} onChange={e => setMensagem(e.target.value)} placeholder="Gostaria de agendar uma visita..." rows={3} />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Enviar interesse
              </Button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
