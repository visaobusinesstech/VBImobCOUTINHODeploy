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
  Default,
  AllowNull
} from "sequelize-typescript";
import Company from "./Company";
import User from "./User";
import LeadSale from "./LeadSale";
import Imovel from "./Imovel";

@Table({ tableName: "realty_compromissos" })
class RealtyCompromisso extends Model<RealtyCompromisso> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column
  title: string;

  @AllowNull(true)
  @Column(DataType.TEXT)
  description: string;

  @Default("reuniao")
  @Column
  tipo: string;

  @Column
  dataInicio: Date;

  @AllowNull(true)
  @Column
  dataFim: Date;

  @AllowNull(true)
  @Column
  local: string;

  @AllowNull(true)
  @ForeignKey(() => LeadSale)
  @Column
  leadSaleId: number;

  @BelongsTo(() => LeadSale)
  leadSale: LeadSale;

  @AllowNull(true)
  @ForeignKey(() => User)
  @Column
  userId: number;

  @BelongsTo(() => User)
  user: User;

  @AllowNull(true)
  @ForeignKey(() => Imovel)
  @Column
  imovelId: number;

  @BelongsTo(() => Imovel)
  imovel: Imovel;

  @Default("pendente")
  @Column
  status: string;

  @Default(false)
  @Column
  lembreteWhatsapp: boolean;

  @AllowNull(true)
  @Column
  telefoneLembrete: string;

  @Default("media")
  @Column
  prioridade: string;

  @AllowNull(true)
  @Column
  emailCliente: string;

  @AllowNull(true)
  @Column
  googleMapsLink: string;

  @Default(false)
  @Column
  confirmado: boolean;

  @Default(0)
  @Column
  lembreteNivel: number;

  @AllowNull(true)
  @Column
  checkinAt: Date;

  @AllowNull(true)
  @Column
  checkoutAt: Date;

  @AllowNull(true)
  @Column(DataType.TEXT)
  feedbackVisita: string;

  @AllowNull(true)
  @Column(DataType.TEXT)
  feedbackIa: string;

  @Default("pendente")
  @Column
  confirmacaoStatus: string;

  @AllowNull(true)
  @Column
  confirmacaoToken: string;

  @AllowNull(true)
  @Column(DataType.TEXT)
  confirmacaoMensagem: string;

  @AllowNull(true)
  @Column(DataType.TEXT)
  clienteResposta: string;

  @AllowNull(true)
  @Column
  dataReagendamentoSugerida: Date;

  @AllowNull(true)
  @Column
  resultadoCliente: string;

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

export default RealtyCompromisso;
