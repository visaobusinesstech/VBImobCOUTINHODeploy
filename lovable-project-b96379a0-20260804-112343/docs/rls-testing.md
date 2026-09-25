# Testes automatizados de RLS / isolamento multi-tenant

Esta suíte valida que **nenhuma imobiliária consegue ler, alterar ou apagar
dados de outra** através dos endpoints públicos do backend (PostgREST +
Storage). Ela cobre os recursos críticos:

- `leads`
- `imoveis`
- `transacoes` (cobranças, receitas, despesas)
- Buckets de Storage: `logos`, `imoveis`, `contratos`, `proprietarios`, `imoveis-docs`
- Acesso anônimo a tabelas sensíveis (`leads`, `contratos`, `propostas`, `proprietarios`, etc.)

## Pré-requisitos

Crie **dois usuários de teste dedicados** no ambiente que você quer validar
(ex.: staging). Os dois precisam estar com **e-mail confirmado** e aprovados
(`profiles.approved = true`).

Recomendamos e-mails descartáveis do tipo `rls-tenant-a@seu-dominio.com` e
`rls-tenant-b@seu-dominio.com`. Não use contas reais de cliente.

Depois exporte as credenciais como variáveis de ambiente antes de rodar:

```bash
export TEST_TENANT_A_EMAIL="rls-tenant-a@..."
export TEST_TENANT_A_PASSWORD="..."
export TEST_TENANT_B_EMAIL="rls-tenant-b@..."
export TEST_TENANT_B_PASSWORD="..."
```

Sem essas variáveis os testes ficam **skipped** — o CI continua verde e
você garante que a suíte só roda quando há credenciais reais.

## Executar

```bash
bun run test -- src/test/rls
# ou
npx vitest run src/test/rls
```

## O que cada teste verifica

Para cada tabela crítica:

1. A cria um recurso via cliente autenticado (respeitando RLS).
2. B tenta SELECT/UPDATE/DELETE por id → RLS deve retornar vazio.
3. B tenta INSERT com `imobiliaria_id = A` → deve ser bloqueado ou reescrito.
4. Anon (sem sessão) → nunca vê linhas nem consegue plantar registros.

Para Storage:

- Buckets públicos (`logos`, `imoveis`): download livre é aceito, mas
  **escrita/sobrescrita em pasta de outro tenant é bloqueada**.
- Buckets privados: nem download, nem list, nem write cruzados.

## Adicionar novos endpoints à suíte

1. Adicione um seed em `src/test/rls/rlsFixtures.ts`.
2. Crie `src/test/rls/<recurso>.rls.test.ts` copiando o template de
   `leads.rls.test.ts` e ajustando os campos.
3. Se a tabela tiver uma policy diferente (ex.: leitura pública em `imoveis`
   quando `status = 'Ativo'`), inclua um `it()` positivo confirmando o
   comportamento esperado além dos negativos.

## CI

O workflow `.github/workflows/rls-tests.yml` roda esta suíte em cada PR.
As credenciais devem ser cadastradas como secrets do repositório:
`TEST_TENANT_A_EMAIL`, `TEST_TENANT_A_PASSWORD`, `TEST_TENANT_B_EMAIL`,
`TEST_TENANT_B_PASSWORD`.
