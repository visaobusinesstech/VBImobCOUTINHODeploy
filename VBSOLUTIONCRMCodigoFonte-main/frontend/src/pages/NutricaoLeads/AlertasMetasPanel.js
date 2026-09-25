/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 *
 * Configuração de metas e lista de alertas da nutrição.
 */

import React, { useEffect, useMemo, useState } from "react";

const GLOBAL = "__global__";

const META_PADRAO = {
  fluxoId: null,
  metaAbertura: 25,
  metaResposta: 10,
  metaAgendamento: 5,
  metaFechamento: 1,
  janelaDias: 14,
  minEnvios: 10,
  repetirAvisoHoras: 24,
  alertarZeroAgendamento: true,
  alertarZeroResposta: true,
  notificarApp: true,
  monitoramentoAtivo: true,
};

export function AlertasMetasPanel({
  fluxos = [],
  metasConfig = [],
  alertas = [],
  onSalvar,
  onVerificar,
  onResolver,
  loading,
  verificando,
}) {
  const [alvo, setAlvo] = useState(GLOBAL);
  const [form, setForm] = useState({ ...META_PADRAO });
  const [mostrarResolvidos, setMostrarResolvidos] = useState(false);

  const configAtual = useMemo(
    () =>
      metasConfig.find((c) => {
        const key = c.fluxoId == null ? GLOBAL : String(c.fluxoId);
        return key === alvo;
      }),
    [metasConfig, alvo]
  );

  useEffect(() => {
    setForm({
      ...META_PADRAO,
      ...(configAtual || {}),
      fluxoId: alvo === GLOBAL ? null : alvo,
    });
  }, [configAtual, alvo]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const numField = (k, label, sufixo) => (
    <label key={k}>
      {label}
      <div className="nutricao-input-sufixo">
        <input
          type="number"
          min={0}
          step="any"
          value={form[k] ?? ""}
          onChange={(e) => set(k, Number(e.target.value))}
        />
        {sufixo && <span className="nutricao-muted">{sufixo}</span>}
      </div>
    </label>
  );

  const checkField = (k, label, desc) => (
    <label key={k} className="nutricao-check-row">
      <input type="checkbox" checked={!!form[k]} onChange={(e) => set(k, e.target.checked)} />
      <span>
        <strong>{label}</strong>
        {desc && <span className="nutricao-muted" style={{ display: "block" }}>{desc}</span>}
      </span>
    </label>
  );

  const alertasVisiveis = alertas.filter((a) => (mostrarResolvidos ? true : !a.resolvido));
  const abertos = alertas.filter((a) => !a.resolvido);
  const criticos = abertos.filter((a) => a.severidade === "critico");

  return (
    <div className="nutricao-panel">
      <div className="nutricao-kpis nutricao-kpis--3">
        <article className="realty-card nutricao-kpi">
          <p className="nutricao-muted">⚠ Alertas em aberto</p>
          <strong>{abertos.length}</strong>
        </article>
        <article className="realty-card nutricao-kpi">
          <p className="nutricao-muted">🔔 Críticos (zero resultado)</p>
          <strong>{criticos.length}</strong>
        </article>
        <article className="realty-card nutricao-kpi">
          <p className="nutricao-muted">✓ Configurações de meta</p>
          <strong>{metasConfig.length}</strong>
        </article>
      </div>

      <article className="realty-card">
        <h3>Metas e regras de alerta</h3>
        <p className="nutricao-muted">
          Defina limites gerais ou específicos por fluxo. Abaixo da meta, o sistema gera alerta e
          notificação automática.
        </p>

        <div className="realty-form" style={{ marginTop: 12 }}>
          <label>
            Escopo
            <select value={alvo} onChange={(e) => setAlvo(e.target.value)}>
              <option value={GLOBAL}>Padrão para todos os fluxos</option>
              {fluxos.map((f) => (
                <option key={f.id} value={String(f.id)}>
                  {f.nome}
                </option>
              ))}
            </select>
          </label>

          <div className="nutricao-grid-4">
            {numField("metaAbertura", "Meta de abertura", "%")}
            {numField("metaResposta", "Meta de resposta", "%")}
            {numField("metaAgendamento", "Meta de agendamento", "%")}
            {numField("metaFechamento", "Meta de fechamento", "%")}
            {numField("janelaDias", "Janela de análise", "dias")}
            {numField("minEnvios", "Mínimo de mensagens")}
            {numField("repetirAvisoHoras", "Repetir aviso a cada", "h")}
          </div>

          <div className="nutricao-grid-2">
            {checkField(
              "alertarZeroAgendamento",
              "Alertar quando zero agendamento",
              "Aviso crítico se nada for agendado."
            )}
            {checkField(
              "alertarZeroResposta",
              "Alertar quando zero resposta",
              "Aviso crítico se ninguém responder."
            )}
            {checkField("notificarApp", "Notificar no app", "Envia para o sino de notificações.")}
            {checkField(
              "monitoramentoAtivo",
              "Monitoramento ativo",
              "Desligue para pausar os alertas."
            )}
          </div>

          <div className="realty-page__header-actions">
            <button
              type="button"
              className="realty-page__btn"
              disabled={loading}
              onClick={() => onSalvar && onSalvar(form)}
            >
              Salvar metas
            </button>
            <button
              type="button"
              className="realty-page__btn realty-page__btn--ghost"
              disabled={verificando}
              onClick={() => onVerificar && onVerificar()}
            >
              {verificando ? "Verificando…" : "Verificar agora"}
            </button>
          </div>
        </div>
      </article>

      <article className="realty-card">
        <div className="nutricao-ab-etapa__head">
          <div>
            <h3>Alertas gerados</h3>
            <p className="nutricao-muted">Fluxos que ficaram abaixo das metas definidas.</p>
          </div>
          <label className="nutricao-check-row" style={{ margin: 0 }}>
            <input
              type="checkbox"
              checked={mostrarResolvidos}
              onChange={(e) => setMostrarResolvidos(e.target.checked)}
            />
            <span>Mostrar resolvidos</span>
          </label>
        </div>

        {alertasVisiveis.length === 0 && (
          <div className="realty-empty" style={{ padding: 16 }}>
            Nenhum alerta {mostrarResolvidos ? "registrado" : "em aberto"}.
          </div>
        )}

        <div className="nutricao-stack">
          {alertasVisiveis.map((a) => (
            <div key={a.id} className="nutricao-alerta">
              <div>
                <div className="nutricao-chips">
                  <span className="realty-chip">
                    {a.severidade === "critico" ? "Crítico" : "Abaixo da meta"}
                  </span>
                  {a.tipo && <span className="realty-chip">{a.tipo}</span>}
                  {a.resolvido && <span className="realty-chip">Resolvido</span>}
                </div>
                <p>{a.mensagem}</p>
                <p className="nutricao-muted">
                  {a.createdAt ? new Date(a.createdAt).toLocaleString("pt-BR") : ""}
                </p>
              </div>
              {!a.resolvido && (
                <button
                  type="button"
                  className="realty-page__btn realty-page__btn--ghost"
                  onClick={() => onResolver && onResolver(a.id)}
                >
                  Marcar resolvido
                </button>
              )}
            </div>
          ))}
        </div>
      </article>
    </div>
  );
}
