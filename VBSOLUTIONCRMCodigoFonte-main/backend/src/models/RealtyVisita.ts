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

@Table({ tableName: "realty_visitas" })
class RealtyVisita extends Model<RealtyVisita> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column
  scheduledAt: Date;

  @Column
  status: string;

  @Column
  result: string;

  @Column(DataType.TEXT)
  notes: string;

  @Column
  location: string;

  @ForeignKey(() => LeadSale)
  @Column
  leadSaleId: number;

  @BelongsTo(() => LeadSale)
  leadSale: LeadSale;

  @ForeignKey(() => Imovel)
  @Column({ allowNull: true })
  imovelId: number;

  @BelongsTo(() => Imovel)
  imovel: Imovel;

  @ForeignKey(() => User)
  @Column({ allowNull: true })
  userId: number;

  @BelongsTo(() => User)
  user: User;

  @Column({ allowNull: true })
  ticketId: number;

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

export default RealtyVisita;
