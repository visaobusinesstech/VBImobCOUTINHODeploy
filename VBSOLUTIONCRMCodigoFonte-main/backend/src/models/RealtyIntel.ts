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

@Table({ tableName: "realty_radarzap_grupos" })
class RadarZapGrupo extends Model<RadarZapGrupo> {
  @PrimaryKey @AutoIncrement @Column id: number;
  @Column name: string;
  @Column inviteUrl: string;
  @Column city: string;
  @Column status: string;
  @ForeignKey(() => Company) @Column companyId: number;
  @BelongsTo(() => Company) company: Company;
  @CreatedAt createdAt: Date;
  @UpdatedAt updatedAt: Date;
}

@Table({ tableName: "realty_radarzap_mensagens" })
class RadarZapMensagem extends Model<RadarZapMensagem> {
  @PrimaryKey @AutoIncrement @Column id: number;
  @Column(DataType.TEXT) texto: string;
  @Column autorContato: string;
  @Column analisado: boolean;
  @Column temImovel: boolean;
  @Column intencao: string;
  @Column(DataType.INTEGER) scoreIntencao: number;
  @Column(DataType.JSONB) extraido: any;
  @ForeignKey(() => RadarZapGrupo) @Column({ allowNull: true }) grupoId: number;
  @ForeignKey(() => Company) @Column companyId: number;
  @BelongsTo(() => Company) company: Company;
  @CreatedAt createdAt: Date;
  @UpdatedAt updatedAt: Date;
}

@Table({ tableName: "realty_radarzap_leads" })
class RadarZapLead extends Model<RadarZapLead> {
  @PrimaryKey @AutoIncrement @Column id: number;
  @Column tipoImovel: string;
  @Column operacao: string;
  @Column bairro: string;
  @Column cidade: string;
  @Column(DataType.DECIMAL(14, 2)) preco: number;
  @Column contato: string;
  @Column(DataType.TEXT) resumo: string;
  @Column status: string;
  @ForeignKey(() => RadarZapMensagem) @Column({ allowNull: true }) mensagemId: number;
  @ForeignKey(() => RadarZapGrupo) @Column({ allowNull: true }) grupoId: number;
  @ForeignKey(() => Company) @Column companyId: number;
  @BelongsTo(() => Company) company: Company;
  @CreatedAt createdAt: Date;
  @UpdatedAt updatedAt: Date;
}

@Table({ tableName: "realty_imoveis_mercado" })
class ImovelMercado extends Model<ImovelMercado> {
  @PrimaryKey @AutoIncrement @Column id: number;
  @Column portal: string;
  @Column url: string;
  @Column titulo: string;
  @Column tipo: string;
  @Column operacao: string;
  @Column bairro: string;
  @Column cidade: string;
  @Column(DataType.DECIMAL(14, 2)) preco: number;
  @Column(DataType.DECIMAL(10, 2)) area: number;
  @Column(DataType.INTEGER) quartos: number;
  @Column(DataType.INTEGER) diasAnuncio: number;
  @Column(DataType.INTEGER) qScore: number;
  @Column(DataType.JSONB) raw: any;
  @ForeignKey(() => Company) @Column companyId: number;
  @BelongsTo(() => Company) company: Company;
  @CreatedAt createdAt: Date;
  @UpdatedAt updatedAt: Date;
}

@Table({ tableName: "realty_seo_conteudos" })
class SeoConteudo extends Model<SeoConteudo> {
  @PrimaryKey @AutoIncrement @Column id: number;
  @Column titulo: string;
  @Column slug: string;
  @Column keyword: string;
  @Column(DataType.TEXT) meta: string;
  @Column(DataType.TEXT) corpo: string;
  @Column(DataType.INTEGER) score: number;
  @Column(DataType.JSONB) checks: any;
  @Column({ allowNull: true }) imovelId: number;
  @ForeignKey(() => Company) @Column companyId: number;
  @BelongsTo(() => Company) company: Company;
  @CreatedAt createdAt: Date;
  @UpdatedAt updatedAt: Date;
}

export { RadarZapGrupo, RadarZapMensagem, RadarZapLead, ImovelMercado, SeoConteudo };
