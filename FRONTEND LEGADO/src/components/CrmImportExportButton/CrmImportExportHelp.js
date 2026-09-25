import React, { useState } from "react";
import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
  makeStyles
} from "@material-ui/core";
import { HelpCircle, X } from "lucide-react";
import { CRM_MODULES_DOC } from "../../config/crmIntegrationProviders";

const NAVY = "#1e3a8a";

const useStyles = makeStyles((theme) => {
  const isDark = theme.palette.type === "dark";
  return {
    helpBtn: {
      color: isDark ? "rgba(255,255,255,0.85)" : NAVY,
      padding: 6,
      "&:hover": { background: isDark ? "rgba(255,255,255,0.08)" : "rgba(30,58,138,0.08)" }
    },
    paper: {
      borderRadius: 16,
      maxWidth: 560
    },
    section: {
      marginTop: 16,
      padding: "12px 14px",
      borderRadius: 12,
      background: isDark ? "rgba(255,255,255,0.04)" : "rgba(15,23,42,0.03)",
      border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.06)"}`
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: 700,
      marginBottom: 8,
      color: theme.palette.text.primary
    },
    body: {
      fontSize: 12.5,
      lineHeight: 1.55,
      color: theme.palette.text.secondary
    },
    step: {
      display: "flex",
      gap: 10,
      marginBottom: 10,
      "&:last-child": { marginBottom: 0 }
    },
    stepNum: {
      width: 22,
      height: 22,
      borderRadius: "50%",
      flexShrink: 0,
      display: "grid",
      placeItems: "center",
      fontSize: 11,
      fontWeight: 700,
      color: "#fff",
      background: NAVY
    },
    matrix: {
      width: "100%",
      borderCollapse: "collapse",
      fontSize: 11,
      marginTop: 8,
      "& th, & td": {
        padding: "6px 8px",
        borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.06)"}`,
        textAlign: "left"
      },
      "& th": { fontWeight: 700, color: theme.palette.text.primary },
      "& td": { color: theme.palette.text.secondary }
    },
    warn: {
      marginTop: 12,
      padding: "10px 12px",
      borderRadius: 10,
      fontSize: 11.5,
      lineHeight: 1.45,
      color: isDark ? "#fbbf24" : "#92400e",
      background: isDark ? "rgba(251,191,36,0.12)" : "rgba(245,158,11,0.1)",
      border: `1px solid ${isDark ? "rgba(251,191,36,0.25)" : "rgba(245,158,11,0.25)"}`
    }
  };
});

const STEPS = [
  "Vá em Integrações → Conexões e conecte o CRM (OAuth). Faça isso uma vez por provedor.",
  "Abra Importar no módulo certo: Leads e Vendas, Atividades, Leads Convertidos (empresas HubSpot), Inventário ou Projetos.",
  "Escolha o CRM conectado e confirme. A importação usa a API direta — sem Agente IA / Brain."
];

const HUBSPOT_MAP = [
  "Negócios (deals) → Leads e Vendas",
  "Tarefas → Atividades",
  "Empresas HubSpot → Leads Convertidos (/leads-convertidos)",
  "Produtos → Inventário"
];

const LIMITATIONS = [
  {
    crm: "HubSpot",
    note: "Negócios, tarefas, empresas e produtos. Sem contatos, calendário/agenda nem projetos."
  },
  {
    crm: "Pipedrive",
    note: "Leads Inbox, negócios (deals), atividades e projetos (add-on Projects). Sem contatos, calendário nem inventário."
  },
  {
    crm: "ClickUp",
    note: "Tarefas e projetos (listas/spaces). Não tem leads, deals nem empresas CRM."
  },
  {
    crm: "Notion",
    note: "Calendário: reuniões. Atividades: anotações e tarefas. Projetos: páginas, subpáginas e anotações com “projeto” no nome. Brain: páginas/notas. Não exporta."
  }
];

