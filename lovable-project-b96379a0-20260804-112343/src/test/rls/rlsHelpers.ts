/**
 * Helpers para suíte de testes de RLS / isolamento multi-tenant.
 *
 * A suíte requer 2 usuários de teste **já criados e com e-mail confirmado**:
 *   TEST_TENANT_A_EMAIL / TEST_TENANT_A_PASSWORD
 *   TEST_TENANT_B_EMAIL / TEST_TENANT_B_PASSWORD
 *
 * Opcionalmente:
 *   VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY (usam os do .env por padrão)
 *
 * Quando as variáveis não estão definidas os testes são pulados (skipped)
 * para não quebrar o CI em ambientes sem credenciais.
 */
import { createClient, SupabaseClient } from "@supabase/supabase-js";

export interface TenantCtx {
  client: SupabaseClient;
  userId: string;
  email: string;
}

export interface RlsEnv {
  url: string;
  anonKey: string;
  a: { email: string; password: string };
  b: { email: string; password: string };
}

export function loadRlsEnv(): RlsEnv | null {
  const url = process.env.VITE_SUPABASE_URL || import.meta.env?.VITE_SUPABASE_URL;
  const anonKey =
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY;
  const aEmail = process.env.TEST_TENANT_A_EMAIL;
  const aPass = process.env.TEST_TENANT_A_PASSWORD;
  const bEmail = process.env.TEST_TENANT_B_EMAIL;
  const bPass = process.env.TEST_TENANT_B_PASSWORD;
  if (!url || !anonKey || !aEmail || !aPass || !bEmail || !bPass) return null;
  return {
    url,
    anonKey,
    a: { email: aEmail, password: aPass },
    b: { email: bEmail, password: bPass },
  };
}

export function newAnonClient(env: RlsEnv): SupabaseClient {
  return createClient(env.url, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function signIn(
  env: RlsEnv,
  creds: { email: string; password: string }
): Promise<TenantCtx> {
  const client = newAnonClient(env);
  const { data, error } = await client.auth.signInWithPassword(creds);
  if (error || !data.user)
    throw new Error(`Falha ao autenticar ${creds.email}: ${error?.message}`);
  return { client, userId: data.user.id, email: creds.email };
}

export async function signOut(ctx: TenantCtx) {
  try {
    await ctx.client.auth.signOut();
  } catch {
    /* noop */
  }
}

/** Contador utilitário para geração de rótulos únicos. */
export const rid = (prefix = "rls") =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
