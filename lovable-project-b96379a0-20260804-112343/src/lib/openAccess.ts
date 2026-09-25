/** Local/demo: entrada livre sem tela de login, aprovação ou trial. */
export function isOpenAccess(): boolean {
  return String(import.meta.env.VITE_OPEN_ACCESS || "").toLowerCase() === "true";
}

export const OPEN_ACCESS_USER_ID = "00000000-0000-4000-8000-000000000001";
export const OPEN_ACCESS_EMAIL = "openaccess@local.dev";
