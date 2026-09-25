/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 *
 * Diligência do proprietário (paridade Lovable WebResearchDialog / open-owner-research).
 * Visual: design system realty VBSolution. Fontes públicas (Google / Jusbrasil / Notícias).
 */

import React, { useEffect, useState } from "react";
import { ExternalLink, Globe, Loader2, Search, X } from "lucide-react";
import {
  buildOwnerDiligenceQuery,
  buildOwnerDiligenceSources,
} from "../../helpers/proprietarioCrm";

const OwnerDiligenceDialog = () => {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("Diligência");
  const [query, setQuery] = useState("");
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handleOwnerResearch = (e) => {
      const owner = e.detail || {};
      const q = buildOwnerDiligenceQuery(owner);
      setTitle(`Diligência: ${owner.name || "Proprietário"}`);
      setQuery(q);
      setOpen(true);
      setLoading(true);
      setSources([]);
      // Pequeno delay para espelhar UX de carregamento do Lovable
      window.setTimeout(() => {
        setSources(buildOwnerDiligenceSources(q));
        setLoading(false);
      }, 350);
    };
    window.addEventListener("open-owner-research", handleOwnerResearch);
    return () => window.removeEventListener("open-owner-research", handleOwnerResearch);
  }, []);

  const refresh = () => {
    setLoading(true);
    window.setTimeout(() => {
      setSources(buildOwnerDiligenceSources(query));
      setLoading(false);
    }, 250);
  };

  if (!open) return null;

  return (
    <div className="realty-modal-backdrop" onClick={() => setOpen(false)} role="presentation">
      <div
        className="realty-modal realty-form realty-prop-form"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 560 }}
      >
        <div className="realty-prop-form__head">
          <h3>
            <Search size={18} style={{ verticalAlign: "middle", marginRight: 8 }} />
            {title}
          </h3>
          <button type="button" className="realty-prop-icon-btn" onClick={() => setOpen(false)}>
            <X size={18} />
          </button>
        </div>
        <p className="realty-prop-hint">
          Consulta pública de processos e notícias (mesma query do CRM Lovable).
        </p>
        {query ? <p className="realty-prop-muted" style={{ fontSize: 12, marginBottom: 12 }}>{query}</p> : null}

        {loading ? (
          <div className="realty-empty">
            <Loader2 size={28} className="realty-spin" />
            <p>Preparando fontes de diligência...</p>
          </div>
        ) : sources.length === 0 ? (
          <div className="realty-empty">Nenhum dado encontrado para &quot;{query}&quot;.</div>
        ) : (
          <div className="realty-prop-diligence-list">
            <div className="realty-prop-section-title" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Globe size={14} /> Fontes Encontradas
            </div>
            {sources.map((res) => (
              <a
                key={res.url}
                href={res.url}
                target="_blank"
                rel="noopener noreferrer"
                className="realty-prop-diligence-item"
              >
                <span>{res.title}</span>
                <ExternalLink size={14} />
              </a>
            ))}
          </div>
        )}

        <div className="realty-card__actions">
          <button type="button" className="realty-page__btn realty-page__btn--ghost" onClick={() => setOpen(false)}>
            Fechar
          </button>
          <button type="button" className="realty-page__btn" onClick={refresh} disabled={loading}>
            {loading ? <Loader2 size={16} className="realty-spin" /> : <Search size={16} />}
            Atualizar
          </button>
        </div>
      </div>
    </div>
  );
};

export default OwnerDiligenceDialog;
