import React from "react";
import { showReloadFallback } from "@/lib/reloadFallback";
import { logReloadEvent } from "@/lib/reloadLogger";

/**
 * Lazy loader resiliente a "Failed to fetch dynamically imported module".
 * Após novo deploy, chunks antigos referenciados pelo HTML em cache somem.
 * Estratégia: retry em memória -> fallback visível. Não faz reload automático.
 */
export function lazyWithRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return React.lazy(async () => {
    const key = `lovable:chunk-reload:${factory.toString().slice(0, 120)}`;

    const isChunkError = (err: any) => {
      const msg = String(err?.message || err);
      return (
        msg.includes("Failed to fetch dynamically imported module") ||
        msg.includes("Importing a module script failed") ||
        msg.includes("error loading dynamically imported module") ||
        msg.includes("Unable to preload CSS")
      );
    };

    try {
      const mod = await factory();
      sessionStorage.removeItem(key);
      return mod;
    } catch (err) {
      if (!isChunkError(err)) throw err;

      // Retry em memória (rede instável)
      try {
        await new Promise((r) => setTimeout(r, 400));
        const mod = await factory();
        sessionStorage.removeItem(key);
        return mod;
      } catch (err2) {
        if (!isChunkError(err2)) throw err2;

        sessionStorage.setItem(key, "1");
        const requestId = logReloadEvent(
          {
            trigger: "chunk_retry_exhausted",
            message: String((err2 as any)?.message || err2 || "Falha ao carregar módulo"),
            stackTrace: (err2 as any)?.stack,
          },
          { willReload: false },
        );
        showReloadFallback({
          requestId,
          reason: String((err2 as any)?.message || err2 || "Falha ao carregar módulo"),
          onRetry: () => {
            try {
              sessionStorage.removeItem(key);
            } catch {}
            window.location.reload();
          },
        });
        return new Promise(() => {}) as never;
      }
    }
  });
}
