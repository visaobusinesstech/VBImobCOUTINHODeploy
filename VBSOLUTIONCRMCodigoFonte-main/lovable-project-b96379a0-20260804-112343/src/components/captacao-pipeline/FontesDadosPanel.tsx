import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ExternalLink, Loader2, ShieldCheck, FileDown } from "lucide-react";

type FonteRow = {
  id: string;
  campo: string;
  valor_capturado: string | null;
  fonte_url: string;
  fonte_tipo: string;
  fonte_titulo: string | null;
  fonte_snippet: string | null;
  base_legal: string;
  metodo_coleta: string;
  coletado_em: string;
  fonte_expirada: boolean;
  ativo: boolean;
};

const TIPO_LABEL: Record<string, string> = {
  portal_imobiliario: "Portal imobiliário",
  diario_oficial: "Diário Oficial",
  cartorio_ri: "Cartório de RI",
  site_institucional: "Site institucional",
  rede_social_publica: "Rede social pública",
  outra_publica: "Outra fonte pública",
};

const BASE_LABEL: Record<string, string> = {
  art7_iv_publico: "LGPD Art. 7º, IV (dado público)",
  art7_ix_legitimo_interesse: "LGPD Art. 7º, IX (legítimo interesse)",
};

/**
 * Painel que lista, campo a campo, a fonte pública original de cada dado
 * coletado do proprietário. Base para a auditoria LGPD do lead.
 */
export function FontesDadosPanel({
  leadTipo,
  leadId,
}: {
  leadTipo: "lista_proprietarios" | "pipeline";
  leadId: string;
}) {
  const [rows, setRows] = useState<FonteRow[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("captacao_fontes_dados" as any)
        .select("id,campo,valor_capturado,fonte_url,fonte_tipo,fonte_titulo,fonte_snippet,base_legal,metodo_coleta,coletado_em,fonte_expirada,ativo")
        .eq("lead_tipo", leadTipo)
        .eq("lead_id", leadId)
        .order("coletado_em", { ascending: false });
      if (!cancel) {
        if (error) console.error(error);
        setRows((data as any) ?? []);
        setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [leadTipo, leadId]);

  const exportar = () => {
    const linhas = [
      ["campo","valor","fonte_url","fonte_tipo","base_legal","metodo_coleta","coletado_em"].join(";"),
      ...(rows ?? []).map(r => [
        r.campo, JSON.stringify(r.valor_capturado ?? ""), r.fonte_url,
        TIPO_LABEL[r.fonte_tipo] ?? r.fonte_tipo,
        BASE_LABEL[r.base_legal] ?? r.base_legal,
        r.metodo_coleta, r.coletado_em,
      ].join(";")),
    ].join("\n");
    const blob = new Blob(["\uFEFF" + linhas], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `dossie-lgpd-${leadId.slice(0,8)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (loading) {
    return <div className="p-6 text-center text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Carregando fontes…</div>;
  }

  return (
    <div className="space-y-3">
      <Alert>
        <ShieldCheck className="w-4 h-4" />
        <AlertDescription className="text-xs">
          Cada dado abaixo foi coletado de fonte <b>pública</b> e está registrado com a URL, o trecho e a base legal (LGPD Art. 7º, IV — dados manifestamente públicos, ou IX — legítimo interesse). Use este dossiê para responder qualquer questionamento do titular.
        </AlertDescription>
      </Alert>

      {rows && rows.length > 0 ? (
        <>
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={exportar}>
              <FileDown className="w-4 h-4 mr-1" /> Exportar dossiê (CSV)
            </Button>
          </div>
          <ScrollArea className="max-h-[420px] rounded border">
            <div className="divide-y">
              {rows.map(r => (
                <div key={r.id} className="p-3 space-y-1 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium capitalize">{r.campo}</div>
                    <div className="flex items-center gap-1">
                      <Badge variant="secondary" className="text-[10px]">{TIPO_LABEL[r.fonte_tipo] ?? r.fonte_tipo}</Badge>
                      {r.fonte_expirada && <Badge variant="destructive" className="text-[10px]">fonte fora do ar</Badge>}
                      {!r.ativo && <Badge variant="outline" className="text-[10px]">inativa</Badge>}
                    </div>
                  </div>
                  {r.valor_capturado && (
                    <div className="text-xs text-muted-foreground">Valor: <span className="text-foreground">{r.valor_capturado}</span></div>
                  )}
                  {r.fonte_snippet && (
                    <div className="text-xs text-muted-foreground italic border-l-2 pl-2 line-clamp-2">"{r.fonte_snippet}"</div>
                  )}
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground pt-1">
                    <a href={r.fonte_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" /> Ver fonte original
                    </a>
                    <span>· {BASE_LABEL[r.base_legal] ?? r.base_legal}</span>
                    <span>· Coletado por {r.metodo_coleta} em {new Date(r.coletado_em).toLocaleString("pt-BR")}</span>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </>
      ) : (
        <div className="p-6 text-center text-sm text-muted-foreground border rounded">
          Nenhuma fonte pública registrada para este lead. <br />
          Enquanto não houver fonte para os campos críticos (nome, telefone, e-mail), o disparo automático fica bloqueado por precaução LGPD.
        </div>
      )}
    </div>
  );
}
