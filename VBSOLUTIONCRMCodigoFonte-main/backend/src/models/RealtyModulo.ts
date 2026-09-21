/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 */

import {
  Table, Column, CreatedAt, UpdatedAt, Model, PrimaryKey, AutoIncrement,
  DataType, ForeignKey, BelongsTo
} from "sequelize-typescript";
import Company from "./Company";

@Table({ tableName: "realty_modulos" })
class RealtyModulo extends Model<RealtyModulo> {
  @PrimaryKey @AutoIncrement @Column id: number;
  @Column kind: string;
  @Column title: string;
  @Column status: string;
  @Column(DataType.TEXT) notes: string;
  @Column(DataType.DECIMAL(14, 2)) value: number;
  @Column dueDate: Date;
  @Column(DataType.JSONB) payload: any;
  @ForeignKey(() => Company) @Column companyId: number;
  @BelongsTo(() => Company) company: Company;
  @CreatedAt createdAt: Date;
  @UpdatedAt updatedAt: Date;
}

export default RealtyModulo;
