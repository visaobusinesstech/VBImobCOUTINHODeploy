/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * Templates de mensagens — paridade Lovable TemplatesDialog.
 */

import React, { useEffect, useState } from "react";
import { Loader2, RotateCcw, Save, Sparkles, X } from "lucide-react";
import { toast } from "react-toastify";
import realtyService from "../../services/realtyService";
import toastError from "../../errors/toastError";
import { TEMPLATE_TIPOS, getDefaultTemplate } from "../../helpers/relacionamentoCrm";

const TemplatesDialog = ({ open, onOpenChange, templates, onSaved }) => {
  const [editValues, setEditValues] = useState({});
  const [saving, setSaving] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [generating, setGenerating] = useState(null);
  const [aiOptions, setAiOptions] = useState({});
  const [promptInput, setPromptInput] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const vals = {};
    TEMPLATE_TIPOS.forEach((t) => {
      const found = (templates || []).find((x) => x.tipo === t.value);
      vals[t.value] = found?.mensagem || getDefaultTemplate(t.value);
    });
    setEditValues(vals);
    setAiOptions({});
    setPromptInput({});
    setExpanded(null);
    setLoading(false);
  }, [open, templates]);

  if (!open) return null;

  const handleSave = async (tipo) => {
    setSaving(tipo);
    try {
      await realtyService.upsertRelacionamentoTemplate({
        tipo,
        mensagem: editValues[tipo] || "",
      });
      toast.success("Template salvo!");
      if (onSaved) await onSaved();
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(null);
    }
  };

  const handleReset = (tipo) => {
    setEditValues((prev) => ({ ...prev, [tipo]: getDefaultTemplate(tipo) }));
  };

  const selectOption = (tipo, msg) => {
    setEditValues((prev) => ({ ...prev, [tipo]: msg }));
  };

  const generateWithAI = async (tipo) => {
    setGenerating(tipo);
    try {
      const data = await realtyService.gerarMensagensRelacionamentoIa({
        tipo,
        contexto: promptInput[tipo] || "",
      });
      if (data?.error) {
        toast.error(data.error);
      } else if (Array.isArray(data?.mensagens) && data.mensagens.length) {
        setAiOptions((prev) => ({ ...prev, [tipo]: data.mensagens }));
        setExpanded(tipo);
        toast.success(data.source === "fallback" ? "Opções padrão carregadas" : "Mensagens geradas!");
      }
    } catch (err) {
      toastError(err);
    } finally {
      setGenerating(null);
    }
  };

  return (
    <div className="realty-modal-backdrop" role="presentation" onClick={(e) => e.stopPropagation()}>
      <div
        className="realty-modal realty-form realty-rel-modal realty-rel-modal--wide"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="realty-modal__head">
          <h3>Templates de Mensagens</h3>
          <button type="button" className="realty-modal__close" onClick={() => onOpenChange(false)} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="realty-empty">
            <Loader2 size={24} className="realty-spin" />
          </div>
        ) : (
          <div className="realty-rel-templates">
            <p className="realty-rel-templates__hint">
              Personalize as mensagens automáticas. Variáveis:{" "}
              <code>{"{nome}"}</code> <code>{"{profissao}"}</code> <code>{"{filho}"}</code>
            </p>

            {TEMPLATE_TIPOS.map((tipo) => {
              const allOptions = [...(tipo.opcoes || []), ...(aiOptions[tipo.value] || [])];
              return (
                <div key={tipo.value} className="realty-rel-template-card">
                  <div className="realty-rel-template-card__head">
                    <strong>{tipo.label}</strong>
                    <div className="realty-rel-template-card__actions">
                      <button
                        type="button"
                        className="realty-page__btn realty-page__btn--ghost"
                        onClick={() =>
                          setExpanded(expanded === tipo.value ? null : tipo.value)
                        }
                      >
                        {expanded === tipo.value ? "Fechar opções" : "Ver opções"}
                      </button>
                      <button
                        type="button"
                        className="realty-prop-icon-btn"
                        title="Restaurar padrão"
                        onClick={() => handleReset(tipo.value)}
                      >
                        <RotateCcw size={14} />
                      </button>
                      <button
                        type="button"
                        className="realty-page__btn"
                        disabled={saving === tipo.value}
                        onClick={() => handleSave(tipo.value)}
                      >
                        {saving === tipo.value ? (
                          <Loader2 size={14} className="realty-spin" />
                        ) : (
                          <Save size={14} />
                        )}
                        Salvar
                      </button>
                    </div>
                  </div>

                  <textarea
                    className="realty-textarea"
                    rows={3}
                    value={editValues[tipo.value] || ""}
                    onChange={(e) =>
                      setEditValues((prev) => ({ ...prev, [tipo.value]: e.target.value }))
                    }
                  />

                  {expanded === tipo.value ? (
                    <div className="realty-rel-template-options">
                      <div className="realty-rel-ai-row">
                        <label className="realty-prop-label" style={{ flex: 1 }}>
                          Descreva o tom ou estilo desejado (opcional)
                          <input
                            value={promptInput[tipo.value] || ""}
                            onChange={(e) =>
                              setPromptInput((prev) => ({
                                ...prev,
                                [tipo.value]: e.target.value,
                              }))
                            }
                            placeholder="Ex: tom mais formal, com foco em gratidão..."
                          />
                        </label>
                        <button
                          type="button"
                          className="realty-page__btn"
                          disabled={generating === tipo.value}
                          onClick={() => generateWithAI(tipo.value)}
                        >
                          {generating === tipo.value ? (
                            <Loader2 size={14} className="realty-spin" />
                          ) : (
                            <Sparkles size={14} />
                          )}
                          Gerar com IA
                        </button>
                      </div>
                      <p className="realty-prop-hint">Clique para usar:</p>
                      <div className="realty-rel-option-list">
                        {allOptions.map((opcao, i) => (
                          <button
                            key={i}
                            type="button"
                            className={`realty-rel-option${
                              editValues[tipo.value] === opcao
                                ? " realty-rel-option--active"
                                : ""
                            }`}
                            onClick={() => selectOption(tipo.value, opcao)}
                          >
                            {opcao}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}

        <div className="realty-modal__footer">
          <button type="button" className="realty-page__btn realty-page__btn--ghost" onClick={() => onOpenChange(false)}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

export default TemplatesDialog;
