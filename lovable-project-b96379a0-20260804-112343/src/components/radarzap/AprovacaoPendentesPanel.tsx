import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserPermissoes } from "@/hooks/useUserPermissoes";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Check, X, ShieldCheck, Lock, Search, Filter as FilterIcon } from "lucide-react";

type PendingLead = {
  id: string;
  proprietario_nome: string | null;
  contato: string | null;
  resumo: string | null;
  tipo_imovel: string | null;
  operacao: string | null;
  bairro: string | null;
  cidade: string | null;
  preco: number | null;
  score: number | null;
  is_principal: boolean | null;
  status: string;
  created_at: string;
};

const onlyDigits = (s: string) => s.replace(/\D/g, "");

export default function AprovacaoPendentesPanel({ onChange }: { onChange?: () => void }) {
  const { user, isMaster } = useAuth();
  const { canAccess, loading: permLoading } = useUserPermissoes("self");
  const canAprovar = isMaster || canAccess("radarzap_aprovar" as any);
  const canEditarSensivel = isMaster || canAccess("radarzap_editar_sensivel" as any);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<PendingLead[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Partial<PendingLead> & { notas?: string }>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Filtros
  const [busca, setBusca] = useState("");
  const [fOperacao, setFOperacao] = useState<string>("all");
  const [fTipo, setFTipo] = useState<string>("all");
  const [fCidade, setFCidade] = useState<string>("all");
  const [fBairro, setFBairro] = useState<string>("all");
  const [fScoreMin, setFScoreMin] = useState<string>("0");
  const [fApenasPrincipal, setFApenasPrincipal] = useState(false);
  const [fApenasComContato, setFApenasComContato] = useState(false);
  const [fBulkNotas, setFBulkNotas] = useState("");

  const carregar = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("radarzap_leads")
      .select("*")
      .eq("status", "pendente_aprovacao")
      .order("score", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) toast.error(error.message);
    setItems((data ?? []) as PendingLead[]);
    setSelected(new Set());
    setLoading(false);
  }, [user]);


  useEffect(() => { carregar(); }, [carregar]);

  const patch = (id: string, p: Partial<PendingLead> & { notas?: string }) =>
    setDrafts(d => ({ ...d, [id]: { ...d[id], ...p } }));

  const aprovar = async (l: PendingLead) => {
    if (!canAprovar) return toast.error("Sem permissão para aprovar leads.");
    const d = drafts[l.id] ?? {};
    // Se não pode editar dados sensíveis, força os valores originais
    const contatoBase = canEditarSensivel ? (d.contato ?? l.contato) : l.contato;
    const nomeBase = canEditarSensivel ? (d.proprietario_nome ?? l.proprietario_nome) : l.proprietario_nome;
    const resumoBase = canEditarSensivel ? (d.resumo ?? l.resumo) : l.resumo;
    const contato = onlyDigits(contatoBase ?? "");
    if (contato && contato.length < 8) {
      toast.error("Contato inválido (mínimo 8 dígitos ou vazio).");
      return;
    }
    const nome = (nomeBase ?? "").trim().slice(0, 120);
    const resumo = (resumoBase ?? "").trim().slice(0, 1000);
    const notas = (d.notas ?? "").trim().slice(0, 500) || null;

    setBusyId(l.id);
    const { error } = await supabase.from("radarzap_leads").update({
      proprietario_nome: nome || null,
      contato: contato || null,
      resumo: resumo || null,
      revisao_notas: notas,
      aprovado_por: user?.id ?? null,
      aprovado_em: new Date().toISOString(),
      status: "aprovado",
    }).eq("id", l.id);
    setBusyId(null);
    if (error) return toast.error(error.message);
    toast.success("Lead aprovado — card criado no CRM com origem RadarZAP e auditoria registrada.");
    setItems(prev => prev.filter(x => x.id !== l.id));
    onChange?.();
  };

  const rejeitar = async (l: PendingLead) => {
    if (!canAprovar) return toast.error("Sem permissão para rejeitar leads.");
    const notas = (drafts[l.id]?.notas ?? "").trim().slice(0, 500) || null;
    setBusyId(l.id);
    const { error } = await supabase.from("radarzap_leads").update({
      status: "descartado",
      revisao_notas: notas,
      aprovado_por: user?.id ?? null,
      aprovado_em: new Date().toISOString(),
    }).eq("id", l.id);
    setBusyId(null);
    if (error) return toast.error(error.message);
    toast.success("Lead rejeitado.");
    setItems(prev => prev.filter(x => x.id !== l.id));
    onChange?.();
  };

  // ---------- Filtros ----------
  const uniq = (arr: (string | null)[]) =>
    Array.from(new Set(arr.filter((v): v is string => !!v && v.trim().length > 0))).sort((a, b) => a.localeCompare(b));

  const operacoes = useMemo(() => uniq(items.map(i => i.operacao)), [items]);
  const tipos = useMemo(() => uniq(items.map(i => i.tipo_imovel)), [items]);
  const cidades = useMemo(() => uniq(items.map(i => i.cidade)), [items]);
  const bairros = useMemo(
    () => uniq(items.filter(i => fCidade === "all" || i.cidade === fCidade).map(i => i.bairro)),
    [items, fCidade]
  );

  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const min = Number(fScoreMin) || 0;
    return items.filter(l => {
      if (fOperacao !== "all" && (l.operacao ?? "") !== fOperacao) return false;
      if (fTipo !== "all" && (l.tipo_imovel ?? "") !== fTipo) return false;
      if (fCidade !== "all" && (l.cidade ?? "") !== fCidade) return false;
      if (fBairro !== "all" && (l.bairro ?? "") !== fBairro) return false;
      if ((l.score ?? 0) < min) return false;
      if (fApenasPrincipal && l.is_principal === false) return false;
      if (fApenasComContato && !(l.contato && onlyDigits(l.contato).length >= 8)) return false;
      if (q) {
        const hay = [l.proprietario_nome, l.contato, l.resumo, l.bairro, l.cidade, l.tipo_imovel, l.operacao]
          .map(x => (x ?? "").toString().toLowerCase()).join(" ");
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, busca, fOperacao, fTipo, fCidade, fBairro, fScoreMin, fApenasPrincipal, fApenasComContato]);

  const limparFiltros = () => {
    setBusca(""); setFOperacao("all"); setFTipo("all"); setFCidade("all"); setFBairro("all");
    setFScoreMin("0"); setFApenasPrincipal(false); setFApenasComContato(false);
  };

  // ---------- Seleção ----------
  const toggleSel = (id: string) => setSelected(s => {
    const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n;
  });
  const selectedIds = useMemo(() => filtered.filter(i => selected.has(i.id)).map(i => i.id), [filtered, selected]);
  const allFilteredSelected = filtered.length > 0 && filtered.every(i => selected.has(i.id));
  const toggleAllFiltered = () => {
    setSelected(s => {
      const n = new Set(s);
      if (allFilteredSelected) filtered.forEach(i => n.delete(i.id));
      else filtered.forEach(i => n.add(i.id));
      return n;
    });
  };

  // ---------- Ações em lote ----------
  const bulkUpdate = async (novoStatus: "aprovado" | "descartado") => {
    if (!canAprovar) return toast.error("Sem permissão.");
    if (selectedIds.length === 0) return toast.error("Selecione ao menos um lead.");
    const label = novoStatus === "aprovado" ? "aprovar" : "rejeitar";
    if (!window.confirm(`Confirma ${label} ${selectedIds.length} lead(s)?`)) return;

    setBulkBusy(true);
    const notasBulk = fBulkNotas.trim().slice(0, 500) || null;
    const payload: Record<string, any> = {
      status: novoStatus,
      aprovado_por: user?.id ?? null,
      aprovado_em: new Date().toISOString(),
    };
    if (notasBulk) payload.revisao_notas = notasBulk;

    // Chunks de 50 para evitar payloads longos em URL/filtro .in
    const chunkSize = 50;
    let ok = 0, fail = 0;
    for (let i = 0; i < selectedIds.length; i += chunkSize) {
      const chunk = selectedIds.slice(i, i + chunkSize);
      const { error } = await supabase.from("radarzap_leads").update(payload).in("id", chunk);
      if (error) { fail += chunk.length; console.error("[bulk radarzap]", error); }
      else ok += chunk.length;
    }
    setBulkBusy(false);
    if (ok) toast.success(`${ok} lead(s) ${novoStatus === "aprovado" ? "aprovado(s)" : "rejeitado(s)"}.`);
    if (fail) toast.error(`${fail} falharam. Verifique permissões.`);
    setItems(prev => prev.filter(x => !selectedIds.includes(x.id)));
    setSelected(new Set());
    setFBulkNotas("");
    onChange?.();
  };

  if (loading || permLoading) return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Carregando…</div>;

  const permBanner = (!canAprovar || !canEditarSensivel) ? (
    <div className="flex items-start gap-2 rounded-md border border-amber-300/60 bg-amber-50 p-3 text-xs text-amber-900">
      <Lock className="h-4 w-4 mt-0.5" />
      <div>
        <b>Acesso limitado por perfil.</b>{" "}
        {!canAprovar && <span>Você não pode aprovar/rejeitar leads. </span>}
        {!canEditarSensivel && <span>Edição de nome do proprietário, contato e resumo está bloqueada. </span>}
        Solicite ao administrador master a liberação em <b>Corretores → Permissões</b>.
      </div>
    </div>
  ) : null;

  if (items.length === 0) {
    return (
      <div className="space-y-3">
        {permBanner}
        <Card><CardContent className="p-6 text-center text-muted-foreground">
          <ShieldCheck className="h-6 w-6 mx-auto mb-2 text-emerald-600" />
          Nenhum lead pendente. Novas capturas aparecerão aqui para revisão antes de virar card no pipeline.
        </CardContent></Card>
      </div>
    );
  }

  const filterBar = (
    <Card>
      <CardContent className="p-3 space-y-3">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <FilterIcon className="h-3.5 w-3.5" /> Filtros avançados
          <span className="ml-auto text-[11px]">
            {filtered.length} de {items.length} pendente(s)
          </span>
        </div>
        <div className="grid gap-2 md:grid-cols-4">
          <div className="relative md:col-span-2">
            <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input className="pl-7 h-9" placeholder="Buscar nome, contato, resumo, bairro…" value={busca} onChange={e => setBusca(e.target.value)} />
          </div>
          <Select value={fOperacao} onValueChange={setFOperacao}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Operação" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas operações</SelectItem>
              {operacoes.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fTipo} onValueChange={setFTipo}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos tipos</SelectItem>
              {tipos.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fCidade} onValueChange={(v) => { setFCidade(v); setFBairro("all"); }}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Cidade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas cidades</SelectItem>
              {cidades.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fBairro} onValueChange={setFBairro}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Bairro" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos bairros</SelectItem>
              {bairros.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Score ≥</span>
            <Input type="number" min={0} max={100} className="h-9" value={fScoreMin} onChange={e => setFScoreMin(e.target.value)} />
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <Checkbox checked={fApenasPrincipal} onCheckedChange={v => setFApenasPrincipal(!!v)} />
              Só principais
            </label>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <Checkbox checked={fApenasComContato} onCheckedChange={v => setFApenasComContato(!!v)} />
              Com contato
            </label>
            <Button size="sm" variant="ghost" onClick={limparFiltros}>Limpar</Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
          <label className="flex items-center gap-1.5 text-xs cursor-pointer">
            <Checkbox checked={allFilteredSelected} onCheckedChange={toggleAllFiltered} />
            Selecionar {filtered.length} visível(is)
          </label>
          <Badge variant="outline">{selectedIds.length} selecionado(s)</Badge>
          <Input
            className="h-9 max-w-xs"
            placeholder="Notas de revisão do lote (opcional)"
            value={fBulkNotas}
            onChange={e => setFBulkNotas(e.target.value)}
            maxLength={500}
          />
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" disabled={!canAprovar || bulkBusy || selectedIds.length === 0} onClick={() => bulkUpdate("descartado")}>
              {bulkBusy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <X className="h-4 w-4 mr-1" />}
              Rejeitar em lote
            </Button>
            <Button size="sm" disabled={!canAprovar || bulkBusy || selectedIds.length === 0} onClick={() => bulkUpdate("aprovado")}>
              {bulkBusy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
              Aprovar em lote
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-3">
      {permBanner}
      {filterBar}
      <p className="text-xs text-muted-foreground">
        Revise resumo e contato de cada mensagem. Só leads <b>aprovados</b> viram cards no pipeline de captação.
        Ações em lote usam os valores originais dos campos (sem edições individuais).
      </p>
      {filtered.length === 0 && (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">
          Nenhum lead corresponde aos filtros atuais.
        </CardContent></Card>
      )}
      {filtered.map(l => {
        const d = drafts[l.id] ?? {};
        const isSel = selected.has(l.id);
        return (
          <Card key={l.id} className={`border-amber-300/60 ${isSel ? "ring-2 ring-primary/40" : ""}`}>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Checkbox checked={isSel} onCheckedChange={() => toggleSel(l.id)} aria-label="Selecionar lead" />
                <Badge className="bg-amber-500 text-white">Pendente</Badge>
                <Badge variant="outline">Score {l.score ?? 0}</Badge>
                {l.operacao && <Badge>{l.operacao}</Badge>}
                {l.tipo_imovel && <Badge variant="secondary">{l.tipo_imovel}</Badge>}
                {l.bairro && <Badge variant="outline">{l.bairro}{l.cidade ? ` · ${l.cidade}` : ""}</Badge>}
                {l.is_principal === false && <Badge variant="outline">Duplicata</Badge>}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="text-xs font-medium flex items-center gap-1">
                    Proprietário {!canEditarSensivel && <Lock className="h-3 w-3 text-amber-600" />}
                  </label>
                  <Input
                    maxLength={120}
                    value={d.proprietario_nome ?? l.proprietario_nome ?? ""}
                    onChange={e => patch(l.id, { proprietario_nome: e.target.value })}
                    placeholder="Nome (opcional)"
                    readOnly={!canEditarSensivel}
                    disabled={!canEditarSensivel}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium flex items-center gap-1">
                    Contato (telefone) {!canEditarSensivel && <Lock className="h-3 w-3 text-amber-600" />}
                  </label>
                  <Input
                    inputMode="tel"
                    maxLength={20}
                    value={d.contato ?? l.contato ?? ""}
                    onChange={e => patch(l.id, { contato: e.target.value })}
                    placeholder="Somente números"
                    readOnly={!canEditarSensivel}
                    disabled={!canEditarSensivel}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium flex items-center gap-1">
                  Resumo da mensagem {!canEditarSensivel && <Lock className="h-3 w-3 text-amber-600" />}
                </label>
                <Textarea
                  maxLength={1000}
                  rows={3}
                  value={d.resumo ?? l.resumo ?? ""}
                  onChange={e => patch(l.id, { resumo: e.target.value })}
                  readOnly={!canEditarSensivel}
                  disabled={!canEditarSensivel}
                />
              </div>

              <div>
                <label className="text-xs font-medium">Notas de revisão (opcional)</label>
                <Textarea
                  maxLength={500}
                  rows={2}
                  placeholder="Motivo da decisão, observações de conformidade…"
                  value={d.notas ?? ""}
                  onChange={e => patch(l.id, { notas: e.target.value })}
                  disabled={!canAprovar}
                />
              </div>

              <div className="flex gap-2 justify-end pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => rejeitar(l)}
                  disabled={busyId === l.id || !canAprovar}
                  title={!canAprovar ? "Sem permissão para rejeitar" : undefined}
                >
                  <X className="h-4 w-4 mr-1" />Rejeitar
                </Button>
                <Button
                  size="sm"
                  onClick={() => aprovar(l)}
                  disabled={busyId === l.id || !canAprovar}
                  title={!canAprovar ? "Sem permissão para aprovar" : undefined}
                >
                  {busyId === l.id ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : canAprovar ? <Check className="h-4 w-4 mr-1" /> : <Lock className="h-4 w-4 mr-1" />}
                  Aprovar e enviar ao pipeline
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
