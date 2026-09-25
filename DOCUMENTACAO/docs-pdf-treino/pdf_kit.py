# -*- coding: utf-8 -*-
"""Helpers + CSS denser + build PDF updater for 50-page training docs."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent
HTML = ROOT / "html"
FOOTER = "Visão Business · Treinamento Código-Fonte VB Solution CRM"
TOTAL = 50


def a(url: str, label: str | None = None) -> str:
    return f'<a href="{url}" target="_blank">{label or url}</a>'


def head(title: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>{title}</title>
  <link rel="stylesheet" href="styles.css" />
  <link rel="stylesheet" href="styles-extra.css" />
  <link rel="stylesheet" href="styles-dense.css" />
</head>
<body>
"""


def cover(series: str, h1: str, subtitle: str, cards: list) -> str:
    cards_html = "".join(
        f'<div class="cover-card"><span>{x}</span><strong>{y}</strong></div>' for x, y in cards
    )
    return f"""
<section class="page cover">
  <div class="cover-top">
    <img class="cover-logo" src="../assets/vbsolution-logo-nome-branca.png" alt="VB Solution" />
    <div class="badge">Material de treinamento · Código-Fonte · 50 páginas</div>
  </div>
  <p class="series">{series}</p>
  <h1>{h1}</h1>
  <p class="subtitle">{subtitle}</p>
  <div class="cover-grid">{cards_html}</div>
  <div class="cover-bottom">
    <div>Visão Business · VB Solution CRM<br />Manual técnico · © Visão Business</div>
    <img src="../assets/vbsolution-logo-square.png" alt="VB" />
  </div>
</section>
"""


def page(meta: str, kicker: str, title: str, body: str, num: int) -> str:
    return f"""
<section class="page inner-page">
  <header class="doc-header">
    <div class="brand"><img src="../assets/vbsolution-logo-nome-preta.png" alt="VB Solution" /></div>
    <div class="meta"><strong>{meta}</strong>VB Solution CRM · Código-Fonte</div>
  </header>
  <div class="page-main">
    <p class="kicker">{kicker}</p>
    <h2>{title}</h2>
    {body}
  </div>
  <footer class="doc-footer">
    <span>{FOOTER}</span>
    <span class="page-num">{num} / {TOTAL}</span>
  </footer>
</section>
"""


def why_how_impact(why: str, how: str, impact: str) -> str:
    return f"""
    <div class="three-col">
      <div class="card soft"><h4>Para que serve</h4><p>{why}</p></div>
      <div class="card soft"><h4>Como funciona</h4><p>{how}</p></div>
      <div class="card soft"><h4>Onde acarreta</h4><p>{impact}</p></div>
    </div>
    """


def steps(items: list[tuple[str, str]]) -> str:
    out = []
    for i, (h, p) in enumerate(items, 1):
        out.append(
            f'<div class="step"><div class="n">{i}</div><div><h4>{h}</h4><p>{p}</p></div></div>'
        )
    return "\n".join(out)


def code(block: str) -> str:
    return f"<code>{block.strip()}</code>"


def callout(text: str, kind: str = "") -> str:
    cls = f"callout {kind}".strip()
    return f'<div class="{cls}">{text}</div>'


def linkbox(title: str, url: str) -> str:
    return f'<div class="link-box"><strong>{title}</strong><div class="url">{a(url)}</div></div>'


def checklist(items: list[str]) -> str:
    lis = "".join(f"<li>{x}</li>" for x in items)
    return f'<ul class="checklist">{lis}</ul>'


def table(headers: list[str], rows: list[list[str]]) -> str:
    th = "".join(f"<th>{h}</th>" for h in headers)
    trs = "".join(
        "<tr>" + "".join(f"<td>{c}</td>" for c in r) + "</tr>" for r in rows
    )
    return f'<table class="compact"><thead><tr>{th}</tr></thead><tbody>{trs}</tbody></table>'


def write_doc(filename: str, title: str, cover_html: str, bodies: list[tuple[str, str, str, str]]) -> None:
    """bodies: list of (meta, kicker, title, body) length TOTAL-1."""
    assert len(bodies) == TOTAL - 1, f"{filename}: expected {TOTAL-1} bodies, got {len(bodies)}"
    parts = [head(title), cover_html]
    for i, (meta, kicker, tit, body) in enumerate(bodies, start=2):
        parts.append(page(meta, kicker, tit, body, i))
    parts.append("\n</body>\n</html>\n")
    path = HTML / filename
    path.write_text("".join(parts), encoding="utf-8")
    n = "".join(parts).count('<section class="page')
    print(f"Wrote {filename}: {n} pages, {path.stat().st_size} bytes")
    if n != TOTAL:
        raise SystemExit(f"{filename} has {n} pages, want {TOTAL}")


# denser stylesheet
DENSE_CSS = """
/* Densidade maior para preencher A4 de cima a baixo */
.page.inner-page { padding: 11mm 14mm 7mm; }
.doc-header { margin-bottom: 8px; padding-bottom: 5px; }
.doc-header .brand img { height: 34px; }
h2 { font-size: 15.5px; margin-bottom: 4px; }
h3 { font-size: 11.5px; margin: 7px 0 4px; }
.lead { font-size: 10.5px; margin-bottom: 7px; }
p { margin-bottom: 6px; font-size: 10.8px; line-height: 1.42; }
li { margin-bottom: 3px; font-size: 10.5px; line-height: 1.4; }
.step { margin-bottom: 7px; gap: 8px; }
.step .n { width: 24px; height: 24px; font-size: 11px; }
.step h4 { font-size: 11px; }
.step p, .step li { font-size: 10.3px; line-height: 1.4; }
.card { padding: 7px 9px; }
.card h4 { font-size: 10.5px; margin-bottom: 2px; }
.card p, .card li { font-size: 9.8px; line-height: 1.35; }
.callout { padding: 6px 8px; margin: 5px 0 7px; font-size: 10px; line-height: 1.4; }
code, .code { font-size: 8.8px; padding: 6px 8px; margin: 4px 0 7px; line-height: 1.38; }
table.compact th, table.compact td { padding: 4px 6px; font-size: 9.5px; line-height: 1.35; }
.three-col { gap: 6px; margin-bottom: 6px; }
.two-col { gap: 7px; }
.kicker { margin-bottom: 2px; font-size: 9px; }
.link-box { padding: 7px 9px; margin: 5px 0; }
.link-box .url { font-size: 9px; }
.qa { padding: 6px 8px; margin-bottom: 5px; }
.qa .q { font-size: 10.2px; }
.qa .a { font-size: 10px; }
.script-bubble { padding: 7px 9px; margin: 4px 0 7px; font-size: 9.8px; line-height: 1.38; }
.checklist li { font-size: 10px; }
.tiny { font-size: 9px; }
"""

if __name__ == "__main__":
    (HTML / "styles-dense.css").write_text(DENSE_CSS, encoding="utf-8")
    print("styles-dense.css ok")
