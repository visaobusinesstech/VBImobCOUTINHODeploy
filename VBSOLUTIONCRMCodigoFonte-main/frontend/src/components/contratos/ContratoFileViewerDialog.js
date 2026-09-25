/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 */

import React from "react";
import { Download, ExternalLink, FileText, Loader2, X } from "lucide-react";
import {
  buildContratoOfficePreviewUrl,
  getContratoFileName,
  getContratoFilePreviewKind,
} from "../../helpers/contratoFilePreview";
import { mediaUrl } from "../../helpers/realtyCrm";

/**
 * @param {{ open: boolean, loading?: boolean, file?: { url?: string, name?: string, previewKind?: string, officePreviewUrl?: string } | null, url?: string, onClose: () => void }} props
 */
const ContratoFileViewerDialog = ({ open, loading = false, file = null, url, onClose }) => {
  if (!open) return null;

  const resolvedUrl = file?.url || (url ? mediaUrl(url) : "");
  const name = file?.name || getContratoFileName(resolvedUrl, "Visualizador de arquivo");
  const previewKind = file?.previewKind || getContratoFilePreviewKind(resolvedUrl);
  const officePreviewUrl =
    file?.officePreviewUrl ||
    (previewKind === "office" && resolvedUrl ? buildContratoOfficePreviewUrl(resolvedUrl) : "");
  const previewSource = previewKind === "office" ? officePreviewUrl : resolvedUrl;

  const handleOpenOriginal = () => {
    if (!resolvedUrl) return;
    window.open(resolvedUrl, "_blank", "noopener,noreferrer");
  };

  const handleDownload = () => {
    if (!resolvedUrl) return;
    const link = document.createElement("a");
    link.href = resolvedUrl;
    link.download = name;
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderPreview = () => {
    if (loading || !resolvedUrl) {
      return (
        <div className="realty-contrato-viewer__empty">
          <Loader2 size={18} className="realty-imovel-spin" />
          <span>Preparando visualização...</span>
        </div>
      );
    }

    if (previewKind === "image") {
      return (
        <div className="realty-contrato-viewer__media">
          <img src={resolvedUrl} alt={name} loading="lazy" />
        </div>
      );
    }

    if (previewKind === "video") {
      return (
        <div className="realty-contrato-viewer__media">
          <video src={resolvedUrl} controls />
        </div>
      );
    }

    if (previewSource && ["pdf", "text", "office"].includes(previewKind)) {
      return (
        <iframe
          title={name}
          src={previewSource}
          className="realty-contrato-viewer__iframe"
          referrerPolicy="no-referrer"
        />
      );
    }

    return (
      <div className="realty-contrato-viewer__unsupported">
        <FileText size={28} />
        <p>Pré-visualização interna indisponível</p>
        <span>Este formato pode ser aberto em nova aba ou baixado diretamente.</span>
      </div>
    );
  };

  return (
    <div className="realty-modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="realty-modal realty-contrato-viewer"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="contrato-viewer-title"
      >
        <div className="realty-contrato-viewer__head">
          <div>
            <h3 id="contrato-viewer-title">{name}</h3>
            <p>Visualização de anexos do contrato</p>
          </div>
          <div className="realty-contrato-viewer__actions">
            <button
              type="button"
              className="realty-page__btn realty-page__btn--ghost"
              onClick={handleOpenOriginal}
              disabled={!resolvedUrl}
            >
              <ExternalLink size={14} /> Abrir original
            </button>
            <button
              type="button"
              className="realty-page__btn"
              onClick={handleDownload}
              disabled={!resolvedUrl}
            >
              <Download size={14} /> Baixar
            </button>
            <button type="button" className="realty-prop-icon-btn" onClick={onClose} aria-label="Fechar">
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="realty-contrato-viewer__body">{renderPreview()}</div>
      </div>
    </div>
  );
};

export default ContratoFileViewerDialog;
