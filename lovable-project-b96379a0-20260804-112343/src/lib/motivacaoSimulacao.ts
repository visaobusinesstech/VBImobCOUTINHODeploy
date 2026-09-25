import type { MotivacaoConfig } from "@/hooks/useMotivacaoConfig";

export type NivelMotivacaoSim = "frio" | "morno" | "quente" | "fervendo";

export interface MotivacaoInputs {
  primeiro_visto_em?: string | null;
  ultimo_preco?: number | null;
  preco?: number | null;
  historico_precos?: any;
  republicacoes?: number | null;
  origem?: string | null;
}

export interface MotivacaoResultadoSim {
  score: number;
  nivel: NivelMotivacaoSim;
  sinais: {
    dias_no_mercado: number;
    queda_pct: number;
    republicacoes: number;
    fsbo: boolean;
    bonus: {
      tempo: number;
      queda: number;
      republicacao: number;
      fsbo: number;
    };
  };
}

/**
 * Espelho puro em TS do public.calcular_motivacao_proprietario (Postgres).
 * Use para prévia de regras sem chamar o banco. Mantenha em sincronia com
 * a função SQL — caso ela mude, atualize aqui também.
 */
export function simulateMotivacao(
  input: MotivacaoInputs,
  cfg: MotivacaoConfig,
): MotivacaoResultadoSim {
  const nowMs = Date.now();
  const primeiroMs = input.primeiro_visto_em
    ? new Date(input.primeiro_visto_em).getTime()
    : nowMs;
  const dias = Math.max(0, Math.floor((nowMs - primeiroMs) / 86_400_000));

  let bonusTempo = 0;
  if (dias >= cfg.dias_tier3) bonusTempo = cfg.bonus_tempo_tier3;
  else if (dias >= cfg.dias_tier2) bonusTempo = cfg.bonus_tempo_tier2;
  else if (dias >= cfg.dias_tier1) bonusTempo = cfg.bonus_tempo_tier1;

  const hist = Array.isArray(input.historico_precos) ? input.historico_precos : [];
  const ultimo = input.ultimo_preco ?? input.preco ?? null;
  let quedaPct = 0;
  let bonusQueda = 0;
  if (hist.length > 0 && ultimo != null) {
    const inicialRaw = hist[0]?.preco;
    const inicial = inicialRaw != null ? Number(inicialRaw) : 0;
    if (inicial > 0 && Number(ultimo) < inicial) {
      quedaPct = Math.round(((inicial - Number(ultimo)) / inicial) * 10000) / 100;
      if (quedaPct >= cfg.queda_tier2) bonusQueda = cfg.bonus_queda_tier2;
      else if (quedaPct >= cfg.queda_tier1) bonusQueda = cfg.bonus_queda_tier1;
    }
  }

  const reps = Math.min(Math.max(input.republicacoes ?? 0, 0), 2);
  const bonusRep = reps * cfg.bonus_republicacao;

  const origem = (input.origem ?? "").toLowerCase();
  const fsbo =
    origem.includes("proprietario") ||
    origem.includes("direto") ||
    origem.startsWith("ia_");
  const bonusFsbo = fsbo ? cfg.bonus_fsbo : 0;

  const score = Math.min(100, bonusTempo + bonusQueda + bonusRep + bonusFsbo);
  const nivel: NivelMotivacaoSim =
    score >= cfg.nivel_fervendo_min
      ? "fervendo"
      : score >= cfg.nivel_quente_min
      ? "quente"
      : score >= cfg.nivel_morno_min
      ? "morno"
      : "frio";

  return {
    score,
    nivel,
    sinais: {
      dias_no_mercado: dias,
      queda_pct: quedaPct,
      republicacoes: input.republicacoes ?? 0,
      fsbo,
      bonus: {
        tempo: bonusTempo,
        queda: bonusQueda,
        republicacao: bonusRep,
        fsbo: bonusFsbo,
      },
    },
  };
}

/**
 * Retorna, para cada sinal, quanto falta para atingir o próximo patamar
 * segundo a `cfg`. Útil para explicar "por que caiu em Frio/Morno".
 */
