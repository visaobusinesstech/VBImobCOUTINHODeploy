import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { SectionHeader, MetricCard } from "@/components/shared/MetricCard";
import { motion } from "framer-motion";
import { MessageCircle, ArrowUpRight, ArrowDownLeft, Plus, Trash2, Search, ExternalLink } from "lucide-react";
import { useState } from "react";
import { useMensagensWhatsapp } from "@/hooks/useMensagensWhatsapp";
import { RegistrarMensagemDialog } from "@/components/whatsapp/RegistrarMensagemDialog";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const WhatsApp = () => {
  const { mensagens, loading, registrarMensagem, deletarMensagem } = useMensagensWhatsapp();
  const [showDialog, setShowDialog] = useState(false);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todas" | "enviada" | "recebida">("todas");

  const filtered = mensagens.filter((m) => {
    const matchBusca = !busca || m.nome_contato.toLowerCase().includes(busca.toLowerCase()) || m.telefone_destino.includes(busca) || m.mensagem.toLowerCase().includes(busca.toLowerCase());
    const matchFiltro = filtro === "todas" || m.direcao === filtro;
    return matchBusca && matchFiltro;
  });

  const totalEnviadas = mensagens.filter((m) => m.direcao === "enviada").length;
  const totalRecebidas = mensagens.filter((m) => m.direcao === "recebida").length;

  const abrirWhatsapp = (telefone: string, mensagem?: string) => {
    const num = telefone.replace(/\D/g, "");
    const defaultMsg = mensagem || "Olá! Entrando em contato pela imobiliária.";
    const url = `https://wa.me/55${num}?text=${encodeURIComponent(defaultMsg)}`;
    window.open(url, "_blank");
  };

  return (
    <DashboardLayout>
      <SectionHeader
        title="WhatsApp"
        subtitle="Histórico de mensagens e comunicação via WhatsApp"
        action={
          <button
            onClick={() => setShowDialog(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" /> Registrar Mensagem
          </button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <MetricCard title="Total de Mensagens" value={String(mensagens.length)} icon={MessageCircle} delay={0} />
        <MetricCard title="Enviadas" value={String(totalEnviadas)} icon={ArrowUpRight} delay={0.1} />
        <MetricCard title="Recebidas" value={String(totalRecebidas)} icon={ArrowDownLeft} delay={0.2} />
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, telefone ou mensagem..."
            className="pl-10 bg-secondary border-border"
          />
        </div>
        <div className="flex gap-2">
          {(["todas", "enviada", "recebida"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filtro === f ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {f === "todas" ? "Todas" : f === "enviada" ? "Enviadas" : "Recebidas"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <MessageCircle className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Nenhuma mensagem registrada ainda.</p>
          <p className="text-xs text-muted-foreground mt-1">Clique em "Registrar Mensagem" para começar.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((m, i) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="glass-card p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                    m.direcao === "enviada" ? "bg-primary/20" : "bg-accent/50"
                  }`}>
                    {m.direcao === "enviada" ? (
                      <ArrowUpRight className="w-4 h-4 text-primary" />
                    ) : (
                      <ArrowDownLeft className="w-4 h-4 text-accent-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground">{m.nome_contato || "Sem nome"}</span>
                      <span className="text-xs text-muted-foreground">{m.telefone_destino}</span>
                      {m.contexto && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{m.contexto}</span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{m.mensagem}</p>
                    <span className="text-[10px] text-muted-foreground mt-1 block">
                      {format(new Date(m.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => abrirWhatsapp(m.telefone_destino, m.mensagem)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                    title="Abrir no WhatsApp"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deletarMensagem(m.id)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title="Excluir"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <RegistrarMensagemDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        onSubmit={registrarMensagem}
      />
    </DashboardLayout>
  );
};

export default WhatsApp;
