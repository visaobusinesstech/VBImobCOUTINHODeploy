/**
 * Amostragem de referências para o laudo no padrão antigo (Gamma).
 * Permite ajustar o tamanho da amostra e o critério de seleção dos comparáveis.
 */

export type CriterioAmostragem =
  | "similaridade"
  | "preco"
  | "area"
  | "recentes"
  | "original";

export interface ConfigAmostragem {
  /** Quantidade máxima de comparáveis exibidos no laudo. */
  tamanho: number;
  criterio: CriterioAmostragem;
  /** Restringe a amostra ao mesmo bairro do imóvel avaliado. */
  somenteMesmoBairro: boolean;
  /** Restringe a amostra ao mesmo tipo do imóvel avaliado. */
  somenteMesmoTipo: boolean;
  /** Desvio máximo de área em relação ao imóvel avaliado (%). 0 = sem limite. */
  toleranciaAreaPct: number;
}

export const AMOSTRAGEM_PADRAO: ConfigAmostragem = {
  tamanho: 10,
  criterio: "similaridade",
  somenteMesmoBairro: true,
  somenteMesmoTipo: true,
  toleranciaAreaPct: 30,
};

export const CRITERIOS_AMOSTRAGEM: { value: CriterioAmostragem; label: string }[] = [
  { value: "similaridade", label: "Mais similares (área + R$/m²)" },
  { value: "preco", label: "Preço mais próximo" },
  { value: "area", label: "Área mais próxima" },
  { value: "recentes", label: "Anúncios mais recentes" },
  { value: "original", label: "Ordem original" },
];

const norm = (v: unknown) =>
  String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export interface ResultadoAmostragem<T = any> {
  selecionados: T[];
  totalDisponivel: number;
  removidosPorFiltro: number;
  diagnosticoSelecao?: Array<{
    id: string;
    titulo: string;
    score: number;
    componentes: {
      area: number;
      pm2: number;
      bairro: number;
    };
    selecionado: boolean;
  }>;
}

