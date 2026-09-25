/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
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
  BelongsTo,
  HasMany,
  Default
} from "sequelize-typescript";
import Company from "./Company";
import Imovel from "./Imovel";
import Proprietario from "./Proprietario";
import LeadSale from "./LeadSale";
import ContratoAnexoAnual from "./ContratoAnexoAnual";
import ContratoComprovanteMensal from "./ContratoComprovanteMensal";

@Table({ tableName: "realty_contratos" })
class Contrato extends Model<Contrato> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column
  title: string;

  @Column
  status: string;

  @Column(DataType.DECIMAL(14, 2))
  value: number;

  @Column
  startDate: Date;

  @Column
  endDate: Date;

  @Column(DataType.TEXT)
  notes: string;

  @ForeignKey(() => Imovel)
  @Column({ allowNull: true })
  imovelId: number;

  @BelongsTo(() => Imovel)
  imovel: Imovel;

  @ForeignKey(() => Proprietario)
  @Column({ allowNull: true })
  proprietarioId: number;

  /** FK association (renamed to avoid clash with string column `proprietario`). */
  @BelongsTo(() => Proprietario, { foreignKey: "proprietarioId", as: "proprietarioRef" })
  proprietarioRef: Proprietario;

  @ForeignKey(() => LeadSale)
  @Column({ allowNull: true })
  leadSaleId: number;

  @BelongsTo(() => LeadSale)
  leadSale: LeadSale;

  @Column({ allowNull: true })
  propostaId: number;

  @Column
  cliente: string;

  @Column
  clienteTelefone: string;

  @Column
  clienteCpf: string;

  @Column
  clienteEmail: string;

  @Column
  clienteRg: string;

  @Default("Venda")
  @Column
  tipo: string;

  @Column
  inquilino: string;

  /** Nome do proprietário (texto livre; distinto de proprietarioId). */
  @Column
  proprietario: string;

  @Column
  contratoUrl: string;

  @Default(false)
  @Column
  vistoriaEntrada: boolean;

  @Default(false)
  @Column
  vistoriaVideo: boolean;

  @Default(false)
  @Column
  apoliceSeguro: boolean;

  @Column
  matricula: string;

  @Column
  indiceCorrecao: string;

  @Column(DataType.DECIMAL(10, 4))
  percentualCorrecao: number;

  @Column(DataType.DATEONLY)
  dataProximaCorrecao: string;

  @Column
  diaVencimentoAluguel: number;

  @Column(DataType.DATEONLY)
  dataVencimentoApolice: string;

  @Column
  tipoGarantia: string;

  @Column
  contratoAnexoUrl: string;

  @Column
  apoliceAnexoUrl: string;

  @Column
  vistoriaAnexoUrl: string;

  @Column
  numeroAgua: string;

  @Column
  numeroLuz: string;

  @Column
  inscricaoIptu: string;

  @Column
  canalOrigem: string;

  @Column
  proprietarioTelefone: string;

  @Column
  proprietarioCpf: string;

  @Column
  proprietarioEmail: string;

  @Column
  proprietarioRg: string;

  @Column
  proprietarioBanco: string;

  @Column
  proprietarioAgencia: string;

  @Column
  proprietarioConta: string;

  @Column
  proprietarioPix: string;

  @Column(DataType.DECIMAL(10, 4))
  comissaoPercentual: number;

  @Column(DataType.DECIMAL(14, 2))
  comissaoValor: number;

  @Column
  comissaoTipo: string;

  @Default(false)
  @Column
  temParceria: boolean;

  @Column
  parceiroNome: string;

  @Column(DataType.DECIMAL(10, 4))
  parceiroComissaoPercentual: number;

  @Column(DataType.DECIMAL(14, 2))
  parceiroComissaoValor: number;

  @Column
  captadorNome: string;

  @Column
  captadorTelefone: string;

  @Column(DataType.DECIMAL(10, 4))
  captadorComissaoPercentual: number;

  @Column(DataType.DECIMAL(14, 2))
  captadorComissaoValor: number;

  @Column
  impostoTipo: string;

  @Column(DataType.DECIMAL(10, 4))
  impostoPercentual: number;

  @Column(DataType.DECIMAL(14, 2))
  impostoValor: number;

  @Column
  corretorNome: string;

  @Column(DataType.DECIMAL(10, 4))
  corretorComissaoPercentual: number;

  @Column(DataType.DECIMAL(14, 2))
  corretorComissaoValor: number;

  @Column({ allowNull: true })
  corretorId: number;

  @Column(DataType.DECIMAL(14, 2))
  valorIptu: number;

  @Default(false)
  @Column
  iptuParcelado: boolean;

  @Column(DataType.DECIMAL(14, 2))
  valorCondominio: number;

  @Column
  condominioInclui: string;

  @Column
  inquilinoTelefone: string;

  @Column
  inquilinoCpf: string;

  @Column
  inquilinoEmail: string;

  @Column
  inquilinoRg: string;

  @Column
  inquilino2Nome: string;

  @Column
  inquilino2Cpf: string;

  @Column
  inquilino2Telefone: string;

  @Column
  inquilino2Email: string;

  @Column
  inquilino2Rg: string;

  @Column(DataType.DECIMAL(14, 2))
  caucaoValor: number;

  @Column
  caucaoQuantidade: number;

  @Column
  conjugeProprietario: string;

  @Column
  conjugeCpf: string;

  @Column
  conjugeTelefone: string;

  @Column
  conjugeEmail: string;

  @Column
  aditivoAnexoUrl: string;

  @Column
  seguroIncendioAnexoUrl: string;

  @Column
  seguroFiancaAnexoUrl: string;

  @Column
  fiadorNome: string;

  @Column
  fiadorCpf: string;

  @Column
  fiadorTelefone: string;

  @Column
  fiadorEmail: string;

  @Column
  fiadorEstadoCivil: string;

  @Column(DataType.TEXT)
  fiadorEndereco: string;

  @Column
  fiadorMatriculaUrl: string;

  @Column
  fiadorRendaUrl: string;

  @Column
  fiador2Nome: string;

  @Column
  fiador2Cpf: string;

  @Column
  fiador2Telefone: string;

  @Column
  fiador2Email: string;

  @Column
  fiador2EstadoCivil: string;

  @Column(DataType.TEXT)
  fiador2Endereco: string;

  @Column
  fiador2MatriculaUrl: string;

  @Column
  fiador2RendaUrl: string;

  @Column
  vistoriaVideoUrl: string;

  @Column
  caucaoComprovanteUrl: string;

  @Column
  comprovanteAguaUrl: string;

  @Column
  comprovanteLuzUrl: string;

  @Column
  numeroUnidade: string;

  @Default([])
  @Column(DataType.JSONB)
  parceriaEnvolvidos: any[];

  @Column
  codigoContrato: string;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @HasMany(() => ContratoAnexoAnual, { foreignKey: "contratoId", as: "anexosAnuais" })
  anexosAnuais: ContratoAnexoAnual[];

  @HasMany(() => ContratoComprovanteMensal, { foreignKey: "contratoId", as: "comprovantesMensais" })
  comprovantesMensais: ContratoComprovanteMensal[];

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default Contrato;
