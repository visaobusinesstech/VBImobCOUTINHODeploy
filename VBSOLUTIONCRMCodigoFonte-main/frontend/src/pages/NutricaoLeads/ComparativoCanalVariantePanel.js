/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 *
 * Comparativo de desempenho por canal e variante de mensagem.
 */

import React, { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const pct = (p, t) => (t > 0 ? (p / t) * 100 : 0);
const fmtPct = (v) => `${Number(v || 0).toFixed(1)}%`;
const moeda = (v) =>
  Number(v || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });

const canalLabel = (c) =>
  c === "email" ? "E-mail" : c === "whatsapp" || c === "whatsapp_oficial" ? "WhatsApp" : c || "Outro";

function agregar(grupos, eventosPorEnvio) {
  return Array.from(grupos.entries()).map(([chave, g]) => {
    const enviados = g.envios.filter((e) => e.status === "enviado").length || g.envios.length;
    let aberturas = 0;
    let cliques = 0;
    let respostas = 0;
    let agendamentos = 0;
    let fechamentos = 0;
    let valorFechado = 0;
    g.envios.forEach((env) => {
      const evs = eventosPorEnvio.get(env.id) ?? [];
      const tem = (t) => evs.some((e) => e.tipo === t);
      if (tem("abertura")) aberturas += 1;
      if (tem("clique")) cliques += 1;
      if (tem("resposta")) respostas += 1;
      if (tem("agendamento")) agendamentos += 1;
      const fech = evs.filter((e) => e.tipo === "fechamento");
      if (fech.length) {
        fechamentos += 1;
        valorFechado += fech.reduce((s, e) => s + Number(e.valor ?? 0), 0);
      }
    });
    return {
      chave,
      label: g.label,
      sublabel: g.sublabel,
      canal: g.canal,
      variante: g.variante,
      enviados,
      aberturas,
      cliques,
      respostas,
      agendamentos,
      fechamentos,
      valorFechado,
      taxaResposta: pct(respostas, enviados),
      taxaAgendamento: pct(agendamentos, enviados),
      taxaFechamento: pct(fechamentos, enviados),
    };
  });
}

function CardComparativo({ item, melhor }) {
  return (
    <article className={`realty-card nutricao-comp-card${melhor ? " nutricao-comp-card--melhor" : ""}`}>
      <div className="nutricao-comp-card__head">
        <h3>
          {item.canal === "email" ? "✉" : "💬"} {item.label}
        </h3>
        {melhor && <span className="realty-chip">★ Melhor</span>}
      </div>
      {item.sublabel && <p className="nutricao-muted">{item.sublabel}</p>}
      <div className="nutricao-stats">
        <div className="nutricao-stat-row">
          <span className="nutricao-muted">Enviadas</span>
          <strong>{item.enviados}</strong>
        </div>
        <div className="nutricao-stat-row">
          <span className="nutricao-muted">Respostas</span>
          <strong>
            {item.respostas} ({fmtPct(item.taxaResposta)})
          </strong>
        </div>
        <div className="nutricao-stat-row">
          <span className="nutricao-muted">Agendamentos</span>
          <strong>
            {item.agendamentos} ({fmtPct(item.taxaAgendamento)})
          </strong>
        </div>
        <div className="nutricao-stat-row">
          <span className="nutricao-muted">Fechamentos</span>
          <strong>
            {item.fechamentos} ({fmtPct(item.taxaFechamento)})
          </strong>
        </div>
        <div className="nutricao-stat-row">
          <span className="nutricao-muted">Valor fechado</span>
          <strong>{moeda(item.valorFechado)}</strong>
        </div>
      </div>
    </article>
  );
}

