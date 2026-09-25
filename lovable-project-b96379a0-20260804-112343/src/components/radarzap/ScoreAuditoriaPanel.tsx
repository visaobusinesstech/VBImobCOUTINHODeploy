import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  Loader2,
  RefreshCw,
  Search,
  Gauge,
  CheckCircle2,
  XCircle,
  Info,
  Copy,
  Star,
} from "lucide-react";

type Lead = {
  id: string;
  score: number;
  score_detalhes: Record<string, number> | null;
  dedup_group_id: string | null;
  dedup_key: string | null;
  is_principal: boolean;
  status: string;
  operacao: string | null;
  tipo_imovel: string | null;
  contato: string | null;
  bairro: string | null;
  cidade: string | null;
  preco: number | null;
  proprietario_nome: string | null;
  created_at: string;
};

type Cfg = {
  peso_operacao: number;
  peso_contato_bom: number;
  peso_contato_parcial: number;
  peso_preco: number;
  peso_bairro: number;
  peso_cidade: number;
  peso_proprietario: number;
  peso_tipo: number;
  min_score_principal: number;
};

const DEFAULT_CFG: Cfg = {
  peso_operacao: 30,
  peso_contato_bom: 25,
  peso_contato_parcial: 10,
  peso_preco: 15,
  peso_bairro: 15,
  peso_cidade: 7,
  peso_proprietario: 10,
  peso_tipo: 5,
  min_score_principal: 40,
};

type FatorKey =
  | "operacao"
  | "contato"
  | "preco"
  | "bairro"
  | "cidade"
  | "proprietario"
  | "tipo";

const FATORES: {
  key: FatorKey;
  label: string;
  descricao: (l: Lead, c: Cfg) => string;
  pesoMax: (c: Cfg) => number;
}[] = [
  {
    key: "operacao",
    label: "Operação",
    descricao: (l) =>
      `Operação declarada: ${l.operacao || "—"} (aceitos: venda/aluguel/temporada)`,
    pesoMax: (c) => c.peso_operacao,
  },
  {
    key: "contato",
    label: "Contato",
    descricao: (l, c) => {
      const dig = (l.contato || "").replace(/\D/g, "");
      if (dig.length >= 10) return `Telefone completo (${dig.length} dígitos) → +${c.peso_contato_bom}`;
      if (dig.length >= 8) return `Telefone parcial (${dig.length} dígitos) → +${c.peso_contato_parcial}`;
      return `Sem telefone válido (${dig.length} dígitos)`;
    },
    pesoMax: (c) => c.peso_contato_bom,
  },
  {
    key: "preco",
    label: "Preço",
    descricao: (l) => (l.preco ? `Preço informado: R$ ${l.preco.toLocaleString("pt-BR")}` : "Sem preço"),
    pesoMax: (c) => c.peso_preco,
  },
  {
    key: "bairro",
    label: "Bairro",
    descricao: (l) => (l.bairro ? `Bairro: ${l.bairro}` : "Sem bairro (fallback para cidade)"),
    pesoMax: (c) => c.peso_bairro,
  },
  {
    key: "cidade",
    label: "Cidade",
    descricao: (l) =>
      l.bairro
        ? `Cidade ignorada (bairro presente contou)`
        : l.cidade
        ? `Cidade: ${l.cidade}`
        : "Sem cidade",
    pesoMax: (c) => c.peso_cidade,
  },
  {
    key: "proprietario",
    label: "Proprietário",
    descricao: (l) =>
      l.proprietario_nome ? `Nome: ${l.proprietario_nome}` : "Nome do proprietário ausente",
    pesoMax: (c) => c.peso_proprietario,
  },
  {
    key: "tipo",
    label: "Tipo do imóvel",
    descricao: (l) => (l.tipo_imovel ? `Tipo: ${l.tipo_imovel}` : "Tipo do imóvel ausente"),
    pesoMax: (c) => c.peso_tipo,
  },
];

