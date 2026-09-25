import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Search, ExternalLink, Flame, Loader2 } from "lucide-react";
import { normalizeExternalUrl } from "@/lib/externalUrl";

interface Row {
  id: string;
  nome_proprietario: string | null;
  telefone: string | null;
  cidade: string | null;
  bairro: string | null;
  titulo_imovel: string | null;
  operacao: string | null;
  tipo_imovel: string | null;
  preco: number | null;
  ultimo_preco: number | null;
  url_anuncio: string | null;
  motivacao_score: number | null;
  motivacao_sinais: any;
  created_at: string;
}

export default function BuscaAvancadaCaptacao() {
  const { imobiliariaId } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [f, setF] = useState({
    q: "", cidade: "", bairro: "", operacao: "todas", tipo: "todos",
    scoreMin: 0, precoMin: "", precoMax: "", diasMax: "",
  });

  useEffect(() => { document.title = "Busca Avançada · Captação"; }, []);

  const buscar = async () => {
    if (!imobiliariaId) return;
    setLoading(true);
    let q: any = supabase.from("lista_proprietarios_captacao")
      .select("id,nome_proprietario,telefone,cidade,bairro,titulo_imovel,operacao,tipo_imovel,preco,ultimo_preco,url_anuncio,motivacao_score,motivacao_sinais,created_at")
      .eq("imobiliaria_id", imobiliariaId)
      .order("motivacao_score", { ascending: false, nullsFirst: false })
      .limit(500);

    if (f.q) q = q.or(`titulo_imovel.ilike.%${f.q}%,nome_proprietario.ilike.%${f.q}%`);
    if (f.cidade) q = q.ilike("cidade", `%${f.cidade}%`);
    if (f.bairro) q = q.ilike("bairro", `%${f.bairro}%`);
    if (f.operacao !== "todas") q = q.eq("operacao", f.operacao);
    if (f.tipo !== "todos") q = q.eq("tipo_imovel", f.tipo);
    if (f.scoreMin > 0) q = q.gte("motivacao_score", f.scoreMin);
    if (f.precoMin) q = q.gte("preco", Number(f.precoMin));
    if (f.precoMax) q = q.lte("preco", Number(f.precoMax));
    if (f.diasMax) q = q.gte("created_at", new Date(Date.now() - Number(f.diasMax) * 86400_000).toISOString());


    const { data } = await q;
    setRows((data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => { buscar(); }, [imobiliariaId]);

  const total = rows.length;
  const quentes = useMemo(() => rows.filter(r => (r.motivacao_score ?? 0) >= 70).length, [rows]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Search className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-semibold">Busca Avançada Unificada</h1>
        <Badge variant="secondary">{total} resultados</Badge>
        {quentes > 0 && <Badge className="bg-orange-500"><Flame className="h-3 w-3 mr-1" />{quentes} quentes</Badge>}
      </div>

      <Card>
        <CardHeader><CardTitle>Filtros</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-4 gap-3">
          <div className="md:col-span-2">
            <Label>Busca livre (título / proprietário)</Label>
            <Input value={f.q} onChange={e => setF({ ...f, q: e.target.value })} />
          </div>
          <div><Label>Cidade</Label><Input value={f.cidade} onChange={e => setF({ ...f, cidade: e.target.value })} /></div>
          <div><Label>Bairro</Label><Input value={f.bairro} onChange={e => setF({ ...f, bairro: e.target.value })} /></div>
          <div>
            <Label>Operação</Label>
            <Select value={f.operacao} onValueChange={v => setF({ ...f, operacao: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="Venda">Venda</SelectItem>
                <SelectItem value="Aluguel">Aluguel</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tipo</Label>
            <Select value={f.tipo} onValueChange={v => setF({ ...f, tipo: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {["Apartamento","Casa","Cobertura","Kitnet","Sala","Lote"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Preço mín (R$)</Label><Input inputMode="numeric" value={f.precoMin} onChange={e => setF({ ...f, precoMin: e.target.value.replace(/\D/g, "") })} /></div>
          <div><Label>Preço máx (R$)</Label><Input inputMode="numeric" value={f.precoMax} onChange={e => setF({ ...f, precoMax: e.target.value.replace(/\D/g, "") })} /></div>
          <div><Label>Últimos N dias</Label><Input inputMode="numeric" value={f.diasMax} onChange={e => setF({ ...f, diasMax: e.target.value.replace(/\D/g, "") })} placeholder="ex.: 30" /></div>
          <div className="md:col-span-2">
            <Label>Score mínimo de motivação: <strong>{f.scoreMin}</strong></Label>
            <Slider min={0} max={100} step={5} value={[f.scoreMin]} onValueChange={v => setF({ ...f, scoreMin: v[0] })} className="mt-2" />
          </div>
          <div className="md:col-span-4 flex justify-end">
            <Button onClick={buscar} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Aplicar filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Resultados</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {rows.length === 0 && !loading && <div className="text-sm text-muted-foreground py-8 text-center">Nenhum registro encontrado.</div>}
          {rows.map(r => {
            const url = normalizeExternalUrl(r.url_anuncio ?? "");
            const score = r.motivacao_score ?? 0;
            return (
              <div key={r.id} className="border rounded-md p-3 flex items-start justify-between gap-3 hover:bg-slate-50">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="font-medium truncate">{r.titulo_imovel ?? r.nome_proprietario ?? "Anúncio"}</div>
                    {score >= 70 && <Badge className="bg-orange-500"><Flame className="h-3 w-3 mr-1" />{score}</Badge>}
                    {score > 0 && score < 70 && <Badge variant="secondary">{score}</Badge>}
                    {r.operacao && <Badge variant="outline">{r.operacao}</Badge>}
                    {r.tipo_imovel && <Badge variant="outline">{r.tipo_imovel}</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {[r.cidade, r.bairro].filter(Boolean).join(" · ")}
                    {r.preco ? ` · R$ ${Number(r.preco).toLocaleString("pt-BR")}` : ""}
                    {r.telefone ? ` · ${r.telefone}` : ""}
                  </div>
                </div>
                {url && (
                  <Button asChild size="sm" variant="outline">
                    <a href={url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3 w-3 mr-1" />Anúncio</a>
                  </Button>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
