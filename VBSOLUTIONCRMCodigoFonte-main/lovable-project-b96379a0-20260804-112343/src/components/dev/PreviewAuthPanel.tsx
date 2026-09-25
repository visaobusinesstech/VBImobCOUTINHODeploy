import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { KeyRound, LogIn, LogOut, ShieldAlert, Loader2 } from "lucide-react";
import {
  isPreviewHost,
  previewLogin,
  previewLogout,
  getStoredPreviewEmail,
  getStoredPreviewSecret,
} from "@/lib/previewAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function PreviewAuthPanel() {
  const { toast } = useToast();
  const [email, setEmail] = useState(getStoredPreviewEmail());
  const [secret, setSecret] = useState(getStoredPreviewSecret());
  const [loading, setLoading] = useState(false);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setSessionEmail(data.user?.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_ev, s) =>
      setSessionEmail(s?.user?.email ?? null),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!isPreviewHost()) {
    return (
      <Alert variant="destructive">
        <ShieldAlert className="h-4 w-4" />
        <AlertDescription>
          Este painel só funciona em ambientes de preview (localhost / *.lovable.app).
        </AlertDescription>
      </Alert>
    );
  }

  const handleLogin = async () => {
    setLoading(true);
    try {
      const res = await previewLogin({ secret, email });
      toast({ title: "Sessão de preview ativa", description: res.email });
    } catch (e: any) {
      toast({ title: "Falha no preview login", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await previewLogout();
    toast({ title: "Sessão encerrada" });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="h-4 w-4" /> Mock JWT de preview
          {sessionEmail && <Badge variant="secondary" className="ml-2">logado: {sessionEmail}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Alert>
          <AlertDescription className="text-xs">
            Emite um JWT real para o e-mail informado (via <code>dev-preview-login</code>),
            protegido pelo segredo <code>DEV_PREVIEW_SECRET</code>. Depois disso as edge
            functions autenticadas (<code>captacao-inteligente</code>,{" "}
            <code>extrair-dados-anuncio</code>, <code>filtrar-proprietarios-ia</code>,{" "}
            <code>calibrar-filtro-ia</code>) recebem o Bearer automaticamente.
          </AlertDescription>
        </Alert>

        <div className="grid gap-2">
          <Label htmlFor="pv-email">E-mail do usuário de preview</Label>
          <Input
            id="pv-email"
            type="email"
            placeholder="dev@radarimobtech.shop"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="off"
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="pv-secret">DEV_PREVIEW_SECRET</Label>
          <Input
            id="pv-secret"
            type="password"
            placeholder="segredo compartilhado"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            autoComplete="off"
          />
          <p className="text-[11px] text-muted-foreground">
            Salvo apenas no seu navegador (localStorage). Se estiver vazio, peça ao
            admin o valor do secret configurado no Backend.
          </p>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleLogin} disabled={loading || !email || !secret} size="sm">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
            <span className="ml-2">Entrar como preview</span>
          </Button>
          {sessionEmail && (
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" /> Sair
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
