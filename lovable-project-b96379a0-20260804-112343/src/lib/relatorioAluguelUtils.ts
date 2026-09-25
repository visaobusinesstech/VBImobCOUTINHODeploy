import type { Contrato } from "@/hooks/useContratos";
import type { Transacao } from "@/hooks/useTransacoes";

export const GARANTIA_LABELS: Record<string, string> = {
  caucao: "Caução",
  fiador: "Fiador",
  seguro_fianca: "Seguro Fiança",
  titulo_capitalizacao: "Título de Capitalização",
};

export interface RelatorioAluguelImovelRef {
  id: string;
  titulo: string;
  endereco: string | null;
  bairro: string | null;
  cidade: string | null;
}

const normalizeText = (value: string | null | undefined) =>
  (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

export const formatCurrencyBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(safeNumber(value));

export const formatDateBR = (value: string | null | undefined) => {
  if (!value) return "—";

  const normalized = value.includes("T") ? value : `${value}T00:00:00`;
  const date = new Date(normalized);

  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("pt-BR");
};

export const safeNumber = (value: unknown) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  if (typeof value === "string") {
    const raw = value.trim();
    if (!raw) return 0;

    const direct = Number(raw);
    if (Number.isFinite(direct)) return direct;

    const normalized = raw.replace(/\./g, "").replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
};

export const isActiveRentalContract = (contrato: Pick<Contrato, "tipo" | "status">) =>
  contrato.tipo === "Locação" && ["ativo", "assinado", "vencendo"].includes(contrato.status);

export const getContratoImovel = (
  contrato: Pick<Contrato, "imovel_id">,
  imoveis: RelatorioAluguelImovelRef[],
) => imoveis.find((imovel) => imovel.id === contrato.imovel_id) ?? null;

export const getContratoImovelLabel = (
  contrato: Pick<Contrato, "titulo">,
  imovel?: Pick<RelatorioAluguelImovelRef, "titulo"> | null,
) => imovel?.titulo?.trim() || contrato.titulo?.trim() || "Imóvel sem título";

export const getContratoLocalizacao = (imovel?: RelatorioAluguelImovelRef | null) =>
  [imovel?.bairro, imovel?.cidade].filter(Boolean).join(", ") || imovel?.endereco || "—";

export const getContratoInquilino = (contrato: Pick<Contrato, "inquilino" | "cliente">) =>
  contrato.inquilino || contrato.cliente || "—";

export const getTransacoesDoContrato = ({
  contrato,
  imovel,
  transacoes,
}: {
  contrato: Pick<Contrato, "imovel_id" | "titulo" | "numero_unidade">;
  imovel?: RelatorioAluguelImovelRef | null;
  transacoes: Pick<Transacao, "imovel_id" | "descricao" | "categoria" | "tipo" | "status" | "valor" | "data" | "numero_unidade">[];
}) => {
  const referenceId = contrato.imovel_id || imovel?.id || null;
  const contratoUnidade = normalizeText(contrato.numero_unidade);

  if (referenceId) {
    const byImovel = transacoes.filter((transacao) => transacao.imovel_id === referenceId);

    // If the contract has a unit number, narrow down to only transactions matching that unit
    if (contratoUnidade.length >= 1) {
      const byUnit = byImovel.filter((transacao) => {
        const txUnidade = normalizeText((transacao as any).numero_unidade);
        // Match ONLY transactions with the same unit number (strict filtering)
        return txUnidade === contratoUnidade;
      });
      // Only narrow if we found results; otherwise fall back to all for that property
      if (byUnit.length > 0) return byUnit;
    }

    return byImovel;
  }

  // Fallback: match by title/unit text in transaction description
  const terms = Array.from(
    new Set(
      [contrato.titulo, imovel?.titulo, contrato.numero_unidade]
        .map((value) => normalizeText(value))
        .filter((value) => value.length >= 4),
    ),
  );

  if (!terms.length) return [];

  return transacoes.filter((transacao) => {
    if (transacao.imovel_id) return false;
    // Also check numero_unidade match on the transaction
    if (contratoUnidade.length >= 1) {
      const txUnidade = normalizeText((transacao as any).numero_unidade);
      if (txUnidade === contratoUnidade) return true;
    }
    const description = normalizeText(transacao.descricao);
    return terms.some((term) => description.includes(term));
  });
};

export const resumirTransacoesContrato = (
  transacoes: Pick<Transacao, "tipo" | "status" | "valor">[],
) => ({
  recebido: transacoes
    .filter((transacao) => transacao.tipo === "entrada" && transacao.status === "confirmado")
    .reduce((total, transacao) => total + safeNumber(transacao.valor), 0),
  pendente: transacoes
    .filter((transacao) => transacao.tipo === "entrada" && transacao.status === "pendente")
    .reduce((total, transacao) => total + safeNumber(transacao.valor), 0),
  despesas: transacoes
    .filter((transacao) => transacao.tipo === "saida" && transacao.status === "confirmado")
    .reduce((total, transacao) => total + safeNumber(transacao.valor), 0),
  atrasado: transacoes
    .filter((transacao) => transacao.tipo === "entrada" && transacao.status === "atrasado")
    .reduce((total, transacao) => total + safeNumber(transacao.valor), 0),
  totalTransacoes: transacoes.length,
});

export type ResumoTransacoes = ReturnType<typeof resumirTransacoesContrato>;

export const getGarantiaLabel = (contrato: Pick<Contrato, "tipo_garantia" | "fiador_nome" | "caucao_valor" | "caucao_quantidade">) => {
  const tipo = contrato.tipo_garantia || "—";
  const label = GARANTIA_LABELS[tipo] || tipo;

  if (tipo === "caucao" && contrato.caucao_valor) {
    return `${label} (${contrato.caucao_quantidade || 1}x = ${formatCurrencyBRL(contrato.caucao_valor)})`;
  }
  if (tipo === "fiador" && contrato.fiador_nome) {
    return `${label}: ${contrato.fiador_nome}`;
  }
  return label;
};

export const getCustoMensalTotal = (contrato: Pick<Contrato, "valor" | "valor_condominio" | "valor_iptu" | "iptu_parcelado">) => {
  const aluguel = safeNumber(contrato.valor);
  const condominio = safeNumber(contrato.valor_condominio);
  const iptuAnual = safeNumber(contrato.valor_iptu);
  const iptuMensal = contrato.iptu_parcelado ? iptuAnual / 12 : 0;
  return { aluguel, condominio, iptuMensal, iptuAnual, total: aluguel + condominio + iptuMensal };
};