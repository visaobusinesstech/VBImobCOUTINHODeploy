
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Não autorizado");

    const sbUrl = Deno.env.get("SUPABASE_URL")!;
    const sbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(sbUrl, sbKey);

    const { siteId, postData } = await req.json();

    // Fetch site credentials
    const { data: site, error: siteError } = await supabase
      .from("wordpress_sites")
      .select("*")
      .eq("id", siteId)
      .single();

    if (siteError || !site) throw new Error("Site não encontrado ou erro nas credenciais.");

    const { base_url, username, application_password, seo_plugin } = site;
    
    // Clean URL
    let apiUrl = base_url.replace(/\/$/, "");
    if (!apiUrl.startsWith("http")) apiUrl = "https://" + apiUrl;
    apiUrl += "/wp-json/wp/v2/posts";

    // Prepare Auth
    const auth = btoa(`${username}:${application_password}`);

    // Prepare Post Body
    const body: any = {
      title: postData.title,
      content: postData.content,
      status: postData.status || "draft",
      excerpt: postData.excerpt,
      slug: postData.slug,
    };

    // SEO Plugin Support
    if (seo_plugin === "yoast") {
      body.meta = {
        _yoast_wpseo_title: postData.title,
        _yoast_wpseo_metadesc: postData.excerpt
      };
    }

    console.log(`Posting to: ${apiUrl} as ${username}`);

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("WordPress API Error:", errorText);
      throw new Error(`Erro no WordPress: ${response.status} - ${errorText}`);
    }

    const result = await response.json();

    return new Response(JSON.stringify({ success: true, post: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("wordpress-post error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
