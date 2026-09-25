import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, History, Send, Copy, Plus, Save, RotateCcw, MessageCircle, Mail, Phone, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

type Canal = "portaria" | "administradora" | "sindico" | "whatsapp" | "email" | "outro";

const CANAIS: { id: Canal; label: string; icon: JSX.Element; usaAssunto: boolean }[] = [
  { id: "portaria", label: "Portaria", icon: <Phone className="w-3 h-3" />, usaAssunto: false },
  { id: "administradora", label: "Administradora", icon: <Mail className="w-3 h-3" />, usaAssunto: true },
  { id: "sindico", label: "Síndico", icon: <MessageCircle className="w-3 h-3" />, usaAssunto: false },
  { id: "whatsapp", label: "WhatsApp", icon: <MessageCircle className="w-3 h-3" />, usaAssunto: false },
  { id: "email", label: "E-mail", icon: <Mail className="w-3 h-3" />, usaAssunto: true },
  { id: "outro", label: "Outro", icon: <FileText className="w-3 h-3" />, usaAssunto: false },
];

type Roteiro = {
  id: string;
  imobiliaria_id: string;
  condominio_nome: string | null;
  canal: Canal;
  titulo: string;
  assunto: string | null;
  corpo: string;
  versao_atual: number;
  ativo: boolean;
  updated_at: string;
};

type Versao = {
  id: string;
  roteiro_id: string;
  versao: number;
  titulo: string;
  assunto: string | null;
  corpo: string;
  nota: string | null;
  created_at: string;
  changed_by: string | null;
};

type Envio = {
  id: string;
  condominio_nome: string;
  canal: string;
  roteiro_id: string | null;
  versao: number | null;
  destinatario: string | null;
  destinatario_tipo: string | null;
  assunto: string | null;
  texto_final: string;
  sent_at: string;
};

