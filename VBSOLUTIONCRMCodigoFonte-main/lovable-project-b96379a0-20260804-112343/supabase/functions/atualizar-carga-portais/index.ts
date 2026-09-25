import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get imobiliaria_id from body (manual) or run for all (cron)
    let imobiliariaIds: string[] = [];

    if (req.method === 'POST') {
      try {
        const body = await req.json();
        if (body.imobiliaria_id) {
          imobiliariaIds = [body.imobiliaria_id];
        }
      } catch {
        // empty body = cron call, process all
      }
    }

    // If no specific ID, get all users with active properties (cron mode)
    if (imobiliariaIds.length === 0) {
      const { data: imobiliarias } = await supabase
        .from('imoveis')
        .select('imobiliaria_id')
        .eq('status', 'Ativo');

      if (imobiliarias) {
        const uniqueIds = [...new Set(imobiliarias.map((i: any) => i.imobiliaria_id))];
        imobiliariaIds = uniqueIds as string[];
      }
    }

    const portais = ['dfimoveis', 'vrsync', 'olx', 'imovelweb', 'wimoveis', 'netimoveis', 'chavenaomao'];
    const results: { imobiliaria_id: string; portais_atualizados: number; timestamp: string }[] = [];

    for (const imobiliariaId of imobiliariaIds) {
      let atualizados = 0;

      for (const portal of portais) {
        // Ping the XML feed to force regeneration / cache-bust
        const feedUrl = `${supabaseUrl}/functions/v1/xml-feed-imoveis?id=${imobiliariaId}&portal=${portal}&_t=${Date.now()}`;
        try {
          const resp = await fetch(feedUrl, {
            headers: { 'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}` },
          });
          if (resp.ok) {
            atualizados++;
            // Consume body to prevent resource leak
            await resp.text();
          } else {
            await resp.text();
          }
        } catch (e) {
          console.error(`Erro ao pingar feed ${portal} para ${imobiliariaId}:`, e);
        }
      }

      // Update timestamp on all active properties to signal freshness
      await supabase
        .from('imoveis')
        .update({ updated_at: new Date().toISOString() })
        .eq('imobiliaria_id', imobiliariaId)
        .eq('status', 'Ativo');

      results.push({
        imobiliaria_id: imobiliariaId,
        portais_atualizados: atualizados,
        timestamp: new Date().toISOString(),
      });
    }

    // Notify master user
    if (imobiliariaIds.length > 0) {
      const { data: master } = await supabase
        .from('profiles')
        .select('id')
        .eq('is_master', true)
        .single();

      if (master) {
        await supabase.from('notifications').insert({
          user_id: master.id,
          title: '🔄 Carga de portais atualizada',
          description: `Feed XML atualizado para ${results.length} imobiliária(s) em ${portais.length} portais. Anúncios renovados com sucesso.`,
        });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Erro ao atualizar carga:', err);
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
