/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 */
import {
  Table, Column, CreatedAt, UpdatedAt, Model, PrimaryKey, AutoIncrement,
  DataType, ForeignKey, BelongsTo, HasMany, Default, AllowNull
} from "sequelize-typescript";
import Company from "./Company";
import Whatsapp from "./Whatsapp";
import Prompt from "./Prompt";
import RealtyNutricaoEtapa from "./RealtyNutricaoEtapa";
import RealtyNutricaoInscricao from "./RealtyNutricaoInscricao";

@Table({ tableName: "realty_nutricao_fluxos" })
class RealtyNutricaoFluxo extends Model<RealtyNutricaoFluxo> {
  @PrimaryKey @AutoIncrement @Column id: number;

  @ForeignKey(() => Company) @Column companyId: number;
  @BelongsTo(() => Company) company: Company;

  @Column nome: string;
  @Column(DataType.TEXT) descricao: string;
  @Column publicoAlvo: string;
  @Default(30) @Column diasInatividade: number;
  @Default("whatsapp") @Column canal: string;
  @Default(true) @Column encerrarAoResponder: boolean;
  @Default(true) @Column ativo: boolean;

  @Column(DataType.JSONB) segmentoEstagios: string[];
  @Column(DataType.JSONB) segmentoPerfis: string[];
  @Column(DataType.JSONB) segmentoMotivosPerda: string[];
  @Column(DataType.JSONB) destinatarioContactIds: number[];
  @Column(DataType.JSONB) destinatarioLeadSaleIds: number[];

  @AllowNull(true) @ForeignKey(() => Whatsapp) @Column whatsappId: number;
  @BelongsTo(() => Whatsapp) whatsapp: Whatsapp;

  @AllowNull(true) @ForeignKey(() => Prompt) @Column promptId: number;
  @BelongsTo(() => Prompt) prompt: Prompt;

  @HasMany(() => RealtyNutricaoEtapa) etapas: RealtyNutricaoEtapa[];
  @HasMany(() => RealtyNutricaoInscricao) inscricoes: RealtyNutricaoInscricao[];

  @CreatedAt createdAt: Date;
  @UpdatedAt updatedAt: Date;
}
export default RealtyNutricaoFluxo;
