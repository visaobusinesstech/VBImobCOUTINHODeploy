/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 */
import {
  Table, Column, CreatedAt, UpdatedAt, Model, PrimaryKey, AutoIncrement,
  DataType, ForeignKey, BelongsTo, Default, AllowNull
} from "sequelize-typescript";
import Company from "./Company";
import RealtyNutricaoFluxo from "./RealtyNutricaoFluxo";

@Table({ tableName: "realty_nutricao_metas_alertas" })
class RealtyNutricaoMetaAlerta extends Model<RealtyNutricaoMetaAlerta> {
  @PrimaryKey @AutoIncrement @Column id: number;

  @ForeignKey(() => Company) @Column companyId: number;
  @BelongsTo(() => Company) company: Company;

  @AllowNull(true) @ForeignKey(() => RealtyNutricaoFluxo) @Column fluxoId: number;
  @BelongsTo(() => RealtyNutricaoFluxo) fluxo: RealtyNutricaoFluxo;

  @Column tipo: string;
  @Default("alerta") @Column severidade: string;
  @Column(DataType.TEXT) mensagem: string;
  @Default(false) @Column resolvido: boolean;
  @AllowNull(true) @Column resolvidoEm: Date;

  @CreatedAt createdAt: Date;
  @UpdatedAt updatedAt: Date;
}
export default RealtyNutricaoMetaAlerta;
