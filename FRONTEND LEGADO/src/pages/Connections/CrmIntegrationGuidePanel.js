import React from "react";
import { Box, Typography, useTheme } from "@material-ui/core";
import IntegrationBrandIcon, { getBrandVisual } from "./IntegrationBrandIcon";
import { getIntegrationByKey } from "./integrationCatalog";
import { useIntegrationAsideCardStyles } from "./integrationAsideCardStyles";
import { CRM_MODULES_DOC } from "../../config/crmIntegrationProviders";

const MODULES = (
  <>
    <strong>{CRM_MODULES_DOC}</strong>
  </>
);

const SYNC_ACTION = (
  <>
    Use <strong>Importar</strong> em cada módulo — a importação respeita a página em que você
    está (leads, atividades, projetos, etc.) e roda na hora via API direta.
  </>
);

const CRM_GUIDES = {
  hubspot: {
    subtitle: "Leads · Atividades · Empresas · Produtos",
    steps: [
      {
        title: "Conecte com OAuth",
        body: (
          <>
            Clique em <strong>Conectar conta HubSpot</strong>. Autorize o portal da sua
            organização — tokens renovam automaticamente e ficam criptografados por workspace.
          </>
        )
      },
      {
        title: "O que esta conexão faz",
        body: (
          <>
            Importa negócios (deals), tarefas, empresas e produtos do HubSpot para Leads e Vendas,
            Atividades, Leads Convertidos (empresas) e Inventário no VBSolution.
          </>
        )
      },
      {
        title: "Como a integração funciona",
        body: (
          <>
            {SYNC_ACTION} Em cada módulo, use <strong>Importar</strong>: negócios em Leads e
            Vendas; tarefas em Atividades; empresas HubSpot em Leads Convertidos; produtos em
            Inventário. Não importa contatos, calendário/agenda nem projetos.
          </>
        )
      },
      {
        title: "O que ela desempenha",
        body: (
          <>
            Leads, atividades, empresas convertidas e produtos — conforme o módulo aberto no
            VBSolution. Se empresas ou produtos falharem, desconecte e reconecte para aplicar as
            permissões novas do app OAuth.
          </>
        )
      }
    ],
    footnote:
      "OAuth exclusivo. Importação de negócios, tarefas, empresas e produtos do HubSpot."
  },
  clickup: {
    subtitle: "Atividades · Projetos (listas/spaces)",
    steps: [
      {
        title: "Conecte com OAuth",
        body: (
          <>
            Use <strong>Conectar conta ClickUp</strong> para autorizar o workspace. Team ID e
            permissões são detectados na autorização — sem configuração manual.
          </>
        )
      },
      {
        title: "O que esta conexão faz",
        body: (
          <>
            Importa tarefas e listas (projetos) do ClickUp para Atividades e Projetos no
            VBSolution. ClickUp não tem leads, contatos nem inventário CRM.
          </>
        )
      },
      {
        title: "Como a integração funciona",
        body: (
          <>
            {SYNC_ACTION} Tasks viram atividades; listas dentro de folders/spaces viram
            projetos. Use HubSpot ou Pipedrive para leads e contatos.
          </>
        )
      },
      {
        title: "O que ela desempenha",
        body: (
          <>
            Atividades e projetos — de acordo com o módulo aberto no VBSolution. Ideal para
            equipes que operam entrega e tarefas no workspace ClickUp.
          </>
        )
      }
    ],
    footnote:
      "OAuth exclusivo. Importação de atividades e projetos (listas) do ClickUp."
  },
  pipedrive: {
    subtitle: "Leads · Atividades · Projetos",
    steps: [
      {
        title: "Conecte com OAuth",
        body: (
          <>
            Clique em <strong>Conectar conta Pipedrive</strong> e autorize a conta comercial da
            organização. Domínio e tokens vêm do OAuth.
          </>
        )
      },
      {
        title: "O que esta conexão faz",
        body: (
          <>
            Importa Leads Inbox, negócios (deals), atividades e projetos do Pipedrive para Leads
            e Vendas, Atividades e Projetos no VBSolution.
          </>
        )
      },
      {
        title: "Como a integração funciona",
        body: (
          <>
            {SYNC_ACTION} Deals e leads da inbox alimentam Leads e Vendas; atividades comerciais
            viram Atividades; projetos (add-on Projects) viram Projetos. Não importa contatos,
            calendário/agenda nem inventário.
          </>
        )
      },
      {
        title: "O que ela desempenha",
        body: (
          <>
            Leads, atividades e projetos — conforme o módulo ativo. Uma conta Pipedrive por
            organização, dados isolados por workspace.
          </>
        )
      }
    ],
    footnote:
      "OAuth exclusivo. Importação de leads, atividades e projetos do Pipedrive."
  },
  notion: {
    subtitle: "Reuniões · Anotações · Páginas · Wikis",
    steps: [
      {
        title: "Conecte com OAuth",
        body: (
          <>
            Use <strong>Conectar conta Notion</strong> para autorizar o workspace compartilhado
            com a integração. No seletor do Notion, marque as páginas e bases que deseja importar.
          </>
        )
      },
      {
        title: "O que esta conexão faz",
        body: (
          <>
            Importa páginas, wikis e bases para a base de conhecimento dos agentes IA, e traz
            atividades/tarefas das bases compartilhadas para o módulo <strong>Atividades</strong>.
            Complementa {MODULES} com documentação e operação.
          </>
        )
      },
      {
        title: "Como a integração funciona",
        body: (
          <>
            Importação <strong>somente de entrada</strong> (Notion → VBSolution). Use{" "}
            <strong>Importar</strong> no <strong>Calendário</strong> para reuniões e em{" "}
            <strong>Atividades</strong> para anotações. No OAuth, compartilhe as páginas certas.
          </>
        )
      },
      {
        title: "O que ela desempenha",
        body: (
          <>
            Ingestão de páginas, indexação para agentes IA, consulta via MCP e importação de
            tarefas de bases Notion. Enriquece decisões em todos os módulos CRM sem exportar dados
            operacionais para o Notion.
          </>
        )
      }
    ],
    footnote:
      "OAuth exclusivo. Importação de conhecimento e atividades — sync de leads/produtos via HubSpot, ClickUp ou Pipedrive."
  },
  supabase: {
    subtitle: "Brain IDE Build · OAuth · Postgres",
    compact: true,
    steps: [
      {
        title: "Conecte com OAuth",
        body: (
          <>
            Clique em <strong>Conectar conta Supabase</strong>. O cliente autoriza o acesso aos
            projetos da organização via OAuth do Supabase Management API.
          </>
        )
      },
      {
        title: "Brain.AI IDE Build",
        highlight: "ideBuild",
        body: (
          <>
            Principal uso desta conexão: no <strong>Brain.AI</strong>, abra o modo{" "}
            <strong>IDE Build</strong> e use <strong>Conecte ao Supabase</strong> para vincular o
            projeto da organização. Publique telas e código gerados pelo Brain direto no Postgres,
            auth e storage do Supabase — sem copiar credenciais manualmente.
          </>
        )
      },
      {
        title: "O que mais ela oferece",
        body: (
          <>
            Além do IDE Build, a conexão permite mirror opcional do CRM na tabela{" "}
            <code>vb_crm_mirror</code> e consulta de dados de {MODULES} no ecossistema
            VBSolution.
          </>
        )
      },
      {
        title: "Após conectar",
        body: (
          <>
            O sistema lista os projetos autorizados e obtém as API keys. Cada workspace usa a
            própria conta Supabase — tokens criptografados e isolados por organização.
          </>
        )
      }
    ],
    footnote:
      "OAuth via Supabase Dashboard → OAuth Apps. Callback no backend Railway."
  }
};

