/**
 * Post / update a sticky PR comment comparing this run's E2E metrics against
 * the most recent run on main.
 *
 * Inputs (env):
 *   CURRENT_METRICS   path to metrics.json from this run (required)
 *   PREVIOUS_METRICS  path to metrics.json from previous main run (optional)
 *   GITHUB_TOKEN      auto-injected; used via github-script context
 *
 * Invoked from actions/github-script so `github` and `context` globals exist.
 */
const fs = require("fs");

const MARKER = "<!-- e2e-auditoria-trend -->";

function loadJson(path) {
  if (!path || !fs.existsSync(path)) return null;
  try { return JSON.parse(fs.readFileSync(path, "utf-8")); } catch { return null; }
}

function fmtPct(x) { return (x * 100).toFixed(0) + "%"; }
function fmtDur(x) { return x.toFixed(2) + "s"; }

function trend(curr, prev, kind) {
  if (prev == null) return "—";
  const diff = curr - prev;
  if (kind === "rate") {
    const arrow = Math.abs(diff) < 0.005 ? "→" : (diff > 0 ? "🔺" : "🔻");
    return `${arrow} ${(diff * 100 >= 0 ? "+" : "")}${(diff * 100).toFixed(0)}pp (was ${fmtPct(prev)})`;
  }
  const arrow = Math.abs(diff) < 0.05 ? "→" : (diff > 0 ? "🔺" : "🔻");
  return `${arrow} ${(diff >= 0 ? "+" : "")}${diff.toFixed(2)}s (was ${fmtDur(prev)})`;
}

module.exports = async ({ github, context }) => {
  const curr = loadJson(process.env.CURRENT_METRICS);
  if (!curr) { console.log("no current metrics; skipping comment"); return; }
  const prev = loadJson(process.env.PREVIOUS_METRICS);

  const cases = Object.keys(curr.cases).sort();
  const rows = cases.map((name) => {
    const c = curr.cases[name];
    const p = prev?.cases?.[name];
    return `| \`${name}\` | ${c.runs} | ${fmtPct(c.flake_rate)} | ${trend(c.flake_rate, p?.flake_rate ?? null, "rate")} | ${fmtDur(c.avg_duration_s)} | ${trend(c.avg_duration_s, p?.avg_duration_s ?? null, "dur")} |`;
  });

  const runUrl = `${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`;
  const t = curr.totals;
  const prevLink = prev?.run_id
    ? `[run ${prev.run_id}](${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/actions/runs/${prev.run_id})`
    : "_n/a_";

  const body = [
    MARKER,
    "### 🧪 E2E `/auditoria-requests` · trend vs previous main run",
    "",
    `- This run: [#${context.runId}](${runUrl}) · Passed **${t.passed}** · Flaky **${t.flaky}** · Failed **${t.failed}**`,
    `- Baseline: ${prevLink}`,
    "",
    "| Case | Runs | Flake rate | Δ flake | Avg duration | Δ duration |",
    "|---|---:|---:|:--|---:|:--|",
    ...rows,
    "",
    "_Artifacts: `e2e-html-report-*` (full Playwright report), `e2e-traces-*` (open at trace.playwright.dev), `e2e-shots-*`, `e2e-reports-*` (JUnit + summary)._",
  ].join("\n");

  const pr = context.payload.pull_request;
  if (!pr) { console.log("not a PR event; printing body only\n" + body); return; }

  const { owner, repo } = context.repo;
  const list = await github.paginate(github.rest.issues.listComments, {
    owner, repo, issue_number: pr.number, per_page: 100,
  });
  const existing = list.find((c) => c.body && c.body.includes(MARKER));
  if (existing) {
    await github.rest.issues.updateComment({ owner, repo, comment_id: existing.id, body });
    console.log(`updated PR comment ${existing.id}`);
  } else {
    await github.rest.issues.createComment({ owner, repo, issue_number: pr.number, body });
    console.log("created PR trend comment");
  }
};
