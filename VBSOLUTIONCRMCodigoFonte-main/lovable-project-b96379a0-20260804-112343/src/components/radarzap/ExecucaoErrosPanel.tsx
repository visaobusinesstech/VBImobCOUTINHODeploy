import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  AlertTriangle, ChevronDown, ChevronRight, KeyRound, ServerCrash, ShieldAlert,
  Timer, WifiOff, FileWarning, CheckCircle2, Copy, Download, FileJson, FileArchive, RefreshCw, Loader2,
  Search, X, FileText, ClipboardCopy,
} from "lucide-react";

import { toast } from "sonner";



type Attempt = {
  tentativa: number;
  status: number | null;
  duration_ms: number;
  error: string | null;
  backoff_ms: number;
  retryable: boolean;
};

type Linha = {
  cidade: string;
  termo: string;
  query: string;
  status: number | null;
  duration_ms: number;
  response_shape?: string[];
  raw_items: number;
  invites_validos: number;
  invites_novos?: number;
  descartados_sem_url?: number;
  descartados_host_invalido?: number;
  error: string | null;
  body_preview?: string | null;
  tentativas?: number;
  retries?: number;
  retry_total_ms?: number;
  retry_attempts?: Attempt[];
  retry_esgotado?: boolean;
  sample_urls?: string[];
};

type Props = {
  ultimaBusca: any | null;
  onReexecutarErros?: (queries: Array<{ cidade: string; termo: string; cat?: string }>) => void | Promise<void>;
  reexecutando?: boolean;
};


/** Rótulos humanos por status HTTP */
const HTTP_LABEL: Record<number, string> = {
  400: "Requisição inválida",
  401: "Não autorizado — chave Firecrawl inválida ou expirada",
  402: "Pagamento necessário — sem créditos no Firecrawl",
  403: "Acesso negado — chave sem permissão para /search",
  404: "Endpoint não encontrado",
  408: "Timeout do servidor",
  425: "Requisição prematura",
  429: "Rate limit — muitas requisições em pouco tempo",
  500: "Erro interno no Firecrawl",
  502: "Bad gateway no Firecrawl",
  503: "Firecrawl indisponível",
  504: "Timeout no gateway Firecrawl",
};

function httpBadgeVariant(s: number | null): "default" | "secondary" | "destructive" | "outline" {
  if (s == null) return "outline";
  if (s >= 200 && s < 300) return "secondary";
  if (s === 429) return "outline";
  return "destructive";
}

function shapeParaMapa(shape?: string[]) {
  // ex.: ["data.web:12","data.news:0"] => { "data.web": 12, "data.news": 0 }
  const m: Record<string, number> = {};
  (shape ?? []).forEach((s) => {
    const [k, v] = s.split(":");
    m[k] = Number(v ?? 0);
  });
  return m;
}

function classificarErro(l: Linha): { titulo: string; cor: string; icone: JSX.Element } {
  const s = l.status;
  if (l.error?.startsWith("fetch falhou")) {
    return { titulo: "Falha de rede", cor: "text-orange-600", icone: <WifiOff className="h-4 w-4" /> };
  }
  if (l.error === "JSON inválido do Firecrawl") {
    return { titulo: "Resposta não-JSON", cor: "text-red-600", icone: <FileWarning className="h-4 w-4" /> };
  }
  if (s === 401 || s === 403) {
    return { titulo: HTTP_LABEL[s], cor: "text-red-600", icone: <KeyRound className="h-4 w-4" /> };
  }
  if (s === 402) {
    return { titulo: HTTP_LABEL[s], cor: "text-red-600", icone: <ShieldAlert className="h-4 w-4" /> };
  }
  if (s === 429) {
    return { titulo: HTTP_LABEL[s], cor: "text-amber-600", icone: <Timer className="h-4 w-4" /> };
  }
  if (s && s >= 500) {
    return { titulo: HTTP_LABEL[s] ?? `HTTP ${s}`, cor: "text-red-600", icone: <ServerCrash className="h-4 w-4" /> };
  }
  if (s && s >= 400) {
    return { titulo: HTTP_LABEL[s] ?? `HTTP ${s}`, cor: "text-red-600", icone: <AlertTriangle className="h-4 w-4" /> };
  }
  return { titulo: l.error ?? "Erro desconhecido", cor: "text-red-600", icone: <AlertTriangle className="h-4 w-4" /> };
}

type TipoFalha = "rede" | "json_invalido" | "http_4xx" | "http_5xx" | "shape" | "retry_esgotado" | "insert";

const TIPO_LABEL: Record<TipoFalha, string> = {
  rede: "Rede (fetch falhou)",
  json_invalido: "JSON inválido",
  http_4xx: "HTTP 4xx (auth/rate limit)",
  http_5xx: "HTTP 5xx (indisponível)",
  shape: "Shape inesperado",
  retry_esgotado: "Retry esgotado",
  insert: "Falha ao salvar (insert)",
};

function tipoDaLinha(l: Linha): TipoFalha[] {
  const tipos: TipoFalha[] = [];
  if (l.error?.startsWith?.("fetch falhou")) tipos.push("rede");
  if (l.error === "JSON inválido do Firecrawl") tipos.push("json_invalido");
  const s = l.status;
  if (s && s >= 400 && s < 500) tipos.push("http_4xx");
  if (s && s >= 500) tipos.push("http_5xx");
  if (l.retry_esgotado) tipos.push("retry_esgotado");
  return tipos;
}

