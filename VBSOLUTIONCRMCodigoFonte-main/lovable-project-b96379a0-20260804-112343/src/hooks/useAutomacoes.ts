import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface Automacao {
  id: string;
  imobiliaria_id: string;
  nome: string;
  trigger_desc: string;
  acao: string;
  tipo: string;
  categoria: string;
  ativo: boolean;
  execucoes: number;
  ultima_execucao: string | null;
  plataforma_url: string | null;
  plataforma_nome: string | null;
}

const defaultAutomacoes = [
  { nome: "Boas-vindas novo lead", trigger_desc: "Lead criado", acao: "Enviar WhatsApp de boas-vindas", tipo: "whatsapp", categoria: "comunicacao", ativo: true, execucoes: 0, plataforma_url: "https://business.whatsapp.com", plataforma_nome: "WhatsApp Business" },
  { nome: "Follow-up 48h", trigger_desc: "Lead parado há 2 dias", acao: "Enviar e-mail de follow-up", tipo: "email", categoria: "comunicacao", ativo: true, execucoes: 0, plataforma_url: "https://mail.google.com", plataforma_nome: "Gmail" },
  { nome: "Alerta proposta", trigger_desc: "Proposta enviada", acao: "Notificar gerente", tipo: "notificacao", categoria: "comunicacao", ativo: true, execucoes: 0 },
  { nome: "Reativar inativos", trigger_desc: "Lead parado há 30 dias", acao: "Enviar campanha de reativação", tipo: "email", categoria: "comunicacao", ativo: true, execucoes: 0, plataforma_url: "https://mail.google.com", plataforma_nome: "Gmail" },
  { nome: "Aniversário do cliente", trigger_desc: "Data comemorativa", acao: "Enviar mensagem personalizada", tipo: "whatsapp", categoria: "comunicacao", ativo: true, execucoes: 0, plataforma_url: "https://business.whatsapp.com", plataforma_nome: "WhatsApp Business" },
  { nome: "Contrato a vencer", trigger_desc: "30 dias antes do vencimento", acao: "Criar tarefa de renovação", tipo: "tarefa", categoria: "comunicacao", ativo: true, execucoes: 0 },
  { nome: "Publicar no ZAP Imóveis", trigger_desc: "Imóvel ativado", acao: "Gerar XML e enviar ao portal", tipo: "portal", categoria: "portal", ativo: true, execucoes: 0, plataforma_url: "https://www.zapimoveis.com.br", plataforma_nome: "ZAP Imóveis" },
  { nome: "Publicar no VivaReal", trigger_desc: "Imóvel ativado", acao: "Exportar via API do portal", tipo: "portal", categoria: "portal", ativo: true, execucoes: 0, plataforma_url: "https://www.vivareal.com.br", plataforma_nome: "VivaReal" },
  { nome: "Publicar no OLX", trigger_desc: "Imóvel ativado", acao: "Enviar anúncio automático", tipo: "portal", categoria: "portal", ativo: true, execucoes: 0, plataforma_url: "https://www.olx.com.br", plataforma_nome: "OLX" },
  { nome: "Atualizar preço nos portais", trigger_desc: "Preço alterado", acao: "Sincronizar preço em todos os portais", tipo: "portal", categoria: "portal", ativo: true, execucoes: 0 },
  { nome: "Remover de portais", trigger_desc: "Imóvel desativado", acao: "Remover anúncio de todos os portais", tipo: "portal", categoria: "portal", ativo: true, execucoes: 0 },
  { nome: "Post no Instagram", trigger_desc: "Imóvel ativado", acao: "Criar post com fotos e descrição", tipo: "social", categoria: "social", ativo: true, execucoes: 0, plataforma_url: "https://www.instagram.com", plataforma_nome: "Instagram" },
  { nome: "Story no Instagram", trigger_desc: "Visita realizada", acao: "Criar story com destaque", tipo: "social", categoria: "social", ativo: true, execucoes: 0, plataforma_url: "https://www.instagram.com", plataforma_nome: "Instagram" },
  { nome: "Post no Facebook", trigger_desc: "Imóvel ativado", acao: "Publicar no feed e marketplace", tipo: "social", categoria: "social", ativo: true, execucoes: 0, plataforma_url: "https://www.facebook.com", plataforma_nome: "Facebook" },
  { nome: "Reels de tour virtual", trigger_desc: "Tour virtual adicionado", acao: "Gerar reels e publicar", tipo: "social", categoria: "social", ativo: true, execucoes: 0, plataforma_url: "https://www.instagram.com/reels", plataforma_nome: "Instagram Reels" },
  { nome: "Cobrança automática", trigger_desc: "Vencimento em 5 dias", acao: "Enviar boleto e link de pagamento", tipo: "pagamento", categoria: "financeiro", ativo: true, execucoes: 0, plataforma_url: "https://www.asaas.com", plataforma_nome: "Asaas" },
  { nome: "Lembrete de pagamento", trigger_desc: "Pagamento atrasado", acao: "Enviar WhatsApp com link de pagamento", tipo: "pagamento", categoria: "financeiro", ativo: true, execucoes: 0, plataforma_url: "https://business.whatsapp.com", plataforma_nome: "WhatsApp Business" },
  { nome: "Multa e juros automáticos", trigger_desc: "Pagamento atrasado > 1 dia", acao: "Calcular multa/juros e atualizar cobrança", tipo: "pagamento", categoria: "financeiro", ativo: true, execucoes: 0, plataforma_url: "https://www.asaas.com", plataforma_nome: "Asaas" },
  { nome: "Baixa automática", trigger_desc: "Pagamento confirmado", acao: "Confirmar pagamento e notificar", tipo: "pagamento", categoria: "financeiro", ativo: true, execucoes: 0 },
  { nome: "Enviar contrato para assinatura", trigger_desc: "Proposta aceita", acao: "Gerar contrato e enviar para assinatura digital", tipo: "assinatura", categoria: "financeiro", ativo: true, execucoes: 0, plataforma_url: "https://www.d4sign.com.br", plataforma_nome: "D4Sign" },
  { nome: "Confirmar assinatura", trigger_desc: "Assinatura concluída", acao: "Atualizar status e armazenar PDF", tipo: "assinatura", categoria: "financeiro", ativo: true, execucoes: 0, plataforma_url: "https://www.d4sign.com.br", plataforma_nome: "D4Sign" },
  { nome: "Repasse ao proprietário", trigger_desc: "Pagamento confirmado", acao: "Calcular comissão e gerar repasse", tipo: "pagamento", categoria: "financeiro", ativo: true, execucoes: 0, plataforma_url: "https://www.asaas.com", plataforma_nome: "Asaas" },
];

