# Publicar o painel na Vercel (aula completa)

A Vercel é um site que pega seu código React, gera uma versão estática (HTML/JS) e entrega pelo mundo. É ótima para o **painel**. É **péssima** para o WhatsApp deste CRM, porque WhatsApp precisa de um processo Node ligado, QR Code, memória e WebSocket estável.

Regra de ouro: **Vercel = vitrine. Railway/VPS = loja dos fundos.**

---

## Passo 1 — Conta

1. https://vercel.com  
2. Continue with GitHub (recomendado), autorize.

## Passo 2 — O código precisa estar no GitHub

Este projeto já foi enviado para:

https://github.com/visaobusinesstech/codigo-fonte-COUTINHO

Se o GitHub da Vercel for **outra conta**, dê acesso ao repositório (Invite) ou faça fork. A Vercel precisa ler o código.

## Passo 3 — New Project

1. Dashboard Vercel → **Add New…** → **Project**.
2. Importe `codigo-fonte-COUTINHO`.
3. Antes de Deploy, abra **Root Directory**: clique em Edit e escolha a pasta do frontend.

Aqui mora a pegadinha do ZIP: o React **não** está na raiz do Git. Ele está em:

`VBSOLUTIONCRMCodigoFonte-main/frontend`

Na tela da Vercel, Root Directory deve ficar exatamente isso (com o nome da pasta que existe no Git). Se você apontar para a raiz, o build não acha o `package.json` certo e quebra.

4. Framework Preset: **Create React App**. Se não listar, deixe Other.
5. Build Command: `npm run build`
6. Output Directory: `build`
7. Install Command: `npm install`
8. **Ainda não clique em Deploy.** Vá em Environment Variables.

## Passo 4 — Variáveis (explique cada uma)

Clique **Environment Variables** e adicione, para Production **e** Preview:

**Nome:** `REACT_APP_BACKEND_URL`  
**Valor:** a URL HTTPS da sua API, exemplo `https://crm-api-xxxx.up.railway.app`  
**Sem** `/` no final. **Sem** `localhost`.

Por que o nome começa com `REACT_APP_`? Porque o Create React App **só** coloca no site as variáveis com esse prefixo. Se você chamar `BACKEND_URL` no frontend, o navegador **nunca** vê.

**Nome:** `DISABLE_ESLINT_PLUGIN`  
**Valor:** `true`  
Evita o build morrer por regra de lint.

**Nome:** `CI`  
**Valor:** `false`  
Se `CI=true` (a Vercel às vezes define), o React trata aviso como erro e o deploy falha.

**Nome:** `GENERATE_SOURCEMAP`  
**Valor:** `false`  
Arquivos menores, menos exposição de código no navegador.

Não coloque senha de banco, JWT, Stripe secret, Redis. Isso é da API.

## Passo 5 — Node 20

Settings do projeto (depois do primeiro deploy também pode) → General → Node.js Version → **20.x**.

## Passo 6 — Arquivo vercel.json (rotas do menu)

O painel usa endereços tipo `/tickets`. Se alguém der F5 nessa URL, a Vercel precisa devolver o `index.html` para o React assumir.

Na pasta `frontend` deste código já existe `vercel.json` com:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

Se você fez deploy **antes** desse arquivo existir, faça um commit e um deploy de novo.

## Passo 7 — Deploy

Clique **Deploy**. Olhe o log. Primeira vez: vários minutos de `npm install`.

**Verde (Ready):** clique no Print / Visit. Deve abrir o login.

**Vermelho:** abra o log.  
- `Cannot find package.json` → Root Directory errado.  
- ESLint / `Treating warnings as errors` → falta `CI=false`.  
- Falta memória → raro; peça log ao suporte.

## Passo 8 — Ligar a API na Vercel (CORS)

O navegador só deixa o site da Vercel falar com a API se a API **autorizar** a origem.

No Railway (ou `.env` da VPS):

```
FRONTEND_URL=https://o-endereco-que-a-vercel-gerou.vercel.app
```

Exemplo: `https://codigo-fonte-coutinho.vercel.app`

Salve. Espere o redeploy da **API**. Sem isso, o login fica em branco, “Network Error”, CORS no F12.

Se usar domínio próprio depois, **mude de novo** o `FRONTEND_URL`.

Há também `WEB_ORIGIN` em alguns setups. Se CORS persistir, coloque o mesmo valor em `WEB_ORIGIN`.

## Passo 9 — Teste humano

1. Login com usuário do banco (não o demo `DEV_NO_DB` de produção).
2. F12 → Network: as chamadas devem ir para `REACT_APP_BACKEND_URL`, status 200 no login.
3. Abra Tickets e veja se a conexão WebSocket sobe (não fica “connecting” eterno).
4. Dê F5 em `/prompts`. Se 404, falta `vercel.json`.

## Passo 10 — Mudou a URL da API?

Altere a variável na Vercel e clique **Redeploy** (Deployments → três pontinhos → Redeploy).  
**Não basta** salvar a variável: o React “imprime” a URL **dentro** do JavaScript na hora do build.

## Passo 11 — Domínio da empresa

1. Compre o domínio (Registro.br, etc.).
2. Vercel → Project → Settings → Domains → `crm.suaempresa.com.br`
3. No DNS, crie o registro que a Vercel pedir (geralmente CNAME para `cname.vercel-dns.com`).
4. Espere o cadeado HTTPS ficar verde (pode levar minutos ou horas).
5. Atualize `FRONTEND_URL` na API e faça login de novo.

## Passo 12 — O que nunca fazer

- Root Directory na pasta `backend`.
- Serverless function tentando rodar `src/server.ts`.
- `REACT_APP_BACKEND_URL=http://localhost:3000` em Production (só funciona na sua casa).
- Duas barras: `https://api.com/` **e** o código já junta `/tickets` virando URL estranha — prefira **sem** barra final.

Parabéns: a vitrine está no ar. O caixa (API) precisa estar no ar também, senão a loja é só um cartaz.
