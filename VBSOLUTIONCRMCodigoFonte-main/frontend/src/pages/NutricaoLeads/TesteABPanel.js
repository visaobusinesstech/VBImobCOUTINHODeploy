/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 *
 * Painel de resultados de teste A/B das etapas de nutrição.
 */

import React, { useMemo } from "react";
import { calcularResultadosAB } from "./nutricaoAbTest";

const perc = (v) => `${Number(v || 0).toFixed(1)}%`;

function ColunaVariante({ stats, destaque, onAplicar }) {
  return (
    <div className={`realty-card nutricao-ab-variante${destaque ? " nutricao-ab-variante--destaque" : ""}`}>
      <div className="nutricao-ab-variante__head">
        <span className="realty-chip">
          Variante {stats.variante}
          {destaque ? " ★" : ""}
        </span>
        <span className="nutricao-muted">{stats.enviados || stats.envios} envios</span>
      </div>
      <p>
        <strong>{stats.titulo || "Sem título"}</strong>
      </p>
      <p className="nutricao-muted nutricao-clamp">{stats.mensagem || "Mensagem não definida"}</p>
      <div className="nutricao-funnel-row">
        <div className="nutricao-funnel-row__head">
          <span className="nutricao-muted">Taxa de resposta</span>
          <strong>{perc(stats.taxaResposta)}</strong>
        </div>
        <div className="nutricao-funnel-bar">
          <div
            className="nutricao-funnel-bar__fill"
            style={{ width: `${Math.min(100, stats.taxaResposta)}%` }}
          />
        </div>
      </div>
      <div className="nutricao-grid-2 nutricao-stats">
        <span className="nutricao-muted">Respostas: {stats.respostas}</span>
        <span className="nutricao-muted">Cliques: {stats.cliques}</span>
        <span className="nutricao-muted">Agendamentos: {stats.agendamentos}</span>
        <span className="nutricao-muted">Fechamentos: {stats.fechamentos}</span>
      </div>
      {onAplicar && (
        <button type="button" className="realty-page__btn realty-page__btn--ghost" onClick={onAplicar}>
          Usar variante {stats.variante}
        </button>
      )}
    </div>
  );
}

export function TesteABPanel({
  fluxos = [],
  etapas = [],
  envios = [],
  eventos = [],
  onAplicarVencedor,
  onReabrir,
}) {
  const resultados = useMemo(
    () => calcularResultadosAB(etapas, envios, eventos),
    [etapas, envios, eventos]
  );

  const porFluxo = useMemo(() => {
    const map = new Map();
    resultados.forEach((r) => {
      map.set(r.fluxoId, [...(map.get(r.fluxoId) ?? []), r]);
    });
    return map;
  }, [resultados]);

  if (resultados.length === 0) {
    return (
      <article className="realty-card">
        <p>
          <strong>⚗ Nenhum teste A/B configurado</strong>
        </p>
        <p className="nutricao-muted">
          Edite um fluxo, abra uma etapa e ative &quot;Teste A/B&quot; para criar a variante B. As
          mensagens serão sorteadas entre os leads e a variante com melhor taxa de resposta pode ser
          escolhida automaticamente.
        </p>
      </article>
    );
  }

  return (
    <div className="nutricao-panel">
      {[...porFluxo.entries()].map(([fluxoId, lista]) => {
        const fluxo = fluxos.find((f) => f.id === fluxoId || String(f.id) === String(fluxoId));
        return (
          <article key={fluxoId} className="realty-card" style={{ marginBottom: 12 }}>
            <h3>{fluxo?.nome ?? "Fluxo"}</h3>
            <p className="nutricao-muted">{lista.length} etapa(s) em teste A/B</p>

            {lista.map((r) => {
              const vencedor = r.vencedorSalvo ?? r.vencedorSugerido;
              return (
                <div key={r.etapaId} className="nutricao-ab-etapa">
                  <div className="nutricao-ab-etapa__head">
                    <div className="nutricao-chips">
                      <span className="realty-chip">Etapa {r.ordem}</span>
                      <span className="realty-chip">
                        {r.canal === "email" ? "E-mail" : "WhatsApp"}
                      </span>
                      {r.ativo ? (
                        <span className="realty-chip">Teste em andamento</span>
                      ) : (
                        <span className="realty-chip">
                          Encerrado{r.vencedorSalvo ? ` · vencedora ${r.vencedorSalvo}` : ""}
                        </span>
                      )}
                      {!r.amostraSuficiente && r.ativo && (
                        <span className="nutricao-muted">
                          Amostra insuficiente (mín. {r.minEnvios} envios por variante)
                        </span>
                      )}
                    </div>
                    {!r.ativo && (
                      <button
                        type="button"
                        className="realty-page__btn realty-page__btn--ghost"
                        onClick={() => onReabrir && onReabrir(r.etapaId)}
                      >
                        Reabrir teste
                      </button>
                    )}
                  </div>

                  <div className="nutricao-grid-2">
                    <ColunaVariante
                      stats={r.a}
                      destaque={vencedor === "A"}
                      onAplicar={
                        r.ativo
                          ? () => onAplicarVencedor && onAplicarVencedor(r.etapaId, "A")
                          : undefined
                      }
                    />
                    <ColunaVariante
                      stats={r.b}
                      destaque={vencedor === "B"}
                      onAplicar={
                        r.ativo
                          ? () => onAplicarVencedor && onAplicarVencedor(r.etapaId, "B")
                          : undefined
                      }
                    />
                  </div>

                  {r.ativo && r.vencedorSugerido && (
                    <p className="nutricao-muted">
                      Sugestão: variante <strong>{r.vencedorSugerido}</strong> está{" "}
                      {Number(r.diferencaPontos || 0).toFixed(1)} pontos à frente.
                      {r.autoEscolher
                        ? " A escolha automática será aplicada no próximo processamento."
                        : " Escolha automática desativada — aplique manualmente."}
                    </p>
                  )}
                </div>
              );
            })}
          </article>
        );
      })}
    </div>
  );
}