export function aplicarAmostragem<T extends Record<string, any>>(
  comparaveis: T[],
  imovel: Record<string, any> | null | undefined,
  config: Partial<ConfigAmostragem> = {},
): ResultadoAmostragem<T> {
  const cfg = { ...AMOSTRAGEM_PADRAO, ...config };
  const lista = Array.isArray(comparaveis) ? comparaveis.filter(Boolean) : [];
  const totalDisponivel = lista.length;

  const bairroAlvo = norm(imovel?.bairro);
  const tipoAlvo = norm(imovel?.tipo);
  const areaAlvo = num(imovel?.area);
  const precoAlvo = num(imovel?.preco);
  const pm2Alvo = areaAlvo > 0 && precoAlvo > 0 ? precoAlvo / areaAlvo : 0;

  /** Referências marcadas como "forçadas" nunca são removidas pelos filtros nem pelo corte da amostra. */
  const isForcada = (c: any) => Boolean(c?.forcada || c?.forcada_manual);

  const filtrados = lista.filter((c) => {
    if (isForcada(c)) return true;
    if (cfg.somenteMesmoBairro && bairroAlvo && norm(c.bairro) !== bairroAlvo) return false;
    if (cfg.somenteMesmoTipo && tipoAlvo && norm(c.tipo) !== tipoAlvo) return false;
    if (cfg.toleranciaAreaPct > 0 && areaAlvo > 0) {
      const area = num(c.area);
      if (area <= 0) return false;
      const desvio = (Math.abs(area - areaAlvo) / areaAlvo) * 100;
      if (desvio > cfg.toleranciaAreaPct) return false;
    }
    return true;
  });

  const ordenados = [...filtrados];
  
  // Cache de scores para evitar recálculos durante o sort
  const scoresCache = new Map<string, number>();
  const diagnosticoCache = new Map<string, any>();

  const getScore = (c: any) => {
    const cached = scoresCache.get(c.id);
    if (cached !== undefined) return cached;

    let total = 0;
    let componentes = { area: 0, pm2: 0, bairro: 0 };

    if (cfg.criterio === "area" && areaAlvo > 0) {
      total = Math.abs(num(c.area) - areaAlvo);
    } else if (cfg.criterio === "preco" && precoAlvo > 0) {
      total = Math.abs(num(c.preco) - precoAlvo);
    } else if (cfg.criterio === "recentes") {
      total = num(c.dias_anuncio) > 0 ? num(c.dias_anuncio) : Number.MAX_SAFE_INTEGER;
    } else if (cfg.criterio === "similaridade") {
      let areaScore = 0;
      let pm2Score = 0;
      let bairroScore = 0;

      if (areaAlvo > 0 && num(c.area) > 0) {
        areaScore = (Math.abs(num(c.area) - areaAlvo) / areaAlvo) * 2;
      } else {
        areaScore = 2;
      }

      const pm2 = num(c.area) > 0 ? num(c.preco) / num(c.area) : 0;
      if (pm2Alvo > 0 && pm2 > 0) {
        pm2Score = Math.abs(pm2 - pm2Alvo) / pm2Alvo;
      } else {
        pm2Score = 1;
      }

      if (bairroAlvo && norm(c.bairro) !== bairroAlvo) {
        bairroScore = 5;
      }

      total = areaScore + pm2Score + bairroScore;
      componentes = { area: areaScore, pm2: pm2Score, bairro: bairroScore };
    }

    scoresCache.set(c.id, total);
    diagnosticoCache.set(c.id, { total, componentes });
    return total;
  };

  if (cfg.criterio !== "original") {
    ordenados.sort((a, b) => getScore(a) - getScore(b));
  }

  // Guardar diagnóstico de seleção para o retorno
  const diagnosticoSelecao = filtrados.map(c => {
    // Garantir que o score esteja no cache
    getScore(c);
    const s = diagnosticoCache.get(c.id) || { total: 0, componentes: { area: 0, pm2: 0, bairro: 0 } };
    return {
      id: String(c.id),
      titulo: String(c.titulo || "Sem título"),
      score: s.total,
      componentes: s.componentes,
      selecionado: false
    };
  });

  const tamanhoEfetivo = Math.max(1, Math.min(30, Math.round(cfg.tamanho) || AMOSTRAGEM_PADRAO.tamanho));
  const forcadas = ordenados.filter(isForcada);
  const demais = ordenados.filter((c) => !isForcada(c));
  const selecionadosFinal = [...forcadas, ...demais.slice(0, Math.max(0, tamanhoEfetivo - forcadas.length))];

  const selecionadosIdsFinal = new Set(selecionadosFinal.map(c => String(c.id)));
  diagnosticoSelecao.forEach(d => {
    d.selecionado = selecionadosIdsFinal.has(String(d.id));
  });

  return {
    selecionados: selecionadosFinal,
    totalDisponivel,
    removidosPorFiltro: totalDisponivel - filtrados.length,
    diagnosticoSelecao: diagnosticoSelecao.sort((a, b) => a.score - b.score)
  };
}

/**
 * Gera o texto de ajuda exibido no laudo explicando como as referências
 * da tabela de amostragem foram escolhidas e quais filtros impactaram a seleção.
 */
