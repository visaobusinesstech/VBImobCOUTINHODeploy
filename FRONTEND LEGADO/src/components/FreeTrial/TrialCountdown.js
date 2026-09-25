import React, { useContext } from "react";
import { Box, Button, Typography, makeStyles } from "@material-ui/core";
import { AuthContext } from "../../context/Auth/AuthContext";
import { isFreeTrialUser } from "../../helpers/trialIntegrationFilter";

const CODIGO_FONTE_URL = "https://www.vbsolutioncrm.com.br/codigo-fonte/instalar";

/**
 * Faixa fina permanente no topo — aviso de Teste Grátis + CTA Instalar Agora.
 */
const useStyles = makeStyles(theme => {
  const isDark = theme?.mode === "dark" || theme?.palette?.type === "dark";

  return {
    wrap: {
      position: "sticky",
      top: 0,
      zIndex: 20,
      width: "100%",
      boxSizing: "border-box",
      flexShrink: 0
    },
    bar: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing(1),
      flexWrap: "nowrap",
      minHeight: 22,
      padding: theme.spacing(0.2, 1.25),
      background: isDark
        ? "rgba(185, 28, 28, 0.72)"
        : "rgba(185, 28, 28, 0.82)",
      backdropFilter: "saturate(140%) blur(8px)",
      WebkitBackdropFilter: "saturate(140%) blur(8px)",
      borderBottom: isDark
        ? "1px solid rgba(254, 202, 202, 0.18)"
        : "1px solid rgba(127, 29, 29, 0.18)",
      boxSizing: "border-box",
      [theme.breakpoints.down("xs")]: {
        minHeight: 20,
        padding: theme.spacing(0.15, 0.85),
        gap: theme.spacing(0.65)
      }
    },
    text: {
      fontSize: 11.5,
      fontWeight: 500,
      letterSpacing: "-0.01em",
      lineHeight: 1.15,
      color: "rgba(255, 255, 255, 0.96)",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      minWidth: 0,
      [theme.breakpoints.down("xs")]: {
        fontSize: 10.5
      }
    },
    cta: {
      textTransform: "none",
      fontWeight: 700,
      minHeight: 20,
      fontSize: 10.5,
      padding: "1px 9px",
      borderRadius: 4,
      background: "#ffffff !important",
      color: "#b91c1c !important",
      boxShadow: isDark
        ? "0 0 0 1px rgba(255,255,255,0.55), 0 1px 6px rgba(0,0,0,0.35)"
        : "0 0 0 1px rgba(255,255,255,0.35)",
      whiteSpace: "nowrap",
      lineHeight: 1.15,
      flexShrink: 0,
      border: "none",
      "&:hover": {
        background: "#fff7f7 !important",
        color: "#991b1b !important",
        boxShadow: isDark
          ? "0 0 0 1px rgba(255,255,255,0.7), 0 1px 8px rgba(0,0,0,0.4)"
          : "0 0 0 1px rgba(255,255,255,0.5)"
      },
      [theme.breakpoints.down("xs")]: {
        fontSize: 10,
        padding: "1px 7px",
        minHeight: 18
      }
    }
  };
});

const TrialCountdown = () => {
  const classes = useStyles();
  const { user } = useContext(AuthContext);

  if (!isFreeTrialUser(user)) return null;
  if (user?.subscription?.expired) return null;

  return (
    <Box className={classes.wrap} role="status" aria-live="polite">
      <Box className={classes.bar}>
        <Typography className={classes.text} component="span">
          Teste Grátis: ambiente completo de demonstração
        </Typography>
        <Button
          className={classes.cta}
          href={CODIGO_FONTE_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          Instalar Agora
        </Button>
      </Box>
    </Box>
  );
};

export default TrialCountdown;
