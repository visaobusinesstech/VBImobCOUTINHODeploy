import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sbAdmin = createClient(supabaseUrl, serviceKey);

    // Get client IP from headers
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
               req.headers.get("x-real-ip") ||
               "unknown";

    const body = await req.json();
    const { user_id } = body;

    if (!user_id || typeof user_id !== "string") {
      return new Response(JSON.stringify({ error: "user_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check how many accounts were created from this IP recently
    const { data: abuseCount } = await sbAdmin.rpc("check_ip_abuse", { _ip: ip });
    const isAbuse = (abuseCount || 0) >= 3; // 3+ accounts from same IP in 30 days

    // Record the IP
    await sbAdmin.from("signup_ips").insert({ ip_address: ip, user_id });

    // Update profile with IP
    await sbAdmin.from("profiles").update({ signup_ip: ip }).eq("id", user_id);

    if (isAbuse) {
      // Flag suspicious account - don't auto-approve
      await sbAdmin.from("profiles").update({ approved: false }).eq("id", user_id);
      
      // Notify master
      const { data: master } = await sbAdmin.from("profiles").select("id").eq("is_master", true).limit(1).single();
      if (master) {
        await sbAdmin.from("notifications").insert({
          user_id: master.id,
          title: "⚠️ Possível abuso de trial detectado",
          description: `IP ${ip} criou ${abuseCount} contas nos últimos 30 dias. Novo usuário: ${user_id}`,
        });
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      abuse_detected: isAbuse,
      accounts_from_ip: abuseCount || 0,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("track-signup-ip error:", e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
