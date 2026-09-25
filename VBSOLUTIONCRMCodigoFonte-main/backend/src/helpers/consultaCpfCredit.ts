/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * Consulta CPF / credit-check — apenas dados reais de bureaus (sem simulação).
 */

export type RestrictionDetail = {
  descricao: string;
  credor: string;
  valor: number;
  data: string;
  cidade: string;
  uf: string;
};

export type DespejoRecord = {
  tipo: string;
  vara: string;
  comarca: string;
  uf: string;
  data: string;
  status: string;
};

export type ProcessoRecord = {
  tipo: string;
  numero: string;
  vara: string;
  comarca: string;
  uf: string;
  data: string;
  status: string;
  natureza: string;
};

export type EnderecoRecord = {
  endereco: string;
  bairro: string;
  cidade: string;
  uf: string;
  periodo: string;
};

export type ChequeRecord = {
  banco: string;
  agencia: string;
  numero: string;
  valor: number;
  data: string;
  motivo: string;
};

export type ParticipacaoRecord = {
  cnpj: string;
  razaoSocial: string;
  cargo: string;
  dataEntrada: string;
  situacao: string;
  capitalSocial: number;
};

export type RendaEstimada = {
  faixa: string;
  classe: string;
  rendaMin: number;
  rendaMax: number;
  compatibilidadeAluguel: number;
  fonteEstimativa: string;
};

export type ProviderResult = {
  provider: string;
  score: number;
  status: string;
  restrictions: RestrictionDetail[];
  consultedAt: string;
  error?: string;
};

export type CreditCheckResult = {
  success: true;
  simulated: false;
  message: string;
  providers: string[];
  results: ProviderResult[];
  failedProviders: string[];
  score: number;
  riskLevel: string;
  status: string;
  restrictions: RestrictionDetail[];
  despejos: DespejoRecord[];
  processosCivis: ProcessoRecord[];
  processosCriminais: ProcessoRecord[];
  historicoEnderecos: EnderecoRecord[];
  chequesSemFundo: ChequeRecord[];
  participacoesSocietarias: ParticipacaoRecord[];
  rendaEstimada: RendaEstimada | null;
  consultedAt: string;
  cpfMasked: string;
};

/** Inputs do formulário Lovable ConsultaCPFWidget */
export const CONSULTA_CPF_FORM_FIELDS = ["cpf", "lgpdConsent"] as const;

export const CONSULTA_CPF_UI = {
  title: "Consulta CPF — Restrição",
  subtitle: "SPC Brasil • Boa Vista SCPC • Serasa (em breve)",
  cpfPlaceholder: "000.000.000-00",
  lgpdLabel: "Declaro consentimento do titular do CPF para esta consulta (LGPD).",
  consultButton: "Consultar",
  providers: ["Serasa Experian", "SPC Brasil", "Boa Vista SCPC"] as const,
  riskLevels: ["baixo", "moderado", "alto"] as const,
  statuses: ["approved", "pending", "rejected"] as const
} as const;

const PROVIDER_TIMEOUT_MS = 8000;

type BureauConfig = {
  name: string;
  envKey: string;
  envUrl: string;
};

const BUREAUS: BureauConfig[] = [
  { name: "Serasa Experian", envKey: "SERASA_API_KEY", envUrl: "SERASA_API_URL" },
  { name: "SPC Brasil", envKey: "SPC_API_KEY", envUrl: "SPC_API_URL" },
  { name: "Boa Vista SCPC", envKey: "BOA_VISTA_API_KEY", envUrl: "BOA_VISTA_API_URL" }
];

export function digitsOnly(value: unknown): string {
  return String(value || "").replace(/\D/g, "");
}

export function formatCpfMask(value: string): string {
  const digits = digitsOnly(value).slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  }
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

