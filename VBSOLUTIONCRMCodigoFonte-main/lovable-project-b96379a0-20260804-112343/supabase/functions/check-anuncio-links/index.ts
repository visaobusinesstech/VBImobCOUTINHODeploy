const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type LinkStatus = {
  url: string;
  ok: boolean;
  status: number | null;
  checked_at: string;
  error?: string;
};

const UA = "Mozilla/5.0 (compatible; RadarImobtechBot/1.0; +https://radarimobtech.shop)";

async function checkOne(url: string, timeoutMs = 6000): Promise<LinkStatus> {
  const checked_at = new Date().toISOString();
  if (!url || !/^https?:\/\//i.test(url)) {
    return { url, ok: false, status: null, checked_at, error: "URL inválida" };
  }
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // Try HEAD first (cheaper); some portals reject HEAD → fallback to GET
    let resp = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": UA, Accept: "text/html,*/*" },
    }).catch(() => null);

    if (!resp || resp.status === 405 || resp.status === 403 || resp.status === 501) {
      resp = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
        headers: { "User-Agent": UA, Accept: "text/html,*/*" },
      });
    }
    const status = resp.status;
    return { url, ok: status >= 200 && status < 400, status, checked_at };
  } catch (e) {
    return {
      url,
      ok: false,
      status: null,
      checked_at,
      error: (e as Error)?.name === "AbortError" ? "timeout" : (e as Error)?.message || "network_error",
    };
  } finally {
    clearTimeout(t);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const urls: string[] = Array.isArray(body?.urls) ? body.urls.slice(0, 60) : [];
    if (urls.length === 0) {
      return new Response(JSON.stringify({ success: true, results: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Dedup while preserving order
    const uniq = Array.from(new Set(urls.filter((u) => typeof u === "string")));

    // Concurrency 8
    const results: LinkStatus[] = [];
    const queue = [...uniq];
    async function worker() {
      while (queue.length) {
        const u = queue.shift()!;
        results.push(await checkOne(u));
      }
    }
    await Promise.all(Array.from({ length: 8 }, () => worker()));

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
