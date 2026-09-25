import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ExternalLink, MessageCircle, Users, Search, Loader2, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { scrapePortais, salvarImoveisMercado, type ImovelMercado } from "@/lib/api/portalScraper";
import { ImportarImovelButton } from "./ImportarImovelButton";

const GRUPOS_FACEBOOK = [
  { nome: "Imóveis Brasília - Compra e Venda", url: "https://www.facebook.com/groups/imoveisbrasilia", membros: "50k+" },
  { nome: "Aluguel de Imóveis em Brasília/DF", url: "https://www.facebook.com/groups/aluguelbrasilia", membros: "30k+" },
  { nome: "Imóveis DF - Venda e Aluguel", url: "https://www.facebook.com/groups/imoveisdf", membros: "40k+" },
  { nome: "Imóveis Águas Claras", url: "https://www.facebook.com/groups/imoveisaguasclaras", membros: "25k+" },
  { nome: "Imóveis Taguatinga e Ceilândia", url: "https://www.facebook.com/groups/imoveistaguatinga", membros: "20k+" },
  { nome: "Imóveis Samambaia e Recanto", url: "https://www.facebook.com/groups/imoveissamambaia", membros: "15k+" },
  { nome: "Imóveis Guará e Park Sul", url: "https://www.facebook.com/groups/imoveisguara", membros: "12k+" },
  { nome: "Imóveis Sobradinho e Planaltina", url: "https://www.facebook.com/groups/imoveissobradinho", membros: "10k+" },
  { nome: "Imóveis Gama e Santa Maria", url: "https://www.facebook.com/groups/imoveisgama", membros: "10k+" },
  { nome: "Imóveis Valparaíso e Entorno", url: "https://www.facebook.com/groups/imoveisvalparaiso", membros: "18k+" },
];

const GRUPOS_WHATSAPP = [
  { nome: "Imóveis Brasília - Venda", url: "https://chat.whatsapp.com/", descricao: "Busque no Google: 'grupo whatsapp imóveis Brasília venda'" },
  { nome: "Imóveis DF - Aluguel", url: "https://chat.whatsapp.com/", descricao: "Busque: 'grupo whatsapp aluguel apartamento Brasília'" },
  { nome: "Corretores Brasília", url: "https://chat.whatsapp.com/", descricao: "Busque: 'grupo whatsapp corretores imóveis DF'" },
];

const ESTRATEGIAS = [
  { titulo: "Google Alerts", descricao: "Configure alertas para 'imóvel venda Brasília' e receba novos anúncios por email automaticamente.", url: "https://www.google.com/alerts", icone: "🔔" },
  { titulo: "OLX Favoritos", descricao: "Use a busca salva da OLX para receber notificações de novos imóveis na sua região.", url: "https://www.olx.com.br/imoveis/venda/estado-df", icone: "⭐" },
  { titulo: "Marketplace Facebook", descricao: "Busque imóveis no Marketplace do Facebook filtrando por Brasília/DF.", url: "https://www.facebook.com/marketplace/brasilia/propertyrentals", icone: "🏪" },
  { titulo: "Instagram #ImóveisBrasília", descricao: "Monitore hashtags como #ImóveisBrasília, #ApartamentoBrasília, #CasaBrasília.", url: "https://www.instagram.com/explore/tags/imoveisbrasilia/", icone: "📸" },
  { titulo: "Leilões Judiciais", descricao: "Imóveis com desconto de até 50% em leilões judiciais e extrajudiciais do DF.", url: "https://www.tjdft.jus.br/consultas/leiloes", icone: "⚖️" },
  { titulo: "Caixa - Imóveis Retomados", descricao: "Imóveis retomados pela Caixa Econômica com preços abaixo do mercado.", url: "https://venda-imoveis.caixa.gov.br/sistema/busca-imovel.asp", icone: "🏦" },
];

// Portais com maior incidência de anúncios de proprietários
const PORTAIS_PROPRIETARIOS = ["olx", "mercadolivre", "quintoandar", "chavenaomao", "i123"];

