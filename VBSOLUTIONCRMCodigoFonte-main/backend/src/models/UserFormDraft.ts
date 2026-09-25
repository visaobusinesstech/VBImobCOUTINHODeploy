/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * Rascunhos de formulário por usuário (substitui localStorage).
 */

import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  ForeignKey,
  BelongsTo,
  DataType,
  AllowNull,
  Default
} from "sequelize-typescript";
import Company from "./Company";
import User from "./User";

@Table({ tableName: "UserFormDrafts" })
class UserFormDraft extends Model<UserFormDraft> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @AllowNull(false)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @ForeignKey(() => User)
  @AllowNull(false)
  @Column
  userId: number;

  @BelongsTo(() => User)
  user: User;

  @AllowNull(false)
  @Column
  draftKey: string;

  @AllowNull(false)
  @Default({})
  @Column(DataType.JSONB)
  payload: Record<string, unknown>;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default UserFormDraft;
