/**
 * Publica anotações inline no GitHub (workflow commands) para cada teste
 * que falhou, apontando arquivo e linha extraídos do stack trace.
 *
 * Uso: bun scripts/annotateJunit.ts [caminho-junit.xml]
 * Padrão: ./pdf-premium-junit.xml
 *
 * Em execução local (sem GITHUB_ACTIONS) imprime o que seria anotado.
 */
import { existsSync, readFileSync } from "node:fs";
import { parseJunit, type Falha } from "./junitParse";

const junitPath = process.argv[2] || "pdf-premium-junit.xml";
const raiz = process.env.GITHUB_WORKSPACE || process.cwd();
const noCI = process.env.GITHUB_ACTIONS === "true";
/** URL do artefato (PDF/HTML) publicado no PR e diretório com metrics.json. */
const artefatoUrl = process.env.PDF_ARTIFACT_URL || "";
const artefatoNome = process.env.PDF_ARTIFACT_NAME || "pdf-premium-review";
const artefatosDir = process.env.PDF_ARTIFACTS_DIR || "pdf-test-artifacts";

type PdfMeta = { id: string; arquivo: string; nome: string; erro?: string };

/** Lê metrics.json gerado por scripts/pdfTestArtifacts.ts para mapear cenários. */
function lerPdfs(): PdfMeta[] {
  const f = `${artefatosDir}/metrics.json`;
  if (!existsSync(f)) return [];
  try {
    const j = JSON.parse(readFileSync(f, "utf8"));
    return Array.isArray(j?.pdfs) ? j.pdfs : [];
  } catch {
    return [];
  }
}

const pdfsGerados = lerPdfs();

function normalizar(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Encontra o PDF do cenário correspondente ao nome do teste que falhou. */
function acharPdf(nomeTeste: string): PdfMeta | undefined {
  const alvo = normalizar(nomeTeste);
  const porNome = pdfsGerados.find((p) => p.nome && alvo.includes(normalizar(p.nome)));
  if (porNome) return porNome;
  const porId = pdfsGerados.find((p) => p.id && alvo.includes(normalizar(p.id).replace(/-/g, " ")));
  if (porId) return porId;
  const qtd = /(\d+)\s*compar/.exec(alvo)?.[1];
  if (qtd) {
    const nPorId: Record<string, string> = {
      "0": "sem-comparaveis",
      "3": "poucos-comparaveis",
      "12": "doze-comparaveis",
      "20": "acima-do-limite",
    };
    const id = nPorId[qtd];
    if (id) return pdfsGerados.find((p) => p.id === id);
  }
  return undefined;
}

/** Escapa conforme o formato de workflow command do GitHub. */
function escData(s: string) {
  return s.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
}
function escProp(s: string) {
  return escData(s).replace(/:/g, "%3A").replace(/,/g, "%2C");
}

function main() {
  if (!existsSync(junitPath)) {
    console.log(`[annotate] ${junitPath} não encontrado — nada a anotar.`);
    return;
  }
  const falhas: Falha[] = parseJunit(readFileSync(junitPath, "utf8"), raiz);
  if (!falhas.length) {
    console.log("[annotate] nenhuma falha — nenhuma anotação criada.");
    return;
  }

  falhas.forEach((f, i) => {
    const titulo = `PDF Premium · ${f.nome}`;
    const pdf = acharPdf(f.nome);
    const linksArtefato: string[] = [];
    if (artefatoUrl) {
      linksArtefato.push(`Artefato ${artefatoNome} (HTML + PDFs): ${artefatoUrl}`);
      linksArtefato.push(
        `Revisão desta falha: abra index.html#falha-${i + 1} dentro do artefato${
          pdf ? ` (PDF do cenário: ${pdf.arquivo})` : ""
        }`,
      );
    } else if (pdf) {
      linksArtefato.push(`PDF do cenário no artefato ${artefatoNome}: ${pdf.arquivo}`);
    }

    const corpo = [
      `Suíte: ${f.suite}`,
      "",
      f.mensagem,
      f.detalhe ? `\n${f.detalhe.slice(0, 1200)}` : "",
      linksArtefato.length ? `\n${linksArtefato.join("\n")}` : "",
    ]
      .join("\n")
      .slice(0, 4000);

    if (noCI) {
      const props = [
        `title=${escProp(titulo)}`,
        f.arquivo ? `file=${escProp(f.arquivo)}` : "",
        f.linha ? `line=${f.linha}` : "",
        f.coluna ? `col=${f.coluna}` : "",
      ]
        .filter(Boolean)
        .join(",");
      console.log(`::error ${props}::${escData(corpo)}`);
    } else {
      console.log(
        `[annotate] ${f.arquivo ?? "?"}:${f.linha ?? "?"}:${f.coluna ?? "?"} → ${titulo}\n  ${
          f.mensagem.split("\n")[0]
        }${linksArtefato.length ? `\n  ${linksArtefato.join("\n  ")}` : ""}`,
      );
    }
  });
  console.log(`[annotate] ${falhas.length} anotação(ões) de falha emitida(s).`);
}

main();
