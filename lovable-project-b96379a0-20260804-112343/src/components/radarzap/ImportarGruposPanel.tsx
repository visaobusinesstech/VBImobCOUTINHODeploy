import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

type Linha = { invite_url: string; categoria?: string; cidade?: string; uf?: string; bairro?: string };

function parseLinhas(txt: string): Linha[] {
  return txt
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      // Formato: url ; categoria ; cidade ; uf ; bairro
      const [url, categoria, cidade, uf, bairro] = l.split(/[;,\t]/).map((s) => s?.trim());
      return { invite_url: url, categoria, cidade, uf, bairro };
    })
    .filter((r) => /chat\.whatsapp\.com\//.test(r.invite_url));
}

export default function ImportarGruposPanel() {
  const [texto, setTexto] = useState("");
  const [ufPadrao, setUfPadrao] = useState("DF");
  const [categoriaPadrao, setCategoriaPadrao] = useState("");
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [resultados, setResultados] = useState<any[] | null>(null);
  const [enviando, setEnviando] = useState(false);

  const validar = () => {
    const l = parseLinhas(texto).map((x) => ({
      ...x,
      uf: x.uf || ufPadrao,
      categoria: x.categoria || categoriaPadrao || undefined,
    }));
    setLinhas(l);
    setResultados(null);
    if (l.length === 0) toast.error("Nenhum link válido encontrado");
    else toast.success(`${l.length} links prontos para importar`);
  };

  const importar = async () => {
    if (linhas.length === 0) return;
    setEnviando(true);
    const { data, error } = await supabase.functions.invoke("radarzap-evolution-join-grupo", {
      body: { grupos: linhas },
    });
    setEnviando(false);
    if (error) { toast.error("Erro ao importar"); return; }
    setResultados(data?.results ?? []);
    const ok = (data?.results ?? []).filter((r: any) => r.ok).length;
    toast.success(`${ok}/${linhas.length} grupos conectados`);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Importar grupos em lote</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Cole um link de convite <code>https://chat.whatsapp.com/…</code> por linha.
            Opcional: separe por <code>;</code> para incluir categoria, cidade, UF e bairro.
          </div>
          <Textarea
            rows={10}
            placeholder={`https://chat.whatsapp.com/ABC123XYZ ; Imóveis DF ; Brasília ; DF ; Asa Sul\nhttps://chat.whatsapp.com/OUTRO456`}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            className="font-mono text-xs"
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">UF padrão</label>
              <Input value={ufPadrao} onChange={(e) => setUfPadrao(e.target.value.toUpperCase().slice(0, 2))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Categoria padrão</label>
              <Input value={categoriaPadrao} onChange={(e) => setCategoriaPadrao(e.target.value)} placeholder="Ex.: Imóveis, Aluguel" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={validar}>Validar</Button>
            <Button onClick={importar} disabled={linhas.length === 0 || enviando}>
              {enviando && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Conectar {linhas.length > 0 ? `(${linhas.length})` : ""}
            </Button>
          </div>
        </CardContent>
      </Card>

      {linhas.length > 0 && !resultados && (
        <Card>
          <CardHeader><CardTitle>Preview ({linhas.length} grupos)</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Link</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Cidade / UF</TableHead>
                <TableHead>Bairro</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {linhas.slice(0, 50).map((l, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-xs truncate max-w-[280px]">{l.invite_url}</TableCell>
                    <TableCell>{l.categoria ?? "—"}</TableCell>
                    <TableCell>{[l.cidade, l.uf].filter(Boolean).join(" / ") || "—"}</TableCell>
                    <TableCell>{l.bairro ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {resultados && (
        <Card>
          <CardHeader><CardTitle>Resultado</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Grupo</TableHead>
                <TableHead>Erro</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {resultados.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      {r.ok ? (
                        <Badge variant="default"><CheckCircle2 className="h-3 w-3 mr-1" />OK</Badge>
                      ) : (
                        <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Falhou</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{r.nome ?? "—"}</div>
                      <div className="text-xs text-muted-foreground truncate max-w-[280px]">{r.invite_url}</div>
                    </TableCell>
                    <TableCell className="text-xs text-red-600">{r.error ?? r.db_error ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
