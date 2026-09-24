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
import User from "./User";
import Contact from "./Contact";
import LeadPipeline from "./LeadPipeline";
import Imovel from "./Imovel";
import Proprietario from "./Proprietario";

@Table({ tableName: "leads_sales" })
class LeadSale extends Model<LeadSale> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column
  name: string;

  @Column(DataType.TEXT)
  description: string;

  @Column
  status: string;

  @Column(DataType.INTEGER)
  value: number;

  @Column
  companyName: string;

  @Column
  phone: string;

  @Column
  email: string;

  @Column
  site: string;

  @Column
  origin: string;

  @Column
  document: string;

  @Column
  birthDate: Date;

  @Column(DataType.JSON)
  address: any;

  @Column(DataType.JSON)
  tags: string[];

  @ForeignKey(() => Contact)
  @Column
  contactId: number;

  @BelongsTo(() => Contact)
  contact: Contact;

  @ForeignKey(() => User)
  @Column
  responsibleId: number;

  @BelongsTo(() => User)
  responsible: User;

  @ForeignKey(() => LeadPipeline)
  @Column({ allowNull: true })
  pipelineId: number | null;

  @BelongsTo(() => LeadPipeline)
  pipeline: LeadPipeline;

  @ForeignKey(() => Imovel)
  @Column({ allowNull: true })
  imovelId: number | null;

  @BelongsTo(() => Imovel)
  imovel: Imovel;

  @ForeignKey(() => Proprietario)
  @Column({ allowNull: true })
  proprietarioId: number | null;

  @BelongsTo(() => Proprietario)
  proprietario: Proprietario;

  @Column
  interestCity: string;

  @Column
  interestNeighborhood: string;

  @Column
  interestType: string;

  @Column(DataType.INTEGER)
  bedrooms: number;

  @Column
  followUpAt: Date;

  @Column
  temperature: string;

  @Column
  purpose: string;

  @Column(DataType.DECIMAL(14, 2))
  priceMin: number;

  @Column(DataType.DECIMAL(14, 2))
  priceMax: number;

  @Column
  paymentMethod: string;

  @Column(DataType.DECIMAL(14, 2))
  downPayment: number;

  @Column
  financing: boolean;

  @Column(DataType.INTEGER)
  parkingSpots: number;

  @Column(DataType.INTEGER)
  suitesDesired: number;

  @Column(DataType.TEXT)
  featuresDesired: string;

  @Column(DataType.TEXT)
  lostReason: string;

  @Column
  nextContactAt: Date;

  @Column({ allowNull: true })
  ticketId: number | null;

  @Column
  date: Date;

  @Column
  dateEnd: Date;

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

export default LeadSale;

