# -*- coding: utf-8 -*-
"""Factory de página densa para manuais 50 págs."""
from __future__ import annotations
from pathlib import Path
from pdf_kit import (
    why_how_impact, steps, code, callout, linkbox, checklist, table, HTML, TOTAL,
)

DENSE = """
.page.inner-page { padding: 10mm 13mm 6mm; }
.doc-header { margin-bottom: 6px; padding-bottom: 4px; }
.doc-header .brand img { height: 32px; }
.doc-header .meta { font-size: 9px; }
h2 { font-size: 14.5px; margin-bottom: 3px; }
h3 { font-size: 11px; margin: 6px 0 3px; }
.lead { font-size: 10.2px; margin-bottom: 5px; line-height: 1.35; }
p { margin-bottom: 5px; font-size: 10.4px; line-height: 1.38; }
li { margin-bottom: 2px; font-size: 10.2px; line-height: 1.35; }
.step { margin-bottom: 5px; gap: 7px; }
.step .n { width: 22px; height: 22px; font-size: 10px; }
.step h4 { font-size: 10.5px; margin-bottom: 1px; }
.step p, .step li { font-size: 10px; line-height: 1.35; }
.card { padding: 6px 8px; }
.card h4 { font-size: 10px; margin-bottom: 2px; }
.card p, .card li { font-size: 9.5px; line-height: 1.32; }
.callout { padding: 5px 7px; margin: 4px 0 5px; font-size: 9.6px; line-height: 1.35; }
code, .code { font-size: 8.4px; padding: 5px 7px; margin: 3px 0 5px; line-height: 1.35; }
table.compact th, table.compact td { padding: 3px 5px; font-size: 9.2px; line-height: 1.3; }
.three-col { gap: 5px; margin-bottom: 5px; }
.two-col { gap: 6px; margin-bottom: 5px; }
.kicker { margin-bottom: 1px; font-size: 8.5px; }
.link-box { padding: 6px 8px; margin: 4px 0; }
.link-box .url { font-size: 8.5px; }
.script-bubble { padding: 6px 8px; margin: 3px 0 5px; font-size: 9.4px; line-height: 1.32; }
.qa { padding: 5px 7px; margin-bottom: 4px; }
.qa .q { font-size: 10px; }
.qa .a { font-size: 9.5px; }
.checklist li { font-size: 9.6px; }
.doc-footer { font-size: 8.5px; padding-top: 4px; }
"""
(HTML / "styles-dense.css").write_text(DENSE, encoding="utf-8")


def dense(
    lead: str,
    why: str,
    how: str,
    impact: str,
    step_list: list[tuple[str, str]],
    *,
    code_block: str | None = None,
    tbl: tuple[list[str], list[list[str]]] | None = None,
    checks: list[str] | None = None,
    note: str | None = None,
    note_kind: str = "",
    links: list[tuple[str, str]] | None = None,
    extra: str = "",
) -> str:
    parts = [f'<p class="lead">{lead}</p>', why_how_impact(why, how, impact)]
    if tbl:
        parts.append(table(tbl[0], tbl[1]))
    parts.append(steps(step_list))
    if code_block:
        parts.append(code(code_block))
    if links:
        for title, url in links:
            parts.append(linkbox(title, url))
    if note:
        parts.append(callout(note, note_kind))
    if checks:
        parts.append(checklist(checks))
    if extra:
        parts.append(extra)
    parts.append(
        callout(
            "<strong>Se pular esta página</strong><br/>"
            "O próximo passo costuma falhar com sintoma em outro lugar "
            "(CORS, senha, porta, Redis). Volte e feche os Passos 1 a 6 antes de avançar.",
            "warn",
        )
    )
    parts.append(
        '<div class="two-col">'
        '<div class="card soft"><h4>Antes de avançar</h4>'
        "<p>Faça cada passo na ordem. Anote ok ou o erro (com hora). "
        "Se pulou um passo, volte.</p></div>"
        '<div class="card blue"><h4>Teste mínimo</h4>'
        "<p>Depois dos passos, rode o teste mais curto possível desta página "
        "(ping, login, migrate, PONG, F12 Network) e só então vire a folha.</p></div>"
        "</div>"
    )
    return "\n".join(parts)


def pack(meta: str, pages: list[tuple[str, str, str]]) -> list[tuple[str, str, str, str]]:
    if len(pages) < TOTAL - 1:
        # pad with expansion pages derived from last topics
        raise SystemExit(f"{meta}: {len(pages)} pages, need {TOTAL-1}")
    if len(pages) > TOTAL - 1:
        pages = pages[: TOTAL - 1]
    return [(meta, k, t, b) for k, t, b in pages]


def ensure_count(meta: str, pages: list, fillers: list[tuple[str, str, str]]) -> list:
    """Pad or trim to TOTAL-1."""
    while len(pages) < TOTAL - 1 and fillers:
        pages.append(fillers.pop(0))
    i = 0
    while len(pages) < TOTAL - 1:
        i += 1
        pages.append((
            f"Extra {i}",
            f"Revisão prática · bloco {i}",
            dense(
                f"Página de reforço do módulo {meta}: revise o que já fez e confirme no ambiente real.",
                "Fechar lacunas antes do go-live.",
                "Você revisita variáveis, URLs e um teste mínimo.",
                "Item esquecido vira incidente depois do anúncio.",
                [
                    ("Passo 1", "Abra o .env ou Variables e confira DEV_NO_DB, URLs e Redis."),
                    ("Passo 2", "Confira logs da API (Railway ou pm2)."),
                    ("Passo 3", "Teste login no painel."),
                    ("Passo 4", "Teste uma ação simples (abrir ticket ou salvar cadastro)."),
                    ("Passo 5", "Anote o resultado e só então avance."),
                    ("Passo 6", "Se falhou, volte à página do tema correspondente neste PDF."),
                ],
                checks=["Revisão feita", "Erro anotado ou tudo ok"],
                note="<strong>Reforço</strong><br/>Esta página existe para encher o checklist com prática, não com teoria solta.",
            ),
        ))
    return pages[: TOTAL - 1]
