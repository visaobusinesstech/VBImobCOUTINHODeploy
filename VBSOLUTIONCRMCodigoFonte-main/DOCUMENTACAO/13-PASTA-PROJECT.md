# Pasta `project/` — pode apagar? Sim. Aqui vai o porquê, sem pressa.

No zip original existiam **dois** sistemas:

1. **VB Solution CRM** — pastas `backend` e `frontend` (este que você está documentando).
2. **Radar Proptech** — pasta `project/` — um app Vite que falava com Supabase no browser.

O trabalho de união **já copiou** as telas e regras do Radar para dentro do VB Solution (imóveis, pipeline, RadarZAP, portais, SEO, módulos). O menu está em [12-MENU.md](./12-MENU.md).

## Pode apagar `project/`?

**Sim**, para o CRM unificado funcionar. Nenhum `import` do `frontend` ou `backend` aponta para `project/`.

Antes de apagar no Explorador de Arquivos:

1. Confirme que você está na cópia certa (não apague o único backup do mundo).
2. Rode o painel e clique nos itens do menu imobiliário. Se abrirem, você não precisa do Vite.
3. Se quiser guardar por nostalgia, zip a pasta `project` num HD e **depois** delete.

## O que NÃO fazer

- Não tente “embeber” o Vite dentro do Express com iframe. Os logins são diferentes.
- Não misture `.env` do Vite (`VITE_`) com o `.env` do React (`REACT_APP_`).
- Não rode `npm run dev` do `project` achando que é o CRM do cliente.

## Onde foi parar cada ideia do Radar

Olhe [10-MAPA-PROJECT.md](./10-MAPA-PROJECT.md) e o grupo **Radar** / **Imóveis** em [12-MENU.md](./12-MENU.md). Dados agora ficam no **mesmo** Postgres da API (`Imovel`, `RealtyModulo`, etc.), não nas tabelas antigas do app Vite (a menos que você tenha migrado dados na mão — este pacote não copia automaticamente linhas do Supabase antigo).

## Dados antigos no Supabase do Radar

Se o cliente já tinha imóveis no projeto Vite, **apagar a pasta não apaga o banco**. Os dados continuam no projeto Supabase velho. Trazer para o CRM novo é exportar/importar (CSV ou SQL) — trabalho à parte, não é um botão neste repositório.
