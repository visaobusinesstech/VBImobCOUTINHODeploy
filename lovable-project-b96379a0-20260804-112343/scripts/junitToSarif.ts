/**
 * Converte o relatório JUnit dos testes do PDF Premium em SARIF 2.1.0,
 * para que o GitHub Code Scanning destaque automaticamente as linhas
 * relevantes de cada falha diretamente no diff do PR.
 *
 * Uso: bun scripts/junitToSarif.ts [junit.xml] [saida.sarif]
 * Padrão: ./pdf-premium-junit.xml → ./pdf-premium.sarif
 *
 * Variáveis opcionais:
 *  - PDF_ARTIFACT_URL / PDF_ARTIFACT_NAME: link do artefato com PDFs + HTML
 *  - PDF_ARTIFACTS_DIR: pasta com metrics.json (mapeia cenário → PDF)
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseJunit, type Falha } from "./junitParse";

const junitPath = process.argv[2] || "pdf-premium-junit.xml";
const saida = process.argv[3] || "pdf-premium.sarif";
const raiz = process.env.GITHUB_WORKSPACE || process.cwd();
const artefatoUrl = process.env.PDF_ARTIFACT_URL || "";
const artefatoNome = process.env.PDF_ARTIFACT_NAME || "pdf-premium-review";
const artefatosDir = process.env.PDF_ARTIFACTS_DIR || "pdf-test-artifacts";

type PdfMeta = { id: string; arquivo: string; nome: string };

function lerPdfs(): PdfMeta[] {
  const f = join(artefatosDir, "metrics.json");
  if (!existsSync(f)) return [];
  try {
    const j = JSON.parse(readFileSync(f, "utf8"));
    return Array.isArray(j?.pdfs) ? j.pdfs : [];
  } catch {
    return [];
  }
}

const pdfs = lerPdfs();

function normalizar(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function acharPdf(nomeTeste: string): PdfMeta | undefined {
  const alvo = normalizar(nomeTeste);
  return (
    pdfs.find((p) => p.nome && alvo.includes(normalizar(p.nome))) ||
    pdfs.find((p) => p.id && alvo.includes(normalizar(p.id).replace(/-/g, " ")))
  );
}

/** Um regra por suíte de teste, para agrupar melhor no Code Scanning. */
function ruleId(f: Falha) {
  const base = f.suite.replace(/[^\w./-]+/g, "-").replace(/^-+|-+$/g, "");
  return `pdf-premium/${base || "testes"}`;
}

function sarif(falhas: Falha[]) {
  const regras = new Map<string, { id: string; suite: string }>();
  for (const f of falhas) regras.set(ruleId(f), { id: ruleId(f), suite: f.suite });

  const results = falhas.map((f, i) => {
    const pdf = acharPdf(f.nome);
    const extras: string[] = [];
    if (artefatoUrl) extras.push(`Artefato ${artefatoNome}: ${artefatoUrl}`);
    if (artefatoUrl) extras.push(`Revisão: index.html#falha-${i + 1}${pdf ? ` · ${pdf.arquivo}` : ""}`);
    else if (pdf) extras.push(`PDF do cenário: ${pdf.arquivo}`);

    const texto = [
      `${f.nome} — ${f.mensagem.split("\n")[0]}`,
      f.detalhe ? f.detalhe.slice(0, 1200) : "",
      extras.join(" · "),
    ]
      .filter(Boolean)
      .join("\n\n");

    return {
      ruleId: ruleId(f),
      level: "error",
      message: { text: texto },
      partialFingerprints: {
        primaryLocationLineHash: `${f.suite}:${f.nome}`,
      },
      locations: [
        {
          physicalLocation: {
            artifactLocation: {
              uri: f.arquivo || "pdf-premium-junit.xml",
              uriBaseId: "%SRCROOT%",
            },
            region: {
              startLine: Math.max(1, f.linha || 1),
              startColumn: Math.max(1, f.coluna || 1),
            },
          },
        },
      ],
    };
  });

  return {
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "PDF Premium · testes de regressão",
            informationUri: "https://vitest.dev",
            version: "1.0.0",
            rules: [...regras.values()].map((r) => ({
              id: r.id,
              name: r.id,
              shortDescription: { text: `Falha de regressão em ${r.suite}` },
              fullDescription: {
                text: "Teste de regressão do laudo PDF Premium falhou. Revise o PDF gerado no artefato do PR.",
              },
              defaultConfiguration: { level: "error" },
              properties: { tags: ["test", "regression", "pdf"] },
            })),
          },
        },
        originalUriBaseIds: { "%SRCROOT%": { uri: `file://${raiz}/` } },
        results,
      },
    ],
  };
}

function main() {
  if (!existsSync(junitPath)) {
    console.log(`[sarif] ${junitPath} não encontrado — gerando SARIF vazio.`);
    writeFileSync(saida, JSON.stringify(sarif([]), null, 2), "utf8");
    return;
  }
  const falhas = parseJunit(readFileSync(junitPath, "utf8"), raiz);
  writeFileSync(saida, JSON.stringify(sarif(falhas), null, 2), "utf8");
  console.log(`[sarif] ${falhas.length} falha(s) exportada(s) para ${saida}`);
}

main();
