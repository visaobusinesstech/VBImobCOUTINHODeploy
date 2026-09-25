import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Loader2, Check, Pencil, X, RefreshCw, Wand2, Info } from "lucide-react";
import { toast } from "sonner";
import type { SasFormData } from "./SasAvaliacaoForm";

type Tom = "profissional" | "acolhedor" | "tecnico" | "publicitario";

interface Props {
  data: SasFormData;
  onAceitar: (novaDescricao: string) => void;
  disabled?: boolean;
}

interface Resposta {
  descricao_otimizada: string;
  resumo_mudancas: string[];
  topicos_adicionados: string[];
  avisos: string[];
}

export function OtimizarDescricaoIA({ data, onAceitar, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tom, setTom] = useState<Tom>("profissional");
  const [resposta, setResposta] = useState<Resposta | null>(null);
  const [editado, setEditado] = useState("");
  const [modoEdicao, setModoEdicao] = useState(false);

  const podeUsar = (data.descricao || "").trim().length >= 10;

  async function invocar() {
    setLoading(true);
    setResposta(null);
    try {
      const imovel = {
        tipo: data.tipo, operacao: data.operacao,
        bairro: data.bairro, cidade: data.cidade, estado: data.estado, endereco: data.endereco,
        area_privativa: data.area_privativa, area_util: data.area_util,
        area_construida: data.area_construida, area_total: data.area_total, area_terreno: data.area_terreno,
        quartos: data.quartos, suites: data.suites, banheiros: data.banheiros, lavabos: data.lavabos,
        vagas: data.vagas, andar: data.andar, ano_construcao: data.ano_construcao,
        estado_conservacao: data.estado_conservacao, posicao_solar: data.posicao_solar,
        elevador: data.elevador, vista_livre: data.vista_livre, vista_permanente: data.vista_permanente,
        mobiliado: data.mobiliado, reformado: data.reformado,
        preco: data.preco, valor_condominio: data.valor_condominio, valor_iptu: data.valor_iptu,
        valor_taxa_extra: data.valor_taxa_extra, taxa_extra_descricao: data.taxa_extra_descricao,
      };
      const { data: res, error } = await supabase.functions.invoke("otimizar-avaliacao-ia", {
        body: { descricao_original: data.descricao, imovel, tom },
      });
      if (error) throw error;
      if ((res as { error?: string })?.error) throw new Error((res as { error: string }).error);
      const r = res as Resposta;
      setResposta(r);
      setEditado(r.descricao_otimizada);
      setModoEdicao(false);
    } catch (e) {
      toast.error(`Falha ao otimizar: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  function abrir() {
    if (!podeUsar) {
      toast.info("Escreva ao menos 10 caracteres na descrição antes de otimizar.");
      return;
    }
    setOpen(true);
    setResposta(null);
    setEditado("");
    setModoEdicao(false);
    void invocar();
  }

  function aceitar() {
    const texto = (modoEdicao ? editado : resposta?.descricao_otimizada || "").trim();
    if (!texto) return;
    onAceitar(texto.slice(0, 2000));
    toast.success("Descrição otimizada aplicada ao formulário.");
    setOpen(false);
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={abrir}
        disabled={disabled || !podeUsar}
        className="gap-1.5"
      >
        <Sparkles className="w-3.5 h-3.5 text-primary" />
        Otimizar com IA
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-primary" /> Refinar descrição com ChatGPT
            </DialogTitle>
            <DialogDescription>
              A IA reescreve sua descrição usando os dados estruturados do imóvel, sem inventar fatos.
              Você pode aceitar, editar antes de aplicar ou descartar.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap items-center gap-2 pb-2 border-b">
            <span className="text-xs text-muted-foreground">Tom:</span>
            <Select value={tom} onValueChange={(v) => setTom(v as Tom)}>
              <SelectTrigger className="w-44 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="profissional">Profissional (padrão)</SelectItem>
                <SelectItem value="acolhedor">Acolhedor / familiar</SelectItem>
                <SelectItem value="tecnico">Técnico / laudo</SelectItem>
                <SelectItem value="publicitario">Comercial / anúncio</SelectItem>
              </SelectContent>
            </Select>
            <Button type="button" size="sm" variant="ghost" onClick={invocar} disabled={loading} className="ml-auto gap-1.5">
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Gerar novamente
            </Button>
          </div>

          <div className="grid md:grid-cols-2 gap-4 pt-2">
            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-1.5">Original</div>
              <div className="rounded-md border bg-muted/30 p-3 text-xs leading-relaxed whitespace-pre-wrap max-h-[340px] overflow-y-auto">
                {data.descricao || <em className="text-muted-foreground">— vazio —</em>}
              </div>
              <div className="text-[10px] text-muted-foreground mt-1">{data.descricao.length} caracteres</div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-primary flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Sugestão da IA
                </span>
                {resposta && !modoEdicao && (
                  <Button type="button" size="sm" variant="ghost" onClick={() => setModoEdicao(true)} className="h-6 text-[11px] gap-1">
                    <Pencil className="w-3 h-3" /> Editar
                  </Button>
                )}
              </div>

              {loading && (
                <div className="rounded-md border border-dashed p-6 text-center text-xs text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin mx-auto mb-2" />
                  Reescrevendo com base nos dados do imóvel…
                </div>
              )}

              {!loading && resposta && !modoEdicao && (
                <div className="rounded-md border bg-primary/5 p-3 text-xs leading-relaxed whitespace-pre-wrap max-h-[340px] overflow-y-auto">
                  {resposta.descricao_otimizada}
                </div>
              )}

              {!loading && resposta && modoEdicao && (
                <Textarea
                  value={editado}
                  onChange={(e) => setEditado(e.target.value.slice(0, 2000))}
                  rows={14}
                  className="text-xs leading-relaxed"
                />
              )}

              {resposta && (
                <div className="text-[10px] text-muted-foreground mt-1">
                  {(modoEdicao ? editado : resposta.descricao_otimizada).length} caracteres
                </div>
              )}
            </div>
          </div>

          {resposta && (resposta.resumo_mudancas.length > 0 || resposta.topicos_adicionados.length > 0 || resposta.avisos.length > 0) && (
            <div className="rounded-md border bg-muted/30 p-3 space-y-2 text-xs">
              {resposta.resumo_mudancas.length > 0 && (
                <div>
                  <div className="font-semibold mb-1 flex items-center gap-1"><Check className="w-3 h-3 text-emerald-600" /> O que mudou</div>
                  <ul className="list-disc pl-5 space-y-0.5 text-muted-foreground">
                    {resposta.resumo_mudancas.map((m, i) => <li key={i}>{m}</li>)}
                  </ul>
                </div>
              )}
              {resposta.topicos_adicionados.length > 0 && (
                <div className="flex flex-wrap gap-1 items-center">
                  <span className="font-semibold">Dados usados:</span>
                  {resposta.topicos_adicionados.map((t, i) => <Badge key={i} variant="secondary" className="text-[10px]">{t}</Badge>)}
                </div>
              )}
              {resposta.avisos.length > 0 && (
                <div className="flex items-start gap-1.5 text-amber-700 dark:text-amber-400">
                  <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-semibold">Avisos</div>
                    <ul className="list-disc pl-5 space-y-0.5">
                      {resposta.avisos.map((a, i) => <li key={i}>{a}</li>)}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              <X className="w-4 h-4 mr-1" /> Descartar sugestão
            </Button>
            <Button type="button" onClick={aceitar} disabled={loading || !resposta}>
              <Check className="w-4 h-4 mr-1" /> {modoEdicao ? "Aplicar texto editado" : "Aceitar sugestão"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
