/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 */
import {
  Table, Column, CreatedAt, UpdatedAt, Model, PrimaryKey, AutoIncrement,
  DataType, ForeignKey, BelongsTo, Default, AllowNull
} from "sequelize-typescript";
import Company from "./Company";
import RealtyNutricaoFluxo from "./RealtyNutricaoFluxo";

@Table({ tableName: "realty_nutricao_etapas" })
class RealtyNutricaoEtapa extends Model<RealtyNutricaoEtapa> {
  @PrimaryKey @AutoIncrement @Column id: number;

  @ForeignKey(() => Company) @Column companyId: number;
  @BelongsTo(() => Company) company: Company;

  @ForeignKey(() => RealtyNutricaoFluxo) @Column fluxoId: number;
  @BelongsTo(() => RealtyNutricaoFluxo) fluxo: RealtyNutricaoFluxo;

  @Default(1) @Column ordem: number;
  @Default(0) @Column diasApos: number;
  @Default("heranca") @Column canal: string;
  @Column titulo: string;
  @Column(DataType.TEXT) mensagem: string;
  @Default(true) @Column ativo: boolean;

  @Default(false) @Column abAtivo: boolean;
  @Column abTituloB: string;
  @Column(DataType.TEXT) abMensagemB: string;
  @Default(50) @Column abSplit: number;
  @Default(true) @Column abAutoEscolher: boolean;
  @Default(20) @Column abMinEnvios: number;
  @AllowNull(true) @Column abVencedor: string;
  @AllowNull(true) @Column abDecididoEm: Date;

  @CreatedAt createdAt: Date;
  @UpdatedAt updatedAt: Date;
}
export default RealtyNutricaoEtapa;
