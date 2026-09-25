import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { mensagemErroComLimite } from "@/lib/planoLimiteError";


export interface Imovel {
  id: string;
  imobiliaria_id: string;
  titulo: string;
  tipo: string;
  operacao: string;
  preco: number;
  endereco: string | null;
  cidade: string | null;
  bairro: string | null;
  estado: string | null;
  cep: string | null;
  quartos: number;
  banheiros: number;
  suites: number;
  vagas: number;
  area: number;
  descricao: string | null;
  status: string;
  exclusivo: boolean;
  destaque: boolean;
  aceita_permuta: boolean;
  aceita_financiamento: boolean;
  aceita_fgts: boolean;
  tem_escritura: boolean;
  valor_condominio: number;
  valor_iptu: number;
  andar: string | null;
  posicao_solar: string | null;
  fotos: string[] | null;
  foto_capa_index: number | null;
  comissao_percentual: number | null;
  caracteristicas?: string[] | null;
  estado_conservacao?: string | null;
  exclusividade_inicio: string | null;
  exclusividade_fim: string | null;
  documentos_matricula: string[] | null;
  documentos_iptu: string[] | null;
  documentos_outros: string[] | null;
  videos: string[] | null;
  created_at: string;
  updated_at: string;
}

export type ImovelInsert = Omit<Imovel, "id" | "created_at" | "updated_at">;

type UseImoveisOptions = {
  suppressFetchErrors?: boolean;
  enabled?: boolean;
};

