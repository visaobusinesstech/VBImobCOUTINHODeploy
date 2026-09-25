/**
 * Sanidade: cliente anônimo (sem sessão) não deve alcançar tabelas sensíveis.
 */
import { describe, expect, it } from "vitest";
import { loadRlsEnv, newAnonClient } from "./rlsHelpers";

const env = loadRlsEnv();
const d = env ? describe : describe.skip;

const TABELAS_SENSIVEIS = [
  "leads",
  "transacoes",
  "contratos",
  "propostas",
  "proprietarios",
  "corretores",
  "profiles",
  "user_permissoes",
  "imobiliaria_config",
];

d("RLS · acesso anônimo", () => {
  for (const t of TABELAS_SENSIVEIS) {
    it(`anon NÃO lê ${t}`, async () => {
      const anon = newAnonClient(env!);
      const { data, error } = await anon.from(t).select("*").limit(1);
      if (error) {
        // Bloqueio explícito é OK
        expect(error.message).toBeTruthy();
      } else {
        expect(data ?? []).toHaveLength(0);
      }
    });
  }

  it("anon NÃO insere lead sem imobiliaria_id (RLS bloqueia)", async () => {
    const anon = newAnonClient(env!);
    const { error } = await anon
      .from("leads")
      .insert({ nome: "anon-injection", valor: 1 })
      .select();
    expect(error).not.toBeNull();
  });
});
