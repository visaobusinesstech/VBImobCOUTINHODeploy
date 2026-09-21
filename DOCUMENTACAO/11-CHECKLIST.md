# Checklist do dia de colocar no ar (não pule linha)

Imprima ou copie isto para um bloco de notas. Marque com X só depois de **fazer**, não de “achar que fez”.

## No computador de quem configura

- [ ] Node 20: `node -v` começa com v20
- [ ] Pasta `backend` com `npm install` terminado sem erro vermelho
- [ ] Pasta `frontend` com `npm install` terminado
- [ ] `.env` do backend existe (copiado do `.env.example`, **não** commitado)
- [ ] `.env` do frontend existe com `REACT_APP_BACKEND_URL`
- [ ] JWT_SECRET e JWT_REFRESH_SECRET são longos e **diferentes** um do outro
- [ ] `DEV_NO_DB=false` em qualquer ambiente que o cliente for usar de verdade

## Banco (Supabase ou outro Postgres)

- [ ] Projeto Supabase Healthy (ou Postgres local/`createdb` ok)
- [ ] URI **porta 5432** (não 6543) copiada no `.env`
- [ ] `DB_SSL=true` se for nuvem
- [ ] `npm run db:migrate` saiu **sem** exception
- [ ] Table Editor mostra tabelas (Users, Tickets, etc.)
- [ ] Usuário admin criado e senha guardada **fora** do GitHub
- [ ] Teste: login local contra esse banco funciona

## Redis

- [ ] Redis no ar (Docker, VPS ou plugin Railway)
- [ ] `REDIS_URI`, `REDIS_URL` e `REDIS_URI_ACK` preenchidos
- [ ] Ping ou log da API sem `ECONNREFUSED 6379`

## API (Railway ou VPS)

- [ ] Root Directory apontando para a pasta `backend` certa
- [ ] Build e Start iguais ao [07-RAILWAY.md](./07-RAILWAY.md) ou [06-VPS.md](./06-VPS.md)
- [ ] `NODE_ENV=production`
- [ ] `BACKEND_URL` e `PUBLIC_BACKEND_URL` = HTTPS público da API, sem barra no fim
- [ ] Logs: “Servidor iniciado” (ou equivalente)
- [ ] HTTPS válido (cadeado no Chrome)
- [ ] Volume/disco se for usar WhatsApp QR (Railway)
- [ ] PM2 `startup` se for VPS
- [ ] Firewall: 80/443 abertos; 3000 e 5432 **fechados** para o mundo

## Painel (Vercel ou outro)

- [ ] Root = pasta `frontend`
- [ ] `REACT_APP_BACKEND_URL` = mesma URL da API
- [ ] Rewrite SPA (`vercel.json` ou `try_files`)
- [ ] Site abre a tela de login
- [ ] Depois do login, F12 Network: requests vão para a API, **não** para localhost
- [ ] `FRONTEND_URL` na API = URL **exata** do painel (CORS)

## WhatsApp e e-mail (pode ser no dia 2)

- [ ] Conexão criada no menu
- [ ] QR lido **ou** webhook Meta verificado
- [ ] Mensagem de teste virou ticket
- [ ] SMTP testado se for usar campanha de e-mail

## Segurança e entrega

- [ ] `.env` não está no repositório (`git status` limpo desses arquivos)
- [ ] Senhas não foram mandadas em grupo de WhatsApp aberto
- [ ] Cliente recebeu URL do painel + este `DOCUMENTACAO/`
- [ ] Cliente sabe que desligar a API = WhatsApp cai
- [ ] Backup do banco combinado (quem faz, de quantos em quantos dias)

## Se alguma caixa ficou em branco

Não “vá para produção assim mesmo”. Volte ao capítulo correspondente: [16-GUIA-CLIENTE.md](./16-GUIA-CLIENTE.md) diz a ordem. [11-TROUBLESHOOTING.md](./11-TROUBLESHOOTING.md) diz o que cada erro costuma ser.
