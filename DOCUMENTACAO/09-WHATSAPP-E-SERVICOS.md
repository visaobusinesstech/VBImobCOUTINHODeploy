# WhatsApp e outros serviços — guia completo (mesmo tema de 09-WHATSAPP-REDIS-EMAIL)

Este arquivo existe para o índice antigo continuar válido. O conteúdo abaixo é o manual **inteiro**, não um resumo. Há um irmão com nome novo: [09-WHATSAPP-REDIS-EMAIL.md](./09-WHATSAPP-REDIS-EMAIL.md) (mesmo assunto).

---

## Redis, com calma

Sem Redis em produção o CRM “abre” e depois falha em campanha, fila e às vezes no próprio WhatsApp.

1. Instale ou contrate Redis.
2. Coloque a URL nas três variáveis do `.env` da API.
3. Reinicie a API.
4. Nos logs, não pode aparecer conexão recusada na 6379.

Windows local: Docker Desktop ligado, depois:

```
docker run -d -p 6379:6379 --name redis redis:7
```

URI: `redis://127.0.0.1:6379`

Na Railway a URL **não** é localhost. É a variável do plugin. Cole ela inteira, incluindo senha.

---

## WhatsApp por QR (biblioteca Baileys)

É o caminho em que o CRM “vira um WhatsApp Web”.

Passos na tela:

1. Login no painel.
2. Menu **Conexões**.
3. Nova conexão, dê um nome (“Principal”).
4. Espere o QR.
5. No celular: WhatsApp → Aparelhos conectados → Conectar um aparelho.
6. Aponte a câmera. Espere o status Connected.

Cuidados que o leigo sempre esbarra:

- API precisa estar **a mesma** que o painel chama (`REACT_APP_BACKEND_URL`). QR gerado num PC e painel apontando para outra API = QR fantasma.
- Reiniciou o servidor na nuvem **sem disco persistente** = QR de novo. Peça Volume na Railway ou não apague arquivos na VPS.
- Dois computadores, mesmo número, dois CRMs = um dos dois cai.
- Uso não oficial pode ser limitado pelo WhatsApp. Comece com chip de teste.

Mídias (áudio, imagem): a API grava em pasta `public` ou S3, conforme `.env`. Sem espaço em disco, áudio não sobe. Na VPS rode `df -h`.

---

## WhatsApp Cloud (oficial)

1. API já pública em **HTTPS**.
2. App no developers.facebook.com, produto WhatsApp.
3. Copie Phone Number ID, token, App Secret.
4. Invente um Verify Token (uma frase secreta) e coloque no `.env` **e** no painel da Meta.
5. Webhook URL = `PUBLIC_BACKEND_URL` + caminho de webhook do sistema (veja `.env.example` e a tela Integrações). Exemplo típico: `https://api.empresa.com/webhook/` — **confira no código/tela**, não chute se a tela mostrar outro path.
6. Meta manda um GET de verificação. Se o token não bater, o webhook fica vermelho.
7. Mande “oi” do celular para o número Cloud. Ticket deve nascer.

Localhost sem túnel **não** recebe a Meta.

---

## E-mail

Preencha `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASS`, `MAIL_FROM` como em [04-VARIAVEIS-DE-AMBIENTE.md](./04-VARIAVEIS-DE-AMBIENTE.md). Gmail exige senha de app. Teste “esqueci senha” ou uma campanha de um destinatário só.

---

## Pagamentos (Stripe e afins)

Só se o white-label vender assinatura. Chaves **secretas** no backend. Chave publicável, se existir, no frontend. Webhook Stripe aponta para a API HTTPS, não para a Vercel (a Vercel não processa o evento da mesma forma que a API).

---

## OpenAI / prompts

Menu Prompts + Integrações. Sem `OPENAI_API_KEY` (nome exato no `.env.example`), o botão de IA mostra erro e o resto do CRM segue.

---

## Ordem saudável

Redis → API HTTPS → login → Conexões → mensagem de teste → só então campanha em massa.
