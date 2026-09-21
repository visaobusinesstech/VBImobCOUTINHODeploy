# Hospedagem em VPS (Ubuntu)

Exemplo: 2 vCPU, 4 GB RAM, Ubuntu 22.04. Domínio `crm.seudominio.com` (painel) e `api.seudominio.com` (backend).

**Banco no Supabase (recomendado para o cliente):** não instale PostgreSQL na VPS. Siga [14-SUPABASE-PASSO-A-PASSO.md](./14-SUPABASE-PASSO-A-PASSO.md) e no `.env` da API use `DATABASE_URL` + `DB_SSL=true`. Na VPS fique **Node + Redis + Nginx + PM2**. O painel pode ir para a [Vercel](./15-VERCEL.md) em vez do Nginx estático.

Se quiser Postgres local na VPS, continue abaixo (`apt install postgresql`).

## 1. Servidor

```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs nginx postgresql redis-server git certbot python3-certbot-nginx
sudo npm i -g pm2
```

Crie o banco (usuário e `vbsolution`) como em [03-BANCO-DE-DADOS.md](./03-BANCO-DE-DADOS.md).

## 2. Código

```bash
sudo mkdir -p /var/www/vbsolution
sudo chown $USER:$USER /var/www/vbsolution
cd /var/www/vbsolution
# copie o repositório (git clone ou scp do zip)
```

## 3. Backend

```bash
cd /var/www/vbsolution/backend
cp .env.example .env
nano .env
```

Ajuste:

```
NODE_ENV=production
PORT=3000
BACKEND_URL=https://api.seudominio.com
PUBLIC_BACKEND_URL=https://api.seudominio.com
FRONTEND_URL=https://crm.seudominio.com
DEV_NO_DB=false
```

```bash
npm install --omit=dev
npm run build
npm run db:migrate
pm2 start dist/server.js --name vbs-api
pm2 save
pm2 startup
```

Se o start oficial for `npm start` (migrate + `dist/server.js`), use isso no PM2:

```bash
pm2 start npm --name vbs-api -- start
```

## 4. Frontend

```bash
cd /var/www/vbsolution/frontend
echo REACT_APP_BACKEND_URL=https://api.seudominio.com > .env.production
npm install
npm run build
```

A pasta `frontend/build` será o site estático.

## 5. Nginx

`/etc/nginx/sites-available/vbs-api`:

```nginx
server {
  listen 80;
  server_name api.seudominio.com;
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

`/etc/nginx/sites-available/vbs-web`:

```nginx
server {
  listen 80;
  server_name crm.seudominio.com;
  root /var/www/vbsolution/frontend/build;
  index index.html;
  location / {
    try_files $uri /index.html;
  }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/vbs-api /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/vbs-web /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d api.seudominio.com -d crm.seudominio.com
```

## 6. Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

Não exponha 5432/6379 na internet.

## 7. Atualizar

```bash
cd /var/www/vbsolution
git pull
cd backend && npm install --omit=dev && npm run build && npm run db:migrate && pm2 restart vbs-api
cd ../frontend && npm install && npm run build
```
