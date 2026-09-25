import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface NutricaoFluxo {
  id: string;
  imobiliaria_id: string;
  nome: string;
  descricao: string | null;
  publico_alvo: string;
  dias_inatividade: number;
  canal: string;
  encerrar_ao_responder: boolean;
  ativo: boolean;
  created_at: string;
  segmento_estagios?: string[] | null;
  segmento_perfis?: string[] | null;
  segmento_motivos_perda?: string[] | null;
}

export interface NutricaoEtapa {
  id: string;
  fluxo_id: string;
  ordem: number;
  dias_apos: number;
  canal: string;
  titulo: string;
  mensagem: string;
  ativo: boolean;
  ab_ativo?: boolean | null;
  ab_titulo_b?: string | null;
  ab_mensagem_b?: string | null;
  ab_split?: number | null;
  ab_auto_escolher?: boolean | null;
  ab_min_envios?: number | null;
  ab_vencedor?: string | null;
  ab_decidido_em?: string | null;
}

export interface NutricaoInscricao {
  id: string;
  fluxo_id: string;
  lead_id: string | null;
  nome: string | null;
  telefone: string | null;
  email: string | null;
  status: string;
  etapa_atual: number;
  proxima_execucao: string;
  ultima_execucao: string | null;
  motivo_encerramento: string | null;
  created_at?: string | null;
}

export interface NutricaoEnvio {
  id: string;
  inscricao_id: string;
  etapa_id: string | null;
  lead_id: string | null;
  canal: string;
  destino: string | null;
  titulo: string | null;
  mensagem: string;
  status: string;
  erro: string | null;
  enviado_em: string | null;
  created_at: string;
  variante?: string | null;
}

export type EtapaInput = Pick<
  NutricaoEtapa,
  | "ordem"
  | "dias_apos"
  | "canal"
  | "titulo"
  | "mensagem"
  | "ativo"
  | "ab_ativo"
  | "ab_titulo_b"
  | "ab_mensagem_b"
  | "ab_split"
  | "ab_auto_escolher"
  | "ab_min_envios"
>;

export const FLUXOS_MODELO: Array<{
  fluxo: Omit<NutricaoFluxo, "id" | "imobiliaria_id" | "created_at">;
  etapas: EtapaInput[];
}> = [
  {
    fluxo: {
      nome: "Reativação de leads inativos (30 dias)",
      descricao: "Sequência de 3 toques para leads sem interação há 30 dias.",
      publico_alvo: "lead_inativo",
      dias_inatividade: 30,
      canal: "whatsapp",
      encerrar_ao_responder: true,
      ativo: true,
    },
    etapas: [
      {
        ordem: 1,
        dias_apos: 0,
        canal: "whatsapp",
        titulo: "Retomada leve",
        mensagem:
          "Olá {{primeiro_nome}}, tudo bem? Passando para saber se sua busca por imóvel continua ativa. Posso te enviar as novidades que entraram na carteira?",
        ativo: true,
      },
      {
        ordem: 2,
        dias_apos: 5,
        canal: "whatsapp",
        titulo: "Conteúdo de valor",
        mensagem:
          "{{primeiro_nome}}, separei um panorama rápido de preços e oportunidades na região que você procurava. Quer que eu envie?",
        ativo: true,
      },
      {
        ordem: 3,
        dias_apos: 7,
        canal: "email",
        titulo: "Última chamada",
        mensagem:
          "Olá {{nome}}, se preferir, posso pausar os contatos e retomar quando fizer sentido para você. É só me responder com um 'ok'.",
        ativo: true,
      },
    ],
  },
  {
    fluxo: {
      nome: "Lead sem resposta (7 dias)",
      descricao: "Para leads novos que não responderam ao primeiro contato.",
      publico_alvo: "lead_sem_resposta",
      dias_inatividade: 7,
      canal: "whatsapp",
      encerrar_ao_responder: true,
      ativo: true,
    },
    etapas: [
      {
        ordem: 1,
        dias_apos: 0,
        canal: "whatsapp",
        titulo: "Segundo toque",
        mensagem:
          "Oi {{primeiro_nome}}! Tentei falar com você sobre o imóvel de interesse. Prefere que eu chame por aqui ou por ligação?",
        ativo: true,
      },
      {
        ordem: 2,
        dias_apos: 4,
        canal: "whatsapp",
        titulo: "Oferta de ajuda",
        mensagem:
          "{{primeiro_nome}}, consigo montar 3 opções dentro do seu orçamento hoje mesmo. Quer receber?",
        ativo: true,
      },
    ],
  },
];

