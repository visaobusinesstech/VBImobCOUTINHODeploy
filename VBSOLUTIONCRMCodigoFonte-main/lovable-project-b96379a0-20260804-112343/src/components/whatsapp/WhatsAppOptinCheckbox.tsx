import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface Props {
  value: boolean;
  onChange: (v: boolean) => void;
  nomeEmpresa?: string;
  finalidades?: string[];
  termoVersao?: string;
}

/**
 * Checkbox padrão para captura de opt-in explícito em landing pages e formulários.
 * O texto do termo é mostrado em modal para aceite consciente (LGPD Art. 7º I e IX).
 */
export function WhatsAppOptinCheckbox({
  value,
  onChange,
  nomeEmpresa = "a imobiliária",
  finalidades = ["envio de imóveis compatíveis", "avisos de visitas e propostas", "comunicações comerciais e novidades"],
  termoVersao = "1.0",
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-start gap-2 rounded-md border p-3 bg-slate-50">
      <Checkbox id="wa-optin" checked={value} onCheckedChange={v => onChange(!!v)} className="mt-0.5" />
      <div className="text-sm leading-relaxed">
        <Label htmlFor="wa-optin" className="cursor-pointer font-normal">
          Autorizo o recebimento de comunicações via <b>WhatsApp</b> por {nomeEmpresa}, incluindo{" "}
          {finalidades.join(", ")}.
        </Label>
        <div className="text-xs text-muted-foreground mt-1">
          Ao marcar, você receberá uma mensagem no WhatsApp para <b>confirmar o opt-in</b> (double opt-in).{" "}
          Você pode cancelar a qualquer momento respondendo <b>SAIR</b>.{" "}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <button type="button" className="underline underline-offset-2 text-primary">Ler termo completo (v{termoVersao})</button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader><DialogTitle>Termo de Consentimento — WhatsApp (v{termoVersao})</DialogTitle></DialogHeader>
              <div className="text-sm space-y-3 max-h-[60vh] overflow-y-auto">
                <p><b>Controlador:</b> {nomeEmpresa}, doravante denominada "Controlador".</p>
                <p><b>Base legal:</b> Lei nº 13.709/2018 (LGPD), Art. 7º, I (consentimento) e IX (legítimo interesse), e Meta WhatsApp Business Policy.</p>
                <p><b>Finalidades:</b> {finalidades.join("; ")}.</p>
                <p><b>Dados coletados:</b> nome, telefone, e-mail (quando fornecido), endereço IP e user-agent no momento do opt-in.</p>
                <p><b>Compartilhamento:</b> operador Meta/WhatsApp para viabilizar o envio das mensagens; provedores de infraestrutura tecnológica sujeitos a contrato de confidencialidade.</p>
                <p><b>Prazo:</b> vigora até revogação pelo titular. Você pode revogar (a) respondendo <b>SAIR</b>, <b>PARAR</b>, <b>CANCELAR</b> ou <b>DESCADASTRAR</b> em qualquer mensagem, (b) acessando o portal do titular, ou (c) solicitando pelos canais de atendimento.</p>
                <p><b>Direitos do titular:</b> confirmação, acesso, correção, portabilidade, anonimização, eliminação, informação sobre compartilhamentos, revisão de decisões automatizadas.</p>
                <p><b>Encarregado (DPO):</b> disponível via canal de contato do Controlador.</p>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}
