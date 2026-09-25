/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 */

import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  DataType,
  ForeignKey,
  BelongsTo,
  Default,
  AllowNull
} from "sequelize-typescript";
import Company from "./Company";
import User from "./User";
import LeadSale from "./LeadSale";
import Contrato from "./Contrato";
import Whatsapp from "./Whatsapp";
import RealtyFollowupMessageTemplate from "./RealtyFollowupMessageTemplate";

@Table({ tableName: "realty_followups" })
class RealtyFollowup extends Model<RealtyFollowup> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column
  type: string;

  @Column
  scheduledAt: Date;

  @Column
  completedAt: Date;

  @Column
  result: string;

  @Column(DataType.TEXT)
  notes: string;

  @Column
  status: string;

  @AllowNull(true)
  @ForeignKey(() => LeadSale)
  @Column
  leadSaleId: number;

  @BelongsTo(() => LeadSale)
  leadSale: LeadSale;

  @AllowNull(true)
  @ForeignKey(() => Contrato)
  @Column
  contratoId: number;

  @BelongsTo(() => Contrato)
  contrato: Contrato;

  @ForeignKey(() => User)
  @Column({ allowNull: true })
  userId: number;

  @BelongsTo(() => User)
  user: User;

  @Column({ allowNull: true })
  ticketId: number;

  @Column(DataType.TEXT)
  messageBody: string;

  @Column
  messageMode: string;

  @ForeignKey(() => RealtyFollowupMessageTemplate)
  @Column({ allowNull: true })
  messageTemplateId: number;

  @BelongsTo(() => RealtyFollowupMessageTemplate)
  messageTemplate: RealtyFollowupMessageTemplate;

  @ForeignKey(() => Whatsapp)
  @Column({ allowNull: true })
  whatsappId: number;

  @BelongsTo(() => Whatsapp)
  whatsapp: Whatsapp;

  @Column({ allowNull: true })
  metaTemplateQuickMessageId: number;

  @Column(DataType.TEXT)
  metaTemplateVariables: string;

  @Default(false)
  @Column
  whatsappSent: boolean;

  @Column({ allowNull: true })
  whatsappSentAt: Date;

  @Default(false)
  @Column
  sendNow: boolean;

  @Default(false)
  @Column
  recurrenceEnabled: boolean;

  @Column({ allowNull: true })
  recurrenceType: string;

  @Default(1)
  @Column
  recurrenceInterval: number;

  @Column({ allowNull: true })
  recurrenceDays: string;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default RealtyFollowup;
