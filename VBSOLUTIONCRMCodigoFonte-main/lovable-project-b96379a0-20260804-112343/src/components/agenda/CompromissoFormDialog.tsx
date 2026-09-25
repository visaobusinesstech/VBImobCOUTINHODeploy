import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { TIPOS_COMPROMISSO, type Compromisso } from "@/hooks/useCompromissos";
import type { Lead } from "@/hooks/useLeads";
import type { Corretor } from "@/hooks/useLeads";
import { useDraft } from "@/hooks/useDraft";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leads: Lead[];
  corretores: Corretor[];
  defaultDate?: string;
  onSave: (data: any) => Promise<any>;
  saving?: boolean;
  editingCompromisso?: Compromisso | null;
}

export function CompromissoFormDialog({ open, onOpenChange, leads, corretores, defaultDate, onSave, saving, editingCompromisso }: Props) {
  const [form, setForm] = useState({
    titulo: "", tipo: "reuniao",
    dataInicio: defaultDate || new Date().toISOString().split("T")[0],
    horaInicio: "09:00", horaFim: "10:00",
    local: "", descricao: "", leadId: "", corretorId: "",
    lembreteWhatsapp: false, telefoneLembrete: "",
    prioridade: "media", emailCliente: "", googleMapsLink: "",
  });

  const isEditing = !!editingCompromisso;
  const { clearDraft } = useDraft("compromisso", form, setForm, { enabled: !isEditing, open });

  useEffect(() => {
    if (!open) return;
    if (editingCompromisso) {
      setForm({
        titulo: editingCompromisso.titulo,
        tipo: editingCompromisso.tipo,
        dataInicio: editingCompromisso.data_inicio.slice(0, 10),
        horaInicio: editingCompromisso.data_inicio.slice(11, 16) || "09:00",
        horaFim: editingCompromisso.data_fim?.slice(11, 16) || "10:00",
        local: editingCompromisso.local || "",
        descricao: editingCompromisso.descricao || "",
        leadId: editingCompromisso.lead_id || "",
        corretorId: editingCompromisso.corretor_id || "",
        lembreteWhatsapp: editingCompromisso.lembrete_whatsapp,
        telefoneLembrete: editingCompromisso.telefone_lembrete || "",
        prioridade: editingCompromisso.prioridade || "media",
        emailCliente: editingCompromisso.email_cliente || "",
        googleMapsLink: editingCompromisso.google_maps_link || "",
      });
    }
    // draft restore is handled by useDraft for new records
  }, [open, defaultDate, editingCompromisso]);

  const set = (key: string, val: any) => setForm(p => ({ ...p, [key]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.titulo || !form.dataInicio) return;
    const data_inicio = `${form.dataInicio}T${form.horaInicio}:00`;
    const data_fim = `${form.dataInicio}T${form.horaFim}:00`;
    await onSave({
      ...(isEditing ? { id: editingCompromisso.id } : {}),
      titulo: form.titulo, tipo: form.tipo, data_inicio, data_fim,
      local: form.local || null,
      descricao: form.descricao || null,
      lead_id: form.leadId || null,
      corretor_id: form.corretorId || null,
      lembrete_whatsapp: form.lembreteWhatsapp,
      telefone_lembrete: form.telefoneLembrete || null,
      prioridade: form.prioridade,
      email_cliente: form.emailCliente || null,
      google_maps_link: form.googleMapsLink || null,
    });
    clearDraft();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Compromisso" : "Novo Compromisso"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Título</Label>
            <Input value={form.titulo} onChange={e => set("titulo", e.target.value)} placeholder="Ex: Visita ao apartamento..." required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={v => set("tipo", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS_COMPROMISSO.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data</Label>
              <Input type="date" value={form.dataInicio} onChange={e => set("dataInicio", e.target.value)} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Hora início</Label>
              <Input type="time" value={form.horaInicio} onChange={e => set("horaInicio", e.target.value)} />
            </div>
            <div>
              <Label>Hora fim</Label>
              <Input type="time" value={form.horaFim} onChange={e => set("horaFim", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Local</Label>
              <Input value={form.local} onChange={e => set("local", e.target.value)} placeholder="Endereço ou link da reunião..." />
            </div>
            <div>
              <Label>Prioridade</Label>
              <Select value={form.prioridade} onValueChange={v => set("prioridade", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="alta">🔴 Alta</SelectItem>
                  <SelectItem value="media">🟡 Média</SelectItem>
                  <SelectItem value="baixa">🟢 Baixa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Link Google Maps (opcional)</Label>
            <Input value={form.googleMapsLink} onChange={e => set("googleMapsLink", e.target.value)} placeholder="https://maps.google.com/..." />
          </div>
          <div>
            <Label>E-mail do cliente (opcional)</Label>
            <Input type="email" value={form.emailCliente} onChange={e => set("emailCliente", e.target.value)} placeholder="cliente@email.com" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Lead (opcional)</Label>
              <Select value={form.leadId} onValueChange={v => set("leadId", v)}>
                <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhum</SelectItem>
                  {leads.map(l => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Corretor (opcional)</Label>
              <Select value={form.corretorId} onValueChange={v => set("corretorId", v)}>
                <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhum</SelectItem>
                  {corretores.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea value={form.descricao} onChange={e => set("descricao", e.target.value)} placeholder="Detalhes do compromisso..." rows={2} />
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border">
            <div>
              <p className="text-sm font-medium text-foreground">Lembrete WhatsApp</p>
              <p className="text-xs text-muted-foreground">Enviar link de lembrete via WhatsApp</p>
            </div>
            <Switch checked={form.lembreteWhatsapp} onCheckedChange={v => set("lembreteWhatsapp", v)} />
          </div>
          {form.lembreteWhatsapp && (
            <div>
              <Label>Telefone para lembrete</Label>
              <Input value={form.telefoneLembrete} onChange={e => set("telefoneLembrete", e.target.value)} placeholder="(11) 99999-9999" />
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving || !form.titulo || !form.dataInicio}>{saving ? "Salvando..." : isEditing ? "Salvar" : "Agendar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
