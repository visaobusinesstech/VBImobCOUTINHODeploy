# Supabase neste CRM

Guia curto. O passo a passo completo está em **[14-SUPABASE-PASSO-A-PASSO.md](./14-SUPABASE-PASSO-A-PASSO.md)**.

- O painel **não** usa `VITE_SUPABASE_URL` / anon key.
- Use o **Postgres do Supabase** via `DATABASE_URL` + `DB_SSL=true`.
- Auth, tickets e WhatsApp continuam na **API Express**.
- A pasta Vite `project/` (Radar antigo) é opcional e pode ser apagada.

Resumo da conexão:

```
DATABASE_URL=postgresql://postgres.[REF]:SENHA@HOST:5432/postgres
DB_SSL=true
DEV_NO_DB=false
```

Depois: `cd backend && npm run db:migrate`.