export function useAutomacoes() {
  const { user, imobiliariaId } = useAuth();
  const { toast } = useToast();
  const [automacoes, setAutomacoes] = useState<Automacao[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("automacoes")
      .select("*")
      .order("created_at");

    if (error) {
      toast({ title: "Erro ao carregar automações", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    // Seed defaults on first use
    if (data.length === 0) {
      const rows = defaultAutomacoes.map((a) => ({ ...a, imobiliaria_id: imobiliariaId }));
      const { data: inserted, error: insertErr } = await supabase.from("automacoes").insert(rows).select();
      if (insertErr) {
        toast({ title: "Erro ao criar automações padrão", description: insertErr.message, variant: "destructive" });
      } else {
        setAutomacoes(inserted as Automacao[]);
      }
      setLoading(false);
      return;
    }

    setAutomacoes(data as Automacao[]);
    setLoading(false);
  }, [user, toast]);

  useEffect(() => { fetch(); }, [fetch]);

  const toggleAtivo = async (id: string, ativo: boolean) => {
    const { error } = await supabase.from("automacoes").update({ ativo }).eq("id", id);
    if (error) {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
      return;
    }
    setAutomacoes((prev) => prev.map((a) => (a.id === id ? { ...a, ativo } : a)));
  };

  const updateAutomacao = async (id: string, data: { nome: string; trigger_desc: string; acao: string }) => {
    const { error } = await supabase.from("automacoes").update(data).eq("id", id);
    if (error) {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
      return;
    }
    setAutomacoes((prev) => prev.map((a) => (a.id === id ? { ...a, ...data } : a)));
    toast({ title: "Automação atualizada!" });
  };

  const createAutomacao = async (data: Omit<Automacao, "id" | "imobiliaria_id" | "execucoes" | "ultima_execucao">) => {
    if (!user) return;
    const { data: created, error } = await supabase
      .from("automacoes")
      .insert({ ...data, imobiliaria_id: imobiliariaId, execucoes: 0 })
      .select()
      .single();
    if (error) {
      toast({ title: "Erro ao criar automação", description: error.message, variant: "destructive" });
      return;
    }
    setAutomacoes((prev) => [...prev, created as Automacao]);
    toast({ title: "Automação criada!" });
  };

  const deleteAutomacao = async (id: string) => {
    const { error } = await supabase.from("automacoes").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
      return;
    }
    setAutomacoes((prev) => prev.filter((a) => a.id !== id));
    toast({ title: "Automação excluída!" });
  };

  return { automacoes, loading, toggleAtivo, updateAutomacao, createAutomacao, deleteAutomacao, refetch: fetch };
}
