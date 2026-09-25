"""
Build a self-contained Playwright HTML report per shard.

Reads:
  - junit-<shard>.xml          (from E2E_REPORT_DIR)
  - e2e-traces/<shard>__*.zip  (Playwright traces for every attempt)
  - e2e-shots/<shard>__*.png   (screenshots)

Writes:
  - <out>/report-<shard>.html  (timeline + steps + screenshots, single file)
  - <out>/traces/...           (copies of trace.zip + screenshots, so the
                                report is portable when zipped as an artifact)

Trace timeline parsing is best-effort: we read the `*.trace` NDJSON inside
the .zip and pair `before`/`after` events by callId to recover step name,
duration, and error status. We do NOT try to render snapshots — for the full
interactive viewer the report links each trace to https://trace.playwright.dev.
"""

from __future__ import annotations

import argparse
import html
import json
import shutil
import sys
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path


def parse_trace(zip_path: Path) -> list[dict]:
    steps: list[dict] = []
    try:
        with zipfile.ZipFile(zip_path) as z:
            trace_files = [n for n in z.namelist() if n.endswith(".trace")]
            for name in trace_files:
                with z.open(name) as fh:
                    befores: dict[str, dict] = {}
                    for raw in fh.read().decode("utf-8", "ignore").splitlines():
                        try:
                            ev = json.loads(raw)
                        except Exception:
                            continue
                        t = ev.get("type")
                        if t == "before":
                            cid = ev.get("callId") or ev.get("id")
                            if cid:
                                befores[cid] = ev
                        elif t == "after":
                            cid = ev.get("callId") or ev.get("id")
                            b = befores.pop(cid, None) if cid else None
                            if not b:
                                continue
                            steps.append({
                                "api": b.get("apiName") or b.get("method") or "?",
                                "start": float(b.get("startTime") or 0),
                                "end": float(ev.get("endTime") or 0),
                                "error": bool(ev.get("error")),
                            })
    except (zipfile.BadZipFile, OSError) as exc:
        print(f"warn: cannot parse trace {zip_path}: {exc}", file=sys.stderr)
    steps.sort(key=lambda s: s["start"])
    return steps


def parse_junit(xml_path: Path) -> list[dict]:
    cases: list[dict] = []
    if not xml_path.exists():
        return cases
    root = ET.parse(xml_path).getroot()
    for tc in root.iter("testcase"):
        name = tc.attrib.get("name", "?")
        duration = float(tc.attrib.get("time", 0) or 0)
        failure = tc.find("failure")
        sysout = tc.find("system-out")
        if failure is not None:
            status, note = "failed", (failure.text or "").strip()
        elif sysout is not None and "FLAKY" in (sysout.text or ""):
            status, note = "flaky", (sysout.text or "").strip()
        else:
            status, note = "passed", ""
        cases.append({"name": name, "status": status, "duration": duration, "note": note})
    return cases


