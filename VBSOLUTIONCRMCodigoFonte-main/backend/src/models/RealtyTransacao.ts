/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * Transações financeiras do CRM imobiliário (paridade Lovable transacoes).
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

@Table({ tableName: "realty_transacoes" })
class RealtyTransacao extends Model<RealtyTransacao> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @Default("")
  @Column
  descricao: string;

  @Default("entrada")
  @Column
  tipo: string;

  @Default("outros")
  @Column
  categoria: string;

  @Default(0)
  @Column(DataType.DECIMAL(14, 2))
  valor: number;

  @Column(DataType.DATEONLY)
  data: string;

  @Default("pendente")
  @Column
  status: string;

  @AllowNull(true)
  @Column
  imovelId: number;

  @AllowNull(true)
  @Column
  contratoId: number;

  @AllowNull(true)
  @Column
  corretorId: number;

  @AllowNull(true)
  @Column(DataType.TEXT)
  observacoes: string;

  @AllowNull(true)
  @Column
  canalOrigem: string;

  @AllowNull(true)
  @Column
  recorrencia: string;

  @AllowNull(true)
  @Column
  corretorNome: string;

  @AllowNull(true)
  @Column
  parceiroNome: string;

  @AllowNull(true)
  @Column
  captadorNome: string;

  @AllowNull(true)
  @Column(DataType.DECIMAL(8, 2))
  comissaoPercentual: number;

  @AllowNull(true)
  @Column(DataType.DECIMAL(14, 2))
  comissaoValor: number;

  @AllowNull(true)
  @Column(DataType.DATEONLY)
  dataRecebimento: string;

  @AllowNull(true)
  @Column
  numeroUnidade: string;

  @AllowNull(true)
  @Column
  proprietarioNome: string;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default RealtyTransacao;
