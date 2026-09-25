import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import * as XLSX from "https://esm.sh/xlsx@0.18.5"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { exportId } = await req.json()
    if (!exportId) throw new Error("ID de exportação não fornecido")

    // 1. Marcar como processando
    await supabaseClient
      .from('batch_exports')
      .update({ status: 'processing', processed_items: 0 })
      .eq('id', exportId)

    // 2. Buscar itens em lotes para atualizar o progresso
    // Aqui fazemos uma busca total primeiro para ter os dados
    const { data: items, error: fetchError } = await supabaseClient
      .from('export_queue_items')
      .select('data')
      .eq('export_id', exportId)

    if (fetchError || !items) throw fetchError || new Error("Nenhum item encontrado")

    // Simulamos progresso enquanto preparamos o buffer (opcional se for muito rápido, mas bom para UX)
    const total = items.length
    const updateInterval = Math.max(1, Math.floor(total / 5)) // Atualiza 5 vezes durante o processo
    
    for (let i = 0; i < total; i += updateInterval) {
      await supabaseClient
        .from('batch_exports')
        .update({ processed_items: Math.min(i + updateInterval, total) })
        .eq('id', exportId)
    }

    const rows = items.map(i => i.data)
    
    // 3. Gerar Excel usando XLSX
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Export")
    
    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    // 4. Upload para o Storage
    const { data: exportData } = await supabaseClient
      .from('batch_exports')
      .select('filename, user_id')
      .eq('id', exportId)
      .single()

    const filePath = `${exportData.user_id}/${exportId}_${exportData.filename}.xlsx`
    
    const { error: uploadError } = await supabaseClient.storage
      .from('exports')
      .upload(filePath, excelBuffer, {
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        upsert: true
      })

    if (uploadError) throw uploadError

    // 5. Obter URL pública
    const { data: { publicUrl } } = supabaseClient.storage
      .from('exports')
      .getPublicUrl(filePath)

    // 6. Finalizar com 100% de progresso
    await supabaseClient
      .from('batch_exports')
      .update({ 
        status: 'completed', 
        processed_items: total,
        download_url: publicUrl 
      })
      .eq('id', exportId)

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
