/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 *
 * Helpers de canal/conexão para o modal de Nutrição (página Integrações).
 */

/** Labels iguais ao catálogo de Integrações (/connections). */
export const CHANNEL_LABELS = {
  whatsapp: "WhatsApp Web",
  whatsapp_oficial: "WhatsApp API Oficial",
  telegram: "Telegram",
  telegram_oficial: "Telegram Oficial",
  sms: "SMS",
  instagram: "Instagram",
  facebook: "Facebook",
  email: "E-mail",
};

/** Canais de messaging vindos da página Integrações (modelo Whatsapp). */
export const MESSAGING_CHANNELS = [
  "whatsapp",
  "whatsapp_oficial",
  "telegram",
  "telegram_oficial",
  "sms",
  "instagram",
  "facebook",
];

export function channelLabel(channel) {
  if (!channel) return "Canal";
  return CHANNEL_LABELS[channel] || channel;
}

export function statusLabel(status) {
  if (!status) return "";
  const s = String(status).toUpperCase();
  if (s === "CONNECTED") return "Conectado";
  if (s === "DISCONNECTED") return "Desconectado";
  if (s === "OPENING" || s === "QRCODE" || s === "qrcode") return "Conectando";
  if (s === "PENDING") return "Pendente";
  return status;
}

export function isConnected(w) {
  return String(w?.status || "").toUpperCase() === "CONNECTED";
}

function connectionDisplayName(w) {
  return String(w?.name || w?.nome || "").trim() || `Conexão #${w?.id}`;
}

/**
 * Monta opções de select a partir das conexões da empresa (Integrações).
 * value: `conn:{id}` para conexões, `email` para e-mail, `heranca` opcional.
 * Labels usam o NOME da conexão criada (ex.: "Atendimento Comercial · WhatsApp Web (Conectado)").
 */
export function buildCanalOptions(
  whatsapps = [],
  { includeHeranca = false, includeEmail = true, connectedOnly = false } = {}
) {
  const list = Array.isArray(whatsapps) ? whatsapps : [];
  let messaging = list.filter((w) =>
    MESSAGING_CHANNELS.includes(w.channel || "whatsapp")
  );
  if (connectedOnly) {
    messaging = messaging.filter(isConnected);
  }

  const sorted = [...messaging].sort((a, b) => {
    const ca = isConnected(a) ? 0 : 1;
    const cb = isConnected(b) ? 0 : 1;
    if (ca !== cb) return ca - cb;
    return connectionDisplayName(a).localeCompare(connectionDisplayName(b), "pt-BR");
  });

  const options = [];
  if (includeHeranca) {
    options.push({
      value: "heranca",
      label: "Mesmo canal do fluxo",
      channel: "heranca",
      connected: true,
      group: "fluxo",
    });
  }

  sorted.forEach((w) => {
    const ch = w.channel || "whatsapp";
    const nome = connectionDisplayName(w);
    const st = statusLabel(w.status);
    const connected = isConnected(w);
    options.push({
      value: `conn:${w.id}`,
      label: `${nome} · ${channelLabel(ch)}${st ? ` (${st})` : ""}`,
      shortLabel: nome,
      channel: ch,
      whatsappId: Number(w.id),
      connected,
      group: connected ? "conectadas" : "outras",
      raw: w,
    });
  });

  if (includeEmail) {
    options.push({
      value: "email",
      label: "E-mail",
      channel: "email",
      connected: true,
      group: "email",
    });
  }

  return options;
}

/** Agrupa opções para <optgroup> no select. */
export function groupCanalOptions(options = []) {
  const groups = [
    { key: "fluxo", label: "Fluxo" },
    { key: "conectadas", label: "Conexões conectadas (Integrações)" },
    { key: "outras", label: "Outras conexões" },
    { key: "email", label: "Outros canais" },
  ];
  return groups
    .map((g) => ({
      ...g,
      options: options.filter((o) => (o.group || "outras") === g.key),
    }))
    .filter((g) => g.options.length > 0);
}

export function parseCanalValue(value, whatsapps = []) {
  const v = String(value || "").trim();
  if (!v || v === "heranca") {
    return { canal: "heranca", whatsappId: null };
  }
  if (v === "email") {
    return { canal: "email", whatsappId: null };
  }
  if (v.startsWith("conn:")) {
    const id = Number(v.slice(5));
    const w = whatsapps.find((x) => Number(x.id) === id);
    return {
      canal: w?.channel || "whatsapp",
      whatsappId: Number.isFinite(id) ? id : null,
      canalKey: v,
      connectionName: w ? connectionDisplayName(w) : null,
    };
  }
  // legado: whatsapp / whatsapp_oficial / telegram...
  if (MESSAGING_CHANNELS.includes(v)) {
    const match =
      whatsapps.find((x) => (x.channel || "whatsapp") === v && isConnected(x)) ||
      whatsapps.find((x) => (x.channel || "whatsapp") === v);
    return {
      canal: v,
      whatsappId: match ? Number(match.id) : null,
      connectionName: match ? connectionDisplayName(match) : null,
    };
  }
  return { canal: v, whatsappId: null };
}

/** Valor do select a partir de fluxo/etapa já salvos. */
export function canalValueFromRecord({ canal, whatsappId } = {}, whatsapps = []) {
  if (whatsappId != null && Number(whatsappId) > 0) {
    return `conn:${whatsappId}`;
  }
  if (canal === "email") return "email";
  if (!canal || canal === "heranca") return "heranca";
  if (String(canal).startsWith("conn:")) return canal;
  const match =
    whatsapps.find((x) => (x.channel || "whatsapp") === canal && isConnected(x)) ||
    whatsapps.find((x) => (x.channel || "whatsapp") === canal);
  if (match) return `conn:${match.id}`;
  return canal || "heranca";
}

export function resolveEtapaCanal(etapaCanal, fluxo, whatsapps = []) {
  let canal = etapaCanal;
  let whatsappId = fluxo?.whatsappId ?? null;

  if (!canal || canal === "heranca") {
    canal = fluxo?.canal || "whatsapp";
    whatsappId = fluxo?.whatsappId ?? whatsappId;
  }

  if (String(canal).startsWith("conn:")) {
    const id = Number(String(canal).slice(5));
    const w = whatsapps.find((x) => Number(x.id) === id);
    return {
      canal: w?.channel || "whatsapp",
      whatsappId: Number.isFinite(id) ? id : whatsappId,
    };
  }

  if (canal === "email") {
    return { canal: "email", whatsappId: null };
  }

  return { canal, whatsappId };
}
