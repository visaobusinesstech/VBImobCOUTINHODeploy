/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 */
import {
  Table, Column, CreatedAt, UpdatedAt, Model, PrimaryKey, AutoIncrement,
  DataType, ForeignKey, BelongsTo
} from "sequelize-typescript";
import Company from "./Company";

@Table({ tableName: "realty_fila_config" })
class RealtyFilaConfig extends Model<RealtyFilaConfig> {
  @PrimaryKey @AutoIncrement @Column id: number;
  @Column strategy: string;
  @Column({ allowNull: true }) lastUserId: number;
  @Column(DataType.JSONB) userIds: number[];
  @Column active: boolean;
  @Column(DataType.TEXT) notes: string;
  @ForeignKey(() => Company) @Column companyId: number;
  @BelongsTo(() => Company) company: Company;
  @CreatedAt createdAt: Date;
  @UpdatedAt updatedAt: Date;
}
export default RealtyFilaConfig;
