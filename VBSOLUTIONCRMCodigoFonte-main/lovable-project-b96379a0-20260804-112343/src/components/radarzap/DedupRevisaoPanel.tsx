import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Loader2,
  Split,
  Merge,
  Star,
  StarOff,
  Search,
  RefreshCw,
  Copy,
} from "lucide-react";

type LeadRow = {
  id: string;
  dedup_group_id: string | null;
  dedup_key: string | null;
  is_principal: boolean;
  score: number;
  status: string;
  tipo_imovel: string | null;
  operacao: string | null;
  bairro: string | null;
  cidade: string | null;
  preco: number | null;
  contato: string | null;
  proprietario_nome: string | null;
  resumo: string | null;
  created_at: string;
  grupo_id: string | null;
};

type Grupo = { id: string; nome: string | null; cidade: string | null };

const brl = (v: number | null) =>
  v == null
    ? "—"
    : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function DedupRevisaoPanel() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [grupos, setGrupos] = useState<Record<string, Grupo>>({});
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [busca, setBusca] = useState("");
  const [somenteDuplicados, setSomenteDuplicados] = useState(true);

  const carregar = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("radarzap_leads")
        .select(
          "id,dedup_group_id,dedup_key,is_principal,score,status,tipo_imovel,operacao,bairro,cidade,preco,contato,proprietario_nome,resumo,created_at,grupo_id"
        )
        .eq("imobiliaria_id", user.id)
        .order("dedup_group_id", { ascending: true })
        .order("is_principal", { ascending: false })
        .order("score", { ascending: false })
        .limit(1000);
      if (error) throw error;
      setLeads((data as LeadRow[]) || []);
      const gids = Array.from(
        new Set((data || []).map((l: any) => l.grupo_id).filter(Boolean))
      );
      if (gids.length) {
        const { data: gs } = await supabase
          .from("radarzap_grupos")
          .select("id,nome,cidade")
          .in("id", gids);
        const map: Record<string, Grupo> = {};
        (gs || []).forEach((g: any) => (map[g.id] = g));
        setGrupos(map);
      } else {
        setGrupos({});
      }
    } catch (e: any) {
      toast.error("Falha ao carregar", { description: e.message });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const grupos_dedup = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const filtered = leads.filter((l) => {
      if (!q) return true;
      return (
        (l.proprietario_nome || "").toLowerCase().includes(q) ||
        (l.contato || "").toLowerCase().includes(q) ||
        (l.bairro || "").toLowerCase().includes(q) ||
        (l.cidade || "").toLowerCase().includes(q) ||
        (l.dedup_key || "").toLowerCase().includes(q)
      );
    });
    const buckets = new Map<string, LeadRow[]>();
    for (const l of filtered) {
      const key = l.dedup_group_id || `sem-grupo:${l.id}`;
      const arr = buckets.get(key) || [];
      arr.push(l);
      buckets.set(key, arr);
    }
    let entries = Array.from(buckets.entries()).map(([k, v]) => ({
      key: k,
      leads: v,
    }));
    if (somenteDuplicados) entries = entries.filter((e) => e.leads.length > 1);
    entries.sort((a, b) => b.leads.length - a.leads.length);
    return entries;
  }, [leads, busca, somenteDuplicados]);

  const toggle = (id: string) => {
    setSelecionados((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const definirPrincipal = async (grupoLeads: LeadRow[], leadId: string) => {
    setSaving(true);
    try {
      const ids = grupoLeads.map((l) => l.id);
      const { error: e1 } = await supabase
        .from("radarzap_leads")
        .update({ is_principal: false })
        .in("id", ids);
      if (e1) throw e1;
      const { error: e2 } = await supabase
        .from("radarzap_leads")
        .update({ is_principal: true })
        .eq("id", leadId);
      if (e2) throw e2;
      toast.success("Principal atualizado");
      await carregar();
    } catch (e: any) {
      toast.error("Falha ao atualizar", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const separar = async (lead: LeadRow) => {
    setSaving(true);
    try {
      const novoGrupo = crypto.randomUUID();
      const { error } = await supabase
        .from("radarzap_leads")
        .update({
          dedup_group_id: novoGrupo,
          is_principal: true,
          revisao_notas: `Separado manualmente em ${new Date().toISOString()}`,
        })
        .eq("id", lead.id);
      if (error) throw error;
      toast.success("Lead separado em novo grupo");
      await carregar();
    } catch (e: any) {
      toast.error("Falha ao separar", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const mesclarSelecionados = async () => {
    if (selecionados.size < 2) {
      toast.warning("Selecione ao menos 2 leads para mesclar");
      return;
    }
    setSaving(true);
    try {
      const ids = Array.from(selecionados);
      const selLeads = leads.filter((l) => ids.includes(l.id));
      const grupoAlvo =
        selLeads.find((l) => l.dedup_group_id)?.dedup_group_id ||
        crypto.randomUUID();
      const principal = selLeads
        .slice()
        .sort((a, b) => (b.score || 0) - (a.score || 0))[0];

      const { error: e1 } = await supabase
        .from("radarzap_leads")
        .update({ dedup_group_id: grupoAlvo, is_principal: false })
        .in("id", ids);
      if (e1) throw e1;
      const { error: e2 } = await supabase
        .from("radarzap_leads")
        .update({ is_principal: true })
        .eq("id", principal.id);
      if (e2) throw e2;
      toast.success(`Mesclados ${ids.length} leads`);
      setSelecionados(new Set());
      await carregar();
    } catch (e: any) {
      toast.error("Falha ao mesclar", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Merge className="h-5 w-5" /> Revisão de deduplicação
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Buscar por nome, contato, bairro, cidade, dedup_key…"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={somenteDuplicados}
                onCheckedChange={(v) => setSomenteDuplicados(!!v)}
              />
              Somente grupos com duplicados
            </label>
            <Button variant="outline" size="sm" onClick={carregar} disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
            <Button
              size="sm"
              onClick={mesclarSelecionados}
              disabled={saving || selecionados.size < 2}
            >
              <Merge className="h-4 w-4 mr-1" />
              Mesclar selecionados ({selecionados.size})
            </Button>
          </div>
          <div className="text-xs text-muted-foreground">
            {grupos_dedup.length} grupo(s) exibido(s). Marque leads de grupos
            diferentes para mesclar em um só, ou use "Separar" para tirar um
            registro do grupo atual.
          </div>
        </CardContent>
      </Card>

      {loading && grupos_dedup.length === 0 && (
        <div className="text-center text-sm text-muted-foreground py-8">
          <Loader2 className="h-5 w-5 animate-spin inline-block mr-2" />
          Carregando…
        </div>
      )}

      {!loading && grupos_dedup.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Nenhum grupo de duplicidade encontrado.
          </CardContent>
        </Card>
      )}

      {grupos_dedup.map(({ key, leads: gLeads }) => (
        <Card key={key}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">Grupo</Badge>
                <code
                  className="text-xs cursor-pointer hover:underline"
                  onClick={() => {
                    navigator.clipboard.writeText(key);
                    toast.success("ID copiado");
                  }}
                  title="Copiar ID do grupo"
                >
                  {key.slice(0, 8)}…
                </code>
                <Copy className="h-3 w-3 text-muted-foreground" />
                <Badge>{gLeads.length} registro(s)</Badge>
                {gLeads[0]?.dedup_key && (
                  <Badge variant="outline">chave: {gLeads[0].dedup_key}</Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {gLeads.map((l) => {
              const grupo = l.grupo_id ? grupos[l.grupo_id] : null;
              return (
                <div
                  key={l.id}
                  className={`border rounded-md p-3 flex flex-col md:flex-row md:items-start gap-3 ${
                    l.is_principal ? "border-primary/60 bg-primary/5" : ""
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={selecionados.has(l.id)}
                      onCheckedChange={() => toggle(l.id)}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">
                        {l.proprietario_nome || "Sem nome"}
                      </span>
                      {l.is_principal && (
                        <Badge className="bg-primary text-primary-foreground">
                          <Star className="h-3 w-3 mr-1" />
                          Principal
                        </Badge>
                      )}
                      <Badge variant="outline">score {l.score}</Badge>
                      <Badge variant="outline">{l.status}</Badge>
                      {l.operacao && <Badge variant="secondary">{l.operacao}</Badge>}
                      {l.tipo_imovel && <Badge variant="secondary">{l.tipo_imovel}</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1">
                      <span>Contato: {l.contato || "—"}</span>
                      <span>
                        Local: {l.bairro || "—"}
                        {l.cidade ? ` · ${l.cidade}` : ""}
                      </span>
                      <span>Preço: {brl(l.preco)}</span>
                      {grupo && (
                        <span>
                          Grupo WhatsApp: {grupo.nome || "—"}
                          {grupo.cidade ? ` · ${grupo.cidade}` : ""}
                        </span>
                      )}
                      <span>
                        Criado em{" "}
                        {new Date(l.created_at).toLocaleString("pt-BR")}
                      </span>
                    </div>
                    {l.resumo && (
                      <div className="text-xs mt-2 line-clamp-2">{l.resumo}</div>
                    )}
                  </div>
                  <div className="flex md:flex-col gap-2">
                    {!l.is_principal && gLeads.length > 1 && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={saving}
                        onClick={() => definirPrincipal(gLeads, l.id)}
                      >
                        <Star className="h-3 w-3 mr-1" />
                        Definir principal
                      </Button>
                    )}
                    {gLeads.length > 1 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={saving}
                        onClick={() => separar(l)}
                      >
                        <Split className="h-3 w-3 mr-1" />
                        Separar
                      </Button>
                    )}
                    {l.is_principal && gLeads.length > 1 && (
                      <span className="text-xs text-muted-foreground flex items-center">
                        <StarOff className="h-3 w-3 mr-1" />
                        Escolha outro para trocar
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
