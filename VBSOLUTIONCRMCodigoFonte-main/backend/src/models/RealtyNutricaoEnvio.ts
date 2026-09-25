/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 */
import {
  Table, Column, CreatedAt, UpdatedAt, Model, PrimaryKey, AutoIncrement,
  DataType, ForeignKey, BelongsTo, Default, AllowNull
} from "sequelize-typescript";
import Company from "./Company";
import LeadSale from "./LeadSale";
import RealtyNutricaoInscricao from "./RealtyNutricaoInscricao";
import RealtyNutricaoEtapa from "./RealtyNutricaoEtapa";

@Table({ tableName: "realty_nutricao_envios" })
class RealtyNutricaoEnvio extends Model<RealtyNutricaoEnvio> {
  @PrimaryKey @AutoIncrement @Column id: number;

  @ForeignKey(() => Company) @Column companyId: number;
  @BelongsTo(() => Company) company: Company;

  @ForeignKey(() => RealtyNutricaoInscricao) @Column inscricaoId: number;
  @BelongsTo(() => RealtyNutricaoInscricao) inscricao: RealtyNutricaoInscricao;

  @AllowNull(true) @ForeignKey(() => RealtyNutricaoEtapa) @Column etapaId: number;
  @BelongsTo(() => RealtyNutricaoEtapa) etapa: RealtyNutricaoEtapa;

  @AllowNull(true) @ForeignKey(() => LeadSale) @Column leadSaleId: number;
  @BelongsTo(() => LeadSale) leadSale: LeadSale;

  @Column canal: string;
  @Column destino: string;
  @Column titulo: string;
  @Column(DataType.TEXT) mensagem: string;
  @Default("pendente") @Column status: string;
  @Column(DataType.TEXT) erro: string;
  @AllowNull(true) @Column enviadoEm: Date;
  @AllowNull(true) @Column variante: string;
  @AllowNull(true) @Column ticketId: number;

  @CreatedAt createdAt: Date;
  @UpdatedAt updatedAt: Date;
}
export default RealtyNutricaoEnvio;
