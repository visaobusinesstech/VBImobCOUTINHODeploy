import EvolutionStatusPanel from "./EvolutionStatusPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { toast } from "sonner";

const DOCKER_COMPOSE = `version: "3.8"
services:
  evolution:
    image: atendai/evolution-api:latest
    restart: always
    ports:
      - "8080:8080"
    environment:
      AUTHENTICATION_API_KEY: "TROQUE_POR_UMA_CHAVE_LONGA"
      SERVER_URL: "https://SEU_DOMINIO"
      DEL_INSTANCE: "false"
      DATABASE_ENABLED: "true"
      DATABASE_CONNECTION_URI: "postgresql://postgres:postgres@postgres:5432/evolution"
      DATABASE_PROVIDER: "postgresql"
      CACHE_REDIS_ENABLED: "true"
      CACHE_REDIS_URI: "redis://redis:6379"
    depends_on: [postgres, redis]
  postgres:
    image: postgres:15-alpine
    restart: always
    environment:
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: evolution
    volumes: ["evo_pg:/var/lib/postgresql/data"]
  redis:
    image: redis:7-alpine
    restart: always
volumes:
  evo_pg: {}
`;

export default function ConexaoEvolutionPanel() {
  const copy = (v: string) => { navigator.clipboard.writeText(v); toast.success("Copiado"); };

  return (
    <div className="space-y-6">
      <EvolutionStatusPanel />

      <Card>
        <CardHeader><CardTitle>Passo a passo — Evolution API self-hosted</CardTitle></CardHeader>
        <CardContent className="space-y-4 text-sm">
          <ol className="list-decimal ml-5 space-y-2">
            <li>Provisione uma VPS Linux (Hetzner, Contabo, DigitalOcean — ~R$30/mês) com Docker instalado.</li>
            <li>Aponte um subdomínio (ex.: <code>evo.seudominio.com</code>) para o IP da VPS e configure HTTPS via Caddy/Traefik/Nginx.</li>
            <li>
              Suba o serviço com o <code>docker-compose.yml</code> abaixo. Troque <code>AUTHENTICATION_API_KEY</code> por uma chave longa (será o <code>EVOLUTION_API_KEY</code>).
              <div className="mt-2 flex items-start gap-2">
                <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-64 flex-1">{DOCKER_COMPOSE}</pre>
                <Button size="icon" variant="outline" onClick={() => copy(DOCKER_COMPOSE)}><Copy className="h-4 w-4" /></Button>
              </div>
            </li>
            <li>
              Crie uma instância chamando (via curl ou Postman):{" "}
              <code className="text-xs">POST /instance/create</code> com body{" "}
              <code className="text-xs">{`{"instanceName":"radarzap","integration":"WHATSAPP-BAILEYS"}`}</code>
            </li>
            <li>
              Salve nos secrets do backend (Cloud → Secrets):
              <ul className="list-disc ml-5 mt-1">
                <li><code>EVOLUTION_API_URL</code> — ex.: <code>https://evo.seudominio.com</code></li>
                <li><code>EVOLUTION_API_KEY</code> — a chave configurada em <code>AUTHENTICATION_API_KEY</code></li>
                <li><code>EVOLUTION_INSTANCE</code> — ex.: <code>radarzap</code></li>
              </ul>
            </li>
            <li>
              No Evolution, configure o webhook para a URL exibida acima com o header{" "}
              <code>x-webhook-token</code> = valor do <code>EVOLUTION_WEBHOOK_SECRET</code> (já gerado nos secrets).
            </li>
            <li>Clique em <b>Atualizar</b> acima e escaneie o QR Code com o WhatsApp que vai ler os grupos.</li>
            <li>Vá na aba <b>Importar grupos</b> e cole os links de convite dos grupos públicos.</li>
          </ol>

          <div className="rounded border-l-4 border-amber-500 bg-amber-50 p-3 text-amber-900 text-xs">
            <b>LGPD:</b> use apenas grupos <b>públicos</b> (com link de convite aberto) e para prospecção B2B.
            Ofereça opt-out imediato no primeiro contato via WhatsApp (já suportado pelo módulo de consentimentos).
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
