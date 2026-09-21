# Por onde começar (leia isto primeiro)

Olá. Este conjunto de arquivos é o **manual do CRM VB Solution** — o sistema unificado de atendimento WhatsApp, vendas, imóveis, IA, campanhas, calendário, respostas rápidas e o restante.

Você **não precisa ser programador**. Precisa de paciência, internet e de seguir os passos **na ordem**. Se pular um passo, o próximo costuma falhar e parece “bug”. Quase sempre é senha incompleta, programa não instalado, ou API apontando para o endereço errado.

Cada arquivo abaixo foi escrito como aula. Não há capítulo “resumido de propósito”: se um tema aparece em dois arquivos, é para o link antigo e o novo continuarem funcionando. Leia o da **ordem** primeiro.

## O que este sistema é, em palavras simples

Três peças:

1. **O painel** — o que você vê no Chrome (login, tickets, imóveis, menu). Pasta `frontend`.
2. **A API** — quem guarda conversas, leads, usuários e fala com o WhatsApp. Pasta `backend`. Precisa ficar ligada **24 horas** em produção.
3. **O banco PostgreSQL** — o arquivo inteligente. Pode ser no PC, na VPS, na Railway ou no **Supabase**.

Peça extra: **Redis** — filinha de campanhas, jobs e sessão. Sem Redis, o login até abre, mas WhatsApp e disparos travam.

## O que você não precisa

- Pasta `project/` (Radar Vite antigo). Pode apagar. [13-PASTA-PROJECT.md](./13-PASTA-PROJECT.md).
- Auth do Supabase. O login é o do próprio CRM.
- Colocar a **API** na Vercel. Vercel = **só o painel**. WhatsApp não mora na Vercel.

## Como estudar (um arquivo por vez)

| Ordem | Arquivo | O que você vai conseguir fazer depois |
|---|---|---|
| 1 | Este índice | Saber o mapa |
| 2 | [16-GUIA-CLIENTE.md](./16-GUIA-CLIENTE.md) | Seguir o roteiro do zero até o ar |
| 3 | [01-REQUISITOS.md](./01-REQUISITOS.md) | Instalar Node, Git, Docker, etc. |
| 4 | [02-INSTALACAO-LOCAL.md](./02-INSTALACAO-LOCAL.md) | Ver o CRM no seu PC |
| 5 | [14-SUPABASE-PASSO-A-PASSO.md](./14-SUPABASE-PASSO-A-PASSO.md) | Criar o banco na nuvem, clique a clique |
| 6 | [03-BANCO-DE-DADOS.md](./03-BANCO-DE-DADOS.md) | Entender migrate, SSL, backup |
| 7 | [04-VARIAVEIS-DE-AMBIENTE.md](./04-VARIAVEIS-DE-AMBIENTE.md) | Preencher cada linha do `.env` |
| 8 | [05-SUPABASE.md](./05-SUPABASE.md) | Entender que Supabase aqui é Postgres, não Auth |
| 9 | [05-PRIMEIRO-USO.md](./05-PRIMEIRO-USO.md) | Primeiro login, filas, imóveis |
| 10 | [06-VPS.md](./06-VPS.md) | Subir a API num Ubuntu |
| 11 | [07-RAILWAY.md](./07-RAILWAY.md) | Subir a API na Railway |
| 12 | [15-VERCEL.md](./15-VERCEL.md) | Subir o painel na Vercel |
| 13 | [08-HOSPEDAGEM-FRONTEND.md](./08-HOSPEDAGEM-FRONTEND.md) | Netlify, Cloudflare, Nginx |
| 14 | [09-WHATSAPP-REDIS-EMAIL.md](./09-WHATSAPP-REDIS-EMAIL.md) | Redis, QR, Cloud API, SMTP |
| 15 | [09-WHATSAPP-E-SERVICOS.md](./09-WHATSAPP-E-SERVICOS.md) | O mesmo tema (nome antigo do arquivo) |
| 16 | [11-CHECKLIST.md](./11-CHECKLIST.md) | Marcar o dia do go-live |
| 17 | [11-TROUBLESHOOTING.md](./11-TROUBLESHOOTING.md) | Quando der tela branca, CORS, 502 |
| 18 | [12-MENU.md](./12-MENU.md) | O que é cada item do menu |
| 19 | [10-MAPA-PROJECT.md](./10-MAPA-PROJECT.md) | Pastas do código |
| 20 | [13-ARQUITETURA.md](./13-ARQUITETURA.md) | Como as peças se ligam |
| 21 | [13-PASTA-PROJECT.md](./13-PASTA-PROJECT.md) | Por que pode apagar o Vite antigo |

## Onde está o código

O que o cliente usa:

`VBSOLUTIONCRMCodigoFonte-main/`

Lá: `backend/`, `frontend/`, `DOCUMENTACAO/`, `.env.example`.

Há uma cópia destes manuais também na pasta `DOCUMENTACAO` da raiz do download.

## Regra de ouro

Arquivos `.env` são senha. Nunca no GitHub público, nunca no grupo da família. O projeto está configurado para **não** enviar `.env`. Cada ambiente (seu PC, Railway, VPS) tem o seu.

Quando se perder, abra [16-GUIA-CLIENTE.md](./16-GUIA-CLIENTE.md) e retome o número da etapa. Repetir passo não é vergonha.
