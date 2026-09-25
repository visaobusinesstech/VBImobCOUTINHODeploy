import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useTabPersistence } from "@/hooks/useTabPersistence";
import { SectionHeader } from "@/components/shared/MetricCard";
import { motion } from "framer-motion";
import { Users, Plus, Edit, Trash2, Loader2, Phone, Mail, Building2, Landmark, Home, Briefcase, Search, X, AlertTriangle, CheckCircle, FileText, MapPin, Maximize, FileSignature } from "lucide-react";
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useProprietarios, type Proprietario } from "@/hooks/useProprietarios";
import { useContratos } from "@/hooks/useContratos";
import { ProprietarioFormDialog } from "@/components/proprietarios/ProprietarioFormDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { WebResearchDialog } from "@/components/shared/WebResearchDialog";

const DIALOG_STATE_KEY = "proprietarios_dialog_state";

const tipoLabel: Record<string, string> = { venda: "Venda", aluguel: "Aluguel", ambos: "Ambos" };
const tipoColor: Record<string, string> = { venda: "bg-info/10 text-info", aluguel: "bg-success/10 text-success", ambos: "bg-primary/10 text-primary" };

const persistProprietarioDialogState = (isOpen: boolean, editId?: string | null) => {
  try {
    if (isOpen) {
      localStorage.setItem(DIALOG_STATE_KEY, JSON.stringify({ open: true, editId: editId || null }));
    } else {
      localStorage.removeItem(DIALOG_STATE_KEY);
    }
  } catch {
    // ignore
  }
};

