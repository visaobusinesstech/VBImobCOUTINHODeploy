import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  MessageSquarePlus,
  Phone,
  Mail,
  ExternalLink,
  Info,
  Settings2,
  CheckSquare,
  Square,
} from "lucide-react";
import type { Lead } from "@/hooks/useLeads";
import type { Followup } from "@/hooks/useFollowups";
import { format, parseISO, differenceInDays, differenceInHours } from "date-fns";
import { ptBR } from "date-fns/locale";

interface LeadsContatoPanelProps {
  leads: Lead[];
  followups: Followup[];
  /** Abrir o dialog para agendar manualmente um follow-up futuro. */
  onFollowup: (leadId: string) => void;
  /**
   * Registrar o contato feito AGORA. O handler deve marcar/inserir um
   * follow-up concluído para hoje e agendar automaticamente a próxima
   * ação usando o SLA de recontato configurado.
   */
  onRegistrarContato?: (leadId: string, tipo: string) => Promise<void> | void;
  onOpenLead?: (lead: Lead) => void;
  slaPrimeiroContatoHoras: number;
  slaRecontatoDias: number;
}

export type LeadContatoTab = "atrasados" | "a_contatar" | "contatados";
type Tab = LeadContatoTab;

export const ESTAGIOS_INATIVOS_CONTATO = new Set([
  "fechado",
  "perdido",
  "desistiu",
  "comprou_outra",
]);
const ESTAGIOS_INATIVOS = ESTAGIOS_INATIVOS_CONTATO;

export type LeadContatoStatus = {
  bucket: Tab;
  motivo: string;
  ultimoContato: Date | null;
  proximoFollowup: Date | null;
  totalContatos: number;
  horasDesdeCriacao: number;
  diasSemContato: number | null;
  diasAtraso: number;
};

type LeadStatus = LeadContatoStatus;

/**
 * Regras determinísticas de classificação:
 *
 * ATRASADOS — o lead ultrapassou o SLA e precisa de ação imediata:
 *   1. Existe follow-up pendente com data anterior a hoje, OU
 *   2. Nunca houve contato e passou o SLA de primeiro contato desde a criação, OU
 *   3. Já foi contatado, mas o último contato passou do SLA de recontato E
 *      não há follow-up futuro agendado.
 *
 * A CONTATAR — o lead está dentro do SLA, mas ainda precisa de próxima ação:
 *   • Nunca contatado e ainda dentro do prazo de primeiro contato, OU
 *   • Já contatado, ainda dentro do prazo de recontato, com follow-up
 *     futuro agendado (ou nenhum), aguardando execução.
 *
 * CONTATADOS — atendimento em dia:
 *   • Pelo menos um follow-up concluído, sem follow-up vencido,
 *     e último contato dentro do SLA de recontato.
 */
export function classifyLeadContato(
  lead: Lead,
  pendentes: Followup[],
  concluidos: Followup[],
  slaPrimeiroHoras: number,
  slaRecontatoDias: number,
  today: Date,
  now: Date,
): LeadContatoStatus {
  return classify(lead, pendentes, concluidos, slaPrimeiroHoras, slaRecontatoDias, today, now);
}

