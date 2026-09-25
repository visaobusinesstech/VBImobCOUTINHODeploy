import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Eye, EyeOff, Sparkles, Variable } from "lucide-react";
import {
  BLOCOS_MENSAGEM,
  GRUPOS_VARIAVEL,
  VARIAVEIS_NUTRICAO,
  aplicarVariaveis,
  variaveisSemValor,
  type GrupoVariavel,
} from "@/lib/nutricaoVariaveis";

interface Props {
  value: string;
  onChange: (v: string) => void;
  canal: string;
  contexto: Record<string, string>;
  leads: Array<{ id: string; label: string }>;
  imoveis: Array<{ id: string; label: string }>;
  leadId: string;
  imovelId: string;
  onLeadChange: (v: string) => void;
  onImovelChange: (v: string) => void;
  placeholder?: string;
}

export function GeradorMensagem({
  value,
  onChange,
  canal,
  contexto,
  leads,
  imoveis,
  leadId,
  imovelId,
  onLeadChange,
  onImovelChange,
  placeholder,
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);

  const inserir = (trecho: string) => {
    const el = ref.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const antes = value.slice(0, start);
    const depois = value.slice(end);
    const precisaEspaco = antes.length > 0 && !/\s$/.test(antes) && !trecho.startsWith("\n");
    const novo = `${antes}${precisaEspaco ? " " : ""}${trecho}${depois}`;
    onChange(novo);
    requestAnimationFrame(() => {
      const pos = antes.length + (precisaEspaco ? 1 : 0) + trecho.length;
      el?.focus();
      el?.setSelectionRange(pos, pos);
    });
  };

  const blocos = useMemo(
    () => BLOCOS_MENSAGEM.filter((b) => b.canal === "ambos" || b.canal === canal),
    [canal],
  );

  const grupos = useMemo(() => {
    const map = new Map<GrupoVariavel, typeof VARIAVEIS_NUTRICAO>();
    VARIAVEIS_NUTRICAO.forEach((v) => {
      map.set(v.grupo, [...(map.get(v.grupo) ?? []), v]);
    });
    return [...map.entries()];
  }, []);

  const semValor = variaveisSemValor(value, contexto);
  const textoFinal = aplicarVariaveis(value, contexto);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              <Variable className="mr-1 h-4 w-4" /> Variáveis
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 p-0">
            <ScrollArea className="h-72">
              <div className="space-y-3 p-3">
                {grupos.map(([grupo, itens]) => (
                  <div key={grupo} className="space-y-1.5">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">
                      {GRUPOS_VARIAVEL[grupo]}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {itens.map((v) => (
                        <button
                          key={v.chave}
                          type="button"
                          title={`${v.label} — ex.: ${v.exemplo}`}
                          onClick={() => inserir(`{{${v.chave}}}`)}
                        >
                          <Badge variant="secondary" className="cursor-pointer font-normal">
                            {v.label}
                          </Badge>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              <Sparkles className="mr-1 h-4 w-4" /> Blocos prontos
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 p-0">
            <ScrollArea className="h-64">
              <div className="space-y-2 p-3">
                {blocos.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => inserir(b.texto.startsWith("\n") ? b.texto : ` ${b.texto}`)}
                    className="w-full rounded-md border p-2 text-left transition hover:bg-muted"
                  >
                    <p className="text-xs font-medium">{b.label}</p>
                    <p className="line-clamp-2 text-xs text-muted-foreground">{b.texto.trim()}</p>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>

        <Button type="button" variant="ghost" size="sm" onClick={() => setPreview((p) => !p)}>
          {preview ? <EyeOff className="mr-1 h-4 w-4" /> : <Eye className="mr-1 h-4 w-4" />}
          {preview ? "Editar" : "Pré-visualizar"}
        </Button>
      </div>

      {preview ? (
        <div className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Lead da prévia</Label>
              <Select value={leadId} onValueChange={onLeadChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="exemplo">Dados de exemplo</SelectItem>
                  {leads.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Imóvel da prévia</Label>
              <Select value={imovelId} onValueChange={onImovelChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="exemplo">Dados de exemplo</SelectItem>
                  {imoveis.map((i) => (
                    <SelectItem key={i.id} value={i.id}>{i.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="whitespace-pre-wrap rounded-md border bg-muted/40 p-3 text-sm">
            {textoFinal || "Escreva a mensagem para ver a prévia."}
          </div>
        </div>
      ) : (
        <Textarea
          ref={ref}
          rows={4}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? "Olá {{primeiro_nome}}, separei esta opção: {{imovel_resumo}}"}
        />
      )}

      {semValor.length > 0 && (
        <p className="text-xs text-amber-600">
          Sem valor no contexto atual: {semValor.map((v) => `{{${v}}}`).join(", ")} — o texto é enviado sem essa parte.
        </p>
      )}
    </div>
  );
}
