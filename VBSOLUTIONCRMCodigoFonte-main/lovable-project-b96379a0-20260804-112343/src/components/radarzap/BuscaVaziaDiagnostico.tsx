import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Lightbulb, Loader2, RefreshCw, Search, WifiOff, KeyRound, MapPin, Filter } from "lucide-react";

type Props = {
  ultimaBusca: any | null;
  cidadesCsv: string;
  termo: string;
  onAplicarSugestao: (cidades: string, termo: string) => void;
  onTentarNovamente: () => void;
  buscando: boolean;
};

// Sugestões prontas de refinamento — cidades grandes / termos que costumam trazer resultado
const SUGESTOES: { label: string; cidades: string; termo: string; motivo: string }[] = [
  { label: "Brasília — aluguel", cidades: "Brasília, Águas Claras, Taguatinga", termo: "aluguel", motivo: "Termo genérico, alto volume" },
  { label: "Brasília — apartamento", cidades: "Brasília, Águas Claras", termo: "apartamento", motivo: "Nicho comum em grupos" },
  { label: "São Paulo — imóveis", cidades: "São Paulo, Guarulhos, Osasco", termo: "imóveis", motivo: "Mercado com muitos grupos ativos" },
  { label: "Rio de Janeiro — locação", cidades: "Rio de Janeiro, Niterói", termo: "locação", motivo: "Termo formal usado em grupos" },
  { label: "Genérica — sem termo", cidades: "Brasília", termo: "", motivo: "Amplia ao máximo (só cidade + palavra imóveis)" },
];

