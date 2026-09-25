/**
 * Helpers de avatar de contato (foto em cache, iniciais ou padrão).
 * Não depende de API não oficial — foto só quando o CRM já tiver URL/cache.
 */

export function isPlaceholderProfilePic(url) {
  const u = String(url || "").trim();
  if (!u) return true;
  return /nopicture|noimage/i.test(u);
}

export function isUsableProfilePic(url) {
  return !isPlaceholderProfilePic(url);
}

/** Iniciais estilo WhatsApp: até 2 letras do nome; senão vazio. */
export function getContactInitials(name, phone) {
  const raw = String(name || "").trim();
  if (raw && !/^\d+$/.test(raw)) {
    const parts = raw.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const a = parts[0][0] || "";
      const b = parts[parts.length - 1][0] || "";
      return `${a}${b}`.toUpperCase();
    }
    return (parts[0] || "").slice(0, 2).toUpperCase();
  }
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length >= 2) return digits.slice(-2);
  return "";
}

/** Cor estável a partir do nome/telefone (paleta sóbria, produto). */
export function getContactAvatarColor(seed) {
  const palette = [
    "#5B6B7C",
    "#4A6FA5",
    "#3D7A6A",
    "#8B6B4A",
    "#6B5B8A",
    "#7A5A5A",
    "#4A7A8B",
    "#6A7A4A"
  ];
  const s = String(seed || "contact");
  let hash = 0;
  for (let i = 0; i < s.length; i += 1) {
    hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  }
  return palette[hash % palette.length];
}

export function resolveContactPicUrl(contact, resolveImageUrl) {
  const raw = contact?.urlPicture || contact?.profilePicUrl || "";
  if (!isUsableProfilePic(raw)) return "";
  if (typeof resolveImageUrl === "function") return resolveImageUrl(raw) || "";
  return String(raw).trim();
}

/**
 * Estado do avatar:
 * - photo | initials | default
 */
export function getContactAvatarState(contact, resolveImageUrl) {
  const pic = resolveContactPicUrl(contact, resolveImageUrl);
  if (pic) return { mode: "photo", src: pic, initials: "", color: "" };

  const initials = getContactInitials(contact?.name, contact?.number);
  if (initials) {
    return {
      mode: "initials",
      src: "",
      initials,
      color: getContactAvatarColor(
        `${contact?.id || ""}:${contact?.name || contact?.number || ""}`
      )
    };
  }

  return { mode: "default", src: "", initials: "", color: "#6B7280" };
}
