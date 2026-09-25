export function buildDefaultAgentV2(integrationState) {
  const apiKey = String(integrationState?.apiKey || "").trim();
  const model = integrationState?.model || "gpt-5.5";
  return {
    schemaVersion: 2,
    integration: {
      apiKey,
      model,
      responderGrupo: false,
      queueId: null,
      maxMessages: 10,
      maxTokens: 2200,
      temperature: 1,
      voice: "texto",
      voiceKey: "",
      voiceRegion: ""
    },
    agent: {
      name: "Novo agente",
      description: "",
      role: "",
      objective: "",
      language: "pt-BR",
      emojisEnabled: true,
      responseDelay: 0,
      formality: "profissional",
      writingStyle: "claro e direto",
      businessHours: "Seg–Sex 9h–18h",
      agentColor: null,
      messages: {
        initial: "",
        fallback: "Desculpe, não consegui concluir. Pode reformular?",
        afterHours: "Estamos fora do horário de atendimento. Retornamos em breve.",
        transferHuman: "Vou transferir você para um atendente humano."
      }
    },
    generalRules: "",
    attendance: {
      script: "",
      settings: {
        objective: "",
        serviceType: "consultivo",
        mandatoryFlow: false,
        allowInterrupt: true,
        maxResponseTimeSec: 120,
        maxAttempts: 5,
        smartFallback: true,
        canImprovise: true,
        canTransferHuman: true,
        scriptContext: ""
      }
    },
    faq: [],
    faqEnabled: true,
    knowledge: {
      enabled: true,
      manualText: "",
      fileListId: null,
      websites: [],
      sources: []
    },
    knowledgeEnabled: true,
    inventory: {
      enabled: true,
      productIds: [],
      reply: {
        tone: "consultivo",
        strategyPreset: "price_first",
        template:
          "O *{{nome}}* custa {{preco}}{{estoque_frase}}.{{link_frase}}",
        includePrice: true,
        includeStock: true,
        includeLink: true,
        includeDescription: false,
        includeSku: false,
        includePromo: false,
        promoText: "",
        includeInstallment: false,
        installmentText: "",
        sendImages: false,
        imageMode: "none",
        imageCount: 3,
        sendDocument: false,
        documentUrl: "",
        documentName: "",
        resumeHint: true,
        resumeHintText: "Quando quiser, seguimos de onde paramos."
      },
      productReplies: {},
      useSameMessage: false
    },
    smartActions: [],
    mediaLibrary: [],
    proactive: {},
    transferChamado: {
      queueId: null,
      userId: null,
      queueIntegrationId: null
    }
  };
}

export function normalizeApiResponseToV2(data) {
  if (!data || typeof data !== "object") return null;
  if (data.v2 && typeof data.v2 === "object") {
    const rootSv = Number(data.schemaVersion);
    const innerSv = Number(data.v2.schemaVersion);
    if (rootSv === 2 || innerSv === 2) {
      const inner = JSON.parse(JSON.stringify(data.v2));
      inner.schemaVersion = 2;
      return inner;
    }
  }
  return extractV2FromImportedJson(data);
}

/**
 * Extrai o objeto v2 de um arquivo exportado ({ v2, schemaVersion }) ou de um payload v2 na raiz.
 */
export function extractV2FromImportedJson(parsed) {
  if (!parsed || typeof parsed !== "object") return null;
  if (parsed.v2 && Number(parsed.v2.schemaVersion) === 2) {
    return JSON.parse(JSON.stringify(parsed.v2));
  }
  if (Number(parsed.schemaVersion) === 2 && parsed.integration && parsed.agent) {
    return JSON.parse(JSON.stringify(parsed));
  }
  return null;
}

/**
 * Mescla JSON importado com defaults da integração atual (API key / modelo da empresa).
 */
export function mergeImportedAgentJson(parsed, integrationDefaults) {
  const src = extractV2FromImportedJson(parsed);
  if (!src) {
    throw new Error("JSON inválido: use a exportação do agente (schemaVersion 2) ou um objeto v2 completo.");
  }
  const base = buildDefaultAgentV2(integrationDefaults || {});
  return {
    schemaVersion: 2,
    integration: { ...base.integration, ...src.integration },
    agent: {
      ...base.agent,
      ...src.agent,
      agentColor: src.agent?.agentColor || base.agent.agentColor,
      messages: { ...base.agent.messages, ...(src.agent?.messages || {}) }
    },
    generalRules: src.generalRules != null ? String(src.generalRules) : base.generalRules,
    attendance: {
      ...base.attendance,
      ...src.attendance,
      settings: { ...base.attendance.settings, ...(src.attendance?.settings || {}) },
      script: src.attendance?.script != null ? String(src.attendance.script) : base.attendance.script
    },
    faq: Array.isArray(src.faq) ? src.faq : base.faq,
    faqEnabled: typeof src.faqEnabled === "boolean" ? src.faqEnabled : base.faqEnabled,
    knowledge: {
      ...base.knowledge,
      ...src.knowledge,
      websites: Array.isArray(src.knowledge?.websites) ? src.knowledge.websites : base.knowledge.websites,
      sources: Array.isArray(src.knowledge?.sources) ? src.knowledge.sources : base.knowledge.sources
    },
    knowledgeEnabled: typeof src.knowledgeEnabled === "boolean" ? src.knowledgeEnabled : base.knowledgeEnabled,
    inventory: {
      enabled:
        src.inventory && typeof src.inventory.enabled === "boolean"
          ? src.inventory.enabled
          : base.inventory?.enabled !== false,
      productIds: Array.isArray(src.inventory?.productIds)
        ? src.inventory.productIds.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0)
        : Array.isArray(base.inventory?.productIds)
          ? base.inventory.productIds
          : [],
      reply: {
        ...(base.inventory?.reply || {}),
        ...(src.inventory?.reply && typeof src.inventory.reply === "object" ? src.inventory.reply : {})
      },
      productReplies:
        src.inventory?.productReplies && typeof src.inventory.productReplies === "object"
          ? src.inventory.productReplies
          : base.inventory?.productReplies && typeof base.inventory.productReplies === "object"
            ? base.inventory.productReplies
            : {},
      useSameMessage:
        typeof src.inventory?.useSameMessage === "boolean"
          ? src.inventory.useSameMessage
          : base.inventory?.useSameMessage === true
    },
    smartActions: Array.isArray(src.smartActions) ? src.smartActions : base.smartActions,
    mediaLibrary: Array.isArray(src.mediaLibrary) ? src.mediaLibrary : base.mediaLibrary,
    proactive:
      src.proactive && typeof src.proactive === "object"
        ? { ...base.proactive, ...src.proactive }
        : base.proactive,
    transferChamado: { ...base.transferChamado, ...(src.transferChamado || {}) }
  };
}
