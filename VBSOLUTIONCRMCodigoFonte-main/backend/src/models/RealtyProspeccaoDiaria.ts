/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 */
import {
  Table, Column, CreatedAt, UpdatedAt, Model, PrimaryKey, AutoIncrement,
  DataType, ForeignKey, BelongsTo
} from "sequelize-typescript";
import Company from "./Company";
import User from "./User";

@Table({ tableName: "realty_prospeccao_diaria" })
class RealtyProspeccaoDiaria extends Model<RealtyProspeccaoDiaria> {
  @PrimaryKey @AutoIncrement @Column id: number;
  @ForeignKey(() => Company) @Column companyId: number;
  @BelongsTo(() => Company) company: Company;
  @ForeignKey(() => User) @Column({ allowNull: true }) userId: number;
  @BelongsTo(() => User) user: User;
  @Column(DataType.DATEONLY) data: string;
  @Column({ defaultValue: 0 }) prospeccoesAluguel: number;
  @Column({ defaultValue: 0 }) prospeccoesVenda: number;
  @Column({ defaultValue: 0 }) proprietariosContatados: number;
  @Column({ defaultValue: 0 }) leadsConversados: number;
  @Column(DataType.TEXT) observacoes: string;
  @CreatedAt createdAt: Date;
  @UpdatedAt updatedAt: Date;
}
export default RealtyProspeccaoDiaria;
