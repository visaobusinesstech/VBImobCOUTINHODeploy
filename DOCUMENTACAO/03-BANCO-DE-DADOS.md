# Banco de dados (PostgreSQL)

O VB Solution **não usa Supabase como banco**. O Sequelize aponta para Postgres via `DB_*` ou `DATABASE_URL`.

## Conexão local

No `backend/.env`:

```
DB_DIALECT=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USER=vbsolution
DB_PASS=senha_forte
DB_NAME=vbsolution
DB_SSL=false
```

Ou URL única (Railway, Render, Neon, Supabase **Postgres**):

```
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DBNAME
```

Hosts gerenciados quase sempre exigem:

```
DB_SSL=true
```

## Migrations

Todas as tabelas (tickets, empresas, imóveis, `realty_modulos`, `ticketId` em leads, etc.) entram com:

```bash
cd backend
npm run db:migrate
```

Isso executa `scripts/prepare-and-migrate.js` (usado também no `npm start` de produção).

## Seed / primeiro admin

Depois do migrate, crie empresa e usuário (escolha o script que existir no `backend/package.json`):

```bash
npm run admin:local-dev
```

Guarde e-mail e senha gerados. Troque a senha no primeiro login.

## Backup

```bash
pg_dump -h HOST -U USER -d vbsolution -F c -f backup.dump
pg_restore -h HOST -U USER -d vbsolution backup.dump
```

## Tabelas do CRM imobiliário (além do CRM clássico)

Migrations em `backend/src/database/migrations/`:

- `proprietarios`, `imoveis`, `contratos`
- campos extra em `leads_sales` (imóvel, follow-up, `ticketId`)
- RadarZAP / mercado / SEO
- `realty_modulos` (condomínios, LGPD, automações, etc.)

## Redis

Não substitui o Postgres. É fila:

```
REDIS_URI=redis://default:SENHA@localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=SENHA
```

No Railway, use o plugin Redis e copie a URL interna para `REDIS_URI`, `REDIS_URL` e `REDIS_URI_ACK`.
