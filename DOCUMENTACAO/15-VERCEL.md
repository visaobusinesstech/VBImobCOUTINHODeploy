# Hospedar o painel na Vercel (frontend)

A Vercel neste CRM serve **só o React** (`frontend/`).  
A **API, WhatsApp, Socket.IO e Redis não sobem na Vercel** (processo longo + WebSocket). Coloque o backend na **Railway** ou **VPS** e o banco no **Supabase** ou Postgres da Railway.

Arquitetura típica:

```
Navegador  →  https://crm.vercel.app     (Vercel — SPA)
           →  https://api.seudominio.com (Railway/VPS — Express)
           →  Postgres (Supabase)
           →  Redis
```

---

## 1. Pré-requisitos

- Conta em https://vercel.com
- Repositório Git (GitHub/GitLab) com a pasta `frontend/`
- API já no ar em HTTPS (`BACKEND_URL`)
- CORS: `FRONTEND_URL` no backend = origem da Vercel (ex. `https://crm.vercel.app` ou domínio próprio)

---

## 2. Projeto na Vercel

1. **Add New → Project** e importe o Git.
2. **Root Directory:** `frontend`  
   (se o Git for a pasta `VBSOLUTIONCRMCodigoFonte-main`, o root é `frontend`; se o Git for só o frontend, deixe vazio.)
3. Framework preset: **Create React App** (ou Other).
4. **Build Command:** `npm run build`
5. **Output Directory:** `build`
6. **Install Command:** `npm install`
7. Node: **20.x** (Project Settings → General → Node.js Version)

---

## 3. Variáveis de ambiente na Vercel

**Settings → Environment Variables** (Production, Preview, Development):

| Nome | Valor | Observação |
|---|---|---|
| `REACT_APP_BACKEND_URL` | `https://api.seudominio.com` | Sem barra no final |
| `DISABLE_ESLINT_PLUGIN` | `true` | Evita falha de lint no build |
| `CI` | `false` | CRA trata warning como erro se `CI=true` |
| `GENERATE_SOURCEMAP` | `false` | Build menor |
| `TSC_COMPILE_ON_ERROR` | `true` | Opcional |

A Vercel **embute** `REACT_APP_*` na hora do **build**. Se mudar a URL da API, faça **Redeploy** (não basta refresh).

Não coloque `DATABASE_URL`, JWT nem chaves Stripe no frontend.

---

## 4. SPA (React Router)

O painel usa rotas tipo `/tickets`, `/prompts`. Sem rewrite, o F5 dá 404.

Em **Settings → Functions** isso não resolve SPA antigo. Use um arquivo na pasta `frontend`:

`frontend/vercel.json`:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

(Se ainda não existir no código, crie esse arquivo antes do deploy.)

---

## 5. CORS no backend

No `backend/.env` (Railway/VPS):

```
FRONTEND_URL=https://SEU-PROJETO.vercel.app
```

Se usar domínio próprio na Vercel (`crm.cliente.com`):

```
FRONTEND_URL=https://crm.cliente.com
```

Pode precisar de `WEB_ORIGIN` com a mesma URL. Redeploy da **API** depois de alterar.

---

## 6. Domínio próprio

Vercel → Project → **Domains** → adicione `crm.seudominio.com`.  
DNS: CNAME `crm` → `cname.vercel-dns.com` (ou o que o painel mostrar).

Atualize `FRONTEND_URL` na API e `REACT_APP_BACKEND_URL` se ainda apontar para preview.

---

## 7. CLI (opcional)

```bash
npm i -g vercel
cd frontend
vercel login
vercel env add REACT_APP_BACKEND_URL
vercel --prod
```

---

## 8. Checklist Vercel

- [ ] Root Directory = `frontend`
- [ ] Output = `build`
- [ ] Node 20
- [ ] `REACT_APP_BACKEND_URL` HTTPS da API
- [ ] `vercel.json` com rewrite para `index.html`
- [ ] API com `FRONTEND_URL` = URL da Vercel
- [ ] Login no painel funciona, Socket (atendimento) conecta (não bloqueado por proxy)

---

## 9. O que **não** fazer

- Não defina Root Directory na raiz do monorepo sem ajustar o build (o CRA está em `frontend/`).
- Não tente `npm start` do **backend** como serverless function.
- Não use `localhost:3000` em Production na Vercel.
