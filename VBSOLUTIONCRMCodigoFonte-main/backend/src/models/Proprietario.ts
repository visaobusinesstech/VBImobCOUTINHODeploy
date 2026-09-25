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
  BelongsTo,
  HasMany,
  Default
} from "sequelize-typescript";
import Company from "./Company";
import ProprietarioFamiliar from "./ProprietarioFamiliar";

@Table({ tableName: "realty_proprietarios" })
class Proprietario extends Model<Proprietario> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column
  name: string;

  @Column
  phone: string;

  @Column
  email: string;

  @Column
  document: string;

  @Column(DataType.TEXT)
  notes: string;

  @Column
  address: string;

  @Column
  city: string;

  @Column
  state: string;

  @Column
  zipCode: string;

  @Column
  bank: string;

  @Column
  agency: string;

  @Column
  account: string;

  @Column
  pix: string;

  @Default("ambos")
  @Column
  tipo: string;

  @Column
  estadoCivil: string;

  @Column
  canalOrigem: string;

  @Column
  conjugeNome: string;

  @Column
  conjugeCpf: string;

  @Column(DataType.DATEONLY)
  conjugeDataNascimento: string;

  @Column(DataType.DATEONLY)
  dataNascimento: string;

  @Column(DataType.DATEONLY)
  dataCasamento: string;

  @Column(DataType.DATEONLY)
  dataCompraImovel: string;

  @Default(false)
  @Column
  contratoAdministracao: boolean;

  @Column(DataType.DECIMAL(5, 2))
  comissaoAcordada: number;

  @Default(false)
  @Column
  exclusividade: boolean;

  @Column(DataType.DATEONLY)
  exclusividadeInicio: string;

  @Column(DataType.DATEONLY)
  exclusividadeFim: string;

  @Column(DataType.TEXT)
  exclusividadeContratoUrl: string;

  @Default(false)
  @Column
  saldoDevedor: boolean;

  @Default(false)
  @Column
  parcelaAtrasoFinanciamento: boolean;

  @Default(false)
  @Column
  parcelaAtrasoCondominio: boolean;

  @Default(false)
  @Column
  parcelaAtrasoIptu: boolean;

  @Default(false)
  @Column
  quitado: boolean;

  @Default(false)
  @Column
  averbacao: boolean;

  @Column
  dadosImovelEndereco: string;

  @Column
  dadosImovelTipo: string;

  @Column(DataType.DECIMAL(10, 2))
  dadosImovelArea: number;

  @Column
  inscricaoIptu: string;

  @Column
  matricula: string;

  @Column(DataType.TEXT)
  certidaoOnusUrl: string;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @HasMany(() => ProprietarioFamiliar)
  familiares: ProprietarioFamiliar[];

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default Proprietario;
