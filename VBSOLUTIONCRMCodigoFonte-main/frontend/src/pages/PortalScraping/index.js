/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 */

import React, { useEffect, useState } from "react";
import MainContainer from "../../components/MainContainer";
import realtyIntelService from "../../services/realtyIntelService";
import toastError from "../../errors/toastError";
import { toast } from "react-toastify";
import { formatBRL } from "../../helpers/realtyCrm";

const PortalScraping = () => {
  const [cidade, setCidade] = useState("Brasília");
  const [tipo, setTipo] = useState("apartamento");
  const [operacao, setOperacao] = useState("Venda");
  const [loading, setLoading] = useState(false);
  const [resultados, setResultados] = useState([]);
  const [salvos, setSalvos] = useState([]);
  const [errors, setErrors] = useState([]);

  const loadSalvos = async () => {
    try {
      const data = await realtyIntelService.listMercado();
      setSalvos(data.imoveis || []);
    } catch (err) {
      toastError(err);
    }
  };

  useEffect(() => {
    loadSalvos();
  }, []);

  const buscar = async () => {
    setLoading(true);
    try {
      const data = await realtyIntelService.scrape({ cidade, tipo, operacao });
      setResultados(data.data || []);
      setErrors(data.errors || []);
      toast.success(`${data.total || 0} anúncios encontrados`);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  };

  const salvar = async () => {
    try {
      const data = await realtyIntelService.salvarMercado(resultados);
      toast.success(`${data.count} gravados no PostgreSQL`);
      await loadSalvos();
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <MainContainer autoHeight>
      <div className="realty-page">
        <div className="realty-page__header">
          <div>
            <h1 className="realty-page__title">Scraping de portais</h1>
            <p className="realty-page__subtitle">
              Busca pública em OLX, VivaReal, ZAP e outros. Resultados ficam no Postgres da empresa — sem Supabase.
            </p>
          </div>
        </div>
        <div className="realty-page__toolbar">
          <input className="realty-page__search" value={cidade} onChange={(e) => setCidade(e.target.value)} />
          <select className="realty-page__search" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="apartamento">Apartamento</option>
            <option value="casa">Casa</option>
            <option value="terreno">Terreno</option>
          </select>
          <select className="realty-page__search" value={operacao} onChange={(e) => setOperacao(e.target.value)}>
            <option>Venda</option>
            <option>Aluguel</option>
          </select>
          <button type="button" className="realty-page__btn" onClick={buscar} disabled={loading}>
            {loading ? "Buscando..." : "Buscar portais"}
          </button>
          {resultados.length > 0 && (
            <button type="button" className="realty-page__btn realty-page__btn--ghost" onClick={salvar}>
              Salvar no banco
            </button>
          )}
        </div>
        {errors.length > 0 && (
          <p className="realty-page__subtitle">Alguns portais bloquearam o fetch: {errors.slice(0, 3).join(" · ")}</p>
        )}
        <div className="realty-page__grid">
          {(resultados.length ? resultados : salvos).map((item, idx) => (
            <article key={item.id || `${item.url}-${idx}`} className="realty-card">
              <h3>{item.titulo}</h3>
              <p>
                {item.portal} · {formatBRL(item.preco)} · {item.cidade}
              </p>
              {item.url && (
                <a href={item.url} target="_blank" rel="noreferrer">
                  Abrir anúncio
                </a>
              )}
              {item.id && (
                <button
                  type="button"
                  className="realty-page__btn"
                  style={{ marginTop: 8 }}
                  onClick={async () => {
                    try {
                      await realtyIntelService.importarImovel(item.id);
                      toast.success("Importado para Imóveis (captação)");
                    } catch (err) {
                      toastError(err);
                    }
                  }}
                >
                  Importar para captação
                </button>
              )}
            </article>
          ))}
        </div>
      </div>
    </MainContainer>
  );
};

export default PortalScraping;
