/**
 * Consolida a cobertura de vários shards do Vitest em um único relatório.
 *
 * Uso: bun scripts/mergeCoverage.ts <dir-com-coverage-final.json> <dir-saida>
 * Gera: coverage-final.json, coverage-summary.json, lcov.info e resumo.md
 */
import { readdirSync, readFileSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import libCoverage from "istanbul-lib-coverage";

const inDir = process.argv[2] || "coverage-shards";
const outDir = process.argv[3] || "coverage-merged";
const LIMIARES = { lines: 85, statements: 85, functions: 80, branches: 80 };

function coletar(dir: string, nome: string): string[] {
  const achados: string[] = [];
  for (const entrada of readdirSync(dir)) {
    const caminho = join(dir, entrada);
    if (statSync(caminho).isDirectory()) achados.push(...coletar(caminho, nome));
    else if (entrada === nome) achados.push(caminho);
  }
  return achados;
}

const arquivos = coletar(inDir, "coverage-final.json");
if (arquivos.length === 0) {
  console.error(`Nenhum coverage-final.json encontrado em ${inDir}`);
  process.exit(1);
}

const mapa = libCoverage.createCoverageMap({});
for (const arquivo of arquivos) {
  mapa.merge(JSON.parse(readFileSync(arquivo, "utf8")));
}

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "coverage-final.json"), JSON.stringify(mapa.toJSON()));

// Resumo por arquivo + total
const total = libCoverage.createCoverageSummary({
  lines: { total: 0, covered: 0, skipped: 0, pct: 0 },
  statements: { total: 0, covered: 0, skipped: 0, pct: 0 },
  functions: { total: 0, covered: 0, skipped: 0, pct: 0 },
  branches: { total: 0, covered: 0, skipped: 0, pct: 0 },
});
const resumo: Record<string, unknown> = {};
for (const arquivo of mapa.files()) {
  const s = mapa.fileCoverageFor(arquivo).toSummary();
  total.merge(s);
  resumo[arquivo] = s.toJSON();
}
resumo.total = total.toJSON();
writeFileSync(join(outDir, "coverage-summary.json"), JSON.stringify(resumo, null, 2));

// lcov.info (formato aceito por Codecov, SonarQube e afins)
const linhasLcov: string[] = [];
for (const arquivo of mapa.files()) {
  const fc = mapa.fileCoverageFor(arquivo);
  const json = fc.toJSON() as any;
  const rel = arquivo.startsWith(process.cwd()) ? arquivo.slice(process.cwd().length + 1) : arquivo;
  linhasLcov.push("TN:", `SF:${rel}`);
  for (const [id, fn] of Object.entries<any>(json.fnMap || {})) {
    linhasLcov.push(`FN:${fn.decl?.start?.line ?? fn.loc?.start?.line ?? 0},${fn.name}`);
    linhasLcov.push(`FNDA:${json.f?.[id] ?? 0},${fn.name}`);
  }
  const linhas = fc.getLineCoverage();
  let lh = 0;
  let lf = 0;
  for (const [linha, hits] of Object.entries<number>(linhas as any)) {
    linhasLcov.push(`DA:${linha},${hits}`);
    lf += 1;
    if (hits > 0) lh += 1;
  }
  linhasLcov.push(`LF:${lf}`, `LH:${lh}`, "end_of_record");
}
writeFileSync(join(outDir, "lcov.info"), linhasLcov.join("\n") + "\n");

// Resumo em markdown (vai para o Job Summary do GitHub Actions)
const t = total.toJSON() as any;
const linha = (rot: string, m: any, limite: number) =>
  `| ${rot} | ${m.pct.toFixed(2)}% | ${m.covered}/${m.total} | ${limite}% | ${m.pct >= limite ? "✅" : "❌"} |`;
const md = [
  "## Cobertura · gerador de PDF de avaliação premium",
  "",
  `Shards consolidados: ${arquivos.length} · arquivos medidos: ${mapa.files().length}`,
  "",
  "| Métrica | Cobertura | Coberto/Total | Meta | Status |",
  "| --- | --- | --- | --- | --- |",
  linha("Linhas", t.lines, LIMIARES.lines),
  linha("Statements", t.statements, LIMIARES.statements),
  linha("Funções", t.functions, LIMIARES.functions),
  linha("Branches", t.branches, LIMIARES.branches),
  "",
].join("\n");
writeFileSync(join(outDir, "resumo.md"), md);
console.log(md);

const abaixo =
  t.lines.pct < LIMIARES.lines ||
  t.statements.pct < LIMIARES.statements ||
  t.functions.pct < LIMIARES.functions ||
  t.branches.pct < LIMIARES.branches;
if (abaixo) {
  console.error("Cobertura abaixo das metas configuradas.");
  process.exit(1);
}
