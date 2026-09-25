// Testes automatizados para a normalização de nomes e os contadores de
// deduplicação usados em `radarzap-descobrir-grupos`:
//   - duplicados_invite_db     (invite canônico já existe no banco)
//   - duplicados_nome_local    (nome normalizado repetido na mesma execução)
//   - duplicados_nome_db       (nome normalizado já existe no banco)
//   - duplicados_local         (invite canônico repetido na mesma execução)
//
// A classificação abaixo espelha exatamente a ordem de checagem da edge function.
// Manter os dois sincronizados: qualquer mudança na ordem/critério deve refletir
// aqui e nos testes correspondentes.

import {
  assertEquals,
  assert,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { normalizarInvite, normalizarNomeGrupo } from "./firecrawlParser.ts";

type Criterio = "invite_local" | "invite_db" | "nome_local" | "nome_db";
type Resultado =
  | { tipo: "novo"; invite: string; nomeNorm: string | null }
  | { tipo: "descartado"; invite: string; nomeNorm: string | null; criterio: Criterio };

interface Contexto {
  invitesLocal: Set<string>;
  nomesLocal: Set<string>;
  invitesDb: Set<string>;
  nomesDb: Set<string>;
  forcado?: boolean;
}

/**
 * Espelho da lógica inline de `radarzap-descobrir-grupos/index.ts` (loop `for (const it of t.items)`).
 * Mantém a MESMA ordem de checagem:
 *  1. invite_local  → 2. invite_db  → 3. nome_local  → 4. nome_db.
 * Se `forcado=true`, pula todas as checagens (usado no reprocessamento).
 * A rotina NÃO muta os sets — quem chama decide o que fazer com o resultado.
 */
function classificar(invite: string, nome: string | null, ctx: Contexto): Resultado {
  const nomeNorm = normalizarNomeGrupo(nome);
  if (ctx.forcado) return { tipo: "novo", invite, nomeNorm };
  if (ctx.invitesLocal.has(invite)) return { tipo: "descartado", invite, nomeNorm, criterio: "invite_local" };
  if (ctx.invitesDb.has(invite)) return { tipo: "descartado", invite, nomeNorm, criterio: "invite_db" };
  if (nomeNorm) {
    if (ctx.nomesLocal.has(nomeNorm)) return { tipo: "descartado", invite, nomeNorm, criterio: "nome_local" };
    if (ctx.nomesDb.has(nomeNorm)) return { tipo: "descartado", invite, nomeNorm, criterio: "nome_db" };
  }
  return { tipo: "novo", invite, nomeNorm };
}

/** Simula o loop completo, produzindo os mesmos contadores da edge function. */
function processarLote(
  itens: Array<{ url: string; nome: string | null }>,
  base: { invitesDb?: string[]; nomesDb?: string[]; forcarInvites?: string[] } = {},
) {
  const invitesLocal = new Set<string>();
  const nomesLocal = new Set<string>();
  const invitesDb = new Set<string>(base.invitesDb ?? []);
  const nomesDb = new Set<string>((base.nomesDb ?? []).map((n) => normalizarNomeGrupo(n) ?? n));
  const forcados = new Set<string>((base.forcarInvites ?? []).map((u) => normalizarInvite(u) ?? u));

  const contadores = {
    invites_validos: 0,
    invites_novos: 0,
    descartados_sem_url: 0,
    descartados_host_invalido: 0,
    duplicados_local: 0,
    duplicados_invite_db: 0,
    duplicados_nome_local: 0,
    duplicados_nome_db: 0,
  };
  const novos: Array<{ invite: string; nome: string | null }> = [];
  const descartados: Array<{ invite: string; nome: string | null; criterio: Criterio }> = [];

  for (const it of itens) {
    if (!it.url) { contadores.descartados_sem_url++; continue; }
    const invite = normalizarInvite(it.url);
    if (!invite) { contadores.descartados_host_invalido++; continue; }
    contadores.invites_validos++;
    const res = classificar(invite, it.nome, {
      invitesLocal, nomesLocal, invitesDb, nomesDb, forcado: forcados.has(invite),
    });
    if (res.tipo === "descartado") {
      descartados.push({ invite, nome: it.nome, criterio: res.criterio });
      if (res.criterio === "invite_local") contadores.duplicados_local++;
      else if (res.criterio === "invite_db") contadores.duplicados_invite_db++;
      else if (res.criterio === "nome_local") contadores.duplicados_nome_local++;
      else if (res.criterio === "nome_db") contadores.duplicados_nome_db++;
    } else {
      contadores.invites_novos++;
      invitesLocal.add(invite);
      if (res.nomeNorm) nomesLocal.add(res.nomeNorm);
      novos.push({ invite, nome: it.nome });
    }
  }
  return { contadores, novos, descartados };
}

// ---------------- normalizarNomeGrupo ----------------

Deno.test("normalizarNomeGrupo — remove acentos e caixa alta", () => {
  assertEquals(normalizarNomeGrupo("Condomínio Águas Claras"), "condominio aguas claras");
});

Deno.test("normalizarNomeGrupo — remove tokens ruidosos (grupo/whatsapp/wpp/zap/oficial/etc)", () => {
  assertEquals(normalizarNomeGrupo("Grupo Whatsapp Oficial Sudoeste"), "sudoeste");
  assertEquals(normalizarNomeGrupo("Zap Moradores Noroeste"), "moradores noroeste");
  assertEquals(normalizarNomeGrupo("Wpp Convite Entrar Lago Sul"), "lago sul");
  assertEquals(normalizarNomeGrupo("Link para Join do Guará"), "para do guara");
});

Deno.test("normalizarNomeGrupo — pontuação e emojis viram espaço e colapsam", () => {
  assertEquals(
    normalizarNomeGrupo("🏡  Condomínio ---  Águas__Claras!! 2024 🏡"),
    "condominio aguas claras 2024",
  );
});

Deno.test("normalizarNomeGrupo — nomes equivalentes produzem chave idêntica", () => {
  const a = normalizarNomeGrupo("GRUPO Águas Claras - Oficial");
  const b = normalizarNomeGrupo("aguas   claras");
  const c = normalizarNomeGrupo("Águas Claras (WhatsApp)");
  assertEquals(a, b);
  assertEquals(a, c);
});

Deno.test("normalizarNomeGrupo — resultado curto (<3 chars) ou vazio retorna null", () => {
  assertEquals(normalizarNomeGrupo(null), null);
  assertEquals(normalizarNomeGrupo(""), null);
  assertEquals(normalizarNomeGrupo("   "), null);
  assertEquals(normalizarNomeGrupo("!!"), null);
  assertEquals(normalizarNomeGrupo("Grupo Whatsapp Oficial"), null); // só tokens ruidosos
  assertEquals(normalizarNomeGrupo("AB"), null);                     // 2 chars após normalização
});

// ---------------- Contadores de deduplicação ----------------

const INV_A = "https://chat.whatsapp.com/AAA111";
const INV_B = "https://chat.whatsapp.com/BBB222";
const INV_C = "https://chat.whatsapp.com/CCC333";

Deno.test("duplicados_invite_db — invite canônico já existe no banco é descartado", () => {
  const { contadores, novos, descartados } = processarLote(
    [{ url: INV_A, nome: "Condomínio Sudoeste" }],
    { invitesDb: [INV_A] },
  );
  assertEquals(contadores.duplicados_invite_db, 1);
  assertEquals(contadores.invites_novos, 0);
  assertEquals(novos.length, 0);
  assertEquals(descartados[0].criterio, "invite_db");
});

Deno.test("duplicados_invite_db — normalização de query-string do banco cobre variações do invite", () => {
  // Banco tem só o canônico; item vem com ?fbclid=xyz e trailing slash — normaliza igual.
  const { contadores } = processarLote(
    [{ url: "https://chat.whatsapp.com/AAA111?fbclid=xyz", nome: "Grupo A" }],
    { invitesDb: [INV_A] },
  );
  assertEquals(contadores.duplicados_invite_db, 1);
  assertEquals(contadores.invites_novos, 0);
});

Deno.test("duplicados_local — mesmo invite aparece 2x na mesma execução", () => {
  const { contadores, descartados } = processarLote([
    { url: INV_A, nome: "Grupo A" },
    { url: INV_A, nome: "Grupo A duplicado" },
  ]);
  assertEquals(contadores.invites_novos, 1);
  assertEquals(contadores.duplicados_local, 1);
  assertEquals(descartados[0].criterio, "invite_local");
});

Deno.test("duplicados_nome_local — invites diferentes com mesmo nome normalizado na execução", () => {
  const { contadores, descartados } = processarLote([
    { url: INV_A, nome: "GRUPO Águas Claras Oficial" },
    { url: INV_B, nome: "aguas   claras" },       // mesmo nome normalizado
    { url: INV_C, nome: "Águas Claras (WhatsApp)" }, // idem
  ]);
  assertEquals(contadores.invites_novos, 1);
  assertEquals(contadores.duplicados_nome_local, 2);
  assertEquals(descartados.map((d) => d.criterio), ["nome_local", "nome_local"]);
});

Deno.test("duplicados_nome_db — nome já existe no banco (após normalização) é descartado", () => {
  const { contadores, descartados } = processarLote(
    [{ url: INV_B, nome: "Zap Moradores Sudoeste" }],
    { nomesDb: ["Grupo Sudoeste - Oficial"] }, // normaliza para "sudoeste"; assert abaixo
  );
  // Sanidade: as duas formas colapsam para o mesmo nome normalizado
  assertEquals(normalizarNomeGrupo("Zap Moradores Sudoeste"), "moradores sudoeste");
  // Ajuste: usar par comprovadamente equivalente
  const equivalente = processarLote(
    [{ url: INV_B, nome: "Grupo Águas Claras" }],
    { nomesDb: ["ÁGUAS   CLARAS"] },
  );
  assertEquals(equivalente.contadores.duplicados_nome_db, 1);
  assertEquals(equivalente.contadores.invites_novos, 0);
  assertEquals(equivalente.descartados[0].criterio, "nome_db");
  // Contadores originais não devem contaminar
  assertEquals(contadores.duplicados_nome_db, 0); // "moradores sudoeste" ≠ "sudoeste"
  assert(descartados.length === 0);
});

Deno.test("ordem de precedência: invite_local > invite_db > nome_local > nome_db", () => {
  const { contadores, descartados } = processarLote(
    [
      { url: INV_A, nome: "Águas Claras" },                    // novo
      { url: INV_A, nome: "Águas Claras" },                    // invite_local (não conta como nome_local nem invite_db)
      { url: INV_B, nome: "GRUPO Águas Claras Oficial" },      // nome_local (mesmo nome normalizado do 1º)
      { url: INV_C, nome: "Sudoeste" },                        // invite_db (também bate nome_db, mas invite tem precedência)
    ],
    {
      invitesDb: [INV_C],
      nomesDb: ["sudoeste"],
    },
  );
  assertEquals(contadores.invites_novos, 1);
  assertEquals(contadores.duplicados_local, 1);
  assertEquals(contadores.duplicados_nome_local, 1);
  assertEquals(contadores.duplicados_invite_db, 1);
  assertEquals(contadores.duplicados_nome_db, 0);
  assertEquals(descartados.map((d) => d.criterio), ["invite_local", "nome_local", "invite_db"]);
});

Deno.test("nomes sem chave válida (só tokens ruidosos ou vazios) NÃO disparam dedup por nome", () => {
  const { contadores } = processarLote(
    [
      { url: INV_A, nome: "Grupo Whatsapp Oficial" }, // normaliza para null
      { url: INV_B, nome: "Grupo Whatsapp Oficial" }, // normaliza para null
    ],
    { nomesDb: ["Grupo Whatsapp Oficial"] },          // também normaliza para null
  );
  assertEquals(contadores.invites_novos, 2);
  assertEquals(contadores.duplicados_nome_local, 0);
  assertEquals(contadores.duplicados_nome_db, 0);
});

Deno.test("URLs inválidas/hosts errados incrementam os contadores corretos e não afetam dedup", () => {
  const { contadores } = processarLote([
    { url: "", nome: "x" },                                    // sem url
    { url: "https://example.com/AAA", nome: "y" },             // host inválido
    { url: "https://chat.whatsapp.com/AAA111", nome: "Grupo Sudoeste" }, // válido novo
  ]);
  assertEquals(contadores.descartados_sem_url, 1);
  assertEquals(contadores.descartados_host_invalido, 1);
  assertEquals(contadores.invites_validos, 1);
  assertEquals(contadores.invites_novos, 1);
});

Deno.test("reprocessamento (forçado) ignora TODAS as regras de dedup", () => {
  const { contadores, novos } = processarLote(
    [
      { url: INV_A, nome: "Águas Claras" }, // bateria em invite_db + nome_db
      { url: INV_B, nome: "Águas Claras" }, // bateria em nome_db
    ],
    {
      invitesDb: [INV_A],
      nomesDb: ["Águas Claras"],
      forcarInvites: [INV_A, INV_B],
    },
  );
  assertEquals(contadores.invites_novos, 2);
  assertEquals(contadores.duplicados_invite_db, 0);
  assertEquals(contadores.duplicados_nome_db, 0);
  assertEquals(contadores.duplicados_nome_local, 0);
  assertEquals(novos.map((n) => n.invite), [INV_A, INV_B]);
});
