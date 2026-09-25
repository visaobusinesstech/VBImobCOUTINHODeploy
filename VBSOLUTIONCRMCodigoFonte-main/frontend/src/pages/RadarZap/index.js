/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 */

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import MainContainer from "../../components/MainContainer";
import realtyIntelService from "../../services/realtyIntelService";
import toastError from "../../errors/toastError";
import { toast } from "react-toastify";

const RadarZap = () => {
  const [texto, setTexto] = useState("");
  const [grupos, setGrupos] = useState([]);
  const [leads, setLeads] = useState([]);
  const [mensagens, setMensagens] = useState([]);
  const [grupoNome, setGrupoNome] = useState("");

  const load = async () => {
    try {
      const [g, l, m] = await Promise.all([
        realtyIntelService.listGrupos(),
        realtyIntelService.listRadarLeads(),
        realtyIntelService.listMensagens(),
      ]);
      setGrupos(g.grupos || []);
      setLeads(l.leads || []);
      setMensagens(m.mensagens || []);
    } catch (err) {
      toastError(err);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const analisar = async () => {
    try {
      await realtyIntelService.analisar({ texto });
      toast.success("Mensagem analisada (PostgreSQL)");
      setTexto("");
      await load();
    } catch (err) {
      toastError(err);
    }
  };

  const addGrupo = async () => {
    try {
      await realtyIntelService.createGrupo({ name: grupoNome, city: "Brasília" });
      setGrupoNome("");
      await load();
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <MainContainer autoHeight>
      <div className="realty-page">
        <div className="realty-page__header">
          <div>
            <h1 className="realty-page__title">RadarZAP</h1>
            <p className="realty-page__subtitle">
              Cole mensagens de grupos, extraia leads imobiliários e grave tudo no PostgreSQL do VBSolution — sem Supabase.
            </p>
          </div>
          <div className="realty-page__header-actions">
            <Link className="realty-page__btn realty-page__btn--ghost" to="/radarzap/onboarding">
              Onboarding
            </Link>
            <Link className="realty-page__btn realty-page__btn--ghost" to="/radarzap/scoring">
              Scoring
            </Link>
            <Link className="realty-page__btn realty-page__btn--ghost" to="/radarzap/status">
              Status
            </Link>
            <Link className="realty-page__btn realty-page__btn--ghost" to="/radarzap/acessos">
              Acessos
            </Link>
            <Link className="realty-page__btn realty-page__btn--ghost" to="/radarzap-grupos">
              Grupos
            </Link>
          </div>
        </div>
        <div className="realty-card realty-form" style={{ marginBottom: 16 }}>
          <textarea
            rows={5}
            placeholder="Cole a mensagem do WhatsApp..."
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
          <button type="button" className="realty-page__btn" onClick={analisar} disabled={!texto.trim()}>
            Analisar e salvar
          </button>
        </div>
        <div className="realty-page__toolbar">
          <input
            className="realty-page__search"
            placeholder="Novo grupo"
            value={grupoNome}
            onChange={(e) => setGrupoNome(e.target.value)}
          />
          <button type="button" className="realty-page__btn realty-page__btn--ghost" onClick={addGrupo}>
            Adicionar grupo
          </button>
        </div>
        <h2 className="realty-page__subtitle">Leads extraídos ({leads.length})</h2>
        <div className="realty-page__grid">
          {leads.map((lead) => (
            <article key={lead.id} className="realty-card">
              <h3>{lead.tipoImovel || "Imóvel"} · {lead.operacao}</h3>
              <p>{lead.resumo}</p>
              <span className="realty-chip">{lead.status}</span>
              <div className="realty-card__actions">
                <button
                  type="button"
                  className="realty-page__btn"
                  onClick={async () => {
                    try {
                      await realtyIntelService.converterLead(lead.id);
                      toast.success("Convertido para Leads e Vendas");
                      await load();
                    } catch (err) {
                      toastError(err);
                    }
                  }}
                >
                  Enviar ao funil
                </button>
              </div>
            </article>
          ))}
        </div>
        <p className="realty-page__subtitle">{grupos.length} grupos · {mensagens.length} mensagens</p>
      </div>
    </MainContainer>
  );
};

export default RadarZap;
