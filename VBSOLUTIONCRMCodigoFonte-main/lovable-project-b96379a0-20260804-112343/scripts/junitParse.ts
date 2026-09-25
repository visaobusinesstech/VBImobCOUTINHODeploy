/**
 * Parser compartilhado de relatórios JUnit XML (Vitest).
 * Usado por scripts/annotateJunit.ts (anotações inline) e
 * scripts/junitToSarif.ts (GitHub Code Scanning / SARIF).
 */
import { relative, isAbsolute } from "node:path";

export type Falha = {
  suite: string;
  nome: string;
  mensagem: string;
  detalhe: string;
  arquivo?: string;
  linha?: number;
  coluna?: number;
};

export function decode(s: string) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#10;/g, "\n")
    .replace(/&#13;/g, "")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Procura o primeiro frame do stack que aponta para um arquivo do projeto. */
export function localizar(texto: string, suiteFile?: string, raiz = process.cwd()) {
  const re = /(?:\(|\s|^|at\s|file:\/\/)([A-Za-z]:)?([./\w-]*src[/\\][\w./\\-]+\.(?:tsx?|jsx?)):(\d+):(\d+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(texto))) {
    let arquivo = m[2].replace(/\\/g, "/");
    if (isAbsolute(arquivo)) arquivo = relative(raiz, arquivo);
    arquivo = arquivo.replace(/^\.\//, "");
    if (arquivo.includes("node_modules")) continue;
    return { arquivo, linha: Number(m[3]), coluna: Number(m[4]) };
  }
  if (suiteFile) {
    const limpo = suiteFile.replace(/\\/g, "/").replace(/^\.\//, "");
    if (/\.(tsx?|jsx?)$/.test(limpo)) return { arquivo: limpo, linha: 1, coluna: 1 };
  }
  return {};
}

export function parseJunit(xml: string, raiz = process.cwd()): Falha[] {
  const falhas: Falha[] = [];
  const suiteRe = /<testsuite\b([^>]*)>([\s\S]*?)<\/testsuite>/g;
  let sm: RegExpExecArray | null;
  while ((sm = suiteRe.exec(xml))) {
    const attrs = sm[1];
    const suite = decode(/name="([^"]*)"/.exec(attrs)?.[1] || "(suite)");
    const suiteFile = decode(/file="([^"]*)"/.exec(attrs)?.[1] || "") || suite;
    const caseRe = /<testcase\b([^>]*?)\s*(?:\/>|>([\s\S]*?)<\/testcase>)/g;
    let cm: RegExpExecArray | null;
    while ((cm = caseRe.exec(sm[2]))) {
      const corpo = cm[2] || "";
      const fail = /<(failure|error)\b([^>]*)(\/>|>([\s\S]*?)<\/\1>)/.exec(corpo);
      if (!fail) continue;
      const nome = decode(/name="([^"]*)"/.exec(cm[1])?.[1] || "(sem nome)");
      const mensagem = decode(/message="([^"]*)"/.exec(fail[2])?.[1] || "Falha");
      const detalhe = decode((fail[4] || "").trim());
      const pos = localizar(`${detalhe}\n${mensagem}`, suiteFile, raiz);
      falhas.push({ suite, nome, mensagem, detalhe, ...pos });
    }
  }
  return falhas;
}