export function useImoveis(options: UseImoveisOptions = {}) {
  const { user, imobiliariaId } = useAuth();
  const { toast } = useToast();
  const { suppressFetchErrors = false, enabled = true } = options;
  const [imoveis, setImoveis] = useState<Imovel[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchingRef = useRef(false);

  const fetchImoveis = useCallback(async (attempt = 1) => {
    if (!user || !imobiliariaId) {
      setImoveis([]);
      setLoading(false);
      return;
    }

    if (!enabled) {
      setLoading(false);
      return;
    }

    if (fetchingRef.current) return;

    fetchingRef.current = true;
    setLoading(true);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const { data, error } = await supabase
        .from("imoveis")
        .select("*")
        .eq("imobiliaria_id", imobiliariaId)
        .order("created_at", { ascending: false })
        .abortSignal(controller.signal);

      clearTimeout(timeout);
      if (error) throw error;
      setImoveis((data as unknown as Imovel[]) ?? []);
    } catch (err: any) {
      clearTimeout(timeout);

      if (err.name === "AbortError" && attempt < 3) {
        fetchingRef.current = false;
        return fetchImoveis(attempt + 1);
      }

      if (!suppressFetchErrors) {
        if (err.name === "AbortError") {
          toast({ title: "Conexão lenta", description: "Não foi possível carregar imóveis. Tente novamente.", variant: "destructive" });
        } else {
          toast({ title: "Erro ao carregar imóveis", description: err.message, variant: "destructive" });
        }
      }
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [user, imobiliariaId, toast, suppressFetchErrors, enabled]);

  useEffect(() => {
    if (!enabled || !user || !imobiliariaId) {
      setImoveis([]);
      setLoading(false);
      return;
    }

    fetchImoveis();
  }, [user, imobiliariaId, fetchImoveis]);

  const createImovel = async (imovel: Partial<ImovelInsert>, options?: { silent?: boolean }) => {
    if (!user) return null;

    // Duplicate check only when we have strong enough identity data
    const titulo = imovel.titulo?.trim().toLowerCase();
    const endereco = imovel.endereco?.trim().toLowerCase();
    const preco = typeof imovel.preco === "number" && imovel.preco > 0 ? imovel.preco : null;
    const area = typeof imovel.area === "number" && imovel.area > 0 ? imovel.area : null;

    if (titulo && (endereco || preco !== null || area !== null)) {
      let query = supabase
        .from("imoveis")
        .select("id, titulo, endereco, preco, area")
        .eq("imobiliaria_id", imobiliariaId as string)
        .ilike("titulo", titulo);

      if (endereco) {
        query = query.ilike("endereco", endereco);
      } else {
        if (preco !== null) {
          query = query.eq("preco", preco);
        }
        if (area !== null) {
          query = query.eq("area", area);
        }
      }

      const { data: matches } = await query.limit(1);
      if (matches && matches.length > 0) {
        if (!options?.silent) {
          toast({
            title: "⚠️ Imóvel possivelmente duplicado",
            description: `Já existe "${matches[0].titulo}"${matches[0].endereco ? ` em "${matches[0].endereco}"` : " com dados semelhantes"}. Verifique antes de cadastrar.`,
            variant: "destructive",
          });
        }
        return null;
      }
    }

    const payload = { ...imovel, imobiliaria_id: imobiliariaId };
    const { data, error } = await supabase
      .from("imoveis")
      .insert(payload as any)
      .select()
      .single();

    if (error) {
      if (!options?.silent) {
        toast({ ...mensagemErroComLimite(error, "Erro ao criar imóvel"), variant: "destructive" });
      }
      return null;
    }

    if (!options?.silent) {
      toast({ title: "Imóvel cadastrado com sucesso!" });
    }
    if (!options?.silent) {
      await fetchImoveis();
    }
    return data;
  };

  const updateImovel = async (id: string, updates: Partial<ImovelInsert>) => {
    const { data, error } = await supabase
      .from("imoveis")
      .update(updates as any)
      .eq("id", id)
      .select();

    if (error) {
      toast({ title: "Erro ao atualizar imóvel", description: error.message, variant: "destructive" });
      return false;
    }
    if (!data || data.length === 0) {
      toast({ title: "Erro ao atualizar imóvel", description: "Nenhum registro foi alterado. Verifique se você tem permissão para editar este imóvel.", variant: "destructive" });
      return false;
    }
    toast({ title: "Imóvel atualizado!" });
    await fetchImoveis();
    return true;
  };

  const deleteImovel = async (id: string) => {
    // Nullify all FK references before deleting — log errors but continue
    const nullifyTasks = [
      { table: "contratos", promise: supabase.from("contratos").update({ imovel_id: null } as any).eq("imovel_id", id) },
      { table: "compromissos", promise: supabase.from("compromissos").update({ imovel_id: null } as any).eq("imovel_id", id) },
      { table: "conteudos_seo", promise: supabase.from("conteudos_seo").update({ imovel_id: null } as any).eq("imovel_id", id) },
      { table: "propostas", promise: supabase.from("propostas").update({ imovel_id: null } as any).eq("imovel_id", id) },
      { table: "transacoes", promise: supabase.from("transacoes").update({ imovel_id: null } as any).eq("imovel_id", id) },
      { table: "avaliacoes_historico", promise: supabase.from("avaliacoes_historico").update({ imovel_id: null } as any).eq("imovel_id", id) },
    ];

    for (const task of nullifyTasks) {
      const { error } = await task.promise;
      if (error) {
        console.warn(`[deleteImovel] Falha ao limpar ref em ${task.table}:`, error.message);
      }
    }

    const { error } = await supabase.from("imoveis").delete().eq("id", id);
    if (error) {
      console.error("[deleteImovel] Erro ao excluir:", error);
      // If FK violation, try to provide a helpful message
      const isFkError = error.message?.includes("violates foreign key") || error.code === "23503";
      toast({
        title: "Erro ao excluir imóvel",
        description: isFkError
          ? "Este imóvel está vinculado a contratos ou transações que não puderam ser desvinculados. Tente remover os vínculos manualmente primeiro."
          : error.message,
        variant: "destructive",
      });
      return false;
    }
    toast({ title: "Imóvel excluído!" });
    await fetchImoveis();
    return true;
  };

  const uploadFotos = async (files: File[]): Promise<string[]> => {
    if (!user) return [];
    const urls: string[] = [];
    for (const file of files) {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("imoveis").upload(path, file);
      if (error) {
        toast({ title: "Erro ao fazer upload", description: error.message, variant: "destructive" });
        continue;
      }
      const { data } = supabase.storage.from("imoveis").getPublicUrl(path);
      urls.push(data.publicUrl);
    }
    return urls;
  };

  /** Upload documents to private bucket (imoveis-docs) — returns storage paths (not public URLs) */
  const uploadDocs = async (files: File[]): Promise<string[]> => {
    if (!user) return [];
    const paths: string[] = [];
    for (const file of files) {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("imoveis-docs").upload(path, file);
      if (error) {
        toast({ title: "Erro ao fazer upload do documento", description: error.message, variant: "destructive" });
        continue;
      }
      // Store as "private::" prefixed path so we can differentiate from public URLs
      paths.push(`private::imoveis-docs::${path}`);
    }
    return paths;
  };

  return { imoveis, loading, createImovel, updateImovel, deleteImovel, uploadFotos, uploadDocs, refetch: fetchImoveis };
}
