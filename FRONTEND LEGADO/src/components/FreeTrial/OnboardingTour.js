import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useHistory, useLocation } from "react-router-dom";
import {
  Box,
  Button,
  Typography,
  makeStyles,
  useMediaQuery,
  useTheme
} from "@material-ui/core";
import api from "../../services/api";
import { AuthContext } from "../../context/Auth/AuthContext";
import { isFreeTrialUser } from "../../helpers/trialIntegrationFilter";

const STEPS = [
  {
    id: 1,
    title: "Identidade Visual",
    route: "/settings?tab=whitelabel",
    body:
      "Personalize logo, nome da empresa, cores e a marca do CRM. Na conta de administrador do código fonte você terá acesso às configurações completas de assinatura e planos."
  },
  {
    id: 2,
    title: "Integrações",
    route: "/connections",
    body:
      "Configure WhatsApp Web, WhatsApp API Oficial, Telegram, Facebook e Instagram. Cada canal alimenta o atendimento com tickets, histórico e automações."
  },
  {
    id: 3,
    title: "Inteligência Artificial",
    route: "/connections",
    body:
      "Provedores na ordem: GPT, Claude, Gemini e Grok. As API Keys ficam no backend com segurança e não ficam expostas no frontend após salvas."
  },
  {
    id: 4,
    title: "Agente de IA",
    route: "/prompts",
    body:
      "Criamos o Agente de Vendas pré configurado: objetivo, regras, roteiro, FAQ, inventário e ações. Seu primeiro agente de vendas já está pronto."
  },
  {
    id: 5,
    title: "Multiatendimento",
    route: "/tickets",
    body:
      "Veja tickets de demonstração em Atendendo e Aguardando. Abra uma conversa, envie mensagem e explore tags e histórico."
  },
  {
    id: 6,
    title: "Leads",
    route: "/leads-sales",
    body:
      "Leads demonstrativos em vários estados. Visualize, pesquise, filtre e acompanhe."
  },
  {
    id: 7,
    title: "Vendas",
    route: "/leads-sales",
    body:
      "Oportunidades e funil com valores, responsáveis e status. Use o Kanban para interagir."
  },
  {
    id: 8,
    title: "Atividades",
    route: "/activities",
    body:
      "Ligações, propostas, follow ups, reuniões e tarefas com prazo, prioridade e responsável."
  },
  {
    id: 9,
    title: "Projetos",
    route: "/projects",
    body:
      "Gestão operacional: projetos com status, progresso, prazos e atividades relacionadas."
  },
  {
    id: 10,
    title: "Inventário",
    route: "/inventory",
    body:
      "Produtos A, B e C com preços, SKU, estoque e categorias, também consultados pelo agente de vendas."
  },
  {
    id: 11,
    title: "Calendário",
    route: "/schedules",
    body:
      "Eventos internos de demonstração, como reuniões e follow ups. A integração Google Calendar não aparece no teste grátis."
  },
  {
    id: 12,
    title: "Conclusão",
    route: "/",
    body:
      "Você conheceu os principais recursos do VBSolution CRM: atendimento, integrações, agentes de IA, leads, vendas, atividades, projetos, inventário e calendário.",
    conclusion: true
  }
];

const CODIGO_FONTE_URL = "https://www.vbsolutioncrm.com.br/codigo-fonte/instalar";

function pathAndSearch(route) {
  const [pathname, search = ""] = String(route || "").split("?");
  return { pathname: pathname || "/", search: search ? `?${search}` : "" };
}

function navigateToStepRoute(history, location, route) {
  if (!route) return;
  const next = pathAndSearch(route);
  const samePath = location.pathname === next.pathname;
  const sameSearch = (location.search || "") === next.search;
  if (samePath && sameSearch) return;
  history.push({ pathname: next.pathname, search: next.search });
}