export function useNutricao() {
  const { user, imobiliariaId } = useAuth();
  const { toast } = useToast();
  const [fluxos, setFluxos] = useState<NutricaoFluxo[]>([]);
  const [etapas, setEtapas] = useState<NutricaoEtapa[]>([]);
  const [inscricoes, setInscricoes] = useState<NutricaoInscricao[]>([]);
  const [envios, setEnvios] = useState<NutricaoEnvio[]>([]);
  const [loading, setLoading] = useState(true);
  const [processando, setProcessando] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!user || !imobiliariaId) return;
    setLoading(true);
    const [f, e, i, en] = await Promise.all([
      supabase.from("nutricao_fluxos").select("*").order("created_at"),
      supabase.from("nutricao_etapas").select("*").order("ordem"),
      supabase.from("nutricao_inscricoes").select("*").order("proxima_execucao"),
      supabase.from("nutricao_envios").select("*").order("created_at", { ascending: false }).limit(300),
    ]);
    if (f.error) toast({ title: "Erro ao carregar fluxos", description: f.error.message, variant: "destructive" });
    setFluxos((f.data ?? []) as NutricaoFluxo[]);
    setEtapas((e.data ?? []) as NutricaoEtapa[]);
    setInscricoes((i.data ?? []) as NutricaoInscricao[]);
    setEnvios((en.data ?? []) as NutricaoEnvio[]);
    setLoading(false);
  }, [user, imobiliariaId, toast]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const salvarFluxo = useCallback(
    async (
      fluxo: Partial<NutricaoFluxo> & { nome: string },
      etapasInput: EtapaInput[],
      fluxoId?: string,
    ) => {
      if (!imobiliariaId) return false;
      let id = fluxoId;
      const payload = {
        imobiliaria_id: imobiliariaId,
        nome: fluxo.nome,
        descricao: fluxo.descricao ?? null,
        publico_alvo: fluxo.publico_alvo ?? "lead_inativo",
        dias_inatividade: fluxo.dias_inatividade ?? 30,
        canal: fluxo.canal ?? "whatsapp",
        encerrar_ao_responder: fluxo.encerrar_ao_responder ?? true,
        ativo: fluxo.ativo ?? true,
        segmento_estagios: fluxo.segmento_estagios ?? [],
        segmento_perfis: fluxo.segmento_perfis ?? [],
        segmento_motivos_perda: fluxo.segmento_motivos_perda ?? [],
      };

      if (id) {
        const { error } = await supabase.from("nutricao_fluxos").update(payload).eq("id", id);
        if (error) {
          toast({ title: "Erro ao salvar fluxo", description: error.message, variant: "destructive" });
          return false;
        }
        await supabase.from("nutricao_etapas").delete().eq("fluxo_id", id);
      } else {
        const { data, error } = await supabase.from("nutricao_fluxos").insert(payload).select().single();
        if (error || !data) {
          toast({ title: "Erro ao criar fluxo", description: error?.message, variant: "destructive" });
          return false;
        }
        id = data.id;
      }

      if (etapasInput.length > 0) {
        const rows = etapasInput.map((et, idx) => ({
          ...et,
          ordem: idx + 1,
          fluxo_id: id!,
          imobiliaria_id: imobiliariaId,
        }));
        const { error } = await supabase.from("nutricao_etapas").insert(rows);
        if (error) {
          toast({ title: "Erro ao salvar etapas", description: error.message, variant: "destructive" });
          return false;
        }
      }

      toast({ title: "Fluxo salvo", description: fluxo.nome });
      await fetchAll();
      return true;
    },
    [imobiliariaId, toast, fetchAll],
  );

  const toggleFluxo = useCallback(
    async (id: string, ativo: boolean) => {
      const { error } = await supabase.from("nutricao_fluxos").update({ ativo }).eq("id", id);
      if (error) {
        toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
        return;
      }
      setFluxos((prev) => prev.map((f) => (f.id === id ? { ...f, ativo } : f)));
    },
    [toast],
  );

  const excluirFluxo = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("nutricao_fluxos").delete().eq("id", id);
      if (error) {
        toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Fluxo excluído" });
      await fetchAll();
    },
    [toast, fetchAll],
  );

  const criarModelos = useCallback(async () => {
    for (const modelo of FLUXOS_MODELO) {
      await salvarFluxo(modelo.fluxo, modelo.etapas);
    }
  }, [salvarFluxo]);

  const processarAgora = useCallback(async () => {
    if (!imobiliariaId) return;
    setProcessando(true);
    const { data, error } = await supabase.functions.invoke("nutricao-processar", {
      body: { imobiliaria_id: imobiliariaId },
    });
    setProcessando(false);
    if (error) {
      toast({ title: "Erro ao processar nutrição", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: "Nutrição processada",
      description: `${data?.inscritos ?? 0} novos inscritos • ${data?.envios ?? 0} mensagens geradas • ${data?.encerrados ?? 0} encerrados por resposta`,
    });
    await fetchAll();
  }, [imobiliariaId, toast, fetchAll]);

  const marcarEnvio = useCallback(
    async (id: string, status: "enviado" | "falha" | "pendente") => {
      const { error } = await supabase
        .from("nutricao_envios")
        .update({ status, enviado_em: status === "enviado" ? new Date().toISOString() : null })
        .eq("id", id);
      if (error) {
        toast({ title: "Erro ao atualizar envio", description: error.message, variant: "destructive" });
        return;
      }
      setEnvios((prev) =>
        prev.map((e) =>
          e.id === id ? { ...e, status, enviado_em: status === "enviado" ? new Date().toISOString() : null } : e,
        ),
      );
    },
    [toast],
  );

  const encerrarInscricao = useCallback(
    async (id: string) => {
      const { error } = await supabase
        .from("nutricao_inscricoes")
        .update({ status: "encerrada", motivo_encerramento: "Encerrada manualmente" })
        .eq("id", id);
      if (error) {
        toast({ title: "Erro ao encerrar", description: error.message, variant: "destructive" });
        return;
      }
      await fetchAll();
    },
    [toast, fetchAll],
  );

  /** Promove a variante vencedora do teste A/B para mensagem oficial da etapa. */
  const aplicarVencedorAB = useCallback(
    async (etapaId: string, vencedor: "A" | "B") => {
      const etapa = etapas.find((e) => e.id === etapaId);
      if (!etapa) return false;
      const payload =
        vencedor === "B"
          ? {
              titulo: etapa.ab_titulo_b || etapa.titulo,
              mensagem: etapa.ab_mensagem_b || etapa.mensagem,
              ab_ativo: false,
              ab_vencedor: "B",
              ab_decidido_em: new Date().toISOString(),
            }
          : {
              ab_ativo: false,
              ab_vencedor: "A",
              ab_decidido_em: new Date().toISOString(),
            };
      const { error } = await supabase.from("nutricao_etapas").update(payload).eq("id", etapaId);
      if (error) {
        toast({ title: "Erro ao aplicar vencedor", description: error.message, variant: "destructive" });
        return false;
      }
      toast({ title: `Variante ${vencedor} definida como oficial` });
      await fetchAll();
      return true;
    },
    [etapas, toast, fetchAll],
  );

  /** Reabre o teste A/B da etapa (limpa o vencedor registrado). */
  const reabrirTesteAB = useCallback(
    async (etapaId: string) => {
      const { error } = await supabase
        .from("nutricao_etapas")
        .update({ ab_ativo: true, ab_vencedor: null, ab_decidido_em: null })
        .eq("id", etapaId);
      if (error) {
        toast({ title: "Erro ao reabrir teste", description: error.message, variant: "destructive" });
        return;
      }
      await fetchAll();
    },
    [toast, fetchAll],
  );

  return {
    fluxos,
    etapas,
    inscricoes,
    envios,
    loading,
    processando,
    fetchAll,
    salvarFluxo,
    toggleFluxo,
    excluirFluxo,
    criarModelos,
    processarAgora,
    marcarEnvio,
    encerrarInscricao,
    aplicarVencedorAB,
    reabrirTesteAB,
  };
}
