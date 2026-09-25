import { useMemo, useState } from "react";
import {
  Building2,
  ChevronDown,
  ChevronRight,
  MapPin,
  MessageCircle,
  Search,
  SlidersHorizontal,
  Sparkles,
  Target,
  TrendingUp,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Lead } from "@/hooks/useLeads";
import { useImoveis } from "@/hooks/useImoveis";
import { cruzarDemandaCarteira, agregarDemanda } from "@/lib/matchingDemandaCarteira";
import { PerfilBuscaLeadDialog } from "./PerfilBuscaLeadDialog";

interface Props {
  leads: Lead[];
  onOpenLead?: (lead: Lead) => void;
  onLeadUpdated?: () => void;
}

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v || 0);

const scoreClass = (score: number) => {
  if (score >= 85) return "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30";
  if (score >= 70) return "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30";
  return "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30";
};

const urgenciaClass = (u?: string | null) => {
  const n = (u || "").toLowerCase();
  if (n.startsWith("alta")) return "border-destructive/40 text-destructive";
  if (n.startsWith("m")) return "border-yellow-500/40 text-yellow-700 dark:text-yellow-400";
  return "text-muted-foreground";
};

export function CruzamentoDemandaPanel({ leads, onOpenLead, onLeadUpdated }: Props) {
  const { imoveis, loading } = useImoveis();
  const [busca, setBusca] = useState("");
  const [scoreMinimo, setScoreMinimo] = useState(60);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [perfilLead, setPerfilLead] = useState<Lead | null>(null);

  const cruzamento = useMemo(
    () => cruzarDemandaCarteira(leads, imoveis, { scoreMinimo }),
    [leads, imoveis, scoreMinimo],
  );

  const demanda = useMemo(() => agregarDemanda(leads, imoveis), [leads, imoveis]);


  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return cruzamento;
    return cruzamento.filter(
      (c) =>
        c.lead.nome.toLowerCase().includes(q) ||
        (c.lead.bairro_interesse || "").toLowerCase().includes(q) ||
        (c.lead.tipo_imovel_interesse || "").toLowerCase().includes(q),
    );
  }, [cruzamento, busca]);

  const comMatch = cruzamento.filter((c) => c.matches.length > 0);
  const semMatch = cruzamento.filter((c) => c.matches.length === 0);

  const enviarSugestoes = (item: (typeof cruzamento)[number]) => {
    const tel = (item.lead.telefone || "").replace(/\D/g, "");
    if (!tel) return;
    const full = tel.startsWith("55") ? tel : `55${tel}`;
    const linhas = item.matches
      .map(
        (m, i) =>
          `${i + 1}. ${m.imovel.titulo} — ${m.imovel.bairro || ""} · ${m.imovel.quartos || 0} quartos · ${m.imovel.area || 0}m² · ${fmtBRL(m.imovel.preco)}`,
      )
      .join("\n");
    const msg = `Olá ${item.lead.nome}! Separei imóveis da nossa carteira que combinam com o que você procura:\n\n${linhas}\n\nQuer agendar uma visita?`;
    window.open(`https://wa.me/${full}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  return (
    <div className="mb-4 rounded-xl border border-border bg-muted/30 p-4 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            Cruzamento Demanda × Carteira
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {comMatch.length} leads com imóvel compatível · {semMatch.length} sem opção na carteira ·{" "}
            {imoveis.length} imóveis analisados
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar lead, bairro ou tipo..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9 h-9 w-[240px]"
            />
          </div>
          <select
            value={scoreMinimo}
            onChange={(e) => setScoreMinimo(Number(e.target.value))}
            className="h-9 px-2 rounded-md bg-background border border-border text-sm text-foreground"
            title="Compatibilidade mínima"
          >
            <option value={50}>Compatibilidade ≥ 50%</option>
            <option value={60}>Compatibilidade ≥ 60%</option>
            <option value={75}>Compatibilidade ≥ 75%</option>
            <option value={90}>Compatibilidade ≥ 90%</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          {/* Leads com sugestões */}
          <div className="space-y-2">
            {filtrados.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">Nenhum lead encontrado.</p>
            ) : (
              filtrados.map((item) => {
                const aberto = expandido === item.lead.id;
                return (
                  <div key={item.lead.id} className="rounded-lg border border-border bg-card">
                    <button
                      onClick={() => setExpandido(aberto ? null : item.lead.id)}
                      className="w-full flex items-center justify-between gap-2 p-3 text-left"
                    >
                      <div className="min-w-0 flex items-center gap-2">
                        {aberto ? (
                          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{item.lead.nome}</p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {[
                              item.lead.tipo_imovel_interesse || "tipo livre",
                              [item.lead.bairro_interesse, ...(item.lead.bairros_interesse || [])]
                                .filter(Boolean)
                                .join(" / ") || "bairro livre",
                              item.lead.valor_maximo || item.lead.valor
                                ? `até ${fmtBRL(Number(item.lead.valor_maximo || item.lead.valor))}`
                                : "sem orçamento",
                              item.lead.area_minima ? `${item.lead.area_minima}m²+` : null,
                              item.lead.quartos_minimo ? `${item.lead.quartos_minimo}q+` : null,
                              item.lead.finalidade || null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {item.lead.urgencia && (
                          <Badge variant="outline" className={`text-[10px] ${urgenciaClass(item.lead.urgencia)}`}>
                            Urgência {item.lead.urgencia}
                          </Badge>
                        )}
                        {item.matches.length > 0 ? (
                          <Badge variant="outline" className={`text-[10px] ${scoreClass(item.melhorScore)}`}>
                            {item.matches.length} imóvel(is) · {item.melhorScore}%
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">
                            Sem imóvel na carteira
                          </Badge>
                        )}
                      </div>

                    </button>

                    {aberto && (
                      <div className="border-t border-border/60 p-3 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => setPerfilLead(item.lead)}
                          >
                            <SlidersHorizontal className="w-3.5 h-3.5 mr-1" /> Perfil de busca
                          </Button>
                          {(item.lead.amenidades_desejadas || []).map((a) => (
                            <Badge key={a} variant="outline" className="text-[10px]">
                              {a}
                            </Badge>
                          ))}
                        </div>
                        {item.matches.length === 0 ? (
                          <p className="text-xs text-muted-foreground">
                            Nenhum imóvel da carteira atende esse perfil — oportunidade de captação.
                          </p>
                        ) : (
                          <>
                            {item.matches.map((m) => (
                              <div
                                key={m.imovel.id}
                                className="rounded-md border border-border/60 bg-background p-2.5"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="text-xs font-medium text-foreground truncate">{m.imovel.titulo}</p>
                                    <p className="text-[11px] text-muted-foreground flex items-center gap-1 truncate">
                                      <MapPin className="w-3 h-3" />
                                      {[m.imovel.bairro, m.imovel.cidade].filter(Boolean).join(" · ") || "—"} ·{" "}
                                      {m.imovel.quartos || 0}q · {m.imovel.suites || 0}st · {m.imovel.vagas || 0}vg ·{" "}
                                      {m.imovel.area || 0}m²
                                    </p>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <p className="text-xs font-semibold text-foreground">{fmtBRL(m.imovel.preco)}</p>
                                    <Badge variant="outline" className={`text-[10px] mt-0.5 ${scoreClass(m.score)}`}>
                                      {m.score}% compatível
                                    </Badge>
                                  </div>
                                </div>
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {m.criterios.map((c) => {
                                    const parcial = !c.ok && c.pontos > 0;
                                    return (
                                      <span
                                        key={c.label}
                                        title={c.detalhe}
                                        className={`text-[10px] px-1.5 py-0.5 rounded border ${
                                          c.ok
                                            ? "border-green-500/30 text-green-700 dark:text-green-400 bg-green-500/10"
                                            : parcial
                                              ? "border-yellow-500/30 text-yellow-700 dark:text-yellow-400 bg-yellow-500/10"
                                              : "border-border text-muted-foreground"
                                        }`}
                                      >
                                        {c.ok ? "✓" : parcial ? "~" : "✕"} {c.label}
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                            <div className="flex items-center gap-2 pt-1">
                              {item.lead.telefone && (
                                <Button
                                  size="sm"
                                  className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white"
                                  onClick={() => enviarSugestoes(item)}
                                >
                                  <MessageCircle className="w-3.5 h-3.5 mr-1" /> Enviar sugestões no WhatsApp
                                </Button>
                              )}
                              {onOpenLead && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs"
                                  onClick={() => onOpenLead(item.lead)}
                                >
                                  Abrir lead
                                </Button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    )}

                  </div>
                );
              })
            )}
          </div>

          {/* Radar de demanda x oferta */}
          <div className="rounded-lg border border-border bg-card p-3">
            <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-2">
              <TrendingUp className="w-3.5 h-3.5 text-primary" />
              Demanda × Oferta por perfil
            </h4>
            {demanda.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sem dados de demanda ainda.</p>
            ) : (
              <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
                {demanda.map((d) => {
                  const gap = d.leads - d.imoveisNaCarteira;
                  return (
                    <div key={d.chave} className="rounded-md border border-border/60 p-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium text-foreground truncate">
                          {d.tipo} · {d.bairro}
                        </p>
                        {gap > 0 ? (
                          <Badge variant="outline" className="text-[10px] border-destructive/40 text-destructive">
                            Faltam {gap}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] border-green-500/30 text-green-700 dark:text-green-400">
                            Coberto
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          {d.leads} procurando
                        </span>
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          {d.imoveisNaCarteira} na carteira
                        </span>
                        {d.ticketMedio > 0 && <span>ticket {fmtBRL(d.ticketMedio)}</span>}
                        {d.urgentes > 0 && <span className="text-destructive">{d.urgentes} urgente(s)</span>}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      <PerfilBuscaLeadDialog
        lead={perfilLead}
        open={!!perfilLead}
        onOpenChange={(o) => !o && setPerfilLead(null)}
        onSaved={() => onLeadUpdated?.()}
      />
    </div>
  );

}

export default CruzamentoDemandaPanel;
