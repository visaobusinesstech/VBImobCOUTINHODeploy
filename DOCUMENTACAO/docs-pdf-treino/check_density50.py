# -*- coding: utf-8 -*-
from pathlib import Path
from playwright.sync_api import sync_playwright

HTML = Path(__file__).parent / "html"
SHOT = Path(__file__).parent / "preview-shots50"
SHOT.mkdir(exist_ok=True)

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 794, "height": 1123})
        for name, idxs in [
            ("01-vps-railway-banco.html", [5, 25, 49]),
            ("03-supabase.html", [10, 30, 49]),
            ("05-instalacao-local.html", [8, 40]),
        ]:
            page.goto((HTML / name).resolve().as_uri(), wait_until="networkidle")
            secs = page.query_selector_all("section.page")
            for i in idxs:
                secs[i].screenshot(path=str(SHOT / f"{name[:-5]}-p{i+1}.png"))
                print("shot", name, i + 1)
            # fill ratios
            data = page.evaluate("""() => [...document.querySelectorAll('section.page')].map((sec,i)=>{
              const m=sec.querySelector('.page-main');
              if(!m) return {i,r:1};
              const kids=[...m.children].reduce((a,el)=>a+el.offsetHeight,0);
              return {i,r: kids/920};
            })""")
            low = [d["i"]+1 for d in data if d["r"] < 0.7]
            print(name, "fill<70%:", low[:15], "count", len(low))
        browser.close()

if __name__ == "__main__":
    main()
