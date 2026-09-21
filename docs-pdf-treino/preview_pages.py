# -*- coding: utf-8 -*-
"""Screenshot de páginas amostrais para validar densidade visual."""
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent
HTML_DIR = ROOT / "html"
SHOT = ROOT / "preview-shots"
SHOT.mkdir(exist_ok=True)

SAMPLES = [
    ("03-supabase.html", [0, 14, 25, 34]),
    ("04-whatsapp-servicos.html", [0, 9, 20, 34]),
    ("05-instalacao-local.html", [0, 12, 28, 34]),
    ("01-vps-railway-banco.html", [5, 20]),
]

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 794, "height": 1123})
        for html_name, indices in SAMPLES:
            uri = (HTML_DIR / html_name).resolve().as_uri()
            page.goto(uri, wait_until="networkidle")
            sections = page.query_selector_all("section.page")
            for i in indices:
                if i >= len(sections):
                    continue
                path = SHOT / f"{html_name.replace('.html','')}-p{i+1}.png"
                sections[i].screenshot(path=str(path))
                print("shot", path.name)
        browser.close()

if __name__ == "__main__":
    main()
