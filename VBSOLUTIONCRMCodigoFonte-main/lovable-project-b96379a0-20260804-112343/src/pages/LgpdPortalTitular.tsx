import { useEffect, useState } from "react";
import { Seo } from "@/components/Seo";

import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ShieldCheck, FileText, Loader2 } from "lucide-react";

const TIPOS = [
  { v: "acesso", l: "Acesso aos meus dados" },
  { v: "correcao", l: "Correção de dados" },
  { v: "exclusao", l: "Exclusão / apagamento" },
  { v: "oposicao", l: "Oposição ao tratamento" },
  { v: "portabilidade", l: "Portabilidade" },
  { v: "revogacao_consentimento", l: "Revogar consentimento" },
  { v: "anonimizacao", l: "Anonimização" },
  { v: "informacao_uso", l: "Informação sobre uso / compartilhamento" },
];

export default function LgpdPortalTitular() {
  const [form, setForm] = useState({
    tipo: "acesso",
    nome: "",
    email: "",
    telefone: "",
    documento: "",
    descricao: "",
  });
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{ protocolo: string; prazo: string } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const [consulta, setConsulta] = useState({ protocolo: "", email: "" });
  const [statusResp, setStatusResp] = useState<any>(null);
  const [consultando, setConsultando] = useState(false);

  useEffect(() => { document.title = "Central LGPD do Titular · radarimobtech"; }, []);


  const enviar = async () => {
    setErro(null); setResultado(null); setEnviando(true);
    try {
      const { data, error } = await supabase.functions.invoke("lgpd-portal-titular", {
        body: { action: "criar", ...form },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResultado({ protocolo: data.protocolo, prazo: data.prazo_legal_em });
      setForm({ tipo: "acesso", nome: "", email: "", telefone: "", documento: "", descricao: "" });
    } catch (e: any) {
      setErro(e?.message ?? "Falha ao enviar.");
    } finally { setEnviando(false); }
  };

  const consultar = async () => {
    setStatusResp(null); setConsultando(true);
    try {
      const { data, error } = await supabase.functions.invoke("lgpd-portal-titular", {
        body: { action: "consultar", ...consulta },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setStatusResp(data.solicitacao);
    } catch (e: any) {
      setStatusResp({ erro: e?.message ?? "Não localizada." });
    } finally { setConsultando(false); }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Seo title="Portal LGPD — Direitos do titular | radarimobtech" description="Exerça seus direitos LGPD sobre dados pessoais tratados pela radarimobtech: acesso, correção, exclusão, portabilidade e revogação de consentimento." path="/lgpd/meus-dados" />


      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="flex items-center gap-3 mb-6">
          <ShieldCheck className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold">Central LGPD do Titular</h1>
            <p className="text-sm text-muted-foreground">Exerça seus direitos sobre os dados pessoais tratados pela plataforma.</p>
          </div>
        </div>

        <Tabs defaultValue="solicitar">
          <TabsList>
            <TabsTrigger value="solicitar">Fazer solicitação</TabsTrigger>
            <TabsTrigger value="acompanhar">Acompanhar por protocolo</TabsTrigger>
            <TabsTrigger value="direitos">Meus direitos</TabsTrigger>
          </TabsList>

          <TabsContent value="solicitar">
            <Card>
              <CardHeader><CardTitle>Nova solicitação</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {resultado && (
                  <Alert>
                    <AlertDescription>
                      Solicitação registrada. <strong>Protocolo:</strong> <code>{resultado.protocolo}</code>.<br />
                      Prazo legal de resposta: {new Date(resultado.prazo).toLocaleDateString("pt-BR")}.
                    </AlertDescription>
                  </Alert>
                )}
                {erro && <Alert variant="destructive"><AlertDescription>{erro}</AlertDescription></Alert>}

                <div>
                  <Label>Tipo de solicitação</Label>
                  <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TIPOS.map(t => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  <div><Label>Nome completo *</Label><Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} /></div>
                  <div><Label>E-mail *</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
                  <div><Label>Telefone</Label><Input value={form.telefone} onChange={e => setForm({ ...form, telefone: e.target.value })} placeholder="(DDD) 9xxxx-xxxx" /></div>
                  <div><Label>Documento (CPF/RG)</Label><Input value={form.documento} onChange={e => setForm({ ...form, documento: e.target.value })} /></div>
                </div>
                <div>
                  <Label>Descrição do pedido *</Label>
                  <Textarea rows={5} value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })}
                    placeholder="Ex.: solicito a exclusão de todos os meus dados coletados do anúncio publicado no portal X em 05/2026." />
                </div>
                <p className="text-xs text-muted-foreground">
                  Seus dados serão usados apenas para verificar sua identidade e atender à sua solicitação, com prazo legal de 15 dias (Art. 19 da LGPD).
                </p>
                <div className="flex justify-end">
                  <Button onClick={enviar} disabled={enviando || !form.nome || !form.email || form.descricao.length < 10}>
                    {enviando && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Enviar solicitação
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="acompanhar">
            <Card>
              <CardHeader><CardTitle>Acompanhar solicitação</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid md:grid-cols-2 gap-3">
                  <div><Label>Protocolo</Label><Input value={consulta.protocolo} onChange={e => setConsulta({ ...consulta, protocolo: e.target.value })} /></div>
                  <div><Label>E-mail informado</Label><Input value={consulta.email} onChange={e => setConsulta({ ...consulta, email: e.target.value })} /></div>
                </div>
                <Button onClick={consultar} disabled={consultando || !consulta.protocolo || !consulta.email}>
                  {consultando && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Consultar
                </Button>
                {statusResp && (
                  <Alert className="mt-2">
                    <AlertDescription>
                      {statusResp.erro ? statusResp.erro : (
                        <div className="space-y-1 text-sm">
                          <div><strong>Tipo:</strong> {statusResp.tipo}</div>
                          <div><strong>Status:</strong> {statusResp.status}</div>
                          <div><strong>Aberta em:</strong> {new Date(statusResp.created_at).toLocaleString("pt-BR")}</div>
                          <div><strong>Prazo:</strong> {new Date(statusResp.prazo_legal_em).toLocaleDateString("pt-BR")}</div>
                          {statusResp.respondido_em && <div><strong>Respondida em:</strong> {new Date(statusResp.respondido_em).toLocaleString("pt-BR")}</div>}
                          {statusResp.resposta && <div><strong>Resposta:</strong> {statusResp.resposta}</div>}
                        </div>
                      )}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="direitos">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Seus direitos (LGPD Art. 18)</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>Enquanto titular de dados pessoais, você pode requerer a qualquer momento:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Confirmação da existência de tratamento;</li>
                  <li>Acesso aos dados;</li>
                  <li>Correção de dados incompletos, inexatos ou desatualizados;</li>
                  <li>Anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados em desconformidade;</li>
                  <li>Portabilidade dos dados a outro fornecedor;</li>
                  <li>Eliminação dos dados tratados com base no consentimento;</li>
                  <li>Informação sobre entidades públicas e privadas com as quais o controlador compartilhou dados;</li>
                  <li>Informação sobre a possibilidade de não fornecer consentimento e sobre as consequências da negativa;</li>
                  <li>Revogação do consentimento.</li>
                </ul>
                <p className="pt-2">A base legal para coleta pública de anúncios de imóveis é o <strong>legítimo interesse</strong> (Art. 7º, IX), sempre com resguardo dos direitos e liberdades fundamentais do titular.</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
