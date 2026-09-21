# -*- coding: utf-8 -*-
"""Densifica só páginas com pouco preenchimento (ratio < 0.62)."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import re

HTML_DIR = Path(__file__).resolve().parent / "html"
FILES = ["03-supabase.html", "04-whatsapp-servicos.html", "05-instalacao-local.html"]

BLOCKS = {
    "03-supabase.html": """
        <div class="two-col" style="margin-top:8px">
          <div class="card soft"><h4>Checklist desta página</h4>
            <ul class="checklist"><li>Entendi o passo</li><li>Anotei senha/URI se houver</li><li>Não usei porta 6543 no migrate</li></ul>
          </div>
          <div class="card blue"><h4>Lembrete</h4>
            <p>Supabase = Postgres. Auth do CRM é JWT na API. Frontend não recebe anon key.</p>
          </div>
        </div>
        <div class="link-box"><strong>Painel Supabase</strong><div class="url"><a href="https://supabase.com/dashboard" target="_blank">https://supabase.com/dashboard</a></div></div>
        <div class="callout"><strong>Se travar</strong><br/>Copie o erro do terminal, confira DATABASE_URL (5432 + SSL) e reinicie a API depois de salvar o .env.</div>
        """,
    "04-whatsapp-servicos.html": """
        <div class="two-col" style="margin-top:8px">
          <div class="card soft"><h4>Checklist desta página</h4>
            <ul class="checklist"><li>Redis em mente (PONG)</li><li>API HTTPS quando for Meta</li><li>Teste com 1 mensagem antes de campanha</li></ul>
          </div>
          <div class="card blue"><h4>Lembrete</h4>
            <p>Vercel não recebe webhook. WhatsApp e SMTP vivem na API (Railway ou VPS).</p>
          </div>
        </div>
        <div class="link-box"><strong>Meta Developers</strong><div class="url"><a href="https://developers.facebook.com/" target="_blank">https://developers.facebook.com/</a></div></div>
        <div class="callout"><strong>Se travar</strong><br/>Confira as três variáveis REDIS_*, o Volume (Baileys) e se VERIFY_TOKEN é idêntico no Meta e no .env.</div>
        """,
    "05-instalacao-local.html": """
        <div class="two-col" style="margin-top:8px">
          <div class="card soft"><h4>Checklist desta página</h4>
            <ul class="checklist"><li>Node 20 no terminal novo</li><li>Pasta com backend e frontend</li><li>Dois terminais quando for subir</li></ul>
          </div>
          <div class="card blue"><h4>Lembrete</h4>
            <p>Demo: DEV_NO_DB=true. Produção local com dados: false + migrate. .env nunca no Git.</p>
          </div>
        </div>
        <div class="link-box"><strong>Node.js 20 LTS</strong><div class="url"><a href="https://nodejs.org" target="_blank">https://nodejs.org</a></div></div>
        <div class="callout"><strong>Se travar</strong><br/>F12 no Chrome, últimas linhas do PowerShell, e confira se REACT_APP_BACKEND_URL aponta para a API que está rodando.</div>
        """,
}


def fill_ratios(html_path: Path):
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 794, "height": 1123})
        page.goto(html_path.resolve().as_uri(), wait_until="networkidle")
        data = page.evaluate("""() => [...document.querySelectorAll('section.page')].map((sec, i) => {
          const main = sec.querySelector('.page-main');
          if (!main) return {i, ratio: 1, cover: true};
          return {i, ratio: main.scrollHeight / 880, cover: sec.classList.contains('cover')};
        })""")
        browser.close()
        return data


def densify_sparse(html_path: Path, threshold: float = 0.62):
    ratios = fill_ratios(html_path)
    sparse = {d["i"] for d in ratios if not d.get("cover") and d["ratio"] < threshold}
    print(f"{html_path.name}: sparse pages {[i+1 for i in sorted(sparse)]}")
    if not sparse:
        return

    text = html_path.read_text(encoding="utf-8")
    # Find each section
    pattern = re.compile(r'<section class="page[^"]*">.*?</section>', re.DOTALL)
    sections = list(pattern.finditer(text))
    block = BLOCKS[html_path.name]
    new_text = text
    # replace from end to keep offsets... build anew
    pieces = []
    last = 0
    for idx, m in enumerate(sections):
        pieces.append(text[last:m.start()])
        sec = m.group(0)
        if idx in sparse and "page-main" in sec:
            # insert before last </div> of page-main (the one before footer)
            sec = sec.replace(
                '</div>\n  <footer class="doc-footer">',
                block + '</div>\n  <footer class="doc-footer">',
                1,
            )
        pieces.append(sec)
        last = m.end()
    pieces.append(text[last:])
    html_path.write_text("".join(pieces), encoding="utf-8")
    # re-measure
    ratios2 = fill_ratios(html_path)
    still = [d["i"]+1 for d in ratios2 if not d.get("cover") and d["ratio"] < threshold]
    print(f"  after: still sparse {still}")


def main():
    for name in FILES:
        densify_sparse(HTML_DIR / name)


if __name__ == "__main__":
    main()
