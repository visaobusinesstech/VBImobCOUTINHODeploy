# -*- coding: utf-8 -*-
"""Build PDFs 50 páginas + regenera HTMLs."""
from pathlib import Path
from playwright.sync_api import sync_playwright
from pypdf import PdfReader
import subprocess
import sys

ROOT = Path(__file__).resolve().parent
HTML_DIR = ROOT / "html"
OUT_DIR = ROOT.parent
TOTAL = 50

MAP = [
    ("01-vps-railway-banco.html", "01-VBSolution-Treinamento-VPS-Railway-Banco-Dados.pdf"),
    ("02-hospedagem-frontend-vercel.html", "02-VBSolution-Treinamento-Hospedagem-Frontend-Vercel.pdf"),
    ("03-supabase.html", "03-VBSolution-Treinamento-Supabase.pdf"),
    ("04-whatsapp-servicos.html", "04-VBSolution-Treinamento-WhatsApp-Servicos.pdf"),
    ("05-instalacao-local.html", "05-VBSolution-Treinamento-Instalacao-Local.pdf"),
]


def html_to_pdf(html_path: Path, pdf_path: Path) -> int:
    uri = html_path.resolve().as_uri()
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.goto(uri, wait_until="networkidle", timeout=120000)
        page.pdf(
            path=str(pdf_path),
            format="A4",
            print_background=True,
            prefer_css_page_size=True,
            margin={"top": "0", "right": "0", "bottom": "0", "left": "0"},
        )
        browser.close()
    return len(PdfReader(str(pdf_path)).pages)


def regen_htmls():
    # dense css
    import page_factory  # noqa
    # 01
    import gen_01_vps
    gen_01_vps.main()
    # 02
    import gen_02_vercel
    gen_02_vercel.doc_vercel()
    # 03-05
    import gen_0345
    gen_0345.doc_supabase()
    gen_0345.doc_whatsapp()
    gen_0345.doc_local()


def main(skip_regen: bool = False):
    if not skip_regen:
        print("=== Regenerando HTMLs ===")
        regen_htmls()
    print("=== Gerando PDFs ===")
    for html_name, pdf_name in MAP:
        html_path = HTML_DIR / html_name
        if not html_path.exists():
            raise SystemExit(f"Missing {html_path}")
        sections = html_path.read_text(encoding="utf-8").count('<section class="page')
        # ensure dense css linked
        txt = html_path.read_text(encoding="utf-8")
        if "styles-dense.css" not in txt:
            txt = txt.replace(
                'href="styles-extra.css" />',
                'href="styles-extra.css" />\n  <link rel="stylesheet" href="styles-dense.css" />',
            )
            html_path.write_text(txt, encoding="utf-8")
        pdf_path = OUT_DIR / pdf_name
        print(f"Rendering {html_name} ({sections} sections) -> {pdf_name}")
        pages = html_to_pdf(html_path, pdf_path)
        status = "OK" if pages == TOTAL else f"WANT {TOTAL} GOT {pages}"
        print(f"  {pages} pages, {pdf_path.stat().st_size//1024} KB [{status}]")


if __name__ == "__main__":
    skip = "--pdf-only" in sys.argv
    main(skip_regen=skip)
