# Guia do cliente: do zero até o sistema no ar

Este arquivo é o **roteiro mestre**. Os outros manuais são capítulos. Aqui você só segue a numeração.

Imagine que você vai montar uma loja: primeiro o estoque (banco), depois o caixa que nunca fecha (API), depois a vitrine (site). Se inverter a ordem, a vitrine aponta para um caixa que não existe.

## Visão da arquitetura (em analogia)

- **Supabase** = o cofre / arquivo morto (PostgreSQL).
- **Redis** = a filazinha da padaria (campanhas, jobs).
- **Railway ou VPS** = o funcionário que trabalha 24 horas (API, WhatsApp).
- **Vercel** = a fachada da loja (painel no navegador).

O cliente final abre só o endereço da Vercel (ou do domínio). Por trás, o navegador conversa com a API.

---

## Etapa A — No seu computador (1 a 2 horas na primeira vez)

Abra [01-REQUISITOS.md](./01-REQUISITOS.md) e faça **cada** passo até `node -v` mostrar v20. Não continue se o PowerShell disser que `node` não é reconhecido: feche o PowerShell, abra de novo, ou reinstale o Node marcando PATH.

Abra [02-INSTALACAO-LOCAL.md](./02-INSTALACAO-LOCAL.md). Você vai:

1. Copiar `.env.example` para `.env` no backend e no frontend.
2. Rodar `npm install` nas duas pastas (pode demorar e parecer “travado”: espere).
3. Subir Redis se for testar fila (Docker).
4. Abrir **dois** terminais: API (`npm run dev` ou o script do backend) e painel (`npm start` no frontend).

O painel local costuma ser `http://localhost:3001` e a API `http://localhost:3000`. Se o login falhar, leia o terminal da API — ele fala a verdade.

Não precisa WhatsApp neste dia. Precisa **ver a tela de login** e entender que são dois programas, não um.

---

## Etapa B — Criar o banco no Supabase (cerca de 20 minutos)

Abra [14-SUPABASE-PASSO-A-PASSO.md](./14-SUPABASE-PASSO-A-PASSO.md) e faça **todos** os passos até:

- existir um projeto Healthy
- você ter a URI na porta **5432** copiada num bloco de notas
- `DEV_NO_DB=false` no `.env`
- `npm run db:migrate` no backend ter terminado sem erro
- no Table Editor do Supabase aparecerem várias tabelas

Se o migrate falhar, **não suba Railway ainda**. Conserte o banco primeiro.

Crie o usuário administrador (script `npm run admin:local-dev` ou o que estiver no `backend/package.json`). Anote e-mail e senha num gerenciador de senhas.

---

## Etapa C — Redis na nuvem

Na Railway: New → Database → Redis. Copie a URL interna.

Ou crie um Redis na Upstash (eles dão uma URL `rediss://...`).

Cole no `.env` da API (e depois nas Variables da Railway):

```
REDIS_URI=...
REDIS_URL=...
REDIS_URI_ACK=...
```

As três iguais, no começo, evitam “uma fila sim outra não”.

---

## Etapa D — API na Railway

Siga [07-RAILWAY.md](./07-RAILWAY.md) **inteiro**, sem pular as variáveis.

No final você terá um endereço tipo:

`https://algo-production.up.railway.app`

Abra no Chrome. Pode não ter uma “home bonita”. Se não der 502 eterno, a API subiu. Veja os **Logs** no Railway: deve falar de migrate e “Servidor iniciado”.

Ajuste:

```
BACKEND_URL=https://esse-endereco-railway.app
PUBLIC_BACKEND_URL=https://esse-endereco-railway.app
FRONTEND_URL=https://ainda-nao-tenho-vercel  (depois você troca)
NODE_ENV=production
DEV_NO_DB=false
DATABASE_URL=...supabase...
DB_SSL=true
JWT_SECRET=...
JWT_REFRESH_SECRET=...
```

---

## Etapa E — Painel na Vercel

Siga [15-VERCEL.md](./15-VERCEL.md) **inteiro**.

A variável mais importante:

```
REACT_APP_BACKEND_URL=https://esse-endereco-railway.app
```

Sem barra no final.

Depois que a Vercel gerar `https://seu-projeto.vercel.app`, **volte na Railway** e coloque:

```
FRONTEND_URL=https://seu-projeto.vercel.app
```

Salve e espere o redeploy da API (senão o login quebra por CORS: o navegador bloqueia a API de outro endereço).

Na Vercel, **Redeploy** se você mudou `REACT_APP_BACKEND_URL` depois do primeiro build.

---

## Etapa F — Primeiro login no ar

1. Abra o endereço da Vercel.
2. Entre com o admin do banco.
3. Troque a senha em Usuários / perfil, se o sistema deixar.
4. Abra Tickets. Se o Socket falhar, o `REACT_APP_BACKEND_URL` está em HTTP ou com barra no final, ou a Railway dormiu (plano hobby).

---

## Etapa G — WhatsApp (depois que o resto estiver estável)

Só agora. [09-WHATSAPP-E-SERVICOS.md](./09-WHATSAPP-E-SERVICOS.md).

Conexões → QR Code (Baileys) precisa da API **acordada**. Cloud API precisa de webhook HTTPS apontando para `PUBLIC_BACKEND_URL`.

---

## Etapa H — Domínio próprio (opcional, mas profissional)

- Painel: na Vercel, Domains, `crm.seudominio.com`
- API: na Railway, domínio custom `api.seudominio.com` **ou** Nginx na VPS

Atualize **quatro** lugares:

1. `REACT_APP_BACKEND_URL` (Vercel) → API nova → **rebuild**
2. `BACKEND_URL` e `PUBLIC_BACKEND_URL` (Railway)
3. `FRONTEND_URL` (Railway)
4. Webhooks Meta/Stripe, se já existirem

---

## Etapa alternativa — Tudo na VPS

Se o cliente tem um servidor Ubuntu em vez da Railway, ignore a Etapa D e faça [06-VPS.md](./06-VPS.md). O banco ainda pode ser o Supabase. O painel ainda pode ser a Vercel.

---

## O que entregar ao cliente no dia

- URL do painel
- URL da API (para suporte)
- Login admin (por canal seguro)
- Este `DOCUMENTACAO/`
- Aviso: `.env` não está no GitHub; cada ambiente tem o seu
- Checklist [11-CHECKLIST.md](./11-CHECKLIST.md) marcado

Se algo falhar, peça: print da tela, print dos **Logs da Railway**, e as **últimas 20 linhas** do terminal local. Com isso dá para diagnosticar sem adivinhar.
