/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — paridade Lovable condominio_iniciativa_logs.
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
import RealtyCondominioIniciativa from "./RealtyCondominioIniciativa";

@Table({ tableName: "realty_condominio_iniciativa_logs" })
class RealtyCondominioIniciativaLog extends Model<RealtyCondominioIniciativaLog> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @ForeignKey(() => RealtyCondominioIniciativa)
  @Column
  iniciativaId: number;

  @BelongsTo(() => RealtyCondominioIniciativa)
  iniciativa: RealtyCondominioIniciativa;

  @Column
  tipo: string;

  @Column(DataType.TEXT)
  conteudo: string;

  @AllowNull(true)
  @Column
  autor: string;

  @Default({})
  @Column(DataType.JSONB)
  metadata: object;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default RealtyCondominioIniciativaLog;
