import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CalendarClock, Trash2, Loader2, Bell } from "lucide-react";

type Props = {
  params: {
    bairro: string | null;
    cidade: string;
    estado: string;
    tipo_imovel: string;
    operacao: string;
    faixa_preco: string | null;
    apenas_proprietarios: boolean;
    nome_predio: string | null;
  };
};

type Agendamento = {
  id: string;
  nome: string;
  frequencia: "diaria" | "semanal";
  ativo: boolean;
  proxima_execucao: string;
  ultima_execucao: string | null;
  ultimo_total: number;
  ultimo_novos: number;
  params: Record<string, unknown>;
};

export function AgendarBuscaCaptacaoDialog({ params }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nome, setNome] = useState("");
  const [frequencia, setFrequencia] = useState<"diaria" | "semanal">("diaria");
  const [items, setItems] = useState<Agendamento[]>([]);
  const [loading, setLoading] = useState(false);

  const carregar = async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("captacao_buscas_agendadas")
      .select("id,nome,frequencia,ativo,proxima_execucao,ultima_execucao,ultimo_total,ultimo_novos,params")
      .order("created_at", { ascending: false });
    if (!error) setItems((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { if (open) carregar(); /* eslint-disable-next-line */ }, [open]);

  useEffect(() => {
    if (!nome) {
      const partes = [params.nome_predio, params.bairro, params.tipo_imovel, params.operacao].filter(Boolean);
      if (partes.length) setNome(partes.join(" · "));
    }
    // eslint-disable-next-line
  }, [params.nome_predio, params.bairro, params.tipo_imovel, params.operacao, open]);

  const salvar = async () => {
    if (!user?.id) return;
    if (!nome.trim()) {
      toast({ title: "Dê um nome ao agendamento", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("captacao_buscas_agendadas").insert({
        imobiliaria_id: user.id,
        user_id: user.id,
        nome: nome.trim(),
        params,
        frequencia,
        ativo: true,
        proxima_execucao: new Date().toISOString(),
      });
      if (error) throw error;
      toast({
        title: "Busca agendada!",
        description: `Será reexecutada em modo lote (${frequencia === "diaria" ? "diariamente" : "semanalmente"}) com dupla passada. Você receberá notificações de novidades.`,
      });
      setNome("");
      await carregar();
    } catch (e: any) {
      toast({ title: "Erro ao agendar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const remover = async (id: string) => {
    const { error } = await supabase.from("captacao_buscas_agendadas").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao remover", description: error.message, variant: "destructive" });
      return;
    }
    await carregar();
  };

  const toggle = async (id: string, ativo: boolean) => {
    const { error } = await supabase
      .from("captacao_buscas_agendadas")
      .update({ ativo: !ativo })
      .eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    await carregar();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full mt-2">
          <CalendarClock className="w-4 h-4 mr-2" />
          Agendar busca automática
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" /> Agendar reexecução automática
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border p-3 bg-muted/30 text-sm">
            <div className="font-medium mb-1">Critérios desta busca</div>
            <div className="text-muted-foreground text-xs">
              {[params.nome_predio && `Prédio: ${params.nome_predio}`,
                params.bairro && `Bairro: ${params.bairro}`,
                `Tipo: ${params.tipo_imovel}`,
                `Operação: ${params.operacao}`,
                params.faixa_preco && `Faixa: ${params.faixa_preco}`,
                params.apenas_proprietarios && "Apenas proprietários"]
                .filter(Boolean).join(" · ")}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Nome do agendamento</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Carpe Diem — Venda" />
            </div>
            <div>
              <Label>Frequência de notificação</Label>
              <Select value={frequencia} onValueChange={(v: any) => setFrequencia(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="diaria">Diária</SelectItem>
                  <SelectItem value="semanal">Semanal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="text-xs text-muted-foreground">
            Cada execução usa <b>modo lote com dupla passada</b> (janela histórica + recente) e envia notificação apenas quando surgirem oportunidades novas em relação às anteriores.
          </div>

          <Button onClick={salvar} disabled={saving} className="w-full">
            {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando...</> : "Agendar esta busca"}
          </Button>

          <div>
            <div className="text-sm font-medium mb-2">Meus agendamentos</div>
            {loading ? (
              <div className="text-xs text-muted-foreground">Carregando...</div>
            ) : items.length === 0 ? (
              <div className="text-xs text-muted-foreground">Nenhum agendamento ainda.</div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-auto">
                {items.map((a) => (
                  <div key={a.id} className="flex items-center justify-between border rounded-md p-2 text-sm">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{a.nome}</div>
                      <div className="text-xs text-muted-foreground flex flex-wrap gap-2">
                        <Badge variant="secondary">{a.frequencia}</Badge>
                        <span>Próxima: {new Date(a.proxima_execucao).toLocaleString("pt-BR")}</span>
                        {a.ultima_execucao && (
                          <span>· Última: {a.ultimo_novos} novas / {a.ultimo_total} total</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Switch checked={a.ativo} onCheckedChange={() => toggle(a.id, a.ativo)} />
                      <Button variant="ghost" size="icon" onClick={() => remover(a.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
