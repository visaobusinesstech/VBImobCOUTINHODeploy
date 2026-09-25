import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2, LinkIcon, Plus, Trash2, ExternalLink, AlertCircle,
  Pencil, Check, X, ArrowUp, ArrowDown, ListPlus,
} from "lucide-react";
import { validarLinkReferencia, processarLoteLinksReferencia } from "@/lib/avaliacao/normalizarLinkReferencia";


export type ModoReferencia = "sistema" | "links" | "ambos";

export interface ReferenciaLinkItem {
  id: string;
  titulo: string;
  preco: number;
  area: number;
  bairro?: string | null;
  url_anuncio?: string | null;
}

export interface ReferenciaLinkPatch {
  titulo: string;
  preco: number;
  area: number;
  bairro: string | null;
}

interface Props {
  modo: ModoReferencia;
  onModoChange: (m: ModoReferencia) => void;
  itens: ReferenciaLinkItem[];
  onAdd: (url: string) => Promise<void> | void;
  onAddLote?: (texto: string) => Promise<void> | void;
  onRemove: (id: string) => void;
  onEdit?: (id: string, patch: ReferenciaLinkPatch) => Promise<void> | void;
  onReorder?: (id: string, direcao: -1 | 1) => void;
  carregando?: boolean;
}

const formatBRL = (v: number) =>
  (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Converte texto pt-BR ("1.250,50") em número. */
const parseNumeroBR = (v: string): number => {
  const limpo = (v || "").replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(limpo);
  return Number.isFinite(n) ? n : NaN;
};

const OPCOES: { value: ModoReferencia; label: string; hint: string }[] = [
  { value: "sistema", label: "Referências do sistema", hint: "Carteira + base de mercado" },
  { value: "links", label: "Somente meus links", hint: "Apenas os anúncios que eu enviar" },
  { value: "ambos", label: "Sistema + meus links", hint: "Combina as duas fontes" },
];

/** Painel para escolher a origem das referências do laudo e enviar links de anúncios. */
export function ReferenciasLinkPanel({
  modo, onModoChange, itens, onAdd, onAddLote, onRemove, onEdit, onReorder, carregando,
}: Props) {
  const [url, setUrl] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [erroEdicao, setErroEdicao] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState({ titulo: "", preco: "", area: "", bairro: "" });
  const [lote, setLote] = useState("");
  const [loteAberto, setLoteAberto] = useState(false);

  const previaLote = useMemo(
    () => processarLoteLinksReferencia(lote, itens.map((i) => i.url_anuncio)),
    [lote, itens],
  );

  const iniciarEdicao = (i: ReferenciaLinkItem) => {
    setEditandoId(i.id);
    setErroEdicao(null);
    setRascunho({
      titulo: i.titulo || "",
      preco: String(i.preco ?? ""),
      area: String(i.area ?? ""),
      bairro: i.bairro || "",
    });
  };

  const cancelarEdicao = () => {
    setEditandoId(null);
    setErroEdicao(null);
  };

  const salvarEdicao = async () => {
    if (!editandoId || !onEdit) return;
    const titulo = rascunho.titulo.trim();
    const preco = parseNumeroBR(rascunho.preco);
    const area = parseNumeroBR(rascunho.area);
    if (!titulo) return setErroEdicao("Informe um título para a referência.");
    if (!Number.isFinite(preco) || preco <= 0) return setErroEdicao("Preço inválido. Use um valor maior que zero.");
    if (!Number.isFinite(area) || area <= 0) return setErroEdicao("Área inválida. Use um valor maior que zero.");
    await onEdit(editandoId, { titulo: titulo.slice(0, 200), preco, area, bairro: rascunho.bairro.trim() || null });
    cancelarEdicao();
  };



  const validacao = useMemo(
    () => (url.trim() ? validarLinkReferencia(url, itens.map((i) => i.url_anuncio)) : null),
    [url, itens],
  );
  const podeAdicionar = !!validacao?.ok;

  const handleAdd = async () => {
    if (carregando) return;
    const r = validarLinkReferencia(url, itens.map((i) => i.url_anuncio));
    if (!r.ok) {
      setErro(r.erro || "Link inválido.");
      return;
    }
    setErro(null);
    await onAdd(r.url!);
    setUrl("");
  };


  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <LinkIcon className="w-4 h-4 text-primary" />
          Referências do laudo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-3">
          {OPCOES.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => onModoChange(o.value)}
              className={`rounded-lg border p-3 text-left transition-colors ${
                modo === o.value
                  ? "border-primary bg-primary/10"
                  : "border-border bg-secondary hover:border-primary/50"
              }`}
            >
              <p className="text-sm font-medium">{o.label}</p>
              <p className="text-xs text-muted-foreground">{o.hint}</p>
            </button>
          ))}
        </div>

        {modo !== "sistema" && (
          <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setErro(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleAdd();
                  }
                }}
                placeholder="Cole o link do anúncio de referência (https://...)"
                maxLength={2048}
                inputMode="url"
                aria-invalid={!!(erro || (validacao && !validacao.ok))}
              />
              <Button onClick={handleAdd} disabled={!podeAdicionar || carregando} className="gap-2 sm:w-auto">
                {carregando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Adicionar
              </Button>
            </div>

            {(erro || (validacao && !validacao.ok)) && (
              <p className="flex items-center gap-1.5 text-xs text-destructive">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {erro || validacao?.erro}
              </p>
            )}
            {validacao?.ok && validacao.url !== url.trim() && (
              <p className="text-xs text-muted-foreground">
                Será salvo como: <span className="font-medium break-all">{validacao.url}</span>
              </p>
            )}

            {onAddLote && (
              <div className="rounded-md border border-dashed border-border p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium flex items-center gap-1.5">
                    <ListPlus className="w-3.5 h-3.5 text-primary" />
                    Importar vários links
                  </p>
                  <Button variant="ghost" size="sm" onClick={() => setLoteAberto((v) => !v)}>
                    {loteAberto ? "Fechar" : "Abrir"}
                  </Button>
                </div>

                {loteAberto && (
                  <>
                    <Textarea
                      value={lote}
                      onChange={(e) => setLote(e.target.value)}
                      placeholder={"Cole um link por linha:\nhttps://portal.com/anuncio-1\nhttps://portal.com/anuncio-2"}
                      rows={5}
                      className="text-xs"
                    />
                    {lote.trim() && (
                      <div className="space-y-1 text-xs">
                        <p className="text-muted-foreground">
                          {previaLote.validos.length} link(s) válido(s)
                          {previaLote.invalidos.length > 0 && ` · ${previaLote.invalidos.length} ignorado(s)`}
                        </p>
                        {previaLote.invalidos.slice(0, 5).map((f, idx) => (
                          <p key={`${f.entrada}-${idx}`} className="flex items-start gap-1.5 text-destructive">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                            <span className="break-all">{f.entrada} — {f.erro}</span>
                          </p>
                        ))}
                      </div>
                    )}
                    <Button
                      size="sm"
                      className="gap-2"
                      disabled={carregando || previaLote.validos.length === 0}
                      onClick={async () => {
                        if (!onAddLote || previaLote.validos.length === 0) return;
                        await onAddLote(lote);
                        setLote("");
                      }}
                    >
                      {carregando ? <Loader2 className="w-4 h-4 animate-spin" /> : <ListPlus className="w-4 h-4" />}
                      Importar {previaLote.validos.length || ""} link(s)
                    </Button>
                  </>
                )}
              </div>
            )}


            {itens.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Nenhum link adicionado ainda. Os dados do anúncio são extraídos e salvos como referência real.
              </p>
            ) : (
              <ul className="space-y-2">
                {itens.map((i, idx) => (
                  <li
                    key={i.id}
                    className="rounded-md border border-border bg-secondary/50 p-2"
                  >
                    {editandoId === i.id ? (
                      <div className="space-y-2">
                        <Input
                          value={rascunho.titulo}
                          onChange={(e) => setRascunho((r) => ({ ...r, titulo: e.target.value }))}
                          placeholder="Título da referência"
                          maxLength={200}
                        />
                        <div className="grid gap-2 sm:grid-cols-3">
                          <Input
                            value={rascunho.preco}
                            onChange={(e) => setRascunho((r) => ({ ...r, preco: e.target.value }))}
                            placeholder="Preço (R$)"
                            inputMode="decimal"
                          />
                          <Input
                            value={rascunho.area}
                            onChange={(e) => setRascunho((r) => ({ ...r, area: e.target.value }))}
                            placeholder="Área (m²)"
                            inputMode="decimal"
                          />
                          <Input
                            value={rascunho.bairro}
                            onChange={(e) => setRascunho((r) => ({ ...r, bairro: e.target.value }))}
                            placeholder="Bairro"
                            maxLength={120}
                          />
                        </div>
                        {erroEdicao && (
                          <p className="flex items-center gap-1.5 text-xs text-destructive">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            {erroEdicao}
                          </p>
                        )}
                        <div className="flex gap-2">
                          <Button size="sm" onClick={salvarEdicao} className="gap-1.5">
                            <Check className="w-3.5 h-3.5" /> Salvar
                          </Button>
                          <Button size="sm" variant="ghost" onClick={cancelarEdicao} className="gap-1.5">
                            <X className="w-3.5 h-3.5" /> Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold text-muted-foreground w-5">{idx + 1}.</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{i.titulo}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatBRL(i.preco)} · {i.area || 0} m² {i.bairro ? `· ${i.bairro}` : ""}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-[10px]">meu link</Badge>
                        {onReorder && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={idx === 0}
                              onClick={() => onReorder(i.id, -1)}
                              aria-label="Mover para cima"
                            >
                              <ArrowUp className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={idx === itens.length - 1}
                              onClick={() => onReorder(i.id, 1)}
                              aria-label="Mover para baixo"
                            >
                              <ArrowDown className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                        {i.url_anuncio && (
                          <a
                            href={i.url_anuncio}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-primary"
                            aria-label="Abrir anúncio"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                        {onEdit && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => iniciarEdicao(i)}
                            aria-label="Editar referência"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => onRemove(i.id)} aria-label="Remover referência">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}

          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ReferenciasLinkPanel;
