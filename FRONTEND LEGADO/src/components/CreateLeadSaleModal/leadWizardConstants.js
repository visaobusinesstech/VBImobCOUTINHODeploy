import {
  FaWhatsapp,
  FaInstagram,
  FaFacebook,
  FaGoogle,
  FaTelegram,
  FaGlobe,
  FaShareAlt
} from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import { MdSms } from "react-icons/md";
import MetaAdsBrandIcon from "../MetaAdsBrandIcon";

function MetaAdsOriginIcon({ size = 20, color = "#0081FB" }) {
  return <MetaAdsBrandIcon size={size} color={color} />;
}

export const WIZARD_STEPS = [
  { id: "personal", label: "Pessoais" },
  { id: "product", label: "Produto" },
  { id: "origin", label: "Origem" },
  { id: "notes", label: "Notas" }
];

export const DETAIL_DOCK_STEPS = [
  ...WIZARD_STEPS
];

export const ORIGIN_CHANNELS = [
  { id: "whatsapp", label: "WhatsApp", color: "#25D366", Icon: FaWhatsapp },
  { id: "instagram", label: "Instagram", color: "#E4405F", Icon: FaInstagram },
  { id: "facebook", label: "Facebook", color: "#1877F2", Icon: FaFacebook },
  { id: "meta_ads", label: "Meta Ads", color: "#0081FB", Icon: MetaAdsOriginIcon },
  { id: "instagram_ads", label: "Instagram Ads", color: "#E4405F", Icon: FaInstagram },
  { id: "google_ads", label: "Google Ads", color: "#4285F4", Icon: FaGoogle },
  { id: "x", label: "X", color: "#0F1419", Icon: FaXTwitter },
  { id: "telegram", label: "Telegram", color: "#26A5E4", Icon: FaTelegram },
  { id: "sms", label: "SMS", color: "#34C759", Icon: MdSms },
  { id: "site", label: "Site", color: "#5856D6", Icon: FaGlobe },
  { id: "indicacao", label: "Indicação", color: "#FF9500", Icon: FaShareAlt },
  { id: "google", label: "Google", color: "#4285F4", Icon: FaGoogle }
];

/** Mapeia attribution.platform → id do canal de origem. */
export function originChannelIdFromAttribution(attribution) {
  if (!attribution || typeof attribution !== "object") return "";
  const platform = String(attribution.platform || "").toLowerCase();
  if (platform === "instagram_ads") return "instagram_ads";
  if (platform === "google_ads") return "google_ads";
  if (platform === "meta_ads" || String(attribution.sourceType || "").toLowerCase() === "ad") {
    return "meta_ads";
  }
  return "";
}

export const PRIORITY_TAG_PREFIX = "prioridade:";

export function resolveOriginChannelId(origin) {
  if (!origin) return "";
  const raw = String(origin).trim();
  if (!raw) return "";
  const byId = ORIGIN_CHANNELS.find((ch) => ch.id === raw.toLowerCase());
  if (byId) return byId.id;
  const byLabel = ORIGIN_CHANNELS.find(
    (ch) => ch.label.toLowerCase() === raw.toLowerCase()
  );
  return byLabel?.id || "";
}

export function resolveOriginLabel(originOrId) {
  const id = resolveOriginChannelId(originOrId);
  if (id) {
    return ORIGIN_CHANNELS.find((ch) => ch.id === id)?.label || String(originOrId || "");
  }
  return String(originOrId || "").trim();
}

export function stripProductMetaFromDescription(description) {
  return String(description || "")
    .replace(/^__cart__:.*$/gim, "")
    .replace(/^Produtos:\s*.+$/gim, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function parseCartLinesFromLead(lead) {
  if (Array.isArray(lead?.products) && lead.products.length) {
    return lead.products
      .map((p) => ({
        id: p.id ?? p._id ?? `prod-${String(p.name || "").trim()}`,
        name: p.name || "Produto",
        price: Number(p.price) || 0,
        currency: String(p.currency || "BRL").toUpperCase(),
        qty: Math.max(1, Number(p.qty) || 1)
      }))
      .filter((p) => p.name);
  }

  const desc = String(lead?.description || "");
  const cartMarker = desc.match(/^__cart__:(.+)$/im);
  if (cartMarker?.[1]) {
    try {
      const parsed = JSON.parse(cartMarker[1]);
      if (Array.isArray(parsed) && parsed.length) {
        return parseCartLinesFromLead({ products: parsed });
      }
    } catch {
      /* ignore */
    }
  }

  const productsLine = desc.match(/^Produtos:\s*(.+)$/im);
  if (!productsLine?.[1]) return [];
  return productsLine[1]
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part, idx) => {
      const m = part.match(/^(\d+)\s*x\s*(.+)$/i);
      const qty = m ? Math.max(1, Number(m[1]) || 1) : 1;
      const name = (m ? m[2] : part).trim();
      return {
        id: `desc-${idx}-${name}`,
        name,
        price: 0,
        currency: "BRL",
        qty
      };
    });
}

export function buildLeadDescription(description, cartLines) {
  const base = stripProductMetaFromDescription(description);
  if (!Array.isArray(cartLines) || !cartLines.length) return base;
  const productsLine = `Produtos: ${cartLines
    .map((l) => `${l.qty || 1}x ${l.name}`)
    .join(", ")}`;
  return [base, productsLine].filter(Boolean).join("\n");
}

export function extractPriorityFromTags(tags) {
  if (!Array.isArray(tags)) return null;
  const found = tags.find((t) => String(t).toLowerCase().startsWith(PRIORITY_TAG_PREFIX));
  if (!found) return null;
  const value = String(found).slice(PRIORITY_TAG_PREFIX.length).trim();
  return value || null;
}

export function mergePriorityIntoTags(tags, priority) {
  const list = Array.isArray(tags)
    ? tags.filter((t) => !String(t).toLowerCase().startsWith(PRIORITY_TAG_PREFIX))
    : [];
  if (priority) list.push(`${PRIORITY_TAG_PREFIX}${priority}`);
  return list;
}
