/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 */

import React, { useEffect, useState } from "react";
import MainContainer from "../../components/MainContainer";
import realtyIntelService from "../../services/realtyIntelService";
import realtyService from "../../services/realtyService";
import toastError from "../../errors/toastError";
import { toast } from "react-toastify";

const ConteudoSEO = () => {
  const [imoveis, setImoveis] = useState([]);
  const [imovelId, setImovelId] = useState("");
  const [draft, setDraft] = useState(null);
  const [salvos, setSalvos] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const [im, seo] = await Promise.all([
          realtyService.listImoveis({ pageSize: 100 }),
          realtyIntelService.listSeo(),
        ]);
        setImoveis(im.imoveis || []);
        setSalvos(seo.conteudos || []);
      } catch (err) {
        toastError(err);
      }
    })();
  }, []);

  const gerar = async () => {
    try {
      const data = await realtyIntelService.gerarSeo({ imovelId: imovelId || undefined });
      setDraft(data);
    } catch (err) {
      toastError(err);
    }
  };

  const salvar = async () => {
    if (!draft) return;
    try {
      await realtyIntelService.salvarSeo({ ...draft, imovelId: imovelId || null });
      toast.success("Conteúdo SEO gravado no PostgreSQL");
      const seo = await realtyIntelService.listSeo();
      setSalvos(seo.conteudos || []);
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <MainContainer autoHeight>
      <div className="realty-page">
        <div className="realty-page__header">
          <div>
            <h1 className="realty-page__title">Conteúdo SEO</h1>
            <p className="realty-page__subtitle">
              Gera título, meta e texto a partir do imóvel no Postgres e aplica checklist on-page.
            </p>
          </div>
        </div>
        <div className="realty-page__toolbar">
          <select className="realty-page__search" value={imovelId} onChange={(e) => setImovelId(e.target.value)}>
            <option value="">Imóvel (opcional)</option>
            {imoveis.map((i) => (
              <option key={i.id} value={i.id}>
                {i.title}
              </option>
            ))}
          </select>
          <button type="button" className="realty-page__btn" onClick={gerar}>
            Gerar
          </button>
          {draft && (
            <button type="button" className="realty-page__btn realty-page__btn--ghost" onClick={salvar}>
              Salvar
            </button>
          )}
        </div>
        {draft && (
          <div className="realty-card">
            <span className="realty-chip">score {draft.score}</span>
            <h3>{draft.titulo}</h3>
            <p>{draft.meta}</p>
            <pre style={{ whiteSpace: "pre-wrap", fontSize: 13 }}>{draft.corpo}</pre>
          </div>
        )}
        <div className="realty-page__grid" style={{ marginTop: 16 }}>
          {salvos.map((c) => (
            <article key={c.id} className="realty-card">
              <h3>{c.titulo}</h3>
              <span className="realty-chip">SEO {c.score}</span>
              <p>{c.slug}</p>
            </article>
          ))}
        </div>
      </div>
    </MainContainer>
  );
};

export default ConteudoSEO;
