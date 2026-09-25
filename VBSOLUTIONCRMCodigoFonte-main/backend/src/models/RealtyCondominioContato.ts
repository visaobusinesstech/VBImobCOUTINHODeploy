/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — paridade Lovable condominio_contatos.
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

@Table({ tableName: "realty_condominio_contatos" })
class RealtyCondominioContato extends Model<RealtyCondominioContato> {
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

  @Column
  tipo: string;

  @AllowNull(true)
  @Column
  nome: string;

  @AllowNull(true)
  @Column
  cargo: string;

  @AllowNull(true)
  @Column
  telefone: string;

  @AllowNull(true)
  @Column
  email: string;

  @Default("manual")
  @Column
  urlFonte: string;

  @AllowNull(true)
  @Column(DataType.TEXT)
  trechoFonte: string;

  @Default(50)
  @Column
  confianca: number;

  @Default("pendente")
  @Column
  status: string;

  @Default({})
  @Column(DataType.JSONB)
  metadata: object;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default RealtyCondominioContato;
