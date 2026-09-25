/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 *
 * Análise de coorte de entrada nos fluxos de nutrição.
 */

import React, { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function inicioSemana(d) {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  const dia = (c.getDay() + 6) % 7;
  c.setDate(c.getDate() - dia);
  return c;
}

function inicioMes(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function rotulo(d, g) {
  if (g === "mes") {
    return d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
  }
  return `Sem. ${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`;
}

const pct = (parte, total) => (total > 0 ? (parte / total) * 100 : 0);
const fmtPct = (v) => `${Number(v || 0).toFixed(1)}%`;
const moeda = (v) =>
  Number(v || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });

function corTaxa(taxa, media) {
  if (taxa === 0) return "nutricao-muted";
  if (taxa >= media * 1.15) return "nutricao-taxa--alta";
  if (taxa <= media * 0.85) return "nutricao-taxa--baixa";
  return "";
}

function eventoData(ev) {
  return ev.createdAt || ev.ocorridoEm || ev.created_at || "";
}

export function CoorteNutricaoPanel({
  fluxos = [],
  inscricoes = [],
  eventos = [],
  loading,
}) {
  const [granularidade, setGranularidade] = useState("mes");
  const [fluxoFiltro, setFluxoFiltro] = useState("todos");
  const [periodos, setPeriodos] = useState("12");

  const linhas = useMemo(() => {
    const inscFiltradas = inscricoes.filter(
      (i) =>
        (fluxoFiltro === "todos" || String(i.fluxoId) === String(fluxoFiltro)) && i.createdAt
    );

    const eventosPorInscricao = new Map();
    eventos.forEach((ev) => {
      const chave = ev.inscricaoId;
      if (!chave) return;
      const arr = eventosPorInscricao.get(chave) ?? [];
      arr.push(ev);
      eventosPorInscricao.set(chave, arr);
    });

    const porLeadFluxo = new Map();
    eventos.forEach((ev) => {
      if (ev.inscricaoId || !ev.leadSaleId) return;
      const k = `${ev.leadSaleId}|${ev.fluxoId}`;
      const arr = porLeadFluxo.get(k) ?? [];
      arr.push(ev);
      porLeadFluxo.set(k, arr);
    });

    const grupos = new Map();
    inscFiltradas.forEach((i) => {
      const d = new Date(i.createdAt);
      const inicio = granularidade === "mes" ? inicioMes(d) : inicioSemana(d);
      const chave = inicio.toISOString().slice(0, 10);
      const g = grupos.get(chave) ?? { inicio, itens: [] };
      g.itens.push(i);
      grupos.set(chave, g);
    });

    const resultado = Array.from(grupos.entries()).map(([chave, { inicio, itens }]) => {
      let respostas = 0;
      let agendamentos = 0;
      let fechamentos = 0;
      let valorFechado = 0;
      const diasAteFechar = [];

      itens.forEach((i) => {
        const evs = [
          ...(eventosPorInscricao.get(i.id) ?? []),
          ...(i.leadSaleId ? porLeadFluxo.get(`${i.leadSaleId}|${i.fluxoId}`) ?? [] : []),
        ];
        const tem = (t) => evs.some((e) => e.tipo === t);
        if (tem("resposta")) respostas += 1;
        if (tem("agendamento")) agendamentos += 1;
        const fech = evs.filter((e) => e.tipo === "fechamento");
        if (fech.length > 0) {
          fechamentos += 1;
          valorFechado += fech.reduce((s, e) => s + Number(e.valor ?? 0), 0);
          const primeiro = fech
            .map((e) => new Date(eventoData(e)).getTime())
            .filter((t) => Number.isFinite(t))
            .sort((a, b) => a - b)[0];
          const base = new Date(i.createdAt).getTime();
          if (primeiro != null && primeiro >= base) {
            diasAteFechar.push((primeiro - base) / 86400000);
          }
        }
      });

      const inscritos = itens.length;
      return {
        chave,
        label: rotulo(inicio, granularidade),
        inicio,
        inscritos,
        respostas,
        agendamentos,
        fechamentos,
        valorFechado,
        taxaResposta: pct(respostas, inscritos),
        taxaAgendamento: pct(agendamentos, inscritos),
        taxaFechamento: pct(fechamentos, inscritos),
        diasMedioFechamento: diasAteFechar.length
          ? diasAteFechar.reduce((s, v) => s + v, 0) / diasAteFechar.length
          : null,
      };
    });

    return resultado
      .sort((a, b) => a.inicio.getTime() - b.inicio.getTime())
      .slice(-Number(periodos));
  }, [inscricoes, eventos, fluxoFiltro, granularidade, periodos]);

  const totais = useMemo(() => {
    const inscritos = linhas.reduce((s, l) => s + l.inscritos, 0);
    const fechamentos = linhas.reduce((s, l) => s + l.fechamentos, 0);
    const valor = linhas.reduce((s, l) => s + l.valorFechado, 0);
    const taxaMedia = pct(fechamentos, inscritos);
    const ultima = linhas[linhas.length - 1];
    const anterior = linhas[linhas.length - 2];
    const variacao =
      ultima && anterior ? ultima.taxaFechamento - anterior.taxaFechamento : null;
    return { inscritos, fechamentos, valor, taxaMedia, variacao };
  }, [linhas]);

  const exportarCsv = () => {
    const head = [
      "Coorte",
      "Inscritos",
      "Respostas",
      "Agendamentos",
      "Fechamentos",
      "Taxa resposta %",
      "Taxa agendamento %",
      "Taxa fechamento %",
      "Dias medio ate fechar",
      "Valor fechado",
    ];
    const linhasCsv = linhas.map((l) => [
      l.label,
      l.inscritos,
      l.respostas,
      l.agendamentos,
      l.fechamentos,
      l.taxaResposta.toFixed(1),
      l.taxaAgendamento.toFixed(1),
      l.taxaFechamento.toFixed(1),
      l.diasMedioFechamento?.toFixed(1) ?? "",
      l.valorFechado.toFixed(2),
    ]);
    const csv = [head, ...linhasCsv].map((r) => r.join(";")).join("\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `coorte-nutricao-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="nutricao-panel">
      <div className="realty-page__header-actions nutricao-toolbar">
        <select
          className="realty-page__select"
          value={granularidade}
          onChange={(e) => setGranularidade(e.target.value)}
        >
          <option value="mes">Por mês</option>
          <option value="semana">Por semana</option>
        </select>
        <select
          className="realty-page__select"
          value={fluxoFiltro}
          onChange={(e) => setFluxoFiltro(e.target.value)}
        >
          <option value="todos">Todos os fluxos</option>
          {fluxos.map((f) => (
            <option key={f.id} value={f.id}>
              {f.nome}
            </option>
          ))}
        </select>
        <select
          className="realty-page__select"
          value={periodos}
          onChange={(e) => setPeriodos(e.target.value)}
        >
          <option value="6">Últimos 6</option>
          <option value="12">Últimos 12</option>
          <option value="24">Últimos 24</option>
        </select>
        <button
          type="button"
          className="realty-page__btn realty-page__btn--ghost"
          onClick={exportarCsv}
          disabled={linhas.length === 0}
        >
          Exportar CSV
        </button>
      </div>

      <div className="nutricao-kpis nutricao-kpis--4">
        <article className="realty-card nutricao-kpi">
          <p className="nutricao-muted">Inscritos nas coortes</p>
          <strong>{totais.inscritos}</strong>
        </article>
        <article className="realty-card nutricao-kpi">
          <p className="nutricao-muted">Fechamentos</p>
          <strong>{totais.fechamentos}</strong>
        </article>
        <article className="realty-card nutricao-kpi">
          <p className="nutricao-muted">Taxa média de fechamento</p>
          <strong>
            {fmtPct(totais.taxaMedia)}
            {totais.variacao !== null && (
              <span className="realty-chip" style={{ marginLeft: 8, fontSize: 12 }}>
                {totais.variacao >= 0 ? "↑" : "↓"}{" "}
                {totais.variacao >= 0 ? "+" : ""}
                {totais.variacao.toFixed(1)} p.p.
              </span>
            )}
          </strong>
        </article>
        <article className="realty-card nutricao-kpi">
          <p className="nutricao-muted">Valor fechado</p>
          <strong>{moeda(totais.valor)}</strong>
        </article>
      </div>

      <article className="realty-card">
        <h3>Evolução por coorte de entrada</h3>
        <p className="nutricao-muted">
          Cada coorte agrupa os leads pela data em que entraram no fluxo, comparando quantos
          fecharam.
        </p>
        <div className="nutricao-chart nutricao-chart--mid">
          {loading && <div className="realty-empty">Carregando…</div>}
          {!loading && linhas.length === 0 && (
            <div className="realty-empty">Sem inscrições no período selecionado.</div>
          )}
          {!loading && linhas.length > 0 && (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={linhas}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                <XAxis dataKey="label" fontSize={12} />
                <YAxis yAxisId="left" fontSize={12} />
                <YAxis yAxisId="right" orientation="right" unit="%" fontSize={12} />
                <Tooltip
                  formatter={(valor, nome) =>
                    String(nome).includes("Taxa") ? fmtPct(Number(valor)) : valor
                  }
                />
                <Legend />
                <Bar
                  yAxisId="left"
                  dataKey="inscritos"
                  name="Inscritos"
                  fill="#94a3b8"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  yAxisId="left"
                  dataKey="fechamentos"
                  name="Fechamentos"
                  fill="#2673d9"
                  radius={[4, 4, 0, 0]}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="taxaFechamento"
                  name="Taxa de fechamento"
                  stroke="#dc2626"
                  strokeWidth={2}
                  dot
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </article>

      <article className="realty-card">
        <h3>Detalhe das coortes</h3>
        <p className="nutricao-muted">
          Taxas destacadas comparam cada coorte com a média do período.
        </p>
        <div className="nutricao-table-wrap">
          <table className="nutricao-table">
            <thead>
              <tr>
                <th>Coorte</th>
                <th className="nutricao-num">Inscritos</th>
                <th className="nutricao-num">Respostas</th>
                <th className="nutricao-num">Agendamentos</th>
                <th className="nutricao-num">Fechamentos</th>
                <th className="nutricao-num">Taxa fechamento</th>
                <th className="nutricao-num">Dias até fechar</th>
                <th className="nutricao-num">Valor fechado</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.chave}>
                  <td>
                    <strong>{l.label}</strong>
                  </td>
                  <td className="nutricao-num">{l.inscritos}</td>
                  <td className="nutricao-num">
                    {l.respostas}{" "}
                    <span className="nutricao-muted">({fmtPct(l.taxaResposta)})</span>
                  </td>
                  <td className="nutricao-num">
                    {l.agendamentos}{" "}
                    <span className="nutricao-muted">({fmtPct(l.taxaAgendamento)})</span>
                  </td>
                  <td className="nutricao-num">{l.fechamentos}</td>
                  <td className={`nutricao-num ${corTaxa(l.taxaFechamento, totais.taxaMedia)}`}>
                    {fmtPct(l.taxaFechamento)}
                  </td>
                  <td className="nutricao-num">
                    {l.diasMedioFechamento !== null
                      ? `${l.diasMedioFechamento.toFixed(0)} d`
                      : "—"}
                  </td>
                  <td className="nutricao-num">{moeda(l.valorFechado)}</td>
                </tr>
              ))}
              {linhas.length === 0 && (
                <tr>
                  <td colSpan={8} className="nutricao-muted" style={{ textAlign: "center" }}>
                    Nenhuma coorte no período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  );
}