function HelpContent({ classes }) {
  return (
    <>
      <div className={classes.section}>
        <Typography className={classes.sectionTitle}>Para que serve</Typography>
        <Typography className={classes.body}>
          Traz dados de CRMs externos para o VBSolution ({CRM_MODULES_DOC}). Cada módulo tem seu
          botão Importar — use o módulo que corresponde ao tipo de dado no CRM de origem.
        </Typography>
      </div>

      <div className={classes.section}>
        <Typography className={classes.sectionTitle}>Passo a passo</Typography>
        {STEPS.map((text, i) => (
          <div key={text} className={classes.step}>
            <span className={classes.stepNum}>{i + 1}</span>
            <Typography className={classes.body}>{text}</Typography>
          </div>
        ))}
      </div>

      <div className={classes.section}>
        <Typography className={classes.sectionTitle}>HubSpot — onde importar cada coisa</Typography>
        {HUBSPOT_MAP.map((line) => (
          <Typography key={line} className={classes.body} style={{ marginBottom: 4 }}>
            • {line}
          </Typography>
        ))}
      </div>

      <div className={classes.section}>
        <Typography className={classes.sectionTitle}>O que cada CRM importa</Typography>
        <table className={classes.matrix}>
          <thead>
            <tr>
              <th>CRM</th>
              <th>Leads</th>
              <th>Atividades</th>
              <th>Empresas</th>
              <th>Produtos</th>
              <th>Projetos</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>HubSpot</td>
              <td>Sim</td>
              <td>Sim</td>
              <td>Sim*</td>
              <td>Sim*</td>
              <td>Não</td>
            </tr>
            <tr>
              <td>Pipedrive</td>
              <td>Sim</td>
              <td>Sim</td>
              <td>Não</td>
              <td>Não</td>
              <td>Sim</td>
            </tr>
            <tr>
              <td>ClickUp</td>
              <td>Não</td>
              <td>Sim</td>
              <td>Não</td>
              <td>Não</td>
              <td>Sim</td>
            </tr>
            <tr>
              <td>Notion</td>
              <td>Não</td>
              <td>Sim</td>
              <td>Não</td>
              <td>Não</td>
              <td>Sim*</td>
            </tr>
          </tbody>
        </table>
        {LIMITATIONS.map((item) => (
          <Typography key={item.crm} className={classes.body} style={{ marginTop: 10 }}>
            <strong>{item.crm}:</strong> {item.note}
          </Typography>
        ))}
        <div className={classes.warn}>
          * HubSpot empresas/produtos: se aparecer erro de permissões, desconecte e reconecte o
          HubSpot em Integrações → Conexões para autorizar os scopes novos. Empresas HubSpot só
          entram em Leads Convertidos — não use a página Contatos para isso.
        </div>
      </div>

      <div className={classes.section}>
        <Typography className={classes.sectionTitle}>Ícone de origem</Typography>
        <Typography className={classes.body}>
          Registros importados de um CRM exibem o ícone do provedor em cards e listas. Dados criados
          manualmente no VBSolution não mostram ícone.
        </Typography>
      </div>
    </>
  );
}

export function CrmImportExportHelpButton({ className, light = false }) {
  const classes = useStyles();
  const [open, setOpen] = useState(false);

  return (
    <>
      <IconButton
        size="small"
        className={className || classes.helpBtn}
        style={light ? { color: "rgba(255,255,255,0.9)" } : undefined}
        onClick={() => setOpen(true)}
        aria-label="Ajuda importar CRM"
      >
        <HelpCircle size={17} />
      </IconButton>
      <Dialog open={open} onClose={() => setOpen(false)} classes={{ paper: classes.paper }} maxWidth="sm" fullWidth>
        <DialogTitle style={{ paddingBottom: 8 }}>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Typography style={{ fontWeight: 700, fontSize: 15 }}>Importar CRM</Typography>
            <IconButton size="small" onClick={() => setOpen(false)}>
              <X size={16} />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent style={{ paddingTop: 0 }}>
          <HelpContent classes={classes} />
        </DialogContent>
      </Dialog>
    </>
  );
}

export default CrmImportExportHelpButton;
