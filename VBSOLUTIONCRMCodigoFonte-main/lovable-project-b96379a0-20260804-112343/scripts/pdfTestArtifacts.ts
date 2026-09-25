/**
 * Gera artefatos de revisão para o CI do PDF Premium:
 *  - PDFs reais dos cenários de avaliação (sempre, para permitir comparação)
 *  - Um resumo em HTML (index.html) com falhas, mensagens e links dos PDFs
 *  - metrics.json com páginas/tamanho/hash de cada PDF (baseline da próxima execução)
 *  - Comparação com a execução anterior (mudanças relevantes por cenário)
 *
 * Uso: bun scripts/pdfTestArtifacts.ts [junit.xml] [dir-saida] [dir-baseline]
 * Padrões: ./pdf-premium-junit.xml → ./pdf-test-artifacts (baseline: ./pdf-baseline)
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

const junitPath = process.argv[2] || "pdf-premium-junit.xml";
const outDir = process.argv[3] || "pdf-test-artifacts";
const baselineDir = process.argv[4] || "pdf-baseline";


type Caso = {
  suite: string;
  nome: string;
  falhou: boolean;
  mensagem?: string;
  detalhe?: string;
  tempo?: string;
};

function decode(s: string) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#10;/g, "\n")
    .replace(/&#13;/g, "")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function parseJunit(xml: string): Caso[] {
  const casos: Caso[] = [];
  const suiteRe = /<testsuite\b[^>]*name="([^"]*)"[^>]*>([\s\S]*?)<\/testsuite>/g;
  let sm: RegExpExecArray | null;
  const push = (suite: string, bloco: string) => {
    const caseRe = /<testcase\b([^>]*?)\s*(?:\/>|>([\s\S]*?)<\/testcase>)/g;
    let cm: RegExpExecArray | null;
    while ((cm = caseRe.exec(bloco))) {
      const attrs = cm[1];
      const corpo = cm[2] || "";
      const nome = decode(/name="([^"]*)"/.exec(attrs)?.[1] || "(sem nome)");
      const tempo = /time="([^"]*)"/.exec(attrs)?.[1];
      const fail = /<(failure|error)\b([^>]*)(\/>|>([\s\S]*?)<\/\1>)/.exec(corpo);
      casos.push({
        suite,
        nome,
        tempo,
        falhou: Boolean(fail),
        mensagem: fail ? decode(/message="([^"]*)"/.exec(fail[2])?.[1] || "Falha") : undefined,
        detalhe: fail ? decode((fail[4] || "").trim()) : undefined,
      });
    }
  };
  while ((sm = suiteRe.exec(xml))) push(decode(sm[1]), sm[2]);
  if (!casos.length) push("(suite)", xml);
  return casos;
}

// ── Cenários usados para materializar os PDFs de revisão ──────────────
const comparaveis = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    titulo: `Comparável ${i + 1}`,
    area: 60 + (i % 5) * 4,
    preco: 480_000 + i * 12_000,
    dias_anuncio: 15 + i * 4,
  }));

const cenarios = [
  { id: "sem-comparaveis", nome: "Sem comparáveis (0)", n: 0 },
  { id: "poucos-comparaveis", nome: "Poucos comparáveis (3)", n: 3 },
  { id: "doze-comparaveis", nome: "Doze comparáveis (12)", n: 12 },
  { id: "acima-do-limite", nome: "Acima do limite (20)", n: 20 },
];

function fixture(n: number) {
  return {
    imovel: {
      tipo: "Apartamento",
      titulo: "Apartamento de revisão do CI",
      endereco: "SQN 210, Bloco A",
      bairro: "Asa Norte",
      cidade: "Brasília",
      estado: "DF",
      area: 78,
      quartos: 3,
      suites: 1,
      vagas: 1,
      preco: 890_000,
      fotos: [],
    },
    avaliacao: {
      valor_ideal: 870_000,
      valor_minimo: 830_000,
      valor_maximo: 910_000,
      preco_m2_estimado: 11_150,
      score_liquidez: 72,
      preco_competitivo: true,
      rating_ia: 8.4,
      pontos_fortes: ["Localização consolidada", "Reformado", "Vaga coberta"],
      pontos_atencao: ["Condomínio acima da média"],
      estrategia: "Anunciar no valor ideal com campanha de 30 dias.",
    },
    comparaveis: comparaveis(n),
  };
}

type Pdf = {
  id: string;
  arquivo: string;
  nome: string;
  erro?: string;
  bytes?: number;
  paginas?: number;
  hash?: string;
};

async function gerarPdfs(): Promise<Pdf[]> {
  const gerados: Pdf[] = [];
  let exportar: any;
  try {
    ({ exportAvaliacaoPremiumPDF: exportar } = await import("../src/lib/exportAvaliacaoPremiumPDF"));
  } catch (e) {
    return [{ id: "import", arquivo: "", nome: "import", erro: String(e) }];
  }
  for (const c of cenarios) {
    const arquivo = `avaliacao-${c.id}.pdf`;
    try {
      const f = fixture(c.n);
      const doc = await exportar({
        ...f,
        brandName: "radarimobtech",
        corretorInfo: { nome: "Revisão CI", creci: "0000" },
        skipSave: true,
      });
      const buf = Buffer.from(doc.output("arraybuffer"));
      writeFileSync(join(outDir, arquivo), buf);
      let paginas: number | undefined;
      try {
        paginas = doc.getNumberOfPages?.() ?? doc.internal?.getNumberOfPages?.();
      } catch {
        paginas = undefined;
      }
      // Hash do conteúdo textual (ignora metadados voláteis como data de criação).
      const texto = buf
        .toString("latin1")
        .replace(/\/CreationDate\s*\([^)]*\)/g, "")
        .replace(/\/ModDate\s*\([^)]*\)/g, "")
        .replace(/\/ID\s*\[[^\]]*\]/g, "");
      const hash = createHash("sha256").update(texto).digest("hex").slice(0, 16);
      gerados.push({ id: c.id, arquivo, nome: c.nome, bytes: buf.length, paginas, hash });
    } catch (e) {
      gerados.push({ id: c.id, arquivo, nome: c.nome, erro: String(e) });
    }
  }
  return gerados;
}

// ── Comparação com a execução anterior ────────────────────────────────
type Mudanca = {
  nome: string;
  tipo: "novo" | "removido" | "alterado" | "igual" | "quebrou" | "corrigido";
  detalhes: string[];
};

function fmtBytes(n?: number) {
  return typeof n === "number" ? `${(n / 1024).toFixed(1)} KB` : "—";
}

function compararPdfs(atual: Pdf[], anterior: Pdf[]): Mudanca[] {
  const antPorId = new Map(anterior.map((p) => [p.id, p]));
  const mudancas: Mudanca[] = [];

  for (const a of atual) {
    const b = antPorId.get(a.id);
    antPorId.delete(a.id);
    if (!b) {
      mudancas.push({ nome: a.nome, tipo: "novo", detalhes: [`${a.paginas ?? "?"} págs · ${fmtBytes(a.bytes)}`] });
      continue;
    }
    if (a.erro && !b.erro) {
      mudancas.push({ nome: a.nome, tipo: "quebrou", detalhes: [String(a.erro).slice(0, 200)] });
      continue;
    }
    if (!a.erro && b.erro) {
      mudancas.push({ nome: a.nome, tipo: "corrigido", detalhes: ["Geração voltou a funcionar"] });
      continue;
    }
    const det: string[] = [];
    if (a.paginas !== b.paginas) det.push(`páginas: ${b.paginas ?? "?"} → ${a.paginas ?? "?"}`);
    if (typeof a.bytes === "number" && typeof b.bytes === "number" && a.bytes !== b.bytes) {
      const delta = a.bytes - b.bytes;
      const pct = b.bytes ? ((delta / b.bytes) * 100).toFixed(1) : "—";
      det.push(`tamanho: ${fmtBytes(b.bytes)} → ${fmtBytes(a.bytes)} (${delta > 0 ? "+" : ""}${pct}%)`);
    }
    if (a.hash !== b.hash) det.push(`conteúdo alterado (hash ${b.hash ?? "—"} → ${a.hash ?? "—"})`);
    mudancas.push({ nome: a.nome, tipo: det.length ? "alterado" : "igual", detalhes: det });
  }

  for (const b of antPorId.values()) {
    mudancas.push({ nome: b.nome, tipo: "removido", detalhes: ["Cenário não existe mais nesta execução"] });
  }
  return mudancas;
}

function compararTestes(atuais: Caso[], anteriores: Caso[]) {
  const chave = (c: Caso) => `${c.suite}::${c.nome}`;
  const ant = new Map(anteriores.map((c) => [chave(c), c]));
  const novasFalhas: string[] = [];
  const corrigidos: string[] = [];
  const novosTestes: string[] = [];
  for (const c of atuais) {
    const b = ant.get(chave(c));
    if (!b) {
      novosTestes.push(c.nome);
      if (c.falhou) novasFalhas.push(c.nome);
      continue;
    }
    if (c.falhou && !b.falhou) novasFalhas.push(c.nome);
    if (!c.falhou && b.falhou) corrigidos.push(c.nome);
    ant.delete(chave(c));
  }
  const removidos = [...ant.values()].map((c) => c.nome);
  return { novasFalhas, corrigidos, novosTestes, removidos };
}

const rotuloMudanca: Record<Mudanca["tipo"], string> = {
  novo: "novo cenário",
  removido: "removido",
  alterado: "mudou",
  igual: "sem mudança",
  quebrou: "quebrou",
  corrigido: "corrigido",
};

async function main() {
  mkdirSync(outDir, { recursive: true });

  const xml = existsSync(junitPath) ? readFileSync(junitPath, "utf8") : "";
  const casos = xml ? parseJunit(xml) : [];
  const falhas = casos.filter((c) => c.falhou);

  // Os PDFs são gerados sempre, para que a comparação entre execuções
  // detecte mudanças mesmo quando todos os testes passam.
  const pdfs = await gerarPdfs();

  // Baseline: metrics.json da execução anterior (artefato baixado pelo CI).
  let baseline: { pdfs: Pdf[]; casos: Caso[]; geradoEm?: string; runId?: string } | null = null;
  const baselineFile = existsSync(baselineDir) ? join(baselineDir, "metrics.json") : "";
  if (baselineFile && existsSync(baselineFile)) {
    try {
      baseline = JSON.parse(readFileSync(baselineFile, "utf8"));
    } catch (e) {
      console.warn("[pdf-artifacts] baseline inválido:", String(e));
    }
  }

  const mudancas = baseline ? compararPdfs(pdfs, baseline.pdfs || []) : [];
  const difTestes = baseline
    ? compararTestes(casos, baseline.casos || [])
    : { novasFalhas: [], corrigidos: [], novosTestes: [], removidos: [] };
  const relevantes = mudancas.filter((m) => m.tipo !== "igual");

  writeFileSync(
    join(outDir, "metrics.json"),
    JSON.stringify(
      {
        geradoEm: new Date().toISOString(),
        runId: process.env.GITHUB_RUN_ID || null,
        commit: process.env.GITHUB_SHA || null,
        pdfs,
        casos: casos.map((c) => ({ suite: c.suite, nome: c.nome, falhou: c.falhou })),
      },
      null,
      2,
    ),
    "utf8",
  );

  const total = casos.length;
  const ok = total - falhas.length;
  const status = falhas.length ? "FALHOU" : "PASSOU";
  const cor = falhas.length ? "#b24a3c" : "#4c8a64";

  const mapaMudanca = new Map(mudancas.map((m) => [m.nome, m]));
  const idFalha = (i: number) => `falha-${i + 1}`;

  // Arquivo de origem da falha (primeiro caminho do stack) e texto indexado
  // para a busca da página de revisão.
  const arquivoDaFalha = (f: Caso) => {
    const txt = `${f.detalhe || ""}\n${f.mensagem || ""}`;
    const m = /(?:^|[\s(])((?:\.\/|\/)?(?:[\w.-]+\/)*[\w.-]+\.(?:tsx?|jsx?|mts|cts))(?::\d+)?/m.exec(txt);
    return m ? m[1].replace(/^\.\//, "") : "";
  };
  const textoBusca = (f: Caso) =>
    `${f.nome} ${f.suite} ${arquivoDaFalha(f)} ${(f.mensagem || "").slice(0, 600)} ${(f.detalhe || "").slice(0, 900)}`
      .toLowerCase()
      .replace(/\s+/g, " ");
  // Chaves estáveis usadas para persistir o estado "revisado" no navegador.
  const chaveFalha = (f: Caso, i: number) => `falha::${f.suite}::${f.nome || i}`;
  const chaveCenario = (nome: string) => `cenario::${nome}`;
  const suitesFalhas = Array.from(new Set(falhas.map((f) => f.suite))).sort();
  const arquivosFalhas = Array.from(new Set(falhas.map(arquivoDaFalha).filter(Boolean))).sort();


  const html = `<!doctype html>

<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>PDF Premium · revisão do PR</title>
<style>
  :root{--navy:#0B1F3A;--gold:#C9A84C;--paper:#F5F3EE;--ink:#1A202C;--rule:#D6D0C2;--muted:#788091}
  *{box-sizing:border-box}
  body{margin:0;background:var(--paper);color:var(--ink);font:15px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
  header{background:var(--navy);color:#fff;padding:22px 28px;border-bottom:4px solid var(--gold);position:sticky;top:0;z-index:10}
  h1{margin:0;font-size:19px;letter-spacing:.02em}
  .sub{opacity:.78;font-size:13px;margin-top:6px}
  .status{color:#fff;background:${cor};border-radius:999px;padding:3px 12px;font-size:12px;font-weight:600}
  .layout{display:grid;grid-template-columns:300px 1fr;gap:0;min-height:calc(100vh - 92px)}
  aside{border-right:1px solid var(--rule);background:#fff;padding:18px 16px 48px;position:sticky;top:92px;align-self:start;max-height:calc(100vh - 92px);overflow:auto}
  aside h3{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin:18px 0 8px}
  aside h3:first-child{margin-top:0}
  .idx{list-style:none;margin:0;padding:0}
  .idx li{margin-bottom:4px}
  .idx a{display:block;padding:7px 10px;border-radius:7px;text-decoration:none;color:var(--ink);font-size:13.5px;border:1px solid transparent}
  .idx a:hover{background:#F3F0E8;border-color:var(--rule)}
  .idx a.fail{border-left:3px solid #b24a3c}
  .idx .suite{display:block;color:var(--muted);font-size:11.5px}
  main{padding:22px 28px 64px;max-width:1100px}
  .cards{display:flex;gap:10px;flex-wrap:wrap;margin:0 0 24px}
  .card{background:#fff;border:1px solid var(--rule);border-radius:10px;padding:12px 16px;min-width:118px}
  .card b{display:block;font-size:23px}
  h2{font-size:16px;margin:26px 0 10px;border-bottom:1px solid var(--rule);padding-bottom:6px;scroll-margin-top:100px}
  .falha{background:#fff;border:1px solid var(--rule);border-left:4px solid #b24a3c;border-radius:8px;padding:14px 16px;margin-bottom:12px;scroll-margin-top:104px}
  .falha .suite{font-size:12px;color:var(--muted)}
  .falha .nome{font-weight:600;margin:2px 0 8px}
  pre{background:#0B1F3A;color:#e8e2d0;padding:12px;border-radius:8px;overflow:auto;font-size:12px;margin:0;white-space:pre-wrap}
  a{color:#1E3A5F}
  .vazio{color:var(--muted)}
  table.diff{width:100%;border-collapse:collapse;background:#fff;border:1px solid var(--rule);border-radius:8px;overflow:hidden;font-size:14px}
  table.diff th,table.diff td{text-align:left;padding:9px 12px;border-bottom:1px solid var(--rule);vertical-align:top}
  table.diff th{background:#EFEBE1;font-size:12px;text-transform:uppercase;letter-spacing:.04em}
  .tag{display:inline-block;border-radius:999px;padding:2px 10px;font-size:12px;font-weight:600;color:#fff;background:var(--muted)}
  .tag.alterado{background:#B8862B}.tag.novo{background:#3C6E9B}.tag.quebrou{background:#b24a3c}
  .tag.corrigido{background:#4c8a64}.tag.removido{background:#5d5d5d}.tag.igual{background:#A8AEB8}
  .tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}
  .tabs button{background:#fff;border:1px solid var(--rule);border-radius:999px;padding:7px 14px;font:inherit;font-size:13.5px;cursor:pointer}
  .tabs button[aria-selected="true"]{background:var(--navy);color:#fff;border-color:var(--navy)}
  .tabs button .dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px;background:#A8AEB8;vertical-align:middle}
  .tabs button .dot.alterado{background:#B8862B}.tabs button .dot.quebrou{background:#b24a3c}
  .tabs button .dot.novo{background:#3C6E9B}.tabs button .dot.corrigido{background:#4c8a64}
  .viewer{background:#fff;border:1px solid var(--rule);border-radius:10px;overflow:hidden}
  .viewer .bar{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 14px;border-bottom:1px solid var(--rule);font-size:13px;flex-wrap:wrap}
  .viewer iframe{width:100%;height:78vh;border:0;display:block;background:#EFEBE1}
  .hint{font-size:12px;color:var(--muted);margin-top:8px}
  .busca{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:0 0 12px}
  .busca input,.busca select{font:inherit;font-size:13.5px;padding:8px 10px;border:1px solid var(--rule);border-radius:8px;background:#fff;color:var(--ink)}
  .busca input{flex:1;min-width:180px}
  .busca button{font:inherit;font-size:13px;padding:8px 12px;border:1px solid var(--rule);border-radius:8px;background:#fff;cursor:pointer}
  .contador{font-size:12px;color:var(--muted)}
  .oculto{display:none !important}
  mark{background:#F3E2A8;padding:0 2px;border-radius:3px}
  .rev{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;color:var(--muted);cursor:pointer;margin:0 0 10px}
  .rev input{width:15px;height:15px;accent-color:#4c8a64;cursor:pointer}
  .falha.revisado{border-left-color:#4c8a64;background:#F6FBF7;opacity:.9}
  .falha.revisado .nome{text-decoration:line-through;text-decoration-color:#9FBFA9}
  .idx li.revisado > a::after{content:" ✓";color:#4c8a64;font-weight:700}
  .idx li.revisado > a{background:#F2F8F4}
  .tabs button.revisado{border-color:#4c8a64}
  .tabs button.revisado::after{content:" ✓";color:#4c8a64;font-weight:700}
  .tabs button[aria-selected="true"].revisado::after{color:#9BD3B2}
  .rev-resumo{margin:0 0 6px;font-size:12.5px;color:var(--muted)}
  .rev-resumo button{margin-top:6px;font:inherit;font-size:12px;padding:5px 10px;border:1px solid var(--rule);border-radius:8px;background:#fff;cursor:pointer}

  @media (max-width:900px){.layout{grid-template-columns:1fr}aside{position:static;max-height:none;border-right:0;border-bottom:1px solid var(--rule)}}
</style></head><body>
<header>
  <h1>PDF Premium · revisão do PR</h1>
  <div class="sub">Gerado em ${new Date().toLocaleString("pt-BR")} · <span class="status">${status}</span> · ${ok}/${total} testes · ${falhas.length} falha(s)</div>
</header>
<div class="layout">
<aside>
  <h3>Índice de falhas (<span id="idx-count">${falhas.length}</span>)</h3>
  ${
    falhas.length
      ? `<div class="busca"><input id="busca-idx" type="search" placeholder="Buscar falha…" aria-label="Buscar falha no índice"></div>
        <ul class="idx" id="idx-falhas">${falhas
          .map(
            (f, i) =>
              `<li data-rev-key="${escapeHtml(chaveFalha(f, i))}" data-busca="${escapeHtml(
                textoBusca(f),
              )}"><a class="fail" href="#${idFalha(i)}">${escapeHtml(
                f.nome,
              )}<span class="suite">${escapeHtml(f.suite)}${
                arquivoDaFalha(f) ? ` · ${escapeHtml(arquivoDaFalha(f))}` : ""
              }</span></a></li>`,
          )
          .join("")}</ul>
        <p class="vazio oculto" id="idx-vazio">Nenhuma falha corresponde à busca.</p>`
      : `<p class="vazio">Nenhuma falha nesta execução.</p>`
  }
  <h3>Revisão</h3>
  <p class="rev-resumo"><span id="rev-resumo">—</span><br><button type="button" id="rev-limpar">Limpar marcações</button></p>
  <h3>Cenários (PDFs)</h3>
  <ul class="idx" id="idx-cenarios">${pdfs
    .map(
      (p, i) =>
        `<li data-rev-key="${escapeHtml(chaveCenario(p.nome))}"><a href="#visualizador" data-goto="${i}">${escapeHtml(
          p.nome,
        )}<span class="suite">${
          p.erro ? "erro ao gerar" : `${p.paginas ?? "?"} págs · ${fmtBytes(p.bytes)}`
        }</span></a></li>`,
    )
    .join("")}</ul>

  <h3>Seções</h3>
  <ul class="idx">
    <li><a href="#falhas">Falhas detalhadas</a></li>
    <li><a href="#comparacao">Comparação com execução anterior</a></li>
    <li><a href="#visualizador">Visualizador de PDFs</a></li>
  </ul>
  <h3>Exportar / arquivar</h3>
  <ul class="idx">
    <li><a href="./indice-falhas.json" download>indice-falhas.json</a></li>
    <li><a href="./falhas.csv" download>falhas.csv</a></li>
    <li><a href="./mudancas.csv" download>mudancas.csv</a></li>
  </ul>

</aside>
<main>
  <div class="cards">
    <div class="card"><b>${total}</b>testes</div>
    <div class="card"><b>${ok}</b>passaram</div>
    <div class="card"><b>${falhas.length}</b>falharam</div>
    <div class="card"><b>${pdfs.filter((p) => !p.erro).length}</b>PDFs</div>
    <div class="card"><b>${relevantes.length}</b>mudanças</div>
  </div>

  <h2 id="visualizador">Visualizador de PDFs</h2>
  ${
    pdfs.some((p) => !p.erro)
      ? `<div class="tabs" role="tablist">${pdfs
          .map((p, i) => {
            const m = mapaMudanca.get(p.nome);
            const tipo = m && m.tipo !== "igual" ? m.tipo : "";
            return `<button role="tab" data-i="${i}" data-rev-key="${escapeHtml(
              chaveCenario(p.nome),
            )}" data-src="${escapeHtml(p.arquivo)}" data-nome="${escapeHtml(
              p.nome,
            )}" data-info="${escapeHtml(
              p.erro ? `Erro: ${p.erro}` : `${p.paginas ?? "?"} páginas · ${fmtBytes(p.bytes)} · hash ${p.hash ?? "—"}`,
            )}" data-mudanca="${escapeHtml(m && m.tipo !== "igual" ? `${rotuloMudanca[m.tipo]} — ${m.detalhes.join(" · ")}` : "sem mudança vs. execução anterior")}" aria-selected="${
              i === 0
            }"${p.erro ? " disabled" : ""}><span class="dot ${tipo}"></span>${escapeHtml(p.nome)}</button>`;
          })
          .join("")}</div>
  <div class="viewer">
    <div class="bar">
      <div><strong id="v-nome"></strong> · <span id="v-info" class="vazio"></span></div>
      <div><label class="rev"><input type="checkbox" id="v-revisado"> Cenário revisado</label> · <span id="v-mudanca" class="vazio"></span> · <a id="v-link" href="#" download>baixar PDF</a></div>
    </div>
    <iframe id="v-frame" title="Pré-visualização do PDF"></iframe>
  </div>
  <p class="hint">Use as setas ← / → para alternar entre os cenários e <strong>R</strong> para marcar o cenário atual como revisado.</p>`

      : `<p class="vazio">Nenhum PDF pôde ser gerado nesta execução.</p>`
  }

  <h2 id="falhas">Falhas detalhadas</h2>
  ${
    falhas.length
      ? `<div class="busca">
      <input id="busca-falhas" type="search" placeholder="Buscar por caso, arquivo ou mensagem…" aria-label="Buscar falhas">
      <select id="filtro-suite" aria-label="Filtrar por suíte">
        <option value="">Todas as suítes</option>
        ${suitesFalhas.map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join("")}
      </select>
      <select id="filtro-arquivo" aria-label="Filtrar por arquivo">
        <option value="">Todos os arquivos</option>
        ${arquivosFalhas.map((a) => `<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`).join("")}
      </select>
      <button type="button" id="limpar-filtros">Limpar</button>
      <span class="contador" id="contador-falhas">${falhas.length} de ${falhas.length}</span>
    </div>
    <div id="lista-falhas">${falhas
      .map(
        (f, i) => `<div class="falha" id="${idFalha(i)}" data-suite="${escapeHtml(f.suite)}" data-arquivo="${escapeHtml(
          arquivoDaFalha(f),
        )}" data-busca="${escapeHtml(textoBusca(f))}">
      <div class="suite">${escapeHtml(f.suite)}${arquivoDaFalha(f) ? ` · ${escapeHtml(arquivoDaFalha(f))}` : ""}</div>
      <div class="nome">${i + 1}. ${escapeHtml(f.nome)}</div>
      <label class="rev"><input type="checkbox" data-rev="${escapeHtml(chaveFalha(f, i))}"> Revisado</label>
      <pre>${escapeHtml(f.mensagem || "")}\n\n${escapeHtml(f.detalhe || "")}</pre>
    </div>`,
      )
      .join("\n")}</div>

    <p class="vazio oculto" id="falhas-vazio">Nenhuma falha corresponde aos filtros aplicados.</p>`
      : `<p class="vazio">Nenhuma falha — todos os testes do PDF Premium passaram.</p>`
  }

  <h2 id="comparacao">Comparação com a execução anterior</h2>
  ${
    baseline
      ? `<p class="vazio">Baseline: execução ${escapeHtml(String(baseline.runId ?? "anterior"))}${
          baseline.geradoEm ? ` · ${escapeHtml(new Date(baseline.geradoEm).toLocaleString("pt-BR"))}` : ""
        }</p>
    <table class="diff"><thead><tr><th>Cenário</th><th>Situação</th><th>Mudanças</th></tr></thead><tbody>
    ${mudancas
      .map(
        (m) => `<tr class="t-${m.tipo}"><td>${escapeHtml(m.nome)}</td><td><span class="tag ${m.tipo}">${
          rotuloMudanca[m.tipo]
        }</span></td><td>${m.detalhes.map(escapeHtml).join("<br>") || "—"}</td></tr>`,
      )
      .join("")}
    </tbody></table>
    <p>${
      [
        difTestes.novasFalhas.length ? `<strong>Novas falhas:</strong> ${difTestes.novasFalhas.map(escapeHtml).join(", ")}` : "",
        difTestes.corrigidos.length ? `<strong>Corrigidos:</strong> ${difTestes.corrigidos.map(escapeHtml).join(", ")}` : "",
        difTestes.novosTestes.length ? `<strong>Novos testes:</strong> ${difTestes.novosTestes.length}` : "",
        difTestes.removidos.length ? `<strong>Testes removidos:</strong> ${difTestes.removidos.length}` : "",
      ]
        .filter(Boolean)
        .join(" · ") || `<span class="vazio">Sem mudanças no conjunto de testes.</span>`
    }</p>`
      : `<p class="vazio">Sem execução anterior para comparar (baseline não encontrado).</p>`
  }
</main>
</div>
<script>
(function(){
  // Busca e filtros das falhas (nome do caso, arquivo, suíte e mensagem).
  var busca = document.getElementById('busca-falhas');
  var buscaIdx = document.getElementById('busca-idx');
  var selSuite = document.getElementById('filtro-suite');
  var selArquivo = document.getElementById('filtro-arquivo');
  var limpar = document.getElementById('limpar-filtros');
  var itens = Array.prototype.slice.call(document.querySelectorAll('#lista-falhas .falha'));
  var idxItens = Array.prototype.slice.call(document.querySelectorAll('#idx-falhas li'));
  var contador = document.getElementById('contador-falhas');
  var vazio = document.getElementById('falhas-vazio');
  var idxVazio = document.getElementById('idx-vazio');
  var idxCount = document.getElementById('idx-count');
  if (!itens.length && !idxItens.length) return;

  function termos(v){ return (v || '').toLowerCase().trim().split(/\\s+/).filter(Boolean); }
  function casa(el, ts){
    var t = el.getAttribute('data-busca') || '';
    for (var i = 0; i < ts.length; i++) if (t.indexOf(ts[i]) === -1) return false;
    return true;
  }
  function aplicar(){
    var ts = termos(busca && busca.value);
    var suite = selSuite ? selSuite.value : '';
    var arquivo = selArquivo ? selArquivo.value : '';
    var visiveis = 0;
    itens.forEach(function(el){
      var ok = casa(el, ts)
        && (!suite || el.getAttribute('data-suite') === suite)
        && (!arquivo || el.getAttribute('data-arquivo') === arquivo);
      el.classList.toggle('oculto', !ok);
      if (ok) visiveis++;
    });
    if (contador) contador.textContent = visiveis + ' de ' + itens.length;
    if (vazio) vazio.classList.toggle('oculto', visiveis > 0);
    if (busca && (suite || arquivo || ts.length)) sincronizarIndice(ts, suite, arquivo);
  }
  function sincronizarIndice(ts, suite, arquivo){
    if (!idxItens.length || (buscaIdx && buscaIdx.value)) return;
    var v = 0;
    idxItens.forEach(function(el, i){
      var alvo = itens[i];
      var ok = alvo ? !alvo.classList.contains('oculto') : casa(el, ts);
      el.classList.toggle('oculto', !ok);
      if (ok) v++;
    });
    if (idxCount) idxCount.textContent = String(v);
    if (idxVazio) idxVazio.classList.toggle('oculto', v > 0);
  }
  function filtrarIndice(){
    var ts = termos(buscaIdx && buscaIdx.value);
    var v = 0;
    idxItens.forEach(function(el){
      var ok = casa(el, ts);
      el.classList.toggle('oculto', !ok);
      if (ok) v++;
    });
    if (idxCount) idxCount.textContent = String(v);
    if (idxVazio) idxVazio.classList.toggle('oculto', v > 0);
  }

  if (busca) busca.addEventListener('input', aplicar);
  if (buscaIdx) buscaIdx.addEventListener('input', filtrarIndice);
  if (selSuite) selSuite.addEventListener('change', aplicar);
  if (selArquivo) selArquivo.addEventListener('change', aplicar);
  if (limpar) limpar.addEventListener('click', function(){
    if (busca) busca.value = '';
    if (selSuite) selSuite.value = '';
    if (selArquivo) selArquivo.value = '';
    aplicar();
    if (busca) busca.focus();
  });
  document.addEventListener('keydown', function(e){
    if (e.key === '/' && busca && !/input|textarea|select/i.test((e.target && e.target.tagName) || '')) {
      e.preventDefault();
      busca.focus();
    }
  });
  aplicar();
})();
(function(){

  var abas = Array.prototype.slice.call(document.querySelectorAll('.tabs button:not([disabled])'));
  if (!abas.length) return;
  var frame = document.getElementById('v-frame');
  var nome = document.getElementById('v-nome');
  var info = document.getElementById('v-info');
  var mud = document.getElementById('v-mudanca');
  var link = document.getElementById('v-link');
  var atual = 0;
  function abrir(i){
    var b = abas[i]; if (!b) return;
    atual = i;
    abas.forEach(function(x){ x.setAttribute('aria-selected', x === b ? 'true' : 'false'); });
    frame.src = './' + b.dataset.src + '#zoom=page-width';
    link.href = './' + b.dataset.src;
    nome.textContent = b.dataset.nome;
    info.textContent = b.dataset.info;
    mud.textContent = b.dataset.mudanca;
    if (history.replaceState) history.replaceState(null, '', '#cenario-' + i);
  }
  abas.forEach(function(b, i){ b.addEventListener('click', function(){ abrir(i); }); });
  document.querySelectorAll('[data-goto]').forEach(function(a){
    a.addEventListener('click', function(){
      var alvo = abas.findIndex(function(b){ return b.dataset.i === a.dataset.goto; });
      if (alvo >= 0) abrir(alvo);
    });
  });
  document.addEventListener('keydown', function(e){
    if (e.target && /input|textarea/i.test(e.target.tagName)) return;
    if (e.key === 'ArrowRight') abrir((atual + 1) % abas.length);
    if (e.key === 'ArrowLeft') abrir((atual - 1 + abas.length) % abas.length);
  });
  window.__pdfRevAbrir = abrir;
  window.__pdfRevAtual = function(){ return abas[atual]; };
  var m = /#cenario-(\\d+)/.exec(location.hash);
  abrir(m ? Math.min(Number(m[1]), abas.length - 1) : 0);
})();
(function(){
  // Marcação de "revisado" para falhas e cenários, persistida no navegador
  // (localStorage por execução) para sobreviver à navegação entre PDFs.
  var STORE = 'pdfrev:' + ${JSON.stringify(
    process.env.GITHUB_SHA || process.env.GITHUB_RUN_ID || "local",
  )};
  var estado = {};
  try { estado = JSON.parse(localStorage.getItem(STORE) || '{}') || {}; } catch (e) { estado = {}; }
  function salvar(){ try { localStorage.setItem(STORE, JSON.stringify(estado)); } catch (e) {} }

  var chks = Array.prototype.slice.call(document.querySelectorAll('input[data-rev]'));
  var resumo = document.getElementById('rev-resumo');
  var limparRev = document.getElementById('rev-limpar');
  var vChk = document.getElementById('v-revisado');
  var abas = Array.prototype.slice.call(document.querySelectorAll('.tabs button[data-rev-key]'));

  function marcado(k){ return !!estado[k]; }
  function pintar(){
    chks.forEach(function(c){
      var k = c.getAttribute('data-rev');
      c.checked = marcado(k);
      var card = c.closest('.falha');
      if (card) card.classList.toggle('revisado', c.checked);
      var li = document.querySelector('#idx-falhas li[data-rev-key="' + (window.CSS && CSS.escape ? CSS.escape(k) : k) + '"]');
      if (li) li.classList.toggle('revisado', c.checked);
    });
    abas.forEach(function(b){ b.classList.toggle('revisado', marcado(b.getAttribute('data-rev-key'))); });
    document.querySelectorAll('#idx-cenarios li[data-rev-key]').forEach(function(li){
      li.classList.toggle('revisado', marcado(li.getAttribute('data-rev-key')));
    });
    var atual = window.__pdfRevAtual && window.__pdfRevAtual();
    if (vChk && atual) vChk.checked = marcado(atual.getAttribute('data-rev-key'));
    if (resumo) {
      var totF = chks.length, okF = chks.filter(function(c){ return c.checked; }).length;
      var totC = abas.length, okC = abas.filter(function(b){ return marcado(b.getAttribute('data-rev-key')); }).length;
      resumo.textContent = 'Falhas ' + okF + '/' + totF + ' · Cenários ' + okC + '/' + totC;
    }
  }
  function alternar(k, v){ if (v) estado[k] = true; else delete estado[k]; salvar(); pintar(); }

  chks.forEach(function(c){
    c.addEventListener('change', function(){ alternar(c.getAttribute('data-rev'), c.checked); });
  });
  if (vChk) vChk.addEventListener('change', function(){
    var atual = window.__pdfRevAtual && window.__pdfRevAtual();
    if (atual) alternar(atual.getAttribute('data-rev-key'), vChk.checked);
  });
  document.querySelectorAll('.tabs button[data-rev-key]').forEach(function(b){
    b.addEventListener('click', function(){ setTimeout(pintar, 0); });
  });
  if (limparRev) limparRev.addEventListener('click', function(){
    estado = {}; salvar(); pintar();
  });
  document.addEventListener('keydown', function(e){
    if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
    if ((e.key === 'r' || e.key === 'R') && vChk) { vChk.checked = !vChk.checked; vChk.dispatchEvent(new Event('change')); }
  });
  pintar();
})();

</script>
</body></html>`;

  writeFileSync(join(outDir, "index.html"), html, "utf8");

  // ── Exportações para arquivar (JSON + CSV) ────────────────────────────
  const csvCampo = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v).replace(/\r?\n/g, " ").trim();
    return /[";,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = (cab: string[], linhas: unknown[][]) =>
    "\uFEFF" + [cab, ...linhas].map((l) => l.map(csvCampo).join(";")).join("\n") + "\n";

  const exRepo = process.env.GITHUB_REPOSITORY || "";
  const exRunId = process.env.GITHUB_RUN_ID || "";
  const exServer = process.env.GITHUB_SERVER_URL || "https://github.com";
  const exRunUrl = exRepo && exRunId ? `${exServer}/${exRepo}/actions/runs/${exRunId}` : "";
  const execucao = {
    geradoEm: new Date().toISOString(),
    repo: exRepo || null,
    workflow: process.env.GITHUB_WORKFLOW || null,
    runId: exRunId || null,
    runUrl: exRunUrl || null,
    commit: process.env.GITHUB_SHA || null,
    prNumero: process.env.PR_NUMBER || null,
    artefato: process.env.PDF_ARTIFACT_NAME || "pdf-premium-review",
    status,
    total,
    passaram: ok,
    falharam: falhas.length,
    baseline: baseline ? { runId: baseline.runId ?? null, geradoEm: baseline.geradoEm ?? null } : null,
  };

  writeFileSync(
    join(outDir, "indice-falhas.json"),
    JSON.stringify(
      {
        execucao,
        falhas: falhas.map((f, i) => ({
          indice: i + 1,
          id: idFalha(i),
          suite: f.suite,
          caso: f.nome,
          arquivo: arquivoDaFalha(f),
          mensagem: (f.mensagem || "").split("\n")[0],
          detalhe: (f.detalhe || "").slice(0, 2000),
        })),
        mudancas: mudancas.map((m) => ({
          cenario: m.nome,
          tipo: m.tipo,
          situacao: rotuloMudanca[m.tipo],
          detalhes: m.detalhes,
        })),
        difTestes,
        pdfs,
      },
      null,
      2,
    ),
    "utf8",
  );

  writeFileSync(
    join(outDir, "falhas.csv"),
    csv(
      ["indice", "suite", "caso", "arquivo", "mensagem", "run_id", "commit", "run_url"],
      falhas.map((f, i) => [
        i + 1,
        f.suite,
        f.nome,
        arquivoDaFalha(f),
        (f.mensagem || "").split("\n")[0].slice(0, 500),
        execucao.runId,
        execucao.commit,
        execucao.runUrl,
      ]),
    ),
    "utf8",
  );

  writeFileSync(
    join(outDir, "mudancas.csv"),
    csv(
      ["cenario", "tipo", "situacao", "detalhes", "paginas", "bytes", "hash", "run_id", "baseline_run_id"],
      mudancas.map((m) => {
        const p = pdfs.find((x) => x.nome === m.nome);
        return [
          m.nome,
          m.tipo,
          rotuloMudanca[m.tipo],
          m.detalhes.join(" | "),
          p?.paginas ?? "",
          p?.bytes ?? "",
          p?.hash ?? "",
          execucao.runId,
          baseline?.runId ?? "",
        ];
      }),
    ),
    "utf8",
  );


  // ── Resumo em Markdown para publicar como comentário no PR ────────────
  const serverUrl = process.env.GITHUB_SERVER_URL || "https://github.com";
  const repo = process.env.GITHUB_REPOSITORY || "";
  const runId = process.env.GITHUB_RUN_ID || "";
  const artefato = process.env.PDF_ARTIFACT_NAME || "pdf-premium-review";
  const runUrl = repo && runId ? `${serverUrl}/${repo}/actions/runs/${runId}` : "";
  const artefatosUrl = runUrl ? `${runUrl}#artifacts` : "";

  const linhasFalhas = falhas.slice(0, 10).map((f) => {
    const msg = (f.mensagem || "").split("\n")[0].slice(0, 300);
    return [
      `<details><summary><strong>${escapeHtml(f.nome)}</strong> — <code>${escapeHtml(f.suite)}</code></summary>`,
      "",
      "```text",
      `${(f.mensagem || "Falha").slice(0, 1200)}`,
      `${(f.detalhe || "").slice(0, 1500)}`,
      "```",
      "",
      "</details>",
      msg ? "" : "",
    ].join("\n");
  });

  const md = [
    `<!-- pdf-premium-review-comment -->`,
    `## PDF Premium · regressão do relatório de avaliação`,
    ``,
    `**${status}** — ${ok}/${total} testes passaram · ${falhas.length} falha(s) · ${pdfs.filter((p) => !p.erro).length} PDF(s) de revisão gerado(s).`,
    ``,
    `| Testes | Passaram | Falharam | PDFs |`,
    `| ---: | ---: | ---: | ---: |`,
    `| ${total} | ${ok} | ${falhas.length} | ${pdfs.filter((p) => !p.erro).length} |`,
    ``,
    falhas.length ? `### Falhas` : `Nenhuma falha detectada nos testes do PDF Premium.`,
    ...(falhas.length ? linhasFalhas : []),
    falhas.length > 10 ? `\n_+${falhas.length - 10} falha(s) adicionais no relatório completo._` : "",
    ``,
    `### Comparação com a execução anterior`,
    ...(baseline
      ? [
          `Baseline: execução ${baseline.runId ?? "anterior"}${
            baseline.geradoEm ? ` (${new Date(baseline.geradoEm).toLocaleString("pt-BR")})` : ""
          }.`,
          ``,
          relevantes.length
            ? [
                `| Cenário | Situação | Mudanças |`,
                `| --- | --- | --- |`,
                ...relevantes.map(
                  (m) => `| ${m.nome} | **${rotuloMudanca[m.tipo]}** | ${m.detalhes.join("<br>") || "—"} |`,
                ),
              ].join("\n")
            : `Nenhuma mudança relevante nos PDFs — páginas, tamanho e conteúdo idênticos à execução anterior.`,
          ``,
          [
            difTestes.novasFalhas.length ? `**Novas falhas:** ${difTestes.novasFalhas.join(", ")}` : "",
            difTestes.corrigidos.length ? `**Corrigidos:** ${difTestes.corrigidos.join(", ")}` : "",
            difTestes.novosTestes.length ? `**Novos testes:** ${difTestes.novosTestes.length}` : "",
            difTestes.removidos.length ? `**Testes removidos:** ${difTestes.removidos.length}` : "",
          ]
            .filter(Boolean)
            .join(" · ") || `Sem mudanças no conjunto de testes.`,
        ]
      : [`Sem execução anterior para comparar (baseline não encontrado).`]),
    ``,
    `### Artefatos`,
    artefatosUrl
      ? `- [Resumo HTML + PDFs (\`${artefato}\`)](${artefatosUrl}) — baixe o artefato e abra \`index.html\`.`
      : `- Artefato \`${artefato}\` (resumo HTML + PDFs) disponível na execução do workflow.`,
    ...pdfs.map((p) =>
      p.erro
        ? `  - ${p.nome}: falha ao gerar (\`${String(p.erro).slice(0, 160)}\`)`
        : `  - ${p.nome}: \`${p.arquivo}\` · ${p.paginas ?? "?"} págs · ${fmtBytes(p.bytes)}`,
    ),
    runUrl ? `\n[Ver execução completa no CI](${runUrl})` : "",
  ]
    .filter((l) => l !== undefined)
    .join("\n");

  writeFileSync(join(outDir, "resumo-pr.md"), md, "utf8");

  // ── Payload de notificação (Slack / e-mail) ───────────────────────────
  // Consumido por scripts/notifyPdfChanges.ts. Só há motivo para notificar
  // quando algum teste falhou ou algum cenário mudou vs. o baseline.
  writeFileSync(
    join(outDir, "notificacao.json"),
    JSON.stringify(
      {
        status,
        total,
        ok,
        falhas: falhas.slice(0, 20).map((f) => ({
          suite: f.suite,
          nome: f.nome,
          mensagem: (f.mensagem || "Falha").split("\n")[0].slice(0, 300),
        })),
        totalFalhas: falhas.length,
        mudancas: relevantes.map((m) => ({
          nome: m.nome,
          tipo: m.tipo,
          rotulo: rotuloMudanca[m.tipo],
          detalhes: m.detalhes,
        })),
        difTestes,
        baseline: baseline
          ? { runId: baseline.runId ?? null, geradoEm: baseline.geradoEm ?? null }
          : null,
        baselineUrl:
          baseline?.runId && repo ? `${serverUrl}/${repo}/actions/runs/${baseline.runId}#artifacts` : null,
        artefato,
        artefatosUrl: artefatosUrl || null,
        runUrl: runUrl || null,
        commit: process.env.GITHUB_SHA || null,
        workflow: process.env.GITHUB_WORKFLOW || null,
        repo: repo || null,
        deveNotificar: falhas.length > 0 || relevantes.length > 0,
      },
      null,
      2,
    ),
    "utf8",
  );

  console.log(
    `[pdf-artifacts] ${total} testes · ${falhas.length} falhas · ${pdfs.filter((p) => !p.erro).length} PDFs · ${
      baseline ? `${relevantes.length} mudança(s) vs. execução anterior` : "sem baseline"
    } → ${outDir}/index.html`,
  );
}

main().catch((e) => {
  console.error("[pdf-artifacts] erro:", e);
  process.exit(0); // nunca derruba o job de testes
});
