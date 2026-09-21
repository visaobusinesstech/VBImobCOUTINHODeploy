/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 */

import React from "react";
import RealtyCrudPage from "../../components/RealtyCrudPage";
import realtyService from "../../services/realtyService";
import { formatBRL, IMOVEL_STATUSES } from "../../helpers/realtyCrm";

const listCaptacao = async (params) => {
  const data = await realtyService.listImoveis({ ...params, status: "captacao", pageSize: 100 });
  return data;
};

const createCaptacao = (payload) =>
  realtyService.createImovel({ ...payload, status: payload.status || "captacao" });

const Captacao = () => (
  <RealtyCrudPage
    title="Captação"
    subtitle="Imóveis em captação — mesma base do inventário imobiliário."
    listKey="imoveis"
    loader={listCaptacao}
    creator={createCaptacao}
    updater={realtyService.updateImovel}
    remover={realtyService.deleteImovel}
    cardTitle={(item) => item.title}
    cardMeta={(item) => (
      <>
        <span className="realty-chip">{item.status || "captacao"}</span>
        <span>
          {item.city || "—"} · {formatBRL(item.price)}
        </span>
      </>
    )}
    fields={[
      { name: "title", label: "Título", required: true },
      { name: "type", label: "Tipo", defaultValue: "apartamento" },
      {
        name: "status",
        label: "Status",
        type: "select",
        defaultValue: "captacao",
        options: IMOVEL_STATUSES.map((s) => ({ value: s, label: s })),
      },
      { name: "price", label: "Preço", type: "number", cast: "number" },
      { name: "city", label: "Cidade" },
      { name: "neighborhood", label: "Bairro" },
      { name: "description", label: "Descrição", type: "textarea" },
    ]}
  />
);

export default Captacao;
