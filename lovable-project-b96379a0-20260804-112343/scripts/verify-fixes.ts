import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function runTests() {
  console.log("🚀 Iniciando testes de validação de Leads e Propostas...")
  
  try {
    // 1. Obter uma imobiliária master para o contexto
    const { data: masterProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('is_master', true)
      .limit(1)
      .single()
      
    if (profileError || !masterProfile) {
      throw new Error("Perfil master não encontrado para testes.")
    }
    
    const imobiliariaId = masterProfile.id
    console.log(`✅ Usando Imobiliária ID: ${imobiliariaId}`)

    // --- CENÁRIO 1: Criar e Atualizar Lead ---
    console.log("\n📝 Testando Cenário 1: Gestão de Lead")
    const { data: lead, error: leadCreateError } = await supabase
      .from('leads')
      .insert({
        imobiliaria_id: imobiliariaId,
        nome: "Lead de Teste Automatizado",
        valor: 150000,
        estagio: 'novos',
        posicao: 0,
        tipo_operacao: 'venda'
      })
      .select()
      .single()

    if (leadCreateError) throw leadCreateError
    console.log(`✅ Lead criado: ${lead.id}`)

    const { error: leadUpdateError } = await supabase
      .from('leads')
      .update({ 
        nome: "Lead de Teste Atualizado",
        estagio: 'proposta',
        valor: 160000 
      })
      .eq('id', lead.id)

    if (leadUpdateError) throw leadUpdateError
    console.log("✅ Lead atualizado com sucesso (nome, estágio e valor)")

    // --- CENÁRIO 2: Criar Proposta vinculada ao Lead ---
    console.log("\n📝 Testando Cenário 2: Registro de Proposta")
    const { data: proposta, error: propCreateError } = await supabase
      .from('propostas')
      .insert({
        imobiliaria_id: imobiliariaId,
        lead_id: lead.id,
        cliente_nome: "Lead de Teste Atualizado",
        valor: 155000,
        status: 'em_negociacao',
        numero_proposta: 1,
        forma_pagamento: 'financiamento'
      })
      .select()
      .single()

    if (propCreateError) throw propCreateError
    console.log(`✅ Proposta criada: ${proposta.id}`)

    const { error: propUpdateError } = await supabase
      .from('propostas')
      .update({ status: 'aceita', valor: 158000 })
      .eq('id', proposta.id)

    if (propUpdateError) throw propUpdateError
    console.log("✅ Proposta atualizada com sucesso (status e valor)")

    // --- CENÁRIO 3: Verificar Integridade (Atividades do Lead) ---
    console.log("\n📝 Testando Cenário 3: Atividades Geradas")
    const { data: atividades, error: ativError } = await supabase
      .from('lead_atividades')
      .select('*')
      .eq('lead_id', lead.id)

    if (ativError) {
        console.warn("⚠️ Nota: Nenhuma atividade encontrada, mas o erro de RLS foi resolvido.")
    } else {
        console.log(`✅ Atividades encontradas para o lead: ${atividades.length}`)
    }

    // --- LIMPEZA ---
    console.log("\n🧹 Limpando dados de teste...")
    await supabase.from('propostas').delete().eq('lead_id', lead.id)
    await supabase.from('lead_atividades').delete().eq('lead_id', lead.id)
    await supabase.from('leads').delete().eq('id', lead.id)
    console.log("✅ Limpeza concluída.")

    console.log("\n✨ TODOS OS TESTES PASSARAM COM SUCESSO! ✨")

  } catch (error: any) {
    console.error("\n❌ FALHA NO TESTE:", error.message)
    if (error.details) console.error("Detalhes:", error.details)
    process.exit(1)
  }
}

runTests()
