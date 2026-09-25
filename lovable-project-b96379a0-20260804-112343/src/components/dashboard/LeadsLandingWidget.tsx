import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { motion } from "framer-motion";
import { Megaphone, Phone, Mail, MessageCircle, Eye, EyeOff, Trash2, Loader2, Pencil, CalendarPlus, Save, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ContatoLanding {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  mensagem: string;
  lido: boolean;
  created_at: string;
}

export function LeadsLandingWidget() {
  const { isMaster } = useAuth();
  const [contatos, setContatos] = useState<ContatoLanding[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ nome: "", email: "", telefone: "", mensagem: "" });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const fetchContatos = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("contatos_landing")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
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

  const toggleLido = async (id: string, lido: boolean) => {
    const { error } = await supabase
      .from("contatos_landing")
      .update({ lido: !lido })
      .eq("id", id);
    if (error) {
      toast.error("Erro ao atualizar status");
    } else {
      setContatos((prev) => prev.map((c) => (c.id === id ? { ...c, lido: !lido } : c)));
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
      .update({
        nome: editForm.nome,
        email: editForm.email,
        telefone: editForm.telefone || null,
        mensagem: editForm.mensagem,
      })
      .eq("id", editingId);
    setSavingEdit(false);
    if (error) {
      toast.error("Erro ao salvar alterações");
    } else {
      setContatos((prev) =>
        prev.map((c) =>
          c.id === editingId
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
      setContatos((prev) => prev.filter((c) => c.id !== deleteId));
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

  if (!isMaster) return null;

  const naoLidos = contatos.filter((c) => !c.lido).length;
  const displayed = showAll ? contatos : contatos.slice(0, 5);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass-card p-5 md:p-6 glow-border"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-primary" />
            <div>
              <h3 className="text-base font-semibold text-foreground">
                Leads da Landing Page
              </h3>
              <p className="text-xs text-muted-foreground">
                Contatos recebidos pelo formulário do site
              </p>
            </div>
          </div>
          {naoLidos > 0 && (
            <Badge variant="destructive" className="text-xs">
              {naoLidos} novo{naoLidos > 1 ? "s" : ""}
            </Badge>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : contatos.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhum contato recebido ainda.
          </p>
        ) : (
          <div className="space-y-3">
            {displayed.map((c) => (
              <div
                key={c.id}
                className={`p-3 rounded-xl border transition-all ${
                  c.lido
                    ? "bg-secondary/30 border-border/50"
                    : "bg-primary/5 border-primary/20 shadow-sm"
                }`}
              >
                {editingId === c.id ? (
                  <div className="space-y-2">
                    <Input
                      value={editForm.nome}
                      onChange={(e) => setEditForm((f) => ({ ...f, nome: e.target.value }))}
                      placeholder="Nome"
                      className="h-8 text-sm"
                    />
                    <Input
                      value={editForm.email}
                      onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                      placeholder="Email"
                      className="h-8 text-sm"
                    />
                    <Input
                      value={editForm.telefone}
                      onChange={(e) => setEditForm((f) => ({ ...f, telefone: e.target.value }))}
                      placeholder="Telefone"
                      className="h-8 text-sm"
                    />
                    <Textarea
                      value={editForm.mensagem}
                      onChange={(e) => setEditForm((f) => ({ ...f, mensagem: e.target.value }))}
                      placeholder="Mensagem"
                      className="text-sm min-h-[60px]"
                    />
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="ghost" onClick={cancelEdit} disabled={savingEdit}>
                        <X className="w-3.5 h-3.5 mr-1" /> Cancelar
                      </Button>
                      <Button size="sm" onClick={saveEdit} disabled={savingEdit}>
                        {savingEdit ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />}
                        Salvar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-foreground">
                          {c.nome}
                        </span>
                        {!c.lido && (
                          <Badge className="text-[10px] px-1.5 py-0 bg-primary/20 text-primary border-0">
                            Novo
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <a
                          href={`mailto:${c.email}`}
                          className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Mail className="w-3 h-3" />
                          {c.email}
                        </a>
                        {c.telefone && (
                          <span
                            className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 cursor-pointer"
                            onClick={() => openWhatsapp(c.telefone, c.nome)}
                          >
                            <Phone className="w-3 h-3" />
                            {c.telefone}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">
                        {c.mensagem}
                      </p>
                      <span className="text-[10px] text-muted-foreground/60 mt-1 block">
                        {new Date(c.created_at).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => openFollowup(c)}
                        className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600 hover:bg-blue-500/20 transition-colors"
                        title="Follow-up"
                      >
                        <CalendarPlus className="w-3.5 h-3.5" />
                      </button>
                      {c.telefone && (
                        <button
                          onClick={() => openWhatsapp(c.telefone, c.nome)}
                          className="w-7 h-7 rounded-lg bg-green-500/10 flex items-center justify-center text-green-600 hover:bg-green-500/20 transition-colors"
                          title="WhatsApp"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => startEdit(c)}
                        className="w-7 h-7 rounded-lg bg-secondary/50 flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors"
                        title="Editar"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => toggleLido(c.id, c.lido)}
                        className="w-7 h-7 rounded-lg bg-secondary/50 flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors"
                        title={c.lido ? "Marcar como não lido" : "Marcar como lido"}
                      >
                        {c.lido ? (
                          <EyeOff className="w-3.5 h-3.5" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        onClick={() => setDeleteId(c.id)}
                        className="w-7 h-7 rounded-lg bg-destructive/10 flex items-center justify-center text-destructive hover:bg-destructive/20 transition-colors"
                        title="Excluir"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {contatos.length > 5 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                onClick={() => setShowAll(!showAll)}
              >
                {showAll
                  ? "Mostrar menos"
                  : `Ver todos (${contatos.length})`}
              </Button>
            )}
          </div>
        )}
      </motion.div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lead?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O contato será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
