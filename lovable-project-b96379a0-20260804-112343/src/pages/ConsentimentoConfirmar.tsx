import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2, MessageCircle } from "lucide-react";

export default function ConsentimentoConfirmar() {
  const { token } = useParams();
  const [estado, setEstado] = useState<"processando" | "ok" | "ja_ativo" | "erro">("processando");
  const [msg, setMsg] = useState("");
  const [nome, setNome] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("whatsapp-optin-confirm", { body: { token } });
        if (error) throw error;
        if (data?.ja_ativo) { setEstado("ja_ativo"); setMsg("Seu opt-in já estava confirmado."); return; }
        if (data?.ok) {
          setEstado("ok");
          setNome(data?.nome_contato || null);
          setMsg("Opt-in confirmado com sucesso. Você passará a receber nossas comunicações via WhatsApp.");
        } else {
          setEstado("erro");
          setMsg(data?.error || "Não foi possível confirmar.");
        }
      } catch (err: any) {
        setEstado("erro");
        setMsg(err?.message || "Erro inesperado.");
      }
    })();
  }, [token]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="flex flex-row items-center gap-3">
          <MessageCircle className="h-8 w-8 text-emerald-600" />
          <CardTitle>Confirmação de opt-in</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          {estado === "processando" && <div className="py-8"><Loader2 className="h-8 w-8 animate-spin mx-auto text-emerald-600" /></div>}
          {(estado === "ok" || estado === "ja_ativo") && (
            <>
              <CheckCircle2 className="h-14 w-14 text-emerald-600 mx-auto" />
              <p className="font-medium">{nome ? `Obrigado, ${nome}!` : "Confirmado!"}</p>
              <p className="text-sm text-muted-foreground">{msg}</p>
              <p className="text-xs text-muted-foreground">Você pode revogar a qualquer momento respondendo <b>SAIR</b> no WhatsApp ou acessando seu portal de consentimento.</p>
            </>
          )}
          {estado === "erro" && (
            <>
              <XCircle className="h-14 w-14 text-red-600 mx-auto" />
              <p className="font-medium">Não foi possível confirmar</p>
              <p className="text-sm text-muted-foreground">{msg}</p>
              <Button asChild variant="outline"><Link to="/">Voltar ao site</Link></Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
