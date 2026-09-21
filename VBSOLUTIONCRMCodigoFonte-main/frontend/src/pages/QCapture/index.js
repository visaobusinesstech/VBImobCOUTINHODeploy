/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 */

import React, { useEffect, useState } from "react";
import MainContainer from "../../components/MainContainer";
import realtyIntelService from "../../services/realtyIntelService";
import toastError from "../../errors/toastError";

const QCapture = () => {
  const [data, setData] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        setData(await realtyIntelService.qcapture());
      } catch (err) {
        toastError(err);
      }
    })();
  }, []);

  return (
    <MainContainer autoHeight>
      <div className="realty-page">
        <div className="realty-page__header">
          <div>
            <h1 className="realty-page__title">Q-Capture</h1>
            <p className="realty-page__subtitle">
              Cruza sua carteira de imóveis com anúncios de mercado salvos no PostgreSQL.
            </p>
          </div>
        </div>
        {!data ? (
          <div className="realty-empty">Carregando análise...</div>
        ) : (
          <>
            <p className="realty-page__subtitle">
              Carteira {data.carteira} · Mercado {data.mercado}
            </p>
            <div className="realty-page__grid">
              {(data.oportunidades || []).slice(0, 24).map((op) => (
                <article key={op.imovelId} className="realty-card">
                  <h3>{op.titulo}</h3>
                  <span className="realty-chip">Q {op.qScore}</span>
                  <p>
                    {op.bairro} · desvio mercado {op.desvioMercado}%
                  </p>
                </article>
              ))}
            </div>
          </>
        )}
      </div>
    </MainContainer>
  );
};

export default QCapture;
