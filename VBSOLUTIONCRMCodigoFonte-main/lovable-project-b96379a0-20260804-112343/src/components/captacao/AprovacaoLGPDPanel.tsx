import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ExternalLink, ShieldCheck, ShieldX, Eye, Loader2, ChevronDown, ChevronUp, ShieldAlert } from "lucide-react";
import { StatusRevisaoBadge } from "./StatusRevisaoBadge";
import {
  useCandidatosPendentes,
  useFontesCandidato,
  useDecidirCandidato,
  type CandidatoAprovacao,
} from "@/hooks/useAprovacaoLGPD";

const CHECKLIST = [
  { key: "url", label: "URL pública e acessível sem login" },
  { key: "trecho", label: "Trecho da fonte confere com o dado capturado" },
  { key: "allowlist", label: "Portal está na allowlist autorizada" },
  { key: "sensivel", label: "Nenhum dado sensível (CPF, saúde, etc.) foi capturado" },
];

function CandidatoRow({ c, onAfter }: { c: CandidatoAprovacao; onAfter?: () => void }) {
  const [open, setOpen] = useState(false);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [motivo, setMotivo] = useState("");
  const fontesQ = useFontesCandidato(open ? c.id : null);
  const decidir = useDecidirCandidato();

  const allChecked = CHECKLIST.every(i => checks[i.key]);
  const podeAprovar = allChecked && (fontesQ.data?.length ?? 0) > 0;

  const decide = async (dec: "aprovado" | "rejeitado" | "em_revisao") => {
    await decidir.mutateAsync({ id: c.id, decisao: dec, motivo });
    setChecks({});
    setMotivo("");
    setOpen(false);
    onAfter?.();
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between p-3 gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium truncate">{c.nome_proprietario || "(sem nome)"}</span>
            <StatusRevisaoBadge status={c.status_revisao} />
            <span className="text-xs text-muted-foreground">{c.operacao}</span>
          </div>
          <div className="text-xs text-muted-foreground truncate">
            {[c.bairro, c.cidade].filter(Boolean).join(" · ")}
            {c.titulo_imovel ? ` · ${c.titulo_imovel}` : ""}
          </div>
          {c.rejeitado_motivo && (
            <div className="text-xs text-red-600 mt-1">Motivo: {c.rejeitado_motivo}</div>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={() => setOpen(o => !o)}>
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          Dossiê
        </Button>
      </div>

      {open && (
        <div className="border-t bg-muted/30 p-3 space-y-3">
          <div>
            <div className="text-xs font-semibold uppercase text-muted-foreground mb-2">Fontes públicas</div>
            {fontesQ.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" /> carregando fontes…
              </div>
            ) : (fontesQ.data?.length ?? 0) === 0 ? (
              <Alert variant="destructive">
                <ShieldAlert className="w-4 h-4" />
                <AlertDescription>
                  Nenhuma fonte registrada. Aprovar sem fonte violaria a rastreabilidade LGPD.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-2">
                {fontesQ.data!.map(f => (
                  <div key={f.id} className="text-xs border rounded p-2 bg-background">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">
                        {f.campo}: <span className="font-normal">{f.valor_capturado ?? "—"}</span>
                      </span>
                      <a
                        href={f.fonte_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary inline-flex items-center gap-1 hover:underline"
                      >
                        <ExternalLink className="w-3 h-3" />
                        {f.fonte_tipo}
                      </a>
                    </div>
                    {f.fonte_snippet && (
                      <blockquote className="mt-1 pl-2 border-l-2 border-muted-foreground/30 italic text-muted-foreground">
                        “{f.fonte_snippet}”
                      </blockquote>
                    )}
                    <div className="mt-1 text-[10px] text-muted-foreground">Base legal: {f.base_legal}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="text-xs font-semibold uppercase text-muted-foreground mb-2">Checklist do revisor</div>
            <div className="space-y-1.5">
              {CHECKLIST.map(i => (
                <label key={i.key} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={!!checks[i.key]}
                    onCheckedChange={v => setChecks(prev => ({ ...prev, [i.key]: !!v }))}
                  />
                  {i.label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs">Motivo (obrigatório se rejeitar)</Label>
            <Textarea
              rows={2}
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              placeholder="Ex.: URL retorna 404 / snippet não corresponde ao anúncio…"
            />
          </div>

          <div className="flex flex-wrap gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              disabled={decidir.isPending}
              onClick={() => decide("em_revisao")}
            >
              <Eye className="w-4 h-4 mr-1" /> Em revisão
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={decidir.isPending || motivo.trim().length < 3}
              onClick={() => decide("rejeitado")}
            >
              <ShieldX className="w-4 h-4 mr-1" /> Rejeitar
            </Button>
            <Button
              size="sm"
              disabled={decidir.isPending || !podeAprovar}
              onClick={() => decide("aprovado")}
              title={!podeAprovar ? "Marque todo o checklist e tenha ao menos uma fonte" : ""}
            >
              <ShieldCheck className="w-4 h-4 mr-1" /> Aprovar e liberar contato
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AprovacaoLGPDPanel() {
  const [tab, setTab] = useState<"pendente" | "em_revisao" | "aprovado" | "rejeitado">("pendente");
  const q = useCandidatosPendentes(tab);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-primary" />
          Aprovação LGPD do Pipeline de Captação
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Nenhum contato (WhatsApp, e-mail ou follow-up) pode ser enviado a um candidato
          até que a fonte pública e o trecho sejam validados por um revisor autorizado.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={tab} onValueChange={v => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="pendente">Pendentes</TabsTrigger>
            <TabsTrigger value="em_revisao">Em revisão</TabsTrigger>
            <TabsTrigger value="aprovado">Aprovados</TabsTrigger>
            <TabsTrigger value="rejeitado">Rejeitados</TabsTrigger>
          </TabsList>
          <TabsContent value={tab} className="mt-4">
            {q.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> carregando…
              </div>
            ) : (q.data?.length ?? 0) === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center">
                Nenhum candidato nesta aba.
              </div>
            ) : (
              <div className="space-y-2">
                {q.data!.map(c => <CandidatoRow key={c.id} c={c} />)}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
