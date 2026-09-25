import { z } from "zod";

/**
 * Schema oficial do payload retornado pela edge function `avaliacao-wizard-ia`.
 * Aplicado no cliente antes de renderizar a análise no wizard, garantindo
 * que campos ausentes/maltipados não quebrem a UI nem o laudo.
 */
export const iaAnaliseSchema = z.object({
  inconsistencias: z
    .array(z.string().trim().min(1).max(500))
    .max(50)
    .catch([])
    .default([]),
  suficiencia: z.string().trim().max(2000).catch("").default(""),
  valor_sugerido_ia: z
    .union([z.number().finite().positive(), z.string()])
    .transform((v) => {
      if (typeof v === "number") return Number.isFinite(v) && v > 0 ? v : undefined;
      const cleaned = String(v).replace(/[^\d.,-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
      const n = Number(cleaned);
      return Number.isFinite(n) && n > 0 ? n : undefined;
    })
    .optional()
    .catch(undefined),
  fundamentacao: z.string().trim().max(8000).catch("").default(""),
  conclusao: z.string().trim().max(4000).catch("").default(""),
});

export type IaAnalisePayload = z.infer<typeof iaAnaliseSchema>;

export interface IaParseResult {
  ok: boolean;
  data: IaAnalisePayload;
  issues: string[];
}

/**
 * Faz parse defensivo da resposta da IA. Em caso de erro grave, retorna
 * um objeto vazio normalizado e a lista de problemas detectados.
 */
export function parseIaResponse(raw: unknown): IaParseResult {
  const fallback: IaAnalisePayload = {
    inconsistencias: [],
    suficiencia: "",
    valor_sugerido_ia: undefined,
    fundamentacao: "",
    conclusao: "",
  };

  if (raw == null || typeof raw !== "object") {
    return { ok: false, data: fallback, issues: ["Resposta vazia ou não-objeto."] };
  }

  const parsed = iaAnaliseSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      data: fallback,
      issues: parsed.error.issues.map((i) => `${i.path.join(".") || "root"}: ${i.message}`),
    };
  }

  // Conteúdo mínimo: ao menos fundamentação OU conclusão OU suficiência preenchida.
  const hasContent =
    parsed.data.fundamentacao.length > 0 ||
    parsed.data.conclusao.length > 0 ||
    parsed.data.suficiencia.length > 0;

  return {
    ok: hasContent,
    data: parsed.data,
    issues: hasContent ? [] : ["Resposta sem fundamentação, conclusão ou suficiência."],
  };
}
