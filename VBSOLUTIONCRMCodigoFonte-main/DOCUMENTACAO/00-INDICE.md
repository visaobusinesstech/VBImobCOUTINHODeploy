# Documentação — VB Solution CRM (com CRM imobiliário)

Comece por **[16-GUIA-CLIENTE.md](./16-GUIA-CLIENTE.md)** se for publicar para o cliente (Supabase + Railway/VPS + Vercel).

| Arquivo | Conteúdo |
|---|---|
| [00-INDICE.md](./00-INDICE.md) | Este índice |
| [01-REQUISITOS.md](./01-REQUISITOS.md) | Node, Postgres, Redis, Git |
| [02-INSTALACAO-LOCAL.md](./02-INSTALACAO-LOCAL.md) | Passo a passo no Windows / Linux / Mac |
| [03-BANCO-DE-DADOS.md](./03-BANCO-DE-DADOS.md) | PostgreSQL, migrate, seed, SSL |
| [04-VARIAVEIS-DE-AMBIENTE.md](./04-VARIAVEIS-DE-AMBIENTE.md) | Todas as variáveis backend e frontend |
| [05-SUPABASE.md](./05-SUPABASE.md) | Radar usava Supabase; o CRM usa Postgres |
| [06-VPS.md](./06-VPS.md) | Ubuntu, Nginx, PM2, HTTPS |
| [07-RAILWAY.md](./07-RAILWAY.md) | Deploy no Railway (API + Postgres + Redis) |
| [08-HOSPEDAGEM-FRONTEND.md](./08-HOSPEDAGEM-FRONTEND.md) | Build estático, Nginx, Cloudflare |
| [09-WHATSAPP-E-SERVICOS.md](./09-WHATSAPP-E-SERVICOS.md) | Baileys, Cloud API, Redis, storage |
| [10-MAPA-PROJECT.md](./10-MAPA-PROJECT.md) | Rotas do `project/` dentro deste CRM |
| [11-CHECKLIST.md](./11-CHECKLIST.md) | Checklist de go-live |
| [12-MENU.md](./12-MENU.md) | Menu único do CRM, organizado por grupos |
| [13-PASTA-PROJECT.md](./13-PASTA-PROJECT.md) | Pode apagar a pasta Vite `project/` |
| [14-SUPABASE-PASSO-A-PASSO.md](./14-SUPABASE-PASSO-A-PASSO.md) | Postgres do Supabase no CRM |
| [15-VERCEL.md](./15-VERCEL.md) | Painel React na Vercel |
| [16-GUIA-CLIENTE.md](./16-GUIA-CLIENTE.md) | Ordem de instalação e publicação |

Código principal:

- Backend: `backend/` (Express + Sequelize + PostgreSQL)
- Frontend: `frontend/` (React CRA / CRACO, porta **5181**)
- A pasta `project/` pode ser apagada; ver [13-PASTA-PROJECT.md](./13-PASTA-PROJECT.md).
