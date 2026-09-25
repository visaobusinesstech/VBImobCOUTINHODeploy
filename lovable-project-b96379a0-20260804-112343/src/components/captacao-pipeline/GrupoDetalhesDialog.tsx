import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, ExternalLink, Radar, MessageSquare, MapPin } from "lucide-react";

type Grupo = {
  id: string;
  nome: string | null;
  categoria: string | null;
  cidade: string | null;
  uf: string | null;
  bairro: string | null;
  invite_url: string | null;
  descricao: string | null;
  status: string | null;
  total_mensagens: number | null;
  total_leads: number | null;
  ultimo_scan: string | null;
};

type MsgLead = {
  id: string;
  data_mensagem: string | null;
  intencao: string | null;
  score_intencao: number | null;
  texto: string;
  leads: { id: string; score: number | null; status: string | null; proprietario_nome: string | null; contato: string | null }[];
};

export default function GrupoDetalhesDialog({
  open,
  onOpenChange,
  hint,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  hint: { nome?: string | null; link?: string | null; cidade?: string | null; uf?: string | null; bairro?: string | null };
}) {
  const [loading, setLoading] = useState(false);
  const [grupo, setGrupo] = useState<Grupo | null>(null);
  const [msgs, setMsgs] = useState<MsgLead[]>([]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setGrupo(null);
      setMsgs([]);
      let g: Grupo | null = null;
      if (hint.link) {
        const { data } = await supabase.from("radarzap_grupos").select("*").eq("invite_url", hint.link).maybeSingle();
        if (data) g = data as Grupo;
      }
      if (!g && hint.nome) {
        const { data } = await supabase.from("radarzap_grupos").select("*").ilike("nome", hint.nome).limit(1).maybeSingle();
        if (data) g = data as Grupo;
      }
      if (cancelled) return;
      setGrupo(g);

      if (g?.id) {
        const { data: msgRows } = await supabase
          .from("radarzap_mensagens")
          .select("id, data_mensagem, intencao, score_intencao, texto, radarzap_leads(id, score, status, proprietario_nome, contato)")
          .eq("grupo_id", g.id)
          .order("data_mensagem", { ascending: false })
          .limit(50);
        if (!cancelled && msgRows) {
          const withLeads = (msgRows as any[])
            .map((r) => ({ ...r, leads: r.radarzap_leads ?? [] }))
            .filter((r) => r.leads.length > 0)
            .slice(0, 15);
          setMsgs(withLeads);
        }
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, hint.link, hint.nome]);

  const nome = grupo?.nome || hint.nome || "Grupo sem nome";
  const link = grupo?.invite_url || hint.link || null;
  const cidade = grupo?.cidade || hint.cidade || null;
  const uf = grupo?.uf || hint.uf || null;
  const bairro = grupo?.bairro || hint.bairro || null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Radar className="w-4 h-4 text-primary" /> {nome}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : (
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap gap-2">
              {grupo?.categoria && <Badge variant="secondary">{grupo.categoria}</Badge>}
              {grupo?.status && <Badge variant="outline">Status: {grupo.status}</Badge>}
              {(cidade || uf || bairro) && (
                <Badge variant="outline" className="gap-1">
                  <MapPin className="w-3 h-3" />
                  {[bairro, cidade, uf].filter(Boolean).join(" · ")}
                </Badge>
              )}
              {link && (
                <a href={link} target="_blank" rel="noopener noreferrer"
                   className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                  Abrir grupo <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            {grupo?.descricao && (
              <div className="text-xs text-muted-foreground border-l-2 pl-2">{grupo.descricao}</div>
            )}

            <div className="grid grid-cols-3 gap-2">
              <StatCard label="Mensagens" value={grupo?.total_mensagens ?? "—"} />
              <StatCard label="Leads gerados" value={grupo?.total_leads ?? "—"} />
              <StatCard
                label="Último scan"
                value={grupo?.ultimo_scan ? new Date(grupo.ultimo_scan).toLocaleDateString("pt-BR") : "—"}
              />
            </div>

            <div>
              <div className="text-xs font-semibold uppercase text-muted-foreground mb-2 flex items-center gap-1">
                <MessageSquare className="w-3 h-3" /> Últimas mensagens que geraram leads
              </div>
              {!grupo ? (
                <div className="text-xs text-muted-foreground italic">Grupo não localizado na base RadarZAP.</div>
              ) : msgs.length === 0 ? (
                <div className="text-xs text-muted-foreground italic">Nenhuma mensagem deste grupo gerou lead ainda.</div>
              ) : (
                <div className="space-y-2">
                  {msgs.map((m) => (
                    <div key={m.id} className="border rounded p-2 space-y-1">
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        {m.data_mensagem && <span>{new Date(m.data_mensagem).toLocaleString("pt-BR")}</span>}
                        {m.intencao && <Badge variant="secondary" className="text-[10px]">{m.intencao}</Badge>}
                        {typeof m.score_intencao === "number" && <span>· intenção {m.score_intencao}</span>}
                      </div>
                      <div className="text-xs whitespace-pre-wrap">{m.texto}</div>
                      <div className="flex flex-wrap gap-1 pt-1">
                        {m.leads.map((l) => (
                          <Badge key={l.id} variant="outline" className="text-[10px]">
                            {l.proprietario_nome || l.contato || "Lead"} · score {l.score ?? 0} · {l.status ?? "—"}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded border p-2 text-center">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}
