# -*- coding: utf-8 -*-
"""Gera HTMLs 03 Supabase, 04 WhatsApp, 05 Instalacao Local (35 paginas cada)."""
from pathlib import Path

OUT = Path(__file__).resolve().parent / "html"
FOOTER = "Visão Business · Treinamento Código-Fonte VB Solution CRM"


def head(title: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>{title}</title>
  <link rel="stylesheet" href="styles.css" />
  <link rel="stylesheet" href="styles-extra.css" />
</head>
<body>
"""


def cover(series: str, h1: str, subtitle: str, cards: list) -> str:
    cards_html = "".join(
        f'<div class="cover-card"><span>{a}</span><strong>{b}</strong></div>' for a, b in cards
    )
    return f"""
<section class="page cover">
  <div class="cover-top">
    <img class="cover-logo" src="../assets/vbsolution-logo-nome-branca.png" alt="VB Solution" />
    <div class="badge">Material de treinamento · Código-Fonte</div>
  </div>
  <p class="series">{series}</p>
  <h1>{h1}</h1>
  <p class="subtitle">{subtitle}</p>
  <div class="cover-grid">{cards_html}</div>
  <div class="cover-bottom">
    <div>Visão Business · VB Solution CRM<br />Manual técnico · © Visão Business</div>
    <img src="../assets/vbsolution-logo-square.png" alt="VB" />
  </div>
</section>
"""


def page(meta: str, kicker: str, title: str, body: str, num: int, total: int = 35) -> str:
    return f"""
<section class="page inner-page">
  <header class="doc-header">
    <div class="brand"><img src="../assets/vbsolution-logo-nome-preta.png" alt="VB Solution" /></div>
    <div class="meta"><strong>{meta}</strong>VB Solution CRM · Código-Fonte</div>
  </header>
  <div class="page-main">
    <p class="kicker">{kicker}</p>
    <h2>{title}</h2>
    {body}
  </div>
  <footer class="doc-footer">
    <span>{FOOTER}</span>
    <span class="page-num">{num} / {total}</span>
  </footer>
</section>
"""


def a(url: str, label: str | None = None) -> str:
    return f'<a href="{url}" target="_blank">{label or url}</a>'


# ---------------------------------------------------------------------------
# 03 SUPABASE
# ---------------------------------------------------------------------------
def build_supabase() -> str:
    m = "Supabase · Banco de Dados"
    pages = [cover(
        "SÉRIE CÓDIGO-FONTE · BANCO DE DADOS",
        "Supabase · Banco de Dados do CRM",
        "Tutorial completo para criar o PostgreSQL do VB Solution no Supabase, colar a URI no backend, rodar migrações e usar o Claude Code no terminal do VS Code para fazer o processo por você.",
        [("Público", "Compradores do código-fonte"), ("Foco", "Postgres hospedado"), ("Ferramenta", "Claude Code + VS Code"), ("Resultado", "Tabelas migradas e admin")],
    )]
    bodies = [
        ("Mapa", "Sumário · o que você vai aprender", """
        <p class="lead">Trinta e cinco páginas do zero até o banco saudável no Table Editor, com prompts prontos para colar no Claude Code.</p>
        <div class="two-col"><div><ol class="toc">
        <li><strong>01</strong> Capa</li><li><strong>02</strong> Sumário</li><li><strong>03</strong> O que é Supabase neste CRM</li>
        <li><strong>04</strong> O que não usar</li><li><strong>05 a 08</strong> Conta e projeto</li>
        <li><strong>09 a 12</strong> Connection string e rede</li><li><strong>13 a 17</strong> .env, migrate, admin</li>
        </ol></div><div><ol class="toc" start="18">
        <li><strong>18 a 24</strong> RLS, backup, Railway, erros</li>
        <li><strong>25 a 29</strong> Prompts Claude Code</li>
        <li><strong>30 a 34</strong> Checklists, FAQ, segurança</li>
        <li><strong>35</strong> Encerramento e links</li>
        </ol></div></div>
        <div class="link-box"><strong>Portal Supabase</strong><div class="url">{a("https://supabase.com")}</div></div>
        """),
        ("Conceito", "O que é Supabase neste projeto", """
        <p class="lead">O Supabase é famoso por “substituir um backend”. Aqui não é o caso.</p>
        <div class="callout"><strong>Neste CRM o Supabase é só PostgreSQL hospedado.</strong><br/>
        Um HD na nuvem organizado em tabelas. Quem autentica o usuário, quem fala com WhatsApp e quem monta o menu é a <strong>API</strong> (pasta backend), não o Auth do Supabase.</div>
        <table class="compact"><thead><tr><th>Peça</th><th>Quem faz</th></tr></thead><tbody>
        <tr><td>Login / JWT</td><td>API Node (backend)</td></tr>
        <tr><td>WhatsApp, filas, Socket</td><td>API + Redis</td></tr>
        <tr><td>Guardar leads, tickets, imóveis</td><td>PostgreSQL no Supabase</td></tr>
        <tr><td>Painel visual</td><td>Frontend (Vercel)</td></tr>
        </tbody></table>
        <p>Fluxo real: Browser → <span class="inline-code">REACT_APP_BACKEND_URL</span> → Express/Sequelize → <span class="inline-code">DATABASE_URL</span>.</p>
        """),
        ("Atenção", "O que você NÃO vai usar no dia 1", """
        <p class="lead">Ignorar estas telas evita confusão e instalação quebrada.</p>
        <ul class="checklist">
        <li>Auth do Supabase (login social, magic link)</li>
        <li>Colar <span class="inline-code">anon key</span> no React do CRM</li>
        <li><span class="inline-code">VITE_SUPABASE_URL</span> (isso era do Radar Vite antigo)</li>
        <li>Storage / Edge Functions para a instalação básica</li>
        <li>RLS agressivo sem saber o que está fazendo</li>
        </ul>
        <div class="callout warn"><strong>Pasta project/</strong><br/>O app Vite antigo falava direto com Supabase. No VB Solution atual você pode apagar essa pasta. O painel oficial é o da pasta <span class="inline-code">frontend/</span>.</div>
        <div class="card blue"><h4>Regra de ouro</h4><p>Você cola a URI do banco no <strong>backend/.env</strong>. O frontend nunca conversa com o Postgres.</p></div>
        """),
        ("Conta", "Passo 1 · Criar conta no Supabase", f"""
        <div class="step"><div class="n">1</div><div><h4>Abrir o site</h4>
        <p>Acesse {a("https://supabase.com")}. Clique em Start project ou Sign in.</p></div></div>
        <div class="step"><div class="n">2</div><div><h4>Entrar</h4>
        <p>Use GitHub (recomendado) ou e-mail. Confirme o e-mail se pedirem.</p></div></div>
        <div class="step"><div class="n">3</div><div><h4>Dashboard</h4>
        <p>Você cai na lista de projetos. Se for a primeira vez, a tela pede para criar o primeiro projeto.</p></div></div>
        <div class="link-box"><strong>URL</strong><div class="url">{a("https://supabase.com")}</div></div>
        <div class="callout">Não precisa cartão no Free para estudar. Em produção séria, avalie o plano Pro (backup automático).</div>
        """),
        ("Projeto", "Passo 2 · Organização e New project", """
        <ol>
        <li>Clique em <strong>New project</strong>.</li>
        <li>Se pedir organização, crie com o nome da empresa (ex. Coutinho).</li>
        <li><strong>Name:</strong> algo claro, tipo <span class="inline-code">crm-coutinho</span>.</li>
        <li>Escolha a organização certa se tiver mais de uma.</li>
        </ol>
        <table class="compact"><thead><tr><th>Campo</th><th>Sugestão</th></tr></thead><tbody>
        <tr><td>Name</td><td>crm-empresa (sem espaços estranhos)</td></tr>
        <tr><td>Organization</td><td>Nome do cliente ou da sua empresa</td></tr>
        <tr><td>Plano</td><td>Free para começar · Pro para produção</td></tr>
        </tbody></table>
        <div class="callout warn">Ainda não copie URI. O projeto precisa ficar <strong>Healthy</strong> antes.</div>
        """),
        ("Senha", "Senha do banco e região", """
        <p class="lead">A senha do Database é o segredo mais importante deste capítulo. Anote agora.</p>
        <ol>
        <li><strong>Database password:</strong> invente uma senha forte. Grave no gerenciador de senhas.</li>
        <li>Prefira letras e números se quiser evitar dor de cabeça com URL-encode.</li>
        <li><strong>Region:</strong> a mais perto dos usuários (Brasil / São Paulo se aparecer; senão South America ou East US).</li>
        <li>Clique em Create project.</li>
        </ol>
        <div class="callout danger"><strong>Perdeu a senha?</strong><br/>Dá para resetar no painel, mas você perde tempo e precisa atualizar o .env em todos os ambientes.</div>
        <div class="card warn"><h4>Dica prática</h4><p>Senha só com A-Z, a-z e 0-9 evita quebrar a URI com @ # % /.</p></div>
        """),
        ("Espera", "Esperar o status Healthy", """
        <p class="lead">Depois de Create project, o Supabase provisiona o Postgres. Pode levar alguns minutos.</p>
        <ul class="checklist">
        <li>Status do projeto aparece como Healthy / Active</li>
        <li>Menu lateral abre Settings, Table Editor, SQL</li>
        <li>Você consegue abrir Project Settings → Database</li>
        </ul>
        <div class="callout warn">Não copie a Connection string no meio do “Setting up”. A URI pode ainda não estar pronta.</div>
        <p>Enquanto espera, abra o código em <span class="inline-code">VBSOLUTIONCRMCodigoFonte-main/backend</span> e localize o arquivo <span class="inline-code">.env.example</span>.</p>
        """),
        ("URI", "Connection string · Session mode porta 5432", """
        <ol>
        <li>Menu esquerdo: ícone de engrenagem → <strong>Project Settings</strong>.</li>
        <li>Clique em <strong>Database</strong>.</li>
        <li>Role até <strong>Connection string</strong> / URI.</li>
        <li>Escolha <strong>Session mode</strong> ou <strong>Direct connection</strong>, porta <strong>5432</strong>.</li>
        </ol>
        <code>postgresql://postgres.xxxxx:SUA_SENHA@aws-0-sa-east-1.pooler.supabase.com:5432/postgres

# ou direct:
postgresql://postgres:SUA_SENHA@db.xxxxx.supabase.co:5432/postgres</code>
        <div class="callout"><strong>Troque SUA_SENHA</strong> pela senha do passo da criação do projeto. Copie a URI para o Bloco de Notas. Não compartilhe em grupo.</div>
        """),
        ("Pooler", "Direct vs Pooler 6543 (evite no início)", """
        <p class="lead">O Sequelize e o migrate deste CRM brigam com o Transaction pooler na porta 6543.</p>
        <table class="compact"><thead><tr><th>Modo</th><th>Porta</th><th>Usar?</th></tr></thead><tbody>
        <tr><td>Session / Direct</td><td>5432</td><td>Sim (padrão deste manual)</td></tr>
        <tr><td>Transaction pooler</td><td>6543</td><td>Não no migrate (prepared statement)</td></tr>
        </tbody></table>
        <div class="callout danger"><strong>Erro típico</strong><br/>prepared statement already exists / similar. Quase sempre URI na 6543. Troque para 5432 Session.</div>
        <p>Se 5432 falhar por IPv6, use o pooler em <strong>session</strong> ainda na 5432 (IPv4), não a 6543.</p>
        """),
        ("Encode", "URL-encode na senha especial", """
        <p class="lead">Se a senha tiver caracteres especiais, a URI quebra no meio.</p>
        <table class="compact"><thead><tr><th>Caractere</th><th>Na URL vira</th></tr></thead><tbody>
        <tr><td>@</td><td>%40</td></tr>
        <tr><td>#</td><td>%23</td></tr>
        <tr><td>%</td><td>%25</td></tr>
        <tr><td>/</td><td>%2F</td></tr>
        </tbody></table>
        <div class="callout">Exemplo: senha <span class="inline-code">a@b#1</span> vira <span class="inline-code">a%40b%231</span> dentro da URI.</div>
        <p>Ou mude a senha do Database no painel para algo sem símbolos e atualize o .env.</p>
        """),
        ("Rede", "Network restrictions e IPv4", """
        <p>Em Settings → Database, veja <strong>Network restrictions</strong>.</p>
        <ul>
        <li><strong>Teste no PC:</strong> Add my IP, ou em estudo 0.0.0.0/0 (aceite o risco).</li>
        <li><strong>Produção:</strong> libere o IP da VPS ou o range da Railway.</li>
        </ul>
        <div class="callout warn"><strong>Timeout / ENETUNREACH</strong><br/>Às vezes o provedor ou a Railway tenta IPv6 e o Free responde mal. Solução: add-on IPv4 no Supabase ou URI pooler IPv4 da mesma tela.</div>
        <div class="card blue"><h4>Checklist rede</h4><p>IP liberado · URI 5432 · senha correta · SSL ligado no .env</p></div>
        """),
        ("Env", "Colar DATABASE_URL no backend/.env", """
        <p class="lead">Abra a pasta backend no VS Code. Copie o exemplo se ainda não tiver .env.</p>
        <code>cd VBSOLUTIONCRMCodigoFonte-main/backend
copy .env.example .env
# Mac/Linux: cp .env.example .env</code>
        <p>No arquivo <span class="inline-code">.env</span>, garanta:</p>
        <code>DEV_NO_DB=false
DB_DIALECT=postgres
DB_SSL=true
DATABASE_URL=postgresql://...:5432/postgres</code>
        <div class="callout danger">Com <span class="inline-code">DEV_NO_DB=true</span> o CRM finge banco e <strong>ignora</strong> o Supabase. Em produção sempre false.</div>
        """),
        ("SSL", "DB_SSL=true e DEV_NO_DB=false", """
        <table class="compact"><thead><tr><th>Variável</th><th>Valor nuvem</th><th>Por quê</th></tr></thead><tbody>
        <tr><td>DEV_NO_DB</td><td>false</td><td>Grava de verdade no Postgres</td></tr>
        <tr><td>DB_DIALECT</td><td>postgres</td><td>Dialeto Sequelize</td></tr>
        <tr><td>DB_SSL</td><td>true</td><td>Supabase exige SSL</td></tr>
        <tr><td>DATABASE_URL</td><td>URI 5432</td><td>Conexão completa</td></tr>
        <tr><td>DB_POOL_MAX</td><td>8 (Free)</td><td>Evita esgotar conexões</td></tr>
        </tbody></table>
        <p>Opcional: preencher também DB_HOST, DB_PORT, DB_USER, DB_PASS, DB_NAME=postgres. Se DATABASE_URL estiver certa, o sistema costuma derivar o resto.</p>
        <div class="callout">Salvou o .env? Reinicie <span class="inline-code">npm run dev</span>, PM2 ou redeploy Railway.</div>
        """),
        ("Migrate", "npm install e db:migrate", """
        <p class="lead">O migrate é o pedreiro: lê as migrations e constrói as tabelas.</p>
        <code>cd VBSOLUTIONCRMCodigoFonte-main/backend
npm install
npm run db:migrate</code>
        <div class="step"><div class="n">1</div><div><h4>Sucesso</h4><p>Volta ao prompt sem stack enorme de erro. Algumas linhas “migrated” são normais.</p></div></div>
        <div class="step"><div class="n">2</div><div><h4>Falha de senha</h4><p>password authentication failed → URI com senha errada ou caractere especial sem encode.</p></div></div>
        <div class="step"><div class="n">3</div><div><h4>Falha SSL</h4><p>Coloque DB_SSL=true.</p></div></div>
        <div class="step"><div class="n">4</div><div><h4>Prepared statement</h4><p>Troque URI da 6543 para 5432 Session.</p></div></div>
        """),
        ("Tabelas", "Validar no Table Editor", """
        <p>No Supabase, abra <strong>Table Editor</strong>. Você deve ver dezenas de tabelas criadas pelas migrations.</p>
        <table class="compact"><thead><tr><th>Exemplos de tabelas</th><th>Para quê</th></tr></thead><tbody>
        <tr><td>Users / Companies</td><td>Login e multiempresa</td></tr>
        <tr><td>Tickets / Messages</td><td>Atendimento WhatsApp</td></tr>
        <tr><td>leads_sales / pipelines</td><td>Funil de vendas</td></tr>
        <tr><td>imoveis / contratos</td><td>Módulo imobiliário</td></tr>
        <tr><td>realty_modulos</td><td>Módulos do produto</td></tr>
        </tbody></table>
        <div class="callout">Se o Table Editor estiver vazio, o migrate não rodou ou apontou para outro projeto. Confira a DATABASE_URL.</div>
        """),
        ("Admin", "Criar usuário admin local-dev", """
        <p class="lead">Com as tabelas no ar, crie o primeiro usuário administrador.</p>
        <code>cd VBSOLUTIONCRMCodigoFonte-main/backend
npm run admin:local-dev</code>
        <p>Se o script existir no package.json, ele cria ou reseta um admin de desenvolvimento. Anote e-mail e senha que o terminal mostrar.</p>
        <div class="card blue"><h4>Sem o script?</h4><p>Use o seed documentado no .env.example ou peça ao Claude Code para criar o admin via comando/script do projeto (página 28).</p></div>
        <div class="callout warn">Troque a senha do admin assim que o painel abrir em produção.</div>
        """),
        ("RLS", "RLS · o CRM não depende disso no painel", """
        <p class="lead">Row Level Security (RLS) no Supabase trava linhas por política. Neste CRM o browser <strong>não</strong> acessa o Postgres.</p>
        <ul>
        <li>A API usa a role com permissão de schema (postgres / connection string).</li>
        <li>Autorização de usuário é JWT + regras na API.</li>
        <li>Ligar RLS agressivo sem políticas certas quebra o migrate ou o runtime.</li>
        </ul>
        <div class="callout">Para a instalação padrão: deixe RLS como veio. Foque em .env seguro e firewall de IP.</div>
        """),
        ("Backup", "Backup com pg_dump", """
        <code>pg_dump "SUA_DATABASE_URL?sslmode=require" -F c -f backup-crm.dump</code>
        <p>Restore (cuidado: sobrescreve):</p>
        <code>pg_restore -d "SUA_DATABASE_URL?sslmode=require" backup-crm.dump</code>
        <div class="callout warn">No Free o backup automático é limitado. Faça dump antes de migrate grande ou troca de senha.</div>
        <ul class="checklist">
        <li>Backup antes de produção</li>
        <li>Guardar o arquivo fora do PC único</li>
        <li>Testar restore em projeto de homologação</li>
        </ul>
        """),
        ("Pool", "Pool de conexões no plano Free", """
        <p class="lead">O Free tem limite de conexões. Se a API abrir 50 de uma vez, o banco recusa.</p>
        <code>DB_POOL_MAX=8</code>
        <table class="compact"><thead><tr><th>Sintoma</th><th>Ação</th></tr></thead><tbody>
        <tr><td>too many connections</td><td>Baixar DB_POOL_MAX · não abrir vários deploys</td></tr>
        <tr><td>API lenta sob carga</td><td>Avaliar Pro + pooler session 5432</td></tr>
        <tr><td>Vários workers</td><td>Somar pools (API + jobs) não passar do limite</td></tr>
        </tbody></table>
        """),
        ("Integração", "Ligar Supabase na Railway ou VPS", """
        <p>Depois da URI pronta:</p>
        <ol>
        <li><strong>Railway:</strong> Variables → cole DATABASE_URL, DB_SSL=true, DEV_NO_DB=false.</li>
        <li><strong>VPS:</strong> mesmo conteúdo no <span class="inline-code">backend/.env</span>.</li>
        <li>Rode migrate uma vez (local apontando para nuvem, ou no start da API).</li>
        <li>Não misture Postgres da Railway e Supabase no mesmo .env sem critério.</li>
        </ol>
        <div class="link-box"><strong>Railway</strong><div class="url">{a("https://railway.app")}</div></div>
        <div class="callout">Uma URI ativa por ambiente. Duas URIs “pela metade” = dados em lugar nenhum.</div>
        """),
        ("Erros", "Erros comuns de conexão", """
        <table class="compact"><thead><tr><th>Sintoma</th><th>Causa provável</th><th>Correção</th></tr></thead><tbody>
        <tr><td>password authentication failed</td><td>Senha / encode</td><td>Conferir URI</td></tr>
        <tr><td>SSL / self signed</td><td>DB_SSL faltando</td><td>DB_SSL=true</td></tr>
        <tr><td>prepared statement</td><td>Porta 6543</td><td>Usar 5432 Session</td></tr>
        <tr><td>ENOTFOUND / timeout</td><td>IPv6 / firewall</td><td>URI IPv4 · liberar IP</td></tr>
        <tr><td>Tabelas vazias</td><td>DEV_NO_DB=true</td><td>false + migrate</td></tr>
        </tbody></table>
        """),
        ("Fluxo", "Fluxo Browser → API → Supabase", """
        <div class="module-grid">
        <div class="module-item"><strong>1. Usuário</strong><span>Abre o painel na Vercel ou localhost</span></div>
        <div class="module-item"><strong>2. React</strong><span>Chama REACT_APP_BACKEND_URL</span></div>
        <div class="module-item"><strong>3. API Node</strong><span>Valida JWT e regras de negócio</span></div>
        <div class="module-item"><strong>4. Sequelize</strong><span>Usa DATABASE_URL com SSL</span></div>
        <div class="module-item"><strong>5. Supabase</strong><span>Postgres grava e lê tabelas</span></div>
        <div class="module-item"><strong>6. Resposta</strong><span>JSON volta ao painel</span></div>
        </div>
        <div class="callout"><strong>Por isso</strong> anon key no frontend não faz sentido neste produto.</div>
        """),
        ("Radar", "Projeto novo vs misturar Radar antigo", """
        <p class="lead">Se você já tinha um Supabase do Radar Vite (pasta project/), não reaproveite às cegas.</p>
        <ul>
        <li>Crie um <strong>projeto novo</strong> para o VB Solution CRM.</li>
        <li>Rode migrate limpo.</li>
        <li>Não apague dados de outro produto sem backup.</li>
        </ul>
        <div class="callout warn">Schemas diferentes. Misturar tabelas antigas com migrations novas gera conflito de nomes e dados fantasma.</div>
        """),
        ("Prompt 1", "Prompt Claude Code · checklist Supabase", """
        <p class="lead">No VS Code, abra o terminal na pasta do CRM e cole no Claude Code:</p>
        <div class="script-bubble"><span class="label">Prompt 1</span>Estou configurando o VB Solution CRM. Liste um checklist clique a clique para criar um projeto no Supabase (https://supabase.com), gerar Database password, pegar Connection string Session porta 5432 (não 6543), e o que colar em backend/.env (DEV_NO_DB=false, DB_SSL=true, DATABASE_URL). Explique o que NÃO usar (Auth, anon key no React). Não invente pastas fora de VBSOLUTIONCRMCodigoFonte-main.</div>
        <div class="card ok"><h4>Como usar</h4><p>Extensão Claude Code no VS Code → cole o prompt → revise a resposta → execute os cliques você mesmo no painel.</p></div>
        """),
        ("Prompt 2", "Prompt Claude Code · .env e migrate", """
        <div class="script-bubble"><span class="label">Prompt 2</span>No diretório VBSOLUTIONCRMCodigoFonte-main/backend, ajude a montar o .env a partir do .env.example com DATABASE_URL Session 5432 do Supabase que eu vou colar, DB_SSL=true, DEV_NO_DB=false, JWT_SECRET e JWT_REFRESH_SECRET novos (openssl rand -base64 32). Depois rode npm install e npm run db:migrate. Se der erro, diagnostique (senha, SSL, 6543, IPv6) sem usar db:migrate:undo. Não commit o .env.</div>
        """),
        ("Prompt 3", "Prompt Claude Code · diagnosticar conexão", """
        <div class="script-bubble"><span class="label">Prompt 3</span>O migrate do CRM falhou ao conectar no Supabase. Segue o erro do terminal: [COLE O ERRO AQUI]. Analise se é senha, URL-encode, DB_SSL, porta 6543, Network restrictions ou IPv6. Me dê a correção exata na DATABASE_URL e nas variáveis, sem apagar dados.</div>
        <div class="callout">Sempre cole o erro real. Sem o stack, o diagnóstico fica genérico.</div>
        """),
        ("Prompt 4", "Prompt Claude Code · tabelas e admin", """
        <div class="script-bubble"><span class="label">Prompt 4</span>Após migrate no Supabase, valide se as tabelas principais existem (Users, Companies, Tickets, Messages, leads/imóveis se houver). Rode npm run admin:local-dev se existir no package.json. Me diga e-mail/senha do admin gerado e o próximo passo para abrir o frontend com REACT_APP_BACKEND_URL apontando para a API.</div>
        """),
        ("Roteiro", "Conversa completa no terminal VS Code", """
        <p class="lead">Roteiro sugerido em uma sessão Claude Code:</p>
        <ol>
        <li>Cole o Prompt 1 e siga o checklist no navegador (criar projeto).</li>
        <li>Copie a URI 5432 para o Bloco de Notas.</li>
        <li>Cole o Prompt 2 e informe a URI quando pedir.</li>
        <li>Se falhar, Prompt 3 com o erro.</li>
        <li>Sucesso: Prompt 4 para admin e validação.</li>
        </ol>
        <div class="callout"><strong>Você no comando</strong><br/>O Claude Code acelera, mas a senha e o .env são sua responsabilidade. Não cole segredos em chat público.</div>
        """),
        ("Checklist", "Checklist do zero ao banco pronto", """
        <ul class="checklist">
        <li>Conta em https://supabase.com</li>
        <li>Projeto Healthy com senha anotada</li>
        <li>URI Session/Direct 5432 copiada</li>
        <li>IP liberado (ou 0.0.0.0/0 em estudo)</li>
        <li>backend/.env com DEV_NO_DB=false e DB_SSL=true</li>
        <li>npm run db:migrate sem exception</li>
        <li>Table Editor com tabelas</li>
        <li>Admin criado</li>
        <li>URI também na Railway/VPS se for produção</li>
        </ul>
        """),
        ("FAQ", "Perguntas frequentes", """
        <div class="qa"><div class="q">Preciso do Auth do Supabase?</div><div class="a">Não. O login é JWT da API do CRM.</div></div>
        <div class="qa"><div class="q">Coloco a anon key no React?</div><div class="a">Não neste produto. Só a API fala com o banco.</div></div>
        <div class="qa"><div class="q">Free serve para produção?</div><div class="a">Serve para começar. Produção com clientes reais: Pro + backup.</div></div>
        <div class="qa"><div class="q">Posso usar o mesmo projeto em homolog e produção?</div><div class="a">Não recomendado. Dois projetos, duas URIs.</div></div>
        <div class="qa"><div class="q">O migrate roda sozinho no npm start?</div><div class="a">Em produção a API tenta migrar no start. Ainda assim rode uma vez e confira logs.</div></div>
        """),
        ("Segurança", "Segurança da senha e do .env", """
        <ul class="checklist">
        <li>.env fora do GitHub (já deve estar no .gitignore)</li>
        <li>Não colar URI em WhatsApp do time</li>
        <li>Resetar senha se vazou</li>
        <li>Restringir IP em produção</li>
        <li>JWT diferentes de qualquer exemplo do material</li>
        </ul>
        <div class="callout danger">Quem tem a DATABASE_URL tem o banco. Trate como chave mestra.</div>
        """),
        ("Planos", "Free vs Pro em produção", """
        <table class="compact"><thead><tr><th>Item</th><th>Free</th><th>Pro</th></tr></thead><tbody>
        <tr><td>Estudo / piloto</td><td>Ok</td><td>Ok</td></tr>
        <tr><td>Backup sério</td><td>Limitado (faça pg_dump)</td><td>Melhor</td></tr>
        <tr><td>Pausa por inatividade</td><td>Pode pausar</td><td>Mais estável</td></tr>
        <tr><td>Conexões</td><td>Baixe DB_POOL_MAX</td><td>Mais folga</td></tr>
        </tbody></table>
        <p>Escolha com o cliente: custo vs risco de pausa e backup.</p>
        """),
        ("Troubleshoot", "Tabela rápida de troubleshooting", """
        <table class="compact"><thead><tr><th>Problema</th><th>Onde olhar</th></tr></thead><tbody>
        <tr><td>Login fake / nada grava</td><td>DEV_NO_DB ainda true?</td></tr>
        <tr><td>CORS depois do banco</td><td>FRONTEND_URL na API (outro tema)</td></tr>
        <tr><td>Railway não conecta</td><td>Variables · IPv4 · 5432</td></tr>
        <tr><td>VPS não conecta</td><td>Firewall Supabase · SSL</td></tr>
        <tr><td>Tabelas faltando</td><td>Logs do migrate · SequelizeMeta</td></tr>
        </tbody></table>
        """),
        ("Fim", "Encerramento + links oficiais", f"""
        <p class="lead">Com o Supabase migrado, o próximo passo é apontar a API (Railway ou VPS) e o painel (Vercel) para esse banco.</p>
        <h3>Links</h3>
        <ul>
        <li>Supabase: {a("https://supabase.com")}</li>
        <li>Código-fonte: {a("https://github.com/visaobusinesstech/codigo-fonte-COUTINHO")}</li>
        <li>Railway: {a("https://railway.app")}</li>
        <li>Node.js: {a("https://nodejs.org")}</li>
        </ul>
        <div class="callout"><strong>Visão Business · VB Solution CRM</strong><br/>Material de treinamento · Supabase · © Visão Business</div>
        """),
    ]
    assert len(bodies) == 34
    for i, (k, t, b) in enumerate(bodies, start=2):
        pages.append(page(m, k, t, b, i))
    return head("Treinamento · Supabase · VB Solution CRM") + "".join(pages) + "\n</body>\n</html>\n"


# ---------------------------------------------------------------------------
# 04 WHATSAPP
# ---------------------------------------------------------------------------
def build_whatsapp() -> str:
    m = "WhatsApp · Redis · E-mail"
    pages = [cover(
        "SÉRIE CÓDIGO-FONTE · CANAIS E SERVIÇOS",
        "WhatsApp e Serviços · QR, API Oficial, Redis e E-mail",
        "Guia mastigado para ligar Redis, conectar WhatsApp Web (QR/Baileys), configurar a Cloud API oficial da Meta, SMTP e filas de campanha no VB Solution CRM.",
        [("Canais", "Baileys + Cloud API"), ("Filas", "Redis obrigatório"), ("E-mail", "SMTP / senha de app"), ("Resultado", "Ticket na tela")],
    )]
    bodies = [
        ("Mapa", "Sumário · o que você vai aprender", f"""
        <p class="lead">Ordem certa: Redis → API HTTPS → login → Conexões → mensagem de teste → só então campanha.</p>
        <div class="two-col"><div><ol class="toc">
        <li>Redis (páginas 4 a 8)</li><li>WhatsApp QR / Baileys (9 a 12)</li>
        <li>Cloud API Meta (13 a 19)</li><li>Comparativo e SMTP (20 a 23)</li>
        </ol></div><div><ol class="toc">
        <li>Filas e integrações (24 a 26)</li><li>Troubleshooting (27 a 28)</li>
        <li>Prompts Claude Code (29 a 30)</li><li>FAQ e go-live (31 a 35)</li>
        </ol></div></div>
        <div class="link-box"><strong>Meta for Developers</strong><div class="url">{a("https://developers.facebook.com/")}</div></div>
        """),
        ("Ordem", "Ordem saudável de ativação", """
        <ol>
        <li>Redis respondendo PONG</li>
        <li>API no ar em HTTPS (Railway ou VPS)</li>
        <li>Login no painel funcionando</li>
        <li>Menu Conexões / Integrações</li>
        <li>Mensagem de teste → ticket em Atendimento</li>
        <li>Só depois: campanha em massa</li>
        </ol>
        <div class="callout warn">Pular Redis ou HTTPS e já disparar campanha é o caminho mais curto para fila travada e número em risco.</div>
        """),
        ("Redis", "Redis · o que é e por que não pular", """
        <p class="lead">Imagine um caderninho super rápido. A API anota: mensagem na fila, socket aberto, job de campanha esperando 2 segundos.</p>
        <div class="callout danger"><strong>Sem Redis em produção</strong><br/>Fila some, WhatsApp desconecta, campanha trava. O login até abre, mas os jobs morrem.</div>
        <p>Porta padrão: <strong>6379</strong>. Na nuvem a URL vem pronta (Railway plugin ou Upstash).</p>
        """),
        ("Docker", "Redis local com Docker (Windows)", """
        <code>docker run -d -p 6379:6379 --name redis redis:7</code>
        <p>No backend/.env:</p>
        <code>REDIS_URI=redis://127.0.0.1:6379
REDIS_URL=redis://127.0.0.1:6379
REDIS_URI_ACK=redis://127.0.0.1:6379</code>
        <div class="callout">Docker Desktop precisa estar aberto. Depois reinicie <span class="inline-code">npm run dev</span>.</div>
        <div class="link-box"><strong>Docker Desktop</strong><div class="url">{a("https://www.docker.com/products/docker-desktop/")}</div></div>
        """),
        ("Nuvem", "Redis na VPS, Railway e Upstash", f"""
        <h3>VPS Ubuntu</h3>
        <code>sudo apt install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server
redis-cli ping</code>
        <p>URI local na VPS: <span class="inline-code">redis://127.0.0.1:6379</span></p>
        <h3>Railway</h3>
        <p>New → Database → Redis → copie REDIS_URL. Nunca use localhost na Railway.</p>
        <div class="link-box"><strong>Railway</strong><div class="url">{a("https://railway.app")}</div></div>
        <h3>Upstash</h3>
        <p>URL costuma ser <span class="inline-code">rediss://...</span> (TLS). Cole nas três variáveis.</p>
        """),
        ("Variáveis", "As três variáveis Redis", """
        <p class="lead">No início, as três apontam para a <strong>mesma</strong> URL.</p>
        <table class="compact"><thead><tr><th>Variável</th><th>Função</th></tr></thead><tbody>
        <tr><td>REDIS_URI</td><td>Filas / conexão principal</td></tr>
        <tr><td>REDIS_URL</td><td>Alguns módulos leem este nome</td></tr>
        <tr><td>REDIS_URI_ACK</td><td>ACKs / filas auxiliares</td></tr>
        </tbody></table>
        <code># Railway (exemplo de referência cruzada)
REDIS_URI=${{Redis.REDIS_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
REDIS_URI_ACK=${{Redis.REDIS_URL}}</code>
        <p>Se o serviço Redis não se chamar exatamente Redis, cole a URL na mão.</p>
        """),
        ("PONG", "Teste: redis-cli ping → PONG", """
        <code>redis-cli ping
# esperado: PONG</code>
        <p>Com senha: <span class="inline-code">redis-cli -a SENHA ping</span></p>
        <div class="callout warn"><strong>ECONNREFUSED 6379</strong><br/>Container parado, Redis não instalado, ou URI localhost num serviço na nuvem.</div>
        <ul class="checklist">
        <li>PONG ok</li>
        <li>Três variáveis iguais</li>
        <li>API reiniciada depois de salvar</li>
        </ul>
        """),
        ("QR visão", "WhatsApp QR (Baileys) · visão geral", """
        <p class="lead">É o caminho “aparelho conectado”: a API gera um QR e o celular lê, como no WhatsApp Web.</p>
        <table class="compact"><thead><tr><th>Prós</th><th>Cuidados</th></tr></thead><tbody>
        <tr><td>Rápido de testar</td><td>Uso não oficial: risco de ban</td></tr>
        <tr><td>Sem app review Meta</td><td>Sessão depende de disco/volume</td></tr>
        <tr><td>Bom para piloto</td><td>Use chip de testes primeiro</td></tr>
        </tbody></table>
        <div class="callout">Pré-requisito: API + Redis + frontend apontando para a mesma API.</div>
        """),
        ("QR passos", "Passo a passo · menu Conexões", """
        <ol>
        <li>Suba API + Redis + frontend.</li>
        <li>Faça login no painel.</li>
        <li>Abra o menu <strong>Conexões</strong> (ou WhatsApp / Canais).</li>
        <li>Adicionar conexão (ex. “Principal”).</li>
        <li>No celular: WhatsApp → Aparelhos conectados → Conectar.</li>
        <li>Aponte a câmera no QR da tela.</li>
        <li>Status deve ir para Connected.</li>
        </ol>
        <div class="callout warn">O celular precisa estar online. Se o QR expirar, gere outro na tela.</div>
        """),
        ("Cuidados", "Cuidados com sessão e número", """
        <ul>
        <li><span class="inline-code">REACT_APP_BACKEND_URL</span> deve ser a mesma API que gera o QR.</li>
        <li>Redeploy Railway <strong>sem Volume</strong> apaga a sessão → QR de novo.</li>
        <li>Mesmo número em dois CRMs = um cai.</li>
        <li>Comece com número de testes.</li>
        <li>Disco cheio (<span class="inline-code">df -h</span>) = mídia/áudio falha.</li>
        </ul>
        <div class="callout danger">Não use o WhatsApp pessoal da empresa em homologação e produção ao mesmo tempo.</div>
        """),
        ("Sessão", "Pastas de sessão e Volume", """
        <p>A sessão Baileys costuma ficar em pastas como <span class="inline-code">public</span> ou diretórios <span class="inline-code">.wwebjs</span> no servidor.</p>
        <h3>Railway</h3>
        <p>Crie um Volume montado no caminho que o código usa para sessão. Sem isso, cada deploy desconecta.</p>
        <h3>VPS + PM2</h3>
        <p>A sessão fica no disco da VPS. Faça backup da pasta e não apague no git pull.</p>
        <div class="card blue"><h4>Checklist Baileys estável</h4><p>Volume ou disco persistente · Redis ok · PM2 startup · um número por ambiente</p></div>
        """),
        ("Cloud visão", "WhatsApp Cloud API (oficial Meta)", f"""
        <p class="lead">Caminho oficial: app no Meta for Developers, número Cloud, webhooks HTTPS.</p>
        <div class="callout"><strong>Pré-requisito</strong><br/>API em HTTPS público (Railway/VPS). Localhost só recebe webhook com túnel (ngrok) em teste.</div>
        <div class="link-box"><strong>Developers Meta</strong><div class="url">{a("https://developers.facebook.com/")}</div></div>
        <p>Você vai precisar de: token permanente, Phone Number ID, Business Account ID, App Secret e um VERIFY_TOKEN inventado por você.</p>
        """),
        ("Meta conta", "Criar conta e app no Meta", f"""
        <ol>
        <li>Acesse {a("https://developers.facebook.com/")}.</li>
        <li>Faça login com a conta Business.</li>
        <li>My Apps → Create App → tipo adequado a Business / Other conforme o fluxo atual.</li>
        <li>Adicione o produto <strong>WhatsApp</strong>.</li>
        </ol>
        <div class="callout warn">Telas da Meta mudam de nome. Procure WhatsApp, API Setup e Webhooks.</div>
        """),
        ("App WA", "Configurar produto WhatsApp", """
        <ol>
        <li>Em WhatsApp → API Setup, veja o número de teste ou vincule um número real.</li>
        <li>Copie o <strong>Temporary / Permanent token</strong> (prefira permanente em produção).</li>
        <li>Copie o <strong>Phone number ID</strong>.</li>
        <li>Anote o WhatsApp Business Account ID.</li>
        <li>Em Settings do app, copie o <strong>App Secret</strong>.</li>
        </ol>
        <div class="card warn"><h4>VERIFY_TOKEN</h4><p>Invente uma frase secreta (ex. crm-coutinho-verify-2026). Vai no .env e no painel do Webhook.</p></div>
        """),
        ("Tokens", "O que guardar (sem vazar)", """
        <table class="compact"><thead><tr><th>Dado</th><th>Onde cola</th></tr></thead><tbody>
        <tr><td>Token permanente</td><td>TOKEN_API_OFICIAL / Integrações</td></tr>
        <tr><td>Phone Number ID</td><td>Painel / variáveis do .env.example</td></tr>
        <tr><td>App Secret</td><td>FACEBOOK_APP_SECRET</td></tr>
        <tr><td>App ID</td><td>FACEBOOK_APP_ID</td></tr>
        <tr><td>VERIFY_TOKEN</td><td>.env + Webhook Meta</td></tr>
        </tbody></table>
        <div class="callout danger">Nunca commit tokens no GitHub. Só Variables da Railway ou .env na VPS.</div>
        """),
        ("Webhook", "Webhook HTTPS na sua API", """
        <p class="lead">A Meta precisa chamar sua API para entregar mensagens.</p>
        <code>https://SUA-API/webhook/</code>
        <p>Troque SUA-API pelo domínio Railway (<span class="inline-code">https://....up.railway.app</span>) ou <span class="inline-code">https://api.suaempresa.com</span>. Confirme o path exato no .env.example ou na tela Integrações.</p>
        <ol>
        <li>No Meta: Webhooks → Callback URL = URL acima.</li>
        <li>Verify token = o mesmo VERIFY_TOKEN do .env.</li>
        <li>Assine os campos de mensagens (messages).</li>
        <li>Salve. A verificação GET precisa retornar ok.</li>
        </ol>
        """),
        ("Env Meta", "Variáveis .env da API Oficial", """
        <code>VERIFY_TOKEN=sua-frase-secreta
FACEBOOK_APP_ID=...
FACEBOOK_APP_SECRET=...
USE_WHATSAPP_OFICIAL=true
URL_API_OFICIAL=https://graph.facebook.com
TOKEN_API_OFICIAL=seu-token-permanente
PUBLIC_BACKEND_URL=https://SUA-API
BACKEND_URL=https://SUA-API</code>
        <p>Nomes exatos podem variar: confira <span class="inline-code">backend/.env.example</span>.</p>
        <div class="callout">Depois de salvar: reinicie a API (PM2 restart ou Redeploy).</div>
        """),
        ("Teste", "Testar mensagem → ticket", """
        <ol>
        <li>No CRM, abra Integrações / WhatsApp Official e salve o que a tela pedir.</li>
        <li>Do celular, mande “oi” para o número Cloud.</li>
        <li>Deve abrir ticket em Atendimento.</li>
        <li>Responda pelo painel e confira no celular.</li>
        </ol>
        <div class="callout warn">Número de teste Meta só conversa com números liberados na allowlist. Adicione seu celular no painel Meta.</div>
        """),
        ("Comparativo", "Baileys vs API Oficial", """
        <table class="compact"><thead><tr><th>Tema</th><th>QR / Baileys</th><th>Cloud API</th></tr></thead><tbody>
        <tr><td>Setup</td><td>Mais rápido</td><td>Mais passos Meta</td></tr>
        <tr><td>Estabilidade</td><td>Depende de sessão</td><td>Oficial</td></tr>
        <tr><td>Risco de ban</td><td>Maior</td><td>Menor (regras Meta)</td></tr>
        <tr><td>HTTPS webhook</td><td>Não (QR)</td><td>Obrigatório</td></tr>
        <tr><td>Indicação</td><td>Piloto / interno</td><td>Produção comercial</td></tr>
        </tbody></table>
        <p>Muitos clientes começam no QR e migram para Oficial.</p>
        """),
        ("SMTP", "E-mail SMTP (Gmail senha de app)", f"""
        <p class="lead">Campanhas de e-mail e “esqueci a senha” precisam de SMTP.</p>
        <ol>
        <li>Conta Google com verificação em 2 etapas.</li>
        <li>Senhas de app: {a("https://myaccount.google.com/apppasswords")}</li>
        <li>Gere uma senha e cole em MAIL_PASS.</li>
        </ol>
        <code>MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=seu@gmail.com
MAIL_PASS=senha_de_app
MAIL_FROM=seu@gmail.com</code>
        """),
        ("MAIL", "Variáveis MAIL_* e boas práticas", """
        <table class="compact"><thead><tr><th>Variável</th><th>Exemplo</th></tr></thead><tbody>
        <tr><td>MAIL_HOST</td><td>smtp.gmail.com</td></tr>
        <tr><td>MAIL_PORT</td><td>587 (TLS) ou 465</td></tr>
        <tr><td>MAIL_USER</td><td>e-mail da caixa</td></tr>
        <tr><td>MAIL_PASS</td><td>senha de app</td></tr>
        <tr><td>MAIL_FROM</td><td>remetente visível</td></tr>
        </tbody></table>
        <div class="callout">Spam: configure SPF/DKIM no DNS do domínio quando for produção séria.</div>
        """),
        ("Provedores", "SendGrid, Mailgun, SES", f"""
        <p>Alternativas ao Gmail:</p>
        <ul>
        <li>SendGrid: {a("https://sendgrid.com")}</li>
        <li>Mailgun: {a("https://www.mailgun.com")}</li>
        <li>Amazon SES: {a("https://aws.amazon.com/ses/")}</li>
        </ul>
        <p>Em todos: host SMTP, porta, usuário, senha/API key e FROM verificado. Cole no .env da API (não na Vercel).</p>
        """),
        ("Filas", "Filas Bull e campanhas", """
        <p class="lead">Campanha não dispara milhares na hora. Vai para Redis + workers.</p>
        <ul>
        <li>Conexão WhatsApp precisa estar Connected.</li>
        <li>Redis precisa estar PONG.</li>
        <li>Se ficar pendente: logs da API + atraso (delay) maior.</li>
        </ul>
        <div class="callout warn">Teste com 1 ou 2 destinatários antes de lista grande.</div>
        """),
        ("Integrações", "OpenAI, Stripe e outras no menu", """
        <p>No menu Gestão → Integrações você cola chaves de IA, pagamento etc.</p>
        <ul>
        <li>OpenAI / Anthropic: preferir chave por empresa no painel; variáveis globais só se o .env.example pedir.</li>
        <li>Stripe: webhook aponta para a <strong>API HTTPS</strong>, nunca para a Vercel.</li>
        <li>Segredos só no backend.</li>
        </ul>
        <div class="card blue"><h4>Ordem</h4><p>WhatsApp estável primeiro. IA e Stripe depois.</p></div>
        """),
        ("Checklist vivo", "Checklist · WhatsApp vivo", """
        <ul class="checklist">
        <li>Redis PONG</li>
        <li>API HTTPS pública</li>
        <li>FRONTEND_URL e BACKEND_URL corretos</li>
        <li>QR lido OU webhook Meta verde</li>
        <li>Mensagem de teste abriu ticket</li>
        <li>Resposta do painel chegou no celular</li>
        <li>Volume/sessão ok (se Baileys)</li>
        </ul>
        """),
        ("TS QR", "Troubleshooting · QR / Baileys", """
        <table class="compact"><thead><tr><th>Sintoma</th><th>Ação</th></tr></thead><tbody>
        <tr><td>QR não aparece</td><td>API e Redis no ar? Console F12?</td></tr>
        <tr><td>QR some após deploy</td><td>Volume Railway / pasta sessão</td></tr>
        <tr><td>Connected e cai</td><td>Dois CRMs no mesmo número?</td></tr>
        <tr><td>Áudio não sobe</td><td>Disco (df -h) e pasta public</td></tr>
        <tr><td>QR de outro ambiente</td><td>REACT_APP_BACKEND_URL errado</td></tr>
        </tbody></table>
        """),
        ("TS Meta", "Troubleshooting · webhook Meta", """
        <table class="compact"><thead><tr><th>Sintoma</th><th>Ação</th></tr></thead><tbody>
        <tr><td>Verify falha</td><td>VERIFY_TOKEN diferente no Meta e no .env</td></tr>
        <tr><td>Callback 502</td><td>API fora / Nginx / path errado</td></tr>
        <tr><td>Mensagem não chega</td><td>Assinatura messages · allowlist do número teste</td></tr>
        <tr><td>Token expirado</td><td>Gerar permanente e redeploy</td></tr>
        <tr><td>HTTPS inválido</td><td>Certificado / domínio público</td></tr>
        </tbody></table>
        """),
        ("Prompt WA", "Prompt Claude Code · Redis + WhatsApp", """
        <div class="script-bubble"><span class="label">Prompt</span>No VB Solution CRM (pasta VBSOLUTIONCRMCodigoFonte-main/backend), liste no .env.example todas as variáveis de Redis e WhatsApp (Baileys e Cloud API). Monte um .env de produção com as três REDIS_* iguais, VERIFY_TOKEN, e explique o passo a passo do menu Conexões para QR e o webhook https://SUA-API/webhook/ para a Meta. Não commit segredos.</div>
        """),
        ("Prompt Meta", "Prompt Claude Code · webhook Meta", """
        <div class="script-bubble"><span class="label">Prompt</span>Minha API está em https://[COLE]. Quero WhatsApp Cloud API. Gere o checklist: app Meta, Phone Number ID, token permanente, VERIFY_TOKEN, Callback URL, variáveis .env, reinício da API e teste de mensagem. Se eu colar o erro do webhook, diagnostique.</div>
        """),
        ("ngrok", "ngrok só para teste local", f"""
        <p class="lead">A Meta não alcança localhost. Em teste, um túnel HTTPS temporário ajuda.</p>
        <ol>
        <li>Instale ngrok: {a("https://ngrok.com")}</li>
        <li><span class="inline-code">ngrok http 3000</span></li>
        <li>Use a URL https gerada em PUBLIC_BACKEND_URL e no webhook.</li>
        <li>Não use ngrok como produção.</li>
        </ol>
        <div class="callout warn">URL do ngrok muda a cada sessão free. Atualize o webhook sempre.</div>
        """),
        ("Segurança", "Segurança de tokens e sessão", """
        <ul class="checklist">
        <li>Tokens só no backend / Variables</li>
        <li>Rotacionar token se vazou</li>
        <li>VERIFY_TOKEN forte e único</li>
        <li>Não compartilhar QR em print público</li>
        <li>Backup da sessão Baileys com acesso restrito</li>
        </ul>
        """),
        ("FAQ", "FAQ WhatsApp e serviços", """
        <div class="qa"><div class="q">Posso usar QR e Oficial juntos?</div><div class="a">Sim, em conexões diferentes, com cuidado de números e configuração. Comece por um canal.</div></div>
        <div class="qa"><div class="q">Redis na mesma VPS da API?</div><div class="a">Sim, é comum. Na Railway use o plugin.</div></div>
        <div class="qa"><div class="q">Vercel recebe webhook?</div><div class="a">Não. Webhook e WhatsApp são da API.</div></div>
        <div class="qa"><div class="q">Campanha sem Redis?</div><div class="a">Não conte com isso. Ligue o Redis antes.</div></div>
        """),
        ("Go-live", "Checklist go-live dos serviços", """
        <ul class="checklist">
        <li>Redis produção com as três variáveis</li>
        <li>Canal escolhido (QR ou Oficial) testado ponta a ponta</li>
        <li>SMTP testado (e-mail chega)</li>
        <li>Volume/sessão se Baileys</li>
        <li>Webhook Meta verde se Oficial</li>
        <li>Cliente avisado: desligar API = WhatsApp cai</li>
        </ul>
        """),
        ("Fim", "Encerramento + links", f"""
        <p class="lead">Com Redis e um canal WhatsApp estáveis, o CRM deixa de ser só tela e passa a atender de verdade.</p>
        <ul>
        <li>Meta Developers: {a("https://developers.facebook.com/")}</li>
        <li>Railway: {a("https://railway.app")}</li>
        <li>Docker Desktop: {a("https://www.docker.com/products/docker-desktop/")}</li>
        <li>Código-fonte: {a("https://github.com/visaobusinesstech/codigo-fonte-COUTINHO")}</li>
        </ul>
        <div class="callout"><strong>Visão Business · VB Solution CRM</strong><br/>Material de treinamento · WhatsApp e Serviços · © Visão Business</div>
        """),
    ]
    assert len(bodies) == 34
    for i, (k, t, b) in enumerate(bodies, start=2):
        pages.append(page(m, k, t, b, i))
    return head("Treinamento · WhatsApp e Serviços · VB Solution CRM") + "".join(pages) + "\n</body>\n</html>\n"


# ---------------------------------------------------------------------------
# 05 INSTALACAO LOCAL
# ---------------------------------------------------------------------------
def build_local() -> str:
    m = "Instalação Local"
    pages = [cover(
        "SÉRIE CÓDIGO-FONTE · MÓDULO LOCAL",
        "Instalação Local · VB Solution CRM",
        "Tutorial para leigo: instalar Node, preparar .env, subir API e painel no seu computador, fazer o primeiro login e saber o que fazer no primeiro dia de uso.",
        [("Público", "Compradores do código-fonte"), ("Ambiente", "Windows · Mac · Ubuntu"), ("Modos", "Demo ou Postgres"), ("Resultado", "CRM em localhost")],
    )]
    bodies = [
        ("Mapa", "Sumário · o que você vai aprender", f"""
        <p class="lead">Do download ao login. Depois, o caminho para nuvem (Supabase, Railway, Vercel) fica mais fácil.</p>
        <div class="two-col"><div><ol class="toc">
        <li>Peças e stack (3 a 4)</li><li>Requisitos e installs (5 a 9)</li>
        <li>Código e pastas (10 a 11)</li><li>Demo e .env (12 a 14)</li>
        </ol></div><div><ol class="toc">
        <li>Subir API e painel (15 a 21)</li><li>Primeiro uso (22 a 27)</li>
        <li>Prompts e FAQ (28 a 34)</li><li>Encerramento (35)</li>
        </ol></div></div>
        <div class="link-box"><strong>Código-fonte</strong><div class="url">{a("https://github.com/visaobusinesstech/codigo-fonte-COUTINHO")}</div></div>
        """),
        ("Peças", "O que você está instalando", """
        <p class="lead">Três peças no PC:</p>
        <table class="compact"><thead><tr><th>Peça</th><th>Pasta</th><th>Função</th></tr></thead><tbody>
        <tr><td>Painel</td><td>frontend</td><td>O que você vê no Chrome</td></tr>
        <tr><td>API</td><td>backend</td><td>Login, tickets, WhatsApp, regras</td></tr>
        <tr><td>Banco</td><td>Postgres ou demo</td><td>Onde os dados ficam</td></tr>
        </tbody></table>
        <div class="callout">Redis entra quando for WhatsApp e campanhas. No primeiro login demo, o foco é ver a tela.</div>
        """),
        ("Stack", "Stack e portas", """
        <table class="compact"><thead><tr><th>Serviço</th><th>Porta</th><th>URL</th></tr></thead><tbody>
        <tr><td>API Node</td><td>3000</td><td>http://localhost:3000</td></tr>
        <tr><td>Frontend React</td><td>5181 (ou a do PORT=)</td><td>http://localhost:5181</td></tr>
        <tr><td>PostgreSQL</td><td>5432</td><td>local ou Supabase</td></tr>
        <tr><td>Redis</td><td>6379</td><td>redis://127.0.0.1:6379</td></tr>
        </tbody></table>
        <div class="callout warn">Alguns manuais citam painel na 3001. Vale o que estiver em frontend/.env.development (PORT=). Alinhe FRONTEND_URL na API.</div>
        """),
        ("Req", "Requisitos · lista de compras", f"""
        <table class="compact"><thead><tr><th>Item</th><th>Detalhe</th></tr></thead><tbody>
        <tr><td>Node.js</td><td>20 LTS · {a("https://nodejs.org")}</td></tr>
        <tr><td>npm</td><td>Vem com o Node</td></tr>
        <tr><td>PostgreSQL</td><td>Local, Supabase ou demo DEV_NO_DB</td></tr>
        <tr><td>Redis</td><td>Docker recomendado</td></tr>
        <tr><td>Git</td><td>Opcional · {a("https://git-scm.com")}</td></tr>
        <tr><td>Editor</td><td>VS Code / Cursor / Bloco de Notas</td></tr>
        </tbody></table>
        """),
        ("Node", "Instalar Node 20", f"""
        <h3>Windows</h3>
        <p>Baixe o MSI 20.x LTS em {a("https://nodejs.org")}. Marque PATH. Feche todos os PowerShells e abra de novo.</p>
        <code>node -v
npm -v</code>
        <p>Esperado: v20.x e um número de npm.</p>
        <h3>Mac</h3>
        <p>.pkg LTS 20 ou <span class="inline-code">brew install node@20</span>.</p>
        <h3>Ubuntu</h3>
        <code>curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs</code>
        """),
        ("Postgres", "PostgreSQL · três caminhos", """
        <div class="module-grid">
        <div class="module-item"><strong>A · Supabase</strong><span>Recomendado para ir à nuvem depois (veja o PDF Supabase)</span></div>
        <div class="module-item"><strong>B · Windows local</strong><span>Instalador em postgresql.org · anote senha e porta 5432</span></div>
        <div class="module-item"><strong>C · Demo</strong><span>DEV_NO_DB=true · login admin@local.dev · não grava de verdade</span></div>
        <div class="module-item"><strong>Docker</strong><span>postgres:16 na porta 5432 se preferir container</span></div>
        </div>
        """),
        ("Redis", "Redis com Docker no PC", """
        <code>docker run -d --name vbs-redis -p 6379:6379 redis:7
redis-cli ping</code>
        <p>No .env do backend (quando for usar WhatsApp):</p>
        <code>REDIS_URI=redis://127.0.0.1:6379
REDIS_URL=redis://127.0.0.1:6379
REDIS_URI_ACK=redis://127.0.0.1:6379</code>
        <div class="callout">No primeiro dia só de UI, pode deixar Redis para depois. Antes de Conexões WhatsApp, ligue.</div>
        """),
        ("Pasta", "Git, pasta e OneDrive", f"""
        <p class="lead">Evite pasta dentro do OneDrive no meio do npm install (trava arquivo).</p>
        <p>Sugestão Windows: <span class="inline-code">C:\\CRM\\VBSOLUTIONCRMCodigoFonte-main</span></p>
        <div class="link-box"><strong>Repositório</strong><div class="url">{a("https://github.com/visaobusinesstech/codigo-fonte-COUTINHO")}</div></div>
        <p>Você pode receber ZIP pela Visão Business. Git clone só depois de acesso Collaborator, se combinado.</p>
        """),
        ("Download", "Baixar o código (ZIP ou Git)", f"""
        <h3>ZIP</h3>
        <ol><li>Baixe o ZIP enviado.</li><li>Extraia.</li><li>Abra a pasta que contém <span class="inline-code">backend</span> e <span class="inline-code">frontend</span>.</li></ol>
        <h3>Git</h3>
        <code>git clone https://github.com/visaobusinesstech/codigo-fonte-COUTINHO.git
cd codigo-fonte-COUTINHO/VBSOLUTIONCRMCodigoFonte-main</code>
        <div class="callout warn">Repo privado sem convite = 404. Aceite o convite Collaborator no e-mail do GitHub.</div>
        """),
        ("Estrutura", "Estrutura de pastas certas", """
        <code>VBSOLUTIONCRMCodigoFonte-main/
  backend/
  frontend/
  DOCUMENTACAO/
  .env.example</code>
        <p>No PowerShell:</p>
        <code>cd CAMINHO\\VBSOLUTIONCRMCodigoFonte-main
dir</code>
        <p>Você deve ver backend e frontend como irmãs. Se abriu a pasta errada (só a raiz do download), entre um nível.</p>
        """),
        ("Demo", "Modo demo · DEV_NO_DB=true", """
        <code>cd backend
copy .env.example .env</code>
        <code>DEV_NO_DB=true
DEV_AUTH_EMAIL=admin@local.dev
DEV_AUTH_PASSWORD=123456
NODE_ENV=development
PORT=3000
BACKEND_URL=http://localhost:3000
PUBLIC_BACKEND_URL=http://localhost:3000
FRONTEND_URL=http://localhost:5181</code>
        <div class="callout"><strong>Login demo</strong><br/>admin@local.dev · senha do .env (ex. 123456)</div>
        <p>Ideal para ver o menu. Não use em produção.</p>
        """),
        ("Env banco", ".env backend com banco real", """
        <code>DEV_NO_DB=false
DB_DIALECT=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASS=suaSenha
DB_NAME=vbsolution
DB_SSL=false</code>
        <p>Ou cole DATABASE_URL do Supabase com DB_SSL=true (veja PDF Supabase).</p>
        <div class="callout">Gere JWT novos:</div>
        <code>openssl rand -base64 32
openssl rand -base64 32</code>
        <p>Cole em JWT_SECRET e JWT_REFRESH_SECRET (valores diferentes).</p>
        """),
        ("JWT Redis", "JWT e Redis no local", """
        <table class="compact"><thead><tr><th>Variável</th><th>Local</th></tr></thead><tbody>
        <tr><td>JWT_SECRET</td><td>String longa única</td></tr>
        <tr><td>JWT_REFRESH_SECRET</td><td>Outra string longa</td></tr>
        <tr><td>REDIS_*</td><td>redis://127.0.0.1:6379 (se Docker up)</td></tr>
        </tbody></table>
        <div class="callout warn">Trocar JWT depois = todo mundo desloga. Normal em estudo; em produção avise o time.</div>
        """),
        ("Install BE", "npm install no backend", """
        <code>cd VBSOLUTIONCRMCodigoFonte-main/backend
npm install</code>
        <p>Pode levar 10 a 25 minutos na primeira vez. Deixe o terminal aberto.</p>
        <div class="callout danger">Erro “npm não reconhecido”: Node 20 não está no PATH. Reabra o terminal após instalar.</div>
        """),
        ("Migrate", "db:migrate e admin:local-dev", """
        <p>Só se DEV_NO_DB=false:</p>
        <code>npm run db:migrate
npm run admin:local-dev</code>
        <p>No modo demo, pule o migrate.</p>
        <div class="card blue"><h4>Sucesso</h4><p>Prompt volta sem stack vermelho. Admin criado (anote e-mail/senha).</p></div>
        """),
        ("Dev BE", "Subir a API · npm run dev", """
        <code>npm run dev</code>
        <p>Espere algo como “Servidor iniciado na porta 3000”. <strong>Não feche</strong> este terminal.</p>
        <div class="callout warn">Na primeira compile TypeScript pode demorar. Se passar de 20–30 min, leia o erro (Redis/Postgres).</div>
        """),
        ("FE env", "Frontend · .env.development", """
        <code>cd VBSOLUTIONCRMCodigoFonte-main/frontend
dir -Force</code>
        <p>Crie ou edite <span class="inline-code">.env.development</span>:</p>
        <code>PORT=5181
REACT_APP_BACKEND_URL=http://localhost:3000
DISABLE_ESLINT_PLUGIN=true</code>
        <div class="callout">Sem barra no final da URL. Esse valor precisa ser a API que está rodando.</div>
        """),
        ("Dev FE", "npm install e npm start no frontend", """
        <p>Abra <strong>outro</strong> PowerShell:</p>
        <code>cd VBSOLUTIONCRMCodigoFonte-main/frontend
npm install
npm start</code>
        <p>Abra o Chrome em <strong>http://localhost:5181</strong> (ou a porta do PORT=).</p>
        <div class="callout">Dois terminais vivos: A = backend, B = frontend.</div>
        """),
        ("Login", "Primeiro login", """
        <ul>
        <li><strong>Demo:</strong> admin@local.dev + senha do .env</li>
        <li><strong>Com banco:</strong> usuário do admin:local-dev / seed</li>
        </ul>
        <div class="callout warn">Não autorizado? Caps Lock, JWT mudou (limpe Local Storage), DEV_NO_DB inconsistente, ou API fora.</div>
        <p>Depois do login você deve ver Dashboard / menu do CRM.</p>
        """),
        ("Dois term", "Checklist dos dois terminais", """
        <ul class="checklist">
        <li>Terminal A: backend na 3000 sem erro vermelho</li>
        <li>Terminal B: frontend compilou</li>
        <li>Chrome abriu a URL certa</li>
        <li>Login ok</li>
        <li>F12 Network: chamadas vão para localhost:3000</li>
        </ul>
        """),
        ("Problemas", "Problemas comuns no local", """
        <table class="compact"><thead><tr><th>Problema</th><th>Ação</th></tr></thead><tbody>
        <tr><td>npm não reconhecido</td><td>Node 20 + terminal novo</td></tr>
        <tr><td>Cannot find module</td><td>Apagar node_modules + npm install</td></tr>
        <tr><td>Porta 3000 em uso</td><td>Mudar PORT + REACT_APP_BACKEND_URL</td></tr>
        <tr><td>Porta 5181 em uso</td><td>PORT=5182 + FRONTEND_URL</td></tr>
        <tr><td>Tela branca</td><td>F12 Console</td></tr>
        <tr><td>Demo não entra</td><td>DEV_NO_DB=true + reiniciar API</td></tr>
        </tbody></table>
        """),
        ("Primeiro uso", "Primeiro uso com banco real", """
        <p class="lead">API ligada, migrate ok, DEV_NO_DB=false.</p>
        <ol>
        <li>Login do seed/admin</li>
        <li>Empresas / Usuários · um usuário por corretor</li>
        <li>Filas (Vendas, Locação, Suporte)</li>
        <li>Tickets de teste</li>
        </ol>
        <div class="callout">WhatsApp fica para depois do Redis e da API estáveis (PDF WhatsApp).</div>
        """),
        ("Cadastros", "Empresas, usuários e filas", """
        <ul>
        <li>Não apague a empresa padrão no primeiro dia.</li>
        <li>Crie usuários com e-mail real do time.</li>
        <li>Configure filas antes de atender cliente.</li>
        </ul>
        <div class="card blue"><h4>Meta do dia 1</h4><p>Login + um usuário extra + uma fila + um ticket manual. Já é vitória.</p></div>
        """),
        ("WA depois", "Conectar WhatsApp depois", """
        <p>Ordem: Redis PONG → API no ar → menu Conexões → QR ou Oficial.</p>
        <p>Detalhes completos no material <strong>WhatsApp e Serviços</strong>.</p>
        <div class="callout warn">Não use o número principal da empresa no primeiro teste.</div>
        """),
        ("Imóveis", "Cadastros · imóveis e contratos", """
        <ol>
        <li>Proprietários</li>
        <li>Imóveis</li>
        <li>Contratos</li>
        <li>Pipeline / Negócios</li>
        </ol>
        <p>Módulos como RadarZAP, Portais e SEO podem começar vazios: use Novo / Analisar na primeira visita.</p>
        """),
        ("Não fazer", "O que não fazer no 1º dia", """
        <ul class="checklist">
        <li>Apagar empresa padrão</li>
        <li>Rodar db:migrate:undo em dado importante</li>
        <li>Mesmo WhatsApp em homolog e produção</li>
        <li>Commitar .env no GitHub</li>
        <li>Colocar API na Vercel</li>
        </ul>
        """),
        ("Prompt install", "Prompt Claude Code · instalação", """
        <div class="script-bubble"><span class="label">Prompt</span>Siga a instalação local do VB Solution CRM em VBSOLUTIONCRMCodigoFonte-main: copie backend/.env.example para .env, configure DEV_NO_DB=true para demo (ou Postgres se eu indicar), suba npm install + npm run dev na API (porta 3000) e no frontend PORT=5181 com REACT_APP_BACKEND_URL=http://localhost:3000. Liste erros do terminal se o login falhar. Não commit .env.</div>
        """),
        ("Prompt erro", "Prompt Claude Code · diagnosticar erros", """
        <div class="script-bubble"><span class="label">Prompt</span>O CRM local falhou. Segue a saída do terminal: [COLE AQUI]. Diagnostique porta em uso, módulo faltando, DEV_NO_DB, JWT, Redis ECONNREFUSED ou Postgres. Me dê os comandos exatos para corrigir no Windows PowerShell.</div>
        """),
        ("Portas", "Alinhar FRONTEND_URL e PORT", """
        <p>Se mudar a porta do painel:</p>
        <ol>
        <li>frontend: PORT=5182</li>
        <li>backend: FRONTEND_URL=http://localhost:5182</li>
        <li>Reinicie os dois terminais</li>
        </ol>
        <div class="callout">CORS no local quase sempre é URL diferente entre o que o Chrome mostra e o FRONTEND_URL.</div>
        """),
        ("Check ok", "Checklist · instalação local ok", """
        <ul class="checklist">
        <li>node -v mostra v20</li>
        <li>backend npm run dev ok</li>
        <li>frontend npm start ok</li>
        <li>Login funciona</li>
        <li>.env não está no Git</li>
        <li>Sei se estou em demo ou banco real</li>
        </ul>
        """),
        ("FAQ", "FAQ instalação local", """
        <div class="qa"><div class="q">Preciso de Redis no primeiro login?</div><div class="a">Não para ver o menu em demo. Sim antes de WhatsApp/campanha.</div></div>
        <div class="qa"><div class="q">Posso usar Node 18?</div><div class="a">Use 20 LTS. Evita surpresa de dependência.</div></div>
        <div class="qa"><div class="q">npm install trava</div><div class="a">Saia do OneDrive, libere disco, feche antivírus por um momento e tente de novo.</div></div>
        <div class="qa"><div class="q">Onde está a documentação MD?</div><div class="a">Pasta DOCUMENTACAO no download e dentro do código-fonte.</div></div>
        """),
        ("Próximos", "Próximos passos na nuvem", """
        <ol>
        <li>PDF Supabase: banco na nuvem</li>
        <li>PDF VPS/Railway: API 24h</li>
        <li>PDF Vercel: painel público</li>
        <li>PDF WhatsApp: canal e Redis produção</li>
        </ol>
        <div class="card blue"><h4>Receita clássica</h4><p>Supabase + Redis Railway + API Railway + painel Vercel</p></div>
        """),
        ("Cliente", "O que entregar ao cliente", """
        <ul class="checklist">
        <li>URL do painel e da API (quando publicados)</li>
        <li>Login admin por canal seguro</li>
        <li>Pasta DOCUMENTACAO/</li>
        <li>Aviso: .env não vai no GitHub</li>
        <li>Se falhar: print + logs + últimas 20 linhas do terminal</li>
        </ul>
        """),
        ("Fim", "Encerramento + links", f"""
        <p class="lead">Com o CRM rodando no localhost, você já entende as três peças. O resto é apontar URLs para a nuvem.</p>
        <ul>
        <li>Node.js: {a("https://nodejs.org")}</li>
        <li>Git: {a("https://git-scm.com")}</li>
        <li>Código: {a("https://github.com/visaobusinesstech/codigo-fonte-COUTINHO")}</li>
        <li>Docker: {a("https://www.docker.com/products/docker-desktop/")}</li>
        </ul>
        <div class="callout"><strong>Visão Business · VB Solution CRM</strong><br/>Material de treinamento · Instalação Local · © Visão Business</div>
        """),
    ]
    assert len(bodies) == 34
    for i, (k, t, b) in enumerate(bodies, start=2):
        pages.append(page(m, k, t, b, i))
    return head("Treinamento · Instalação Local · VB Solution CRM") + "".join(pages) + "\n</body>\n</html>\n"


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    files = {
        "03-supabase.html": build_supabase(),
        "04-whatsapp-servicos.html": build_whatsapp(),
        "05-instalacao-local.html": build_local(),
    }
    for name, html in files.items():
        path = OUT / name
        path.write_text(html, encoding="utf-8")
        count = html.count('<section class="page')
        print(f"Wrote {path.name}: {count} pages, {len(html)} chars")
        if count != 35:
            raise SystemExit(f"Expected 35 pages in {name}, got {count}")


if __name__ == "__main__":
    main()
