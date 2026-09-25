import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowRightLeft, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ESTAGIOS, type Lead } from "@/hooks/useLeads";

interface Corretor { id: string; nome: string; email?: string | null; status?: string | null }

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  leads: Lead[];
  corretores: Corretor[];
  onDone?: () => void;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export function TransferLeadsDialog({ open, onOpenChange, leads, corretores, onDone, loading = false, error = null, onRetry }: Props) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [estagioFilter, setEstagioFilter] = useState<string>("todos");
  const [origemFilter, setOrigemFilter] = useState<string>("todos");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [destino, setDestino] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  type ResultRow = { id: string; nome: string; origem: string; destino: string; status: "ok" | "ignorado" | "falha"; motivo?: string };
  type Result = { destinoNome: string; total: number; sucesso: ResultRow[]; ignorados: ResultRow[]; falhas: ResultRow[]; erroGeral?: string };
  const [result, setResult] = useState<Result | null>(null);




  const corretoresAtivos = useMemo(
    () => corretores.filter(c => (c.status ?? "ativo") === "ativo"),
    [corretores]
  );

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return leads.filter(l => {
      if (estagioFilter !== "todos" && (l.estagio ?? "") !== estagioFilter) return false;
      if (origemFilter !== "todos" && (l.canal_origem ?? "") !== origemFilter) return false;
      if (!s) return true;
      return [l.nome, l.email, l.telefone].some(v => (v ?? "").toLowerCase().includes(s));
    });
  }, [leads, search, estagioFilter, origemFilter]);

  const origens = useMemo(() => {
    const set = new Set<string>();
    leads.forEach(l => l.canal_origem && set.add(l.canal_origem));
    return Array.from(set).sort();
  }, [leads]);

  const allVisibleSelected = filtered.length > 0 && filtered.every(l => selected.has(l.id));
  const allLeadsSelected = leads.length > 0 && leads.every(l => selected.has(l.id));

  const toggleAll = () => {
    const next = new Set(selected);
    if (allVisibleSelected) filtered.forEach(l => next.delete(l.id));
    else filtered.forEach(l => next.add(l.id));
    setSelected(next);
  };

  const toggleAllLeads = () => {
    if (allLeadsSelected) setSelected(new Set());
    else setSelected(new Set(leads.map(l => l.id)));
  };

  const clearSelection = () => setSelected(new Set());

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const [previewOpen, setPreviewOpen] = useState(false);

  const INATIVOS = ["fechado", "perdido", "descartado", "inativo"];

  const preview = useMemo(() => {
    const corretorId = destino === "__none__" ? null : destino;
    const alvos = leads.filter(l => selected.has(l.id));
    const transferir: Array<{ lead: Lead; origem: string }> = [];
    const ignorar: Array<{ lead: Lead; motivo: string }> = [];
    for (const l of alvos) {
      const origem = corretores.find(c => c.id === l.corretor_id)?.nome ?? "sem corretor";
      if ((l.corretor_id ?? null) === corretorId) {
        ignorar.push({ lead: l, motivo: corretorId ? "Já atribuído ao corretor de destino" : "Já está sem corretor" });
        continue;
      }
      if (INATIVOS.includes((l.estagio ?? "").toLowerCase())) {
        ignorar.push({ lead: l, motivo: `Lead inativo (estágio "${l.estagio}")` });
        continue;
      }
      transferir.push({ lead: l, origem });
    }
    return { transferir, ignorar, destinoNome: corretorId ? (corretores.find(c => c.id === corretorId)?.nome ?? "corretor") : "Sem corretor" };
  }, [leads, selected, destino, corretores]);

  const validation = useMemo(() => {
    if (selected.size === 0) {
      return { ok: false, message: "Selecione ao menos um lead antes de transferir." };
    }
    if (!destino) {
      return { ok: false, message: "Escolha um corretor de destino (ou use “Remover corretor”)." };
    }
    if (corretoresAtivos.length === 0 && destino !== "__none__") {
      return { ok: false, message: "Nenhum corretor ativo disponível para receber a transferência." };
    }
    if (preview.transferir.length === 0 && preview.ignorar.length > 0) {
      const allSame = preview.ignorar.every(i => /Já atribuído|Já está sem corretor/.test(i.motivo));
      if (allSame) {
        return { ok: false, message: `Todos os leads selecionados já estão em “${preview.destinoNome}”. Escolha outro destino.` };
      }
      return { ok: false, message: "Nenhum lead elegível: todos foram ignorados (veja os motivos na prévia)." };
    }
    return { ok: true as const, message: "" };
  }, [selected.size, destino, corretoresAtivos.length, preview]);

  const attemptOpenPreview = () => {
    if (!validation.ok) {
      toast({ title: "Não é possível transferir", description: validation.message, variant: "destructive" });
      return;
    }
    setPreviewOpen(true);
  };




  const handleTransfer = async () => {
    if (preview.transferir.length === 0) return;
    setSaving(true);
    setSubmitError(null);

    try {
      const corretorId = destino === "__none__" ? null : destino;
      const destinoNome = preview.destinoNome;
      const alvos = preview.transferir.map(t => t.lead);
      const ids = alvos.map(l => l.id);

      const { data: { user } } = await supabase.auth.getUser();
      const executor = user?.email ?? "admin";

      const { error } = await supabase
        .from("leads")
        .update({ corretor_id: corretorId, updated_at: new Date().toISOString() } as any)
        .in("id", ids);
      if (error) throw error;

      const atividades = preview.transferir.map(({ lead: l, origem }) => ({
        lead_id: l.id,
        imobiliaria_id: (l as any).imobiliaria_id,
        tipo: "atribuicao",
        titulo: "🔁 Transferência de lead",
        descricao:
          `Transferido de "${origem}" para "${destinoNome}".` +
          `\n• Executado por: ${executor}` +
          `\n• Em: ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}` +
          `\n• Origem: painel admin (transferência em lote)`,
      }));
      if (atividades.length) {
        await supabase.from("lead_atividades").insert(atividades as any);
      }

      // Auditoria consolidada (system_logs) — batch + por lead, visível em /auditoria-leads
      const nowBr = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
      const imobId = (alvos[0] as any)?.imobiliaria_id ?? null;
      const batchLog = {
        level: "info",
        module: "LeadsTransfer",
        action: "transfer_batch",
        message: `🔁 Transferência em lote: ${ids.length} lead(s) → ${destinoNome}`,
        user_id: user?.id ?? null,
        metadata: {
          executor,
          destino_corretor_id: corretorId,
          destino_nome: destinoNome,
          total_transferidos: ids.length,
          total_ignorados: preview.ignorar.length,
          timestamp_br: nowBr,
          imobiliaria_id: imobId,
          leads: preview.transferir.map(({ lead: l, origem }) => ({
            id: l.id,
            nome: l.nome,
            estagio: l.estagio,
            canal_origem: l.canal_origem,
            corretor_origem_id: l.corretor_id ?? null,
            corretor_origem_nome: origem,
          })),
          ignorados: preview.ignorar.map(({ lead: l, motivo }) => ({ id: l.id, nome: l.nome, motivo })),
        },
      };
      const perLeadLogs = preview.transferir.map(({ lead: l, origem }) => ({
        level: "info",
        module: "LeadsTransfer",
        action: "transfer",
        message: `Lead "${l.nome}" transferido de "${origem}" para "${destinoNome}"`,
        user_id: user?.id ?? null,
        metadata: {
          executor, timestamp_br: nowBr,
          lead_id: l.id, lead_nome: l.nome, estagio: l.estagio, canal_origem: l.canal_origem,
          corretor_origem_id: l.corretor_id ?? null, corretor_origem_nome: origem,
          corretor_destino_id: corretorId, corretor_destino_nome: destinoNome,
          imobiliaria_id: (l as any).imobiliaria_id ?? null,
          origem: "painel admin (transferência em lote)",
        },
      }));
      await supabase.from("system_logs").insert([batchLog, ...perLeadLogs] as any);

      // Notificar o corretor de destino (se houver e tiver conta vinculada pelo e-mail)
      let notificado = false;
      if (corretorId) {
        const destinoEmail = corretores.find(c => c.id === corretorId)?.email?.toLowerCase() ?? null;
        if (destinoEmail) {
          const { data: prof } = await supabase
            .from("profiles")
            .select("id")
            .ilike("email", destinoEmail)
            .maybeSingle();
          if (prof?.id) {
            const preview5 = preview.transferir.slice(0, 5).map(t => `• ${t.lead.nome}${t.lead.estagio ? ` (${t.lead.estagio})` : ""}`).join("\n");
            const extras = preview.transferir.length > 5 ? `\n…e mais ${preview.transferir.length - 5}` : "";
            await supabase.from("notifications").insert({
              user_id: prof.id,
              title: `🔁 ${ids.length} novo(s) lead(s) na sua carteira`,
              description:
                `Você recebeu ${ids.length} lead(s) via transferência em lote.` +
                `\n• Por: ${executor}` +
                `\n• Em: ${nowBr}` +
                (preview5 ? `\n\nLeads:\n${preview5}${extras}` : ""),
            } as any);
            notificado = true;
          }
        }
      }

      toast({
        title: "Transferência concluída",
        description:
          `${ids.length} transferido(s) · ${preview.ignorar.length} ignorado(s)` +
          (corretorId ? (notificado ? " · corretor notificado" : " · corretor sem conta vinculada (sem notificação)") : ""),
      });

      setResult({
        destinoNome,

        total: preview.transferir.length + preview.ignorar.length,
        sucesso: preview.transferir.map(({ lead, origem }) => ({
          id: lead.id, nome: lead.nome, origem, destino: destinoNome, status: "ok",
        })),
        ignorados: preview.ignorar.map(({ lead, motivo }) => ({
          id: lead.id, nome: lead.nome, origem: corretores.find(c => c.id === lead.corretor_id)?.nome ?? "sem corretor", destino: destinoNome, status: "ignorado", motivo,
        })),
        falhas: [],
      });
      setSelected(new Set());
      setDestino("");
      setPreviewOpen(false);
      onDone?.();
    } catch (e: any) {
      const msg = e?.message ?? "Falha ao atualizar leads.";
      setSubmitError(msg);
      setResult({
        destinoNome: preview.destinoNome,
        total: preview.transferir.length + preview.ignorar.length,
        sucesso: [],
        ignorados: preview.ignorar.map(({ lead, motivo }) => ({
          id: lead.id, nome: lead.nome, origem: corretores.find(c => c.id === lead.corretor_id)?.nome ?? "sem corretor", destino: preview.destinoNome, status: "ignorado", motivo,
        })),
        falhas: preview.transferir.map(({ lead, origem }) => ({
          id: lead.id, nome: lead.nome, origem, destino: preview.destinoNome, status: "falha", motivo: msg,
        })),
        erroGeral: msg,
      });
      toast({ title: "Erro na transferência", description: msg, variant: "destructive" });
      setPreviewOpen(false);
    } finally {
      setSaving(false);
    }

  };



  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-primary" />
            Transferência de Leads
          </DialogTitle>
          <DialogDescription>
            Selecione os leads e escolha o corretor de destino. A transferência é aplicada em lote.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="flex flex-col gap-3 overflow-hidden flex-1" data-testid="tld-result">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center">
              <div className="rounded-md border bg-muted/30 p-2">
                <div className="text-[10px] uppercase text-muted-foreground">Total</div>
                <div className="text-lg font-semibold">{result.total}</div>
              </div>
              <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-2">
                <div className="text-[10px] uppercase text-emerald-700">Sucesso</div>
                <div className="text-lg font-semibold text-emerald-700">{result.sucesso.length}</div>
              </div>
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2">
                <div className="text-[10px] uppercase text-amber-700">Ignorados</div>
                <div className="text-lg font-semibold text-amber-700">{result.ignorados.length}</div>
              </div>
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2">
                <div className="text-[10px] uppercase text-destructive">Falhas</div>
                <div className="text-lg font-semibold text-destructive">{result.falhas.length}</div>
              </div>
            </div>

            {result.erroGeral && (
              <div className="border border-destructive/40 bg-destructive/10 text-destructive text-xs rounded-md px-3 py-2">
                {result.erroGeral}
              </div>
            )}

            <div className="overflow-auto border rounded-md flex-1">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 sticky top-0">
                  <tr className="text-left">
                    <th className="px-2 py-2">Lead</th>
                    <th className="px-2 py-2">Origem → Destino</th>
                    <th className="px-2 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[...result.sucesso, ...result.falhas, ...result.ignorados].map(r => (
                    <tr key={`${r.status}-${r.id}`} className="border-t">
                      <td className="px-2 py-1.5 font-medium">{r.nome}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">{r.origem} → {r.destino}</td>
                      <td className="px-2 py-1.5">
                        {r.status === "ok" && <Badge className="bg-emerald-600 hover:bg-emerald-600 text-[10px]">Transferido</Badge>}
                        {r.status === "ignorado" && <Badge variant="secondary" className="text-[10px]" title={r.motivo}>Ignorado</Badge>}
                        {r.status === "falha" && <Badge variant="destructive" className="text-[10px]" title={r.motivo}>Falha</Badge>}
                        {r.motivo && <div className="text-[10px] text-muted-foreground mt-0.5">{r.motivo}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" onClick={() => { setResult(null); setSubmitError(null); }}>Nova transferência</Button>
              <Button onClick={() => { setResult(null); setSubmitError(null); onOpenChange(false); }}>Fechar</Button>
            </div>
          </div>
        ) : (
        <>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">

          <div className="md:col-span-2 relative">
            <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, e-mail ou telefone"
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={estagioFilter} onValueChange={setEstagioFilter}>
            <SelectTrigger><SelectValue placeholder="Estágio" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os estágios</SelectItem>
              {ESTAGIOS.map(e => <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={origemFilter} onValueChange={setOrigemFilter}>
            <SelectTrigger><SelectValue placeholder="Origem" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as origens</SelectItem>
              {origens.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground gap-2 flex-wrap">
          <div>{filtered.length} lead(s) visíveis · {leads.length} no total · <b className="text-foreground">{selected.size}</b> selecionado(s)</div>
          <div className="flex items-center gap-3">
            <button type="button" className="underline" onClick={toggleAll}>
              {allVisibleSelected ? "Desmarcar visíveis" : "Selecionar visíveis"}
            </button>
            <button type="button" className="underline font-medium text-primary" onClick={toggleAllLeads} data-testid="tld-select-all">
              {allLeadsSelected ? "Desmarcar todos" : `Selecionar todos (${leads.length})`}
            </button>
            {selected.size > 0 && (
              <button type="button" className="underline" onClick={clearSelection}>Limpar</button>
            )}
          </div>
        </div>


        <div className="border rounded-md overflow-y-auto flex-1 min-h-[200px]">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 sticky top-0">
              <tr className="text-left">
                <th className="px-2 py-2 w-10">
                  <Checkbox checked={allVisibleSelected} onCheckedChange={toggleAll} />
                </th>
                <th className="px-2 py-2">Nome</th>
                <th className="px-2 py-2">Estágio</th>
                <th className="px-2 py-2">Origem</th>
                <th className="px-2 py-2">Corretor atual</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-2 py-8 text-center text-muted-foreground" data-testid="tld-loading">
                  <Loader2 className="w-4 h-4 animate-spin inline mr-2" />Carregando leads…
                </td></tr>
              ) : error ? (
                <tr><td colSpan={5} className="px-2 py-8 text-center" data-testid="tld-error">
                  <div className="text-destructive font-medium">Falha ao carregar leads</div>
                  <div className="text-xs text-muted-foreground mb-2">{error}</div>
                  {onRetry && <Button size="sm" variant="outline" onClick={onRetry}>Tentar novamente</Button>}
                </td></tr>
              ) : leads.length === 0 ? (
                <tr><td colSpan={5} className="px-2 py-8 text-center text-muted-foreground" data-testid="tld-empty-all">
                  Nenhum lead disponível para transferência.
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="px-2 py-8 text-center text-muted-foreground" data-testid="tld-empty-filter">
                  Nenhum lead corresponde aos filtros. Ajuste a busca ou limpe os filtros.
                </td></tr>
              ) : filtered.map(l => {
                const cAtual = corretores.find(c => c.id === l.corretor_id);
                return (
                  <tr key={l.id} className="border-t hover:bg-muted/30">
                    <td className="px-2 py-2">
                      <Checkbox checked={selected.has(l.id)} onCheckedChange={() => toggleOne(l.id)} />
                    </td>
                    <td className="px-2 py-2 font-medium">{l.nome}</td>
                    <td className="px-2 py-2"><Badge variant="secondary" className="text-[10px]">{l.estagio ?? "—"}</Badge></td>
                    <td className="px-2 py-2">{l.canal_origem ?? "—"}</td>
                    <td className="px-2 py-2">{cAtual?.nome ?? <span className="text-muted-foreground italic">sem corretor</span>}</td>
                  </tr>
                );
              })}
            </tbody>

          </table>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2 items-end pt-2 border-t">
          <div>
            <Label className="text-xs">Corretor de destino</Label>
            <Select value={destino} onValueChange={setDestino}>
              <SelectTrigger><SelectValue placeholder="Selecione o corretor" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Remover corretor (sem responsável)</SelectItem>
                {corretoresAtivos.length === 0 ? (
                  <div className="px-2 py-2 text-xs text-muted-foreground">Nenhum corretor ativo cadastrado.</div>
                ) : corretoresAtivos.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}{c.email ? ` · ${c.email}` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!validation.ok && (
              <p data-testid="tld-validation" className="text-[11px] text-destructive mt-1">
                {validation.message}
              </p>
            )}
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button
            data-testid="tld-open-preview"
            onClick={attemptOpenPreview}
            disabled={saving}
            aria-disabled={!validation.ok}
            title={validation.ok ? "Revisar e transferir" : validation.message}
          >
            <ArrowRightLeft className="w-4 h-4 mr-2" />
            Revisar e transferir {selected.size > 0 ? `(${selected.size})` : ""}
          </Button>
        </div>


        <AlertDialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <AlertDialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar transferência</AlertDialogTitle>
              <AlertDialogDescription>
                Destino: <strong>{preview.destinoNome}</strong> · {preview.transferir.length} serão transferidos · {preview.ignorar.length} serão ignorados.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="grid grid-cols-3 gap-2 text-center" data-testid="tld-preview-counters">
              <div className="rounded-md border bg-muted/30 p-2">
                <div className="text-[10px] uppercase text-muted-foreground">Total selecionado</div>
                <div className="text-lg font-semibold">{preview.transferir.length + preview.ignorar.length}</div>
              </div>
              <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-2">
                <div className="text-[10px] uppercase text-emerald-700">Serão transferidos</div>
                <div className="text-lg font-semibold text-emerald-700">{preview.transferir.length}</div>
              </div>
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2">
                <div className="text-[10px] uppercase text-amber-700">Serão ignorados</div>
                <div className="text-lg font-semibold text-amber-700">{preview.ignorar.length}</div>
              </div>
            </div>



            <div className="overflow-auto space-y-4 text-sm">
              <div>
                <div className="font-medium text-emerald-700 mb-1">Serão transferidos ({preview.transferir.length})</div>
                {preview.transferir.length === 0 ? (
                  <p className="text-muted-foreground italic">Nenhum lead elegível.</p>
                ) : (
                  <ul className="divide-y border rounded-md">
                    {preview.transferir.map(({ lead, origem }) => (
                      <li key={lead.id} className="px-3 py-1.5 flex justify-between gap-2">
                        <span className="truncate">{lead.nome} <Badge variant="secondary" className="text-[10px] ml-1">{lead.estagio ?? "—"}</Badge></span>
                        <span className="text-muted-foreground text-xs whitespace-nowrap">{origem} → {preview.destinoNome}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {preview.ignorar.length > 0 && (
                <div>
                  <div className="font-medium text-amber-700 mb-1">Ignorados ({preview.ignorar.length})</div>
                  <ul className="divide-y border rounded-md">
                    {preview.ignorar.map(({ lead, motivo }) => (
                      <li key={lead.id} className="px-3 py-1.5 flex justify-between gap-2">
                        <span className="truncate">{lead.nome}</span>
                        <span className="text-muted-foreground text-xs whitespace-nowrap">{motivo}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {submitError && (
              <div data-testid="tld-submit-error" className="border border-destructive/40 bg-destructive/10 text-destructive text-xs rounded-md px-3 py-2">
                Não foi possível concluir a transferência: {submitError}
              </div>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={saving}>Voltar</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => { e.preventDefault(); handleTransfer(); }}
                disabled={saving || preview.transferir.length === 0}
              >
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowRightLeft className="w-4 h-4 mr-2" />}
                Confirmar transferência ({preview.transferir.length})
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        </>
        )}
      </DialogContent>

    </Dialog>
  );
}

