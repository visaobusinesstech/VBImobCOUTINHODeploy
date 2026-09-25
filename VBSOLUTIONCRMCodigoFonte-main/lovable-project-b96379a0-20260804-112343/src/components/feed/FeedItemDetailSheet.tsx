import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase as supabaseClient } from "@/integrations/supabase/client";
const supabase: any = supabaseClient;
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Loader2, ExternalLink, MessageCircle, Phone, Mail, MapPin,
  FileText, Home, UserPlus, CalendarDays, PenTool, Magnet, Copy,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

export type FeedKind = "post" | "lead" | "captacao" | "compromisso";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: FeedKind | null;
  rawId: string | null;
}

const KIND_LABEL: Record<FeedKind, string> = {
  post: "Post SEO",
  lead: "Lead",
  captacao: "Captação",
  compromisso: "Compromisso",
};

const KIND_ICON: Record<FeedKind, any> = {
  post: PenTool,
  lead: UserPlus,
  captacao: Magnet,
  compromisso: CalendarDays,
};

function formatDate(d?: string | null) {
  if (!d) return "—";
  try { return format(new Date(d), "dd 'de' MMM 'de' yyyy · HH:mm", { locale: ptBR }); }
  catch { return String(d); }
}

function copy(text: string, label = "Copiado") {
  navigator.clipboard.writeText(text).then(() => toast.success(label));
}

