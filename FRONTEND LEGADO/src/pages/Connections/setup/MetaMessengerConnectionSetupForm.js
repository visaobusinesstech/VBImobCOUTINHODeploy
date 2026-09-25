import React, { useContext, useEffect, useState } from "react";
import { Box, Button, Typography, makeStyles } from "@material-ui/core";
import { AuthContext } from "../../../context/Auth/AuthContext";
import usePlans from "../../../hooks/usePlans";
import ConnectionSetupFluid from "../ConnectionSetupFluid";
import IntegrationBrandIcon, { getBrandVisual } from "../IntegrationBrandIcon";
import { getIntegrationByKey } from "../integrationCatalog";
import { CONNECTIONS_FONT } from "../connectionsTypography";
import MetaMessengerOAuthConnect from "../MetaMessengerOAuthConnect";

const useStyles = makeStyles((theme) => ({
  box: {
    fontFamily: CONNECTIONS_FONT,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: theme.spacing(4, 2.5),
    minHeight: 280,
  },
  title: {
    fontFamily: CONNECTIONS_FONT,
    fontSize: "1.05rem",
    fontWeight: 600,
    letterSpacing: "-0.02em",
    marginBottom: theme.spacing(1),
  },
  hint: {
    fontFamily: CONNECTIONS_FONT,
    fontSize: "0.875rem",
    color: theme.palette.text.secondary,
    lineHeight: 1.55,
    maxWidth: 440,
    marginBottom: theme.spacing(2.5),
  },
  note: {
    fontFamily: CONNECTIONS_FONT,
    fontSize: "0.75rem",
    color: theme.palette.text.secondary,
    lineHeight: 1.45,
    maxWidth: 440,
    marginTop: theme.spacing(2),
  },
  oauthBtn: {
    textTransform: "none",
    fontWeight: 600,
    borderRadius: 10,
    padding: "10px 22px",
    fontFamily: CONNECTIONS_FONT,
  },
  logo: {
    marginBottom: theme.spacing(2),
  },
}));

export default function MetaMessengerConnectionSetupForm({
  channel = "facebook",
  onCancel,
  onSaved,
  hidePageHeader = false,
}) {
  const classes = useStyles();
  const integrationKey = channel === "instagram" ? "instagram" : "facebook";
  const integration = getIntegrationByKey(integrationKey);
  const visual = getBrandVisual(integration);
  const { user } = useContext(AuthContext);
  const { getPlanCompany } = usePlans();
  const [planConfig, setPlanConfig] = useState({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user?.companyId) return;
      try {
        const data = await getPlanCompany(undefined, user.companyId);
        if (!cancelled) setPlanConfig(data || {});
      } catch {
        if (!cancelled) setPlanConfig({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.companyId, getPlanCompany]);

  const planLocked =
    channel === "facebook"
      ? Boolean(planConfig?.plan && !planConfig.plan.useFacebook)
      : Boolean(planConfig?.plan && !planConfig.plan.useInstagram);

  const label = integration?.label || (channel === "instagram" ? "Instagram" : "Facebook");

  return (
    <ConnectionSetupFluid
      fluid
      hidePageHeader={hidePageHeader}
      title={`Conectar ${label}`}
      subtitle={
        channel === "instagram"
          ? "Acesse DMs, crie tickets e use automações de comentários."
          : "Acesse DMs e crie tickets com as mensagens do Messenger."
      }
      hint={
        channel === "instagram"
          ? "Use «Conectar Instagram Login». Após autorizar, a janela fecha sozinha. No celular: Mensagens → Ferramentas conectadas → Permitir acesso às mensagens."
          : "Use uma Página pública da empresa (não perfil pessoal). Autorize e a conexão é criada automaticamente."
      }
      footer={
        <Button onClick={onCancel} color="default">
          Cancelar
        </Button>
      }
    >
      <Box className={classes.box}>
        <Box className={classes.logo}>
          <IntegrationBrandIcon
            brandKey={visual.brandKey}
            variant="hubBox"
            accentColor={visual.accent}
            plain
          />
        </Box>
        <Typography className={classes.title}>Conectar {label}</Typography>
        <Typography className={classes.hint}>{integration?.description}</Typography>
        <MetaMessengerOAuthConnect
          channel={channel}
          disabled={planLocked}
          onSuccess={onSaved}
          className={classes.oauthBtn}
        />
        {planLocked ? (
          <Typography className={classes.note}>
            Seu plano não inclui {label}. Atualize o plano para conectar.
          </Typography>
        ) : null}
      </Box>
    </ConnectionSetupFluid>
  );
}
