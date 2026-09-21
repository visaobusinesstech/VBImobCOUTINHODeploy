# Primeiro uso do CRM — do login até o primeiro imóvel (leigo)

Este texto assume: API ligada, banco migrado, painel aberto, `DEV_NO_DB=false`.

---

## Passo 1 — Abrir o site

Local: `http://localhost:3001`  
Produção: URL da Vercel.

Se a tela branca: F12 Console. Erro de API = backend off ou `REACT_APP_BACKEND_URL` errado.

## Passo 2 — Login

Usuário e senha do **seed** (veja logs da API no primeiro migrate, ou a senha que você cadastrou). Em demo `DEV_NO_DB`, o login de teste está no [02-INSTALACAO-LOCAL.md](./02-INSTALACAO-LOCAL.md).

Se “Não autorizado”: JWT, relógio do PC (hora errada), ou empresa inativa.

## Passo 3 — Empresa e usuários

Menu **Empresas** / **Usuários**. Crie um usuário para cada corretor. Sem isso, o chat não sabe quem atende.

## Passo 4 — Conectar WhatsApp

[09-WHATSAPP-REDIS-EMAIL.md](./09-WHATSAPP-REDIS-EMAIL.md). Sem canal, o ticket não nasce sozinho (você ainda pode cadastrar lead na mão).

## Passo 5 — Filas e tickets

Menu **Filas**: crie “Vendas”, “Locação”, “Suporte”.  
Menu **Tickets**: conversas. Cada ticket pode ligar a um **negócio** (pipeline).

## Passo 6 — Cadastros imobiliários

Ordem que evita tela vazia:

1. **Proprietários** — quem é dono do imóvel.
2. **Imóveis** — endereço, tipo, valor; escolha o proprietário.
3. **Contratos** — aluguel/venda ligado ao imóvel.
4. **Pipeline / Negócios** — funil; pode nascer do ticket.

## Passo 7 — Radar e conteúdo

**RadarZAP**, **Portais**, **SEO**, **Q-Capture** usam API deste mesmo CRM. Primeira visita pode estar vazia: clique Novo / Analisar / Capturar e espere o toast.

## Passo 8 — Calendário, respostas rápidas, campanhas

São páginas **nativas** do VB Solution, no menu. Resposta rápida: atalho de texto no atendimento. Campanha: lista + conexão WhatsApp + intervalo.

## Passo 9 — O que não fazer no primeiro dia

- Não apague a empresa padrão sem criar outra.
- Não rode `db:migrate:undo` em produção.
- Não coloque o mesmo WhatsApp em homologação e produção.
