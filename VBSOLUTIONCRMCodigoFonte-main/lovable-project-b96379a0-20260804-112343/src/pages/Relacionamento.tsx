import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { SectionHeader } from "@/components/shared/MetricCard";
import { motion } from "framer-motion";
import { Heart, Calendar, MessageCircle, Edit, Plus, Trash2, User, Briefcase, Baby, Loader2, FileText, Send, Search, X, Filter, Phone, Mail } from "lucide-react";
import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useClientesRelacionamento, type ClienteRelacionamento, type Filho } from "@/hooks/useClientesRelacionamento";
import { format, differenceInDays, parseISO, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TemplatesDialog } from "@/components/relacionamento/TemplatesDialog";
import { SendMessageDialog } from "@/components/relacionamento/SendMessageDialog";

const emptyForm = {
  nome: "", telefone: "", email: "", aniversario: "", data_casamento: "",
  profissao: "", data_profissao: "", data_mudanca: "", data_compra_imovel: "",
  filhos: [] as Filho[], observacoes: "",
};

type EventoTipo = "aniversario" | "casamento" | "profissao" | "mudanca" | "compra" | "filhos";

const EVENTO_FILTROS: { tipo: EventoTipo; label: string; emoji: string }[] = [
  { tipo: "aniversario", label: "Aniversário", emoji: "🎂" },
  { tipo: "casamento", label: "Casamento", emoji: "💍" },
  { tipo: "profissao", label: "Profissão", emoji: "🎉" },
  { tipo: "mudanca", label: "Mudança", emoji: "🏠" },
  { tipo: "compra", label: "Compra", emoji: "🔑" },
  { tipo: "filhos", label: "Filhos", emoji: "🎈" },
];

function clienteTemEvento(c: ClienteRelacionamento, tipo: EventoTipo): boolean {
  switch (tipo) {
    case "aniversario": return !!c.aniversario;
    case "casamento": return !!c.data_casamento;
    case "profissao": return !!c.data_profissao;
    case "mudanca": return !!c.data_mudanca;
    case "compra": return !!c.data_compra_imovel;
    case "filhos": return c.filhos.length > 0;
  }
}

function proximoEvento(cliente: ClienteRelacionamento): string {
  const hoje = new Date();
  const eventos: { label: string; dias: number }[] = [];

  const checkDate = (dateStr: string | null, label: string) => {
    if (!dateStr) return;
    const d = parseISO(dateStr);
    if (!isValid(d)) return;
    const proximo = new Date(hoje.getFullYear(), d.getMonth(), d.getDate());
    if (proximo < hoje) proximo.setFullYear(proximo.getFullYear() + 1);
    eventos.push({ label, dias: differenceInDays(proximo, hoje) });
  };

  checkDate(cliente.aniversario, "Aniversário");
  checkDate(cliente.data_casamento, "Aniversário de casamento");
  checkDate(cliente.data_profissao, `Dia do(a) ${cliente.profissao || "profissional"}`);
  checkDate(cliente.data_mudanca, "Aniversário de mudança");
  checkDate(cliente.data_compra_imovel, "Aniversário de compra do imóvel");
  cliente.filhos.forEach(f => checkDate(f.data_nascimento, `Aniversário de ${f.nome}`));

  if (eventos.length === 0) return "Sem eventos próximos";
  eventos.sort((a, b) => a.dias - b.dias);
  const e = eventos[0];
  return e.dias === 0 ? `${e.label} é HOJE!` : `${e.label} em ${e.dias} dias`;
}

function clientesComEventoProximo(clientes: ClienteRelacionamento[], dias: number): number {
  const hoje = new Date();
  return clientes.filter(c => {
    if (!c.ativo) return false;
    const checkDate = (dateStr: string | null): boolean => {
      if (!dateStr) return false;
      const d = parseISO(dateStr);
      if (!isValid(d)) return false;
      const proximo = new Date(hoje.getFullYear(), d.getMonth(), d.getDate());
      if (proximo < hoje) proximo.setFullYear(proximo.getFullYear() + 1);
      const diff = differenceInDays(proximo, hoje);
      return diff >= 0 && diff <= dias;
    };
    return checkDate(c.aniversario) || checkDate(c.data_casamento) || checkDate(c.data_profissao) ||
      checkDate(c.data_mudanca) || checkDate(c.data_compra_imovel) ||
      c.filhos.some(f => checkDate(f.data_nascimento));
  }).length;
}

