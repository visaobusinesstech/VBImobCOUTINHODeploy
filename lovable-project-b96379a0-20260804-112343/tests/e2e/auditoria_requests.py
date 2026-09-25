"""
E2E tests for /auditoria-requests shared-link / toast flows.

Runs four scenarios against a running dev server. Each attempt is wrapped in
a Playwright tracing session; on failure the trace.zip is persisted next to
the screenshot for the shard. Emits JUnit XML + a small HTML summary per run
and writes GitHub workflow commands (annotations + step summary).

Env knobs:
  BASE_URL          — preview URL (default http://localhost:8080)
  E2E_CASES         — comma list of case ids to run (default: all)
  E2E_RETRIES       — extra attempts on failure (default 0)
  E2E_SHOTS_DIR     — where to write screenshots
  E2E_TRACES_DIR    — where to write failing-attempt traces
  E2E_REPORT_DIR    — where to write junit-*.xml and summary-*.html
  E2E_SHARD         — shard name used in report filenames (default 'default')
  GITHUB_STEP_SUMMARY / GITHUB_ACTIONS — picked up automatically when on CI

Exit codes: 0 = all selected cases passed (retries allowed); 1 = at least one failed.
"""

from __future__ import annotations

import asyncio
import html
import inspect
import json
import os
import sys
import time
from pathlib import Path
from xml.sax.saxutils import escape as xml_escape

from playwright.async_api import async_playwright, Page, BrowserContext

BASE_URL = os.environ.get("BASE_URL", "http://localhost:8080").rstrip("/")
SHARD = os.environ.get("E2E_SHARD", "default")
SHOTS = Path(os.environ.get("E2E_SHOTS_DIR", "/tmp/audit-e2e-shots"))
TRACES = Path(os.environ.get("E2E_TRACES_DIR", "/tmp/audit-e2e-traces"))
REPORTS = Path(os.environ.get("E2E_REPORT_DIR", "/tmp/audit-e2e-reports"))
for d in (SHOTS, TRACES, REPORTS):
    d.mkdir(parents=True, exist_ok=True)

RETRIES = max(0, int(os.environ.get("E2E_RETRIES", "0")))
ON_CI = os.environ.get("GITHUB_ACTIONS") == "true"
STEP_SUMMARY = os.environ.get("GITHUB_STEP_SUMMARY")
SELF_FILE = Path(__file__).resolve()
REPO_ROOT = Path(os.environ.get("GITHUB_WORKSPACE", SELF_FILE.parents[2])).resolve()

VIEWPORT = {"width": 1280, "height": 1800}


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────

async def visible_toast_titles(page: Page) -> list[str]:
    return await page.evaluate(
        """() => Array.from(document.querySelectorAll('[role="status"], [data-radix-toast-title], li[role="status"]'))
              .map(el => (el.textContent || '').trim())
              .filter(Boolean)"""
    )


async def expect_toast(page: Page, needle: str, *, timeout_ms: int = 7000) -> str:
    deadline = asyncio.get_event_loop().time() + timeout_ms / 1000
    last: list[str] = []
    while asyncio.get_event_loop().time() < deadline:
        last = await visible_toast_titles(page)
        for t in last:
            if needle.lower() in t.lower():
                return t
        await page.wait_for_timeout(200)
    raise AssertionError(f"Toast containing {needle!r} not found. Saw: {last}")


async def expect_no_toast(page: Page, needles: list[str], *, settle_ms: int = 2500) -> None:
    await page.wait_for_timeout(settle_ms)
    titles = await visible_toast_titles(page)
    blob = " | ".join(titles).lower()
    for needle in needles:
        if needle.lower() in blob:
            raise AssertionError(f"Unexpected toast {needle!r}. Saw: {titles}")


# ──────────────────────────────────────────────────────────────────────────────
# Cases
# ──────────────────────────────────────────────────────────────────────────────

