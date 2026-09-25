import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { SectionHeader } from "@/components/shared/MetricCard";
import { motion } from "framer-motion";
import {
  User, Phone, Mail, MessageCircle, Eye, FileSignature, CreditCard, Star,
  ChevronDown, ChevronUp, Search, Loader2, MapPin, DollarSign, Clock,
  Plus, UserCheck, Kanban, Tag,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { ESTAGIOS } from "@/hooks/useLeads";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Atividade {
  id: string;
  tipo: string;
  titulo: string;
  descricao: string | null;
  created_at: string;
}

interface LeadComAtividades {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  interesse: string | null;
  valor: number;
  estagio: string;
  observacoes: string | null;
  created_at: string;
  corretor_nome: string | null;
  atividades: Atividade[];
}

const tipoConfig: Record<string, { color: string; icon: any; label: string }> = {
  captacao: { color: "bg-info", icon: User, label: "Captação" },
  contato: { color: "bg-primary", icon: MessageCircle, label: "Contato" },
  visita: { color: "bg-chart-4", icon: Eye, label: "Visita" },
  proposta: { color: "bg-warning", icon: FileSignature, label: "Proposta" },
  estagio: { color: "bg-accent", icon: Kanban, label: "Estágio" },
  nota: { color: "bg-secondary", icon: Tag, label: "Nota" },
  contrato: { color: "bg-success", icon: FileSignature, label: "Contrato" },
  pagamento: { color: "bg-success", icon: CreditCard, label: "Pagamento" },
  posvenda: { color: "bg-primary", icon: Star, label: "Pós-venda" },
};

const estagioMap = Object.fromEntries(ESTAGIOS.map(e => [e.id, e]));

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const JornadaCliente = () => {
  const { user, imobiliariaId } = useAuth();
  const { toast } = useToast();
  const [leads, setLeads] = useState<LeadComAtividades[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [novaAtividade, setNovaAtividade] = useState<{ leadId: string; tipo: string; titulo: string; descricao: string } | null>(null);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const [leadsRes, atividadesRes] = await Promise.all([
      supabase.from("leads").select("*, corretores(nome)").order("created_at", { ascending: false }),
      supabase.from("lead_atividades").select("*").order("created_at", { ascending: true }),
    ]);

    if (leadsRes.error || atividadesRes.error) {
      toast({ title: "Erro ao carregar dados", variant: "destructive" });
      setLoading(false);
      return;
    }

    const atividadesMap = new Map<string, Atividade[]>();
    for (const a of (atividadesRes.data ?? [])) {
      const list = atividadesMap.get(a.lead_id) ?? [];
      list.push(a as Atividade);
      atividadesMap.set(a.lead_id, list);
    }

    const mapped: LeadComAtividades[] = (leadsRes.data ?? []).map((l: any) => ({
      id: l.id,
      nome: l.nome,
      email: l.email,
      telefone: l.telefone,
      interesse: l.interesse,
      valor: l.valor,
      estagio: l.estagio,
      observacoes: l.observacoes,
      created_at: l.created_at,
      corretor_nome: l.corretores?.nome ?? null,
      atividades: atividadesMap.get(l.id) ?? [],
    }));

    setLeads(mapped);
    setLoading(false);
  }, [user, toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("jornada-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "lead_atividades" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchData]);

  const addAtividade = async () => {
    if (!novaAtividade || !user) return;
    const { error } = await supabase.from("lead_atividades").insert({
      lead_id: novaAtividade.leadId,
      imobiliaria_id: imobiliariaId,
      tipo: novaAtividade.tipo,
      titulo: novaAtividade.titulo,
      descricao: novaAtividade.descricao || null,
    } as any);
    if (error) {
      toast({ title: "Erro ao adicionar atividade", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Atividade registrada!" });
      setNovaAtividade(null);
    }
  };

  const filtered = leads.filter((l) =>
    l.nome.toLowerCase().includes(busca.toLowerCase()) ||
    (l.email ?? "").toLowerCase().includes(busca.toLowerCase()) ||
    (l.interesse ?? "").toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <DashboardLayout>
      <SectionHeader title="Jornada do Lead" subtitle={`${leads.length} leads · Acompanhe toda a trajetória`} />

      <div className="relative max-w-sm mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar lead..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="w-full h-10 pl-10 pr-4 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <User className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-sm">{busca ? "Nenhum lead encontrado." : "Nenhum lead cadastrado."}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((lead) => {
            const estagioInfo = estagioMap[lead.estagio];
            const isExpanded = expandedId === lead.id;
            const tempo = formatDistanceToNow(new Date(lead.created_at), { addSuffix: true, locale: ptBR });

            return (
              <motion.div key={lead.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card overflow-hidden">
                {/* Header */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : lead.id)}
                  className="w-full p-4 flex items-center gap-4 hover:bg-secondary/30 transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-sm font-semibold text-primary flex-shrink-0">
                    {lead.nome.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <h3 className="text-sm font-semibold text-foreground">{lead.nome}</h3>
                    <p className="text-xs text-muted-foreground truncate">
                      {lead.interesse || "Sem interesse definido"} · {lead.corretor_nome || "Sem corretor"} · {lead.atividades.length} interações
                    </p>
                  </div>
                  <div className="hidden sm:flex items-center gap-2">
                    {lead.valor > 0 && (
                      <span className="text-xs font-semibold text-foreground">{formatCurrency(lead.valor)}</span>
                    )}
                    <span
                      className="text-xs font-medium px-2 py-1 rounded"
                      style={{
                        backgroundColor: estagioInfo ? `${estagioInfo.color}20` : undefined,
                        color: estagioInfo?.color,
                      }}
                    >
                      {estagioInfo?.title ?? lead.estagio}
                    </span>
                  </div>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="px-4 pb-4">
                    {/* Lead details cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                      <div className="p-3 rounded-lg bg-muted/30 border border-border">
                        <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                          <Phone className="w-3 h-3" /><span className="text-[10px] font-medium">Telefone</span>
                        </div>
                        <p className="text-xs font-medium text-foreground">{lead.telefone || "—"}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/30 border border-border">
                        <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                          <Mail className="w-3 h-3" /><span className="text-[10px] font-medium">Email</span>
                        </div>
                        <p className="text-xs font-medium text-foreground truncate">{lead.email || "—"}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/30 border border-border">
                        <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                          <DollarSign className="w-3 h-3" /><span className="text-[10px] font-medium">Valor</span>
                        </div>
                        <p className="text-xs font-medium text-foreground">{lead.valor > 0 ? formatCurrency(lead.valor) : "—"}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/30 border border-border">
                        <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                          <Clock className="w-3 h-3" /><span className="text-[10px] font-medium">Criado</span>
                        </div>
                        <p className="text-xs font-medium text-foreground">{tempo}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/30 border border-border">
                        <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                          <UserCheck className="w-3 h-3" /><span className="text-[10px] font-medium">Corretor</span>
                        </div>
                        <p className="text-xs font-medium text-foreground">{lead.corretor_nome || "Sem corretor"}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/30 border border-border">
                        <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                          <Kanban className="w-3 h-3" /><span className="text-[10px] font-medium">Estágio</span>
                        </div>
                        <p className="text-xs font-medium" style={{ color: estagioInfo?.color }}>{estagioInfo?.title ?? lead.estagio}</p>
                      </div>
                      <div className="col-span-2 p-3 rounded-lg bg-muted/30 border border-border">
                        <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                          <Tag className="w-3 h-3" /><span className="text-[10px] font-medium">Observações</span>
                        </div>
                        <p className="text-xs text-foreground">{lead.observacoes || "Nenhuma observação"}</p>
                      </div>
                    </div>

                    {/* Stage progress bar */}
                    <div className="flex items-center gap-1 mb-5">
                      {ESTAGIOS.map((e, i) => {
                        const currentIdx = ESTAGIOS.findIndex(s => s.id === lead.estagio);
                        const isCompleted = i <= currentIdx;
                        return (
                          <div key={e.id} className="flex-1 flex flex-col items-center gap-1">
                            <div
                              className="w-full h-2 rounded-full transition-colors"
                              style={{ backgroundColor: isCompleted ? e.color : "hsl(var(--muted))" }}
                            />
                            <span className={`text-[9px] font-medium ${isCompleted ? "text-foreground" : "text-muted-foreground"}`}>{e.title}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Add activity button */}
                    {novaAtividade?.leadId !== lead.id ? (
                      <button
                        onClick={() => setNovaAtividade({ leadId: lead.id, tipo: "contato", titulo: "", descricao: "" })}
                        className="flex items-center gap-2 mb-4 px-3 py-1.5 rounded-lg border border-dashed border-border text-xs text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
                      >
                        <Plus className="w-3 h-3" />Registrar atividade
                      </button>
                    ) : (
                      <div className="mb-4 p-3 rounded-lg border border-primary/30 bg-primary/5 space-y-2">
                        <div className="flex gap-2">
                          <select
                            value={novaAtividade.tipo}
                            onChange={e => setNovaAtividade({ ...novaAtividade, tipo: e.target.value })}
                            className="h-8 px-2 rounded-md bg-background border border-border text-xs text-foreground"
                          >
                            {Object.entries(tipoConfig).map(([k, v]) => (
                              <option key={k} value={k}>{v.label}</option>
                            ))}
                          </select>
                          <input
                            type="text"
                            placeholder="Título da atividade"
                            value={novaAtividade.titulo}
                            onChange={e => setNovaAtividade({ ...novaAtividade, titulo: e.target.value })}
                            className="flex-1 h-8 px-2 rounded-md bg-background border border-border text-xs text-foreground"
                          />
                        </div>
                        <input
                          type="text"
                          placeholder="Descrição (opcional)"
                          value={novaAtividade.descricao}
                          onChange={e => setNovaAtividade({ ...novaAtividade, descricao: e.target.value })}
                          className="w-full h-8 px-2 rounded-md bg-background border border-border text-xs text-foreground"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={addAtividade}
                            disabled={!novaAtividade.titulo.trim()}
                            className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50"
                          >
                            Salvar
                          </button>
                          <button onClick={() => setNovaAtividade(null)} className="px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground">
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Timeline */}
                    {lead.atividades.length > 0 ? (
                      <div className="ml-5 border-l-2 border-border pl-6 space-y-4">
                        {lead.atividades.map((atividade, i) => {
                          const config = tipoConfig[atividade.tipo] ?? tipoConfig.nota;
                          return (
                            <motion.div
                              key={atividade.id}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.03 }}
                              className="relative"
                            >
                              <div className={`absolute -left-[33px] w-4 h-4 rounded-full ${config.color} flex items-center justify-center`}>
                                <div className="w-2 h-2 rounded-full bg-background" />
                              </div>
                              <div className="flex items-start gap-3">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs text-muted-foreground">
                                      {new Date(atividade.created_at).toLocaleDateString("pt-BR")} {new Date(atividade.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                                    </span>
                                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${config.color}/10 text-foreground`}>{config.label}</span>
                                    <span className="text-xs font-semibold text-foreground">{atividade.titulo}</span>
                                  </div>
                                  {atividade.descricao && (
                                    <p className="text-xs text-muted-foreground mt-0.5">{atividade.descricao}</p>
                                  )}
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground text-center py-4">Nenhuma atividade registrada ainda.</p>
                    )}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
};

export default JornadaCliente;
