/** Lê companyId do JWT em localStorage (mesma fonte que o backend valida no socket). */
export function getCompanyIdFromStoredToken() {
  try {
    const raw = localStorage.getItem("token");
    if (!raw) return null;
    const token = JSON.parse(raw);
    const part = String(token).split(".")[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(b64));
    const id = payload.companyId ?? payload.companyid;
    const n = Number(id);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}
