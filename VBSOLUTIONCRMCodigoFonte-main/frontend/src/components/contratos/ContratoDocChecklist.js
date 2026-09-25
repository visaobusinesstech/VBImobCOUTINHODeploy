/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 *
 * Checklist de documentação do contrato (paridade Lovable, campos camelCase).
 */

import React, { useMemo } from "react";
import { AlertCircle, CheckCircle2, ClipboardList, FileText } from "lucide-react";

const CHECKLIST_LOCACAO = [
  { key: "contrato_anexo", label: "Contrato assinado (PDF)", fields: ["contratoAnexoUrl"], type: "file", required: true },
  { key: "vistoria_entrada", label: "Vistoria de entrada", fields: ["vistoriaEntrada"], type: "bool", required: true },
  { key: "vistoria_anexo", label: "Laudo de vistoria (anexo)", fields: ["vistoriaAnexoUrl"], type: "file", required: true },
  { key: "apolice_seguro", label: "Apólice de seguro", fields: ["apoliceSeguro"], type: "bool", required: true },
  { key: "apolice_anexo", label: "Apólice (anexo PDF)", fields: ["apoliceAnexoUrl"], type: "file", required: true },
  { key: "seguro_incendio", label: "Seguro incêndio (anexo)", fields: ["seguroIncendioAnexoUrl"], type: "file", required: true },
  { key: "inquilino_cpf", label: "CPF do inquilino", fields: ["inquilinoCpf"], type: "data", required: true },
  { key: "inquilino_telefone", label: "Telefone do inquilino", fields: ["inquilinoTelefone"], type: "data", required: true },
  { key: "proprietario_cpf", label: "CPF do proprietário", fields: ["proprietarioCpf"], type: "data", required: true },
  { key: "proprietario_telefone", label: "Telefone do proprietário", fields: ["proprietarioTelefone"], type: "data", required: true },
  { key: "matricula", label: "Matrícula do imóvel", fields: ["matricula"], type: "data", required: true },
  { key: "inscricao_iptu", label: "Inscrição IPTU", fields: ["inscricaoIptu"], type: "data", required: false },
  { key: "numero_agua", label: "Número conta de água", fields: ["numeroAgua"], type: "data", required: false },
  { key: "numero_luz", label: "Número conta de luz", fields: ["numeroLuz"], type: "data", required: false },
  { key: "seguro_fianca", label: "Seguro fiança (anexo)", fields: ["seguroFiancaAnexoUrl"], type: "file", required: false },
  { key: "caucao_comprovante", label: "Comprovante de caução", fields: ["caucaoComprovanteUrl"], type: "file", required: false },
  { key: "aditivo", label: "Aditivo contratual", fields: ["aditivoAnexoUrl"], type: "file", required: false },
  { key: "vistoria_video", label: "Vistoria em vídeo", fields: ["vistoriaVideo"], type: "bool", required: false },
  { key: "vistoria_video_url", label: "Vídeo de vistoria (anexo)", fields: ["vistoriaVideoUrl"], type: "file", required: false },
];

const CHECKLIST_VENDA = [
  { key: "contrato_anexo", label: "Contrato de venda (PDF)", fields: ["contratoAnexoUrl"], type: "file", required: true },
  { key: "cliente_cpf", label: "CPF do comprador", fields: ["clienteCpf"], type: "data", required: true },
  { key: "cliente_telefone", label: "Telefone do comprador", fields: ["clienteTelefone"], type: "data", required: true },
  { key: "cliente_email", label: "E-mail do comprador", fields: ["clienteEmail"], type: "data", required: true },
  { key: "proprietario_cpf", label: "CPF do proprietário", fields: ["proprietarioCpf"], type: "data", required: true },
  { key: "proprietario_telefone", label: "Telefone do proprietário", fields: ["proprietarioTelefone"], type: "data", required: true },
  { key: "matricula", label: "Matrícula do imóvel", fields: ["matricula"], type: "data", required: true },
  { key: "inscricao_iptu", label: "Inscrição IPTU", fields: ["inscricaoIptu"], type: "data", required: false },
  { key: "comissao", label: "Comissão definida", fields: ["comissaoPercentual", "comissaoValor"], type: "data", required: true },
  { key: "aditivo", label: "Aditivo contratual", fields: ["aditivoAnexoUrl"], type: "file", required: false },
];

