/**
 * Junta vários relatórios JUnit (um por shard do Vitest) em um único XML.
 *
 * Uso: bun scripts/mergeJunit.ts <dir-com-xmls> <arquivo-saida.xml>
 * Padrões: ./junit-shards → ./pdf-premium-junit.xml
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const inDir = process.argv[2] || "junit-shards";
const outFile = process.argv[3] || "pdf-premium-junit.xml";

function coletarXmls(dir: string): string[] {
  const achados: string[] = [];
  for (const entrada of readdirSync(dir)) {
    const caminho = join(dir, entrada);
    if (statSync(caminho).isDirectory()) achados.push(...coletarXmls(caminho));
    else if (entrada.endsWith(".xml")) achados.push(caminho);
  }
  return achados;
}

const arquivos = coletarXmls(inDir).sort();
const suites: string[] = [];
let tests = 0;
let failures = 0;
let errors = 0;
let skipped = 0;
let time = 0;

for (const arquivo of arquivos) {
  const xml = readFileSync(arquivo, "utf8");
  const suiteRe = /<testsuite\b[\s\S]*?<\/testsuite>/g;
  let m: RegExpExecArray | null;
  while ((m = suiteRe.exec(xml))) {
    const bloco = m[0];
    suites.push(bloco);
    const num = (attr: string) =>
      Number(new RegExp(`\\b${attr}="([^"]*)"`).exec(bloco.slice(0, bloco.indexOf(">") + 1))?.[1] || 0);
    tests += num("tests");
    failures += num("failures");
    errors += num("errors");
    skipped += num("skipped");
    time += num("time");
  }
}

const saida = [
  '<?xml version="1.0" encoding="UTF-8" ?>',
  `<testsuites name="vitest tests" tests="${tests}" failures="${failures}" errors="${errors}" skipped="${skipped}" time="${time.toFixed(
    4,
  )}">`,
  ...suites,
  "</testsuites>",
  "",
].join("\n");

writeFileSync(outFile, saida);
console.log(
  `Merged ${arquivos.length} relatório(s) / ${suites.length} suíte(s): ${tests} testes, ${failures} falhas, ${errors} erros → ${outFile}`,
);
