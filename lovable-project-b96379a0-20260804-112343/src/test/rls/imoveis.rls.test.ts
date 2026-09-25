/**
 * Isolamento multi-tenant em `imoveis`.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadRlsEnv, signIn, signOut, TenantCtx } from "./rlsHelpers";
import { cleanupImovel, seedImovel } from "./rlsFixtures";

const env = loadRlsEnv();
const d = env ? describe : describe.skip;

d("RLS · imoveis", () => {
  let A: TenantCtx;
  let B: TenantCtx;
  let imovelA: { id: string; imobiliaria_id: string; titulo: string };

  beforeAll(async () => {
    A = await signIn(env!, env!.a);
    B = await signIn(env!, env!.b);
    imovelA = await seedImovel(A);
  }, 30000);

  afterAll(async () => {
    if (imovelA) await cleanupImovel(A, imovelA.id);
    if (A) await signOut(A);
    if (B) await signOut(B);
  });

  it("A vê o próprio imóvel", async () => {
    const { data, error } = await A.client
      .from("imoveis")
      .select("id, imobiliaria_id")
      .eq("id", imovelA.id);
    expect(error).toBeNull();
    expect(data?.length).toBe(1);
  });

  it("B NÃO vê o imóvel de A pelo id direto", async () => {
    const { data } = await B.client
      .from("imoveis")
      .select("id")
      .eq("id", imovelA.id);
    // Nota: se a policy publicar imóveis públicos, este teste falha e sinaliza
    // vazamento fora do canal esperado. Se sua carteira DEVE ser pública,
    // ajuste a expectativa para permitir leitura mas bloquear UPDATE/DELETE.
    expect(data ?? []).toHaveLength(0);
  });

  it("B NÃO atualiza imóvel de A", async () => {
    const { data } = await B.client
      .from("imoveis")
      .update({ titulo: "hijack" })
      .eq("id", imovelA.id)
      .select();
    expect(data ?? []).toHaveLength(0);

    const { data: after } = await A.client
      .from("imoveis")
      .select("titulo")
      .eq("id", imovelA.id)
      .single();
    expect(after?.titulo).toBe(imovelA.titulo);
  });

  it("B NÃO apaga imóvel de A", async () => {
    const { data } = await B.client
      .from("imoveis")
      .delete()
      .eq("id", imovelA.id)
      .select();
    expect(data ?? []).toHaveLength(0);

    const { data: after } = await A.client
      .from("imoveis")
      .select("id")
      .eq("id", imovelA.id);
    expect(after?.length).toBe(1);
  });

  it("B NÃO consegue plantar imóvel no tenant de A", async () => {
    const { data, error } = await B.client
      .from("imoveis")
      .insert({
        imobiliaria_id: A.userId,
        titulo: "spoof-imovel",
        tipo: "Apartamento",
        operacao: "Venda",
        preco: 1,
        quartos: 0,
        banheiros: 0,
        vagas: 0,
        area: 0,
      })
      .select();
    if (!error && data && data.length) {
      // Se passou, precisa ter sido reatribuído para B — jamais para A.
      expect(data[0].imobiliaria_id).toBe(B.userId);
      await B.client.from("imoveis").delete().eq("id", data[0].id);
    }
    const { data: check } = await A.client
      .from("imoveis")
      .select("id")
      .eq("titulo", "spoof-imovel");
    expect(check ?? []).toHaveLength(0);
  });
});