export function GruposImoveisPanel() {
  const { user, imobiliariaId } = useAuth();
  const { toast } = useToast();
  const [cidade, setCidade] = useState("Brasília");
  const [tipo, setTipo] = useState("apartamento");
  const [operacao, setOperacao] = useState("Venda");
  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [resultados, setResultados] = useState<ImovelMercado[]>([]);

  const handleBuscarProprietarios = async () => {
    if (!cidade.trim()) {
      toast({ title: "Informe a cidade", variant: "destructive" });
      return;
    }
    setLoading(true);
    setResultados([]);

    try {
      const result = await scrapePortais(cidade, tipo, operacao, PORTAIS_PROPRIETARIOS, "DF");
      if (result.success && result.data) {
        setResultados(result.data);
        toast({ title: `${result.total} anúncios de proprietários encontrados de ${result.portais_consultados} portais` });
      } else {
        toast({ title: "Erro na busca", description: result.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro ao conectar", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSalvar = async () => {
    if (!user || !imobiliariaId || resultados.length === 0) return;
    setSalvando(true);
    const result = await salvarImoveisMercado(imobiliariaId, resultados);
    setSalvando(false);
    if (result.success) {
      toast({ title: `${result.count} anúncios de proprietários salvos no banco de dados!` });
    } else {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      {/* Busca Automática de Proprietários */}
      <Card className="border-primary/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="w-4 h-4 text-primary" />
            🏠 Busca Automática — Imóveis de Proprietários
          </CardTitle>
          <CardDescription>
            Busca automatizada nos portais com maior incidência de anúncios diretos de proprietários (OLX, Mercado Livre, QuintoAndar, Chave na Mão, 123i)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Select value={cidade} onValueChange={setCidade}>
              <SelectTrigger><SelectValue placeholder="Cidade" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Brasília">Brasília (Plano Piloto)</SelectItem>
                <SelectItem value="Águas Claras">Águas Claras</SelectItem>
                <SelectItem value="Taguatinga">Taguatinga</SelectItem>
                <SelectItem value="Ceilândia">Ceilândia</SelectItem>
                <SelectItem value="Samambaia">Samambaia</SelectItem>
                <SelectItem value="Guará">Guará</SelectItem>
                <SelectItem value="Vicente Pires">Vicente Pires</SelectItem>
                <SelectItem value="Sobradinho">Sobradinho</SelectItem>
                <SelectItem value="Planaltina">Planaltina</SelectItem>
                <SelectItem value="Gama">Gama</SelectItem>
                <SelectItem value="Santa Maria">Santa Maria</SelectItem>
                <SelectItem value="Recanto das Emas">Recanto das Emas</SelectItem>
                <SelectItem value="Riacho Fundo">Riacho Fundo</SelectItem>
                <SelectItem value="São Sebastião">São Sebastião</SelectItem>
                <SelectItem value="Paranoá">Paranoá</SelectItem>
                <SelectItem value="Jardim Botânico">Jardim Botânico</SelectItem>
                <SelectItem value="Park Way">Park Way</SelectItem>
                <SelectItem value="Núcleo Bandeirante">Núcleo Bandeirante</SelectItem>
                <SelectItem value="Brazlândia">Brazlândia</SelectItem>
                <SelectItem value="Lago Sul">Lago Sul</SelectItem>
                <SelectItem value="Lago Norte">Lago Norte</SelectItem>
                <SelectItem value="Cruzeiro">Cruzeiro</SelectItem>
                <SelectItem value="Sudoeste">Sudoeste</SelectItem>
                <SelectItem value="Octogonal">Octogonal</SelectItem>
                <SelectItem value="Arniqueira">Arniqueira</SelectItem>
                <SelectItem value="Sol Nascente">Sol Nascente</SelectItem>
                <SelectItem value="Pôr do Sol">Pôr do Sol</SelectItem>
                <SelectItem value="Estrutural">Estrutural</SelectItem>
                <SelectItem value="Varjão">Varjão</SelectItem>
                <SelectItem value="Itapoã">Itapoã</SelectItem>
                <SelectItem value="Fercal">Fercal</SelectItem>
                <SelectItem value="SIA">SIA</SelectItem>
              </SelectContent>
            </Select>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="apartamento">Apartamento</SelectItem>
                <SelectItem value="casa">Casa</SelectItem>
                <SelectItem value="terreno">Terreno</SelectItem>
                <SelectItem value="comercial">Comercial</SelectItem>
              </SelectContent>
            </Select>
            <Select value={operacao} onValueChange={setOperacao}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Venda">Venda</SelectItem>
                <SelectItem value="Aluguel">Aluguel</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleBuscarProprietarios} disabled={loading} className="gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              {loading ? "Buscando..." : "Buscar Proprietários"}
            </Button>
          </div>

          {/* Resultados */}
          {resultados.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="default" className="text-xs">
                  {resultados.length} anúncios encontrados
                </Badge>
                <Button size="sm" variant="outline" onClick={handleSalvar} disabled={salvando} className="gap-1">
                  <Download className="w-3 h-3" />
                  {salvando ? "Salvando..." : "Salvar no Banco"}
                </Button>
              </div>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left p-2 font-medium">Portal</th>
                      <th className="text-left p-2 font-medium">Título</th>
                      <th className="text-left p-2 font-medium">Bairro</th>
                      <th className="text-right p-2 font-medium">Preço</th>
                      <th className="text-right p-2 font-medium">Área</th>
                      <th className="text-center p-2 font-medium">Qts</th>
                      <th className="text-center p-2 font-medium">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultados.slice(0, 30).map((im, i) => (
                      <tr
                        key={i}
                        className="border-b hover:bg-primary/10 transition-colors cursor-pointer"
                        onClick={() => {
                          if (im.url_anuncio) {
                            window.open(im.url_anuncio, '_blank', 'noopener,noreferrer');
                          }
                        }}
                        title={im.url_anuncio ? "Clique para abrir o anúncio" : ""}
                      >
                        <td className="p-2">
                          <Badge variant="outline" className="text-xs">{im.portal}</Badge>
                        </td>
                        <td className="p-2 max-w-[180px] truncate font-medium text-xs">{im.titulo}</td>
                        <td className="p-2 text-xs text-muted-foreground">{(im as any).bairro || "-"}</td>
                        <td className="p-2 text-right text-xs">
                          {im.preco.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </td>
                        <td className="p-2 text-right text-xs">{im.area > 0 ? `${im.area}m²` : "-"}</td>
                        <td className="p-2 text-center text-xs">{im.quartos || "-"}</td>
                        <td className="p-2 text-center" onClick={(e) => e.stopPropagation()}>
                          <ImportarImovelButton
                            imovel={{
                              titulo: im.titulo,
                              tipo: im.tipo,
                              operacao: im.operacao,
                              bairro: (im as any).bairro,
                              cidade: (im as any).cidade,
                              estado: (im as any).estado,
                              preco: im.preco,
                              area: im.area,
                              quartos: im.quartos,
                              banheiros: im.banheiros,
                              vagas: im.vagas,
                              url_anuncio: im.url_anuncio,
                              fotos: (im as any).fotos,
                            }}
                            size="icon"
                            variant="ghost"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {resultados.length > 30 && (
                  <p className="text-xs text-muted-foreground p-2 text-center">
                    Mostrando 30 de {resultados.length} resultados
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Estratégias de Captação */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">🎯 Estratégias de Captação Inteligente</CardTitle>
          <CardDescription>Ferramentas e canais para encontrar oportunidades além dos portais tradicionais</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {ESTRATEGIAS.map((e, i) => (
              <a
                key={i}
                href={e.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors group"
              >
                <span className="text-2xl">{e.icone}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors flex items-center gap-1">
                    {e.titulo} <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{e.descricao}</p>
                </div>
              </a>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Grupos Facebook */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-500" />
            Grupos de Facebook — Imóveis Brasília/DF
          </CardTitle>
          <CardDescription>Busque estes grupos no Facebook para encontrar oportunidades direto com proprietários</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {GRUPOS_FACEBOOK.map((g, i) => (
              <a
                key={i}
                href={g.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors group"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Users className="w-4 h-4 text-blue-500 shrink-0" />
                  <span className="text-sm font-medium text-foreground truncate">{g.nome}</span>
                </div>
                <Badge variant="secondary" className="text-xs shrink-0">{g.membros}</Badge>
              </a>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Grupos WhatsApp */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-green-500" />
            Grupos de WhatsApp — Imóveis DF
          </CardTitle>
          <CardDescription>Links de grupos de WhatsApp mudam frequentemente. Use as dicas de busca abaixo para encontrá-los.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {GRUPOS_WHATSAPP.map((g, i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/20"
              >
                <MessageCircle className="w-4 h-4 text-green-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{g.nome}</p>
                  <p className="text-xs text-muted-foreground">{g.descricao}</p>
                </div>
              </div>
            ))}
            <div className="pt-2">
              <a
                href="https://www.google.com/search?q=grupo+whatsapp+im%C3%B3veis+bras%C3%ADlia+venda+link"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <ExternalLink className="w-3 h-3" /> Buscar grupos no Google
              </a>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
