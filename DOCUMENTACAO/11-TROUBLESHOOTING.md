# Problemas comuns — leia como um manual de “o que eu fiz de errado”

Cada bloco: o que você **vê**, o que **significa**, o que **fazer**, na ordem.

---

## Tela branca no painel

Significa: o JavaScript quebrou ou a API não responde.

1. F12 → Console. Copie o erro vermelho.
2. Se `Failed to fetch` / `ERR_CONNECTION_REFUSED`: a API não está no ar. `npm start` no backend. Local: porta 3000.
3. Se Mixed Content (HTTP no meio de HTTPS): painel em https e API em http. Coloque HTTPS na API.
4. `Wrong API URL`: `.env` do frontend com localhost em produção. Corrija, **rebuild**, redeploy (Vercel: variável + Redeploy).

## Login não entra

1. Senha certa? Caps Lock?
2. `DEV_NO_DB=true` em produção: banco de mentira. Ponha `false` e migrate.
3. JWT_SECRET mudou depois que você já estava logado: limpe o localStorage (F12 → Application → Local Storage → Clear) e login de novo.
4. Relógio do Windows errado: JWT “expira” na hora.

## CORS / “blocked by CORS policy”

O navegador pergunta à API: “posso chamar você deste site?”. A API só diz sim se `FRONTEND_URL` for **idêntico** (https, domínio, sem barra no fim).

1. Abra a URL do painel na barra do Chrome. Copie.
2. Cole em `FRONTEND_URL` da API. Reinicie PM2 / redeploy Railway.
3. Local: `http://localhost:3001` (a porta do `npm start` do frontend).

## Migrations “already exists” / “does not exist”

Você rodou migrate duas vezes em bancos diferentes, ou undo no meio.

1. Não invente DROP TABLE em produção.
2. Olhe a tabela `SequelizeMeta` no Postgres: lista o que já rodou.
3. Ambiente novo: `npm run db:migrate` em banco **vazio**.

## Supabase: timeout ou IPv6

Windows/Railway às vezes não falam IPv6 com o host `db.xxxx.supabase.co`.

No painel Supabase, copie a connection string **IPv4** / Session 5432. `DB_SSL=true`. Não use 6543 no migrate.

## Redis: ECONNREFUSED 6379

Nada escutando na porta. Docker Redis parado, ou Railway sem plugin, ou URI `localhost` dentro da Railway (lá o Redis **não** é localhost — é a URL do plugin).

## WhatsApp QR some toda hora

Sessão em disco apagada. Railway: adicione Volume. VPS: não apague a pasta do projeto; PM2 `save` + `startup`.

## 502 Nginx

API caiu. `pm2 status`. `pm2 logs`. Disco cheio (`df -h`). Porta 3000 ocupada por outro processo.

## `npm start` frontend ENOSPC / disco cheio

Libere espaço (node_modules duplicado, Recycle Bin). CRA precisa de disco.

## Menu / página 404

URL tem que existir em `frontend/src/routes` **e** no host SPA (`vercel.json` rewrite). Confira [12-MENU.md](./12-MENU.md).

## Pipeline sem ticket

O lead precisa de `ticketId`. Use o botão de vincular na tela de negócios / o serviço ResolveTicket. Ticket fechado demais pode não aparecer no preview.

## Testes Jest travam

Use `npx jest --config jest.realty.config.js --forceExit`. Não misture ts-jest de outro pacote sem necessidade.
