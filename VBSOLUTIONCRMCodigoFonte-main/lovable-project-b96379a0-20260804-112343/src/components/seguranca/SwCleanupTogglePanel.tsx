import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldAlert } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Row {
  user_id: string;
  nome_empresa: string | null;
  sw_cleanup_disabled: boolean;
  sw_cleanup_disabled_at: string | null;
  sw_cleanup_disabled_by: string | null;
  sw_cleanup_disabled_reason: string | null;
  changed_by_name?: string | null;
}

export function SwCleanupTogglePanel() {
  const { isMaster } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reasonMap, setReasonMap] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    const { data: configs } = await supabase
      .from("imobiliaria_config")
      .select("user_id, nome_empresa, sw_cleanup_disabled, sw_cleanup_disabled_at, sw_cleanup_disabled_by, sw_cleanup_disabled_reason")
      .order("nome_empresa", { ascending: true });

    const authorIds = Array.from(
      new Set((configs ?? []).map((c: any) => c.sw_cleanup_disabled_by).filter(Boolean)),
    );
    let authorMap: Record<string, string> = {};
    if (authorIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, nome, email")
        .in("id", authorIds as string[]);
      authorMap = Object.fromEntries(
        (profs ?? []).map((p: any) => [p.id, p.nome || p.email || p.id]),
      );
    }
    setRows(
      (configs ?? []).map((c: any) => ({
        ...c,
        changed_by_name: c.sw_cleanup_disabled_by ? authorMap[c.sw_cleanup_disabled_by] : null,
      })),
    );
    setLoading(false);
  };

  useEffect(() => {
    if (isMaster) load();
  }, [isMaster]);

  const toggle = async (row: Row, next: boolean) => {
    setBusyId(row.user_id);
    const { error } = await supabase.rpc("set_sw_cleanup_disabled", {
      _tenant_id: row.user_id,
      _disabled: next,
      _reason: reasonMap[row.user_id] ?? null,
    });
    setBusyId(null);
    if (error) {
      toast({
        variant: "destructive",
        title: "Não foi possível alterar",
        description: error.message,
      });
      return;
    }
    toast({
      title: next ? "Limpeza desativada" : "Limpeza reativada",
      description: `Alteração registrada em auditoria para ${row.nome_empresa || row.user_id}.`,
    });
    await load();
  };

  if (!isMaster) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-amber-500" />
          Limpeza de Service Worker / Cache por Tenant
        </CardTitle>
        <CardDescription>
          Uso exclusivo do Super Admin. Desativar preserva SW e caches do navegador do tenant no próximo boot — útil para diagnosticar problemas em produção. Toda alteração fica registrada em auditoria.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma imobiliária configurada.</p>
        ) : (
          rows.map((row) => (
            <div
              key={row.user_id}
              className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-center md:justify-between"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium truncate">{row.nome_empresa || row.user_id}</p>
                  {row.sw_cleanup_disabled ? (
                    <Badge variant="destructive">Limpeza desativada</Badge>
                  ) : (
                    <Badge variant="secondary">Padrão</Badge>
                  )}
                </div>
                {row.sw_cleanup_disabled_at && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Última alteração{" "}
                    {formatDistanceToNow(new Date(row.sw_cleanup_disabled_at), {
                      addSuffix: true,
                      locale: ptBR,
                    })}{" "}
                    por <span className="font-medium">{row.changed_by_name || row.sw_cleanup_disabled_by}</span>
                    {row.sw_cleanup_disabled_reason ? ` — "${row.sw_cleanup_disabled_reason}"` : ""}
                  </p>
                )}
                <div className="mt-2">
                  <Label htmlFor={`reason-${row.user_id}`} className="text-xs">
                    Motivo (opcional)
                  </Label>
                  <Textarea
                    id={`reason-${row.user_id}`}
                    value={reasonMap[row.user_id] ?? ""}
                    onChange={(e) =>
                      setReasonMap((m) => ({ ...m, [row.user_id]: e.target.value }))
                    }
                    placeholder="Ex.: investigando white screen em produção"
                    rows={2}
                    className="mt-1"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={row.sw_cleanup_disabled}
                  disabled={busyId === row.user_id}
                  onCheckedChange={(v) => toggle(row, v)}
                />
                {busyId === row.user_id && (
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                )}
              </div>
            </div>
          ))
        )}
        <div className="pt-2 flex justify-end">
          <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
            Recarregar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
