import React, { useContext, useEffect, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogContent,
  Typography,
  makeStyles
} from "@material-ui/core";
import api from "../../services/api";
import { AuthContext } from "../../context/Auth/AuthContext";
import { isFreeTrialUser } from "../../helpers/trialIntegrationFilter";

const CODIGO_FONTE_URL = "https://www.vbsolutioncrm.com.br/codigo-fonte/instalar";

const useStyles = makeStyles(theme => ({
  content: {
    textAlign: "center",
    padding: theme.spacing(3, 2),
    maxWidth: 480,
    margin: "0 auto"
  },
  title: { fontWeight: 700, marginBottom: theme.spacing(1.5) },
  body: {
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(3),
    lineHeight: 1.5
  },
  cta: {
    textTransform: "none",
    fontWeight: 700,
    minHeight: 48,
    background: "#0d9488",
    color: "#fff",
    "&:hover": { background: "#0f766e" }
  }
}));

/**
 * Tela de encerramento do teste — não depende do relógio do navegador
 * (status vem do backend via trialExpiresAt).
 */
const TrialExpiredGate = () => {
  const classes = useStyles();
  const { user } = useContext(AuthContext);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isFreeTrialUser(user)) return undefined;
    let cancelled = false;
    const check = async () => {
      try {
        const { data } = await api.get("/free-trial/status");
        if (!cancelled) setOpen(Boolean(data.expired));
      } catch (err) {
        if (err?.response?.status === 402) {
          if (!cancelled) setOpen(true);
        }
      }
    };
    check();
    const id = setInterval(check, 60000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [user]);

  if (!isFreeTrialUser(user)) return null;

  return (
    <Dialog open={open} fullScreen disableEscapeKeyDown>
      <DialogContent className={classes.content}>
        <Typography className={classes.title} variant="h5" component="h1">
          Seu teste grátis encerrou
        </Typography>
        <Typography className={classes.body} component="p">
          O período de 12 horas terminou. Os dados de demonstração permanecem
          conforme a estratégia do sistema. Para continuar com o VBSolution CRM
          completo, conheça o código fonte.
        </Typography>
        <Button
          className={classes.cta}
          href={CODIGO_FONTE_URL}
          target="_blank"
          rel="noopener noreferrer"
          fullWidth
          aria-label="Conhecer o Código-Fonte"
        >
          Conhecer o Código-Fonte
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default TrialExpiredGate;
