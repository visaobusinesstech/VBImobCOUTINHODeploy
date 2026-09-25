/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 *
 * Métricas agregadas de nutrição (camelCase alinhado ao backend).
 */

export const TIPOS_EVENTO = [
  { tipo: "abertura", label: "Abertura" },
  { tipo: "clique", label: "Clique" },
  { tipo: "resposta", label: "Resposta" },
  { tipo: "agendamento", label: "Agendamento" },
  { tipo: "fechamento", label: "Fechamento" },
];

const pct = (parte, total) => (total > 0 ? (parte / total) * 100 : 0);

export function calcularMetricas(fluxos, inscricoes, envios, eventos) {
  const fluxoPorInscricao = new Map(inscricoes.map((i) => [i.id, i.fluxoId]));

  return fluxos.map((f) => {
    const insc = inscricoes.filter((i) => i.fluxoId === f.id);
    const env = envios.filter((e) => fluxoPorInscricao.get(e.inscricaoId) === f.id);
    const enviados = env.filter((e) => e.status === "enviado").length;
    const ev = eventos.filter((e) => e.fluxoId === f.id);
    const conta = (t) => ev.filter((e) => e.tipo === t).length;

    const aberturas = conta("abertura");
    const cliques = conta("clique");
    const respostas = conta("resposta");
    const agendamentos = conta("agendamento");
    const fechamentos = conta("fechamento");
    const base = enviados || env.length;
    const leadsReativados = new Set(
      ev
        .filter(
          (e) =>
            e.tipo === "resposta" || e.tipo === "agendamento" || e.tipo === "fechamento"
        )
        .map((e) => e.leadSaleId ?? e.inscricaoId ?? e.id)
    ).size;

    return {
      fluxoId: f.id,
      nome: f.nome,
      ativo: f.ativo,
      inscritos: insc.length,
      envios: env.length,
      enviados,
      aberturas,
      cliques,
      respostas,
      agendamentos,
      fechamentos,
      valorFechado: ev
        .filter((e) => e.tipo === "fechamento")
        .reduce((s, e) => s + Number(e.valor ?? 0), 0),
      taxaAbertura: pct(aberturas, base),
      taxaClique: pct(cliques, base),
      taxaResposta: pct(respostas, base),
      taxaAgendamento: pct(agendamentos, base),
      taxaFechamento: pct(fechamentos, base),
      reativados: leadsReativados,
      taxaReativacao: pct(leadsReativados, insc.length),
    };
  });
}
