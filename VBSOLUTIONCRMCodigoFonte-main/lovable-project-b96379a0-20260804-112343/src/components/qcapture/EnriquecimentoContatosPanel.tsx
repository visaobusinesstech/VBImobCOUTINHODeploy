import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  Sparkles, Loader2, Phone, Mail, ExternalLink, Trash2, RefreshCw,
  ShieldCheck, Building2, Users, Search, ClipboardCheck,
} from "lucide-react";

type Tipo = "administradora" | "sindico" | "portaria" | "imobiliaria" | "outro";
type Status = "pendente" | "verificado" | "invalido" | "contatado";

interface Contato {
  id: string;
  condominio_nome: string;
  tipo: Tipo;
  nome: string | null;
  cargo: string | null;
  telefone: string | null;
  email: string | null;
  url_fonte: string;
  trecho_fonte: string | null;
  confianca: number;
  status: Status;
  created_at: string;
}

interface Run {
  id: string;
  condominio_nome: string;
  contatos_encontrados: number;
  status: string;
  erro: string | null;
  duracao_ms: number | null;
  fontes: any;
  created_at: string;
}

const db = supabase as any;

const TIPO_META: Record<Tipo, { label: string; icon: JSX.Element; className: string }> = {
  administradora: { label: "Administradora", icon: <Building2 className="w-3 h-3" />, className: "bg-blue-50 text-blue-700 border-blue-200" },
  sindico: { label: "Síndico", icon: <Users className="w-3 h-3" />, className: "bg-purple-50 text-purple-700 border-purple-200" },
  portaria: { label: "Portaria", icon: <Phone className="w-3 h-3" />, className: "bg-amber-50 text-amber-700 border-amber-200" },
  imobiliaria: { label: "Imobiliária", icon: <Building2 className="w-3 h-3" />, className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  outro: { label: "Outro", icon: <Search className="w-3 h-3" />, className: "bg-slate-50 text-slate-700 border-slate-200" },
};

const STATUS_META: Record<Status, string> = {
  pendente: "bg-slate-100 text-slate-700",
  verificado: "bg-emerald-100 text-emerald-700",
  contatado: "bg-blue-100 text-blue-700",
  invalido: "bg-rose-100 text-rose-700",
};

export function EnriquecimentoContatosPanel() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [condominio, setCondominio] = useState("");
  const [bairro, setBairro] = useState("");
  const [cep, setCep] = useState("");
  const [rodando, setRodando] = useState(false);
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(false);

  const carregar = async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: ct }, { data: rn }] = await Promise.all([
      db.from("condominio_contatos").select("*").eq("imobiliaria_id", user.id).order("created_at", { ascending: false }).limit(500),
      db.from("condominio_enriquecimento_runs").select("*").eq("imobiliaria_id", user.id).order("created_at", { ascending: false }).limit(20),
    ]);
    setContatos((ct ?? []) as Contato[]);
    setRuns((rn ?? []) as Run[]);
    setLoading(false);
  };

  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [user?.id]);

  const enriquecer = async () => {
    if (!condominio.trim()) {
      toast({ title: "Informe o condomínio", variant: "destructive" });
      return;
    }
    setRodando(true);
    try {
      const { data, error } = await supabase.functions.invoke("enriquecer-condominio", {
        body: { condominio_nome: condominio.trim(), bairro: bairro.trim(), cep: cep.trim() },
      });
      if (error) throw error;
      const r = data as { status: string; contatos_encontrados: number; fontes: number; erros?: string[] };
      toast({
        title: r.status === "sucesso" ? "Enriquecimento concluído" : r.status === "parcial" ? "Parcial" : r.status === "sem_resultados" ? "Sem contatos" : "Falhou",
        description: `${r.contatos_encontrados} contato(s) coletado(s) de ${r.fontes} fonte(s) pública(s).`,
        variant: r.status === "erro" ? "destructive" : "default",
      });
      await carregar();
    } catch (e: any) {
      toast({ title: "Erro no enriquecimento", description: e.message, variant: "destructive" });
    } finally {
      setRodando(false);
    }
  };

  const marcar = async (c: Contato, status: Status) => {
    const { error } = await db.from("condominio_contatos").update({ status }).eq("id", c.id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setContatos((prev) => prev.map((x) => (x.id === c.id ? { ...x, status } : x)));
  };

  const remover = async (c: Contato) => {
    if (!confirm("Remover este contato?")) return;
    const { error } = await db.from("condominio_contatos").delete().eq("id", c.id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setContatos((prev) => prev.filter((x) => x.id !== c.id));
  };

  const filtrados = useMemo(() => {
    return contatos.filter((c) => {
      if (filtroTipo !== "todos" && c.tipo !== filtroTipo) return false;
      if (busca) {
        const q = busca.toLowerCase();
        return (
          c.condominio_nome.toLowerCase().includes(q) ||
          (c.telefone ?? "").includes(q) ||
          (c.email ?? "").toLowerCase().includes(q) ||
          (c.nome ?? "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [contatos, filtroTipo, busca]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Enriquecimento Automático de Condomínios
          </CardTitle>
          <CardDescription>
            Consulta fontes públicas (busca web via Firecrawl) para descobrir administradoras,
            síndicos, portarias e imobiliárias associadas, extraindo telefones e e-mails visíveis publicamente.
            Cada contato guarda a URL de origem para conformidade LGPD.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <Input placeholder="Condomínio *" value={condominio} onChange={(e) => setCondominio(e.target.value)} className="md:col-span-2" />
            <Input placeholder="Bairro" value={bairro} onChange={(e) => setBairro(e.target.value)} />
            <Input placeholder="CEP" value={cep} onChange={(e) => setCep(e.target.value)} />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button onClick={enriquecer} disabled={rodando} className="gap-1">
              {rodando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {rodando ? "Buscando fontes públicas..." : "Enriquecer contatos"}
            </Button>
            <Button variant="outline" onClick={carregar} disabled={loading} className="gap-1">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Badge variant="secondary" className="gap-1"><ShieldCheck className="w-3 h-3" /> LGPD: apenas dados públicos com fonte</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Filtros */}
      <Card>
        <CardContent className="p-3 flex flex-col md:flex-row gap-2">
          <Input placeholder="Buscar por condomínio, telefone, e-mail, nome..." value={busca} onChange={(e) => setBusca(e.target.value)} className="md:max-w-sm" />
          <Select value={filtroTipo} onValueChange={setFiltroTipo}>
            <SelectTrigger className="md:w-52"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              {(Object.keys(TIPO_META) as Tipo[]).map((t) => (
                <SelectItem key={t} value={t}>{TIPO_META[t].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="md:ml-auto flex items-center text-xs text-muted-foreground">
            {filtrados.length} de {contatos.length} contato(s)
          </div>
        </CardContent>
      </Card>

      {/* Lista de contatos */}
      <Card>
        <CardContent className="p-0">
          {filtrados.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Nenhum contato coletado ainda. Informe um condomínio acima e clique em <strong>Enriquecer contatos</strong>.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs">
                  <tr>
                    <th className="text-left p-3">Condomínio</th>
                    <th className="text-left p-3">Tipo</th>
                    <th className="text-left p-3">Contato</th>
                    <th className="text-left p-3">Fonte pública</th>
                    <th className="text-center p-3">Conf.</th>
                    <th className="text-left p-3">Status</th>
                    <th className="text-right p-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((c) => {
                    const m = TIPO_META[c.tipo];
                    return (
                      <tr key={c.id} className="border-t hover:bg-muted/20">
                        <td className="p-3">
                          <div className="font-medium">{c.condominio_nome}</div>
                          {c.nome && <div className="text-xs text-muted-foreground truncate max-w-[240px]">{c.nome}</div>}
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" className={`${m.className} gap-1`}>{m.icon}{m.label}</Badge>
                        </td>
                        <td className="p-3 space-y-0.5">
                          {c.telefone && (
                            <div className="flex items-center gap-1 text-xs">
                              <Phone className="w-3 h-3 text-emerald-600" />
                              <a className="hover:underline" href={`tel:${c.telefone}`}>{c.telefone}</a>
                            </div>
                          )}
                          {c.email && (
                            <div className="flex items-center gap-1 text-xs">
                              <Mail className="w-3 h-3 text-blue-600" />
                              <a className="hover:underline" href={`mailto:${c.email}`}>{c.email}</a>
                            </div>
                          )}
                        </td>
                        <td className="p-3">
                          <a href={c.url_fonte} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1 max-w-[220px] truncate">
                            <ExternalLink className="w-3 h-3 shrink-0" />
                            <span className="truncate">{new URL(c.url_fonte).hostname}</span>
                          </a>
                        </td>
                        <td className="p-3 text-center">
                          <Badge variant="outline" className="text-[10px]">{c.confianca}%</Badge>
                        </td>
                        <td className="p-3">
                          <Select value={c.status} onValueChange={(v) => marcar(c, v as Status)}>
                            <SelectTrigger className={`h-7 text-xs w-32 ${STATUS_META[c.status]}`}><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {(Object.keys(STATUS_META) as Status[]).map((s) => (
                                <SelectItem key={s} value={s}>{s}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-3 text-right">
                          <Button size="sm" variant="ghost" onClick={() => remover(c)} className="text-rose-600">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Histórico de execuções */}
      {runs.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-muted-foreground" />
              Últimas execuções
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="text-left p-2">Data</th>
                    <th className="text-left p-2">Condomínio</th>
                    <th className="text-left p-2">Status</th>
                    <th className="text-right p-2">Contatos</th>
                    <th className="text-right p-2">Fontes</th>
                    <th className="text-right p-2">Duração</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className="p-2">{new Date(r.created_at).toLocaleString("pt-BR")}</td>
                      <td className="p-2">{r.condominio_nome}</td>
                      <td className="p-2">
                        <Badge variant="outline" className={
                          r.status === "sucesso" ? "border-emerald-300 text-emerald-700" :
                          r.status === "parcial" ? "border-amber-300 text-amber-700" :
                          r.status === "sem_resultados" ? "border-slate-300 text-slate-600" :
                          "border-rose-300 text-rose-700"
                        }>{r.status}</Badge>
                      </td>
                      <td className="p-2 text-right font-medium">{r.contatos_encontrados}</td>
                      <td className="p-2 text-right">{Array.isArray(r.fontes) ? r.fontes.length : 0}</td>
                      <td className="p-2 text-right text-muted-foreground">{r.duracao_ms ? `${(r.duracao_ms / 1000).toFixed(1)}s` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
