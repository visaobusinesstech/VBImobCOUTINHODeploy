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
    subtitle="Imóveis em captação — inputs do pipeline legado (endereço, operação, valor estimado, corretor)."
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
          {item.city || "—"} · {item.neighborhood || ""} · {formatBRL(item.price)}
        </span>
      </>
    )}
    fields={[
      { name: "title", label: "Título / referência", required: true },
      { name: "code", label: "Código do imóvel" },
      { name: "type", label: "Tipo de imóvel", defaultValue: "apartamento" },
      {
        name: "purpose",
        label: "Operação",
        type: "select",
        defaultValue: "venda",
        options: [
          { value: "venda", label: "Venda" },
          { value: "aluguel", label: "Aluguel" },
        ],
      },
      {
        name: "status",
        label: "Status",
        type: "select",
        defaultValue: "captacao",
        options: IMOVEL_STATUSES.map((s) => ({ value: s, label: s })),
      },
      { name: "price", label: "Valor estimado (R$)", type: "number", cast: "number" },
      { name: "address", label: "Endereço" },
      { name: "neighborhood", label: "Bairro" },
      { name: "city", label: "Cidade" },
      { name: "state", label: "UF", defaultValue: "SP" },
      { name: "bedrooms", label: "Quartos", type: "number", cast: "number" },
      { name: "suites", label: "Suítes", type: "number", cast: "number" },
      { name: "parkingSpots", label: "Vagas", type: "number", cast: "number" },
      { name: "areaM2", label: "Área m²", type: "number", cast: "number" },
      { name: "proprietarioId", label: "ID Proprietário", type: "number", cast: "number" },
      { name: "userId", label: "Corretor captador (ID user)", type: "number", cast: "number" },
      { name: "description", label: "Observações / origem da captação", type: "textarea" },
    ]}
  />
);

export default Captacao;
