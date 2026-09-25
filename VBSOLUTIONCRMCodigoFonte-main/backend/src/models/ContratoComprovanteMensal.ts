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
  ForeignKey,
  BelongsTo,
  Default
} from "sequelize-typescript";
import Company from "./Company";
import Contrato from "./Contrato";

@Table({ tableName: "realty_contrato_comprovantes_mensais" })
class ContratoComprovanteMensal extends Model<ContratoComprovanteMensal> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @ForeignKey(() => Contrato)
  @Column
  contratoId: number;

  @BelongsTo(() => Contrato)
  contrato: Contrato;

  @Column
  ano: number;

  @Column
  mes: number;

  @Column
  tipo: string;

  @Column
  fileUrl: string;

  @Column
  fileName: string;

  @Default(false)
  @Column
  recebido: boolean;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default ContratoComprovanteMensal;
