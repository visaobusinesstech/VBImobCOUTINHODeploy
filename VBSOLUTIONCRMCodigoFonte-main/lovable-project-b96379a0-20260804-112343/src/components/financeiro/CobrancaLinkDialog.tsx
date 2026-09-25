import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, ExternalLink, CheckCircle2, MessageSquare, Loader2, Link as LinkIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  transacao: {
    id: string;
    descricao: string;
    valor: number;
    token_pagamento?: string | null;
    link_pagamento?: string | null;
    proprietario_telefone?: string | null;
    proprietario_nome?: string | null;
    status: string;
    pago_confirmado_em?: string | null;
  };
  onChanged?: () => void;
}

const PUBLIC_BASE = typeof window !== "undefined" ? window.location.origin : "";
const fmtBRL = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export default function CobrancaLinkDialog({ open, onOpenChange, transacao, onChanged }: Props) {
  const { toast } = useToast();
  const [link, setLink] = useState(transacao.link_pagamento ?? "");
  const [saving, setSaving] = useState(false);
  const [marking, setMarking] = useState(false);

  const publicUrl = transacao.token_pagamento ? `${PUBLIC_BASE}/pagamento/${transacao.token_pagamento}` : "";

  const copy = (text: string, label = "Copiado") => {
    navigator.clipboard.writeText(text);
    toast({ title: label });
  };

  const salvarLink = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("transacoes")
      .update({ link_pagamento: link.trim() || null })
      .eq("id", transacao.id);
    setSaving(false);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Link salvo" });
      onChanged?.();
    }
  };

  const marcarPago = async () => {
    setMarking(true);
    const { error } = await supabase
      .from("transacoes")
      .update({
        status: "confirmado",
        pago_confirmado_em: new Date().toISOString(),
        pago_confirmado_por: "manual",
        data_recebimento: new Date().toISOString().slice(0, 10),
      })
      .eq("id", transacao.id);
    setMarking(false);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Baixa registrada" });
      onChanged?.();
      onOpenChange(false);
    }
  };

  const shareWhatsApp = () => {
    if (!transacao.proprietario_telefone) {
      toast({ title: "Sem telefone", description: "Adicione um telefone no cadastro.", variant: "destructive" });
      return;
    }
    const numero = transacao.proprietario_telefone.replace(/\D/g, "");
    const formatted = numero.startsWith("55") ? numero : `55${numero}`;
    const msg = encodeURIComponent(
      `Olá ${transacao.proprietario_nome ?? ""}, segue link para pagamento de ${transacao.descricao} — ${fmtBRL(Number(transacao.valor))}.\n\n${link ? link + "\n\n" : ""}Confirme aqui: ${publicUrl}`,
    );
    window.open(`https://wa.me/${formatted}?text=${msg}`, "_blank");
  };

  const jaPago = !!transacao.pago_confirmado_em || transacao.status === "confirmado";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Cobrança — {transacao.descricao}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md bg-muted/30 p-3">
            <div className="text-sm text-muted-foreground">Valor</div>
            <div className="text-xl font-semibold">{fmtBRL(Number(transacao.valor))}</div>
          </div>

          <div className="space-y-2">
            <Label>Link ou PIX (copia e cola)</Label>
            <div className="flex gap-2">
              <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://... ou chave PIX" />
              <Button variant="outline" onClick={salvarLink} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
              </Button>
            </div>
          </div>

          {publicUrl && (
            <div className="space-y-2">
              <Label>Página pública para o cliente</Label>
              <div className="flex gap-2">
                <Input readOnly value={publicUrl} className="font-mono text-xs" />
                <Button variant="outline" size="icon" onClick={() => copy(publicUrl, "URL copiada")}>
                  <Copy className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" asChild>
                  <a href={publicUrl} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                <LinkIcon className="h-3 w-3 inline mr-1" />
                Envie esse link ao cliente. Quando ele confirmar o pagamento, a baixa é feita automaticamente.
              </p>
            </div>
          )}

          <div className="flex gap-2 flex-wrap pt-2">
            <Button variant="outline" onClick={shareWhatsApp} disabled={!publicUrl}>
              <MessageSquare className="h-4 w-4 mr-2" /> Enviar via WhatsApp
            </Button>
            {!jaPago && (
              <Button onClick={marcarPago} disabled={marking}>
                {marking ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                Marcar como pago (baixa manual)
              </Button>
            )}
            {jaPago && (
              <div className="flex items-center gap-2 text-success text-sm">
                <CheckCircle2 className="h-4 w-4" /> Pagamento confirmado
                {transacao.pago_confirmado_em && ` em ${new Date(transacao.pago_confirmado_em).toLocaleString("pt-BR")}`}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
