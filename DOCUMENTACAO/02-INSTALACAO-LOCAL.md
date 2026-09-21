# Instalar e abrir o CRM no seu computador

Este é o tutorial “quero ver o sistema no Chrome hoje”. Faça na ordem. Se um comando der erro, **não pule**: copie a mensagem, leia a seção “Problemas comuns” no final.

Vamos usar o **PowerShell no Windows**. No Mac/Linux é o Terminal, e `copy` vira `cp`.

## Passo 1 — Abra a pasta certa

O código do produto está **dentro** de:

`...\VBSOLUTIONCRMCodigoFonte-main\VBSOLUTIONCRMCodigoFonte-main`

(Sim, o nome pode aparecer duas vezes se você baixou o ZIP. Confira: tem que existir as pastas `backend` e `frontend` **irmãs**, lado a lado.)

No PowerShell:

```powershell
cd C:\CAMINHO\ATE\VBSOLUTIONCRMCodigoFonte-main\VBSOLUTIONCRMCodigoFonte-main
dir
```

Você deve ver `backend` e `frontend`. Se não vir, `cd` para a pasta que as contém.

## Passo 2 — Arquivo de senhas do backend

O backend lê um arquivo escondido chamado `.env`. O Windows às vezes esconde arquivos que começam com ponto.

1. Entre na pasta backend:

```powershell
cd backend
dir -Force
```

2. Se **não** existir `.env`, copie o modelo:

```powershell
copy .env.example .env
```

Se o arquivo se chamar só `.env.example` e o copy falhar, abra a pasta no Explorer, copie `.env.example`, cole, e **renomeie** para `.env` (confirme a extensão; não deixe `.env.txt`).

3. Abra o `.env` no Bloco de Notas ou no Cursor.

## Passo 3 — Preencha o `.env` para o **primeiro teste** (demo sem banco)

Se você ainda **não** tem PostgreSQL, use o modo aula:

Procure as linhas (no final do arquivo costuma ter):

```
DEV_NO_DB=true
DEV_AUTH_EMAIL=admin@local.dev
DEV_AUTH_PASSWORD=123456
```

- `DEV_NO_DB=true` significa: “não fale com Postgres”.
- O e-mail e a senha são o login da tela. **Troque a senha** se outras pessoas usam o PC.

Deixe também (já costuma vir assim):

```
NODE_ENV=development
PORT=3000
BACKEND_URL=http://localhost:3000
PUBLIC_BACKEND_URL=http://localhost:3000
FRONTEND_URL=http://localhost:5181
```

`localhost` quer dizer “neste computador”. `3000` é a porta da API. `5181` é a porta do painel.

Salve o arquivo (Ctrl+S).

## Passo 4 — Preencha o `.env` para teste **com banco de verdade**

Se já tem Postgres ou Supabase, **não** use `DEV_NO_DB=true`. Coloque:

```
DEV_NO_DB=false
```

E as chaves do banco. Exemplo local:

```
DB_DIALECT=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASS=a_senha_que_voce_criou_na_instalacao
DB_NAME=vbsolution
DB_SSL=false
```

Você precisa **criar o banco** `vbsolution` antes (veja [03-BANCO-DE-DADOS.md](./03-BANCO-DE-DADOS.md)).

Supabase: copie `DATABASE_URL` e `DB_SSL=true` como no [14-SUPABASE-PASSO-A-PASSO.md](./14-SUPABASE-PASSO-A-PASSO.md).

JWT: duas linhas longas e **diferentes**. No Git Bash ou WSL:

```bash
openssl rand -base64 32
```

Rode duas vezes, cole uma em `JWT_SECRET=` e outra em `JWT_REFRESH_SECRET=`. No Windows sem openssl, invente duas frases longas aleatórias (mais de 32 caracteres), nunca `123456`.

Redis local (se tiver):

```
REDIS_URI=redis://127.0.0.1:6379
REDIS_URL=redis://127.0.0.1:6379
REDIS_URI_ACK=redis://127.0.0.1:6379
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
```

Se o Redis tiver senha, o formato é `redis://:SENHA@127.0.0.1:6379`.

## Passo 5 — Instalar as peças do backend

Ainda na pasta `backend`:

```powershell
npm install
```

Isso pode levar **10 a 25 minutos** na primeira vez. A tela enche de texto. Warnings amarelos (`deprecated`) são comuns. **Erro vermelho** que para o processo não é comum: aí sim leia o final da tela.

