import { supabase } from "@/integrations/supabase/client";

const CONTRATOS_BUCKET = "contratos";
const STORAGE_MARKERS = [
  "/object/public/contratos/",
  "/object/sign/contratos/",
  "/object/authenticated/contratos/",
  "/storage/v1/object/public/contratos/",
  "/storage/v1/object/sign/contratos/",
  "/storage/v1/object/authenticated/contratos/",
  "/storage/v1/s3/contratos/",
];

export type ResolveContratoFileSourceTable = "contratos" | "contrato_anexos_anuais" | "contrato_comprovantes_mensais";

export interface ResolveContratoFileOptions {
  contractId?: string | null;
  sourceTable?: ResolveContratoFileSourceTable;
  sourceField?: string;
  recordId?: string | null;
}

/**
 * Upload a file to the private contratos bucket and return the stored path.
 */
export async function uploadContratoFilePrivate(
  file: File,
  path: string,
): Promise<string | null> {
  const { error } = await supabase.storage
    .from(CONTRATOS_BUCKET)
    .upload(path, file, { upsert: true });

  if (error) {
    console.error("[contratosStorage] Upload error:", error.message, error);
    return null;
  }

  return path;
}

/**
 * Get a fresh signed URL for a file in the private contratos bucket.
 * Works for both current storage paths and legacy public/signed URLs.
 */
export async function getContratoSignedUrl(
  pathOrUrl: string,
  options?: ResolveContratoFileOptions,
): Promise<string | null> {
  if (!pathOrUrl) return null;

  const sanitizedReference = sanitizeReference(pathOrUrl);
  const isBucketReference = isContratoBucketReference(sanitizedReference);
  const normalizedReference = isBucketReference
    ? `${CONTRATOS_BUCKET}/${extractPathFromUrl(sanitizedReference)}`
    : sanitizedReference;

  try {
    const { data, error } = await supabase.functions.invoke("resolve-contrato-file", {
      body: {
        pathOrUrl: normalizedReference,
        contractId: options?.contractId ?? null,
        sourceTable: options?.sourceTable,
        sourceField: options?.sourceField,
        recordId: options?.recordId ?? null,
      },
    });

    if (error) throw error;
    if (data?.signedUrl) return data.signedUrl as string;
  } catch (error) {
    console.error("[contratosStorage] resolve-contrato-file failed, using fallback:", error);
  }

  const path = isBucketReference ? extractPathFromUrl(normalizedReference) : "";
  if (!path) {
    return sanitizedReference.startsWith("http") && !isBucketReference ? sanitizedReference : null;
  }

  const { data, error } = await supabase.storage
    .from(CONTRATOS_BUCKET)
    .createSignedUrl(path, 3600);

  if (error || !data?.signedUrl) {
    console.error("[contratosStorage] Signed URL fallback error:", error?.message, error);

    return sanitizedReference.startsWith("http") && !isBucketReference ? sanitizedReference : null;
  }

  return data.signedUrl;
}

function extractPathFromUrl(pathOrUrl: string): string {
  if (!pathOrUrl) return pathOrUrl;

  const sanitized = sanitizeReference(pathOrUrl);

  if (sanitized.startsWith("private::")) {
    const parts = sanitized.split("::");
    if (parts.length >= 3) return parts.slice(2).join("::");
  }

  if (sanitized.startsWith(`${CONTRATOS_BUCKET}/`)) {
    return sanitized.slice(`${CONTRATOS_BUCKET}/`.length);
  }

  if (sanitized.startsWith("novo/")) {
    return sanitized;
  }

  for (const marker of STORAGE_MARKERS) {
    const index = sanitized.indexOf(marker);
    if (index !== -1) {
      return decodeSafe(sanitized.substring(index + marker.length));
    }
  }

  if (sanitized.startsWith("http") && sanitized.includes(`/${CONTRATOS_BUCKET}/`)) {
    const index = sanitized.indexOf(`/${CONTRATOS_BUCKET}/`);
    return decodeSafe(sanitized.substring(index + `/${CONTRATOS_BUCKET}/`.length));
  }

  return decodeSafe(sanitized);
}

function isContratoBucketReference(pathOrUrl: string): boolean {
  const sanitized = sanitizeReference(pathOrUrl);

  return Boolean(sanitized) && (
    sanitized.startsWith("private::") ||
    sanitized.startsWith(`${CONTRATOS_BUCKET}/`) ||
    sanitized.startsWith("novo/") ||
    STORAGE_MARKERS.some((marker) => sanitized.includes(marker)) ||
    (sanitized.startsWith("http") && sanitized.includes(`/${CONTRATOS_BUCKET}/`)) ||
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\//i.test(sanitized)
  );
}

function sanitizeReference(value: string) {
  const [withoutHash] = value.split("#");
  const [withoutQuery] = withoutHash.split("?");

  return decodeSafe(withoutQuery.trim());
}

function decodeSafe(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
