/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * Cliente de relacionamento (paridade Lovable clientes_relacionamento).
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

@Table({ tableName: "realty_clientes_relacionamento" })
class RealtyClienteRelacionamento extends Model<RealtyClienteRelacionamento> {
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
  nome: string;

  @Column
  telefone: string;

  @Column
  email: string;

  @Column(DataType.DATEONLY)
  aniversario: string;

  @Column(DataType.DATEONLY)
  dataCasamento: string;

  @Column
  profissao: string;

  @Column(DataType.DATEONLY)
  dataProfissao: string;

  @Column(DataType.DATEONLY)
  dataMudanca: string;

  @Column(DataType.DATEONLY)
  dataCompraImovel: string;

  @Default([])
  @Column(DataType.JSONB)
  filhos: Array<{ nome: string; dataNascimento?: string; data_nascimento?: string }>;

  @Column(DataType.TEXT)
  observacoes: string;

  @Default(true)
  @Column
  ativo: boolean;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default RealtyClienteRelacionamento;