async def _case_invalid(pg: Page) -> None:
    await expect_toast(pg, "Parâmetros inválidos ignorados")


async def _case_shared(pg: Page) -> None:
    await expect_toast(pg, "Configuração compartilhada aplicada")


async def _case_view(pg: Page) -> None:
    t = await expect_toast(pg, "Visualização carregada")
    assert "Minha View" in t, f"view name missing in toast: {t!r}"


async def _case_clean(pg: Page) -> None:
    await expect_no_toast(
        pg,
        [
            "Parâmetros inválidos ignorados",
            "Configuração compartilhada aplicada",
            "Visualização carregada",
        ],
    )


CASES: dict[str, tuple[str, callable]] = {
    "invalid-params": (
        "/auditoria-requests?sort=bogus&dir=sideways&status=nope&size=999&page=-3&fn=has%20space",
        _case_invalid,
    ),
    "shared-link": (
        "/auditoria-requests?q=aval_&status=error&sort=function_name&dir=asc&size=100&page=1",
        _case_shared,
    ),
    "named-view": (
        "/auditoria-requests?view=Minha%20View&status=ok",
        _case_view,
    ),
    "clean-url": ("/auditoria-requests", _case_clean),
}


def case_source_location(name: str) -> tuple[str, int]:
    """Return (repo-relative file, line) for the case fn — used in GH annotations."""
    _, fn = CASES[name]
    try:
        _, line = inspect.getsourcelines(fn)
    except OSError:
        line = 1
    try:
        rel = SELF_FILE.relative_to(REPO_ROOT).as_posix()
    except ValueError:
        rel = SELF_FILE.as_posix()
    return rel, line


def select_cases() -> list[str]:
    raw: list[str] = []
    if len(sys.argv) > 1:
        raw = sys.argv[1:]
    elif os.environ.get("E2E_CASES"):
        raw = [s.strip() for s in os.environ["E2E_CASES"].split(",") if s.strip()]
    if not raw:
        return list(CASES.keys())
    unknown = [c for c in raw if c not in CASES]
    if unknown:
        print(f"unknown case(s): {unknown}. valid: {list(CASES.keys())}", file=sys.stderr)
        sys.exit(2)
    return raw


# ──────────────────────────────────────────────────────────────────────────────
# Reporting
# ──────────────────────────────────────────────────────────────────────────────

def gh_cmd(level: str, message: str, *, file: str | None = None, line: int | None = None, title: str | None = None) -> None:
    """Emit a GitHub workflow annotation (warning/error/notice)."""
    if not ON_CI:
        return
    params: list[str] = []
    if file:
        params.append(f"file={file}")
    if line:
        params.append(f"line={line}")
    if title:
        params.append(f"title={title}")
    head = f"::{level} " + ",".join(params) if params else f"::{level}"
    # Annotations don't render multi-line — collapse.
    msg = message.replace("\n", "%0A").replace("\r", "%0D")
    print(f"{head}::{msg}", flush=True)


def append_summary(md: str) -> None:
    if not STEP_SUMMARY:
        return
    try:
        with open(STEP_SUMMARY, "a", encoding="utf-8") as fh:
            fh.write(md + "\n")
    except OSError as exc:
        print(f"warn: failed to append step summary: {exc}", file=sys.stderr)


def write_junit(results: list[dict], total_seconds: float) -> Path:
    name = f"junit-{SHARD}.xml"
    path = REPORTS / name
    failures = sum(1 for r in results if r["status"] == "failed")
    parts = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        f'<testsuite name="auditoria-requests[{SHARD}]" '
        f'tests="{len(results)}" failures="{failures}" '
        f'time="{total_seconds:.3f}">',
    ]
    for r in results:
        case_attr = xml_escape(r["name"])
        time_attr = f'{r["duration"]:.3f}'
        parts.append(f'  <testcase classname="auditoria-requests" name="{case_attr}" time="{time_attr}">')
        if r["status"] == "failed":
            err = xml_escape(r["error"] or "failed")
            parts.append(f'    <failure message="{err}"><![CDATA[{r["error"]}\nattempts={r["attempts"]}]]></failure>')
        elif r["status"] == "flaky":
            parts.append(f'    <system-out><![CDATA[FLAKY: passed on attempt {r["attempts"]}; first error: {r["error"]}]]></system-out>')
        parts.append("  </testcase>")
    parts.append("</testsuite>")
    path.write_text("\n".join(parts), encoding="utf-8")
    return path


