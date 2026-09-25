export interface PerfilClienteOption {
  value: string;
  label: string;
  descricao: string;
}

/**
 * Perfis de cliente usados na segmentação dos fluxos de nutrição.
 * O casamento é feito contra os campos `tipo_operacao` e `finalidade` do lead.
 */
export const PERFIS_CLIENTE: PerfilClienteOption[] = [
  { value: "comprador", label: "Comprador", descricao: "Operação de compra/venda" },
  { value: "locatario", label: "Locatário", descricao: "Operação de locação/aluguel" },
  { value: "investidor", label: "Investidor", descricao: "Finalidade investimento/renda" },
  { value: "moradia", label: "Moradia própria", descricao: "Finalidade moradia/residencial" },
  { value: "proprietario", label: "Proprietário", descricao: "Quer anunciar / captação" },
];

const PERFIL_MATCHERS: Record<string, RegExp> = {
  comprador: /(compra|comprar|venda|aquisic)/i,
  locatario: /(loca|alug|rent)/i,
  investidor: /(investi|renda|rentab)/i,
  moradia: /(moradia|residenc|morar|propria|própria)/i,
  proprietario: /(propriet|captac|captaç|anunciar)/i,
};

export const MOTIVOS_PERDA_PADRAO = [
  "Preço acima do orçamento",
  "Comprou/alugou com outra imobiliária",
  "Sem crédito aprovado",
  "Desistiu da mudança",
  "Sem resposta",
  "Imóvel indisponível",
  "Localização não atendeu",
];

export interface LeadSegmentavel {
  estagio?: string | null;
  tipo_operacao?: string | null;
  finalidade?: string | null;
  interesse?: string | null;
  motivo_perda?: string | null;
}

export interface SegmentacaoFluxo {
  segmento_estagios?: string[] | null;
  segmento_perfis?: string[] | null;
  segmento_motivos_perda?: string[] | null;
}

const norm = (v?: string | null) =>
  (v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

export function leadCombinaPerfil(lead: LeadSegmentavel, perfil: string): boolean {
  const re = PERFIL_MATCHERS[perfil];
  if (!re) return true;
  const alvo = `${lead.tipo_operacao ?? ""} ${lead.finalidade ?? ""} ${lead.interesse ?? ""}`;
  return re.test(alvo);
}

/** Listas vazias significam "sem restrição" (fluxo vale para todos). */
export function leadCombinaSegmentacao(lead: LeadSegmentavel, seg: SegmentacaoFluxo): boolean {
  const estagios = seg.segmento_estagios ?? [];
  const perfis = seg.segmento_perfis ?? [];
  const motivos = seg.segmento_motivos_perda ?? [];

  if (estagios.length > 0 && !estagios.map(norm).includes(norm(lead.estagio))) return false;
  if (perfis.length > 0 && !perfis.some((p) => leadCombinaPerfil(lead, p))) return false;
  if (motivos.length > 0 && !motivos.map(norm).includes(norm(lead.motivo_perda))) return false;

  return true;
}

export function resumoSegmentacao(seg: SegmentacaoFluxo): string[] {
  const out: string[] = [];
  const estagios = seg.segmento_estagios ?? [];
  const perfis = seg.segmento_perfis ?? [];
  const motivos = seg.segmento_motivos_perda ?? [];
  if (estagios.length) out.push(`Etapas: ${estagios.join(", ")}`);
  if (perfis.length)
    out.push(
      `Perfis: ${perfis
        .map((p) => PERFIS_CLIENTE.find((o) => o.value === p)?.label ?? p)
        .join(", ")}`,
    );
  if (motivos.length) out.push(`Perda: ${motivos.join(", ")}`);
  return out;
}