export default function CrmIntegrationGuidePanel({ providerKey, oauthOnly = false }) {
  const classes = useIntegrationAsideCardStyles();
  const theme = useTheme();
  const integration = getIntegrationByKey(providerKey);
  const guide = CRM_GUIDES[providerKey] || CRM_GUIDES.hubspot;
  const visual = getBrandVisual(integration);
  const steps = oauthOnly
    ? guide.steps.filter((step) => !/^Alternativa:/i.test(step.title))
    : guide.steps;

  return (
    <Box className={`${classes.root} ${guide.compact ? classes.rootCompact : ""}`}>
      <div className={classes.head}>
        <IntegrationBrandIcon
          brandKey={visual.brandKey}
          variant="list"
          accentColor={visual.accent}
          plain
        />
        <div>
          <Typography className={classes.headTitle} style={{ color: theme.palette.text.primary }}>
            Como conectar {integration?.label || providerKey}
          </Typography>
          <Typography className={classes.headSub}>{guide.subtitle}</Typography>
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
              {step.highlight === "ideBuild" ? (
                <div className={classes.ideBuildCallout}>
                  <span className={classes.ideBuildLabel}>Brain.AI · IDE Build</span>
                  <Typography component="div" className={classes.ideBuildText}>
                    {step.body}
                  </Typography>
                </div>
              ) : (
                <Typography component="div" className={classes.stepBody}>
                  {step.body}
                </Typography>
              )}
            </div>
          </li>
        ))}
      </ol>
      {guide.footnote ? (
        <Typography className={classes.footnote}>{guide.footnote}</Typography>
      ) : null}
    </Box>
  );
}
