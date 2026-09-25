// Shared helpers for schema-drift regression tests.
// Do NOT put Deno.test() here — this is imported by per-function *_test.ts files.
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

export const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
export const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

assert(SUPABASE_URL, "VITE_SUPABASE_URL missing");
assert(SUPABASE_ANON_KEY, "VITE_SUPABASE_PUBLISHABLE_KEY missing");

export async function readFn(name: string): Promise<string> {
  // Resolve relative to the repo layout: supabase/functions/<name>/index.ts
  const url = new URL(`../${name}/index.ts`, import.meta.url);
  return await Deno.readTextFile(url);
}

/** Extracts every `.from("table")...select("cols")` pair with a literal column list. */
export function extractFromSelectPairs(src: string): Array<{ table: string; cols: string[] }> {
  const out: Array<{ table: string; cols: string[] }> = [];
  const re = /\.from\(\s*["'`]([a-zA-Z0-9_]+)["'`]\s*\)\s*(?:\.[a-zA-Z0-9_]+\([^)]*\)\s*)*?\.select\(\s*["'`]([^"'`]+)["'`]/gs;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const table = m[1];
    const raw = m[2];
    // Skip aggregates / relational embeds / wildcards.
    if (raw.includes("(") || raw.includes(")") || raw.trim() === "*") continue;
    const cols = raw
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean)
      .map((c) => c.split(":")[0].trim()) // strip aliases
      .filter((c) => /^[a-zA-Z0-9_]+$/.test(c));
    if (cols.length) out.push({ table, cols });
  }
  return out;
}

const columnCache = new Map<string, Set<string>>();

/**
 * Introspect columns for a `public` table via the `introspect_table_columns` RPC
 * (a stable, security-definer helper installed for the test suite).
 */
export async function getTableColumns(table: string): Promise<Set<string>> {
  const cached = columnCache.get(table);
  if (cached) return cached;

  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/introspect_table_columns`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ _table: table }),
  });
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`RPC introspect_table_columns(${table}) failed: ${res.status} ${body}`);
  }
  const rows = JSON.parse(body) as Array<{ column_name: string }>;
  const cols = new Set(rows.map((r) => r.column_name));
  assert(cols.size > 0, `Could not introspect columns for table "${table}" (no rows returned)`);
  columnCache.set(table, cols);
  return cols;
}

/** Assert every column selected by the given edge function exists in its target table. */
export async function assertFunctionSchemaValid(fnName: string) {
  const src = await readFn(fnName);
  const pairs = extractFromSelectPairs(src);
  assert(pairs.length > 0, `No .from().select() pairs found in ${fnName}/index.ts`);

  const errors: string[] = [];
  for (const { table, cols } of pairs) {
    let actual: Set<string>;
    try {
      actual = await getTableColumns(table);
    } catch (e) {
      errors.push(`[${fnName}] table "${table}" introspection failed: ${(e as Error).message}`);
      continue;
    }
    for (const col of cols) {
      if (!actual.has(col)) {
        errors.push(`[${fnName}] "${table}.${col}" is selected but does NOT exist in schema`);
      }
    }
  }
  assertEquals(errors, [], `Schema mismatches:\n${errors.join("\n")}`);
}
