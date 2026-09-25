import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Lead } from "@/hooks/useLeads";
import type { Contrato } from "@/hooks/useContratos";
import type { Followup } from "@/hooks/useFollowups";
import { isContratoInativo, isLeadInativo } from "@/hooks/useFollowups";

const TIPOS = [
  { id: "ligacao", label: "📞 Ligação" },
  { id: "whatsapp", label: "💬 WhatsApp" },
  { id: "email", label: "📧 E-mail" },
  { id: "visita", label: "🏠 Visita" },
  { id: "reuniao", label: "🤝 Reunião" },
  { id: "outro", label: "📌 Outro" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leads: Lead[];
  contratos?: Contrato[];
  defaultLeadId?: string;
  defaultContratoId?: string;
  onSave: (data: { id?: string; lead_id?: string | null; contrato_id?: string | null; data_followup: string; tipo: string; descricao?: string; resultado?: string }) => Promise<any>;
  saving?: boolean;
  editingFollowup?: Followup | null;
}

export function FollowupFormDialog({ open, onOpenChange, leads, contratos = [], defaultLeadId, defaultContratoId, onSave, saving, editingFollowup }: Props) {
  const [alvo, setAlvo] = useState<"lead" | "contrato">("lead");
  const [leadId, setLeadId] = useState(defaultLeadId || "");
  const [contratoId, setContratoId] = useState(defaultContratoId || "");
  const [data, setData] = useState("");
  const [tipo, setTipo] = useState("ligacao");
  const [descricao, setDescricao] = useState("");
  const [resultado, setResultado] = useState("");

  const isEditing = !!editingFollowup;

  useEffect(() => {
    if (!open) return;
    if (editingFollowup) {
      const alvoEd = editingFollowup.contrato_id ? "contrato" : "lead";
      setAlvo(alvoEd);
      setLeadId(editingFollowup.lead_id || "");
      setContratoId(editingFollowup.contrato_id || "");
      setData(editingFollowup.data_followup);
      setTipo(editingFollowup.tipo);
      setDescricao(editingFollowup.descricao || "");
      setResultado(editingFollowup.resultado || "");
    } else {
      setAlvo(defaultContratoId ? "contrato" : "lead");
      setLeadId(defaultLeadId || "");
      setContratoId(defaultContratoId || "");
      setData(new Date().toISOString().split("T")[0]);
      setTipo("ligacao");
      setDescricao("");
      setResultado("");
    }
  }, [open, defaultLeadId, defaultContratoId, editingFollowup]);

  // Contracts eligible: exclude clearly inactive to keep the list clean (still shown when editing)
  const contratosAtivos = useMemo(
    () => contratos.filter(c => !isContratoInativo(c.status) || c.id === contratoId),
    [contratos, contratoId]
  );
  const leadsAtivos = useMemo(
    () => leads.filter(l => !isLeadInativo(l.estagio) || l.id === leadId),
    [leads, leadId]
  );

  const targetValid = alvo === "lead" ? !!leadId : !!contratoId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetValid || !data) return;
    await onSave({
      ...(isEditing ? { id: editingFollowup!.id } : {}),
      lead_id: alvo === "lead" ? leadId : null,
      contrato_id: alvo === "contrato" ? contratoId : null,
      data_followup: data,
      tipo,
      descricao: descricao || undefined,
      resultado: resultado || undefined,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Follow-up" : "Agendar Follow-up"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label className="mb-1 block">Vincular a</Label>
            <Tabs value={alvo} onValueChange={(v) => setAlvo(v as "lead" | "contrato")}>
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="lead" disabled={isEditing && !!editingFollowup?.contrato_id}>Lead</TabsTrigger>
                <TabsTrigger value="contrato" disabled={isEditing && !!editingFollowup?.lead_id}>Contrato</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {alvo === "lead" ? (
            <div>
              <Label>Lead</Label>
              <Select value={leadId} onValueChange={setLeadId}>
                <SelectTrigger><SelectValue placeholder="Selecione o lead" /></SelectTrigger>
                <SelectContent>
                  {leadsAtivos.length === 0 && <div className="px-2 py-1 text-xs text-muted-foreground">Nenhum lead ativo</div>}
                  {leadsAtivos.map(l => (
                    <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div>
              <Label>Contrato</Label>
              <Select value={contratoId} onValueChange={setContratoId}>
                <SelectTrigger><SelectValue placeholder="Selecione o contrato" /></SelectTrigger>
                <SelectContent>
                  {contratosAtivos.length === 0 && <div className="px-2 py-1 text-xs text-muted-foreground">Nenhum contrato ativo</div>}
                  {contratosAtivos.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.titulo} {c.cliente ? `• ${c.cliente}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Data</Label>
              <Input type="date" value={data} onChange={e => setData(e.target.value)} required />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Observação</Label>
            <Textarea value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Lembrete sobre o contato..." rows={2} />
          </div>
          {isEditing && (
            <div>
              <Label>O que foi feito? (Resultado)</Label>
              <Textarea
                value={resultado}
                onChange={e => setResultado(e.target.value)}
                placeholder="Descreva o que foi realizado neste follow-up..."
                rows={3}
                className="border-primary/30 focus:border-primary"
              />
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving || !targetValid || !data}>{saving ? "Salvando..." : isEditing ? "Salvar" : "Agendar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
