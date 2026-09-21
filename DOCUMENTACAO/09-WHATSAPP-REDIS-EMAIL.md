# WhatsApp, e-mail, Redis e filas — passo a passo de leigo

Esta parte **não** é “ligar o site”. É o que faz conversa chegar, campanha sair e sessão não cair.

---

## 1. Redis — o que é e por que não pular

Imagine um caderninho super rápido. A API anota nele: “esta mensagem está na fila”, “este socket está aberto”, “este job de campanha espera 2 segundos”. Sem Redis, em produção: fila some, WhatsApp desconecta, campanha trava.

**Local (Windows):** Docker `docker run -d -p 6379:6379 --name redis redis:7` e no `.env` `REDIS_URI=redis://127.0.0.1:6379`.

**VPS:** `sudo apt install redis-server` e o mesmo URI.

**Railway:** plugin Redis e as três variáveis apontando para a URL (veja [07-RAILWAY.md](./07-RAILWAY.md)).

Teste: `redis-cli ping` → `PONG`.

As três variáveis deste projeto costumam ser a **mesma** URL:

- `REDIS_URI`
- `REDIS_URI_ACK`
- `REDIS_URL` (às vezes o código lê um nome, às vezes o outro)

---

## 2. Canal WhatsApp “QR Code” (Baileys)

1. Suba API + Redis + frontend.
2. Login no painel.
3. Menu **Conexões** (ou WhatsApp / Canais, conforme o menu).
4. Adicionar conexão.
5. Abra o WhatsApp no celular → Aparelhos conectados → Conectar → aponte a câmera no QR da tela.

O que o leigo precisa saber:

- O celular precisa estar online na hora.
- Se a API **reiniciar sem volume** (Railway sem disco), o QR some e pede de novo. Na VPS com PM2, a sessão fica em pasta no servidor — faça backup.
- Não use o mesmo número em dois CRMs ao mesmo tempo.
- WhatsApp oficial pode banir uso não oficial. Use número de **testes** primeiro.

---

## 3. WhatsApp Cloud API (oficial Meta)

Isso é outro caminho: você cria app no [Meta for Developers](https://developers.facebook.com/), produto WhatsApp, número de teste ou número real verificado.

No `.env` da **API** entram tokens que o Meta mostra (nomes exatos dependem da versão do código; procure no `.env.example`):

- token permanente
- Phone Number ID
- Business Account ID
- App Secret
- Verify Token (uma senha que **você inventa**)

No painel da Meta, **Webhook**: URL `https://SUA-API/webhook/` ou o caminho que o `.env.example` / tela Integrações indicar, método GET para verificar com o mesmo Verify Token.

Passo a passo mental:

1. API já em HTTPS público (Railway/VPS). Localhost **não** recebe webhook da Meta, a menos que use túnel (ngrok) só para teste.
2. Cole as chaves no `.env` ou nas Variables da Railway.
3. Reinicie a API.
4. No CRM, Integrações / WhatsApp Official, salve o que a tela pedir.
5. Mande uma mensagem do celular para o número Cloud. Deve abrir ticket.

---

## 4. E-mail (SMTP)

Campanhas de e-mail e “esqueci a senha” precisam de SMTP.

Gmail: senha de **app**, não a senha normal (conta Google → Segurança → verificação 2 etapas → senhas de app).

No `.env`:

```
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=seu@gmail.com
MAIL_PASS=senha_de_app
MAIL_FROM=seu@gmail.com
```

Outros: SendGrid, Mailgun, Amazon SES — o host e a porta mudam; a ideia é a mesma.

Mande um teste pela tela de campanha ou recuperação de senha. Se cair em spam, configure SPF/DKIM no DNS do domínio (o provedor SMTP ensina).

---

## 5. Filas de campanha e mensagens

Quando você clica “enviar campanha”, o backend **não** dispara 10 mil WhatsApp no mesmo segundo. Coloca na fila (Redis + workers). Por isso Redis precisa estar **sempre** no ar.

Se a campanha “fica pendente”:

1. `pm2 logs` ou logs Railway — erro de Redis?
2. Conexão WhatsApp realmente Connected?
3. Intervalos muito agressivos: o WhatsApp corta. Aumente o delay na tela de campanha.

---

## 6. Integrações extra (OpenAI, Stripe, etc.)

Tela **Integrações** no menu Gestão. Cada cartão pede chave. Sem chave, o botão daquela função falha com toast — o resto do CRM continua.

Nunca cole chaves no frontend `.env` se a documentação disser que é só no backend.

---

## Checklist do leigo “WhatsApp está vivo”

- [ ] Redis PONG
- [ ] API HTTPS
- [ ] FRONTEND_URL e BACKEND_URL certos
- [ ] QR lido **ou** Cloud webhook verde
- [ ] Mensagem de teste vira ticket no menu Atendimento
