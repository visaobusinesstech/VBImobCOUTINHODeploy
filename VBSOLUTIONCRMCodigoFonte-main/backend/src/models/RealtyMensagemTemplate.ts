/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * Template de mensagem de relacionamento (paridade Lovable mensagem_templates).
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

@Table({ tableName: "realty_mensagem_templates" })
class RealtyMensagemTemplate extends Model<RealtyMensagemTemplate> {
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
  tipo: string;

  @Column(DataType.TEXT)
  mensagem: string;

  @Default(true)
  @Column
  ativo: boolean;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default RealtyMensagemTemplate;
