/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 */
import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  DataType,
  ForeignKey,
  BelongsTo
} from "sequelize-typescript";
import Company from "./Company";
import User from "./User";

@Table({ tableName: "realty_consulta_cpf" })
class RealtyConsultaCpf extends Model<RealtyConsultaCpf> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @ForeignKey(() => User)
  @Column({ allowNull: true })
  userId: number;

  @BelongsTo(() => User)
  user: User;

  @Column(DataType.STRING(11))
  cpf: string;

  @Column(DataType.STRING(20))
  cpfMasked: string;

  @Column({ defaultValue: false })
  lgpdConsent: boolean;

  @Column({ allowNull: true })
  contratoId: number;

  @Column({ allowNull: true })
  score: number;

  @Column(DataType.STRING(20))
  riskLevel: string;

  @Column(DataType.STRING(20))
  status: string;

  @Column({ defaultValue: false })
  simulated: boolean;

  @Column(DataType.JSONB)
  resultado: object;

  @Column(DataType.DATE)
  consultedAt: Date;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default RealtyConsultaCpf;
