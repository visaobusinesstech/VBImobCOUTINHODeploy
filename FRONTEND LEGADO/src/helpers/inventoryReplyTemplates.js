import {
  INVENTORY_REPLY_DEFAULT,
  INVENTORY_STRATEGY_PRESETS
} from "../components/InventoryReplySettingsPanel";

const CONFIG_KEYS = [
  "tone",
  "strategyPreset",
  "template",
  "includePrice",
  "includeStock",
  "includeLink",
  "includeDescription",
  "includeSku",
  "includePromo",
  "promoText",
  "includeInstallment",
  "installmentText",
  "sendImages",
  "imageMode",
  "imageCount",
  "sendDocument",
  "documentUrl",
  "documentName",
  "resumeHint",
  "resumeHintText"
];

export function stripTemplateMeta(settings) {
  if (!settings || typeof settings !== "object") return { ...INVENTORY_REPLY_DEFAULT };
  const out = { ...INVENTORY_REPLY_DEFAULT };
  CONFIG_KEYS.forEach((k) => {
    if (settings[k] !== undefined && settings[k] !== null) out[k] = settings[k];
  });
  return out;
}

export function listSavedTemplates(settings) {
  const list = settings?.savedTemplates;
  if (!Array.isArray(list)) return [];
  return list
    .filter((t) => t && typeof t === "object" && t.id)
    .map((t) => ({
      id: String(t.id),
      name: String(t.name || "Template").trim() || "Template",
      updatedAt: t.updatedAt || null,
      ...stripTemplateMeta(t)
    }));
}

export function withSavedTemplates(settings, templates, activeTemplateId) {
  const base = stripTemplateMeta(settings);
  return {
    ...base,
    activeTemplateId: activeTemplateId || null,
    savedTemplates: (templates || []).map((t) => ({
      id: String(t.id),
      name: String(t.name || "Template").trim() || "Template",
      updatedAt: t.updatedAt || new Date().toISOString(),
      ...stripTemplateMeta(t)
    }))
  };
}

export function newTemplateId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Prévia de texto alinhada ao runtime do agente. */
export function buildInventoryWhatsAppPreview(reply, productSample = null) {
  const r = { ...INVENTORY_REPLY_DEFAULT, ...(reply || {}) };
  const name = productSample?.name || "VBSolution CRM";
  const priceNum = Number(productSample?.price);
  const price = Number.isFinite(priceNum)
    ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(priceNum)
    : "R$ 149,90";
  const qty = Number(productSample?.quantity);
  const estoque = Number.isFinite(qty) ? String(qty) : "8";
  const sample = {
    nome: name,
    preco: r.includePrice ? price : "",
    estoque,
    estoque_status: `${estoque} unidades disponíveis`,
    estoque_frase: r.includeStock ? ` e temos ${estoque} unidades disponíveis` : "",
    promo_frase:
      r.includePromo && String(r.promoText || "").trim()
        ? ` (${String(r.promoText).trim()})`
        : "",
    parcelamento_frase:
      r.includeInstallment && String(r.installmentText || "").trim()
        ? ` — ${String(r.installmentText).trim()}`
        : "",
    link: productSample?.buyLink || "https://exemplo.com/comprar",
    link_frase: r.includeLink
      ? `\n\nSe quiser, você pode realizar a compra por aqui: ${
          productSample?.buyLink || "https://exemplo.com/comprar"
        }`
      : "",
    descricao: productSample?.description || "CRM completo para atendimento e vendas.",
    descricao_ou_nome: `${productSample?.description || "CRM completo para atendimento e vendas."}\n\n*${name}*`,
    sku: productSample?.sku || "VBS-001",
    catalogo: `1. *${name}* — ${price} — ${estoque} unidades disponíveis`
  };

  let tpl =
    r.strategyPreset === "custom"
      ? r.template || INVENTORY_STRATEGY_PRESETS[0].template
      : INVENTORY_STRATEGY_PRESETS.find((p) => p.id === r.strategyPreset)?.template ||
        r.template ||
        INVENTORY_STRATEGY_PRESETS[0].template;

  if (!r.includePrice) tpl = tpl.replace(/\{\{\s*preco\s*\}\}/gi, "");
  if (!r.includeStock) {
    tpl = tpl
      .replace(/\{\{\s*estoque_frase\s*\}\}/gi, "")
      .replace(/\{\{\s*estoque_status\s*\}\}/gi, "")
      .replace(/\{\{\s*estoque\s*\}\}/gi, "");
  }
  if (!r.includeLink) {
    tpl = tpl.replace(/\{\{\s*link_frase\s*\}\}/gi, "").replace(/\{\{\s*link\s*\}\}/gi, "");
  }
  if (!r.includeDescription) tpl = tpl.replace(/\{\{\s*descricao\s*\}\}/gi, "");
  if (!r.includeSku) tpl = tpl.replace(/\{\{\s*sku\s*\}\}/gi, "");
  if (!r.includePromo) tpl = tpl.replace(/\{\{\s*promo_frase\s*\}\}/gi, "");
  if (!r.includeInstallment) tpl = tpl.replace(/\{\{\s*parcelamento_frase\s*\}\}/gi, "");

  Object.entries(sample).forEach(([k, v]) => {
    tpl = tpl.replace(new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, "gi"), v);
  });
  tpl = tpl.replace(/\{\{[a-z0-9_]+\}\}/gi, "").trim();
  if (r.resumeHint) {
    tpl = `${tpl}\n\n${r.resumeHintText || INVENTORY_REPLY_DEFAULT.resumeHintText}`;
  }
  return tpl;
}
