import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentCorretor } from "@/hooks/useCurrentCorretor";
import { useToast } from "@/hooks/use-toast";
import { mensagemErroComLimite } from "@/lib/planoLimiteError";


export interface Lead {
  id: string;
  imobiliaria_id: string;
  created_by?: string | null;
  nome: string;
  telefone: string | null;
  email: string | null;
  interesse: string | null;
  valor: number;
  corretor_id: string | null;
  estagio: string;
  posicao: number;
  observacoes: string | null;
  motivo_perda: string | null;
  tipo_operacao: string;
  canal_origem: string | null;
  bairro_interesse: string | null;
  tipo_imovel_interesse: string | null;
  // Perfil de busca detalhado (matching demanda × carteira)
  area_minima?: number | null;
  quartos_minimo?: number | null;
  suites_minimo?: number | null;
  banheiros_minimo?: number | null;
  vagas_minimo?: number | null;
  valor_maximo?: number | null;
  bairros_interesse?: string[] | null;
  amenidades_desejadas?: string[] | null;
  finalidade?: string | null;
  urgencia?: string | null;
  created_at: string;
  updated_at: string;
  corretor_nome?: string;
}

export interface Corretor {
  id: string;
  nome: string;
}

export const ESTAGIOS = [
  { id: "novos", title: "Novos Leads", color: "hsl(199, 89%, 48%)" },
  { id: "qualificados", title: "Qualificados", color: "hsl(38, 92%, 50%)" },
  { id: "visita", title: "Visita Agendada", color: "hsl(262, 83%, 58%)" },
  { id: "proposta", title: "Proposta", color: "hsl(142, 71%, 45%)" },
  { id: "mandar_opcoes", title: "Mandar Opções", color: "hsl(210, 70%, 55%)" },
  { id: "pediu_tempo", title: "Pediu Tempo", color: "hsl(25, 95%, 53%)" },
  { id: "quer_alugar", title: "Quer Alugar", color: "hsl(180, 70%, 45%)" },
  { id: "nao_responde", title: "Não Responde", color: "hsl(0, 0%, 55%)" },
  { id: "fechado", title: "Fechado", color: "hsl(45, 93%, 47%)" },
  { id: "comprou_outra", title: "Comprou c/ Outra", color: "hsl(15, 80%, 50%)" },
  { id: "desistiu", title: "Desistiu", color: "hsl(0, 60%, 45%)" },
  { id: "perdido", title: "Perdido", color: "hsl(0, 72%, 51%)" },
] as const;

/**
 * Remap defensivo: estágios legados que não existem mais em ESTAGIOS
 * (ex.: "procurar_opcoes") são normalizados para o estágio atual
 * equivalente. Garante que nenhum card fantasma seja renderizado no
 * pipeline, mesmo se um registro antigo persistir no banco.
 */
export const LEGACY_ESTAGIO_REMAP: Record<string, string> = {
  procurar_opcoes: "mandar_opcoes",
  opcoes: "mandar_opcoes",
};

const VALID_ESTAGIO_IDS = new Set<string>(ESTAGIOS.map((e) => e.id));

/**
 * Slugs conhecidos dinamicamente (setados pelo hook usePipelineEstagios após
 * carregar a lista da imobiliária). Permite que estágios personalizados criados
 * pelo usuário não sejam derrubados para "novos".
 */
const DYNAMIC_ESTAGIO_IDS = new Set<string>();
export function registerDynamicEstagios(slugs: string[]) {
  DYNAMIC_ESTAGIO_IDS.clear();
  slugs.forEach((s) => DYNAMIC_ESTAGIO_IDS.add(s));
}

export function normalizeEstagio(estagio: string | null | undefined): string {
  const raw = (estagio ?? "").trim();
  if (LEGACY_ESTAGIO_REMAP[raw]) return LEGACY_ESTAGIO_REMAP[raw];
  if (VALID_ESTAGIO_IDS.has(raw)) return raw;
  if (DYNAMIC_ESTAGIO_IDS.has(raw)) return raw;
  return "novos";
}


