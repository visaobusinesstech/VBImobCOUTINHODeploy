import { useState } from "react";
import { Brain, Building2, MapPin, Loader2, Sparkles, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import type { Lead } from "@/hooks/useLeads";

interface MatchImovel {
  id: string;
  titulo: string;
  tipo: string;
  operacao: string;
  preco: number;
  area: number;
  quartos: number;
  bairro: string;
  cidade: string;
  foto: string | null;
}

interface Match {
  imovel_id: string;
  score: number;
  motivo: string;
  imovel: MatchImovel;
}

interface Props {
  lead: Lead;
}

const formatValor = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

const getScoreColor = (score: number) => {
  if (score >= 80) return "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30";
  if (score >= 60) return "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30";
  return "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30";
};

const getScoreLabel = (score: number) => {
  if (score >= 80) return "Excelente";
  if (score >= 60) return "Bom";
  return "Parcial";
};

export function LeadMatchingPanel({ lead }: Props) {
  const { imobiliariaId } = useAuth();
  const { toast } = useToast();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const buscarMatches = async () => {
    setLoading(true);
    setHasSearched(true);

    try {
      let targetImobiliariaId = imobiliariaId;
      if (!targetImobiliariaId) {
        const { data: authData } = await supabase.rpc("get_master_user_id");
        targetImobiliariaId = authData ?? null;
      }

      if (!targetImobiliariaId) {
        toast({ title: "Erro no matching", description: "Não foi possível identificar a imobiliária.", variant: "destructive" });
        return;
      }

      const { data, error } = await supabase.functions.invoke("matching-lead-imovel", {
        body: {
          lead_id: lead.id,
          imobiliaria_id: targetImobiliariaId,
          bairro: lead.bairro_interesse,
          tipo_imovel: lead.tipo_imovel_interesse,
          valor: lead.valor,
          tipo_operacao: lead.tipo_operacao,
        },
      });

      if (error) throw error;

      if (data?.error) {
        toast({ title: "Erro no matching", description: data.error, variant: "destructive" });
        return;
      }

      setMatches(data?.matches || []);

      if (data?.matches?.length === 0) {
        toast({ title: "Nenhum imóvel compatível encontrado", description: "Tente ajustar os critérios do lead." });
      }
    } catch (err: any) {
      console.error("Matching error:", err);
      toast({ title: "Erro ao buscar matches", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border-2 border-primary/20 bg-primary/5 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Brain className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Matching Inteligente</p>
            <p className="text-[10px] text-muted-foreground">IA sugere imóveis compatíveis</p>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={buscarMatches}
          disabled={loading}
          className="gap-1.5"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          {loading ? "Analisando..." : "Buscar Matches"}
        </Button>
      </div>

      {/* Critérios do lead */}
      <div className="flex flex-wrap gap-1.5">
        {lead.bairro_interesse && (
          <Badge variant="secondary" className="text-[10px] gap-1">
            <MapPin className="h-3 w-3" /> {lead.bairro_interesse}
          </Badge>
        )}
        {lead.tipo_imovel_interesse && (
          <Badge variant="secondary" className="text-[10px] gap-1">
            <Building2 className="h-3 w-3" /> {lead.tipo_imovel_interesse}
          </Badge>
        )}
        {lead.valor > 0 && (
          <Badge variant="secondary" className="text-[10px]">
            Até {formatValor(lead.valor)}
          </Badge>
        )}
        {lead.tipo_operacao && (
          <Badge variant="secondary" className="text-[10px]">
            {lead.tipo_operacao === "venda" ? "Compra" : "Aluguel"}
          </Badge>
        )}
      </div>

      {/* Results */}
      {hasSearched && !loading && matches.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-3">
          Nenhum imóvel compatível encontrado. Ajuste os critérios do lead ou cadastre mais imóveis.
        </p>
      )}

      {matches.length > 0 && (
        <div className="space-y-2">
          {matches.map((match, idx) => (
            <div
              key={match.imovel_id}
              className="flex items-start gap-3 rounded-lg border border-border bg-background/80 p-3 transition-colors hover:bg-accent/30"
            >
              {/* Rank */}
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {idx + 1}º
              </div>

              {/* Photo */}
              {match.imovel.foto && (
                <img
                  src={match.imovel.foto}
                  alt={match.imovel.titulo}
                  className="h-14 w-14 shrink-0 rounded-lg object-cover"
                />
              )}

              {/* Info */}
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-foreground truncate">
                    {match.imovel.titulo}
                  </p>
                  <Badge
                    variant="outline"
                    className={`shrink-0 text-[10px] font-bold ${getScoreColor(match.score)}`}
                  >
                    {match.score}% — {getScoreLabel(match.score)}
                  </Badge>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                  <span>{match.imovel.tipo}</span>
                  <span>•</span>
                  <span>{formatValor(match.imovel.preco)}</span>
                  {match.imovel.area > 0 && (
                    <>
                      <span>•</span>
                      <span>{match.imovel.area}m²</span>
                    </>
                  )}
                  {match.imovel.quartos > 0 && (
                    <>
                      <span>•</span>
                      <span>{match.imovel.quartos} qts</span>
                    </>
                  )}
                  {match.imovel.bairro && (
                    <>
                      <span>•</span>
                      <span>{match.imovel.bairro}</span>
                    </>
                  )}
                </div>

                <p className="text-[11px] italic text-muted-foreground">
                  💡 {match.motivo}
                </p>
              </div>

              {/* View link */}
              <a
                href={`/imoveis?id=${match.imovel.id}`}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 p-1 text-muted-foreground hover:text-primary"
                title="Ver imóvel"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}