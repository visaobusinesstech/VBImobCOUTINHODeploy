# Arquitetura em uma página de caderno (para leigo)

Imagine três caixas:

```
[ Celular WhatsApp ]
        |
        |  internet
        v
[ API Node — Railway ou VPS ]
   |              |
   | SQL          | filas
   v              v
[ Postgres        [ Redis ]
  Supabase ]      
        ^
        | HTTPS REST + Socket.io
        |
[ Painel React — Vercel ou Nginx ]
        ^
        |
[ Você no Chrome ]
```

- O **painel** nunca fala com o Postgres direto. Só com a API.
- A **API** é o único lugar com senha do banco.
- O **Redis** não substitui o Postgres: é memória de fila e socket.
- O **WhatsApp** (Baileys) mora **junto da API**. Por isso a API precisa ficar ligada 24 h. A Vercel **não** segura essa sessão.

## Multi-empresa

Cada linha no banco tem `companyId`. Seu login gera um JWT. A API filtra “só dados da sua empresa”. Não misture `DATABASE_URL` de cliente A no servidor do cliente B.

## Por que não usamos Auth do Supabase

Este CRM já tem login próprio (tabela Users). O Supabase aqui é **Postgres hospedado**. Ligar Auth do Supabase exigiria reescrever o frontend inteiro.

## Socket.io

O chat ao vivo não é “atualizar a página”. É um fio permanente (WebSocket) da API até o browser. Nginx/Railway precisam deixar Upgrade de conexão. Sem isso, você só vê mensagem nova se der F5.

## Módulo imobiliário

Tabelas extras (`Imoveis`, `Proprietarios`, `Contratos`, `RealtyModulos`, campos em `LeadSales`). O restante é o VB Solution de sempre. Um único `npm start` no backend serve os dois mundos.