const Proprietarios = () => {
  const { proprietarios, loading, create, update, remove } = useProprietarios();
  const { contratos } = useContratos();
  const [propTab, setPropTab] = useTabPersistence("proprietarios_active_tab", "todos");
  const navigate = useNavigate();
  const { toast } = useToast();

  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<Proprietario | null>(null);
  const [deleteItem, setDeleteItem] = useState<Proprietario | null>(null);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Restore dialog state on mount - only restore editItem once proprietarios load
  const restoredRef = useRef(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DIALOG_STATE_KEY);
      if (saved) {
        const state = JSON.parse(saved);
        if (state.open) {
          setFormOpen(true);
          if (state.editId && proprietarios.length > 0 && !restoredRef.current) {
            const found = proprietarios.find(p => p.id === state.editId);
            if (found) {
              setEditItem(found);
              restoredRef.current = true;
            }
          }
        }
      }
    } catch { /* ignore */ }
  }, [proprietarios]);

  const handleOpenPrivateFile = async (urlOrPath: string) => {
    try {
      // Extract path from signed URL if needed
      let path = urlOrPath;

      // Handle private:: prefix
      if (path.startsWith("private::")) {
        const parts = path.split("::");
        if (parts.length >= 3) {
          const bucket = parts[1];
          path = parts.slice(2).join("::");
          const { data, error } = await supabase.storage
            .from(bucket)
            .createSignedUrl(path, 3600);
          if (error || !data?.signedUrl) {
            console.error("[Proprietarios] Signed URL error:", error);
            toast({ title: "Erro ao abrir arquivo", description: "Não foi possível gerar o link.", variant: "destructive" });
            return;
          }
          window.open(data.signedUrl, "_blank", "noopener,noreferrer");
          return;
        }
      }

      const markers = ["/object/public/proprietarios/", "/object/sign/proprietarios/", "/storage/v1/object/public/proprietarios/", "/storage/v1/object/sign/proprietarios/"];
      for (const m of markers) {
        const idx = urlOrPath.indexOf(m);
        if (idx !== -1) {
          let extracted = urlOrPath.substring(idx + m.length);
          const qIdx = extracted.indexOf("?");
          if (qIdx !== -1) extracted = extracted.substring(0, qIdx);
          path = decodeURIComponent(extracted);
          break;
        }
      }
      const { data, error } = await supabase.storage
        .from("proprietarios")
        .createSignedUrl(path, 3600);
      if (error || !data?.signedUrl) {
        // Fallback: try opening original URL
        if (urlOrPath.startsWith("http")) {
          window.open(urlOrPath, "_blank", "noopener,noreferrer");
        } else {
          toast({ title: "Erro ao abrir arquivo", description: "Não foi possível gerar o link.", variant: "destructive" });
        }
        return;
      }
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch {
      if (urlOrPath.startsWith("http")) {
        window.open(urlOrPath, "_blank", "noopener,noreferrer");
      } else {
        toast({ title: "Erro ao abrir arquivo", variant: "destructive" });
      }
    }
  };


  useEffect(() => {
    persistProprietarioDialogState(formOpen, editItem?.id || null);
  }, [formOpen, editItem]);

  const handleFormOpenChange = (open: boolean) => {
    setFormOpen(open);
    if (!open) {
      persistProprietarioDialogState(false);
    }
  };

  const openCreate = () => {
    setEditItem(null);
    persistProprietarioDialogState(true, null);
    setFormOpen(true);
  };

  const openEdit = (proprietario: Proprietario) => {
    setEditItem(proprietario);
    persistProprietarioDialogState(true, proprietario.id);
    setFormOpen(true);
  };

  const handleSave = async (data: Partial<Proprietario>) => {
    setSaving(true);
    try {
      if (editItem) await update(editItem.id, data);
      else await create(data);
      setFormOpen(false);
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    await remove(deleteItem.id);
    setDeleteItem(null);
  };

  const contratosByProprietario = useMemo(() => {
    const map = new Map<string, number>();
    contratos.forEach(c => {
      if (c.proprietario_id) {
        map.set(c.proprietario_id, (map.get(c.proprietario_id) || 0) + 1);
      }
    });
    return map;
  }, [contratos]);

  const filteredProprietarios = useMemo(() => {
    if (!searchQuery.trim()) return proprietarios;
    const q = searchQuery.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return proprietarios.filter(p => {
      const norm = (s: string | null | undefined) => s ? s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "";
      return (
        norm(p.nome).includes(q) ||
        (p.telefone && p.telefone.replace(/\D/g, "").includes(q.replace(/\D/g, "")) && q.replace(/\D/g, "").length > 0) ||
        norm(p.email).includes(q) ||
        norm(p.cpf_cnpj).includes(q) ||
        norm(p.canal_origem).includes(q) ||
        norm(p.dados_imovel_endereco).includes(q)
      );
    });
  }, [proprietarios, searchQuery]);

  const vendaProps = filteredProprietarios.filter(p => p.tipo === "venda" || p.tipo === "ambos");
  const aluguelProps = filteredProprietarios.filter(p => p.tipo === "aluguel" || p.tipo === "ambos");

  // Ranking de captação por canal
  const rankingCaptacaoVenda = useMemo(() => {
    const map = new Map<string, number>();
    proprietarios.filter(p => p.tipo === "venda" || p.tipo === "ambos").forEach(p => {
      const canal = p.canal_origem || "Não informado";
      map.set(canal, (map.get(canal) || 0) + 1);
    });
    return Array.from(map.entries()).map(([canal, count]) => ({ canal, count })).sort((a, b) => b.count - a.count);
  }, [proprietarios]);

  const rankingCaptacaoAluguel = useMemo(() => {
    const map = new Map<string, number>();
    proprietarios.filter(p => p.tipo === "aluguel" || p.tipo === "ambos").forEach(p => {
      const canal = p.canal_origem || "Não informado";
      map.set(canal, (map.get(canal) || 0) + 1);
    });
    return Array.from(map.entries()).map(([canal, count]) => ({ canal, count })).sort((a, b) => b.count - a.count);
  }, [proprietarios]);

  const renderCard = (p: Proprietario, i: number) => (
    <motion.div key={p.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
      className="glass-card p-5 group cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all"
      onClick={() => openEdit(p)}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
            {p.nome.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">{p.nome}</h3>
            {p.cpf_cnpj && <p className="text-xs text-muted-foreground">{p.cpf_cnpj}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${tipoColor[p.tipo] || tipoColor.ambos}`}>
            {tipoLabel[p.tipo] || "Ambos"}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              const event = new CustomEvent("open-owner-research", { detail: p });
              window.dispatchEvent(event);
            }}
            className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-all"
            title="Diligência com IA"
          >
            <Search className="w-3.5 h-3.5" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); openEdit(p); }} className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-all">
            <Edit className="w-3.5 h-3.5" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); setDeleteItem(p); }} className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="space-y-1.5 text-xs text-muted-foreground">
        {p.telefone && (
          <a href={`https://wa.me/55${p.telefone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 hover:text-green-600 transition-colors cursor-pointer group/phone">
            <Phone className="w-3.5 h-3.5 group-hover/phone:text-green-600" />{p.telefone}
          </a>
        )}
        {p.email && (
          <a href={`mailto:${p.email}`}
            className="flex items-center gap-2 hover:text-primary transition-colors cursor-pointer group/email">
            <Mail className="w-3.5 h-3.5 group-hover/email:text-primary" />{p.email}
          </a>
        )}
        {p.endereco && <div className="flex items-center gap-2"><Home className="w-3.5 h-3.5" />{p.endereco}{p.cidade ? `, ${p.cidade}` : ""}</div>}
        {(p.banco || p.pix) && (
          <div className="flex items-center gap-2"><Landmark className="w-3.5 h-3.5" />
            {p.pix ? `PIX: ${p.pix}` : `${p.banco} Ag:${p.agencia} Cc:${p.conta}`}
          </div>
        )}
        {/* Dados do Imóvel */}
        {p.dados_imovel_endereco && (
          <div className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-primary" /><span className="text-primary">{p.dados_imovel_endereco}</span></div>
        )}
        {(p.dados_imovel_tipo || (p.dados_imovel_area && p.dados_imovel_area > 0)) && (
          <div className="flex items-center gap-2">
            {p.dados_imovel_tipo && <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-foreground">{p.dados_imovel_tipo}</span>}
            {p.dados_imovel_area && p.dados_imovel_area > 0 && (
              <span className="flex items-center gap-0.5"><Maximize className="w-3 h-3" />{p.dados_imovel_area}m²</span>
            )}
          </div>
        )}
        {/* Status financeiro badges */}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {p.contrato_administracao && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">📋 Administração</span>
          )}
          {p.exclusividade && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-warning/10 text-warning">⭐ Exclusividade</span>
          )}
          {(p.comissao_acordada || 0) > 0 && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-success/10 text-success">💰 {p.comissao_acordada}%</span>
          )}
          {p.quitado && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-success/10 text-success">✅ Quitado</span>
          )}
          {p.averbacao && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-info/10 text-info">📝 Averbação</span>
          )}
          {p.saldo_devedor && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-warning/10 text-warning">💳 Saldo Devedor</span>
          )}
          {p.parcela_atraso_financiamento && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">⚠️ Atraso Financ.</span>
          )}
          {p.parcela_atraso_condominio && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">⚠️ Atraso Cond.</span>
          )}
          {p.parcela_atraso_iptu && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">⚠️ Atraso IPTU</span>
          )}
          {p.exclusividade_contrato_url && (
            <button type="button" onClick={() => void handleOpenPrivateFile(p.exclusividade_contrato_url!)}
              className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary hover:underline flex items-center gap-1">
              <FileText className="w-3 h-3" /> Contrato
            </button>
          )}
          {p.canal_origem && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-secondary text-foreground">📍 {p.canal_origem}</span>
          )}
        </div>
        {/* Contratos vinculados */}
        {(contratosByProprietario.get(p.id) || 0) > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/contratos?proprietario=${p.id}`); }}
            className="mt-2 flex items-center gap-1.5 text-[10px] font-medium px-2 py-1 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          >
            <FileSignature className="w-3 h-3" />
            {contratosByProprietario.get(p.id)} contrato{(contratosByProprietario.get(p.id) || 0) > 1 ? "s" : ""}
          </button>
        )}
      </div>
    </motion.div>
  );

  const renderRanking = (data: { canal: string; count: number }[], title: string) => {
    if (data.length === 0) return null;
    const maxCount = Math.max(...data.map(d => d.count), 1);
    return (
      <div className="glass-card p-4">
        <h4 className="text-sm font-semibold text-foreground mb-3">{title}</h4>
        <div className="space-y-2">
          {data.slice(0, 8).map((item, i) => (
            <div key={item.canal} className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}.</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs text-foreground truncate">{item.canal}</span>
                  <span className="text-xs font-bold text-primary">{item.count}</span>
                </div>
                <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(item.count / maxCount) * 100}%` }}
                    transition={{ delay: i * 0.05 + 0.2 }}
                    className="h-full bg-primary rounded-full"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-3 mb-6">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="flex flex-col gap-2">
            <div>
              <h2 className="text-xl font-bold text-foreground">Proprietários</h2>
              <p className="text-sm text-muted-foreground mt-0.5">{proprietarios.length} proprietários</p>
            </div>
            <button onClick={openCreate} className="self-start flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm">
              <Plus className="w-4 h-4" />Novo Proprietário
            </button>
          </div>
        </div>
      </div>

      {/* Rankings */}
      {proprietarios.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {renderRanking(rankingCaptacaoVenda, "🏆 Ranking Captação - Venda")}
          {renderRanking(rankingCaptacaoAluguel, "🏆 Ranking Captação - Aluguel")}
        </div>
      )}

      {/* Search bar */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Buscar por nome, telefone, e-mail, CPF/CNPJ ou endereço do imóvel..."
          className="w-full h-10 pl-10 pr-10 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : proprietarios.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Nenhum proprietário cadastrado.</p>
          <button onClick={openCreate} className="mt-3 text-sm text-primary hover:underline">Cadastrar primeiro</button>
        </div>
      ) : (
        <Tabs value={propTab} onValueChange={setPropTab} className="w-full">
          <TabsList className="mb-4 bg-secondary">
            <TabsTrigger value="todos" className="gap-1.5"><Users className="w-3.5 h-3.5" />Todos ({filteredProprietarios.length})</TabsTrigger>
            <TabsTrigger value="venda" className="gap-1.5"><Briefcase className="w-3.5 h-3.5" />Venda ({vendaProps.length})</TabsTrigger>
            <TabsTrigger value="aluguel" className="gap-1.5"><Building2 className="w-3.5 h-3.5" />Aluguel ({aluguelProps.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="todos">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{filteredProprietarios.map((p, i) => renderCard(p, i))}</div>
          </TabsContent>
          <TabsContent value="venda">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{vendaProps.map((p, i) => renderCard(p, i))}</div>
          </TabsContent>
          <TabsContent value="aluguel">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{aluguelProps.map((p, i) => renderCard(p, i))}</div>
          </TabsContent>
        </Tabs>
      )}

      <ProprietarioFormDialog open={formOpen} onOpenChange={handleFormOpenChange} proprietario={editItem} onSave={handleSave} saving={saving} />

      <AlertDialog open={!!deleteItem} onOpenChange={(open) => !open && setDeleteItem(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir proprietário?</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir "{deleteItem?.nome}"?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <WebResearchDialog />
    </DashboardLayout>
  );
};

export default Proprietarios;
