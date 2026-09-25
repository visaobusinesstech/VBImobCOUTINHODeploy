import React from "react";
import { Box, Link, Typography, useTheme } from "@material-ui/core";
import { LobeClaudeIcon, LobeGeminiIcon, LobeGrokIcon, LobeOpenAIIcon } from "../../components/LobeBrandIcon";
import { FigmaBrandIcon } from "../../components/BrainMcpDialog/BrainMcpBrandIcons";
import MetaAdsBrandIcon from "../../components/MetaAdsBrandIcon";
import { SiGithub } from "react-icons/si";
import { OPENAI_API_KEYS_URL } from "../../components/OpenAiApiKeyHint";
import {
  ANTHROPIC_API_KEYS_URL,
  ANTHROPIC_BILLING_URL
} from "../../components/AnthropicApiKeyHint";
import {
  GOOGLE_AI_API_KEYS_URL,
  GOOGLE_AI_STUDIO_URL
} from "../../components/GeminiApiKeyHint";
import { useIntegrationAsideCardStyles } from "./integrationAsideCardStyles";

const XAI_CONSOLE_URL = "https://console.x.ai/";
const XAI_API_KEYS_URL = "https://console.x.ai/";

const OPENAI_STEPS = [
  {
    title: "Para que serve esta chave",
    body: (
      <>
        A API Key aqui é usada pelos <strong>Agentes de IA</strong> no atendimento (WhatsApp, Telegram e
        automações). O <strong>Brain.AI</strong> usa infraestrutura interna da VBSolution — não precisa de
        chave cadastrada nesta tela; o consumo é debitado dos créditos Brain (Stripe).
      </>
    )
  },
  {
    title: "Entre na plataforma OpenAI",
    body: (
      <>
        Acesse{" "}
        <Link href="https://platform.openai.com" target="_blank" rel="noopener noreferrer">
          platform.openai.com
        </Link>{" "}
        com sua conta (ou crie uma).
      </>
    )
  },
  {
    title: "Abra API Keys",
    body: (
      <>
        No menu, vá em{" "}
        <Link href={OPENAI_API_KEYS_URL} target="_blank" rel="noopener noreferrer">
          API Keys
        </Link>{" "}
        (ou Settings → API keys).
      </>
    )
  },
  {
    title: "Crie uma chave secreta",
    body: 'Clique em "Create new secret key", dê um nome (ex.: Agente WhatsApp) e confirme.'
  },
  {
    title: "Copie e cole aqui",
    body: "Copie a chave que começa com sk-… e cole no campo API Key à esquerda. Ela só aparece uma vez."
  },
  {
    title: "Salve a integração",
    body: 'Clique em Salvar. Com "Integração ativa" ligado, os agentes de IA da sua organização passam a usar esta conta no atendimento.'
  }
];

const CLAUDE_STEPS = [
  {
    title: "Para que serve esta chave",
    body: (
      <>
        A API Key Anthropic aqui alimenta os <strong>Agentes de IA Claude</strong> no atendimento e automações.
        O <strong>Brain.AI</strong> opera com infraestrutura interna da plataforma — sem necessidade de chave
        nesta conexão; o uso é cobrado via créditos Brain.
      </>
    )
  },
  {
    title: "Entre no Console Anthropic",
    body: (
      <>
        Acesse{" "}
        <Link href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer">
          console.anthropic.com
        </Link>{" "}
        e faça login.
      </>
    )
  },
  {
    title: "Abra API Keys",
    body: (
      <>
        Vá em Settings →{" "}
        <Link href={ANTHROPIC_API_KEYS_URL} target="_blank" rel="noopener noreferrer">
          API Keys
        </Link>
        .
      </>
    )
  },
  {
    title: "Crie uma chave",
    body: 'Clique em "Create Key", defina um nome e gere a chave (sk-ant-…).'
  },
  {
    title: "Créditos e billing",
    body: (
      <>
        Confira saldo em{" "}
        <Link href={ANTHROPIC_BILLING_URL} target="_blank" rel="noopener noreferrer">
          Plans &amp; Billing
        </Link>
        . Sem créditos, a API retorna erro de cota.
      </>
    )
  },
  {
    title: "Copie e cole aqui",
    body: "Cole a API Key no campo à esquerda. Para trocar a chave depois, basta colar uma nova e salvar."
  },
  {
    title: "Salve a integração",
    body: 'Ative "Claude ativo" e clique em Salvar. Depois, em Agente IA, crie um agente Claude e escolha o modelo na aba Integração do editor — essa chave não é usada pelo Brain.AI.'
  }
];

