/**
 * Seeds mínimos criados pelo próprio tenant (nunca com service role).
 * Isso garante que cada linha tem o `imobiliaria_id = auth.uid()` correto
 * e que os testes de vazamento consultam dados reais criados via RLS.
 */
import { TenantCtx, rid } from "./rlsHelpers";

export async function seedLead(ctx: TenantCtx) {
  const nome = rid("lead");
  const { data, error } = await ctx.client
    .from("leads")
    .insert({ nome, telefone: "11999999999", valor: 100000 })
    .select()
    .single();
  if (error) throw new Error(`seedLead(${ctx.email}): ${error.message}`);
  return data as { id: string; imobiliaria_id: string; nome: string };
}

export async function seedImovel(ctx: TenantCtx) {
  const titulo = rid("imovel");
  const { data, error } = await ctx.client
    .from("imoveis")
    .insert({
      imobiliaria_id: ctx.userId,
      titulo,
      tipo: "Apartamento",
      operacao: "Venda",
      preco: 500000,
      quartos: 2,
      banheiros: 1,
      vagas: 1,
      area: 60,
    })
    .select()
    .single();
  if (error) throw new Error(`seedImovel(${ctx.email}): ${error.message}`);
  return data as { id: string; imobiliaria_id: string; titulo: string };
}

export async function seedTransacao(ctx: TenantCtx) {
  const descricao = rid("txn");
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await ctx.client
    .from("transacoes")
    .insert({
      imobiliaria_id: ctx.userId,
      descricao,
      tipo: "entrada",
      categoria: "outros",
      valor: 1000,
      data: today,
      status: "pendente",
    })
    .select()
    .single();
  if (error) throw new Error(`seedTransacao(${ctx.email}): ${error.message}`);
  return data as { id: string; imobiliaria_id: string; descricao: string };
}

export async function cleanupLead(ctx: TenantCtx, id: string) {
  await ctx.client.from("leads").delete().eq("id", id);
}
export async function cleanupImovel(ctx: TenantCtx, id: string) {
  await ctx.client.from("imoveis").delete().eq("id", id);
}
export async function cleanupTransacao(ctx: TenantCtx, id: string) {
  await ctx.client.from("transacoes").delete().eq("id", id);
}