// Uma linha é considerada retryable quando o motor tentou (ou tentaria) novamente:
// - já registrou retry_attempts / retry_esgotado
// - status transitório (408, 429, 5xx)
// - falha de rede sem status (fetch falhou / DNS / timeout)
function ehRetryable(l: Linha): boolean {
  if ((l.retry_attempts?.length ?? 0) > 0) return true;
  if (l.retry_esgotado) return true;
  const s = l.status;
  if (s === 408 || s === 429) return true;
  if (s && s >= 500) return true;
  if (l.error && l.status == null) return true;
  return false;
}

export default function ExecucaoErrosPanel({ ultimaBusca, onReexecutarErros, reexecutando }: Props) {
  const [abertos, setAbertos] = useState<Record<number, boolean>>({});
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<string>("all");
  const [filtroTipo, setFiltroTipo] = useState<TipoFalha | "all">("all");
  const [filtroRetryable, setFiltroRetryable] = useState<"all" | "sim" | "nao">("all");

  const telemetria: Linha[] = ultimaBusca?.telemetria ?? [];

  const errosInsert: string[] = (ultimaBusca?.erros ?? []).filter(
    (e: string) => e?.startsWith?.("Insert:"),
  );
  const firecrawlKind: string | undefined = ultimaBusca?.firecrawl_key_kind;
  const runId: string | undefined = ultimaBusca?.run_id;

  const { comErro, shapeInesperado, retryEsgotado } = useMemo(() => {
    const comErro = telemetria.filter((t) => t.error);
    const shapeInesperado = telemetria.filter((t) => {
      if (t.error) return false;
      const m = shapeParaMapa(t.response_shape);
      // Firecrawl v2 deveria retornar data.web; se ausente e sem itens, é shape inesperado
      const temWeb = "data.web" in m;
      return !temWeb && t.raw_items === 0;
    });
    const retryEsgotado = telemetria.filter((t) => t.retry_esgotado);
    return { comErro, shapeInesperado, retryEsgotado };
  }, [telemetria]);

  const statusOptions = useMemo(() => {
    const set = new Set<number>();
    comErro.forEach((l) => { if (l.status != null) set.add(l.status); });
    return Array.from(set).sort((a, b) => a - b);
  }, [comErro]);

  const buscaLower = busca.trim().toLowerCase();
  const casaBusca = (l: Linha) => {
    if (!buscaLower) return true;
    return (
      l.cidade?.toLowerCase().includes(buscaLower) ||
      l.termo?.toLowerCase().includes(buscaLower) ||
      l.query?.toLowerCase().includes(buscaLower) ||
      (l.error ?? "").toLowerCase().includes(buscaLower)
    );
  };

  const comErroFiltrado = useMemo(() => {
    return comErro.filter((l) => {
      if (!casaBusca(l)) return false;
      if (filtroStatus === "__none__") {
        if (l.status != null) return false;
      } else if (filtroStatus !== "all" && String(l.status ?? "") !== filtroStatus) return false;

      if (filtroTipo !== "all") {
        if (filtroTipo === "insert") return false; // "insert" só se aplica ao bloco de insert
        const tipos = tipoDaLinha(l);
        if (!tipos.includes(filtroTipo)) return false;
      }
      if (filtroRetryable !== "all") {
        const r = ehRetryable(l);
        if (filtroRetryable === "sim" && !r) return false;
        if (filtroRetryable === "nao" && r) return false;
      }
      return true;
    });
  }, [comErro, buscaLower, filtroStatus, filtroTipo, filtroRetryable]);

  const shapeFiltrado = useMemo(() => {
    // "shape" não tem status HTTP nem retry; oculta quando esses filtros estão ativos
    if (filtroTipo !== "all" && filtroTipo !== "shape") return [];
    if (filtroStatus !== "all") return [];
    if (filtroRetryable !== "all") return [];
    return shapeInesperado.filter(casaBusca);
  }, [shapeInesperado, buscaLower, filtroStatus, filtroTipo, filtroRetryable]);

  const errosInsertFiltrado = useMemo(() => {
    // Insert é textual — só respeita busca e filtro tipo=insert/all
    if (filtroTipo !== "all" && filtroTipo !== "insert") return [];
    if (filtroStatus !== "all") return [];
    if (filtroRetryable !== "all") return [];
    if (!buscaLower) return errosInsert;
    return errosInsert.filter((e) => e.toLowerCase().includes(buscaLower));
  }, [errosInsert, buscaLower, filtroStatus, filtroTipo, filtroRetryable]);

  const chaveIncompativel = firecrawlKind?.includes("INCOMPATÍVEL");
  const nadaARelatar =
    !ultimaBusca ||
    (comErro.length === 0 &&
      shapeInesperado.length === 0 &&
      errosInsert.length === 0 &&
      !chaveIncompativel);

  if (nadaARelatar) return null;

  const temFiltroAtivo =
    !!buscaLower || filtroStatus !== "all" || filtroTipo !== "all" || filtroRetryable !== "all";
  const limparFiltros = () => {
    setBusca("");
    setFiltroStatus("all");
    setFiltroTipo("all");
    setFiltroRetryable("all");
  };


  const copiar = (txt: string) => {
    navigator.clipboard.writeText(txt).then(
      () => toast.success("Copiado"),
      () => toast.error("Não foi possível copiar"),
    );
  };

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const baseName = `radarzap-erros-${runId?.slice(0, 8) ?? "sem-run"}-${timestamp}`;

  const baixar = (nome: string, conteudo: string, mime: string) => {
    const blob = new Blob([conteudo], { type: `${mime};charset=utf-8;` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const montarBreadcrumbs = () => {
    const cidadesUsadas: string[] =
      ultimaBusca?._cidades ??
      ultimaBusca?.cidades ??
      Array.from(new Set(telemetria.map((l) => l.cidade).filter(Boolean)));
    const termosUsados: string[] =
      Array.from(new Set(telemetria.map((l) => l.termo).filter(Boolean)));
    const termoBase: string | null =
      ultimaBusca?._termo ?? ultimaBusca?.termo ?? (termosUsados[0] ?? null);

    return {
      execucao: {
        run_id: runId ?? null,
        retry_of_run_id: ultimaBusca?.retry_of_run_id ?? null,
        modo: ultimaBusca?.modo ?? null,
        criado_em: ultimaBusca?.created_at ?? null,
        gerado_em: new Date().toISOString(),
        origem_url:
          typeof window !== "undefined" ? window.location.href : null,
        user_agent:
          typeof navigator !== "undefined" ? navigator.userAgent : null,
      },
      parametros_busca: {
        cidades: cidadesUsadas,
        regiao: cidadesUsadas.join(" | "),
        termo_base: termoBase,
        termos_expandidos: termosUsados,
        firecrawl_key_kind: firecrawlKind ?? null,
      },
      retry_policy: ultimaBusca?.retry_policy ?? null,
      filtros_aplicados_na_exportacao: {
        busca_texto: buscaLower || null,
        filtro_status_http: filtroStatus === "all" ? null : filtroStatus,
        filtro_tipo_falha: filtroTipo === "all" ? null : filtroTipo,
        filtro_retryable: filtroRetryable === "all" ? null : filtroRetryable,
        alguma_ativo: temFiltroAtivo,
      },
      contadores: {
        queries_total: ultimaBusca?.queries ?? telemetria.length,
        queries_com_erro_total: comErro.length,
        queries_com_erro_filtradas: comErroFiltrado.length,
        shape_inesperado_total: shapeInesperado.length,
        shape_inesperado_filtradas: shapeFiltrado.length,
        retry_esgotado: retryEsgotado.length,
        falhas_insert: errosInsert.length,
        encontrados: ultimaBusca?.encontrados ?? 0,
        inseridos: ultimaBusca?.inseridos ?? 0,
      },
    };
  };

  const montarJSON = () => {
    const breadcrumbs = montarBreadcrumbs();
    const payload = {
      run_id: runId ?? null,
      gerado_em: breadcrumbs.execucao.gerado_em,
      firecrawl_key_kind: firecrawlKind ?? null,
      breadcrumbs,
      resumo: {
        queries: ultimaBusca?.queries ?? telemetria.length,
        encontrados: ultimaBusca?.encontrados ?? 0,
        inseridos: ultimaBusca?.inseridos ?? 0,
        total_ms: ultimaBusca?.total_ms ?? null,
        total_raw_items: ultimaBusca?.total_raw_items ?? null,
        total_invites_validos: ultimaBusca?.total_invites_validos ?? null,
        total_retries: ultimaBusca?.total_retries ?? null,
        total_retry_esgotado: ultimaBusca?.total_retry_esgotado ?? null,
        erros_http_rede: comErro.length,
        shape_inesperado: shapeInesperado.length,
        retry_esgotado: retryEsgotado.length,
        falhas_insert: errosInsert.length,
        chave_incompativel: !!chaveIncompativel,
      },
      retry_policy: ultimaBusca?.retry_policy ?? null,
      erros_insert: errosInsert,
      queries_com_erro: comErro,
      queries_shape_inesperado: shapeInesperado.map((l) => ({
        cidade: l.cidade,
        termo: l.termo,
        query: l.query,
        status: l.status,
        response_shape: l.response_shape,
        raw_items: l.raw_items,
      })),
    };
    return JSON.stringify(payload, null, 2);
  };

  const exportarJSON = () => {
    baixar(`${baseName}.json`, montarJSON(), "application/json");
    toast.success("JSON exportado");
  };

  // BOM p/ Excel abrir UTF-8 corretamente
  const BOM = "\uFEFF";
  const csvCell = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "string" ? v : Array.isArray(v) ? v.join(" | ") : String(v);
    return `"${s.replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
  };
  const csvLinha = (arr: unknown[]) => arr.map(csvCell).join(",");

  const montarCSV = () => {
    const bc = montarBreadcrumbs();
    const linhas: string[] = [];

    // Cabeçalho de breadcrumbs (chave;valor) — facilita rastreamento no Excel
    linhas.push(csvLinha(["-- breadcrumbs --"]));
    linhas.push(csvLinha(["chave", "valor"]));
    const flat: Array<[string, unknown]> = [
      ["run_id", bc.execucao.run_id],
      ["retry_of_run_id", bc.execucao.retry_of_run_id],
      ["modo", bc.execucao.modo],
      ["criado_em", bc.execucao.criado_em],
      ["gerado_em", bc.execucao.gerado_em],
      ["origem_url", bc.execucao.origem_url],
      ["cidades", bc.parametros_busca.cidades],
      ["regiao", bc.parametros_busca.regiao],
      ["termo_base", bc.parametros_busca.termo_base],
      ["termos_expandidos", bc.parametros_busca.termos_expandidos],
      ["firecrawl_key_kind", bc.parametros_busca.firecrawl_key_kind],
      ["filtro_busca_texto", bc.filtros_aplicados_na_exportacao.busca_texto],
      ["filtro_status_http", bc.filtros_aplicados_na_exportacao.filtro_status_http],
      ["filtro_tipo_falha", bc.filtros_aplicados_na_exportacao.filtro_tipo_falha],
      ["filtro_retryable", bc.filtros_aplicados_na_exportacao.filtro_retryable],
      ["contador_queries_total", bc.contadores.queries_total],
      ["contador_queries_com_erro_total", bc.contadores.queries_com_erro_total],
      ["contador_queries_com_erro_filtradas", bc.contadores.queries_com_erro_filtradas],
      ["contador_shape_inesperado_total", bc.contadores.shape_inesperado_total],
      ["contador_shape_inesperado_filtradas", bc.contadores.shape_inesperado_filtradas],
      ["contador_retry_esgotado", bc.contadores.retry_esgotado],
      ["contador_falhas_insert", bc.contadores.falhas_insert],
      ["contador_encontrados", bc.contadores.encontrados],
      ["contador_inseridos", bc.contadores.inseridos],
    ];
    flat.forEach(([k, v]) => linhas.push(csvLinha([k, v as unknown])));
    linhas.push("");

    linhas.push(csvLinha(["-- queries --"]));
    const header = [
      "run_id", "cidade", "termo", "query", "http_status", "http_label",
      "duration_ms", "tentativas", "retries", "retry_total_ms", "retry_esgotado",
      "raw_items", "invites_validos", "response_shape", "categoria_erro",
      "error", "body_preview",
    ];
    linhas.push(csvLinha(header));

    const marcarCategoria = (l: Linha): string => {
      if (l.error) return "http_rede";
      const m = shapeParaMapa(l.response_shape);
      if (!("data.web" in m) && l.raw_items === 0) return "shape_inesperado";
      return "ok";
    };

    for (const l of telemetria) {
      const cat = marcarCategoria(l);
      if (cat === "ok") continue;
      linhas.push(csvLinha([
        runId ?? "",
        l.cidade, l.termo, l.query,
        l.status ?? "", l.status ? (HTTP_LABEL[l.status] ?? "") : "",
        l.duration_ms, l.tentativas ?? 1, l.retries ?? 0,
        l.retry_total_ms ?? l.duration_ms, l.retry_esgotado ? "sim" : "não",
        l.raw_items, l.invites_validos, l.response_shape ?? [],
        cat, l.error ?? "", l.body_preview ?? "",
      ]));
    }

    // Detalhe das tentativas (uma linha por tentativa)
    linhas.push("");
    linhas.push(csvLinha(["-- tentativas --"]));
    linhas.push(csvLinha([
      "run_id", "cidade", "termo", "tentativa", "http_status",
      "duration_ms", "backoff_ms", "retryable", "error",
    ]));
    for (const l of comErro) {
      for (const a of l.retry_attempts ?? []) {
        linhas.push(csvLinha([
          runId ?? "", l.cidade, l.termo, a.tentativa, a.status ?? "",
          a.duration_ms, a.backoff_ms, a.retryable ? "sim" : "não", a.error ?? "",
        ]));
      }
    }

    // Falhas de insert
    if (errosInsert.length) {
      linhas.push("");
      linhas.push(csvLinha(["-- falhas insert --"]));
      linhas.push(csvLinha(["run_id", "mensagem"]));
      errosInsert.forEach((e) => linhas.push(csvLinha([runId ?? "", e])));
    }

    return BOM + linhas.join("\r\n");
  };

  const exportarCSV = () => {
    baixar(`${baseName}.csv`, montarCSV(), "text/csv");
    toast.success("CSV exportado");
  };

  const montarREADME = () => {
    const bc = montarBreadcrumbs();
    const cidades = bc.parametros_busca.cidades.length
      ? bc.parametros_busca.cidades.join(", ")
      : "(nenhuma)";
    const termos = bc.parametros_busca.termos_expandidos.length
      ? bc.parametros_busca.termos_expandidos.join(", ")
      : "(nenhum)";
    const linhas = [
      "# RadarZAP — Relatório de erros da busca de grupos públicos",
      "",
      `- run_id: ${runId ?? "(sem run)"}`,
      `- retry_of_run_id: ${bc.execucao.retry_of_run_id ?? "(nenhum — execução original)"}`,
      `- Modo: ${bc.execucao.modo ?? "(não informado)"}`,
      `- Criado em: ${bc.execucao.criado_em ?? "(desconhecido)"}`,
      `- Gerado em: ${bc.execucao.gerado_em}`,
      `- Firecrawl key: ${firecrawlKind ?? "desconhecido"}`,
      `- Origem: ${bc.execucao.origem_url ?? "(desconhecida)"}`,
      "",
      "## Breadcrumbs (parâmetros e filtros)",
      "",
      `- Região / cidades: ${cidades}`,
      `- Termo base: ${bc.parametros_busca.termo_base ?? "(nenhum)"}`,
      `- Termos expandidos: ${termos}`,
      `- Filtro busca (texto): ${bc.filtros_aplicados_na_exportacao.busca_texto ?? "(nenhum)"}`,
      `- Filtro status HTTP: ${bc.filtros_aplicados_na_exportacao.filtro_status_http ?? "(todos)"}`,
      `- Filtro tipo de falha: ${bc.filtros_aplicados_na_exportacao.filtro_tipo_falha ?? "(todos)"}`,
      `- Filtro retryable: ${bc.filtros_aplicados_na_exportacao.filtro_retryable ?? "(todos)"}`,
      "",
      "> Consulte também o objeto `breadcrumbs` em `erros.json` e o bloco `-- breadcrumbs --` no topo de `erros.csv` para o registro completo.",
      "",
      "## Conteúdo do ZIP",
      "",
      "- `resumo.txt` — resumo em texto com principais erros, contagens (por status HTTP, cidade e termo) e recomendações contextuais. Serve para colar direto num chamado.",
      "- `erros.json` — payload completo com resumo, política de retry, queries com erro (com histórico de tentativas e body_preview do Firecrawl), queries com shape inesperado e falhas de insert.",
      "- `erros.csv` — mesma informação em formato tabular (UTF-8 com BOM), com três blocos:",
      "  1. Uma linha por query com erro ou shape inesperado.",
      "  2. `-- tentativas --`: uma linha por tentativa (HTTP status, duração, backoff, retryable, erro).",
      "  3. `-- falhas insert --`: mensagens de erro ao gravar grupos no banco.",
      "- `README.md` — este arquivo.",
      "",
      "## Resumo desta execução",
      "",
      `- Queries executadas: ${ultimaBusca?.queries ?? telemetria.length}`,
      `- Grupos encontrados: ${ultimaBusca?.encontrados ?? 0}`,
      `- Inseridos no banco: ${ultimaBusca?.inseridos ?? 0}`,
      `- Erros HTTP/rede: ${comErro.length}`,
      `- Shape inesperado (HTTP 200 sem data.web): ${shapeInesperado.length}`,
      `- Retry esgotado: ${retryEsgotado.length}`,
      `- Falhas ao salvar (insert): ${errosInsert.length}`,
      `- Chave Firecrawl incompatível: ${chaveIncompativel ? "SIM" : "não"}`,
      "",
      "## Como interpretar",
      "",
      "- **HTTP 401/403** → chave Firecrawl inválida ou sem permissão para `/search`.",
      "- **HTTP 402** → sem créditos no Firecrawl.",
      "- **HTTP 429** → rate limit; reduza a frequência ou o número de cidades/termos.",
      "- **HTTP 5xx** → Firecrawl indisponível; o retry com backoff cobre parte dos casos.",
      "- **`fetch falhou …`** → problema de rede entre a Edge Function e o Firecrawl.",
      "- **`JSON inválido do Firecrawl`** → resposta não-JSON; ver `body_preview`.",
      "- **Shape inesperado** → HTTP 200 mas sem `data.web[]`; pode ser mudança de contrato do Firecrawl v2, plano sem Web ou consulta genuinamente vazia.",
      "- **Retry esgotado** → todas as tentativas dentro do orçamento falharam (ver `retry_policy` no JSON).",
      "",
      "## Como enviar para o suporte",
      "",
      "1. Anexe este ZIP inteiro.",
      "2. Informe o `run_id` acima e a data/hora aproximada da execução.",
      "3. Se possível, descreva o que estava tentando fazer (cidades, termos, agendamento manual/automático).",
      "",
    ];
    return linhas.join("\n");
  };

  const montarResumoTexto = () => {
    const bc = montarBreadcrumbs();

    // top status HTTP
    const statusCount = new Map<string, number>();
    for (const l of comErro) {
      const k = l.status != null ? String(l.status) : "sem_status";
      statusCount.set(k, (statusCount.get(k) ?? 0) + 1);
    }
    const topStatus = Array.from(statusCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // top cidades / termos com erro
    const cidadeCount = new Map<string, number>();
    const termoCount = new Map<string, number>();
    for (const l of comErro) {
      cidadeCount.set(l.cidade, (cidadeCount.get(l.cidade) ?? 0) + 1);
      termoCount.set(l.termo, (termoCount.get(l.termo) ?? 0) + 1);
    }
    const topCidades = Array.from(cidadeCount.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const topTermos = Array.from(termoCount.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);

    // recomendações contextuais
    const recs: string[] = [];
    if (chaveIncompativel) {
      recs.push("Substituir a chave Firecrawl por uma compatível com o endpoint /search (a atual foi marcada como INCOMPATÍVEL).");
    }
    if (statusCount.get("401") || statusCount.get("403")) {
      recs.push("Revisar as permissões da chave Firecrawl (401/403): pode estar inválida, expirada ou sem acesso a /search.");
    }
    if (statusCount.get("402")) {
      recs.push("Recarregar créditos no Firecrawl (402 — pagamento necessário).");
    }
    if (statusCount.get("429")) {
      recs.push("Reduzir a taxa de queries (429 — rate limit): diminuir cidades/termos por execução ou espaçar agendamentos.");
    }
    const has5xx = Array.from(statusCount.keys()).some((k) => /^5\d\d$/.test(k));
    if (has5xx) {
      recs.push("Instabilidade no Firecrawl (5xx): reexecutar apenas as queries com erro usando o botão “Reexecutar”. O retry com backoff já cobre parte dos casos.");
    }
    if (retryEsgotado.length) {
      recs.push(`Há ${retryEsgotado.length} query(ies) com retry esgotado — considere ampliar o orçamento de retry ou revisar a estabilidade da rede.`);
    }
    if (shapeInesperado.length) {
      recs.push("Queries com shape inesperado (HTTP 200 sem data.web): validar contrato do Firecrawl v2 ou se o plano contempla resultados web.");
    }
    if (errosInsert.length) {
      recs.push(`Existem ${errosInsert.length} falha(s) ao gravar no banco — verificar RLS, colunas obrigatórias e duplicidades.`);
    }
    if (!recs.length) {
      recs.push("Nada crítico detectado nesta execução. Se o problema persistir, anexe o ZIP completo ao suporte.");
    }

    const linhas: string[] = [];
    linhas.push("RadarZAP — Resumo da execução");
    linhas.push("=".repeat(40));
    linhas.push(`run_id: ${runId ?? "(sem run)"}`);
    if (bc.execucao.retry_of_run_id) linhas.push(`retry_of_run_id: ${bc.execucao.retry_of_run_id}`);
    if (bc.execucao.modo) linhas.push(`modo: ${bc.execucao.modo}`);
    if (bc.execucao.criado_em) linhas.push(`criado em: ${bc.execucao.criado_em}`);
    linhas.push(`gerado em: ${bc.execucao.gerado_em}`);
    linhas.push(`firecrawl_key_kind: ${firecrawlKind ?? "desconhecido"}`);
    linhas.push("");
    linhas.push("Parâmetros da busca");
    linhas.push("-".repeat(40));
    linhas.push(`Cidades / região: ${bc.parametros_busca.cidades.join(", ") || "(nenhuma)"}`);
    linhas.push(`Termo base: ${bc.parametros_busca.termo_base ?? "(nenhum)"}`);
    if (bc.parametros_busca.termos_expandidos.length) {
      linhas.push(`Termos expandidos: ${bc.parametros_busca.termos_expandidos.join(", ")}`);
    }
    if (temFiltroAtivo) {
      linhas.push("");
      linhas.push("Filtros aplicados na exportação");
      linhas.push("-".repeat(40));
      if (bc.filtros_aplicados_na_exportacao.busca_texto)
        linhas.push(`Busca (texto): ${bc.filtros_aplicados_na_exportacao.busca_texto}`);
      if (bc.filtros_aplicados_na_exportacao.filtro_status_http)
        linhas.push(`Status HTTP: ${bc.filtros_aplicados_na_exportacao.filtro_status_http}`);
      if (bc.filtros_aplicados_na_exportacao.filtro_tipo_falha)
        linhas.push(`Tipo de falha: ${bc.filtros_aplicados_na_exportacao.filtro_tipo_falha}`);
      if (bc.filtros_aplicados_na_exportacao.filtro_retryable)
        linhas.push(`Retryable: ${bc.filtros_aplicados_na_exportacao.filtro_retryable}`);
    }
    linhas.push("");
    linhas.push("Contagens");
    linhas.push("-".repeat(40));
    linhas.push(`Queries executadas:            ${bc.contadores.queries_total}`);
    linhas.push(`Grupos encontrados:            ${bc.contadores.encontrados}`);
    linhas.push(`Inseridos no banco:            ${bc.contadores.inseridos}`);
    linhas.push(`Erros HTTP / rede:             ${comErro.length}`);
    linhas.push(`Shape inesperado (200 s/ web): ${shapeInesperado.length}`);
    linhas.push(`Retry esgotado:                ${retryEsgotado.length}`);
    linhas.push(`Falhas de insert:              ${errosInsert.length}`);
    linhas.push(`Chave Firecrawl incompatível:  ${chaveIncompativel ? "SIM" : "não"}`);

    if (topStatus.length) {
      linhas.push("");
      linhas.push("Principais status HTTP com erro");
      linhas.push("-".repeat(40));
      for (const [s, n] of topStatus) {
        const label = /^\d+$/.test(s) ? (HTTP_LABEL[Number(s)] ?? "") : "";
        linhas.push(`  ${s.padEnd(12)} ${String(n).padStart(4)}${label ? "  — " + label : ""}`);
      }
    }
    if (topCidades.length) {
      linhas.push("");
      linhas.push("Top cidades com erro");
      linhas.push("-".repeat(40));
      for (const [c, n] of topCidades) linhas.push(`  ${String(n).padStart(4)}  ${c}`);
    }
    if (topTermos.length) {
      linhas.push("");
      linhas.push("Top termos com erro");
      linhas.push("-".repeat(40));
      for (const [t, n] of topTermos) linhas.push(`  ${String(n).padStart(4)}  ${t}`);
    }

    linhas.push("");
    linhas.push("Recomendações");
    linhas.push("-".repeat(40));
    recs.forEach((r, i) => linhas.push(`${i + 1}. ${r}`));

    linhas.push("");
    linhas.push("Gerado pelo painel de erros do RadarZAP.");
    return linhas.join("\n");
  };

  const copiarResumo = async () => {
    try {
      await navigator.clipboard.writeText(montarResumoTexto());
      toast.success("Resumo copiado para a área de transferência");
    } catch {
      toast.error("Não foi possível copiar o resumo");
    }
  };

  const exportarResumoTxt = () => {
    baixar(`${baseName}-resumo.txt`, montarResumoTexto(), "text/plain");
    toast.success("Resumo TXT exportado");
  };

  const exportarZIP = async () => {
    try {
      const { zipSync, strToU8 } = await import("fflate");
      const files: Record<string, Uint8Array> = {
        "README.md": strToU8(montarREADME()),
        "resumo.txt": strToU8(montarResumoTexto()),
        "erros.json": strToU8(montarJSON()),
        "erros.csv": strToU8(montarCSV()),
      };
      const zipped = zipSync(files, { level: 6 });
      // Copia para um ArrayBuffer "puro" (evita SharedArrayBuffer no tipo Blob)
      const buffer = new Uint8Array(zipped).buffer;
      const blob = new Blob([buffer], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${baseName}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("ZIP exportado (resumo + JSON + CSV + README)");
    } catch (e: any) {
      toast.error(`Falha ao gerar ZIP: ${e?.message ?? e}`);
    }
  };


  return (
    <Card className="border-destructive/40">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex flex-wrap items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          Detalhes de erros da última busca
          <div className="ml-auto flex items-center gap-2">
            {runId && (
              <button
                type="button"
                onClick={() => copiar(runId)}
                className="text-xs font-mono text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                title="Copiar run_id"
              >
                run {runId.slice(0, 8)}… <Copy className="h-3 w-3" />
              </button>
            )}
            {onReexecutarErros && comErroFiltrado.length > 0 && (
              <Button
                size="sm"
                variant="default"
                className="h-7"
                disabled={!!reexecutando}
                onClick={() =>
                  onReexecutarErros(
                    comErroFiltrado.map((l) => ({ cidade: l.cidade, termo: l.termo })),
                  )
                }
                title={temFiltroAtivo
                  ? "Reexecuta apenas as consultas visíveis (filtro ativo)"
                  : "Reexecuta apenas as consultas com erro, mantendo os mesmos parâmetros"}
              >
                {reexecutando
                  ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
                Reexecutar {comErroFiltrado.length}
                {temFiltroAtivo && comErroFiltrado.length !== comErro.length ? ` de ${comErro.length}` : " com erro"}
              </Button>
            )}

            <Button
              size="sm"
              variant="outline"
              onClick={copiarResumo}
              className="h-7"
              title="Copia um resumo em texto com principais erros, contagens e recomendações"
            >
              <ClipboardCopy className="h-3.5 w-3.5 mr-1" /> Copiar resumo
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={exportarResumoTxt}
              className="h-7"
              title="Baixa o resumo em .txt para anexar ao lado do relatório"
            >
              <FileText className="h-3.5 w-3.5 mr-1" /> Resumo TXT
            </Button>

            <Button size="sm" variant="outline" onClick={exportarJSON} className="h-7">
              <FileJson className="h-3.5 w-3.5 mr-1" /> JSON
            </Button>
            <Button size="sm" variant="outline" onClick={exportarCSV} className="h-7">
              <Download className="h-3.5 w-3.5 mr-1" /> CSV
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={exportarZIP}
              className="h-7"
              title="ZIP com JSON + CSV + README para anexar no suporte"
            >
              <FileArchive className="h-3.5 w-3.5 mr-1" /> ZIP suporte
            </Button>


          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Alertas globais */}
        {chaveIncompativel && (
          <div className="flex gap-2 items-start rounded-md border border-destructive/40 bg-destructive/5 p-3">
            <KeyRound className="h-4 w-4 text-destructive mt-0.5" />
            <div className="text-sm">
              <div className="font-medium text-destructive">Chave Firecrawl incompatível</div>
              <p className="text-muted-foreground">
                Sua chave começa com <code className="font-mono">lovc_</code> (gateway) mas o servidor
                chama <code className="font-mono">api.firecrawl.dev</code> diretamente. Reconecte o
                conector com uma chave <code className="font-mono">fc-*</code> ou peça migração para o gateway.
              </p>
            </div>
          </div>
        )}

        {/* Resumo por categoria */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Resumo cor="text-red-600" rotulo="Erros HTTP/rede" valor={comErro.length} />
          <Resumo cor="text-amber-600" rotulo="Shape inesperado" valor={shapeInesperado.length} />
          <Resumo cor="text-orange-600" rotulo="Retry esgotado" valor={retryEsgotado.length} />
          <Resumo cor="text-red-600" rotulo="Falhas no insert" valor={errosInsert.length} />
        </div>

        {/* Filtros */}
        {(comErro.length > 0 || shapeInesperado.length > 0 || errosInsert.length > 0) && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/20 p-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por cidade, termo, query ou mensagem…"
                className="h-8 pl-7 text-xs"
              />
            </div>
            <Select value={filtroTipo} onValueChange={(v) => setFiltroTipo(v as any)}>
              <SelectTrigger className="h-8 w-[190px] text-xs">
                <SelectValue placeholder="Tipo de falha" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                {(Object.keys(TIPO_LABEL) as TipoFalha[]).map((t) => (
                  <SelectItem key={t} value={t}>{TIPO_LABEL[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="h-8 w-[160px] text-xs">
                <SelectValue placeholder="Status HTTP" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {statusOptions.map((s) => (
                  <SelectItem key={s} value={String(s)}>
                    {s} {HTTP_LABEL[s] ? `— ${HTTP_LABEL[s]}` : ""}
                  </SelectItem>
                ))}
                {comErro.some((l) => l.status == null) && (
                  <SelectItem value="__none__">sem status (rede/JSON)</SelectItem>
                )}

              </SelectContent>
            </Select>
            <Select value={filtroRetryable} onValueChange={(v) => setFiltroRetryable(v as any)}>
              <SelectTrigger className="h-8 w-[150px] text-xs">
                <SelectValue placeholder="Retryable" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Retryable: todos</SelectItem>
                <SelectItem value="sim">Somente retryable</SelectItem>
                <SelectItem value="nao">Não retryable</SelectItem>
              </SelectContent>
            </Select>
            {temFiltroAtivo && (
              <>
                <Badge variant="outline" className="text-[10px]">
                  {comErroFiltrado.length + shapeFiltrado.length + errosInsertFiltrado.length} de{" "}
                  {comErro.length + shapeInesperado.length + errosInsert.length}
                </Badge>
                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={limparFiltros}>
                  <X className="h-3.5 w-3.5 mr-1" /> Limpar
                </Button>
              </>
            )}
          </div>
        )}



        {/* Falhas do insert */}
        {errosInsertFiltrado.length > 0 && (
          <div className="rounded-md border bg-muted/30 p-3">
            <div className="text-sm font-medium mb-1">
              Falhas ao salvar grupos
              {errosInsertFiltrado.length !== errosInsert.length && (
                <span className="text-muted-foreground font-normal"> ({errosInsertFiltrado.length} de {errosInsert.length})</span>
              )}
            </div>
            <ul className="text-xs font-mono text-muted-foreground space-y-1">
              {errosInsertFiltrado.map((e, i) => (
                <li key={i} className="break-all">• {e}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Shape inesperado */}
        {shapeFiltrado.length > 0 && (
          <div className="rounded-md border border-amber-300/60 bg-amber-50 dark:bg-amber-900/10 p-3">
            <div className="text-sm font-medium mb-1 flex items-center gap-2">
              <FileWarning className="h-4 w-4 text-amber-600" />
              Resposta do Firecrawl sem <code className="font-mono">data.web</code> ({shapeFiltrado.length}
              {shapeFiltrado.length !== shapeInesperado.length ? ` de ${shapeInesperado.length}` : ""})
            </div>
            <p className="text-xs text-muted-foreground mb-2">
              O parser espera o campo <code className="font-mono">data.web[]</code> (Firecrawl v2). Consultas abaixo
              retornaram HTTP 200 mas sem essa chave — pode indicar mudança de contrato, plano sem acesso a Web, ou
              consulta genuinamente vazia.
            </p>
            <ul className="text-xs space-y-1">
              {shapeFiltrado.slice(0, 5).map((l, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="font-mono">{l.cidade}/{l.termo}</Badge>
                  <span className="text-muted-foreground">
                    shape recebido: <code className="font-mono">{l.response_shape?.join(", ") || "—"}</code>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Nenhum resultado após filtro */}
        {temFiltroAtivo && comErroFiltrado.length === 0 && shapeFiltrado.length === 0 && (
          <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
            Nenhum erro corresponde aos filtros aplicados.{" "}
            <button className="underline hover:text-foreground" onClick={limparFiltros}>Limpar filtros</button>
          </div>
        )}

        {/* Erros por query */}
        {comErroFiltrado.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium">
              Consultas com erro ({comErroFiltrado.length}
              {comErroFiltrado.length !== comErro.length ? ` de ${comErro.length}` : ""})
            </div>
            {comErroFiltrado.map((l, i) => {

              const cls = classificarErro(l);
              const aberto = !!abertos[i];
              return (
                <Collapsible key={i} open={aberto} onOpenChange={(v) => setAbertos((s) => ({ ...s, [i]: v }))}>
                  <div className="rounded-md border">
                    <CollapsibleTrigger className="w-full flex items-center gap-2 p-3 text-left hover:bg-muted/40">
                      {aberto ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                      <span className={`shrink-0 ${cls.cor}`}>{cls.icone}</span>
                      <span className="text-sm font-medium truncate flex-1">{cls.titulo}</span>
                      <Badge variant={httpBadgeVariant(l.status)} className="font-mono">
                        {l.status ?? "—"}
                      </Badge>
                      <Badge variant="outline" className="font-mono">
                        {l.cidade}/{l.termo}
                      </Badge>
                      {l.retry_esgotado && (
                        <Badge variant="destructive" className="text-[10px]">retry esgotado</Badge>
                      )}
                    </CollapsibleTrigger>
                    <CollapsibleContent className="border-t bg-muted/20 p-3 space-y-2 text-xs">
                      <div className="flex flex-wrap gap-3 text-muted-foreground">
                        <span>Duração: <span className="font-mono text-foreground">{l.duration_ms}ms</span></span>
                        <span>Tentativas: <span className="font-mono text-foreground">{l.tentativas ?? 1}</span></span>
                        <span>Retries: <span className="font-mono text-foreground">{l.retries ?? 0}</span></span>
                        <span>Retry total: <span className="font-mono text-foreground">{l.retry_total_ms ?? l.duration_ms}ms</span></span>
                      </div>
                      <div>
                        <div className="text-muted-foreground mb-1">Query enviada</div>
                        <div className="flex items-start gap-2">
                          <code className="font-mono bg-background border rounded px-2 py-1 flex-1 break-all">
                            {l.query}
                          </code>
                          <Button size="sm" variant="ghost" onClick={() => copiar(l.query)} className="h-7">
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground mb-1">Mensagem crua</div>
                        <code className="font-mono bg-background border rounded px-2 py-1 block break-all">
                          {l.error ?? "—"}
                        </code>
                      </div>
                      {l.body_preview && (
                        <div>
                          <div className="text-muted-foreground mb-1">Preview do corpo (300 chars)</div>
                          <pre className="font-mono bg-background border rounded px-2 py-1 whitespace-pre-wrap break-all max-h-48 overflow-auto">
{l.body_preview}
                          </pre>
                        </div>
                      )}
                      {l.retry_attempts && l.retry_attempts.length > 0 && (
                        <div>
                          <div className="text-muted-foreground mb-1">Histórico de tentativas</div>
                          <div className="rounded border overflow-hidden">
                            <table className="w-full text-[11px]">
                              <thead className="bg-muted/40">
                                <tr className="text-left">
                                  <th className="px-2 py-1">#</th>
                                  <th className="px-2 py-1">HTTP</th>
                                  <th className="px-2 py-1">Duração</th>
                                  <th className="px-2 py-1">Backoff</th>
                                  <th className="px-2 py-1">Retryable</th>
                                  <th className="px-2 py-1">Erro</th>
                                </tr>
                              </thead>
                              <tbody>
                                {l.retry_attempts.map((a) => (
                                  <tr key={a.tentativa} className="border-t">
                                    <td className="px-2 py-1 font-mono">{a.tentativa}</td>
                                    <td className="px-2 py-1 font-mono">{a.status ?? "—"}</td>
                                    <td className="px-2 py-1 font-mono">{a.duration_ms}ms</td>
                                    <td className="px-2 py-1 font-mono">{a.backoff_ms}ms</td>
                                    <td className="px-2 py-1">
                                      {a.retryable ? (
                                        <Badge variant="outline" className="text-[10px]">sim</Badge>
                                      ) : (
                                        <span className="text-muted-foreground">não</span>
                                      )}
                                    </td>
                                    <td className="px-2 py-1 font-mono truncate max-w-[220px]" title={a.error ?? ""}>
                                      {a.error ?? <CheckCircle2 className="h-3 w-3 inline text-green-600" />}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Resumo({ cor, rotulo, valor }: { cor: string; rotulo: string; valor: number }) {
  return (
    <div className="rounded-md border p-2">
      <div className={`text-lg font-semibold ${valor > 0 ? cor : "text-muted-foreground"}`}>{valor}</div>
      <div className="text-[11px] text-muted-foreground">{rotulo}</div>
    </div>
  );
}
