import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface ConteudoSEO {
  id: string;
  imobiliaria_id: string;
  imovel_id: string | null;
  tipo: string;
  titulo: string;
  conteudo: any;
  created_at: string;
  updated_at: string;
}

export function useConteudosSEO() {
  const { toast } = useToast();
  const [conteudos, setConteudos] = useState<ConteudoSEO[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConteudos = async () => {
    const { data: profile } = await supabase.rpc("get_user_imobiliaria_id");
    if (!profile) return;

    const { data, error } = await supabase
      .from("conteudos_seo")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erro ao carregar conteúdos SEO:", error);
    } else {
      setConteudos((data as any[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchConteudos(); }, []);

  const salvarConteudo = async (params: { tipo: string; titulo: string; conteudo: any; imovel_id?: string }) => {
    const imobiliaria_id = await supabase.rpc("get_user_imobiliaria_id");
    if (!imobiliaria_id.data) {
      toast({ title: "Erro", description: "Imobiliária não encontrada", variant: "destructive" });
      return null;
    }

    const { data, error } = await supabase
      .from("conteudos_seo")
      .insert({
        imobiliaria_id: imobiliaria_id.data,
        tipo: params.tipo,
        titulo: params.titulo,
        conteudo: params.conteudo,
        imovel_id: params.imovel_id || null,
      } as any)
      .select()
      .single();

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return null;
    }

    toast({ title: "Conteúdo salvo!", description: "O conteúdo foi salvo no histórico." });
    fetchConteudos();
    return data;
  };

  const deletarConteudo = async (id: string) => {
    const { error } = await supabase.from("conteudos_seo").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Conteúdo excluído" });
      fetchConteudos();
    }
  };

  const atualizarEmMassa = async (
    ids: string[],
    patch: { status?: "rascunho" | "publicado"; cidade?: string | null; bairro?: string | null; publicado_em?: string | null }
  ) => {
    if (!ids.length) return { ok: 0, fail: 0 };
    const payload: any = { ...patch, updated_at: new Date().toISOString() };
    const { error, data } = await supabase
      .from("conteudos_seo")
      .update(payload)
      .in("id", ids)
      .select("id");
    if (error) {
      toast({ title: "Erro na ação em lote", description: error.message, variant: "destructive" });
      return { ok: 0, fail: ids.length };
    }
    const ok = (data || []).length;
    toast({ title: "Ação em lote concluída", description: `${ok} de ${ids.length} atualizado(s).` });
    fetchConteudos();
    return { ok, fail: ids.length - ok };
  };

  const reverterEdicaoLote = async (
    snapshots: Array<{ id: string; status?: string | null; cidade?: string | null; bairro?: string | null; publicado_em?: string | null }>
  ) => {
    if (!snapshots.length) return { ok: 0, fail: 0 };
    const results = await Promise.all(
      snapshots.map((s) =>
        supabase
          .from("conteudos_seo")
          .update({
            status: s.status ?? null,
            cidade: s.cidade ?? null,
            bairro: s.bairro ?? null,
            publicado_em: s.publicado_em ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", s.id)
          .select("id")
      )
    );
    const ok = results.filter((r) => !r.error && (r.data || []).length).length;
    const fail = snapshots.length - ok;
    if (fail > 0) {
      toast({ title: "Reversão parcial", description: `${ok} revertido(s), ${fail} falharam.`, variant: "destructive" });
    } else {
      toast({ title: "Edição em lote revertida", description: `${ok} registro(s) restaurados.` });
    }
    fetchConteudos();
    return { ok, fail };
  };

  const excluirEmMassa = async (ids: string[]) => {
    if (!ids.length) return { ok: 0 };
    const { error, data } = await supabase.from("conteudos_seo").delete().in("id", ids).select("id");
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
      return { ok: 0 };
    }
    const ok = (data || []).length;
    toast({ title: "Excluídos", description: `${ok} registro(s) removido(s).` });
    fetchConteudos();
    return { ok };
  };

  return { conteudos, loading, salvarConteudo, deletarConteudo, atualizarEmMassa, reverterEdicaoLote, excluirEmMassa, refetch: fetchConteudos };
}