function getWhatsAppLink(telefone: string, msg: string) {
  const num = telefone.replace(/\D/g, "");
  return `https://wa.me/55${num}?text=${encodeURIComponent(msg)}`;
}

const Relacionamento = () => {
  const { clientes, loading, create, update, remove } = useClientesRelacionamento();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [sendMsgClient, setSendMsgClient] = useState<ClienteRelacionamento | null>(null);
  const [sendPreTipo, setSendPreTipo] = useState<string | undefined>(undefined);
  const [busca, setBusca] = useState("");
  const [filtroEventos, setFiltroEventos] = useState<EventoTipo[]>([]);

  const toggleFiltroEvento = (tipo: EventoTipo) => {
    setFiltroEventos(prev => prev.includes(tipo) ? prev.filter(t => t !== tipo) : [...prev, tipo]);
  };
  const openNew = () => { setEditId(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (c: ClienteRelacionamento) => {
    setEditId(c.id);
    setForm({
      nome: c.nome, telefone: c.telefone || "", email: c.email || "",
      aniversario: c.aniversario || "", data_casamento: c.data_casamento || "",
      profissao: c.profissao || "", data_profissao: c.data_profissao || "",
      data_mudanca: c.data_mudanca || "", data_compra_imovel: c.data_compra_imovel || "",
      filhos: c.filhos, observacoes: c.observacoes || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.nome.trim()) return;
    setSaving(true);
    const payload = {
      ...form,
      aniversario: form.aniversario || null,
      data_casamento: form.data_casamento || null,
      data_profissao: form.data_profissao || null,
      data_mudanca: form.data_mudanca || null,
      data_compra_imovel: form.data_compra_imovel || null,
      filhos: form.filhos,
    };
    if (editId) await update(editId, payload);
    else await create(payload);
    setSaving(false);
    setDialogOpen(false);
  };

  const addFilho = () => setForm(f => ({ ...f, filhos: [...f.filhos, { nome: "", data_nascimento: "" }] }));
  const removeFilho = (i: number) => setForm(f => ({ ...f, filhos: f.filhos.filter((_, idx) => idx !== i) }));
  const updateFilho = (i: number, key: keyof Filho, val: string) =>
    setForm(f => ({ ...f, filhos: f.filhos.map((fi, idx) => idx === i ? { ...fi, [key]: val } : fi) }));

  const set = (key: string, value: any) => setForm(prev => ({ ...prev, [key]: value }));

  const termoBusca = busca.toLowerCase().trim();
  const filtrar = (lista: ClienteRelacionamento[]) => {
    let resultado = lista;
    if (termoBusca) {
      resultado = resultado.filter(c =>
        c.nome.toLowerCase().includes(termoBusca) ||
        (c.telefone && c.telefone.includes(termoBusca)) ||
        (c.email && c.email.toLowerCase().includes(termoBusca)) ||
        (c.profissao && c.profissao.toLowerCase().includes(termoBusca))
      );
    }
    if (filtroEventos.length > 0) {
      resultado = resultado.filter(c => filtroEventos.some(tipo => clienteTemEvento(c, tipo)));
    }
    return resultado;
  };

  const ativos = filtrar(clientes.filter(c => c.ativo));
  const inativos = filtrar(clientes.filter(c => !c.ativo));

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-3 mb-0">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="flex flex-col gap-2">
            <div>
              <h2 className="text-xl font-bold text-foreground">Relacionamento</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Central de relacionamento com clientes</p>
            </div>
            <Button size="sm" onClick={openNew} className="self-start gap-1.5 px-5 py-2.5 font-semibold shadow-sm">
              <Plus className="w-4 h-4" /><span className="hidden sm:inline">Novo Cliente</span><span className="sm:hidden">Novo</span>
            </Button>
          </div>
          <div className="flex gap-2 items-center">
            {!loading && (
              <Badge variant="outline" className="text-xs gap-1 border-primary/30 text-primary whitespace-nowrap">
                <Calendar className="w-3 h-3" />
                {clientesComEventoProximo(clientes, 7)} evento(s) em 7 dias
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={() => setTemplatesOpen(true)} className="gap-1.5 hidden sm:flex"><FileText className="w-4 h-4" />Templates</Button>
          </div>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <div className="relative flex-1 min-w-[150px] max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar cliente..."
              className="pl-9 pr-8 h-9 text-sm w-full"
            />
            {busca && (
              <button onClick={() => setBusca("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={() => setTemplatesOpen(true)} className="gap-1.5 sm:hidden"><FileText className="w-4 h-4" />Templates</Button>
        </div>
      </div>

      {/* Filtros por tipo de evento */}
      <div className="flex items-center gap-1.5 sm:gap-2 mb-4 flex-wrap overflow-x-auto pb-1">
        <Filter className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <span className="text-xs text-muted-foreground mr-0.5 shrink-0">Eventos:</span>
        {EVENTO_FILTROS.map(ef => (
          <Badge
            key={ef.tipo}
            variant={filtroEventos.includes(ef.tipo) ? "default" : "secondary"}
            className="cursor-pointer text-xs transition-colors hover:bg-primary/20 whitespace-nowrap shrink-0"
            onClick={() => toggleFiltroEvento(ef.tipo)}
          >
            {ef.emoji} {ef.label}
          </Badge>
        ))}
        {filtroEventos.length > 0 && (
          <button onClick={() => setFiltroEventos([])} className="text-xs text-muted-foreground hover:text-foreground ml-1 underline shrink-0">
            Limpar
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {/* Próximos Eventos */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Clientes & Eventos</h3>
              <span className="ml-auto text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">{ativos.length} ativos</span>
            </div>
            {ativos.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum cliente cadastrado. Clique em "Novo Cliente".</p>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {ativos.map(c => (
                  <div key={c.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 rounded-lg bg-secondary/30">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                        {c.nome.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{c.nome}</p>
                        <p className="text-xs text-muted-foreground">{proximoEvento(c)}</p>
                        {c.telefone && <a href={`https://wa.me/55${c.telefone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="text-[11px] text-muted-foreground hover:text-green-600 transition-colors flex items-center gap-1"><Phone className="w-3 h-3" />{c.telefone}</a>}
                        {c.email && <a href={`mailto:${c.email}`} className="text-[11px] text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"><Mail className="w-3 h-3" />{c.email}</a>}
                        {c.profissao && <p className="text-[11px] text-primary flex items-center gap-1"><Briefcase className="w-3 h-3" />{c.profissao}</p>}
                        {c.filhos.length > 0 && <p className="text-[11px] text-muted-foreground flex items-center gap-1 truncate"><Baby className="w-3 h-3 shrink-0" />{c.filhos.map(f => f.nome + (f.data_nascimento ? ` (${format(parseISO(f.data_nascimento), "dd/MM/yyyy")})` : "")).join(", ")}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 ml-12 sm:ml-0">
                      <button onClick={() => openEdit(c)} className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground" title="Editar">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button onClick={() => { setSendPreTipo(undefined); setSendMsgClient(c); }} className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary hover:bg-primary/20 transition-colors" title="Enviar mensagem">
                        <Send className="w-4 h-4" />
                      </button>
                      {c.telefone && (
                        <a
                          href={getWhatsAppLink(c.telefone, `Olá ${c.nome.split(" ")[0]}! 😊`)}
                          target="_blank" rel="noopener noreferrer"
                          className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary hover:bg-primary/20 transition-colors"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </a>
                      )}
                      <button onClick={() => setDeleteConfirm(c.id)} className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center text-destructive hover:bg-destructive/20">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          {/* Inativos */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Heart className="w-4 h-4 text-destructive" />
              <h3 className="text-sm font-semibold text-foreground">Clientes Inativos</h3>
              <span className="ml-auto text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">{inativos.length} para reativar</span>
            </div>
            {inativos.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum cliente inativo.</p>
            ) : (
              <div className="space-y-3">
                {inativos.map(c => (
                  <div key={c.id} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30">
                    <div className="w-9 h-9 rounded-full bg-destructive/20 flex items-center justify-center text-xs font-semibold text-destructive">
                      {c.nome.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{c.nome}</p>
                      <p className="text-xs text-muted-foreground">{c.profissao || "Sem profissão"}</p>
                    </div>
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => { setSendPreTipo("reativacao"); setSendMsgClient(c); }} title="Enviar mensagem de reativação">
                        <Send className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Reativar via msg</span>
                      </Button>
                      <Button size="sm" variant="default" onClick={() => update(c.id, { ativo: true })}>Reativar</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? "Editar Cliente" : "Novo Cliente"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome *</Label><Input value={form.nome} onChange={e => set("nome", e.target.value)} placeholder="Nome completo" required /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Telefone</Label><Input value={form.telefone} onChange={e => set("telefone", e.target.value)} placeholder="(11) 99999-0000" /></div>
              <div><Label>E-mail</Label><Input type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="email@exemplo.com" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Data de Nascimento</Label><Input type="date" value={form.aniversario} onChange={e => set("aniversario", e.target.value)} /></div>
              <div><Label>Data de Casamento</Label><Input type="date" value={form.data_casamento} onChange={e => set("data_casamento", e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Profissão</Label><Input value={form.profissao} onChange={e => set("profissao", e.target.value)} placeholder="Ex: Engenheiro" /></div>
              <div><Label>Dia da Profissão</Label><Input type="date" value={form.data_profissao} onChange={e => set("data_profissao", e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Data de Mudança</Label><Input type="date" value={form.data_mudanca} onChange={e => set("data_mudanca", e.target.value)} /></div>
              <div><Label>Data de Compra do Imóvel</Label><Input type="date" value={form.data_compra_imovel} onChange={e => set("data_compra_imovel", e.target.value)} /></div>
            </div>

            {/* Filhos */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="flex items-center gap-1"><Baby className="w-3.5 h-3.5" />Filhos</Label>
                <Button type="button" variant="outline" size="sm" onClick={addFilho}><Plus className="w-3 h-3 mr-1" />Adicionar</Button>
              </div>
              {form.filhos.map((f, i) => (
                <div key={i} className="flex gap-2 mb-2 items-end">
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground">Nome</Label>
                    <Input value={f.nome} onChange={e => updateFilho(i, "nome", e.target.value)} placeholder="Nome do filho" />
                  </div>
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground">Data de Nascimento</Label>
                    <Input type="date" value={f.data_nascimento} onChange={e => updateFilho(i, "data_nascimento", e.target.value)} />
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeFilho(i)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                </div>
              ))}
            </div>

            <div><Label>Observações</Label><Input value={form.observacoes} onChange={e => set("observacoes", e.target.value)} placeholder="Anotações..." /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !form.nome.trim()}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {editId ? "Salvar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader><DialogTitle>Confirmar exclusão</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Deseja realmente excluir este cliente?</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={async () => { if (deleteConfirm) { await remove(deleteConfirm); setDeleteConfirm(null); } }}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TemplatesDialog open={templatesOpen} onOpenChange={setTemplatesOpen} />
      <SendMessageDialog open={!!sendMsgClient} onOpenChange={(o) => { if (!o) { setSendMsgClient(null); setSendPreTipo(undefined); } }} cliente={sendMsgClient} preSelectTipo={sendPreTipo} />
    </DashboardLayout>
  );
};

export default Relacionamento;
