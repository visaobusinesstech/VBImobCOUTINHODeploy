# Banco de dados PostgreSQL, explicado do zero

O CRM guarda tudo em tabelas: cada linha é um registro (um usuário, um ticket, um imóvel). Quem organiza isso é o **PostgreSQL**. O programa do CRM que fala com o Postgres se chama **Sequelize**. Você quase não vê o Sequelize; você só preenche o `.env` e roda o migrate.

## Passo 1 — Criar um banco vazio no seu PC (Windows)

1. Abra o **SQL Shell (psql)** que o instalador do Postgres colocou no Menu Iniciar, **ou** o pgAdmin.
2. No psql, ele pergunta servidor (`localhost`), database (`postgres`), port (`5432`), username (`postgres`), senha (a da instalação).
3. Quando aparecer `postgres=#`, digite (trocando a senha):

```sql
CREATE USER vbsolution WITH PASSWORD 'escolhaUmaSenhaForte';
CREATE DATABASE vbsolution OWNER vbsolution;
```

4. `\q` para sair.

No `.env`:

```
DB_HOST=localhost
DB_PORT=5432
DB_USER=vbsolution
DB_PASS=escolhaUmaSenhaForte
DB_NAME=vbsolution
DB_SSL=false
DEV_NO_DB=false
```

Local **sem** SSL. Nuvem **com** SSL.

## Passo 2 — DATABASE_URL (um único fio)

Em vez de cinco linhas, a nuvem gosta de um endereço só:

```
DATABASE_URL=postgresql://USUARIO:SENHA@HOST:5432/NOME_DO_BANCO
```

O `bootstrap` do backend lê isso e preenche `DB_HOST` se faltar. Na Railway o plugin Postgres já entrega `DATABASE_URL`. No Supabase você copia a URI ([14-SUPABASE-PASSO-A-PASSO.md](./14-SUPABASE-PASSO-A-PASSO.md)).

## Passo 3 — O que é “migrate”

Cada arquivo em `backend/src/database/migrations/` é uma receita: “crie a tabela X”, “adicione a coluna Y”.

Comando:

```powershell
cd backend
npm run db:migrate
```

Por baixo, isso chama o script `prepare-and-migrate.js`. Em produção, `npm start` **também** tenta migrar. Por isso o primeiro deploy pode demorar e **precisa** da URI certa.

Se você rodar migrate duas vezes, o sistema marca o que já rodou. Não duplica tabela. Se um migrate quebrar no meio, o próximo erro vai citar o nome do arquivo: aí precisa consertar o banco ou o arquivo (isso é hora de chamar quem conhece SQL).

## Passo 4 — Tabelas que o CRM imobiliário acrescentou

Além das tabelas clássicas (Users, Tickets, Messages…), este código cria, entre outras:

- proprietários, imóveis, contratos
- campos extras em leads (imóvel, follow-up, ticket)
- tabelas de RadarZAP / mercado / SEO
- `realty_modulos` (condomínios, LGPD operacional, etc.)

Você não cria isso na mão. O migrate cria.

## Passo 5 — Redis não é banco de dados de cadastro

Redis não substitui Postgres. É memória rápida para filas. Se o Redis cair, o cadastro de imóvel ainda está no Postgres; o que sofre é campanha e job.

## Passo 6 — Backup e restore (quando o sistema já tem dados reais)

Backup:

```bash
pg_dump -h HOST -U USUARIO -d vbsolution -F c -f crm.dump
```

Ele pede senha.

Restore num banco vazio:

```bash
pg_restore -h HOST -U USUARIO -d vbsolution crm.dump
```

No Supabase Pro, use também os backups automáticos do painel.

## Passo 7 — Segurança

- Nunca exponha a porta 5432 na internet aberta se o Postgres está na VPS. O firewall só 80/443. O banco escuta em localhost **ou** só aceita o IP da API.
- No Supabase, senha forte e restrição de IP se possível.
- `.env` fora do Git.

## Passo 8 — “Meu migrate aponta para o banco errado?”

Desligue `DEV_NO_DB`. Confira `DATABASE_URL` sem espaço. Reinicie o terminal. Rode `npm run db:migrate` de novo. No log do backend, leia `DB: usando ...`.