const CHECKLIST_ADMINISTRACAO = [
  { key: "contrato_anexo", label: "Contrato de administração (PDF)", fields: ["contratoAnexoUrl"], type: "file", required: true },
  { key: "proprietario_cpf", label: "CPF do proprietário", fields: ["proprietarioCpf"], type: "data", required: true },
  { key: "proprietario_telefone", label: "Telefone do proprietário", fields: ["proprietarioTelefone"], type: "data", required: true },
  { key: "matricula", label: "Matrícula do imóvel", fields: ["matricula"], type: "data", required: true },
  { key: "inscricao_iptu", label: "Inscrição IPTU", fields: ["inscricaoIptu"], type: "data", required: false },
  { key: "numero_agua", label: "Número conta de água", fields: ["numeroAgua"], type: "data", required: false },
  { key: "numero_luz", label: "Número conta de luz", fields: ["numeroLuz"], type: "data", required: false },
  { key: "apolice_seguro", label: "Apólice de seguro", fields: ["apoliceSeguro"], type: "bool", required: false },
  { key: "apolice_anexo", label: "Apólice (anexo PDF)", fields: ["apoliceAnexoUrl"], type: "file", required: false },
  { key: "comissao", label: "Comissão definida", fields: ["comissaoPercentual", "comissaoValor"], type: "data", required: true },
];

function getChecklistForType(tipo) {
  switch (tipo) {
    case "Locação":
      return CHECKLIST_LOCACAO;
    case "Venda":
    case "Exclusividade":
      return CHECKLIST_VENDA;
    case "Administração":
      return CHECKLIST_ADMINISTRACAO;
    default:
      return CHECKLIST_VENDA;
  }
}

function isItemDone(item, form) {
  return item.fields.some((field) => {
    const val = form?.[field];
    if (item.type === "bool") return val === true;
    if (item.type === "file") return typeof val === "string" && val.length > 5;
    if (typeof val === "number") return val > 0;
    return typeof val === "string" && val.trim().length > 0;
  });
}

/**
 * @param {{ tipo: string, form: Record<string, any> }} props
 */
const ContratoDocChecklist = ({ tipo, form }) => {
  const checklist = useMemo(() => getChecklistForType(tipo), [tipo]);

  const results = useMemo(
    () => checklist.map((item) => ({ ...item, done: isItemDone(item, form || {}) })),
    [checklist, form]
  );

  const requiredItems = results.filter((r) => r.required);
  const optionalItems = results.filter((r) => !r.required);
  const doneCount = results.filter((r) => r.done).length;
  const requiredDoneCount = requiredItems.filter((r) => r.done).length;
  const requiredMissing = requiredItems.filter((r) => !r.done);
  const progress = results.length > 0 ? Math.round((doneCount / results.length) * 100) : 0;
  const allRequiredDone = requiredMissing.length === 0;

  return (
    <div className="realty-contrato-checklist">
      <div className="realty-contrato-checklist__head">
        <div className="realty-contrato-checklist__title">
          <ClipboardList size={16} />
          <span>Checklist de Documentação</span>
          <span className="realty-contrato-checklist__badge">{tipo}</span>
        </div>
        <div>
          {allRequiredDone ? (
            <span className="realty-contrato-checklist__status realty-contrato-checklist__status--ok">
              <CheckCircle2 size={12} /> Completo
            </span>
          ) : (
            <span className="realty-contrato-checklist__status realty-contrato-checklist__status--warn">
              <AlertCircle size={12} /> {requiredMissing.length} pendente
              {requiredMissing.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      <div className="realty-contrato-checklist__progress">
        <div className="realty-contrato-checklist__progress-meta">
          <span>Progresso geral</span>
          <span>
            {doneCount}/{results.length} ({progress}%)
          </span>
        </div>
        <div className="realty-contrato-checklist__bar">
          <div className="realty-contrato-checklist__bar-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {requiredMissing.length > 0 && (
        <div className="realty-contrato-checklist__alert">
          <p>
            <AlertCircle size={14} /> Documentos obrigatórios pendentes
          </p>
          <ul>
            {requiredMissing.map((item) => (
              <li key={item.key}>{item.label}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="realty-contrato-checklist__group">
        <p className="realty-contrato-checklist__group-title">
          Obrigatórios ({requiredDoneCount}/{requiredItems.length})
        </p>
        <div className="realty-contrato-checklist__grid">
          {requiredItems.map((item) => (
            <div
              key={item.key}
              className={`realty-contrato-checklist__item${
                item.done ? " realty-contrato-checklist__item--done" : " realty-contrato-checklist__item--miss"
              }`}
            >
              {item.done ? <CheckCircle2 size={14} /> : <FileText size={14} />}
              <span className={item.done ? "is-done" : ""}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {optionalItems.length > 0 && (
        <div className="realty-contrato-checklist__group">
          <p className="realty-contrato-checklist__group-title">
            Opcionais ({optionalItems.filter((i) => i.done).length}/{optionalItems.length})
          </p>
          <div className="realty-contrato-checklist__grid">
            {optionalItems.map((item) => (
              <div
                key={item.key}
                className={`realty-contrato-checklist__item${
                  item.done ? " realty-contrato-checklist__item--done" : ""
                }`}
              >
                {item.done ? <CheckCircle2 size={14} /> : <FileText size={14} />}
                <span className={item.done ? "is-done" : ""}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ContratoDocChecklist;
