/**
 * Isolamento multi-tenant em `leads`.
 * Cada suíte segue o mesmo padrão: A cria um recurso, B tenta lê-lo/mutá-lo/
 * apagá-lo e o RLS deve bloquear (linhas retornam vazias ou erro).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  loadRlsEnv,
  newAnonClient,
  signIn,
  signOut,
  TenantCtx,
} from "./rlsHelpers";
import { cleanupLead, seedLead } from "./rlsFixtures";

const env = loadRlsEnv();
const d = env ? describe : describe.skip;

d("RLS · leads", () => {
  let A: TenantCtx;
  let B: TenantCtx;
  let leadA: { id: string; imobiliaria_id: string; nome: string };

  beforeAll(async () => {
    A = await signIn(env!, env!.a);
    B = await signIn(env!, env!.b);
    leadA = await seedLead(A);
  }, 30000);

  afterAll(async () => {
    if (leadA) await cleanupLead(A, leadA.id);
    if (A) await signOut(A);
    if (B) await signOut(B);
  });

  it("A vê o próprio lead", async () => {
    const { data, error } = await A.client
      .from("leads")
      .select("id, imobiliaria_id")
      .eq("id", leadA.id);
    expect(error).toBeNull();
    expect(data?.length).toBe(1);
    expect(data![0].imobiliaria_id).toBe(A.userId);
  });

  it("B NÃO vê o lead de A (SELECT filtrado)", async () => {
    const { data, error } = await B.client
      .from("leads")
      .select("id")
      .eq("id", leadA.id);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("B NÃO atualiza o lead de A (falha silenciosa via RLS)", async () => {
    const { data } = await B.client
      .from("leads")
      .update({ nome: "hijack" })
      .eq("id", leadA.id)
      .select();
    expect(data ?? []).toHaveLength(0);

    const { data: after } = await A.client
      .from("leads")
      .select("nome")
      .eq("id", leadA.id)
      .single();
    expect(after?.nome).toBe(leadA.nome);
  });

  it("B NÃO apaga o lead de A", async () => {
    const { data } = await B.client
      .from("leads")
      .delete()
      .eq("id", leadA.id)
      .select();
    expect(data ?? []).toHaveLength(0);

    const { data: after } = await A.client
      .from("leads")
      .select("id")
      .eq("id", leadA.id);
    expect(after?.length).toBe(1);
  });

  it("B NÃO consegue inserir lead com imobiliaria_id de A", async () => {
    const { error } = await B.client
      .from("leads")
      .insert({ imobiliaria_id: A.userId, nome: "spoof", valor: 1 })
      .select();
    // A policy pode barrar via WITH CHECK (erro) OU o trigger reescreve para B
    // e depois nenhuma linha volta para A. Ambos os cenários são aceitos —
    // desde que A não veja essa inserção.
    if (!error) {
      const { data } = await A.client
        .from("leads")
        .select("id")
        .eq("nome", "spoof");
      expect(data ?? []).toHaveLength(0);
    }
  });

  it("anon NÃO lista leads", async () => {
    const anon = newAnonClient(env!);
    const { data, error } = await anon.from("leads").select("id").limit(1);
    // Ou RLS bloqueia com erro, ou retorna vazio — nunca dados de tenant.
    if (!error) expect(data ?? []).toHaveLength(0);
  });
});
