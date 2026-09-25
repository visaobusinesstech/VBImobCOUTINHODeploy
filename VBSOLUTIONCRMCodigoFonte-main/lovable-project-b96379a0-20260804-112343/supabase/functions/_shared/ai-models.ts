// Central AI model registry (Deno / Edge Functions).
// Ordered by priority: index 0 = preferred, remaining = fallback chain.
// Mirrors src/config/ai-models.ts (keep both files in sync).

export const AI_MODELS: Record<string, string[]> = {
  google: [
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash",
    "gemini-3.1-flash-lite",
    "gemini-2.0-flash",
  ],
  groq: [
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant",
  ],
  deepseek: [
    "deepseek-chat",
    "deepseek-reasoner",
  ],
  openrouter: [
    "meta-llama/llama-3.3-70b-instruct:free",
    "google/gemini-2.0-flash-exp:free",
  ],
  anthropic: [
    "claude-haiku-4-5",
    "claude-sonnet-4-6",
    "claude-3-5-haiku-20241022",
  ],
  openai: [
    "gpt-4o-mini",
    "gpt-4o",
  ],
};

export function firstModel(provider: string): string {
  return AI_MODELS[provider]?.[0] || "gpt-4o-mini";
}

/**
 * Modelos comprovadamente descontinuados pelos provedores — nunca tentar,
 * mesmo que o usuário tenha um salvo no `user_ai_config.model`.
 */
export const DEPRECATED_MODELS = new Set<string>([
  "gemini-1.5-pro",
  "gemini-1.5-flash",
  "gemini-1.5-flash-latest",
  "gemini-1.5-pro-latest",
  "gemini-pro",
  "gemini-1.0-pro",
  "gpt-3.5-turbo",
  "gpt-4",
  "claude-3-opus-latest",
  "claude-3-opus-20240229",
  "claude-3-sonnet-20240229",
  "mixtral-8x7b-32768",
  "llama2-70b-4096",
  "o3-mini",
]);

/**
 * Returns the fallback chain for a provider, putting `preferred` first (if valid)
 * and appending remaining models in priority order, de-duplicated.
 * Modelos em DEPRECATED_MODELS são ignorados mesmo se vierem em `preferred`.
 */
export function fallbackChain(provider: string, preferred?: string | null): string[] {
  const list = AI_MODELS[provider] || [];
  const safePreferred = preferred && !DEPRECATED_MODELS.has(preferred) ? preferred : null;
  const chain = safePreferred && list.includes(safePreferred)
    ? [safePreferred, ...list.filter((m) => m !== safePreferred)]
    : safePreferred
      ? [safePreferred, ...list]
      : [...list];
  // dedupe preservando ordem e filtrando descontinuados
  return Array.from(new Set(chain)).filter((m) => !DEPRECATED_MODELS.has(m));
}

export function buildAiUrl(provider: string, model: string, apiKey: string): string {
  switch (provider) {
    case "google":
      return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    case "openai": return "https://api.openai.com/v1/chat/completions";
    case "groq": return "https://api.groq.com/openai/v1/chat/completions";
    case "deepseek": return "https://api.deepseek.com/chat/completions";
    case "openrouter": return "https://openrouter.ai/api/v1/chat/completions";
    case "anthropic": return "https://api.anthropic.com/v1/messages";
    default: return "https://api.openai.com/v1/chat/completions";
  }
}
