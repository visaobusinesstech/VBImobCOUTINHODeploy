import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useTabPersistence } from "@/hooks/useTabPersistence";
import { SectionHeader } from "@/components/shared/MetricCard";
import { motion } from "framer-motion";
import { Zap, Mail, MessageCircle, Bell, Clock, ToggleLeft, ToggleRight, Plus, Globe, Share2, CreditCard, FileSignature, Edit, ExternalLink, Loader2, Trash2, Lock } from "lucide-react";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAutomacoes, type Automacao } from "@/hooks/useAutomacoes";
import { useAuth } from "@/contexts/AuthContext";

const tipoIcons: Record<string, any> = {
  whatsapp: MessageCircle,
  email: Mail,
  notificacao: Bell,
  tarefa: Clock,
  portal: Globe,
  social: Share2,
  pagamento: CreditCard,
  assinatura: FileSignature,
};

const tipoColors: Record<string, string> = {
  whatsapp: "text-success",
  email: "text-info",
  notificacao: "text-warning",
  tarefa: "text-chart-4",
  portal: "text-primary",
  social: "text-chart-4",
  pagamento: "text-success",
  assinatura: "text-info",
};

const Automacoes = () => {
  const { isMaster } = useAuth();

  if (!isMaster) {
    return (
      <DashboardLayout>
        <SectionHeader title="Automações" subtitle="Motor de automação avançado" />
        <div className="rounded-xl border border-border bg-card p-10 text-center space-y-3 mt-6">
          <Lock className="w-12 h-12 text-muted-foreground mx-auto" />
          <h3 className="text-lg font-semibold text-foreground">Funcionalidade em desenvolvimento</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            O módulo de Automações estará disponível em breve.
            Fique atento às próximas atualizações!
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return <AutomacoesContent />;
};

const AutomacoesContent = () => {
  const { automacoes, loading, toggleAtivo, updateAutomacao, createAutomacao, deleteAutomacao } = useAutomacoes();
  const [editItem, setEditItem] = useState<Automacao | null>(null);
  const [autoTab, setAutoTab] = useTabPersistence("automacoes_active_tab", "comunicacao");
  const [editNome, setEditNome] = useState("");
  const [editTrigger, setEditTrigger] = useState("");
  const [editAcao, setEditAcao] = useState("");
  const [deleteItem, setDeleteItem] = useState<Automacao | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [newNome, setNewNome] = useState("");
  const [newTrigger, setNewTrigger] = useState("");
  const [newAcao, setNewAcao] = useState("");
  const [newTipo, setNewTipo] = useState("whatsapp");
  const [newCategoria, setNewCategoria] = useState("comunicacao");
  const [newPlataformaNome, setNewPlataformaNome] = useState("");
  const [newPlataformaUrl, setNewPlataformaUrl] = useState("");

  const openEdit = (auto: Automacao) => {
    setEditItem(auto);
    setEditNome(auto.nome);
    setEditTrigger(auto.trigger_desc);
    setEditAcao(auto.acao);
  };

  const saveEdit = async () => {
    if (!editItem) return;
    await updateAutomacao(editItem.id, { nome: editNome, trigger_desc: editTrigger, acao: editAcao });
    setEditItem(null);
  };

  const handleCreate = async () => {
    if (!newNome.trim() || !newTrigger.trim() || !newAcao.trim()) return;
    await createAutomacao({
      nome: newNome,
      trigger_desc: newTrigger,
      acao: newAcao,
      tipo: newTipo,
      categoria: newCategoria,
      ativo: true,
      plataforma_nome: newPlataformaNome || null,
      plataforma_url: newPlataformaUrl || null,
    });
    setCreateOpen(false);
    setNewNome(""); setNewTrigger(""); setNewAcao(""); setNewTipo("whatsapp"); setNewCategoria("comunicacao");
    setNewPlataformaNome(""); setNewPlataformaUrl("");
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    await deleteAutomacao(deleteItem.id);
    setDeleteItem(null);
  };

  const renderList = (categoria: string) => {
    const filtered = automacoes.filter((a) => a.categoria === categoria);
    if (filtered.length === 0) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          <Zap className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Nenhuma automação nesta categoria.</p>
          <button onClick={() => { setNewCategoria(categoria); setCreateOpen(true); }} className="mt-2 text-sm text-primary hover:underline">Criar automação</button>
        </div>
      );
    }
    return (
      <div className="grid gap-3">
        {filtered.map((auto, i) => {
          const Icon = tipoIcons[auto.tipo] || Zap;
          return (
            <motion.div
              key={auto.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`glass-card p-4 flex items-center gap-4 transition-all ${!auto.ativo ? "opacity-50" : ""}`}
            >
              <div className={`w-10 h-10 rounded-lg bg-secondary flex items-center justify-center ${tipoColors[auto.tipo] || "text-primary"}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-foreground">{auto.nome}</h3>
                  <Zap className="w-3 h-3 text-primary" />
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  <span className="text-info">{auto.trigger_desc}</span>
                  {" → "}
                  <span>{auto.acao}</span>
                </p>
                {auto.plataforma_nome && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Plataforma: <span className="text-primary font-medium">{auto.plataforma_nome}</span>
                  </p>
                )}
              </div>
              <div className="text-right mr-2 hidden md:block">
                <p className="text-xs text-muted-foreground">{auto.execucoes} execuções</p>
              </div>
              {auto.plataforma_url && (
                <a href={auto.plataforma_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors" title={`Abrir ${auto.plataforma_nome}`}>
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
              <button onClick={() => openEdit(auto)} className="text-muted-foreground hover:text-foreground transition-colors">
                <Edit className="w-4 h-4" />
              </button>
              <button onClick={() => setDeleteItem(auto)} className="text-muted-foreground hover:text-destructive transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
              <button onClick={() => toggleAtivo(auto.id, !auto.ativo)} className="text-foreground">
                {auto.ativo ? (
                  <ToggleRight className="w-8 h-8 text-primary" />
                ) : (
                  <ToggleLeft className="w-8 h-8 text-muted-foreground" />
                )}
              </button>
            </motion.div>
          );
        })}
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-3 mb-6">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="flex flex-col gap-2">
            <div>
              <h2 className="text-xl font-bold text-foreground">Automações</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Configure triggers e ações automáticas ({automacoes.length} automações)</p>
            </div>
            <button onClick={() => setCreateOpen(true)} className="self-start flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm">
              <Plus className="w-4 h-4" />Nova Automação
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <Tabs value={autoTab} onValueChange={setAutoTab} className="w-full">
          <TabsList className="mb-4 bg-secondary flex-wrap">
            <TabsTrigger value="comunicacao" className="gap-1.5"><MessageCircle className="w-3.5 h-3.5" />Comunicação ({automacoes.filter(a => a.categoria === "comunicacao").length})</TabsTrigger>
            <TabsTrigger value="portal" className="gap-1.5"><Globe className="w-3.5 h-3.5" />Portais ({automacoes.filter(a => a.categoria === "portal").length})</TabsTrigger>
            <TabsTrigger value="social" className="gap-1.5"><Share2 className="w-3.5 h-3.5" />Redes Sociais ({automacoes.filter(a => a.categoria === "social").length})</TabsTrigger>
            <TabsTrigger value="financeiro" className="gap-1.5"><CreditCard className="w-3.5 h-3.5" />Financeiro ({automacoes.filter(a => a.categoria === "financeiro").length})</TabsTrigger>
          </TabsList>
          <TabsContent value="comunicacao">{renderList("comunicacao")}</TabsContent>
          <TabsContent value="portal">{renderList("portal")}</TabsContent>
          <TabsContent value="social">{renderList("social")}</TabsContent>
          <TabsContent value="financeiro">{renderList("financeiro")}</TabsContent>
        </Tabs>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              Nova Automação
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-muted-foreground">Nome da automação</Label>
              <Input value={newNome} onChange={(e) => setNewNome(e.target.value)} placeholder="Ex: Boas-vindas novo lead" className="mt-1 bg-secondary border-border" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-muted-foreground">Tipo</Label>
                <Select value={newTipo} onValueChange={setNewTipo}>
                  <SelectTrigger className="mt-1 bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="email">E-mail</SelectItem>
                    <SelectItem value="notificacao">Notificação</SelectItem>
                    <SelectItem value="tarefa">Tarefa</SelectItem>
                    <SelectItem value="portal">Portal</SelectItem>
                    <SelectItem value="social">Rede Social</SelectItem>
                    <SelectItem value="pagamento">Pagamento</SelectItem>
                    <SelectItem value="assinatura">Assinatura</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-muted-foreground">Categoria</Label>
                <Select value={newCategoria} onValueChange={setNewCategoria}>
                  <SelectTrigger className="mt-1 bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="comunicacao">Comunicação</SelectItem>
                    <SelectItem value="portal">Portais</SelectItem>
                    <SelectItem value="social">Redes Sociais</SelectItem>
                    <SelectItem value="financeiro">Financeiro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-muted-foreground">Gatilho (Trigger)</Label>
              <Input value={newTrigger} onChange={(e) => setNewTrigger(e.target.value)} placeholder="Ex: Lead criado, Pagamento atrasado..." className="mt-1 bg-secondary border-border" />
            </div>
            <div>
              <Label className="text-muted-foreground">Ação</Label>
              <Input value={newAcao} onChange={(e) => setNewAcao(e.target.value)} placeholder="Ex: Enviar WhatsApp de boas-vindas" className="mt-1 bg-secondary border-border" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-muted-foreground">Plataforma (opcional)</Label>
                <Input value={newPlataformaNome} onChange={(e) => setNewPlataformaNome(e.target.value)} placeholder="Ex: WhatsApp Business" className="mt-1 bg-secondary border-border" />
              </div>
              <div>
                <Label className="text-muted-foreground">URL da plataforma</Label>
                <Input value={newPlataformaUrl} onChange={(e) => setNewPlataformaUrl(e.target.value)} placeholder="https://..." className="mt-1 bg-secondary border-border" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!newNome.trim() || !newTrigger.trim() || !newAcao.trim()}>Criar Automação</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editItem} onOpenChange={(open) => !open && setEditItem(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Editar Automação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label className="text-muted-foreground">Nome</Label><Input value={editNome} onChange={(e) => setEditNome(e.target.value)} className="mt-1 bg-secondary border-border" /></div>
            <div><Label className="text-muted-foreground">Trigger</Label><Input value={editTrigger} onChange={(e) => setEditTrigger(e.target.value)} className="mt-1 bg-secondary border-border" /></div>
            <div><Label className="text-muted-foreground">Ação</Label><Input value={editAcao} onChange={(e) => setEditAcao(e.target.value)} className="mt-1 bg-secondary border-border" /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditItem(null)}>Cancelar</Button>
            <Button onClick={saveEdit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteItem} onOpenChange={(open) => !open && setDeleteItem(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir automação?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{deleteItem?.nome}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default Automacoes;