def write_html_summary(results: list[dict], total_seconds: float) -> Path:
    path = REPORTS / f"summary-{SHARD}.html"
    rows = []
    for r in results:
        badge = {
            "passed": '<span style="color:#0a7f2e">PASS</span>',
            "flaky": '<span style="color:#b76e00">FLAKY</span>',
            "failed": '<span style="color:#b00020">FAIL</span>',
        }[r["status"]]
        err = html.escape(r["error"] or "")
        rows.append(
            f"<tr><td>{html.escape(r['name'])}</td><td>{badge}</td>"
            f"<td>{r['attempts']}</td><td>{r['duration']:.2f}s</td>"
            f"<td><pre style='margin:0;white-space:pre-wrap'>{err}</pre></td></tr>"
        )
    failed = sum(1 for r in results if r["status"] == "failed")
    flaky = sum(1 for r in results if r["status"] == "flaky")
    body = f"""<!doctype html><meta charset="utf-8"><title>E2E summary · {html.escape(SHARD)}</title>
<style>body{{font:14px system-ui;margin:24px;color:#222}}
table{{border-collapse:collapse;width:100%}} th,td{{border:1px solid #ddd;padding:6px 10px;text-align:left;vertical-align:top}}
th{{background:#f5f5f7}}</style>
<h1>E2E · /auditoria-requests · shard <code>{html.escape(SHARD)}</code></h1>
<p>Total: {len(results)} · Passed: {len(results)-failed-flaky} · Flaky: {flaky} · Failed: {failed} · Duration: {total_seconds:.2f}s</p>
<table><thead><tr><th>Case</th><th>Status</th><th>Attempts</th><th>Duration</th><th>Error</th></tr></thead>
<tbody>{''.join(rows)}</tbody></table>"""
    path.write_text(body, encoding="utf-8")
    return path


# ──────────────────────────────────────────────────────────────────────────────
# Runner
# ──────────────────────────────────────────────────────────────────────────────

KEEP_TRACES = os.environ.get("E2E_KEEP_TRACES", "failed").lower()  # 'failed' | 'all'


async def run_attempt(context: BrowserContext, name: str, attempt: int) -> None:
    path, action = CASES[name]
    trace_path = TRACES / f"{SHARD}__{name}__attempt{attempt}.trace.zip"
    await context.tracing.start(screenshots=True, snapshots=True, sources=True)
    page = await context.new_page()
    try:
        await page.goto(f"{BASE_URL}{path}", wait_until="domcontentloaded")
        await page.wait_for_timeout(500)
        await action(page)
        await page.screenshot(path=str(SHOTS / f"{SHARD}__{name}.png"))
        if KEEP_TRACES == "all":
            await context.tracing.stop(path=str(trace_path))
        else:
            await context.tracing.stop()
    except Exception:
        # Persist trace + failure screenshot before propagating.
        try:
            await page.screenshot(path=str(SHOTS / f"{SHARD}__{name}.attempt{attempt}.fail.png"))
        except Exception:
            pass
        try:
            await context.tracing.stop(path=str(trace_path))
        except Exception:
            pass
        raise
    finally:
        await page.close()