export function descreverAmostragem(
  cfg: ConfigAmostragem,
  resultado: Pick<ResultadoAmostragem, "selecionados" | "totalDisponivel" | "removidosPorFiltro">,
  imovel?: Record<string, any>,
): string {
  const criterioLabel =
    CRITERIOS_AMOSTRAGEM.find((c) => c.value === cfg.criterio)?.label ?? cfg.criterio;

  const filtros: string[] = [];
  if (cfg.somenteMesmoBairro) filtros.push(`mesmo bairro${imovel?.bairro ? ` (${imovel.bairro})` : ""}`);
  if (cfg.somenteMesmoTipo) filtros.push(`mesmo tipo${imovel?.tipo ? ` (${imovel.tipo})` : ""}`);
  if (cfg.toleranciaAreaPct > 0)
    filtros.push(
      `área com desvio máximo de ${cfg.toleranciaAreaPct}%${
        imovel?.area ? ` sobre ${imovel.area} m²` : ""
      }`,
    );

  const partes: string[] = [];
  partes.push(
    `Como as referências foram escolhidas: de ${resultado.totalDisponivel} imóvel(is) comparável(is) coletado(s) no mercado, ` +
      `${resultado.selecionados.length} foram exibido(s) nesta tabela, ordenados pelo critério "${criterioLabel}" ` +
      `(amostra máxima configurada: ${cfg.tamanho}).`,
  );
  partes.push(
    filtros.length
      ? `Filtros aplicados: ${filtros.join("; ")}. Esses filtros descartaram ${resultado.removidosPorFiltro} referência(s) antes da ordenação.`
      : "Nenhum filtro de bairro, tipo ou área foi aplicado — todas as referências coletadas concorreram à amostra.",
  );
  if (resultado.totalDisponivel - resultado.removidosPorFiltro > resultado.selecionados.length) {
    partes.push(
      `Outras ${
        resultado.totalDisponivel - resultado.removidosPorFiltro - resultado.selecionados.length
      } referência(s) elegível(is) ficaram fora por excederem o tamanho da amostra, mas seguem consideradas na análise estatística.`,
    );
  }
  const forcadasSel = (resultado.selecionados as any[]).filter((c) => c?.forcada || c?.forcada_manual);
  if (forcadasSel.length) {
    const detalhes = forcadasSel
      .map((c) => `${c.titulo || "Imóvel sem título"} (${c.motivo_forcada || c.motivoDescarte || "inclusão manual"})`)
      .join("; ");
    partes.push(
      `Referências forçadas (${forcadasSel.length}): incluídas manualmente pelo avaliador e mantidas na tabela mesmo contrariando os filtros acima — ${detalhes}.`,
    );
  }
  return partes.join(" ");
}

export interface CriterioAplicado {
  label: string;
  detalhe: string;
}

export interface MotivoSelecaoReferencia {
  titulo: string;
  motivo: string;
}

/** Lista legível dos critérios e filtros efetivamente aplicados na amostragem. */
export function listarCriteriosAmostragem(
  cfg: ConfigAmostragem,
  imovel?: Record<string, any>,
): CriterioAplicado[] {
  const criterioLabel =
    CRITERIOS_AMOSTRAGEM.find((c) => c.value === cfg.criterio)?.label ?? cfg.criterio;
  const itens: CriterioAplicado[] = [
    { label: "Critério de ordenação", detalhe: criterioLabel },
    { label: "Tamanho máximo da amostra", detalhe: `${cfg.tamanho} referência(s)` },
    {
      label: "Filtro de bairro",
      detalhe: cfg.somenteMesmoBairro
        ? `Somente ${imovel?.bairro || "o mesmo bairro do imóvel avaliado"}`
        : "Não aplicado (todos os bairros elegíveis)",
    },
    {
      label: "Filtro de tipo",
      detalhe: cfg.somenteMesmoTipo
        ? `Somente ${imovel?.tipo || "o mesmo tipo do imóvel avaliado"}`
        : "Não aplicado (todos os tipos elegíveis)",
    },
    {
      label: "Tolerância de área",
      detalhe:
        cfg.toleranciaAreaPct > 0
          ? `Desvio máximo de ${cfg.toleranciaAreaPct}%${imovel?.area ? ` sobre ${imovel.area} m²` : ""}`
          : "Não aplicada (sem limite de desvio de área)",
    },
  ];
  return itens;
}

