# -*- coding: utf-8 -*-
"""Injeta blocos de fechamento densos em páginas que ainda não têm."""
from pathlib import Path
import re

HTML = Path(__file__).parent / "html"

BLOCK = """
        <div class="callout warn"><strong>Se pular esta página</strong><br/>
        O próximo passo costuma falhar com sintoma em outro lugar (CORS, senha, porta, Redis).
        Feche os passos desta página antes de avançar.</div>
        <div class="two-col">
          <div class="card soft"><h4>Antes de avançar</h4>
            <p>Faça cada passo na ordem. Anote ok ou o erro (com hora). Se pulou um passo, volte.</p>
          </div>
          <div class="card blue"><h4>Teste mínimo</h4>
            <p>Rode o teste mais curto desta página (ping, login, migrate, PONG ou F12 Network) e só então vire a folha.</p>
          </div>
        </div>
"""


def densify_file(path: Path):
    text = path.read_text(encoding="utf-8")
    pattern = re.compile(r'(<section class="page[^"]*">.*?</section>)', re.DOTALL)
    out = []
    last = 0
    changed = 0
    for m in pattern.finditer(text):
        out.append(text[last:m.start()])
        sec = m.group(1)
        if 'class="page cover"' in sec or 'class="page cover ' in sec:
            out.append(sec)
        elif "Se pular esta página" in sec and "Teste mínimo" in sec:
            out.append(sec)
        elif "page-main" in sec:
            # inject before closing page-main (the div before footer)
            if '</div>\n  <footer class="doc-footer">' in sec:
                sec2 = sec.replace(
                    '</div>\n  <footer class="doc-footer">',
                    BLOCK + '</div>\n  <footer class="doc-footer">',
                    1,
                )
                if sec2 != sec:
                    changed += 1
                out.append(sec2)
            else:
                out.append(sec)
        else:
            out.append(sec)
        last = m.end()
    out.append(text[last:])
    path.write_text("".join(out), encoding="utf-8")
    print(f"{path.name}: injected into {changed} pages")


def main():
    for f in sorted(HTML.glob("0*.html")):
        densify_file(f)


if __name__ == "__main__":
    main()
