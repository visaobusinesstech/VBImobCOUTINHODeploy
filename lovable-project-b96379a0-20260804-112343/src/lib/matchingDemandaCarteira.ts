import type { Lead } from "@/hooks/useLeads";
import type { Imovel } from "@/hooks/useImoveis";

export interface MatchCriterio {
  label: string;
  ok: boolean;
  /** Peso relativo do critério dentro do score final (0-100 normalizado). */
  peso: number;
  /** Pontuação parcial obtida (0..peso) — permite match parcial (ex.: 2 de 3 amenidades). */
  pontos: number;
  detalhe?: string;
  /** Critério eliminatório: se falhar, o match é descartado. */
  eliminatorio?: boolean;
}

export interface MatchResultado {
  imovel: Imovel;
  score: number;
  criterios: MatchCriterio[];
  /** True quando algum critério eliminatório falhou. */
  bloqueado: boolean;
}

export interface LeadComMatches {
  lead: Lead;
  matches: MatchResultado[];
  melhorScore: number;
}

export const norm = (v?: string | null) =>
  (v || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

/** Tolerância de preço: o imóvel entra se estiver entre -25% e +10% do orçamento do lead. */
export const PRECO_MIN_FATOR = 0.75;
export const PRECO_MAX_FATOR = 1.1;

/** Amenidades reconhecidas pelo motor (usadas no perfil do lead e do imóvel). */
export const AMENIDADES_CATALOGO = [
  "Piscina",
  "Academia",
  "Churrasqueira",
  "Varanda gourmet",
  "Segurança 24h",
  "Portaria",
  "Elevador",
  "Salão de festas",
  "Playground",
  "Quadra",
  "Mobiliado",
  "Aceita pet",
  "Área de lazer",
  "Próximo a escolas",
  "Próximo ao metrô",
] as const;

export const FINALIDADES = ["Moradia", "Investimento", "Comercial"] as const;
export const URGENCIAS = ["Alta", "Média", "Baixa"] as const;
export const ESTADOS_CONSERVACAO = ["Novo", "Usado", "Em construção", "Reformado"] as const;

const ALUGUEL = ["aluguel", "locacao"];

const operacaoCompativel = (leadOp?: string | null, imovelOp?: string | null) => {
  const l = norm(leadOp);
  const i = norm(imovelOp);
  if (!l || !i) return true;
  if (l === i) return true;
  if (ALUGUEL.includes(l) && ALUGUEL.includes(i)) return true;
  return false;
};

const textoImovel = (imovel: Imovel) =>
  norm(
    [
      imovel.titulo,
      imovel.descricao,
      ...(imovel.caracteristicas || []),
      imovel.posicao_solar,
      imovel.estado_conservacao,
    ]
      .filter(Boolean)
      .join(" "),
  );

const temAmenidade = (texto: string, amenidade: string) => {
  const a = norm(amenidade);
  if (!a) return false;
  if (texto.includes(a)) return true;
  // tolerância para variações comuns
  const alias: Record<string, string[]> = {
    "seguranca 24h": ["seguranca", "portaria 24", "vigilancia"],
    "varanda gourmet": ["varanda", "sacada gourmet"],
    "aceita pet": ["pet friendly", "aceita animais", "pet"],
    "proximo a escolas": ["escola", "colegio"],
    "proximo ao metro": ["metro"],
    "area de lazer": ["lazer"],
    "salao de festas": ["salao"],
  };
  return (alias[a] || []).some((t) => texto.includes(t));
};

const listaLocalizacoes = (lead: Lead) =>
  [lead.bairro_interesse, ...(lead.bairros_interesse || [])].map(norm).filter(Boolean);

const orcamentoLead = (lead: Lead) => Number(lead.valor_maximo) || Number(lead.valor) || 0;

export function calcularMatch(lead: Lead, imovel: Imovel): MatchResultado {
  const criterios: MatchCriterio[] = [];
  const push = (c: Omit<MatchCriterio, "pontos"> & { pontos?: number }) =>
    criterios.push({ ...c, pontos: c.pontos ?? (c.ok ? c.peso : 0) });

  // 1. Operação — eliminatório
  const opOk = operacaoCompativel(lead.tipo_operacao, imovel.operacao);
  push({
    label: "Operação",
    ok: opOk,
    peso: 18,
    eliminatorio: true,
    detalhe: `${lead.tipo_operacao || "—"} × ${imovel.operacao || "—"}`,
  });

  // 2. Disponibilidade — eliminatório
  const st = norm(imovel.status);
  const disponivel = !st || ["disponivel", "ativo"].includes(st);
  push({
    label: "Disponível",
    ok: disponivel,
    peso: 6,
    eliminatorio: true,
    detalhe: imovel.status || "—",
  });

  // 3. Tipo de imóvel
  const leadTipo = norm(lead.tipo_imovel_interesse);
  const imovelTipo = norm(imovel.tipo);
  const tipoOk =
    !leadTipo || !imovelTipo || leadTipo === imovelTipo || imovelTipo.includes(leadTipo) || leadTipo.includes(imovelTipo);
  push({
    label: "Tipo",
    ok: tipoOk,
    peso: 14,
    detalhe: `${lead.tipo_imovel_interesse || "sem preferência"} × ${imovel.tipo || "—"}`,
  });

  // 4. Localização (bairro principal + lista de bairros de interesse)
  const bairros = listaLocalizacoes(lead);
  const imovelBairro = norm(imovel.bairro);
  const imovelCidade = norm(imovel.cidade);
  const localOk =
    bairros.length === 0 ||
    !imovelBairro ||
    bairros.some((b) => b === imovelBairro || imovelBairro.includes(b) || b.includes(imovelBairro) || b === imovelCidade);
  push({
    label: "Localização",
    ok: localOk,
    peso: 16,
    detalhe: `${bairros.length ? [lead.bairro_interesse, ...(lead.bairros_interesse || [])].filter(Boolean).join(", ") : "sem preferência"} × ${
      [imovel.bairro, imovel.cidade].filter(Boolean).join(" · ") || "—"
    }`,
  });

  // 5. Faixa de preço / orçamento máximo
  const alvo = orcamentoLead(lead);
  const preco = Number(imovel.preco) || 0;
  let precoOk = true;
  let precoPontos = 15;
  let precoDetalhe = "sem orçamento informado";
  if (alvo > 0 && preco > 0) {
    const teto = lead.valor_maximo ? Number(lead.valor_maximo) : alvo * PRECO_MAX_FATOR;
    precoOk = preco <= teto && preco >= alvo * PRECO_MIN_FATOR;
    const dif = ((preco - alvo) / alvo) * 100;
    precoDetalhe = `${dif >= 0 ? "+" : ""}${dif.toFixed(0)}% do orçamento (${fmt(preco)} × teto ${fmt(teto)})`;
    precoPontos = precoOk ? 15 : preco <= teto * 1.05 ? 8 : 0;
  }
  push({ label: "Preço", ok: precoOk, peso: 15, pontos: precoPontos, detalhe: precoDetalhe });

  // 6. Área mínima
  const areaMin = Number(lead.area_minima) || 0;
  const area = Number(imovel.area) || 0;
  const areaOk = !areaMin || !area || area >= areaMin;
  push({
    label: "Área",
    ok: areaOk,
    peso: 8,
    pontos: areaOk ? 8 : area >= areaMin * 0.9 ? 4 : 0,
    detalhe: areaMin ? `mín. ${areaMin}m² × ${area || "—"}m²` : "sem exigência",
  });

  // 7. Cômodos (quartos, suítes, banheiros, vagas)
  const comodos: Array<[string, number, number]> = [
    ["quartos", Number(lead.quartos_minimo) || 0, Number(imovel.quartos) || 0],
    ["suítes", Number(lead.suites_minimo) || 0, Number(imovel.suites) || 0],
    ["banheiros", Number(lead.banheiros_minimo) || 0, Number(imovel.banheiros) || 0],
    ["vagas", Number(lead.vagas_minimo) || 0, Number(imovel.vagas) || 0],
  ];
  const exigidos = comodos.filter(([, min]) => min > 0);
  const atendidos = exigidos.filter(([, min, val]) => val >= min);
  const comodosOk = exigidos.length === 0 || atendidos.length === exigidos.length;
  push({
    label: "Cômodos",
    ok: comodosOk,
    peso: 12,
    pontos: exigidos.length === 0 ? 12 : Math.round((atendidos.length / exigidos.length) * 12),
    detalhe: exigidos.length
      ? exigidos.map(([nome, min, val]) => `${nome}: mín ${min} × ${val}`).join(" | ")
      : "sem exigência",
  });

  // 8. Amenidades procuradas
  const desejadas = (lead.amenidades_desejadas || []).filter(Boolean);
  const texto = textoImovel(imovel);
  const encontradas = desejadas.filter((a) => temAmenidade(texto, a));
  const amenOk = desejadas.length === 0 || encontradas.length === desejadas.length;
  push({
    label: "Amenidades",
    ok: amenOk,
    peso: 8,
    pontos: desejadas.length === 0 ? 8 : Math.round((encontradas.length / desejadas.length) * 8),
    detalhe: desejadas.length
      ? `${encontradas.length}/${desejadas.length}: ${desejadas.map((a) => `${encontradas.includes(a) ? "✓" : "✕"} ${a}`).join(", ")}`
      : "sem exigência",
  });

  // 9. Finalidade × perfil do imóvel
  const fin = norm(lead.finalidade);
  let finOk = true;
  let finDetalhe = "sem finalidade definida";
  if (fin) {
    if (fin === "comercial") {
      finOk = ["comercial", "sala", "loja", "galpao", "terreno"].some((t) => imovelTipo.includes(t));
    } else if (fin === "investimento") {
      finOk = true; // qualquer imóvel serve; prioriza estado novo/em construção
    } else {
      finOk = !["comercial", "sala", "loja", "galpao"].some((t) => imovelTipo.includes(t));
    }
    finDetalhe = `${lead.finalidade} × ${imovel.tipo || "—"}`;
  }
  push({ label: "Finalidade", ok: finOk, peso: 3, detalhe: finDetalhe });

  const bloqueado = criterios.some((c) => c.eliminatorio && !c.ok);
  const totalPeso = criterios.reduce((s, c) => s + c.peso, 0);
  const totalPontos = criterios.reduce((s, c) => s + c.pontos, 0);
  const score = Math.round((totalPontos / (totalPeso || 1)) * 100);

  return { imovel, score: bloqueado ? Math.min(score, 39) : score, criterios, bloqueado };
}

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v || 0);

