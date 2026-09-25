# Webhooks — validação robusta

Todos os webhooks públicos (leads dos portais e confirmações de
pagamento/assinatura) passam por `supabase/functions/_shared/webhookSecurity.ts`,
que aplica três camadas de defesa:

1. **Assinatura HMAC-SHA256** com segredo por tenant + provedor
   (`public.webhook_secrets`). Comparação em tempo constante.
2. **Replay protection** — combinação de `X-Timestamp` (janela ±5 min) com
   `X-Nonce` persistido em `public.webhook_nonces` (UNIQUE por tenant/provider/nonce).
   Um segundo POST com o mesmo nonce recebe HTTP 409.
3. **Verificação de tenant** — o `id` (imobiliária) do path é obrigatório e,
   quando o remetente envia `X-Tenant-Id`, o valor precisa bater com o path.
   Além disso, o segredo só é aceito se pertencer àquele tenant/provider.

## Headers exigidos

| Header         | Descrição                                             |
| -------------- | ----------------------------------------------------- |
| `X-Signature`  | `sha256=<hex>` ou apenas o hex (64 chars)             |
| `X-Timestamp`  | Unix seconds no momento do envio                      |
| `X-Nonce`      | Identificador único do evento (8–200 chars)           |
| `X-Tenant-Id`  | Opcional — se enviado, deve bater com `?id=<uuid>`    |

**Base assinada:** `` `${timestamp}.${nonce}.${rawBody}` ``.

```bash
# exemplo (bash)
TS=$(date +%s); NONCE=$(uuidgen)
BODY='{"nome":"João","telefone":"+55..."}'
SIG=$(printf '%s.%s.%s' "$TS" "$NONCE" "$BODY" | \
      openssl dgst -sha256 -hmac "$SECRET" -r | cut -d' ' -f1)

curl -X POST "$URL/webhook-leads-portal?id=$TENANT&portal=zap" \
  -H "Content-Type: application/json" \
  -H "X-Timestamp: $TS" -H "X-Nonce: $NONCE" \
  -H "X-Signature: sha256=$SIG" \
  --data "$BODY"
```

## Endpoints

- `POST /webhook-leads-portal?id=<tenant>&portal=<slug>` — cria lead.
  Provider registrado como `portal:<slug>`.
- `POST /webhook-pagamentos?id=<tenant>&provider=<slug>` — atualiza
  `subscriptions`. Provider registrado como `pagamentos:<slug>`. Eventos
  aceitos: `payment.confirmed|failed|refunded`,
  `subscription.created|updated|cancelled|trial_end`.

## Cadastro de segredo

Cada imobiliária cadastra um segredo forte por provedor em `webhook_secrets`
(RLS: só o próprio tenant/Master). Rotação: crie o novo segredo, marque o
antigo como `ativo=false` após o provedor migrar.

## Migração dos portais legados

`WEBHOOK_LEADS_ALLOW_UNSIGNED=true` permite temporariamente aceitar POSTs sem
`X-Signature` no endpoint de leads (apenas). Assim que os portais forem
atualizados, remova o env — a partir daí qualquer request sem assinatura é
rejeitado com 401.

## Trilha de auditoria

Falhas de verificação e sucessos em pagamentos são gravados em
`security_audit_log` via `log_service_role_call` com o motivo
(`assinatura_invalida`, `replay_detectado`, `tenant_mismatch`, etc.),
correlação de tenant, IP e User-Agent.

## Limpeza de nonces

Rodar `select public.cleanup_webhook_nonces();` periodicamente (pg_cron) para
descartar registros com `expires_at < now()`.
