import { supabase } from "@/integrations/supabase/client";

/**
 * Resolves a document URL — if it's a private storage reference (private::bucket::path),
 * creates a signed URL. Otherwise returns the original URL as-is (legacy public URLs).
 */
export async function resolveDocUrl(url: string): Promise<string> {
  if (!url.startsWith("private::")) return url;
  
  const parts = url.split("::");
  if (parts.length < 3) return url;
  
  const bucket = parts[1];
  const path = parts.slice(2).join("::");
  
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 3600); // 1 hour expiry
  
  if (error || !data?.signedUrl) {
    console.error("Error creating signed URL:", error);
    return url;
  }
  
  return data.signedUrl;
}

/**
 * Resolves an array of document URLs, returning signed URLs for private ones.
 */
export async function resolveDocUrls(urls: string[]): Promise<string[]> {
  return Promise.all(urls.map(resolveDocUrl));
}
