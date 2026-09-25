/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * Captação por canal — paridade Lovable `captacoes`.
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

@Table({ tableName: "realty_captacoes" })
class RealtyCaptacao extends Model<RealtyCaptacao> {
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

  @Column({ defaultValue: "porteiro" })
  tipo: string;

  @Column({ defaultValue: "" })
  nomeContato: string;

  @Column({ allowNull: true })
  telefoneContato: string;

  @Column({ allowNull: true })
  emailContato: string;

  @Column(DataType.TEXT)
  enderecoImovel: string;

  @Column({ allowNull: true })
  bairro: string;

  @Column({ allowNull: true })
  cidade: string;

  @Column({ allowNull: true, defaultValue: "SP" })
  estado: string;

  @Column({ allowNull: true, defaultValue: "Apartamento" })
  tipoImovel: string;

  @Column({ allowNull: true, defaultValue: "Venda" })
  operacao: string;

  @Column({ allowNull: true })
  nomeConstrutora: string;

  @Column({ allowNull: true })
  nomeCondominio: string;

  @Column(DataType.TEXT)
  observacoes: string;

  @Column({ defaultValue: "pendente" })
  status: string;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default RealtyCaptacao;
