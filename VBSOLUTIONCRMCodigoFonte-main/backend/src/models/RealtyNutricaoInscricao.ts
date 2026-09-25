/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 */
import {
  Table, Column, CreatedAt, UpdatedAt, Model, PrimaryKey, AutoIncrement,
  DataType, ForeignKey, BelongsTo, Default, AllowNull
} from "sequelize-typescript";
import Company from "./Company";
import LeadSale from "./LeadSale";
import RealtyNutricaoFluxo from "./RealtyNutricaoFluxo";

@Table({ tableName: "realty_nutricao_inscricoes" })
class RealtyNutricaoInscricao extends Model<RealtyNutricaoInscricao> {
  @PrimaryKey @AutoIncrement @Column id: number;

  @ForeignKey(() => Company) @Column companyId: number;
  @BelongsTo(() => Company) company: Company;

  @ForeignKey(() => RealtyNutricaoFluxo) @Column fluxoId: number;
  @BelongsTo(() => RealtyNutricaoFluxo) fluxo: RealtyNutricaoFluxo;

  @AllowNull(true) @ForeignKey(() => LeadSale) @Column leadSaleId: number;
  @BelongsTo(() => LeadSale) leadSale: LeadSale;

  @Column nome: string;
  @Column telefone: string;
  @Column email: string;
  @Default("ativa") @Column status: string;
  @Default(0) @Column etapaAtual: number;
  @AllowNull(true) @Column proximaExecucao: Date;
  @AllowNull(true) @Column ultimaExecucao: Date;
  @Column(DataType.TEXT) motivoEncerramento: string;

  @CreatedAt createdAt: Date;
  @UpdatedAt updatedAt: Date;
}
export default RealtyNutricaoInscricao;
