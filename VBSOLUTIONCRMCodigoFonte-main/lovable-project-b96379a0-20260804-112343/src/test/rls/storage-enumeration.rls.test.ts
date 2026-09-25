/**
 * Anti-enumeração em Storage.
 *
 * Regras de segurança validadas aqui:
 *
 *  1. Anônimo NÃO pode LISTAR nenhum bucket (público ou privado) — nem a raiz,
 *     nem qualquer pasta. Buckets públicos servem CDN por *referência direta*,
 *     nunca por listagem.
 *  2. Tenant autenticado NÃO enumera a raiz de nenhum bucket — não pode
 *     descobrir pastas de outros tenants nem em `imoveis`/`logos` (públicos).
 *  3. Tenant autenticado NÃO lista a pasta de outro tenant, mesmo em bucket
 *     público. Só a própria pasta (`{auth.uid()}/...`) é enumerável.
 *  4. Referência direta a URL pública de outro tenant continua funcionando
 *     via CDN (é o modelo dos buckets públicos), mas *paths chutados* que
 *     não existem retornam 404 — nada de índice/diretório.
 *  5. Em bucket privado, gerar URL assinada para arquivo de outro tenant
 *     falha.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadRlsEnv, newAnonClient, signIn, signOut, TenantCtx, rid } from "./rlsHelpers";

const env = loadRlsEnv();
const d = env ? describe : describe.skip;

const PUBLIC_BUCKETS = ["imoveis", "logos"] as const;
const PRIVATE_BUCKETS = ["contratos", "proprietarios", "imoveis-docs", "exports"] as const;
const ALL_BUCKETS = [...PUBLIC_BUCKETS, ...PRIVATE_BUCKETS] as const;

async function uploadTiny(ctx: TenantCtx, bucket: string, path: string) {
  const blob = new Blob([`enum-test-${Date.now()}`], { type: "text/plain" });
  return ctx.client.storage.from(bucket).upload(path, blob, { upsert: true });
}

d("Storage · anti-enumeração e acesso por referência", () => {
  let A: TenantCtx;
  let B: TenantCtx;
  let anon: ReturnType<typeof newAnonClient>;
  const cleanup: Array<{ ctx: () => TenantCtx; bucket: string; path: string }> = [];

  const aFiles: Record<string, string> = {}; // bucket -> path uploaded por A

  beforeAll(async () => {
    A = await signIn(env!, env!.a);
    B = await signIn(env!, env!.b);
    anon = newAnonClient(env!);

    // Semear um arquivo de A em cada bucket que aceite path folder-based.
    for (const bucket of ["imoveis", "logos", "proprietarios", "imoveis-docs", "exports"]) {
      const path = `${A.userId}/${rid("enum")}.txt`;
      const up = await uploadTiny(A, bucket, path);
      if (!up.error) {
        aFiles[bucket] = path;
        cleanup.push({ ctx: () => A, bucket, path });
      }
    }
  }, 45000);

  afterAll(async () => {
    for (const { ctx, bucket, path } of cleanup) {
      try { await ctx().client.storage.from(bucket).remove([path]); } catch { /* noop */ }
    }
    if (A) await signOut(A);
    if (B) await signOut(B);
  });

  // ---------------------------------------------------------------------------
  // 1) Anônimo não lista nada
  // ---------------------------------------------------------------------------
  for (const bucket of ALL_BUCKETS) {
    it(`[${bucket}] anônimo NÃO lista a raiz`, async () => {
      const { data, error } = await anon.storage.from(bucket).list("", { limit: 100 });
      // Aceita: erro OU lista vazia. Nunca deve devolver arquivos.
      expect(!!error || (data ?? []).length === 0).toBe(true);
      if ((data ?? []).length > 0) {
        throw new Error(`ENUMERAÇÃO: anônimo listou ${data!.length} itens em ${bucket}`);
      }
    });

    it(`[${bucket}] anônimo NÃO lista a pasta de A`, async () => {
      const { data, error } = await anon.storage.from(bucket).list(A.userId, { limit: 100 });
      expect(!!error || (data ?? []).length === 0).toBe(true);
    });
  }

  // ---------------------------------------------------------------------------
  // 2) Autenticado não enumera raiz — nem em bucket público
  // ---------------------------------------------------------------------------
  for (const bucket of ALL_BUCKETS) {
    it(`[${bucket}] B autenticado NÃO enumera a raiz (não vê pastas de outros tenants)`, async () => {
      const { data } = await B.client.storage.from(bucket).list("", { limit: 1000 });
      const items = data ?? [];
      // Se algo vier, não pode conter a pasta de A nem qualquer UUID que não seja de B.
      const leak = items.find((it) => it.name && it.name !== B.userId);
      if (leak) {
        throw new Error(
          `ENUMERAÇÃO em ${bucket}: B viu "${leak.name}" na raiz (esperado só "${B.userId}" ou nada)`,
        );
      }
    });
  }

  // ---------------------------------------------------------------------------
  // 3) Tenant B não lista pasta de A — em nenhum bucket
  // ---------------------------------------------------------------------------
  for (const bucket of ALL_BUCKETS) {
    it(`[${bucket}] B NÃO lista a pasta de A`, async () => {
      const { data } = await B.client.storage.from(bucket).list(A.userId, { limit: 100 });
      expect((data ?? []).length).toBe(0);
    });
  }

  // ---------------------------------------------------------------------------
  // 4) Buckets públicos: URL direta funciona (referência); path chutado não
  // ---------------------------------------------------------------------------
  for (const bucket of PUBLIC_BUCKETS) {
    it(`[${bucket}] URL pública referenciada é acessível (CDN)`, async () => {
      const path = aFiles[bucket];
      if (!path) return; // bucket sem seed
      const { data } = A.client.storage.from(bucket).getPublicUrl(path);
      const res = await fetch(data.publicUrl);
      expect(res.status).toBe(200);
    });

    it(`[${bucket}] path INEXISTENTE retorna 4xx (sem índice/diretório)`, async () => {
      const fakePath = `${A.userId}/nao-existe-${rid("chute")}.txt`;
      const { data } = anon.storage.from(bucket).getPublicUrl(fakePath);
      const res = await fetch(data.publicUrl);
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });

    it(`[${bucket}] URL de "diretório" (sem arquivo) NÃO devolve listagem`, async () => {
      // Simula um path que termina em '/' — nunca deve devolver HTML de índice.
      const { data } = anon.storage.from(bucket).getPublicUrl(`${A.userId}/`);
      const res = await fetch(data.publicUrl);
      const body = res.ok ? await res.text() : "";
      // Se por acaso retornar 200, o corpo NÃO pode ser uma listagem HTML.
      const looksLikeIndex = /<a\s+href=|Index of|<listing/i.test(body);
      expect(looksLikeIndex).toBe(false);
    });
  }

  // ---------------------------------------------------------------------------
  // 5) Buckets privados: signed URL de arquivo alheio é negada
  // ---------------------------------------------------------------------------
  for (const bucket of ["proprietarios", "imoveis-docs", "exports"] as const) {
    it(`[${bucket}] B NÃO gera signed URL para arquivo de A`, async () => {
      const path = aFiles[bucket];
      if (!path) return;
      const { data, error } = await B.client.storage.from(bucket).createSignedUrl(path, 60);
      // Precisa: falhar ou não expor a URL.
      const leaked = !!data?.signedUrl && !error;
      if (leaked) {
        // Última verificação: mesmo que crie, o download precisa falhar
        const res = await fetch(data!.signedUrl);
        expect(res.status).toBeGreaterThanOrEqual(400);
      } else {
        expect(!!error || !data?.signedUrl).toBe(true);
      }
    });

    it(`[${bucket}] anônimo NÃO gera signed URL`, async () => {
      const path = aFiles[bucket] ?? `${A.userId}/x.txt`;
      const { data, error } = await anon.storage.from(bucket).createSignedUrl(path, 60);
      expect(!!error || !data?.signedUrl).toBe(true);
    });
  }

  // ---------------------------------------------------------------------------
  // 6) Path traversal / prefix guessing
  // ---------------------------------------------------------------------------
  for (const bucket of ALL_BUCKETS) {
    it(`[${bucket}] B NÃO lista com prefixo curto tentando adivinhar UUIDs`, async () => {
      // Tenta prefixos comuns; nenhum deve devolver algo que não pertença a B.
      for (const prefix of ["a", "0", "f", "00000000"]) {
        const { data } = await B.client.storage.from(bucket).list(prefix, { limit: 50 });
        const leak = (data ?? []).find((it) => it.name && !it.name.startsWith(B.userId));
        if (leak) {
          throw new Error(
            `ENUMERAÇÃO por prefixo "${prefix}" em ${bucket}: B viu "${leak.name}"`,
          );
        }
      }
    });
  }
});
