# Guia do cliente — instalar e publicar o CRM

Entrega: pasta **`VBSOLUTIONCRMCodigoFonte-main/`** (não precisa da pasta `project/`).

| Onde | O quê |
|---|---|
| **Supabase** | PostgreSQL (dados) |
| **Redis** | Filas (Railway Redis, Upstash ou VPS) |
| **Railway ou VPS** | API Node (WhatsApp, tickets, migrate) |
| **Vercel** | Painel React |

```
Usuário → Vercel (frontend)
        → Railway/VPS (backend :443)
        → Supabase Postgres
        → Redis
```

## Ordem recomendada

1. Criar projeto Supabase e pegar `DATABASE_URL` — [14-SUPABASE-PASSO-A-PASSO.md](./14-SUPABASE-PASSO-A-PASSO.md)
2. Redis (plugin Railway ou `docker run redis`)
3. Copiar `backend/.env.example` → `backend/.env` — [04-VARIAVEIS-DE-AMBIENTE.md](./04-VARIAVEIS-DE-AMBIENTE.md)
4. `DEV_NO_DB=false`, `DB_SSL=true`, JWT novos
5. Local (opcional): [02-INSTALACAO-LOCAL.md](./02-INSTALACAO-LOCAL.md) — `npm install` em `backend` e `frontend`, `npm run db:migrate`, `npm run dev` + `npm start`
6. Publicar API: [07-RAILWAY.md](./07-RAILWAY.md) **ou** [06-VPS.md](./06-VPS.md)
7. Publicar painel: [15-VERCEL.md](./15-VERCEL.md)
8. WhatsApp / Meta: [09-WHATSAPP-E-SERVICOS.md](./09-WHATSAPP-E-SERVICOS.md)
9. Checklist: [11-CHECKLIST.md](./11-CHECKLIST.md)

## Comandos mínimos (máquina local)

```bash
# Node 20
cd VBSOLUTIONCRMCodigoFonte-main/backend
copy .env.example .env
# edite DATABASE_URL, JWT, REDIS, FRONTEND_URL, DEV_NO_DB=false
npm install
npm run db:migrate

cd ../frontend
npm install
# frontend/.env.development → REACT_APP_BACKEND_URL=http://localhost:3000
npm start
```

Outro terminal: `cd backend && npm run dev`.

Painel: http://localhost:5181  
API: http://localhost:3000
