export type CheckStatus = "ok" | "alerta" | "critico";

export interface CheckItem {
  id: string;
  categoria: string;
  titulo: string;
  status: CheckStatus;
  peso: number;
  detalhe: string;
  recomendacao: string;
}

export interface SeoCheckInput {
  titulo: string;
  slug: string;
  meta: string;
  introducao?: string;
  conclusao?: string;
  secoes?: Array<{ titulo?: string; conteudo?: string }>;
  tags?: string[];
  palavraChavePrincipal?: string;
}

function normalize(s: string) {
  return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function contem(hay: string, needle: string) {
  if (!needle) return false;
  return normalize(hay).includes(normalize(needle));
}
function countWords(s: string) {
  return (s || "").trim().split(/\s+/).filter(Boolean).length;
}

export function computeSeoChecks(input: SeoCheckInput): CheckItem[] {
  const { titulo, slug, meta, introducao = "", conclusao = "", secoes = [], tags = [] } = input;
  const kw = (input.palavraChavePrincipal ?? tags?.[0] ?? "").trim();
  const corpoTexto = [introducao, ...secoes.flatMap((s) => [s.titulo || "", s.conteudo || ""]), conclusao].join("\n");

  const items: CheckItem[] = [];
  const tituloLen = titulo.length;
  const metaLen = meta.length;
  const totalWords = countWords(corpoTexto);
  const kwOk = kw.length > 0;

  items.push({
    id: "title-len", categoria: "Meta Título", titulo: "Comprimento (50–60)", peso: 5,
    status: tituloLen >= 50 && tituloLen <= 60 ? "ok" : tituloLen >= 40 && tituloLen <= 70 ? "alerta" : "critico",
    detalhe: `${tituloLen} caracteres`,
    recomendacao: tituloLen < 40 ? "Título muito curto — aproveite espaço para incluir a keyword e um diferencial." :
                  tituloLen > 70 ? "Google trunca acima de ~60. Encurte mantendo a keyword no início." :
                  tituloLen < 50 || tituloLen > 60 ? "Ajuste para 50–60 caracteres para máxima exibição." :
                  "Comprimento ideal.",
  });
  items.push({
    id: "title-kw", categoria: "Meta Título", titulo: "Palavra-chave no título", peso: 5,
    status: !kwOk ? "alerta" : contem(titulo, kw) ? (contem(titulo.split(/\s+/).slice(0, 5).join(" "), kw) ? "ok" : "alerta") : "critico",
    detalhe: !kwOk ? "Informe a keyword principal" : contem(titulo, kw) ? "Presente no título" : "Ausente",
    recomendacao: !kwOk ? "Defina a keyword principal para calibrar os checks." :
                  !contem(titulo, kw) ? `Inclua "${kw}" no título — de preferência nos primeiros 60 caracteres.` :
                  "Se possível, mova a keyword para o início do título.",
  });

  items.push({
    id: "meta-len", categoria: "Meta Description", titulo: "Comprimento (120–160)", peso: 4,
    status: metaLen >= 120 && metaLen <= 160 ? "ok" : metaLen >= 80 && metaLen <= 180 ? "alerta" : "critico",
    detalhe: metaLen === 0 ? "Vazia" : `${metaLen} caracteres`,
    recomendacao: metaLen === 0 ? "Escreva uma meta com resumo + CTA (120–160)." :
                  metaLen < 120 ? "Aumente para 120–160 caracteres para melhor CTR." :
                  metaLen > 160 ? "Reduza para evitar truncamento no SERP." : "Comprimento ideal.",
  });
  items.push({
    id: "meta-kw", categoria: "Meta Description", titulo: "Palavra-chave na meta", peso: 3,
    status: !kwOk ? "alerta" : contem(meta, kw) ? "ok" : "critico",
    detalhe: !kwOk ? "Sem keyword definida" : contem(meta, kw) ? "Presente" : "Ausente",
    recomendacao: !kwOk ? "Defina a keyword principal." :
                  contem(meta, kw) ? "Presente — Google costuma destacar em negrito no SERP." :
                  `Inclua "${kw}" naturalmente na meta description.`,
  });
  items.push({
    id: "meta-cta", categoria: "Meta Description", titulo: "Chamada para ação (CTA)", peso: 2,
    status: /(saiba|descubra|conheça|veja|aprenda|baixe|solicite|clique|entenda|compare|calcule)/i.test(meta) ? "ok" : metaLen > 0 ? "alerta" : "critico",
    detalhe: metaLen === 0 ? "Meta vazia" : "Analisada por verbos de ação",
    recomendacao: "Use verbos como 'Descubra', 'Saiba', 'Compare' para elevar o CTR.",
  });

  const slugOk = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
  items.push({
    id: "slug-format", categoria: "URL/Slug", titulo: "Formato limpo (kebab-case)", peso: 4,
    status: slugOk ? "ok" : "critico",
    detalhe: slug || "vazio",
    recomendacao: slugOk ? "Formato correto." : "Use apenas minúsculas, números e hífens (sem acentos ou underscores).",
  });
  items.push({
    id: "slug-len", categoria: "URL/Slug", titulo: "Tamanho do slug (3–75)", peso: 2,
    status: slug.length >= 3 && slug.length <= 75 ? "ok" : slug.length > 0 ? "alerta" : "critico",
    detalhe: `${slug.length} caracteres`,
    recomendacao: slug.length > 75 ? "Encurte o slug para até ~75 caracteres." : slug.length < 3 ? "Slug muito curto." : "OK.",
  });
  items.push({
    id: "slug-kw", categoria: "URL/Slug", titulo: "Keyword no slug", peso: 3,
    status: !kwOk ? "alerta" : contem(slug.replace(/-/g, " "), kw) ? "ok" : "critico",
    detalhe: !kwOk ? "Sem keyword" : contem(slug.replace(/-/g, " "), kw) ? "Presente" : "Ausente",
    recomendacao: !kwOk ? "Defina a keyword." : contem(slug.replace(/-/g, " "), kw) ? "OK." : `Adicione "${kw}" ao slug.`,
  });

  const numH2 = secoes.filter((s) => (s.titulo || "").trim()).length;
  items.push({
    id: "struct-h2", categoria: "Estrutura", titulo: "Subtítulos (H2) suficientes", peso: 3,
    status: numH2 >= 3 ? "ok" : numH2 >= 1 ? "alerta" : "critico",
    detalhe: `${numH2} H2 identificado(s)`,
    recomendacao: numH2 < 3 ? "Adicione ao menos 3 H2 para melhorar escaneabilidade e cobertura semântica." : "Boa estrutura.",
  });
  const h2ComKw = kwOk ? secoes.some((s) => contem(s.titulo || "", kw)) : false;
  items.push({
    id: "struct-h2-kw", categoria: "Estrutura", titulo: "Keyword em algum H2", peso: 2,
    status: !kwOk ? "alerta" : h2ComKw ? "ok" : "alerta",
    detalhe: !kwOk ? "Sem keyword" : h2ComKw ? "Encontrada" : "Não encontrada",
    recomendacao: h2ComKw ? "OK." : "Inclua a keyword ou variação em pelo menos um H2.",
  });

  items.push({
    id: "content-len", categoria: "Conteúdo", titulo: "Tamanho do conteúdo (≥ 600 palavras)", peso: 4,
    status: totalWords >= 800 ? "ok" : totalWords >= 400 ? "alerta" : "critico",
    detalhe: `${totalWords} palavras`,
    recomendacao: totalWords < 400 ? "Amplie para 600+ palavras — conteúdo raso ranqueia mal." :
                  totalWords < 800 ? "Considere aprofundar para 800+ palavras." : "OK.",
  });
  if (kwOk) {
    const ocorrencias = (normalize(corpoTexto).match(new RegExp(normalize(kw).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
    const densidade = totalWords > 0 ? (ocorrencias / totalWords) * 100 : 0;
    items.push({
      id: "content-density", categoria: "Conteúdo", titulo: "Densidade da keyword (0,5%–2%)", peso: 3,
      status: densidade >= 0.5 && densidade <= 2 ? "ok" : densidade > 0 && densidade < 3 ? "alerta" : "critico",
      detalhe: `${ocorrencias} ocorrência(s) — ${densidade.toFixed(2)}%`,
      recomendacao: densidade === 0 ? `Use "${kw}" ao longo do texto (sem stuffing).` :
                    densidade > 2 ? "Reduza repetições — parece keyword stuffing." :
                    densidade < 0.5 ? "Aumente ligeiramente o uso natural da keyword." : "OK.",
    });
    items.push({
      id: "content-intro-kw", categoria: "Conteúdo", titulo: "Keyword nos primeiros 100 caracteres", peso: 2,
      status: contem(introducao.slice(0, 200), kw) ? "ok" : "alerta",
      detalhe: contem(introducao.slice(0, 200), kw) ? "Presente na introdução" : "Ausente",
      recomendacao: contem(introducao.slice(0, 200), kw) ? "OK." : "Cite a keyword logo no início do texto.",
    });
  }

  items.push({
    id: "tags", categoria: "Taxonomia", titulo: "Tags/tópicos definidos (3–8)", peso: 1,
    status: tags.length >= 3 && tags.length <= 8 ? "ok" : tags.length > 0 ? "alerta" : "critico",
    detalhe: `${tags.length} tag(s)`,
    recomendacao: tags.length === 0 ? "Adicione 3 a 8 tags relevantes." :
                  tags.length < 3 ? "Adicione mais tags para conectar a conteúdos relacionados." :
                  tags.length > 8 ? "Reduza — muitas tags diluem o foco." : "OK.",
  });

  const frases = corpoTexto.split(/[.!?]+/).map((f) => f.trim()).filter(Boolean);
  const mediaPorFrase = frases.length > 0 ? totalWords / frases.length : 0;
  items.push({
    id: "readability", categoria: "Legibilidade", titulo: "Frases curtas (< 25 palavras/média)", peso: 2,
    status: frases.length === 0 ? "critico" : mediaPorFrase <= 22 ? "ok" : mediaPorFrase <= 30 ? "alerta" : "critico",
    detalhe: frases.length === 0 ? "Sem conteúdo" : `${mediaPorFrase.toFixed(1)} palavras/frase`,
    recomendacao: mediaPorFrase > 25 ? "Quebre frases longas para elevar a legibilidade." : "OK.",
  });

  return items;
}

export function getCriticalChecks(items: CheckItem[]): CheckItem[] {
  return items.filter((c) => c.status === "critico");
}
