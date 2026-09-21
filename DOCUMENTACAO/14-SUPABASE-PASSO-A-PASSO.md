# Usar o Supabase como banco do CRM (passo a passo)

O VB Solution **não usa** Auth/Storage/Realtime do Supabase. Ele usa o **PostgreSQL** que o Supabase hospeda. A API (Express + Sequelize) conecta como em qualquer Postgres na nuvem.

Ainda é obrigatório:

- **Redis** (filas, campanhas, WhatsApp)
- **Backend Node** (Railway, VPS ou similar) — **não** rode a API no Vercel (WebSocket + sessões WhatsApp)
- **Frontend** (Vercel, Nginx ou Railway)

Desligue `DEV_NO_DB` em produção.

---

## 1. Criar o projeto no Supabase

1. Acesse https://supabase.com e entre na conta.
2. **New project**.
3. Nome (ex. `vbsolution-crm`), senha forte do usuário `postgres` — **guarde essa senha**.
4. Região: a mais perto do Brasil (ex. São Paulo, se existir; senão `South America` / `East US`).
5. Espere o projeto ficar **Healthy**.

Use um projeto **novo**. Não misture tabelas do Radar antigo (`project/` Vite) com as migrations do VBSolution no mesmo schema `public` sem backup.

---

## 2. Copiar a connection string

No painel: **Project Settings → Database**.

Há dois tipos de URI:

| Tipo | Porta | Quando usar |
|---|---|---|
| **Direct** (Session) | `5432` | VPS e Railway (Sequelize, migrations, WhatsApp 24/7) — **recomendado** |
| **Transaction pooler** | `6543` | Serverless (muitas conexões curtas). Sequelize + migrate podem falhar aqui |

Copie **URI** do modo **Session / Direct**.

Formato:

```
postgresql://postgres.[PROJECT_REF]:SUA_SENHA@aws-0-sa-east-1.pooler.supabase.com:5432/postgres
```

ou host direto:

```
postgresql://postgres:SUA_SENHA@db.[PROJECT_REF].supabase.co:5432/postgres
```

Se a senha tiver `@`, `#`, `%`, encode na URL (`@` → `%40`).

Em **Database → Connection pooling**, anote também IPv4 se o host da VPS não tiver IPv6 (Supabase às vezes exige add-on IPv4).

---

## 3. Variáveis no `backend/.env`

```
NODE_ENV=production
DEV_NO_DB=false
DB_DIALECT=postgres
DB_SSL=true

DATABASE_URL=postgresql://postgres.[REF]:SENHA@HOST:5432/postgres

DB_HOST=db.XXXX.supabase.co
DB_PORT=5432
DB_USER=postgres
DB_PASS=SENHA
DB_NAME=postgres
DB_POOL_MAX=8
DB_POOL_MIN=0
```

Pode preencher **só** `DATABASE_URL` + `DB_SSL=true`; o bootstrap também deriva `DB_HOST` da URL.

JWT (obrigatório, valores novos):

```
JWT_SECRET=
JWT_REFRESH_SECRET=
```

Gere:

```bash
openssl rand -base64 32
```

Redis (Upstash, Redis Cloud, Railway Redis ou Redis na VPS):

```
REDIS_URI=redis://default:SENHA@HOST:6379
REDIS_URL=redis://default:SENHA@HOST:6379
REDIS_URI_ACK=redis://default:SENHA@HOST:6379
REDIS_HOST=HOST
REDIS_PORT=6379
REDIS_PASSWORD=SENHA
```

URLs públicas:

```
BACKEND_URL=https://api.seudominio.com
PUBLIC_BACKEND_URL=https://api.seudominio.com
FRONTEND_URL=https://crm.seudominio.com
```

---

## 4. Liberar rede (se o connect falhar)

**Project Settings → Database → Network bans / Restrictions.**

- Em desenvolvimento: pode permitir seu IP.
- Em produção: permita o IP da VPS ou deixe aberto se o plano não tiver restrição.

Erro comum: `ENETUNREACH` / timeout = IPv6. Use a URI **pooler IPv4** ou ative o add-on IPv4 do Supabase.

Erro `SSL`: confirme `DB_SSL=true`. O Sequelize deste CRM usa `rejectUnauthorized: false` quando SSL está ligado.

---

## 5. Instalar dependências e migrar

No computador ou no servidor, pasta `backend/`:

```bash
cd VBSOLUTIONCRMCodigoFonte-main/backend
npm install
npm run db:migrate
```

O `npm start` de produção também roda migrate (`prepare-and-migrate.js`).

Confira no Supabase: **Table Editor** — devem aparecer tabelas (`Users`, `Companies`, `Tickets`, `leads_sales`, `imoveis`, `realty_modulos`, etc.).

Crie o primeiro admin (scripts no `package.json` do backend), por exemplo:

```bash
npm run admin:local-dev
```

(ajuste e-mail/senha depois no painel **Usuários**.)

---

## 6. Storage e Auth do Supabase (opcional)

| Recurso Supabase | No VB Solution |
|---|---|
| Auth | **Não.** Login é JWT nas tabelas `Users` |
| Storage | **Opcional.** Mídias do WhatsApp vão para o disco da API; se quiser bucket, é extra |
| Realtime | **Não.** O CRM usa Socket.IO na API |
| Edge Functions | **Não** são usadas pelo painel |

Não coloque `VITE_SUPABASE_ANON_KEY` no frontend React do VB. A URL da API é `REACT_APP_BACKEND_URL`.

---

## 7. Testar a conexão

```bash
cd backend
npm run dev
```

Log esperado: `DB: usando DATABASE_URL` ou `DB: usando DB_HOST ...`.

Se aparecer `DEV_NO_DB` no log, a variável ainda está `true` — desligue.

Login no painel (`frontend`, porta 5181 em local) com o usuário criado no seed.

---

## 8. Backup

Supabase: **Database → Backups** (plano Pro) ou:

```bash
pg_dump "postgresql://postgres:SENHA@HOST:5432/postgres?sslmode=require" -F c -f vbsolution.dump
```

---

Próximos passos de hospedagem:

- [06-VPS.md](./06-VPS.md) — API na VPS, banco no Supabase
- [07-RAILWAY.md](./07-RAILWAY.md) — API no Railway, banco no Supabase (sem plugin Postgres)
- [15-VERCEL.md](./15-VERCEL.md) — **somente o frontend** na Vercel
