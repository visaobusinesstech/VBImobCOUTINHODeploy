# O que você precisa ter antes de começar

Este capítulo é a “lista de compras”. Se faltar um item, o sistema reclama com mensagens em inglês. Não se assuste: quase sempre significa “falta instalar X” ou “a senha do banco está errada”.

## Passo 1 — Entenda os programas (sem tecniquês)

**Node.js** é o motor que faz o CRM rodar. Sem Node, os comandos `npm install` e `npm start` nem existem. Use a versão **20** (chamada LTS). Versão 18 ou 22 pode funcionar, mas o frontend pede 20.

**npm** vem junto com o Node. É o “instalador de peças” do projeto. Quando você entra na pasta `backend` e digita `npm install`, ele baixa milhares de arquivos para a pasta `node_modules`. Isso é normal e demora. Não feche a janela no meio.

**PostgreSQL** é o arquivo inteligente: usuários, tickets, imóveis, conversas. Pode estar no seu PC, no Supabase ou na Railway. O CRM **não** funciona de verdade em produção sem ele.

**Redis** é a fila. Sem Redis, campanhas e vários jobs não andam direito.

**Git** (opcional no começo) serve para baixar o código do GitHub. Se você já tem a pasta no computador, pode pular o Git no primeiro dia.

**Um navegador** atualizado (Chrome, Edge ou Firefox).

**Um editor de texto** para abrir `.env`. Bloco de Notas funciona; VS Code ou Cursor são mais confortáveis.

## Passo 2 — Instalar o Node.js 20 no Windows (bem devagar)

1. Abra o Google e busque **Node.js 20 LTS**.
2. Entre no site oficial https://nodejs.org
3. Baixe o instalador **Windows Installer (.msi)** da linha **20.x LTS** (não a “Latest” se ela for 22+, a não ser que você saiba o que está fazendo).
4. Execute o arquivo. Clique em Next, Next. Deixe marcado “Add to PATH” se aparecer.
5. Feche **todas** as janelas do Prompt de Comando / PowerShell que estavam abertas (elas não enxergam o Node novo).
6. Abra o PowerShell de novo: botão Iniciar, digite `PowerShell`, Enter.
7. Digite exatamente isto e aperte Enter:

```
node -v
```

Deve aparecer algo como `v20.11.1` (o número depois de 20 pode variar).

8. Digite:

```
npm -v
```

Deve aparecer um número (ex. `10.2.4`). Se disser que o comando não existe, o Node não entrou no PATH: reinstale marcando PATH ou reinicie o Windows.

## Passo 3 — Instalar o Node no Mac

1. O jeito mais simples para leigo: baixe o `.pkg` LTS 20 em https://nodejs.org e instale.
2. Abra o **Terminal** (Spotlight, digite Terminal).
3. Rode `node -v` e `npm -v` como no Windows.

Quem já usa Homebrew pode fazer `brew install node@20`, mas o instalador oficial basta.

## Passo 4 — Instalar o Node no Ubuntu (servidor ou PC Linux)

Abra o Terminal e cole **um bloco por vez**, esperando terminar:

```bash
sudo apt update
```

Ele pede a senha do computador. Enquanto você digita a senha, **não aparece asterisco**. Isso é normal. Digite e Enter.

Depois (Node 20 via NodeSource, que é o caminho mais previsível):

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

Se `curl` não existir: `sudo apt install -y curl`.

## Passo 5 — PostgreSQL: três caminhos, escolha um

**Caminho A — Supabase (recomendado para cliente)**  
Você não instala Postgres no PC. Cria um projeto na nuvem. Siga [14-SUPABASE-PASSO-A-PASSO.md](./14-SUPABASE-PASSO-A-PASSO.md) **depois** de conseguir abrir o Node. Para só “ver o CRM no PC hoje”, use o Caminho C.

**Caminho B — Postgres no seu Windows**  
1. Baixe o instalador em https://www.postgresql.org/download/windows/  
2. Instale. **Anote a senha do usuário `postgres`** que o instalador pedir. Sem essa senha você trava depois.  
3. A porta padrão é **5432**. Deixe assim.  
4. No fim, pode abrir o pgAdmin (programa visual). Não é obrigatório no primeiro dia.

**Caminho C — Modo demonstração sem banco (`DEV_NO_DB`)**  
O código aceita ligar o CRM **sem Postgres** só para olhar telas. Login típico: `admin@local.dev` e a senha do `.env`. **Isso não é produção.** WhatsApp de verdade, persistência e várias listas não ficam confiáveis. Use só para “será que o painel abre?”.

**Docker (opcional):** se você já tem Docker Desktop:

```bash
docker run -d --name vbs-pg -e POSTGRES_PASSWORD=senhaForte123 -e POSTGRES_USER=vbsolution -e POSTGRES_DB=vbsolution -p 5432:5432 postgres:16
```

Troque `senhaForte123` por uma senha sua.

## Passo 6 — Redis: três caminhos

**No Windows**, Redis oficial é chato. Opções de leigo:

- Instalar **Docker Desktop** e rodar:

```bash
docker run -d --name vbs-redis -p 6379:6379 redis:7
```

- Ou usar Redis na **Railway** / **Upstash** já na hora de publicar, e no PC usar `DEV_NO_DB` só para ver a tela.

**No Ubuntu:**

```bash
sudo apt install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server
```

Teste:

```bash
redis-cli ping
```

A resposta deve ser `PONG`.

## Passo 7 — Git (para puxar o código do GitHub)

Windows: https://git-scm.com/download/win — Next, Next, Finish.  
Abra um PowerShell **novo** e teste: `git --version`.

O código deste cliente está em:

https://github.com/visaobusinesstech/codigo-fonte-COUTINHO

Se você já recebeu a pasta ZIP, extraia para um lugar simples, por exemplo:

`C:\CRM\VBSOLUTIONCRMCodigoFonte-main`

Evite pastas com espaço demais ou OneDrive sincronizando no meio do `npm install` (às vezes corrompe download).

## Passo 8 — Contas na nuvem (quando for publicar, não no primeiro dia)

Anote e crie com calma, **quando** for ao ar:

1. Conta **Supabase** (banco) — gratuito para começar.
2. Conta **Railway** ou uma **VPS** Ubuntu (API).
3. Conta **Vercel** (painel).
4. Um **domínio** (opcional no começo; no início usamos os endereços `.up.railway.app` e `.vercel.app`).

## Passo 9 — O que “pronto para o passo seguinte” significa

Você está pronto para o [02-INSTALACAO-LOCAL.md](./02-INSTALACAO-LOCAL.md) quando:

- `node -v` mostra v20.algo
- `npm -v` mostra um número
- Você sabe **onde** está a pasta do código no disco
- Você decidiu: demo sem banco **ou** Postgres (local/Supabase)

Não avance para Railway/Vercel sem ter visto o painel abrir pelo menos uma vez no computador, se possível. Errar no PC é mais barato do que errar no servidor pago.
