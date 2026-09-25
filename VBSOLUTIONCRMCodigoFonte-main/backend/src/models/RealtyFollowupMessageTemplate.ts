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
  BelongsTo,
  Default
} from "sequelize-typescript";
import Company from "./Company";

@Table({ tableName: "realty_followup_templates" })
class RealtyFollowupMessageTemplate extends Model<RealtyFollowupMessageTemplate> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column
  title: string;

  @Column(DataType.TEXT)
  message: string;

  @Default(true)
  @Column
  active: boolean;

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

export default RealtyFollowupMessageTemplate;
