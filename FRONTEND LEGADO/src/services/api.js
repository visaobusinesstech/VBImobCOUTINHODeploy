import axios from "axios";
import { getBackendUrl } from "../config";

const baseURL = getBackendUrl();

const api = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 20000
});

export const openApi = axios.create({
  baseURL,
  timeout: 20000
});

const shouldRetry = (error) => {
  const cfg = error?.config || {};
  const method = String(cfg.method || "get").toLowerCase();
  const isGet = method === "get";
  const isTimeout = error?.code === "ECONNABORTED";
  const isNetwork = error?.message === "Network Error";
  return isGet && (isTimeout || isNetwork) && (cfg.__retryCount || 0) < 1;
};

const scheduleRetry = (config) =>
  new Promise((resolve) => {
    const retryAfter = 1000;
    setTimeout(() => resolve({ ...config, __retryCount: (config.__retryCount || 0) + 1, timeout: Math.max(config.timeout || 0, 25000) }), retryAfter);
  });

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (shouldRetry(error)) {
      const nextCfg = await scheduleRetry(error.config);
      return api.request(nextCfg);
    }
    if (
      error?.response?.status === 402 &&
      (error?.response?.data?.error === "ERR_SUBSCRIPTION_EXPIRED" ||
        error?.response?.data?.error === "ERR_FREE_TRIAL_EXPIRED") &&
      typeof window !== "undefined" &&
      window.location.pathname !== "/financeiro-aberto" &&
      !String(window.location.pathname || "").includes("teste-gratis")
    ) {
      if (error?.response?.data?.error === "ERR_FREE_TRIAL_EXPIRED") {
        // Gate de trial no layout trata a UI; evita redirecionar para financeiro
        return Promise.reject(error);
      }
      window.location.assign("/financeiro-aberto");
    }
    return Promise.reject(error);
  }
);

openApi.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (shouldRetry(error)) {
      const nextCfg = await scheduleRetry(error.config);
      return openApi.request(nextCfg);
    }
    return Promise.reject(error);
  }
);

export default api;
