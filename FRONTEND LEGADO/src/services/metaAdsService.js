import api from "./api";

export async function getMetaAdsConfig() {
  const { data } = await api.get("/meta-ads/config");
  return data;
}

export async function saveMetaAdsConfig(payload) {
  const { data } = await api.put("/meta-ads/config", payload);
  return data;
}

export async function getMetaAdsInsightsConfig() {
  const { data } = await api.get("/meta-ads/insights/config");
  return data;
}

export async function saveMetaAdsInsightsConfig(payload) {
  const { data } = await api.put("/meta-ads/insights/config", payload);
  return data;
}

export async function probeMetaAdsInsights() {
  const { data } = await api.post("/meta-ads/insights/probe");
  return data;
}

export async function getMetaAdsAnalytics(params = {}) {
  const { data } = await api.get("/meta-ads/analytics", {
    params,
    timeout: 120000,
  });
  return data;
}

export async function listMetaAdsCampaigns() {
  const { data } = await api.get("/meta-ads/campaigns");
  return data;
}

export async function listMetaAdsAccounts() {
  const { data } = await api.get("/meta-ads/accounts");
  return data;
}

export async function discoverMetaAdsAccounts(accessToken) {
  const { data } = await api.post("/meta-ads/accounts/discover", { accessToken });
  return data;
}

export async function connectMetaAdsAccounts({ accessToken, accounts }) {
  const { data } = await api.post("/meta-ads/accounts", { accessToken, accounts });
  return data;
}

export async function saveMetaAdsGoals(goals) {
  const { data } = await api.put("/meta-ads/goals", { goals });
  return data;
}

export async function getMetaAdsGoals() {
  const { data } = await api.get("/meta-ads/goals");
  return data;
}

export async function deleteMetaAdsAccount(id) {
  const { data } = await api.delete(`/meta-ads/accounts/${id}`);
  return data;
}
