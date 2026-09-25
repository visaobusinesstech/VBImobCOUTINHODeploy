import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, FolderDown, CheckCircle, AlertTriangle, Building2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete?: () => void;
}

export function ImportarCarteiraDialog({ open, onOpenChange, onImportComplete }: Props) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const { toast } = useToast();

  const handleImport = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("importar-carteira-portal", {
        body: { url: url.trim() },
      });
      if (fnErr) throw new Error(fnErr.message);
      if (data?.error) {
        setError(data.error);
        return;
      }
      if (data?.success) {
        setResult(data);
        if (data.importados > 0) {
          toast({ title: `✅ ${data.importados} imóveis importados com sucesso!` });
          onImportComplete?.();
        }
      }
    } catch (err: any) {
      setError(err.message || "Erro ao processar a importação.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setUrl("");
      setResult(null);
      setError("");
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderDown className="w-5 h-5 text-primary" />
            Importar Carteira de Portal
          </DialogTitle>
          <DialogDescription>
            Cole o link de uma página de listagem de imóveis de qualquer portal (OLX, ZAP, VivaReal, etc.) e importaremos todos os imóveis encontrados automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>URL da página de listagem</Label>
            <div className="flex gap-2 mt-1">
              <Input
                placeholder="https://www.zapimoveis.com.br/venda/apartamentos/df+brasilia/"
                value={url}
                onChange={e => setUrl(e.target.value)}
                className="flex-1"
                disabled={loading}
              />
              <Button onClick={handleImport} disabled={loading || !url.trim()}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Importar"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Use páginas de busca/listagem que mostram vários imóveis (não anúncios individuais).
            </p>
          </div>

          {loading && (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-primary/5 border border-primary/20">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <div>
                <p className="text-sm font-medium">Processando importação...</p>
                <p className="text-xs text-muted-foreground">Acessando o portal, extraindo dados e salvando imóveis. Isso pode levar alguns segundos.</p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {result && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-400 text-sm">
                <CheckCircle className="w-4 h-4 shrink-0" />
                {result.message}
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 rounded-lg bg-muted">
                  <Building2 className="w-5 h-5 mx-auto mb-1 text-primary" />
                  <p className="text-lg font-bold">{result.importados}</p>
                  <p className="text-xs text-muted-foreground">Importados</p>
                </div>
                <div className="p-3 rounded-lg bg-muted">
                  <p className="text-lg font-bold">{result.total_encontrados}</p>
                  <p className="text-xs text-muted-foreground">Encontrados</p>
                </div>
                <div className="p-3 rounded-lg bg-muted">
                  <p className="text-sm font-medium">{result.portal}</p>
                  <p className="text-xs text-muted-foreground">Portal</p>
                </div>
              </div>

              <Button onClick={() => handleClose(false)} className="w-full" variant="outline">
                Fechar
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
