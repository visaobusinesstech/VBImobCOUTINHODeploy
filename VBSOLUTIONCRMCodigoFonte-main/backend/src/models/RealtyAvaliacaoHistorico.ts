/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * Paridade Lovable avaliacoes_historico.
 */
import {
  Table, Column, CreatedAt, UpdatedAt, Model, PrimaryKey, AutoIncrement,
  DataType, ForeignKey, BelongsTo
} from "sequelize-typescript";
import Company from "./Company";
import User from "./User";
import Imovel from "./Imovel";

@Table({ tableName: "realty_avaliacoes_historico" })
class RealtyAvaliacaoHistorico extends Model<RealtyAvaliacaoHistorico> {
  @PrimaryKey @AutoIncrement @Column id: number;
  @ForeignKey(() => Company) @Column companyId: number;
  @BelongsTo(() => Company) company: Company;
  @ForeignKey(() => User) @Column({ allowNull: true }) userId: number;
  @BelongsTo(() => User) user: User;
  @ForeignKey(() => Imovel) @Column({ allowNull: true }) imovelId: number;
  @BelongsTo(() => Imovel) imovel: Imovel;

  @Column({ defaultValue: "" }) titulo: string;
  @Column({ defaultValue: "Apartamento" }) tipo: string;
  @Column({ defaultValue: "Venda" }) operacao: string;
  @Column({ type: DataType.DECIMAL(14, 2), defaultValue: 0 }) area: number;
  @Column({ defaultValue: 0 }) quartos: number;
  @Column({ allowNull: true }) bairro: string;
  @Column({ allowNull: true }) cidade: string;
  @Column({ allowNull: true }) estado: string;
  @Column({ type: DataType.DECIMAL(14, 2), allowNull: true, defaultValue: 0 }) precoInformado: number;
  @Column({ type: DataType.DECIMAL(14, 2), defaultValue: 0 }) valorMinimo: number;
  @Column({ type: DataType.DECIMAL(14, 2), defaultValue: 0 }) valorIdeal: number;
  @Column({ type: DataType.DECIMAL(14, 2), defaultValue: 0 }) valorMaximo: number;
  @Column({ type: DataType.DECIMAL(14, 2), allowNull: true, defaultValue: 0 }) precoM2Estimado: number;
  @Column({ type: DataType.DECIMAL(14, 2), allowNull: true, defaultValue: 0 }) precoM2Regiao: number;
  @Column({ allowNull: true, defaultValue: 0 }) scoreLiquidez: number;
  @Column({ allowNull: true, defaultValue: "media" }) classificacaoLiquidez: string;
  @Column(DataType.TEXT) analiseResumo: string;
  @Column({ type: DataType.JSONB, allowNull: true, defaultValue: [] }) pontosFortes: any;
  @Column({ type: DataType.JSONB, allowNull: true, defaultValue: [] }) pontosAtencao: any;
  @Column(DataType.TEXT) estrategiaVenda: string;
  @Column({ type: DataType.JSONB, allowNull: true, defaultValue: [] }) portaisRecomendados: any;
  @Column({ type: DataType.DECIMAL(14, 2), allowNull: true, defaultValue: 0 }) sugestaoPrecoInicial: number;
  @Column({ allowNull: true, defaultValue: 0 }) probabilidadeVenda30dias: number;
  @Column({ allowNull: true, defaultValue: 0 }) probabilidadeVenda60dias: number;
  @Column({ allowNull: true, defaultValue: 0 }) probabilidadeVenda90dias: number;
  @Column({ allowNull: true, defaultValue: false }) precoCompetitivo: boolean;
  @Column({ allowNull: true, defaultValue: "manual" }) modo: string;
  @Column({ allowNull: true, defaultValue: 0 }) comparaveisCount: number;
  @Column(DataType.TEXT) descricao: string;
  @Column({ type: DataType.JSONB, allowNull: true, defaultValue: {} }) dadosCompletos: any;

  @CreatedAt createdAt: Date;
  @UpdatedAt updatedAt: Date;
}
export default RealtyAvaliacaoHistorico;
