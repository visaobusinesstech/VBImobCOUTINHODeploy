import React, { useContext, useMemo, useState, useEffect } from "react";
import { useHistory, useLocation } from "react-router-dom";
import { Box, Grid, Typography, makeStyles } from "@material-ui/core";
import ActivitiesStyleLayout from "../../components/ActivitiesStyleLayout";
import { WhatsAppsContext } from "../../context/WhatsApp/WhatsAppsContext";
import { AuthContext } from "../../context/Auth/AuthContext";
import ForbiddenPage from "../../components/ForbiddenPage";
import usePlans from "../../hooks/usePlans";
import smtpService from "../../services/smtpService";
import api from "../../services/api";
import anthropicIntegrationService from "../../services/anthropicIntegrationService";
import geminiIntegrationService from "../../services/geminiIntegrationService";
import grokIntegrationService from "../../services/grokIntegrationService";
import { getMetaAdsConfig, getMetaAdsInsightsConfig } from "../../services/metaAdsService";
import figmaIntegrationService from "../../services/figmaIntegrationService";
import caktoIntegrationService from "../../services/caktoIntegrationService";
import hotmartIntegrationService from "../../services/hotmartIntegrationService";
import githubIntegrationService from "../../services/githubIntegrationService";
import crmIntegrationService from "../../services/crmIntegrationService";
import platformApiService from "../../services/platformApiService";
import {
  INTEGRATION_CATALOG,
  countConnectionsForIntegration,
  GOOGLE_WORKSPACE_INTEGRATION_KEYS,
} from "./integrationCatalog";
import { filterCatalogForFreeTrial, isFreeTrialUser } from "../../helpers/trialIntegrationFilter";
import { subscribeCrmOAuthCallback } from "./crmOAuthPopup";
import { getConnectionCounts as getGoogleConnectionCounts } from "../../services/googleWorkspaceService";
import { getBrandVisual } from "./IntegrationBrandIcon";
import IntegrationHubCard from "./IntegrationHubCard";
import ConnectionsPageShell from "./ConnectionsPageShell";
import { CONNECTIONS_FONT } from "./connectionsTypography";

const useStyles = makeStyles((theme) => ({
  gridWrap: {
    width: "100%",
    maxWidth: "100%",
    margin: "0 auto",
    padding: theme.spacing(1, 0, 2),
    boxSizing: "border-box",
  },
  gridItem: {
    display: "flex",
    width: "100%",
  },
  emptyHint: {
    fontFamily: CONNECTIONS_FONT,
    fontWeight: 400,
    marginTop: theme.spacing(4),
    textAlign: "center",
    fontSize: "0.8125rem",
    color: theme.palette.text.secondary,
  },
}));

