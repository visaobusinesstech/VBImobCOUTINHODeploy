/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * Dialog enviar mensagem — paridade Lovable SendMessageDialog.
 */

import React, { useEffect, useState } from "react";
import { Check, Copy, Mail, MessageCircle, X } from "lucide-react";
import { toast } from "react-toastify";
import {
  applyTemplateVars,
  getDefaultTemplate,
  getWhatsAppLink,
} from "../../helpers/relacionamentoCrm";

const AVAILABLE_TYPES = [
  { tipo: "aniversario", label: "Aniversário", field: "aniversario" },
  { tipo: "casamento", label: "Casamento", field: "dataCasamento" },
  { tipo: "profissao", label: "Profissão", field: "profissao" },
  { tipo: "mudanca", label: "Mudança", field: "dataMudanca" },
  { tipo: "compra_imovel", label: "Compra", field: "dataCompraImovel" },
  { tipo: "reativacao", label: "Reativação", field: null },
];

const SendMessageDialog = ({ open, onOpenChange, cliente, preSelectTipo, getTemplate }) => {
  const [selectedTipo, setSelectedTipo] = useState(null);
  const [selectedFilho, setSelectedFilho] = useState(null);
  const [mensagem, setMensagem] = useState("");
  const [copied, setCopied] = useState(false);

  const resolveTemplate = (tipo) => {
    if (typeof getTemplate === "function") {
      const t = getTemplate(tipo);
      if (t) return t;
    }
    return getDefaultTemplate(tipo);
  };

  const handleSelectTipo = (tipo, filhoNome) => {
    if (!cliente) return;
    setSelectedTipo(tipo);
    setSelectedFilho(filhoNome || null);
    const primeiroNome = String(cliente.nome || "").split(" ")[0] || "";
    const vars = { nome: primeiroNome };
    if (cliente.profissao) vars.profissao = cliente.profissao;
    if (filhoNome) vars.filho = filhoNome;
    setMensagem(applyTemplateVars(resolveTemplate(tipo), vars));
  };

  useEffect(() => {
    if (open && cliente && preSelectTipo) {
      handleSelectTipo(preSelectTipo);
    }
    if (!open) {
      setSelectedTipo(null);
      setSelectedFilho(null);
      setMensagem("");
      setCopied(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, preSelectTipo, cliente?.id]);

  if (!open || !cliente) return null;

  const filhos = Array.isArray(cliente.filhos) ? cliente.filhos : [];

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(mensagem);
      setCopied(true);
      toast.success("Mensagem copiada!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const isAvailable = (t) => {
    if (!t.field) return true;
    return !!cliente[t.field];
  };

  return (
    <div className="realty-modal-backdrop" role="presentation" onClick={(e) => e.stopPropagation()}>
      <div
        className="realty-modal realty-form realty-rel-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="realty-modal__head">
          <h3>Enviar mensagem para {cliente.nome}</h3>
          <button type="button" className="realty-modal__close" onClick={() => onOpenChange(false)} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <div className="realty-rel-send">
          <p className="realty-prop-label">Escolha o tipo de mensagem:</p>
          <div className="realty-rel-badges">
            {AVAILABLE_TYPES.map((t) => {
              const available = isAvailable(t);
              const active = selectedTipo === t.tipo && !selectedFilho;
              return (
                <button
                  key={t.tipo}
                  type="button"
                  disabled={!available}
                  className={`realty-rel-badge${active ? " realty-rel-badge--active" : ""}${
                    !available ? " realty-rel-badge--disabled" : ""
                  }`}
                  onClick={() => available && handleSelectTipo(t.tipo)}
                >
                  {t.label}
                </button>
              );
            })}
            {filhos.map((f, idx) => (
              <button
                key={`${f.nome || "filho"}-${idx}`}
                type="button"
                className={`realty-rel-badge${
                  selectedFilho === f.nome ? " realty-rel-badge--active" : ""
                }`}
                onClick={() => handleSelectTipo("filho_aniversario", f.nome)}
              >
                {f.nome || `Filho ${idx + 1}`}
              </button>
            ))}
          </div>

          {selectedTipo ? (
            <label className="realty-rel-form__field">
              <span>Mensagem (edite se quiser):</span>
              <textarea
                className="realty-textarea"
                rows={4}
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
              />
            </label>
          ) : null}
        </div>

        <div className="realty-modal__footer">
          <button type="button" className="realty-page__btn realty-page__btn--ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </button>
          {selectedTipo ? (
            <>
              <button type="button" className="realty-page__btn realty-page__btn--ghost" onClick={handleCopy}>
                {copied ? <Check size={14} /> : <Copy size={14} />}
                Copiar
              </button>
              {cliente.telefone ? (
                <a
                  className="realty-page__btn"
                  href={getWhatsAppLink(cliente.telefone, mensagem)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircle size={14} />
                  WhatsApp
                </a>
              ) : null}
              {cliente.email ? (
                <a
                  className="realty-page__btn realty-page__btn--ghost"
                  href={`mailto:${cliente.email}?subject=Mensagem&body=${encodeURIComponent(mensagem)}`}
                >
                  <Mail size={14} />
                  E-mail
                </a>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default SendMessageDialog;
