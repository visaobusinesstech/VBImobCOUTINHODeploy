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
import Proprietario from "./Proprietario";

@Table({ tableName: "realty_proprietario_familiares" })
class ProprietarioFamiliar extends Model<ProprietarioFamiliar> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column
  nome: string;

  @Column(DataType.DATEONLY)
  dataNascimento: string;

  @Column
  relacao: string;

  @ForeignKey(() => Proprietario)
  @Column
  proprietarioId: number;

  @BelongsTo(() => Proprietario)
  proprietario: Proprietario;

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

export default ProprietarioFamiliar;
