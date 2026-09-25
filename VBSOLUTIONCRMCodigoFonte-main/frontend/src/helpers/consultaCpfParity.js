/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * Paridade Consulta CPF — inputs/opções do Lovable ConsultaCPFWidget.
 */

export const CONSULTA_CPF_FORM_FIELDS = ["cpf", "lgpdConsent"];

export const CONSULTA_CPF_UI = {
  title: "Consulta CPF — Restrição",
  subtitle: "SPC Brasil • Boa Vista SCPC • Serasa (em breve)",
  cpfPlaceholder: "000.000.000-00",
  lgpdLabel: "Declaro consentimento do titular do CPF para esta consulta (LGPD).",
  consultButton: "Consultar",
  providers: ["Serasa Experian", "SPC Brasil", "Boa Vista SCPC"],
  riskLevels: ["baixo", "moderado", "alto"],
  statuses: ["approved", "pending", "rejected"],
  scoreTipsActions: ["Exportar Plano PDF", "Enviar via WhatsApp", "Agendar Reconsulta"],
};

/** Mapeamento input Lovable → payload VB API */
export const CONSULTA_CPF_FIELD_MAP = {
  cpf: "cpf",
  lgpdConsent: "lgpdConsent",
  lgpd_consent: "lgpdConsent",
  contratoId: "contratoId",
  contrato_id: "contratoId",
};

export function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}

export function formatCpfMask(value) {
  const digits = digitsOnly(value).slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  }
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

export function isValidCpfDigits(cpf) {
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

export function normalizeRestrictions(restrictions) {
  const all = [];
  (restrictions || []).forEach((r) => {
    if (typeof r === "string") {
      all.push({ descricao: r, credor: "", valor: 0, data: "", cidade: "", uf: "" });
    } else if (r && typeof r === "object") {
      all.push({
        descricao: r.descricao || "",
        credor: r.credor || "",
        valor: Number(r.valor) || 0,
        data: r.data || "",
        cidade: r.cidade || "",
        uf: r.uf || "",
      });
    }
  });
  return all;
}

export function scoreBarPercent(score) {
  const s = Number(score) || 0;
  return Math.min(100, Math.max(0, ((s - 300) / 600) * 100));
}

export function scoreTone(score) {
  const s = Number(score) || 0;
  if (s >= 700) return "success";
  if (s >= 500) return "warning";
  return "danger";
}

export function riskLabel(riskLevel) {
  if (riskLevel === "baixo") return "Risco Baixo ✅";
  if (riskLevel === "moderado") return "Risco Moderado ⚠️";
  return "Risco Alto 🔴";
}

export function buildScoreTips(score) {
  const tips = [];
  const s = Number(score) || 0;
  if (s < 800) {
    tips.push({
      title: "Manter contas em dia",
      body: "Pagar todas as contas antes do vencimento é o principal fator para aumentar o score. Cadastrar débito automático ajuda.",
      kind: "tip",
    });
  }
  if (s < 750) {
    tips.push({
      title: "Cadastro Positivo",
      body: "Ativar o Cadastro Positivo nos bureaus (Serasa, SPC, Boa Vista) permite que pagamentos em dia sejam contabilizados, elevando o score.",
      kind: "tip",
    });
  }
  if (s < 700) {
    tips.push({
      title: "Atualizar dados cadastrais",
      body: "Manter CPF com endereço, telefone e e-mail atualizados nos bureaus aumenta a confiabilidade do perfil.",
      kind: "tip",
    });
  }
  tips.push({
    title: "Evitar múltiplas consultas",
    body: "Consultas frequentes ao CPF em curto período podem reduzir o score. Espaçar solicitações de crédito.",
    kind: "tip",
  });
  tips.push({
    title: "Ter relacionamento bancário saudável",
    body: "Usar cartão de crédito com parcimônia e pagar a fatura total demonstra responsabilidade financeira.",
    kind: "tip",
  });
  if (s >= 700) {
    tips.push({
      title: "Score já está bom! 🎉",
      body: "O CPF consultado possui score acima de 700, o que indica um bom perfil de crédito. Continue mantendo as boas práticas.",
      kind: "ok",
    });
  }
  return tips;
}

export function buildWhatsAppScoreMessage(score) {
  const dicas = [
    "✅ Pague contas antes do vencimento",
    "✅ Ative o Cadastro Positivo",
    "✅ Atualize dados nos bureaus",
    "✅ Evite consultas frequentes",
    "✅ Mantenha bom relacionamento bancário",
  ];
  return `Olá! Seguem dicas para melhorar seu score de crédito (atual: ${score}):\n\n${dicas.join(
    "\n"
  )}\n\n💡 Prazo estimado: 30 a 90 dias.\n\nQualquer dúvida, estamos à disposição!`;
}

export function providerIcon(provider) {
  const p = String(provider || "");
  if (p.includes("Serasa")) return "🔵";
  if (p.includes("SPC")) return "🟡";
  if (p.includes("Boa Vista")) return "🟢";
  return "⚪";
}

export function formatCurrencyBRL(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number(value) || 0
  );
}

export function formatDateBR(isoDate) {
  if (!isoDate) return "—";
  const s = String(isoDate).slice(0, 10);
  try {
    return new Date(`${s}T12:00:00`).toLocaleDateString("pt-BR");
  } catch {
    return s;
  }
}