async def main() -> int:
    selected = select_cases()
    print(f"[shard={SHARD}] running cases: {selected} (retries={RETRIES})")
    results: list[dict] = []
    overall_start = time.monotonic()

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport=VIEWPORT)

        for name in selected:
            attempts = RETRIES + 1
            last_err: Exception | None = None
            first_err: Exception | None = None
            taken = 0
            case_start = time.monotonic()
            for attempt in range(1, attempts + 1):
                print(f"→ {name} (attempt {attempt}/{attempts})")
                try:
                    await run_attempt(context, name, attempt)
                    print(f"  ✓ {name}")
                    last_err = None
                    taken = attempt
                    break
                except Exception as exc:  # noqa: BLE001
                    last_err = exc
                    if first_err is None:
                        first_err = exc
                    print(f"  ✗ {name} attempt {attempt}: {exc}")
                    taken = attempt
            duration = time.monotonic() - case_start

            file, line = case_source_location(name)
            if last_err is None and taken > 1:
                status = "flaky"
                err_text = str(first_err) if first_err else ""
                gh_cmd(
                    "warning",
                    f"{name} passed on attempt {taken}/{attempts}. First error: {err_text}",
                    file=file,
                    line=line,
                    title=f"E2E flaky · {name} [{SHARD}]",
                )
            elif last_err is None:
                status = "passed"
                err_text = ""
            else:
                status = "failed"
                err_text = str(last_err)
                evidence_rel = f"e2e-shots/{SHARD}__{name}.attempt{taken}.fail.png"
                trace_rel = f"e2e-traces/{SHARD}__{name}__attempt{taken}.trace.zip"
                gh_cmd(
                    "error",
                    f"{name} failed after {taken}/{attempts} attempts: {err_text} "
                    f"(see artifact: {evidence_rel}; trace: {trace_rel})",
                    file=file,
                    line=line,
                    title=f"E2E failed · {name} [{SHARD}]",
                )

            results.append({
                "name": name,
                "status": status,
                "attempts": taken,
                "duration": duration,
                "error": err_text,
            })

        await browser.close()

    total = time.monotonic() - overall_start
    junit = write_junit(results, total)
    summary = write_html_summary(results, total)
    print(f"\nJUnit:    {junit}")
    print(f"Summary:  {summary}")

    flakes = [r for r in results if r["status"] == "flaky"]
    failed = [r for r in results if r["status"] == "failed"]

    # GitHub step summary
    lines = [f"### E2E /auditoria-requests · shard `{SHARD}`", ""]
    lines.append(f"- Cases: **{len(results)}** · Passed: **{len(results)-len(flakes)-len(failed)}** "
                 f"· Flaky: **{len(flakes)}** · Failed: **{len(failed)}** · Duration: **{total:.1f}s**")
    if flakes:
        lines.append("")
        lines.append("**Flaky scenarios (passed on retry):**")
        lines.append("")
        lines.append("| Case | Attempts | Flake rate | First error |")
        lines.append("|---|---:|---:|---|")
        for r in flakes:
            rate = f"{(r['attempts']-1)/r['attempts']*100:.0f}%"
            lines.append(f"| `{r['name']}` | {r['attempts']} | {rate} | {html.escape(r['error'])[:120]} |")
    if failed:
        lines.append("")
        lines.append("**Failed scenarios:**")
        lines.append("")
        lines.append("| Case | Attempts | Error |")
        lines.append("|---|---:|---|")
        for r in failed:
            lines.append(f"| `{r['name']}` | {r['attempts']} | {html.escape(r['error'])[:160]} |")
    append_summary("\n".join(lines))

    if flakes:
        print("\nFLAKY (passed on retry):")
        for r in flakes:
            print(f"  ~ {r['name']} passed on attempt {r['attempts']} — first error: {r['error']}")
    if failed:
        print("\nFAILED:")
        for r in failed:
            print(f"  - {r['name']}: {r['error']}")
        return 1
    print(f"\nAll selected /auditoria-requests E2E checks passed in shard '{SHARD}'.")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