def render(shard: str, cases: list[dict], traces_by_case: dict[str, list[Path]],
           shots_by_case: dict[str, list[Path]]) -> str:
    badge = {
        "passed": ("PASS", "#0a7f2e"),
        "flaky": ("FLAKY", "#b76e00"),
        "failed": ("FAIL", "#b00020"),
    }
    sections: list[str] = []
    for c in cases:
        label, color = badge[c["status"]]
        shots = shots_by_case.get(c["name"], [])
        traces = sorted(traces_by_case.get(c["name"], []))
        shot_html = "".join(
            f'<figure><figcaption>{html.escape(p.name)}</figcaption>'
            f'<img loading="lazy" src="traces/{html.escape(p.name)}" style="max-width:480px;border:1px solid #ddd"/></figure>'
            for p in shots
        ) or "<p><em>no screenshots</em></p>"

        attempts_html = ""
        for trace in traces:
            steps = parse_trace(trace)
            if steps:
                base = steps[0]["start"]
                total = max((s["end"] for s in steps), default=base) - base or 1
                rows = []
                for s in steps:
                    dur_ms = (s["end"] - s["start"])
                    rows.append(
                        f"<tr><td><code>{html.escape(s['api'])}</code></td>"
                        f"<td style='text-align:right'>{dur_ms:.0f} ms</td>"
                        f"<td style='width:50%'><div style='background:{'#fdd' if s['error'] else '#cde'};"
                        f"height:10px;margin-left:{(s['start']-base)/total*100:.1f}%;"
                        f"width:{max(0.4, dur_ms/total*100):.1f}%'></div></td></tr>"
                    )
                steps_html = (
                    "<table style='width:100%;border-collapse:collapse;font-size:12px'>"
                    "<thead><tr><th style='text-align:left'>step</th>"
                    "<th style='text-align:right'>duration</th>"
                    "<th style='text-align:left'>timeline</th></tr></thead>"
                    f"<tbody>{''.join(rows)}</tbody></table>"
                )
            else:
                steps_html = "<p><em>no steps parsed</em></p>"
            attempts_html += (
                f"<details open><summary><strong>{html.escape(trace.name)}</strong> "
                f"· <a href='https://trace.playwright.dev' target='_blank'>open in trace viewer</a> "
                f"· <a href='traces/{html.escape(trace.name)}' download>download</a></summary>"
                f"{steps_html}</details>"
            )

        sections.append(f"""
<section style="margin:24px 0;padding:16px;border:1px solid #e5e5ea;border-radius:8px">
  <h2 style="margin:0 0 6px"><code>{html.escape(c['name'])}</code>
    <span style="color:{color};font-weight:600;margin-left:8px">{label}</span>
    <small style="color:#666;margin-left:8px">{c['duration']:.2f}s</small></h2>
  {'<pre style="background:#fff5f5;color:#b00020;padding:8px;border-radius:6px;white-space:pre-wrap">' + html.escape(c['note']) + '</pre>' if c['note'] else ''}
  <h3 style="margin:16px 0 6px">Screenshots</h3>
  <div style="display:flex;flex-wrap:wrap;gap:12px">{shot_html}</div>
  <h3 style="margin:16px 0 6px">Traces &amp; steps</h3>
  {attempts_html or '<p><em>no traces captured</em></p>'}
</section>""")

    return f"""<!doctype html><html lang="en"><meta charset="utf-8">
<title>Playwright report · {html.escape(shard)}</title>
<style>body{{font:14px/1.45 system-ui,-apple-system,Segoe UI,Roboto;color:#222;margin:24px;max-width:1200px}}
h1{{margin:0 0 4px}} code{{font:13px ui-monospace,Menlo,monospace}}
summary{{cursor:pointer}}</style>
<h1>Playwright report · shard <code>{html.escape(shard)}</code></h1>
<p>{len(cases)} case(s) · open any <code>trace.zip</code> at
<a href="https://trace.playwright.dev" target="_blank">trace.playwright.dev</a>
for the full interactive timeline (snapshots, network, console, sources).</p>
{''.join(sections)}
</html>"""


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--shard", required=True)
    ap.add_argument("--reports", default="e2e-reports")
    ap.add_argument("--traces", default="e2e-traces")
    ap.add_argument("--shots", default="e2e-shots")
    ap.add_argument("--out", default="e2e-html-report")
    args = ap.parse_args()

    out = Path(args.out)
    (out / "traces").mkdir(parents=True, exist_ok=True)

    cases = parse_junit(Path(args.reports) / f"junit-{args.shard}.xml")
    case_names = {c["name"] for c in cases}

    traces_by_case: dict[str, list[Path]] = {n: [] for n in case_names}
    for trace in Path(args.traces).glob(f"{args.shard}__*.trace.zip"):
        # name format: <shard>__<case>__attempt<N>.trace.zip
        try:
            inner = trace.name[len(args.shard) + 2:]
            case = inner.split("__attempt", 1)[0]
        except Exception:
            continue
        if case in traces_by_case:
            traces_by_case[case].append(trace)
            shutil.copy2(trace, out / "traces" / trace.name)

    shots_by_case: dict[str, list[Path]] = {n: [] for n in case_names}
    for shot in Path(args.shots).glob(f"{args.shard}__*.png"):
        stem = shot.name[len(args.shard) + 2:]
        case = stem.split(".", 1)[0]
        if case in shots_by_case:
            shots_by_case[case].append(shot)
            shutil.copy2(shot, out / "traces" / shot.name)

    html_doc = render(args.shard, cases, traces_by_case, shots_by_case)
    (out / f"report-{args.shard}.html").write_text(html_doc, encoding="utf-8")
    print(f"wrote {out / f'report-{args.shard}.html'} ({len(cases)} cases, "
          f"{sum(len(v) for v in traces_by_case.values())} trace(s))")
    return 0


if __name__ == "__main__":
    sys.exit(main())
