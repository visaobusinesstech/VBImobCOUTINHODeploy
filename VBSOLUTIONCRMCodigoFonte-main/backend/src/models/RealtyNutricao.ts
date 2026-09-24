/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 */
import {
  Table, Column, CreatedAt, UpdatedAt, Model, PrimaryKey, AutoIncrement,
  DataType, ForeignKey, BelongsTo
} from "sequelize-typescript";
import Company from "./Company";
import User from "./User";
import LeadSale from "./LeadSale";

@Table({ tableName: "realty_nutricao" })
class RealtyNutricao extends Model<RealtyNutricao> {
  @PrimaryKey @AutoIncrement @Column id: number;
  @Column title: string;
  @ForeignKey(() => LeadSale) @Column({ allowNull: true }) leadSaleId: number;
  @BelongsTo(() => LeadSale) leadSale: LeadSale;
  @Column cadenceDays: number;
  @Column nextSendAt: Date;
  @Column channel: string;
  @Column(DataType.TEXT) messageTemplate: string;
  @Column status: string;
  @Column(DataType.TEXT) notes: string;
  @ForeignKey(() => User) @Column({ allowNull: true }) userId: number;
  @BelongsTo(() => User) user: User;
  @ForeignKey(() => Company) @Column companyId: number;
  @BelongsTo(() => Company) company: Company;
  @CreatedAt createdAt: Date;
  @UpdatedAt updatedAt: Date;
}
export default RealtyNutricao;
