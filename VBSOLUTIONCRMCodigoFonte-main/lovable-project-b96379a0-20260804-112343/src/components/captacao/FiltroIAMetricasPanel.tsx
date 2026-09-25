import { Clock, Filter, XCircle, CheckCircle2, TrendingDown } from "lucide-react";

interface Props {
  data: {
    duracao_ms?: number;
    tempos?: Record<string, number>;
    filtros_efetivos?: Array<{ etapa: string; label: string; count: number; excluidos: number }>;
    motivos_exclusao?: Record<string, number>;
    contagens?: {
      total_bruto: number;
      total_pos_filtros: number;
      candidatos_analisados: number;
      retornados_pela_ia: number;
    };
    run_id?: string;
  };
}

const MOTIVO_LABEL: Record<string, string> = {
  abaixo_do_score_min: "Abaixo do score dor mínimo",
  filtro_operacao: "Filtro de operação",
  filtro_cidade: "Filtro de cidade",
  filtro_bairro: "Filtro de bairro",
  filtro_tipo_imovel: "Filtro de tipo de imóvel",
  alem_do_limite: "Cortados pelo limite (ordenados por score)",
  sem_resposta_ia: "IA não retornou análise",
};

const TEMPO_LABEL: Record<string, string> = {
  auth_ms: "Autenticação",
  ai_gate_ms: "Verificação da chave IA",
  filtros_efetivos_ms: "Contagem por filtro",
  db_candidatos_ms: "Carga dos candidatos",
  prep_prompt_ms: "Preparação do prompt",
  ai_call_ms: "Chamada à IA",
  pos_processamento_ms: "Pós-processamento",
};

function fmtMs(ms?: number) {
  if (!ms && ms !== 0) return "—";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

export function FiltroIAMetricasPanel({ data }: Props) {
  const etapas = data.filtros_efetivos ?? [];
  const motivos = Object.entries(data.motivos_exclusao ?? {})
    .filter(([, n]) => (n ?? 0) > 0)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));
  const tempos = Object.entries(data.tempos ?? {}).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));
  const totalTempoMedido = tempos.reduce((sum, [, v]) => sum + (v ?? 0), 0);
  const overhead = Math.max(0, (data.duracao_ms ?? 0) - totalTempoMedido);
  const c = data.contagens;

  return (
    <div className="rounded-lg border bg-muted/20 p-4 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-sm font-semibold flex items-center gap-1.5">
          📊 Métricas da execução
        </div>
        <div className="text-[11px] text-muted-foreground">
          run {String(data.run_id ?? "").slice(0, 8)} · total <strong>{fmtMs(data.duracao_ms)}</strong>
        </div>
      </div>

      {/* Contagens síntese */}
      {c && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="rounded-md bg-slate-100 px-3 py-2">
            <div className="text-[10px] uppercase text-slate-600">Total na carteira</div>
            <div className="text-lg font-bold">{c.total_bruto}</div>
          </div>
          <div className="rounded-md bg-blue-50 px-3 py-2">
            <div className="text-[10px] uppercase text-blue-700">Após filtros</div>
            <div className="text-lg font-bold text-blue-900">{c.total_pos_filtros}</div>
          </div>
          <div className="rounded-md bg-indigo-50 px-3 py-2">
            <div className="text-[10px] uppercase text-indigo-700">Analisados pela IA</div>
            <div className="text-lg font-bold text-indigo-900">{c.candidatos_analisados}</div>
          </div>
          <div className="rounded-md bg-emerald-50 px-3 py-2">
            <div className="text-[10px] uppercase text-emerald-700">Retornados</div>
            <div className="text-lg font-bold text-emerald-900">{c.retornados_pela_ia}</div>
          </div>
        </div>
      )}

      {/* Filtros efetivos */}
      {etapas.length > 0 && (
        <div>
          <div className="text-xs font-semibold flex items-center gap-1.5 mb-2">
            <Filter className="w-3.5 h-3.5" /> Filtros efetivos (redução por etapa)
          </div>
          <div className="space-y-1.5">
            {etapas.map((e, i) => {
              const base = etapas[0]?.count || 1;
              const pct = Math.round((e.count / base) * 100);
              return (
                <div key={e.etapa + i} className="flex items-center gap-2 text-xs">
                  <div className="w-40 shrink-0 truncate text-muted-foreground">{e.label}</div>
                  <div className="flex-1 h-2 rounded bg-slate-200 overflow-hidden">
                    <div className="h-full bg-blue-500" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="w-16 text-right font-mono">{e.count}</div>
                  {e.excluidos > 0 && (
                    <div className="w-24 text-right text-rose-600 flex items-center justify-end gap-1">
                      <TrendingDown className="w-3 h-3" /> −{e.excluidos}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Motivos de exclusão */}
      {motivos.length > 0 && (
        <div>
          <div className="text-xs font-semibold flex items-center gap-1.5 mb-2">
            <XCircle className="w-3.5 h-3.5 text-rose-600" /> Motivos de exclusão
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {motivos.map(([k, n]) => (
              <div key={k} className="flex items-center justify-between rounded-md bg-rose-50 border border-rose-100 px-2.5 py-1.5 text-xs">
                <span className="text-rose-900 truncate">{MOTIVO_LABEL[k] ?? k}</span>
                <span className="font-bold text-rose-700 ml-2">{n}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {motivos.length === 0 && (
        <div className="flex items-center gap-1.5 text-xs text-emerald-700">
          <CheckCircle2 className="w-3.5 h-3.5" /> Nenhum proprietário foi excluído pelos filtros ou pela IA.
        </div>
      )}

      {/* Tempos */}
      {tempos.length > 0 && (
        <div>
          <div className="text-xs font-semibold flex items-center gap-1.5 mb-2">
            <Clock className="w-3.5 h-3.5" /> Tempo por etapa
          </div>
          <div className="space-y-1">
            {tempos.map(([k, v]) => {
              const pct = data.duracao_ms ? Math.round((v / data.duracao_ms) * 100) : 0;
              return (
                <div key={k} className="flex items-center gap-2 text-xs">
                  <div className="w-40 shrink-0 truncate text-muted-foreground">{TEMPO_LABEL[k] ?? k}</div>
                  <div className="flex-1 h-1.5 rounded bg-slate-200 overflow-hidden">
                    <div className="h-full bg-indigo-500" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="w-20 text-right font-mono">{fmtMs(v)}</div>
                  <div className="w-10 text-right text-muted-foreground">{pct}%</div>
                </div>
              );
            })}
            {overhead > 50 && (
              <div className="flex items-center gap-2 text-xs opacity-70">
                <div className="w-40 shrink-0 truncate text-muted-foreground">Rede / outros</div>
                <div className="flex-1" />
                <div className="w-20 text-right font-mono">{fmtMs(overhead)}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