export interface CruzarOptions {
  /** Score mínimo (0-100) para o imóvel aparecer como sugestão. */
  scoreMinimo?: number;
  /** Limite de imóveis sugeridos por lead. */
  limitePorLead?: number;
  /** Status de imóveis considerados disponíveis. */
  statusDisponiveis?: string[];
}

/** Ordem de prioridade dos leads pela urgência declarada. */
const pesoUrgencia = (lead: Lead) => {
  const u = norm(lead.urgencia);
  if (u === "alta") return 3;
  if (u === "media") return 2;
  if (u === "baixa") return 1;
  return 0;
};

export function cruzarDemandaCarteira(
  leads: Lead[],
  imoveis: Imovel[],
  options: CruzarOptions = {},
): LeadComMatches[] {
  const { scoreMinimo = 60, limitePorLead = 5, statusDisponiveis = ["disponivel", "ativo"] } = options;
  const permitidos = statusDisponiveis.map(norm);

  const disponiveis = imoveis.filter((i) => {
    const s = norm(i.status);
    if (!s) return true;
    return permitidos.includes(s);
  });

  return leads
    .map((lead) => {
      const matches = disponiveis
        .map((imovel) => calcularMatch(lead, imovel))
        .filter((m) => !m.bloqueado && m.score >= scoreMinimo)
        .sort((a, b) => b.score - a.score)
        .slice(0, limitePorLead);

      return { lead, matches, melhorScore: matches[0]?.score ?? 0 };
    })
    .sort(
      (a, b) =>
        pesoUrgencia(b.lead) - pesoUrgencia(a.lead) ||
        b.melhorScore - a.melhorScore ||
        b.matches.length - a.matches.length,
    );
}

