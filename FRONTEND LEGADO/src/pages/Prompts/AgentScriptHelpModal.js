import React, { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  IconButton,
  Typography,
  Box,
  Button,
  Snackbar
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import CloseIcon from "@material-ui/icons/Close";
import FileCopyOutlined from "@material-ui/icons/FileCopyOutlined";

const useStyles = makeStyles((theme) => ({
  paper: {
    borderRadius: 14,
    overflow: "hidden",
    maxWidth: 520,
    margin: theme.spacing(2),
    boxShadow:
      theme.palette.type === "dark"
        ? "0 24px 80px rgba(0,0,0,0.55)"
        : "0 24px 80px rgba(0,0,0,0.12), 0 0 1px rgba(0,0,0,0.08)"
  },
  titleRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: theme.spacing(2, 2, 1, 2.5),
    borderBottom:
      theme.palette.type === "dark" ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.06)"
  },
  title: {
    fontWeight: 600,
    fontSize: "1.05rem",
    letterSpacing: "-0.02em"
  },
  body: {
    padding: theme.spacing(2, 2.5, 2.5),
    maxHeight: "min(72vh, 640px)",
    overflowY: "auto",
    ...theme.scrollbarStyles
  },
  section: {
    marginBottom: theme.spacing(2)
  },
  sectionTitle: {
    fontWeight: 600,
    fontSize: "0.8125rem",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(0.75)
  },
  paragraph: {
    fontSize: "0.9375rem",
    lineHeight: 1.55,
    color: theme.palette.text.secondary
  },
  chatgptPaper: {
    marginTop: theme.spacing(2),
    padding: theme.spacing(1.5),
    borderRadius: 10,
    backgroundColor:
      theme.palette.type === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
    border:
      theme.palette.type === "dark" ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.06)"
  },
  chatgptPre: {
    margin: 0,
    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
    fontSize: "0.72rem",
    lineHeight: 1.5,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    color: theme.palette.text.primary,
    maxHeight: "min(48vh, 420px)",
    overflow: "auto",
    ...theme.scrollbarStyles
  },
  copyBtn: {
    textTransform: "none",
    borderRadius: 10,
    marginTop: theme.spacing(1)
  }
}));

/** Texto para colar no ChatGPT (ou similar) e gerar roteiros compatíveis com o agente VB Solution. */
export const CHATGPT_SCRIPT_GENERATION_BRIEFING = `Você é especialista em roteiros de atendimento por mensagens para a plataforma VB Solution.

TAREFA: Escrever um roteiro em português (Brasil) para um agente de IA conduzir conversas. O sistema VB interpreta o texto por significado, separa etapas por marcadores e sincroniza com o fluxo visual (perguntas aguardam resposta antes de avançar).

REGRAS DE ESTRUTURA (obrigatório):
1) Cada NOVA ETAPA começa em uma linha própria com UM destes formatos:
   - Linha contendo apenas: ---
   - OU linha com # marcando etapa, por exemplo:
     # ETAPA 1 — Boas-vindas
     # PASSO: Qualificação
     # PRÓXIMA ETAPA
     # 1. Saudação
     # 2) Coleta de dados

2) Dentro da mesma etapa, parágrafos e linhas em branco à vontade — isso NÃO cria etapa nova.

3) Condições sem IF/ELSE técnico. Use:
   - EXEMPLO DE RESPOSTA DO LEAD: (aspas ou texto de exemplo) — isso é SÓ ilustração de FORMATO (como o cliente pode escrever), não uma frase obrigatória nem a única resposta válida; na vida real ele pode dizer “dia 31/05”, “final de julho”, etc.
   - Cenários em linguagem natural (“se o cliente disser sim…”, “se preferir não…”)
   - Sim/não no texto corrido

4) Opcional: blocos Mensagem: (fala ao cliente) e, após exemplos do lead, RESPOSTA: (fala do agente naquele ramo — também é modelo do autor, não texto fixo que o sistema exige do cliente).

5) Ações automáticas: linha isolada com /slug (ex.: /agendamento). Não invente slugs — o operador cadastra em “Ações inteligentes”.
6) Mídias anexadas: linha isolada com #slug (ex.: #catalogo) — o slug deve bater com a mídia cadastrada. URLs no texto são texto comum (o / da URL não dispara comando).
7) Quebras:
   - Quebra simples = mesma bolha WhatsApp
   - Linha em branco = bolha nova
   - Linha só com "-" = mesma bolha com parágrafo (espaço entre blocos)
   - Linha só com — = mesma bolha, só quebra visual

COMPORTAMENTO NA CONVERSA REAL (obrigatório — o VB aplica isto):
- Uma coisa principal por envio ao cliente: não condense várias etapas em uma única mensagem.
- SEQUÊNCIA PERGUNTA → RESPOSTA DO CLIENTE → PRÓXIMO CONTEÚDO:
  • Se o agente faz uma pergunta ou pede um dado (data, quantidade, escolha), qualquer texto que dependa dessa resposta deve ficar na ETAPA SEGUINTE ou no ramo RESPOSTA: depois do EXEMPLO DO LEAD correspondente — nunca na mesma mensagem da pergunta.
  • Não escreva na mesma mensagem em que há pergunta frases que assumam que o cliente já respondeu (ex.: “Perfeito, vou verificar as opções para esse período” antes de ele informar a data).
  • Depois de pedir informação, confirmações, ofertas e linhas /comando vêm só quando fizer sentido após o cliente ter respondido — separe em etapa ou ramo RESPOSTA:.
- Comandos /slug no fim de etapa costumam executar após o cliente cumprir o pedido da etapa (ex.: data para /agendamento); posicione o comando na etapa correta (idealmente após EXEMPLO… / RESPOSTA: no mesmo passo, antes do --- da próxima etapa).

MAPA DE CORREÇÕES (sintomas frequentes):
- Cliente enviou data/período na etapa certa mas NÃO apareceu evento em Agendas/Schedules: (1) confirme “Ação inteligente” com tipo/slug compatível com /agendamento; (2) teste pelo canal de mensagens — o fluxo que agenda após a resposta do cliente roda no pipeline de mensagem recebida do atendimento; o chat interno do ticket no painel pode avançar o roteiro pela IA sem executar essa mesma etapa de ação.
- “EXEMPLO DE RESPOSTA” não é a resposta exata que o agente “espera” do cliente — é exemplo de formato; respostas diferentes no mesmo sentido devem contar.

Saída: apenas o roteiro, sem prefácio nem explicações fora do texto que o operador colará no editor VB.`;

