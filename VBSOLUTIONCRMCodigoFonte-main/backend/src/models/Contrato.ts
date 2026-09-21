/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
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
import Imovel from "./Imovel";
import Proprietario from "./Proprietario";
import LeadSale from "./LeadSale";

@Table({ tableName: "realty_contratos" })
class Contrato extends Model<Contrato> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column
  title: string;

  @Column
  status: string;

  @Column(DataType.DECIMAL(14, 2))
  value: number;

  @Column
  startDate: Date;

  @Column
  endDate: Date;

  @Column(DataType.TEXT)
  notes: string;

  @ForeignKey(() => Imovel)
  @Column({ allowNull: true })
  imovelId: number;

  @BelongsTo(() => Imovel)
  imovel: Imovel;

  @ForeignKey(() => Proprietario)
  @Column({ allowNull: true })
  proprietarioId: number;

  @BelongsTo(() => Proprietario)
  proprietario: Proprietario;

  @ForeignKey(() => LeadSale)
  @Column({ allowNull: true })
  leadSaleId: number;

  @BelongsTo(() => LeadSale)
  leadSale: LeadSale;

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

export default Contrato;
