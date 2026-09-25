// Diff coverage gate para webhookSecurity.
//
// Diferente de `webhook-security-coverage.ts` (que mede cobertura total do
// arquivo), este script computa cobertura APENAS das linhas alteradas no diff
// vs. a base (default: origin/main). Isso garante que todo código novo/tocado
// em um PR tenha testes, sem exigir que o arquivo inteiro seja 100% coberto.
//
// Uso:
//   deno run -A scripts/webhook-security-diff-coverage.ts
//
// Env:
//   DIFF_BASE_REF          ref base para o diff (default: origin/main)
//   DIFF_COVERAGE_MIN      % mínimo de linhas alteradas cobertas (default: 90)
//   COVERAGE_LCOV          caminho do lcov.info (default: coverage/webhook-security/lcov.info)
//   TARGET_FILE            arquivo alvo (default: supabase/functions/_shared/webhookSecurity.ts)
//   OUT_DIR                pasta de saída (default: coverage/webhook-security)

const TARGET_FILE = Deno.env.get("TARGET_FILE") ??
  "supabase/functions/_shared/webhookSecurity.ts";
const TEST_FILE = "supabase/functions/_shared/webhookSecurity.test.ts";
const OUT_DIR = Deno.env.get("OUT_DIR") ?? "coverage/webhook-security";
const LCOV_PATH = Deno.env.get("COVERAGE_LCOV") ?? `${OUT_DIR}/lcov.info`;
const BASE_REF = Deno.env.get("DIFF_BASE_REF") ?? "origin/main";
const MIN_PCT = Number(Deno.env.get("DIFF_COVERAGE_MIN") ?? 90);

async function run(cmd: string[], capture = true) {
  const p = new Deno.Command(cmd[0], {
    args: cmd.slice(1),
    stdout: capture ? "piped" : "inherit",
    stderr: capture ? "piped" : "inherit",
  });
  const out = await p.output();
  return {
    code: out.code,
    stdout: capture ? new TextDecoder().decode(out.stdout) : "",
    stderr: capture ? new TextDecoder().decode(out.stderr) : "",
  };
}

// 1) Garante lcov: se não existir, gera invocando o gate base (que roda os testes).
try {
  await Deno.stat(LCOV_PATH);
} catch {
  console.log(`ℹ️  ${LCOV_PATH} ausente — executando webhook-security-coverage.ts para gerar.`);
  const gen = await run(["deno", "run", "-A", "scripts/webhook-security-coverage.ts"], false);
  if (gen.code !== 0) {
    console.error("❌ Não foi possível gerar cobertura base.");
    Deno.exit(gen.code);
  }
}

// 2) Extrai linhas alteradas (added/modified) no arquivo alvo via git diff --unified=0.
async function ensureBase(ref: string) {
  const check = await run(["git", "rev-parse", "--verify", ref]);
  if (check.code === 0) return ref;
  // Tenta fetch em CI onde só há checkout raso.
  const [remote, ...rest] = ref.split("/");
  const branch = rest.join("/");
  if (remote && branch) {
    await run(["git", "fetch", "--no-tags", "--depth=200", remote, branch]);
    const retry = await run(["git", "rev-parse", "--verify", ref]);
    if (retry.code === 0) return ref;
  }
  // Fallback: HEAD~1
  console.warn(`⚠️  Ref ${ref} indisponível — comparando com HEAD~1.`);
  return "HEAD~1";
}
const base = await ensureBase(BASE_REF);

const diff = await run(["git", "diff", "--unified=0", "--no-color", base, "--", TARGET_FILE]);
if (diff.code !== 0) {
  console.error("❌ git diff falhou:\n" + diff.stderr);
  Deno.exit(diff.code);
}

const changedLines = new Set<number>();
{
  let current = 0;
  let remaining = 0;
  for (const line of diff.stdout.split("\n")) {
    const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
    if (hunk) {
      current = Number(hunk[1]);
      remaining = hunk[2] === undefined ? 1 : Number(hunk[2]);
      continue;
    }
    if (remaining <= 0) continue;
    if (line.startsWith("+") && !line.startsWith("+++")) {
      changedLines.add(current);
      current++;
      remaining--;
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      // linhas removidas não avançam o cursor no lado "+"
    } else if (!line.startsWith("\\")) {
      // contexto (não deveria ocorrer com --unified=0, mas por segurança)
      current++;
      remaining--;
    }
  }
}

// 3) Parseia LCOV e monta hitmap { linha -> hits } para o arquivo alvo.
const lcov = await Deno.readTextFile(LCOV_PATH);
const hits = new Map<number, number>();
{
  let inTarget = false;
  const targetSuffix = TARGET_FILE.replace(/\\/g, "/");
  for (const raw of lcov.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("SF:")) {
      const sf = line.slice(3).replace(/\\/g, "/");
      inTarget = sf.endsWith(targetSuffix) || sf === targetSuffix;
      continue;
    }
    if (!inTarget) continue;
    if (line === "end_of_record") { inTarget = false; continue; }
    if (line.startsWith("DA:")) {
      const [ln, count] = line.slice(3).split(",").map(Number);
      hits.set(ln, count);
    }
  }
}

