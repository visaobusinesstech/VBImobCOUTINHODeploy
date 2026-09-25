const AUTH_CALLBACK_PATH = "/auth/callback";
const PASSWORD_RESET_PATH = "/reset-password";

function getAppOrigin() {
  if (typeof window === "undefined") return "";
  return window.location.origin;
}

function buildAuthUrl(path: string) {
  const origin = getAppOrigin();
  if (!origin) return path;
  return new URL(path, origin).toString();
}

export function getEmailConfirmationRedirectUrl() {
  return buildAuthUrl(AUTH_CALLBACK_PATH);
}

export function getPasswordResetRedirectUrl() {
  return buildAuthUrl(PASSWORD_RESET_PATH);
}
