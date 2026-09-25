import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type SourceTable = "contratos" | "contrato_anexos_anuais" | "contrato_comprovantes_mensais";

type ResolveRequest = {
  pathOrUrl?: string;
  contractId?: string | null;
  sourceTable?: SourceTable;
  sourceField?: string;
  recordId?: string | null;
};

const CONTRATO_FILE_FIELDS = new Set([
  "contrato_url",
  "contrato_anexo_url",
  "aditivo_anexo_url",
  "vistoria_anexo_url",
  "seguro_incendio_anexo_url",
  "seguro_fianca_anexo_url",
  "apolice_anexo_url",
  "caucao_comprovante_url",
  "vistoria_video_url",
  "fiador_matricula_url",
  "fiador_renda_url",
  "fiador2_matricula_url",
  "fiador2_renda_url",
  "comprovante_agua_url",
  "comprovante_luz_url",
]);

const STORAGE_MARKERS = [
  "/object/public/contratos/",
  "/object/sign/contratos/",
  "/object/authenticated/contratos/",
  "/storage/v1/object/public/contratos/",
  "/storage/v1/object/sign/contratos/",
  "/storage/v1/object/authenticated/contratos/",
  "/storage/v1/s3/contratos/",
];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function sanitizeReference(value: string) {
  const [withoutHash] = value.split("#");
  const [withoutQuery] = withoutHash.split("?");

  try {
    return decodeURIComponent(withoutQuery.trim());
  } catch {
    return withoutQuery.trim();
  }
}

function extractPathFromUrl(pathOrUrl: string) {
  if (!pathOrUrl) return "";

  const sanitized = sanitizeReference(pathOrUrl);

  if (sanitized.startsWith("private::")) {
    const parts = sanitized.split("::");
    if (parts.length >= 3) return parts.slice(2).join("::");
  }

  if (sanitized.startsWith("contratos/")) {
    return sanitized.slice("contratos/".length);
  }

  for (const marker of STORAGE_MARKERS) {
    const index = sanitized.indexOf(marker);
    if (index !== -1) {
      return sanitizeReference(sanitized.slice(index + marker.length));
    }
  }

  if (sanitized.startsWith("http") && sanitized.includes("/contratos/")) {
    const index = sanitized.indexOf("/contratos/");
    return sanitizeReference(sanitized.slice(index + "/contratos/".length));
  }

  return sanitized;
}

function sameFileReference(input: string, stored: string) {
  const inputValue = sanitizeReference(input);
  const storedValue = sanitizeReference(stored);
  const inputPath = extractPathFromUrl(input);
  const storedPath = extractPathFromUrl(stored);

  return (
    inputValue === storedValue ||
    (inputPath.length > 0 && inputPath === storedPath)
  );
}

async function canAccessContract(anonClient: ReturnType<typeof createClient>, contractId: string) {
  const { data, error } = await anonClient
    .from("contratos")
    .select("id")
    .eq("id", contractId)
    .single();

  return !error && !!data;
}

async function resolveStoredReference(
  anonClient: ReturnType<typeof createClient>,
  payload: Required<Pick<ResolveRequest, "sourceTable" | "recordId">> & Pick<ResolveRequest, "sourceField" | "contractId">,
) {
  if (payload.sourceTable === "contratos") {
    if (!payload.sourceField || !CONTRATO_FILE_FIELDS.has(payload.sourceField)) {
      return { ok: false as const, status: 400, error: "Campo de arquivo inválido." };
    }

    const { data, error } = await anonClient
      .from("contratos")
      .select(`id, ${payload.sourceField}`)
      .eq("id", payload.recordId)
      .single();

    if (error || !data) {
      return { ok: false as const, status: 403, error: "Acesso negado ao contrato." };
    }

    const storedValue = data[payload.sourceField];
    if (!storedValue || typeof storedValue !== "string") {
      return { ok: false as const, status: 404, error: "Arquivo não encontrado no contrato." };
    }

    return { ok: true as const, value: storedValue };
  }

  const { data, error } = await anonClient
    .from(payload.sourceTable)
    .select("id, contrato_id, arquivo_url")
    .eq("id", payload.recordId)
    .single();

  if (error || !data) {
    return { ok: false as const, status: 403, error: "Acesso negado ao anexo solicitado." };
  }

  if (payload.contractId && data.contrato_id !== payload.contractId) {
    return { ok: false as const, status: 403, error: "Contrato divergente para o arquivo solicitado." };
  }

  if (!data.arquivo_url || typeof data.arquivo_url !== "string") {
    return { ok: false as const, status: 404, error: "Arquivo não encontrado no registro." };
  }

  return { ok: true as const, value: data.arquivo_url };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autorizado" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const {
      pathOrUrl = "",
      contractId,
      sourceTable,
      sourceField,
      recordId,
    } = (await req.json()) as ResolveRequest;

    if (!pathOrUrl || typeof pathOrUrl !== "string") {
      return json({ error: "Arquivo não informado." }, 400);
    }

    const {
      data: { user },
      error: userError,
    } = await anonClient.auth.getUser();

    if (userError || !user) return json({ error: "Não autorizado" }, 401);

    let authorizedValue = pathOrUrl;

    if (sourceTable && recordId) {
      const resolved = await resolveStoredReference(anonClient, {
        sourceTable,
        recordId,
        sourceField,
        contractId,
      });

      if (!resolved.ok) {
        return json({ error: resolved.error }, resolved.status);
      }

      if (!sameFileReference(pathOrUrl, resolved.value)) {
        return json({ error: "Arquivo divergente do registro solicitado." }, 403);
      }

      authorizedValue = resolved.value;
    } else {
      const path = extractPathFromUrl(pathOrUrl);
      const contractFromPath = path.split("/")[0];
      const isLegacyPath = contractFromPath === "novo" || contractFromPath === "contratos";

      if (contractId) {
        if (!(await canAccessContract(anonClient, contractId))) {
          return json({ error: "Acesso negado ao contrato." }, 403);
        }
      } else if (!isLegacyPath && contractFromPath) {
        if (!(await canAccessContract(anonClient, contractFromPath))) {
          return json({ error: "Acesso negado ao contrato." }, 403);
        }
      } else {
        return json({ error: "Contexto do contrato obrigatório para este arquivo." }, 400);
      }
    }

    const resolvedPath = extractPathFromUrl(authorizedValue);
    if (!resolvedPath) {
      return json({ error: "Caminho do arquivo inválido." }, 400);
    }

    const { data, error } = await adminClient.storage
      .from("contratos")
      .createSignedUrl(resolvedPath, 3600);

    if (error || !data?.signedUrl) {
      console.error("resolve-contrato-file createSignedUrl error", { resolvedPath, error });
      return json({ error: "Arquivo não encontrado." }, 404);
    }

    return json({ signedUrl: data.signedUrl, path: resolvedPath });
  } catch (error) {
    console.error("resolve-contrato-file error", error);
    return json({ error: error instanceof Error ? error.message : "Erro interno" }, 500);
  }
});