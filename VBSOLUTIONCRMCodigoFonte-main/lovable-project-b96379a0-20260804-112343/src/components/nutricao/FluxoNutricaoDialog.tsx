import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, FlaskConical, Info, Plus, Trash2 } from "lucide-react";
import {
  validarMensagemNutricao,
  type ResultadoValidacaoMensagem,
} from "@/lib/nutricaoValidacaoMensagem";
import type { EtapaInput, NutricaoEtapa, NutricaoFluxo } from "@/hooks/useNutricao";
import { usePipelineEstagios } from "@/hooks/usePipelineEstagios";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { MOTIVOS_PERDA_PADRAO, PERFIS_CLIENTE } from "@/lib/nutricaoSegmentacao";
import { GeradorMensagem } from "@/components/nutricao/GeradorMensagem";
import { useNutricaoPreview } from "@/hooks/useNutricaoPreview";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  fluxo?: NutricaoFluxo | null;
  etapas: NutricaoEtapa[];
  onSave: (fluxo: Partial<NutricaoFluxo> & { nome: string }, etapas: EtapaInput[], id?: string) => Promise<boolean>;
}

const etapaVazia = (ordem: number): EtapaInput => ({
  ordem,
  dias_apos: ordem === 1 ? 0 : 5,
  canal: "whatsapp",
  titulo: "",
  mensagem: "",
  ativo: true,
  ab_ativo: false,
  ab_titulo_b: "",
  ab_mensagem_b: "",
  ab_split: 50,
  ab_auto_escolher: true,
  ab_min_envios: 20,
});

function AvisosValidacao({
  resultado,
  rotulo,
}: {
  resultado: ResultadoValidacaoMensagem | null;
  rotulo?: string;
}) {
  if (!resultado || (resultado.erros.length === 0 && resultado.avisos.length === 0)) return null;
  return (
    <div className="space-y-1">
      {resultado.erros.map((p, i) => (
        <p key={`e${i}`} className="flex items-start gap-1 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            {rotulo ? `${rotulo}: ` : ""}
            {p.mensagem}
          </span>
        </p>
      ))}
      {resultado.avisos.map((p, i) => (
        <p key={`a${i}`} className="flex items-start gap-1 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            {rotulo ? `${rotulo}: ` : ""}
            {p.mensagem}
          </span>
        </p>
      ))}
    </div>
  );
}

function ChipToggle({
  ativo,
  onClick,
  children,
  title,
}: {
  ativo: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button type="button" onClick={onClick} title={title}>
      <Badge variant={ativo ? "default" : "outline"} className="cursor-pointer">
        {children}
      </Badge>
    </button>
  );
}


