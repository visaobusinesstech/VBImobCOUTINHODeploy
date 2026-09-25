import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Copy, ExternalLink, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Cobranca {
  descricao: string;
  valor: number;
  data_vencimento: string;
  status: string;
  categoria: string;
  link_pagamento: string | null;
  confirmado_em: string | null;
  destinatario: string | null;
}

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export default function PagamentoPublico() {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cobranca, setCobranca] = useState<Cobranca | null>(null);
  const [imob, setImob] = useState<{ nome_imobiliaria?: string; logo_url?: string; telefone?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [comprovanteUrl, setComprovanteUrl] = useState("");

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("cobranca-confirmar", {
        method: "GET",
        headers: { "x-token": token },
      } as any);
      // fallback: fetch direto
      let payload = data;
      if (!payload) {
        const res = await fetch(
          `https://ugxnxztecfsklijmhhmo.supabase.co/functions/v1/cobranca-confirmar?token=${token}`,
        );
        payload = await res.json();
        if (!res.ok) throw new Error(payload.error || "Erro");
      }
      if (payload.error) throw new Error(payload.error);
      setCobranca(payload.cobranca);
      setImob(payload.imobiliaria);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [token]);

  const confirmar = async () => {
    if (!nome.trim()) {
      toast({ title: "Informe seu nome", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(
        `https://ugxnxztecfsklijmhhmo.supabase.co/functions/v1/cobranca-confirmar`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, pago_por: nome, comprovante_url: comprovanteUrl || null }),
        },
      );
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Falha");
      toast({ title: "Pagamento confirmado", description: "A imobiliária foi notificada." });
      await load();
    } catch (err) {
      toast({ title: "Erro", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const copyLink = () => {
    if (cobranca?.link_pagamento) {
      navigator.clipboard.writeText(cobranca.link_pagamento);
      toast({ title: "Link/PIX copiado" });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !cobranca) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="max-w-md w-full">
          <CardHeader><CardTitle>Cobrança não encontrada</CardTitle></CardHeader>
          <CardContent><p className="text-muted-foreground">{error ?? "Verifique o link recebido."}</p></CardContent>
        </Card>
      </div>
    );
  }

  const jaPago = !!cobranca.confirmado_em;

  return (
    <div className="min-h-screen bg-muted/30 py-10 px-4">
      <div className="max-w-lg mx-auto space-y-6">
        {imob && (
          <div className="text-center space-y-2">
            {imob.logo_url && <img src={imob.logo_url} alt={imob.nome_imobiliaria} className="h-16 mx-auto" />}
            <h1 className="text-xl font-semibold">{imob.nome_imobiliaria}</h1>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Cobrança</span>
              {jaPago && (
                <span className="text-success flex items-center gap-1 text-sm">
                  <CheckCircle2 className="h-4 w-4" /> Pago
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm text-muted-foreground">Descrição</div>
              <div className="font-medium">{cobranca.descricao}</div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Valor</div>
                <div className="text-2xl font-bold text-primary">{fmtBRL(cobranca.valor)}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Vencimento</div>
                <div className="font-medium">{new Date(cobranca.data_vencimento + "T00:00:00").toLocaleDateString("pt-BR")}</div>
              </div>
            </div>

            {cobranca.link_pagamento && (
              <div className="rounded-lg border p-3 bg-muted/30 space-y-2">
                <div className="text-sm font-medium">Link ou PIX de pagamento</div>
                <div className="text-xs break-all font-mono">{cobranca.link_pagamento}</div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={copyLink}>
                    <Copy className="h-3 w-3 mr-1" /> Copiar
                  </Button>
                  {cobranca.link_pagamento.startsWith("http") && (
                    <Button size="sm" asChild>
                      <a href={cobranca.link_pagamento} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-3 w-3 mr-1" /> Abrir
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            )}

            {jaPago ? (
              <div className="rounded-lg bg-success/10 text-success p-3 text-sm">
                Pagamento registrado em{" "}
                {new Date(cobranca.confirmado_em!).toLocaleString("pt-BR")}
              </div>
            ) : (
              <div className="space-y-3 pt-2 border-t">
                <div className="text-sm font-medium">Já pagou? Confirme abaixo</div>
                <div className="space-y-2">
                  <Label htmlFor="nome">Seu nome</Label>
                  <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Como você aparece no contrato" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="comp">Link do comprovante (opcional)</Label>
                  <Input id="comp" value={comprovanteUrl} onChange={(e) => setComprovanteUrl(e.target.value)} placeholder="https://..." />
                </div>
                <Button className="w-full" disabled={submitting} onClick={confirmar}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                  Confirmar pagamento
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  A imobiliária receberá a confirmação em tempo real.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
