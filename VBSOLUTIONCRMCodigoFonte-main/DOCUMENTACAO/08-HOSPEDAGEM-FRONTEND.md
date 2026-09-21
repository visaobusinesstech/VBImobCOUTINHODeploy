# Hospedar o painel (frontend) — passo a passo de leigo

O painel é a pasta `frontend`: um site React. Ele **não** guarda o banco. Ele só fala com a API.

**Caminho recomendado:** [15-VERCEL.md](./15-VERCEL.md). Este arquivo explica o mesmo tipo de site em **outros** lugares, caso a Vercel não seja opção.

Antes de qualquer hospedagem, no seu PC:

```powershell
cd CAMINHO\VBSOLUTIONCRMCodigoFonte-main\frontend
copy .env.example .env
```

Edite `.env`:

```
REACT_APP_BACKEND_URL=https://SUA-API-PUBLICA
```

Sem barra no fim. Troque pelo domínio real da API (Railway ou VPS).

```powershell
npm install
npm run build
```

Isso cria a pasta `build` com HTML/JS/CSS estáticos.

---

## Opção A — Vercel (recomendado)

Siga [15-VERCEL.md](./15-VERCEL.md) inteiro. Não precisa do `build` local se a Vercel construir no Git.

## Opção B — Netlify

1. Conta em https://www.netlify.com com GitHub.
2. Add new site → Import from Git → este repositório.
3. Base directory: `VBSOLUTIONCRMCodigoFonte-main/frontend`
4. Build command: `npm run build`
5. Publish directory: `build`
6. Environment: `REACT_APP_BACKEND_URL` = URL da API.
7. Deploy.

SPA: em Site configuration → Redirects, ou arquivo `public/_redirects`:

```
/*    /index.html   200
```

Sem isso, abrir `/tickets` direto dá 404.

## Opção C — Cloudflare Pages

1. https://pages.cloudflare.com → Create → Connect Git.
2. Root: `VBSOLUTIONCRMCodigoFonte-main/frontend`
3. Build: `npm run build` · Output: `build`
4. Variável `REACT_APP_BACKEND_URL`.
5. Depois do deploy: Functions ou Redirects para `/*` → `/index.html`.

## Opção D — Nginx na mesma VPS da API

Depois de `npm run build` **na VPS**, dentro de `frontend`:

```nginx
server {
  listen 80;
  server_name crm.suaempresa.com;
  root /var/www/vbsolution/VBSOLUTIONCRMCodigoFonte-main/frontend/build;
  index index.html;
  client_max_body_size 50M;

  location / {
    try_files $uri /index.html;
  }
}
```

`try_files` é o segredo do React Router. Certbot no domínio do painel igual ao da API.

O arquivo `frontend/vercel.json` já tem rewrite para Vercel; Nginx precisa da linha `try_files` acima.

## Opção E — Pasta `build` em qualquer hospedagem estática

Hostinger, cPanel, S3+CloudFront: envie o **conteúdo** de `build` (index.html na raiz do site). Configure o host para 404 → index.html.

## Depois de publicar

Abra o site. Login. F12 → Network. Uma chamada deve ir para `https://SUA-API/...`. Se for `localhost:3000`, você **esqueceu** a variável e precisa rebuild/redeploy.

CORS: a API precisa de `FRONTEND_URL` igual a este site. Veja [04-VARIAVEIS-DE-AMBIENTE.md](./04-VARIAVEIS-DE-AMBIENTE.md).
