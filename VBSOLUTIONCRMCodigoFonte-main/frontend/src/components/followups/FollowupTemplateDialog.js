/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Modal de template de mensagem para Follow-up.
 */

import React, { useEffect, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import realtyService from "../../services/realtyService";
import toastError from "../../errors/toastError";
import { toast } from "react-toastify";

const FollowupTemplateDialog = ({ open, onClose, onSaved }) => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await realtyService.listFollowupTemplates();
      setTemplates(data.templates || []);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      load();
      setTitle("");
      setMessage("");
      setEditingId(null);
    }
  }, [open]);

  if (!open) return null;

  const resetForm = () => {
    setTitle("");
    setMessage("");
    setEditingId(null);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      toast.error("Título e mensagem são obrigatórios");
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await realtyService.updateFollowupTemplate(editingId, {
          title: title.trim(),
          message: message.trim(),
          active: true,
        });
        toast.success("Template atualizado");
      } else {
        await realtyService.createFollowupTemplate({
          title: title.trim(),
          message: message.trim(),
          active: true,
        });
        toast.success("Template criado");
      }
      resetForm();
      await load();
      if (onSaved) onSaved();
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (tpl) => {
    setEditingId(tpl.id);
    setTitle(tpl.title || "");
    setMessage(tpl.message || "");
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Excluir este template?")) return;
    try {
      await realtyService.deleteFollowupTemplate(id);
      toast.success("Template excluído");
      if (editingId === id) resetForm();
      await load();
      if (onSaved) onSaved();
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <div className="realty-modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="realty-card realty-modal followup-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <h3>{editingId ? "Editar template" : "Criar template de mensagem"}</h3>
        <p className="followup-modal__hint">
          Variáveis: {"{nome}"} {"{telefone}"} — usadas ao enviar o follow-up.
        </p>

        <form className="realty-proposta-form" onSubmit={handleSave}>
          <label>
            Título *
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Retorno pós-visita"
              required
            />
          </label>
          <label>
            Mensagem *
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              placeholder="Olá {nome}, passando para acompanhar..."
              required
            />
          </label>
          <div className="realty-proposta-form__actions">
            {editingId ? (
              <button type="button" className="realty-page__btn realty-page__btn--ghost" onClick={resetForm}>
                Cancelar edição
              </button>
            ) : null}
            <button type="button" className="realty-page__btn realty-page__btn--ghost" onClick={onClose}>
              Fechar
            </button>
            <button type="submit" className="realty-page__btn" disabled={saving}>
              {saving ? <Loader2 size={16} className="spin" /> : null}
              {editingId ? "Salvar" : "Criar template"}
            </button>
          </div>
        </form>

        <div className="followup-templates-list">
          <h4>Templates salvos</h4>
          {loading ? (
            <div className="followup-empty"><Loader2 className="spin" size={20} /></div>
          ) : templates.length === 0 ? (
            <p className="followup-modal__hint">Nenhum template ainda.</p>
          ) : (
            templates.map((tpl) => (
              <article key={tpl.id} className="followup-template-card">
                <div>
                  <strong>{tpl.title}</strong>
                  <p>{tpl.message}</p>
                </div>
                <div className="followup-template-card__actions">
                  <button type="button" className="realty-page__btn realty-page__btn--ghost" onClick={() => handleEdit(tpl)}>
                    Editar
                  </button>
                  <button type="button" className="realty-page__btn realty-page__btn--ghost" onClick={() => handleDelete(tpl.id)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default FollowupTemplateDialog;
