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

@Table({ tableName: "realty_prospeccao" })
class RealtyProspeccao extends Model<RealtyProspeccao> {
  @PrimaryKey @AutoIncrement @Column id: number;
  @Column title: string;
  @Column prospectDate: Date;
  @ForeignKey(() => LeadSale) @Column({ allowNull: true }) leadSaleId: number;
  @BelongsTo(() => LeadSale) leadSale: LeadSale;
  @Column phone: string;
  @Column targetCount: number;
  @Column doneCount: number;
  @Column status: string;
  @Column(DataType.TEXT) notes: string;
  @ForeignKey(() => User) @Column({ allowNull: true }) userId: number;
  @BelongsTo(() => User) user: User;
  @Column({ allowNull: true }) ticketId: number;
  @ForeignKey(() => Company) @Column companyId: number;
  @BelongsTo(() => Company) company: Company;
  @CreatedAt createdAt: Date;
  @UpdatedAt updatedAt: Date;
}
export default RealtyProspeccao;
