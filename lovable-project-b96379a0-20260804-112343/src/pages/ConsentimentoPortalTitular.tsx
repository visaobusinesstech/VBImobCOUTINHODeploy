import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ShieldCheck, ShieldX, Download, MessageCircle } from "lucide-react";
import { toast } from "sonner";

type Consentimento = {
  id: string;
  status: string;
  telefone: string;
  nome_contato: string | null;
  email: string | null;
  canal_origem: string;
  termo_versao: string | null;
  finalidades: string[];
  aceito_em: string | null;
  revogado_em: string | null;
  motivo_revogacao: string | null;
  created_at: string;
};

type Evento = {
  id: string;
  tipo_evento: string;
  descricao: string | null;
  created_at: string;
};

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pendente: { label: "Aguardando confirmação", color: "bg-amber-100 text-amber-800 border-amber-300" },
  ativo: { label: "Ativo", color: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  revogado: { label: "Revogado", color: "bg-red-100 text-red-800 border-red-300" },
  bloqueado: { label: "Bloqueado", color: "bg-slate-200 text-slate-800 border-slate-400" },
  expirado: { label: "Expirado", color: "bg-slate-100 text-slate-700 border-slate-300" },
};

export default function ConsentimentoPortalTitular() {
  const { token } = useParams();
  const [carregando, setCarregando] = useState(true);
  const [cons, setCons] = useState<Consentimento | null>(null);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [motivo, setMotivo] = useState("");
  const [revogando, setRevogando] = useState(false);

  useEffect(() => {
    if (!token) return;
    (async () => {
      const { data } = await supabase
        .from("whatsapp_consentimentos")
        .select("id, status, telefone, nome_contato, email, canal_origem, termo_versao, finalidades, aceito_em, revogado_em, motivo_revogacao, created_at")
        .eq("token_publico", token)
        .maybeSingle();

      if (data) {
        setCons(data as any);
        const { data: evs } = await supabase
          .from("whatsapp_consentimento_eventos")
          .select("id, tipo_evento, descricao, created_at")
          .eq("consentimento_id", data.id)
          .order("created_at", { ascending: false })
          .limit(50);
        setEventos((evs as any) || []);
      }
      setCarregando(false);
    })();
  }, [token]);

  async function revogar() {
    if (!cons) return;
    setRevogando(true);
    const { error } = await supabase
      .from("whatsapp_consentimentos")
      .update({
        status: "revogado",
        revogado_em: new Date().toISOString(),
        revogado_por: "titular_portal",
        motivo_revogacao: motivo || "Revogado pelo titular via portal público",
      })
      .eq("token_publico", token!);
    setRevogando(false);
    if (error) { toast.error("Falha ao revogar: " + error.message); return; }
    toast.success("Consentimento revogado. Não enviaremos mais mensagens.");
    setCons({ ...cons, status: "revogado", revogado_em: new Date().toISOString() });
  }

  function exportarDados() {
    if (!cons) return;
    const payload = {
      consentimento: cons,
      eventos,
      exportado_em: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `meu-consentimento-whatsapp-${cons.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (carregando) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!cons) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md">
          <CardHeader><CardTitle>Link inválido</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground">Este link de consentimento não foi encontrado ou expirou.</p></CardContent>
        </Card>
      </div>
    );
  }

  const st = STATUS_LABEL[cons.status] || STATUS_LABEL.pendente;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <MessageCircle className="h-8 w-8 text-emerald-600" />
          <div>
            <h1 className="text-2xl font-semibold">Meu consentimento — WhatsApp</h1>
            <p className="text-sm text-muted-foreground">Portal do titular (LGPD)</p>
          </div>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Situação atual</CardTitle>
            <Badge className={st.color + " border"}>{st.label}</Badge>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><span className="text-muted-foreground">Nome:</span> {cons.nome_contato || "—"}</div>
              <div><span className="text-muted-foreground">Telefone:</span> {cons.telefone}</div>
              <div><span className="text-muted-foreground">E-mail:</span> {cons.email || "—"}</div>
              <div><span className="text-muted-foreground">Origem:</span> {cons.canal_origem}</div>
              <div><span className="text-muted-foreground">Termo:</span> v{cons.termo_versao || "1.0"}</div>
              <div><span className="text-muted-foreground">Registrado em:</span> {new Date(cons.created_at).toLocaleString("pt-BR")}</div>
              {cons.aceito_em && <div><span className="text-muted-foreground">Aceito em:</span> {new Date(cons.aceito_em).toLocaleString("pt-BR")}</div>}
              {cons.revogado_em && <div><span className="text-muted-foreground">Revogado em:</span> {new Date(cons.revogado_em).toLocaleString("pt-BR")}</div>}
            </div>
            {cons.finalidades?.length ? (
              <div>
                <div className="text-muted-foreground mb-1">Finalidades autorizadas:</div>
                <div className="flex gap-2 flex-wrap">
                  {cons.finalidades.map(f => <Badge key={f} variant="outline">{f}</Badge>)}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {cons.status === "ativo" || cons.status === "pendente" ? (
          <Card>
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><ShieldX className="h-5 w-5 text-red-600" />Revogar consentimento</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">Você pode retirar seu consentimento a qualquer momento. Deixaremos de enviar mensagens imediatamente.</p>
              <Textarea placeholder="Motivo (opcional)" value={motivo} onChange={e => setMotivo(e.target.value)} maxLength={500} />
              <Button variant="destructive" onClick={revogar} disabled={revogando}>
                {revogando && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Confirmar revogação
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-emerald-300">
            <CardContent className="pt-6 flex items-center gap-3">
              <ShieldCheck className="h-6 w-6 text-emerald-600" />
              <p className="text-sm">Seu consentimento está <b>revogado</b>. Não enviaremos mais mensagens.</p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Histórico de eventos</CardTitle>
            <Button variant="outline" size="sm" onClick={exportarDados}><Download className="h-4 w-4 mr-2" />Exportar meus dados</Button>
          </CardHeader>
          <CardContent>
            {eventos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem eventos registrados.</p>
            ) : (
              <div className="space-y-2">
                {eventos.map(e => (
                  <div key={e.id} className="border-l-2 border-slate-200 pl-3 py-1">
                    <div className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString("pt-BR")}</div>
                    <div className="text-sm"><b>{e.tipo_evento}</b> {e.descricao ? "— " + e.descricao : ""}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground text-center">
          Base legal: Art. 7º, I e IX da LGPD. Em caso de dúvidas, entre em contato com o encarregado de dados da imobiliária.
        </p>
      </div>
    </div>
  );
}
