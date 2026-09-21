# -*- coding: utf-8 -*-
"""Doc 01 · VPS + Railway + Banco · 50 páginas densas."""
from pdf_kit import (
    a, cover, why_how_impact, steps, code, callout, linkbox, checklist, table, write_doc, TOTAL
)

M = "VPS · Railway · Banco"


def bodies():
    b = []

    def add(k, t, html):
        b.append((M, k, t, html))

    add("Mapa", "Sumário · o que este manual resolve", f"""
    <p class="lead">Este material sobe a API do CRM em produção: banco, variáveis, Redis e o servidor (Railway ou VPS). O painel na Vercel fica no outro PDF.</p>
    {why_how_impact(
        "Deixar a API ligada 24h com dados reais e WhatsApp estável.",
        "Você escolhe Railway ou VPS, cola o .env, migra o Postgres e publica HTTPS.",
        "Sem isso o painel até abre, mas login, tickets e WhatsApp quebram em produção.",
    )}
    {table(["Bloco", "Páginas", "Resultado"], [
        ["Arquitetura e contas", "3–7", "Saber o que sobe onde"],
        ["PostgreSQL", "8–16", "Banco migrado e com backup"],
        ["Variáveis .env", "17–24", ".env de produção fechado"],
        ["Railway", "25–33", "API HTTPS na nuvem"],
        ["VPS Ubuntu", "34–43", "API na sua máquina virtual"],
        ["Checklist, prompts, FAQ", "44–50", "Go-live sem surpresa"],
    ])}
    {linkbox("Código-fonte", "https://github.com/visaobusinesstech/codigo-fonte-COUTINHO")}
    {callout("<strong>Como estudar</strong><br/>Faça o passo da página. Só avance quando o checklist do rodapé mental estiver ok.")}
    """)

    add("Peças", "As três peças do CRM em produção", f"""
    <p class="lead">Pense em três caixas. Cada uma mora em um lugar diferente.</p>
    {why_how_impact(
        "Separar painel, API e banco evita colocar WhatsApp na Vercel (que não aguenta processo 24h).",
        "Browser fala com a API. API grava no Postgres e usa Redis para filas.",
        "Errar o endereço de qualquer peça = CORS, login falso ou mensagem que não chega.",
    )}
    {table(["Peça", "Onde sobe", "O que acontece se cair"], [
        ["Painel React", "Vercel (outro PDF)", "Ninguém abre a tela"],
        ["API Node", "Railway ou VPS", "Login, WhatsApp e tickets param"],
        ["PostgreSQL", "Supabase / Railway / VPS", "Nada grava; migrate falha"],
        ["Redis", "Plugin / Upstash / VPS", "Fila e sessão WhatsApp travam"],
    ])}
    {steps([
        ("Anote no papel", "URL futura da API (ex. api.suaempresa.com ou *.up.railway.app) e URL do painel."),
        ("Escolha o caminho", "Receita rápida: Supabase + Redis Railway + API Railway + painel Vercel."),
        ("Não misture no dia 1", "Um banco por ambiente. Homolog e produção separados."),
    ])}
    {callout("<strong>Regra</strong><br/>Root Directory da API: <span class=\"inline-code\">VBSOLUTIONCRMCodigoFonte-main/backend</span>", "")}
    """)

    add("Fluxo", "Como uma requisição anda de ponta a ponta", f"""
    <p class="lead">Quando o corretor clica em Salvar no painel, isto acontece:</p>
    {steps([
        ("Chrome abre o painel", "O JS foi buildado na Vercel com REACT_APP_BACKEND_URL apontando para a API."),
        ("Browser chama a API", "HTTPS para Railway/VPS. Vai JWT no header se estiver logado."),
        ("API valida e grava", "Sequelize usa DATABASE_URL. Redis marca jobs se for fila."),
        ("Resposta volta", "JSON no painel. Se FRONTEND_URL estiver errado, o navegador bloqueia (CORS)."),
    ])}
    {why_how_impact(
        "Entender o fluxo para achar o elo quebrado.",
        "Quatro URLs precisam bater: REACT_APP_BACKEND_URL, BACKEND_URL, PUBLIC_BACKEND_URL, FRONTEND_URL.",
        "Um localhost esquecido no build = produção ainda falando com seu PC.",
    )}
    {callout("<strong>Teste rápido</strong><br/>No Chrome F12 → Network. A chamada deve ir para a API pública, nunca para localhost em produção.")}
    {checklist(["Sei qual é a URL da API", "Sei qual é a URL do painel", "Sei qual DATABASE_URL está ativa"])}
    """)

    add("Contas", "Contas e acessos que você precisa ter", f"""
    <p class="lead">Antes de clicar em Deploy, reúna os logins. Evita parar no meio.</p>
    {why_how_impact(
        "Cada serviço exige conta e, às vezes, cartão (Railway que não dorme).",
        "Você cria projeto, cola URI e gera domínio.",
        "Sem cartão no plano que dorme, a API apaga da memória e o WhatsApp cai.",
    )}
    {table(["Conta", "Para quê", "Link"], [
        ["GitHub", "Código e deploy", a("https://github.com")],
        ["Supabase", "Postgres recomendado", a("https://supabase.com")],
        ["Railway", "API + Redis", a("https://railway.app")],
        ["VPS (Hostgator etc.)", "Alternativa à Railway", "IP + SSH"],
        ["Vercel", "Painel (outro PDF)", a("https://vercel.com")],
    ])}
    {steps([
        ("Passo 1", f"Entre em {a('https://github.com/visaobusinesstech/codigo-fonte-COUTINHO')} e confirme que vê o repo (ou use o ZIP)."),
        ("Passo 2", "Crie/ Supabase e anote a senha do banco agora."),
        ("Passo 3", "Crie Railway com plano que não hiberna, ou tenha IP da VPS e senha root."),
        ("Passo 4", "Deixe a conta Vercel pronta para o PDF do frontend."),
    ])}
    {callout("<strong>Segurança</strong><br/>Senhas do banco e JWT não vão no grupo da família. Só no gerenciador de senhas e no .env.", "warn")}
    """)

    add("Pré", "Pré-requisitos no seu PC", f"""
    <p class="lead">Mesmo publicando na nuvem, você usa o PC para editar .env, rodar migrate e abrir SSH.</p>
    {why_how_impact(
        "Ter Node e um editor para não editar .env no escuro.",
        "Node 20 roda scripts locais; Git clona; terminal fala com a VPS.",
        "Node antigo quebra install. Pasta no OneDrive trava npm.",
    )}
    {steps([
        ("Passo 1 · Node 20", f"Instale LTS em {a('https://nodejs.org')}. Feche o PowerShell e abra de novo. Rode <span class=\"inline-code\">node -v</span>."),
        ("Passo 2 · Pasta limpa", "Use algo como C:\\CRM\\... Evite OneDrive no meio do npm install."),
        ("Passo 3 · Editor", "VS Code ou Cursor para editar .env com calma."),
        ("Passo 4 · Git (opcional)", f"Se for clonar: {a('https://git-scm.com')}."),
        ("Passo 5 · Confirme", "node -v = v20.x · npm -v responde · você sabe onde está a pasta backend."),
    ])}
    {checklist(["Node 20 ok", "Sei o caminho da pasta backend", "Tenho onde anotar URIs e senhas"])}
    """)

    add("Escolha", "Railway ou VPS: qual caminho seguir", f"""
    <p class="lead">Os dois sobem a mesma API. Muda quem administra o servidor.</p>
    {why_how_impact(
        "Escolher onde a API vai viver as próximas semanas.",
        "Railway: cliques + Variables. VPS: SSH, Nginx, PM2, Certbot.",
        "Trocar no meio do WhatsApp exige novo domínio e reconfigurar webhook Meta.",
    )}
    {table(["Cenário", "Escolha", "Por quê"], [
        ["Quer ir ao ar rápido", "Railway", "Menos Linux na frente"],
        ["Já tem VPS Ubuntu", "VPS", "Custo previsível, disco fixo"],
        ["Precisa de Volume Baileys", "Os dois", "Railway: Volume; VPS: pasta no disco"],
        ["Time sem SSH", "Railway", "Menos superfície de erro"],
    ])}
    {steps([
        ("Passo 1", "Marque no papel: Railway OU VPS (não os dois no mesmo dia)."),
        ("Passo 2", "Se Railway: siga páginas 25–33 depois do banco e .env."),
        ("Passo 3", "Se VPS: siga páginas 34–43."),
        ("Passo 4", "Banco e variáveis (8–24) servem para os dois."),
    ])}
    {callout("<strong>Dica</strong><br/>Cliente leigo + prazo curto = Railway. Compliance “dado na minha máquina” = VPS + Postgres local ou Supabase com IP liberado.")}
    """)

    # Postgres block 8-16
    add("Postgres", "PostgreSQL · para que serve no CRM", f"""
    <p class="lead">É o arquivo inteligente: usuários, tickets, mensagens, imóveis, contratos.</p>
    {why_how_impact(
        "Guardar tudo que o painel mostra depois do F5.",
        "A API fala com ele via Sequelize e DATABASE_URL (ou DB_*).",
        "URI errada = login some, migrate falha, Table Editor vazio.",
    )}
    {table(["Opção", "Quando usar", "Trabalho extra"], [
        ["Supabase", "Maioria dos clientes", "Criar projeto + URI 5432"],
        ["Postgres Railway", "Tudo num painel", "Não misturar com Supabase"],
        ["Postgres na VPS", "Dado no mesmo servidor", "Backup, firewall, updates"],
        ["Postgres no Windows", "Só estudo local", "Não é produção"],
    ])}
    {steps([
        ("Passo 1", "Decida: Supabase (recomendado) ou outra opção da tabela."),
        ("Passo 2", "Anote senha agora. Sem ela a URI não fecha."),
        ("Passo 3", "Lembre: porta do migrate é 5432 Session/Direct, não 6543."),
    ])}
    {linkbox("PostgreSQL", "https://www.postgresql.org")}
    {callout("<strong>Regra de ouro</strong><br/>Um ambiente = uma DATABASE_URL. Não aponte produção e homolog para o mesmo banco “só para testar migrate”.", "danger")}
    """)

    add("Local PG", "Criar Postgres local (estudo) · passo a passo", f"""
    <p class="lead">Útil para treinar migrate sem nuvem. Produção prefere Supabase.</p>
    {why_how_impact(
        "Ter um banco no PC para testar sem depender da internet.",
        "Você cria usuário/database e aponta DB_* no .env com DB_SSL=false.",
        "Se esquecer de mudar para a URI da nuvem no deploy, a API na Railway tenta localhost e morre.",
    )}
    {steps([
        ("Passo 1", f"Instale Postgres Windows em {a('https://www.postgresql.org/download/windows/')} ou use Docker."),
        ("Passo 2 · Docker", "docker run -d --name vbs-pg -e POSTGRES_PASSWORD=senhaForte123 -e POSTGRES_USER=vbsolution -e POSTGRES_DB=vbsolution -p 5432:5432 postgres:16"),
        ("Passo 3 · SQL", "CREATE USER vbsolution WITH PASSWORD 'escolhaUmaSenhaForte'; CREATE DATABASE vbsolution OWNER vbsolution;"),
        ("Passo 4 · .env", "DB_HOST=localhost · DB_PORT=5432 · DB_USER=vbsolution · DB_PASS=... · DB_NAME=vbsolution · DB_SSL=false · DEV_NO_DB=false"),
        ("Passo 5", "cd backend → npm run db:migrate e confira se não houve exception."),
    ])}
    {code("""DB_HOST=localhost
DB_PORT=5432
DB_USER=vbsolution
DB_PASS=escolhaUmaSenhaForte
DB_NAME=vbsolution
DB_SSL=false
DEV_NO_DB=false""")}
    {callout("<strong>Atenção</strong><br/>No deploy, troque isso pela DATABASE_URL da nuvem e DB_SSL=true.", "warn")}
    """)

    add("URI", "DATABASE_URL · montar e entender cada pedaço", f"""
    <p class="lead">A URI é um endereço completo: usuário, senha, host, porta e nome do banco.</p>
    {why_how_impact(
        "Uma linha só para a API achar o Postgres.",
        "O bootstrap lê DATABASE_URL e preenche DB_* se faltar.",
        "Senha com @ # % sem encode quebra no meio. Porta 6543 quebra o migrate.",
    )}
    {code("""postgresql://USUARIO:SENHA@HOST:5432/NOME_DO_BANCO

# Exemplos Supabase (session/direct 5432):
postgresql://postgres.xxxxx:SENHA@aws-0-sa-east-1.pooler.supabase.com:5432/postgres
postgresql://postgres:SENHA@db.xxxxx.supabase.co:5432/postgres""")}
    {steps([
        ("Passo 1", "No Supabase: Settings → Database → Connection string → Session ou Direct."),
        ("Passo 2", "Copie a URI para o Bloco de Notas. Troque [YOUR-PASSWORD] pela senha real."),
        ("Passo 3", "Se a senha tem @, vire %40; # vire %23; % vire %25."),
        ("Passo 4", "Confira se a porta no meio da URI é 5432."),
        ("Passo 5", "Cole em DATABASE_URL= no .env sem aspas e sem espaço no começo."),
    ])}
    {callout("<strong>Onde acarreta</strong><br/>Railway Variables, .env da VPS e migrate local usam a mesma lógica de URI.")}
    """)

    add("5432", "Por que evitar a porta 6543 no migrate", f"""
    <p class="lead">O pooler “transaction” na 6543 é para serverless. O Sequelize deste CRM briga com ele.</p>
    {why_how_impact(
        "Fazer migrate e runtime estáveis.",
        "Session/Direct 5432 mantém prepared statements do jeito que o ORM espera.",
        "Erro clássico: prepared statement already exists. Parece bug do código; é a porta.",
    )}
    {table(["Modo", "Porta", "Usar neste CRM?"], [
        ["Session / Direct", "5432", "Sim"],
        ["Transaction pooler", "6543", "Não no migrate"],
        ["Session pooler IPv4", "5432", "Sim, se IPv6 falhar"],
    ])}
    {steps([
        ("Passo 1", "Abra a URI no Bloco de Notas e procure :6543."),
        ("Passo 2", "Se achar, volte ao painel Supabase e pegue Session 5432."),
        ("Passo 3", "Rode de novo npm run db:migrate."),
        ("Passo 4", "Se der timeout/IPv6, use a URI IPv4 Session da mesma tela (ainda 5432)."),
    ])}
    {callout("<strong>Como funciona na prática</strong><br/>Você não “otimiza” começando na 6543. Primeiro estabiliza. Pool avançado é assunto depois.", "warn")}
    {checklist(["URI sem 6543", "DB_SSL=true na nuvem", "DEV_NO_DB=false"])}
    """)

    add("Migrate", "Rodar migrações · passo a passo completo", f"""
    <p class="lead">Migrate é o pedreiro: lê arquivos em backend/src/database/migrations e cria tabelas.</p>
    {why_how_impact(
        "Criar o esquema do CRM (Users, Tickets, Messages, imóveis...).",
        "npm run db:migrate aplica o que ainda não está na tabela SequelizeMeta.",
        "Pular migrate = Table Editor vazio e API reclamando de relação inexistente.",
    )}
    {steps([
        ("Passo 1", "Abra o PowerShell na pasta VBSOLUTIONCRMCodigoFonte-main/backend."),
        ("Passo 2", "Confira .env: DEV_NO_DB=false e DATABASE_URL (ou DB_*) corretos."),
        ("Passo 3", "Rode npm install (só na primeira vez ou após puxar código)."),
        ("Passo 4", "Rode npm run db:migrate e espere voltar ao prompt."),
        ("Passo 5", "Se houver admin:local-dev no package.json, rode para criar o admin."),
        ("Passo 6", "No Supabase Table Editor, confira se as tabelas apareceram."),
    ])}
    {code("""cd VBSOLUTIONCRMCodigoFonte-main/backend
npm install
npm run db:migrate
npm run admin:local-dev""")}
    {callout("<strong>Não faça</strong><br/>db:migrate:undo em produção sem backup. Desfaz estrutura e pode apagar caminho de dados.", "danger")}
    """)

    add("SSL Pool", "SSL, pool de conexões e Free do Supabase", f"""
    <p class="lead">Nuvem exige SSL. Free tem limite de conexões simultâneas.</p>
    {why_how_impact(
        "Conectar com segurança e sem estourar o plano.",
        "DB_SSL=true manda a API negociar TLS. DB_POOL_MAX limita sockets abertos.",
        "Sem SSL a nuvem recusa. Pool alto demais = too many connections.",
    )}
    {code("""DB_SSL=true
DB_POOL_MAX=8
DEV_NO_DB=false
DB_DIALECT=postgres""")}
    {steps([
        ("Passo 1", "Na nuvem, DB_SSL=true sempre."),
        ("Passo 2", "No Free, comece com DB_POOL_MAX=8 (não 50)."),
        ("Passo 3", "Se aparecer too many connections, baixe o pool e feche deploys duplicados."),
        ("Passo 4", "Local Windows com Postgres instalado: DB_SSL=false."),
    ])}
    {table(["Ambiente", "DB_SSL", "Pool sugerido"], [
        ["Supabase / Railway PG", "true", "8 no Free"],
        ["Postgres local", "false", "10–20"],
        ["Vários workers", "true", "Some os pools com cuidado"],
    ])}
    {callout("<strong>Onde acarreta</strong><br/>Mesmas variáveis na Railway Variables e no .env da VPS.")}
    """)

    add("Backup", "Backup e restore · quando e como", f"""
    <p class="lead">Backup é o cinto de segurança antes de migrate grande ou troca de senha.</p>
    {why_how_impact(
        "Conseguir voltar atrás se algo der errado.",
        "pg_dump gera arquivo; pg_restore recoloca.",
        "Sem backup, um undo ou projeto apagado vira prejuízo.",
    )}
    {steps([
        ("Passo 1", "Antes de mudança grande, rode o dump com sslmode=require na URI da nuvem."),
        ("Passo 2", "Guarde o arquivo fora do PC único (Drive/NAS com acesso restrito)."),
        ("Passo 3", "Teste restore em um projeto de homolog, não direto na produção."),
        ("Passo 4", "Combine com o cliente a frequência (diário/semanal)."),
    ])}
    {code("""pg_dump "SUA_DATABASE_URL?sslmode=require" -F c -f backup-crm.dump
pg_restore -d "SUA_DATABASE_URL?sslmode=require" backup-crm.dump""")}
    {callout("<strong>Free Supabase</strong><br/>Backup automático é limitado. Não dependa só dele.", "warn")}
    {checklist(["Sei onde está o último .dump", "URI de restore é a certa", "Cliente avisado do ritmo de backup"])}
    """)

    add("Rede DB", "Rede, firewall e IPv4 do banco", f"""
    <p class="lead">Às vezes a senha está certa e mesmo assim não conecta: IP ou IPv6.</p>
    {why_how_impact(
        "Deixar a API alcançar o Postgres.",
        "Supabase pode restringir IP; alguns ambientes preferem IPv4.",
        "Timeout e ENETUNREACH parecem “internet ruim”, mas é rede do banco.",
    )}
    {steps([
        ("Passo 1", "No Supabase: Settings → Database → Network restrictions."),
        ("Passo 2", "Estudo: Add my IP ou 0.0.0.0/0 aceitando o risco."),
        ("Passo 3", "Produção: IP da VPS ou ranges da Railway."),
        ("Passo 4", "Se der ENETUNREACH: URI pooler IPv4 Session 5432 ou add-on IPv4."),
        ("Passo 5", "Na VPS, não abra 5432 para o mundo se o Postgres for local. Só 80/443."),
    ])}
    {callout("<strong>Como funciona</strong><br/>A API na nuvem sai de um IP. Se o Supabase não conhece esse IP, a porta nem responde.")}
    {table(["Sintoma", "Olhar primeiro"], [
        ["timeout", "Network restrictions / IPv6"],
        ["password authentication failed", "Senha e encode"],
        ["ENOTFOUND", "Host da URI errado"],
    ])}
    """)

    add("Seg DB", "Segurança do banco no dia a dia", f"""
    <p class="lead">Quem tem a DATABASE_URL tem o banco. Trate como chave mestra.</p>
    {why_how_impact(
        "Evitar vazamento e acesso anônimo na porta 5432.",
        "URI só no .env/Variables; firewall fechado; senhas fortes.",
        "URI no GitHub público = banco exposto em minutos.",
    )}
    {steps([
        ("Passo 1", "Confirme que .env está no .gitignore."),
        ("Passo 2", "Nunca cole URI em print de WhatsApp do time."),
        ("Passo 3", "Se vazou, troque a senha no Supabase e atualize todos os .env."),
        ("Passo 4", "Restrinja IP depois do go-live."),
        ("Passo 5", "JWT_SECRET diferentes de qualquer exemplo deste PDF."),
    ])}
    {checklist([".env fora do Git", "Senha forte anotada no cofre", "IP restrito em produção", "Homolog ≠ produção"])}
    {callout("<strong>Onde acarreta</strong><br/>Vazou URI = precisa rotacionar senha + redeploy API + avisar quem tinha o valor antigo.", "danger")}
    """)

    # Env 17-24
    add("Dois mundos", "Dois mundos de variáveis: backend e frontend", f"""
    <p class="lead">O painel não lê o .env da API. São arquivos e painéis diferentes.</p>
    {why_how_impact(
        "Cada lado recebe só o que precisa.",
        "Backend: DB, JWT, Redis, Meta. Frontend: só REACT_APP_*.",
        "Colocar JWT na Vercel não ajuda e ainda arrisca vazamento no browser.",
    )}
    {table(["Onde", "Arquivo / painel", "Exemplos"], [
        ["API", "backend/.env ou Railway Variables", "DATABASE_URL, JWT, REDIS_*"],
        ["Painel", "Vercel Environment Variables", "REACT_APP_BACKEND_URL"],
        ["Build local FE", ".env / .env.production", "REACT_APP_* embutido no build"],
    ])}
    {steps([
        ("Passo 1", "cd backend → copy .env.example .env"),
        ("Passo 2", "Preencha grupos nas próximas páginas."),
        ("Passo 3", "Frontend fica para o PDF Vercel (REACT_APP_BACKEND_URL)."),
        ("Passo 4", "Mudou .env? Reinicie npm run dev, pm2 restart ou Redeploy."),
    ])}
    {callout("<strong>Como funciona</strong><br/>Create React App grava REACT_APP_* dentro do JS no build. Mudar na Vercel sem Redeploy não altera o pacote antigo.")}
    """)

    add("URLs", "Grupo servidor · PORT e URLs públicas", f"""
    <p class="lead">Essas variáveis dizem à API quem ela é e quem pode chamá-la.</p>
    {why_how_impact(
        "HTTPS certo para webhook Meta, Socket e CORS.",
        "BACKEND_URL/PUBLIC_BACKEND_URL = endereço público da API. FRONTEND_URL = origem do painel.",
        "Barra no final ou http vs https diferente = CORS e webhook falhando.",
    )}
    {table(["Variável", "Local", "Produção"], [
        ["NODE_ENV", "development", "production"],
        ["PORT", "3000", "Railway injeta; VPS 3000 atrás do Nginx"],
        ["BACKEND_URL", "http://localhost:3000", "https://api... sem / final"],
        ["PUBLIC_BACKEND_URL", "igual", "igual (Meta/webhook)"],
        ["FRONTEND_URL", "http://localhost:5181", "URL exata Vercel sem /"],
        ["WEB_ORIGIN", "opcional", "mesmo FRONTEND_URL se CORS persistir"],
    ])}
    {steps([
        ("Passo 1", "Defina as três URLs sem barra no final."),
        ("Passo 2", "Copie a URL exatamente como o Chrome mostra (https)."),
        ("Passo 3", "Depois do domínio Vercel, volte e atualize FRONTEND_URL + redeploy API."),
    ])}
    {code("""NODE_ENV=production
PORT=3000
BACKEND_URL=https://SEU-SERVICO.up.railway.app
PUBLIC_BACKEND_URL=https://SEU-SERVICO.up.railway.app
FRONTEND_URL=https://SEU-APP.vercel.app""")}
    """)

    add("Env DB", "Grupo banco no .env · linha a linha", f"""
    <p class="lead">Além da URI, o projeto aceita DB_* soltos. Em nuvem a URI basta se estiver completa.</p>
    {why_how_impact(
        "Conectar o ORM ao Postgres certo.",
        "DATABASE_URL tem prioridade na prática; DB_* ajudam local.",
        "DEV_NO_DB=true em produção finge banco: nada grava de verdade.",
    )}
    {steps([
        ("Passo 1", "DEV_NO_DB=false (produção e nuvem)."),
        ("Passo 2", "DB_DIALECT=postgres"),
        ("Passo 3", "DB_SSL=true na nuvem; false só no Postgres local."),
        ("Passo 4", "Cole DATABASE_URL 5432."),
        ("Passo 5", "Opcional: DB_HOST, DB_PORT, DB_USER, DB_PASS, DB_NAME=postgres."),
        ("Passo 6", "DB_POOL_MAX=8 no Free."),
    ])}
    {code("""DEV_NO_DB=false
DB_DIALECT=postgres
DB_SSL=true
DATABASE_URL=postgresql://...:5432/postgres
DB_POOL_MAX=8""")}
    {callout("<strong>Onde acarreta</strong><br/>Esquecer DEV_NO_DB=false é o erro mais caro: parece que “funciona”, mas o Supabase fica vazio.", "danger")}
    """)

    add("JWT", "Grupo JWT · gerar e não reutilizar exemplo", f"""
    <p class="lead">JWT assina o login. Se vazar ou mudar, o efeito é imediato.</p>
    {why_how_impact(
        "Provar que o usuário está logado sem guardar senha a cada request.",
        "API assina token com JWT_SECRET e refresh com JWT_REFRESH_SECRET.",
        "Trocar em produção = todos deslogados. Reutilizar exemplo do PDF = risco.",
    )}
    {steps([
        ("Passo 1", "No terminal: openssl rand -base64 32"),
        ("Passo 2", "Rode de novo para o segundo segredo."),
        ("Passo 3", "Cole em JWT_SECRET e JWT_REFRESH_SECRET (valores diferentes)."),
        ("Passo 4", "Nunca commite esses valores."),
        ("Passo 5", "Se alguém viu o .env, gere de novo e avise o time para logar outra vez."),
    ])}
    {code("""openssl rand -base64 32
openssl rand -base64 32

JWT_SECRET=cole-o-primeiro
JWT_REFRESH_SECRET=cole-o-segundo""")}
    {callout("<strong>Como funciona</strong><br/>O browser guarda o token. A API confere a assinatura. Segredo fraco = token forjável.")}
    """)

    add("Redis env", "Grupo Redis · três nomes, uma URL no início", f"""
    <p class="lead">Redis é o caderno rápido de filas e sessão. Em produção não é opcional se houver WhatsApp/campanha.</p>
    {why_how_impact(
        "Filas Bull, ACK e partes da sessão não morrerem a cada request.",
        "O código lê REDIS_URI, REDIS_URL e REDIS_URI_ACK. No começo as três iguais.",
        "localhost na Railway = ECONNREFUSED. Login abre, campanha trava.",
    )}
    {steps([
        ("Passo 1 · local", "Docker: docker run -d -p 6379:6379 --name redis redis:7"),
        ("Passo 2", "REDIS_*=redis://127.0.0.1:6379 nas três."),
        ("Passo 3 · Railway", "Crie plugin Redis e copie a URL (nunca localhost)."),
        ("Passo 4", "Preencha as três variáveis com a mesma URL ou ${{Redis.REDIS_URL}} se o serviço se chamar Redis."),
        ("Passo 5", "Upstash: rediss://... (com TLS)."),
        ("Passo 6", "Reinicie a API e teste redis-cli ping → PONG quando for VPS/local."),
    ])}
    {code("""REDIS_URI=redis://default:senha@host:port
REDIS_URL=redis://default:senha@host:port
REDIS_URI_ACK=redis://default:senha@host:port""")}
    {linkbox("Railway", "https://railway.app")}
    """)

    add("Opcional", "Grupos opcionais · Meta, Stripe, IA, OAuth", f"""
    <p class="lead">No dia 1 podem ficar vazios. Saiba para que existem para não colar no lugar errado.</p>
    {why_how_impact(
        "Ligar WhatsApp Oficial, pagamento e login social quando chegar a hora.",
        "Variáveis no backend; algumas REACT_APP_* no build do painel.",
        "Webhook Stripe/Meta na API. Segredo Stripe na Vercel = erro grave.",
    )}
    {table(["Grupo", "Exemplos", "Quando preencher"], [
        ["Meta / WA", "VERIFY_TOKEN, FACEBOOK_APP_*, TOKEN_API_OFICIAL", "PDF WhatsApp"],
        ["Stripe", "STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET", "Pagamentos"],
        ["IA", "OPENAI_*, ANTHROPIC_API_KEY", "Ou chave no painel por empresa"],
        ["OAuth", "GOOGLE_OAUTH_*, GITHUB_OAUTH_*", "Login social"],
    ])}
    {steps([
        ("Passo 1", "Abra backend/.env.example e localize os blocos."),
        ("Passo 2", "Deixe em branco o que não for usar agora."),
        ("Passo 3", "Quando for Meta, siga o PDF WhatsApp (VERIFY_TOKEN igual no painel Meta)."),
        ("Passo 4", "Stripe webhook → URL da API HTTPS, não Vercel."),
    ])}
    {callout("<strong>Onde acarreta</strong><br/>Preencher Meta sem HTTPS público = webhook nunca verifica.")}
    """)

    add("Check env", "Checklist .env de produção · feche antes do deploy", f"""
    <p class="lead">Imprima mentalmente esta lista. Se faltar um item, o deploy vai mentir que “subiu”.</p>
    {why_how_impact(
        "Evitar redeploy em loop por variável esquecida.",
        "Você confere grupo a grupo e só então Generate Domain / PM2.",
        "Item marcado errado = sintoma em outra página (CORS, migrate, Redis).",
    )}
    {checklist([
        "DEV_NO_DB=false",
        "NODE_ENV=production",
        "DATABASE_URL 5432 ou DB_* ok",
        "DB_SSL=true na nuvem",
        "JWT_SECRET e JWT_REFRESH_SECRET longos e diferentes",
        "REDIS_URI, REDIS_URL, REDIS_URI_ACK preenchidas",
        "BACKEND_URL e PUBLIC_BACKEND_URL HTTPS sem / final",
        "FRONTEND_URL = origem real do painel",
        "Frontend buildado com o mesmo REACT_APP_BACKEND_URL",
        ".env fora do Git",
    ])}
    {steps([
        ("Passo 1", "Abra o .env e marque cada item acima."),
        ("Passo 2", "Peça para outra pessoa revisar URLs (olho fresco)."),
        ("Passo 3", "Só então vá ao deploy Railway ou VPS."),
    ])}
    {callout("<strong>Como funciona</strong><br/>A API lê o ambiente na subida. Variável errada só muda depois de reiniciar.")}
    """)

    # Railway 25-33
    add("Railway start", "Railway · criar conta e projeto", f"""
    <p class="lead">Railway hospeda a API e o Redis com pouco Linux na frente.</p>
    {why_how_impact(
        "API pública HTTPS sem montar Nginx do zero.",
        "Conecta no GitHub, builda o backend e injeta Variables.",
        "Plano que dorme = WhatsApp morre quando ninguém acessa.",
    )}
    {steps([
        ("Passo 1", f"Abra {a('https://railway.app')} e entre com GitHub."),
        ("Passo 2", "Escolha plano que não hiberna (cartão pode ser exigido)."),
        ("Passo 3", "New Project → Deploy from GitHub → repo codigo-fonte-COUTINHO."),
        ("Passo 4", "Se o repo não aparece, autorize a organização no GitHub."),
        ("Passo 5", "Não configure o Root Directory ainda: primeiro Redis (próxima página)."),
    ])}
    {linkbox("Railway", "https://railway.app")}
    {callout("<strong>Onde acarreta</strong><br/>Sem GitHub autorizado o botão de deploy nem lista o repositório.", "warn")}
    {checklist(["Login Railway ok", "Repo visível", "Plano sem sleep combinado com o cliente"])}
    """)

    add("Railway Redis", "Railway · criar Redis primeiro", f"""
    <p class="lead">Crie o Redis antes da API para já ter URL na hora das Variables.</p>
    {why_how_impact(
        "Filas e sessão com endereço real na nuvem.",
        "Plugin Redis gera REDIS_URL. A API referencia essa URL.",
        "Subir API com localhost = erro 6379 nos logs.",
    )}
    {steps([
        ("Passo 1", "No projeto: New → Database → Redis."),
        ("Passo 2", "Espere o status Healthy."),
        ("Passo 3", "Abra a variável REDIS_URL e copie (ou prepare a referência ${{Redis.REDIS_URL}})."),
        ("Passo 4", "Anote o nome do serviço. Se não for Redis, a referência ${{Redis...}} não resolve."),
        ("Passo 5", "Não apague o plugin depois do go-live."),
    ])}
    {callout("<strong>Como funciona</strong><br/>${{Redis.REDIS_URL}} só funciona se o serviço se chamar exatamente Redis. Senão cole a URL na mão.")}
    {table(["Errado", "Certo"], [
        ["redis://127.0.0.1:6379 na Railway", "URL do plugin"],
        ["Só uma variável Redis", "As três iguais"],
    ])}
    """)

    add("Railway API", "Railway · serviço da API e Root Directory", f"""
    <p class="lead">O build precisa apontar para a pasta onde está o package.json do backend.</p>
    {why_how_impact(
        "Instalar e compilar só a API.",
        "Root Directory isola o monorepo. Build e Start rodam ali.",
        "Root na raiz do repo = não acha package.json certo ou builda coisa errada.",
    )}
    {steps([
        ("Passo 1", "Adicione serviço a partir do mesmo repo (se ainda não tiver)."),
        ("Passo 2", "Settings → Root Directory: VBSOLUTIONCRMCodigoFonte-main/backend"),
        ("Passo 3", "Build Command: npm install && npm run build"),
        ("Passo 4", "Start Command: npm start"),
        ("Passo 5", "Watch Paths (opcional): VBSOLUTIONCRMCodigoFonte-main/backend/**"),
        ("Passo 6", "Ainda não espere verde total: falta Variables (próxima página)."),
    ])}
    {code("""Root Directory: VBSOLUTIONCRMCodigoFonte-main/backend
Build: npm install && npm run build
Start: npm start""")}
    {callout("<strong>Onde acarreta</strong><br/>Root errado gera Cannot find package.json ou sobe pasta vazia.")}
    """)

    add("Railway vars", "Railway · Variables completas da API", f"""
    <p class="lead">Cole o pacote mínimo. Sem isso o container sobe e cai no boot.</p>
    {why_how_impact(
        "Mesmo .env de produção, só que no painel Railway.",
        "Variables viram process.env no Node.",
        "Faltou JWT ou DATABASE_URL = crash loop nos logs.",
    )}
    {steps([
        ("Passo 1", "Abra Variables do serviço da API."),
        ("Passo 2", "Cole o bloco abaixo adaptado."),
        ("Passo 3", "Use URI Supabase 5432 com senha já encodada."),
        ("Passo 4", "Ligue as três Redis."),
        ("Passo 5", "Salve e deixe o redeploy acontecer."),
    ])}
    {code("""NODE_ENV=production
DEV_NO_DB=false
DB_DIALECT=postgres
DB_SSL=true
DATABASE_URL=cole_uri_5432_supabase
JWT_SECRET=...
JWT_REFRESH_SECRET=...
REDIS_URI=${{Redis.REDIS_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
REDIS_URI_ACK=${{Redis.REDIS_URL}}
DB_POOL_MAX=8""")}
    {callout("<strong>Ainda faltam URLs públicas</strong><br/>Depois do Generate Domain você preenche BACKEND_URL, PUBLIC_BACKEND_URL e FRONTEND_URL.")}
    """)

    add("Railway domínio", "Generate Domain e alinhar URLs", f"""
    <p class="lead">Sem domínio público não há webhook Meta nem painel falando com a API.</p>
    {why_how_impact(
        "Entregar HTTPS estável do tipo *.up.railway.app.",
        "Networking → Generate Domain cria a URL. Você cola nas Variables.",
        "Esquecer de atualizar FRONTEND_URL depois da Vercel = CORS.",
    )}
    {steps([
        ("Passo 1", "Settings → Networking → Generate Domain."),
        ("Passo 2", "Copie https://SEU-SERVICO.up.railway.app sem barra final."),
        ("Passo 3", "Variables: BACKEND_URL e PUBLIC_BACKEND_URL = essa URL."),
        ("Passo 4", "FRONTEND_URL = URL da Vercel (quando existir). Provisório: deixe e atualize depois."),
        ("Passo 5", "Redeploy se as Variables não aplicaram sozinhas."),
        ("Passo 6", "No PDF Vercel, REACT_APP_BACKEND_URL = domínio Railway."),
    ])}
    {code("""BACKEND_URL=https://SEU-SERVICO.up.railway.app
PUBLIC_BACKEND_URL=https://SEU-SERVICO.up.railway.app
FRONTEND_URL=https://SEU-FRONTEND.vercel.app""")}
    {checklist(["Domínio gerado", "URLs sem / final", "HTTPS mesmo no Bloco de Notas"])}
    """)

    add("Railway logs", "Ler logs Railway · o que é sucesso", f"""
    <p class="lead">Logs contam a história: install → build → migrate → servidor iniciado.</p>
    {why_how_impact(
        "Saber se a API está viva de verdade.",
        "Deploy escreve stdout. Erro de senha/Redis aparece ali.",
        "Ignorar log vermelho = achar que “está no ar” com processo morto.",
    )}
    {steps([
        ("Passo 1", "Abra a aba Deployments / Logs do serviço API."),
        ("Passo 2", "Confira npm install sem ENOENT de pasta."),
        ("Passo 3", "Confira tsc/build ok."),
        ("Passo 4", "Confira migrate sem password authentication failed."),
        ("Passo 5", "Procure frase de servidor iniciado / listening."),
        ("Passo 6", "Se reinicia em loop, leia as 30 linhas antes do exit."),
    ])}
    {table(["Sintoma no log", "Causa"], [
        ["password authentication failed", "DATABASE_URL"],
        ["ENOTFOUND / timeout", "IPv6 / host"],
        ["prepared statement", "porta 6543"],
        ["ECONNREFUSED 6379", "Redis localhost"],
        ["DEV_NO_DB", "esqueceu false"],
    ])}
    {callout("<strong>Como funciona</strong><br/>Cada push ou Variable change gera um deploy. O anterior morre.")}
    """)

    add("Railway volume", "Volume Baileys e disco efêmero", f"""
    <p class="lead">Redeploy apaga arquivos locais do container. Sessão WhatsApp QR some sem Volume.</p>
    {why_how_impact(
        "Manter QR/Baileys conectado entre deploys.",
        "Volume monta pasta persistente no caminho da sessão.",
        "Sem Volume: todo deploy pede QR de novo.",
    )}
    {steps([
        ("Passo 1", "Decida se vai usar Baileys (QR). Se só Cloud API, Volume é menos crítico."),
        ("Passo 2", "Crie Volume no serviço API."),
        ("Passo 3", "Monte no caminho que o código usa (public / pasta de sessão do projeto)."),
        ("Passo 4", "Redeploy e reconecte o QR uma última vez."),
        ("Passo 5", "Teste um redeploy de Variable inocente e veja se continua Connected."),
    ])}
    {callout("<strong>Onde acarreta</strong><br/>Cliente reclama que “todo dia pede QR” → quase sempre disco efêmero.", "warn")}
    {checklist(["Sei se uso Baileys", "Volume criado ou migrei para Oficial", "Backup da sessão se VPS"])}
    """)

    add("Railway erros", "Erros comuns Railway · correção objetiva", f"""
    <p class="lead">Antes de “reinstalar tudo”, case o sintoma com a linha certa.</p>
    {why_how_impact(
        "Encurtar troubleshooting.",
        "Logs + Variables + URI.",
        "Ação errada (apagar projeto) perde domínio e webhook.",
    )}
    {table(["Sintoma", "Causa", "Correção"], [
        ["password authentication failed", "URI/senha", "Reabrir URI 5432 + encode"],
        ["ENOTFOUND / timeout", "rede/IPv6", "URI IPv4 Session"],
        ["prepared statement", "6543", "trocar para 5432"],
        ["ECONNREFUSED 6379", "Redis local", "URL do plugin"],
        ["OOM", "plano pequeno", "plano maior ou pool 5"],
        ["sleep / app parada", "plano free sleep", "plano sem hibernar"],
    ])}
    {steps([
        ("Passo 1", "Copie 20 linhas do log."),
        ("Passo 2", "Ache a linha na tabela."),
        ("Passo 3", "Mude só aquela Variable."),
        ("Passo 4", "Espere o deploy e reteste login."),
    ])}
    {callout("<strong>Não faça</strong><br/>Criar segundo Postgres “para ver” e deixar duas URIs pela metade.")}
    """)

    add("Railway CLI", "CLI Railway opcional", f"""
    <p class="lead">Quem prefere terminal pode linkar a pasta backend.</p>
    {why_how_impact(
        "Deploy e logs sem só clicar no painel.",
        "railway link associa o diretório ao serviço.",
        "Link na pasta errada sobe contexto errado.",
    )}
    {steps([
        ("Passo 1", "npm i -g @railway/cli"),
        ("Passo 2", "railway login"),
        ("Passo 3", "cd VBSOLUTIONCRMCodigoFonte-main/backend"),
        ("Passo 4", "railway link e escolha o serviço API"),
        ("Passo 5", "railway up ou use o GitHub deploy como fluxo principal"),
        ("Passo 6", "railway logs para acompanhar"),
    ])}
    {code("""npm i -g @railway/cli
railway login
cd VBSOLUTIONCRMCodigoFonte-main/backend
railway link
railway logs""")}
    {linkbox("Docs Railway", "https://docs.railway.app")}
    {callout("<strong>Como funciona</strong><br/>O fluxo GitHub continua válido. CLI é atalho, não obrigação.")}
    """)

    # Fix typo in the lead above - I have an extra quote. Let me fix when I notice - "Quem prefere terminal pode linkar a pasta backend.",</p> has a stray quote. I'll fix in a patch later.

    # VPS 34-43
    add("VPS specs", "VPS Ubuntu · o que contratar e por quê", f"""
    <p class="lead">VPS é um Linux seu. Você instala Node, Redis, Nginx e PM2.</p>
    {why_how_impact(
        "API 24h com disco persistente e custo previsível.",
        "SSH + apt + PM2 + Nginx + Certbot.",
        "Sem PM2 startup, reboot do host derruba WhatsApp.",
    )}
    {table(["Item", "Sugestão", "Por quê"], [
        ["CPU/RAM", "2 vCPU · 4 GB+", "Node + Redis + folga"],
        ["Disco", "40 GB+", "logs, mídia, sessão"],
        ["SO", "Ubuntu 22.04 LTS", "Comandos deste manual"],
        ["Domínio", "api.suaempresa.com", "SSL e webhook"],
    ])}
    {steps([
        ("Passo 1", "Contrate Ubuntu 22.04 e anote IP, usuário e senha/SSH key."),
        ("Passo 2", "Crie o DNS A de api.suaempresa.com → IP (pode propagar)."),
        ("Passo 3", "Tenha a DATABASE_URL Supabase pronta (ou aceite Postgres na VPS)."),
        ("Passo 4", "Abra um terminal SSH de teste: ssh root@IP"),
    ])}
    {callout("<strong>Onde acarreta</strong><br/>DNS errado = Certbot falha. IP sem SSH = nada anda.")}
    """)

    add("VPS pacotes", "Instalar Node 20, Nginx, Redis, Certbot, PM2", f"""
    <p class="lead">Um bloco de pacotes e você já tem a base do servidor.</p>
    {why_how_impact(
        "Ferramentas mínimas para rodar a API com HTTPS.",
        "Nodesource instala Node 20; apt traz Nginx/Redis/Certbot; npm -g pm2.",
        "Node 12/14 do Ubuntu antigo quebra dependências do CRM.",
    )}
    {steps([
        ("Passo 1", "ssh root@IP_DA_VPS"),
        ("Passo 2", "sudo apt update && sudo apt upgrade -y"),
        ("Passo 3", "Instale Node 20 via NodeSource e confira node -v"),
        ("Passo 4", "sudo apt install -y nginx redis-server git certbot python3-certbot-nginx"),
        ("Passo 5", "sudo npm install -g pm2"),
        ("Passo 6", "systemctl enable/start redis-server · redis-cli ping → PONG"),
    ])}
    {code("""curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs nginx redis-server git certbot python3-certbot-nginx
sudo npm install -g pm2
sudo systemctl enable redis-server
sudo systemctl start redis-server
redis-cli ping""")}
    {callout("<strong>Postgres na VPS</strong><br/>Só se não usar Supabase: sudo apt install -y postgresql. Senão pule.", "warn")}
    """)

    add("VPS código", "Clonar código e criar .env na VPS", f"""
    <p class="lead">O código mora em /var/www/vbsolution. O segredo mora no .env.</p>
    {why_how_impact(
        "Ter a API versionada e configurada no servidor.",
        "git clone + cp .env.example .env + nano.",
        ".env com localhost de desenvolvimento = produção quebrada.",
    )}
    {steps([
        ("Passo 1", "sudo mkdir -p /var/www/vbsolution && sudo chown $USER:$USER /var/www/vbsolution"),
        ("Passo 2", "cd /var/www/vbsolution && git clone https://github.com/visaobusinesstech/codigo-fonte-COUTINHO.git ."),
        ("Passo 3", "cd VBSOLUTIONCRMCodigoFonte-main/backend"),
        ("Passo 4", "cp .env.example .env && nano .env"),
        ("Passo 5", "Preencha DEV_NO_DB=false, DATABASE_URL, DB_SSL=true, JWT, Redis local, URLs HTTPS do domínio api."),
        ("Passo 6", "Salve (Ctrl+O, Enter, Ctrl+X no nano)."),
    ])}
    {code("""DEV_NO_DB=false
NODE_ENV=production
DB_SSL=true
DATABASE_URL=postgresql://...:5432/postgres
REDIS_URI=redis://127.0.0.1:6379
REDIS_URL=redis://127.0.0.1:6379
REDIS_URI_ACK=redis://127.0.0.1:6379
PORT=3000
BACKEND_URL=https://api.suaempresa.com
PUBLIC_BACKEND_URL=https://api.suaempresa.com
FRONTEND_URL=https://crm.suaempresa.com""")}
    """)

    add("VPS build", "Build, migrate e PM2", f"""
    <p class="lead">Compilar TypeScript, criar tabelas e deixar o processo gerenciado.</p>
    {why_how_impact(
        "API rodando mesmo se a sessão SSH fechar.",
        "npm run build gera dist/. PM2 cuida do restart.",
        "Rodar só node na mão = cai quando o SSH desconecta.",
    )}
    {steps([
        ("Passo 1", "cd .../backend && npm install --omit=dev"),
        ("Passo 2", "npm run build"),
        ("Passo 3", "npm run db:migrate"),
        ("Passo 4", "pm2 start dist/server.js --name vbs-api  (ou pm2 start npm --name vbs-api -- start)"),
        ("Passo 5", "pm2 save"),
        ("Passo 6", "pm2 startup e execute o comando sudo que ele imprimir"),
        ("Passo 7", "pm2 logs vbs-api e confira boot limpo"),
    ])}
    {code("""npm install --omit=dev
npm run build
npm run db:migrate
pm2 start dist/server.js --name vbs-api
pm2 save
pm2 startup
pm2 logs vbs-api""")}
    {callout("<strong>Onde acarreta</strong><br/>Sem pm2 startup, reboot da Hostgator derruba atendimento.", "danger")}
    """)

    add("VPS nginx", "Nginx com WebSocket + SSL Certbot", f"""
    <p class="lead">Nginx recebe 443 e encaminha para a porta 3000 com Upgrade de WebSocket.</p>
    {why_how_impact(
        "HTTPS público e tempo real (Socket) estáveis.",
        "proxy_pass + headers Upgrade/Connection + certbot.",
        "Sem WebSocket no Nginx, chat/atualização ao vivo falha.",
    )}
    {steps([
        ("Passo 1", "Crie /etc/nginx/sites-available/vbs-api com o bloco server abaixo."),
        ("Passo 2", "sudo ln -s /etc/nginx/sites-available/vbs-api /etc/nginx/sites-enabled/"),
        ("Passo 3", "sudo nginx -t && sudo systemctl reload nginx"),
        ("Passo 4", "Confirme DNS A de api.suaempresa.com"),
        ("Passo 5", "sudo certbot --nginx -d api.suaempresa.com"),
        ("Passo 6", "Teste https://api.suaempresa.com no browser"),
    ])}
    {code("""server {
  listen 80;
  server_name api.suaempresa.com;
  client_max_body_size 50M;
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 3600s;
  }
}""")}
    {linkbox("Certbot", "https://certbot.eff.org")}
    """)

    add("VPS firewall", "UFW e o que NÃO abrir", f"""
    <p class="lead">Firewall bom é o que fecha porta demais, não o que abre por precaução.</p>
    {why_how_impact(
        "Expor só HTTP/HTTPS e SSH.",
        "ufw allow 22/80/443. Postgres e 3000 ficam locais.",
        "5432 aberto na internet = scanners batendo na porta.",
    )}
    {steps([
        ("Passo 1", "sudo ufw allow OpenSSH"),
        ("Passo 2", "sudo ufw allow 80 && sudo ufw allow 443"),
        ("Passo 3", "sudo ufw enable"),
        ("Passo 4", "sudo ufw status"),
        ("Passo 5", "Confirme que 3000 e 5432 NÃO estão liberados para o mundo"),
    ])}
    {table(["Porta", "Abrir?"], [
        ["22 SSH", "Sim (ou só seu IP)"],
        ["80 / 443", "Sim"],
        ["3000", "Não (só localhost via Nginx)"],
        ["5432", "Não"],
        ["6379", "Não"],
    ])}
    {callout("<strong>Como funciona</strong><br/>O mundo fala com o Nginx. O Node só escuta 127.0.0.1:3000.")}
    """)

    add("VPS update", "Atualizar código na VPS sem drama", f"""
    <p class="lead">git pull + install + build + migrate + restart. Sempre nessa ordem.</p>
    {why_how_impact(
        "Publicar correção sem perder .env nem sessão.",
        "Pull na pasta do repo; build no backend; pm2 restart.",
        "Esquecer migrate após pull que cria tabela = erro 500 novo.",
    )}
    {steps([
        ("Passo 1", "cd /var/www/vbsolution && git pull"),
        ("Passo 2", "cd VBSOLUTIONCRMCodigoFonte-main/backend"),
        ("Passo 3", "npm install --omit=dev"),
        ("Passo 4", "npm run build"),
        ("Passo 5", "npm run db:migrate"),
        ("Passo 6", "pm2 restart vbs-api && pm2 logs vbs-api"),
        ("Passo 7", "Teste login e uma rota simples no painel"),
    ])}
    {code("""cd /var/www/vbsolution
git pull
cd VBSOLUTIONCRMCodigoFonte-main/backend
npm install --omit=dev
npm run build
npm run db:migrate
pm2 restart vbs-api""")}
    {callout("<strong>Backup</strong><br/>Antes de migrate arriscado, rode pg_dump (página de backup).", "warn")}
    """)

    add("VPS problemas", "Problemas típicos na VPS", f"""
    <p class="lead">502, Certbot e WhatsApp que cai depois de reboot têm causa curta.</p>
    {why_how_impact(
        "Voltar o ar sem reinstalar o servidor.",
        "pm2 logs, nginx -t, DNS, ufw, df -h.",
        "Chutar “é o Node” sem ler log atrasa horas.",
    )}
    {table(["Sintoma", "Olhar", "Ação"], [
        ["502 Bad Gateway", "pm2 logs vbs-api", "Subir processo / corrigir crash"],
        ["Certbot falha", "DNS A", "Esperar propagação"],
        ["WhatsApp caiu após reboot", "pm2 startup", "Rodar startup + save"],
        ["Disco cheio", "df -h", "Limpar logs pm2 flush"],
        ["CORS", "FRONTEND_URL", "URL idêntica ao Chrome"],
    ])}
    {steps([
        ("Passo 1", "Reproduza o erro e anote a hora."),
        ("Passo 2", "pm2 logs vbs-api --lines 50"),
        ("Passo 3", "sudo nginx -t"),
        ("Passo 4", "df -h e free -m"),
        ("Passo 5", "Corrija uma coisa só e reteste"),
    ])}
    {checklist(["Sei ler pm2 logs", "Sei testar nginx", "UFW não fechou SSH sem querer"])}
    """)

    add("Comparativo", "Railway vs VPS · quadro final de decisão", f"""
    <p class="lead">Os dois entregam a mesma API. Escolha pelo time e pelo prazo.</p>
    {why_how_impact(
        "Parar de oscilar entre tutoriais.",
        "Compare operação, disco e custo de atenção.",
        "Manter os dois “meio configurados” dobra incidente.",
    )}
    {table(["Tema", "Railway", "VPS"], [
        ["Velocidade inicial", "Alta", "Média"],
        ["SSH / Linux", "Quase zero", "Obrigatório"],
        ["Disco Baileys", "Volume", "Pasta nativa"],
        ["Hibernação", "Cuidado com plano", "Não hiberna sozinha"],
        ["Nginx/SSL", "Plataforma", "Você configura"],
        ["Indicação", "Maioria dos go-lives", "Controle total"],
    ])}
    {steps([
        ("Passo 1", "Se ainda não escolheu, escolha agora e risque o outro caminho deste sprint."),
        ("Passo 2", "Feche o checklist .env (página Check env)."),
        ("Passo 3", "Execute só o bloco do caminho escolhido."),
        ("Passo 4", "Siga para go-live e PDF Vercel."),
    ])}
    {callout("<strong>Como funciona com o cliente</strong><br/>Explique em uma frase: painel na Vercel, API aqui, banco no Supabase.")}
    """)

    # 44-50
    add("Health", "Teste de saúde da API depois do deploy", f"""
    <p class="lead">Antes de chamar o time, prove que a API responde de fora do servidor.</p>
    {why_how_impact(
        "Confirmar HTTPS, DNS e processo vivos.",
        "Browser ou curl na URL pública; logs ao lado.",
        "Painel ok com API morta = tela de erro nas chamadas.",
    )}
    {steps([
        ("Passo 1", "Abra a BACKEND_URL no Chrome. Não precisa ser página bonita; precisa responder sem timeout."),
        ("Passo 2", "No PowerShell: curl -I https://SUA-API (ou Invoke-WebRequest)."),
        ("Passo 3", "Confira certificado válido (cadeado)."),
        ("Passo 4", "Olhe logs no mesmo instante (Railway ou pm2 logs)."),
        ("Passo 5", "Só então teste login pelo painel."),
        ("Passo 6", "Anote horário e resultado para o checklist go-live."),
    ])}
    {callout("<strong>Onde acarreta</strong><br/>Webhook Meta e Socket dependem desse HTTPS estar estável.")}
    {checklist(["URL responde", "HTTPS ok", "Logs sem crash loop", "Login testado"])}
    """)

    add("Homolog", "Ambiente de homologação · por que separar", f"""
    <p class="lead">Homolog é a cópia para errar sem machucar o cliente real.</p>
    {why_how_impact(
        "Testar migrate, WhatsApp de teste e variáveis novas.",
        "Segundo projeto Supabase + segundo serviço API + painel preview.",
        "Homolog = produção na mesma URI apaga ou mistura dados reais.",
    )}
    {steps([
        ("Passo 1", "Crie projeto Supabase só de homolog."),
        ("Passo 2", "Crie serviço Railway/VPS com Variables apontando para essa URI."),
        ("Passo 3", "Use número WhatsApp de teste, nunca o principal."),
        ("Passo 4", "FRONTEND_URL de preview Vercel separado."),
        ("Passo 5", "Roteiro: migrate em homolog → validar → só então produção."),
        ("Passo 6", "Documente as quatro URLs de homolog no mesmo cofre."),
    ])}
    {callout("<strong>Como funciona</strong><br/>Mesmo código, outro .env. O risco está na URI, não no Git.")}
    {table(["Item", "Produção", "Homolog"], [
        ["Supabase", "projeto A", "projeto B"],
        ["API", "domínio api", "api-hml ou outro serviço"],
        ["WhatsApp", "número real", "número teste"],
    ])}
    """)

    add("Troubleshoot", "Troubleshooting geral API + banco + Redis", f"""
    <p class="lead">Uma página para triagem rápida antes de abrir chamado.</p>
    {why_how_impact(
        "Separar sintoma de causa.",
        "CORS ≠ senha do banco ≠ Redis.",
        "Corrigir o item errado cria segundo problema.",
    )}
    {table(["Sintoma", "Camada", "Primeira checagem"], [
        ["CORS no F12", "URLs", "FRONTEND_URL idêntico"],
        ["Login não grava", "Banco", "DEV_NO_DB / URI"],
        ["Campanha parada", "Redis", "PONG / três variáveis"],
        ["Webhook Meta", "HTTPS", "PUBLIC_BACKEND_URL"],
        ["502", "Processo", "pm2 / logs Railway"],
    ])}
    {steps([
        ("Passo 1", "Classifique a camada (URLs, banco, Redis, processo)."),
        ("Passo 2", "Mude só variáveis daquela camada."),
        ("Passo 3", "Reinicie e teste um fluxo mínimo (login)."),
        ("Passo 4", "Só então teste WhatsApp."),
    ])}
    {callout("<strong>Print útil</strong><br/>URL do Chrome + 20 linhas de log + Variable names (sem colar segredos).")}
    """)

    add("Go-live", "Checklist go-live da API", f"""
    <p class="lead">Marque com o cliente do lado. É o porteiro do estamos no ar.</p>
    {why_how_impact(
        "Não lançar pela metade.",
        "Lista única cobrindo Node, .env, banco, Redis, HTTPS, firewall.",
        "Item aberto = risco de voltar de madrugada.",
    )}
    {checklist([
        "Node 20 no ambiente de build",
        "Root Directory = backend",
        "DEV_NO_DB=false",
        "URI 5432 + DB_SSL=true + migrate ok",
        "Admin criado",
        "Redis três variáveis + sem ECONNREFUSED",
        "BACKEND_URL e PUBLIC_BACKEND_URL HTTPS",
        "FRONTEND_URL alinhado (mesmo que provisório)",
        "Volume/PM2 startup se Baileys",
        "Firewall 80/443 (VPS) ou domínio Railway ok",
        ".env fora do repo",
        "Cliente sabe: desligar API = WhatsApp cai",
        "Backup combinado",
    ])}
    {steps([
        ("Passo 1", "Leia em voz alta com o responsável técnico."),
        ("Passo 2", "O que não estiver marcado vira tarefa antes do anúncio."),
        ("Passo 3", "Guarde print do checklist."),
    ])}
    """)

    add("Prompt 1", "Prompt Claude Code · .env e deploy", f"""
    <p class="lead">Cole no Claude Code no VS Code com a pasta do CRM aberta.</p>
    {why_how_impact(
        "Acelerar montagem sem inventar pasta fora do projeto.",
        "O assistente edita .env e sugere comandos; você revisa segredos.",
        "Prompt vago gera Variable inventada. Seja específico.",
    )}
    <div class="script-bubble"><span class="label">Prompt</span>Configure backend/.env para produção com Supabase URI Session 5432 (vou colar), DB_SSL=true, DEV_NO_DB=false, JWT_SECRET e JWT_REFRESH_SECRET novos via openssl, Redis nas três variáveis, BACKEND_URL/PUBLIC_BACKEND_URL/FRONTEND_URL HTTPS sem barra final. Root Directory VBSOLUTIONCRMCodigoFonte-main/backend. Não commit o .env. Liste o checklist antes de eu colar a URI.</div>
    {steps([
        ("Passo 1", "Abra o terminal do VS Code na pasta do monorepo."),
        ("Passo 2", "Cole o prompt e forneça a URI quando pedir."),
        ("Passo 3", "Revise cada linha secreta."),
        ("Passo 4", "Só então rode migrate/deploy."),
    ])}
    {callout("<strong>Segurança</strong><br/>Não cole URI em chat público fora da sua máquina.", "warn")}
    """)

    add("Prompt 2", "Prompts Claude Code · migrate, PM2, Railway", f"""
    <p class="lead">Três prompts curtos para momentos diferentes.</p>
    {why_how_impact(
        "Cobrir migrate seguro, VPS e Railway sem misturar.",
        "Um prompt por tarefa.",
        "Pedir tudo de uma vez gera resposta genérica.",
    )}
    <div class="script-bubble"><span class="label">Migrate</span>Explique npm run db:migrate neste backend. Checklist: DEV_NO_DB, 5432 vs 6543, DB_SSL. Comandos a partir de VBSOLUTIONCRMCodigoFonte-main/backend. Não rode db:migrate:undo.</div>
    <div class="script-bubble"><span class="label">VPS</span>Ubuntu 22.04: Node 20, Redis, clone codigo-fonte-COUTINHO, .env, build, pm2 nome vbs-api, nginx WebSocket, certbot, UFW. Inclua bloco server completo.</div>
    <div class="script-bubble"><span class="label">Railway</span>Redis plugin, Root backend, build/start, Variables Supabase+JWT+Redis, Generate Domain, alinhar com Vercel. Erros: prepared statement, sleep, Volume Baileys.</div>
    {callout("<strong>Como funciona</strong><br/>Você cola um, executa, valida, só então cola o próximo.")}
    """)

    add("FAQ", "FAQ · dúvidas que mais aparecem", f"""
    <p class="lead">Respostas curtas para não reabrir o manual inteiro.</p>
    {why_how_impact(
        "Destravar decisão rápida.",
        "Pergunta objetiva → resposta objetiva.",
        "FAQ não substitui o checklist de go-live.",
    )}
    <div class="qa"><div class="q">Posso frontend e API na mesma Railway?</div><div class="a">Dá com segundo serviço. Vercel costuma ser mais simples para SPA.</div></div>
    <div class="qa"><div class="q">Supabase e Postgres Railway juntos?</div><div class="a">Não no mesmo ambiente sem critério. Uma URI ativa.</div></div>
    <div class="qa"><div class="q">Migrate ok no PC e quebra na nuvem?</div><div class="a">6543, SSL ou IPv6. Use 5432 Session + DB_SSL=true + URI IPv4.</div></div>
    <div class="qa"><div class="q">Redis é obrigatório no primeiro dia?</div><div class="a">Para login básico às vezes sobe. Para WhatsApp/campanha, sim.</div></div>
    <div class="qa"><div class="q">Preciso domínio próprio na Railway?</div><div class="a">Não para testar. *.up.railway.app basta. Custom ajuda marca e Meta.</div></div>
    <div class="qa"><div class="q">Root Directory?</div><div class="a">VBSOLUTIONCRMCodigoFonte-main/backend</div></div>
    {callout("<strong>Onde acarreta</strong><br/>Tirar dúvida errada no grupo sem olhar log prolonga o incidente.")}
    """)

    add("Domínio", "Domínio próprio · os 4 lugares para atualizar", f"""
    <p class="lead">Quando sair do *.vercel.app / *.up.railway.app, atualize quatro pontas.</p>
    {why_how_impact(
        "Marca própria sem quebrar CORS e webhook.",
        "DNS + Variables + rebuild do frontend.",
        "Atualizar só o DNS deixa o build antigo falando com host velho.",
    )}
    {steps([
        ("Passo 1", "Aponte DNS do api. e do crm. (A/CNAME conforme o host)."),
        ("Passo 2", "Atualize REACT_APP_BACKEND_URL na Vercel e Redeploy."),
        ("Passo 3", "Atualize BACKEND_URL e PUBLIC_BACKEND_URL na API."),
        ("Passo 4", "Atualize FRONTEND_URL na API e redeploy/pm2 restart."),
        ("Passo 5", "Atualize webhook Meta para a nova URL."),
        ("Passo 6", "Teste login + F12 Network + mensagem WhatsApp."),
    ])}
    {table(["Lugar", "Variável"], [
        ["Vercel", "REACT_APP_BACKEND_URL"],
        ["API", "BACKEND_URL"],
        ["API", "PUBLIC_BACKEND_URL"],
        ["API", "FRONTEND_URL"],
    ])}
    {callout("<strong>Como funciona</strong><br/>O browser só conhece o que foi buildado. A Meta só conhece a Callback URL salva no app.")}
    """)

    add("Fim", "Encerramento · próximos passos e links", f"""
    <p class="lead">API e banco prontos. Agora publique o painel e ligue o WhatsApp com calma.</p>
    {why_how_impact(
        "Fechar este módulo e abrir o próximo sem buraco.",
        "Ordem: este PDF → Vercel → Supabase (se ainda não) → WhatsApp.",
        "Pular Vercel com API ok ainda deixa o time sem URL bonita; pular Redis quebra canal.",
    )}
    {steps([
        ("Passo 1", "Marque o checklist go-live."),
        ("Passo 2", "Abra o PDF Hospedagem Frontend Vercel."),
        ("Passo 3", "Alinhe as quatro URLs."),
        ("Passo 4", "Só então PDF WhatsApp."),
        ("Passo 5", "Guarde URI, domínio e runbook de update num lugar seguro."),
    ])}
    <h3>Links oficiais</h3>
    <ul>
      <li>Railway: {a("https://railway.app")}</li>
      <li>Supabase: {a("https://supabase.com")}</li>
      <li>Node.js: {a("https://nodejs.org")}</li>
      <li>Código: {a("https://github.com/visaobusinesstech/codigo-fonte-COUTINHO")}</li>
      <li>Certbot: {a("https://certbot.eff.org")}</li>
      <li>PostgreSQL: {a("https://www.postgresql.org")}</li>
    </ul>
    {callout("<strong>Visão Business · VB Solution CRM</strong><br/>Treinamento · VPS, Railway e Banco · 50 páginas · © Visão Business")}
    """)

    return b


def main():
    from pdf_kit import TOTAL
    bodies_list = bodies()
    # fix count if short/long
    print("bodies", len(bodies_list), "expected", TOTAL - 1)
    write_doc(
        "01-vps-railway-banco.html",
        "Treinamento · VPS, Railway e Banco · VB Solution CRM",
        cover(
            "SÉRIE CÓDIGO-FONTE · INFRAESTRUTURA · 50 PÁGINAS",
            "Instalação e Configuração · VPS, Railway e Banco de Dados",
            "Manual completo e passo a passo: PostgreSQL, variáveis de ambiente, Redis, deploy na Railway ou VPS Ubuntu, Nginx, SSL, checklist de go-live e prompts para Claude Code. Escrito para quem comprou o código-fonte e precisa colocar a API no ar sem enrolação.",
            [
                ("Público", "Compradores do código-fonte"),
                ("Foco", "API + Banco + Redis"),
                ("Caminhos", "Railway ou VPS Ubuntu"),
                ("Formato", "50 páginas · passo a passo"),
            ],
        ),
        bodies_list,
    )


if __name__ == "__main__":
    main()
