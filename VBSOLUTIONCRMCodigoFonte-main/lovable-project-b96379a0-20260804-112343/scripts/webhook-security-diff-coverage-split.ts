// Diff coverage gate SEPARADO por camada (unit + integration) para webhookSecurity.
//
// Diferente de `webhook-security-diff-coverage.ts` (combinado), este script
// aplica o gate de diff coverage independentemente para cada camada, usando o
// LCOV gerado por `webhook-security-split-coverage.ts`:
//
//   coverage/webhook-security/unit/lcov.info
//   coverage/webhook-security/integration/lcov.info
//
// Regra: uma camada só reprova o PR se AS LINHAS ALTERADAS forem cobertas por
// aquela camada abaixo do mínimo dela. Isto evita que:
//   - regressão em unit seja mascarada por integration (e vice-versa);
//   - trechos exclusivamente de integração (ex.: seções de auditoria remota)
//     forcem unit a cobrir código que nunca é seu escopo.
//
// Uso:
//   deno run -A scripts/webhook-security-diff-coverage-split.ts
//
// Env:
//   DIFF_BASE_REF                        base do diff (default: origin/main)
//   DIFF_COVERAGE_MIN_UNIT               % mínimo (default: 90)
//   DIFF_COVERAGE_MIN_INTEGRATION        % mínimo (default: 70)
//   TARGET_FILE                          default: supabase/functions/_shared/webhookSecurity.ts
//   OUT_ROOT                             default: coverage/webhook-security

const TARGET_FILE = Deno.env.get("TARGET_FILE") ??
  "supabase/functions/_shared/webhookSecurity.ts";
const TEST_FILE = "supabase/functions/_shared/webhookSecurity.test.ts";
const OUT_ROOT = Deno.env.get("OUT_ROOT") ?? "coverage/webhook-security";
const BASE_REF = Deno.env.get("DIFF_BASE_REF") ?? "origin/main";

type Layer = { name: "unit" | "integration"; min: number };
const LAYERS: Layer[] = [
  { name: "unit",        min: Number(Deno.env.get("DIFF_COVERAGE_MIN_UNIT")        ?? 90) },
  { name: "integration", min: Number(Deno.env.get("DIFF_COVERAGE_MIN_INTEGRATION") ?? 70) },
];

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

// 1) Garante que os LCOVs por camada existam — se faltarem, roda o split gate.
async function ensureLcov() {
  const missing: string[] = [];
  for (const l of LAYERS) {
    try {
      await Deno.stat(`${OUT_ROOT}/${l.name}/lcov.info`);
    } catch {
      missing.push(l.name);
    }
  }
  if (missing.length === 0) return;
  console.log(`ℹ️  LCOV ausente para: ${missing.join(", ")} — executando split coverage.`);
  const gen = await run(["deno", "run", "-A", "scripts/webhook-security-split-coverage.ts"], false);
  // O split-coverage sai !=0 quando o gate absoluto reprova; para gerar o LCOV isso
  // é irrelevante — verificamos por presença do arquivo, não pelo exit code.
  for (const l of LAYERS) {
    try {
      await Deno.stat(`${OUT_ROOT}/${l.name}/lcov.info`);
    } catch {
      console.error(`❌ LCOV de "${l.name}" não foi gerado (exit split=${gen.code}).`);
      Deno.exit(1);
    }
  }
}
await ensureLcov();

// 2) Diff base
async function ensureBase(ref: string) {
  const check = await run(["git", "rev-parse", "--verify", ref]);
  if (check.code === 0) return ref;
  const [remote, ...rest] = ref.split("/");
  const branch = rest.join("/");
  if (remote && branch) {
    await run(["git", "fetch", "--no-tags", "--depth=200", remote, branch]);
    const retry = await run(["git", "rev-parse", "--verify", ref]);
    if (retry.code === 0) return ref;
  }
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
      // ignorar
    } else if (!line.startsWith("\\")) {
      current++;
      remaining--;
    }
  }
}

// 3) Hitmap por LCOV
async function loadHitmap(lcovPath: string): Promise<Map<number, number>> {
  const lcov = await Deno.readTextFile(lcovPath);
  const hits = new Map<number, number>();
  const targetSuffix = TARGET_FILE.replace(/\\/g, "/");
  let inTarget = false;
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
  return hits;
}

function groupRanges(lines: number[]): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];
  for (const ln of lines) {
    const last = ranges[ranges.length - 1];
    if (last && ln === last.end + 1) last.end = ln;
    else ranges.push({ start: ln, end: ln });
  }
  return ranges;
}

const esc = (v: string) => v.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
const escProp = (v: string) => esc(v).replace(/:/g, "%3A").replace(/,/g, "%2C");

type LayerResult = {
  layer: Layer["name"];
  threshold: number;
  changed_lines: number;
  executable_changed: number;
  covered: number;
  uncovered_lines: number[];
  pct: number;
  failed: boolean;
};

const results: LayerResult[] = [];

