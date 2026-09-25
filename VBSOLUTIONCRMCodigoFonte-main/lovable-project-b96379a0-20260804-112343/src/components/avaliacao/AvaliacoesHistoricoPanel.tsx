import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface Props {
  bairro?: string | null;
  cidade?: string | null;
  tipo?: string | null;
  imovelId?: string | null;
}

interface Avaliacao {
  id: string;
  titulo: string | null;
  bairro: string | null;
  cidade: string | null;
  tipo: string | null;
  area: number | null;
  valor_ideal: number | null;
  preco_m2_estimado: number | null;
  score_liquidez: number | null;
  created_at: string;
}

const formatBRL = (v: number | null) =>
  v == null
    ? "—"
    : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function AvaliacoesHistoricoPanel({ bairro, cidade, tipo, imovelId }: Props) {
  const { imobiliariaId } = useAuth();
  const [items, setItems] = useState<Avaliacao[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!imobiliariaId) return;
    if (!imovelId && !bairro && !cidade) {
      setItems([]);
      return;
    }
    setLoading(true);
    (async () => {
      let q = supabase
        .from("avaliacoes_historico")
        .select("id, titulo, bairro, cidade, tipo, area, valor_ideal, preco_m2_estimado, score_liquidez, created_at")
        .eq("imobiliaria_id", imobiliariaId)
        .order("created_at", { ascending: false })
        .limit(6);

      if (imovelId) q = q.eq("imovel_id", imovelId);
      else {
        if (bairro) q = q.ilike("bairro", bairro);
        if (cidade) q = q.ilike("cidade", cidade);
        if (tipo) q = q.eq("tipo", tipo);
      }

      const { data } = await q;
      setItems((data || []) as Avaliacao[]);
      setLoading(false);
    })();
  }, [imobiliariaId, bairro, cidade, tipo, imovelId]);

  if (!items.length && !loading) return null;

  const variacao = (curr: number | null, prev: number | null) => {
    if (!curr || !prev) return null;
    return ((curr - prev) / prev) * 100;
  };

  return (
    <Card className="bg-card border-border">
      <CardContent className="pt-5">
        <div className="flex items-center gap-2 mb-3">
          <History className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm">Avaliações anteriores</h3>
          <Badge variant="outline" className="ml-auto text-[10px]">{items.length}</Badge>
        </div>

        {loading ? (
          <p className="text-xs text-muted-foreground">Carregando...</p>
        ) : (
          <div className="space-y-2">
            {items.map((it, i) => {
              const prev = items[i + 1];
              const v = variacao(it.valor_ideal, prev?.valor_ideal ?? null);
              const Icon = v == null ? Minus : v > 0 ? TrendingUp : v < 0 ? TrendingDown : Minus;
              const color = v == null ? "text-muted-foreground" : v > 0 ? "text-emerald-600" : v < 0 ? "text-destructive" : "text-muted-foreground";
              return (
                <div
                  key={it.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs p-2 rounded-md bg-secondary/40 border border-border/50"
                >
                  <span className="text-muted-foreground min-w-[80px]">
                    {new Date(it.created_at).toLocaleDateString("pt-BR")}
                  </span>
                  <span className="font-medium">{formatBRL(it.valor_ideal)}</span>
                  <span className="text-muted-foreground">
                    {it.preco_m2_estimado ? `${formatBRL(it.preco_m2_estimado)}/m²` : "—"}
                  </span>
                  {it.score_liquidez != null && (
                    <Badge variant="secondary" className="text-[10px]">
                      Liquidez {it.score_liquidez}
                    </Badge>
                  )}
                  <span className="text-muted-foreground truncate flex-1">
                    {it.bairro || it.titulo || "—"}
                  </span>
                  {v != null && (
                    <span className={`flex items-center gap-1 font-medium ${color}`}>
                      <Icon className="w-3 h-3" />
                      {v > 0 ? "+" : ""}{v.toFixed(1)}%
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
