import { z } from "zod";

export const sanitizeNumberInput = (raw: string) => raw.replace(/[^\d.,]/g, "");

export const parseCurrencyInput = (raw: string): number => {
  const cleaned = sanitizeNumberInput(raw);
  if (!cleaned) return 0;

  const normalized = cleaned.includes(",")
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned;

  const num = Number.parseFloat(normalized);
  return Number.isFinite(num) ? num : 0;
};

export type FechamentoLeadFormShape = {
  tipo: string;
  valor: number;
  comissao_percentual: number;
  comissao_valor: number;
  tem_parceria: boolean;
  parceiro_nome: string;
  parceiro_comissao_percentual: number;
  parceiro_comissao_valor: number;
  captador_comissao_percentual: number;
  captador_comissao_valor: number;
  corretor_comissao_percentual: number;
  corretor_comissao_valor: number;
  imposto_percentual: number;
  imposto_valor: number;
};

export type FechamentoLeadValidationField =
  | "tipo"
  | "valor"
  | "comissao"
  | "parceiro_nome"
  | "parceiro_comissao";

export type FechamentoLeadValidationErrors = Partial<
  Record<FechamentoLeadValidationField, string>
>;

export const getFechamentoLeadComputedValues = (form: FechamentoLeadFormShape) => {
  const comissaoValor = form.comissao_valor > 0
    ? form.comissao_valor
    : (form.valor * form.comissao_percentual) / 100;

  const parceiroValor = form.parceiro_comissao_valor > 0
    ? form.parceiro_comissao_valor
    : (comissaoValor * form.parceiro_comissao_percentual) / 100;

  const captadorValor = form.captador_comissao_valor > 0
    ? form.captador_comissao_valor
    : (comissaoValor * form.captador_comissao_percentual) / 100;

  const corretorValor = form.corretor_comissao_valor > 0
    ? form.corretor_comissao_valor
    : (comissaoValor * form.corretor_comissao_percentual) / 100;

  const impostoValorTotal = form.imposto_valor > 0
    ? form.imposto_valor
    : (comissaoValor * form.imposto_percentual) / 100;

  const impostoValor = form.tem_parceria ? impostoValorTotal / 2 : impostoValorTotal;
  const liquidoImobiliaria = comissaoValor - parceiroValor - captadorValor - corretorValor - impostoValor;

  return {
    comissaoValor,
    parceiroValor,
    captadorValor,
    corretorValor,
    impostoValor,
    liquidoImobiliaria,
  };
};

const fechamentoLeadSchema = z.object({
  tipo: z.string().trim(),
  valor: z.number(),
  comissao_percentual: z.number(),
  comissao_valor: z.number(),
  tem_parceria: z.boolean(),
  parceiro_nome: z.string(),
  parceiro_comissao_percentual: z.number(),
  parceiro_comissao_valor: z.number(),
  captador_comissao_percentual: z.number(),
  captador_comissao_valor: z.number(),
  corretor_comissao_percentual: z.number(),
  corretor_comissao_valor: z.number(),
  imposto_percentual: z.number(),
  imposto_valor: z.number(),
}).superRefine((form, ctx) => {
  const parsedForm = form as FechamentoLeadFormShape;

  if (!parsedForm.tipo.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["tipo"],
      message: "Selecione o tipo do contrato",
    });
  }

  if (parsedForm.valor <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["valor"],
      message: "Informe o valor do imóvel",
    });
  }

  const { comissaoValor, parceiroValor } = getFechamentoLeadComputedValues(parsedForm);

  if (comissaoValor <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["comissao"],
      message: "Informe a comissão (% ou valor)",
    });
  }

  if (parsedForm.tem_parceria) {
    if (!parsedForm.parceiro_nome.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["parceiro_nome"],
        message: "Informe o nome do parceiro",
      });
    }

    if (parceiroValor <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["parceiro_comissao"],
        message: "Informe a comissão da parceria (% ou valor)",
      });
    }
  }
});

export const validateFechamentoLeadForm = (
  form: FechamentoLeadFormShape,
): FechamentoLeadValidationErrors => {
  const result = fechamentoLeadSchema.safeParse(form);

  if (result.success) return {};

  return result.error.issues.reduce<FechamentoLeadValidationErrors>((acc, issue) => {
    const field = issue.path[0] as FechamentoLeadValidationField | undefined;
    if (field && !acc[field]) acc[field] = issue.message;
    return acc;
  }, {});
};
