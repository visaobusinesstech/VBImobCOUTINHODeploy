import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RefreshCw, CheckCircle2, XCircle, Copy } from "lucide-react";
import { toast } from "sonner";

export default function EvolutionStatusPanel() {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const carregar = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("radarzap-evolution-status");
    if (error) toast.error("Erro ao consultar status");
    setStatus(data ?? null);
    setLoading(false);
  };

  useEffect(() => { carregar(); }, []);

  const copiar = (v: string) => {
    navigator.clipboard.writeText(v);
    toast.success("Copiado");
  };

  const configurado = status?.configured;
  const conectado = status?.state === "open";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Status da conexão WhatsApp</CardTitle>
        <Button size="sm" variant="outline" onClick={carregar} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={configurado ? "default" : "destructive"}>
            {configurado ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
            Evolution API {configurado ? "configurada" : "não configurada"}
          </Badge>
          {configurado && (
            <Badge variant={conectado ? "default" : "secondary"}>
              {conectado ? "Conectado" : `Estado: ${status?.state ?? "—"}`}
            </Badge>
          )}
          {status?.grupos_conectados != null && (
            <Badge variant="outline">{status.grupos_conectados} grupos ativos</Badge>
          )}
        </div>

        {!configurado && (
          <Alert>
            <AlertDescription>
              Configure os secrets <code>EVOLUTION_API_URL</code>, <code>EVOLUTION_API_KEY</code> e{" "}
              <code>EVOLUTION_INSTANCE</code> nas configurações do backend para ativar a ingestão ao vivo.
            </AlertDescription>
          </Alert>
        )}

        {configurado && !conectado && status?.qrcode && (
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">Escaneie o QR no WhatsApp → Aparelhos conectados</p>
            <img
              src={status.qrcode.startsWith("data:") ? status.qrcode : `data:image/png;base64,${status.qrcode}`}
              alt="QR Code"
              className="mx-auto max-w-[280px] border rounded"
            />
          </div>
        )}

        {status?.webhook_url && (
          <div className="rounded border p-3 text-sm space-y-2">
            <div className="font-medium">Configuração do webhook no Evolution</div>
            <div className="flex items-center gap-2">
              <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">{status.webhook_url}</code>
              <Button size="icon" variant="ghost" onClick={() => copiar(status.webhook_url)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <div className="text-xs text-muted-foreground">
              Autenticação por header <code>x-webhook-token</code> (valor: seu <code>EVOLUTION_WEBHOOK_SECRET</code>).<br />
              Eventos: <code>messages.upsert</code> e <code>groups.upsert</code>.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
