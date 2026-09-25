import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useTabPersistence } from "@/hooks/useTabPersistence";
import { SectionHeader, MetricCard } from "@/components/shared/MetricCard";
import { motion } from "framer-motion";
import { Users, Trophy, TrendingUp, Star, Phone, Mail, Edit, Plus, Trash2, Search, X, BarChart3, MapPin } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CorretorDesempenhoTab } from "@/components/corretores/CorretorDesempenhoTab";
import { AtribuicaoRegrasTab } from "@/components/corretores/AtribuicaoRegrasTab";
import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface Corretor {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  status: string;
}

interface Permissao {
  modulo: string;
  ativo: boolean;
}

const MODULOS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "imoveis", label: "Imóveis" },
  { key: "crm", label: "CRM Pipeline" },
  { key: "automacoes", label: "Automações" },
  { key: "financeiro", label: "Financeiro" },
  { key: "contratos", label: "Contratos" },
  { key: "relacionamento", label: "Relacionamento" },
  { key: "jornada", label: "Jornada do Cliente" },
  { key: "followups", label: "Follow-up" },
  { key: "seguranca", label: "Segurança" },
  { key: "configuracoes", label: "Configurações" },
  { key: "proprietarios", label: "Proprietários" },
];

const Corretores = () => {
  const { user, imobiliariaId } = useAuth();
  const { toast } = useToast();
  const [corrTab, setCorrTab] = useTabPersistence("corretores_active_tab", "desempenho");
  const [corretores, setCorretores] = useState<Corretor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Dialog states
  const [showCreate, setShowCreate] = useState(false);
  const [editItem, setEditItem] = useState<Corretor | null>(null);
  const [editFields, setEditFields] = useState({ nome: "", email: "", telefone: "", creci: "" });

  // Permissions dialog
  const [permCorretor, setPermCorretor] = useState<Corretor | null>(null);
  const [permissoes, setPermissoes] = useState<Permissao[]>([]);

  const fetchCorretores = async () => {
    const { data, error } = await supabase
      .from("corretores")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setCorretores(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchCorretores();
  }, []);

  const handleCreate = async () => {
    if (!editFields.nome || !user) return;
    const { error } = await supabase.from("corretores").insert({
      imobiliaria_id: imobiliariaId,
      nome: editFields.nome,
      email: editFields.email || null,
      telefone: editFields.telefone || null,
      creci: editFields.creci || null,
    } as any);
    if (error) {
      toast({ title: "Erro ao criar corretor", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Corretor criado!" });
      // Create default permissions (all active)
      const { data: newCorretores } = await supabase
        .from("corretores")
        .select("id")
        .eq("nome", editFields.nome)
        .eq("imobiliaria_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1);
      if (newCorretores?.[0]) {
        await supabase.from("corretor_permissoes").insert(
          MODULOS.map((m) => ({ corretor_id: newCorretores[0].id, modulo: m.key, ativo: true }))
        );
      }
      fetchCorretores();
      setShowCreate(false);
      setEditFields({ nome: "", email: "", telefone: "", creci: "" });
    }
  };

  const openEdit = (c: Corretor) => {
    setEditItem(c);
    setEditFields({ nome: c.nome, email: c.email || "", telefone: c.telefone || "", creci: (c as any).creci || "" });
  };

  const saveEdit = async () => {
    if (!editItem) return;
    const { error } = await supabase.from("corretores").update({
      nome: editFields.nome,
      email: editFields.email || null,
      telefone: editFields.telefone || null,
      creci: editFields.creci || null,
    } as any).eq("id", editItem.id);
    if (!error) {
      toast({ title: "Corretor atualizado!" });
      fetchCorretores();
    }
    setEditItem(null);
  };

  const deleteCorretor = async (id: string) => {
    await supabase.from("corretores").delete().eq("id", id);
    toast({ title: "Corretor removido" });
    fetchCorretores();
  };

  // Permissions
  const openPermissions = async (c: Corretor) => {
    setPermCorretor(c);
    const { data } = await supabase
      .from("corretor_permissoes")
      .select("modulo, ativo")
      .eq("corretor_id", c.id);
    if (data) {
      const existing = new Map(data.map((p) => [p.modulo, p.ativo]));
      setPermissoes(MODULOS.map((m) => ({ modulo: m.key, ativo: existing.get(m.key) ?? true })));
    } else {
      setPermissoes(MODULOS.map((m) => ({ modulo: m.key, ativo: true })));
    }
  };

  const togglePermission = async (modulo: string, ativo: boolean) => {
    if (!permCorretor) return;
    setPermissoes((prev) => prev.map((p) => (p.modulo === modulo ? { ...p, ativo } : p)));
    await supabase
      .from("corretor_permissoes")
      .upsert({ corretor_id: permCorretor.id, modulo, ativo }, { onConflict: "corretor_id,modulo" });
  };

  const initials = (nome: string) =>
    nome.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  const filteredCorretores = useMemo(() => {
    if (!searchQuery.trim()) return corretores;
    const q = searchQuery.toLowerCase();
    return corretores.filter(c =>
      c.nome.toLowerCase().includes(q) ||
      (c.email && c.email.toLowerCase().includes(q)) ||
      (c.telefone && c.telefone.toLowerCase().includes(q))
    );
  }, [corretores, searchQuery]);

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-3 mb-6">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-bold text-foreground">Corretores</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Cadastre e acompanhe o desempenho da equipe</p>
          </div>
        </div>
      </div>

      <Tabs value={corrTab} onValueChange={setCorrTab} className="space-y-4">
        <TabsList className="grid grid-cols-3 w-full max-w-xl">
          <TabsTrigger value="desempenho" className="gap-1.5"><BarChart3 className="w-3.5 h-3.5" />Desempenho</TabsTrigger>
          <TabsTrigger value="equipe" className="gap-1.5"><Users className="w-3.5 h-3.5" />Equipe</TabsTrigger>
          <TabsTrigger value="atribuicao" className="gap-1.5"><MapPin className="w-3.5 h-3.5" />Atribuição</TabsTrigger>
        </TabsList>

        <TabsContent value="desempenho">
          <CorretorDesempenhoTab />
        </TabsContent>

        <TabsContent value="atribuicao">
          <AtribuicaoRegrasTab />
        </TabsContent>

        <TabsContent value="equipe">
          <div className="mb-4">
            <button
              onClick={() => { setShowCreate(true); setEditFields({ nome: "", email: "", telefone: "", creci: "" }); }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm"
            >
              <Plus className="w-4 h-4" /> Novo Corretor
            </button>
          </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <MetricCard title="Total Corretores" value={String(corretores.length)} icon={Users} delay={0} />
        <MetricCard title="Ativos" value={String(corretores.filter((c) => c.status === "ativo").length)} icon={Trophy} delay={0.1} />
        <MetricCard title="Cadastrados hoje" value="–" icon={TrendingUp} delay={0.2} />
        <MetricCard title="NPS Médio" value="–" icon={Star} delay={0.3} />
      </div>

      {/* Search bar */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Buscar por nome, e-mail ou telefone..."
          className="w-full h-10 pl-10 pr-10 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredCorretores.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">{corretores.length === 0 ? "Nenhum corretor cadastrado ainda." : "Nenhum corretor encontrado."}</p>
          {corretores.length === 0 && <p className="text-xs text-muted-foreground mt-1">Clique em "Novo Corretor" para começar.</p>}
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Corretor</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contato</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Funções</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filteredCorretores.map((c, i) => (
                <motion.tr key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold text-primary">{initials(c.nome)}</div>
                      <span className="text-sm font-medium text-foreground">{c.nome}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="space-y-0.5">
                      {c.email && <a href={`mailto:${c.email}`} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors cursor-pointer"><Mail className="w-3 h-3" />{c.email}</a>}
                      {c.telefone && <a href={`https://wa.me/55${c.telefone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-green-600 transition-colors cursor-pointer"><Phone className="w-3 h-3" />{c.telefone}</a>}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${c.status === "ativo" ? "text-success" : "text-muted-foreground"}`}>
                      <span className={`w-2 h-2 rounded-full ${c.status === "ativo" ? "bg-success" : "bg-muted-foreground"}`} />
                      {c.status === "ativo" ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <button onClick={() => openPermissions(c)} className="text-xs text-primary hover:underline">
                      Gerenciar Funções
                    </button>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(c)} className="text-muted-foreground hover:text-foreground"><Edit className="w-4 h-4" /></button>
                      <button onClick={() => deleteCorretor(c.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
       )}
        </TabsContent>
      </Tabs>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle className="text-foreground">Novo Corretor</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label className="text-muted-foreground">Nome</Label><Input value={editFields.nome} onChange={(e) => setEditFields({ ...editFields, nome: e.target.value })} className="mt-1 bg-secondary border-border" placeholder="Nome completo" /></div>
            <div><Label className="text-muted-foreground">E-mail</Label><Input value={editFields.email} onChange={(e) => setEditFields({ ...editFields, email: e.target.value })} className="mt-1 bg-secondary border-border" placeholder="email@exemplo.com" /></div>
            <div><Label className="text-muted-foreground">Telefone</Label><Input value={editFields.telefone} onChange={(e) => setEditFields({ ...editFields, telefone: e.target.value })} className="mt-1 bg-secondary border-border" placeholder="(11) 99999-0000" /></div>
            <div><Label className="text-muted-foreground">CRECI</Label><Input value={editFields.creci} onChange={(e) => setEditFields({ ...editFields, creci: e.target.value })} className="mt-1 bg-secondary border-border" placeholder="CRECI 00000-F" /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button onClick={handleCreate}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editItem} onOpenChange={(open) => !open && setEditItem(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle className="text-foreground">Editar Corretor</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label className="text-muted-foreground">Nome</Label><Input value={editFields.nome} onChange={(e) => setEditFields({ ...editFields, nome: e.target.value })} className="mt-1 bg-secondary border-border" /></div>
            <div><Label className="text-muted-foreground">E-mail</Label><Input value={editFields.email} onChange={(e) => setEditFields({ ...editFields, email: e.target.value })} className="mt-1 bg-secondary border-border" /></div>
            <div><Label className="text-muted-foreground">Telefone</Label><Input value={editFields.telefone} onChange={(e) => setEditFields({ ...editFields, telefone: e.target.value })} className="mt-1 bg-secondary border-border" /></div>
            <div><Label className="text-muted-foreground">CRECI</Label><Input value={editFields.creci} onChange={(e) => setEditFields({ ...editFields, creci: e.target.value })} className="mt-1 bg-secondary border-border" /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditItem(null)}>Cancelar</Button>
            <Button onClick={saveEdit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Permissions Dialog */}
      <Dialog open={!!permCorretor} onOpenChange={(open) => !open && setPermCorretor(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Funções — {permCorretor?.nome}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground mb-4">
            Ative ou desative o acesso do corretor a cada módulo do sistema.
          </p>
          <div className="space-y-3">
            {permissoes.map((p) => {
              const moduloInfo = MODULOS.find((m) => m.key === p.modulo);
              return (
                <div key={p.modulo} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                  <span className="text-sm text-foreground">{moduloInfo?.label || p.modulo}</span>
                  <Switch checked={p.ativo} onCheckedChange={(checked) => togglePermission(p.modulo, checked)} />
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button onClick={() => setPermCorretor(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Corretores;
