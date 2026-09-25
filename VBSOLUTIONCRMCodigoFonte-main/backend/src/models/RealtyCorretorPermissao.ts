/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * Permissões por módulo do corretor (paridade Lovable corretor_permissoes).
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
  Default
} from "sequelize-typescript";
import Company from "./Company";
import RealtyModulo from "./RealtyModulo";

@Table({ tableName: "realty_corretor_permissoes" })
class RealtyCorretorPermissao extends Model<RealtyCorretorPermissao> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @ForeignKey(() => RealtyModulo)
  @Column
  corretorId: number;

  @BelongsTo(() => RealtyModulo)
  corretor: RealtyModulo;

  @Column
  modulo: string;

  @Default(true)
  @Column
  ativo: boolean;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default RealtyCorretorPermissao;