function classify(
  lead: Lead,
  pendentes: Followup[],
  concluidos: Followup[],
  slaPrimeiroHoras: number,
  slaRecontatoDias: number,
  today: Date,
  now: Date,
): LeadStatus {
  const criado = parseISO(lead.created_at);
  const horasDesdeCriacao = Math.max(0, differenceInHours(now, criado));

  const ultimoContato = concluidos.reduce<Date | null>((acc, f) => {
    const d = parseISO(f.data_followup);
    return !acc || d > acc ? d : acc;
  }, null);

  const followupVencido = pendentes
    .map((f) => parseISO(f.data_followup))
    .filter((d) => d < today)
    .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;

  const proximoFollowup = pendentes
    .map((f) => parseISO(f.data_followup))
    .filter((d) => d >= today)
    .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;

  const diasSemContato = ultimoContato
    ? Math.max(0, differenceInDays(today, ultimoContato))
    : null;

  // Regra 1: follow-up vencido
  if (followupVencido) {
    return {
      bucket: "atrasados",
      motivo: "Follow-up agendado venceu",
      ultimoContato,
      proximoFollowup,
      totalContatos: concluidos.length,
      horasDesdeCriacao,
      diasSemContato,
      diasAtraso: Math.max(1, differenceInDays(today, followupVencido)),
    };
  }

  // Regra 2: nunca contatado
  if (concluidos.length === 0) {
    if (horasDesdeCriacao > slaPrimeiroHoras) {
      return {
        bucket: "atrasados",
        motivo: `Sem contato há mais de ${slaPrimeiroHoras}h desde a captação`,
        ultimoContato: null,
        proximoFollowup,
        totalContatos: 0,
        horasDesdeCriacao,
        diasSemContato: null,
        diasAtraso: Math.max(
          1,
          Math.floor((horasDesdeCriacao - slaPrimeiroHoras) / 24) || 1,
        ),
      };
    }
    return {
      bucket: "a_contatar",
      motivo: `Aguardando primeiro contato (SLA ${slaPrimeiroHoras}h)`,
      ultimoContato: null,
      proximoFollowup,
      totalContatos: 0,
      horasDesdeCriacao,
      diasSemContato: null,
      diasAtraso: 0,
    };
  }

  // Regra 3: já contatado — avalia SLA de recontato
  const excedeu = (diasSemContato ?? 0) > slaRecontatoDias;

  if (excedeu && !proximoFollowup) {
    return {
      bucket: "atrasados",
      motivo: `Último contato há ${diasSemContato} dias (SLA ${slaRecontatoDias}d) e sem próxima ação agendada`,
      ultimoContato,
      proximoFollowup: null,
      totalContatos: concluidos.length,
      horasDesdeCriacao,
      diasSemContato,
      diasAtraso: (diasSemContato ?? 0) - slaRecontatoDias,
    };
  }

  if (excedeu && proximoFollowup) {
    return {
      bucket: "a_contatar",
      motivo: `SLA de recontato vencido, mas há follow-up agendado para ${format(proximoFollowup, "dd/MM", { locale: ptBR })}`,
      ultimoContato,
      proximoFollowup,
      totalContatos: concluidos.length,
      horasDesdeCriacao,
      diasSemContato,
      diasAtraso: 0,
    };
  }

  return {
    bucket: "contatados",
    motivo: `Em dia — ${concluidos.length} contato${concluidos.length > 1 ? "s" : ""} registrado${concluidos.length > 1 ? "s" : ""}`,
    ultimoContato,
    proximoFollowup,
    totalContatos: concluidos.length,
    horasDesdeCriacao,
    diasSemContato,
    diasAtraso: 0,
  };
}

