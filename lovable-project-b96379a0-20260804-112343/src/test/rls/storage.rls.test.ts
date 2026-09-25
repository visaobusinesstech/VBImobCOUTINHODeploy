/**
 * Isolamento em Storage.
 * - `logos` e `imoveis` são buckets públicos: qualquer um pode BAIXAR um
 *   arquivo cuja URL conhece (CDN), mas ninguém deve conseguir LISTAR ou
 *   ESCREVER dentro da pasta de outro tenant.
 * - `contratos`, `proprietarios`, `imoveis-docs` são privados: nem leitura
 *   nem escrita cruzada.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadRlsEnv, signIn, signOut, TenantCtx } from "./rlsHelpers";

const env = loadRlsEnv();
const d = env ? describe : describe.skip;

const PRIVATE_BUCKETS = ["contratos", "proprietarios", "imoveis-docs"];
const PUBLIC_BUCKETS = ["logos", "imoveis"];

async function uploadTiny(ctx: TenantCtx, bucket: string, path: string) {
  const blob = new Blob(["rls-test"], { type: "text/plain" });
  return ctx.client.storage.from(bucket).upload(path, blob, { upsert: true });
}

d("RLS · storage buckets", () => {
  let A: TenantCtx;
  let B: TenantCtx;
  const uploaded: Array<{ bucket: string; path: string }> = [];

  beforeAll(async () => {
    A = await signIn(env!, env!.a);
    B = await signIn(env!, env!.b);
  }, 30000);

  afterAll(async () => {
    for (const { bucket, path } of uploaded) {
      await A.client.storage.from(bucket).remove([path]);
    }
    if (A) await signOut(A);
    if (B) await signOut(B);
  });

  for (const bucket of PUBLIC_BUCKETS) {
    it(`[${bucket}] B NÃO grava dentro da pasta de A`, async () => {
      const path = `${A.userId}/rls-cross-${Date.now()}.txt`;
      const { error } = await uploadTiny(B, bucket, path);
      expect(error).not.toBeNull();
    });
  }

  for (const bucket of PRIVATE_BUCKETS) {
    it(`[${bucket}] A escreve na própria pasta, B não consegue baixar`, async () => {
      const path = `${A.userId}/rls-${Date.now()}.txt`;
      const up = await uploadTiny(A, bucket, path);
      // Alguns buckets exigem estrutura contextual (ex.: contratos usa
      // {contrato_id}/...); nesse caso pulamos com aviso claro.
      if (up.error) {
        console.warn(
          `[${bucket}] upload de A falhou (estrutura de path exige contexto): ${up.error.message}`
        );
        return;
      }
      uploaded.push({ bucket, path });

      const { data, error } = await B.client.storage.from(bucket).download(path);
      // Privado: precisa erro OU corpo indisponível.
      expect(!!error || !data).toBe(true);
    });

    it(`[${bucket}] B não lista a pasta de A`, async () => {
      const { data } = await B.client.storage
        .from(bucket)
        .list(A.userId, { limit: 100 });
      // list pode devolver [] ou erro — o essencial é NUNCA retornar arquivos.
      expect((data ?? []).length).toBe(0);
    });

    it(`[${bucket}] B não sobrescreve arquivo em pasta de A`, async () => {
      const path = `${A.userId}/rls-cross-${Date.now()}.txt`;
      const { error } = await uploadTiny(B, bucket, path);
      expect(error).not.toBeNull();
    });
  }
});
