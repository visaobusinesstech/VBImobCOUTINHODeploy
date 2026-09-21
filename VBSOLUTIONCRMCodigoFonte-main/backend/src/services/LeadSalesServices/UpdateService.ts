/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 */

import LeadSale from "../../models/LeadSale";

interface Request {
  id: number | string;
  name?: string;
  description?: string;
  status?: string;
  value?: number;
  pipelineId?: number | null;
  companyName?: string;
  phone?: string;
  email?: string;
  site?: string;
  origin?: string;
  document?: string;
  birthDate?: string | Date | null;
  address?: any;
  tags?: string[];
  contactId?: number;
  responsibleId?: number;
  date?: string | Date | null;
  dateEnd?: string | Date | null;
  imovelId?: number | null;
  proprietarioId?: number | null;
  interestCity?: string;
  interestNeighborhood?: string;
  interestType?: string;
  bedrooms?: number | null;
  followUpAt?: string | Date | null;
  ticketId?: number | null;
}

const UpdateService = async ({
  id,
  name,
  description,
  status,
  value,
  companyName,
  phone,
  email,
  site,
  origin,
  document,
  birthDate,
  address,
  tags,
  contactId,
  responsibleId,
  pipelineId,
  date,
  dateEnd,
  imovelId,
  proprietarioId,
  interestCity,
  interestNeighborhood,
  interestType,
  bedrooms,
  followUpAt,
  ticketId
}: Request): Promise<LeadSale> => {
  const record = await LeadSale.findByPk(id as any);
  if (!record) {
    throw new Error("Lead sale not found");
  }

  const parsedValue =
    (typeof value === "string" ? Number(value) : value);
  const parsedResponsibleId =
    (responsibleId as any) === "" ? undefined : responsibleId;
  const parsedContactId =
    (contactId as any) === "" ? undefined : contactId;
  const parsedDate =
    typeof date === "string"
      ? (date.trim() ? new Date(date) : undefined)
      : date;
  const parsedDateEnd =
    typeof dateEnd === "string"
      ? (dateEnd.trim() ? new Date(dateEnd) : null)
      : dateEnd;
  const parsedBirthDate =
    typeof birthDate === "string"
      ? (birthDate.trim() ? new Date(birthDate) : null)
      : birthDate;

  await record.update({
    name: name ?? record.name,
    description: description ?? record.description,
    status: status ?? record.status,
    value: parsedValue ?? record.value,
    companyName: companyName ?? record.companyName,
    phone: phone ?? record.phone,
    email: email !== undefined ? email : (record as any).email,
    site: site ?? record.site,
    origin: origin ?? record.origin,
    document: document ?? record.document,
    birthDate: parsedBirthDate ?? record.birthDate,
    address: address ?? record.address,
    tags: tags ?? record.tags,
    contactId: parsedContactId ?? record.contactId,
    responsibleId: parsedResponsibleId ?? record.responsibleId,
    pipelineId: pipelineId !== undefined ? pipelineId : (record as any).pipelineId,
    date: parsedDate ?? record.date,
    dateEnd: parsedDateEnd !== undefined ? parsedDateEnd : (record as any).dateEnd,
    imovelId: imovelId !== undefined ? imovelId || null : (record as any).imovelId,
    proprietarioId: proprietarioId !== undefined ? proprietarioId || null : (record as any).proprietarioId,
    interestCity: interestCity !== undefined ? interestCity : (record as any).interestCity,
    interestNeighborhood:
      interestNeighborhood !== undefined ? interestNeighborhood : (record as any).interestNeighborhood,
    interestType: interestType !== undefined ? interestType : (record as any).interestType,
    bedrooms: bedrooms !== undefined ? bedrooms : (record as any).bedrooms,
    followUpAt:
      followUpAt !== undefined
        ? followUpAt
          ? new Date(followUpAt as any)
          : null
        : (record as any).followUpAt,
    ticketId: ticketId !== undefined ? ticketId || null : (record as any).ticketId
  } as any);

  return record;
};

export default UpdateService;
