/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * Registrar visita — campos 1:1 Lovable RegistrarVisitaDialog.
 */

import React, { useState } from "react";
import { Check } from "lucide-react";

export default function RegistrarVisitaDialog({
  open,
  onOpenChange,
  titulo,
  leadNome,
  onConfirm,
  resultadoOptions = [],
}) {
  const [resultado, setResultado] = useState("gostou");
  const [feedback, setFeedback] = useState("");

  if (!open) return null;

  const handleConfirm = () => {
    onConfirm({
      feedbackVisita: feedback,
      resultadoCliente: resultado,
    });
    setResultado("gostou");
    setFeedback("");
  };

  return (
    <div className="realty-modal-backdrop" onClick={() => onOpenChange(false)}>
      <div
        className="realty-card realty-modal realty-form agenda-form"
        onClick={(e) => e.stopPropagation()}
      >
        <h3>
          <Check size={16} /> Registrar Visita Realizada
        </h3>
        <div className="agenda-visita-summary">
          <strong>{titulo}</strong>
          {leadNome && <p>Cliente: {leadNome}</p>}
        </div>

        <fieldset className="agenda-radio-group">
          <legend>Como foi a reação do cliente?</legend>
          {resultadoOptions.map((opt) => (
            <label key={opt.id} className={resultado === opt.id ? "is-selected" : ""}>
              <input
                type="radio"
                name="resultado"
                value={opt.id}
                checked={resultado === opt.id}
                onChange={() => setResultado(opt.id)}
              />
              {opt.label}
            </label>
          ))}
        </fieldset>

        <label>
          Observações da visita
          <textarea
            rows={4}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Ex: Cliente gostou da sala, mas achou o preço alto..."
          />
        </label>

        <div className="realty-card__actions">
          <button
            type="button"
            className="realty-page__btn realty-page__btn--ghost"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </button>
          <button type="button" className="realty-page__btn" onClick={handleConfirm}>
            <Check size={14} /> Registrar
          </button>
        </div>
      </div>
    </div>
  );
}
