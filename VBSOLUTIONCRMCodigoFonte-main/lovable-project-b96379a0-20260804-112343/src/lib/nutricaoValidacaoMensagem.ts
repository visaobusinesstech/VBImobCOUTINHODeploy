import {
  CHAVES_VALIDAS,
  variaveisUsadas,
  variaveisDesconhecidas,
  VARIAVEIS_NUTRICAO,
} from "@/lib/nutricaoVariaveis";

/**
 * Variáveis consideradas essenciais: quando usadas na mensagem, precisam
 * necessariamente resolver para um valor válido, senão o envio é bloqueado.
 */
export const VARIAVEIS_ESSENCIAIS = [
  "imovel_link",
  "imovel_endereco",
  "imovel_titulo",
  "imovel_resumo",
  "imovel_preco",
] as const;

export type VariavelEssencial = (typeof VARIAVEIS_ESSENCIAIS)[number];

/** Variáveis que devem conter uma URL http(s) válida. */
export const VARIAVEIS_URL = ["imovel_link"];

const rotulo = (chave: string) =>
  VARIAVEIS_NUTRICAO.find((v) => v.chave === chave)?.label ?? chave;

export interface ProblemaMensagem {
  tipo: "erro" | "aviso";
  codigo:
    | "vazia"
    | "titulo"
    | "variavel_invalida"
    | "placeholder_malformado"
    | "essencial_vazia"
    | "url_invalida"
    | "sem_valor"
    | "tamanho";
  mensagem: string;
}

export interface ResultadoValidacaoMensagem {
  erros: ProblemaMensagem[];
  avisos: ProblemaMensagem[];
  podeEnviar: boolean;
}

const LIMITE_WHATSAPP = 1200;

/** Detecta `{unica}`, `{{sem_fechar` ou `{{ }}` vazio. */
export function placeholdersMalformados(texto: string): string[] {
  const problemas: string[] = [];
  if (/\{\{\s*\}\}/.test(texto)) problemas.push("{{ }} sem nome de variável");
  const semFechar = texto.match(/\{\{(?:(?!\}\})[\s\S]){0,40}$/);
  if (semFechar) problemas.push("chave `{{` aberta sem fechamento `}}`");
  const chaveSimples = texto
    .replace(/\{\{[\s\S]*?\}\}/g, "")
    .match(/\{[^{}\n]{1,40}\}/g);
  if (chaveSimples?.length) {
    problemas.push(`use chaves duplas: ${chaveSimples.slice(0, 3).join(", ")}`);
  }
  return problemas;
}

export function urlValida(valor: string): boolean {
  try {
    const u = new URL(valor.trim());
    return (u.protocol === "http:" || u.protocol === "https:") && !!u.hostname.includes(".");
  } catch {
    return false;
  }
}

/**
 * Valida uma mensagem de nutrição contra o contexto de pré-visualização.
 * Erros bloqueiam o salvamento/envio; avisos são apenas informativos.
 */
export function validarMensagemNutricao(
  mensagem: string,
  opcoes: {
    titulo?: string;
    canal?: string;
    contexto?: Record<string, string>;
    exigirContexto?: boolean;
  } = {},
): ResultadoValidacaoMensagem {
  const erros: ProblemaMensagem[] = [];
  const avisos: ProblemaMensagem[] = [];
  const texto = (mensagem ?? "").trim();
  const ctx = opcoes.contexto;

  if (!texto) {
    erros.push({ tipo: "erro", codigo: "vazia", mensagem: "A mensagem não pode ficar vazia." });
    return { erros, avisos, podeEnviar: false };
  }

  if (opcoes.titulo !== undefined && !opcoes.titulo.trim()) {
    erros.push({ tipo: "erro", codigo: "titulo", mensagem: "Informe um título para a etapa." });
  }

  placeholdersMalformados(texto).forEach((p) =>
    erros.push({ tipo: "erro", codigo: "placeholder_malformado", mensagem: `Variável mal formatada: ${p}.` }),
  );

  variaveisDesconhecidas(texto).forEach((v) =>
    erros.push({
      tipo: "erro",
      codigo: "variavel_invalida",
      mensagem: `A variável {{${v}}} não existe no catálogo.`,
    }),
  );

  const usadas = variaveisUsadas(texto).filter((v) => CHAVES_VALIDAS.has(v));

  if (ctx) {
    usadas.forEach((v) => {
      const valor = (ctx[v] ?? "").trim();
      const essencial = (VARIAVEIS_ESSENCIAIS as readonly string[]).includes(v);

      if (!valor) {
        const item: ProblemaMensagem = {
          tipo: essencial ? "erro" : "aviso",
          codigo: essencial ? "essencial_vazia" : "sem_valor",
          mensagem: essencial
            ? `${rotulo(v)} ({{${v}}}) está vazio no exemplo selecionado — o envio seria feito com a informação faltando.`
            : `{{${v}}} está sem valor no exemplo selecionado e sairá em branco.`,
        };
        (essencial ? erros : avisos).push(item);
        return;
      }

      if (VARIAVEIS_URL.includes(v) && !urlValida(valor)) {
        erros.push({
          tipo: "erro",
          codigo: "url_invalida",
          mensagem: `${rotulo(v)} precisa ser um link http(s) válido (valor atual: "${valor}").`,
        });
      }
    });
  }

  if (opcoes.canal === "whatsapp" && texto.length > LIMITE_WHATSAPP) {
    avisos.push({
      tipo: "aviso",
      codigo: "tamanho",
      mensagem: `Mensagem longa para WhatsApp (${texto.length} caracteres). Ideal até ${LIMITE_WHATSAPP}.`,
    });
  }

  return { erros, avisos, podeEnviar: erros.length === 0 };
}

/** Retorna as variáveis essenciais usadas no texto que estão vazias/inválidas no contexto. */
export function essenciaisPendentes(texto: string, ctx: Record<string, string>): string[] {
  return variaveisUsadas(texto).filter((v) => {
    if (!(VARIAVEIS_ESSENCIAIS as readonly string[]).includes(v)) return false;
    const valor = (ctx[v] ?? "").trim();
    if (!valor) return true;
    return VARIAVEIS_URL.includes(v) && !urlValida(valor);
  });
}
