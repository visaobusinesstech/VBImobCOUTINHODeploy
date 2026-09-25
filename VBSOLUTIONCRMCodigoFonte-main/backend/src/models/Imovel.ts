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

@Table({ tableName: "realty_imoveis" })
class Imovel extends Model<Imovel> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column
  title: string;

  @Column(DataType.TEXT)
  description: string;

  @Column
  type: string;

  @Column
  status: string;

  @Column(DataType.DECIMAL(14, 2))
  price: number;

  @Column
  city: string;

  @Column
  neighborhood: string;

  @Column
  address: string;

  @Column(DataType.INTEGER)
  bedrooms: number;

  @Column(DataType.INTEGER)
  bathrooms: number;

  @Column(DataType.DECIMAL(10, 2))
  areaM2: number;

  @Column
  code: string;

  @Column
  purpose: string;

  @Column(DataType.DECIMAL(14, 2))
  condoFee: number;

  @Column(DataType.DECIMAL(14, 2))
  iptu: number;

  @Column
  state: string;

  @Column
  zipCode: string;

  @Column(DataType.INTEGER)
  suites: number;

  @Column(DataType.INTEGER)
  parkingSpots: number;

  @Column({ allowNull: true })
  userId: number;

  @Column
  videoUrl: string;

  @Column(DataType.JSONB)
  images: string[];

  @Column({ defaultValue: false })
  exclusivo: boolean;

  @Column({ defaultValue: false })
  destaque: boolean;

  @Column({ defaultValue: false })
  aceitaPermuta: boolean;

  @Column({ defaultValue: false })
  aceitaFinanciamento: boolean;

  @Column({ defaultValue: false })
  aceitaFgts: boolean;

  @Column({ defaultValue: false })
  temEscritura: boolean;

  @Column
  andar: string;

  @Column
  posicaoSolar: string;

  @Column(DataType.DECIMAL(5, 2))
  comissaoPercentual: number;

  @Column(DataType.DATEONLY)
  exclusividadeInicio: string;

  @Column(DataType.DATEONLY)
  exclusividadeFim: string;

  @Column
  portalOrigem: string;

  @Column
  urlAnuncio: string;

  @Column(DataType.INTEGER)
  fotoCapaIndex: number;

  @Column(DataType.JSONB)
  documentosMatricula: string[];

  @Column(DataType.JSONB)
  documentosIptu: string[];

  @Column(DataType.JSONB)
  documentosOutros: string[];

  @Column(DataType.JSONB)
  videos: string[];

  @ForeignKey(() => Proprietario)
  @Column({ allowNull: true })
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

export default Imovel;
