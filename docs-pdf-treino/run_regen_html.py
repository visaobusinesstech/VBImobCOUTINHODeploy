# -*- coding: utf-8 -*-
import page_factory  # noqa: F401 — writes styles-dense.css
import gen_01_vps
import gen_02_vercel
import gen_0345
from pathlib import Path

print("Building 01...")
gen_01_vps.main()
print("Building 02...")
gen_02_vercel.doc_vercel()
print("Building 03-05...")
gen_0345.doc_supabase()
gen_0345.doc_whatsapp()
gen_0345.doc_local()

html = Path(__file__).parent / "html"
for f in sorted(html.glob("0*.html")):
    t = f.read_text(encoding="utf-8")
    n = t.count('<section class="page')
    if "styles-dense.css" not in t:
        t = t.replace(
            'href="styles-extra.css" />',
            'href="styles-extra.css" />\n  <link rel="stylesheet" href="styles-dense.css" />',
        )
        f.write_text(t, encoding="utf-8")
    print(f"{f.name}: {n} pages, dense={'styles-dense' in f.read_text(encoding='utf-8')}")
