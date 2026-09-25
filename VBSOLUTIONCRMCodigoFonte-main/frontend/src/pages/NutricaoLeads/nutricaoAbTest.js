/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 *
 * Cálculo de resultados de teste A/B (campos camelCase do backend).
 */

const taxa = (parte, total) => (total > 0 ? (parte / total) * 100 : 0);

/** Deterministic-ish split: returns "A" or "B" honoring the configured percentage for A. */
export function sortearVariante(splitA) {
  const p = Math.min(100, Math.max(0, Number.isFinite(splitA) ? splitA : 50));
  return Math.random() * 100 < p ? "A" : "B";
}

function statsDaVariante(variante, titulo, mensagem, envios, eventos) {
  const meus = envios.filter((e) => (e.variante ?? "A") === variante);
  const ids = new Set(meus.map((e) => e.id));
  const evs = eventos.filter((ev) => (ev.envioId ? ids.has(ev.envioId) : false));
  const conta = (t) => evs.filter((e) => e.tipo === t).length;

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

export function calcularResultadosAB(etapas, envios, eventos) {
  return etapas
    .filter((et) => et.abAtivo || et.abVencedor)
    .map((et) => {
      const enviosEtapa = envios.filter((e) => e.etapaId === et.id);
      const eventosEtapa = eventos.filter(
        (ev) => ev.etapaId === et.id || ev.etapaId == null
      );
      const a = statsDaVariante("A", et.titulo, et.mensagem, enviosEtapa, eventosEtapa);
      const b = statsDaVariante(
        "B",
        et.abTituloB || et.titulo,
        et.abMensagemB ?? "",
        enviosEtapa,
        eventosEtapa
      );

      const minEnvios = Number(et.abMinEnvios ?? 20);
      const amostraSuficiente =
        (a.enviados || a.envios) >= minEnvios && (b.enviados || b.envios) >= minEnvios;

      const scoreA = a.taxaResposta + a.taxaConversao;
      const scoreB = b.taxaResposta + b.taxaConversao;
      const diferenca = Math.abs(scoreA - scoreB);
      const vencedorSugerido =
        amostraSuficiente && diferenca > 0 ? (scoreA >= scoreB ? "A" : "B") : null;

      return {
        etapaId: et.id,
        fluxoId: et.fluxoId,
        ordem: et.ordem,
        canal: et.canal,
        ativo: !!et.abAtivo,
        minEnvios,
        autoEscolher: et.abAutoEscolher !== false,
        vencedorSalvo: et.abVencedor || null,
        decididoEm: et.abDecididoEm ?? null,
        a,
        b,
        amostraSuficiente,
        vencedorSugerido,
        diferencaPontos: diferenca,
      };
    })
    .sort((x, y) => x.ordem - y.ordem);
}
