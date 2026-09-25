/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 */

import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Link2, Loader2, X } from "lucide-react";
import {
  formatCurrencyInput,
  parseCurrencyInput,
  TIPOS_IMOVEL,
  normalizeHttpUrl,
} from "../../helpers/realtyCrm";
import realtyService from "../../services/realtyService";

const defaultForm = {
  urlAnuncio: "",
  title: "",
  type: "Apartamento",
  purpose: "venda",
  price: "",
  portalOrigem: "",
};

const PORTAIS = [
  "ZAP Imóveis",
  "VivaReal",
  "OLX",
  "Imovelweb",
  "Wimoveis",
  "DF Imóveis",
  "ImovelP",
  "Aluga Mais",
  "Captei",
  "Site Próprio",
  "Outro",
];

const ImportarViaLinkDialog = ({ open, onClose, onImported }) => {
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({ ...defaultForm });
    setSaving(false);
  }, [open]);

  if (!open) return null;

  const set = (key, val) => setForm((prev) => ({ ...prev, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const url = String(form.urlAnuncio || "").trim();
    if (!url) {
      toast.error("Informe a URL do anúncio");
      return;
    }
    const title = String(form.title || "").trim() || "Imóvel importado via link";
    setSaving(true);
    try {
      const created = await realtyService.createImovel({
        title,
        type: form.type || "Apartamento",
        purpose: form.purpose || "venda",
        price: parseCurrencyInput(form.price),
        portalOrigem: form.portalOrigem.trim() || null,
        urlAnuncio: normalizeHttpUrl(url),
        status: "disponivel",
      });
      toast.success("Imóvel importado com sucesso");
      if (typeof onImported === "function") onImported(created);
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.error || err?.message || "Erro ao importar imóvel");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="realty-modal-backdrop" onClick={saving ? undefined : onClose} role="presentation">
      <div
        className="realty-modal realty-imovel-modal realty-imovel-modal--import"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="importar-link-title"
      >
        <div className="realty-imovel-header">
          <div className="realty-imovel-header__row">
            <h2 id="importar-link-title">
              <Link2 size={18} /> Importar Imóvel via Link
            </h2>
            <button
              type="button"
              className="realty-imovel-close"
              onClick={onClose}
              disabled={saving}
              aria-label="Fechar"
            >
              <X size={18} />
            </button>
          </div>
          <p className="realty-imovel-hint">
            Informe a URL do anúncio e os dados básicos para cadastrar o imóvel.
          </p>
        </div>

        <form className="realty-imovel-import-form" onSubmit={handleSubmit}>
          <label className="realty-imovel-field">
            <span className="realty-imovel-label">URL do anúncio *</span>
            <input
              className="realty-imovel-input"
              type="text"
              inputMode="url"
              required
              value={form.urlAnuncio}
              onChange={(e) => set("urlAnuncio", e.target.value)}
              placeholder="https://www.olx.com.br/..."
            />
          </label>

          <label className="realty-imovel-field">
            <span className="realty-imovel-label">Título</span>
            <input
              className="realty-imovel-input"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Ex: Apartamento 2 quartos"
            />
          </label>

          <div className="realty-imovel-row realty-imovel-row--2">
            <label className="realty-imovel-field">
              <span className="realty-imovel-label">Tipo</span>
              <select
                className="realty-imovel-input"
                value={form.type}
                onChange={(e) => set("type", e.target.value)}
              >
                {TIPOS_IMOVEL.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>

            <label className="realty-imovel-field">
              <span className="realty-imovel-label">Finalidade</span>
              <select
                className="realty-imovel-input"
                value={form.purpose}
                onChange={(e) => set("purpose", e.target.value)}
              >
                <option value="venda">Venda</option>
                <option value="aluguel">Aluguel</option>
                <option value="ambos">Venda e Aluguel</option>
              </select>
            </label>
          </div>

          <div className="realty-imovel-row realty-imovel-row--2">
            <label className="realty-imovel-field">
              <span className="realty-imovel-label">Preço (R$)</span>
              <input
                className="realty-imovel-input"
                value={form.price}
                inputMode="decimal"
                placeholder="0,00"
                onChange={(e) => set("price", e.target.value.replace(/[^\d.,]/g, ""))}
                onBlur={() => set("price", formatCurrencyInput(parseCurrencyInput(form.price)))}
              />
            </label>

            <label className="realty-imovel-field">
              <span className="realty-imovel-label">Portal de origem</span>
              <select
                className="realty-imovel-input"
                value={form.portalOrigem}
                onChange={(e) => set("portalOrigem", e.target.value)}
              >
                <option value="">Selecione...</option>
                {PORTAIS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="realty-imovel-nav">
            <button
              type="button"
              className="realty-page__btn realty-page__btn--ghost"
              onClick={onClose}
              disabled={saving}
            >
              Cancelar
            </button>
            <button type="submit" className="realty-page__btn" disabled={saving}>
              {saving ? <Loader2 size={16} className="realty-imovel-spin" /> : null}
              {saving ? "Salvando…" : "Importar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ImportarViaLinkDialog;
