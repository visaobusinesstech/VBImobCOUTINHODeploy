import { supabase } from "@/integrations/supabase/client";

const SECRET_STORAGE_KEY = "preview_auth_secret";
const EMAIL_STORAGE_KEY = "preview_auth_email";

export function isPreviewHost(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return (
    h === "localhost" ||
    h === "127.0.0.1" ||
    h.endsWith(".lovable.app") ||
    h.endsWith(".lovableproject.com")
  );
}

export function getStoredPreviewSecret(): string {
  try { return localStorage.getItem(SECRET_STORAGE_KEY) ?? ""; } catch { return ""; }
}
export function setStoredPreviewSecret(v: string) {
  try { localStorage.setItem(SECRET_STORAGE_KEY, v); } catch { /* noop */ }
}
export function getStoredPreviewEmail(): string {
  try { return localStorage.getItem(EMAIL_STORAGE_KEY) ?? ""; } catch { return ""; }
}
export function setStoredPreviewEmail(v: string) {
  try { localStorage.setItem(EMAIL_STORAGE_KEY, v); } catch { /* noop */ }
}

export interface PreviewLoginResult {
  email: string;
  userId: string;
  accessToken: string;
}

/**
 * Mints a real Supabase session for the given email using the dev-preview-login
 * edge function (protected by a shared secret). After this resolves, subsequent
 * supabase.functions.invoke() calls carry a valid Authorization: Bearer JWT.
 */
export async function previewLogin(opts?: { secret?: string; email?: string }): Promise<PreviewLoginResult> {
  const secret = (opts?.secret ?? getStoredPreviewSecret()).trim();
  const email = (opts?.email ?? getStoredPreviewEmail()).trim();
  if (!secret) throw new Error("Segredo de preview ausente (DEV_PREVIEW_SECRET).");
  if (!email) throw new Error("Informe o e-mail do usuário de preview.");

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const url = `https://${projectId}.functions.supabase.co/dev-preview-login`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-preview-secret": secret,
    },
    body: JSON.stringify({ email }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `HTTP ${res.status}`);
  }

  const { error, data: sessionData } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: data.token_hash,
  });
  if (error || !sessionData?.session) {
    throw new Error(error?.message || "verifyOtp falhou");
  }

  setStoredPreviewSecret(secret);
  setStoredPreviewEmail(email);

  return {
    email: sessionData.user?.email ?? email,
    userId: sessionData.user!.id,
    accessToken: sessionData.session.access_token,
  };
}

export async function previewLogout(): Promise<void> {
  await supabase.auth.signOut();
}
