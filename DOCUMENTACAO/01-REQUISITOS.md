# Requisitos

## Obrigatório para produção

| Item | Versão sugerida | Para quê |
|---|---|---|
| Node.js | **20 LTS** (engines do frontend pedem `>=20`) | API e painel |
| npm | 10+ | Instalar dependências |
| PostgreSQL | 14, 15 ou 16 | Banco principal (leads, tickets, imóveis, WhatsApp) |
| Redis | 6 ou 7 | Filas Bull, campanhas, rate limit, agente |
| Git | 2.x | Clonar e atualizar |

## Opcional

- **Chrome / Chromium** — exportações e alguns fluxos de mídia (`CHROME_PATH`)
- **FFmpeg** — já vem via `@ffmpeg-installer/ffmpeg` no backend
- **Domínio + TLS** — Let's Encrypt (VPS) ou o certificado do Railway
- **Object storage** (S3 / Cloudflare R2 / disco da VPS) — mídias do WhatsApp

## Modo demo local **sem** Postgres

O backend aceita `DEV_NO_DB=true` (veja `.env.example`). Serve para **abrir o painel** e navegar. **Não use em produção.** Dados não persistem de verdade; WhatsApp e filas não ficam completos.

Login demo típico (confira o que está no seu `backend/.env`):

- e-mail: `admin@local.dev`
- senha: a definida em `DEV_AUTH_PASSWORD`

## O que **não** é requisito do VBSolution

- **Supabase** — usado só no `project/` (Radar). O CRM unificado grava em **PostgreSQL**.
- Conta Railway / Vercel — só se você escolher esses hosts.
