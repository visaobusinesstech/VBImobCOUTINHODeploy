/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * Alertas gerados pela ação "Gerar Alertas Automáticos" (paridade Lovable).
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
  AllowNull,
  DataType,
  Default
} from "sequelize-typescript";
import Company from "./Company";

@Table({ tableName: "realty_inadimplencia_alertas" })
class RealtyInadimplenciaAlerta extends Model<RealtyInadimplenciaAlerta> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @AllowNull(true)
  @Column
  contratoId: number;

  @Column
  titulo: string;

  @AllowNull(true)
  @Column(DataType.TEXT)
  description: string;

  @Default(0)
  @Column
  diasAtraso: number;

  @AllowNull(true)
  @Column
  gravidade: string;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default RealtyInadimplenciaAlerta;
