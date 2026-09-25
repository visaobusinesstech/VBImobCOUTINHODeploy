import React, { useContext, useEffect } from "react";
import { useHistory, useParams } from "react-router-dom";
import WhatsAppModal from "../../components/WhatsAppModal";
import { getIntegrationByKey } from "./integrationCatalog";
import { WhatsAppsContext } from "../../context/WhatsApp/WhatsAppsContext";
import ForbiddenPage from "../../components/ForbiddenPage";
import { AuthContext } from "../../context/Auth/AuthContext";
import ConnectionsChannelLayout from "./ConnectionsChannelLayout";
import { getConnectionGuideSteps } from "../../components/HelpStepsList/connectionChannelSteps";
import TelegramBotSetupForm from "./setup/TelegramBotSetupForm";
import TelegramOficialSetupForm from "./setup/TelegramOficialSetupForm";
import MetaMessengerConnectionSetupForm from "./setup/MetaMessengerConnectionSetupForm";
import SmsSetupForm from "./setup/SmsSetupForm";
import EmailSmtpSetupForm from "./setup/EmailSmtpSetupForm";
import OpenAiConnectionSetupForm from "./setup/OpenAiConnectionSetupForm";
import AnthropicConnectionSetupForm from "./setup/AnthropicConnectionSetupForm";
import GeminiConnectionSetupForm from "./setup/GeminiConnectionSetupForm";
import GrokConnectionSetupForm from "./setup/GrokConnectionSetupForm";
import MetaAdsSetupShell from "./setup/MetaAdsSetupShell";
import FigmaConnectionSetupForm from "./setup/FigmaConnectionSetupForm";
import GithubConnectionSetupForm from "./setup/GithubConnectionSetupForm";
import CaktoConnectionSetupForm from "./setup/CaktoConnectionSetupForm";
import HotmartConnectionSetupForm from "./setup/HotmartConnectionSetupForm";
import CrmIntegrationSetupForm from "./setup/CrmIntegrationSetupForm";
import GoogleWorkspaceConnectForm from "./setup/GoogleWorkspaceConnectForm";
import { GOOGLE_WORKSPACE_INTEGRATION_KEYS } from "./integrationCatalog";

const WHATSAPP_CHANNEL_BY_KEY = {
  "whatsapp-web": "whatsapp",
  "whatsapp-oficial": "whatsapp_oficial",
};

const SETUP_KEYS = new Set([
  "whatsapp-web",
  "whatsapp-oficial",
  "telegram-bot",
  "telegram-oficial",
  "facebook",
  "instagram",
  "sms",
  "email",
  "openai",
  "claude",
  "gemini",
  "grok",
  "meta-ads",
  "google-drive",
  "google-sheets",
  "google-calendar",
  "figma",
  "cakto",
  "hotmart",
  "github",
  "hubspot",
  "clickup",
  "pipedrive",
  "notion",
  "supabase",
]);

