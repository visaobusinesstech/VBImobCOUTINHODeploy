import { useState, useEffect, useCallback, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Megaphone, Phone, Mail, MessageCircle, Eye, EyeOff, Trash2, Loader2,
  Pencil, Save, X, Search, Filter, CalendarPlus, Download,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AnunciosProprietarioPanel } from "@/components/captacao/AnunciosProprietarioPanel";

interface ContatoLanding {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  mensagem: string;
  lido: boolean;
  created_at: string;
  source_url?: string | null;
}

type StatusFilter = "todos" | "novos" | "lidos";
type ViewMode = "cards" | "tabela";
type Aba = "leads" | "anuncios";

const LeadsLanding = () => {
  const { isMaster } = useAuth();
  const [contatos, setContatos] = useState<ContatoLanding[]>([]);
  const [aba, setAba] = useState<Aba>("leads");

  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ nome: "", email: "", telefone: "", mensagem: "" });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");

  const fetchContatos = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("contatos_landing")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Erro ao buscar contatos landing:", error);
    } else {
      setContatos((data as ContatoLanding[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isMaster) fetchContatos();
  }, [isMaster, fetchContatos]);

  // Realtime
  useEffect(() => {
    if (!isMaster) return;
    const channel = supabase
      .channel("contatos-landing-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "contatos_landing" }, () => {
        fetchContatos();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isMaster, fetchContatos]);

  // Leads reais do site: registros automáticos de extração ficam na aba "Anúncios captados"
  const contatosSite = useMemo(
    () => contatos.filter(c => !c.source_url && c.email !== "sistema@radarimob.tech"),
    [contatos],
  );

  const filteredContatos = useMemo(() => {
    let result = contatosSite;
    if (statusFilter === "novos") result = result.filter(c => !c.lido);
    if (statusFilter === "lidos") result = result.filter(c => c.lido);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c =>
        c.nome.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.telefone || "").includes(q) ||
        c.mensagem.toLowerCase().includes(q)
      );
    }
    return result;
  }, [contatosSite, statusFilter, searchQuery]);

  const naoLidos = contatosSite.filter(c => !c.lido).length;


  const toggleLido = async (id: string, lido: boolean) => {
    const { error } = await supabase.from("contatos_landing").update({ lido: !lido }).eq("id", id);
    if (error) {
      toast.error("Erro ao atualizar status");
    } else {
      setContatos(prev => prev.map(c => c.id === id ? { ...c, lido: !lido } : c));
    }
  };

  const startEdit = (c: ContatoLanding) => {
    setEditingId(c.id);
    setEditForm({ nome: c.nome, email: c.email, telefone: c.telefone || "", mensagem: c.mensagem });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ nome: "", email: "", telefone: "", mensagem: "" });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setSavingEdit(true);
    const { error } = await supabase
      .from("contatos_landing")
      .update({ nome: editForm.nome, email: editForm.email, telefone: editForm.telefone || null, mensagem: editForm.mensagem })
      .eq("id", editingId);
    setSavingEdit(false);
    if (error) {
      toast.error("Erro ao salvar alterações");
    } else {
      setContatos(prev =>
        prev.map(c => c.id === editingId
          ? { ...c, nome: editForm.nome, email: editForm.email, telefone: editForm.telefone || null, mensagem: editForm.mensagem }
          : c
        )
      );
      toast.success("Lead atualizado!");
      cancelEdit();
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("contatos_landing").delete().eq("id", deleteId);
    if (error) {
      toast.error("Erro ao excluir lead");
    } else {
      setContatos(prev => prev.filter(c => c.id !== deleteId));
      toast.success("Lead excluído!");
    }
    setDeleteId(null);
  };

  const openWhatsapp = (telefone: string | null, nome: string) => {
    if (!telefone) return;
    const num = telefone.replace(/\D/g, "");
    const fullNum = num.startsWith("55") ? num : `55${num}`;
    window.open(`https://wa.me/${fullNum}?text=${encodeURIComponent(`Olá ${nome}! Recebemos seu contato pelo nosso site. Como posso ajudá-lo?`)}`, "_blank");
  };

  const openFollowup = (c: ContatoLanding) => {
    if (!c.telefone) {
      toast.info("Este lead não possui telefone para follow-up via WhatsApp.");
      return;
    }
    const num = c.telefone.replace(/\D/g, "");
    const fullNum = num.startsWith("55") ? num : `55${num}`;
    const msg = `Olá ${c.nome}! Tudo bem? Estou entrando em contato novamente referente ao seu interesse. Posso te ajudar com mais informações?`;
    window.open(`https://wa.me/${fullNum}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  if (!isMaster) return <Navigate to="/dashboard" replace />;

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Megaphone className="w-6 h-6 text-primary" />
              <h2 className="text-xl font-bold text-foreground">CRM Landing Page</h2>
              {naoLidos > 0 && (
                <Badge variant="destructive" className="text-xs">{naoLidos} novo{naoLidos > 1 ? "s" : ""}</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {filteredContatos.length} leads · Gerencie os contatos recebidos pelo formulário do site
            </p>
          </div>
        </div>

        {/* Abas */}
        <div className="flex border rounded-lg overflow-hidden w-fit">
          <button
            onClick={() => setAba("leads")}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${aba === "leads" ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-secondary/80"}`}
          >
            Leads do site
          </button>
          <button
            onClick={() => setAba("anuncios")}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${aba === "anuncios" ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-secondary/80"}`}
          >
            Anúncios captados (proprietário direto)
          </button>
        </div>

        {/* Filters */}
        {aba === "leads" && (
        <div className="flex items-center gap-2 flex-wrap">

          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, email, telefone..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={v => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="novos">Não lidos</SelectItem>
              <SelectItem value="lidos">Lidos</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex border rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode("cards")}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === "cards" ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-secondary/80"}`}
            >
              Cards
            </button>
            <button
              onClick={() => setViewMode("tabela")}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === "tabela" ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-secondary/80"}`}
            >
              Tabela
            </button>
          </div>
        </div>
        )}
      </div>

      {aba === "anuncios" ? (
        <AnunciosProprietarioPanel />
      ) : loading ? (

        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredContatos.length === 0 ? (
        <div className="text-center py-16">
          <Megaphone className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">Nenhum lead encontrado.</p>
        </div>
      ) : viewMode === "tabela" ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card glow-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Mensagem</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContatos.map(c => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Badge variant={c.lido ? "secondary" : "default"} className="text-[10px]">
                      {c.lido ? "Lido" : "Novo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{c.nome}</TableCell>
                  <TableCell>
                    <a href={`mailto:${c.email}`} className="text-xs text-muted-foreground hover:text-primary">{c.email}</a>
                  </TableCell>
                  <TableCell className="text-xs">{c.telefone || "—"}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">{c.mensagem}</TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(c.created_at)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => openFollowup(c)} className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600 hover:bg-blue-500/20" title="Follow-up">
                        <CalendarPlus className="w-3.5 h-3.5" />
                      </button>
                      {c.telefone && (
                        <button onClick={() => openWhatsapp(c.telefone, c.nome)} className="w-7 h-7 rounded-lg bg-green-500/10 flex items-center justify-center text-green-600 hover:bg-green-500/20" title="WhatsApp">
                          <MessageCircle className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button onClick={() => startEdit(c)} className="w-7 h-7 rounded-lg bg-secondary/50 flex items-center justify-center text-muted-foreground hover:bg-secondary" title="Editar">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => toggleLido(c.id, c.lido)} className="w-7 h-7 rounded-lg bg-secondary/50 flex items-center justify-center text-muted-foreground hover:bg-secondary" title={c.lido ? "Marcar como não lido" : "Marcar como lido"}>
                        {c.lido ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => setDeleteId(c.id)} className="w-7 h-7 rounded-lg bg-destructive/10 flex items-center justify-center text-destructive hover:bg-destructive/20" title="Excluir">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filteredContatos.map((c, i) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className={`p-4 rounded-xl border transition-all ${
                c.lido ? "bg-secondary/30 border-border/50" : "bg-primary/5 border-primary/20 shadow-sm"
              }`}
            >
              {editingId === c.id ? (
                <div className="space-y-2">
                  <Input value={editForm.nome} onChange={e => setEditForm(f => ({ ...f, nome: e.target.value }))} placeholder="Nome" className="h-8 text-sm" />
                  <Input value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} placeholder="Email" className="h-8 text-sm" />
                  <Input value={editForm.telefone} onChange={e => setEditForm(f => ({ ...f, telefone: e.target.value }))} placeholder="Telefone" className="h-8 text-sm" />
                  <Textarea value={editForm.mensagem} onChange={e => setEditForm(f => ({ ...f, mensagem: e.target.value }))} placeholder="Mensagem" className="text-sm min-h-[60px]" />
                  <div className="flex gap-2 justify-end">
                    <Button size="sm" variant="ghost" onClick={cancelEdit} disabled={savingEdit}><X className="w-3.5 h-3.5 mr-1" /> Cancelar</Button>
                    <Button size="sm" onClick={saveEdit} disabled={savingEdit}>
                      {savingEdit ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />} Salvar
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-foreground">{c.nome}</span>
                        {!c.lido && <Badge className="text-[10px] px-1.5 py-0 bg-primary/20 text-primary border-0">Novo</Badge>}
                      </div>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <a href={`mailto:${c.email}`} className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1">
                          <Mail className="w-3 h-3" />{c.email}
                        </a>
                        {c.telefone && (
                          <span className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 cursor-pointer" onClick={() => openWhatsapp(c.telefone, c.nome)}>
                            <Phone className="w-3 h-3" />{c.telefone}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{c.mensagem}</p>
                      <span className="text-[10px] text-muted-foreground/60 mt-1 block">{formatDate(c.created_at)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 mt-3 pt-2 border-t border-border/30">
                    <button onClick={() => openFollowup(c)} className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600 hover:bg-blue-500/20" title="Follow-up">
                      <CalendarPlus className="w-3.5 h-3.5" />
                    </button>
                    {c.telefone && (
                      <button onClick={() => openWhatsapp(c.telefone, c.nome)} className="w-7 h-7 rounded-lg bg-green-500/10 flex items-center justify-center text-green-600 hover:bg-green-500/20" title="WhatsApp">
                        <MessageCircle className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button onClick={() => startEdit(c)} className="w-7 h-7 rounded-lg bg-secondary/50 flex items-center justify-center text-muted-foreground hover:bg-secondary" title="Editar">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => toggleLido(c.id, c.lido)} className="w-7 h-7 rounded-lg bg-secondary/50 flex items-center justify-center text-muted-foreground hover:bg-secondary" title={c.lido ? "Marcar como não lido" : "Marcar como lido"}>
                      {c.lido ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={() => setDeleteId(c.id)} className="w-7 h-7 rounded-lg bg-destructive/10 flex items-center justify-center text-destructive hover:bg-destructive/20" title="Excluir">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lead?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita. O contato será removido permanentemente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default LeadsLanding;
