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

@Table({ tableName: "realty_propostas" })
class RealtyProposta extends Model<RealtyProposta> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column
  title: string;

  @Column
  clienteNome: string;

  @Column
  clienteTelefone: string;

  @Column
  clienteEmail: string;

  @Column(DataType.DECIMAL(14, 2))
  value: number;

  @Column
  paymentMethod: string;

  @Column(DataType.DECIMAL(14, 2))
  downPayment: number;

  @Column
  financing: boolean;

  @Column(DataType.TEXT)
  conditions: string;

  @Column
  prazoContrato: string;

  @Column
  status: string;

  @Column
  numeroProposta: number;

  @Column
  validUntil: Date;

  @Column(DataType.TEXT)
  notes: string;

  @ForeignKey(() => LeadSale)
  @Column({ allowNull: true })
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

export default RealtyProposta;