Quando voltar o prompt (`PS C:\...\backend>`), terminou.

## Passo 6 — Criar as tabelas (só se NÃO estiver em DEV_NO_DB)

```powershell
npm run db:migrate
```

Isso lê a pasta de migrations e cria tabelas no Postgres. Se der erro de senha, `DB_PASS` está errado. Se der `ECONNREFUSED 5432`, o Postgres não está ligado.

Crie um usuário admin se o script existir:

```powershell
npm run admin:local-dev
```

Anote o e-mail e senha que o script imprimir. Se o script não existir ou falhar, no modo `DEV_NO_DB` você já tem o login do passo 3.

## Passo 7 — Ligar a API e deixá-la aberta

Ainda em `backend`:

```powershell
npm run dev
```

Espere até aparecer algo como **Servidor iniciado na porta 3000**.  
**Não feche esta janela.** Ela é o cérebro. Se fechar, o painel fica mudo.

Na primeira vez o Node pode demorar vários minutos compilando. Tome um café. Se a janela “travar” sem erro, ainda pode estar compilando.

## Passo 8 — Arquivo do frontend

Abra **outro** PowerShell (deixe o primeiro rodando).

```powershell
cd C:\CAMINHO\ATE\VBSOLUTIONCRMCodigoFonte-main\VBSOLUTIONCRMCodigoFonte-main\frontend
dir -Force
```

Deve existir `.env.development`. Abra e confirme:

```
PORT=5181
REACT_APP_BACKEND_URL=http://localhost:3000
DISABLE_ESLINT_PLUGIN=true
```

`REACT_APP_BACKEND_URL` é “para onde o painel manda os cliques”. Tem que ser a mesma API do passo 7.

## Passo 9 — Instalar o frontend

```powershell
npm install
```

De novo: demora. Warnings de pacotes antigos (Material UI) são esperados.

## Passo 10 — Ligar o painel

```powershell
npm start
```

O Chrome pode abrir sozinho em http://localhost:5181  
Se não abrir, cole esse endereço na barra.

A primeira compilação também demora (webpack). Espere “Compiled” ou a página de login.

## Passo 11 — Entrar

- Demo: e-mail `admin@local.dev` e senha do `.env`.
- Com banco: usuário criado no seed.

Se a tela de login aparecer mas ao entrar der erro de rede, a API (passo 7) não está no ar ou a URL `REACT_APP_BACKEND_URL` está errada.

## Passo 12 — O que você deve ver

O menu agrupado: Atendimento, IA, Vendas, Imobiliário, etc. (veja [12-MENU.md](./12-MENU.md)). Clique em **Tickets**, **Leads e Vendas**, **Imóveis**, **Agente IA / Prompts**. Se a rota não existir, o manual e o código estão desalinhados — nesse caso o teste `npm run test:realty` no backend confere o menu.

## Problemas comuns (leia o seu caso)

**“npm não é reconhecido”**  
Node não instalado ou PowerShell antigo. Feche tudo, instale Node 20, abra PowerShell de novo.

**“Cannot find module”**  
`npm install` não terminou. Apague a pasta `node_modules` daquele lado (backend ou frontend) e rode `npm install` de novo.

**Porta 3000 em uso**  
Outro programa está na 3000. Feche-o ou mude `PORT=` no `.env` **e** `REACT_APP_BACKEND_URL` para a nova porta.

**Porta 5181 em uso**  
Mude `PORT=5181` no `.env.development` para `5182` e abra `http://localhost:5182`. Ajuste `FRONTEND_URL` no backend.

**Tela branca**  
Abra F12 no Chrome, aba Console. Se falar de `MainContainer`, um import estava errado (já corrigido no código atual). Confirme que você está na versão enviada ao GitHub.

**Disco cheio (`ENOSPC`)**  
O frontend recusa de compilar. Libere espaço (Lixeira, `frontend\node_modules\.cache`).

**Login demo não entra**  
`DEV_NO_DB` não está `true`, ou e-mail/senha diferentes do `.env`. Reinicie o `npm run dev` depois de salvar o `.env`.

**Demora infinita no `npm run dev`**  
Primeira compilação TypeScript deste backend é pesada. Se passar de 20–30 minutos sem “Servidor iniciado”, leia as últimas linhas do terminal: erro de Redis/Postgres costuma aparecer ali.

Quando o local funcionar, o próximo passo de verdade (cliente no ar) é o [16-GUIA-CLIENTE.md](./16-GUIA-CLIENTE.md).
