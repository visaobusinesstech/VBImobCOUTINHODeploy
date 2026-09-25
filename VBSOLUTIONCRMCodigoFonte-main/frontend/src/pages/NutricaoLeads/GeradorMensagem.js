/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 *
 * Gerador de mensagem com variáveis, blocos e preview (estilo Lovable).
 */

import React, { useMemo, useRef, useState } from "react";
import {
  BLOCOS_MENSAGEM,
  GRUPOS_VARIAVEL,
  VARIAVEIS_NUTRICAO,
  aplicarVariaveis,
  variaveisSemValor,
} from "./nutricaoVariaveis";

export function GeradorMensagem({
  value,
  onChange,
  canal = "whatsapp",
  contexto = {},
  placeholder,
  onFocusField,
}) {
  const ref = useRef(null);
  const [preview, setPreview] = useState(false);
  const [showVars, setShowVars] = useState(false);

  const canalFiltro = String(canal || "").includes("email") ? "email" : "whatsapp";

  const inserir = (trecho) => {
    const el = ref.current;
    const start = el?.selectionStart ?? String(value || "").length;
    const end = el?.selectionEnd ?? String(value || "").length;
    const atual = String(value || "");
    const antes = atual.slice(0, start);
    const depois = atual.slice(end);
    const precisaEspaco = antes.length > 0 && !/\s$/.test(antes) && !trecho.startsWith("\n");
    const novo = `${antes}${precisaEspaco ? " " : ""}${trecho}${depois}`;
    onChange(novo);
    requestAnimationFrame(() => {
      const pos = antes.length + (precisaEspaco ? 1 : 0) + trecho.length;
      el?.focus();
      el?.setSelectionRange(pos, pos);
    });
  };

  const blocos = useMemo(
    () => BLOCOS_MENSAGEM.filter((b) => b.canal === "ambos" || b.canal === canalFiltro),
    [canalFiltro]
  );

  const grupos = useMemo(() => {
    const map = new Map();
    VARIAVEIS_NUTRICAO.forEach((v) => {
      map.set(v.grupo, [...(map.get(v.grupo) || []), v]);
    });
    return [...map.entries()];
  }, []);

  const semValor = variaveisSemValor(String(value || ""), contexto);
  const textoFinal = aplicarVariaveis(String(value || ""), contexto);

  return (
    <div className="nutricao-gerador">
      <div className="nutricao-gerador__toolbar">
        <button
          type="button"
          className="realty-page__btn realty-page__btn--ghost"
          onClick={() => setShowVars((v) => !v)}
        >
          {showVars ? "Ocultar variáveis" : "Inserir variável"}
        </button>
        <button
          type="button"
          className="realty-page__btn realty-page__btn--ghost"
          onClick={() => setPreview((v) => !v)}
        >
          {preview ? "Editar" : "Pré-visualizar"}
        </button>
      </div>

      {showVars && (
        <div className="nutricao-gerador__vars">
          {grupos.map(([grupo, vars]) => (
            <div key={grupo} className="nutricao-gerador__grupo">
              <span className="nutricao-label-xs">{GRUPOS_VARIAVEL[grupo] || grupo}</span>
              <div className="nutricao-chips">
                {vars.map((v) => (
                  <button
                    key={v.chave}
                    type="button"
                    className="realty-chip"
                    title={v.exemplo}
                    onClick={() => inserir(`{{${v.chave}}}`)}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="nutricao-gerador__grupo">
            <span className="nutricao-label-xs">Blocos rápidos</span>
            <div className="nutricao-chips">
              {blocos.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  className="realty-chip"
                  onClick={() => inserir(b.texto)}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {preview ? (
        <div className="nutricao-gerador__preview">
          <pre>{textoFinal || "(vazio)"}</pre>
          {semValor.length > 0 && (
            <p className="nutricao-muted">
              Sem valor no preview: {semValor.map((k) => `{{${k}}}`).join(", ")}
            </p>
          )}
        </div>
      ) : (
        <textarea
          ref={ref}
          rows={4}
          value={value || ""}
          placeholder={placeholder || "Escreva a mensagem…"}
          onFocus={onFocusField}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}
