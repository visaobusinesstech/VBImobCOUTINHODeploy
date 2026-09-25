import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, ShieldCheck, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type Criado = { id: string; url: string; nome: string; fontes: number };

export default function ColetaCandidatosPanel() {
  const { toast } = useToast();
  const [cidade, setCidade] = useState("");
  const [bairro, setBairro] = useState("");
  const [operacao, setOperacao] = useState<"venda" | "aluguel">("venda");
  const [tipo, setTipo] = useState<string>("apartamento");
  const [max, setMax] = useState(10);
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<{ criados: Criado[]; total_resultados: number; erros: any[] } | null>(null);

  const executar = async (dry_run = false) => {
    if (!cidade.trim()) {
      toast({ title: "Informe a cidade", variant: "destructive" });
      return;
    }
    setLoading(true);
    setResultado(null);
    try {
      const { data, error } = await supabase.functions.invoke("captacao-coletar-candidatos", {
        body: {
          cidade: cidade.trim(),
          bairro: bairro.trim() || null,
          operacao,
          tipo_imovel: tipo || null,
          max_candidatos: max,
          dry_run,
        },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error ?? "Falha na coleta");
      setResultado(data);
      toast({
        title: dry_run ? "Prévia gerada" : `${data.total_criados} candidatos criados`,
        description: `${data.total_resultados} resultados de fontes públicas permitidas`,
      });
    } catch (e: any) {
      toast({ title: "Erro na coleta", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="w-5 h-5" />
          Coleta semiautomática de candidatos
          <Badge variant="outline" className="ml-2 gap-1"><ShieldCheck className="w-3 h-3" /> LGPD Art. 7º IV</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertDescription className="text-xs">
            Busca apenas em portais imobiliários da <b>allowlist pública</b>. Cada candidato entra em <b>revisão pendente</b>
            e o dossiê LGPD é preenchido automaticamente com URL de origem e trecho.
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <Label>Cidade *</Label>
            <Input value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Brasília" maxLength={100} />
          </div>
          <div>
            <Label>Bairro</Label>
            <Input value={bairro} onChange={(e) => setBairro(e.target.value)} placeholder="Asa Sul" maxLength={120} />
          </div>
          <div>
            <Label>Operação</Label>
            <Select value={operacao} onValueChange={(v: any) => setOperacao(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="venda">Venda</SelectItem>
                <SelectItem value="aluguel">Aluguel</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="apartamento">Apartamento</SelectItem>
                <SelectItem value="casa">Casa</SelectItem>
                <SelectItem value="cobertura">Cobertura</SelectItem>
                <SelectItem value="terreno">Terreno</SelectItem>
                <SelectItem value="sala comercial">Sala comercial</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-end gap-3">
          <div className="w-32">
            <Label>Máx. candidatos</Label>
            <Input type="number" min={1} max={30} value={max} onChange={(e) => setMax(Number(e.target.value) || 10)} />
          </div>
          <Button onClick={() => executar(true)} disabled={loading} variant="outline">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Prévia"}
          </Button>
          <Button onClick={() => executar(false)} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Search className="w-4 h-4 mr-2" />}
            Coletar e registrar
          </Button>
        </div>

        {resultado && (
          <div className="border rounded-lg divide-y">
            {resultado.criados.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">Nenhum candidato novo (dedup por URL).</p>
            )}
            {resultado.criados.map((c) => (
              <div key={c.id} className="p-3 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{c.nome}</p>
                  <a href={c.url} target="_blank" rel="noopener noreferrer"
                     className="text-xs text-blue-600 hover:underline truncate flex items-center gap-1">
                    <ExternalLink className="w-3 h-3" /> {c.url}
                  </a>
                </div>
                <Badge variant="secondary">{c.fontes} fontes registradas</Badge>
              </div>
            ))}
            {resultado.erros?.length > 0 && (
              <p className="p-3 text-xs text-destructive">{resultado.erros.length} erros durante gravação</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