/** Explica, referência a referência, por que ela entrou na seleção da amostragem. */
export function explicarSelecaoReferencias<T extends Record<string, any>>(
  selecionados: T[],
  cfg: ConfigAmostragem,
  imovel?: Record<string, any>,
): MotivoSelecaoReferencia[] {
  const areaAlvo = num(imovel?.area);
  const precoAlvo = num(imovel?.preco);
  const pm2Alvo = areaAlvo > 0 && precoAlvo > 0 ? precoAlvo / areaAlvo : 0;
  const bairroAlvo = norm(imovel?.bairro);
  const tipoAlvo = norm(imovel?.tipo);

  return (selecionados || []).map((c, idx) => {
    const titulo = String(c?.titulo || "Imóvel sem título");
    if (c?.forcada || c?.forcada_manual) {
      return {
        titulo,
        motivo: `Inclusão manual do avaliador (${c.motivo_forcada || c.motivoDescarte || "referência forçada"}) — mantida mesmo fora dos filtros.`,
      };
    }

    const razoes: string[] = [];
    razoes.push(`${idx + 1}ª posição pelo critério "${
      CRITERIOS_AMOSTRAGEM.find((x) => x.value === cfg.criterio)?.label ?? cfg.criterio
    }"`);

    const area = num(c?.area);
    if (areaAlvo > 0 && area > 0) {
      const desvio = (Math.abs(area - areaAlvo) / areaAlvo) * 100;
      razoes.push(`área de ${area} m² (desvio de ${desvio.toFixed(1)}% frente aos ${areaAlvo} m² do imóvel)`);
    }

    const pm2 = area > 0 ? num(c?.preco) / area : 0;
    if (pm2Alvo > 0 && pm2 > 0) {
      const dif = ((pm2 - pm2Alvo) / pm2Alvo) * 100;
      razoes.push(
        `R$/m² de ${Math.round(pm2).toLocaleString("pt-BR")} (${dif >= 0 ? "+" : ""}${dif.toFixed(1)}% vs. imóvel avaliado)`,
      );
    }

    if (bairroAlvo) {
      razoes.push(norm(c?.bairro) === bairroAlvo ? "mesmo bairro do imóvel" : `bairro ${c?.bairro || "não informado"}`);
    }
    if (tipoAlvo && norm(c?.tipo) === tipoAlvo) razoes.push("mesmo tipo de imóvel");
    if (num(c?.dias_anuncio) > 0) razoes.push(`${num(c.dias_anuncio)} dia(s) de anúncio`);

    return { titulo, motivo: `${razoes.join("; ")}.` };
  });
}

/**
 * Parâmetros exatos usados na amostragem, para auditoria e rastreabilidade do laudo.
 * Retorna pares label/valor com os valores brutos da configuração.
 */
export function parametrosAmostragemAuditoria(
  cfg: ConfigAmostragem,
  resultado?: ResultadoAmostragem,
  imovel?: Record<string, any>,
): { label: string; valor: string }[] {
  const criterioLabel =
    CRITERIOS_AMOSTRAGEM.find((c) => c.value === cfg.criterio)?.label ?? cfg.criterio;
  const itens: { label: string; valor: string }[] = [
    { label: "tamanho_amostra", valor: String(cfg.tamanho) },
    { label: "criterio", valor: `${cfg.criterio} (${criterioLabel})` },
    { label: "tolerancia_area_pct", valor: cfg.toleranciaAreaPct > 0 ? `${cfg.toleranciaAreaPct}%` : "0 (sem limite)" },
    { label: "somente_mesmo_bairro", valor: cfg.somenteMesmoBairro ? `true (${imovel?.bairro || "bairro do imóvel"})` : "false" },
    { label: "somente_mesmo_tipo", valor: cfg.somenteMesmoTipo ? `true (${imovel?.tipo || "tipo do imóvel"})` : "false" },
  ];
  if (resultado) {
    itens.push(
      { label: "referencias_disponiveis", valor: String(resultado.totalDisponivel) },
      { label: "removidas_por_filtro", valor: String(resultado.removidosPorFiltro) },
      { label: "referencias_no_laudo", valor: String(resultado.selecionados.length) },
    );
  }
  itens.push({
    label: "gerado_em",
    valor: new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }),
  });
  return itens;
}