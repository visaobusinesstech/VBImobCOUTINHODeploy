"""
Aggregate per-shard JUnit XMLs into:
  - reports/metrics.json (per-case flake rate + avg duration)
  - $GITHUB_STEP_SUMMARY  (markdown summary w/ artifact paths and links)
  - exit code 1          (when E2E_FLAKE_RATE_MAX is exceeded)

CLI: python aggregate_reports.py <reports_dir>
Env:
  E2E_FLAKE_RATE_MAX     fraction in [0..1]; case flake-rate above this fails
                         the workflow (default: unset = disabled).
  GITHUB_*               standard CI vars used for run/artifact links.
"""

from __future__ import annotations

import json
import os
import sys
import xml.etree.ElementTree as ET
from collections import defaultdict
from pathlib import Path


def parse(file: Path) -> list[dict]:
    out: list[dict] = []
    try:
        root = ET.parse(file).getroot()
    except ET.ParseError as exc:
        print(f"warn: failed to parse {file}: {exc}", file=sys.stderr)
        return out
    suite_name = root.attrib.get("name", file.stem)
    # Shard label: strip "auditoria-requests[shard-1]" → "shard-1"
    shard = suite_name
    if "[" in shard and shard.endswith("]"):
        shard = shard[shard.index("[") + 1 : -1]
    for tc in root.iter("testcase"):
        name = tc.attrib.get("name", "?")
        duration = float(tc.attrib.get("time", 0) or 0)
        failure = tc.find("failure")
        sysout = tc.find("system-out")
        if failure is not None:
            status = "failed"
            note = (failure.text or failure.attrib.get("message") or "").strip()
        elif sysout is not None and "FLAKY" in (sysout.text or ""):
            status = "flaky"
            note = (sysout.text or "").strip()
        else:
            status = "passed"
            note = ""
        out.append({"shard": shard, "case": name, "status": status,
                    "duration": duration, "note": note})
    return out


def run_url() -> str:
    base = os.environ.get("GITHUB_SERVER_URL", "https://github.com")
    repo = os.environ.get("GITHUB_REPOSITORY", "")
    rid = os.environ.get("GITHUB_RUN_ID", "")
    if repo and rid:
        return f"{base}/{repo}/actions/runs/{rid}"
    return ""


def artifact_block(shard: str, case: str, attempt: int | None) -> str:
    """Markdown bullets pointing to the exact artifact + file inside it."""
    run = run_url()
    base = f"{run}#artifacts" if run else "(see workflow artifacts)"
    a = f"attempt{attempt}" if attempt else "attempt*"
    return (
        f"  - 📸 Screenshot: artifact `e2e-shots-{shard}` → "
        f"`e2e-shots/{shard}__{case}.{a}.fail.png` "
        f"([open run]({base}))\n"
        f"  - 🎞 Trace: artifact `e2e-traces-{shard}` → "
        f"`e2e-traces/{shard}__{case}__{a}.trace.zip` "
        f"(load on https://trace.playwright.dev)\n"
        f"  - 📄 Full report: artifact `e2e-html-report-{shard}` → "
        f"`report-{shard}.html`"
    )