// 4) Calcula cobertura só das linhas alteradas que são executáveis (existem no LCOV).
const executableChanged: number[] = [];
const uncovered: number[] = [];
for (const ln of [...changedLines].sort((a, b) => a - b)) {
  if (!hits.has(ln)) continue; // linha não executável (comentário, blank, tipo puro)
  executableChanged.push(ln);
  if ((hits.get(ln) ?? 0) === 0) uncovered.push(ln);
}

const total = executableChanged.length;
const covered = total - uncovered.length;
const pct = total === 0 ? 100 : (covered / total) * 100;

const summary = {
  target: TARGET_FILE,
  base_ref: base,
  changed_lines: changedLines.size,
  executable_changed_lines: total,
  covered,
  uncovered_lines: uncovered,
  pct: Number(pct.toFixed(2)),
  threshold: MIN_PCT,
  generated_at: new Date().toISOString(),
};
await Deno.mkdir(OUT_DIR, { recursive: true });
await Deno.writeTextFile(`${OUT_DIR}/diff-summary.json`, JSON.stringify(summary, null, 2));

console.log("\n📐 Diff coverage · webhookSecurity");
console.log("────────────────────────────────────────────");
console.log(`  Base ref            : ${base}`);
console.log(`  Linhas alteradas    : ${changedLines.size}`);
console.log(`  Executáveis (LCOV)  : ${total}`);
console.log(`  Cobertas            : ${covered}`);
console.log(`  Não cobertas        : ${uncovered.length}${uncovered.length ? "  → " + uncovered.slice(0, 20).join(", ") + (uncovered.length > 20 ? "…" : "") : ""}`);
console.log(`  Diff coverage       : ${pct.toFixed(2)}%   mínimo ${MIN_PCT}%`);
console.log("────────────────────────────────────────────");

// 4b) PR annotations — emite comandos de workflow do GitHub Actions para que
// cada trecho não coberto apareça como marcador inline na aba "Files changed"
// do PR. Agrupa linhas consecutivas em ranges (endLine) para reduzir ruído.
function groupRanges(lines: number[]): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];
  for (const ln of lines) {
    const last = ranges[ranges.length - 1];
    if (last && ln === last.end + 1) last.end = ln;
    else ranges.push({ start: ln, end: ln });
  }
  return ranges;
}

// Escapa valores conforme spec dos workflow commands
// (https://docs.github.com/actions/reference/workflow-commands-for-github-actions#example-of-setting-an-error-message).
function esc(v: string): string {
  return v.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
}
function escProp(v: string): string {
  return esc(v).replace(/:/g, "%3A").replace(/,/g, "%2C");
}

if (Deno.env.get("GITHUB_ACTIONS") === "true" && uncovered.length > 0) {
  const gateFailed = pct + 1e-9 < MIN_PCT;
  const level = gateFailed ? "error" : "warning";
  const title = gateFailed
    ? `Diff coverage abaixo do mínimo (${MIN_PCT}%)`
    : `Linha alterada sem cobertura de teste`;

  for (const { start, end } of groupRanges(uncovered)) {
    const span = start === end ? `linha ${start}` : `linhas ${start}–${end}`;
    const message =
      `${span} de ${TARGET_FILE} foi alterada neste PR mas não é exercitada por ${TEST_FILE}. ` +
      `Adicione um caso de teste cobrindo esse trecho para manter o diff coverage ≥ ${MIN_PCT}% ` +
      `(atual: ${pct.toFixed(2)}%).`;

    const props = [
      `file=${escProp(TARGET_FILE)}`,
      `line=${start}`,
      `endLine=${end}`,
      `title=${escProp(title)}`,
    ].join(",");
    console.log(`::${level} ${props}::${esc(message)}`);
  }
}

const gh = Deno.env.get("GITHUB_STEP_SUMMARY");
if (gh) {
  const ok = pct + 1e-9 >= MIN_PCT;
  const md = `## ${ok ? "✅" : "❌"} Diff coverage · webhookSecurity

| Métrica | Valor |
|---------|-------|
| Base | \`${base}\` |
| Linhas alteradas | ${changedLines.size} |
| Executáveis | ${total} |
| Cobertas | ${covered} |
| Diff coverage | **${pct.toFixed(2)}%** (mín. ${MIN_PCT}%) |

${uncovered.length ? `**Linhas alteradas sem cobertura:** ${uncovered.join(", ")}\n` : ""}
Alvo: \`${TARGET_FILE}\` · Testes: \`${TEST_FILE}\`
`;
  await Deno.writeTextFile(gh, md, { append: true });
}

if (total === 0) {
  console.log("\nℹ️  Nenhuma linha executável alterada — gate satisfeito.");
  Deno.exit(0);
}
if (pct + 1e-9 < MIN_PCT) {
  console.error(`\n❌ Diff coverage ${pct.toFixed(2)}% < ${MIN_PCT}%.`);
  console.error(`   Adicione testes cobrindo: ${uncovered.join(", ")}`);
  Deno.exit(1);
}
console.log("\n✅ Diff coverage acima do threshold.");
