# Logs de auditoria de segurança

Toda operação sensível grava um evento em `public.security_audit_log`, com
correlação por **tenant (imobiliária)**, **usuário atuante** e
**correlation_id** (mesmo id para eventos relacionados de uma requisição).

## Tipos de evento

| `event_type`             | Origem                                                      | Como é registrado                                                       |
| ------------------------ | ----------------------------------------------------------- | ----------------------------------------------------------------------- |
| `sensitive_mutation`     | Trigger em `leads`, `imoveis`, `transacoes`, `contratos`, `propostas`, `proprietarios` | Automático em INSERT/UPDATE/DELETE bem-sucedido                         |
| `cross_tenant_attempt`   | Trigger (mesmo conjunto de tabelas)                         | Quando `auth.uid()` (via `get_user_imobiliaria_id`) opera em tenant ≠ do próprio |
| `rls_denied`             | RPC `log_rls_denied_attempt` — chamada pelo frontend        | Depois que uma mutação retorna `[]` (RLS silenciou)                     |
| `service_role_call`      | Edge function via `createAuditedServiceRoleClient`          | Um evento no início (`start`) e outro ao concluir (`allowed/denied/error`) |
| `privilege_escalation`   | Regras específicas (a expandir)                             | Reservado para tentativas de mexer em `is_master`, `approved`, `plano`  |
| `auth_event`             | Cliente (login/reset)                                       | Chamada opcional para amarrar contexto                                  |

Cada linha carrega: `actor_user_id`, `tenant_id` (recurso), `actor_tenant_id`
(imobiliária efetiva do ator), `table_name`, `record_id`, `action`,
`outcome` (`allowed|denied|error`), `source` (`client|edge_function|trigger|cron|system`),
`edge_function`, `correlation_id`, `request_ip`, `user_agent` e `metadata` (jsonb).

## Uso no frontend

```ts
import { auditedUpdate, auditedDelete, logRlsDenied } from "@/lib/security/auditClient";

// Em vez de supabase.from('leads').update(...).eq('id', id):
const { data, deniedByRls } = await auditedUpdate("leads", leadId, { estagio: "fechado" });
if (deniedByRls) showToast("Você não tem permissão para editar este lead.");

// Uso manual quando você já detectou o silent-fail:
await logRlsDenied({
  table: "imoveis",
  action: "delete",
  recordId,
  reason: "empty result on delete",
});
```

O `correlation_id` é armazenado por aba em `sessionStorage`, então múltiplos
eventos gerados por uma mesma tela ficam amarrados.

## Uso em edge functions com service_role

```ts
import { createAuditedServiceRoleClient } from "../_shared/serviceRoleAudit.ts";

Deno.serve(async (req) => {
  const { admin, audit } = createAuditedServiceRoleClient(req, {
    edgeFunction: "admin-reset-password",
    action: "auth.reset_password",
    tenantId: null,
    metadata: { table: "auth.users" },
  });

  try {
    const { error } = await admin.auth.admin.updateUserById(userId, { password: newPass });
    if (error) {
      await audit({ outcome: "error", reason: error.message });
      return new Response(error.message, { status: 400 });
    }
    await audit({ outcome: "allowed" });
    return new Response("ok");
  } catch (e) {
    await audit({ outcome: "error", reason: String(e) });
    throw e;
  }
});
```

Cada chamada gera **dois eventos** com o mesmo `correlation_id`:
`service_role_call:start` (pré) e `service_role_call:allowed|denied|error` (pós).

## Consultas úteis (RLS: só Master vê tudo)

```sql
-- Últimas tentativas negadas por RLS na última hora
select created_at, actor_user_id, tenant_id, table_name, action, reason
from public.security_audit_log
where event_type = 'rls_denied' and created_at > now() - interval '1 hour'
order by created_at desc limit 100;

-- Chamadas service_role por edge function nas últimas 24h
select edge_function, count(*) filter (where outcome='allowed') as ok,
       count(*) filter (where outcome='error') as errors
from public.security_audit_log
where event_type='service_role_call' and created_at > now() - interval '24 hours'
group by 1 order by 2 desc;

-- Tentativas cross-tenant (ator operou em imobiliária diferente da própria)
select created_at, actor_user_id, actor_tenant_id, tenant_id, table_name, record_id
from public.security_audit_log
where event_type = 'cross_tenant_attempt'
order by created_at desc limit 50;

-- Timeline completa de uma requisição
select created_at, event_type, action, outcome, source, edge_function, table_name
from public.security_audit_log
where correlation_id = '00000000-0000-0000-0000-000000000000'
order by created_at;
```

## Garantias

- **Anon** pode inserir apenas `rls_denied` / `auth_event` com
  `actor_user_id IS NULL` (via RPC controlada) — não consegue plantar
  eventos em nome de outro usuário.
- **Authenticated** só insere eventos onde `actor_user_id = auth.uid()`.
- **Ninguém que não seja service_role** pode UPDATE/DELETE nesta tabela
  (histórico imutável do ponto de vista do app).
- **Master** enxerga tudo; usuário comum vê só eventos onde é ator ou
  cujo `tenant_id` ele pode acessar (`can_access_imobiliaria`).
