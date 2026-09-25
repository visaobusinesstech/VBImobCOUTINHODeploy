export type VarianteAB = "A" | "B";

export interface EtapaAB {
  id: string;
  fluxo_id: string;
  ordem: number;
  titulo: string;
  mensagem: string;
  canal: string;
  ab_ativo?: boolean | null;
  ab_titulo_b?: string | null;
  ab_mensagem_b?: string | null;
  ab_split?: number | null;
  ab_auto_escolher?: boolean | null;
  ab_min_envios?: number | null;
  ab_vencedor?: string | null;
  ab_decidido_em?: string | null;
}

export interface EnvioAB {
  id: string;
  inscricao_id: string;
  etapa_id: string | null;
  status: string;
  variante?: string | null;
}

export interface EventoAB {
  envio_id: string | null;
  etapa_id: string | null;
  tipo: string;
  variante?: string | null;
}

export interface EstatisticaVariante {
  variante: VarianteAB;
  titulo: string;
  mensagem: string;
  envios: number;
  enviados: number;
  respostas: number;
  cliques: number;
  aberturas: number;
  agendamentos: number;
  fechamentos: number;
  taxaResposta: number;
  taxaClique: number;
  taxaConversao: number;
}

export interface ResultadoAB {
  etapa_id: string;
  fluxo_id: string;
  ordem: number;
  canal: string;
  ativo: boolean;
  minEnvios: number;
  autoEscolher: boolean;
  vencedorSalvo: VarianteAB | null;
  decididoEm: string | null;
  a: EstatisticaVariante;
  b: EstatisticaVariante;
  amostraSuficiente: boolean;
  vencedorSugerido: VarianteAB | null;
  diferencaPontos: number;
}

const taxa = (parte: number, total: number) => (total > 0 ? (parte / total) * 100 : 0);

/** Deterministic-ish split: returns "A" or "B" honoring the configured percentage for A. */
export function sortearVariante(splitA: number): VarianteAB {
  const p = Math.min(100, Math.max(0, Number.isFinite(splitA) ? splitA : 50));
  return Math.random() * 100 < p ? "A" : "B";
}

function statsDaVariante(
  variante: VarianteAB,
  titulo: string,
  mensagem: string,
  envios: EnvioAB[],
  eventos: EventoAB[],
): EstatisticaVariante {
  const meus = envios.filter((e) => (e.variante ?? "A") === variante);
  const ids = new Set(meus.map((e) => e.id));
  const evs = eventos.filter((ev) => (ev.envio_id ? ids.has(ev.envio_id) : false));
  const conta = (t: string) => evs.filter((e) => e.tipo === t).length;

  const enviados = meus.filter((e) => e.status === "enviado").length;
  const base = enviados || meus.length;
  const respostas = conta("resposta");
  const cliques = conta("clique");
  const agendamentos = conta("agendamento");
  const fechamentos = conta("fechamento");

  return {
    variante,
    titulo,
    mensagem,
    envios: meus.length,
    enviados,
    respostas,
    cliques,
    aberturas: conta("abertura"),
    agendamentos,
    fechamentos,
    taxaResposta: taxa(respostas, base),
    taxaClique: taxa(cliques, base),
    taxaConversao: taxa(agendamentos + fechamentos, base),
  };
}

export function calcularResultadosAB(
  etapas: EtapaAB[],
  envios: EnvioAB[],
  eventos: EventoAB[],
): ResultadoAB[] {
  return etapas
    .filter((et) => et.ab_ativo || et.ab_vencedor)
    .map((et) => {
      const enviosEtapa = envios.filter((e) => e.etapa_id === et.id);
      const eventosEtapa = eventos.filter((ev) => ev.etapa_id === et.id || ev.etapa_id === null);
      const a = statsDaVariante("A", et.titulo, et.mensagem, enviosEtapa, eventosEtapa);
      const b = statsDaVariante("B", et.ab_titulo_b || et.titulo, et.ab_mensagem_b ?? "", enviosEtapa, eventosEtapa);

      const minEnvios = Number(et.ab_min_envios ?? 20);
      const amostraSuficiente =
        (a.enviados || a.envios) >= minEnvios && (b.enviados || b.envios) >= minEnvios;

      const scoreA = a.taxaResposta + a.taxaConversao;
      const scoreB = b.taxaResposta + b.taxaConversao;
      const diferenca = Math.abs(scoreA - scoreB);
      const vencedorSugerido: VarianteAB | null =
        amostraSuficiente && diferenca > 0 ? (scoreA >= scoreB ? "A" : "B") : null;

      return {
        etapa_id: et.id,
        fluxo_id: et.fluxo_id,
        ordem: et.ordem,
        canal: et.canal,
        ativo: !!et.ab_ativo,
        minEnvios,
        autoEscolher: et.ab_auto_escolher !== false,
        vencedorSalvo: (et.ab_vencedor as VarianteAB | null) ?? null,
        decididoEm: et.ab_decidido_em ?? null,
        a,
        b,
        amostraSuficiente,
        vencedorSugerido,
        diferencaPontos: diferenca,
      };
    })
    .sort((x, y) => x.ordem - y.ordem);
}