export default function AgentScriptHelpModal({ open, onClose }) {
  const classes = useStyles();
  const [snack, setSnack] = useState(false);

  const copyBriefing = useCallback(() => {
    const t = CHATGPT_SCRIPT_GENERATION_BRIEFING;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t).then(() => setSnack(true));
    }
  }, []);

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="sm"
        fullWidth
        classes={{ paper: classes.paper }}
        BackdropProps={{
          style: { backdropFilter: "blur(8px)", backgroundColor: "rgba(0,0,0,0.35)" }
        }}
      >
        <div className={classes.titleRow}>
          <Typography component="h2" className={classes.title}>
            Roteiro — o que você pode fazer
          </Typography>
          <IconButton aria-label="Fechar" size="small" onClick={onClose}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </div>
        <DialogContent className={classes.body}>
          <Box className={classes.section}>
            <Typography className={classes.sectionTitle}>Para que serve</Typography>
            <Typography className={classes.paragraph} component="div">
              O roteiro é o mapa da conversa: saudação, perguntas, envio de PDF/imagem, agendamento e
              transferência. A IA lê o sentido — não precisa de código. Você descreve o atendimento como
              falaria com um vendedor bom: claro, humano e em etapas.
            </Typography>
          </Box>
          <Box className={classes.section}>
            <Typography className={classes.sectionTitle}>O que o agente ganha com isso</Typography>
            <Typography className={classes.paragraph} component="div">
              Qualifica o lead, envia material na hora certa, agenda reunião e mantém o tom da sua marca.
              Com <strong>Contexto do roteiro</strong> (aba à direita), você diz quando seguir o fluxo e quando
              só ouvir — assim um “quero ajuda” não vira a etapa 1 automaticamente.
            </Typography>
          </Box>
          <Box className={classes.section}>
            <Typography className={classes.sectionTitle}>Como montar etapas</Typography>
            <Typography className={classes.paragraph} component="div">
              Separe fases com <strong>---</strong> ou <strong># ETAPA 1</strong>, <strong># PASSO</strong>,{" "}
              <strong># 1. Título</strong>. Espaço entre parágrafos não cria etapa nova — só organiza a fala.
            </Typography>
          </Box>
          <Box className={classes.section}>
            <Typography className={classes.sectionTitle}>Bolhas no WhatsApp</Typography>
            <Typography className={classes.paragraph} component="div">
              Quebra simples = mesma bolha. Linha em branco (vazia) = bolha nova. Linha só com{" "}
              <strong>-</strong> = mesma bolha, com espaço entre parágrafos. Linha só com{" "}
              <strong>—</strong> = mesma bolha, só quebra visual.
            </Typography>
          </Box>
          <Box className={classes.section}>
            <Typography className={classes.sectionTitle}>Mídias e ações</Typography>
            <Typography className={classes.paragraph} component="div">
              Cadastre o PDF/imagem em Mídias e use <strong>#slug</strong> na etapa (ex.:{" "}
              <strong>#APRESENTACAO</strong>). Ações como agenda ficam em Ações inteligentes e no roteiro como{" "}
              <strong>/agendamento</strong>. Salve o agente depois de anexar a mídia.
            </Typography>
          </Box>
          <Box className={classes.section}>
            <Typography className={classes.sectionTitle}>Pergunta → resposta → próximo passo</Typography>
            <Typography className={classes.paragraph} component="div">
              Se você pergunta algo, o que depende da resposta (confirmação, PDF, /comando) vai na{" "}
              <strong>próxima etapa</strong> ou no ramo <strong>RESPOSTA:</strong> — não na mesma mensagem da
              pergunta.
            </Typography>
          </Box>
          <Box className={classes.section}>
            <Typography className={classes.sectionTitle}>Gerar com ChatGPT</Typography>
            <Typography className={classes.paragraph} component="div" paragraph>
              Copie o bloco abaixo, peça para adaptar ao seu negócio e cole o resultado no editor. Atalhos:{" "}
              <strong>?</strong>, <strong>F1</strong> ou <strong>Ctrl+?</strong> no campo do roteiro.
            </Typography>
            <div className={classes.chatgptPaper}>
              <pre className={classes.chatgptPre}>{CHATGPT_SCRIPT_GENERATION_BRIEFING}</pre>
            </div>
            <Button
              fullWidth
              variant="outlined"
              className={classes.copyBtn}
              startIcon={<FileCopyOutlined />}
              onClick={copyBriefing}
            >
              Copiar instruções para o ChatGPT
            </Button>
          </Box>
        </DialogContent>
      </Dialog>
      <Snackbar
        open={snack}
        autoHideDuration={2200}
        onClose={() => setSnack(false)}
        message="Copiado para a área de transferência"
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </>
  );
}