export default function ScoreAuditoriaPanel() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [cfg, setCfg] = useState<Cfg>(DEFAULT_CFG);
  const [busca, setBusca] = useState("");
  const [expandido, setExpandido] = useState<Set<string>>(new Set());

  const carregar = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [{ data: leadsData, error: e1 }, { data: cfgData }] = await Promise.all([
        supabase
          .from("radarzap_leads")
          .select(
            "id,score,score_detalhes,dedup_group_id,dedup_key,is_principal,status,operacao,tipo_imovel,contato,bairro,cidade,preco,proprietario_nome,created_at"
          )
          .eq("imobiliaria_id", user.id)
          .order("created_at", { ascending: false })
          .limit(500),
        supabase
          .from("radarzap_scoring_config")
          .select("*")
          .eq("imobiliaria_id", user.id)
          .maybeSingle(),
      ]);
      if (e1) throw e1;
      setLeads((leadsData as Lead[]) || []);
      if (cfgData) setCfg({ ...DEFAULT_CFG, ...(cfgData as any) });
    } catch (e: any) {
      toast.error("Falha ao carregar", { description: e.message });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const grupos = useMemo(() => {
    const m = new Map<string, Lead[]>();
    for (const l of leads) {
      if (!l.dedup_group_id) continue;
      const arr = m.get(l.dedup_group_id) || [];
      arr.push(l);
      m.set(l.dedup_group_id, arr);
    }
    return m;
  }, [leads]);

  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter(
      (l) =>
        (l.proprietario_nome || "").toLowerCase().includes(q) ||
        (l.contato || "").toLowerCase().includes(q) ||
        (l.bairro || "").toLowerCase().includes(q) ||
        (l.cidade || "").toLowerCase().includes(q) ||
        (l.dedup_key || "").toLowerCase().includes(q)
    );
  }, [leads, busca]);

  const toggle = (id: string) =>
    setExpandido((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gauge className="h-5 w-5" /> Auditoria de Score & Dedup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Buscar por nome, contato, bairro, cidade, dedup_key…"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
            <Button size="sm" variant="outline" onClick={carregar} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>
          <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
            <span>Score mínimo para virar principal e ir ao pipeline: <b>{cfg.min_score_principal}</b></span>
            <span>Pesos vigentes — op:{cfg.peso_operacao} · cont:{cfg.peso_contato_bom}/{cfg.peso_contato_parcial} · preço:{cfg.peso_preco} · bairro:{cfg.peso_bairro} · cidade:{cfg.peso_cidade} · prop:{cfg.peso_proprietario} · tipo:{cfg.peso_tipo}</span>
          </div>
        </CardContent>
      </Card>

      {loading && leads.length === 0 && (
        <div className="text-center text-sm text-muted-foreground py-8">
          <Loader2 className="h-5 w-5 inline animate-spin mr-2" /> Carregando…
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Nenhum lead encontrado.
          </CardContent>
        </Card>
      )}

      {filtered.map((l) => {
        const det = l.score_detalhes || {};
        const total = Object.values(det).reduce((s, v) => s + (v || 0), 0);
        const passou = l.score >= cfg.min_score_principal;
        const gLeads = l.dedup_group_id ? grupos.get(l.dedup_group_id) || [] : [];
        const principalDoGrupo = gLeads.find((x) => x.is_principal);
        const isOpen = expandido.has(l.id);
        return (
          <Card key={l.id}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">
                      {l.proprietario_nome || "Sem nome"}
                    </span>
                    <Badge variant="outline">{l.status}</Badge>
                    {l.is_principal && (
                      <Badge className="bg-primary text-primary-foreground">
                        <Star className="h-3 w-3 mr-1" />
                        Principal
                      </Badge>
                    )}
                    <Badge className={passou ? "bg-emerald-600" : "bg-amber-600"}>
                      {passou ? (
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                      ) : (
                        <XCircle className="h-3 w-3 mr-1" />
                      )}
                      score {l.score} / mín {cfg.min_score_principal}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3">
                    <span>{l.operacao || "—"} · {l.tipo_imovel || "—"}</span>
                    <span>{l.bairro || "—"}{l.cidade ? ` · ${l.cidade}` : ""}</span>
                    <span>Contato: {l.contato || "—"}</span>
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => toggle(l.id)}>
                  {isOpen ? "Ocultar" : "Detalhar"}
                </Button>
              </div>
            </CardHeader>
            {isOpen && (
              <CardContent className="space-y-3">
                <div>
                  <div className="text-xs font-medium mb-1">Composição do score</div>
                  <div className="space-y-1.5">
                    {FATORES.map((f) => {
                      const aplicado = det[f.key] || 0;
                      const max = f.pesoMax(cfg);
                      const pct = max ? Math.min(100, (aplicado / max) * 100) : 0;
                      return (
                        <div key={f.key} className="text-xs">
                          <div className="flex items-center justify-between">
                            <span>
                              <b>{f.label}</b> — {f.descricao(l, cfg)}
                            </span>
                            <span className={aplicado > 0 ? "text-emerald-600" : "text-muted-foreground"}>
                              {aplicado > 0 ? `+${aplicado}` : "0"} / {max}
                            </span>
                          </div>
                          <Progress value={pct} className="h-1.5 mt-0.5" />
                        </div>
                      );
                    })}
                  </div>
                  <div className="text-xs text-muted-foreground mt-2">
                    Soma auditada: <b>{total}</b> · Score final gravado (limitado a 100): <b>{l.score}</b>
                  </div>
                </div>

                <div className="border-t pt-2">
                  <div className="text-xs font-medium mb-1 flex items-center gap-1">
                    <Info className="h-3 w-3" /> Decisão de deduplicação
                  </div>
                  <div className="text-xs space-y-1">
                    <div>
                      <b>dedup_key:</b>{" "}
                      <code
                        className="cursor-pointer hover:underline"
                        onClick={() => {
                          navigator.clipboard.writeText(l.dedup_key || "");
                          toast.success("Chave copiada");
                        }}
                      >
                        {l.dedup_key || "—"}
                      </code>{" "}
                      <Copy className="h-3 w-3 inline text-muted-foreground" />
                    </div>
                    <div>
                      <b>Grupo:</b> {l.dedup_group_id ? l.dedup_group_id.slice(0, 8) + "…" : "—"} ·{" "}
                      {gLeads.length} registro(s)
                    </div>
                    {principalDoGrupo && principalDoGrupo.id !== l.id && (
                      <div className="text-muted-foreground">
                        Não é principal porque{" "}
                        <b>{principalDoGrupo.proprietario_nome || "outro registro"}</b> do mesmo
                        grupo tem score maior ({principalDoGrupo.score} ≥ {l.score}).
                      </div>
                    )}
                    <div className={passou ? "text-emerald-700" : "text-amber-700"}>
                      {passou
                        ? l.is_principal
                          ? "✓ Passou no mínimo e é principal → foi enviado ao pipeline de captação."
                          : "Passa no mínimo, mas não é principal do grupo → considerado sinal duplicado."
                        : "✗ Score abaixo do mínimo → não vira card no pipeline (fica em Aprovações / Leads)."}
                    </div>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
