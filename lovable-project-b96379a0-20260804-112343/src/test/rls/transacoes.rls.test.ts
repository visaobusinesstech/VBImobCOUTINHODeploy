/**
 * Isolamento multi-tenant em `transacoes` (cobranças/receitas/despesas).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadRlsEnv, signIn, signOut, TenantCtx } from "./rlsHelpers";
import { cleanupTransacao, seedTransacao } from "./rlsFixtures";

const env = loadRlsEnv();
const d = env ? describe : describe.skip;

d("RLS · transacoes (cobranças)", () => {
  let A: TenantCtx;
  let B: TenantCtx;
  let txnA: { id: string; imobiliaria_id: string; descricao: string };

  beforeAll(async () => {
    A = await signIn(env!, env!.a);
    B = await signIn(env!, env!.b);
    txnA = await seedTransacao(A);
  }, 30000);

  afterAll(async () => {
    if (txnA) await cleanupTransacao(A, txnA.id);
    if (A) await signOut(A);
    if (B) await signOut(B);
  });

  it("A enxerga a própria transação", async () => {
    const { data, error } = await A.client
      .from("transacoes")
      .select("id, imobiliaria_id, valor")
      .eq("id", txnA.id);
    expect(error).toBeNull();
    expect(data?.length).toBe(1);
    expect(data![0].imobiliaria_id).toBe(A.userId);
  });

  it("B NÃO vê a transação de A", async () => {
    const { data } = await B.client
      .from("transacoes")
      .select("id, valor")
      .eq("id", txnA.id);
    expect(data ?? []).toHaveLength(0);
  });

  it("B NÃO altera valor de cobrança de A", async () => {
    const { data } = await B.client
      .from("transacoes")
      .update({ valor: 0.01, status: "pago" })
      .eq("id", txnA.id)
      .select();
    expect(data ?? []).toHaveLength(0);

    const { data: after } = await A.client
      .from("transacoes")
      .select("valor, status")
      .eq("id", txnA.id)
      .single();
    expect(Number(after?.valor)).toBe(1000);
  });

  it("B NÃO apaga cobrança de A", async () => {
    const { data } = await B.client
      .from("transacoes")
      .delete()
      .eq("id", txnA.id)
      .select();
    expect(data ?? []).toHaveLength(0);

    const { data: after } = await A.client
      .from("transacoes")
      .select("id")
      .eq("id", txnA.id);
    expect(after?.length).toBe(1);
  });

  it("Listagem sem filtros de B nunca retorna linhas de A", async () => {
    const { data } = await B.client
      .from("transacoes")
      .select("imobiliaria_id")
      .limit(200);
    (data ?? []).forEach((row) => expect(row.imobiliaria_id).toBe(B.userId));
  });
});