export function LeadsContatoPanel({
  leads,
  followups,
  onFollowup,
  onRegistrarContato,
  onOpenLead,
  slaPrimeiroContatoHoras,
  slaRecontatoDias,
}: LeadsContatoPanelProps) {
  const FILTROS_STORAGE_KEY = "leads-contato-panel:filtros:v1";
  type FiltrosPersistidos = {
    tab: Tab;
    filtroImobiliaria: string;
    filtroCorretor: string;
    filtroOrigem: string;
    filtroTipoImovel: string;
  };
  const loadFiltros = (): Partial<FiltrosPersistidos> => {
    if (typeof window === "undefined") return {};
    try {
      const raw = window.localStorage.getItem(FILTROS_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Partial<FiltrosPersistidos>) : {};
    } catch {
      return {};
    }
  };
  const persistidos = loadFiltros();

  const [tab, setTab] = useState<Tab>(persistidos.tab ?? "atrasados");
  const [showRules, setShowRules] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [filtroImobiliaria, setFiltroImobiliaria] = useState<string>(persistidos.filtroImobiliaria ?? "todas");
  const [filtroCorretor, setFiltroCorretor] = useState<string>(persistidos.filtroCorretor ?? "todos");
  const [filtroOrigem, setFiltroOrigem] = useState<string>(persistidos.filtroOrigem ?? "todas");
  const [filtroTipoImovel, setFiltroTipoImovel] = useState<string>(persistidos.filtroTipoImovel ?? "todos");

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        FILTROS_STORAGE_KEY,
        JSON.stringify({ tab, filtroImobiliaria, filtroCorretor, filtroOrigem, filtroTipoImovel }),
      );
    } catch {
      /* ignore quota errors */
    }
  }, [tab, filtroImobiliaria, filtroCorretor, filtroOrigem, filtroTipoImovel]);
  // Seleção múltipla por aba
  const [selecionados, setSelecionados] = useState<Record<Tab, Set<string>>>({
    atrasados: new Set(),
    a_contatar: new Set(),
    contatados: new Set(),
  });
  const [bulkBusy, setBulkBusy] = useState(false);

  const toggleSelecionado = (leadId: string) => {
    setSelecionados((prev) => {
      const next = new Set(prev[tab]);
      if (next.has(leadId)) next.delete(leadId);
      else next.add(leadId);
      return { ...prev, [tab]: next };
    });
  };
  const limparSelecao = () =>
    setSelecionados((prev) => ({ ...prev, [tab]: new Set() }));

  // Opções derivadas dinamicamente dos leads recebidos
  const { imobiliariasOpts, corretoresOpts, origensOpts, tiposImovelOpts } = useMemo(() => {
    const imob = new Map<string, string>();
    const corr = new Map<string, string>();
    const orig = new Set<string>();
    const tipos = new Set<string>();
    leads.forEach((l) => {
      if (l.imobiliaria_id) imob.set(l.imobiliaria_id, l.imobiliaria_id.slice(0, 6));
      if (l.corretor_id) corr.set(l.corretor_id, l.corretor_nome || "Sem nome");
      else corr.set("__none__", "Sem corretor");
      if (l.canal_origem) orig.add(l.canal_origem);
      if ((l as any).tipo_imovel_interesse) tipos.add((l as any).tipo_imovel_interesse);
    });
    return {
      imobiliariasOpts: Array.from(imob.entries()),
      corretoresOpts: Array.from(corr.entries()).sort((a, b) => a[1].localeCompare(b[1])),
      origensOpts: Array.from(orig).sort(),
      tiposImovelOpts: Array.from(tipos).sort(),
    };
  }, [leads]);

  const filtrosAtivos =
    (filtroImobiliaria !== "todas" ? 1 : 0) +
    (filtroCorretor !== "todos" ? 1 : 0) +
    (filtroOrigem !== "todas" ? 1 : 0) +
    (filtroTipoImovel !== "todos" ? 1 : 0);

  const leadsFiltrados = useMemo(() => {
    return leads.filter((l) => {
      if (filtroImobiliaria !== "todas" && l.imobiliaria_id !== filtroImobiliaria) return false;
      if (filtroCorretor === "__none__") {
        if (l.corretor_id) return false;
      } else if (filtroCorretor !== "todos" && l.corretor_id !== filtroCorretor) return false;
      if (filtroOrigem !== "todas" && (l.canal_origem || "") !== filtroOrigem) return false;
      if (filtroTipoImovel !== "todos" && ((l as any).tipo_imovel_interesse || "") !== filtroTipoImovel) return false;
      return true;
    });
  }, [leads, filtroImobiliaria, filtroCorretor, filtroOrigem, filtroTipoImovel]);

  const { atrasados, aContatar, contatados } = useMemo(() => {
    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const pendentesPorLead = new Map<string, Followup[]>();
    const concluidosPorLead = new Map<string, Followup[]>();
    followups.forEach((f) => {
      if (!f.lead_id) return;
      const bucket = f.status === "concluido" ? concluidosPorLead : pendentesPorLead;
      const arr = bucket.get(f.lead_id) ?? [];
      arr.push(f);
      bucket.set(f.lead_id, arr);
    });

    const ativos = leadsFiltrados.filter((l) => !ESTAGIOS_INATIVOS.has(l.estagio));

    const atrasados: Array<{ lead: Lead; status: LeadStatus }> = [];
    const aContatar: Array<{ lead: Lead; status: LeadStatus }> = [];
    const contatados: Array<{ lead: Lead; status: LeadStatus }> = [];

    ativos.forEach((lead) => {
      const status = classify(
        lead,
        pendentesPorLead.get(lead.id) ?? [],
        concluidosPorLead.get(lead.id) ?? [],
        slaPrimeiroContatoHoras,
        slaRecontatoDias,
        today,
        now,
      );
      if (status.bucket === "atrasados") atrasados.push({ lead, status });
      else if (status.bucket === "a_contatar") aContatar.push({ lead, status });
      else contatados.push({ lead, status });
    });

    atrasados.sort((a, b) => b.status.diasAtraso - a.status.diasAtraso);
    aContatar.sort((a, b) => b.status.horasDesdeCriacao - a.status.horasDesdeCriacao);
    contatados.sort(
      (a, b) =>
        (b.status.ultimoContato?.getTime() ?? 0) -
        (a.status.ultimoContato?.getTime() ?? 0),
    );

    return { atrasados, aContatar, contatados };
  }, [leadsFiltrados, followups, slaPrimeiroContatoHoras, slaRecontatoDias]);

  const tabs: { id: Tab; label: string; count: number; icon: any; tone: string }[] = [
    { id: "atrasados", label: "Atrasados", count: atrasados.length, icon: AlertTriangle, tone: "text-destructive" },
    { id: "a_contatar", label: "A contatar", count: aContatar.length, icon: Clock, tone: "text-warning" },
    { id: "contatados", label: "Contatados", count: contatados.length, icon: CheckCircle2, tone: "text-emerald-500" },
  ];

  const openWhats = (tel: string | null) => {
    if (!tel) return;
    const digits = tel.replace(/\D/g, "");
    if (!digits) return;
    window.open(`https://wa.me/55${digits}`, "_blank");
  };

  const currentItems =
    tab === "atrasados" ? atrasados : tab === "a_contatar" ? aContatar : contatados;

  const selecaoAtual = selecionados[tab];
  const allSelectedIds = currentItems.map((i) => i.lead.id);
  const todosSelecionados =
    allSelectedIds.length > 0 && allSelectedIds.every((id) => selecaoAtual.has(id));

  const toggleSelecionarTodos = () => {
    setSelecionados((prev) => ({
      ...prev,
      [tab]: todosSelecionados ? new Set() : new Set(allSelectedIds),
    }));
  };

  const leadsSelecionados = currentItems
    .filter((i) => selecaoAtual.has(i.lead.id))
    .map((i) => i.lead);

  const bulkWhatsApp = () => {
    const alvos = leadsSelecionados.filter((l) => l.telefone);
    if (alvos.length === 0) {
      toast.error("Nenhum lead selecionado com telefone.");
      return;
    }
    if (alvos.length > 8 && !window.confirm(`Abrir ${alvos.length} janelas do WhatsApp?`)) return;
    alvos.forEach((l, idx) => {
      const digits = (l.telefone || "").replace(/\D/g, "");
      if (!digits) return;
      setTimeout(() => window.open(`https://wa.me/55${digits}`, "_blank"), idx * 300);
    });
    toast.success(`Abrindo WhatsApp para ${alvos.length} lead${alvos.length > 1 ? "s" : ""}.`);
  };

  const bulkEmail = () => {
    const emails = leadsSelecionados.map((l) => l.email).filter(Boolean) as string[];
    if (emails.length === 0) {
      toast.error("Nenhum lead selecionado com e-mail.");
      return;
    }
    const bcc = emails.join(",");
    window.location.href = `mailto:?bcc=${encodeURIComponent(bcc)}`;
    toast.success(`Compondo e-mail para ${emails.length} contato${emails.length > 1 ? "s" : ""} (BCC).`);
  };

  const bulkRegistrar = async () => {
    if (!onRegistrarContato) return;
    if (leadsSelecionados.length === 0) return;
    if (
      !window.confirm(
        `Registrar contato feito hoje para ${leadsSelecionados.length} lead(s) e agendar próxima ação em ${slaRecontatoDias} dias?`,
      )
    )
      return;
    setBulkBusy(true);
    let ok = 0;
    for (const l of leadsSelecionados) {
      try {
        await onRegistrarContato(l.id, "whatsapp");
        ok++;
      } catch {
        /* segue o baile */
      }
    }
    setBulkBusy(false);
    limparSelecao();
    toast.success(`${ok} contato${ok !== 1 ? "s" : ""} registrado${ok !== 1 ? "s" : ""}.`);
  };

  return (
    <div className="mb-4 rounded-xl bg-muted/30 border border-border overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border bg-background/50 px-2 pt-2 flex-wrap">
        <div className="flex items-center gap-1 flex-1 min-w-0 overflow-x-auto">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                  active
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${active ? t.tone : ""}`} />
                {t.label}
                <span
                  className={`ml-1 min-w-[20px] text-center px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    active ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 pr-2 pb-1">
          <button
            onClick={() => setShowRules((v) => !v)}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            title="Ver regras de classificação"
          >
            <Info className="w-3.5 h-3.5" />
            Regras
          </button>
          <Link
            to="/configuracoes"
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors"
            title="Configurar SLA"
          >
            <Settings2 className="w-3.5 h-3.5" />
            SLA
          </Link>
        </div>
      </div>

      {/* Filtros rápidos */}
      <div className="flex items-center gap-2 flex-wrap px-3 py-2 bg-background/40 border-b border-border">
        {imobiliariasOpts.length > 1 && (
          <FiltroSelect
            label="Imobiliária"
            value={filtroImobiliaria}
            onChange={setFiltroImobiliaria}
            options={[["todas", "Todas"], ...imobiliariasOpts.map(([id, l]) => [id, l] as [string, string])]}
          />
        )}
        <FiltroSelect
          label="Corretor"
          value={filtroCorretor}
          onChange={setFiltroCorretor}
          options={[["todos", "Todos"], ...corretoresOpts]}
        />
        <FiltroSelect
          label="Origem"
          value={filtroOrigem}
          onChange={setFiltroOrigem}
          options={[["todas", "Todas"], ...origensOpts.map((o) => [o, o] as [string, string])]}
        />
        <FiltroSelect
          label="Tipo imóvel"
          value={filtroTipoImovel}
          onChange={setFiltroTipoImovel}
          options={[["todos", "Todos"], ...tiposImovelOpts.map((o) => [o, o] as [string, string])]}
        />
        {filtrosAtivos > 0 && (
          <button
            onClick={() => {
              setFiltroImobiliaria("todas");
              setFiltroCorretor("todos");
              setFiltroOrigem("todas");
              setFiltroTipoImovel("todos");
            }}
            className="ml-auto text-[11px] text-muted-foreground hover:text-destructive transition-colors underline underline-offset-2"
          >
            Limpar {filtrosAtivos} filtro{filtrosAtivos > 1 ? "s" : ""}
          </button>
        )}
      </div>


      {showRules && (
        <div className="px-4 py-3 bg-background/30 border-b border-border text-[11px] text-muted-foreground space-y-1.5">
          <p>
            <span className="font-semibold text-destructive">Atrasados</span> — follow-up
            vencido, ou sem contato há mais de{" "}
            <b className="text-foreground">{slaPrimeiroContatoHoras}h</b> após captação, ou
            último contato há mais de{" "}
            <b className="text-foreground">{slaRecontatoDias} dias</b> sem nova ação
            agendada.
          </p>
          <p>
            <span className="font-semibold text-warning">A contatar</span> — dentro do
            SLA aguardando primeiro contato, ou com follow-up futuro já agendado.
          </p>
          <p>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              Contatados
            </span>{" "}
            — atendimento em dia dentro do prazo de recontato.
          </p>
          <p className="text-[10px] italic">
            Leads em estágio final (fechado, perdido, desistiu, comprou c/ outra) não
            entram nesta lista.
          </p>
        </div>
      )}

      {/* Barra de ações em lote */}
      {currentItems.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap px-3 py-2 bg-background/40 border-b border-border">
          <button
            onClick={toggleSelecionarTodos}
            className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {todosSelecionados ? (
              <CheckSquare className="w-3.5 h-3.5 text-primary" />
            ) : (
              <Square className="w-3.5 h-3.5" />
            )}
            {todosSelecionados ? "Desmarcar todos" : "Selecionar todos"}
          </button>
          <span className="text-[11px] text-muted-foreground">
            {selecaoAtual.size} de {currentItems.length} selecionado
            {selecaoAtual.size === 1 ? "" : "s"}
          </span>
          <div className="flex items-center gap-1 ml-auto">
            <button
              disabled={selecaoAtual.size === 0}
              onClick={bulkWhatsApp}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Phone className="w-3 h-3" /> WhatsApp
            </button>
            <button
              disabled={selecaoAtual.size === 0}
              onClick={bulkEmail}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Mail className="w-3 h-3" /> E-mail
            </button>
            {onRegistrarContato && (
              <button
                disabled={selecaoAtual.size === 0 || bulkBusy}
                onClick={bulkRegistrar}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
              >
                <MessageSquarePlus className="w-3 h-3" />
                {bulkBusy ? "Registrando..." : "Registrar contato"}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="p-3 max-h-[420px] overflow-y-auto">
        <LeadList
          empty={
            tab === "atrasados"
              ? "Nenhum contato atrasado 🎉"
              : tab === "a_contatar"
              ? "Todos os leads em dia dentro do SLA."
              : "Nenhum contato registrado ainda."
          }
          items={currentItems}
          tab={tab}
          savingId={savingId}
          slaRecontatoDias={slaRecontatoDias}
          selecionados={selecaoAtual}
          onToggleSelecionado={toggleSelecionado}
          onFollowup={onFollowup}
          onRegistrarContato={
            onRegistrarContato
              ? async (leadId, tipo) => {
                  setSavingId(leadId);
                  try {
                    await onRegistrarContato(leadId, tipo);
                  } finally {
                    setSavingId(null);
                  }
                }
              : undefined
          }
          onOpenLead={onOpenLead}
          onWhats={openWhats}
        />
      </div>

    </div>
  );
}

function LeadList({
  items,
  empty,
  tab,
  savingId,
  slaRecontatoDias,
  selecionados,
  onToggleSelecionado,
  onFollowup,
  onRegistrarContato,
  onOpenLead,
  onWhats,
}: {
  items: Array<{ lead: Lead; status: LeadStatus }>;
  empty: string;
  tab: Tab;
  savingId: string | null;
  slaRecontatoDias: number;
  selecionados: Set<string>;
  onToggleSelecionado: (leadId: string) => void;
  onFollowup: (leadId: string) => void;
  onRegistrarContato?: (leadId: string, tipo: string) => Promise<void> | void;
  onOpenLead?: (lead: Lead) => void;
  onWhats: (tel: string | null) => void;
}) {
  if (items.length === 0) {
    return <p className="text-xs text-muted-foreground text-center py-6">{empty}</p>;
  }
  const registrarLabel =
    tab === "atrasados" ? "Registrar contato" : tab === "a_contatar" ? "Falar agora" : "Novo contato";

  return (
    <ul className="space-y-2">
      {items.map(({ lead, status }) => {
        const selecionado = selecionados.has(lead.id);
        return (
        <li
          key={lead.id}
          className={`flex items-center justify-between gap-3 p-2.5 rounded-lg bg-background border transition-colors ${
            selecionado ? "border-primary/70 ring-1 ring-primary/30" : "border-border hover:border-primary/40"
          }`}
        >
          <button
            onClick={() => onToggleSelecionado(lead.id)}
            className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
            title={selecionado ? "Desmarcar" : "Selecionar"}
          >
            {selecionado ? (
              <CheckSquare className="w-4 h-4 text-primary" />
            ) : (
              <Square className="w-4 h-4" />
            )}
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => onOpenLead?.(lead)}
                className="text-sm font-semibold text-foreground truncate hover:text-primary transition-colors text-left"
              >
                {lead.nome}
              </button>
              {lead.corretor_nome && (
                <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                  {lead.corretor_nome}
                </span>
              )}
              {tab === "atrasados" && status.diasAtraso > 0 && (
                <span className="text-[10px] text-destructive bg-destructive/10 px-1.5 py-0.5 rounded font-semibold">
                  +{status.diasAtraso}d
                </span>
              )}
            </div>
            <p
              className={`text-[11px] font-medium mt-0.5 ${
                tab === "atrasados"
                  ? "text-destructive"
                  : tab === "a_contatar"
                  ? "text-warning"
                  : "text-emerald-600 dark:text-emerald-400"
              }`}
            >
              {status.motivo}
            </p>
            {status.ultimoContato && tab !== "atrasados" && (
              <p className="text-[10px] text-muted-foreground">
                Último contato em{" "}
                {format(status.ultimoContato, "dd/MM/yyyy", { locale: ptBR })}
                {status.proximoFollowup && (
                  <>
                    {" · próximo em "}
                    {format(status.proximoFollowup, "dd/MM", { locale: ptBR })}
                  </>
                )}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {lead.telefone && (
              <button
                onClick={() => onWhats(lead.telefone)}
                title="Abrir WhatsApp"
                className="p-1.5 rounded-md text-muted-foreground hover:text-emerald-600 hover:bg-emerald-500/10 transition-colors"
              >
                <Phone className="w-3.5 h-3.5" />
              </button>
            )}
            {lead.email && (
              <a
                href={`mailto:${lead.email}`}
                title="Enviar e-mail"
                className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
              >
                <Mail className="w-3.5 h-3.5" />
              </a>
            )}
            {onRegistrarContato && (
              <button
                onClick={() => onRegistrarContato(lead.id, "whatsapp")}
                disabled={savingId === lead.id}
                title={`Marca contato feito hoje e agenda próximo em ${slaRecontatoDias}d`}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-primary text-primary-foreground text-[11px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                <MessageSquarePlus className="w-3.5 h-3.5" />
                {savingId === lead.id ? "Salvando..." : registrarLabel}
              </button>
            )}
            <button
              onClick={() => onFollowup(lead.id)}
              title="Agendar follow-up manual"
              className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
            >
              <Clock className="w-3.5 h-3.5" />
            </button>
            {onOpenLead && (
              <button
                onClick={() => onOpenLead(lead)}
                title="Abrir lead"
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </li>
        );
      })}
    </ul>
  );
}

function FiltroSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
      <span className="font-medium">{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-background border border-border rounded px-2 py-1 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary max-w-[160px]"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