const useStyles = makeStyles(theme => ({
  sheet: {
    position: "fixed",
    zIndex: 1400,
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: "min(42vh, calc(100dvh - env(safe-area-inset-top, 0px) - 96px))",
    overflowY: "auto",
    overflowX: "hidden",
    WebkitOverflowScrolling: "touch",
    overscrollBehavior: "contain",
    background: theme.palette.background.paper,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    boxShadow: "0 -8px 32px rgba(0,0,0,0.18)",
    padding: theme.spacing(1.75, 2, 2),
    paddingBottom: "max(16px, env(safe-area-inset-bottom, 0px))",
    touchAction: "pan-y",
    [theme.breakpoints.down("sm")]: {
      maxHeight: "min(40vh, calc(100dvh - env(safe-area-inset-top, 0px) - 88px))"
    },
    [theme.breakpoints.up("md")]: {
      left: "auto",
      right: 24,
      bottom: 24,
      width: 400,
      maxHeight: "70vh",
      borderRadius: 16,
      paddingBottom: theme.spacing(2.5)
    }
  },
  progress: {
    fontSize: 12,
    fontWeight: 600,
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(0.75)
  },
  title: { fontWeight: 700, fontSize: 18, marginBottom: theme.spacing(0.75) },
  body: {
    fontSize: 14,
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(1.5),
    lineHeight: 1.5
  },
  actions: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(1),
    alignItems: "center"
  },
  primary: {
    textTransform: "none",
    fontWeight: 700,
    background: "#0d9488",
    color: "#fff",
    minHeight: 44,
    "&:hover": { background: "#0f766e" }
  },
  secondary: {
    textTransform: "none",
    minHeight: 44
  },
  spotlight: {
    position: "fixed",
    inset: 0,
    zIndex: 1390,
    pointerEvents: "none",
    background: "rgba(15, 23, 42, 0.22)",
    overscrollBehavior: "none"
  }
}));

