import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { Copy, ExternalLink, Rss, Webhook, CheckCircle2, Info, RefreshCw, Clock } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

const PORTAIS = [
  {
    key: 'vrsync',
    nome: 'ZAP Imóveis + VivaReal',
    desc: 'Formato VRSync (padrão Grupo OLX). Use este feed para ambos os portais.',
    feedParam: 'vrsync',
    cor: 'bg-purple-500',
    instrucoes: '1. Copie o link do XML\n2. Acesse o Canal Pro (canalpro.com.br)\n3. Vá em Configurações → Integração Feed\n4. Cole a URL do feed XML\n5. Aguarde o processamento (até 24h)',
  },
  {
    key: 'olx',
    nome: 'OLX',
    desc: 'Formato XML específico OLX para classificados de imóveis.',
    feedParam: 'olx',
    cor: 'bg-orange-500',
    instrucoes: '1. Copie o link do XML\n2. Acesse o painel de gestão da OLX\n3. Vá em Ferramentas → Importação XML\n4. Cole a URL e salve\n5. A importação ocorre automaticamente',
  },
  {
    key: 'imovelweb',
    nome: 'Imovelweb',
    desc: 'Feed XML para integração com o portal Imovelweb.',
    feedParam: 'imovelweb',
    cor: 'bg-blue-600',
    instrucoes: '1. Copie o link do XML\n2. Entre em contato com seu executivo comercial Imovelweb\n3. Envie a URL do feed para ativação\n4. O portal configurará a importação automática',
  },
  {
    key: 'wimoveis',
    nome: 'WImóveis',
    desc: 'Feed XML compatível com o formato WImóveis (mesmo grupo Imovelweb).',
    feedParam: 'wimoveis',
    cor: 'bg-green-600',
    instrucoes: '1. Copie o link do XML\n2. Acesse wimoveis.com.br → Área do Anunciante\n3. Vá em Integrações e cole a URL\n4. Ou envie para o suporte do WImóveis',
  },
  {
    key: 'netimoveis',
    nome: 'NetImóveis',
    desc: 'Feed XML padrão para integração com NetImóveis.',
    feedParam: 'netimoveis',
    cor: 'bg-red-500',
    instrucoes: '1. Copie o link do XML\n2. Entre em contato com o suporte NetImóveis\n3. Solicite a ativação da integração via XML\n4. Informe a URL do feed',
  },
  {
    key: 'dfimoveis',
    nome: 'DFImóveis',
    desc: 'Feed XML para integração com o portal DFImóveis.',
    feedParam: 'dfimoveis',
    cor: 'bg-teal-600',
    instrucoes: '1. Copie o link do XML\n2. Acesse dfimoveis.com → Área do Cliente\n3. Vá em Integração XML\n4. Cole a URL e ative',
  },
  {
    key: 'chavenaomao',
    nome: 'Chave na Mão',
    desc: 'Feed XML para integração com o portal Chave na Mão.',
    feedParam: 'chavenaomao',
    cor: 'bg-amber-600',
    instrucoes: '1. Copie o link do XML\n2. Acesse chavenaomao.com.br\n3. Na área de parceiros, solicite integração XML\n4. Envie a URL do feed',
  },
];

