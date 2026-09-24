/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 */
import {
  Table, Column, CreatedAt, UpdatedAt, Model, PrimaryKey, AutoIncrement,
  DataType, ForeignKey, BelongsTo
} from "sequelize-typescript";
import Company from "./Company";

@Table({ tableName: "realty_automacao_followup" })
class RealtyAutomacaoFollowup extends Model<RealtyAutomacaoFollowup> {
  @PrimaryKey @AutoIncrement @Column id: number;
  @Column title: string;
  @Column trigger: string;
  @Column daysWithoutContact: number;
  @Column fromStatus: string;
  @Column toStatus: string;
  @Column action: string;
  @Column(DataType.TEXT) messageTemplate: string;
  @Column active: boolean;
  @Column(DataType.TEXT) notes: string;
  @ForeignKey(() => Company) @Column companyId: number;
  @BelongsTo(() => Company) company: Company;
  @CreatedAt createdAt: Date;
  @UpdatedAt updatedAt: Date;
}
export default RealtyAutomacaoFollowup;
