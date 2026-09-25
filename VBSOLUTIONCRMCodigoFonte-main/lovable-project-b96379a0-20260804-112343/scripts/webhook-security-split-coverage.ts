// Gate de cobertura SEPARADO por camada de teste da suíte webhookSecurity.
//
// Motivação: rodar unit + integration juntos permite que testes de integração
// (que exercitam caminhos amplos — cache remoto, concorrência, auditoria, etc.)
// mascarem a queda de cobertura dos testes unitários (e vice-versa). Este gate
// executa CADA camada isoladamente, gera um LCOV próprio e aplica thresholds
// independentes.
//
// Classificação (por nome do teste em `webhookSecurity.test.ts`):
//   INTEGRATION → testes cujo nome contém qualquer um destes marcadores:
//                 "Cache remoto" | "Concorrência" | "Correlação"
//               | "Log estruturado" | "auditoria" | "fallback pelo DB"
//   UNIT        → todos os demais.
//
// Uso:
//   deno run -A scripts/webhook-security-split-coverage.ts
//
// Env (thresholds — CI deve travar ≥ ao observado em main):
//   COVERAGE_MIN_UNIT_LINES         (default 75)
//   COVERAGE_MIN_UNIT_BRANCHES      (default 80)
//   COVERAGE_MIN_INTEGRATION_LINES  (default 55)
//   COVERAGE_MIN_INTEGRATION_BRANCHES (default 60)
//
// Saídas em `coverage/webhook-security/{unit,integration}/`:
//   - lcov.info
//   - summary.json

const TEST_FILE = "supabase/functions/_shared/webhookSecurity.test.ts";
const TARGET_FILE = "supabase/functions/_shared/webhookSecurity.ts";
const OUT_ROOT = "coverage/webhook-security";

// Regex é aplicado pelo Deno como JS RegExp (formato /.../). Usamos alternância
// para o subset de integração e um lookahead negativo para o de unit — assim os
// dois filtros são disjuntos e cobrem 100% dos `Deno.test` da suíte.
const INTEGRATION_MARKERS = [
  "Cache remoto",
  "Concorrência",
  "Correlação",
  "Log estruturado",
  "auditoria",
  "fallback pelo DB",
];
const INTEGRATION_FILTER = `/(${INTEGRATION_MARKERS.join("|")})/`;
const UNIT_FILTER = `/^(?!.*(${INTEGRATION_MARKERS.join("|")})).*$/`;

type Layer = {
  name: "unit" | "integration";
  filter: string;
  minLines: number;
  minBranches: number;
};

const LAYERS: Layer[] = [
  {
    name: "unit",
    filter: UNIT_FILTER,
    minLines: Number(Deno.env.get("COVERAGE_MIN_UNIT_LINES") ?? 75),
    minBranches: Number(Deno.env.get("COVERAGE_MIN_UNIT_BRANCHES") ?? 80),
  },
  {
    name: "integration",
    filter: INTEGRATION_FILTER,
    minLines: Number(Deno.env.get("COVERAGE_MIN_INTEGRATION_LINES") ?? 55),
    minBranches: Number(Deno.env.get("COVERAGE_MIN_INTEGRATION_BRANCHES") ?? 60),
  },
];