export function isValidCpfDigits(cpf: string): boolean {
  const clean = digitsOnly(cpf);
  if (clean.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(clean)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(clean[i], 10) * (10 - i);
  let d1 = 11 - (sum % 11);
  if (d1 >= 10) d1 = 0;
  if (parseInt(clean[9], 10) !== d1) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(clean[i], 10) * (11 - i);
  let d2 = 11 - (sum % 11);
  if (d2 >= 10) d2 = 0;
  return parseInt(clean[10], 10) === d2;
}

export function validateCpfForCreditCheck(cpf: unknown): string | null {
  const clean = digitsOnly(cpf);
  if (!clean) return "CPF é obrigatório";
  if (clean.length !== 11) return "CPF inválido — deve conter 11 dígitos";
  if (/^(\d)\1{10}$/.test(clean)) return "CPF inválido — dígitos repetidos";
  if (!isValidCpfDigits(clean)) return "CPF inválido — dígito verificador incorreto";
  return null;
}

export function maskCpf(cpf: string): string {
  const clean = digitsOnly(cpf);
  return `***.***.${clean.slice(6, 9)}-${clean.slice(9)}`;
}

export function getConfiguredBureaus(
  env: NodeJS.ProcessEnv = process.env
): Array<BureauConfig & { apiKey: string; apiUrl: string }> {
  return BUREAUS.map(b => {
    const apiKey = String(env[b.envKey] || "").trim();
    const apiUrl = String(env[b.envUrl] || "").trim();
    if (!apiKey || !apiUrl) return null;
    return { ...b, apiKey, apiUrl };
  }).filter(Boolean) as Array<BureauConfig & { apiKey: string; apiUrl: string }>;
}

export function missingBureauConfigMessage(
  env: NodeJS.ProcessEnv = process.env
): string {
  const missing: string[] = [];
  for (const b of BUREAUS) {
    const hasKey = !!String(env[b.envKey] || "").trim();
    const hasUrl = !!String(env[b.envUrl] || "").trim();
    if (!hasKey || !hasUrl) {
      missing.push(`${b.name} (${b.envKey} + ${b.envUrl})`);
    }
  }
  if (missing.length === BUREAUS.length) {
    return (
      "Nenhum bureau de crédito configurado. Defina as chaves e URLs " +
      "(SERASA_API_KEY/SERASA_API_URL, SPC_API_KEY/SPC_API_URL, " +
      "BOA_VISTA_API_KEY/BOA_VISTA_API_URL) no ambiente do servidor. " +
      "Consultas simuladas foram desativadas."
    );
  }
  return (
    "Configure pelo menos um bureau completo (API key + URL). Faltando: " +
    missing.join("; ")
  );
}

function asRestrictionList(raw: unknown): RestrictionDetail[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((r: any) => {
    if (typeof r === "string") {
      return { descricao: r, credor: "", valor: 0, data: "", cidade: "", uf: "" };
    }
    return {
      descricao: String(r?.descricao || r?.description || r?.tipo || ""),
      credor: String(r?.credor || r?.creditor || ""),
      valor: Number(r?.valor ?? r?.value ?? 0) || 0,
      data: String(r?.data || r?.date || "").slice(0, 10),
      cidade: String(r?.cidade || r?.city || ""),
      uf: String(r?.uf || r?.state || "")
    };
  });
}

function normalizeProviderPayload(
  providerName: string,
  data: any,
  consultedAt: string
): ProviderResult {
  const score = Number(data?.score ?? data?.Score ?? data?.pontuacao);
  if (!Number.isFinite(score)) {
    throw new Error(`${providerName}: resposta sem score válido`);
  }
  const restrictions = asRestrictionList(
    data?.restrictions ?? data?.restricoes ?? data?.pendencias ?? []
  );
  let status = String(data?.status || "").toLowerCase();
  if (!["approved", "rejected", "pending", "error"].includes(status)) {
    status =
      restrictions.length > 0 ? "pending" : score >= 500 ? "approved" : "pending";
  }
  return {
    provider: providerName,
    score: Math.min(900, Math.max(0, Math.round(score))),
    status,
    restrictions,
    consultedAt
  };
}

async function callBureauProvider(
  bureau: { name: string; apiKey: string; apiUrl: string },
  cpf: string
): Promise<ProviderResult> {
  const consultedAt = new Date().toISOString();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(bureau.apiUrl, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${bureau.apiKey}`,
        "Content-Type": "application/json",
        "X-Api-Key": bureau.apiKey
      },
      body: JSON.stringify({ cpf })
    });
  } catch (err: any) {
    if (err?.name === "AbortError") {
      throw new Error(`${bureau.name}: timeout (${PROVIDER_TIMEOUT_MS}ms)`);
    }
    throw new Error(`${bureau.name}: ${err?.message || "falha de rede"}`);
  } finally {
    clearTimeout(timer);
  }

  let data: any = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const msg = data?.error || data?.message || `HTTP ${response.status}`;
    throw new Error(`${bureau.name}: ${msg}`);
  }

  const payload = data?.result || data?.data || data;
  return normalizeProviderPayload(bureau.name, payload, consultedAt);
}

function riskFromScore(score: number): string {
  if (score >= 700) return "baixo";
  if (score >= 500) return "moderado";
  return "alto";
}

function mergeExtras(results: any[]): {
  despejos: DespejoRecord[];
  processosCivis: ProcessoRecord[];
  processosCriminais: ProcessoRecord[];
  historicoEnderecos: EnderecoRecord[];
  chequesSemFundo: ChequeRecord[];
  participacoesSocietarias: ParticipacaoRecord[];
  rendaEstimada: RendaEstimada | null;
} {
  // Extras só entram se o bureau devolver — nunca inventamos.
  const pick = (key: string) => {
    for (const r of results) {
      const arr = r?.[key];
      if (Array.isArray(arr) && arr.length) return arr;
    }
    return [];
  };
  let rendaEstimada: RendaEstimada | null = null;
  for (const r of results) {
    if (r?.rendaEstimada && typeof r.rendaEstimada === "object") {
      rendaEstimada = r.rendaEstimada as RendaEstimada;
      break;
    }
  }
  return {
    despejos: pick("despejos"),
    processosCivis: pick("processosCivis"),
    processosCriminais: pick("processosCriminais"),
    historicoEnderecos: pick("historicoEnderecos"),
    chequesSemFundo: pick("chequesSemFundo"),
    participacoesSocietarias: pick("participacoesSocietarias"),
    rendaEstimada
  };
}

/**
 * Consulta real nos bureaus configurados. Sem chave/URL → erro (sem mock).
 */
export async function runCreditCheck(
  cpf: string,
  env: NodeJS.ProcessEnv = process.env
): Promise<CreditCheckResult> {
  const cleanCpf = digitsOnly(cpf);
  const configured = getConfiguredBureaus(env);

  if (configured.length === 0) {
    throw new CreditCheckConfigError(missingBureauConfigMessage(env));
  }

  const results: ProviderResult[] = [];
  const failedProviders: string[] = [];
  const rawExtras: any[] = [];

  await Promise.all(
    configured.map(async bureau => {
      try {
        const result = await callBureauProvider(bureau, cleanCpf);
        results.push(result);
      } catch (err: any) {
        failedProviders.push(bureau.name);
        results.push({
          provider: bureau.name,
          score: 0,
          status: "error",
          restrictions: [],
          consultedAt: new Date().toISOString(),
          error: err?.message || String(err)
        });
      }
    })
  );

  const okResults = results.filter(r => r.status !== "error");
  if (okResults.length === 0) {
    throw new CreditCheckProviderError(
      "Nenhum bureau de crédito respondeu com sucesso. " +
        failedProviders.join(", ") +
        ". Verifique as credenciais e tente novamente."
    );
  }

  const worstScore = Math.min(...okResults.map(r => r.score));
  const hasRejected = okResults.some(r => r.status === "rejected");
  const finalStatus = hasRejected
    ? "rejected"
    : worstScore >= 600
      ? "approved"
      : worstScore >= 400
        ? "pending"
        : "rejected";

  const restrictions = okResults.flatMap(r => r.restrictions || []);
  const extras = mergeExtras(rawExtras);
  const consultedAt = new Date().toISOString();

  return {
    success: true,
    simulated: false,
    message: `Consulta realizada em ${okResults.length} bureau(s) de crédito.`,
    providers: okResults.map(r => r.provider),
    results: okResults,
    failedProviders,
    score: worstScore,
    riskLevel: riskFromScore(worstScore),
    status: finalStatus,
    restrictions,
    despejos: extras.despejos,
    processosCivis: extras.processosCivis,
    processosCriminais: extras.processosCriminais,
    historicoEnderecos: extras.historicoEnderecos,
    chequesSemFundo: extras.chequesSemFundo,
    participacoesSocietarias: extras.participacoesSocietarias,
    rendaEstimada: extras.rendaEstimada,
    consultedAt,
    cpfMasked: maskCpf(cleanCpf)
  };
}

export class CreditCheckConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CreditCheckConfigError";
  }
}

export class CreditCheckProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CreditCheckProviderError";
  }
}

export function scoreTipsFor(score: number): Array<{ title: string; body: string; kind: "tip" | "ok" }> {
  const tips: Array<{ title: string; body: string; kind: "tip" | "ok" }> = [];
  if (score < 800) {
    tips.push({
      title: "Manter contas em dia",
      body: "Pagar todas as contas antes do vencimento é o principal fator para aumentar o score. Cadastrar débito automático ajuda.",
      kind: "tip"
    });
  }
  if (score < 750) {
    tips.push({
      title: "Cadastro Positivo",
      body: "Ativar o Cadastro Positivo nos bureaus (Serasa, SPC, Boa Vista) permite que pagamentos em dia sejam contabilizados, elevando o score.",
      kind: "tip"
    });
  }
  if (score < 700) {
    tips.push({
      title: "Atualizar dados cadastrais",
      body: "Manter CPF com endereço, telefone e e-mail atualizados nos bureaus aumenta a confiabilidade do perfil.",
      kind: "tip"
    });
  }
  tips.push({
    title: "Evitar múltiplas consultas",
    body: "Consultas frequentes ao CPF em curto período podem reduzir o score. Espaçar solicitações de crédito.",
    kind: "tip"
  });
  tips.push({
    title: "Ter relacionamento bancário saudável",
    body: "Usar cartão de crédito com parcimônia e pagar a fatura total demonstra responsabilidade financeira.",
    kind: "tip"
  });
  if (score >= 700) {
    tips.push({
      title: "Score já está bom!",
      body: "O CPF consultado possui score acima de 700, o que indica um bom perfil de crédito. Continue mantendo as boas práticas.",
      kind: "ok"
    });
  }
  return tips;
}
