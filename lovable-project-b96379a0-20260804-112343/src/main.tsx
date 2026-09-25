import { createRoot } from "react-dom/client";
import { ThemeProvider } from "next-themes";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import { flushPendingReloadLogs, logReloadEvent } from "@/lib/reloadLogger";
import { showReloadFallback } from "@/lib/reloadFallback";

const isDynamicImportFailure = (value: unknown) => {
  const message = typeof value === "string" ? value : String((value as { message?: unknown })?.message ?? value);
  return (
    message.includes("Failed to fetch dynamically imported module") ||
    message.includes("Importing a module script failed") ||
    message.includes("error loading dynamically imported module") ||
    message.includes("Unable to preload CSS")
  );
};

const RELOAD_TS_KEY = "lovable:chunk-reload:global";
const FAIL_COUNT_KEY = "lovable:chunk-fail-count";
const MAX_AUTO_RELOADS = 2; // depois disso, mostra fallback

function incrementFailCount(): number {
  try {
    const n = Number(sessionStorage.getItem(FAIL_COUNT_KEY) || 0) + 1;
    sessionStorage.setItem(FAIL_COUNT_KEY, String(n));
    return n;
  } catch {
    return MAX_AUTO_RELOADS + 1;
  }
}

function handleChunkFailure(payload: Parameters<typeof logReloadEvent>[0]) {
  const failures = incrementFailCount();
  let lastReload = 0;
  try {
    lastReload = Number(sessionStorage.getItem(RELOAD_TS_KEY) || 0);
  } catch {}

  const requestId = logReloadEvent(payload, { willReload: false });

  // Nunca recarrega automaticamente. Em conexões instáveis ou chunks antigos,
  // o reload automático causava loops visuais ao trocar de aba/rota. Agora a
  // aplicação mostra um fallback e só recarrega se o usuário clicar.
  showReloadFallback({
    requestId,
    reason: payload.message || payload.trigger,
    failures: Math.min(failures, MAX_AUTO_RELOADS + 1),
    lastReloadAt: lastReload || null,
    onRetry: () => {
      try {
        sessionStorage.removeItem(RELOAD_TS_KEY);
        sessionStorage.setItem(FAIL_COUNT_KEY, "0");
      } catch {}
      window.location.reload();
    },
  });
}

// Limpeza única de service worker e caches antigos.
// Diagnóstico em produção: defina `localStorage.setItem("lovable:disable-sw-cleanup", "1")`
// no DevTools para preservar SW/caches entre boots e inspecionar o comportamento real.
const CLEANUP_FLAG = "lovable:sw-cache-cleanup:v1";
const CLEANUP_DISABLED_FLAG = "lovable:disable-sw-cleanup";
try {
  const disabled = localStorage.getItem(CLEANUP_DISABLED_FLAG) === "1";
  if (disabled) {
    console.info(
      "[main] SW/cache cleanup DESATIVADO via flag 'lovable:disable-sw-cleanup'. " +
        "Remova o item do localStorage para reativar.",
    );
  } else if (!localStorage.getItem(CLEANUP_FLAG)) {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker
        .getRegistrations()
        .then((regs) => Promise.all(regs.map((r) => r.unregister())))
        .catch(() => undefined);
    }
    if ("caches" in window) {
      void caches
        .keys()
        .then((names) => Promise.all(names.map((n) => caches.delete(n))))
        .catch(() => undefined);
    }
    localStorage.setItem(CLEANUP_FLAG, "1");
  }
} catch {
  // ignore
}

// Boot bem-sucedido → zera contador
try {
  window.addEventListener("load", () => {
    setTimeout(() => {
      try {
        sessionStorage.setItem(FAIL_COUNT_KEY, "0");
      } catch {}
    }, 5000);
  });
} catch {}

flushPendingReloadLogs();

window.addEventListener("error", (e) => {
  if (isDynamicImportFailure(e.message) || isDynamicImportFailure(e.error)) {
    e.preventDefault();
    handleChunkFailure({
      trigger: "dynamic_import_failure",
      message: e.message || "Falha no carregamento de módulo dinâmico",
      stackTrace: e.error?.stack,
      filename: e.filename,
      lineno: e.lineno,
      colno: e.colno,
    });
  }
});

window.addEventListener("unhandledrejection", (e) => {
  if (isDynamicImportFailure(e.reason)) {
    e.preventDefault();
    handleChunkFailure({
      trigger: "dynamic_import_failure_rejection",
      message: e.reason?.message || "Rejeição de promessa por falha de módulo",
      stackTrace: e.reason?.stack,
      extra: { reason: String(e.reason) },
    });
  }
});

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <App />
    </ThemeProvider>
  </HelmetProvider>
);
