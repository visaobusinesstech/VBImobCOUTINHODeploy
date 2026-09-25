import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentCorretor } from "@/hooks/useCurrentCorretor";
import { toast } from "sonner";
import { Bell, Check, CheckCheck, Loader2, RefreshCw, Trash2, AlertTriangle, Clock, Inbox, Search, ArrowUpDown } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface NotificacaoRow {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  read: boolean;
  created_at: string;
}

type Filtro = "todas" | "nao_lidas" | "atrasados" | "prestes";

const matchesFiltro = (n: NotificacaoRow, f: Filtro) => {
  if (f === "todas") return true;
  if (f === "nao_lidas") return !n.read;
  const t = n.title.toLowerCase();
  if (f === "atrasados") return t.includes("atrasado");
  if (f === "prestes") return t.includes("prestes") || t.includes("prazo");
  return true;
};

const isRelevante = (n: NotificacaoRow) => {
  const t = n.title.toLowerCase();
  return t.includes("atrasado") || t.includes("prestes") || t.includes("prazo") || t.includes("lead");
};

const tipoDe = (n: NotificacaoRow): "atrasado" | "prestes" | "outro" => {
  const t = n.title.toLowerCase();
  if (t.includes("atrasado")) return "atrasado";
  if (t.includes("prestes") || t.includes("prazo")) return "prestes";
  return "outro";
};

