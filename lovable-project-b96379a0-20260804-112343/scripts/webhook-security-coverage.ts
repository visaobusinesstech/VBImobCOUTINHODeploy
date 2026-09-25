// Executa a suíte webhookSecurity com coverage e falha o processo quando
// as métricas de linhas/branches ficarem abaixo do threshold configurado.
//
// Uso:
//   deno run -A scripts/webhook-security-coverage.ts
//
// Thresholds também podem ser sobrescritos por env (útil em CI):
//   COVERAGE_MIN_LINES=82 COVERAGE_MIN_BRANCHES=86 deno run -A ...
//
// Saídas geradas em `coverage/webhook-security/`:
//   - lcov.info           (relatório LCOV para upload em Codecov/Coveralls)
//   - html/index.html     (relatório navegável)
//   - summary.json        (métricas consolidadas — consumido por dashboards)

const TEST_FILE = "supabase/functions/_shared/webhookSecurity.test.ts";
const TARGET_FILE = "supabase/functions/_shared/webhookSecurity.ts";
const OUT_DIR = "coverage/webhook-security";
const RAW_DIR = `${OUT_DIR}/raw`;

const MIN_LINES = Number(Deno.env.get("COVERAGE_MIN_LINES") ?? 80);
const MIN_BRANCHES = Number(Deno.env.get("COVERAGE_MIN_BRANCHES") ?? 85);

async function run(cmd: string[], opts: { capture?: boolean } = {}): Promise<{ code: number; stdout: string; stderr: string }> {
  const p = new Deno.Command(cmd[0], {
    args: cmd.slice(1),
    stdout: opts.capture ? "piped" : "inherit",
    stderr: opts.capture ? "piped" : "inherit",
  });
  const out = await p.output();
  return {
    code: out.code,
    stdout: opts.capture ? new TextDecoder().decode(out.stdout) : "",
    stderr: opts.capture ? new TextDecoder().decode(out.stderr) : "",
  };
}

// 1) Limpa saídas anteriores
try { await Deno.remove(OUT_DIR, { recursive: true }); } catch { /* ok */ }
await Deno.mkdir(RAW_DIR, { recursive: true });

// 2) Roda os testes com --coverage. O runner do Deno já falha se qualquer teste
//    quebrar; abortamos antes de olhar cobertura para não mascarar regressão.
const testRun = await run(["deno", "test", "-A", `--coverage=${RAW_DIR}`, TEST_FILE]);
if (testRun.code !== 0) {
  console.error(`\n❌ Suíte webhookSecurity falhou (exit ${testRun.code}). Cobertura não avaliada.`);
  Deno.exit(testRun.code);
}

// 3) Gera relatório LCOV escopado ao arquivo alvo (evita ruído de bibliotecas).
const lcovOut = await run(
  ["deno", "coverage", RAW_DIR, `--include=${TARGET_FILE}`, "--lcov"],
  { capture: true },
);
if (lcovOut.code !== 0) {
  console.error("❌ Falha ao gerar LCOV:\n" + lcovOut.stderr);
  Deno.exit(lcovOut.code);
}
await Deno.writeTextFile(`${OUT_DIR}/lcov.info`, lcovOut.stdout);

// 4) Relatório HTML navegável (útil ao inspecionar branches faltantes).
await run(["deno", "coverage", RAW_DIR, `--include=${TARGET_FILE}`, `--html`]);
try {
  await Deno.rename(`${RAW_DIR}/html`, `${OUT_DIR}/html`);
} catch { /* deno já pode ter escrito em cov/html; ignoramos */ }

// 5) Parse do LCOV para extrair line/branch coverage do arquivo alvo.
//    Formato: LF (linhas totais), LH (linhas cobertas), BRF/BRH (branches).
let LF = 0, LH = 0, BRF = 0, BRH = 0;
for (const line of lcovOut.stdout.split("\n")) {
  const [k, v] = line.split(":");
  if (!v) continue;
  const n = Number(v);
  if (k === "LF") LF += n;
  else if (k === "LH") LH += n;
  else if (k === "BRF") BRF += n;
  else if (k === "BRH") BRH += n;
}

const linePct = LF === 0 ? 100 : (LH / LF) * 100;
// LCOV do Deno omite BRF quando o arquivo não tem branches contáveis; nesse
// caso tratamos como 100% para não gerar falso negativo.
const branchPct = BRF === 0 ? 100 : (BRH / BRF) * 100;

const summary = {
  target: TARGET_FILE,
  test: TEST_FILE,
  generated_at: new Date().toISOString(),
  lines: { total: LF, covered: LH, pct: Number(linePct.toFixed(2)) },
  branches: { total: BRF, covered: BRH, pct: Number(branchPct.toFixed(2)) },
  thresholds: { lines: MIN_LINES, branches: MIN_BRANCHES },
};
await Deno.writeTextFile(`${OUT_DIR}/summary.json`, JSON.stringify(summary, null, 2));

// 6) Relatório em stdout + gate.
console.log("\n📊 Cobertura webhookSecurity");
console.log("────────────────────────────────────────────");
console.log(`  Linhas   : ${linePct.toFixed(2)}%  (${LH}/${LF})   mínimo ${MIN_LINES}%`);
console.log(`  Branches : ${branchPct.toFixed(2)}%  (${BRH}/${BRF})   mínimo ${MIN_BRANCHES}%`);
console.log("────────────────────────────────────────────");

const failures: string[] = [];
if (linePct + 1e-9 < MIN_LINES) failures.push(`linhas ${linePct.toFixed(2)}% < ${MIN_LINES}%`);
if (branchPct + 1e-9 < MIN_BRANCHES) failures.push(`branches ${branchPct.toFixed(2)}% < ${MIN_BRANCHES}%`);

// GitHub Actions: publica no summary do job.
const gh = Deno.env.get("GITHUB_STEP_SUMMARY");
if (gh) {
  const status = failures.length === 0 ? "✅" : "❌";
  const md = `## ${status} Cobertura webhookSecurity

| Métrica  | Valor | Mínimo |
|----------|-------|--------|
| Linhas   | ${linePct.toFixed(2)}% (${LH}/${LF}) | ${MIN_LINES}% |
| Branches | ${branchPct.toFixed(2)}% (${BRH}/${BRF}) | ${MIN_BRANCHES}% |

Alvo: \`${TARGET_FILE}\`
`;
  await Deno.writeTextFile(gh, md, { append: true });
}

if (failures.length > 0) {
  console.error(`\n❌ Cobertura abaixo do mínimo: ${failures.join(" · ")}`);
  console.error(`   Relatório HTML: ${OUT_DIR}/html/index.html`);
  Deno.exit(1);
}

console.log("\n✅ Cobertura acima do threshold.");