/** Agrega a demanda: quantos leads procuram cada combinação bairro + tipo. */
export interface DemandaAgregada {
  chave: string;
  bairro: string;
  tipo: string;
  leads: number;
  imoveisNaCarteira: number;
  ticketMedio: number;
  urgentes: number;
}

export function agregarDemanda(leads: Lead[], imoveis: Imovel[]): DemandaAgregada[] {
  const mapa = new Map<string, { bairro: string; tipo: string; leads: Lead[] }>();

  for (const lead of leads) {
    const bairros = [lead.bairro_interesse, ...(lead.bairros_interesse || [])].filter(Boolean);
    const alvos = bairros.length ? bairros : ["Sem bairro definido"];
    const tipo = lead.tipo_imovel_interesse?.trim() || "Sem tipo definido";
    for (const bairroRaw of alvos) {
      const bairro = String(bairroRaw).trim();
      const chave = `${norm(bairro)}|${norm(tipo)}`;
      const atual = mapa.get(chave) || { bairro, tipo, leads: [] };
      atual.leads.push(lead);
      mapa.set(chave, atual);
    }
  }

  return Array.from(mapa.entries())
    .map(([chave, v]) => {
      const imoveisNaCarteira = imoveis.filter((i) => {
        const bOk = norm(i.bairro) === norm(v.bairro);
        const tOk = norm(i.tipo) === norm(v.tipo);
        return bOk && tOk;
      }).length;
      const valores = v.leads.map((l) => orcamentoLead(l)).filter((n) => n > 0);
      const ticketMedio = valores.length ? valores.reduce((s, n) => s + n, 0) / valores.length : 0;
      return {
        chave,
        bairro: v.bairro,
        tipo: v.tipo,
        leads: v.leads.length,
        imoveisNaCarteira,
        ticketMedio,
        urgentes: v.leads.filter((l) => norm(l.urgencia) === "alta").length,
      };
    })
    .sort((a, b) => b.leads - a.leads);
}
