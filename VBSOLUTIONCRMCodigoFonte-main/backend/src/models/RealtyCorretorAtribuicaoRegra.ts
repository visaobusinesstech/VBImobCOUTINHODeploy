/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * Regras de atribuição geográfica (paridade Lovable corretor_atribuicao_regras).
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
  Default,
  AllowNull,
  DataType
} from "sequelize-typescript";
import Company from "./Company";
import RealtyModulo from "./RealtyModulo";

@Table({ tableName: "realty_corretor_atribuicao_regras" })
class RealtyCorretorAtribuicaoRegra extends Model<RealtyCorretorAtribuicaoRegra> {
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

  @AllowNull(true)
  @Column
  cidade: string;

  @AllowNull(true)
  @Column
  bairro: string;

  @Default(100)
  @Column
  prioridade: number;

  @Default(1)
  @Column
  peso: number;

  @Default(true)
  @Column
  ativo: boolean;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default RealtyCorretorAtribuicaoRegra;
