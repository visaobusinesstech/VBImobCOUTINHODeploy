import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Radar, MessageCircle, ExternalLink, Loader2, Clock, CheckCircle2, Copy, Users, MapPin, FileText, ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pipelineId: string;
  dados: Record<string, any> | null | undefined;
};

const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString("pt-BR") : "—");
const brl = (n?: number | null) =>
  typeof n === "number" ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n) : "—";

export default function RadarZapAuditoriaDialog({ open, onOpenChange, pipelineId, dados }: Props) {
  const [loading, setLoading] = useState(true);
  const [lead, setLead] = useState<any>(null);
  const [mensagem, setMensagem] = useState<any>(null);
  const [grupo, setGrupo] = useState<any>(null);
  const [duplicados, setDuplicados] = useState<any[]>([]);
  const [atividades, setAtividades] = useState<any[]>([]);
  const [historico, setHistorico] = useState<any[]>([]);

  useEffect(() => {
    if (!open || !pipelineId) return;
    (async () => {
      setLoading(true);
      const leadId = dados?.radarzap_lead_id as string | undefined;
      const msgIdHint = dados?.radarzap_mensagem_id as string | undefined;

      const [{ data: leadRow }, { data: acts }, { data: hist }] = await Promise.all([
        leadId
          ? supabase.from("radarzap_leads").select("*").eq("id", leadId).maybeSingle()
          : Promise.resolve({ data: null } as any),
        supabase
          .from("captacao_pipeline_atividades")
          .select("id, tipo, descricao, data_atividade, metadata, created_at")
          .eq("pipeline_id", pipelineId)
          .order("data_atividade", { ascending: false })
          .limit(50),
        supabase
          .from("captacao_pipeline_historico")
          .select("id, de_estagio, para_estagio, duracao_horas, created_at, metadata")
          .eq("pipeline_id", pipelineId)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

      setLead(leadRow ?? null);
      setAtividades(acts ?? []);
      setHistorico(hist ?? []);

      const msgId = leadRow?.mensagem_id ?? msgIdHint ?? null;
      const grupoId = leadRow?.grupo_id ?? null;

      const [{ data: msg }, { data: grp }] = await Promise.all([
        msgId
          ? supabase.from("radarzap_mensagens").select("*").eq("id", msgId).maybeSingle()
          : Promise.resolve({ data: null } as any),
        grupoId
          ? supabase.from("radarzap_grupos").select("*").eq("id", grupoId).maybeSingle()
          : Promise.resolve({ data: null } as any),
      ]);
      setMensagem(msg ?? null);
      setGrupo(grp ?? null);

      // Buscar duplicados agrupados
      if (leadRow?.dedup_group_id) {
        const { data: dup } = await supabase
          .from("radarzap_leads")
          .select("id, created_at, contato, proprietario_nome, preco, is_principal, score, status, grupo_id")
          .eq("dedup_group_id", leadRow.dedup_group_id)
          .order("created_at", { ascending: true });
        setDuplicados((dup ?? []).filter((d) => d.id !== leadRow.id));
      } else {
        setDuplicados([]);
      }

      setLoading(false);
    })();
  }, [open, pipelineId, dados]);

  const grupoNome = grupo?.nome ?? (dados?.origem_grupo_nome as string | undefined);
  const grupoLink = grupo?.invite_url ?? (dados?.origem_grupo_link as string | undefined);
  const cidade = grupo?.cidade ?? (dados?.origem_grupo_cidade as string | undefined);
  const uf = grupo?.uf ?? (dados?.origem_grupo_uf as string | undefined);
  const bairro = grupo?.bairro ?? (dados?.origem_grupo_bairro as string | undefined);
  const categoria = grupo?.categoria ?? (dados?.origem_grupo_categoria as string | undefined);

  const copy = (t: string) => {
    navigator.clipboard.writeText(t);
    toast.success("Copiado");
  };

  const timeline: { at: string; icon: any; label: string; hint?: string }[] = [];
  if (mensagem?.data_mensagem) timeline.push({ at: mensagem.data_mensagem, icon: MessageCircle, label: "Mensagem publicada no grupo", hint: grupoNome });
  if (lead?.created_at) timeline.push({ at: lead.created_at, icon: Radar, label: "Sinal capturado pelo RadarZAP", hint: `Score ${lead.score ?? "—"}` });
  if (lead?.aprovado_em) timeline.push({ at: lead.aprovado_em, icon: CheckCircle2, label: "Lead aprovado na revisão", hint: lead.revisao_notas ?? undefined });
  if (dados?.origem_mensagem_em) timeline.push({ at: dados.origem_mensagem_em, icon: FileText, label: "Card criado no pipeline" });
  historico.forEach((h) =>
    timeline.push({
      at: h.created_at,
      icon: ArrowRightLeft,
      label: `Movido: ${h.de_estagio ?? "—"} → ${h.para_estagio}`,
      hint: h.duracao_horas ? `${Math.round(Number(h.duracao_horas))}h no estágio` : undefined,
    }),
  );
  atividades.forEach((a) =>
    timeline.push({ at: a.data_atividade ?? a.created_at, icon: Clock, label: a.tipo ?? "Atividade", hint: a.descricao ?? undefined }),
  );
  timeline.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  // Duplicados também vindos do trigger de dedup no card (dados.radarzap_duplicados)
  const dupsCard = (dados?.radarzap_duplicados as any[] | undefined) ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Radar className="w-4 h-4 text-primary" /> Rastreabilidade RadarZAP
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin inline mr-2" />Carregando auditoria…
          </div>
        ) : (
          <ScrollArea className="flex-1 pr-3">
            <div className="space-y-4">
              {/* Origem: Grupo */}
              <section className="rounded-md border p-3">
                <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" /> GRUPO DE ORIGEM
                </div>
                {grupoNome ? (
                  <div className="space-y-1">
                    <div className="flex items-center flex-wrap gap-2">
                      <div className="font-medium">{grupoNome}</div>
                      {categoria && <Badge variant="outline" className="text-[10px]">{categoria}</Badge>}
                      {grupo?.status && <Badge variant="secondary" className="text-[10px]">{grupo.status}</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1 flex-wrap">
                      <MapPin className="w-3 h-3" />
                      {[bairro, cidade, uf].filter(Boolean).join(" · ") || "Localização não informada"}
                    </div>
                    {grupo?.total_mensagens != null && (
                      <div className="text-xs text-muted-foreground">
                        {grupo.total_mensagens} mensagens · {grupo.total_leads ?? 0} leads · último scan {fmt(grupo.ultimo_scan)}
                      </div>
                    )}
                    {grupoLink && (
                      <a href={grupoLink} target="_blank" rel="noopener noreferrer" className="text-xs text-primary inline-flex items-center gap-1 hover:underline">
                        <ExternalLink className="w-3 h-3" /> Abrir convite do grupo
                      </a>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">
                    Sem vínculo direto com grupo. Card criado manualmente ou fonte não RadarZAP.
                  </div>
                )}
              </section>

              {/* Mensagem original */}
              {mensagem && (
                <section className="rounded-md border p-3">
                  <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                    <MessageCircle className="w-3.5 h-3.5" /> MENSAGEM ORIGINAL · {fmt(mensagem.data_mensagem)}
                  </div>
                  <div className="rounded bg-muted/40 p-2 text-sm whitespace-pre-wrap max-h-52 overflow-auto">
                    {mensagem.texto ?? "—"}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    {mensagem.intencao && <Badge variant="outline">Intenção: {mensagem.intencao}</Badge>}
                    {mensagem.score_intencao != null && <Badge variant="secondary">Score msg: {mensagem.score_intencao}</Badge>}
                    {mensagem.autor_contato && (
                      <Badge variant="outline" className="cursor-pointer" onClick={() => copy(mensagem.autor_contato)}>
                        <Copy className="w-3 h-3 mr-1" /> {mensagem.autor_contato}
                      </Badge>
                    )}
                    {mensagem.autor_hash && (
                      <span className="text-muted-foreground font-mono text-[10px]">autor#{mensagem.autor_hash.slice(0, 10)}</span>
                    )}
                  </div>
                </section>
              )}

              {/* Lead extraído */}
              {lead && (
                <section className="rounded-md border p-3">
                  <div className="text-xs font-medium text-muted-foreground mb-2">DADOS EXTRAÍDOS DO LEAD</div>
                  <div className="grid md:grid-cols-3 gap-2 text-sm">
                    <div><span className="text-muted-foreground">Operação:</span> <Badge variant="secondary">{lead.operacao ?? "—"}</Badge></div>
                    <div><span className="text-muted-foreground">Tipo:</span> {lead.tipo_imovel ?? "—"}</div>
                    <div><span className="text-muted-foreground">Preço:</span> {brl(lead.preco)}</div>
                    <div><span className="text-muted-foreground">Bairro:</span> {lead.bairro ?? "—"}</div>
                    <div><span className="text-muted-foreground">Cidade:</span> {lead.cidade ?? "—"}</div>
                    <div><span className="text-muted-foreground">Contato:</span> {lead.contato ?? "—"}</div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant={lead.is_principal ? "default" : "outline"}>{lead.is_principal ? "Principal" : "Duplicado"}</Badge>
                    <Badge variant="secondary">Score {lead.score ?? "—"}</Badge>
                    <Badge variant="outline">Status: {lead.status}</Badge>
                    {lead.aprovado_em && <Badge variant="outline">Aprovado {fmt(lead.aprovado_em)}</Badge>}
                  </div>
                  {lead.score_detalhes && (
                    <details className="mt-2 text-xs">
                      <summary className="cursor-pointer text-muted-foreground">Ver breakdown do score</summary>
                      <pre className="mt-1 rounded bg-muted/40 p-2 overflow-auto max-h-40 text-[11px]">
{JSON.stringify(lead.score_detalhes, null, 2)}
                      </pre>
                    </details>
                  )}
                </section>
              )}

              {/* Duplicados */}
              {(duplicados.length > 0 || dupsCard.length > 0) && (
                <section className="rounded-md border p-3">
                  <div className="text-xs font-medium text-muted-foreground mb-2">
                    SINAIS DUPLICADOS ({duplicados.length + dupsCard.length})
                  </div>
                  <div className="space-y-1 max-h-52 overflow-auto">
                    {duplicados.map((d) => (
                      <div key={d.id} className="flex items-center gap-2 text-xs border-b py-1">
                        <span className="text-muted-foreground w-32 shrink-0">{fmt(d.created_at)}</span>
                        <span className="flex-1 truncate">{d.proprietario_nome ?? d.contato ?? "—"}</span>
                        <Badge variant="outline" className="text-[10px]">Score {d.score ?? "—"}</Badge>
                        <Badge variant="secondary" className="text-[10px]">{d.status}</Badge>
                      </div>
                    ))}
                    {dupsCard.map((d, i) => (
                      <div key={`c${i}`} className="flex items-center gap-2 text-xs border-b py-1">
                        <span className="text-muted-foreground w-32 shrink-0">{fmt(d.detectado_em ?? d.created_at)}</span>
                        <span className="flex-1 truncate">{d.motivo ?? "duplicidade detectada no card"}</span>
                        <Badge variant="outline" className="text-[10px]">RadarZAP</Badge>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Timeline unificada */}
              <section className="rounded-md border p-3">
                <div className="text-xs font-medium text-muted-foreground mb-2">TIMELINE DE AUDITORIA</div>
                {timeline.length === 0 ? (
                  <div className="text-xs text-muted-foreground">Sem eventos registrados.</div>
                ) : (
                  <ol className="relative border-l pl-4 space-y-3">
                    {timeline.map((t, i) => {
                      const Icon = t.icon;
                      return (
                        <li key={i} className="relative">
                          <span className="absolute -left-[22px] top-0.5 w-4 h-4 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
                            <Icon className="w-2.5 h-2.5 text-primary" />
                          </span>
                          <div className="text-xs text-muted-foreground">{fmt(t.at)}</div>
                          <div className="text-sm font-medium">{t.label}</div>
                          {t.hint && <div className="text-xs text-muted-foreground">{t.hint}</div>}
                        </li>
                      );
                    })}
                  </ol>
                )}
              </section>

              <Separator />
              <div className="text-[10px] text-muted-foreground font-mono">
                pipeline_id={pipelineId} · lead_id={lead?.id ?? "—"} · msg_id={mensagem?.id ?? "—"} · grupo_id={grupo?.id ?? "—"}
              </div>
            </div>
          </ScrollArea>
        )}

        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
