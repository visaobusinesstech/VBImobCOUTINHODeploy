# Variáveis de ambiente — o que é cada linha do `.env`

Um arquivo `.env` é uma lista `NOME=valor`. O programa lê na hora que **sobe**. Se você mudou o `.env` com o servidor ligado, **reinicie** `npm run dev` ou o serviço na Railway.

Nunca commite `.env` com senha. O GitHub deste cliente ignora `.env`. Use `.env.example` como modelo.

Há **dois** mundos:

1. `backend/.env` — o cérebro (é aqui que mora o banco).
2. `frontend/.env.development` (no PC) ou variáveis da **Vercel** (no ar).

O frontend **não enxerga** o `.env` do backend. Por isso a URL da API precisa estar **repetida** no frontend: `REACT_APP_BACKEND_URL`.

---

## Como copiar o modelo no backend

```powershell
cd backend
copy .env.example .env
```

Abra `.env` e preencha. Abaixo, cada grupo.

---

## Grupo 1 — Onde o servidor escuta

`NODE_ENV`  
- `development` no seu PC.  
- `production` na Railway/VPS.  
Muda logs e SSL automático em alguns casos.

`PORT`  
Porta da API. No PC: `3000`. Na Railway **não brigue**: a plataforma injeta `PORT`. O código já usa a da plataforma.

`BACKEND_URL` e `PUBLIC_BACKEND_URL`  
O endereço **público** da API, do jeito que o celular e o Meta vão chamar.  
No PC: `http://localhost:3000`  
No ar: `https://api.suaempresa.com` (sempre `https` em produção).

`FRONTEND_URL`  
De onde o painel é aberto.  
No PC: `http://localhost:5181`  
Na Vercel: `https://seu-app.vercel.app`  
Se errar, o login falha com CORS (o Chrome bloqueia).

`WEB_ORIGIN`  
Às vezes uma origem extra. Se o CORS persistir, copie o mesmo valor do `FRONTEND_URL`.

---

## Grupo 2 — Banco

`DB_DIALECT=postgres` — sempre postgres neste CRM.

`DB_HOST` `DB_PORT` `DB_USER` `DB_PASS` `DB_NAME` — peça por peça.

`DB_SSL=true` na nuvem, `false` no Postgres do seu Windows.

`DATABASE_URL` — atalho. Ver [03-BANCO-DE-DADOS.md](./03-BANCO-DE-DADOS.md) e [14-SUPABASE-PASSO-A-PASSO.md](./14-SUPABASE-PASSO-A-PASSO.md).

`DB_POOL_MAX` etc. — quantas conexões simultâneas. No plano Free do Supabase não coloque 50. `8` é um começo seguro.

`DEV_NO_DB`  
`true` = teatro (sem Postgres).  
`false` = vida real. **Produção sempre false.**

---

## Grupo 3 — JWT (o crachá de quem logou)

`JWT_SECRET` e `JWT_REFRESH_SECRET`  
Duas strings longas e **diferentes**. São a assinatura do “você está logado”. Se vazar, alguém forja sessão. Se você **trocar** em produção, **todo mundo é deslogado**. Gere com `openssl rand -base64 32` duas vezes.

---

## Grupo 4 — Redis

`REDIS_URI` `REDIS_URL` `REDIS_URI_ACK`  
No começo, **as três iguais**.

Exemplos:

- Local: `redis://127.0.0.1:6379`
- Com senha: `redis://:minhasenha@127.0.0.1:6379`
- Railway: cole a URL que o plugin mostra (às vezes `redis://default:senha@host:port`)
- Upstash: `rediss://...` (com dois s = TLS)

`REDIS_HOST` `REDIS_PORT` `REDIS_PASSWORD` — alguns códigos leem as peças separadas. Preencha combinando com a URI.

---

## Grupo 5 — WhatsApp / Meta (pode deixar vazio no primeiro dia)

`VERIFY_TOKEN` — palavra que você inventa e cola no painel da Meta no webhook.

`FACEBOOK_APP_ID` `FACEBOOK_APP_SECRET` — do app em developers.facebook.com.

`USE_WHATSAPP_OFICIAL` — `true` se for Cloud API.

`URL_API_OFICIAL` `TOKEN_API_OFICIAL` — se usarem a API oficial embutida neste monorepo (`api_oficial`).

Sem isso, você ainda pode usar Baileys (QR Code) em **Conexões**, desde que a API esteja em HTTPS público em produção.

---

## Grupo 6 — Pagamentos (opcional)

Só preencha o que o cliente contratou: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, URLs de sucesso/cancelamento apontando para o **frontend**. Mercado Pago, Asaas, Gerencianet, Cakto têm campos no `.env.example`. Vazio = desligado.

---

## Grupo 7 — Inteligência artificial (opcional)

O ideal: o admin cola a chave **dentro do painel** (Prompts / Brain.AI), por empresa.

Linhas `OPENAI_...`, `ANTHROPIC_API_KEY`, `BRAIN_PLATFORM_...` são reservas da plataforma. **Não** coloque a chave da Visão Business no cliente. Cada cliente usa a chave **dele**.

---

## Grupo 8 — Google e GitHub (opcional)

Login Google: `GOOGLE_OAUTH_CLIENT_ID` e `SECRET`, e a URL de callback no console Google apontando para a API.

Brain.AI publicar no GitHub: `GITHUB_OAUTH_CLIENT_ID` e `SECRET`.

---

## Frontend (o outro arquivo)

`PORT=5181` — só no `npm start` local.

`REACT_APP_BACKEND_URL` — obrigatória. Local `http://localhost:3000`. Produção = URL HTTPS da API.

`REACT_APP_NAME_SYSTEM` — nome na interface.

`REACT_APP_FACEBOOK_APP_ID` — se usar login/embedded da Meta no browser.

`DISABLE_ESLINT_PLUGIN=true` — evita overlay chato no Windows.

Na **Vercel**, essas linhas não ficam num arquivo: ficam na tela Environment Variables, e só valem depois do **build**.

---

## Checklist rápido de um `.env` de produção

- [ ] `DEV_NO_DB=false`
- [ ] `NODE_ENV=production`
- [ ] `DATABASE_URL` ou `DB_*` testados
- [ ] `DB_SSL=true` se for nuvem
- [ ] JWT longos e únicos
- [ ] Redis preenchido
- [ ] `BACKEND_URL` / `PUBLIC_BACKEND_URL` HTTPS
- [ ] `FRONTEND_URL` = origem real do painel
- [ ] Frontend buildado com o mesmo `REACT_APP_BACKEND_URL`

Se uma coisa “às vezes funciona”, compare letra por letra essas URLs: `http` vs `https`, `www`, barra no final, `localhost` esquecido.
