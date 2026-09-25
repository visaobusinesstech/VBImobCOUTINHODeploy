import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Download, Loader2, ListChecks, Sparkles, Eraser, ExternalLink, Copy, Search, X, Images, MessageCircle, AlertTriangle, ImagePlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { exportToExcel } from "@/lib/exportExcel";
import { ESTADOS_BRASIL, BAIRROS_BRASILIA } from "@/lib/brasilLocalidades";
import { normalizeExternalUrl, openExternalUrl } from "@/lib/externalUrl";
import { useWhatsappCaptacaoTemplate } from "@/hooks/useWhatsappCaptacaoTemplate";
import { renderTemplate, DEFAULT_TEMPLATE_BODY } from "@/lib/whatsappTemplate";
import { normalizeToE164 } from "@/lib/phoneE164";
import { useImoveis } from "@/hooks/useImoveis";

export type ListaProprietarioRecord = {
  id: string;
  nome_proprietario: string;
  telefone: string | null;
  email: string | null;
  operacao: string;
  titulo_imovel: string | null;
  bairro: string | null;
  cidade: string | null;
  preco: number | null;
  q_score: number | null;
  observacoes: string | null;
  origem: string | null;
  url_anuncio: string | null;
  imovel_id_ref: string | null;
  dados_extraidos_raw?: { fotos?: string[]; [k: string]: unknown } | null;
  created_at: string;
  status_revisao?: string | null;
};


interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ListaProprietariosDialog({ open, onOpenChange }: Props) {
  const { user, imobiliariaId } = useAuth();
  const { toast } = useToast();
  const { template: waTemplate } = useWhatsappCaptacaoTemplate();
  const [records, setRecords] = useState<ListaProprietarioRecord[]>([]);
  const [semLinkCount, setSemLinkCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"venda" | "aluguel">("venda");
  const [edits, setEdits] = useState<Record<string, { telefone?: string; email?: string; nome?: string }>>({});
  const [gerandoIA, setGerandoIA] = useState(false);
  const [estadoSel, setEstadoSel] = useState<string>("__all__");
  const [cidadeSel, setCidadeSel] = useState<string>("__all__");
  const [bairroSel, setBairroSel] = useState<string>("__all__");
  const [quantidade, setQuantidade] = useState<number>(50);
  const [precoMin, setPrecoMin] = useState<string>("");
  const [precoMax, setPrecoMax] = useState<string>("");
  const [localizacao, setLocalizacao] = useState<string>("");
  const [busca, setBusca] = useState<string>("");
  const [origemFiltro, setOrigemFiltro] = useState<string>("__all__");
  const [sortBy, setSortBy] = useState<string>("recentes");
  const [pageSize, setPageSize] = useState<number>(25);
  const [page, setPage] = useState<number>(1);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewRecord, setPreviewRecord] = useState<ListaProprietarioRecord | null>(null);
  const [previewFotos, setPreviewFotos] = useState<string[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewSource, setPreviewSource] = useState<"cache" | "live" | null>(null);
  const [previewPhotoInfo, setPreviewPhotoInfo] = useState<{ blocked?: boolean; block_reason?: string; strategy_stats?: Record<string, number> } | null>(null);
  const [uploadingManualFotos, setUploadingManualFotos] = useState(false);
  const { uploadFotos } = useImoveis();
  type LinkStatus = { ok: boolean; status: number | null; checked_at: string; error?: string; loading?: boolean };
  const [linkStatus, setLinkStatus] = useState<Record<string, LinkStatus>>({});
  type WaPreviewState = {
    record: ListaProprietarioRecord;
    mensagem: string;
    link: string;
    digits: string;
    e164: string;
    editing: boolean;
  };
  const [waPreview, setWaPreview] = useState<WaPreviewState | null>(null);
  const [waSending, setWaSending] = useState(false);


  const validarLinks = async (urls: string[]) => {
    const alvo = Array.from(new Set(urls.filter((u) => typeof u === "string" && /^https?:\/\//i.test(u))));
    if (alvo.length === 0) return;
    setLinkStatus((prev) => {
      const next = { ...prev };
      alvo.forEach((u) => { next[u] = { ...(next[u] || { ok: false, status: null, checked_at: "" }), loading: true }; });
      return next;
    });
    try {
      const { data, error } = await supabase.functions.invoke("check-anuncio-links", { body: { urls: alvo } });
      if (error) throw error;
      const results: Array<{ url: string; ok: boolean; status: number | null; checked_at: string; error?: string }> = data?.results || [];
      setLinkStatus((prev) => {
        const next = { ...prev };
        results.forEach((r) => { next[r.url] = { ok: r.ok, status: r.status, checked_at: r.checked_at, error: r.error, loading: false }; });
        // Mark unresolved as not loading
        alvo.forEach((u) => { if (next[u]?.loading) next[u] = { ...next[u], loading: false }; });
        return next;
      });
    } catch {
      setLinkStatus((prev) => {
        const next = { ...prev };
        alvo.forEach((u) => { next[u] = { ok: false, status: null, checked_at: new Date().toISOString(), error: "validação falhou", loading: false }; });
        return next;
      });
    }
  };


  const persistFotosNoRegistro = async (recordId: string, baseRaw: any, fotos: string[]) => {
    try {
      await supabase
        .from("lista_proprietarios_captacao")
        .update({ dados_extraidos_raw: { ...(baseRaw || {}), fotos } })
        .eq("id", recordId);
      setRecords((prev) => prev.map((it) => it.id === recordId
        ? { ...it, dados_extraidos_raw: { ...(it.dados_extraidos_raw || {}), fotos } }
        : it));
    } catch { /* silent */ }
  };

  const handleUploadManualPreviewFotos = async (files: File[]) => {
    if (!previewRecord || files.length === 0) return;
    setUploadingManualFotos(true);
    try {
      const uploaded = await uploadFotos(files);
      if (uploaded.length === 0) {
        toast({ title: "Falha no envio das fotos", variant: "destructive" });
        return;
      }
      const merged = Array.from(new Set([...(previewFotos || []), ...uploaded]));
      setPreviewFotos(merged);
      setPreviewSource("cache");
      await persistFotosNoRegistro(previewRecord.id, previewRecord.dados_extraidos_raw, merged);
      toast({ title: `${uploaded.length} foto(s) anexada(s) manualmente` });
    } finally {
      setUploadingManualFotos(false);
    }
  };

  const abrirPreviewFotos = async (r: ListaProprietarioRecord) => {
    setPreviewOpen(true);
    setPreviewRecord(r);
    setPreviewLoading(true);
    setPreviewFotos([]);
    setPreviewSource(null);
    setPreviewPhotoInfo(null);

    const cached = Array.isArray(r.dados_extraidos_raw?.fotos)
      ? (r.dados_extraidos_raw!.fotos as string[]).filter((u) => typeof u === "string" && u)
      : [];

    if (cached.length > 0) {
      setPreviewFotos(cached);
      setPreviewSource("cache");
      setPreviewLoading(false);
      return;
    }

    if (!r.url_anuncio) {
      setPreviewLoading(false);
      toast({ title: "Sem link", description: "Este registro não tem link do anúncio para extrair imagens. Você pode anexar fotos manualmente abaixo." });
      return;
    }

    try {
      const { invokeWithRetry } = await import("@/lib/retryExtracao");
      const { data, error } = await invokeWithRetry(
        () => supabase.functions.invoke("extrair-dados-anuncio", { body: { url: r.url_anuncio } }),
        { onRetry: ({ attempt, delayMs }) => console.warn(`[lista-proprietarios] retry ${attempt} em ${Math.round(delayMs)}ms`) },
      );
      if (error) throw error;
      const photoExtraction = data?.photo_extraction ?? data?.data?.photo_extraction ?? null;
      setPreviewPhotoInfo(photoExtraction);
      const fotos: string[] = Array.isArray(data?.data?.fotos)
        ? data.data.fotos
        : Array.isArray(data?.fotos)
          ? data.fotos
          : [];
      setPreviewFotos(fotos);
      setPreviewSource("live");
      if (fotos.length === 0) {
        if (data?.error_code === "PORTAL_BLOCKED_TRY_MANUAL_UPLOAD" || photoExtraction?.blocked) {
          toast({ title: "Portal bloqueou a coleta", description: "Proteção anti-bot ativada. Anexe as fotos manualmente." });
        } else {
          toast({ title: "Nenhuma imagem pública", description: "Este anúncio não expôs fotos publicamente. Você pode anexá-las manualmente." });
        }
      } else {
        await persistFotosNoRegistro(r.id, r.dados_extraidos_raw, fotos);
      }
    } catch (e: any) {
      toast({ title: "Falha ao extrair imagens", description: e?.message || "Tente novamente ou anexe as fotos manualmente.", variant: "destructive" });
    } finally {
      setPreviewLoading(false);
    }
  };


  const getListaErrorMessage = (error: { code?: string; message?: string } | null) => {
    if (!error) return "Ocorreu um erro ao salvar o contato.";
    if (error.code === "23505") return "Este telefone já existe nesta lista para a mesma operação.";
    if (error.code === "42501") return "Seu login não tinha permissão para alterar esta lista.";
    return error.message || "Ocorreu um erro ao salvar o contato.";
  };

  const cidadesDoEstado = useMemo(() => {
    if (estadoSel === "__all__") return [];
    return ESTADOS_BRASIL.find((e) => e.uf === estadoSel)?.cidades || [];
  }, [estadoSel]);

  const bairrosDaCidade = useMemo(() => {
    if (estadoSel === "DF" && cidadeSel === "Brasília") return BAIRROS_BRASILIA;
    return [];
  }, [estadoSel, cidadeSel]);

  const gerarBrasilIA = async () => {
    setGerandoIA(true);
    try {
      const { data, error } = await supabase.functions.invoke("gerar-proprietarios-brasil", {
        body: {
          operacao: tab,
          quantidade,
          estado: estadoSel !== "__all__" ? estadoSel : undefined,
          cidade: cidadeSel !== "__all__" ? cidadeSel : undefined,
          bairro: bairroSel !== "__all__" ? bairroSel : undefined,
          preco_min: precoMin ? Number(precoMin) : undefined,
          preco_max: precoMax ? Number(precoMax) : undefined,
          localizacao: localizacao.trim() || undefined,
        },
      });

      const functionPayload = data as { success?: boolean; total?: number; error?: string; code?: string } | null;
      const functionErrorMessage = functionPayload?.error;

      if (error) {
        throw new Error(functionErrorMessage || error.message || "Falha ao executar a geração por IA.");
      }

      if (functionPayload?.success === false || functionErrorMessage) {
        throw new Error(functionErrorMessage || "Falha ao executar a geração por IA.");
      }

      toast({ title: "Lista gerada!", description: `${data.total} proprietários de ${tab} adicionados.` });
      fetchRecords();
    } catch (e: any) {
      toast({ title: "Erro ao gerar", description: e.message || "Não foi possível gerar a lista agora.", variant: "destructive" });
    } finally {
      setGerandoIA(false);
    }
  };

  const fetchRecords = async () => {
    if (!user || !imobiliariaId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("lista_proprietarios_captacao")
      .select("*")
      .eq("imobiliaria_id", imobiliariaId)
      .order("created_at", { ascending: false });
    if (!error && data) {
      const all = data as ListaProprietarioRecord[];
      // Regra de negócio: só exibimos anúncios com link de referência público válido.
      const recs = all.filter((r) => !!normalizeExternalUrl(r.url_anuncio));
      setRecords(recs);
      setSemLinkCount(all.length - recs.length);
      const urls = recs.map((r) => r.url_anuncio).filter((u): u is string => !!u);
      validarLinks(urls);
    }
    setLoading(false);
  };


  useEffect(() => {
    if (open) fetchRecords();
  }, [open, user, imobiliariaId]);

  const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  const origensDisponiveis = useMemo(() => {
    const set = new Set<string>();
    records.filter((r) => (r.operacao || "venda").toLowerCase() === tab).forEach((r) => {
      if (r.origem) set.add(r.origem);
    });
    return Array.from(set).sort();
  }, [records, tab]);

  const filtered = useMemo(() => {
    const q = norm(busca.trim());
    return records.filter((r) => {
      if ((r.operacao || "venda").toLowerCase() !== tab) return false;
      if (origemFiltro !== "__all__" && (r.origem || "") !== origemFiltro) return false;
      if (!q) return true;
      const haystack = [r.nome_proprietario, r.telefone, r.email, r.titulo_imovel, r.bairro, r.cidade, r.origem]
        .filter(Boolean)
        .map((v) => norm(String(v)))
        .join(" ");
      return haystack.includes(q);
    });
  }, [records, tab, busca, origemFiltro]);

  const sortedFiltered = useMemo(() => {
    const arr = [...filtered];
    const cmpStr = (a?: string | null, b?: string | null) => (a || "").localeCompare(b || "", "pt-BR");
    switch (sortBy) {
      case "antigos":
        arr.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        break;
      case "preco_asc":
        arr.sort((a, b) => (a.preco ?? Infinity) - (b.preco ?? Infinity));
        break;
      case "preco_desc":
        arr.sort((a, b) => (b.preco ?? -Infinity) - (a.preco ?? -Infinity));
        break;
      case "nome_asc":
        arr.sort((a, b) => cmpStr(a.nome_proprietario, b.nome_proprietario));
        break;
      case "nome_desc":
        arr.sort((a, b) => cmpStr(b.nome_proprietario, a.nome_proprietario));
        break;
      case "qscore_desc":
        arr.sort((a, b) => (b.q_score ?? -Infinity) - (a.q_score ?? -Infinity));
        break;
      case "bairro":
        arr.sort((a, b) => cmpStr(a.bairro, b.bairro));
        break;
      case "recentes":
      default:
        arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    return arr;
  }, [filtered, sortBy]);

  const totalPaginas = Math.max(1, Math.ceil(sortedFiltered.length / pageSize));
  const pageSafe = Math.min(page, totalPaginas);
  const pageItems = useMemo(() => {
    const start = (pageSafe - 1) * pageSize;
    return sortedFiltered.slice(start, start + pageSize);
  }, [sortedFiltered, pageSafe, pageSize]);

  useEffect(() => { setPage(1); }, [tab, busca, origemFiltro, sortBy, pageSize]);

  const handleSaveField = async (id: string) => {
    const patch = edits[id];
    if (!patch) return;


    // Filter out undefined fields to avoid sending them in the update
    const updatePayload: any = {};
    if (patch.nome !== undefined) updatePayload.nome_proprietario = patch.nome;
    if (patch.telefone !== undefined) updatePayload.telefone = patch.telefone;
    if (patch.email !== undefined) updatePayload.email = patch.email;

    if (Object.keys(updatePayload).length === 0) return;

    const { error } = await supabase
      .from("lista_proprietarios_captacao")
      .update({
        ...updatePayload
      })
      .eq("id", id);

    if (error) {
      toast({ title: "Erro ao salvar", description: getListaErrorMessage(error), variant: "destructive" });
      return;
    }
    toast({ title: "Atualizado" });
    setEdits((prev) => { const { [id]: _, ...rest } = prev; return rest; });
    fetchRecords();
  };

  const handleDelete = async (id: string) => {
    if (!imobiliariaId) return;
    const { data, error } = await supabase
      .from("lista_proprietarios_captacao")
      .delete()
      .eq("id", id)
      .eq("imobiliaria_id", imobiliariaId)
      .select("id");
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    if (!data?.length) {
      toast({ title: "Sem permissão", description: "Este contato não pode ser removido por este login.", variant: "destructive" });
      return;
    }
    setRecords((prev) => prev.filter((r) => r.id !== id));
  };

  const handleWhatsappContato = (r: ListaProprietarioRecord) => {
    const telefoneAtual = edits[r.id]?.telefone ?? r.telefone ?? "";
    const e164 = normalizeToE164(telefoneAtual);
    if (!e164.ok || !e164.digits || !e164.e164) {
      toast({
        title: "Telefone inválido",
        description: e164.message || "Cadastre um telefone válido no formato E.164 (ex.: +5511987654321).",
        variant: "destructive",
      });
      return;
    }
    const link = normalizeExternalUrl(r.url_anuncio) ?? r.url_anuncio ?? "";
    if (!link) {
      toast({ title: "Sem link do anúncio", description: "Este registro não possui url_anuncio válido.", variant: "destructive" });
      return;
    }
    const saudacao = r.nome_proprietario ? `Olá, ${r.nome_proprietario.split(" ")[0]}!` : "Olá!";
    const imovelDesc = [r.titulo_imovel, r.bairro, r.cidade].filter(Boolean).join(" · ") || "seu imóvel anunciado";
    const body = waTemplate?.template_body || DEFAULT_TEMPLATE_BODY;
    const values: Record<string, string> = {
      saudacao,
      descricao: imovelDesc,
      url_anuncio: link,
      nome: r.nome_proprietario || "",
      primeiro_nome: r.nome_proprietario ? r.nome_proprietario.split(" ")[0] : "",
      bairro: r.bairro || "",
      cidade: r.cidade || "",
      titulo: r.titulo_imovel || "",
      link,
    };
    const mensagem = renderTemplate(body, values).trim();

    setWaPreview({
      record: r,
      mensagem,
      link,
      digits: e164.digits,
      e164: e164.e164,
      editing: false,
    });
  };

  const confirmWhatsappSend = async () => {
    if (!waPreview) return;
    const { record, mensagem, digits, link } = waPreview;
    if (!mensagem.trim()) {
      toast({ title: "Mensagem vazia", description: "Digite a mensagem antes de enviar.", variant: "destructive" });
      return;
    }
    if (!link) {
      toast({ title: "Sem link do anúncio", description: "O link do anúncio é obrigatório.", variant: "destructive" });
      return;
    }
    setWaSending(true);
    try {
      const { data, error } = await supabase.rpc("register_whatsapp_contato_captacao", {
        p_lista_id: record.id,
        p_mensagem: mensagem,
      });
      if (error) {
        toast({ title: "Erro ao registrar contato", description: error.message, variant: "destructive" });
        return;
      }
      const result = data as { allowed: boolean; reason?: string; next_allowed_at?: string } | null;
      if (!result?.allowed) {
        if (result?.reason === "rate_limited" && result.next_allowed_at) {
          const proxima = new Date(result.next_allowed_at).toLocaleString("pt-BR");
          toast({
            title: "Aguarde para reenviar",
            description: `Já houve contato via WhatsApp com este proprietário nos últimos 7 dias. Próximo envio liberado em ${proxima}.`,
            variant: "destructive",
          });
        } else if (result?.reason === "invalid_phone") {
          toast({ title: "Telefone inválido", description: "Ajuste o número antes de enviar.", variant: "destructive" });
        } else {
          toast({ title: "Envio bloqueado", description: result?.reason || "Não foi possível registrar o contato.", variant: "destructive" });
        }
        return;
      }
      const waUrl = `https://wa.me/${digits}?text=${encodeURIComponent(mensagem)}`;
      window.open(waUrl, "_blank", "noopener,noreferrer");
      toast({ title: "WhatsApp aberto", description: "Contato registrado. Novo envio para este número liberado em 7 dias." });
      setWaPreview(null);
    } finally {
      setWaSending(false);
    }
  };



  const handleClearList = async () => {
    if (!user || !imobiliariaId) return;
    const alvo = filtered;
    if (alvo.length === 0) {
      toast({ title: "Lista vazia", description: `Nenhum registro de ${tab} para limpar.` });
      return;
    }
    if (!confirm(`Tem certeza que deseja apagar TODOS os ${alvo.length} registros de ${tab}?`)) return;

    const { data, error } = await supabase
      .from("lista_proprietarios_captacao")
      .delete()
      .eq("imobiliaria_id", imobiliariaId)
      .eq("operacao", tab)
      .select("id");

    if (error) {
      toast({ title: "Erro ao limpar", description: error.message, variant: "destructive" });
    } else if ((data?.length || 0) === 0) {
      toast({ title: "Nada removido", description: "Os registros pertencem a outro usuário (sem permissão).", variant: "destructive" });
    } else {
      toast({ title: "Lista limpa", description: `${data?.length || 0} registros removidos.` });
    }
    fetchRecords();
  };

  const handleExport = () => {
    // Dedupe by phone (digits-only) or email (lowercase). Keeps first occurrence.
    const seen = new Set<string>();
    let duplicates = 0;
    const unique = filtered.filter((r) => {
      const phone = (r.telefone || "").replace(/\D/g, "");
      const email = (r.email || "").trim().toLowerCase();
      const key = phone || email;
      if (!key) return true; // keep records without contact info
      if (seen.has(key)) { duplicates++; return false; }
      seen.add(key);
      return true;
    });

    const data = unique.map((r) => {
      const portal = r.origem || "Não informado";
      const link = r.url_anuncio || "";
      return {
        nome_proprietario: r.nome_proprietario || "",
        telefone: r.telefone || "",
        email: r.email || "",
        origem_anuncio: link ? `${portal} — ${link}` : portal,
        portal_origem: portal,
        link_anuncio: link,
        titulo_imovel: r.titulo_imovel || "",
        bairro: r.bairro || "",
        cidade: r.cidade || "",
        preco: r.preco || 0,
        q_score: r.q_score || 0,
        observacoes: r.observacoes || "",
      };
    });

    if (data.length === 0) {
      toast({ title: "Lista vazia", description: "Nenhum registro para exportar.", variant: "destructive" });
      return;
    }

    const ok = exportToExcel({
      fileName: `proprietarios_${tab}_${new Date().toISOString().slice(0, 10)}`,
      sheetName: tab === "venda" ? "Venda" : "Aluguel",
      columns: [
        { header: "Nome Proprietário", key: "nome_proprietario" },
        { header: "Telefone", key: "telefone" },
        { header: "E-mail", key: "email" },
        { header: "Origem do Anúncio", key: "origem_anuncio" },
        { header: "Portal de Origem", key: "portal_origem" },
        { header: "Link do Anúncio", key: "link_anuncio" },
        { header: "Imóvel", key: "titulo_imovel" },
        { header: "Bairro", key: "bairro" },
        { header: "Cidade", key: "cidade" },
        { header: "Preço (R$)", key: "preco" },
        { header: "Q-Score", key: "q_score" },
        { header: "Observações", key: "observacoes" },
      ],

      data,
    });

    if (ok) toast({
      title: "Planilha exportada",
      description: `${data.length} registros baixados${duplicates > 0 ? ` (${duplicates} duplicados removidos)` : ""}.`,
    });
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>

      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListChecks className="w-5 h-5" /> Lista de Proprietários para Captação
          </DialogTitle>
          <DialogDescription>
            Salve dados de contato dos proprietários separados por Venda e Aluguel. Edite telefone/e-mail e baixe como planilha.
          </DialogDescription>
        </DialogHeader>

        {semLinkCount > 0 && (
          <div className="rounded-md border border-amber-300/60 bg-amber-50 text-amber-900 px-3 py-2 text-xs flex items-start gap-2">
            <span className="font-semibold">⚠️ {semLinkCount}</span>
            <span>
              anúncio(s) foram ocultados por não possuírem <strong>link de referência</strong> público da origem.
              Todo anúncio exibido aqui precisa ter o link do site/portal onde o proprietário publicou originalmente.
            </span>
          </div>
        )}

        <Tabs value={tab} onValueChange={(v) => setTab(v as "venda" | "aluguel")}>
          <div className="flex items-center justify-between gap-2">
            <TabsList>
              <TabsTrigger value="venda">
                Venda <Badge variant="secondary" className="ml-2">{records.filter((r) => (r.operacao || "venda").toLowerCase() === "venda").length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="aluguel">
                Aluguel <Badge variant="secondary" className="ml-2">{records.filter((r) => (r.operacao || "venda").toLowerCase() === "aluguel").length}</Badge>
              </TabsTrigger>
            </TabsList>
            <div className="flex items-center gap-2">
              <Button onClick={gerarBrasilIA} size="sm" variant="outline" disabled={gerandoIA} className="gap-2 border-primary/40 text-primary hover:bg-primary/10">
                {gerandoIA ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Gerar Lista Brasil (IA)
              </Button>
              <Button onClick={handleClearList} size="sm" variant="outline" className="gap-2 border-destructive/40 text-destructive hover:bg-destructive/10">
                <Eraser className="w-4 h-4" /> Limpar Lista
              </Button>
              <Button onClick={handleExport} size="sm" className="gap-2">
                <Download className="w-4 h-4" /> Baixar Planilha
              </Button>
            </div>
          </div>

          <div className="mt-3 p-3 rounded-lg border bg-muted/20 grid grid-cols-2 md:grid-cols-6 gap-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Estado</label>
              <Select value={estadoSel} onValueChange={(v) => { setEstadoSel(v); setCidadeSel("__all__"); setBairroSel("__all__"); }}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="__all__">Todos os estados</SelectItem>
                  {ESTADOS_BRASIL.map((e) => (
                    <SelectItem key={e.uf} value={e.uf}>{e.uf} — {e.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Cidade</label>
              <Select value={cidadeSel} onValueChange={(v) => { setCidadeSel(v); setBairroSel("__all__"); }} disabled={estadoSel === "__all__"}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="__all__">Todas as cidades</SelectItem>
                  {cidadesDoEstado.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Bairro {estadoSel === "DF" && cidadeSel === "Brasília" && <span className="text-primary">(DF)</span>}
              </label>
              <Select value={bairroSel} onValueChange={setBairroSel} disabled={bairrosDaCidade.length === 0}>
                <SelectTrigger className="h-9"><SelectValue placeholder={bairrosDaCidade.length === 0 ? "Selecione DF/Brasília" : "Todos"} /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="__all__">Todos os bairros</SelectItem>
                  {bairrosDaCidade.map((b) => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Preço mín. (R$)</label>
              <Input type="number" min={0} step={1000} value={precoMin} onChange={(e) => setPrecoMin(e.target.value)} placeholder="Opcional" className="h-9" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Preço máx. (R$)</label>
              <Input type="number" min={0} step={1000} value={precoMax} onChange={(e) => setPrecoMax(e.target.value)} placeholder="Opcional" className="h-9" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Quantidade</label>
              <div className="flex gap-1">
                <Input type="number" min={10} value={quantidade} onChange={(e) => setQuantidade(Math.max(10, Number(e.target.value) || 50))} className="h-9" />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-9 px-2 text-xs whitespace-nowrap"
                  onClick={() => setQuantidade(2000)}
                  title="Puxar grande volume — use com filtros específicos"
                >
                  Todos
                </Button>
              </div>
            </div>
            <div className="col-span-2 md:col-span-6">
              <label className="text-xs text-muted-foreground mb-1 block">Localização específica do imóvel (opcional)</label>
              <Input
                value={localizacao}
                onChange={(e) => setLocalizacao(e.target.value)}
                placeholder="Ex.: Próximo ao Parque da Cidade, Av. das Nações, condomínio fechado, etc."
                className="h-9"
              />
            </div>
            <div className="col-span-2 md:col-span-6">
              <p className="text-xs text-muted-foreground">
                IA valida telefone, e-mail, atribui Q-Score e respeita a faixa de preço e localização definidas.
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-col md:flex-row gap-2 items-stretch md:items-center">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nome, telefone, e-mail, imóvel ou bairro..."
                className="h-9 pl-8 pr-8"
              />
              {busca && (
                <button
                  type="button"
                  onClick={() => setBusca("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Limpar busca"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="md:w-56">
              <Select value={origemFiltro} onValueChange={setOrigemFiltro}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Portal de origem" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="__all__">Todos os portais</SelectItem>
                  {origensDisponiveis.map((o) => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:w-52">
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Ordenar por" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="recentes">Mais recentes</SelectItem>
                  <SelectItem value="antigos">Mais antigos</SelectItem>
                  <SelectItem value="preco_desc">Preço (maior → menor)</SelectItem>
                  <SelectItem value="preco_asc">Preço (menor → maior)</SelectItem>
                  <SelectItem value="nome_asc">Nome (A → Z)</SelectItem>
                  <SelectItem value="nome_desc">Nome (Z → A)</SelectItem>
                  <SelectItem value="qscore_desc">Q-Score (maior primeiro)</SelectItem>
                  <SelectItem value="bairro">Bairro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="text-xs text-muted-foreground whitespace-nowrap">
              {sortedFiltered.length} resultado(s)
            </div>
          </div>


          {(["venda", "aluguel"] as const).map((opVal) => (
            <TabsContent key={opVal} value={opVal} className="mt-4">
              {loading ? (
                <div className="flex items-center justify-center p-8 text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando...
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center p-8 text-muted-foreground text-sm">
                  Nenhum proprietário salvo nesta lista. Clique em "Salvar na Lista" em uma oportunidade para adicionar.
                </div>
              ) : (
                <div className="overflow-x-auto border rounded-lg">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left p-2 font-medium">Imóvel</th>
                        <th className="text-left p-2 font-medium">Nome</th>
                        <th className="text-left p-2 font-medium">Telefone</th>
                        <th className="text-left p-2 font-medium">E-mail</th>
                        <th className="text-left p-2 font-medium">Bairro</th>
                        <th className="text-left p-2 font-medium">Origem do Anúncio</th>
                        <th className="text-right p-2 font-medium">Preço</th>
                        <th className="text-center p-2 font-medium">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageItems.map((r) => {
                        const e = edits[r.id] || {};
                        const dirty = e.nome !== undefined || e.telefone !== undefined || e.email !== undefined;
                        return (
                          <tr key={r.id} className="border-b hover:bg-muted/20">
                            <td className="p-2 max-w-[180px] truncate">{r.titulo_imovel}</td>
                            <td className="p-2">
                              <Input
                                value={e.nome ?? r.nome_proprietario ?? ""}
                                onChange={(ev) => setEdits((p) => ({ ...p, [r.id]: { ...p[r.id], nome: ev.target.value } }))}
                                placeholder="Nome"
                                className="h-8 text-xs"
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                value={e.telefone ?? r.telefone ?? ""}
                                onChange={(ev) => setEdits((p) => ({ ...p, [r.id]: { ...p[r.id], telefone: ev.target.value } }))}
                                placeholder="(61) 9..."
                                className="h-8 text-xs"
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                value={e.email ?? r.email ?? ""}
                                onChange={(ev) => setEdits((p) => ({ ...p, [r.id]: { ...p[r.id], email: ev.target.value } }))}
                                placeholder="email@..."
                                className="h-8 text-xs"
                              />
                            </td>
                            <td className="p-2 text-muted-foreground">{r.bairro}</td>
                            <td className="p-2">
                              {r.url_anuncio ? (
                                <div className="flex items-center gap-1 max-w-[240px]">
                                  {(() => {
                                    const st = linkStatus[r.url_anuncio!];
                                    const cor = st?.loading
                                      ? "bg-slate-300 animate-pulse"
                                      : st?.ok
                                        ? "bg-emerald-500"
                                        : st
                                          ? "bg-red-500"
                                          : "bg-slate-300";
                                    const rotulo = st?.loading
                                      ? "Validando link..."
                                      : !st
                                        ? "Ainda não validado"
                                        : st.ok
                                          ? `OK · HTTP ${st.status ?? "?"} · última tentativa ${new Date(st.checked_at).toLocaleString("pt-BR")}`
                                          : `Erro · ${st.error || `HTTP ${st.status ?? "sem resposta"}`} · última tentativa ${new Date(st.checked_at).toLocaleString("pt-BR")}`;
                                    return (
                                      <span
                                        title={rotulo}
                                        aria-label={rotulo}
                                        className={`inline-block w-2 h-2 rounded-full shrink-0 ${cor}`}
                                      />
                                    );
                                  })()}
                                  <a
                                    href={normalizeExternalUrl(r.url_anuncio) ?? r.url_anuncio}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title={normalizeExternalUrl(r.url_anuncio) ?? r.url_anuncio}
                                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline truncate"
                                    onClick={(e) => {
                                      const href = normalizeExternalUrl(r.url_anuncio);
                                      if (!href) {
                                        e.preventDefault();
                                        toast({ title: "Link inválido", description: "O anúncio não possui URL válida.", variant: "destructive" });
                                      }
                                    }}
                                  >
                                    <Badge variant="outline" className="text-xs shrink-0">
                                      {r.origem || "Anúncio"}
                                    </Badge>
                                    <span className="truncate">{r.url_anuncio}</span>
                                  </a>

                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 p-0 shrink-0"
                                    title="Abrir anúncio em nova aba"
                                    onClick={() => {
                                      if (!openExternalUrl(r.url_anuncio)) {
                                        toast({ title: "Link inválido", description: "O anúncio não possui URL válida.", variant: "destructive" });
                                      }
                                    }}
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 p-0 shrink-0"
                                    title="Copiar link do anúncio"
                                    onClick={async () => {
                                      const href = normalizeExternalUrl(r.url_anuncio) ?? r.url_anuncio!;
                                      try {
                                        await navigator.clipboard.writeText(href);
                                        toast({ title: "Link copiado", description: "URL do anúncio copiada para a área de transferência." });
                                      } catch {
                                        toast({ title: "Falha ao copiar", description: "Copie manualmente o link.", variant: "destructive" });
                                      }
                                    }}
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 p-0 shrink-0"
                                    title="Pré-visualizar imagens do anúncio"
                                    onClick={() => abrirPreviewFotos(r)}
                                  >
                                    <Images className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 p-0 shrink-0 text-emerald-600 hover:text-emerald-700 disabled:text-muted-foreground"
                                    title={
                                      r.status_revisao !== "aprovado"
                                        ? "Aguardando aprovação LGPD da fonte — libere na aba 'Aprovação LGPD'"
                                        : "Contatar proprietário via WhatsApp (limite: 1 envio a cada 7 dias)"
                                    }
                                    disabled={r.status_revisao !== "aprovado"}
                                    onClick={() => handleWhatsappContato(r)}
                                  >
                                    <MessageCircle className="w-3.5 h-3.5" />
                                  </Button>
                                  {(() => {
                                    const st = linkStatus[r.url_anuncio!];
                                    const broken = st && !st.loading && !st.ok;
                                    if (!broken) return null;
                                    const q = [r.titulo_imovel, r.bairro, r.cidade, r.origem].filter(Boolean).join(" ");
                                    const gUrl = `https://www.google.com/search?q=${encodeURIComponent(q)}`;
                                    return (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 w-7 p-0 shrink-0 text-amber-600 hover:text-amber-700"
                                        title="Link com erro — buscar anúncio no Google"
                                        onClick={() => openExternalUrl(gUrl)}
                                      >
                                        <Search className="w-3.5 h-3.5" />
                                      </Button>
                                    );
                                  })()}

                                </div>
                              ) : (
                                <div className="flex items-center gap-1">
                                  <Badge variant="outline" className="text-xs">
                                    {r.origem || "Não informado"}
                                  </Badge>
                                  {(r.titulo_imovel || r.bairro) && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 w-7 p-0 shrink-0"
                                      title="Buscar este anúncio no Google"
                                      onClick={() => {
                                        const q = [r.titulo_imovel, r.bairro, r.cidade, r.origem].filter(Boolean).join(" ");
                                        openExternalUrl(`https://www.google.com/search?q=${encodeURIComponent(q)}`);
                                      }}
                                    >
                                      <Search className="w-3.5 h-3.5" />
                                    </Button>
                                  )}
                                </div>
                              )}
                            </td>

                            <td className="p-2 text-right">{(r.preco || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
                            <td className="p-2 text-center">
                              <div className="flex items-center justify-center gap-1">
                                {dirty && (
                                  <Button size="sm" variant="default" className="h-7 text-xs" onClick={() => handleSaveField(r.id)}>
                                    Salvar
                                  </Button>
                                )}
                                <Button size="sm" variant="ghost" onClick={() => handleDelete(r.id)}>
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {!loading && sortedFiltered.length > 0 && (
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mt-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span>Itens por página:</span>
                    <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                      <SelectTrigger className="h-8 w-20"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="ml-2">
                      {(pageSafe - 1) * pageSize + 1}–{Math.min(pageSafe * pageSize, sortedFiltered.length)} de {sortedFiltered.length}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="outline" className="h-8" disabled={pageSafe <= 1} onClick={() => setPage(1)}>«</Button>
                    <Button size="sm" variant="outline" className="h-8" disabled={pageSafe <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>‹ Anterior</Button>
                    <span className="px-2 whitespace-nowrap">Página {pageSafe} de {totalPaginas}</span>
                    <Button size="sm" variant="outline" className="h-8" disabled={pageSafe >= totalPaginas} onClick={() => setPage((p) => Math.min(totalPaginas, p + 1))}>Próxima ›</Button>
                    <Button size="sm" variant="outline" className="h-8" disabled={pageSafe >= totalPaginas} onClick={() => setPage(totalPaginas)}>»</Button>
                  </div>
                </div>
              )}

            </TabsContent>
          ))}
        </Tabs>
      </DialogContent>
    </Dialog>

    <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Images className="w-5 h-5" /> Pré-visualização de imagens do anúncio
          </DialogTitle>
          <DialogDescription className="space-y-1">
            <span className="block truncate">{previewRecord?.titulo_imovel || "Anúncio"}</span>
            {(() => {
              const href = normalizeExternalUrl(previewRecord?.url_anuncio ?? null);
              if (!href) return null;
              return (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline text-xs inline-flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" /> Abrir anúncio original
                </a>
              );
            })()}
          </DialogDescription>
        </DialogHeader>

        {previewLoading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="text-sm">Extraindo imagens do anúncio...</span>
          </div>
        ) : previewFotos.length === 0 ? (
          <div className="space-y-3 rounded-lg border-2 border-dashed border-amber-400/50 bg-amber-50 dark:bg-amber-950/20 p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                  Nenhuma foto foi extraída automaticamente
                </p>
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  {previewPhotoInfo?.blocked
                    ? "O portal bloqueou a coleta de imagens (proteção anti-bot). Anexe as fotos manualmente abaixo — elas ficarão vinculadas a este registro."
                    : "Este anúncio não expôs as fotos publicamente (renderização via JavaScript ou CDN protegido). Você pode anexá-las manualmente abaixo."}
                </p>
              </div>
            </div>
            <label className="flex items-center justify-center gap-2 w-full py-3 rounded-md border border-amber-500/60 bg-white dark:bg-background hover:bg-amber-100 dark:hover:bg-amber-950/40 cursor-pointer transition-colors text-sm font-medium text-amber-900 dark:text-amber-100">
              {uploadingManualFotos ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
              <span>{uploadingManualFotos ? "Enviando..." : "Escolher fotos do dispositivo"}</span>
              <input
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                disabled={uploadingManualFotos}
                onChange={async (e) => {
                  const files = Array.from(e.target.files || []);
                  await handleUploadManualPreviewFotos(files);
                  e.target.value = "";
                }}
              />
            </label>
            {previewPhotoInfo?.strategy_stats && (
              <p className="text-[10px] text-amber-700 dark:text-amber-400 font-mono">
                Estratégias tentadas: {Object.entries(previewPhotoInfo.strategy_stats).map(([k, v]) => `${k}=${v}`).join(" · ")}
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
              <span>{previewFotos.length} imagem(ns) encontradas</span>
              <Badge variant="outline" className="text-[10px]">
                {previewSource === "cache" ? "Cache local" : "Extraída ao vivo"}
              </Badge>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {previewFotos.map((url, i) => (
                <a
                  key={`${url}-${i}`}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block rounded-lg overflow-hidden border bg-muted/20 aspect-[4/3] relative"
                  title={url}
                >
                  <img
                    src={url}
                    alt={`Imagem ${i + 1} do anúncio`}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = "0.2"; }}
                  />
                  <span className="absolute bottom-1 right-1 text-[10px] px-1.5 py-0.5 rounded bg-black/60 text-white">
                    {i + 1}
                  </span>
                </a>
              ))}
            </div>
            <label className="mt-3 flex items-center justify-center gap-2 w-full py-2 rounded-md border border-dashed cursor-pointer text-xs text-muted-foreground hover:bg-secondary/50 transition-colors">
              {uploadingManualFotos ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />}
              <span>{uploadingManualFotos ? "Enviando..." : "Adicionar mais fotos manualmente"}</span>
              <input
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                disabled={uploadingManualFotos}
                onChange={async (e) => {
                  const files = Array.from(e.target.files || []);
                  await handleUploadManualPreviewFotos(files);
                  e.target.value = "";
                }}
              />
            </label>
            <p className="text-[10px] text-muted-foreground mt-2">
              Imagens do portal público são referenciadas por URL. Fotos anexadas manualmente são armazenadas no seu bucket.
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>

    <Dialog open={!!waPreview} onOpenChange={(o) => { if (!o) setWaPreview(null); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-emerald-600" />
            Revisar mensagem do WhatsApp
          </DialogTitle>
          <DialogDescription>
            Confira o conteúdo antes de abrir o WhatsApp. Nada é enviado até você confirmar.
          </DialogDescription>
        </DialogHeader>

        {waPreview && (
          <div className="space-y-4">
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs space-y-1">
              <div><span className="text-muted-foreground">Destinatário:</span> <span className="font-medium">{waPreview.record.nome_proprietario || "—"}</span></div>
              <div><span className="text-muted-foreground">Telefone (E.164):</span> <span className="font-mono">{waPreview.e164}</span></div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Mensagem</label>
                {!waPreview.editing && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setWaPreview((p) => (p ? { ...p, editing: true } : p))}
                  >
                    Editar mensagem
                  </Button>
                )}
              </div>
              {waPreview.editing ? (
                <Textarea
                  value={waPreview.mensagem}
                  onChange={(e) => setWaPreview((p) => (p ? { ...p, mensagem: e.target.value } : p))}
                  rows={8}
                  className="text-sm font-mono"
                  autoFocus
                />
              ) : (
                <div className="rounded-md border bg-background px-3 py-2 text-sm whitespace-pre-wrap max-h-56 overflow-auto">
                  {waPreview.mensagem}
                </div>
              )}
              <p className="text-[10px] text-muted-foreground mt-1">
                {waPreview.mensagem.length} caracteres
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Link do anúncio</label>
              {waPreview.editing ? (
                <Input
                  value={waPreview.link}
                  onChange={(e) => setWaPreview((p) => (p ? { ...p, link: e.target.value } : p))}
                  className="text-sm font-mono mt-1"
                  placeholder="https://..."
                />
              ) : (
                <a
                  href={waPreview.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 block rounded-md border bg-emerald-500/5 border-emerald-500/30 px-3 py-2 text-xs font-mono text-emerald-700 dark:text-emerald-400 break-all hover:underline"
                >
                  {waPreview.link}
                </a>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="ghost" onClick={() => setWaPreview(null)} disabled={waSending}>
            Cancelar
          </Button>
          {waPreview?.editing && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setWaPreview((p) => (p ? { ...p, editing: false } : p))}
              disabled={waSending}
            >
              Concluir edição
            </Button>
          )}
          <Button
            type="button"
            onClick={confirmWhatsappSend}
            disabled={waSending || !waPreview?.mensagem.trim() || !waPreview?.link}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {waSending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <MessageCircle className="w-4 h-4 mr-2" />}
            Confirmar e enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>

  );
}