export function FluxoNutricaoDialog({ open, onOpenChange, fluxo, etapas, onSave }: Props) {
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [publicoAlvo, setPublicoAlvo] = useState("lead_inativo");
  const [dias, setDias] = useState(30);
  const [canal, setCanal] = useState("whatsapp");
  const [encerrar, setEncerrar] = useState(true);
  const [ativo, setAtivo] = useState(true);
  const [lista, setLista] = useState<EtapaInput[]>([etapaVazia(1)]);
  const [salvando, setSalvando] = useState(false);
  const [segEstagios, setSegEstagios] = useState<string[]>([]);
  const [segPerfis, setSegPerfis] = useState<string[]>([]);
  const [segMotivos, setSegMotivos] = useState<string[]>([]);
  const [motivosLead, setMotivosLead] = useState<string[]>([]);

  const { estagios } = usePipelineEstagios();
  const preview = useNutricaoPreview(open);
  const { imobiliariaId } = useAuth();

  useEffect(() => {
    if (!open || !imobiliariaId) return;
    let cancel = false;
    (async () => {
      const { data } = await supabase
        .from("leads")
        .select("motivo_perda")
        .eq("imobiliaria_id", imobiliariaId)
        .not("motivo_perda", "is", null)
        .limit(500);
      if (cancel) return;
      const vistos = new Set<string>();
      (data ?? []).forEach((l: { motivo_perda: string | null }) => {
        const v = (l.motivo_perda ?? "").trim();
        if (v) vistos.add(v);
      });
      setMotivosLead([...vistos]);
    })();
    return () => { cancel = true; };
  }, [open, imobiliariaId]);

  const opcoesMotivos = useMemo(() => {
    const set = new Set<string>([...MOTIVOS_PERDA_PADRAO, ...motivosLead, ...segMotivos]);
    return [...set];
  }, [motivosLead, segMotivos]);

  useEffect(() => {
    if (!open) return;
    setNome(fluxo?.nome ?? "");
    setDescricao(fluxo?.descricao ?? "");
    setPublicoAlvo(fluxo?.publico_alvo ?? "lead_inativo");
    setDias(fluxo?.dias_inatividade ?? 30);
    setCanal(fluxo?.canal ?? "whatsapp");
    setEncerrar(fluxo?.encerrar_ao_responder ?? true);
    setAtivo(fluxo?.ativo ?? true);
    setSegEstagios(fluxo?.segmento_estagios ?? []);
    setSegPerfis(fluxo?.segmento_perfis ?? []);
    setSegMotivos(fluxo?.segmento_motivos_perda ?? []);
    setLista(
      etapas.length > 0
        ? etapas.map((e) => ({
            ordem: e.ordem,
            dias_apos: e.dias_apos,
            canal: e.canal,
            titulo: e.titulo,
            mensagem: e.mensagem,
            ativo: e.ativo,
            ab_ativo: e.ab_ativo ?? false,
            ab_titulo_b: e.ab_titulo_b ?? "",
            ab_mensagem_b: e.ab_mensagem_b ?? "",
            ab_split: e.ab_split ?? 50,
            ab_auto_escolher: e.ab_auto_escolher ?? true,
            ab_min_envios: e.ab_min_envios ?? 20,
          }))
        : [etapaVazia(1)],
    );
  }, [open, fluxo, etapas]);

  const toggle = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    valor: string,
  ) => setter((prev) => (prev.includes(valor) ? prev.filter((v) => v !== valor) : [...prev, valor]));

  const atualizarEtapa = (idx: number, patch: Partial<EtapaInput>) =>
    setLista((prev) => prev.map((e, i) => (i === idx ? { ...e, ...patch } : e)));

  const validacoes = useMemo(
    () =>
      lista.map((etapa) => ({
        a: validarMensagemNutricao(etapa.mensagem, {
          titulo: etapa.titulo,
          canal: etapa.canal,
          contexto: preview.contexto,
        }),
        b: etapa.ab_ativo
          ? validarMensagemNutricao(etapa.ab_mensagem_b ?? "", {
              titulo: etapa.ab_titulo_b || etapa.titulo,
              canal: etapa.canal,
              contexto: preview.contexto,
            })
          : null,
      })),
    [lista, preview.contexto],
  );

  const totalErros = useMemo(
    () => validacoes.reduce((s, v) => s + v.a.erros.length + (v.b?.erros.length ?? 0), 0),
    [validacoes],
  );

  const salvar = async () => {
    if (!nome.trim() || totalErros > 0) return;
    setSalvando(true);
    const etapasValidas = lista
      .filter((e) => e.titulo.trim() && e.mensagem.trim())
      .map((e) => {
        const abOk = !!e.ab_ativo && !!(e.ab_mensagem_b ?? "").trim();
        return {
          ...e,
          ab_ativo: abOk,
          ab_titulo_b: abOk ? (e.ab_titulo_b || e.titulo) : null,
          ab_mensagem_b: abOk ? (e.ab_mensagem_b ?? "").trim() : null,
          ab_split: Math.min(95, Math.max(5, Number(e.ab_split ?? 50))),
          ab_min_envios: Math.max(1, Number(e.ab_min_envios ?? 20)),
          ab_auto_escolher: e.ab_auto_escolher !== false,
        };
      });
    const ok = await onSave(
      {
        nome: nome.trim(),
        descricao: descricao.trim() || null,
        publico_alvo: publicoAlvo,
        dias_inatividade: Number(dias) || 30,
        canal,
        encerrar_ao_responder: encerrar,
        ativo,
        segmento_estagios: segEstagios,
        segmento_perfis: segPerfis,
        segmento_motivos_perda: segMotivos,
      },
      etapasValidas,
      fluxo?.id,
    );
    setSalvando(false);
    if (ok) onOpenChange(false);
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{fluxo ? "Editar fluxo de nutrição" : "Novo fluxo de nutrição"}</DialogTitle>
          <DialogDescription>
            Defina o público, o gatilho de inatividade e a sequência de mensagens automáticas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Nome do fluxo</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Reativação 30 dias" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Descrição</Label>
              <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Público-alvo</Label>
              <Select value={publicoAlvo} onValueChange={setPublicoAlvo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="lead_inativo">Leads inativos</SelectItem>
                  <SelectItem value="lead_sem_resposta">Leads sem resposta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Dias sem interação para entrar</Label>
              <Input type="number" min={1} value={dias} onChange={(e) => setDias(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Canal padrão</Label>
              <Select value={canal} onValueChange={setCanal}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">Encerrar ao responder</p>
                <p className="text-xs text-muted-foreground">Para a sequência se o lead voltar a interagir</p>
              </div>
              <Switch checked={encerrar} onCheckedChange={setEncerrar} />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3 sm:col-span-2">
              <div>
                <p className="text-sm font-medium">Fluxo ativo</p>
                <p className="text-xs text-muted-foreground">Processa inscrições automaticamente</p>
              </div>
              <Switch checked={ativo} onCheckedChange={setAtivo} />
            </div>
          </div>

          <div className="space-y-4 rounded-md border p-3">
            <div>
              <Label className="text-base">Segmentação avançada</Label>
              <p className="text-xs text-muted-foreground">
                Sem seleção, o fluxo vale para todos os leads elegíveis. Cada filtro selecionado restringe a entrada.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase text-muted-foreground">Etapa do pipeline</Label>
              <div className="flex flex-wrap gap-2">
                {estagios.length === 0 && (
                  <span className="text-xs text-muted-foreground">Nenhuma etapa configurada no pipeline.</span>
                )}
                {estagios.map((e) => (
                  <ChipToggle
                    key={e.slug}
                    ativo={segEstagios.includes(e.slug)}
                    onClick={() => toggle(setSegEstagios, e.slug)}
                  >
                    {e.title}
                  </ChipToggle>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase text-muted-foreground">Perfil do cliente</Label>
              <div className="flex flex-wrap gap-2">
                {PERFIS_CLIENTE.map((p) => (
                  <ChipToggle
                    key={p.value}
                    ativo={segPerfis.includes(p.value)}
                    onClick={() => toggle(setSegPerfis, p.value)}
                    title={p.descricao}
                  >
                    {p.label}
                  </ChipToggle>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase text-muted-foreground">Motivo da perda</Label>
              <div className="flex flex-wrap gap-2">
                {opcoesMotivos.map((m) => (
                  <ChipToggle
                    key={m}
                    ativo={segMotivos.includes(m)}
                    onClick={() => toggle(setSegMotivos, m)}
                  >
                    {m}
                  </ChipToggle>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Ao selecionar um motivo de perda, leads perdidos passam a entrar no fluxo.
              </p>
            </div>
          </div>



          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base">Etapas da sequência</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setLista((prev) => [...prev, etapaVazia(prev.length + 1)])}
              >
                <Plus className="mr-1 h-4 w-4" /> Etapa
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Use o gerador de mensagens para inserir variáveis do lead e do imóvel (ex.:{" "}
              <code>{"{{primeiro_nome}}"}</code>, <code>{"{{imovel_resumo}}"}</code>) e pré-visualizar com dados reais.
            </p>

            {lista.map((etapa, idx) => (
              <Card key={idx} className="space-y-3 p-3">
                <div className="flex flex-wrap items-end gap-3">
                  <span className="rounded bg-muted px-2 py-1 text-xs font-medium">Etapa {idx + 1}</span>
                  <div className="w-28 space-y-1">
                    <Label className="text-xs">Dias após</Label>
                    <Input
                      type="number"
                      min={0}
                      value={etapa.dias_apos}
                      onChange={(e) => atualizarEtapa(idx, { dias_apos: Number(e.target.value) })}
                    />
                  </div>
                  <div className="w-36 space-y-1">
                    <Label className="text-xs">Canal</Label>
                    <Select value={etapa.canal} onValueChange={(v) => atualizarEtapa(idx, { canal: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="whatsapp">WhatsApp</SelectItem>
                        <SelectItem value="email">E-mail</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="min-w-[180px] flex-1 space-y-1">
                    <Label className="text-xs">Título</Label>
                    <Input
                      value={etapa.titulo}
                      onChange={(e) => atualizarEtapa(idx, { titulo: e.target.value })}
                      placeholder="Retomada leve"
                    />
                  </div>
                  {lista.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setLista((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
                {etapa.ab_ativo && (
                  <p className="text-xs font-medium text-muted-foreground">Variante A (original)</p>
                )}
                <GeradorMensagem
                  value={etapa.mensagem}
                  onChange={(v) => atualizarEtapa(idx, { mensagem: v })}
                  canal={etapa.canal === "email" ? "email" : "whatsapp"}
                  contexto={preview.contexto}
                  leads={preview.leads}
                  imoveis={preview.imoveis}
                  leadId={preview.leadId}
                  imovelId={preview.imovelId}
                  onLeadChange={preview.setLeadId}
                  onImovelChange={preview.setImovelId}
                />
                <AvisosValidacao
                  resultado={validacoes[idx]?.a ?? null}
                  rotulo={etapa.ab_ativo ? "Variante A" : undefined}
                />

                <div className="space-y-3 rounded-md border border-dashed p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <FlaskConical className="h-4 w-4 text-primary" />
                      <div>
                        <p className="text-sm font-medium">Teste A/B desta etapa</p>
                        <p className="text-xs text-muted-foreground">
                          Duas versões da mensagem são sorteadas entre os leads e comparadas por taxa de resposta.
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={!!etapa.ab_ativo}
                      onCheckedChange={(v) => atualizarEtapa(idx, { ab_ativo: v })}
                    />
                  </div>

                  {etapa.ab_ativo && (
                    <div className="space-y-3">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="space-y-1">
                          <Label className="text-xs">% para variante A</Label>
                          <Input
                            type="number"
                            min={5}
                            max={95}
                            value={etapa.ab_split ?? 50}
                            onChange={(e) => atualizarEtapa(idx, { ab_split: Number(e.target.value) })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Mín. envios por variante</Label>
                          <Input
                            type="number"
                            min={1}
                            value={etapa.ab_min_envios ?? 20}
                            onChange={(e) => atualizarEtapa(idx, { ab_min_envios: Number(e.target.value) })}
                          />
                        </div>
                        <div className="flex items-center justify-between gap-2 rounded-md border p-2">
                          <span className="text-xs">Escolher vencedor automaticamente</span>
                          <Switch
                            checked={etapa.ab_auto_escolher !== false}
                            onCheckedChange={(v) => atualizarEtapa(idx, { ab_auto_escolher: v })}
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Título da variante B</Label>
                        <Input
                          value={etapa.ab_titulo_b ?? ""}
                          onChange={(e) => atualizarEtapa(idx, { ab_titulo_b: e.target.value })}
                          placeholder={etapa.titulo || "Título alternativo"}
                        />
                      </div>

                      <p className="text-xs font-medium text-muted-foreground">Variante B (alternativa)</p>
                      <GeradorMensagem
                        value={etapa.ab_mensagem_b ?? ""}
                        onChange={(v) => atualizarEtapa(idx, { ab_mensagem_b: v })}
                        canal={etapa.canal === "email" ? "email" : "whatsapp"}
                        contexto={preview.contexto}
                        leads={preview.leads}
                        imoveis={preview.imoveis}
                        leadId={preview.leadId}
                        imovelId={preview.imovelId}
                        onLeadChange={preview.setLeadId}
                        onImovelChange={preview.setImovelId}
                      />
                      <AvisosValidacao resultado={validacoes[idx]?.b ?? null} rotulo="Variante B" />
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>

        <DialogFooter className="flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end">
          {totalErros > 0 && (
            <p className="flex items-center gap-1 text-xs text-destructive sm:mr-auto">
              <AlertTriangle className="h-4 w-4" />
              {totalErros} pendência(s) de validação impedem o envio das mensagens.
            </p>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando || !nome.trim() || totalErros > 0}>
            {salvando ? "Salvando..." : "Salvar fluxo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
