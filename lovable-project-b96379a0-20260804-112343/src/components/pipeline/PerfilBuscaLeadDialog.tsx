import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Lead } from "@/hooks/useLeads";
import { AMENIDADES_CATALOGO, FINALIDADES, URGENCIAS } from "@/lib/matchingDemandaCarteira";

interface Props {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

const num = (v: string) => (v.trim() === "" ? null : Number(v.replace(/[^\d.,-]/g, "").replace(",", ".")) || null);

export function PerfilBuscaLeadDialog({ lead, open, onOpenChange, onSaved }: Props) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    valor_maximo: "",
    area_minima: "",
    quartos_minimo: "",
    suites_minimo: "",
    banheiros_minimo: "",
    vagas_minimo: "",
    bairros: "",
    finalidade: "",
    urgencia: "",
  });
  const [amenidades, setAmenidades] = useState<string[]>([]);

  useEffect(() => {
    if (!lead || !open) return;
    setForm({
      valor_maximo: lead.valor_maximo ? String(lead.valor_maximo) : "",
      area_minima: lead.area_minima ? String(lead.area_minima) : "",
      quartos_minimo: lead.quartos_minimo ? String(lead.quartos_minimo) : "",
      suites_minimo: lead.suites_minimo ? String(lead.suites_minimo) : "",
      banheiros_minimo: lead.banheiros_minimo ? String(lead.banheiros_minimo) : "",
      vagas_minimo: lead.vagas_minimo ? String(lead.vagas_minimo) : "",
      bairros: (lead.bairros_interesse || []).join(", "),
      finalidade: lead.finalidade || "",
      urgencia: lead.urgencia || "",
    });
    setAmenidades(lead.amenidades_desejadas || []);
  }, [lead, open]);

  const toggleAmenidade = (a: string) =>
    setAmenidades((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));

  const salvar = async () => {
    if (!lead) return;
    setSaving(true);
    const payload = {
      valor_maximo: num(form.valor_maximo),
      area_minima: num(form.area_minima),
      quartos_minimo: num(form.quartos_minimo),
      suites_minimo: num(form.suites_minimo),
      banheiros_minimo: num(form.banheiros_minimo),
      vagas_minimo: num(form.vagas_minimo),
      bairros_interesse: form.bairros
        .split(",")
        .map((b) => b.trim())
        .filter(Boolean),
      amenidades_desejadas: amenidades,
      finalidade: form.finalidade || null,
      urgencia: form.urgencia || null,
    };

    const { data, error } = await supabase.from("leads").update(payload).eq("id", lead.id).select("id");
    setSaving(false);

    if (error || !data || data.length === 0) {
      toast({
        title: "Não foi possível salvar",
        description: error?.message || "Você não tem permissão para editar este lead.",
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Perfil de busca atualizado", description: "O matching foi recalculado." });
    onSaved?.();
    onOpenChange(false);
  };

  const campo = (key: keyof typeof form, label: string, placeholder?: string, type = "text") => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        type={type}
        inputMode="decimal"
        value={form[key]}
        placeholder={placeholder}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        className="h-9"
      />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Perfil de busca — {lead?.nome}</DialogTitle>
          <DialogDescription>
            Quanto mais detalhado o perfil, mais preciso o cruzamento com os imóveis da carteira.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          {campo("valor_maximo", "Orçamento máximo (R$)", "500000")}
          {campo("area_minima", "Área mínima (m²)", "60")}
          {campo("quartos_minimo", "Quartos (mín.)", "2")}
          {campo("suites_minimo", "Suítes (mín.)", "1")}
          {campo("banheiros_minimo", "Banheiros (mín.)", "2")}
          {campo("vagas_minimo", "Vagas (mín.)", "1")}
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Bairros / regiões de interesse (separe por vírgula)</Label>
          <Input
            value={form.bairros}
            placeholder="Asa Norte, Águas Claras, Sudoeste"
            onChange={(e) => setForm((f) => ({ ...f, bairros: e.target.value }))}
            className="h-9"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Finalidade</Label>
            <select
              value={form.finalidade}
              onChange={(e) => setForm((f) => ({ ...f, finalidade: e.target.value }))}
              className="h-9 w-full px-2 rounded-md bg-background border border-border text-sm"
            >
              <option value="">Não informada</option>
              {FINALIDADES.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Urgência</Label>
            <select
              value={form.urgencia}
              onChange={(e) => setForm((f) => ({ ...f, urgencia: e.target.value }))}
              className="h-9 w-full px-2 rounded-md bg-background border border-border text-sm"
            >
              <option value="">Não informada</option>
              {URGENCIAS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Amenidades procuradas</Label>
          <div className="flex flex-wrap gap-1.5">
            {AMENIDADES_CATALOGO.map((a) => {
              const ativo = amenidades.includes(a);
              return (
                <Badge
                  key={a}
                  variant="outline"
                  onClick={() => toggleAmenidade(a)}
                  className={`cursor-pointer text-[11px] ${
                    ativo ? "bg-primary/10 border-primary/40 text-primary" : "text-muted-foreground"
                  }`}
                >
                  {a}
                </Badge>
              );
            })}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
            Salvar perfil
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default PerfilBuscaLeadDialog;
