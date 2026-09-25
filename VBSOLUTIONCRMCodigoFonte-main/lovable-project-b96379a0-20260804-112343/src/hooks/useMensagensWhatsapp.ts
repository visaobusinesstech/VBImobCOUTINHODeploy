import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface MensagemWhatsapp {
  id: string;
  imobiliaria_id: string;
  lead_id: string | null;
  cliente_id: string | null;
  proprietario_id: string | null;
  corretor_id: string | null;
  telefone_destino: string;
  nome_contato: string;
  mensagem: string;
  direcao: string;
  contexto: string | null;
  created_at: string;
}

interface NovaMensagem {
  telefone_destino: string;
  nome_contato: string;
  mensagem: string;
  direcao?: string;
  contexto?: string;
  lead_id?: string;
  cliente_id?: string;
  proprietario_id?: string;
  corretor_id?: string;
}

export function useMensagensWhatsapp() {
  const { imobiliariaId } = useAuth();
  const { toast } = useToast();
  const [mensagens, setMensagens] = useState<MensagemWhatsapp[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMensagens = useCallback(async () => {
    if (!imobiliariaId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("mensagens_whatsapp")
      .select("*")
      .eq("imobiliaria_id", imobiliariaId)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      console.error("Erro ao buscar mensagens:", error);
    } else {
      setMensagens((data as MensagemWhatsapp[]) || []);
    }
    setLoading(false);
  }, [imobiliariaId]);

  useEffect(() => {
    fetchMensagens();
  }, [fetchMensagens]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("mensagens-whatsapp-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "mensagens_whatsapp" }, () => {
        fetchMensagens();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchMensagens]);

  const registrarMensagem = useCallback(async (msg: NovaMensagem) => {
    if (!imobiliariaId) return;
    const { error } = await supabase.from("mensagens_whatsapp").insert({
      imobiliaria_id: imobiliariaId,
      telefone_destino: msg.telefone_destino,
      nome_contato: msg.nome_contato,
      mensagem: msg.mensagem,
      direcao: msg.direcao || "enviada",
      contexto: msg.contexto || null,
      lead_id: msg.lead_id || null,
      cliente_id: msg.cliente_id || null,
      proprietario_id: msg.proprietario_id || null,
      corretor_id: msg.corretor_id || null,
    } as any);

    if (error) {
      toast({ title: "Erro ao registrar mensagem", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Mensagem registrada!" });
    }
  }, [imobiliariaId, toast]);

  const deletarMensagem = useCallback(async (id: string) => {
    const { error } = await supabase.from("mensagens_whatsapp").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao deletar", description: error.message, variant: "destructive" });
    }
  }, [toast]);

  return { mensagens, loading, registrarMensagem, deletarMensagem, refetch: fetchMensagens };
}
