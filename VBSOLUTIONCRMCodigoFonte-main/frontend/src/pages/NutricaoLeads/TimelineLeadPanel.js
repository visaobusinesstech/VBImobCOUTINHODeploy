/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 *
 * Linha do tempo de nutrição por lead / inscrição.
 */

import React, { useMemo, useState } from "react";

const CONFIG = {
  envio: { label: "Enviada", emoji: "✉" },
  abertura: { label: "Abertura", emoji: "👁" },
  clique: { label: "Clique", emoji: "🖱" },
  resposta: { label: "Resposta", emoji: "↩" },
  agendamento: { label: "Agendamento", emoji: "📅" },
  fechamento: { label: "Fechamento", emoji: "🏆" },
};

const ORDEM_ETAPA = ["envio", "abertura", "clique", "resposta", "agendamento", "fechamento"];

function dataHora(v) {
  if (!v) return "—";
  return new Date(v).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const moeda = (v) =>
  Number(v || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });

function eventoData(ev) {
  return ev.createdAt || ev.ocorridoEm || ev.created_at || "";
}

export function TimelineLeadPanel({
  fluxos = [],
  etapas = [],
  inscricoes = [],
  envios = [],
  eventos = [],
  loading,
}) {
  const [busca, setBusca] = useState("");
  const [fluxoFiltro, setFluxoFiltro] = useState("todos");
  const [selecionada, setSelecionada] = useState(null);

  const fluxoPorId = useMemo(() => new Map(fluxos.map((f) => [f.id, f])), [fluxos]);
  const etapaPorId = useMemo(() => new Map(etapas.map((e) => [e.id, e])), [etapas]);
  const inscricaoPorId = useMemo(() => new Map(inscricoes.map((i) => [i.id, i])), [inscricoes]);

  const enviosPorInscricao = useMemo(() => {
    const m = new Map();
    envios.forEach((e) => {
      const key = e.inscricaoId;
      if (key == null) return;
      const arr = m.get(key) ?? [];
      arr.push(e);
      m.set(key, arr);
    });
    return m;
  }, [envios]);

  const eventosPorInscricao = useMemo(() => {
    const envioParaInscricao = new Map(envios.map((e) => [e.id, e.inscricaoId]));
    const m = new Map();
    eventos.forEach((ev) => {
      let insc = ev.inscricaoId ?? null;
      if (!insc && ev.envioId) insc = envioParaInscricao.get(ev.envioId) ?? null;
      if (!insc && ev.leadSaleId) {
        const found = inscricoes.find(
          (i) => i.leadSaleId === ev.leadSaleId && i.fluxoId === ev.fluxoId
        );
        insc = found?.id ?? null;
      }
      if (!insc) return;
      const arr = m.get(insc) ?? [];
      arr.push(ev);
      m.set(insc, arr);
    });
    return m;
  }, [eventos, envios, inscricoes]);

  const listaFiltrada = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return inscricoes
      .filter((i) => (fluxoFiltro === "todos" ? true : String(i.fluxoId) === String(fluxoFiltro)))
      .filter((i) => {
        if (!termo) return true;
        const alvo = `${i.nome ?? ""} ${i.email ?? ""} ${i.telefone ?? ""}`.toLowerCase();
        return alvo.includes(termo);
      })
      .map((i) => {
        const evs = eventosPorInscricao.get(i.id) ?? [];
        const envs = enviosPorInscricao.get(i.id) ?? [];
        const datas = [
          ...evs.map((e) => eventoData(e)),
          ...envs.map((e) => e.enviadoEm || e.createdAt),
        ].filter(Boolean);
        const ordenadas = datas.sort();
        const ultima = ordenadas[ordenadas.length - 1] ?? i.proximaExecucao;
        return { inscricao: i, envios: envs.length, eventos: evs.length, ultima };
      })
      .sort((a, b) => (String(a.ultima) < String(b.ultima) ? 1 : -1));
  }, [inscricoes, fluxoFiltro, busca, eventosPorInscricao, enviosPorInscricao]);

  const inscricaoAtiva = selecionada
    ? inscricaoPorId.get(selecionada) ?? null
    : listaFiltrada[0]?.inscricao ?? null;

  const linha = useMemo(() => {
    if (!inscricaoAtiva) return [];
    const fluxoNome = fluxoPorId.get(inscricaoAtiva.fluxoId)?.nome ?? "Fluxo";
    const etapaLabel = (etapaId) => {
      if (!etapaId) return null;
      const et = etapaPorId.get(etapaId);
      return et ? `Etapa ${et.ordem} · ${et.titulo}` : null;
    };

    const deEnvios = (enviosPorInscricao.get(inscricaoAtiva.id) ?? []).map((e) => ({
      id: `envio-${e.id}`,
      tipo: "envio",
      data: e.enviadoEm || e.createdAt,
      titulo: e.titulo || "Mensagem enviada",
      descricao: e.mensagem,
      canal: e.canal,
      fluxoNome,
      etapaLabel: etapaLabel(e.etapaId),
      variante: e.variante,
      status: e.status,
    }));

    const deEventos = (eventosPorInscricao.get(inscricaoAtiva.id) ?? []).map((ev) => ({
      id: `evento-${ev.id}`,
      tipo: ev.tipo,
      data: eventoData(ev),
      titulo: CONFIG[ev.tipo]?.label || ev.tipo,
      descricao: ev.observacao,
      canal: ev.canal,
      fluxoNome: fluxoPorId.get(ev.fluxoId)?.nome ?? fluxoNome,
      etapaLabel: etapaLabel(ev.etapaId),
      valor: ev.valor,
    }));

    return [...deEnvios, ...deEventos].sort((a, b) => (String(a.data) < String(b.data) ? 1 : -1));
  }, [inscricaoAtiva, enviosPorInscricao, eventosPorInscricao, fluxoPorId, etapaPorId]);

  const resumo = useMemo(() => {
    const c = {
      envio: 0,
      abertura: 0,
      clique: 0,
      resposta: 0,
      agendamento: 0,
      fechamento: 0,
    };
    linha.forEach((i) => {
      if (c[i.tipo] != null) c[i.tipo] += 1;
    });
    return c;
  }, [linha]);

  return (
    <div className="nutricao-timeline">
      <article className="realty-card nutricao-timeline__lista">
        <h3>Leads em nutrição</h3>
        <p className="nutricao-muted">Escolha um lead para ver a linha do tempo completa.</p>
        <div className="realty-form" style={{ marginTop: 8 }}>
          <label>
            Buscar
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Nome, e-mail ou telefone"
            />
          </label>
          <label>
            Fluxo
            <select value={fluxoFiltro} onChange={(e) => setFluxoFiltro(e.target.value)}>
              <option value="todos">Todos os fluxos</option>
              {fluxos.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="nutricao-timeline__scroll">
          {loading && <div className="realty-empty">Carregando…</div>}
          {!loading && listaFiltrada.length === 0 && (
            <div className="realty-empty">Nenhum lead encontrado.</div>
          )}
          {listaFiltrada.map(({ inscricao, envios: qtdEnvios, eventos: qtdEventos, ultima }) => {
            const ativo = inscricaoAtiva?.id === inscricao.id;
            return (
              <button
                key={inscricao.id}
                type="button"
                className={`nutricao-timeline__item${ativo ? " nutricao-timeline__item--ativo" : ""}`}
                onClick={() => setSelecionada(inscricao.id)}
              >
                <strong>
                  {inscricao.nome || inscricao.email || inscricao.telefone || "Lead sem nome"}
                </strong>
                <span className="nutricao-muted">
                  {fluxoPorId.get(inscricao.fluxoId)?.nome ?? "Fluxo"} · {qtdEnvios} envios ·{" "}
                  {qtdEventos} eventos
                </span>
                <span className="nutricao-muted">Última atividade: {dataHora(ultima)}</span>
              </button>
            );
          })}
        </div>
      </article>

      <article className="realty-card nutricao-timeline__detalhe">
        <h3>
          {inscricaoAtiva
            ? inscricaoAtiva.nome ||
              inscricaoAtiva.email ||
              inscricaoAtiva.telefone ||
              "Lead sem nome"
            : "Linha do tempo"}
        </h3>
        <p className="nutricao-muted">
          {inscricaoAtiva
            ? `${fluxoPorId.get(inscricaoAtiva.fluxoId)?.nome ?? "Fluxo"} · etapa ${
                inscricaoAtiva.etapaAtual
              } · ${inscricaoAtiva.status}`
            : "Selecione um lead na lista ao lado."}
        </p>

        {inscricaoAtiva && (
          <div className="nutricao-chips" style={{ marginTop: 8 }}>
            {ORDEM_ETAPA.map((t) => (
              <span key={t} className="realty-chip">
                {CONFIG[t].emoji} {CONFIG[t].label}: {resumo[t]}
              </span>
            ))}
          </div>
        )}

        {inscricaoAtiva && linha.length === 0 && (
          <div className="realty-empty">
            Ainda não há mensagens ou eventos registrados para este lead.
          </div>
        )}

        <ol className="nutricao-timeline__ol">
          {linha.map((item) => {
            const cfg = CONFIG[item.tipo] || { label: item.tipo, emoji: "•" };
            return (
              <li key={item.id} className="nutricao-timeline__evento">
                <span className="nutricao-timeline__dot" aria-hidden>
                  {cfg.emoji}
                </span>
                <div className="realty-card nutricao-timeline__card">
                  <div className="nutricao-chips">
                    <span className="realty-chip">
                      {cfg.emoji} {cfg.label}
                    </span>
                    {item.canal && (
                      <span className="realty-chip">
                        {item.canal === "email" ? "E-mail" : "WhatsApp"}
                      </span>
                    )}
                    {item.variante && (
                      <span className="realty-chip">Variante {item.variante}</span>
                    )}
                    {item.status && item.tipo === "envio" && (
                      <span className="realty-chip">{item.status}</span>
                    )}
                    {typeof item.valor === "number" && item.valor > 0 && (
                      <span className="realty-chip">{moeda(item.valor)}</span>
                    )}
                    <span className="nutricao-muted" style={{ marginLeft: "auto" }}>
                      {dataHora(item.data)}
                    </span>
                  </div>
                  <p>
                    <strong>{item.titulo}</strong>
                  </p>
                  {item.etapaLabel && <p className="nutricao-muted">{item.etapaLabel}</p>}
                  {item.descricao && (
                    <p className="nutricao-muted nutricao-clamp">{item.descricao}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </article>
    </div>
  );
}