async function run(cmd: string[], capture = false) {
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

function parseLcov(lcov: string) {
  let LF = 0, LH = 0, BRF = 0, BRH = 0;
  const uncoveredLines: number[] = [];
  const uncoveredBranches: number[] = [];
  for (const line of lcov.split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const k = line.slice(0, idx);
    const v = line.slice(idx + 1);
    if (k === "DA") {
      // DA:<line>,<hits>
      const [ln, hits] = v.split(",");
      if (Number(hits) === 0) uncoveredLines.push(Number(ln));
    } else if (k === "BRDA") {
      // BRDA:<line>,<block>,<branch>,<taken|->
      const parts = v.split(",");
      const ln = Number(parts[0]);
      const taken = parts[3];
      if (taken === "-" || taken === "0") {
        if (!uncoveredBranches.includes(ln)) uncoveredBranches.push(ln);
      }
    } else {
      const n = Number(v);
      if (Number.isNaN(n)) continue;
      if (k === "LF") LF += n;
      else if (k === "LH") LH += n;
      else if (k === "BRF") BRF += n;
      else if (k === "BRH") BRH += n;
    }
  }
  const linePct = LF === 0 ? 100 : (LH / LF) * 100;
  const branchPct = BRF === 0 ? 100 : (BRH / BRF) * 100;
  uncoveredLines.sort((a, b) => a - b);
  uncoveredBranches.sort((a, b) => a - b);
  return { LF, LH, BRF, BRH, linePct, branchPct, uncoveredLines, uncoveredBranches };
}

// Compacta uma lista ordenada de números em ranges: [1,2,3,7,9,10] → "1-3, 7, 9-10"
function compactRanges(nums: number[]): string {
  if (nums.length === 0) return "";
  const out: string[] = [];
  let start = nums[0], prev = nums[0];
  for (let i = 1; i < nums.length; i++) {
    const n = nums[i];
    if (n === prev + 1) { prev = n; continue; }
    out.push(start === prev ? `${start}` : `${start}-${prev}`);
    start = n;
    prev = n;
  }
  out.push(start === prev ? `${start}` : `${start}-${prev}`);
  return out.join(", ");
}

try { await Deno.remove(OUT_ROOT, { recursive: true }); } catch { /* ok */ }
await Deno.mkdir(OUT_ROOT, { recursive: true });

const results: Array<{
  layer: Layer;
  metrics: ReturnType<typeof parseLcov>;
  failures: string[];
  tests_ran: number;
}> = [];

for (const layer of LAYERS) {
  const outDir = `${OUT_ROOT}/${layer.name}`;
  const rawDir = `${outDir}/raw`;
  await Deno.mkdir(rawDir, { recursive: true });

  console.log(`\n🧪 Executando camada "${layer.name}" (filter=${layer.filter})`);
  const test = await run([
    "deno", "test", "-A",
    `--coverage=${rawDir}`,
    `--filter=${layer.filter}`,
    TEST_FILE,
  ], true);
  // stdout precisa ser preservado no console para diagnóstico:
  Deno.stdout.writeSync(new TextEncoder().encode(test.stdout));
  Deno.stderr.writeSync(new TextEncoder().encode(test.stderr));

  if (test.code !== 0) {
    console.error(`\n❌ Suíte "${layer.name}" falhou (exit ${test.code}) — cobertura não avaliada.`);
    Deno.exit(test.code);
  }

  // Sanity: garante que o filtro efetivamente rodou testes. Se um marcador for
  // renomeado, o subset pode virar vazio e mascarar regressões silenciosamente.
  const ranMatch = test.stdout.match(/(\d+)\s+passed(?:\s*\(\d+\s*steps?\))?/);
  const testsRan = ranMatch ? Number(ranMatch[1]) : 0;
  if (testsRan === 0) {
    console.error(
      `\n❌ Camada "${layer.name}" não executou nenhum teste — filtro provavelmente desatualizado ` +
      `(marcadores: ${INTEGRATION_MARKERS.join(", ")}). Falhando o gate para evitar regressão silenciosa.`,
    );
    Deno.exit(2);
  }

  const lcov = await run(
    ["deno", "coverage", rawDir, `--include=${TARGET_FILE}`, "--lcov"],
    true,
  );
  if (lcov.code !== 0) {
    console.error(`❌ Falha ao gerar LCOV (${layer.name}):\n${lcov.stderr}`);
    Deno.exit(lcov.code);
  }
  await Deno.writeTextFile(`${outDir}/lcov.info`, lcov.stdout);

  const metrics = parseLcov(lcov.stdout);
  const failures: string[] = [];
  if (metrics.linePct + 1e-9 < layer.minLines) {
    failures.push(`linhas ${metrics.linePct.toFixed(2)}% < ${layer.minLines}%`);
  }
  if (metrics.branchPct + 1e-9 < layer.minBranches) {
    failures.push(`branches ${metrics.branchPct.toFixed(2)}% < ${layer.minBranches}%`);
  }

  await Deno.writeTextFile(
    `${outDir}/summary.json`,
    JSON.stringify({
      layer: layer.name,
      target: TARGET_FILE,
      test: TEST_FILE,
      tests_ran: testsRan,
      filter: layer.filter,
      generated_at: new Date().toISOString(),
      lines: {
        total: metrics.LF,
        covered: metrics.LH,
        pct: Number(metrics.linePct.toFixed(2)),
        uncovered: metrics.uncoveredLines,
        uncovered_ranges: compactRanges(metrics.uncoveredLines),
      },
      branches: {
        total: metrics.BRF,
        covered: metrics.BRH,
        pct: Number(metrics.branchPct.toFixed(2)),
        uncovered: metrics.uncoveredBranches,
        uncovered_ranges: compactRanges(metrics.uncoveredBranches),
      },
      thresholds: { lines: layer.minLines, branches: layer.minBranches },
      failures,
    }, null, 2),
  );

  results.push({ layer, metrics, failures, tests_ran: testsRan });
}

// Relatório consolidado.
console.log("\n📊 Cobertura webhookSecurity — camadas isoladas");
console.log("──────────────────────────────────────────────────────────────");
console.log("  Camada        Testes   Linhas         Branches");
for (const r of results) {
  const l = `${r.metrics.linePct.toFixed(2)}% (${r.metrics.LH}/${r.metrics.LF}) ≥ ${r.layer.minLines}%`;
  const b = `${r.metrics.branchPct.toFixed(2)}% (${r.metrics.BRH}/${r.metrics.BRF}) ≥ ${r.layer.minBranches}%`;
  console.log(`  ${r.layer.name.padEnd(12)}  ${String(r.tests_ran).padStart(5)}    ${l}    ${b}`);
}
console.log("──────────────────────────────────────────────────────────────");

const gh = Deno.env.get("GITHUB_STEP_SUMMARY");
if (gh) {
  const rows = results.map((r) => {
    const status = r.failures.length === 0 ? "✅" : "❌";
    return `| ${status} ${r.layer.name} | ${r.tests_ran} | ${r.metrics.linePct.toFixed(2)}% (${r.metrics.LH}/${r.metrics.LF}) | ${r.layer.minLines}% | ${r.metrics.branchPct.toFixed(2)}% (${r.metrics.BRH}/${r.metrics.BRF}) | ${r.layer.minBranches}% |`;
  }).join("\n");
  const md = `## Cobertura webhookSecurity — camadas isoladas

| Camada | Testes | Linhas | Mín. linhas | Branches | Mín. branches |
|--------|--------|--------|-------------|----------|---------------|
${rows}

Cada camada tem seu próprio LCOV — regressões em unit **não** são absorvidas por integration (e vice-versa).
`;
  await Deno.writeTextFile(gh, md, { append: true });
}

const failing = results.filter((r) => r.failures.length > 0);
if (failing.length > 0) {
  for (const r of failing) {
    console.error(`\n❌ Camada "${r.layer.name}" abaixo do mínimo: ${r.failures.join(" · ")}`);
  }
  Deno.exit(1);
}
console.log("\n✅ Todas as camadas acima do threshold.");
