import React from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Box,
  Button,
  Container,
  Typography,
  makeStyles
} from "@material-ui/core";

const useStyles = makeStyles(theme => ({
  root: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    background:
      theme.palette.type === "dark"
        ? "linear-gradient(160deg, #0f172a 0%, #134e4a 55%, #0f172a 100%)"
        : "linear-gradient(160deg, #f0fdfa 0%, #ecfeff 40%, #f8fafc 100%)",
    padding: theme.spacing(3, 2),
    fontFamily: "'Helvetica Neue', Arial, sans-serif"
  },
  card: {
    maxWidth: 720,
    margin: "0 auto",
    textAlign: "center",
    padding: theme.spacing(4, 3),
    [theme.breakpoints.down("xs")]: {
      padding: theme.spacing(3, 1.5)
    }
  },
  brand: {
    fontWeight: 800,
    fontSize: 28,
    letterSpacing: -0.5,
    color: theme.palette.type === "dark" ? "#5eead4" : "#0f766e",
    marginBottom: theme.spacing(2),
    [theme.breakpoints.down("xs")]: { fontSize: 22 }
  },
  title: {
    fontWeight: 700,
    fontSize: 36,
    lineHeight: 1.2,
    marginBottom: theme.spacing(2),
    [theme.breakpoints.down("xs")]: { fontSize: 26 }
  },
  subtitle: {
    fontSize: 17,
    color: theme.palette.text.secondary,
    maxWidth: 520,
    margin: "0 auto",
    marginBottom: theme.spacing(4),
    [theme.breakpoints.down("xs")]: { fontSize: 15 }
  },
  cta: {
    minHeight: 48,
    minWidth: 220,
    borderRadius: 12,
    fontWeight: 700,
    fontSize: 16,
    textTransform: "none",
    padding: theme.spacing(1.5, 4),
    background: "#0d9488",
    color: "#fff",
    "&:hover": { background: "#0f766e" }
  },
  note: {
    marginTop: theme.spacing(3),
    fontSize: 13,
    color: theme.palette.text.secondary
  }
}));

const TesteGratis = () => {
  const classes = useStyles();

  return (
    <Box className={classes.root} component="main">
      <Container maxWidth="md">
        <Box className={classes.card}>
          <Typography className={classes.brand} component="p">
            VBSolution CRM
          </Typography>
          <Typography className={classes.title} component="h1" variant="h3">
            Experimente grátis por 12 horas
          </Typography>
          <Typography className={classes.subtitle} component="p">
            Conheça o atendimento, integrações, agentes de IA, leads, vendas e
            muito mais — sem cartão e com acesso completo aos módulos do CRM.
          </Typography>
          <Button
            className={classes.cta}
            component={RouterLink}
            to="/register/teste-gratis"
            variant="contained"
            aria-label="Começar teste grátis"
          >
            Começar teste grátis
          </Button>
          <Typography className={classes.note} component="p">
            Ao finalizar o período, você poderá conhecer o código-fonte completo
            do VBSolution CRM.
          </Typography>
        </Box>
      </Container>
    </Box>
  );
};

export default TesteGratis;
