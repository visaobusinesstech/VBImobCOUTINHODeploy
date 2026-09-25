/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — paridade Lovable condominio_iniciativas.
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

@Table({ tableName: "realty_condominio_iniciativas" })
class RealtyCondominioIniciativa extends Model<RealtyCondominioIniciativa> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @Column
  condominioNome: string;

  @AllowNull(true)
  @Column
  bairro: string;

  @AllowNull(true)
  @Column
  cep: string;

  @Column
  canal: string;

  @Column
  titulo: string;

  @AllowNull(true)
  @Column(DataType.TEXT)
  descricao: string;

  @Default("planejado")
  @Column
  status: string;

  @AllowNull(true)
  @Column
  responsavel: string;

  @AllowNull(true)
  @Column
  dataAgendada: Date;

  @AllowNull(true)
  @Column
  dataConclusao: Date;

  @AllowNull(true)
  @Column(DataType.TEXT)
  resultado: string;

  @Default({})
  @Column(DataType.JSONB)
  metadata: object;

  @AllowNull(true)
  @ForeignKey(() => User)
  @Column
  createdBy: number;

  @BelongsTo(() => User)
  creator: User;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default RealtyCondominioIniciativa;
