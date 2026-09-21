# Instalação local (desenvolvimento)

Raiz do CRM: pasta `VBSOLUTIONCRMCodigoFonte-main/` (backend + frontend).

## 1. Instalar Node 20

- Windows: https://nodejs.org (LTS 20) ou `nvm-windows`
- Conferir:

```bash
node -v
npm -v
```

## 2. PostgreSQL e Redis (produção / ambiente real)

### Windows

- Postgres: instalador oficial ou Docker Desktop
- Redis: Memurai, Redis para Windows, ou Docker:

```bash
docker run -d --name vbs-pg -e POSTGRES_PASSWORD=senha -e POSTGRES_USER=vbsolution -e POSTGRES_DB=vbsolution -p 5432:5432 postgres:16
docker run -d --name vbs-redis -p 6379:6379 redis:7
```

### Linux / Mac

```bash
# exemplo Ubuntu
sudo apt update
sudo apt install -y postgresql redis-server
```

Crie o banco:

```sql
CREATE USER vbsolution WITH PASSWORD 'senha_forte';
CREATE DATABASE vbsolution OWNER vbsolution;
```

## 3. Variáveis de ambiente

Na pasta `backend/`:

```bash
copy .env.example .env
```

(Linux/Mac: `cp .env.example .env`)

Preencha `DB_*`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `REDIS_URI`.

Gere segredos:

```bash
openssl rand -base64 32
```

No frontend, `frontend/.env.development` já aponta para `http://localhost:3000`.

Para **só abrir o sistema sem banco**:

```
DEV_NO_DB=true
DEV_AUTH_EMAIL=admin@local.dev
DEV_AUTH_PASSWORD=123456
```

Para **usar Postgres de verdade**, defina `DEV_NO_DB=false` ou apague a linha.

## 4. Instalar dependências

Abra **dois** terminais na pasta do CRM.

```bash
cd backend
npm install
```

```bash
cd frontend
npm install
```

A instalação do backend pode demorar (Baileys, Playwright opcional, TypeScript).

## 5. Migrar o banco (se não estiver em DEV_NO_DB)

```bash
cd backend
npm run db:migrate
```

Opcional — usuário admin local (scripts no `package.json` do backend):

```bash
npm run admin:local-dev
```

## 6. Subir API e painel

Terminal 1:

```bash
cd backend
npm run dev
```

API padrão: **http://localhost:3000**

Terminal 2:

```bash
cd frontend
npm start
```

Painel padrão: **http://localhost:5181**

Faça login com o usuário criado no seed ou com `DEV_AUTH_*`.

## 7. Testes do módulo imobiliário

```bash
cd backend
npm run test:realty
```

## Problemas comuns

| Sintoma | Causa | Ação |
|---|---|---|
| Frontend abre e APIs 401/404 | Backend desligado ou `REACT_APP_BACKEND_URL` errada | Conferir porta 3000 |
| `ECONNREFUSED 5432` | Postgres parado ou `DEV_NO_DB` off | Ligar o banco ou ativar demo |
| Redis timeout | Sem Redis | Instalar Redis ou aceitar filas degradadas |
| Tela branca no CRA | Node 18 vs 20 | Usar Node 20 |
| CORS | `FRONTEND_URL` diferente da URL do browser | Igualar origem (ex. `http://localhost:5181`) |
