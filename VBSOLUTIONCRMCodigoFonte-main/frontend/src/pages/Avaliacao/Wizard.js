/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * Wizard NBR 14.653 — mesmos campos/opções do Lovable SasWizard.
 */
import React, { useEffect, useMemo, useState } from "react";
import {
  CONSERVACOES,
  FATORES_DEFAULT,
  FATORES_LABELS,
  FINALIDADES_WIZARD,
  PADROES,
  TIPOS_WIZARD,
  createEmptyWizardState,
} from "../../helpers/avaliacaoConstants";
import { calcularResultadoWizard } from "../../helpers/avaliacaoEngine";
import { formatBRL } from "../../helpers/realtyCrm";

const DRAFT_KEY = "sas-wizard-v1";

function uid() {
  return `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function WizardNbr({ onApplyResult }) {
  const [step, setStep] = useState(1);
  const [state, setState] = useState(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) return { ...createEmptyWizardState(), ...JSON.parse(raw) };
    } catch {
      /* ignore */
    }
    return createEmptyWizardState();
  });

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(state));
      } catch {
        /* ignore */
      }
    }, 400);
    return () => clearTimeout(t);
  }, [state]);

  const setImovel = (k, v) =>
    setState((p) => ({ ...p, imovel: { ...p.imovel, [k]: v } }));

  const addComparavel = () => {
    const id = uid();
    setState((p) => ({
      ...p,
      comparaveis: [
        ...p.comparaveis,
        {
          id,
          endereco: "",
          bairro: "",
          area: "",
          valor_anunciado: "",
          valor_negociado: "",
          distancia_km: "",
          data_pesquisa: new Date().toISOString().slice(0, 10),
          link_fonte: "",
          observacoes: "",
        },
      ],
      fatores: { ...p.fatores, [id]: { ...FATORES_DEFAULT } },
    }));
  };

  const updateComparavel = (id, k, v) => {
    setState((p) => ({
      ...p,
      comparaveis: p.comparaveis.map((c) => (c.id === id ? { ...c, [k]: v } : c)),
    }));
  };

  const removeComparavel = (id) => {
    setState((p) => {
      const fatores = { ...p.fatores };
      delete fatores[id];
      return {
        ...p,
        comparaveis: p.comparaveis.filter((c) => c.id !== id),
        fatores,
      };
    });
  };

  const setFator = (id, k, v) => {
    setState((p) => ({
      ...p,
      fatores: {
        ...p.fatores,
        [id]: { ...(p.fatores[id] || FATORES_DEFAULT), [k]: Number(v) || 1 },
      },
    }));
  };

  const canStep1 =
    state.imovel.tipo &&
    state.imovel.bairro.trim() &&
    state.imovel.cidade.trim() &&
    Number(state.imovel.area_construida) > 0;

  const resultado = useMemo(() => {
    if (step < 4) return null;
    return calcularResultadoWizard(
      state.comparaveis.map((c) => ({
        ...c,
        area: Number(c.area) || 0,
        valor_anunciado: Number(c.valor_anunciado) || 0,
        valor_negociado: Number(c.valor_negociado) || 0,
      })),
      state.fatores,
      state.imovel.area_construida
    );
  }, [step, state]);

  return (
    <div className="realty-avaliacao__wizard">
      <div className="realty-avaliacao__steps">
        {[1, 2, 3, 4].map((n) => (
          <button
            key={n}
            type="button"
            className={`realty-chip ${step === n ? "realty-chip--active" : ""}`}
            onClick={() => setStep(n)}
          >
            Etapa {n}
          </button>
        ))}
      </div>

      {step === 1 && (
        <div className="realty-form">
          <div className="realty-avaliacao__grid">
            <label>
              Tipo do imóvel *
              <select value={state.imovel.tipo} onChange={(e) => setImovel("tipo", e.target.value)}>
                {TIPOS_WIZARD.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Finalidade *
              <select
                value={state.imovel.finalidade}
                onChange={(e) => setImovel("finalidade", e.target.value)}
              >
                {FINALIDADES_WIZARD.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Padrão construtivo
              <select
                value={state.imovel.padrao_construtivo}
                onChange={(e) => setImovel("padrao_construtivo", e.target.value)}
              >
                {PADROES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label>
              CEP
              <input
                value={state.imovel.cep}
                onChange={(e) => setImovel("cep", e.target.value)}
              />
            </label>
            <label className="realty-avaliacao__field--full">
              Endereço
              <input
                value={state.imovel.endereco}
                onChange={(e) => setImovel("endereco", e.target.value)}
              />
            </label>
            <label>
              Bairro *
              <input
                value={state.imovel.bairro}
                onChange={(e) => setImovel("bairro", e.target.value)}
              />
            </label>
            <label>
              Cidade *
              <input
                value={state.imovel.cidade}
                onChange={(e) => setImovel("cidade", e.target.value)}
              />
            </label>
            <label>
              UF
              <input
                maxLength={2}
                value={state.imovel.estado}
                onChange={(e) => setImovel("estado", e.target.value.toUpperCase())}
              />
            </label>
            <label>
              Latitude
              <input
                value={state.imovel.latitude}
                onChange={(e) => setImovel("latitude", e.target.value)}
              />
            </label>
            <label>
              Longitude
              <input
                value={state.imovel.longitude}
                onChange={(e) => setImovel("longitude", e.target.value)}
              />
            </label>
            <label>
              Área do terreno
              <input
                type="number"
                value={state.imovel.area_terreno}
                onChange={(e) => setImovel("area_terreno", e.target.value)}
              />
            </label>
            <label>
              Área construída *
              <input
                type="number"
                value={state.imovel.area_construida}
                onChange={(e) => setImovel("area_construida", e.target.value)}
              />
            </label>
            <label>
              Idade (anos)
              <input
                type="number"
                value={state.imovel.idade}
                onChange={(e) => setImovel("idade", e.target.value)}
              />
            </label>
            <label>
              Estado de conservação
              <select
                value={state.imovel.estado_conservacao}
                onChange={(e) => setImovel("estado_conservacao", e.target.value)}
              >
                {CONSERVACOES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Quartos
              <input
                type="number"
                value={state.imovel.quartos}
                onChange={(e) => setImovel("quartos", e.target.value)}
              />
            </label>
            <label>
              Suítes
              <input
                type="number"
                value={state.imovel.suites}
                onChange={(e) => setImovel("suites", e.target.value)}
              />
            </label>
            <label>
              Banheiros
              <input
                type="number"
                value={state.imovel.banheiros}
                onChange={(e) => setImovel("banheiros", e.target.value)}
              />
            </label>
            <label>
              Garagens
              <input
                type="number"
                value={state.imovel.garagens}
                onChange={(e) => setImovel("garagens", e.target.value)}
              />
            </label>
            <label>
              Área de lazer
              <input
                type="number"
                value={state.imovel.area_lazer}
                onChange={(e) => setImovel("area_lazer", e.target.value)}
              />
            </label>
            <label className="realty-avaliacao__field--full">
              Descrição (vista, diferenciais…)
              <textarea
                rows={3}
                value={state.imovel.caracteristicas}
                onChange={(e) => setImovel("caracteristicas", e.target.value)}
              />
            </label>
          </div>
          <div className="realty-avaliacao__actions">
            <button
              type="button"
              className="realty-page__btn"
              disabled={!canStep1}
              onClick={() => setStep(2)}
            >
              Próximo: Comparáveis
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="realty-form">
          <p className="realty-page__subtitle">Inclua pelo menos 1 comparável (ideal ≥ 3).</p>
          {state.comparaveis.map((c, idx) => (
            <div key={c.id} className="realty-card" style={{ marginBottom: 12 }}>
              <div className="realty-avaliacao__section-title">Comparável {idx + 1}</div>
              <div className="realty-avaliacao__grid">
                <label>
                  Endereço
                  <input
                    value={c.endereco}
                    onChange={(e) => updateComparavel(c.id, "endereco", e.target.value)}
                  />
                </label>
                <label>
                  Bairro
                  <input
                    value={c.bairro}
                    onChange={(e) => updateComparavel(c.id, "bairro", e.target.value)}
                  />
                </label>
                <label>
                  Área (m²) *
                  <input
                    type="number"
                    value={c.area}
                    onChange={(e) => updateComparavel(c.id, "area", e.target.value)}
                  />
                </label>
                <label>
                  Valor anunciado *
                  <input
                    type="number"
                    value={c.valor_anunciado}
                    onChange={(e) => updateComparavel(c.id, "valor_anunciado", e.target.value)}
                  />
                </label>
                <label>
                  Valor negociado
                  <input
                    type="number"
                    value={c.valor_negociado}
                    onChange={(e) => updateComparavel(c.id, "valor_negociado", e.target.value)}
                  />
                </label>
                <label>
                  Distância (km)
                  <input
                    type="number"
                    step="0.1"
                    value={c.distancia_km}
                    onChange={(e) => updateComparavel(c.id, "distancia_km", e.target.value)}
                  />
                </label>
                <label>
                  Data da pesquisa
                  <input
                    type="date"
                    value={c.data_pesquisa}
                    onChange={(e) => updateComparavel(c.id, "data_pesquisa", e.target.value)}
                  />
                </label>
                <label>
                  Link fonte
                  <input
                    value={c.link_fonte}
                    onChange={(e) => updateComparavel(c.id, "link_fonte", e.target.value)}
                  />
                </label>
                <label className="realty-avaliacao__field--full">
                  Observações
                  <input
                    value={c.observacoes}
                    onChange={(e) => updateComparavel(c.id, "observacoes", e.target.value)}
                  />
                </label>
              </div>
              <button
                type="button"
                className="realty-page__btn realty-page__btn--ghost"
                onClick={() => removeComparavel(c.id)}
              >
                Remover
              </button>
            </div>
          ))}
          <div className="realty-avaliacao__actions">
            <button type="button" className="realty-page__btn realty-page__btn--ghost" onClick={addComparavel}>
              + Comparável
            </button>
            <button type="button" className="realty-page__btn realty-page__btn--ghost" onClick={() => setStep(1)}>
              Voltar
            </button>
            <button
              type="button"
              className="realty-page__btn"
              disabled={!state.comparaveis.length}
              onClick={() => setStep(3)}
            >
              Próximo: Homogeneização
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="realty-form">
          <p className="realty-page__subtitle">
            Fatores multiplicadores (1 = neutro). Ajuste por comparável.
          </p>
          {state.comparaveis.map((c) => (
            <div key={c.id} className="realty-card" style={{ marginBottom: 12 }}>
              <strong>{c.endereco || c.bairro || c.id}</strong>
              <div className="realty-avaliacao__grid">
                {Object.keys(FATORES_LABELS).map((k) => (
                  <label key={k}>
                    {FATORES_LABELS[k]}
                    <input
                      type="number"
                      step="0.01"
                      min={0.5}
                      max={1.5}
                      value={(state.fatores[c.id] || FATORES_DEFAULT)[k]}
                      onChange={(e) => setFator(c.id, k, e.target.value)}
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}
          <div className="realty-avaliacao__actions">
            <button type="button" className="realty-page__btn realty-page__btn--ghost" onClick={() => setStep(2)}>
              Voltar
            </button>
            <button type="button" className="realty-page__btn" onClick={() => setStep(4)}>
              Calcular resultado
            </button>
          </div>
        </div>
      )}

      {step === 4 && resultado && (
        <div className="realty-card">
          <h3>Resultado NBR 14.653</h3>
          <p>
            Qualidade: <span className="realty-chip">{resultado.qualidade.nivel}</span>{" "}
            {resultado.qualidade.mensagem}
          </p>
          <p>Amostra válida: {resultado.amostraValida}</p>
          <p>m² mediana: {formatBRL(resultado.precoM2.mediana)} /m²</p>
          <p>Valor sugerido: {formatBRL(resultado.valorFinal.sugerido)}</p>
          <p>
            Faixa: {formatBRL(resultado.valorFinal.minimo)} –{" "}
            {formatBRL(resultado.valorFinal.maximo)}
          </p>
          {resultado.qualidade.alertas?.length > 0 && (
            <ul>
              {resultado.qualidade.alertas.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          )}
          <div className="realty-avaliacao__actions">
            <button type="button" className="realty-page__btn realty-page__btn--ghost" onClick={() => setStep(3)}>
              Voltar
            </button>
            <button
              type="button"
              className="realty-page__btn"
              onClick={() => onApplyResult?.(state, resultado)}
            >
              Aplicar ao formulário manual
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
