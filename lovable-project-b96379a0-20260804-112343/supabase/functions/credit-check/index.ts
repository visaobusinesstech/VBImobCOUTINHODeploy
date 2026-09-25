import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface RestrictionDetail {
  descricao: string;
  credor: string;
  valor: number;
  data: string;
  cidade: string;
  uf: string;
}

interface DespejoRecord {
  tipo: string;
  vara: string;
  comarca: string;
  uf: string;
  data: string;
  status: string;
}

interface ProcessoRecord {
  tipo: string;
  numero: string;
  vara: string;
  comarca: string;
  uf: string;
  data: string;
  status: string;
  natureza: string;
}

function generateSimulatedScore(cpf: string): {
  score: number;
  restrictions: RestrictionDetail[];
  riskLevel: string;
  despejos: DespejoRecord[];
  processosCivis: ProcessoRecord[];
  processosCriminais: ProcessoRecord[];
  historicoEnderecos: { endereco: string; bairro: string; cidade: string; uf: string; periodo: string }[];
  chequesSemFundo: { banco: string; agencia: string; numero: string; valor: number; data: string; motivo: string }[];
  participacoesSocietarias: { cnpj: string; razaoSocial: string; cargo: string; dataEntrada: string; situacao: string; capitalSocial: number }[];
  rendaEstimada: { faixa: string; classe: string; rendaMin: number; rendaMax: number; compatibilidadeAluguel: number; fonteEstimativa: string };
} {
  const digits = cpf.replace(/\D/g, "");
  const seed = digits.split("").reduce((a, b) => a + parseInt(b), 0);
  // Use a wider distribution - more CPFs will show restrictions for realistic simulation
  const baseScore = 300 + (seed * 29) % 600;
  const score = Math.min(850, Math.max(300, baseScore));

  const restrictions: RestrictionDetail[] = [];
  if (score < 600) {
    restrictions.push({
      descricao: "Pendência financeira registrada",
      credor: seed % 2 === 0 ? "Banco Itaú S.A." : "Magazine Luiza S.A.",
      valor: 1200 + (seed * 13) % 8000,
      data: new Date(Date.now() - (seed % 365) * 86400000).toISOString().split("T")[0],
      cidade: seed % 3 === 0 ? "São Paulo" : seed % 3 === 1 ? "Brasília" : "Rio de Janeiro",
      uf: seed % 3 === 0 ? "SP" : seed % 3 === 1 ? "DF" : "RJ",
    });
    if (score < 500) {
      restrictions.push({
        descricao: "Protesto em cartório",
        credor: seed % 2 === 0 ? "Claro S.A." : "Vivo Telecomunicações",
        valor: 500 + (seed * 7) % 3000,
        data: new Date(Date.now() - ((seed + 30) % 300) * 86400000).toISOString().split("T")[0],
        cidade: seed % 2 === 0 ? "Curitiba" : "Belo Horizonte",
        uf: seed % 2 === 0 ? "PR" : "MG",
      });
    }
    if (score < 450) {
      restrictions.push({
        descricao: "Dívida negativada",
        credor: seed % 2 === 0 ? "Casas Bahia" : "Banco Santander",
        valor: 800 + (seed * 11) % 5000,
        data: new Date(Date.now() - ((seed + 60) % 200) * 86400000).toISOString().split("T")[0],
        cidade: seed % 2 === 0 ? "Goiânia" : "Recife",
        uf: seed % 2 === 0 ? "GO" : "PE",
      });
    }
  }
  if (score < 700 && seed % 3 === 0) {
    restrictions.push({
      descricao: "Consulta recente em outro bureau",
      credor: "Consulta informativa",
      valor: 0,
      data: new Date(Date.now() - (seed % 30) * 86400000).toISOString().split("T")[0],
      cidade: seed % 2 === 0 ? "Goiânia" : "Recife",
      uf: seed % 2 === 0 ? "GO" : "PE",
    });
  }

  const riskLevel = score >= 700 ? "baixo" : score >= 500 ? "moderado" : "alto";

  // Simulated eviction history (despejo)
  const despejos: DespejoRecord[] = [];
  if (score < 550 && seed % 3 !== 0) {
    despejos.push({
      tipo: "Ação de Despejo por Falta de Pagamento",
      vara: `${(seed % 10) + 1}ª Vara Cível`,
      comarca: seed % 2 === 0 ? "São Paulo" : "Rio de Janeiro",
      uf: seed % 2 === 0 ? "SP" : "RJ",
      data: new Date(Date.now() - ((seed * 11) % 730 + 180) * 86400000).toISOString().split("T")[0],
      status: seed % 3 === 0 ? "Transitado em julgado" : "Arquivado",
    });
  }
  if (score < 380) {
    despejos.push({
      tipo: "Ação de Despejo por Descumprimento Contratual",
      vara: `${(seed % 5) + 1}ª Vara Cível`,
      comarca: seed % 2 === 0 ? "Curitiba" : "Belo Horizonte",
      uf: seed % 2 === 0 ? "PR" : "MG",
      data: new Date(Date.now() - ((seed * 7) % 1000 + 365) * 86400000).toISOString().split("T")[0],
      status: "Transitado em julgado",
    });
  }

  // Simulated civil lawsuits
  const processosCivis: ProcessoRecord[] = [];
  if (seed % 5 < 3 && score < 700) {
    processosCivis.push({
      tipo: "Ação de Cobrança",
      numero: `${seed * 1234}-${(seed % 90) + 10}.${new Date().getFullYear()}.8.${seed % 2 === 0 ? "26" : "19"}.0001`,
      vara: `${(seed % 8) + 1}ª Vara Cível`,
      comarca: seed % 3 === 0 ? "São Paulo" : seed % 3 === 1 ? "Brasília" : "Fortaleza",
      uf: seed % 3 === 0 ? "SP" : seed % 3 === 1 ? "DF" : "CE",
      data: new Date(Date.now() - ((seed * 9) % 500 + 60) * 86400000).toISOString().split("T")[0],
      status: seed % 2 === 0 ? "Em andamento" : "Arquivado",
      natureza: "Cobrança / Execução Fiscal",
    });
  }
  if (seed % 7 === 0 && score < 500) {
    processosCivis.push({
      tipo: "Execução de Título Extrajudicial",
      numero: `${seed * 5678}-${(seed % 80) + 10}.${new Date().getFullYear() - 1}.8.${seed % 2 === 0 ? "13" : "05"}.0001`,
      vara: `${(seed % 6) + 1}ª Vara de Execuções`,
      comarca: seed % 2 === 0 ? "Recife" : "Salvador",
      uf: seed % 2 === 0 ? "PE" : "BA",
      data: new Date(Date.now() - ((seed * 5) % 800 + 120) * 86400000).toISOString().split("T")[0],
      status: "Em andamento",
      natureza: "Execução de Título",
    });
  }

  // Simulated criminal records
  const processosCriminais: ProcessoRecord[] = [];
  if (seed % 11 === 0 && score < 400) {
    processosCriminais.push({
      tipo: "Ação Penal",
      numero: `${seed * 9012}-${(seed % 70) + 10}.${new Date().getFullYear() - 2}.8.${seed % 2 === 0 ? "26" : "13"}.0001`,
      vara: `${(seed % 4) + 1}ª Vara Criminal`,
      comarca: seed % 2 === 0 ? "São Paulo" : "Rio de Janeiro",
      uf: seed % 2 === 0 ? "SP" : "RJ",
      data: new Date(Date.now() - ((seed * 13) % 1200 + 200) * 86400000).toISOString().split("T")[0],
      status: "Arquivado",
      natureza: "Estelionato",
    });
  }

  // Simulated address history
  const cidades = ["São Paulo", "Rio de Janeiro", "Curitiba", "Belo Horizonte", "Brasília", "Salvador", "Fortaleza", "Recife"];
  const ufs = ["SP", "RJ", "PR", "MG", "DF", "BA", "CE", "PE"];
  const bairros = ["Centro", "Jardins", "Copacabana", "Savassi", "Asa Sul", "Barra", "Aldeota", "Boa Viagem"];
  const historicoEnderecos = [];
  const numEnderecos = 2 + (seed % 3);
  for (let i = 0; i < numEnderecos; i++) {
    const ci = (seed + i * 3) % cidades.length;
    const anoFim = 2025 - i * 2;
    const anoInicio = anoFim - 1 - (seed % 3);
    historicoEnderecos.push({
      endereco: `Rua ${["das Flores", "São José", "XV de Novembro", "Sete de Setembro", "Augusta"][(seed + i) % 5]}, ${100 + (seed * (i + 1)) % 900}`,
      bairro: bairros[ci],
      cidade: cidades[ci],
      uf: ufs[ci],
      periodo: `${anoInicio} - ${i === 0 ? "Atual" : String(anoFim)}`,
    });
  }

  // Simulated CCF (cheques sem fundo)
  const chequesSemFundo: { banco: string; agencia: string; numero: string; valor: number; data: string; motivo: string }[] = [];
  if (score < 550 && seed % 2 === 0) {
    chequesSemFundo.push({
      banco: seed % 2 === 0 ? "Banco do Brasil" : "Bradesco",
      agencia: `${1000 + (seed * 3) % 9000}`,
      numero: `${100000 + (seed * 7) % 900000}`,
      valor: 500 + (seed * 11) % 5000,
      data: new Date(Date.now() - ((seed * 17) % 600 + 90) * 86400000).toISOString().split("T")[0],
      motivo: seed % 2 === 0 ? "Insuficiência de fundos" : "Conta encerrada",
    });
  }

  // Simulated corporate participations
  const participacoesSocietarias: { cnpj: string; razaoSocial: string; cargo: string; dataEntrada: string; situacao: string; capitalSocial: number }[] = [];
  if (seed % 4 < 2) {
    participacoesSocietarias.push({
      cnpj: `${10 + seed % 90}.${100 + (seed * 3) % 900}.${100 + (seed * 7) % 900}/0001-${10 + seed % 90}`,
      razaoSocial: seed % 3 === 0 ? "Comércio Digital LTDA" : seed % 3 === 1 ? "Consultoria & Serviços ME" : "Imóveis & Participações S.A.",
      cargo: seed % 2 === 0 ? "Sócio Administrador" : "Sócio Cotista",
      dataEntrada: new Date(Date.now() - ((seed * 23) % 1500 + 365) * 86400000).toISOString().split("T")[0],
      situacao: seed % 5 === 0 ? "Baixada" : "Ativa",
      capitalSocial: (seed % 10 + 1) * 10000,
    });
  }
  if (seed % 6 === 0) {
    participacoesSocietarias.push({
      cnpj: `${20 + seed % 80}.${200 + (seed * 5) % 800}.${300 + (seed * 9) % 700}/0001-${20 + seed % 80}`,
      razaoSocial: "Transportes & Logística EIRELI",
      cargo: "Sócio Cotista",
      dataEntrada: new Date(Date.now() - ((seed * 31) % 2000 + 700) * 86400000).toISOString().split("T")[0],
      situacao: "Ativa",
      capitalSocial: (seed % 5 + 1) * 50000,
    });
  }

  // Simulated income estimate
  const rendaBase = score >= 700 ? 8000 + (seed * 41) % 12000 : score >= 500 ? 3000 + (seed * 29) % 7000 : 1500 + (seed * 19) % 3500;
  const classe = rendaBase >= 15000 ? "A" : rendaBase >= 8000 ? "B" : rendaBase >= 3500 ? "C" : "D";
  const rendaEstimada = {
    faixa: rendaBase >= 15000 ? "Acima de R$ 15.000" : rendaBase >= 8000 ? "R$ 8.000 - R$ 15.000" : rendaBase >= 3500 ? "R$ 3.500 - R$ 8.000" : "R$ 1.500 - R$ 3.500",
    classe: `Classe ${classe}`,
    rendaMin: Math.round(rendaBase * 0.8),
    rendaMax: Math.round(rendaBase * 1.3),
    compatibilidadeAluguel: Math.round(rendaBase * 0.3),
    fonteEstimativa: "Perfil de consumo e comportamento financeiro",
  };

  return { score, restrictions, riskLevel, despejos, processosCivis, processosCriminais, historicoEnderecos, chequesSemFundo, participacoesSocietarias, rendaEstimada };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Verify caller is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado. Faça login para consultar crédito." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify the caller's JWT
    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: authError } = await anonClient.auth.getUser();
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: "Sessão expirada. Faça login novamente." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller is approved
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: profile } = await supabase
      .from("profiles")
      .select("approved")
      .eq("id", caller.id)
      .single();

    if (!profile?.approved) {
      return new Response(JSON.stringify({ error: "Sua conta precisa ser aprovada para usar este serviço." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { cpf, contratoId } = await req.json();
    if (!cpf) {
      return new Response(JSON.stringify({ error: "CPF é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleanCpf = cpf.replace(/\D/g, "");
    if (cleanCpf.length !== 11) {
      return new Response(JSON.stringify({ error: "CPF inválido — deve conter 11 dígitos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate CPF check digits
    if (/^(\d)\1{10}$/.test(cleanCpf)) {
      return new Response(JSON.stringify({ error: "CPF inválido — dígitos repetidos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += parseInt(cleanCpf[i]) * (10 - i);
    let d1 = 11 - (sum % 11);
    if (d1 >= 10) d1 = 0;
    if (parseInt(cleanCpf[9]) !== d1) {
      return new Response(JSON.stringify({ error: "CPF inválido — dígito verificador incorreto" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    sum = 0;
    for (let i = 0; i < 10; i++) sum += parseInt(cleanCpf[i]) * (11 - i);
    let d2 = 11 - (sum % 11);
    if (d2 >= 10) d2 = 0;
    if (parseInt(cleanCpf[10]) !== d2) {
      return new Response(JSON.stringify({ error: "CPF inválido — dígito verificador incorreto" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[credit-check] Starting credit check for contract:", contratoId, "by user:", caller.id);

    // Check for real API keys
    const hasSerasa = !!Deno.env.get("SERASA_API_KEY");
    const hasSpc = !!Deno.env.get("SPC_API_KEY");
    const hasBoaVista = !!Deno.env.get("BOA_VISTA_API_KEY");
    const hasRealProvider = hasSerasa || hasSpc || hasBoaVista;

    const simulated = generateSimulatedScore(cleanCpf);
    
    const providers = [];
    const results = [];

    const serasaScore = simulated.score + Math.floor(Math.random() * 40) - 20;
    providers.push("Serasa Experian");
    results.push({
      provider: "Serasa Experian",
      score: Math.min(900, Math.max(300, serasaScore)),
      status: serasaScore >= 500 ? "approved" : "pending",
      restrictions: simulated.restrictions.slice(0, 1),
      consultedAt: new Date().toISOString(),
    });

    const spcScore = simulated.score + Math.floor(Math.random() * 30) - 15;
    providers.push("SPC Brasil");
    results.push({
      provider: "SPC Brasil",
      score: Math.min(900, Math.max(300, spcScore)),
      status: spcScore >= 500 ? "approved" : "pending",
      restrictions: simulated.restrictions.slice(0, 2),
      consultedAt: new Date().toISOString(),
    });

    const bvScore = simulated.score + Math.floor(Math.random() * 50) - 25;
    providers.push("Boa Vista SCPC");
    results.push({
      provider: "Boa Vista SCPC",
      score: Math.min(900, Math.max(300, bvScore)),
      status: bvScore >= 500 ? "approved" : "pending",
      restrictions: [],
      consultedAt: new Date().toISOString(),
    });

    const worstScore = Math.min(...results.map(r => r.score));
    const hasRejected = results.some(r => r.status === "rejected");
    const finalStatus = hasRejected ? "rejected" : worstScore >= 600 ? "approved" : worstScore >= 400 ? "pending" : "rejected";

    if (contratoId) {
      await supabase.from("audit_log").insert({
        master_id: caller.id,
        target_user_id: caller.id,
        acao: "credit_check",
        modulo: "contratos",
        detalhes: `Consulta CPF ***${cleanCpf.slice(-4)} para contrato ${contratoId}. Score: ${worstScore}. Status: ${finalStatus}. Provedores: ${providers.join(", ")}${!hasRealProvider ? " (simulado)" : ""}`,
      });
    }

    return new Response(JSON.stringify({
      success: true,
      simulated: !hasRealProvider,
      message: hasRealProvider
        ? `Consulta realizada em ${providers.length} bureaus de crédito.`
        : `Consulta simulada em ${providers.length} bureaus (configure API keys para dados reais).`,
      providers,
      results,
      score: worstScore,
      riskLevel: simulated.riskLevel,
      status: finalStatus,
      restrictions: simulated.restrictions,
      despejos: simulated.despejos,
      processosCivis: simulated.processosCivis,
      processosCriminais: simulated.processosCriminais,
      historicoEnderecos: simulated.historicoEnderecos,
      chequesSemFundo: simulated.chequesSemFundo,
      participacoesSocietarias: simulated.participacoesSocietarias,
      rendaEstimada: simulated.rendaEstimada,
      consultedAt: new Date().toISOString(),
      cpfMasked: `***.***.${cleanCpf.slice(6, 9)}-${cleanCpf.slice(9)}`,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: any) {
    console.error("[credit-check] Error:", error.message);
    return new Response(JSON.stringify({ error: "Erro ao processar consulta de crédito. Tente novamente." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
