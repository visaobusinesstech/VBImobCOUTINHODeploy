/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 */

import { Request, Response } from "express";
import { getIO } from "../libs/socket";
import ListService from "../services/LeadSalesServices/ListService";
import CreateService from "../services/LeadSalesServices/CreateService";
import UpdateService from "../services/LeadSalesServices/UpdateService";
import ShowService from "../services/LeadSalesServices/ShowService";
import DeleteService from "../services/LeadSalesServices/DeleteService";
import DashboardService from "../services/LeadSalesServices/DashboardService";
import LeadSale from "../models/LeadSale";
import ResolveTicketForLeadPreviewService from "../services/TicketServices/ResolveTicketForLeadPreviewService";

type IndexQuery = {
  searchParam?: string;
  pageNumber?: string;
  pageSize?: string;
  status?: string;
  pipelineId?: string;
  responsibleId?: string;
  contactId?: string;
  dateStart?: string;
  dateEnd?: string;
  followUpDue?: string;
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { searchParam, pageNumber, status, pipelineId, responsibleId, contactId, dateStart, dateEnd, pageSize, followUpDue } =
    req.query as IndexQuery;

  const { leads, count, hasMore } = await ListService({
    searchParam,
    pageNumber,
    status,
    pipelineId,
    responsibleId,
    contactId,
    dateStart,
    dateEnd,
    pageSize,
    followUpDue,
    companyId
  });

  return res.json({ leads, count, hasMore });
};

export const dashboard = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { status, pipelineId, responsibleId, contactId, dateStart, dateEnd } = req.query as IndexQuery;

  const data = await DashboardService({
    status,
    pipelineId,
    responsibleId,
    contactId,
    dateStart,
    dateEnd,
    companyId
  });

  return res.json(data);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const {
    name,
    description,
    status,
    value,
    pipelineId,
    contactId,
    responsibleId,
    date,
    dateEnd,
    companyName,
    phone,
    email,
    tags,
    site,
    origin,
    document,
    birthDate,
    address,
    imovelId,
    proprietarioId,
    interestCity,
    interestNeighborhood,
    interestType,
    bedrooms,
    followUpAt,
    ticketId
  } = req.body;

  const record = await CreateService({
    name,
    description,
    status,
    value,
    pipelineId,
    companyName,
    phone,
    email,
    tags,
    site,
    origin,
    document,
    birthDate,
    address,
    contactId,
    responsibleId,
    date,
    dateEnd,
    imovelId,
    proprietarioId,
    interestCity,
    interestNeighborhood,
    interestType,
    bedrooms,
    followUpAt,
    ticketId,
    companyId
  });

  const io = getIO();
  const full = await ShowService(record.id);
  io.of(String(companyId)).emit(`company-${companyId}-leads-sales`, {
    action: "create",
    lead: full
  });

  return res.status(201).json(record);
};

export const update = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { id } = req.params;
  const {
    name,
    description,
    status,
    value,
    pipelineId,
    contactId,
    responsibleId,
    date,
    dateEnd,
    companyName,
    phone,
    email,
    tags,
    site,
    origin,
    document,
    birthDate,
    address,
    imovelId,
    proprietarioId,
    interestCity,
    interestNeighborhood,
    interestType,
    bedrooms,
    followUpAt,
    ticketId
  } = req.body;

  const record = await UpdateService({
    id,
    name,
    description,
    status,
    value,
    pipelineId,
    companyName,
    phone,
    email,
    tags,
    site,
    origin,
    document,
    birthDate,
    address,
    contactId,
    responsibleId,
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
  });

  const io = getIO();
  const full = await ShowService(record.id);
  io.of(String(companyId)).emit(`company-${companyId}-leads-sales`, {
    action: "update",
    lead: full
  });

  return res.json(record);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { id } = req.params;

  const record = await ShowService(id);

  return res.json(record);
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { id } = req.params;

  await DeleteService(id);

  const io = getIO();
  io.of(String(companyId)).emit(`company-${companyId}-leads-sales`, {
    action: "delete",
    id
  });

  return res.status(200).json({ message: "Lead sale deleted" });
};

export const linkTicket = async (req: Request, res: Response): Promise<Response> => {
  const { companyId, id: userId } = req.user;
  const { id } = req.params;
  const lead = await LeadSale.findOne({ where: { id, companyId } });
  if (!lead) return res.status(404).json({ error: "Lead not found" });

  const ticket = await ResolveTicketForLeadPreviewService({
    companyId,
    contactId: lead.contactId,
    phone: lead.phone,
    requestUserId: +userId
  });

  if (ticket?.id) {
    await lead.update({ ticketId: ticket.id });
  }

  return res.json({
    ticket: ticket
      ? { id: ticket.id, uuid: ticket.uuid, status: ticket.status }
      : null,
    lead,
    stage: lead.status
  });
};