export function FeedItemDetailSheet({ open, onOpenChange, kind, rawId }: Props) {
  const [loading, setLoading] = useState(false);
  const [entity, setEntity] = useState<any>(null);
  const [history, setHistory] = useState<Array<{ at: string; text: string; badge?: string }>>([]);

  useEffect(() => {
    if (!open || !kind || !rawId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setEntity(null);
      setHistory([]);
      try {
        if (kind === "lead") {
          const [{ data: lead }, { data: ativ }, { data: fups }] = await Promise.all([
            supabase.from("leads").select("*").eq("id", rawId).maybeSingle(),
            supabase.from("lead_atividades").select("*").eq("lead_id", rawId).order("created_at", { ascending: false }).limit(20),
            supabase.from("followups").select("*").eq("lead_id", rawId).order("created_at", { ascending: false }).limit(20),
          ]);
          if (cancelled) return;
          setEntity(lead);
          const h: any[] = [];
          (ativ || []).forEach((a: any) => h.push({
            at: a.created_at, text: a.descricao || a.tipo || "Atividade", badge: a.tipo,
          }));
          (fups || []).forEach((f: any) => h.push({
            at: f.created_at, text: f.observacao || `Follow-up ${f.status || ""}`, badge: "follow-up",
          }));
          h.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
          setHistory(h);
        } else if (kind === "captacao") {
          const [{ data: cap }, { data: pipe }] = await Promise.all([
            supabase.from("captacoes").select("*").eq("id", rawId).maybeSingle(),
            supabase.from("captacao_pipeline_historico").select("*").eq("captacao_id", rawId).order("created_at", { ascending: false }).limit(20),
          ]);
          if (cancelled) return;
          setEntity(cap);
          setHistory((pipe || []).map((p: any) => ({
            at: p.created_at,
            text: `${p.estagio_de || "início"} → ${p.estagio_para || "atualizado"}${p.observacao ? " · " + p.observacao : ""}`,
            badge: "pipeline",
          })));
        } else if (kind === "compromisso") {
          const { data } = await supabase.from("compromissos").select("*").eq("id", rawId).maybeSingle();
          if (cancelled) return;
          setEntity(data);
        } else if (kind === "post") {
          const [{ data: post }, { data: versoes }] = await Promise.all([
            supabase.from("conteudos_seo").select("*").eq("id", rawId).maybeSingle(),
            supabase.from("conteudos_seo_versoes").select("*").eq("conteudo_id", rawId).order("created_at", { ascending: false }).limit(10),
          ]);
          if (cancelled) return;
          setEntity(post);
          setHistory((versoes || []).map((v: any) => ({
            at: v.created_at,
            text: `Versão salva: ${v.titulo || "sem título"}`,
            badge: "versão",
          })));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, kind, rawId]);

  if (!kind) return null;
  const Icon = KIND_ICON[kind];

  const title = entity
    ? (entity.titulo || entity.nome || entity.endereco_imovel || "Detalhes")
    : "Carregando…";

  const whatsappHref = (phone?: string | null, text = "") =>
    phone ? `https://wa.me/${String(phone).replace(/\D/g, "")}${text ? `?text=${encodeURIComponent(text)}` : ""}` : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg border bg-muted flex items-center justify-center">
              <Icon className="w-4 h-4" />
            </div>
            <div>
              <Badge variant="outline" className="text-xs">{KIND_LABEL[kind]}</Badge>
              <SheetTitle className="text-lg mt-1">{title}</SheetTitle>
              {entity?.created_at && (
                <SheetDescription>Criado em {formatDate(entity.created_at)}</SheetDescription>
              )}
            </div>
          </div>
        </SheetHeader>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : !entity ? (
          <p className="text-center text-muted-foreground py-16">Registro não encontrado ou sem permissão.</p>
        ) : (
          <div className="mt-6 space-y-6">
            {/* Detalhes por tipo */}
            {kind === "lead" && (
              <section className="space-y-2 text-sm">
                {entity.estagio && <div><span className="text-muted-foreground">Estágio:</span> <Badge variant="secondary">{entity.estagio}</Badge></div>}
                {entity.origem && <div><span className="text-muted-foreground">Origem:</span> {entity.origem}</div>}
                {entity.telefone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-muted-foreground" /> {entity.telefone}
                    <button onClick={() => copy(entity.telefone)} className="text-muted-foreground hover:text-foreground"><Copy className="w-3 h-3" /></button>
                  </div>
                )}
                {entity.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-muted-foreground" /> {entity.email}
                    <button onClick={() => copy(entity.email)} className="text-muted-foreground hover:text-foreground"><Copy className="w-3 h-3" /></button>
                  </div>
                )}
                {entity.interesse && <div><span className="text-muted-foreground">Interesse:</span> {entity.interesse}</div>}
                {entity.observacoes && <p className="text-muted-foreground whitespace-pre-wrap">{entity.observacoes}</p>}
              </section>
            )}

            {kind === "captacao" && (
              <section className="space-y-2 text-sm">
                {entity.tipo_imovel && <div><span className="text-muted-foreground">Tipo:</span> {entity.tipo_imovel}</div>}
                {(entity.cidade || entity.bairro || entity.endereco_imovel) && (
                  <div className="flex items-start gap-2">
                    <MapPin className="w-3.5 h-3.5 text-muted-foreground mt-0.5" />
                    <span>{[entity.endereco_imovel, entity.bairro, entity.cidade].filter(Boolean).join(", ")}</span>
                  </div>
                )}
                {entity.status && <div><span className="text-muted-foreground">Status:</span> <Badge variant="secondary">{entity.status}</Badge></div>}
                {entity.proprietario_nome && <div><span className="text-muted-foreground">Proprietário:</span> {entity.proprietario_nome}</div>}
                {entity.proprietario_telefone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-muted-foreground" /> {entity.proprietario_telefone}
                  </div>
                )}
              </section>
            )}

            {kind === "compromisso" && (
              <section className="space-y-2 text-sm">
                {entity.status && <div><span className="text-muted-foreground">Status:</span> <Badge variant="secondary">{entity.status}</Badge></div>}
                {entity.data_hora && <div><span className="text-muted-foreground">Quando:</span> {formatDate(entity.data_hora)}</div>}
                {entity.local && <div><span className="text-muted-foreground">Local:</span> {entity.local}</div>}
                {entity.descricao && <p className="text-muted-foreground whitespace-pre-wrap">{entity.descricao}</p>}
              </section>
            )}

            {kind === "post" && (
              <section className="space-y-2 text-sm">
                {entity.tipo && <div><span className="text-muted-foreground">Categoria:</span> <Badge variant="secondary">{entity.tipo}</Badge></div>}
                {entity.status && <div><span className="text-muted-foreground">Status:</span> <Badge variant="secondary">{entity.status}</Badge></div>}
                {(entity.cidade || entity.bairro) && <div><span className="text-muted-foreground">Local:</span> {[entity.bairro, entity.cidade].filter(Boolean).join(", ")}</div>}
                {entity.meta_description && <p className="text-muted-foreground">{entity.meta_description}</p>}
                {entity.slug && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-mono">/blog/{entity.slug}</span>
                    <button onClick={() => copy(`${window.location.origin}/blog/${entity.slug}`, "Link copiado")} className="hover:text-foreground"><Copy className="w-3 h-3" /></button>
                  </div>
                )}
              </section>
            )}

            <Separator />

            {/* Ações rápidas */}
            <section>
              <h3 className="text-sm font-medium mb-2">Ações rápidas</h3>
              <div className="flex flex-wrap gap-2">
                {kind === "lead" && (
                  <>
                    <Button asChild size="sm" variant="outline"><Link to="/pipeline"><UserPlus className="w-4 h-4 mr-1.5" /> Abrir no Pipeline</Link></Button>
                    {entity.telefone && (
                      <Button asChild size="sm" variant="outline">
                        <a href={whatsappHref(entity.telefone, `Olá ${entity.nome || ""}, tudo bem?`)!} target="_blank" rel="noreferrer">
                          <MessageCircle className="w-4 h-4 mr-1.5" /> WhatsApp
                        </a>
                      </Button>
                    )}
                    {entity.email && (
                      <Button asChild size="sm" variant="outline">
                        <a href={`mailto:${entity.email}`}><Mail className="w-4 h-4 mr-1.5" /> E-mail</a>
                      </Button>
                    )}
                    <Button asChild size="sm" variant="outline"><Link to="/agenda"><CalendarDays className="w-4 h-4 mr-1.5" /> Agendar</Link></Button>
                    <Button asChild size="sm" variant="outline"><Link to="/imoveis"><Home className="w-4 h-4 mr-1.5" /> Enviar imóveis</Link></Button>
                  </>
                )}
                {kind === "captacao" && (
                  <>
                    <Button asChild size="sm" variant="outline"><Link to="/captacao"><Magnet className="w-4 h-4 mr-1.5" /> Abrir Captação</Link></Button>
                    {entity.proprietario_telefone && (
                      <Button asChild size="sm" variant="outline">
                        <a href={whatsappHref(entity.proprietario_telefone)!} target="_blank" rel="noreferrer">
                          <MessageCircle className="w-4 h-4 mr-1.5" /> WhatsApp proprietário
                        </a>
                      </Button>
                    )}
                    <Button asChild size="sm" variant="outline"><Link to="/contratos"><FileText className="w-4 h-4 mr-1.5" /> Contratos</Link></Button>
                    <Button asChild size="sm" variant="outline"><Link to="/avaliacao"><Home className="w-4 h-4 mr-1.5" /> Avaliar imóvel</Link></Button>
                  </>
                )}
                {kind === "compromisso" && (
                  <Button asChild size="sm" variant="outline"><Link to="/agenda"><CalendarDays className="w-4 h-4 mr-1.5" /> Abrir na Agenda</Link></Button>
                )}
                {kind === "post" && (
                  <>
                    {entity.status === "publicado" && entity.slug && (
                      <Button asChild size="sm" variant="outline">
                        <Link to={`/blog/${entity.slug}`}><ExternalLink className="w-4 h-4 mr-1.5" /> Ver publicado</Link>
                      </Button>
                    )}
                    <Button asChild size="sm" variant="outline"><Link to="/conteudo-seo"><PenTool className="w-4 h-4 mr-1.5" /> Editar em Conteúdo SEO</Link></Button>
                  </>
                )}
              </div>
            </section>

            <Separator />

            {/* Histórico */}
            <section>
              <h3 className="text-sm font-medium mb-2">Histórico</h3>
              {history.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sem eventos registrados ainda.</p>
              ) : (
                <ol className="relative border-l pl-4 space-y-3">
                  {history.map((h, i) => (
                    <li key={i} className="relative">
                      <span className="absolute -left-[21px] top-1.5 w-2 h-2 rounded-full bg-primary" />
                      <div className="text-xs text-muted-foreground">{formatDate(h.at)}</div>
                      <div className="text-sm">
                        {h.badge && <Badge variant="outline" className="mr-2 text-[10px]">{h.badge}</Badge>}
                        {h.text}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
