# Subir a API numa VPS Ubuntu (passo a passo de leigo)

VPS é um computador alugado na nuvem (DigitalOcean, Contabo, Hostinger, AWS Lightsail…). Você entra nele por SSH, como se fosse o Prompt de Comando, mas o computador fica ligado 24 h.

**Recomendação deste cliente:** Postgres no **Supabase**, painel na **Vercel**, e nesta VPS só: **Node + Redis + Nginx + PM2**. Assim a VPS não precisa ser enorme.

Mínimo sugerido: 2 vCPU, 4 GB de RAM, Ubuntu 22.04, disco 40 GB+. WhatsApp come RAM.

Domínios de exemplo neste texto:

- painel: `https://crm.suaempresa.com` (pode ser Vercel)
- API: `https://api.suaempresa.com` (esta VPS)

---

## Passo 1 — Comprar a VPS e anotar

Anote: IP (tipo `192.0.2.10`), usuário (`root` ou `ubuntu`), senha ou chave SSH.

No Windows, abra PowerShell:

```powershell
ssh root@IP_DA_VPS
```

Na primeira vez pergunta se confia no servidor: digite `yes`. Depois a senha (não aparece).

## Passo 2 — Atualizar o Ubuntu

```bash
sudo apt update
sudo apt upgrade -y
```

Pode pedir para reiniciar serviços: Enter nas opções padrão.

## Passo 3 — Instalar Node 20, Nginx, Redis, Git, certificado

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs nginx redis-server git certbot python3-certbot-nginx
node -v
```

Tem que mostrar v20.

Instale o PM2 (fica rodando a API se o SSH fechar):

```bash
sudo npm install -g pm2
```

**Postgres na VPS?** Só se você **não** for usar Supabase. Aí: `sudo apt install -y postgresql` e [03-BANCO-DE-DADOS.md](./03-BANCO-DE-DADOS.md). Com Supabase, pule o Postgres local.

## Passo 4 — Ligar o Redis

```bash
sudo systemctl enable redis-server
sudo systemctl start redis-server
redis-cli ping
```

Resposta: `PONG`.

## Passo 5 — Colocar o código no servidor

```bash
sudo mkdir -p /var/www/vbsolution
sudo chown $USER:$USER /var/www/vbsolution
cd /var/www/vbsolution
git clone https://github.com/visaobusinesstech/codigo-fonte-COUTINHO.git .
```

Se o Git pedir login, use um **Personal Access Token** no lugar da senha (GitHub → Settings → Developer settings → Tokens).

Ajuste o caminho: o `backend` pode estar em `VBSOLUTIONCRMCodigoFonte-main/backend` dentro do clone. Entre **nessa** pasta. Confira com `ls`.

## Passo 6 — `.env` da API

```bash
cd /var/www/vbsolution/VBSOLUTIONCRMCodigoFonte-main/backend
cp .env.example .env
nano .env
```

`nano` é o editor. Setas para mexer, Ctrl+O Enter para salvar, Ctrl+X para sair.

Preencha como em [04-VARIAVEIS-DE-AMBIENTE.md](./04-VARIAVEIS-DE-AMBIENTE.md):

- `DEV_NO_DB=false`
- `NODE_ENV=production`
- `DATABASE_URL` do Supabase e `DB_SSL=true`
- JWT novos
- Redis `redis://127.0.0.1:6379` (nesta máquina)
- `PORT=3000`
- `BACKEND_URL=https://api.suaempresa.com`
- `PUBLIC_BACKEND_URL=https://api.suaempresa.com`
- `FRONTEND_URL=https://crm.suaempresa.com` (ou URL da Vercel)

## Passo 7 — Instalar, migrar, build, ligar

```bash
npm install --omit=dev
npm run build
npm run db:migrate
pm2 start dist/server.js --name vbs-api
pm2 save
pm2 startup
```

O último comando `pm2 startup` **imprime** um comando `sudo ...` — copie e execute para a API voltar depois de reboot.

`pm2 logs vbs-api` — deve dizer que o servidor iniciou. Erro de banco aparece aqui.

Se o `package.json` mandar `npm start` (migrate + dist), pode usar:

```bash
pm2 start npm --name vbs-api -- start
```

## Passo 8 — Nginx como porteiro (HTTPS e WebSocket)

```bash
sudo nano /etc/nginx/sites-available/vbs-api
```

Cole (trocando o domínio):

```nginx
server {
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
}
```

As linhas `Upgrade` e `Connection` são o que deixam o **chat ao vivo** funcionar. Sem elas, o ticket “pisca” e cai.

```bash
sudo ln -s /etc/nginx/sites-available/vbs-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

No site do domínio, crie um **A record**: `api` → IP da VPS.

Espere o DNS (às vezes 5 minutos, às vezes algumas horas). Teste: `ping api.suaempresa.com`.

## Passo 9 — Certificado grátis (HTTPS)

```bash
sudo certbot --nginx -d api.suaempresa.com
```

Informe o e-mail, aceite, escolha redirect para HTTPS. Sem HTTPS o WhatsApp Cloud e os navegadores modernos reclamam.

## Passo 10 — Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

**Não** libere 5432 nem 3000 para o mundo. O mundo fala com 443; o Nginx fala com 3000 por dentro.

## Passo 11 — Painel: Vercel ou Nginx estático

Vercel: [15-VERCEL.md](./15-VERCEL.md) com `REACT_APP_BACKEND_URL=https://api.suaempresa.com`.

Ou, nesta mesma VPS, `npm run build` no frontend e um `server` Nginx com `root` na pasta `build` e `try_files $uri /index.html`. Detalhes em [08-HOSPEDAGEM-FRONTEND.md](./08-HOSPEDAGEM-FRONTEND.md).

## Passo 12 — Atualizar o sistema no futuro

```bash
cd /var/www/vbsolution
git pull
cd VBSOLUTIONCRMCodigoFonte-main/backend
npm install --omit=dev
npm run build
npm run db:migrate
pm2 restart vbs-api
```

Se o frontend também estiver nesta máquina, entre em `frontend`, `npm install`, `npm run build`.

## Se der ruim

- 502 Bad Gateway: API caiu. `pm2 logs vbs-api`.
- Certbot falha: DNS ainda não aponta para este IP.
- WhatsApp desconecta: VPS reiniciou sem `pm2 startup`, ou Redis caiu (`systemctl status redis`).
- Disco cheio: `df -h` e limpe logs `pm2 flush`.
