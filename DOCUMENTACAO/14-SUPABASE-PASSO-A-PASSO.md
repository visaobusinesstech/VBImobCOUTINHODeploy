# Como usar o Supabase como banco de dados do CRM

Este tutorial ensina a criar uma conta, criar um projeto, copiar a senha de conexão e ligar isso no VB Solution. Vamos bem devagar. Se uma tela do Supabase mudar de nome, procure a palavra **Database** ou **Settings**.

## O que o Supabase é neste projeto (importante)

O Supabase é famoso por “substituir um backend”. **Aqui não é o caso.**

Neste CRM o Supabase é só um **PostgreSQL hospedado**: um HD na nuvem organizado em tabelas. Quem autentica o usuário, quem fala com WhatsApp e quem monta o menu é a **API** (`backend`), não o painel Auth do Supabase.

Por isso você **não** vai colar `anon key` no frontend React. Quem cola `anon key` é o app Vite antigo (`project/`), que você pode até apagar.

---

## Passo 1 — Criar conta

1. Abra https://supabase.com
2. Clique em Start project / Sign in.
3. Entre com GitHub ou e-mail. Confirme o e-mail se pedirem.

## Passo 2 — Criar o projeto

1. Clique em **New project**.
2. Se pedir organização, crie uma com o nome da empresa (ex. Coutinho).
3. **Name:** algo claro, tipo `crm-coutinho`.
4. **Database password:** invente uma senha **forte** e grave no gerenciador de senhas **agora**. Se perder, você reseta, mas perde tempo.
5. **Region:** a mais perto dos usuários (Brasil / São Paulo se aparecer; senão East US ou South America).
6. Plano: Free serve para começar. Produção séria: Pro (backup).
7. Create project e **espere**. O status precisa ficar pronto (Healthy). Pode levar uns minutos. Não copie URI no meio do “Setting up”.

## Passo 3 — Achar a string de conexão

1. No menu esquerdo, ícone de engrenagem: **Project Settings**.
2. Clique em **Database**.
3. Role até **Connection string** / **URI**.

Você verá modos. Para este CRM escolha:

**Session mode** ou **Direct connection**, porta **5432**.

**Não** comece pelo Transaction pooler porta **6543**. Esse modo é para funções serverless. O Sequelize (a biblioteca que o backend usa) e o `migrate` brigam com ele (prepared statements). Se 5432 falhar por IPv6, aí sim tentamos o pooler em **session** na 5432, não a 6543.

A URI parece com:

```
postgresql://postgres.abcdefghijklmnop:SUA_SENHA@aws-0-sa-east-1.pooler.supabase.com:5432/postgres
```

ou:

```
postgresql://postgres:SUA_SENHA@db.abcdefghijklmnop.supabase.co:5432/postgres
```

O trecho `SUA_SENHA` deve ser a senha do passo 2. Se a senha tiver `@`, `#`, `%`, `/`, o endereço quebra. Troque esses caracteres na URL:

- `@` vira `%40`
- `#` vira `%23`
- `%` vira `%25`

Ou use uma senha só com letras e números.

Copie a URI para o Bloco de Notas. Não compartilhe no grupo da família.

## Passo 4 — Colar no backend

Abra `backend/.env`.

1. `DEV_NO_DB=false` (se estiver `true`, o CRM **finge** que não há banco e ignora o Supabase).
2. `DB_DIALECT=postgres`
3. `DB_SSL=true` (nuvem sempre com SSL).
4. `DATABASE_URL=` e cole a URI **sem aspas e sem espaço no começo**.

Você também pode preencher `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME=postgres`. Se `DATABASE_URL` estiver certo, o sistema costuma derivar o resto.

5. Salve.

## Passo 5 — Rede e firewall do Supabase

Em Settings → Database, veja se há **Network restrictions**.

- Para testar do seu PC: adicione seu IP (o próprio painel costuma mostrar “Add my IP”) ou, em projeto de estudo, deixe 0.0.0.0/0 (qualquer IP) **só se você aceitar o risco**. Em produção, libere o IP da VPS/Railway.
- Se o erro for timeout ou `ENETUNREACH`: seu provedor ou a Railway está tentando IPv6 e o Supabase Free às vezes só fala IPv6 bem. Soluções: add-on **IPv4** no Supabase, ou URI do pooler IPv4 que eles documentam na mesma tela.

## Passo 6 — Instalar e migrar

No PowerShell, pasta `backend`:

```powershell
npm install
npm run db:migrate
```

O migrate é o “pedreiro”: lê arquivos na pasta `backend/src/database/migrations` e constrói as tabelas.

**Sucesso:** volta ao prompt sem stack enorme de erro.

**Falha de senha:** `password authentication failed` — URI com senha errada ou caractere especial não codificado.

**Falha SSL:** coloque `DB_SSL=true`.

**Falha SSL com certificado:** este projeto usa `rejectUnauthorized: false` quando SSL está ligado, justamente para hosts gerenciados. Se mesmo assim falhar, a URI está incompleta.

## Passo 7 — Conferir no Table Editor

No Supabase, menu **Table Editor**. Você deve ver várias tabelas, entre elas coisas como Users, Companies, Tickets, Messages, leads_sales, imoveis, realty_modulos (os nomes exatos podem ter maiúsculas/minúsculas conforme o Sequelize).

Se estiver vazio depois de um migrate “sucesso”, você migrando **outro** banco (URI de outro projeto).

## Passo 8 — Primeiro usuário

Ainda em `backend`:

```powershell
npm run admin:local-dev
```

Leia o que o script imprimir. Guarde o login.

Reinicie `npm run dev` e entre no painel. Agora os dados **ficam** quando você cria um imóvel ou um lead.

## Passo 9 — Redis continua sendo outro serviço

Supabase **não** substitui Redis. Sem Redis em produção: campanhas e filas sofrem. Suba Redis na Railway ou na VPS.

## Passo 10 — Storage e Auth do Supabase

Pode ignorar **Authentication**, **Storage** e **Edge Functions** para o CRM funcionar. Fotos de WhatsApp o backend grava no disco do servidor (ou volume). Login é JWT na API.

Se um dia quiser jogar imagens no Storage, isso seria um desenvolvimento extra, não está neste manual de instalação.

## Passo 11 — Não misturar com o Radar antigo

Se você já tinha tabelas do Vite/Radar no mesmo projeto Supabase, **não rode o migrate em cima sem backup**. O certo: **projeto Supabase novo** só para o VB Solution. Dados antigos se exportam depois (CSV) com calma.

## Passo 12 — Backup

Plano Free: backup limitado. Exporte de vez em quando:

Instale cliente `psql`/`pg_dump` ou use o SQL Editor para dumps pontuais.

Exemplo (Git Bash), com SSL:

```bash
pg_dump "SUA_DATABASE_URL?sslmode=require" -F c -f backup-crm.dump
```

Guarde o arquivo fora do notebook da empresa.

Pronto. Banco na nuvem. Agora a API precisa apontar para essa mesma URI em produção ([07-RAILWAY.md](./07-RAILWAY.md) ou [06-VPS.md](./06-VPS.md)).
