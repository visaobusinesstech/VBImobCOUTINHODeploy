# Supabase neste CRM — explicação completa para leigo

Muita gente ouve “Supabase” e pensa no site colorido com login mágico. **Neste projeto o Supabase é só o PostgreSQL na nuvem.** O login que você vê no CRM **não** é o Auth do Supabase.

O passo a passo de cliques (criar projeto, copiar senha, URI 5432, SSL) está em **[14-SUPABASE-PASSO-A-PASSO.md](./14-SUPABASE-PASSO-A-PASSO.md)**. Leia aquele arquivo **inteiro** quando for criar o banco. Este arquivo explica **por quê**, para você não misturar as coisas.

---

## O que o CRM antigo (pasta `project/`) fazia

O Radar Proptech em Vite falava **direto** com o Supabase no navegador: `VITE_SUPABASE_URL` e a chave `anon`. Tabelas, login e storage iam pelo cliente JS do Supabase.

## O que o VB Solution faz

1. O navegador só conhece `REACT_APP_BACKEND_URL`.
2. A API Express usa Sequelize.
3. Sequelize usa `DATABASE_URL` (Postgres).
4. Esse Postgres **pode** ser o do Supabase.

Ou seja: o Supabase vira um **Postgres hospedado**, igual um Postgres na VPS, só que outra empresa cuida de backup e disco.

## O que você NÃO deve fazer

- Não cole `VITE_SUPABASE_URL` no frontend deste CRM. Não existe Vite neste painel.
- Não ligue “Supabase Auth” e espere o login do VB Solution usar. Os usuários estão na tabela `Users` (nome pode variar) da API.
- Não use a URI do **pooler porta 6543** no `npm run db:migrate` se aparecer erro de prepared statement. Use **session / direct porta 5432**.
- Não deixe `DEV_NO_DB=true` com a URI do Supabase e ache que os dados estão no cofre. Com `true`, o sistema **finge** banco e não grava de verdade.

## Variáveis mínimas na API

```
DB_DIALECT=postgres
DATABASE_URL=postgresql://postgres.[REF]:SUA_SENHA@HOST:5432/postgres
DB_SSL=true
DEV_NO_DB=false
```

A senha da URI tem caracteres especiais (`@`, `#`)? Codifique na URL (`%40` para `@`) ou o Postgres “corta” a senha no meio.

## Depois de colar a URI

Na pasta `backend`:

```
npm run db:migrate
```

Abra o Supabase → Table Editor. Tem que aparecer dezenas de tabelas (Tickets, Users, Imoveis…). Se estiver vazio, o migrate não rodou neste projeto ou a URI é de **outro** projeto.

## RLS (Row Level Security)

O CRM **não** depende do RLS do Supabase para o painel, porque o browser não acessa o Postgres. A API usa usuário `postgres` (ou o que você colocou). Se você ligar RLS agressivo nas tabelas **e** a API usar um role restrito, as queries quebram. Deixe o padrão do migrate. Não “segure” as tabelas no painel do Supabase sem saber.

## Backup

Supabase Pro tem backup automático. No plano free, exporte quando for importante: [03-BANCO-DE-DADOS.md](./03-BANCO-DE-DADOS.md).

## Resumo em uma frase

**Supabase = endereço Postgres + SSL. Auth, WhatsApp e tickets = API Node.**