for (const layer of LAYERS) {
  const hits = await loadHitmap(`${OUT_ROOT}/${layer.name}/lcov.info`);

  const executableChanged: number[] = [];
  const uncovered: number[] = [];
  for (const ln of [...changedLines].sort((a, b) => a - b)) {
    if (!hits.has(ln)) continue; // não executável nesta camada
    executableChanged.push(ln);
    if ((hits.get(ln) ?? 0) === 0) uncovered.push(ln);
  }
  const total = executableChanged.length;
  const covered = total - uncovered.length;
  const pct = total === 0 ? 100 : (covered / total) * 100;
  const failed = total > 0 && (pct + 1e-9 < layer.min);

  const summary: LayerResult = {
    layer: layer.name,
    threshold: layer.min,
    changed_lines: changedLines.size,
    executable_changed: total,
    covered,
    uncovered_lines: uncovered,
    pct: Number(pct.toFixed(2)),
    failed,
  };
  results.push(summary);

  await Deno.mkdir(`${OUT_ROOT}/${layer.name}`, { recursive: true });
  await Deno.writeTextFile(
    `${OUT_ROOT}/${layer.name}/diff-summary.json`,
    JSON.stringify({
      ...summary,
      target: TARGET_FILE,
      base_ref: base,
      generated_at: new Date().toISOString(),
    }, null, 2),
  );

  // PR annotations por camada (só na que falhar — warning nas outras com trechos descobertos).
  if (Deno.env.get("GITHUB_ACTIONS") === "true" && uncovered.length > 0) {
    const level = failed ? "error" : "warning";
    const title = failed
      ? `Diff coverage (${layer.name}) abaixo do mínimo (${layer.min}%)`
      : `Linha alterada sem cobertura de ${layer.name}`;
    for (const { start, end } of groupRanges(uncovered)) {
      const span = start === end ? `linha ${start}` : `linhas ${start}–${end}`;
      const message =
        `${span} de ${TARGET_FILE} não é exercitada pela camada **${layer.name}** de ${TEST_FILE}. ` +
        (failed
          ? `Adicione teste ${layer.name} cobrindo esse trecho para manter diff coverage ≥ ${layer.min}% (atual: ${pct.toFixed(2)}%).`
          : `Diff coverage atual: ${pct.toFixed(2)}% (mín. ${layer.min}%).`);
      const props = [
        `file=${escProp(TARGET_FILE)}`,
        `line=${start}`,
        `endLine=${end}`,
        `title=${escProp(title)}`,
      ].join(",");
      console.log(`::${level} ${props}::${esc(message)}`);
    }
  }
}

// Relatório consolidado
console.log("\n📐 Diff coverage por camada · webhookSecurity");
console.log("─────────────────────────────────────────────────────────────");
console.log(`  Base ref            : ${base}`);
console.log(`  Linhas alteradas    : ${changedLines.size}`);
for (const r of results) {
  const status = r.failed ? "❌" : (r.executable_changed === 0 ? "➖" : "✅");
  console.log(
    `  ${status} ${r.layer.padEnd(11)} exec=${String(r.executable_changed).padStart(3)}` +
    `  cob=${String(r.covered).padStart(3)}  pct=${r.pct.toFixed(2)}%  mín=${r.threshold}%` +
    (r.uncovered_lines.length ? `  faltando=${r.uncovered_lines.slice(0, 15).join(",")}${r.uncovered_lines.length > 15 ? "…" : ""}` : ""),
  );
}
console.log("─────────────────────────────────────────────────────────────");

// Summary consolidado (raiz — para o comentário do PR ler tudo em um só lugar)
await Deno.writeTextFile(
  `${OUT_ROOT}/diff-summary-split.json`,
  JSON.stringify({
    target: TARGET_FILE,
    base_ref: base,
    changed_lines: changedLines.size,
    layers: results,
    generated_at: new Date().toISOString(),
  }, null, 2),
);

const gh = Deno.env.get("GITHUB_STEP_SUMMARY");
if (gh) {
  const rows = results.map((r) => {
    const status = r.failed ? "❌" : (r.executable_changed === 0 ? "➖" : "✅");
    const list = r.uncovered_lines.length
      ? r.uncovered_lines.slice(0, 30).join(", ") + (r.uncovered_lines.length > 30 ? " …" : "")
      : "—";
    return `| ${status} ${r.layer} | ${r.executable_changed} | ${r.covered} | ${r.pct.toFixed(2)}% | ${r.threshold}% | ${list} |`;
  }).join("\n");
  const md = `## Diff coverage · webhookSecurity (por camada)

Base: \`${base}\` · Linhas alteradas: **${changedLines.size}**

| Camada | Executáveis | Cobertas | Diff cov. | Mínimo | Linhas alteradas sem cobertura |
|--------|-------------|----------|-----------|--------|--------------------------------|
${rows}

Regra: **cada camada falha só se as linhas alteradas exclusivas dela ficarem abaixo do seu próprio mínimo**.
`;
  await Deno.writeTextFile(gh, md, { append: true });
}

const failing = results.filter((r) => r.failed);
if (failing.length > 0) {
  for (const r of failing) {
    console.error(
      `\n❌ Camada "${r.layer}" diff coverage ${r.pct.toFixed(2)}% < ${r.threshold}%.` +
      (r.uncovered_lines.length ? `\n   Cubra: ${r.uncovered_lines.join(", ")}` : ""),
    );
  }
  Deno.exit(1);
}
console.log("\n✅ Todas as camadas ≥ threshold de diff coverage.");