export function RoteirosMensagensPanel() {
  const { toast } = useToast();
  const { user } = useAuth();

  const [canalAtivo, setCanalAtivo] = useState<Canal>("portaria");
  const [filtroCondo, setFiltroCondo] = useState<string>("");
  const [roteiros, setRoteiros] = useState<Roteiro[]>([]);
  const [selecionado, setSelecionado] = useState<Roteiro | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [versoesOpen, setVersoesOpen] = useState(false);
  const [envioOpen, setEnvioOpen] = useState(false);
  const [versoes, setVersoes] = useState<Versao[]>([]);
  const [envios, setEnvios] = useState<Envio[]>([]);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    id: "" as string | "",
    canal: "portaria" as Canal,
    condominio_nome: "",
    titulo: "",
    assunto: "",
    corpo: "",
  });

  const [envioForm, setEnvioForm] = useState({
    destinatario: "",
    destinatario_tipo: "",
    condominio_nome: "",
    assunto: "",
    texto_final: "",
  });

  const carregar = async () => {
    if (!user?.id) return;
    let q = supabase
      .from("condominio_roteiros")
      .select("*")
      .eq("imobiliaria_id", user.id)
      .eq("canal", canalAtivo)
      .order("updated_at", { ascending: false });
    if (filtroCondo.trim()) q = q.ilike("condominio_nome", `%${filtroCondo.trim()}%`);
    const { data, error } = await q;
    if (!error) setRoteiros((data as Roteiro[]) ?? []);
  };

  const carregarEnvios = async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from("condominio_mensagens_enviadas")
      .select("*")
      .eq("imobiliaria_id", user.id)
      .order("sent_at", { ascending: false })
      .limit(50);
    setEnvios((data as Envio[]) ?? []);
  };

  useEffect(() => { carregar(); }, [user?.id, canalAtivo, filtroCondo]);
  useEffect(() => { carregarEnvios(); }, [user?.id]);

  const canalMeta = useMemo(() => CANAIS.find((c) => c.id === canalAtivo)!, [canalAtivo]);

  const abrirNovo = () => {
    setForm({ id: "", canal: canalAtivo, condominio_nome: "", titulo: "", assunto: "", corpo: "" });
    setEditorOpen(true);
  };

  const abrirEdicao = (r: Roteiro) => {
    setForm({
      id: r.id,
      canal: r.canal,
      condominio_nome: r.condominio_nome ?? "",
      titulo: r.titulo,
      assunto: r.assunto ?? "",
      corpo: r.corpo,
    });
    setEditorOpen(true);
  };

  const salvar = async () => {
    if (!user?.id) return;
    if (!form.titulo.trim() || !form.corpo.trim()) {
      toast({ title: "Título e corpo são obrigatórios", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        imobiliaria_id: user.id,
        canal: form.canal,
        condominio_nome: form.condominio_nome.trim() || null,
        titulo: form.titulo.trim(),
        assunto: form.assunto.trim() || null,
        corpo: form.corpo,
      };
      if (form.id) {
        const { error } = await supabase
          .from("condominio_roteiros")
          .update(payload)
          .eq("id", form.id)
          .eq("imobiliaria_id", user.id);
        if (error) throw error;
        toast({ title: "Roteiro atualizado", description: "Nova versão gerada automaticamente." });
      } else {
        const { error } = await supabase.from("condominio_roteiros").insert(payload);
        if (error) throw error;
        toast({ title: "Roteiro criado" });
      }
      setEditorOpen(false);
      await carregar();
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const excluir = async (r: Roteiro) => {
    if (!confirm(`Excluir o roteiro "${r.titulo}"? O histórico de versões também será removido.`)) return;
    const { error } = await supabase
      .from("condominio_roteiros")
      .delete()
      .eq("id", r.id)
      .eq("imobiliaria_id", user!.id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Roteiro excluído" });
    if (selecionado?.id === r.id) setSelecionado(null);
    carregar();
  };

  const abrirVersoes = async (r: Roteiro) => {
    setSelecionado(r);
    const { data } = await supabase
      .from("condominio_roteiro_versoes")
      .select("*")
      .eq("roteiro_id", r.id)
      .order("versao", { ascending: false });
    setVersoes((data as Versao[]) ?? []);
    setVersoesOpen(true);
  };

  const restaurarVersao = async (v: Versao) => {
    if (!selecionado || !user?.id) return;
    if (!confirm(`Restaurar a versão ${v.versao}? Uma nova versão será criada com este conteúdo.`)) return;
    const { error } = await supabase
      .from("condominio_roteiros")
      .update({ titulo: v.titulo, assunto: v.assunto, corpo: v.corpo })
      .eq("id", selecionado.id)
      .eq("imobiliaria_id", user.id);
    if (error) {
      toast({ title: "Erro ao restaurar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `Versão ${v.versao} restaurada como nova versão` });
    setVersoesOpen(false);
    carregar();
  };

  const abrirEnvio = (r: Roteiro) => {
    setSelecionado(r);
    setEnvioForm({
      destinatario: "",
      destinatario_tipo: r.canal,
      condominio_nome: r.condominio_nome ?? "",
      assunto: r.assunto ?? "",
      texto_final: r.corpo,
    });
    setEnvioOpen(true);
  };

  const registrarEnvio = async () => {
    if (!user?.id || !selecionado) return;
    if (!envioForm.condominio_nome.trim() || !envioForm.texto_final.trim()) {
      toast({ title: "Condomínio e mensagem são obrigatórios", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("condominio_mensagens_enviadas").insert({
      imobiliaria_id: user.id,
      condominio_nome: envioForm.condominio_nome.trim(),
      canal: selecionado.canal,
      roteiro_id: selecionado.id,
      versao: selecionado.versao_atual,
      destinatario: envioForm.destinatario || null,
      destinatario_tipo: envioForm.destinatario_tipo || null,
      assunto: envioForm.assunto || null,
      texto_final: envioForm.texto_final,
    });
    if (error) {
      toast({ title: "Erro ao registrar envio", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Envio registrado", description: "Aparece no histórico de mensagens enviadas." });
    setEnvioOpen(false);
    carregarEnvios();
  };

  const copiar = async (t: string) => {
    await navigator.clipboard.writeText(t);
    toast({ title: "Copiado" });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                Roteiros e mensagens por canal
              </CardTitle>
              <CardDescription>
                Edite scripts e e-mails por condomínio e canal. Cada alteração cria uma nova versão automática.
              </CardDescription>
            </div>
            <Button size="sm" onClick={abrirNovo} className="gap-1">
              <Plus className="w-3 h-3" /> Novo roteiro
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Tabs value={canalAtivo} onValueChange={(v) => setCanalAtivo(v as Canal)}>
            <TabsList className="flex flex-wrap h-auto">
              {CANAIS.map((c) => (
                <TabsTrigger key={c.id} value={c.id} className="gap-1">
                  {c.icon} {c.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {CANAIS.map((c) => (
              <TabsContent key={c.id} value={c.id} className="space-y-3 mt-3">
                <Input
                  value={filtroCondo}
                  onChange={(e) => setFiltroCondo(e.target.value)}
                  placeholder="Filtrar por condomínio (deixe vazio para ver globais + todos)"
                />
                {roteiros.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    Nenhum roteiro em <strong>{c.label}</strong>. Clique em <strong>Novo roteiro</strong>.
                  </p>
                ) : (
                  <div className="grid gap-2 md:grid-cols-2">
                    {roteiros.map((r) => (
                      <div key={r.id} className="border rounded-lg p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate">{r.titulo}</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              <Badge variant="secondary" className="text-[10px]">v{r.versao_atual}</Badge>
                              <Badge variant="outline" className="text-[10px]">
                                {r.condominio_nome ?? "Global"}
                              </Badge>
                            </div>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive"
                            onClick={() => excluir(r)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                        {r.assunto && <p className="text-xs text-muted-foreground truncate">📧 {r.assunto}</p>}
                        <p className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">{r.corpo}</p>
                        <div className="flex flex-wrap gap-1 pt-1">
                          <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={() => abrirEdicao(r)}>
                            Editar
                          </Button>
                          <Button size="sm" variant="ghost" className="gap-1 h-7 text-xs" onClick={() => abrirVersoes(r)}>
                            <History className="w-3 h-3" /> Versões
                          </Button>
                          <Button size="sm" variant="ghost" className="gap-1 h-7 text-xs" onClick={() => copiar(r.corpo)}>
                            <Copy className="w-3 h-3" /> Copiar
                          </Button>
                          <Button size="sm" className="gap-1 h-7 text-xs" onClick={() => abrirEnvio(r)}>
                            <Send className="w-3 h-3" /> Registrar envio
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {envios.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Send className="w-4 h-4 text-primary" /> Últimos envios registrados
            </CardTitle>
            <CardDescription>Trilha do que foi disparado (canal, condomínio, versão do roteiro).</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-80 overflow-y-auto space-y-2">
              {envios.map((e) => (
                <div key={e.id} className="border rounded-md p-2 text-xs space-y-1">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1">
                      <Badge variant="outline" className="text-[10px] capitalize">{e.canal}</Badge>
                      <span className="font-medium">{e.condominio_nome}</span>
                      {e.versao != null && <Badge variant="secondary" className="text-[10px]">v{e.versao}</Badge>}
                    </div>
                    <span className="text-muted-foreground">{new Date(e.sent_at).toLocaleString("pt-BR")}</span>
                  </div>
                  {e.destinatario && <p className="text-muted-foreground">Para: {e.destinatario}</p>}
                  {e.assunto && <p className="text-muted-foreground truncate">Assunto: {e.assunto}</p>}
                  <p className="line-clamp-2 whitespace-pre-wrap">{e.texto_final}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Editor */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar roteiro" : "Novo roteiro"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Canal</Label>
                <Select value={form.canal} onValueChange={(v) => setForm({ ...form, canal: v as Canal })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CANAIS.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Condomínio (vazio = global)</Label>
                <Input
                  value={form.condominio_nome}
                  onChange={(e) => setForm({ ...form, condominio_nome: e.target.value })}
                  placeholder="Ex.: Life Park Sul"
                />
              </div>
            </div>
            <div>
              <Label>Título *</Label>
              <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
            </div>
            {(CANAIS.find((c) => c.id === form.canal)?.usaAssunto) && (
              <div>
                <Label>Assunto (e-mail)</Label>
                <Input value={form.assunto} onChange={(e) => setForm({ ...form, assunto: e.target.value })} />
              </div>
            )}
            <div>
              <Label>Corpo da mensagem *</Label>
              <Textarea
                value={form.corpo}
                onChange={(e) => setForm({ ...form, corpo: e.target.value })}
                className="min-h-[220px]"
                placeholder="Escreva o roteiro/mensagem. Cada salvamento gera uma nova versão."
              />
              <p className="text-xs text-muted-foreground mt-1">
                Dica: use variáveis livres como {"{condominio}"}, {"{corretor}"}, {"{imobiliaria}"} — você substitui na hora do envio.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)}>Cancelar</Button>
            <Button onClick={salvar} disabled={saving} className="gap-1">
              <Save className="w-3 h-3" /> {form.id ? "Salvar (nova versão)" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Versões */}
      <Dialog open={versoesOpen} onOpenChange={setVersoesOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Histórico de versões — {selecionado?.titulo}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {versoes.length === 0 && <p className="text-sm text-muted-foreground">Sem versões registradas.</p>}
            {versoes.map((v) => (
              <div key={v.id} className="border rounded-md p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge>v{v.versao}</Badge>
                    {v.nota && <span className="text-xs text-muted-foreground">{v.nota}</span>}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(v.created_at).toLocaleString("pt-BR")}
                  </span>
                </div>
                <p className="text-sm font-medium">{v.titulo}</p>
                {v.assunto && <p className="text-xs text-muted-foreground">📧 {v.assunto}</p>}
                <p className="text-xs whitespace-pre-wrap line-clamp-6 bg-muted/40 rounded p-2">{v.corpo}</p>
                <div className="flex gap-1 justify-end">
                  <Button size="sm" variant="ghost" className="gap-1 h-7 text-xs" onClick={() => copiar(v.corpo)}>
                    <Copy className="w-3 h-3" /> Copiar
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={() => restaurarVersao(v)}>
                    <RotateCcw className="w-3 h-3" /> Restaurar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Registrar envio */}
      <Dialog open={envioOpen} onOpenChange={setEnvioOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Registrar envio — {selecionado?.titulo}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Condomínio *</Label>
                <Input
                  value={envioForm.condominio_nome}
                  onChange={(e) => setEnvioForm({ ...envioForm, condominio_nome: e.target.value })}
                />
              </div>
              <div>
                <Label>Destinatário (telefone/e-mail)</Label>
                <Input
                  value={envioForm.destinatario}
                  onChange={(e) => setEnvioForm({ ...envioForm, destinatario: e.target.value })}
                />
              </div>
            </div>
            {selecionado && CANAIS.find((c) => c.id === selecionado.canal)?.usaAssunto && (
              <div>
                <Label>Assunto</Label>
                <Input
                  value={envioForm.assunto}
                  onChange={(e) => setEnvioForm({ ...envioForm, assunto: e.target.value })}
                />
              </div>
            )}
            <div>
              <Label>Texto final enviado *</Label>
              <Textarea
                value={envioForm.texto_final}
                onChange={(e) => setEnvioForm({ ...envioForm, texto_final: e.target.value })}
                className="min-h-[180px]"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Ajuste variáveis antes de registrar. A versão v{selecionado?.versao_atual} do roteiro fica atrelada ao envio.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEnvioOpen(false)}>Cancelar</Button>
            <Button onClick={registrarEnvio} className="gap-1">
              <Send className="w-3 h-3" /> Registrar envio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
