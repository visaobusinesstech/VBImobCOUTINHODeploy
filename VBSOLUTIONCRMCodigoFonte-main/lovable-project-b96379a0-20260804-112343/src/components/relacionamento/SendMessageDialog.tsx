import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Mail, Copy, Check } from "lucide-react";
import { useTemplatesMensagem, TEMPLATE_TIPOS } from "@/hooks/useTemplatesMensagem";
import { useToast } from "@/hooks/use-toast";
import type { ClienteRelacionamento, Filho } from "@/hooks/useClientesRelacionamento";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cliente: ClienteRelacionamento | null;
  preSelectTipo?: string;
}

function applyTemplate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, "g"), value);
  }
  return result;
}

export function SendMessageDialog({ open, onOpenChange, cliente, preSelectTipo }: Props) {
  const { getTemplate } = useTemplatesMensagem();
  const { toast } = useToast();
  const [selectedTipo, setSelectedTipo] = useState<string | null>(null);
  const [selectedFilho, setSelectedFilho] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState("");
  const [copied, setCopied] = useState(false);

  const primeiroNome = cliente?.nome.split(" ")[0] ?? "";

  const handleSelectTipo = (tipo: string, filhoNome?: string) => {
    if (!cliente) return;
    setSelectedTipo(tipo);
    setSelectedFilho(filhoNome || null);
    const template = getTemplate(tipo);
    const vars: Record<string, string> = { nome: primeiroNome };
    if (cliente.profissao) vars.profissao = cliente.profissao;
    if (filhoNome) vars.filho = filhoNome;
    setMensagem(applyTemplate(template, vars));
  };

  useEffect(() => {
    if (open && cliente && preSelectTipo) {
      handleSelectTipo(preSelectTipo);
    }
    if (!open) {
      setSelectedTipo(null);
      setSelectedFilho(null);
      setMensagem("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, preSelectTipo, cliente?.id]);

  if (!cliente) return null;

  const getWhatsAppLink = () => {
    if (!cliente.telefone) return null;
    const num = cliente.telefone.replace(/\D/g, "");
    return `https://wa.me/55${num}?text=${encodeURIComponent(mensagem)}`;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(mensagem);
    setCopied(true);
    toast({ title: "Mensagem copiada!" });
    setTimeout(() => setCopied(false), 2000);
  };

  const availableTypes = [
    { tipo: "aniversario", label: "🎂 Aniversário", available: !!cliente.aniversario },
    { tipo: "casamento", label: "💍 Casamento", available: !!cliente.data_casamento },
    { tipo: "profissao", label: "🎉 Profissão", available: !!cliente.profissao },
    { tipo: "mudanca", label: "🏠 Mudança", available: !!cliente.data_mudanca },
    { tipo: "compra_imovel", label: "🔑 Compra", available: !!cliente.data_compra_imovel },
    { tipo: "reativacao", label: "🔄 Reativação", available: true },
  ];

  const filhos = (cliente.filhos || []) as Filho[];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-lg">
        <DialogHeader>
          <DialogTitle>Enviar mensagem para {cliente.nome}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium mb-2 block">Escolha o tipo de mensagem:</Label>
            <div className="flex flex-wrap gap-2">
              {availableTypes.map(t => (
                <Badge
                  key={t.tipo}
                  variant={selectedTipo === t.tipo && !selectedFilho ? "default" : "secondary"}
                  className={`cursor-pointer transition-colors ${!t.available ? "opacity-40 pointer-events-none" : "hover:bg-primary/20"}`}
                  onClick={() => t.available && handleSelectTipo(t.tipo)}
                >
                  {t.label}
                </Badge>
              ))}
              {filhos.map(f => (
                <Badge
                  key={f.nome}
                  variant={selectedFilho === f.nome ? "default" : "secondary"}
                  className="cursor-pointer transition-colors hover:bg-primary/20"
                  onClick={() => handleSelectTipo("filho_aniversario", f.nome)}
                >
                  🎈 {f.nome}
                </Badge>
              ))}
            </div>
          </div>

          {selectedTipo && (
            <div>
              <Label className="text-sm mb-1 block">Mensagem (edite se quiser):</Label>
              <Textarea
                value={mensagem}
                onChange={e => setMensagem(e.target.value)}
                rows={4}
                className="text-sm"
              />
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>

          {selectedTipo && (
            <>
              <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1">
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                Copiar
              </Button>

              {cliente.telefone && (
                <Button asChild className="gap-1">
                  <a href={getWhatsAppLink()!} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="w-4 h-4" />
                    WhatsApp
                  </a>
                </Button>
              )}

              {cliente.email && (
                <Button variant="secondary" asChild className="gap-1">
                  <a href={`mailto:${cliente.email}?subject=Mensagem&body=${encodeURIComponent(mensagem)}`}>
                    <Mail className="w-4 h-4" />
                    E-mail
                  </a>
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
