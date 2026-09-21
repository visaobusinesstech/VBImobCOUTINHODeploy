# Subir a API na Railway (passo a passo de leigo)

A Railway é um painel: você liga o GitHub, ela constrói o `backend` e deixa um endereço `https://....up.railway.app`. É o caminho mais simples se você **não** quer administrar Ubuntu.

Receita deste cliente:

1. Banco no **Supabase** ([14-SUPABASE-PASSO-A-PASSO.md](./14-SUPABASE-PASSO-A-PASSO.md))
2. **Redis** na própria Railway
3. **API** (serviço a partir da pasta `backend`)
4. Painel na **Vercel** ([15-VERCEL.md](./15-VERCEL.md))

Você **pode** adicionar o plugin PostgreSQL da Railway em vez do Supabase. Não use os dois ao mesmo tempo sem saber qual URI está no `.env`.

---

## Passo 1 — Conta e cartão

1. https://railway.app — Login with GitHub.
2. Planos pagos pedem cartão. Sem cartão, o serviço **dorme** e o WhatsApp cai. Para CRM de verdade, use plano que **não durma**.

## Passo 2 — New Project

1. **New Project**.
2. **Deploy from GitHub repo**.
3. Autorize a Railway a ver `visaobusinesstech/codigo-fonte-COUTINHO` (ou o fork).
4. Se o projeto for “vazio”, adicione o repo em seguida.

## Passo 3 — Redis primeiro

1. No projeto, **New** → **Database** → **Redis**.
2. Espere ficar Running.
3. Abra o Redis → **Variables** ou **Connect**. Copie a URL (`REDIS_URL`). Guarde.

## Passo 4 — Serviço da API

1. **New** → **GitHub Repo** (o mesmo repositório) **ou** adicione um serviço Empty e conecte o repo.
2. Clique no serviço → **Settings**.
3. **Root Directory:** precisa ser a pasta onde está o `package.json` **do backend**.

No Git deste cliente isso costuma ser:

`VBSOLUTIONCRMCodigoFonte-main/backend`

Se errar o root, o build não acha `npm run build` certo.

4. **Build Command:** `npm install && npm run build`  
   (Se a Railway já detectou Nixpacks/Node, às vezes só o build padrão. Confira os logs.)

5. **Start Command:** `npm start`  
   Este projeto, no start, roda migrate e depois `dist/server.js`. É o que queremos.

6. **Watch Paths** (opcional): `VBSOLUTIONCRMCodigoFonte-main/backend/**`

## Passo 5 — Variáveis (não pule nenhuma)

Aba **Variables** do serviço da **API** (não do Redis). Clique **Raw Editor** se tiver, ou adicione uma a uma.

Cole e ajuste:

```
NODE_ENV=production
DEV_NO_DB=false
DB_DIALECT=postgres
DB_SSL=true
DATABASE_URL=cole_aqui_a_uri_5432_do_supabase

JWT_SECRET=cole_uma_string_longa
JWT_REFRESH_SECRET=cole_outra_string_longa_diferente

REDIS_URI=${{Redis.REDIS_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
REDIS_URI_ACK=${{Redis.REDIS_URL}}
```

A sintaxe `${{Redis.REDIS_URL}}` só funciona se o serviço Redis no **mesmo** projeto se chamar exatamente `Redis`. Se o nome for outro, abra o Redis, copie a URL na mão e cole nas três linhas.

Depois que o primeiro deploy gerar o domínio:

```
BACKEND_URL=https://SEU-SERVICO.up.railway.app
PUBLIC_BACKEND_URL=https://SEU-SERVICO.up.railway.app
FRONTEND_URL=https://SEU-FRONTEND.vercel.app
```

No **primeiro** deploy você ainda não tem Vercel: coloque provisoriamente o próprio domínio da Railway ou `*` não existe aqui — use um placeholder e atualize no passo 8.

Gere JWT no seu PC e cole. Não use `123456`.

Outras chaves (Stripe, Meta) podem esperar.

## Passo 6 — Generate Domain

No serviço da API: Settings → Networking → **Generate Domain**. Copie o `https://...up.railway.app`. Atualize `BACKEND_URL` e `PUBLIC_BACKEND_URL` para esse valor **sem barra no final**. Salve (dispara novo deploy).

## Passo 7 — Ler os logs como ser humano

Aba **Deployments** → o deploy atual → **View Logs**.

O que você quer ver, no fim:

- npm install ok
- `tsc` / build ok
- migrate rodando (pode demorar)
- “Servidor iniciado”

O que é problema:

- `password authentication failed` → `DATABASE_URL` errada
- `ENOTFOUND` / timeout Supabase → IPv6; use URI IPv4 do painel Supabase
- `prepared statement` → você usou pooler 6543; troque para 5432 session
- `DEV_NO_DB` no log → você esqueceu `false`
- Out of memory → suba o plano ou `DB_POOL_MAX=5`

## Passo 8 — Vercel e CORS

Quando o painel na Vercel existir, volte aqui e sete `FRONTEND_URL` exatamente igual à URL do site (https, sem barra). Deploy de novo.

Na Vercel, `REACT_APP_BACKEND_URL` = domínio Generate Domain da Railway. Redeploy na Vercel.

## Passo 9 — Volume (WhatsApp e arquivos)

Se o Baileys gravar sessão em disco, um **redeploy apaga o disco efêmero**. Em Settings do serviço, adicione um **Volume** montado na pasta que o backend usa para sessões/public (confira no código/README se houver caminho; muitas instalações usam `public` ou `.wwebjs`). Sem volume, o QR Code pede de novo a cada deploy.

## Passo 10 — CLI (opcional)

Se um dia instalar `npm i -g @railway/cli`:

```bash
railway login
cd VBSOLUTIONCRMCodigoFonte-main/backend
railway link
railway up
```

O painel no browser já basta para leigo.

## Passo 11 — Frontend também na Railway? (não recomendado agora)

Dá para criar segundo serviço Root Directory `.../frontend`, start `npx serve -s build -l $PORT`, e `REACT_APP_BACKEND_URL` no build. A Vercel é mais simples para SPA. Se insistir, instale a dependência `serve` no `package.json` do frontend.

## Recapitulando o clique-a-clique

GitHub conectado → Redis no projeto → serviço Node com root `backend` → variáveis Supabase+JWT+Redis → Generate Domain → logs verdes → Vercel apontando para esse domínio → `FRONTEND_URL` de volta na Railway.