export function ComparativoCanalVariantePanel({
  fluxos = [],
  etapas = [],
  envios = [],
  eventos = [],
  loading,
}) {
  const [fluxoFiltro, setFluxoFiltro] = useState("todos");
  const [metrica, setMetrica] = useState("taxaFechamento");

  const etapaPorId = useMemo(() => new Map(etapas.map((e) => [e.id, e])), [etapas]);
  const fluxoPorEtapa = useMemo(
    () => new Map(etapas.map((e) => [e.id, e.fluxoId])),
    [etapas]
  );

  const enviosFiltrados = useMemo(
    () =>
      envios.filter((e) =>
        fluxoFiltro === "todos"
          ? true
          : e.etapaId
            ? String(fluxoPorEtapa.get(e.etapaId)) === String(fluxoFiltro)
            : false
      ),
    [envios, fluxoFiltro, fluxoPorEtapa]
  );

  const eventosPorEnvio = useMemo(() => {
    const m = new Map();
    eventos.forEach((ev) => {
      if (!ev.envioId) return;
      const arr = m.get(ev.envioId) ?? [];
      arr.push(ev);
      m.set(ev.envioId, arr);
    });
    return m;
  }, [eventos]);

  const porCanal = useMemo(() => {
    const grupos = new Map();
    enviosFiltrados.forEach((e) => {
      const canal = e.canal || "outro";
      const g = grupos.get(canal) ?? { label: canalLabel(canal), canal, envios: [] };
      g.envios.push(e);
      grupos.set(canal, g);
    });
    return agregar(grupos, eventosPorEnvio).sort((a, b) => b[metrica] - a[metrica]);
  }, [enviosFiltrados, eventosPorEnvio, metrica]);

  const porVersao = useMemo(() => {
    const grupos = new Map();
    enviosFiltrados.forEach((e) => {
      if (!e.etapaId) return;
      const etapa = etapaPorId.get(e.etapaId);
      const variante = String(e.variante || "A").toUpperCase();
      const chave = `${e.etapaId}|${variante}`;
      const fluxoNome = fluxos.find((f) => f.id === etapa?.fluxoId)?.nome ?? "Fluxo";
      const g = grupos.get(chave) ?? {
        label: `${etapa ? `Etapa ${etapa.ordem} · ${etapa.titulo}` : "Etapa"} — versão ${variante}`,
        sublabel: `${fluxoNome} · ${canalLabel(e.canal)}`,
        canal: e.canal,
        variante,
        envios: [],
      };
      g.envios.push(e);
      grupos.set(chave, g);
    });
    return agregar(grupos, eventosPorEnvio).sort((a, b) => b[metrica] - a[metrica]);
  }, [enviosFiltrados, eventosPorEnvio, etapaPorId, fluxos, metrica]);

  const paresVariante = useMemo(() => {
    const m = new Map();
    porVersao.forEach((v) => {
      const base = v.chave.split("|")[0];
      const arr = m.get(base) ?? [];
      arr.push(v);
      m.set(base, arr);
    });
    return Array.from(m.values())
      .filter((arr) => arr.length > 1)
      .map((arr) => arr.sort((a, b) => String(a.variante ?? "").localeCompare(String(b.variante ?? ""))));
  }, [porVersao]);

  const grafico = useMemo(
    () =>
      porVersao.slice(0, 10).map((v) => ({
        nome: `${v.variante} · ${v.label.split("—")[0].trim().slice(0, 22)}`,
        Agendamento: Number(v.taxaAgendamento.toFixed(1)),
        Fechamento: Number(v.taxaFechamento.toFixed(1)),
        Resposta: Number(v.taxaResposta.toFixed(1)),
      })),
    [porVersao]
  );

  const exportarCsv = () => {
    const head = [
      "Grupo",
      "Tipo",
      "Canal",
      "Versao",
      "Enviadas",
      "Respostas",
      "Agendamentos",
      "Fechamentos",
      "Taxa agendamento %",
      "Taxa fechamento %",
      "Valor fechado",
    ];
    const linhas = [
      ...porCanal.map((c) => [
        "Canal: " + c.label,
        "canal",
        c.label,
        "",
        c.enviados,
        c.respostas,
        c.agendamentos,
        c.fechamentos,
        c.taxaAgendamento.toFixed(1),
        c.taxaFechamento.toFixed(1),
        c.valorFechado.toFixed(2),
      ]),
      ...porVersao.map((v) => [
        v.label,
        "versao",
        canalLabel(v.canal),
        v.variante ?? "",
        v.enviados,
        v.respostas,
        v.agendamentos,
        v.fechamentos,
        v.taxaAgendamento.toFixed(1),
        v.taxaFechamento.toFixed(1),
        v.valorFechado.toFixed(2),
      ]),
    ];
    const csv = [head, ...linhas].map((r) => r.join(";")).join("\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `comparativo-canal-versao-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const melhorCanal = porCanal[0]?.chave;

  return (
    <div className="nutricao-panel">
      <div className="realty-page__header-actions nutricao-toolbar">
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
          value={metrica}
          onChange={(e) => setMetrica(e.target.value)}
        >
          <option value="taxaFechamento">Ordenar por fechamento</option>
          <option value="taxaAgendamento">Ordenar por agendamento</option>
          <option value="taxaResposta">Ordenar por resposta</option>
        </select>
        <button
          type="button"
          className="realty-page__btn realty-page__btn--ghost"
          onClick={exportarCsv}
          disabled={porCanal.length === 0}
        >
          Exportar CSV
        </button>
      </div>

      {loading && <div className="realty-empty">Carregando…</div>}

      <section>
        <h3 className="nutricao-section-title">Comparação por canal</h3>
        {porCanal.length === 0 ? (
          <p className="nutricao-muted">Sem mensagens registradas para comparar.</p>
        ) : (
          <div className="nutricao-grid-2">
            {porCanal.map((c) => (
              <CardComparativo
                key={c.chave}
                item={c}
                melhor={c.chave === melhorCanal && porCanal.length > 1}
              />
            ))}
          </div>
        )}
      </section>

      {paresVariante.length > 0 && (
        <section>
          <h3 className="nutricao-section-title">Comparação lado a lado por versão de mensagem</h3>
          <div className="nutricao-stack">
            {paresVariante.map((par) => {
              const vencedor = [...par].sort((a, b) => b[metrica] - a[metrica])[0];
              return (
                <div key={par[0].chave} className="nutricao-grid-2">
                  {par.map((v) => (
                    <CardComparativo
                      key={v.chave}
                      item={v}
                      melhor={v.chave === vencedor.chave}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {grafico.length > 0 && (
        <article className="realty-card">
          <h3>Agendamento × fechamento por versão</h3>
          <p className="nutricao-muted">Top 10 versões pela métrica selecionada.</p>
          <div className="nutricao-chart nutricao-chart--tall">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={grafico}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                <XAxis
                  dataKey="nome"
                  fontSize={11}
                  interval={0}
                  angle={-20}
                  textAnchor="end"
                  height={70}
                />
                <YAxis unit="%" fontSize={12} />
                <Tooltip formatter={(v) => `${v}%`} />
                <Legend />
                <Bar dataKey="Agendamento" fill="#2673d9" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Fechamento" fill="#dc2626" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
      )}

      <article className="realty-card">
        <h3>Detalhe por versão de mensagem</h3>
        <div className="nutricao-table-wrap">
          <table className="nutricao-table">
            <thead>
              <tr>
                <th>Versão</th>
                <th>Canal</th>
                <th className="nutricao-num">Enviadas</th>
                <th className="nutricao-num">Respostas</th>
                <th className="nutricao-num">Agendamentos</th>
                <th className="nutricao-num">Fechamentos</th>
                <th className="nutricao-num">Valor</th>
              </tr>
            </thead>
            <tbody>
              {porVersao.map((v) => (
                <tr key={v.chave}>
                  <td>
                    <strong>{v.label}</strong>
                    {v.sublabel && (
                      <span className="nutricao-muted" style={{ display: "block" }}>
                        {v.sublabel}
                      </span>
                    )}
                  </td>
                  <td>{canalLabel(v.canal)}</td>
                  <td className="nutricao-num">{v.enviados}</td>
                  <td className="nutricao-num">
                    {v.respostas} ({fmtPct(v.taxaResposta)})
                  </td>
                  <td className="nutricao-num">
                    {v.agendamentos} ({fmtPct(v.taxaAgendamento)})
                  </td>
                  <td className="nutricao-num">
                    {v.fechamentos} ({fmtPct(v.taxaFechamento)})
                  </td>
                  <td className="nutricao-num">{moeda(v.valorFechado)}</td>
                </tr>
              ))}
              {porVersao.length === 0 && (
                <tr>
                  <td colSpan={7} className="nutricao-muted" style={{ textAlign: "center" }}>
                    Nenhuma versão com mensagens registradas.
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
