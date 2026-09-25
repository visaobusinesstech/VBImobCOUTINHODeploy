/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 */
import {
  Table, Column, CreatedAt, UpdatedAt, Model, PrimaryKey, AutoIncrement,
  DataType, ForeignKey, BelongsTo, Default, AllowNull
} from "sequelize-typescript";
import Company from "./Company";
import RealtyNutricaoFluxo from "./RealtyNutricaoFluxo";

@Table({ tableName: "realty_nutricao_metas_config" })
class RealtyNutricaoMetaConfig extends Model<RealtyNutricaoMetaConfig> {
  @PrimaryKey @AutoIncrement @Column id: number;

  @ForeignKey(() => Company) @Column companyId: number;
  @BelongsTo(() => Company) company: Company;

  @AllowNull(true) @ForeignKey(() => RealtyNutricaoFluxo) @Column fluxoId: number;
  @BelongsTo(() => RealtyNutricaoFluxo) fluxo: RealtyNutricaoFluxo;

  @Default(25) @Column(DataType.DECIMAL(8, 2)) metaAbertura: number;
  @Default(10) @Column(DataType.DECIMAL(8, 2)) metaResposta: number;
  @Default(5) @Column(DataType.DECIMAL(8, 2)) metaAgendamento: number;
  @Default(1) @Column(DataType.DECIMAL(8, 2)) metaFechamento: number;
  @Default(14) @Column janelaDias: number;
  @Default(10) @Column minEnvios: number;
  @Default(24) @Column repetirAvisoHoras: number;
  @Default(true) @Column alertarZeroAgendamento: boolean;
  @Default(true) @Column alertarZeroResposta: boolean;
  @Default(true) @Column notificarApp: boolean;
  @Default(true) @Column monitoramentoAtivo: boolean;

  @CreatedAt createdAt: Date;
  @UpdatedAt updatedAt: Date;
}
export default RealtyNutricaoMetaConfig;
