import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Trash2, MapPin, Loader2, Users } from "lucide-react";

interface Corretor { id: string; nome: string; status: string }
interface Regra {
  id: string;
  corretor_id: string;
  cidade: string | null;
  bairro: string | null;
  prioridade: number;
  peso: number;
  ativo: boolean;
}

export function AtribuicaoRegrasTab() {
  const { user, imobiliariaId } = useAuth();
  const { toast } = useToast();
  const [corretores, setCorretores] = useState<Corretor[]>([]);
  const [regras, setRegras] = useState<Regra[]>([]);
  const [carga, setCarga] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Regra>>({
    corretor_id: "", cidade: "", bairro: "", prioridade: 100, peso: 1, ativo: true,
  });

  const imob = imobiliariaId ?? user?.id;

  const load = async () => {
    if (!imob) return;
    setLoading(true);
    const [{ data: c }, { data: r }, { data: pipe }] = await Promise.all([
      supabase.from("corretores").select("id, nome, status")
        .eq("imobiliaria_id", imob).eq("status", "ativo").order("nome"),
      (supabase as any).from("corretor_atribuicao_regras").select("*")
        .eq("imobiliaria_id", imob).order("prioridade", { ascending: true }),
      (supabase as any).from("captacao_pipeline")
        .select("corretor_id, estagio").eq("imobiliaria_id", imob),
    ]);
    setCorretores((c ?? []) as Corretor[]);
    setRegras((r ?? []) as Regra[]);
    const load: Record<string, number> = {};
    ((pipe ?? []) as any[]).forEach((row) => {
      if (!row.corretor_id) return;
      if (["Perdido", "Contrato Assinado"].includes(row.estagio)) return;
      load[row.corretor_id] = (load[row.corretor_id] ?? 0) + 1;
    });
    setCarga(load);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [imob]);

  const salvar = async () => {
    if (!imob || !form.corretor_id) {
      toast({ title: "Selecione um corretor", variant: "destructive" });
      return;
    }
    const payload = {
      imobiliaria_id: imob,
      corretor_id: form.corretor_id,
      cidade: form.cidade?.trim() || null,
      bairro: form.bairro?.trim() || null,
      prioridade: Number(form.prioridade ?? 100),
      peso: Number(form.peso ?? 1),
      ativo: form.ativo ?? true,
    };
    const { error } = await (supabase as any)
      .from("corretor_atribuicao_regras").insert(payload);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Regra criada" });
    setOpen(false);
    setForm({ corretor_id: "", cidade: "", bairro: "", prioridade: 100, peso: 1, ativo: true });
    load();
  };

  const toggle = async (r: Regra) => {
    await (supabase as any).from("corretor_atribuicao_regras")
      .update({ ativo: !r.ativo }).eq("id", r.id);
    load();
  };

  const remover = async (id: string) => {
    await (supabase as any).from("corretor_atribuicao_regras").delete().eq("id", id);
    load();
  };

  const porCorretor = useMemo(() => {
    const map: Record<string, Regra[]> = {};
    regras.forEach((r) => { (map[r.corretor_id] ??= []).push(r); });
    return map;
  }, [regras]);

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Regras de atribuição automática</h3>
          <p className="text-xs text-muted-foreground">
            Novos leads (RadarZAP e captação) são atribuídos ao corretor com regra
            mais específica (bairro &gt; cidade) e menor carga aberta.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Nova regra</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova regra de atribuição</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Corretor</Label>
                <Select
                  value={form.corretor_id ?? ""}
                  onValueChange={(v) => setForm({ ...form, corretor_id: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione o corretor" /></SelectTrigger>
                  <SelectContent>
                    {corretores.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Cidade</Label>
                  <Input
                    placeholder="Ex.: Brasília"
                    value={form.cidade ?? ""}
                    onChange={(e) => setForm({ ...form, cidade: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Bairro</Label>
                  <Input
                    placeholder="Ex.: Águas Claras"
                    value={form.bairro ?? ""}
                    onChange={(e) => setForm({ ...form, bairro: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Prioridade (menor = maior)</Label>
                  <Input
                    type="number"
                    value={form.prioridade ?? 100}
                    onChange={(e) => setForm({ ...form, prioridade: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Peso</Label>
                  <Input
                    type="number" min={1}
                    value={form.peso ?? 1}
                    onChange={(e) => setForm({ ...form, peso: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.ativo ?? true}
                  onCheckedChange={(v) => setForm({ ...form, ativo: v })}
                />
                <Label className="text-sm">Regra ativa</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Deixe cidade/bairro em branco para uma regra "curinga" (recebe qualquer lead).
              </p>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={salvar}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {corretores.length === 0 && (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">
          Cadastre corretores ativos na aba <b>Equipe</b> antes de criar regras.
        </CardContent></Card>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {corretores.map((c) => {
          const rs = porCorretor[c.id] ?? [];
          return (
            <Card key={c.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    {c.nome}
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {carga[c.id] ?? 0} abertos
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {rs.length === 0 && (
                  <div className="text-xs text-muted-foreground">Sem regras — só recebe por fallback (menor carga).</div>
                )}
                {rs.map((r) => (
                  <div key={r.id} className="flex items-center justify-between border rounded-md px-3 py-2">
                    <div className="text-xs">
                      <div className="flex items-center gap-1 font-medium">
                        <MapPin className="w-3 h-3" />
                        {[r.bairro, r.cidade].filter(Boolean).join(" · ") || "Curinga (qualquer área)"}
                      </div>
                      <div className="text-muted-foreground mt-0.5">
                        Prio {r.prioridade} · Peso {r.peso}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={r.ativo} onCheckedChange={() => toggle(r)} />
                      <Button size="icon" variant="ghost" onClick={() => remover(r.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
