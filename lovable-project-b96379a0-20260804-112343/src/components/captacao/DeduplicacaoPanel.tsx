import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Users, Merge, EyeOff, RefreshCw, Star, Search, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useDedupGroups, pickAutoMaster, completenessScore,
  type DedupGroup,
} from "@/hooks/useDedupGroups";

function fmtPhone(e164: string) {
  // +5561999998888 → +55 (61) 99999-8888
  const m = e164.match(/^\+55(\d{2})(\d{4,5})(\d{4})$/);
  if (!m) return e164;
  return `+55 (${m[1]}) ${m[2]}-${m[3]}`;
}

function GroupCard({
  group,
  onMerge,
  onIgnore,
}: {
  group: DedupGroup;
  onMerge: (masterId: string, duplicateIds: string[]) => Promise<void>;
  onIgnore: (telefoneE164: string) => Promise<void>;
}) {
  const auto = useMemo(() => pickAutoMaster(group.registros), [group]);
  const [masterId, setMasterId] = useState<string>(auto);
  const [busy, setBusy] = useState(false);

  const dupIds = group.registros.filter((r) => r.id !== masterId).map((r) => r.id);

  return (
    <Card className="border-amber-200/60">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono">{fmtPhone(group.telefone_e164)}</Badge>
            <Badge variant="secondary">{group.total} registros</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try { await onIgnore(group.telefone_e164); } finally { setBusy(false); }
              }}
            >
              <EyeOff className="w-4 h-4 mr-1" /> Ignorar grupo
            </Button>
            <Button
              size="sm"
              disabled={busy || dupIds.length === 0}
              onClick={async () => {
                setBusy(true);
                try { await onMerge(masterId, dupIds); } finally { setBusy(false); }
              }}
            >
              {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Merge className="w-4 h-4 mr-1" />}
              Mesclar {dupIds.length} no mestre
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {group.registros.map((r) => {
          const isMaster = r.id === masterId;
          const isAuto = r.id === auto;
          return (
            <label
              key={r.id}
              className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer transition ${
                isMaster ? "border-primary bg-primary/5" : "hover:bg-muted/40"
              }`}
            >
              <input
                type="radio"
                name={`master-${group.telefone_e164}`}
                className="mt-1"
                checked={isMaster}
                onChange={() => setMasterId(r.id)}
              />
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium truncate">{r.nome_proprietario || "(sem nome)"}</span>
                  {isMaster && (
                    <Badge className="gap-1"><Star className="w-3 h-3" /> Mestre</Badge>
                  )}
                  {isAuto && !isMaster && (
                    <Badge variant="outline">Sugerido</Badge>
                  )}
                  {r.operacao && <Badge variant="secondary">{r.operacao}</Badge>}
                  <span className="text-xs text-muted-foreground">
                    {completenessScore(r)} campos preenchidos
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1">
                  {r.telefone && <span>Tel: {r.telefone}</span>}
                  {r.email && <span>E-mail: {r.email}</span>}
                  {r.cidade && <span>Cidade: {r.cidade}</span>}
                  {r.bairro && <span>Bairro: {r.bairro}</span>}
                  {r.origem && <span>Origem: {r.origem}</span>}
                  <span>Captado em: {new Date(r.created_at).toLocaleDateString("pt-BR")}</span>
                </div>
                {r.url_anuncio && (
                  <a
                    href={r.url_anuncio}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline break-all"
                  >
                    {r.url_anuncio}
                  </a>
                )}
              </div>
              {!isMaster && (
                <div className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
                  <Trash2 className="w-3 h-3" /> será removido
                </div>
              )}
            </label>
          );
        })}
      </CardContent>
    </Card>
  );
}

export function DeduplicacaoPanel() {
  const { toast } = useToast();
  const { groups, loading, refetch, merge, ignore } = useDedupGroups();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) => {
      if (g.telefone_e164.toLowerCase().includes(q)) return true;
      return g.registros.some((r) =>
        (r.nome_proprietario || "").toLowerCase().includes(q) ||
        (r.cidade || "").toLowerCase().includes(q) ||
        (r.bairro || "").toLowerCase().includes(q) ||
        (r.email || "").toLowerCase().includes(q)
      );
    });
  }, [groups, query]);

  const totalDup = groups.reduce((acc, g) => acc + (g.total - 1), 0);

  const handleMerge = async (masterId: string, duplicateIds: string[]) => {
    try {
      const res = await merge(masterId, duplicateIds);
      toast({
        title: "Mesclagem concluída",
        description: `${res.deleted} duplicado(s) removido(s). Mestre mantido com dados consolidados.`,
      });
      await refetch();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Falha ao mesclar";
      toast({ title: "Erro ao mesclar", description: message, variant: "destructive" });
    }
  };

  const handleIgnore = async (telefone: string) => {
    try {
      await ignore(telefone);
      toast({ title: "Grupo ignorado", description: "Este grupo não aparecerá mais na lista." });
      await refetch();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Falha ao ignorar";
      toast({ title: "Erro", description: message, variant: "destructive" });
    }
  };

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="w-5 h-5 text-primary" />
              Deduplicação por Telefone
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Grupos de proprietários captados que compartilham o mesmo telefone (normalizado para E.164).
              {groups.length > 0 && (
                <> <b>{groups.length}</b> grupo(s), <b>{totalDup}</b> registro(s) duplicado(s) removíveis.</>
              )}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={refetch} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}
            Recarregar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nome, telefone, cidade, bairro ou e-mail..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {loading && (
          <div className="text-center py-10 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
            Analisando duplicados...
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-10 text-muted-foreground text-sm">
            {groups.length === 0
              ? "Nenhum grupo de duplicados encontrado. Tudo limpo por aqui."
              : "Nenhum grupo corresponde à busca."}
          </div>
        )}

        {!loading && filtered.map((g) => (
          <GroupCard
            key={g.telefone_e164}
            group={g}
            onMerge={handleMerge}
            onIgnore={handleIgnore}
          />
        ))}
      </CardContent>
    </Card>
  );
}
