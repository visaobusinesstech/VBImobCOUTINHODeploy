/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 *
 * Painel de métricas agregadas dos fluxos de nutrição.
 */

import React, { useMemo, useState } from "react";
import { calcularMetricas, TIPOS_EVENTO } from "./nutricaoMetricas";

const PERIODOS = [7, 30, 90, 180];
const ORDENS = ["fechamentos", "agendamentos", "respostas", "cliques", "aberturas", "reativados"];

const moeda = (v) =>
  Number(v || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
const perc = (v) => `${Number(v || 0).toFixed(1)}%`;

function LinhaFunil({ label, valor, total }) {
  const p = total > 0 ? (valor / total) * 100 : 0;
  return (
    <div className="nutricao-funnel-row">
      <div className="nutricao-funnel-row__head">
        <span>{label}</span>
        <span>
          {valor} <span className="nutricao-muted">({perc(p)})</span>
        </span>
      </div>
      <div className="nutricao-funnel-bar">
        <div className="nutricao-funnel-bar__fill" style={{ width: `${Math.min(100, p)}%` }} />
      </div>
    </div>
  );
}

export function MetricasFluxosPanel({
  fluxos = [],
  inscricoes = [],
  envios = [],
  eventos = [],
  dias = 30,
  onDiasChange,
  loading,
}) {
  const [ordem, setOrdem] = useState("fechamentos");

  const metricas = useMemo(
    () => calcularMetricas(fluxos, inscricoes, envios, eventos),
    [fluxos, inscricoes, envios, eventos]
  );

  const ordenadas = useMemo(
    () => [...metricas].sort((a, b) => Number(b[ordem] ?? 0) - Number(a[ordem] ?? 0)),
    [metricas, ordem]
  );

  const totais = useMemo(
    () =>
      metricas.reduce(
        (acc, m) => ({
          enviados: acc.enviados + (m.enviados || m.envios),
          aberturas: acc.aberturas + m.aberturas,
          cliques: acc.cliques + m.cliques,
          respostas: acc.respostas + m.respostas,
          agendamentos: acc.agendamentos + m.agendamentos,
          fechamentos: acc.fechamentos + m.fechamentos,
          valor: acc.valor + m.valorFechado,
          reativados: acc.reativados + m.reativados,
        }),
        {
          enviados: 0,
          aberturas: 0,
          cliques: 0,
          respostas: 0,
          agendamentos: 0,
          fechamentos: 0,
          valor: 0,
          reativados: 0,
        }
      ),
    [metricas]
  );

  const exportarCsv = () => {
    const head = [
      "Fluxo",
      "Ativo",
      "Inscritos",
      "Mensagens",
      "Enviadas",
      "Aberturas",
      "% Abertura",
      "Cliques",
      "% Clique",
      "Respostas",
      "% Resposta",
      "Agendamentos",
      "% Agendamento",
      "Fechamentos",
      "% Fechamento",
      "Valor fechado",
      "Leads reativados",
      "% Reativação",
    ];
    const linhas = ordenadas.map((m) => [
      m.nome,
      m.ativo ? "Sim" : "Não",
      m.inscritos,
      m.envios,
      m.enviados,
      m.aberturas,
      perc(m.taxaAbertura),
      m.cliques,
      perc(m.taxaClique),
      m.respostas,
      perc(m.taxaResposta),
      m.agendamentos,
      perc(m.taxaAgendamento),
      m.fechamentos,
      perc(m.taxaFechamento),
      m.valorFechado,
      m.reativados,
      perc(m.taxaReativacao),
    ]);
    const csv = [head, ...linhas]
      .map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `nutricao-metricas-${dias}d.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const melhor = ordenadas.find((m) => m.fechamentos > 0 || m.respostas > 0);

  const kpis = [
    { label: "Enviadas", v: totais.enviados },
    { label: "Aberturas", v: totais.aberturas },
    { label: "Cliques", v: totais.cliques },
    { label: "Respostas", v: totais.respostas },
    { label: "Agendamentos", v: totais.agendamentos },
    { label: "Fechamentos", v: totais.fechamentos },
  ];

  return (
    <div className="nutricao-panel">
      <div className="realty-page__header-actions nutricao-toolbar">
        <button type="button" className="realty-page__btn realty-page__btn--ghost" onClick={exportarCsv}>
          Exportar CSV
        </button>
        {PERIODOS.map((d) => (
          <button
            key={d}
            type="button"
            className={`realty-page__btn${dias === d ? "" : " realty-page__btn--ghost"}`}
            onClick={() => onDiasChange && onDiasChange(d)}
          >
            {d} dias
          </button>
        ))}
      </div>

      <div className="nutricao-kpis">
        {kpis.map((c) => (
          <article key={c.label} className="realty-card nutricao-kpi">
            <p className="nutricao-muted">{c.label}</p>
            <strong>{c.v}</strong>
          </article>
        ))}
      </div>

      <div className="nutricao-grid-2">
        <article className="realty-card">
          <h3>Funil geral da nutrição</h3>
          <p className="nutricao-muted">Base: mensagens enviadas nos últimos {dias} dias</p>
          <LinhaFunil label="Enviadas" valor={totais.enviados} total={totais.enviados} />
          <LinhaFunil label="Aberturas" valor={totais.aberturas} total={totais.enviados} />
          <LinhaFunil label="Cliques" valor={totais.cliques} total={totais.enviados} />
          <LinhaFunil label="Respostas" valor={totais.respostas} total={totais.enviados} />
          <LinhaFunil label="Agendamentos" valor={totais.agendamentos} total={totais.enviados} />
          <LinhaFunil label="Fechamentos" valor={totais.fechamentos} total={totais.enviados} />
        </article>

        <article className="realty-card">
          <h3>Campanha que mais reativa</h3>
          <p className="nutricao-muted">
            Leads que responderam, agendaram ou fecharam após a nutrição
          </p>
          {melhor ? (
            <>
              <p>
                <span className="realty-chip">↑</span> <strong>{melhor.nome}</strong>
              </p>
              <div className="nutricao-grid-2 nutricao-stats">
                <div>
                  <span className="nutricao-muted">Reativados: </span>
                  {melhor.reativados}
                </div>
                <div>
                  <span className="nutricao-muted">Taxa: </span>
                  {perc(melhor.taxaReativacao)}
                </div>
                <div>
                  <span className="nutricao-muted">Agendamentos: </span>
                  {melhor.agendamentos}
                </div>
                <div>
                  <span className="nutricao-muted">Fechamentos: </span>
                  {melhor.fechamentos}
                </div>
              </div>
              <p>
                <span className="nutricao-muted">Valor fechado no período: </span>
                <strong>{moeda(totais.valor)}</strong>
              </p>
            </>
          ) : (
            <p className="realty-empty" style={{ padding: 16 }}>
              Nenhum evento registrado ainda. Marque abertura, clique, resposta, agendamento ou
              fechamento na aba Mensagens para alimentar os relatórios.
            </p>
          )}
        </article>
      </div>

      <article className="realty-card">
        <h3>Desempenho por fluxo</h3>
        <p className="nutricao-muted">Ordenar por:</p>
        <div className="realty-page__header-actions" style={{ marginBottom: 12 }}>
          {ORDENS.map((k) => (
            <button
              key={k}
              type="button"
              className={`realty-page__btn${ordem === k ? "" : " realty-page__btn--ghost"}`}
              onClick={() => setOrdem(k)}
            >
              {k.charAt(0).toUpperCase() + k.slice(1)}
            </button>
          ))}
        </div>

        {loading && <div className="realty-empty">Carregando…</div>}
        {!loading && ordenadas.length === 0 && (
          <div className="realty-empty">Nenhum fluxo cadastrado.</div>
        )}
        {ordenadas.length > 0 && (
          <div className="nutricao-table-wrap">
            <table className="nutricao-table">
              <thead>
                <tr>
                  <th>Fluxo</th>
                  <th>Inscritos</th>
                  <th>Enviadas</th>
                  {TIPOS_EVENTO.map((t) => (
                    <th key={t.tipo}>{t.label}</th>
                  ))}
                  <th>Reativação</th>
                  <th>Valor</th>
                </tr>
              </thead>
              <tbody>
                {ordenadas.map((m) => (
                  <tr key={m.fluxoId}>
                    <td>
                      <strong>{m.nome}</strong>
                      {!m.ativo && <span className="realty-chip">pausado</span>}
                    </td>
                    <td>{m.inscritos}</td>
                    <td>{m.enviados}</td>
                    <td>
                      {m.aberturas}{" "}
                      <span className="nutricao-muted">{perc(m.taxaAbertura)}</span>
                    </td>
                    <td>
                      {m.cliques} <span className="nutricao-muted">{perc(m.taxaClique)}</span>
                    </td>
                    <td>
                      {m.respostas}{" "}
                      <span className="nutricao-muted">{perc(m.taxaResposta)}</span>
                    </td>
                    <td>
                      {m.agendamentos}{" "}
                      <span className="nutricao-muted">{perc(m.taxaAgendamento)}</span>
                    </td>
                    <td>
                      {m.fechamentos}{" "}
                      <span className="nutricao-muted">{perc(m.taxaFechamento)}</span>
                    </td>
                    <td>
                      {m.reativados}{" "}
                      <span className="nutricao-muted">{perc(m.taxaReativacao)}</span>
                    </td>
                    <td>{moeda(m.valorFechado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </div>
  );
}