export function LeadNotificacoesPanel() {
  const { user } = useAuth();
  const { corretorId, isBroker, ready: corretorReady } = useCurrentCorretor();
  const [rows, setRows] = useState<NotificacaoRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>("nao_lidas");
  const [busca, setBusca] = useState("");
  const [tipoAlerta, setTipoAlerta] = useState<"todos" | "atrasado" | "prestes" | "outro">("todos");
  const [ordenacao, setOrdenacao] = useState<"recentes" | "antigos" | "atraso_maior" | "atraso_menor">("recentes");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [leadNomes, setLeadNomes] = useState<string[] | null>(null);

  // Para corretores, carrega os nomes dos leads atribuídos a ele para filtrar
  // as notificações (que referenciam o lead pelo nome na descrição/título).
  useEffect(() => {
    if (!corretorReady) return;
    if (!isBroker || !corretorId) { setLeadNomes(null); return; }
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("leads")
        .select("nome")
        .eq("corretor_id", corretorId);
      if (!active) return;
      setLeadNomes((data ?? []).map((l: any) => (l.nome ?? "").toLowerCase().trim()).filter(Boolean));
    })();
    return () => { active = false; };
  }, [corretorReady, isBroker, corretorId]);

  const fetchRows = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("notifications")
      .select("id, user_id, title, description, read, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(200);
    setLoading(false);
    if (error) {
      toast.error("Erro ao carregar notificações");
      return;
    }
    setRows((data ?? []).filter(isRelevante));
  }, [user]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const visiveis = useMemo(() => {
    if (!isBroker) return rows;
    if (leadNomes === null) return [];
    if (leadNomes.length === 0) return [];
    return rows.filter((n) => {
      const hay = `${n.title} ${n.description ?? ""}`.toLowerCase();
      return leadNomes.some((nome) => hay.includes(nome));
    });
  }, [rows, isBroker, leadNomes]);

  const norm = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const filtradas = useMemo(() => {
    const termo = norm(busca.trim());
    let base = visiveis.filter((n) => matchesFiltro(n, filtro));
    if (tipoAlerta !== "todos") base = base.filter((n) => tipoDe(n) === tipoAlerta);
    if (termo) {
      base = base.filter((n) => {
        const hay = norm(`${n.title} ${n.description ?? ""}`);
        return hay.includes(termo);
      });
    }
    const sorted = [...base];
    switch (ordenacao) {
      case "recentes":
        sorted.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
        break;
      case "antigos":
        sorted.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
        break;
      case "atraso_maior":
        // Mais antigos primeiro entre "atrasados"; demais ao final por data desc
        sorted.sort((a, b) => {
          const aAtr = tipoDe(a) === "atrasado" ? 0 : 1;
          const bAtr = tipoDe(b) === "atrasado" ? 0 : 1;
          if (aAtr !== bAtr) return aAtr - bAtr;
          return +new Date(a.created_at) - +new Date(b.created_at);
        });
        break;
      case "atraso_menor":
        sorted.sort((a, b) => {
          const aAtr = tipoDe(a) === "atrasado" ? 0 : 1;
          const bAtr = tipoDe(b) === "atrasado" ? 0 : 1;
          if (aAtr !== bAtr) return aAtr - bAtr;
          return +new Date(b.created_at) - +new Date(a.created_at);
        });
        break;
    }
    return sorted;
  }, [visiveis, filtro, busca, tipoAlerta, ordenacao]);

  const contadores = useMemo(() => ({
    total: visiveis.length,
    naoLidas: visiveis.filter((n) => !n.read).length,
    atrasados: visiveis.filter((n) => tipoDe(n) === "atrasado").length,
    prestes: visiveis.filter((n) => tipoDe(n) === "prestes").length,
  }), [visiveis]);

  const marcarLida = async (id: string, read: boolean) => {
    setBusyId(id);
    const { error } = await supabase.from("notifications").update({ read }).eq("id", id);
    setBusyId(null);
    if (error) { toast.error("Falha ao atualizar"); return; }
    setRows((prev) => prev.map((n) => (n.id === id ? { ...n, read } : n)));
  };

  const marcarTodasLidas = async () => {
    const ids = filtradas.filter((n) => !n.read).map((n) => n.id);
    if (ids.length === 0) return;
    setBulkBusy(true);
    const { error } = await supabase.from("notifications").update({ read: true }).in("id", ids);
    setBulkBusy(false);
    if (error) { toast.error("Falha ao marcar como lidas"); return; }
    setRows((prev) => prev.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)));
    toast.success(`${ids.length} notificação${ids.length > 1 ? "ões" : ""} marcada${ids.length > 1 ? "s" : ""} como lida${ids.length > 1 ? "s" : ""}`);
  };

  const excluir = async (id: string) => {
    setBusyId(id);
    const { error } = await supabase.from("notifications").delete().eq("id", id);
    setBusyId(null);
    if (error) { toast.error("Falha ao excluir"); return; }
    setRows((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <div className="mb-4 p-4 rounded-xl bg-muted/30 border border-border">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Notificações de contatos</h3>
          {contadores.naoLidas > 0 && (
            <span className="text-[11px] font-medium text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">
              {contadores.naoLidas} não lida{contadores.naoLidas > 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchRows}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-background border border-border text-xs text-foreground hover:bg-secondary"
            disabled={loading}
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Atualizar
          </button>
          <button
            onClick={marcarTodasLidas}
            disabled={bulkBusy || filtradas.every((n) => n.read)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 disabled:opacity-50"
          >
            {bulkBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCheck className="w-3.5 h-3.5" />}
            Marcar visíveis como lidas
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome do lead ou texto…"
            className="w-full pl-7 pr-2 py-1.5 text-xs rounded-md bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <select
          value={tipoAlerta}
          onChange={(e) => setTipoAlerta(e.target.value as typeof tipoAlerta)}
          className="px-2 py-1.5 text-xs rounded-md bg-background border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          aria-label="Tipo de alerta"
        >
          <option value="todos">Todos os tipos</option>
          <option value="atrasado">Atrasados</option>
          <option value="prestes">Prestes / prazo</option>
          <option value="outro">Outros</option>
        </select>
        <div className="flex items-center gap-1">
          <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" />
          <select
            value={ordenacao}
            onChange={(e) => setOrdenacao(e.target.value as typeof ordenacao)}
            className="px-2 py-1.5 text-xs rounded-md bg-background border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            aria-label="Ordenação"
          >
            <option value="recentes">Mais recentes</option>
            <option value="antigos">Mais antigos</option>
            <option value="atraso_maior">Atrasos há mais tempo</option>
            <option value="atraso_menor">Atrasos mais recentes</option>
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {([
          { id: "nao_lidas", label: `Não lidas (${contadores.naoLidas})` },
          { id: "atrasados", label: `Atrasados (${contadores.atrasados})` },
          { id: "prestes", label: `Prestes (${contadores.prestes})` },
          { id: "todas", label: `Todas (${contadores.total})` },
        ] as { id: Filtro; label: string }[]).map((opt) => (
          <button
            key={opt.id}
            onClick={() => setFiltro(opt.id)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              filtro === opt.id
                ? "bg-primary/10 text-primary border-primary/40"
                : "bg-background text-muted-foreground border-border hover:text-foreground"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
          <Loader2 className="w-4 h-4 animate-spin mr-2" /> Carregando…
        </div>
      ) : filtradas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground text-sm">
          <Inbox className="w-6 h-6 mb-2 opacity-60" />
          Nenhuma notificação {filtro !== "todas" ? "neste filtro" : "por aqui"}.
        </div>
      ) : (
        <ul className="space-y-2">
          {filtradas.map((n) => {
            const tipo = tipoDe(n);
            const Icon = tipo === "atrasado" ? AlertTriangle : Clock;
            const iconClass =
              tipo === "atrasado"
                ? "text-destructive"
                : tipo === "prestes"
                ? "text-warning"
                : "text-muted-foreground";
            return (
              <li
                key={n.id}
                className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                  n.read
                    ? "bg-background border-border"
                    : "bg-primary/5 border-primary/30"
                }`}
              >
                <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${iconClass}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground truncate">{n.title}</span>
                    {!n.read && (
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                        Nova
                      </span>
                    )}
                  </div>
                  {n.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 break-words">{n.description}</p>
                  )}
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => marcarLida(n.id, !n.read)}
                    disabled={busyId === n.id}
                    title={n.read ? "Marcar como não lida" : "Marcar como lida"}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 disabled:opacity-50"
                  >
                    {busyId === n.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => excluir(n.id)}
                    disabled={busyId === n.id}
                    title="Excluir"
                    className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
