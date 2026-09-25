import { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";

import {
  Building2,
  Phone,
  Mail,
  MessageCircle,
  Search,
  ExternalLink,
  Copy,
  CheckCircle2,
  Users,
  Sparkles,
  RotateCcw,
  Database,
  Loader2,
  History,
  Trash2,
  FileDown,
  FileSpreadsheet,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useImobiliariaConfig } from "@/hooks/useImobiliariaConfig";
import { supabase } from "@/integrations/supabase/client";
import { carregarFunilCondominios, exportarFunilCsv, exportarFunilPdf } from "@/lib/exportProspeccaoFunil";
import { HistoricoCondominioDialog } from "./HistoricoCondominioDialog";
import { Eye } from "lucide-react";


type EtapaId = "portaria" | "administradora" | "sindico" | "canais_publicos" | "registro_lgpd";

type Etapa = {
  id: EtapaId;
  titulo: string;
  descricao: string;
  icone: JSX.Element;
};

const ETAPAS: Etapa[] = [
  {
    id: "portaria",
    titulo: "1. Contato com a Portaria",
    descricao: "Ligue ou envie mensagem à portaria para identificar o síndico e a administradora responsável.",
    icone: <Phone className="w-4 h-4 text-primary" />,
  },
  {
    id: "administradora",
    titulo: "2. Contato com a Administradora",
    descricao: "Envie e-mail formal apresentando a parceria e solicitando divulgação autorizada.",
    icone: <Mail className="w-4 h-4 text-primary" />,
  },
  {
    id: "sindico",
    titulo: "3. Contato com o Síndico via WhatsApp",
    descricao: "Aborde o síndico com proposta de parceria e programa de indicação.",
    icone: <MessageCircle className="w-4 h-4 text-green-600" />,
  },
  {
    id: "canais_publicos",
    titulo: "4. Canais Públicos & Grupos",
    descricao: "Busque grupos públicos, páginas do condomínio e menções em portais.",
    icone: <Search className="w-4 h-4 text-primary" />,
  },
  {
    id: "registro_lgpd",
    titulo: "5. Registrar prospecção (LGPD)",
    descricao: "Documente fonte, data e conteúdo abordado para conformidade LGPD.",
    icone: <CheckCircle2 className="w-4 h-4 text-primary" />,
  },
];

const CONDOMINIOS_SUGERIDOS = [
  "Residencial Vida Bela", "Life Park Sul", "Alameda Park Sul", "Alphaville Brasília",
  "Reserva Alphaville", "Bosque Águas Claras", "Terraços Nova Aldeia", "Reserva do Paranoá",
  "Península dos Ministros", "Ilhas do Lago", "Riviera del Sol", "Green Village",
  "Sun Place Sudoeste", "Central Park Sudoeste", "Le Quartier Sudoeste", "Vivendas Park Sul",
  "Vivace Park Sul", "Absoluto Park Sul", "Absolut Guará", "Vila Riacho Guará",
  "Passárgada Águas Claras", "Ilhas Gregas", "Villa Serena Águas Claras", "Verde Morada",
];

type ProspeccaoDB = {
  id: string;
  imobiliaria_id: string;
  condominio_nome: string;
  bairro: string | null;
  cep: string | null;
  endereco: string | null;
  telefone_portaria: string | null;
  telefone_sindico: string | null;
  nome_adm: string | null;
  email_adm: string | null;
  etapas_concluidas: EtapaId[];
  progresso: number;
  status: "em_andamento" | "concluida" | "pausada" | "cancelada";
  created_at: string;
  updated_at: string;
};

type HistoricoEntry = {
  id: string;
  prospeccao_id: string;
  tipo: string;
  etapa: string | null;
  valor_anterior: any;
  valor_novo: any;
  nota: string | null;
  created_at: string;
};

const STORAGE_KEY = "prospeccao_condominios_v1"; // legado (apenas fallback de leitura)

export function ProspeccaoCondominioPanel() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { nome_empresa } = useImobiliariaConfig();
  const nomeCorretor = user?.user_metadata?.nome || user?.email?.split("@")[0] || "Corretor";
  const imobiliaria = nome_empresa || "sua imobiliária parceira";

  const [form, setForm] = useState({
    condominio: "",
    cep: "",
    bairro: "",
    endereco: "",
    telefonePortaria: "",
    emailAdm: "",
    nomeAdm: "",
    telefoneSindico: "",
  });
  const [iniciado, setIniciado] = useState(false);
  const [etapasConcluidas, setEtapasConcluidas] = useState<EtapaId[]>([]);
  const [prospeccaoId, setProspeccaoId] = useState<string | null>(null);
  const [historico, setHistorico] = useState<ProspeccaoDB[]>([]);
  const [logs, setLogs] = useState<HistoricoEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [historicoDialog, setHistoricoDialog] = useState<ProspeccaoDB | null>(null);

  const [baseCondominios, setBaseCondominios] = useState<Array<{
    id: string; nome: string; bairro: string | null; cep: string | null;
    endereco: string | null; cidade: string | null; source: string;
  }>>([]);
  const [totalBase, setTotalBase] = useState<number>(0);
  const [seedLoading, setSeedLoading] = useState(false);
  const [buscaBase, setBuscaBase] = useState("");
  const [filtroCidade, setFiltroCidade] = useState<string>("__all__");
  const [filtroBairro, setFiltroBairro] = useState<string>("__all__");
  const [filtroFonte, setFiltroFonte] = useState<string>("__all__");
  const [somenteComCep, setSomenteComCep] = useState(false);
  const [tolerancia, setTolerancia] = useState<number>(1);

  const carregarBase = async () => {
    const { data, count } = await supabase
      .from("condominios_df")
      .select("id,nome,bairro,cep,endereco,cidade,source", { count: "exact" })
      .order("nome", { ascending: true })
      .limit(2000);
    setBaseCondominios((data as any[]) ?? []);
    setTotalBase(count ?? 0);
  };


  const carregarHistoricoDB = async () => {
    if (!user?.id) return;
    const { data, error } = await supabase
      .from("condominio_prospeccoes")
      .select("*")
      .eq("imobiliaria_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(50);
    if (!error && data) setHistorico(data as ProspeccaoDB[]);
  };

  const carregarLogs = async (id: string) => {
    const { data } = await supabase
      .from("condominio_prospeccao_historico")
      .select("*")
      .eq("prospeccao_id", id)
      .order("created_at", { ascending: false })
      .limit(50);
    setLogs((data as HistoricoEntry[]) ?? []);
  };

  useEffect(() => {
    carregarBase();
    carregarHistoricoDB();
  }, [user?.id]);

  const atualizarBase = async () => {
    setSeedLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("seed-condominios-df");
      if (error) throw error;
      const r = data as { inseridos_osm?: number; inseridos_google?: number; total_base?: number; google_disponivel?: boolean };
      toast({
        title: "Base atualizada",
        description: `OSM: ${r.inseridos_osm ?? 0} • Google: ${r.inseridos_google ?? 0} • Total: ${r.total_base ?? 0}${r.google_disponivel === false ? " (Google Places não conectado)" : ""}`,
      });
      await carregarBase();
    } catch (e: any) {
      toast({ title: "Erro ao atualizar base", description: e.message, variant: "destructive" });
    } finally {
      setSeedLoading(false);
    }
  };

  const normalizar = (s: string) =>
    s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

  const levenshtein = (a: string, b: string): number => {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 0; j <= b.length; j++) dp[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      }
    }
    return dp[a.length][b.length];
  };

  const matchAproximado = (haystack: string, needle: string, tol: number): boolean => {
    if (!needle) return true;
    const h = normalizar(haystack);
    const n = normalizar(needle);
    if (!h) return false;
    if (h.includes(n)) return true;
    if (tol <= 0) return false;
    // token-based: cada token do needle precisa casar (com tolerância) com algum token do haystack
    const hTokens = h.split(/[\s,.\-\/]+/).filter(Boolean);
    const nTokens = n.split(/[\s,.\-\/]+/).filter(Boolean);
    return nTokens.every((nt) =>
      hTokens.some((ht) => {
        if (ht.includes(nt) || nt.includes(ht)) return true;
        const maxLen = Math.max(ht.length, nt.length);
        if (maxLen < 3) return ht === nt;
        return levenshtein(ht, nt) <= Math.min(tol, Math.floor(maxLen / 3));
      })
    );
  };

  const cidadesDisponiveis = useMemo(() => {
    const set = new Set<string>();
    baseCondominios.forEach((c) => c.cidade && set.add(c.cidade));
    return Array.from(set).sort();
  }, [baseCondominios]);

  const bairrosDisponiveis = useMemo(() => {
    const set = new Set<string>();
    baseCondominios
      .filter((c) => filtroCidade === "__all__" || c.cidade === filtroCidade)
      .forEach((c) => c.bairro && set.add(c.bairro));
    return Array.from(set).sort();
  }, [baseCondominios, filtroCidade]);

  const baseFiltrada = useMemo(() => {
    const q = buscaBase.trim();
    const soDigitos = q.replace(/\D/g, "");
    const filtered = baseCondominios.filter((c) => {
      if (filtroCidade !== "__all__" && c.cidade !== filtroCidade) return false;
      if (filtroBairro !== "__all__" && c.bairro !== filtroBairro) return false;
      if (filtroFonte !== "__all__" && c.source !== filtroFonte) return false;
      if (somenteComCep && !(c.cep && c.cep.replace(/\D/g, "").length >= 5)) return false;
      if (!q) return true;
      const cepOk = soDigitos.length >= 3 && (c.cep ?? "").replace(/\D/g, "").includes(soDigitos);
      if (cepOk) return true;
      return (
        matchAproximado(c.nome, q, tolerancia) ||
        matchAproximado(c.bairro ?? "", q, tolerancia) ||
        matchAproximado(c.endereco ?? "", q, tolerancia)
      );
    });
    return filtered.slice(0, 150);
  }, [baseCondominios, buscaBase, filtroCidade, filtroBairro, filtroFonte, somenteComCep, tolerancia]);

  const filtrosAtivos =
    (buscaBase ? 1 : 0) +
    (filtroCidade !== "__all__" ? 1 : 0) +
    (filtroBairro !== "__all__" ? 1 : 0) +
    (filtroFonte !== "__all__" ? 1 : 0) +
    (somenteComCep ? 1 : 0);


  const selecionarDaBase = (c: typeof baseCondominios[number]) => {
    setForm((prev) => ({
      ...prev,
      condominio: c.nome,
      bairro: c.bairro ?? prev.bairro,
      cep: c.cep ?? prev.cep,
      endereco: c.endereco ?? prev.endereco,
    }));
    toast({ title: "Condomínio selecionado", description: c.nome });
  };

  const onlyDigits = (v: string) => v.replace(/\D/g, "");

  const templates = useMemo(() => {
    const cond = form.condominio || "seu condomínio";
    const scriptPortaria = `Olá, boa tarde! Aqui é ${nomeCorretor}, da imobiliária ${imobiliaria}. Estou entrando em contato para saber se posso falar com o síndico do ${cond} ou obter o contato da administradora responsável — gostaríamos de apresentar uma parceria formal e autorizada de divulgação. Poderia me ajudar com essa informação?`;

    const emailAdmSubject = `Parceria de divulgação autorizada — ${cond}`;
    const emailAdmBody = `Olá,

Meu nome é ${nomeCorretor}, atuo pela ${imobiliaria}. Gostaria de apresentar formalmente uma proposta de parceria para atender aos moradores do ${cond} em demandas de venda e locação, respeitando integralmente as normas internas do condomínio e a LGPD.

Nossos diferenciais:
• Avaliação gratuita para moradores indicados pela administração/síndico
• Divulgação com autorização prévia e sinalização de origem
• Repasse de comissão em programa de parceria com síndicos e administradoras

Podemos agendar uma breve conversa para alinhar formatos e materiais aprovados?

Atenciosamente,
${nomeCorretor}
${imobiliaria}`;

    const scriptSindico = `Olá! Aqui é ${nomeCorretor}, da ${imobiliaria}. Fui informado que você é o síndico do ${cond}. Trabalhamos com um programa de parceria com síndicos que inclui avaliação gratuita para moradores, materiais aprovados pelo condomínio e comissionamento por indicação. Poderíamos conversar 5 minutos?`;

    const googleQuery = encodeURIComponent(`"${cond}" ${form.bairro || "Brasília"} moradores OR síndico OR administradora`);
    const facebookQuery = encodeURIComponent(`${cond} moradores`);
    const instagramQuery = encodeURIComponent(cond);

    return {
      scriptPortaria,
      emailAdmSubject,
      emailAdmBody,
      scriptSindico,
      googleUrl: `https://www.google.com/search?q=${googleQuery}`,
      facebookUrl: `https://www.facebook.com/search/groups/?q=${facebookQuery}`,
      instagramUrl: `https://www.instagram.com/explore/tags/${instagramQuery}`,
    };
  }, [form, nomeCorretor, imobiliaria]);

  const copiar = async (texto: string, label: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      toast({ title: `${label} copiado` });
    } catch {
      toast({ title: "Erro ao copiar", variant: "destructive" });
    }
  };

  const iniciar = () => {
    if (!form.condominio.trim()) {
      toast({ title: "Informe o nome do condomínio", variant: "destructive" });
      return;
    }
    setIniciado(true);
    setEtapasConcluidas([]);
  };

  const persistirEtapas = async (novas: EtapaId[], id: string | null) => {
    if (!id || !user?.id) return;
    const prog = Math.round((novas.length / ETAPAS.length) * 100);
    const status = prog === 100 ? "concluida" : "em_andamento";
    const { error } = await supabase
      .from("condominio_prospeccoes")
      .update({ etapas_concluidas: novas, progresso: prog, status })
      .eq("id", id)
      .eq("imobiliaria_id", user.id);
    if (error) {
      toast({ title: "Erro ao salvar etapa", description: error.message, variant: "destructive" });
    } else {
      carregarHistoricoDB();
      carregarLogs(id);
    }
  };

  const toggleEtapa = (id: EtapaId) => {
    setEtapasConcluidas((prev) => {
      const novas = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      persistirEtapas(novas, prospeccaoId);
      return novas;
    });
  };

  const salvarProspeccao = async () => {
    if (!user?.id) {
      toast({ title: "Faça login para salvar", variant: "destructive" });
      return;
    }
    if (!form.condominio.trim()) {
      toast({ title: "Informe o nome do condomínio", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const prog = Math.round((etapasConcluidas.length / ETAPAS.length) * 100);
      const payload = {
        imobiliaria_id: user.id,
        condominio_nome: form.condominio.trim(),
        bairro: form.bairro || null,
        cep: form.cep || null,
        endereco: form.endereco || null,
        telefone_portaria: form.telefonePortaria || null,
        telefone_sindico: form.telefoneSindico || null,
        nome_adm: form.nomeAdm || null,
        email_adm: form.emailAdm || null,
        etapas_concluidas: etapasConcluidas,
        progresso: prog,
        status: (prog === 100 ? "concluida" : "em_andamento") as ProspeccaoDB["status"],
      };
      let id = prospeccaoId;
      if (id) {
        const { error } = await supabase
          .from("condominio_prospeccoes")
          .update(payload)
          .eq("id", id)
          .eq("imobiliaria_id", user.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("condominio_prospeccoes")
          .upsert(payload, { onConflict: "imobiliaria_id,condominio_nome", ignoreDuplicates: false })
          .select("id")
          .single();
        if (error) throw error;
        id = data.id;
        setProspeccaoId(id);
      }
      toast({ title: "Prospecção salva", description: `${form.condominio} persistido no banco.` });
      await carregarHistoricoDB();
      if (id) await carregarLogs(id);
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const excluirProspeccao = async (id: string) => {
    if (!user?.id) return;
    if (!confirm("Excluir esta prospecção e seu histórico?")) return;
    const { error } = await supabase
      .from("condominio_prospeccoes")
      .delete()
      .eq("id", id)
      .eq("imobiliaria_id", user.id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
      return;
    }
    if (prospeccaoId === id) resetar();
    carregarHistoricoDB();
    toast({ title: "Prospecção excluída" });
  };

  const resetar = () => {
    setForm({
      condominio: "", cep: "", bairro: "", endereco: "",
      telefonePortaria: "", emailAdm: "", nomeAdm: "", telefoneSindico: "",
    });
    setEtapasConcluidas([]);
    setIniciado(false);
    setProspeccaoId(null);
    setLogs([]);
  };

  const carregarProspeccao = (h: ProspeccaoDB) => {
    setForm({
      condominio: h.condominio_nome,
      cep: h.cep ?? "",
      bairro: h.bairro ?? "",
      endereco: h.endereco ?? "",
      telefonePortaria: h.telefone_portaria ?? "",
      emailAdm: h.email_adm ?? "",
      nomeAdm: h.nome_adm ?? "",
      telefoneSindico: h.telefone_sindico ?? "",
    });
    setEtapasConcluidas(h.etapas_concluidas || []);
    setProspeccaoId(h.id);
    setIniciado(true);
    carregarLogs(h.id);
  };

  const waLink = (numero: string, texto: string) =>
    `https://wa.me/${onlyDigits(numero) || ""}?text=${encodeURIComponent(texto)}`;

  const progresso = Math.round((etapasConcluidas.length / ETAPAS.length) * 100);

  return (
    <div className="space-y-4">
      {/* Base pública de condomínios (OSM + Google Places) */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Database className="w-4 h-4 text-primary" />
                Base de Condomínios do DF
              </CardTitle>
              <CardDescription>
                Referência pública alimentada por OpenStreetMap e Google Places.
                Busque por nome, bairro, CEP ou endereço e importe direto para o fluxo.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{totalBase} na base</Badge>
              <Button
                size="sm"
                variant="outline"
                onClick={atualizarBase}
                disabled={seedLoading}
                className="gap-1"
              >
                {seedLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                {seedLoading ? "Atualizando..." : "Atualizar base"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={buscaBase}
              onChange={(e) => setBuscaBase(e.target.value)}
              placeholder="Buscar por nome, CEP (ex. 71919), bairro ou endereço..."
              className="pl-9"
            />
          </div>

          <div className="rounded-md border bg-muted/20 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                Filtros avançados
                {filtrosAtivos > 0 && (
                  <Badge variant="secondary" className="text-[10px]">{filtrosAtivos} ativo(s)</Badge>
                )}
              </div>
              {filtrosAtivos > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => {
                    setBuscaBase("");
                    setFiltroCidade("__all__");
                    setFiltroBairro("__all__");
                    setFiltroFonte("__all__");
                    setSomenteComCep(false);
                    setTolerancia(1);
                  }}
                >
                  Limpar
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div>
                <Label className="text-[11px] text-muted-foreground">Cidade / RA</Label>
                <Select value={filtroCidade} onValueChange={(v) => { setFiltroCidade(v); setFiltroBairro("__all__"); }}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Todas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todas as cidades</SelectItem>
                    {cidadesDisponiveis.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">Bairro</Label>
                <Select value={filtroBairro} onValueChange={setFiltroBairro}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todos os bairros</SelectItem>
                    {bairrosDisponiveis.map((b) => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">Fonte</Label>
                <Select value={filtroFonte} onValueChange={setFiltroFonte}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Todas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todas as fontes</SelectItem>
                    <SelectItem value="osm">OpenStreetMap</SelectItem>
                    <SelectItem value="google_places">Google Places</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-[11px] text-muted-foreground">
                    Tolerância de endereço aproximado
                  </Label>
                  <span className="text-[11px] font-medium">
                    {tolerancia === 0 ? "Exato" : tolerancia === 1 ? "Baixa" : tolerancia === 2 ? "Média" : "Alta"}
                  </span>
                </div>
                <Slider
                  value={[tolerancia]}
                  onValueChange={(v) => setTolerancia(v[0] ?? 0)}
                  min={0}
                  max={3}
                  step={1}
                />
              </div>
              <label className="flex items-center gap-2 text-xs cursor-pointer md:justify-end">
                <Checkbox
                  checked={somenteComCep}
                  onCheckedChange={(v) => setSomenteComCep(Boolean(v))}
                />
                Somente com CEP cadastrado
              </label>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Exibindo <strong>{baseFiltrada.length}</strong> de {baseCondominios.length} carregados
              {totalBase > baseCondominios.length ? ` (${totalBase} na base)` : ""}.
            </p>
          </div>

          {totalBase === 0 && (
            <div className="text-xs text-muted-foreground rounded-md border border-dashed p-3">
              A base ainda está vazia. Clique em <strong>Atualizar base</strong> para importar
              condomínios do DF via OpenStreetMap (grátis) e Google Places (se conectado).
            </div>
          )}
          {baseFiltrada.length > 0 && (
            <div className="max-h-72 overflow-y-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/60 text-xs">
                  <tr>
                    <th className="text-left p-2">Nome</th>
                    <th className="text-left p-2">Bairro</th>
                    <th className="text-left p-2">CEP</th>
                    <th className="text-left p-2">Fonte</th>
                    <th className="p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {baseFiltrada.map((c) => (
                    <tr key={c.id} className="border-t hover:bg-muted/30">
                      <td className="p-2 font-medium">{c.nome}</td>
                      <td className="p-2 text-xs text-muted-foreground">{c.bairro || "—"}</td>
                      <td className="p-2 text-xs text-muted-foreground">{c.cep || "—"}</td>
                      <td className="p-2">
                        <Badge variant="outline" className="text-[10px]">
                          {c.source === "osm" ? "OSM" : c.source === "google_places" ? "Google" : "Manual"}
                        </Badge>
                      </td>
                      <td className="p-2 text-right">
                        <Button size="sm" variant="ghost" onClick={() => selecionarDaBase(c)}>
                          Usar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {buscaBase && baseFiltrada.length === 0 && totalBase > 0 && (
            <p className="text-xs text-muted-foreground">
              Nenhum condomínio encontrado para "{buscaBase}". Tente outro termo ou clique em
              <strong> Atualizar base</strong> para importar mais registros.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="border-primary/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" />
            Prospecção de Condomínios — Fluxo Guiado
          </CardTitle>
          <CardDescription>
            Selecione um condomínio e dispare automaticamente as etapas de prospecção
            (portaria, administradora, síndico e canais públicos), com scripts prontos e conformidade LGPD.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="condominio">Condomínio *</Label>
              <Input
                id="condominio"
                list="condominios-sugeridos"
                value={form.condominio}
                onChange={(e) => setForm({ ...form, condominio: e.target.value })}
                placeholder="Ex.: Residencial Vida Bela"
              />
              <datalist id="condominios-sugeridos">
                {CONDOMINIOS_SUGERIDOS.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div>
              <Label htmlFor="bairro">Bairro / RA</Label>
              <Input
                id="bairro"
                value={form.bairro}
                onChange={(e) => setForm({ ...form, bairro: e.target.value })}
                placeholder="Ex.: Águas Claras"
              />
            </div>
            <div>
              <Label htmlFor="cep">CEP</Label>
              <Input
                id="cep"
                value={form.cep}
                onChange={(e) => setForm({ ...form, cep: e.target.value })}
                placeholder="00000-000"
              />
            </div>
            <div>
              <Label htmlFor="endereco">Endereço</Label>
              <Input
                id="endereco"
                value={form.endereco}
                onChange={(e) => setForm({ ...form, endereco: e.target.value })}
                placeholder="Rua / Quadra"
              />
            </div>
            <div>
              <Label htmlFor="tel-portaria">Telefone da portaria (opcional)</Label>
              <Input
                id="tel-portaria"
                value={form.telefonePortaria}
                onChange={(e) => setForm({ ...form, telefonePortaria: e.target.value })}
                placeholder="(61) 90000-0000"
              />
            </div>
            <div>
              <Label htmlFor="tel-sindico">WhatsApp do síndico (opcional)</Label>
              <Input
                id="tel-sindico"
                value={form.telefoneSindico}
                onChange={(e) => setForm({ ...form, telefoneSindico: e.target.value })}
                placeholder="(61) 90000-0000"
              />
            </div>
            <div>
              <Label htmlFor="nome-adm">Nome da administradora (opcional)</Label>
              <Input
                id="nome-adm"
                value={form.nomeAdm}
                onChange={(e) => setForm({ ...form, nomeAdm: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="email-adm">E-mail da administradora (opcional)</Label>
              <Input
                id="email-adm"
                type="email"
                value={form.emailAdm}
                onChange={(e) => setForm({ ...form, emailAdm: e.target.value })}
                placeholder="contato@administradora.com.br"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={iniciar} className="gap-2">
              <Sparkles className="w-4 h-4" />
              Iniciar prospecção
            </Button>
            {iniciado && (
              <>
                <Button variant="outline" onClick={salvarProspeccao} disabled={saving} className="gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {prospeccaoId ? "Atualizar" : "Salvar"} no banco
                </Button>
                <Button variant="ghost" onClick={resetar} className="gap-2">
                  <RotateCcw className="w-4 h-4" />
                  Nova prospecção
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {iniciado && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                Etapas de prospecção — {form.condominio}
              </CardTitle>
              <Badge variant={progresso === 100 ? "default" : "secondary"}>
                {etapasConcluidas.length}/{ETAPAS.length} — {progresso}%
              </Badge>
            </div>
            <div className="w-full h-1.5 rounded-full bg-muted mt-2 overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${progresso}%` }}
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {ETAPAS.map((etapa) => {
              const done = etapasConcluidas.includes(etapa.id);
              return (
                <div
                  key={etapa.id}
                  className={`rounded-lg border p-3 space-y-3 transition-colors ${
                    done ? "border-primary/40 bg-primary/5" : "border-border"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      {etapa.icone}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{etapa.titulo}</p>
                        <p className="text-xs text-muted-foreground">{etapa.descricao}</p>
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <Checkbox checked={done} onCheckedChange={() => toggleEtapa(etapa.id)} />
                      Concluída
                    </label>
                  </div>

                  {etapa.id === "portaria" && (
                    <div className="space-y-2">
                      <Textarea
                        readOnly
                        value={templates.scriptPortaria}
                        className="text-xs min-h-[80px]"
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copiar(templates.scriptPortaria, "Script")}
                          className="gap-1"
                        >
                          <Copy className="w-3 h-3" /> Copiar script
                        </Button>
                        {form.telefonePortaria && (
                          <>
                            <a href={`tel:${onlyDigits(form.telefonePortaria)}`}>
                              <Button size="sm" variant="secondary" className="gap-1">
                                <Phone className="w-3 h-3" /> Ligar
                              </Button>
                            </a>
                            <a
                              href={waLink(form.telefonePortaria, templates.scriptPortaria)}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Button size="sm" className="gap-1 bg-green-600 hover:bg-green-700">
                                <MessageCircle className="w-3 h-3" /> WhatsApp
                              </Button>
                            </a>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {etapa.id === "administradora" && (
                    <div className="space-y-2">
                      <Input readOnly value={templates.emailAdmSubject} className="text-xs" />
                      <Textarea
                        readOnly
                        value={templates.emailAdmBody}
                        className="text-xs min-h-[120px]"
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copiar(templates.emailAdmBody, "E-mail")}
                          className="gap-1"
                        >
                          <Copy className="w-3 h-3" /> Copiar e-mail
                        </Button>
                        <a
                          href={`mailto:${form.emailAdm}?subject=${encodeURIComponent(
                            templates.emailAdmSubject
                          )}&body=${encodeURIComponent(templates.emailAdmBody)}`}
                        >
                          <Button size="sm" variant="secondary" className="gap-1">
                            <Mail className="w-3 h-3" /> Abrir e-mail
                          </Button>
                        </a>
                      </div>
                    </div>
                  )}

                  {etapa.id === "sindico" && (
                    <div className="space-y-2">
                      <Textarea
                        readOnly
                        value={templates.scriptSindico}
                        className="text-xs min-h-[80px]"
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copiar(templates.scriptSindico, "Mensagem")}
                          className="gap-1"
                        >
                          <Copy className="w-3 h-3" /> Copiar mensagem
                        </Button>
                        {form.telefoneSindico && (
                          <a
                            href={waLink(form.telefoneSindico, templates.scriptSindico)}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Button size="sm" className="gap-1 bg-green-600 hover:bg-green-700">
                              <MessageCircle className="w-3 h-3" /> WhatsApp síndico
                            </Button>
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  {etapa.id === "canais_publicos" && (
                    <div className="flex flex-wrap gap-2">
                      <a href={templates.googleUrl} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="outline" className="gap-1">
                          <Search className="w-3 h-3" /> Google
                          <ExternalLink className="w-3 h-3" />
                        </Button>
                      </a>
                      <a href={templates.facebookUrl} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="outline" className="gap-1">
                          <Users className="w-3 h-3" /> Grupos Facebook
                          <ExternalLink className="w-3 h-3" />
                        </Button>
                      </a>
                      <a href={templates.instagramUrl} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="outline" className="gap-1">
                          <Search className="w-3 h-3" /> Instagram
                          <ExternalLink className="w-3 h-3" />
                        </Button>
                      </a>
                    </div>
                  )}

                  {etapa.id === "registro_lgpd" && (
                    <div className="text-xs text-muted-foreground space-y-1 rounded-md bg-muted/40 p-2">
                      <p>
                        ✅ Registre no CRM: origem "Prospecção condomínio", data,
                        canal utilizado (portaria/adm/síndico) e conteúdo abordado.
                      </p>
                      <p>
                        ✅ Somente contatar pessoas físicas mediante autorização
                        explícita do síndico/administradora ou fontes públicas.
                      </p>
                      <p>
                        ✅ O histórico local abaixo mantém rastreabilidade das etapas.
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {prospeccaoId && logs.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <History className="w-4 h-4 text-primary" /> Histórico de mudanças
            </CardTitle>
            <CardDescription>Auditoria automática de alterações desta prospecção.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 max-h-72 overflow-y-auto">
              {logs.map((l) => {
                const when = new Date(l.created_at).toLocaleString("pt-BR");
                let label = l.tipo;
                if (l.tipo === "criacao") label = "Prospecção criada";
                else if (l.tipo === "status") label = `Status: ${l.valor_anterior ?? "—"} → ${l.valor_novo}`;
                else if (l.tipo === "etapa_concluida") label = `Etapas concluídas: ${(l.valor_novo || []).join(", ")}`;
                else if (l.tipo === "etapa_removida") label = `Etapas desmarcadas: ${(l.valor_anterior || []).join(", ")}`;
                return (
                  <li key={l.id} className="text-xs border-l-2 border-primary/40 pl-2">
                    <span className="text-muted-foreground">{when}</span> — {label}
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      {historico.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <CardTitle className="text-base">Histórico de prospecções</CardTitle>
                <CardDescription>Persistido no banco — acessível de qualquer dispositivo.</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  onClick={async () => {
                    if (!user) return;
                    const rows = await carregarFunilCondominios(user.id);
                    if (!rows.length) return toast({ title: "Sem dados para exportar" });
                    exportarFunilCsv(rows);
                    toast({ title: "CSV exportado", description: `${rows.length} condomínio(s)` });
                  }}
                >
                  <FileSpreadsheet className="w-3 h-3" /> CSV
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  onClick={async () => {
                    if (!user) return;
                    const rows = await carregarFunilCondominios(user.id);
                    if (!rows.length) return toast({ title: "Sem dados para exportar" });
                    exportarFunilPdf(rows);
                    toast({ title: "PDF exportado", description: `${rows.length} condomínio(s)` });
                  }}
                >
                  <FileDown className="w-3 h-3" /> PDF
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {historico.map((h) => {
                const prog = h.progresso ?? Math.round(((h.etapas_concluidas?.length || 0) / ETAPAS.length) * 100);
                return (
                  <div
                    key={h.id}
                    className={`p-3 rounded-lg border transition-colors ${
                      prospeccaoId === h.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <button
                        onClick={() => carregarProspeccao(h)}
                        className="text-left flex-1 min-w-0"
                      >
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{h.condominio_nome}</p>
                          <Badge variant={prog === 100 ? "default" : "secondary"} className="text-[10px]">
                            {prog}%
                          </Badge>
                          <Badge variant="outline" className="text-[10px] capitalize">
                            {h.status.replace("_", " ")}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {h.bairro || "—"} • atualizado {new Date(h.updated_at).toLocaleDateString("pt-BR")}
                        </p>
                      </button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setHistoricoDialog(h)}
                        className="h-7 w-7"
                        title="Ver histórico completo"
                      >
                        <Eye className="w-3 h-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => excluirProspeccao(h.id)}
                        className="h-7 w-7 text-destructive"
                        title="Excluir"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>

                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <HistoricoCondominioDialog
        open={!!historicoDialog}
        onOpenChange={(v) => !v && setHistoricoDialog(null)}
        prospeccao={historicoDialog as any}
        etapas={ETAPAS.map((e) => ({ id: e.id, titulo: e.titulo, descricao: e.descricao }))}
      />
    </div>
  );
}

