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
  BelongsTo
} from "sequelize-typescript";
import Company from "./Company";
import User from "./User";
import LeadSale from "./LeadSale";
import Imovel from "./Imovel";

@Table({ tableName: "realty_lead_imovel_envios" })
class RealtyLeadImovelEnvio extends Model<RealtyLeadImovelEnvio> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => LeadSale)
  @Column
  leadSaleId: number;

  @BelongsTo(() => LeadSale)
  leadSale: LeadSale;

  @ForeignKey(() => Imovel)
  @Column
  imovelId: number;

  @BelongsTo(() => Imovel)
  imovel: Imovel;

  @Column({ allowNull: true })
  ticketId: number;

  @Column
  score: number;

  @Column(DataType.TEXT)
  messageBody: string;

  @Column
  sentAt: Date;

  @ForeignKey(() => User)
  @Column({ allowNull: true })
  userId: number;

  @BelongsTo(() => User)
  user: User;

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

export default RealtyLeadImovelEnvio;