export default function ConnectionsHub() {
  const classes = useStyles();
  const history = useHistory();
  const location = useLocation();
  const { whatsApps, loading } = useContext(WhatsAppsContext);
  const { user } = useContext(AuthContext);
  const { getPlanCompany } = usePlans();
  const [planConfig, setPlanConfig] = React.useState({});
  const [emailCount, setEmailCount] = useState(0);
  const [openAiCount, setOpenAiCount] = useState(0);
  const [anthropicCount, setAnthropicCount] = useState(0);
  const [geminiCount, setGeminiCount] = useState(0);
  const [grokCount, setGrokCount] = useState(0);
  const [metaAdsCount, setMetaAdsCount] = useState(0);
  const [figmaCount, setFigmaCount] = useState(0);
  const [caktoCount, setCaktoCount] = useState(0);
  const [hotmartCount, setHotmartCount] = useState(0);
  const [githubCount, setGithubCount] = useState(0);
  const [googleCounts, setGoogleCounts] = useState({});
  const [platformCounts, setPlatformCounts] = useState({});
  const [apiCredentialCount, setApiCredentialCount] = useState(0);

  React.useEffect(() => {
    async function load() {
      try {
        const data = await getPlanCompany(undefined, user.companyId);
        setPlanConfig(data);
      } catch {
        setPlanConfig({});
      }
    }
    if (user?.companyId) load();
  }, [user?.companyId, getPlanCompany]);

  const loadPlatformCounts = React.useCallback(async () => {
    try {
      const data = await crmIntegrationService.getStatus();
      const providers = data?.providers || {};
      const next = {};
      Object.entries(providers).forEach(([key, row]) => {
        next[key] = row?.connected ? 1 : 0;
      });
      setPlatformCounts(next);
    } catch {
      setPlatformCounts({});
    }
  }, []);

  useEffect(() => {
    async function loadConfigCounts() {
      const trial = isFreeTrialUser(user);
      await loadPlatformCounts();
      if (!trial) {
        try {
          const { data } = await platformApiService.listCredentials();
          setApiCredentialCount((data || []).length);
        } catch {
          setApiCredentialCount(0);
        }
      } else {
        setApiCredentialCount(0);
      }
      try {
        const res = await smtpService.list();
        setEmailCount((res?.items || []).length);
      } catch { /* ignore */ }
      try {
        const { data } = await api.get("/settings/agent_integration");
        let v = null;
        if (data?.value) {
          v = typeof data.value === "string" ? JSON.parse(data.value) : data.value;
        }
        setOpenAiCount(v && String(v.apiKey || "").trim() ? 1 : 0);
      } catch { /* ignore */ }
      try {
        const data = await anthropicIntegrationService.getIntegration();
        setAnthropicCount(data?.apiKey?.hasKey ? 1 : 0);
      } catch { /* ignore */ }
      try {
        const data = await geminiIntegrationService.getIntegration();
        setGeminiCount(data?.apiKey?.hasKey ? 1 : 0);
      } catch { /* ignore */ }
      try {
        const data = await grokIntegrationService.getIntegration();
        setGrokCount(data?.apiKey?.hasKey ? 1 : 0);
      } catch { /* ignore */ }
      if (!trial) {
        try {
          const [capi, insights] = await Promise.all([
            getMetaAdsConfig(),
            getMetaAdsInsightsConfig(),
          ]);
          setMetaAdsCount(
            (capi?.configured ? 1 : 0) + (insights?.configured ? 1 : 0)
          );
        } catch { /* ignore */ }
        try {
          const data = await figmaIntegrationService.getIntegration();
          setFigmaCount(data?.credential?.hasKey ? 1 : 0);
        } catch { /* ignore */ }
        try {
          const data = await caktoIntegrationService.listConnections();
          setCaktoCount(
            (data?.connections || []).filter((c) => Number(c?.id) > 0).length
          );
        } catch { /* ignore */ }
        try {
          const data = await hotmartIntegrationService.listConnections();
          setHotmartCount(
            (data?.connections || []).filter((c) => Number(c?.id) > 0).length
          );
        } catch { /* ignore */ }
        try {
          const data = await githubIntegrationService.getIntegration();
          const linked =
            data?.status === "connected" &&
            Boolean(data?.credential?.hasKey || data?.githubAccount?.login);
          setGithubCount(linked ? 1 : 0);
        } catch { /* ignore */ }
        try {
          const counts = await getGoogleConnectionCounts();
          setGoogleCounts(counts || {});
        } catch { /* ignore */ }
      } else {
        setMetaAdsCount(0);
        setFigmaCount(0);
        setCaktoCount(0);
        setHotmartCount(0);
        setGithubCount(0);
        setGoogleCounts({});
      }
    }
    loadConfigCounts();
  }, [location.pathname, loadPlatformCounts, user]);

  useEffect(() => {
    return subscribeCrmOAuthCallback((payload) => {
      if (payload.status === "success") {
        loadPlatformCounts();
      }
    });
  }, [loadPlatformCounts]);

  const hasActiveConnections = useMemo(() => {
    if ((whatsApps || []).length > 0) return true;
    if (
      emailCount > 0 ||
      openAiCount > 0 ||
      anthropicCount > 0 ||
      geminiCount > 0 ||
      grokCount > 0 ||
      metaAdsCount > 0 ||
      figmaCount > 0 ||
      caktoCount > 0 ||
      hotmartCount > 0 ||
      githubCount > 0 ||
      apiCredentialCount > 0
    ) {
      return true;
    }
    if (Object.values(googleCounts).some((n) => n > 0)) return true;
    if (Object.values(platformCounts).some((n) => n > 0)) return true;
    return false;
  }, [
    whatsApps,
    emailCount,
    openAiCount,
    anthropicCount,
    geminiCount,
    grokCount,
    metaAdsCount,
    figmaCount,
    caktoCount,
    hotmartCount,
    githubCount,
    apiCredentialCount,
    googleCounts,
    platformCounts,
  ]);

  if (user.profile === "user" && user.allowConnections === "disabled") {
    return <ForbiddenPage />;
  }

  const handleCardClick = (integration) => {
    if (integration.comingSoon) return;
    if (integration.externalPath) {
      history.push(integration.externalPath);
      return;
    }
    if (integration.planFlag && planConfig?.plan && !planConfig.plan[integration.planFlag]) {
      return;
    }
    history.push(`/connections/${integration.key}/manage`);
  };

  const isPlanDisabled = (integration) => {
    if (integration.externalPath) return false;
    if (!integration.planFlag) return false;
    return planConfig?.plan ? !planConfig.plan[integration.planFlag] : false;
  };

  const visibleCatalog = useMemo(
    () => filterCatalogForFreeTrial(INTEGRATION_CATALOG, user),
    [user]
  );

  return (
    <ActivitiesStyleLayout
      viewModes={[{ value: "grid", label: "Integrações" }]}
      currentViewMode="grid"
      disableFilterBar
      hideDefaultRightFilters
      hideSearch
      hideNavDivider
      hideHeaderDivider
      helpTopic="connections"
      hideCreateButton
      scrollContent={false}
      contentEdgeToEdge
    >
      <ConnectionsPageShell>
        <Box className={classes.gridWrap}>
          <Grid container spacing={2}>
            {visibleCatalog.map((integration) => {
              let count = countConnectionsForIntegration(whatsApps, integration);
              if (integration.key === "email") count = emailCount;
              if (integration.key === "openai") count = openAiCount;
              if (integration.key === "claude") count = anthropicCount;
              if (integration.key === "gemini") count = geminiCount;
              if (integration.key === "grok") count = grokCount;
              if (integration.key === "meta-ads") count = metaAdsCount;
              if (integration.key === "figma") count = figmaCount;
              if (integration.key === "cakto") count = caktoCount;
              if (integration.key === "hotmart") count = hotmartCount;
              if (integration.key === "github") count = githubCount;
              if (integration.key === "vbsolution-api") count = apiCredentialCount;
              if (GOOGLE_WORKSPACE_INTEGRATION_KEYS.has(integration.key)) {
                count = googleCounts[integration.key] || 0;
              }
              if (integration.platformIntegration) {
                count = platformCounts[integration.key] || 0;
              }
              const visual = getBrandVisual(integration);
              return (
                <Grid
                  item
                  xs={12}
                  sm={6}
                  md={4}
                  lg={4}
                  xl={3}
                  key={integration.key}
                  className={classes.gridItem}
                >
                  <IntegrationHubCard
                    integration={integration}
                    visual={visual}
                    count={count}
                    disabled={isPlanDisabled(integration)}
                    onClick={() => handleCardClick(integration)}
                  />
                </Grid>
              );
            })}
          </Grid>
        </Box>

        {!loading && !hasActiveConnections ? (
          <Typography className={classes.emptyHint} component="p">
            Nenhuma conexão ativa — abra um canal para configurar.
          </Typography>
        ) : null}
      </ConnectionsPageShell>
    </ActivitiesStyleLayout>
  );
}