const FreeTrialOnboardingTour = () => {
  const classes = useStyles();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const history = useHistory();
  const location = useLocation();
  const { user } = useContext(AuthContext);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [progress, setProgress] = useState(null);
  const startedNavRef = React.useRef(false);
  const sheetRef = React.useRef(null);

  const isTrial = isFreeTrialUser(user);

  const current = useMemo(
    () => STEPS.find(s => s.id === step) || STEPS[0],
    [step]
  );

  const persist = useCallback(async patch => {
    try {
      const { data } = await api.post("/free-trial/onboarding", patch);
      setProgress(data.progress);
      return data.progress;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!isTrial || !user?.companyId) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get("/free-trial/onboarding");
        if (cancelled) return;
        const p = data.progress;
        setProgress(p);
        if (p?.onboarding_completed) {
          setOpen(false);
          return;
        }
        // Ignora skip antigo: só sai ao concluir a apresentação
        const cur = Math.min(
          Math.max(1, Number(p?.current_step) || 1),
          STEPS.length
        );
        setStep(cur);
        setOpen(true);
        const target = STEPS.find(s => s.id === cur) || STEPS[0];
        if (!startedNavRef.current && target?.route) {
          startedNavRef.current = true;
          navigateToStepRoute(history, location, target.route);
        }
        if (p?.skipped) {
          persist({ skipped: false, current_step: cur, onboarding_started: true });
        }
      } catch {
        /* silent */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isTrial, user?.companyId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Marca a apresentação aberta sem travar o body (position:fixed + padding
  // gerava o bloco cinza/branco vazio entre o conteúdo e o sheet no mobile).
  useEffect(() => {
    if (!open) return undefined;
    const html = document.documentElement;
    const body = document.body;
    const pageBg =
      theme.palette.type === "dark"
        ? theme.palette.background.default || "#1e1e1e"
        : theme.palette.background.default || "#f5f5f7";

    html.classList.add("ft-onboarding-open");
    body.classList.add("ft-onboarding-open");
    html.style.setProperty("--ft-onboarding-page-bg", pageBg);
    html.style.overscrollBehavior = "none";
    body.style.overscrollBehavior = "none";
    html.style.backgroundColor = pageBg;
    body.style.backgroundColor = pageBg;

    const syncSheetHeight = () => {
      const h = sheetRef.current?.offsetHeight || 0;
      if (h > 0) {
        html.style.setProperty("--ft-onboarding-sheet-h", `${h}px`);
      }
    };
    syncSheetHeight();
    const ro =
      typeof ResizeObserver !== "undefined" && sheetRef.current
        ? new ResizeObserver(syncSheetHeight)
        : null;
    if (ro && sheetRef.current) ro.observe(sheetRef.current);
    window.addEventListener("resize", syncSheetHeight);

    return () => {
      html.classList.remove("ft-onboarding-open");
      body.classList.remove("ft-onboarding-open");
      html.style.overscrollBehavior = "";
      body.style.overscrollBehavior = "";
      html.style.backgroundColor = "";
      body.style.backgroundColor = "";
      html.style.removeProperty("--ft-onboarding-page-bg");
      html.style.removeProperty("--ft-onboarding-sheet-h");
      window.removeEventListener("resize", syncSheetHeight);
      if (ro) ro.disconnect();
    };
  }, [open, theme.palette.type, theme.palette.background.default, step]);

  const scrollMainToTop = () => {
    try {
      const main =
        document.querySelector(".logged-in-layout main") ||
        document.querySelector("[class*='contentEdgeToEdge']") ||
        document.querySelector("[class*='MainContainer']");
      if (main && typeof main.scrollTo === "function") {
        main.scrollTo({ top: 0, behavior: "auto" });
      }
      window.scrollTo({ top: 0, behavior: "auto" });
    } catch {
      /* ignore */
    }
  };

  const goTo = async nextStep => {
    const target = STEPS.find(s => s.id === nextStep) || STEPS[0];
    setStep(nextStep);
    if (target.route) {
      navigateToStepRoute(history, location, target.route);
      scrollMainToTop();
    }
    const completed = Array.from(
      new Set([...(progress?.completed_steps || []), step])
    );
    await persist({
      onboarding_started: true,
      current_step: nextStep,
      completed_steps: completed,
      onboarding_completed: nextStep > STEPS.length,
      skipped: false
    });
  };

  const handleContinue = async () => {
    if (current.conclusion) {
      await persist({
        onboarding_started: true,
        current_step: STEPS.length,
        completed_steps: STEPS.map(s => s.id),
        onboarding_completed: true,
        skipped: false
      });
      setOpen(false);
      return;
    }
    await goTo(Math.min(step + 1, STEPS.length));
  };

  const handleBack = async () => {
    if (step <= 1) return;
    await goTo(step - 1);
  };

  if (!isTrial) return null;

  return (
    <>
      {open && <div className={classes.spotlight} aria-hidden />}
      {open && (
        <Box
          ref={sheetRef}
          className={classes.sheet}
          role="dialog"
          aria-modal="true"
          aria-labelledby="ft-onboarding-title"
          onTouchMove={e => e.stopPropagation()}
        >
          <Typography className={classes.progress}>
            {step} de {STEPS.length}: {current.title}
          </Typography>
          <Typography id="ft-onboarding-title" className={classes.title}>
            {current.title}
          </Typography>
          <Typography className={classes.body}>{current.body}</Typography>
          {current.conclusion && (
            <Box mb={2}>
              <Typography className={classes.title} style={{ fontSize: 16 }}>
                Quer ter o sistema completo?
              </Typography>
              <Button
                type="button"
                className={classes.primary}
                href={CODIGO_FONTE_URL}
                target="_blank"
                rel="noopener noreferrer"
                fullWidth={isMobile}
                style={{ marginTop: 8 }}
              >
                Instalar Agora
              </Button>
            </Box>
          )}
          <Box className={classes.actions}>
            <Button
              type="button"
              className={classes.secondary}
              onClick={handleBack}
              disabled={step <= 1}
              aria-label="Voltar"
            >
              Voltar
            </Button>
            <Button
              type="button"
              className={classes.primary}
              onClick={handleContinue}
              aria-label={current.conclusion ? "Concluir" : "Continuar"}
            >
              {current.conclusion ? "Concluir" : "Continuar"}
            </Button>
          </Box>
        </Box>
      )}
    </>
  );
};

export default FreeTrialOnboardingTour;
