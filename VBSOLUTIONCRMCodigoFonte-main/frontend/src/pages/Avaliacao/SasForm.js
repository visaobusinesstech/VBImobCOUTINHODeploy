/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * Formulário Completo SAS — mesmos campos/opções do Lovable SasAvaliacaoForm.
 */
import React, { useEffect, useState } from "react";
import {
  CONSERVACOES,
  OPERACOES_SAS,
  POSICAO_SOLAR_SAS,
  TIPOS_SAS,
  createEmptySasState,
} from "../../helpers/avaliacaoConstants";
import {
  DESCRICAO_MAX,
  DESCRICAO_MIN,
  contarDescricao,
  truncarDescricao,
} from "../../helpers/avaliacaoDescricao";

const DRAFT_KEY = "draft_v1_sas-avaliacao-form";

const maskCEP = (v) =>
  String(v || "")
    .replace(/\D/g, "")
    .slice(0, 8)
    .replace(/^(\d{5})(\d)/, "$1-$2");
const maskUF = (v) =>
  String(v || "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 2);
const maskCRECI = (v) =>
  String(v || "")
    .toUpperCase()
    .replace(/[^0-9A-Z\-/]/g, "")
    .slice(0, 12);

function Field({ label, children, full }) {
  return (
    <label className={full ? "realty-avaliacao__field--full" : undefined}>
      {label}
      {children}
    </label>
  );
}

export default function SasForm({ onSubmit, initial }) {
  const [d, setD] = useState(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) return { ...createEmptySasState(), ...JSON.parse(raw), ...(initial || {}) };
    } catch {
      /* ignore */
    }
    return { ...createEmptySasState(), ...(initial || {}) };
  });

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
      } catch {
        /* ignore */
      }
    }, 400);
    return () => clearTimeout(t);
  }, [d]);

  const set = (k, v) => setD((p) => ({ ...p, [k]: v }));

  const num = (v) => (v === "" || Number.isNaN(Number(v)) ? 0 : Number(v));

  useEffect(() => {
    const priv = num(d.area_privativa);
    const comum = num(d.area_comum);
    if (priv || comum) {
      const util = String(Math.round((priv + comum) * 100) / 100);
      if (d.area_util !== util) set("area_util", util);
      const total = String(Math.round((priv + comum) * 100) / 100);
      if (d.area_total !== total && !d.area_total) set("area_total", total);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.area_privativa, d.area_comum]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!d.bairro.trim() || !d.cidade.trim()) {
      window.alert("Bairro e Cidade são obrigatórios no formulário SAS.");
      return;
    }
    if (!d.tipo) {
      window.alert("Tipo do imóvel é obrigatório.");
      return;
    }
    const areaOk =
      d.tipo === "Terreno"
        ? num(d.area_terreno) > 0
        : num(d.area_privativa) > 0 || num(d.area_construida) > 0;
    if (!areaOk) {
      window.alert(
        d.tipo === "Terreno"
          ? "Informe a área do terreno."
          : "Informe área privativa ou construída."
      );
      return;
    }
    const len = contarDescricao(d.descricao.trim());
    if (len < DESCRICAO_MIN || len > DESCRICAO_MAX) {
      window.alert(`Descrição deve ter entre ${DESCRICAO_MIN} e ${DESCRICAO_MAX} caracteres.`);
      return;
    }
    if (num(d.valor_taxa_extra) > 0 && String(d.taxa_extra_descricao || "").trim().length < 15) {
      window.alert("Descreva a taxa extra (mínimo 15 caracteres) quando o valor for informado.");
      return;
    }
    onSubmit?.(d);
  };

  const clearDraft = () => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
    setD(createEmptySasState());
  };

  return (
    <form className="realty-form realty-avaliacao__sas" onSubmit={handleSubmit}>
      <div className="realty-avaliacao__section-title">1. Identificação</div>
      <div className="realty-avaliacao__grid">
        <Field label="Código do imóvel">
          <input maxLength={30} value={d.codigo} onChange={(e) => set("codigo", e.target.value)} />
        </Field>
        <Field label="Proprietário">
          <input
            maxLength={120}
            value={d.proprietario}
            onChange={(e) => set("proprietario", e.target.value)}
          />
        </Field>
        <Field label="Data da avaliação">
          <input
            type="date"
            value={d.data_avaliacao}
            onChange={(e) => set("data_avaliacao", e.target.value)}
          />
        </Field>
        <Field label="Corretor responsável">
          <input
            maxLength={120}
            value={d.corretor_nome}
            onChange={(e) => set("corretor_nome", e.target.value)}
          />
        </Field>
        <Field label="CRECI">
          <input
            value={d.corretor_creci}
            onChange={(e) => set("corretor_creci", maskCRECI(e.target.value))}
            placeholder="12345-F"
          />
        </Field>
      </div>

      <div className="realty-avaliacao__section-title">2. Localização</div>
      <div className="realty-avaliacao__grid">
        <Field label="CEP">
          <input
            value={d.cep}
            onChange={(e) => set("cep", maskCEP(e.target.value))}
            placeholder="00000-000"
          />
        </Field>
        <Field label="Endereço" full>
          <input
            maxLength={160}
            value={d.endereco}
            onChange={(e) => set("endereco", e.target.value)}
          />
        </Field>
        <Field label="Número">
          <input maxLength={10} value={d.numero} onChange={(e) => set("numero", e.target.value)} />
        </Field>
        <Field label="Complemento">
          <input
            maxLength={60}
            value={d.complemento}
            onChange={(e) => set("complemento", e.target.value)}
          />
        </Field>
        <Field label="Bairro *">
          <input
            maxLength={80}
            required
            value={d.bairro}
            onChange={(e) => set("bairro", e.target.value)}
          />
        </Field>
        <Field label="Cidade *">
          <input
            maxLength={80}
            required
            value={d.cidade}
            onChange={(e) => set("cidade", e.target.value)}
          />
        </Field>
        <Field label="Estado (UF)">
          <input value={d.estado} onChange={(e) => set("estado", maskUF(e.target.value))} />
        </Field>
        <Field label="Latitude">
          <input value={d.latitude} onChange={(e) => set("latitude", e.target.value)} />
        </Field>
        <Field label="Longitude">
          <input value={d.longitude} onChange={(e) => set("longitude", e.target.value)} />
        </Field>
      </div>

      <div className="realty-avaliacao__section-title">3. Tipo</div>
      <div className="realty-avaliacao__grid">
        <Field label="Tipo *">
          <select value={d.tipo} onChange={(e) => set("tipo", e.target.value)} required>
            {TIPOS_SAS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Operação">
          <select value={d.operacao} onChange={(e) => set("operacao", e.target.value)}>
            {OPERACOES_SAS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Estado de conservação">
          <select
            value={d.estado_conservacao}
            onChange={(e) => set("estado_conservacao", e.target.value)}
          >
            {CONSERVACOES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="realty-avaliacao__section-title">4. Dimensões (m²)</div>
      <div className="realty-avaliacao__grid">
        <Field label="Área privativa">
          <input
            type="number"
            step="0.01"
            value={d.area_privativa}
            onChange={(e) => set("area_privativa", e.target.value)}
          />
        </Field>
        <Field label="Área comum">
          <input
            type="number"
            step="0.01"
            value={d.area_comum}
            onChange={(e) => set("area_comum", e.target.value)}
          />
        </Field>
        <Field label="Área útil (auto)">
          <input type="number" step="0.01" value={d.area_util} readOnly />
        </Field>
        <Field label="Área construída">
          <input
            type="number"
            step="0.01"
            value={d.area_construida}
            onChange={(e) => set("area_construida", e.target.value)}
          />
        </Field>
        <Field label="Área total">
          <input
            type="number"
            step="0.01"
            value={d.area_total}
            onChange={(e) => set("area_total", e.target.value)}
          />
        </Field>
        <Field label="Área do terreno">
          <input
            type="number"
            step="0.01"
            value={d.area_terreno}
            onChange={(e) => set("area_terreno", e.target.value)}
          />
        </Field>
      </div>

      <div className="realty-avaliacao__section-title">5. Ambientes</div>
      <div className="realty-avaliacao__grid">
        <Field label="Quartos">
          <input
            type="number"
            min={0}
            max={30}
            value={d.quartos}
            onChange={(e) => set("quartos", e.target.value)}
          />
        </Field>
        <Field label="Suítes">
          <input
            type="number"
            min={0}
            max={30}
            value={d.suites}
            onChange={(e) => set("suites", e.target.value)}
          />
        </Field>
        <Field label="Banheiros">
          <input
            type="number"
            min={0}
            max={30}
            value={d.banheiros}
            onChange={(e) => set("banheiros", e.target.value)}
          />
        </Field>
        <Field label="Lavabos">
          <input
            type="number"
            min={0}
            max={10}
            value={d.lavabos}
            onChange={(e) => set("lavabos", e.target.value)}
          />
        </Field>
        <Field label="Vagas">
          <input
            type="number"
            min={0}
            max={50}
            value={d.vagas}
            onChange={(e) => set("vagas", e.target.value)}
          />
        </Field>
        <Field label="Ano de construção">
          <input
            type="number"
            min={1900}
            max={new Date().getFullYear() + 5}
            value={d.ano_construcao}
            onChange={(e) => set("ano_construcao", e.target.value)}
          />
        </Field>
      </div>

      <div className="realty-avaliacao__section-title">6. Adicionais</div>
      <div className="realty-avaliacao__grid">
        <Field label="Andar">
          <input maxLength={6} value={d.andar} onChange={(e) => set("andar", e.target.value)} />
        </Field>
        <Field label="Posição solar">
          <select value={d.posicao_solar} onChange={(e) => set("posicao_solar", e.target.value)}>
            <option value="">Selecione</option>
            {POSICAO_SOLAR_SAS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Preço pretendido (R$)">
          <input
            type="number"
            min={0}
            value={d.preco}
            onChange={(e) => set("preco", e.target.value)}
          />
        </Field>
        <Field label="Condomínio (R$)">
          <input
            type="number"
            min={0}
            value={d.valor_condominio}
            onChange={(e) => set("valor_condominio", e.target.value)}
          />
        </Field>
        {num(d.valor_condominio) > 0 && (
          <>
            <Field label="Taxa extra (R$)">
              <input
                type="number"
                min={0}
                value={d.valor_taxa_extra}
                onChange={(e) => set("valor_taxa_extra", e.target.value)}
              />
            </Field>
            <Field label="Descrição da taxa extra" full>
              <textarea
                maxLength={400}
                rows={2}
                value={d.taxa_extra_descricao}
                onChange={(e) => set("taxa_extra_descricao", e.target.value)}
              />
            </Field>
          </>
        )}
        <Field label="IPTU mensal (R$)">
          <input
            type="number"
            min={0}
            value={d.valor_iptu}
            onChange={(e) => set("valor_iptu", e.target.value)}
          />
        </Field>
      </div>
      <div className="realty-avaliacao__checks">
        {[
          ["elevador", "Elevador"],
          ["vista_livre", "Vista livre"],
          ["vista_permanente", "Vista permanente"],
          ["mobiliado", "Mobiliado"],
          ["reformado", "Reformado"],
        ].map(([key, label]) => (
          <label key={key} className="realty-avaliacao__check">
            <input
              type="checkbox"
              checked={!!d[key]}
              onChange={(e) => set(key, e.target.checked)}
            />
            {label}
          </label>
        ))}
      </div>

      <div className="realty-avaliacao__section-title">7. Descrição completa</div>
      <Field label={`Descrição * (${contarDescricao(d.descricao)}/${DESCRICAO_MAX})`} full>
        <textarea
          rows={5}
          value={d.descricao}
          onChange={(e) => set("descricao", truncarDescricao(e.target.value))}
          placeholder="Acabamento, reformas, vista, diferenciais, posição, entorno, condomínio…"
        />
      </Field>
      <p className="realty-page__subtitle">
        Mínimo {DESCRICAO_MIN} caracteres. Ideal acima de 200 para laudo mais preciso.
      </p>

      <div className="realty-avaliacao__actions">
        <button type="button" className="realty-page__btn realty-page__btn--ghost" onClick={clearDraft}>
          Limpar rascunho
        </button>
        <button type="submit" className="realty-page__btn">
          Aplicar dados ao formulário
        </button>
      </div>
    </form>
  );
}
