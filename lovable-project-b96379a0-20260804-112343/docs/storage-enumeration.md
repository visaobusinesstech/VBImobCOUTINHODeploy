# Storage — regras anti-enumeração

Complementa `docs/rls-testing.md`. Cobre especificamente **listagem indevida**
e **acesso por URL não referenciada** em buckets Storage.

## Regras vigentes

| # | Regra                                                                                 | Como é garantida                                                                                          |
|---|---------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------|
| 1 | Anônimo não lista nenhum bucket (público ou privado).                                 | Não há nenhuma policy `TO anon`/`TO public` de SELECT em `storage.objects` — anon é sempre negado.        |
| 2 | Tenant autenticado só enumera a **própria pasta** (`{auth.uid()}/...`).               | Todas as policies de SELECT/UPDATE/DELETE prendem `(storage.foldername(name))[1] = auth.uid()::text` ou usam `owns_contrato_file(name)` para `contratos`. |
| 3 | Escrita cruzada é bloqueada em todos os buckets.                                      | Mesma checagem de pasta no `WITH CHECK` das policies de INSERT.                                           |
| 4 | Buckets públicos (`imoveis`, `logos`) servem **por referência direta** via CDN.       | O objeto público é acessível por URL conhecida; a *listagem* continua gated pela RLS de `storage.objects`. |
| 5 | Buckets privados exigem *signed URL* gerada pelo dono; anônimo/tenant alheio falha.   | `createSignedUrl` chama `storage.objects` que aplica a RLS de SELECT.                                     |

## O que a suíte de testes valida

Arquivo: `src/test/rls/storage-enumeration.rls.test.ts` (roda no CI junto com
os outros testes de RLS, e é pulado sem `TEST_TENANT_A_*` / `TEST_TENANT_B_*`).

- Anônimo listando **raiz** e **pasta de A** em cada bucket → sempre vazio ou erro.
- Tenant B listando a **raiz** em cada bucket → nunca aparece pasta de A (nem em
  bucket público). Se aparecer qualquer item cujo nome não seja o próprio UUID
  de B, o teste falha com mensagem `ENUMERAÇÃO em <bucket>`.
- Tenant B listando **pasta de A** em cada bucket → sempre 0 itens.
- Em `imoveis`/`logos`:
  - URL pública referenciada retorna 200 (CDN funciona).
  - Path inexistente retorna 4xx (não há índice/diretório servido).
  - URL "de diretório" (`{uid}/`) não devolve HTML de listagem.
- Em `proprietarios`/`imoveis-docs`/`exports`:
  - B tentando `createSignedUrl` para arquivo de A → falha, ou URL retornada
    baixa com 4xx.
  - Anônimo tentando `createSignedUrl` → falha.
- Enumeração por prefixo curto (`"a"`, `"0"`, `"f"`, `"00000000"`) → não
  retorna nada que não pertença ao tenant chamador.

## Convenção de path

**Sempre grave arquivos como `{tenant_id}/...`.** Ex.:
`imoveis/{auth.uid()}/{imovel_id}/{arquivo}.jpg`. É o que as policies exigem —
paths sem UUID de tenant na primeira pasta são rejeitados no INSERT.

Para `contratos` a convenção é `{contrato_id}/...`; a validação é feita pela
função `public.owns_contrato_file(name)` que confere se o contrato pertence à
imobiliária do chamador.

## Como rodar localmente

```bash
export TEST_TENANT_A_EMAIL=... TEST_TENANT_A_PASSWORD=...
export TEST_TENANT_B_EMAIL=... TEST_TENANT_B_PASSWORD=...
bunx vitest run src/test/rls/storage-enumeration.rls.test.ts
```

Sem essas variáveis a suíte fica `skipped` — o CI (`.github/workflows/rls-tests.yml`)
já injeta os secrets nos runs de PR.
