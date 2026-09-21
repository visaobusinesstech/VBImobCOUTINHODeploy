# WhatsApp, Redis e serviços extras

## Dois modos de WhatsApp

1. **Baileys (não oficial)** — QR Code em **Conexões**. Precisa de processo Node 24/7, Redis estável e URL WebSocket (Nginx `Upgrade`).
2. **Cloud API (oficial Meta)** — `USE_WHATSAPP_OFICIAL`, tokens no `.env` ou no painel. Webhook: `https://api.seudominio.com/` + `VERIFY_TOKEN`.

O pipeline imobiliário liga o lead ao **ticket** existente (`POST /leads-sales/:id/ticket`). Sem conversa no número, o botão Ticket avisa que não há atendimento.

## Redis

Obrigatório de verdade para campanhas, filas do agente e ACK. Sem Redis, partes do CRM degradam.

## Mídias

Uploads vão para o disco do backend (ou storage configurado). Na VPS, backup da pasta de public; no Railway, Volume.

## Stripe / PIX

Configure webhooks para `PUBLIC_BACKEND_URL`. URLs de sucesso/cancelamento = frontend.

## E-mail

SMTP no `.env` ou por empresa no módulo Email do painel.

## Chrome

`CHROME_PATH` se exportações/PDF falharem em Linux sem Chromium:

```bash
sudo apt install -y chromium-browser
```
