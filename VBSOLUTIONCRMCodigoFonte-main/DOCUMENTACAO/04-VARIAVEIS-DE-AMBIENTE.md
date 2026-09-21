# Variáveis de ambiente

Exemplos canônicos (sem segredos reais):

- raiz: `.env.example`
- `backend/.env.example` → copie para `backend/.env`
- frontend: `frontend/.env.development` (dev) e `frontend/.env` / `.env.production` no build

Nunca commite `.env` com senhas.

## Frontend (React)

O CRA só lê variáveis que começam com `REACT_APP_`. Elas entram **no build**. Se mudar a URL da API em produção, **gere o build de novo**.

| Variável | Exemplo | Função |
|---|---|---|
| `PORT` | `5181` | Porta do `npm start` |
| `REACT_APP_BACKEND_URL` | `https://api.seudominio.com` | REST + Socket.IO |
| `REACT_APP_HOURS_CLOSE_TICKETS_AUTO` | (opcional) | Auto-fechamento no UI |
| `REACT_APP_FACEBOOK_APP_ID` | | Login/WhatsApp embedded |
| `REACT_APP_NAME_SYSTEM` | `VB Solution` | Nome na UI |
| `DISABLE_ESLINT_PLUGIN` | `true` | Evita overlay de lint no Windows |

Build:

```bash
cd frontend
set REACT_APP_BACKEND_URL=https://api.seudominio.com
npm run build
```

(Linux: `export REACT_APP_BACKEND_URL=...`)

## Backend — núcleo

| Variável | Função |
|---|---|
| `NODE_ENV` | `development` ou `production` |
| `PORT` | Porta HTTP da API (3000 local; Railway injeta `PORT`) |
| `BACKEND_URL` / `PUBLIC_BACKEND_URL` | URL pública da API (QR, webhooks) |
| `FRONTEND_URL` | Origem do painel (CORS) |
| `WEB_ORIGIN` | Origem extra de CORS, se precisar |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | Tokens — únicos, longos |
| `USER_LIMIT` / `CONNECTIONS_LIMIT` | Limites de plano |

## Backend — banco e Redis

Ver [03-BANCO-DE-DADOS.md](./03-BANCO-DE-DADOS.md).

## Backend — WhatsApp / Meta

| Variável | Função |
|---|---|
| `VERIFY_TOKEN` | Webhook Meta |
| `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET` | App Meta |
| `USE_WHATSAPP_OFICIAL` | Cloud API |
| `URL_API_OFICIAL` / `TOKEN_API_OFICIAL` | Endpoint oficial |

Sessões Baileys (não oficiais) ficam no Postgres + arquivos da API; precisa de **URL pública HTTPS** em produção.

## Backend — pagamentos (opcional)

Stripe, Mercado Pago, Asaas, Gerencianet, Cakto — campos no `.env.example`. Preencha só o que for usar. Webhooks devem apontar para `PUBLIC_BACKEND_URL`.

## Backend — IA (opcional)

Prefira cadastrar chaves **por empresa no painel**. Variáveis `OPENAI_*`, `ANTHROPIC_*`, `GEMINI_*`, `BRAIN_PLATFORM_*` são fallback de plataforma.

## Demo sem banco

```
DEV_NO_DB=true
DEV_AUTH_EMAIL=admin@local.dev
DEV_AUTH_PASSWORD=senha
```

**Desligue em produção.**

## Railway / VPS

Cadastre as mesmas chaves no painel do host. Não use `localhost` em `BACKEND_URL` nem `REACT_APP_BACKEND_URL` quando o site estiver na internet.