export const FIGMA_PERSONAL_ACCESS_TOKENS_URL =
  "https://www.figma.com/settings#security";

const FIGMA_STEPS = [
  {
    title: "Entre no Figma",
    body: (
      <>
        Acesse{" "}
        <Link href="https://www.figma.com" target="_blank" rel="noopener noreferrer">
          figma.com
        </Link>{" "}
        e faça login na sua conta.
      </>
    )
  },
  {
    title: "Abra as configurações de segurança",
    body: (
      <>
        No menu do avatar, vá em Settings → aba{" "}
        <Link
          href={FIGMA_PERSONAL_ACCESS_TOKENS_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          Security
        </Link>
        .
      </>
    )
  },
  {
    title: "Gere um Personal Access Token",
    body: (
      <>
        Em{" "}
        <Link
          href={FIGMA_PERSONAL_ACCESS_TOKENS_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          Personal access tokens
        </Link>
        , clique em &quot;Generate new token&quot;, defina um nome (ex.: VBsolution) e
        confirme.
      </>
    )
  },
  {
    title: "Copie o token",
    body: "O token é exibido apenas uma vez. Copie-o imediatamente e guarde em local seguro."
  },
  {
    title: "Cole no campo à esquerda",
    body: 'Cole a credencial no campo "Credencial Figma". Para trocar depois, basta colar um novo token e salvar.'
  },
  {
    title: "Salve a integração",
    body: "Ajuste as opções avançadas (Brain AI, protótipos, comentários, design system) e clique em Salvar Integração."
  }
];

const GITHUB_STEPS = [
  {
    title: "Clique em Conectar com GitHub",
    body: (
      <>
        No formulário à esquerda, use o botão{" "}
        <strong>Conectar com GitHub</strong>. Uma janela do VBSolution abrirá e
        redirecionará para a autorização oficial do GitHub.
      </>
    )
  },
  {
    title: "Entre na conta da organização",
    body: (
      <>
        Faça login no{" "}
        <Link href="https://github.com" target="_blank" rel="noopener noreferrer">
          GitHub
        </Link>{" "}
        com a conta que tem acesso aos repositórios que o Brain AI deve usar
        (conta pessoal ou usuário admin da org).
      </>
    )
  },
  {
    title: "Autorize o VBSolution",
    body: (
      <>
        Revise as permissões solicitadas (repositórios, leitura e escrita) e
        confirme em <strong>Authorize</strong>. O token fica salvo apenas na
        sua organização — não é compartilhado com outros clientes.
      </>
    )
  },
  {
    title: "Conexão concluída",
    body: (
      <>
        Após autorizar, a janela fecha automaticamente. Você verá a conta
        conectada (@usuário) e o bloco em{" "}
        <strong>Integrações → GitHub → Administrar</strong> com status
        &quot;1 conexão&quot;.
      </>
    )
  },
  {
    title: "Ajuste as permissões (opcional)",
    body: (
      <>
        Ative ou desative Brain AI, publicação de código e leitura de
        repositórios nas configurações avançadas e clique em{" "}
        <strong>Salvar Integração</strong>.
      </>
    )
  },
  {
    title: "O que a conexão habilita",
    body: (
      <>
        O Brain AI pode listar repositórios, ler arquivos e pull requests, e
        publicar código gerado no Brain para um repo GitHub. Cada organização
        conecta a própria conta — o VBSolution não acessa repos de outras contas.
      </>
    )
  }
];

const GEMINI_STEPS = [
  {
    title: "Para que serve esta chave",
    body: (
      <>
        A API Key Gemini é usada pelos <strong>Agentes de IA</strong> no atendimento (WhatsApp, Telegram e
        fluxos). O <strong>Brain.AI</strong> utiliza chaves internas da VBSolution — você não precisa
        cadastrar chave aqui para conversar no Brain; o consumo segue o plano de créditos Brain.
      </>
    )
  },
  {
    title: "Entre no Google AI Studio",
    body: (
      <>
        Acesse{" "}
        <Link href={GOOGLE_AI_STUDIO_URL} target="_blank" rel="noopener noreferrer">
          aistudio.google.com
        </Link>{" "}
        com sua conta Google.
      </>
    )
  },
  {
    title: "Abra API Keys",
    body: (
      <>
        No menu, vá em{" "}
        <Link href={GOOGLE_AI_API_KEYS_URL} target="_blank" rel="noopener noreferrer">
          Get API key
        </Link>{" "}
        (ou API Keys no Google AI Studio).
      </>
    )
  },
  {
    title: "Crie uma chave",
    body: 'Clique em "Create API key", escolha o projeto Google Cloud e confirme a geração.'
  },
  {
    title: "Cota e faturamento",
    body: (
      <>
        No AI Studio, confira uso e limites em{" "}
        <Link href={GOOGLE_AI_STUDIO_URL} target="_blank" rel="noopener noreferrer">
          Usage &amp; Billing
        </Link>
        . Projetos novos podem exigir billing ativo no Google Cloud.
      </>
    )
  },
  {
    title: "Copie e cole aqui",
    body: "Cole a API Key no campo à esquerda. Cada organização usa sua própria chave para os agentes de atendimento."
  },
  {
    title: "Salve a integração",
    body: 'Ative "Gemini ativo" e clique em Salvar. Depois vincule agentes Gemini em Agente IA e nos canais de atendimento — não é necessário para o Brain.AI.'
  }
];

const GROK_STEPS = [
  {
    title: "Para que serve esta chave",
    body: (
      <>
        A API Key da <strong>xAI (Grok)</strong> alimenta os <strong>Agentes de IA</strong> no atendimento
        (WhatsApp, Telegram etc.). No <strong>Brain.AI</strong>, a mesma chave da organização pode ser usada
        quando a plataforma não tiver chave Grok própria. Modelos são escolhidos em Agente IA e no Brain.
      </>
    )
  },
  {
    title: "Entre no console xAI",
    body: (
      <>
        Acesse{" "}
        <Link href={XAI_CONSOLE_URL} target="_blank" rel="noopener noreferrer">
          console.x.ai
        </Link>{" "}
        com sua conta xAI (ou crie uma).
      </>
    )
  },
  {
    title: "Crie uma API Key",
    body: (
      <>
        Em{" "}
        <Link href={XAI_API_KEYS_URL} target="_blank" rel="noopener noreferrer">
          API Keys
        </Link>
        , gere uma nova chave. Copie o valor completo (geralmente começa com <code>xai-</code>).
      </>
    )
  },
  {
    title: "Copie e cole aqui",
    body: "Cole a API Key no campo à esquerda. Cada organização usa sua própria chave para agentes Grok."
  },
  {
    title: "Salve a integração",
    body: 'Ative "Grok ativo" e clique em Salvar. Depois selecione um modelo Grok em Agente IA → Integração e vincule o agente ao canal de atendimento.'
  }
];

const META_ADS_STEPS = [
  {
    title: "Para que serve esta conexão",
    body: (
      <>
        O <strong>Dataset ID</strong> e o <strong>Access Token</strong> ligam o CRM ao Gerenciador de
        Eventos da Meta (Conversions API): identifica leads de Click-to-WhatsApp, mostra rastreio e
        devolve conversões Lead/Purchase. Para <strong>puxar campanhas, gasto e pixels</strong>, use
        o card <strong>Meta Ads Anúncios &amp; Pixels</strong> e a página{" "}
        <strong>Mais → Análises Ads</strong>.
      </>
    )
  },
  {
    title: "Abra o Gerenciador de Eventos",
    body: (
      <>
        Acesse{" "}
        <Link
          href="https://business.facebook.com/events_manager2"
          target="_blank"
          rel="noopener noreferrer"
        >
          business.facebook.com/events_manager2
        </Link>{" "}
        com a conta Business que gerencia seus anúncios.
      </>
    )
  },
  {
    title: "Crie ou selecione o Dataset CRM",
    body: (
      <>
        Em <strong>Conectar dados</strong>, escolha <strong>CRM</strong> (ou abra o conjunto já
        criado). O número sob o nome do dataset é o <strong>Dataset ID</strong> — copie e cole à
        esquerda.
      </>
    )
  },
  {
    title: "Gere o Access Token",
    body: (
      <>
        No dataset, vá em <strong>Configurações</strong> → <strong>API Conversões</strong> →{" "}
        <strong>Gerar token de acesso</strong>. Copie o token na hora (a Meta costuma mostrar só uma
        vez) e cole no campo Access Token.
      </>
    )
  },
  {
    title: "Onde usar no CRM",
    body: (
      <>
        Com a conexão salva: tickets de anúncio recebem tags e chip Meta Ads; leads do quadro herdam
        campanha e rastreio; ao criar lead ou fechar venda, o CRM pode enviar eventos pela Conversions
        API (se o envio estiver ativo).
      </>
    )
  },
  {
    title: "O que isso agrega",
    body: (
      <>
        Você passa a saber <strong>qual campanha e criativo</strong> geraram a conversa e a
        oportunidade, e a Meta recebe o resultado da venda para otimizar o investimento em mídia —
        sem depender só do seletor manual de origem.
      </>
    )
  },
  {
    title: "Teste (opcional)",
    body: (
      <>
        Na aba <strong>Testar eventos</strong> do dataset, copie o código de teste e cole em Test
        Event Code só durante homologação. Em produção, deixe em branco.
      </>
    )
  }
];

const META_ADS_INSIGHTS_STEPS = [
  {
    title: "Para que serve",
    body: (
      <>
        Esta conexão usa a <strong>Marketing API</strong> para <strong>ler</strong> campanhas,
        anúncios, pixels e métricas (gasto, CTR, impressões). Alimenta a página{" "}
        <strong>Análises Ads</strong> no menu Mais. É diferente da integração Meta Ads (CAPI),
        que só envia conversões.
      </>
    )
  },
  {
    title: "Abra o app da sua empresa na Meta",
    body: (
      <>
        Acesse{" "}
        <Link href="https://developers.facebook.com/apps/" target="_blank" rel="noopener noreferrer">
          developers.facebook.com/apps
        </Link>
        , entre com o administrador do negócio e abra o app usado pela empresa. Se ainda não existir,
        clique em <strong>Criar aplicativo</strong> e escolha o tipo <strong>Business</strong>.
        Depois copie o <strong>App ID</strong> exibido no painel do app.
      </>
    )
  },
  {
    title: "Copie o ID da conta de anúncios",
    body: (
      <>
        Abra <strong>Configurações do negócio → Contas → Contas de anúncios</strong>, ou use{" "}
        <Link
          href="https://business.facebook.com/settings/ad-accounts"
          target="_blank"
          rel="noopener noreferrer"
        >
          business.facebook.com/settings/ad-accounts
        </Link>
        . Clique na conta que deseja analisar e copie o ID mostrado nos detalhes. Você pode colar
        aqui como <strong>act_123…</strong> ou somente os números.
      </>
    )
  },
  {
    title: "Crie um Usuário do sistema e dê acesso à conta",
    body: (
      <>
        Em{" "}
        <Link
          href="https://business.facebook.com/settings/system-users"
          target="_blank"
          rel="noopener noreferrer"
        >
          Configurações do Business → Usuários do sistema
        </Link>
        , clique em <strong>Adicionar</strong>, dê um nome (por exemplo, “VBSolution”) e escolha a
        função <strong>Administrador</strong>. Com esse usuário selecionado, clique em{" "}
        <strong>Adicionar ativos → Contas de anúncios</strong>, marque a conta correta e permita
        gerenciar ou visualizar campanhas.
      </>
    )
  },
  {
    title: "Gere e copie o token permanente",
    body: (
      <>
        Ainda no Usuário do sistema, clique em <strong>Gerar novo token</strong>, selecione o app da
        etapa anterior e marque <strong>ads_read</strong>. Marque também{" "}
        <strong>business_management</strong> quando disponível. Clique em{" "}
        <strong>Gerar token</strong> e copie o valor imediatamente — a Meta não volta a mostrar o
        token completo depois que a janela é fechada.
      </>
    )
  },
  {
    title: "Só para teste: use o Graph API Explorer",
    body: (
      <>
        Em{" "}
        <Link
          href="https://developers.facebook.com/tools/explorer/"
          target="_blank"
          rel="noopener noreferrer"
        >
          developers.facebook.com/tools/explorer
        </Link>
        , selecione o mesmo app, abra <strong>Adicionar uma permissão</strong>, marque{" "}
        <code>ads_read</code> e gere o token. Esse token de usuário costuma expirar e serve apenas
        para validar rapidamente; para uso contínuo, prefira o token do Usuário do sistema.
      </>
    )
  },
  {
    title: "Business ID (opcional)",
    body: (
      <>
        Em{" "}
        <Link
          href="https://business.facebook.com/settings/info"
          target="_blank"
          rel="noopener noreferrer"
        >
          business.facebook.com/settings/info
        </Link>{" "}
        você encontra o ID do portfólio Business.
      </>
    )
  },
  {
    title: "Várias contas via OAuth",
    body: (
      <>
        Em Integrações → Meta Ads, o botão <strong>Conectar outra conta via OAuth</strong> (ao
        lado de Criar conexão) abre o login do Facebook, lista as contas de anúncios e cria os
        cards de Gerenciador de Eventos e Anúncios &amp; Pixels. No dashboard{" "}
        <strong>Análises Ads</strong> use o filtro <strong>Conta Meta Ads</strong> para alternar.
      </>
    )
  },
  {
    title: "Cole os dados, teste e salve",
    body: (
      <>
        Volte a esta tela, cole o <strong>Access Token</strong> e o{" "}
        <strong>Ad Account ID</strong>, depois clique em <strong>Testar conexão</strong>. Se o teste
        confirmar a conta, clique em <strong>Salvar</strong> e abra{" "}
        <strong>Mais → Análises Ads</strong> para conferir as campanhas e métricas.
      </>
    )
  }
];

const PROVIDER_META = {
  openai: {
    icon: (size) => <LobeOpenAIIcon size={size} />,
    subtitle: "OpenAI Platform — passo a passo"
  },
  anthropic: {
    icon: (size) => <LobeClaudeIcon size={size} />,
    subtitle: "Anthropic Console — passo a passo"
  },
  gemini: {
    icon: (size) => <LobeGeminiIcon size={size} />,
    subtitle: "Google AI Studio — passo a passo"
  },
  grok: {
    icon: (size) => <LobeGrokIcon size={size} />,
    subtitle: "xAI Console — passo a passo"
  },
  figma: {
    icon: (size) => <FigmaBrandIcon size={size} />,
    subtitle: "Figma — Personal Access Token"
  },
  github: {
    icon: (size, isDark) => (
      <SiGithub size={size} color={isDark ? "#f4f4f5" : "#181717"} />
    ),
    subtitle: "GitHub — autorização OAuth da organização"
  },
  "meta-ads": {
    icon: (size) => <MetaAdsBrandIcon size={size} color="#0081FB" />,
    subtitle: "Events Manager — Dataset e Conversions API"
  },
  "meta-ads-insights": {
    icon: (size) => <MetaAdsBrandIcon size={size} color="#0081FB" />,
    subtitle: "Marketing API — campanhas, anúncios e pixels"
  }
};

export default function IntegrationApiKeyGuidePanel({ provider }) {
  const classes = useIntegrationAsideCardStyles();
  const theme = useTheme();
  const key =
    provider === "openai"
      ? "openai"
      : provider === "gemini"
        ? "gemini"
        : provider === "grok"
          ? "grok"
          : provider === "figma"
            ? "figma"
            : provider === "github"
              ? "github"
              : provider === "meta-ads"
                ? "meta-ads"
                : provider === "meta-ads-insights"
                  ? "meta-ads-insights"
                : "anthropic";
  const steps =
    key === "openai"
      ? OPENAI_STEPS
      : key === "gemini"
        ? GEMINI_STEPS
        : key === "grok"
          ? GROK_STEPS
          : key === "figma"
            ? FIGMA_STEPS
            : key === "github"
              ? GITHUB_STEPS
              : key === "meta-ads"
                ? META_ADS_STEPS
                : key === "meta-ads-insights"
                  ? META_ADS_INSIGHTS_STEPS
                : CLAUDE_STEPS;
  const meta = PROVIDER_META[key];
  const guideTitle =
    key === "figma"
      ? "Como obter a credencial"
      : key === "github"
        ? "Como conectar o GitHub"
        : key === "meta-ads"
          ? "Como conectar o Meta Ads"
          : key === "meta-ads-insights"
            ? "Como conectar Anúncios & Pixels"
          : "Como obter a API Key";

  return (
    <Box className={classes.root}>
      <div className={classes.head}>
        {meta.icon(32, theme.palette.type === "dark")}
        <div>
          <Typography className={classes.headTitle} style={{ color: theme.palette.text.primary }}>
            {guideTitle}
          </Typography>
          <Typography className={classes.headSub}>{meta.subtitle}</Typography>
        </div>
      </div>
      <ol className={classes.steps}>
        {steps.map((step, idx) => (
          <li key={step.title} className={classes.step}>
            <span className={classes.stepNum}>{idx + 1}</span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <Typography className={classes.stepTitle} style={{ color: theme.palette.text.primary }}>
                {step.title}
              </Typography>
              <Typography component="div" className={classes.stepBody}>
                {step.body}
              </Typography>
            </div>
          </li>
        ))}
      </ol>
    </Box>
  );
}
