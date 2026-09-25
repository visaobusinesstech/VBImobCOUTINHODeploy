import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, History, Globe, ShieldAlert } from "lucide-react";

type Portal = {
  id: string;
  dominio: string;
  ativo: boolean;
  regiao: string | null;
  notas: string | null;
  updated_at: string;
  updated_by: string | null;
  created_by: string | null;
};

type Versao = {
  id: string;
  portal_id: string | null;
  dominio: string;
  acao: "insert" | "update" | "delete";
  dados_antes: any;
  dados_depois: any;
  changed_by: string | null;
  changed_at: string;
};

const DOMINIO_RE = /^(?!:\/\/)([a-z0-9-]+\.)+[a-z]{2,}$/i;

export default function CaptacaoAllowlist() {
  const { user } = useAuth();
  const [isMaster, setIsMaster] = useState<boolean | null>(null);
  const [portais, setPortais] = useState<Portal[]>([]);
  const [versoes, setVersoes] = useState<Versao[]>([]);
  const [loading, setLoading] = useState(true);
  const [novoDominio, setNovoDominio] = useState("");
  const [novaRegiao, setNovaRegiao] = useState("");
  const [novasNotas, setNovasNotas] = useState("");
  const [savingNew, setSavingNew] = useState(false);
  const [filtro, setFiltro] = useState("");

  const carregar = useCallback(async () => {
    setLoading(true);
    const [p, v, prof] = await Promise.all([
      supabase.from("captacao_portais_allowlist").select("*").order("dominio"),
      supabase
        .from("captacao_portais_allowlist_versoes")
        .select("*")
        .order("changed_at", { ascending: false })
        .limit(100),
      user
        ? supabase.from("profiles").select("is_master").eq("id", user.id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    if (p.error) toast.error("Erro ao carregar portais: " + p.error.message);
    else setPortais((p.data ?? []) as Portal[]);
    if (!v.error) setVersoes((v.data ?? []) as Versao[]);
    setIsMaster(!!(prof as any)?.data?.is_master);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const normalizarDominio = (d: string) =>
    d.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");

  const adicionar = async () => {
    const dominio = normalizarDominio(novoDominio);
    if (!DOMINIO_RE.test(dominio)) {
      toast.error("Domínio inválido. Ex.: portalimoveis.com.br");
      return;
    }
    setSavingNew(true);
    const { error } = await supabase.from("captacao_portais_allowlist").insert({
      dominio,
      regiao: novaRegiao.trim() || null,
      notas: novasNotas.trim() || null,
      created_by: user?.id ?? null,
      updated_by: user?.id ?? null,
    });
    setSavingNew(false);
    if (error) {
      toast.error(error.message.includes("duplicate") ? "Este domínio já existe no allowlist." : error.message);
      return;
    }
    toast.success(`${dominio} adicionado ao allowlist.`);
    setNovoDominio("");
    setNovaRegiao("");
    setNovasNotas("");
    carregar();
  };

  const toggleAtivo = async (p: Portal, ativo: boolean) => {
    const { error } = await supabase
      .from("captacao_portais_allowlist")
      .update({ ativo })
      .eq("id", p.id);
    if (error) toast.error(error.message);
    else {
      toast.success(`${p.dominio} ${ativo ? "ativado" : "desativado"}.`);
      carregar();
    }
  };

  const atualizarCampo = async (p: Portal, campo: "regiao" | "notas", valor: string) => {
    const { error } = await supabase
      .from("captacao_portais_allowlist")
      .update({ [campo]: valor.trim() || null })
      .eq("id", p.id);
    if (error) toast.error(error.message);
    else carregar();
  };

  const remover = async (p: Portal) => {
    if (!confirm(`Remover ${p.dominio} do allowlist? A remoção fica registrada no histórico.`)) return;
    const { error } = await supabase.from("captacao_portais_allowlist").delete().eq("id", p.id);
    if (error) toast.error(error.message);
    else {
      toast.success(`${p.dominio} removido.`);
      carregar();
    }
  };

  const filtered = portais.filter((p) =>
    !filtro.trim() ? true : p.dominio.toLowerCase().includes(filtro.trim().toLowerCase()) ||
      (p.regiao ?? "").toLowerCase().includes(filtro.trim().toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isMaster) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-500" /> Acesso restrito
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Somente contas Master podem gerenciar o allowlist de portais de captação.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Globe className="w-6 h-6" /> Allowlist de portais
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Portais autorizados nas buscas Firecrawl (PASS 1 / PASS 2). Alterações entram em vigor em até 60s (cache do edge function).
        </p>
      </div>

      {/* Adicionar */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="w-4 h-4" /> Adicionar portal
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Input
            placeholder="dominio.com.br"
            value={novoDominio}
            onChange={(e) => setNovoDominio(e.target.value)}
          />
          <Input
            placeholder="Região (ex.: df, nacional)"
            value={novaRegiao}
            onChange={(e) => setNovaRegiao(e.target.value)}
          />
          <Input
            placeholder="Notas (opcional)"
            value={novasNotas}
            onChange={(e) => setNovasNotas(e.target.value)}
          />
          <Button onClick={adicionar} disabled={savingNew || !novoDominio.trim()}>
            {savingNew ? <Loader2 className="w-4 h-4 animate-spin" /> : "Adicionar"}
          </Button>
        </CardContent>
      </Card>

      {/* Lista */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-base">
            Portais ({portais.filter((p) => p.ativo).length}/{portais.length} ativos)
          </CardTitle>
          <Input
            placeholder="Filtrar por domínio ou região…"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            className="max-w-xs"
          />
        </CardHeader>
        <CardContent className="space-y-2">
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum portal encontrado.</p>
          )}
          {filtered.map((p) => (
            <div
              key={p.id}
              className="flex flex-col md:flex-row md:items-center gap-3 p-3 rounded-lg border bg-background hover:bg-accent/30 transition"
            >
              <div className="flex items-center gap-2 min-w-[220px]">
                <Switch checked={p.ativo} onCheckedChange={(v) => toggleAtivo(p, v)} />
                <span className={`font-mono text-sm ${p.ativo ? "" : "line-through text-muted-foreground"}`}>
                  {p.dominio}
                </span>
                {p.ativo ? (
                  <Badge variant="outline" className="text-[10px] border-emerald-400 text-emerald-700 bg-emerald-50">Ativo</Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px]">Inativo</Badge>
                )}
              </div>
              <Input
                defaultValue={p.regiao ?? ""}
                placeholder="Região"
                className="max-w-[160px]"
                onBlur={(e) => e.target.value !== (p.regiao ?? "") && atualizarCampo(p, "regiao", e.target.value)}
              />
              <Input
                defaultValue={p.notas ?? ""}
                placeholder="Notas"
                className="flex-1"
                onBlur={(e) => e.target.value !== (p.notas ?? "") && atualizarCampo(p, "notas", e.target.value)}
              />
              <Button variant="ghost" size="icon" onClick={() => remover(p)} title="Remover">
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Histórico */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <History className="w-4 h-4" /> Histórico de mudanças (últimas 100)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {versoes.length === 0 && (
            <p className="text-sm text-muted-foreground">Sem alterações registradas.</p>
          )}
          <div className="max-h-[420px] overflow-auto divide-y">
            {versoes.map((v) => {
              const badgeClass =
                v.acao === "insert" ? "border-emerald-400 text-emerald-700 bg-emerald-50" :
                v.acao === "delete" ? "border-red-400 text-red-700 bg-red-50" :
                "border-sky-400 text-sky-700 bg-sky-50";
              const diff: string[] = [];
              if (v.acao === "update" && v.dados_antes && v.dados_depois) {
                for (const k of ["ativo", "regiao", "notas", "dominio"]) {
                  const a = (v.dados_antes as any)?.[k];
                  const b = (v.dados_depois as any)?.[k];
                  if (JSON.stringify(a) !== JSON.stringify(b)) {
                    diff.push(`${k}: ${JSON.stringify(a)} → ${JSON.stringify(b)}`);
                  }
                }
              }
              return (
                <div key={v.id} className="py-2 text-sm flex flex-col gap-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={`text-[10px] ${badgeClass}`}>{v.acao}</Badge>
                    <span className="font-mono">{v.dominio}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(v.changed_at).toLocaleString("pt-BR")}
                    </span>
                  </div>
                  {diff.length > 0 && (
                    <div className="text-xs text-muted-foreground font-mono pl-2">
                      {diff.map((d, i) => <div key={i}>• {d}</div>)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