export function useLeads() {
  const { user, imobiliariaId, isMaster } = useAuth();
  const { corretorId, isBroker } = useCurrentCorretor();
  const { toast } = useToast();
  const [rawLeads, setRawLeads] = useState<Lead[]>([]);
  const [corretores, setCorretores] = useState<Corretor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Guard: prevent concurrent fetches
  const fetchingRef = useRef(false);
  const corretoresFetchedRef = useRef(false);
  const lastFetchAtRef = useRef(0);
  const hasLoadedOnceRef = useRef(false);

  // Enrich leads with corretor_nome + normalize legacy estagios
  const leads = useMemo(() => {
    const corretorMap = new Map(corretores.map(c => [c.id, c.nome]));
    return rawLeads.map(l => ({
      ...l,
      estagio: normalizeEstagio(l.estagio) as Lead["estagio"],
      corretor_nome: l.corretor_id ? corretorMap.get(l.corretor_id) ?? null : null,
    }));
  }, [rawLeads, corretores]);

  const fetchLeads = useCallback(async (attempt = 1) => {
    if (!user) {
      setRawLeads([]);
      setLoading(false);
      return;
    }

    if (fetchingRef.current) {
      return;
    }

    fetchingRef.current = true;
    // Só mostra spinner na primeira carga — refetches em background (realtime,
    // visibilitychange, polling) NÃO devem resetar a UI/scroll do Pipeline.
    if (!hasLoadedOnceRef.current) setLoading(true);
    setError(null);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const PAGE_SIZE = 1000;
      let allLeads: Lead[] = [];
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        const isOwnerOfImob = user && imobiliariaId && user.id === imobiliariaId;
        const restrictToOwn = !isMaster && !isOwnerOfImob;
        let q = supabase
          .from("leads")
          .select("id, imobiliaria_id, created_by, nome, telefone, email, interesse, valor, corretor_id, estagio, posicao, observacoes, motivo_perda, tipo_operacao, canal_origem, bairro_interesse, tipo_imovel_interesse, created_at, updated_at")
          .order("estagio")
          .order("posicao", { ascending: true })
          .range(from, to)
          .abortSignal(controller.signal);
        if (restrictToOwn && user) {
          // Match corretor pelo email do usuário (leads direcionados a ele)
          const email = user.email?.toLowerCase() ?? "";
          let corretorId: string | null = null;
          if (email) {
            const { data: cor } = await supabase
              .from("corretores")
              .select("id")
              .ilike("email", email)
              .limit(1)
              .maybeSingle();
            corretorId = (cor as any)?.id ?? null;
          }
          // Corretor cadastrado: enxerga leads atribuídos a ele OU cadastrados por ele.
          // Usuário sem vínculo de corretor: enxerga apenas os que ele mesmo criou.
          q = corretorId
            ? q.or(`corretor_id.eq.${corretorId},created_by.eq.${user.id}`)
            : q.eq("created_by", user.id);
        }
        const { data, error: queryError } = await q;

        clearTimeout(timeout);
        if (queryError) throw queryError;
        const rows = (data as Lead[]) ?? [];
        allLeads = [...allLeads, ...rows];
        hasMore = rows.length === PAGE_SIZE;
        page++;
      }

      setRawLeads(allLeads);
      lastFetchAtRef.current = Date.now();
      hasLoadedOnceRef.current = true;
    } catch (err: any) {
      clearTimeout(timeout);
      if (err.name === "AbortError" && attempt < 3) {
        fetchingRef.current = false;
        return fetchLeads(attempt + 1);
      }
      const msg = err.name === "AbortError" ? "Conexão lenta. Tente novamente." : err.message;
      setError(msg);
      toast({ title: "Erro ao carregar leads", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [user, imobiliariaId, isMaster, toast]);

  const fetchCorretores = useCallback(async () => {
    if (!user) {
      setCorretores([]);
      return;
    }

    const { data, error } = await supabase
      .from("corretores")
      .select("id, nome")
      .eq("status", "ativo")
      .order("nome");

    if (error) {
      console.error("[useLeads] fetchCorretores error:", error.message);
      return;
    }

    setCorretores((data as Corretor[]) ?? []);
    corretoresFetchedRef.current = true;
  }, [user]);

  // Fetch once when user is ready
  useEffect(() => {
    if (user) {
      fetchLeads();
      if (!corretoresFetchedRef.current) {
        fetchCorretores();
      }
    }
  }, [user, fetchLeads, fetchCorretores]);

  // Realtime — debounced e filtrado por tenant. Sem polling/focus refetch para
  // não travar nem redesenhar o Pipeline quando o usuário volta para a aba.
  useEffect(() => {
    if (!user || !imobiliariaId) return;
    let debounceTimer: ReturnType<typeof setTimeout>;

    const channel = supabase
      .channel(`leads-realtime:${imobiliariaId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "leads",
        filter: `imobiliaria_id=eq.${imobiliariaId}`,
      }, () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          if (document.visibilityState === "visible" && !fetchingRef.current) {
            fetchLeads();
          }
        }, 500);
      })
      .subscribe();

    return () => {
      clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [user, imobiliariaId, fetchLeads]);

  const checkDuplicateLead = async (lead: Partial<Lead>, targetImobiliariaId: string): Promise<boolean> => {
    const phone = lead.telefone?.replace(/\D/g, "");
    const email = lead.email?.trim().toLowerCase();

    if (!phone && !email) return false;

    let query = supabase.from("leads").select("id, nome, telefone, email").eq("imobiliaria_id", targetImobiliariaId);

    if (phone && phone.length >= 8) {
      const { data: phoneMatches } = await supabase
        .from("leads")
        .select("id, nome, telefone")
        .eq("imobiliaria_id", targetImobiliariaId)
        .ilike("telefone", `%${phone.slice(-8)}%`);

      if (phoneMatches && phoneMatches.length > 0) {
        const seguir = window.confirm(
          `Já existe "${phoneMatches[0].nome}" com telefone semelhante (${phoneMatches[0].telefone}).\n\nDeseja cadastrar mesmo assim?`
        );
        if (!seguir) {
          toast({ title: "Cadastro cancelado", description: "Lead possivelmente duplicado." });
          return true;
        }
        return false;
      }
    }

    if (email) {
      const { data: emailMatches } = await supabase
        .from("leads")
        .select("id, nome, email")
        .eq("imobiliaria_id", targetImobiliariaId)
        .ilike("email", email);

      if (emailMatches && emailMatches.length > 0) {
        const seguir = window.confirm(
          `Já existe "${emailMatches[0].nome}" com o e-mail "${emailMatches[0].email}".\n\nDeseja cadastrar mesmo assim?`
        );
        if (!seguir) {
          toast({ title: "Cadastro cancelado", description: "Lead possivelmente duplicado." });
          return true;
        }
        return false;
      }
    }


    return false;
  };

  const createLead = async (lead: Partial<Lead>) => {
    if (!user) return null;

    let targetImobiliariaId = imobiliariaId;
    if (!targetImobiliariaId) {
      const { data } = await supabase.rpc("get_master_user_id");
      targetImobiliariaId = data ?? null;
    }
    if (!targetImobiliariaId) {
      toast({ title: "Erro ao criar lead", description: "Não foi possível identificar a imobiliária.", variant: "destructive" });
      return null;
    }

    // Duplicate check
    const isDuplicate = await checkDuplicateLead(lead, targetImobiliariaId);
    if (isDuplicate) return null;

    const maxPos = leads.filter(l => l.estagio === (lead.estagio || "novos")).length;
    const payload = { ...lead, imobiliaria_id: targetImobiliariaId, posicao: maxPos };
    const { data, error } = await supabase
      .from("leads")
      .insert(payload as any)
      .select()
      .single();

    if (error) {
      toast({ ...mensagemErroComLimite(error, "Erro ao criar lead"), variant: "destructive" });
      return null;
    }

    toast({ title: "Lead adicionado!" });
    await fetchLeads();
    return data;
  };

  const canManageLead = useCallback(
    (id: string) => {
      if (!isBroker) return true;
      const lead = rawLeads.find((l) => l.id === id);
      // Se o lead não está na lista visível do corretor, ele não pode agir.
      if (!lead) return false;
      // Pode agir se for o corretor atribuído OU o criador do lead
      return lead.corretor_id === corretorId || lead.created_by === user?.id;
    },
    [isBroker, corretorId, rawLeads, user?.id]
  );

  const denyPermission = useCallback(() => {
    toast({
      title: "Permissão insuficiente",
      description: "Você só pode agir em leads atribuídos a você ou cadastrados por você.",
      variant: "destructive",
    });
  }, [toast]);

  const updateLead = async (id: string, updates: Partial<Lead>) => {
    if (!canManageLead(id)) { denyPermission(); return false; }
    // Stage change tracking is handled by DB trigger
    // Owner change tracking is handled by DB trigger

    // Create a clean updates object without internal fields like corretor_nome
    const cleanUpdates = { ...updates };
    delete (cleanUpdates as any).corretor_nome;
    delete (cleanUpdates as any).created_at;
    delete (cleanUpdates as any).updated_at;

    const { error } = await supabase
      .from("leads")
      .update(cleanUpdates as any)
      .eq("id", id);

    if (error) {
      console.error("[useLeads] updateLead error:", error);
      toast({ title: "Erro ao atualizar lead", description: error.message, variant: "destructive" });
      return false;
    }
    await fetchLeads(); // Ensure local state is updated
    return true;
  };

  const deleteLead = async (id: string) => {
    if (!canManageLead(id)) { denyPermission(); return false; }
    const { error } = await supabase.from("leads").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir lead", description: error.message, variant: "destructive" });
      return false;
    }
    toast({ title: "Lead excluído!" });
    return true;
  };

  const moveLead = async (leadId: string, newEstagio: string, newPosicao: number) => {
    if (!canManageLead(leadId)) { denyPermission(); return; }
    setRawLeads(prev => prev.map(l => l.id === leadId ? { ...l, estagio: newEstagio, posicao: newPosicao } : l));

    const { error } = await supabase
      .from("leads")
      .update({ estagio: newEstagio, posicao: newPosicao } as any)
      .eq("id", leadId);

    if (error) {
      toast({ title: "Erro ao mover lead", description: error.message, variant: "destructive" });
      await fetchLeads();
    }
  };


  const getLeadsByEstagio = useCallback((estagio: string) => {
    return leads.filter(l => l.estagio === estagio).sort((a, b) => a.posicao - b.posicao);
  }, [leads]);

  return { leads, loading, error, corretores, createLead, updateLead, deleteLead, moveLead, getLeadsByEstagio, refetch: fetchLeads };
}
