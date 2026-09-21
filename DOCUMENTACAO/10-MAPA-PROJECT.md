# Mapa do projeto — onde cada coisa mora (para leigo curioso)

Você não precisa disso para **usar** o CRM. Precisa se for **mexer no código** ou achar um arquivo.

Há duas pastas “CRM” no download: a raiz do zip e `VBSOLUTIONCRMCodigoFonte-main\`. O código que roda é o da pasta **interna** com `backend` e `frontend`.

## backend/

- `src/server.ts` (ou `.js` após build) — porta, Socket.io.
- `src/app.ts` — Express, CORS, rotas.
- `src/database/` — Sequelize, migrations.
- `src/models/` — tabelas: User, Ticket, Imovel, Proprietario, Contrato, LeadSale, RealtyModulo…
- `src/controllers/` — “o que acontece quando a tela chama a API”.
- `src/services/` — regras (ex.: achar ticket do lead).
- `src/helpers/` — pedaços reutilizáveis (RadarZAP, scrape de portal, SEO).
- `src/routes/` — URLs `/imoveis`, `/tickets`, etc.
- `.env` — segredos. **Não** sobe no Git.

## frontend/

- `src/routes/index.js` — cada caminho do navegador (`/imoveis`, `/tickets`).
- `src/layout/MainListItems.js` — o menu da esquerda.
- `src/pages/` — telas. Imobiliário muitas vezes em `pages/Imoveis`, `RealtyPipeline`, `RadarZap`…
- `src/components/` — botões, listas, chat.
- `src/services/api.js` (ou similar) — axios para `REACT_APP_BACKEND_URL`.
- `vercel.json` — rewrite SPA na Vercel.

## DOCUMENTACAO/

Estes Markdowns. Índice em [00-INDICE.md](./00-INDICE.md).

## project/

Pasta antiga do Radar Proptech (Vite + Supabase direto). **Pode apagar.** Nada do VB Solution importa ela.

## Testes

`backend/jest.realty.config.js` — testes do imobiliário e do menu. Rodar: na pasta backend, `npx jest --config jest.realty.config.js --forceExit`.