export function diagnosticarSinais(
  res: MotivacaoResultadoSim,
  cfg: MotivacaoConfig,
) {
  const { sinais } = res;
  const diag: {
    key: "tempo" | "queda" | "republicacao" | "fsbo";
    label: string;
    presente: boolean;
    valorAtual: string;
    proximoPatamar?: string;
    ganhoAdicional?: number;
    motivo?: string;
  }[] = [];

  // Tempo
  {
    const d = sinais.dias_no_mercado;
    const ganho = sinais.bonus.tempo;
    let proximo: string | undefined;
    let ganhoNext: number | undefined;
    if (d < cfg.dias_tier1) {
      proximo = `${cfg.dias_tier1} dias no mercado`;
      ganhoNext = cfg.bonus_tempo_tier1;
    } else if (d < cfg.dias_tier2) {
      proximo = `${cfg.dias_tier2} dias no mercado`;
      ganhoNext = cfg.bonus_tempo_tier2 - cfg.bonus_tempo_tier1;
    } else if (d < cfg.dias_tier3) {
      proximo = `${cfg.dias_tier3} dias no mercado`;
      ganhoNext = cfg.bonus_tempo_tier3 - cfg.bonus_tempo_tier2;
    }
    diag.push({
      key: "tempo",
      label: "Tempo no mercado",
      presente: ganho > 0,
      valorAtual: `${d} dias`,
      proximoPatamar: proximo,
      ganhoAdicional: ganhoNext,
      motivo:
        ganho === 0
          ? `Anúncio ainda muito recente (< ${cfg.dias_tier1} dias). Proprietários costumam relaxar o preço só após esse período.`
          : undefined,
    });
  }

  // Queda de preço
  {
    const q = sinais.queda_pct;
    const ganho = sinais.bonus.queda;
    let proximo: string | undefined;
    let ganhoNext: number | undefined;
    if (q < cfg.queda_tier1) {
      proximo = `queda de ${cfg.queda_tier1}%`;
      ganhoNext = cfg.bonus_queda_tier1;
    } else if (q < cfg.queda_tier2) {
      proximo = `queda de ${cfg.queda_tier2}%`;
      ganhoNext = cfg.bonus_queda_tier2 - cfg.bonus_queda_tier1;
    }
    diag.push({
      key: "queda",
      label: "Queda de preço",
      presente: ganho > 0,
      valorAtual: q > 0 ? `${q}%` : "sem queda registrada",
      proximoPatamar: proximo,
      ganhoAdicional: ganhoNext,
      motivo:
        ganho === 0
          ? "Sem histórico de queda: proprietário ainda ancorado no preço inicial."
          : undefined,
    });
  }

  // Republicações
  {
    const r = sinais.republicacoes;
    const ganho = sinais.bonus.republicacao;
    let proximo: string | undefined;
    let ganhoNext: number | undefined;
    if (r < 1) {
      proximo = "1 republicação";
      ganhoNext = cfg.bonus_republicacao;
    } else if (r < 2) {
      proximo = "2 republicações";
      ganhoNext = cfg.bonus_republicacao;
    }
    diag.push({
      key: "republicacao",
      label: "Republicações",
      presente: ganho > 0,
      valorAtual: `${r}x`,
      proximoPatamar: proximo,
      ganhoAdicional: ganhoNext,
      motivo:
        ganho === 0
          ? "Anúncio não foi republicado — sinal de ansiedade ainda não detectado."
          : undefined,
    });
  }

  // FSBO
  {
    diag.push({
      key: "fsbo",
      label: "Direto do proprietário (FSBO)",
      presente: sinais.fsbo,
      valorAtual: sinais.fsbo ? "sim" : "não",
      motivo: !sinais.fsbo
        ? "Anúncio está com imobiliária/portal — proprietário ainda tem intermediário, menor urgência direta."
        : undefined,
    });
  }

  // Quanto falta em pontos para o próximo nível
  const proxNivel =
    res.nivel === "frio"
      ? { nome: "morno", min: cfg.nivel_morno_min }
      : res.nivel === "morno"
      ? { nome: "quente", min: cfg.nivel_quente_min }
      : res.nivel === "quente"
      ? { nome: "fervendo", min: cfg.nivel_fervendo_min }
      : null;
  const pontosFaltantes = proxNivel
    ? Math.max(0, proxNivel.min - res.score)
    : 0;

  return { diag, proxNivel, pontosFaltantes };
}
