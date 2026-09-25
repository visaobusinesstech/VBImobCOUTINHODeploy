import { supabase } from "@/integrations/supabase/client";

export type LogLevel = "info" | "warn" | "error" | "fatal";

interface LogParams {
  module: string;
  action: string;
  message: string;
  level?: LogLevel;
  metadata?: any;
  stackTrace?: string;
  userId?: string;
  correlationId?: string;
}

export const logger = {
  log: async ({
    module,
    action,
    message,
    level = "info",
    metadata = {},
    stackTrace,
    userId,
    correlationId,
  }: LogParams) => {
    // Generate a unique log ID that can be used as a tracking reference
    const trackingId = correlationId || (window as any).currentCorrelationId || `LOG-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    try {
      // Client-side console log
      const consoleMethod = level === "fatal" || level === "error" ? "error" : level === "warn" ? "warn" : "log";
      console[consoleMethod](`[${module}:${action}] [ID: ${trackingId}] ${message}`, { metadata, stackTrace });

      // Server-side (Supabase) log
      const { error } = await supabase.from("system_logs").insert({
        module,
        action,
        message,
        level,
        user_id: userId || null,
        correlation_id: trackingId,
        stack_trace: stackTrace || null,
        metadata: {
          ...metadata,
          userAgent: navigator.userAgent,
          url: window.location.href,
          clientTimestamp: new Date().toISOString(),
        },
      });

      if (error) {
        console.error("Failed to send log to server:", error);
      }
    } catch (err) {
      console.error("Critical failure in logger:", err);
    }

    return { trackingId };
  },

  error: (params: Omit<LogParams, "level">) => logger.log({ ...params, level: "error" }),
  warn: (params: Omit<LogParams, "level">) => logger.log({ ...params, level: "warn" }),
  info: (params: Omit<LogParams, "level">) => logger.log({ ...params, level: "info" }),
};
