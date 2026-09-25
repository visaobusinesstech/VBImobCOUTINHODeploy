import { useState } from "react";
import { AlertCircle, Copy, ChevronDown, ChevronUp, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import type { FiltroIAErro } from "@/hooks/useFiltrarProprietariosIA";

const ERROR_HINTS: Record<string, string> = {
  no_ai_connected: "Conecte sua IA em Configurações → Configurar IA (BYOK) antes de filtrar.",
  invalid_provider_token: "A chave configurada foi rejeitada pelo provedor. Reabra Configurar IA e teste a conexão.",
  ai_parse_error: "A IA retornou um JSON inválido. Reduza o limite ou tente novamente em alguns segundos.",
  ai_timeout: "O provedor demorou demais para responder. Reduza o limite de candidatos e tente de novo.",
  ai_rate_limit: "Rate limit do provedor. Aguarde alguns segundos antes de reprocessar.",
  ai_quota_exceeded: "Créditos/quota do provedor esgotados. Verifique sua conta no provedor de IA.",
  db_error: "Falha ao carregar candidatos no banco. Recarregue a página e tente novamente.",
  unauthorized: "Sessão expirada. Faça login novamente.",
  invalid_session: "Sessão expirada. Faça login novamente.",
  invoke_error: "Não foi possível chamar a Edge Function. Verifique sua conexão.",
  unexpected_error: "Erro inesperado. Copie o ID da execução e o log para diagnóstico.",
};

export function FiltroIAErroAlert({ erro, onRetry }: { erro: FiltroIAErro; onRetry?: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const hint = erro.error_code ? ERROR_HINTS[erro.error_code] : undefined;
  const logLines = erro.log_excerpt ?? [];

  const copyDiagnostic = async () => {
    const bloco = [
      `IA Filtra — diagnóstico`,
      `run_id: ${erro.run_id ?? "—"}`,
      `error_code: ${erro.error_code ?? "—"}`,
      `status: ${erro.status ?? "—"}`,
      `duracao_ms: ${erro.duracao_ms ?? "—"}`,
      `mensagem: ${erro.message}`,
      erro.detalhe ? `detalhe: ${erro.detalhe}` : null,
      erro.preview ? `preview: ${erro.preview}` : null,
      erro.stack ? `stack:\n${erro.stack}` : null,
      logLines.length ? `log:\n${logLines.join("\n")}` : null,
    ]
      .filter(Boolean)
      .join("\n");
    try {
      await navigator.clipboard.writeText(bloco);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Diagnóstico copiado", description: "Cole no suporte para acelerar a análise." });
    } catch {
      toast({ title: "Não foi possível copiar", variant: "destructive" });
    }
  };

  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-destructive">IA Filtra falhou</span>
            {erro.error_code && (
              <Badge variant="outline" className="border-destructive/40 text-destructive text-[10px] uppercase tracking-wide">
                {erro.error_code}
              </Badge>
            )}
            {erro.status != null && (
              <Badge variant="outline" className="text-[10px]">HTTP {erro.status}</Badge>
            )}
            {erro.duracao_ms != null && (
              <span className="text-[11px] text-muted-foreground">· {erro.duracao_ms} ms</span>
            )}
          </div>
          <p className="text-sm text-foreground break-words">{erro.message}</p>
          {hint && <p className="text-xs text-muted-foreground">💡 {hint}</p>}
          {erro.run_id && (
            <p className="text-[11px] font-mono text-muted-foreground">
              run_id: <span className="text-foreground">{erro.run_id}</span>
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={copyDiagnostic} className="gap-1.5">
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? "Copiado" : "Copiar diagnóstico"}
        </Button>
        {(logLines.length > 0 || erro.stack || erro.preview) && (
          <Button size="sm" variant="ghost" onClick={() => setExpanded((v) => !v)} className="gap-1.5">
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {expanded ? "Ocultar log" : "Ver log da execução"}
          </Button>
        )}
        {onRetry && (
          <Button size="sm" onClick={onRetry} className="gap-1.5">
            Tentar novamente
          </Button>
        )}
      </div>

      {expanded && (
        <div className="space-y-2">
          {logLines.length > 0 && (
            <pre className="max-h-64 overflow-auto rounded-md bg-background border p-3 text-[11px] leading-relaxed font-mono whitespace-pre-wrap break-words">
              {logLines.join("\n")}
            </pre>
          )}
          {erro.preview && (
            <div>
              <div className="text-[11px] font-semibold text-muted-foreground mb-1">Resposta bruta da IA (preview)</div>
              <pre className="max-h-40 overflow-auto rounded-md bg-background border p-3 text-[11px] font-mono whitespace-pre-wrap break-words">
                {erro.preview}
              </pre>
            </div>
          )}
          {erro.stack && (
            <div>
              <div className="text-[11px] font-semibold text-muted-foreground mb-1">Stack</div>
              <pre className="max-h-40 overflow-auto rounded-md bg-background border p-3 text-[11px] font-mono whitespace-pre-wrap break-words">
                {erro.stack}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