export default function BuscaVaziaDiagnostico({
  ultimaBusca, cidadesCsv, termo, onAplicarSugestao, onTentarNovamente, buscando,
}: Props) {
  const jaBuscou = !!ultimaBusca;
  const encontrados = ultimaBusca?.encontrados ?? 0;
  const inseridos = ultimaBusca?.inseridos ?? 0;
  const totalRaw = ultimaBusca?.total_raw_items ?? 0;
  const totalValidos = ultimaBusca?.total_invites_validos ?? 0;
  const telemetria: any[] = ultimaBusca?.telemetria ?? [];
  const erros: any[] = ultimaBusca?.erros ?? [];
  const firecrawlKind: string | undefined = ultimaBusca?.firecrawl_key_kind;

  // Diagnóstico das causas prováveis
  const causas: { titulo: string; detalhe: string; icone: JSX.Element; cor: string }[] = [];

  if (!jaBuscou) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          Nenhum grupo descoberto ainda. Clique em <strong>Buscar grupos públicos</strong> acima para começar.
        </CardContent>
      </Card>
    );
  }

  const httpErros = telemetria.filter(t => t.status && t.status >= 400);
  const semRetorno = telemetria.filter(t => (t.raw_items ?? 0) === 0 && !t.error && (t.status ?? 0) < 400);
  const semValidos = telemetria.filter(t => (t.raw_items ?? 0) > 0 && (t.invites_validos ?? 0) === 0);
  const duplicados = totalValidos > 0 && inseridos === 0;

  if (!firecrawlKind || firecrawlKind === "missing") {
    causas.push({
      titulo: "Chave Firecrawl ausente",
      detalhe: "A integração com Firecrawl não está configurada. Sem ela não é possível descobrir links públicos.",
      icone: <KeyRound className="h-4 w-4" />,
      cor: "text-red-600",
    });
  }
  if (httpErros.length > 0) {
    causas.push({
      titulo: `Falhas HTTP em ${httpErros.length} consulta(s)`,
      detalhe: `Códigos retornados: ${[...new Set(httpErros.map(e => e.status))].join(", ")}. Pode ser rate limit, chave inválida ou instabilidade.`,
      icone: <WifiOff className="h-4 w-4" />,
      cor: "text-red-600",
    });
  }
  if (semRetorno.length > 0 && httpErros.length === 0) {
    causas.push({
      titulo: `Firecrawl não achou nada em ${semRetorno.length} consulta(s)`,
      detalhe: "O buscador não retornou resultados para essas combinações. Termos muito específicos ou cidades pequenas costumam zerar.",
      icone: <Search className="h-4 w-4" />,
      cor: "text-amber-600",
    });
  }
  if (semValidos.length > 0) {
    causas.push({
      titulo: `${semValidos.length} consulta(s) retornaram páginas, mas sem links chat.whatsapp.com`,
      detalhe: "Só aceitamos convites públicos do WhatsApp. Blogs, notícias e listas sem link direto são descartados.",
      icone: <Filter className="h-4 w-4" />,
      cor: "text-amber-600",
    });
  }
  if (duplicados) {
    causas.push({
      titulo: `${totalValidos} link(s) encontrados, mas todos já estavam cadastrados`,
      detalhe: "Nada de novo foi inserido — verifique a aba Grupos com filtro de status para revisar existentes ou tente outra cidade/termo.",
      icone: <AlertCircle className="h-4 w-4" />,
      cor: "text-blue-600",
    });
  }
  if (causas.length === 0 && encontrados === 0) {
    causas.push({
      titulo: "Sem resultados úteis para os parâmetros atuais",
      detalhe: "Tente termos mais genéricos (aluguel, imóveis) e cidades maiores para ampliar o alcance.",
      icone: <Lightbulb className="h-4 w-4" />,
      cor: "text-amber-600",
    });
  }

  return (
    <Card className="border-amber-200 bg-amber-50/40">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          0 grupos encontrados — veja o que ajustar
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Resumo do run */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <div className="bg-white rounded-md p-2 border">
            <div className="text-muted-foreground">Consultas</div>
            <div className="text-lg font-bold">{telemetria.length}</div>
          </div>
          <div className="bg-white rounded-md p-2 border">
            <div className="text-muted-foreground">Itens brutos</div>
            <div className="text-lg font-bold">{totalRaw}</div>
          </div>
          <div className="bg-white rounded-md p-2 border">
            <div className="text-muted-foreground">Links válidos</div>
            <div className="text-lg font-bold">{totalValidos}</div>
          </div>
          <div className="bg-white rounded-md p-2 border">
            <div className="text-muted-foreground">Novos inseridos</div>
            <div className="text-lg font-bold">{inseridos}</div>
          </div>
        </div>

        {/* Parâmetros usados */}
        <div className="text-xs text-muted-foreground flex flex-wrap gap-2 items-center">
          <MapPin className="h-3 w-3" />
          <span>Cidades: <strong className="text-foreground">{cidadesCsv || "—"}</strong></span>
          <span>·</span>
          <span>Termo: <strong className="text-foreground">{termo || "(nenhum)"}</strong></span>
          {firecrawlKind && <><span>·</span><Badge variant="outline" className="text-[10px]">Firecrawl: {firecrawlKind}</Badge></>}
        </div>

        {/* Causas prováveis */}
        <div>
          <div className="text-sm font-semibold mb-2">Causas prováveis</div>
          <ul className="space-y-2">
            {causas.map((c, i) => (
              <li key={i} className="flex gap-2 text-sm bg-white rounded-md p-2 border">
                <span className={c.cor}>{c.icone}</span>
                <div>
                  <div className="font-medium">{c.titulo}</div>
                  <div className="text-xs text-muted-foreground">{c.detalhe}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Sugestões de ajuste */}
        <div>
          <div className="text-sm font-semibold mb-2 flex items-center gap-1">
            <Lightbulb className="h-4 w-4 text-amber-600" /> Tente com estes parâmetros
          </div>
          <div className="grid md:grid-cols-2 gap-2">
            {SUGESTOES.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onAplicarSugestao(s.cidades, s.termo)}
                className="text-left bg-white border rounded-md p-2 hover:border-primary hover:shadow-sm transition"
              >
                <div className="text-sm font-medium">{s.label}</div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {s.cidades} {s.termo && `· ${s.termo}`}
                </div>
                <div className="text-[11px] text-muted-foreground italic">{s.motivo}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Dicas gerais */}
        <div className="text-xs text-muted-foreground bg-white border rounded-md p-3 space-y-1">
          <div className="font-semibold text-foreground">Dicas rápidas</div>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>Use nomes de cidades completos (ex.: <em>Rio de Janeiro</em>, não <em>RJ</em>).</li>
            <li>Prefira termos amplos (<em>aluguel, imóveis, apartamento</em>) a termos muito específicos.</li>
            <li>Cidades pequenas raramente têm grupos públicos indexados — combine com a capital da região.</li>
            <li>Se aparecerem erros HTTP repetidos, aguarde 1-2 min (rate limit) e tente novamente.</li>
          </ul>
        </div>

        {erros.length > 0 && (
          <details className="text-xs bg-white border rounded-md p-2">
            <summary className="cursor-pointer font-medium">Ver erros detalhados ({erros.length})</summary>
            <pre className="mt-2 overflow-auto max-h-40 text-[10px]">{JSON.stringify(erros, null, 2)}</pre>
          </details>
        )}

        <div className="flex gap-2 pt-1">
          <Button onClick={onTentarNovamente} disabled={buscando} size="sm">
            {buscando ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            Buscar novamente
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
