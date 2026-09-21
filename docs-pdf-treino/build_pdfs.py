# -*- coding: utf-8 -*-
"""Converte os HTMLs de treinamento em PDFs A4 (1 section = 1 página)."""
from pathlib import Path
from playwright.sync_api import sync_playwright
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parent
HTML_DIR = ROOT / "html"
OUT_DIR = ROOT.parent  # raiz do projeto codigo-fonte-COUTINHO-main

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
        page.goto(uri, wait_until="networkidle")
        page.pdf(
            path=str(pdf_path),
            format="A4",
            print_background=True,
            prefer_css_page_size=True,
            margin={"top": "0", "right": "0", "bottom": "0", "left": "0"},
        )
        browser.close()
    return len(PdfReader(str(pdf_path)).pages)


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    results = []
    for html_name, pdf_name in MAP:
        html_path = HTML_DIR / html_name
        if not html_path.exists():
            raise SystemExit(f"Missing {html_path}")
        sections = html_path.read_text(encoding="utf-8").count('<section class="page')
        pdf_path = OUT_DIR / pdf_name
        print(f"Rendering {html_name} ({sections} sections) -> {pdf_name} ...")
        pages = html_to_pdf(html_path, pdf_path)
        size = pdf_path.stat().st_size
        print(f"  OK: {pages} PDF pages, {size} bytes")
        results.append((pdf_name, sections, pages, size))
    print("\n=== RESUMO ===")
    for name, sec, pages, size in results:
        status = "OK" if pages == 35 else f"ESPERADO 35, veio {pages}"
        print(f"{name}: HTML sections={sec}, PDF pages={pages}, {size//1024} KB [{status}]")


if __name__ == "__main__":
    main()
