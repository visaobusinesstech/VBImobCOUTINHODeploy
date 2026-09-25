# Estratégia SEO Contínua — radarimobtech (2026)

Estratégia aterrada em dados reais do Semrush (database `br`, jul/2026) e no que já
está construído na plataforma (SEO técnico automatizado, landing pages
programáticas de cidade/bairro, monitoramento Lighthouse, auditoria pós-deploy).

## 1. Diagnóstico

- **Domínio:** `radarimobtech.shop` — ainda sem tráfego orgânico rastreável no Semrush BR (fase de indexação). Isso é normal para site novo.
- **Concorrente-âncora:** `kenlo.com.br` → **104.815 palavras-chave orgânicas**, **~141.926 visitas/mês**. Existe demanda enorme para capturar.
- **Ativos SEO já existentes:**
  - `index.html` com title/description/OG/Twitter reais.
  - `robots.txt` liberado com `Sitemap:` apontado para o domínio próprio.
  - `scripts/generate-sitemap.ts` gerando XML dinâmico (estáticas + `/anunciar-imovel/:cidade` + `/imoveis/:cidade/:bairro` + imóveis publicados) via `predev/prebuild`.
  - Componente `<Seo />` (react-helmet-async) com canonical, OG e JSON-LD.
  - Auditoria Lighthouse semanal + monitor SEO 6h + alertas de regressão + checklist por rota (`/seo-auditoria`).
  - Landing programática `/solucoes/seo-imobiliario`.
- **Gap prioritário:** ausência de conteúdo editorial (blog) e de landing pages comparativas — as duas maiores portas de entrada para termos "melhor X", "X vs Y", "como fazer X" que respondem a busca real.

## 2. Palavras-chave alvo (dados Semrush BR)

### Cluster A — Ferramenta (fundo de funil, alta intenção)

| Keyword | Volume/mo | KD | Estratégia |
|---|---|---|---|
| crm imobiliário | 1.000 | 21 (easy) | **Landing principal** (/solucoes/crm-imobiliario) |
| crm para imobiliária | 1.000 | 79 (comp) | Redirecionar/canonical para cluster A |
| crm imobiliario (sem acento) | 720 | 79 | Variação — cobrir no título/H1 |
| software para imobiliária | 210 | 36 | Landing dedicada |
| sistema para imobiliária | 390 | 69 | Blog (topo) + link p/ landing |
| o que é crm imobiliário | 140 | 76 | **Post de blog** (topo de funil) |
| melhor crm para corretor | — | — | Landing comparativa |
| kenlo (marca concorrente) | 18.100 | — | **/comparativo/kenlo-vs-radarimobtech** ← implementado |
| imoview crm | 14.800 | — | **/comparativo/imoview-vs-radarimobtech** |
| loft crm | 2.900 | — | **/comparativo/loft-vs-radarimobtech** |
| arbo crm | 1.900 | — | **/comparativo/arbo-vs-radarimobtech** |

### Cluster B — Captação (dor do corretor)

| Keyword | Volume/mo | KD | Formato |
|---|---|---|---|
| captação | 5.400 | — | Pilar |
| captador de imoveis | 880 | — | Blog |
| captação de imoveis | 720+260 | 13 (very easy) | **Landing /captacao-de-imoveis** |
| imoveis direto com proprietario | 480 | — | Blog + integração com portal |
| como fazer captação de imóveis | 0-10 (long tail) | 0 | Blog how-to |
| como conseguir exclusividade na captação | 0 (long tail) | 0 | Blog |
| funil de vendas imobiliário | 90 | 7 (very easy) | Blog |
| gestão de leads imobiliários | baixo | 0 | Blog |
| avaliação de imóveis online | 140 | 34 | Landing /avaliacao-imovel + AI CMA |

### Cluster C — Local/Programático (já parcialmente coberto)

- `/imoveis/:cidade/:bairro` e `/anunciar-imovel/:cidade` — expandir slugs e enriquecer conteúdo com bairros novos e cidades secundárias (Goiânia, Campo Grande, Anápolis). Meta: sair de ~400 páginas para 1.500+ em 90 dias.

## 3. Plano de conteúdo — 90 dias

### Mês 1 — Fundações (fundo → meio de funil)
1. `/comparativo/kenlo-vs-radarimobtech` — **entregue nesta iteração**.
2. `/comparativo/imoview-vs-radarimobtech`
3. `/solucoes/crm-imobiliario` (landing pilar cluster A)
4. `/captacao-de-imoveis` (landing pilar cluster B)
5. Blog: **"O que é CRM Imobiliário e por que corretores no Brasil usam em 2026"** (targeting 140+20 buscas/mês)
6. Blog: **"Como fazer captação de imóveis diretamente com proprietários"** (long-tail hub)

### Mês 2 — Amplitude
7. Blog: **"Funil de vendas imobiliário: 5 etapas para dobrar sua conversão"** (KD 7)
8. Blog: **"Como conseguir exclusividade na captação de imóveis"**
9. Blog: **"Avaliação de imóveis online: como precificar sem errar"**
10. `/comparativo/loft-vs-radarimobtech`
11. `/comparativo/arbo-vs-radarimobtech`
12. Expandir bairros programáticos (+300 combinações cidade/bairro)

