# Hospedagem do frontend

O painel é um SPA (React). Qualquer CDN/estático serve, **desde que** `REACT_APP_BACKEND_URL` aponte para a API HTTPS.

## Build

```bash
cd frontend
# Windows PowerShell
$env:REACT_APP_BACKEND_URL="https://api.seudominio.com"
npm ci
npm run build
```

Artefato: `frontend/build/`.

## Nginx (já na VPS)

Ver [06-VPS.md](./06-VPS.md) — `try_files $uri /index.html`.

## Cloudflare Pages / Netlify / Vercel

- Build command: `npm run build` (working directory `frontend`)
- Output: `build`
- Env: `REACT_APP_BACKEND_URL`
- SPA rewrite: `/*` → `/index.html`

CORS: `FRONTEND_URL` no backend deve ser exatamente a origem (ex. `https://crm.pages.dev`).

## Mesmo domínio (recomendado)

`https://crm.seudominio.com` = frontend  
`https://crm.seudominio.com/api` = proxy para Node  

Aí o frontend pode usar `REACT_APP_BACKEND_URL=` vazio ou a mesma origem, conforme o código do `api.js`. Confira `frontend/src/services/api.js` se existir proxy.

Este projeto, por padrão, usa URL absoluta (`http://localhost:3000`). Em produção use a URL pública completa da API.