export default function IntegracaoPortais() {
  const { user } = useAuth();
  const [expandedPortal, setExpandedPortal] = useState<string | null>(null);

  const imobiliariaId = user?.id;
  const [atualizando, setAtualizando] = useState(false);
  
  const getFeedUrl = (feedParam: string) =>
    `${SUPABASE_URL}/functions/v1/xml-feed-imoveis?id=${imobiliariaId}&portal=${feedParam}`;

  const handleAtualizarCarga = async () => {
    if (!imobiliariaId) return;
    setAtualizando(true);
    try {
      const { data, error } = await supabase.functions.invoke('atualizar-carga-portais', {
        body: { imobiliaria_id: imobiliariaId },
      });
      if (error) throw error;
      toast.success('Carga de todos os portais atualizada com sucesso! Seus anúncios foram renovados.');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao atualizar carga dos portais.');
    } finally {
      setAtualizando(false);
    }
  };

  const getWebhookUrl = (portal: string) =>
    `${SUPABASE_URL}/functions/v1/webhook-leads-portal?id=${imobiliariaId}&portal=${portal}`;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">Integração com Portais Imobiliários</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Configure a exportação automática de imóveis e a captação de leads dos principais portais.
          </p>
        </div>

        {/* Info Card */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 flex gap-3 items-start">
            <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div className="text-sm text-foreground space-y-1">
              <p className="font-medium">Como funciona a integração?</p>
              <p className="text-muted-foreground">
                <strong>Feed XML (Exportação):</strong> Copie o link do feed e cadastre no portal. Seus imóveis ativos serão sincronizados automaticamente.
              </p>
              <p className="text-muted-foreground">
                <strong>Webhook (Leads):</strong> Cadastre a URL de webhook no portal para receber leads automaticamente no seu Pipeline.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Atualizar Carga Card */}
        <Card className="border-primary/30 bg-gradient-to-r from-primary/5 to-primary/10">
          <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex gap-3 items-start">
              <RefreshCw className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-foreground">Atualizar Carga dos Portais</p>
                <p className="text-muted-foreground text-xs mt-0.5">
                  Atualiza todos os feeds XML automaticamente. Execução automática diária às 00:00 para manter seus anúncios no topo.
                </p>
                <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span>Próxima execução automática: hoje às 00:00</span>
                </div>
              </div>
            </div>
            <Button
              onClick={handleAtualizarCarga}
              disabled={atualizando}
              className="shrink-0"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${atualizando ? 'animate-spin' : ''}`} />
              {atualizando ? 'Atualizando...' : 'Atualizar Agora'}
            </Button>
          </CardContent>
        </Card>

        {/* Portal Cards */}
        <div className="grid gap-4">
          {PORTAIS.map(portal => {
            const feedUrl = getFeedUrl(portal.feedParam);
            const webhookUrl = getWebhookUrl(portal.key);
            const isExpanded = expandedPortal === portal.key;

            return (
              <Card key={portal.key} className="border-border">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${portal.cor}`} />
                      <div>
                        <CardTitle className="text-base">{portal.nome}</CardTitle>
                        <CardDescription className="text-xs">{portal.desc}</CardDescription>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="outline" className="text-xs gap-1">
                        <Rss className="w-3 h-3" /> XML
                      </Badge>
                      <Badge variant="outline" className="text-xs gap-1">
                        <Webhook className="w-3 h-3" /> Leads
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Feed XML */}
                  <div>
                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-1">
                      <Rss className="w-3 h-3" /> URL do Feed XML (Exportação de Imóveis)
                    </label>
                    <div className="flex gap-2">
                      <Input
                        readOnly
                        value={feedUrl}
                        className="text-xs font-mono bg-muted/30"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard(feedUrl, 'Link do feed XML')}
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(feedUrl, '_blank')}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Webhook */}
                  <div>
                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-1">
                      <Webhook className="w-3 h-3" /> URL do Webhook (Receber Leads)
                    </label>
                    <div className="flex gap-2">
                      <Input
                        readOnly
                        value={webhookUrl}
                        className="text-xs font-mono bg-muted/30"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard(webhookUrl, 'URL do webhook')}
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Instructions toggle */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground w-full"
                    onClick={() => setExpandedPortal(isExpanded ? null : portal.key)}
                  >
                    {isExpanded ? '▲ Ocultar instruções' : '▼ Ver instruções de integração'}
                  </Button>

                  {isExpanded && (
                    <div className="bg-muted/30 rounded-lg p-3 text-xs text-muted-foreground whitespace-pre-line border border-border">
                      <p className="font-medium text-foreground mb-1">📋 Passo a passo:</p>
                      {portal.instrucoes}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Status summary */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span>
                Todos os feeds estão ativos. Os imóveis com status <strong>"Ativo"</strong> serão exportados automaticamente.
                Leads recebidos via webhook entram direto no Pipeline como <strong>"Novos"</strong>.
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
