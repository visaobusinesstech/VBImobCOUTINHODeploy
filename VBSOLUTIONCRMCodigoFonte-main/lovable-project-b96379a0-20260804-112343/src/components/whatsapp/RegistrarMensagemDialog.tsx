import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    telefone_destino: string;
    nome_contato: string;
    mensagem: string;
    direcao: string;
    contexto: string;
  }) => void;
}

export function RegistrarMensagemDialog({ open, onOpenChange, onSubmit }: Props) {
  const [telefone, setTelefone] = useState("");
  const [nome, setNome] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [direcao, setDirecao] = useState("enviada");
  const [contexto, setContexto] = useState("");

  const handleSubmit = () => {
    if (!telefone || !mensagem) return;
    onSubmit({
      telefone_destino: telefone,
      nome_contato: nome,
      mensagem,
      direcao,
      contexto,
    });
    setTelefone("");
    setNome("");
    setMensagem("");
    setDirecao("enviada");
    setContexto("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">Registrar Mensagem WhatsApp</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-muted-foreground">Nome do contato</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} className="mt-1 bg-secondary border-border" placeholder="Nome do contato" />
          </div>
          <div>
            <Label className="text-muted-foreground">Telefone *</Label>
            <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} className="mt-1 bg-secondary border-border" placeholder="(11) 99999-0000" />
          </div>
          <div>
            <Label className="text-muted-foreground">Direção</Label>
            <Select value={direcao} onValueChange={setDirecao}>
              <SelectTrigger className="mt-1 bg-secondary border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="enviada">Enviada</SelectItem>
                <SelectItem value="recebida">Recebida</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-muted-foreground">Contexto</Label>
            <Input value={contexto} onChange={(e) => setContexto(e.target.value)} className="mt-1 bg-secondary border-border" placeholder="Ex: Visita ao imóvel, Negociação..." />
          </div>
          <div>
            <Label className="text-muted-foreground">Mensagem *</Label>
            <Textarea value={mensagem} onChange={(e) => setMensagem(e.target.value)} className="mt-1 bg-secondary border-border min-h-[100px]" placeholder="Conteúdo da mensagem..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!telefone || !mensagem}>Registrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
