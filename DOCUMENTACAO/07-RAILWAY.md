# Deploy no Railway

O Railway combina app + Redis. O **Postgres pode ser o do Supabase** (não precisa do plugin PostgreSQL da Railway).

**Receita cliente:** Redis + Backend no Railway · banco no [Supabase](./14-SUPABASE-PASSO-A-PASSO.md) · frontend na [Vercel](./15-VERCEL.md).

Variáveis extras no serviço da API:

```
DATABASE_URL=postgresql://postgres.[REF]:SENHA@HOST:5432/postgres
DB_SSL=true
DEV_NO_DB=false
FRONTEND_URL=https://SEU-APP.vercel.app
```

Não use o pooler porta **6543** para o `npm start` / migrate se der erro de prepared statements; use a URI **session/direct 5432**.

O Railway combina app + Postgres + Redis. Duas formas: **um serviço só da API** + frontend noutro host, ou **dois serviços** (backend e frontend).

## Serviços recomendados

1. **PostgreSQL** — plugin Railway **ou** Supabase (`DATABASE_URL`)
2. **Redis** (plugin)
3. **Backend** — pasta `backend/`
4. **Frontend** — [Vercel](./15-VERCEL.md) (recomendado) ou segundo serviço Railway

## Backend no Railway

1. New Project → Deploy from GitHub (ou CLI `railway up` na pasta `backend`).
2. Root Directory: `backend` (se o repo tiver frontend na mesma raiz).
3. Build: `npm install && npm run build`
4. Start: `npm start`  
   (`prepare-and-migrate` + `dist/server.js` — o `PORT` do Railway é injetado.)
5. Variables: cole o conteúdo de `.env.example` e preencha.

Mapeie o plugin Postgres:

- `DATABASE_URL` = variável `${{Postgres.DATABASE_URL}}` (sintaxe do Railway)
- `DB_SSL=true`
- `DB_DIALECT=postgres`

Redis:

- `REDIS_URI` / `REDIS_URL` / `REDIS_URI_ACK` = URL interna do Redis

URLs públicas:

```
BACKEND_URL=https://SEU-SERVICO.up.railway.app
PUBLIC_BACKEND_URL=https://SEU-SERVICO.up.railway.app
FRONTEND_URL=https://SEU-FRONTEND
NODE_ENV=production
DEV_NO_DB=false
```

Gere `JWT_SECRET` e `JWT_REFRESH_SECRET`.

6. Generate Domain no serviço da API.
7. No primeiro deploy, veja os logs do migrate. Se falhar, o `npm start` já tenta migrar; corrija SSL/`DATABASE_URL`.

Volume (opcional): sessões WhatsApp / uploads — anexe um Volume no diretório de public/media do backend se o app gravar em disco.

## Frontend no Railway

1. Serviço com Root Directory `frontend`.
2. Variável `REACT_APP_BACKEND_URL=https://api-publica.up.railway.app` **antes** do build.
3. Build: `npm install && npm run build`
4. Start: sirva a pasta `build`, por exemplo:

```
npx serve -s build -l $PORT
```

(adicione `serve` em `dependencies` se for o caso.)

SPA precisa de fallback para `index.html` (o `serve -s` faz isso).

## CLI

```bash
npm i -g @railway/cli
railway login
cd backend
railway init
railway add   # postgres / redis pelo dashboard é mais simples
railway variables
railway up
```

## Cuidados

- Rebuild o frontend sempre que mudar `REACT_APP_BACKEND_URL`.
- Webhooks Meta / Stripe devem usar o domínio HTTPS da API.
- Sleep de hobby: WhatsApp Baileys **cai** se o container dormir — plano que não durma, ou use Cloud API.