export default function ConnectionsChannelSetupPage() {
  const history = useHistory();
  const { integrationKey, whatsAppId: editIdParam } = useParams();
  const integration = getIntegrationByKey(integrationKey);
  const managePath = `/connections/${integrationKey}/manage`;
  const { fetchWhatsApps } = useContext(WhatsAppsContext);
  const { user } = useContext(AuthContext);

  const whatsAppId = editIdParam || undefined;
  const isEdit = Boolean(whatsAppId);

  if (user?.profile === "user" && user?.allowConnections === "disabled") {
    return <ForbiddenPage />;
  }

  const setupAllowed = Boolean(integration && SETUP_KEYS.has(integrationKey));

  useEffect(() => {
    if (!setupAllowed) {
      history.replace("/connections");
    }
  }, [setupAllowed, history]);

  if (!setupAllowed) {
    return null;
  }

  const hideSidebarWizard =
    integrationKey === "openai" ||
    integrationKey === "gemini" ||
    integrationKey === "grok" ||
    integrationKey === "meta-ads" ||
    integrationKey === "figma" ||
    integrationKey === "cakto" ||
    integrationKey === "hotmart" ||
    integrationKey === "github" ||
    ["hubspot", "clickup", "pipedrive", "notion", "supabase"].includes(integrationKey) ||
    GOOGLE_WORKSPACE_INTEGRATION_KEYS.has(integrationKey);
  const guideSteps = hideSidebarWizard
    ? []
    : getConnectionGuideSteps(integrationKey);
  const wizardResetKey = `${integrationKey}-${whatsAppId || "new"}`;

  const onSaved = async () => {
    if (
      typeof fetchWhatsApps === "function" &&
      ![
        "email",
        "openai",
        "gemini",
        "grok",
        "meta-ads",
        "figma",
        "cakto",
        "hotmart",
        "github",
        ...GOOGLE_WORKSPACE_INTEGRATION_KEYS,
      ].includes(integrationKey)
    ) {
      await fetchWhatsApps({ silent: true });
    }
    history.push(managePath);
  };

  const onCancel = () => history.push(managePath);

  let content = null;

  if (WHATSAPP_CHANNEL_BY_KEY[integrationKey]) {
    content = (
      <WhatsAppModal
        embeddedPage
        open
        onClose={onCancel}
        whatsAppId={whatsAppId}
        channel={WHATSAPP_CHANNEL_BY_KEY[integrationKey]}
        onConnectionSaved={onSaved}
      />
    );
  } else if (integrationKey === "telegram-bot") {
    content = (
      <TelegramBotSetupForm
        whatsAppId={whatsAppId}
        isEdit={isEdit}
        onCancel={onCancel}
        onSaved={onSaved}
        hidePageHeader
      />
    );
  } else if (integrationKey === "telegram-oficial") {
    content = (
      <TelegramOficialSetupForm
        whatsAppId={whatsAppId}
        isEdit={isEdit}
        onCancel={onCancel}
        onSaved={onSaved}
        hidePageHeader
      />
    );
  } else if (integrationKey === "facebook" || integrationKey === "instagram") {
    if (isEdit) {
      content = (
        <WhatsAppModal
          embeddedPage
          open
          onClose={onCancel}
          whatsAppId={whatsAppId}
          channel={integrationKey}
          onConnectionSaved={onSaved}
        />
      );
    } else {
      content = (
        <MetaMessengerConnectionSetupForm
          channel={integrationKey}
          onCancel={onCancel}
          onSaved={onSaved}
          hidePageHeader
        />
      );
    }
  } else if (integrationKey === "sms") {
    content = (
      <SmsSetupForm
        whatsAppId={whatsAppId}
        isEdit={isEdit}
        onCancel={onCancel}
        onSaved={onSaved}
        hidePageHeader
      />
    );
  } else if (integrationKey === "email") {
    content = (
      <EmailSmtpSetupForm
        smtpId={whatsAppId}
        isEdit={isEdit}
        onCancel={onCancel}
        onSaved={onSaved}
        hidePageHeader
      />
    );
  } else if (integrationKey === "openai") {
    content = (
      <OpenAiConnectionSetupForm
        isEdit={isEdit || Boolean(whatsAppId)}
        onCancel={onCancel}
        onSaved={onSaved}
        hidePageHeader
      />
    );
  } else if (integrationKey === "claude") {
    content = (
      <AnthropicConnectionSetupForm
        isEdit={isEdit || Boolean(whatsAppId)}
        onCancel={onCancel}
        onSaved={onSaved}
        hidePageHeader
      />
    );
  } else if (GOOGLE_WORKSPACE_INTEGRATION_KEYS.has(integrationKey)) {
    content = (
      <GoogleWorkspaceConnectForm
        integrationKey={integrationKey}
        onCancel={onCancel}
        onSaved={onSaved}
        hidePageHeader
      />
    );
  } else if (integrationKey === "gemini") {
    content = (
      <GeminiConnectionSetupForm
        isEdit={isEdit || Boolean(whatsAppId)}
        onCancel={onCancel}
        onSaved={onSaved}
        hidePageHeader
      />
    );
  } else if (integrationKey === "grok") {
    content = (
      <GrokConnectionSetupForm
        isEdit={isEdit || Boolean(whatsAppId)}
        onCancel={onCancel}
        onSaved={onSaved}
        hidePageHeader
      />
    );
  } else if (integrationKey === "meta-ads") {
    content = <MetaAdsSetupShell onCancel={onCancel} onSaved={onSaved} />;
  } else if (integrationKey === "figma") {
    content = (
      <FigmaConnectionSetupForm
        onCancel={onCancel}
        onSaved={onSaved}
        hidePageHeader
      />
    );
  } else if (integrationKey === "cakto") {
    const rawId = isEdit ? whatsAppId : undefined;
    const caktoIntegrationId =
      rawId && rawId !== "settings" && /^\d+$/.test(String(rawId))
        ? Number(rawId)
        : undefined;
    content = (
      <CaktoConnectionSetupForm
        integrationId={caktoIntegrationId}
        isNew={!isEdit && !caktoIntegrationId}
        onCancel={onCancel}
        onSaved={onSaved}
        hidePageHeader
      />
    );
  } else if (integrationKey === "hotmart") {
    const rawId = isEdit ? whatsAppId : undefined;
    const hotmartIntegrationId =
      rawId && rawId !== "settings" && /^\d+$/.test(String(rawId))
        ? Number(rawId)
        : undefined;
    content = (
      <HotmartConnectionSetupForm
        integrationId={hotmartIntegrationId}
        isNew={!isEdit && !hotmartIntegrationId}
        onCancel={onCancel}
        onSaved={onSaved}
        hidePageHeader
      />
    );
  } else if (["hubspot", "clickup", "pipedrive", "notion", "supabase"].includes(integrationKey)) {
    content = (
      <CrmIntegrationSetupForm integrationKey={integrationKey} onSaved={onSaved} />
    );
  } else if (integrationKey === "github") {
    content = (
      <GithubConnectionSetupForm onSaved={onSaved} hidePageHeader />
    );
  }

  const setupTitle = isEdit ? "Editar conexão" : "Nova conexão";

  return (
    <ConnectionsChannelLayout
      integration={integration}
      wizardSteps={guideSteps}
      wizardResetKey={wizardResetKey}
      wizardLabel="Passo a passo"
      hideWizard={hideSidebarWizard}
      managePath={managePath}
      setupMode
      setupTitle={setupTitle}
    >
      {content}
    </ConnectionsChannelLayout>
  );
}
