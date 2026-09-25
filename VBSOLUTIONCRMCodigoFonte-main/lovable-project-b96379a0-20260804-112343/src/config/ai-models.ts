// Client mirror of supabase/functions/_shared/ai-models.ts
// Ordered by priority: index 0 = preferred, remaining = fallback chain.
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
  deepseek: ["deepseek-chat", "deepseek-reasoner"],
  openrouter: [
    "meta-llama/llama-3.3-70b-instruct:free",
    "google/gemini-2.0-flash-exp:free",
  ],
  anthropic: [
    "claude-haiku-4-5",
    "claude-sonnet-4-6",
    "claude-3-5-haiku-20241022",
  ],
  openai: ["gpt-4o-mini", "gpt-4o"],
};

export function firstModel(provider: string): string {
  return AI_MODELS[provider]?.[0] || "gpt-4o-mini";
}
