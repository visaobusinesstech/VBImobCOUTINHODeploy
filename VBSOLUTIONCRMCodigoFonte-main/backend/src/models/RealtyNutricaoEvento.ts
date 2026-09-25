/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 */
import {
  Table, Column, CreatedAt, UpdatedAt, Model, PrimaryKey, AutoIncrement,
  DataType, ForeignKey, BelongsTo, AllowNull
} from "sequelize-typescript";
import Company from "./Company";
import LeadSale from "./LeadSale";
import RealtyNutricaoFluxo from "./RealtyNutricaoFluxo";
import RealtyNutricaoEnvio from "./RealtyNutricaoEnvio";
import RealtyNutricaoInscricao from "./RealtyNutricaoInscricao";
import RealtyNutricaoEtapa from "./RealtyNutricaoEtapa";

@Table({ tableName: "realty_nutricao_eventos" })
class RealtyNutricaoEvento extends Model<RealtyNutricaoEvento> {
  @PrimaryKey @AutoIncrement @Column id: number;

  @ForeignKey(() => Company) @Column companyId: number;
  @BelongsTo(() => Company) company: Company;

  @AllowNull(true) @ForeignKey(() => RealtyNutricaoFluxo) @Column fluxoId: number;
  @BelongsTo(() => RealtyNutricaoFluxo) fluxo: RealtyNutricaoFluxo;

  @AllowNull(true) @ForeignKey(() => RealtyNutricaoEnvio) @Column envioId: number;
  @BelongsTo(() => RealtyNutricaoEnvio) envio: RealtyNutricaoEnvio;

  @AllowNull(true) @ForeignKey(() => RealtyNutricaoInscricao) @Column inscricaoId: number;
  @BelongsTo(() => RealtyNutricaoInscricao) inscricao: RealtyNutricaoInscricao;

  @AllowNull(true) @ForeignKey(() => RealtyNutricaoEtapa) @Column etapaId: number;
  @BelongsTo(() => RealtyNutricaoEtapa) etapa: RealtyNutricaoEtapa;

  @AllowNull(true) @ForeignKey(() => LeadSale) @Column leadSaleId: number;
  @BelongsTo(() => LeadSale) leadSale: LeadSale;

  @Column tipo: string;
  @Column canal: string;
  @AllowNull(true) @Column(DataType.DECIMAL(14, 2)) valor: number;

  @CreatedAt createdAt: Date;
  @UpdatedAt updatedAt: Date;
}
export default RealtyNutricaoEvento;
