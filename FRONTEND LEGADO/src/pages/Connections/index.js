import React from "react";
import { Redirect, Switch, Route, useRouteMatch } from "react-router-dom";
import ConnectionsHub from "./ConnectionsHub";
import ConnectionsTypePage from "./ConnectionsTypePage";
import ConnectionsChannelSetupPage from "./ConnectionsChannelSetupPage";
import GoogleOAuthCallbackPage from "./GoogleOAuthCallbackPage";
import GithubOAuthCallbackPage from "./GithubOAuthCallbackPage";
import GithubOAuthConnectPage from "./GithubOAuthConnectPage";
import CrmOAuthCallbackPage from "./CrmOAuthCallbackPage";
import CrmOAuthConnectPage from "./CrmOAuthConnectPage";

/**
 * Hub → administrar (lista) direto; criar/editar WhatsApp em sub-rota.
 */
export default function Connections() {
  const { path } = useRouteMatch();

  return (
    <Switch>
      <Route exact path={path} component={ConnectionsHub} />
      <Route
        path={`${path}/google-oauth/callback`}
        component={GoogleOAuthCallbackPage}
      />
      <Route
        path={`${path}/github-oauth/callback`}
        component={GithubOAuthCallbackPage}
      />
      <Route
        path={`${path}/github/oauth/start`}
        component={GithubOAuthConnectPage}
      />
      <Route
        path={`${path}/:integrationKey/oauth/start`}
        component={CrmOAuthConnectPage}
      />
      <Route
        path={`${path}/hubspot-oauth/callback`}
        component={CrmOAuthCallbackPage}
      />
      <Route
        path={`${path}/pipedrive-oauth/callback`}
        component={CrmOAuthCallbackPage}
      />
      <Route
        path={`${path}/clickup-oauth/callback`}
        component={CrmOAuthCallbackPage}
      />
      <Route
        path={`${path}/notion-oauth/callback`}
        component={CrmOAuthCallbackPage}
      />
      <Route
        path={`${path}/supabase-oauth/callback`}
        component={CrmOAuthCallbackPage}
      />
      <Route
        exact
        path={`${path}/meta-ads-insights`}
        render={() => <Redirect to="/connections/meta-ads/manage" />}
      />
      <Route
        exact
        path={`${path}/meta-ads-insights/manage`}
        render={() => <Redirect to="/connections/meta-ads/manage" />}
      />
      <Route
        exact
        path={`${path}/meta-ads-insights/new`}
        render={() => (
          <Redirect to="/connections/meta-ads/new?section=insights" />
        )}
      />
      <Route
        path={`${path}/meta-ads-insights/edit/:whatsAppId`}
        render={() => (
          <Redirect to="/connections/meta-ads/edit/settings?section=insights" />
        )}
      />
      <Route
        exact
        path={`${path}/cakto/edit/settings`}
        render={() => <Redirect to={`${path}/cakto/manage`} />}
      />
      <Route
        exact
        path={`${path}/hotmart/edit/settings`}
        render={() => <Redirect to={`${path}/hotmart/manage`} />}
      />
      <Route
        path={`${path}/:integrationKey/new`}
        component={ConnectionsChannelSetupPage}
      />
      <Route
        path={`${path}/:integrationKey/edit/:whatsAppId`}
        component={ConnectionsChannelSetupPage}
      />
      <Route
        path={`${path}/:integrationKey/manage`}
        component={ConnectionsTypePage}
      />
      <Route
        path={`${path}/:integrationKey`}
        render={({ match }) => (
          <Redirect to={`${path}/${match.params.integrationKey}/manage`} />
        )}
      />
    </Switch>
  );
}
