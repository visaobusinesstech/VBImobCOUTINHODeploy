import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Paperclip, MessageSquarePlus, Lock, Users, Trash2, Download, X, Pencil } from "lucide-react";

export type NotaEvento = {
  id: string;
  historico_id: string;
  autor_id: string;
  autor_nome: string | null;
  visibilidade: string;
  texto: string | null;
  anexo_path: string | null;
  anexo_nome: string | null;
  anexo_tipo: string | null;
  anexo_tamanho: number | null;
  created_at: string;
  updated_at?: string | null;
};

const MAX_MB = 10;

interface Props {
  historicoId: string;
  prospeccaoId: string;
  etapa?: string | null;
  notas: NotaEvento[];
  onChanged: () => void;
}

export function EventoNotasBlock({ historicoId, prospeccaoId, etapa, notas, onChanged }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [visibilidade, setVisibilidade] = useState("time");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [baixando, setBaixando] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  // edição
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editTexto, setEditTexto] = useState("");
  const [editVisibilidade, setEditVisibilidade] = useState("time");
  const [editArquivo, setEditArquivo] = useState<File | null>(null);
  const [removerAnexo, setRemoverAnexo] = useState(false);
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);


  const autorNome =
    (user?.user_metadata as { nome?: string; full_name?: string } | undefined)?.nome ||
    (user?.user_metadata as { full_name?: string } | undefined)?.full_name ||
    user?.email ||
    "Usuário";

  const validarTamanho = (f: File | null) => {
    if (f && f.size > MAX_MB * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: `Limite de ${MAX_MB}MB por anexo.`, variant: "destructive" });
      return false;
    }
    return true;
  };

  const escolherArquivo = (f: File | null) => {
    if (!validarTamanho(f)) return;
    setArquivo(f);
  };

  const escolherArquivoEdicao = (f: File | null) => {
    if (!validarTamanho(f)) return;
    setEditArquivo(f);
    if (f) setRemoverAnexo(false);
  };

  const uploadAnexo = async (f: File) => {
    const safeName = f.name.replace(/[^\w.\-]+/g, "_").slice(-80);
    const path = `${user!.id}/${prospeccaoId}/${crypto.randomUUID()}-${safeName}`;
    const { error: upErr } = await supabase.storage.from("historico-anexos").upload(path, f, {
      contentType: f.type || "application/octet-stream",
      upsert: false,
    });
    if (upErr) throw upErr;
    return path;
  };

  /** Registra no timeline do condomínio quem alterou/excluiu a nota e quando. */
  const registrarTimeline = async (
    tipo: "nota_editada" | "nota_excluida",
    nota: string,
    valorAnterior?: Record<string, unknown>,
    valorNovo?: Record<string, unknown>
  ) => {
    if (!user) return;
    await supabase.from("condominio_prospeccao_historico").insert({
      prospeccao_id: prospeccaoId,
      imobiliaria_id: user.id,
      tipo,
      etapa: etapa ?? null,
      nota,
      changed_by: user.id,
      valor_anterior: (valorAnterior ?? null) as never,
      valor_novo: (valorNovo ?? null) as never,
    });
  };

  const iniciarEdicao = (n: NotaEvento) => {
    setEditandoId(n.id);
    setEditTexto(n.texto ?? "");
    setEditVisibilidade(n.visibilidade);
    setEditArquivo(null);
    setRemoverAnexo(false);
  };

  const cancelarEdicao = () => {
    setEditandoId(null);
    setEditTexto("");
    setEditArquivo(null);
    setRemoverAnexo(false);
    if (editInputRef.current) editInputRef.current.value = "";
  };

  const salvarEdicao = async (n: NotaEvento) => {
    if (!user) return;
    const conteudo = editTexto.trim();
    const manteveAnexo = !!n.anexo_path && !removerAnexo;
    if (!conteudo && !editArquivo && !manteveAnexo) {
      toast({ title: "Escreva uma nota ou mantenha um anexo", variant: "destructive" });
      return;
    }
    setSalvandoEdicao(true);
    try {
      const patch: Record<string, unknown> = {
        texto: conteudo || null,
        visibilidade: editVisibilidade,
        updated_at: new Date().toISOString(),
      };

      let anexoAntigoParaRemover: string | null = null;
      if (editArquivo) {
        patch.anexo_path = await uploadAnexo(editArquivo);
        patch.anexo_nome = editArquivo.name;
        patch.anexo_tipo = editArquivo.type || null;
        patch.anexo_tamanho = editArquivo.size;
        anexoAntigoParaRemover = n.anexo_path;
      } else if (removerAnexo && n.anexo_path) {
        patch.anexo_path = null;
        patch.anexo_nome = null;
        patch.anexo_tipo = null;
        patch.anexo_tamanho = null;
        anexoAntigoParaRemover = n.anexo_path;
      }

      const { data, error } = await supabase
        .from("condominio_historico_notas")
        .update(patch)
        .eq("id", n.id)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        toast({ title: "Você não tem permissão para editar esta nota", variant: "destructive" });
        return;
      }

      if (anexoAntigoParaRemover) {
        await supabase.storage.from("historico-anexos").remove([anexoAntigoParaRemover]);
      }

      const mudancas: string[] = [];
      if ((n.texto ?? "") !== (conteudo || "")) mudancas.push("texto");
      if (n.visibilidade !== editVisibilidade) mudancas.push("visibilidade");
      if (editArquivo) mudancas.push("anexo substituído");
      else if (removerAnexo && n.anexo_path) mudancas.push("anexo removido");

      await registrarTimeline(
        "nota_editada",
        `${autorNome} editou uma nota${mudancas.length ? ` (${mudancas.join(", ")})` : ""}`,
        { texto: n.texto, visibilidade: n.visibilidade, anexo_nome: n.anexo_nome },
        { texto: conteudo || null, visibilidade: editVisibilidade, anexo_nome: patch.anexo_nome ?? n.anexo_nome },
      );

      cancelarEdicao();
      toast({ title: "Nota atualizada" });
      onChanged();
    } catch (e) {
      toast({
        title: "Não foi possível atualizar a nota",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSalvandoEdicao(false);
    }
  };


  const salvar = async () => {
    if (!user) return;
    const conteudo = texto.trim();
    if (!conteudo && !arquivo) {
      toast({ title: "Escreva uma nota ou anexe um arquivo", variant: "destructive" });
      return;
    }
    setSalvando(true);
    try {
      let anexo_path: string | null = null;
      if (arquivo) {
        const safeName = arquivo.name.replace(/[^\w.\-]+/g, "_").slice(-80);
        const path = `${user.id}/${prospeccaoId}/${crypto.randomUUID()}-${safeName}`;
        const { error: upErr } = await supabase.storage.from("historico-anexos").upload(path, arquivo, {
          contentType: arquivo.type || "application/octet-stream",
          upsert: false,
        });
        if (upErr) throw upErr;
        anexo_path = path;
      }

      const { error } = await supabase.from("condominio_historico_notas").insert({
        historico_id: historicoId,
        prospeccao_id: prospeccaoId,
        imobiliaria_id: user.id,
        autor_id: user.id,
        autor_nome: autorNome,
        visibilidade,
        texto: conteudo || null,
        anexo_path,
        anexo_nome: arquivo?.name ?? null,
        anexo_tipo: arquivo?.type ?? null,
        anexo_tamanho: arquivo?.size ?? null,
      });
      if (error) throw error;

      setTexto("");
      setArquivo(null);
      if (inputRef.current) inputRef.current.value = "";
      setAberto(false);
      toast({ title: "Nota adicionada ao evento" });
      onChanged();
    } catch (e) {
      toast({
        title: "Não foi possível salvar a nota",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSalvando(false);
    }
  };

  const baixar = async (nota: NotaEvento) => {
    if (!nota.anexo_path) return;
    setBaixando(nota.id);
    const { data, error } = await supabase.storage.from("historico-anexos").createSignedUrl(nota.anexo_path, 60);
    setBaixando(null);
    if (error || !data?.signedUrl) {
      toast({ title: "Não foi possível abrir o anexo", variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const excluir = async (nota: NotaEvento) => {
    if (!window.confirm("Excluir esta nota? Esta ação será registrada na linha do tempo.")) return;
    const { data, error } = await supabase
      .from("condominio_historico_notas")
      .delete()
      .eq("id", nota.id)
      .select("id")
      .maybeSingle();
    if (error) {
      toast({ title: "Não foi possível excluir", variant: "destructive" });
      return;
    }
    if (!data) {
      toast({ title: "Você não tem permissão para excluir esta nota", variant: "destructive" });
      return;
    }
    if (nota.anexo_path) {
      await supabase.storage.from("historico-anexos").remove([nota.anexo_path]);
    }
    await registrarTimeline(
      "nota_excluida",
      `${autorNome} excluiu uma nota${nota.anexo_nome ? ` (com anexo: ${nota.anexo_nome})` : ""}`,
      { texto: nota.texto, visibilidade: nota.visibilidade, anexo_nome: nota.anexo_nome },
      undefined,
    );
    toast({ title: "Nota excluída" });
    onChanged();
  };

  return (
    <div className="mt-1.5">
      {notas.length > 0 && (
        <ul className="space-y-1.5 mb-1.5">
          {notas.map((n) => (
            <li key={n.id} className="rounded-md border bg-muted/40 px-2 py-1.5">
              <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                <Badge variant="outline" className="text-[10px] gap-1">
                  {n.visibilidade === "privada" ? <Lock className="w-2.5 h-2.5" /> : <Users className="w-2.5 h-2.5" />}
                  {n.visibilidade === "privada" ? "Privada" : "Time"}
                </Badge>
                <span className="font-medium text-foreground">{n.autor_nome ?? "Usuário"}</span>
                <span>{new Date(n.created_at).toLocaleString("pt-BR")}</span>
                {n.updated_at && new Date(n.updated_at).getTime() - new Date(n.created_at).getTime() > 2000 && (
                  <Badge variant="secondary" className="text-[10px]">
                    editada em {new Date(n.updated_at).toLocaleString("pt-BR")}
                  </Badge>
                )}
                {n.autor_id === user?.id && editandoId !== n.id && (
                  <div className="flex items-center gap-1 ml-auto">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-5 px-1"
                      onClick={() => iniciarEdicao(n)}
                      aria-label="Editar nota"
                    >
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-5 px-1"
                      onClick={() => excluir(n)}
                      aria-label="Excluir nota"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </div>

              {editandoId === n.id ? (
                <div className="mt-1.5 space-y-2">
                  <Textarea
                    value={editTexto}
                    onChange={(e) => setEditTexto(e.target.value)}
                    rows={3}
                    maxLength={2000}
                    className="text-xs"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <Select value={editVisibilidade} onValueChange={setEditVisibilidade}>
                      <SelectTrigger className="h-8 w-[150px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="time">Visível para o time</SelectItem>
                        <SelectItem value="privada">Privada (só eu)</SelectItem>
                      </SelectContent>
                    </Select>
                    <input
                      ref={editInputRef}
                      type="file"
                      className="hidden"
                      onChange={(e) => escolherArquivoEdicao(e.target.files?.[0] ?? null)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs gap-1"
                      onClick={() => editInputRef.current?.click()}
                    >
                      <Paperclip className="w-3 h-3" /> {n.anexo_path ? "Substituir anexo" : "Anexar"}
                    </Button>
                    {editArquivo && (
                      <Badge variant="secondary" className="text-[10px] gap-1 max-w-[200px]">
                        <span className="truncate">{editArquivo.name}</span>
                        <button type="button" onClick={() => escolherArquivoEdicao(null)}>
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    )}
                    {n.anexo_path && !editArquivo && (
                      <Button
                        type="button"
                        variant={removerAnexo ? "destructive" : "ghost"}
                        size="sm"
                        className="h-8 text-xs gap-1"
                        onClick={() => setRemoverAnexo((v) => !v)}
                      >
                        <Trash2 className="w-3 h-3" />
                        {removerAnexo ? "Anexo será removido" : "Remover anexo"}
                      </Button>
                    )}
                    <div className="flex gap-2 ml-auto">
                      <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={cancelarEdicao}>
                        Cancelar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => salvarEdicao(n)}
                        disabled={salvandoEdicao}
                      >
                        {salvandoEdicao && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
                        Salvar alterações
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {n.texto && <p className="text-xs mt-1 whitespace-pre-wrap break-words">{n.texto}</p>}
                  {n.anexo_path && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-6 mt-1 text-[10px] gap-1"
                      onClick={() => baixar(n)}
                      disabled={baixando === n.id}
                    >
                      {baixando === n.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Download className="w-3 h-3" />
                      )}
                      <span className="truncate max-w-[180px]">{n.anexo_nome ?? "anexo"}</span>
                    </Button>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}


      {!aberto ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-1.5 text-[10px] gap-1 text-muted-foreground"
          onClick={() => setAberto(true)}
        >
          <MessageSquarePlus className="w-3 h-3" /> Adicionar nota / anexo
        </Button>
      ) : (
        <div className="rounded-md border p-2 space-y-2">
          <Textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Escreva uma nota sobre este evento..."
            rows={3}
            maxLength={2000}
            className="text-xs"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Select value={visibilidade} onValueChange={setVisibilidade}>
              <SelectTrigger className="h-8 w-[150px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="time">Visível para o time</SelectItem>
                <SelectItem value="privada">Privada (só eu)</SelectItem>
              </SelectContent>
            </Select>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              onChange={(e) => escolherArquivo(e.target.files?.[0] ?? null)}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1"
              onClick={() => inputRef.current?.click()}
            >
              <Paperclip className="w-3 h-3" /> Anexar
            </Button>
            {arquivo && (
              <Badge variant="secondary" className="text-[10px] gap-1 max-w-[200px]">
                <span className="truncate">{arquivo.name}</span>
                <button type="button" onClick={() => escolherArquivo(null)}>
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            )}
            <div className="flex gap-2 ml-auto">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={() => {
                  setAberto(false);
                  setTexto("");
                  setArquivo(null);
                }}
              >
                Cancelar
              </Button>
              <Button type="button" size="sm" className="h-8 text-xs" onClick={salvar} disabled={salvando}>
                {salvando && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
                Salvar nota
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
