import type { ComparavelInput, FatoresHomogeneizacao, ResultadoAvaliacao } from "@/lib/avaliacao/engine";

/** Dados completos do wizard. Persistidos em localStorage como rascunho. */
export interface WizardState {
  // Etapa 1
  imovel: {
    tipo: string;
    finalidade: string;
    endereco: string;
    bairro: string;
    cidade: string;
    estado: string;
    cep: string;
    latitude: string;
    longitude: string;
    area_terreno: string;
    area_construida: string;
    idade: string;
    estado_conservacao: string;
    padrao_construtivo: string;
    quartos: string;
    suites: string;
    banheiros: string;
    garagens: string;
    area_lazer: string;
    caracteristicas: string;
  };
  // Etapa 2
  comparaveis: ComparavelInput[];
  // Etapa 3
  fatores: Record<string, FatoresHomogeneizacao>;
  // Etapa 4
  resultado?: ResultadoAvaliacao;
  iaAnalise?: {
    inconsistencias: string[];
    suficiencia: string;
    valor_sugerido_ia?: number;
    fundamentacao: string;
    conclusao: string;
    gerado_em: string;
  };
}

export const emptyWizardState = (): WizardState => ({
  imovel: {
    tipo: "Apartamento",
    finalidade: "Venda",
    endereco: "",
    bairro: "",
    cidade: "",
    estado: "DF",
    cep: "",
    latitude: "",
    longitude: "",
    area_terreno: "",
    area_construida: "",
    idade: "",
    estado_conservacao: "Bom",
    padrao_construtivo: "Médio",
    quartos: "",
    suites: "",
    banheiros: "",
    garagens: "",
    area_lazer: "",
    caracteristicas: "",
  },
  comparaveis: [],
  fatores: {},
});

export const TIPOS_IMOVEL = [
  "Apartamento", "Casa", "Cobertura", "Studio", "Kitnet",
  "Terreno", "Sala Comercial", "Loja", "Galpão", "Fazenda",
];

export const FINALIDADES = ["Venda", "Locação", "Avaliação Judicial", "Garantia Bancária", "Inventário", "Reavaliação"];
export const CONSERVACOES = ["Novo", "Excelente", "Bom", "Regular", "Necessita reforma"];
export const PADROES = ["Alto Luxo", "Alto", "Médio Alto", "Médio", "Médio Baixo", "Simples"];