def main() -> int:
    root = Path(sys.argv[1] if len(sys.argv) > 1 else "reports")
    files = sorted(root.rglob("junit-*.xml"))
    if not files:
        print(f"no junit files under {root}", file=sys.stderr)
        return 0

    rows: list[dict] = []
    for f in files:
        rows.extend(parse(f))

    per_case: dict[str, list[dict]] = defaultdict(list)
    for r in rows:
        per_case[r["case"]].append(r)

    # ── metrics.json ─────────────────────────────────────────────────────
    metrics: dict = {
        "run_id": os.environ.get("GITHUB_RUN_ID"),
        "sha": os.environ.get("GITHUB_SHA"),
        "ref": os.environ.get("GITHUB_REF"),
        "totals": {"passed": 0, "flaky": 0, "failed": 0},
        "cases": {},
    }
    for r in rows:
        metrics["totals"][r["status"]] += 1
    for case, rs in per_case.items():
        n = len(rs)
        flaky = sum(1 for r in rs if r["status"] == "flaky")
        failed = sum(1 for r in rs if r["status"] == "failed")
        avg = sum(r["duration"] for r in rs) / n if n else 0.0
        metrics["cases"][case] = {
            "runs": n,
            "flaky": flaky,
            "failed": failed,
            "passed": n - flaky - failed,
            "flake_rate": (flaky / n) if n else 0.0,
            "avg_duration_s": round(avg, 3),
        }
    (root / "metrics.json").write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    print(f"wrote metrics → {root / 'metrics.json'}")

    # ── step summary ─────────────────────────────────────────────────────
    summary_lines: list[str] = ["## E2E aggregate · /auditoria-requests", ""]
    t = metrics["totals"]
    summary_lines.append(
        f"- Shards: **{len({r['shard'] for r in rows})}** "
        f"· Cases run: **{len(rows)}** "
        f"· Passed: **{t['passed']}** "
        f"· Flaky: **{t['flaky']}** "
        f"· Failed: **{t['failed']}**"
    )
    ru = run_url()
    if ru:
        summary_lines.append(f"- Artifacts: [open run page]({ru}#artifacts)")
    summary_lines.append("")

    flaky_cases = [c for c, rs in per_case.items() if any(r["status"] == "flaky" for r in rs)]
    if flaky_cases:
        summary_lines.append("### Flaky scenarios (rate across shards)")
        summary_lines.append("")
        summary_lines.append("| Case | Runs | Flaky | Failed | Flake rate | Avg duration |")
        summary_lines.append("|---|---:|---:|---:|---:|---:|")
        for case in sorted(flaky_cases):
            m = metrics["cases"][case]
            summary_lines.append(
                f"| `{case}` | {m['runs']} | {m['flaky']} | {m['failed']} "
                f"| {m['flake_rate']*100:.0f}% | {m['avg_duration_s']:.2f}s |"
            )
        summary_lines.append("")
        summary_lines.append("**Evidence for flaky scenarios:**")
        summary_lines.append("")
        for case in sorted(flaky_cases):
            shard = next(r["shard"] for r in per_case[case] if r["status"] == "flaky")
            summary_lines.append(f"- `{case}` (shard `{shard}`)")
            summary_lines.append(artifact_block(shard, case, None))
        summary_lines.append("")

    failed_rows = [r for r in rows if r["status"] == "failed"]
    if failed_rows:
        summary_lines.append("### Failures")
        summary_lines.append("")
        summary_lines.append("| Shard | Case | Error |")
        summary_lines.append("|---|---|---|")
        for r in failed_rows:
            err = (r["note"] or "").splitlines()[0][:180]
            summary_lines.append(f"| {r['shard']} | `{r['case']}` | {err} |")
        summary_lines.append("")
        summary_lines.append("**Evidence for failures:**")
        summary_lines.append("")
        for r in failed_rows:
            summary_lines.append(f"- `{r['case']}` (shard `{r['shard']}`)")
            summary_lines.append(artifact_block(r["shard"], r["case"], None))
        summary_lines.append("")

    md = "\n".join(summary_lines)
    print(md)
    out = os.environ.get("GITHUB_STEP_SUMMARY")
    if out:
        with open(out, "a", encoding="utf-8") as fh:
            fh.write(md + "\n")

    # ── threshold gate ───────────────────────────────────────────────────
    threshold_raw = os.environ.get("E2E_FLAKE_RATE_MAX")
    over_threshold: list[tuple[str, float]] = []
    if threshold_raw:
        try:
            threshold = float(threshold_raw)
        except ValueError:
            print(f"warn: invalid E2E_FLAKE_RATE_MAX={threshold_raw!r}", file=sys.stderr)
            threshold = None
        if threshold is not None:
            for case, m in metrics["cases"].items():
                if m["flake_rate"] > threshold:
                    over_threshold.append((case, m["flake_rate"]))
            if over_threshold:
                msg = "; ".join(f"{c}={r*100:.0f}%" for c, r in over_threshold)
                line = (
                    f"❌ Flake-rate threshold exceeded "
                    f"(max={threshold*100:.0f}%): {msg}"
                )
                print(line)
                if out:
                    with open(out, "a", encoding="utf-8") as fh:
                        fh.write(f"\n> {line}\n")
                # GitHub error annotation
                print(f"::error title=E2E flake-rate threshold exceeded::{line}")

    if failed_rows or over_threshold:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