### Mês 3 — Autoridade e link-earning
13. Estudo original: **"Radar do Mercado — DF 2026"** (dados agregados da própria base) — ativo de PR/backlinks
14. Blog: **"Regras do CRECI para corretor autônomo 2026"** (informacional, DR builder)
15. Blog: **"WhatsApp Business para imobiliária: templates que convertem"**
16. Guest posts em 3 blogs do nicho (associações regionais de imobiliárias, CRECI)

## 4. On-page — checklist por página nova

- Title 50–60 chars com keyword primária + marca no fim.
- Meta description 140–160 chars com benefício + CTA.
- H1 único, keyword primária.
- H2/H3 cobrindo variações e question keywords (`o que é`, `como funciona`).
- Canonical e OG apontando para a própria rota (via `<Seo />`).
- JSON-LD `Article` ou `Product` + `FAQPage` quando houver FAQ.
- Interlink: cada landing linka para 2 blogs relacionados e vice-versa.
- CTA principal acima da dobra.
- Adicionar entrada em `scripts/generate-sitemap.ts` e em `src/lib/seo/seoRegistry.ts` (checklist).

## 5. Otimização técnica — o que já roda + o que falta

Já ativo:
- Sitemap dinâmico regenerado a cada build.
- Robots.txt permissivo + Sitemap declarado.
- Core Web Vitals monitorados via `lighthouse-weekly` cron.
- Alertas automáticos de regressão (`SeoLighthouseAlertasPanel`).
- Auditoria pós-deploy comparando baseline (`post_deploy_audit_runs`).
- Programmatic SEO (cidade/bairro) + JSON-LD por página.

Adicionar (backlog priorizado):
- [ ] Preload de fontes críticas + `font-display: swap` (impacta LCP).
- [ ] `next-gen images` — converter PNGs pesados (`pwa-512.png` usado como OG) para WebP.
- [ ] Breadcrumb JSON-LD nas páginas programáticas.
- [ ] `hreflang="pt-BR"` explícito no `<html lang>` (já ok) e em `link[rel=alternate]` se abrir versão pt-PT no futuro.
- [ ] Página `/blog` como hub editorial.

## 6. Link building — estratégia realista

Não é sobre "comprar links". É sobre criar ativos que naturalmente atraem citações.

1. **Estudo de dados original** ("Radar do Mercado DF/BR 2026") → distribuir para portais setoriais (Molico, Redimob, Habitar Imob, Rede Imobiliária) com pitch de dados exclusivos.
2. **Ferramentas gratuitas indexáveis** — calculadora de ITBI, simulador de comissão CRECI, avaliador rápido de imóvel. Cada uma é uma landing linkável.
3. **Presença em diretórios setoriais** — Secovi, CRECI regional, associações de corretores.
4. **Guest posts** em 3–5 blogs por trimestre (temas: automação, IA para corretor, LGPD para imobiliária).
5. **HARO/Correspondentes** — responder pautas de jornalistas sobre mercado imobiliário via Conexão Assessor.
6. **Podcast/vídeo** — participar de 2 podcasts do nicho por mês; a bio inclui link.

Meta 90 dias: **de 0 → 30 domínios referentes**, foco em DR 20+.

## 7. Monitoramento e KPIs

Dashboards já disponíveis internamente:
- `/seo-auditoria` — findings + Lighthouse + tendências + pós-deploy.
- Semrush (connector) — para bulk keyword tracking se contratado.

KPIs por mês:

| KPI | Baseline | Meta M+3 | Meta M+6 |
|---|---|---|---|
| Palavras-chave indexadas | 0 | 200 | 800 |
| Tráfego orgânico/mês (Semrush est.) | 0 | 500 | 2.500 |
| Páginas na Search Console | ~30 | 500 | 1.500 |
| Domínios referentes | 0 | 15 | 40 |
| Authority Score | — | 10 | 20 |
| Lighthouse Perf (mobile) — home | medir | 85+ | 90+ |
| Lighthouse SEO — home | 90+ | 95+ | 100 |
| Conversões orgânicas → free trial | 0 | 20/mês | 100/mês |

Revisão: análise mensal com Semrush `seo_trend` + `domain_analysis`, e rerun do Lighthouse baseline após cada release grande.

## 8. Cadência operacional

- **Semanal:** rodar `seo-monitor-6h` já é automático; revisar alertas de regressão; publicar 1 post de blog.
- **Quinzenal:** publicar 1 landing (comparativo, cluster ou cidade).
- **Mensal:** rodar `lighthouse-weekly` review; atualizar baselines; auditar 5 páginas antigas (refresh de conteúdo); analisar Semrush `seo_trend`.
- **Trimestral:** publicar 1 estudo original; revisar palavras-chave (Semrush `keyword_research` + `competitive_analysis`); depurar redirects/404.

## 9. Próximas ações concretas

1. ✅ `/comparativo/kenlo-vs-radarimobtech` publicada nesta iteração.
2. Escrever 3 primeiros posts de blog (usar `/conteudo-seo` que já existe).
3. Adicionar `/solucoes/crm-imobiliario` (landing cluster A pilar).
4. Adicionar `/captacao-de-imoveis` (landing cluster B pilar).
5. Solicitar indexação manual na Search Console para novas rotas.
6. Rodar `seo_chat--trigger_scan` semanalmente ou após cada publicação.
