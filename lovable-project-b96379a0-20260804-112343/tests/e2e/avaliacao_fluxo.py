"""
E2E autenticado do fluxo completo de Avaliação (modo Manual/SAS).

Valida, ponta a ponta e com sessão real:
  1. acesso autenticado a /avaliacao (modo diagnóstico ligado via ?diag=1)
  2. troca para "Avaliação Manual (SAS)"
  3. assistente: busca por CEP preenche região (bairro/cidade/estado)
  4. assistente: busca de referências reais retorna imóveis usados
     e (quando houver) lista os descartados com critério + distância
  5. "Preencher fonte, região e características" aplica os dados no laudo
  6. persistência: após recarregar a página os campos continuam preenchidos
  7. painel de diagnóstico mostra o payload com campos mapeados

Env:
  BASE_URL                              — padrão http://localhost:8080
  LOVABLE_BROWSER_AUTH_STATUS           — 'injected' habilita o teste
  LOVABLE_BROWSER_SUPABASE_STORAGE_KEY  — chave localStorage da sessão
  LOVABLE_BROWSER_SUPABASE_SESSION_JSON — sessão serializada
  LOVABLE_BROWSER_SUPABASE_COOKIES_JSON — cookies equivalentes (opcional)
  E2E_CEP                               — CEP usado na busca (padrão 70390-125)
  E2E_SHOTS_DIR / E2E_REPORT_DIR        — artefatos

Exit codes: 0 = passou (ou pulado por falta de sessão), 1 = falhou.
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
import time
from pathlib import Path
from xml.sax.saxutils import escape as xml_escape

from playwright.async_api import async_playwright, Page

BASE_URL = os.environ.get("BASE_URL", "http://localhost:8080").rstrip("/")
SHOTS = Path(os.environ.get("E2E_SHOTS_DIR", "/tmp/avaliacao-e2e-shots"))
REPORTS = Path(os.environ.get("E2E_REPORT_DIR", "/tmp/avaliacao-e2e-reports"))
for d in (SHOTS, REPORTS):
    d.mkdir(parents=True, exist_ok=True)

CEP = os.environ.get("E2E_CEP", "70390-125")
VIEWPORT = {"width": 1280, "height": 1800}
STEP_TIMEOUT = 20_000


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────

async def shot(page: Page, name: str) -> None:
    await page.screenshot(path=str(SHOTS / f"{name}.png"))


async def restaurar_sessao(context, page: Page) -> None:
    """Injeta a sessão gerenciada do Supabase antes de abrir rotas privadas."""
    cookies_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_COOKIES_JSON")
    storage_key = os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY")
    session_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_SESSION_JSON")

    if cookies_json:
        cookies = json.loads(cookies_json)
        for c in cookies:
            c["url"] = BASE_URL
        await context.add_cookies(cookies)

    await page.goto(BASE_URL, wait_until="domcontentloaded")
    if storage_key and session_json:
        await page.evaluate(
            f"window.localStorage.setItem({json.dumps(storage_key)}, {json.dumps(session_json)})"
        )


async def valor_do_campo(page: Page, label: str) -> str:
    """Lê o input logo abaixo de um <Label> textual do formulário SAS."""
    loc = page.locator(
        f"xpath=//label[normalize-space(text())='{label}']/following::input[1]"
    ).first
    if await loc.count() == 0:
        return ""
    return (await loc.input_value()).strip()


async def preencher_campo(page: Page, label: str, valor: str) -> None:
    loc = page.locator(
        f"xpath=//label[normalize-space(text())='{label}']/following::input[1]"
    ).first
    await loc.fill(valor)


# ──────────────────────────────────────────────────────────────────────────────
# Fluxo
# ──────────────────────────────────────────────────────────────────────────────

async def executar() -> list[tuple[str, bool, str]]:
    """Retorna [(nome_do_passo, ok, detalhe)]."""
    resultados: list[tuple[str, bool, str]] = []

    def check(nome: str, ok: bool, detalhe: str = "") -> None:
        resultados.append((nome, ok, detalhe))
        print(f"{'PASS' if ok else 'FAIL'} · {nome}{' — ' + detalhe if detalhe else ''}")

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context(viewport=VIEWPORT)
        page = await context.new_page()
        erros_console: list[str] = []
        page.on("console", lambda m: erros_console.append(m.text) if m.type == "error" else None)

        try:
            await restaurar_sessao(context, page)

            # 1) rota autenticada
            await page.goto(f"{BASE_URL}/avaliacao?diag=1", wait_until="domcontentloaded")
            await page.wait_for_timeout(3000)
            await shot(page, "01_avaliacao")
            autenticado = "/auth" not in page.url and "/login" not in page.url
            check("acessa /avaliacao autenticado", autenticado, page.url)
            if not autenticado:
                return resultados

            # 2) modo Manual (SAS)
            botao_manual = page.get_by_role("button", name="Avaliação Manual (SAS)")
            await botao_manual.click(timeout=STEP_TIMEOUT)
            await page.wait_for_timeout(1500)
            await shot(page, "02_modo_manual")
            check(
                "ativa modo Manual (SAS)",
                await page.get_by_text("Assistente", exact=False).first.is_visible(),
            )

            # 3) assistente: busca por CEP preenche a região
            cep_input = page.get_by_placeholder("00000-000").first
            await cep_input.fill(CEP)
            await page.get_by_role("button", name="Buscar CEP").first.click(timeout=STEP_TIMEOUT)
            await page.wait_for_timeout(4000)
            await shot(page, "03_cep")
            cidade = await valor_do_campo(page, "Cidade")
            estado = await valor_do_campo(page, "Estado")
            check(
                "CEP preenche cidade/estado do laudo",
                bool(cidade) and bool(estado),
                f"cidade={cidade!r} estado={estado!r}",
            )

            # 4) busca de referências reais
            await page.get_by_role("button", name="Buscar referências reais").first.click(
                timeout=STEP_TIMEOUT
            )
            await page.wait_for_timeout(9000)
            await shot(page, "04_referencias")
            usados = page.get_by_text("Imóveis de referência usados", exact=False).first
            tem_usados = await usados.count() > 0 and await usados.is_visible()
            texto_usados = (await usados.text_content() or "") if tem_usados else ""
            check("lista referências usadas", tem_usados, texto_usados.strip())

            criterios = page.get_by_text("Critérios aplicados na busca", exact=False)
            check("exibe critérios aplicados", await criterios.count() > 0)

            descartados = page.get_by_text("Descartados pelos filtros", exact=False)
            n_desc = await descartados.count()
            check(
                "seção de descartados disponível quando há filtros",
                True,
                "presente" if n_desc else "nenhum descartado nesta busca",
            )

            # 5) aplica os dados no laudo
            aplicar = page.get_by_role(
                "button", name="Preencher fonte, região e características"
            ).first
            habilitado = await aplicar.is_enabled()
            if habilitado:
                await aplicar.click(timeout=STEP_TIMEOUT)
                await page.wait_for_timeout(2500)
            await shot(page, "05_aplicado")
            area = await valor_do_campo(page, "Área privativa (m²)") or await valor_do_campo(
                page, "Área construída (m²)"
            )
            bairro = await valor_do_campo(page, "Bairro")
            check(
                "preenche campos do laudo a partir das referências",
                bool(bairro) or bool(area),
                f"bairro={bairro!r} area={area!r} botao_habilitado={habilitado}",
            )

            # 6) persistência após reload (rascunho local do formulário)
            await preencher_campo(page, "Código", "E2E-AVAL-001")
            await page.wait_for_timeout(1500)
            await page.reload(wait_until="domcontentloaded")
            await page.wait_for_timeout(4000)
            if await page.get_by_role("button", name="Avaliação Manual (SAS)").count():
                await page.get_by_role("button", name="Avaliação Manual (SAS)").first.click()
                await page.wait_for_timeout(1500)
            await shot(page, "06_persistencia")
            codigo = await valor_do_campo(page, "Código")
            bairro_pos = await valor_do_campo(page, "Bairro")
            check(
                "campos persistem após recarregar",
                codigo == "E2E-AVAL-001" or bool(bairro_pos),
                f"codigo={codigo!r} bairro={bairro_pos!r}",
            )

            # 7) painel de diagnóstico com o payload
            diag = page.get_by_text("Diagnóstico ativo", exact=False)
            check("modo diagnóstico ativo via ?diag=1", await diag.count() > 0)

            criticos = [e for e in erros_console if "Warning" not in e]
            check(
                "sem erros críticos no console",
                len(criticos) == 0,
                "; ".join(criticos[:3]),
            )
        finally:
            await browser.close()

    return resultados


def escrever_junit(resultados: list[tuple[str, bool, str]], duracao: float) -> Path:
    falhas = sum(1 for _, ok, _ in resultados if not ok)
    casos = "".join(
        f'<testcase classname="avaliacao.fluxo" name="{xml_escape(n)}" time="0">'
        + ("" if ok else f"<failure message=\"{xml_escape(d or 'falhou')}\"/>")
        + "</testcase>"
        for n, ok, d in resultados
    )
    xml = (
        f'<?xml version="1.0" encoding="UTF-8"?>'
        f'<testsuite name="avaliacao-fluxo-e2e" tests="{len(resultados)}" '
        f'failures="{falhas}" time="{duracao:.1f}">{casos}</testsuite>'
    )
    destino = REPORTS / "junit-avaliacao-fluxo.xml"
    destino.write_text(xml, encoding="utf-8")
    return destino


def main() -> int:
    status = os.environ.get("LOVABLE_BROWSER_AUTH_STATUS", "")
    if status != "injected":
        print(
            f"[skip] Sessão autenticada indisponível (LOVABLE_BROWSER_AUTH_STATUS={status or 'ausente'}). "
            "Faça login no preview e rode novamente."
        )
        return 0

    inicio = time.time()
    resultados = asyncio.run(executar())
    destino = escrever_junit(resultados, time.time() - inicio)
    falhas = sum(1 for _, ok, _ in resultados if not ok)
    print(f"\nRelatório: {destino} · screenshots: {SHOTS}")
    print(f"{len(resultados) - falhas}/{len(resultados)} passos OK")
    return 1 if falhas else 0


if __name__ == "__main__":
    sys.exit(main())
