import { useState, useEffect, useRef, useCallback } from "react";
import ReactDOM from "react-dom";
import { useHistory } from "react-router-dom";
import { has, isArray } from "lodash";

import { toast } from "react-toastify";

import { i18n, applyAppLanguage } from "../../translate/i18n";
import api from "../../services/api";
import { openApi } from "../../services/api";
import toastError from "../../errors/toastError";
import { socketConnection, resolveSocketCompanyId } from "../../services/socket";
import moment from "moment";

const batchUpdates = ReactDOM.unstable_batchedUpdates || ((fn) => fn());

/** Uma única requisição de refresh por vez evita 401 em rajada quando há vários 403. */
let refreshSessionPromise = null;
function refreshSessionOnce(apiClient) {
  if (!refreshSessionPromise) {
    refreshSessionPromise = apiClient
      .post("/auth/refresh_token")
      .then((res) => {
        refreshSessionPromise = null;
        return res;
      })
      .catch((err) => {
        refreshSessionPromise = null;
        throw err;
      });
  }
  return refreshSessionPromise;
}

const useAuth = () => {
  const history = useHistory();
  const [isAuth, setIsAuth] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState({ queues: [] });
  const [socket, setSocket] = useState({
    on: () => {},
    off: () => {},
    emit: () => {},
    disconnect: () => {}
  });
  
  const listenersRef = useRef(new Set());
  const setIsAuthRef = useRef(setIsAuth);
  setIsAuthRef.current = setIsAuth;
  const socketRef = useRef(socket);
  socketRef.current = socket;

  useEffect(() => {
    const reqId = api.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem("token");
        if (token) {
          config.headers["Authorization"] = `Bearer ${JSON.parse(token)}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    const resId = api.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        const errPayload = error?.response?.data;
        const errCode = String(errPayload?.error || errPayload?.message || "");
        // 403 de permissão/negócio NÃO é sessão expirada (ex.: FREE_TRIAL bloqueando Google/API)
        const isBusinessForbidden =
          error?.response?.status === 403 &&
          (/ERR_FREE_TRIAL|ERR_NO_PERMISSION|FORBIDDEN|ERR_.*_FORBIDDEN/i.test(errCode) ||
            /free.?trial|integração|integracao|não permitido|nao permitido/i.test(errCode));

        if (
          error?.response?.status === 403 &&
          originalRequest &&
          !originalRequest._retry &&
          !isBusinessForbidden
        ) {
          originalRequest._retry = true;
          try {
            const { data } = await refreshSessionOnce(api);
            if (data) {
              localStorage.setItem("token", JSON.stringify(data.token));
              api.defaults.headers.Authorization = `Bearer ${data.token}`;
            }
            return api(originalRequest);
          } catch (refreshErr) {
            // Cookie jrt pode falhar (mobile/cross-origin); tenta manter sessão via Bearer
            const stored = localStorage.getItem("token");
            if (stored && refreshErr?.response?.status === 401) {
              try {
                let parsed = stored;
                try {
                  parsed = JSON.parse(stored);
                } catch {
                  /* raw */
                }
                api.defaults.headers.Authorization = `Bearer ${parsed}`;
                const me = await api.get("/auth/me");
                if (me?.data?.user?.id || me?.data?.id) {
                  return api(originalRequest);
                }
              } catch {
                /* segue para logout */
              }
              localStorage.removeItem("token");
              api.defaults.headers.Authorization = undefined;
              setIsAuthRef.current(false);
            }
            return Promise.reject(refreshErr);
          }
        }
        if (isBusinessForbidden) {
          return Promise.reject(error);
        }
        if (error?.response?.status === 401) {
          const errCode = error?.response?.data?.error;
          const errMsg = String(error?.response?.data?.error || error?.response?.data?.message || "");
          const isMetaTokenError =
            errCode === "ERR_META_TOKEN_INVALID" ||
            errMsg.includes("ERR_META_TOKEN_INVALID") ||
            errMsg.includes("Token Meta");
          if (!isMetaTokenError && errCode === "ERR_SESSION_EXPIRED") {
            localStorage.removeItem("token");
            api.defaults.headers.Authorization = undefined;
            setIsAuthRef.current(false);
          } else if (!isMetaTokenError && !errCode) {
            localStorage.removeItem("token");
            api.defaults.headers.Authorization = undefined;
            setIsAuthRef.current(false);
          }
        }
        return Promise.reject(error);
      }
    );

    return () => {
      api.interceptors.request.eject(reqId);
      api.interceptors.response.eject(resId);
    };
  }, []);

  // Effect para inicialização do token (mesmo canal que o interceptor 403 → evita 2× POST /refresh em paralelo)
  useEffect(() => {
    const token = localStorage.getItem("token");
    (async () => {
      try {
        const { data } = await refreshSessionOnce(api);
        if (data) {
          api.defaults.headers.Authorization = `Bearer ${data.token}`;
          localStorage.setItem("token", JSON.stringify(data.token));
          const u = data.user || data;
          batchUpdates(() => {
            setIsAuth(true);
            setUser({ ...u, queues: Array.isArray(u?.queues) ? u.queues : [] });
            setLoading(false);
          });
        } else {
          batchUpdates(() => {
            setIsAuth(false);
            setLoading(false);
          });
        }
      } catch (err) {
        // Cookie cross-origin pode falhar; tenta Bearer do localStorage
        if (token) {
          try {
            let parsed = token;
            try {
              parsed = JSON.parse(token);
            } catch {
              /* raw jwt */
            }
            api.defaults.headers.Authorization = `Bearer ${parsed}`;
            const me = await api.get("/auth/me");
            const u = me?.data?.user || me?.data;
            if (u?.id) {
              batchUpdates(() => {
                setIsAuth(true);
                setUser({ ...u, queues: Array.isArray(u?.queues) ? u.queues : [] });
                setLoading(false);
              });
              return;
            }
          } catch {
            /* cai no logout abaixo */
          }
          const isSession401 =
            err?.response?.status === 401 &&
            (err?.response?.data?.error === "ERR_SESSION_EXPIRED" ||
              err?.response?.data?.message === "ERR_SESSION_EXPIRED");
          if (!isSession401) {
            try {
              toastError(err);
            } catch {}
          }
          localStorage.removeItem("token");
          api.defaults.headers.Authorization = undefined;
        }
        batchUpdates(() => {
          setIsAuth(false);
          setLoading(false);
        });
      }
    })();
  }, []);

  // Effect para configuração do socket
  useEffect(() => {
    if (Object.keys(user).length && user.id > 0) {
      const socketCompanyId = resolveSocketCompanyId({
        user: { companyId: user.companyId, id: user.id }
      });
      console.log("Configurando socket para user", user.id, "company", socketCompanyId);
      
      // Limpar listeners anteriores
      if (socket) {
        listenersRef.current.forEach(eventName => {
          if (socket.off) {
            socket.off(eventName);
          }
        });
        listenersRef.current.clear();
      }

      if (socketCompanyId == null) {
        return;
      }

      // Criar nova conexão socket
      const socketInstance = socketConnection({ user: {
        companyId: user.companyId,
        id: user.id }
      });
      
      if (socketInstance) {
        setSocket(socketInstance);

        // Aguardar um pouco para garantir que o socket está configurado
        setTimeout(() => {
          const eventName = `company-${socketCompanyId}-user`;
          
          const handleUserUpdate = (data) => {
            if (data.action === "update" && data.user.id === user.id) {
              const u = data.user;
              setUser({ ...u, queues: Array.isArray(u?.queues) ? u.queues : [] });
            }
          };

          // Verificar se o socket tem o método 'on'
          if (socketInstance && typeof socketInstance.on === 'function') {
            socketInstance.on(eventName, handleUserUpdate);
            listenersRef.current.add(eventName);
            console.log(`Listener adicionado para: ${eventName}`);
          } else {
            console.error("Socket instance não tem método 'on'", socketInstance);
          }
        }, 100);
      }
    }

    // Cleanup function
    return () => {
      if (socket && listenersRef.current.size > 0) {
        console.log("Limpando listeners do socket para user", user.id);
        listenersRef.current.forEach(eventName => {
          if (socket.off) {
            socket.off(eventName);
          }
        });
        listenersRef.current.clear();
      }
    };
  }, [user.id, user.companyId]); // Dependências específicas

  // Effect para buscar dados do usuário atual (skip se init já carregou)
  const userLoadedRef = useRef(false);
  useEffect(() => {
    if (!isAuth) {
      userLoadedRef.current = false;
      return;
    }
    if (userLoadedRef.current) return;
    userLoadedRef.current = true;
  }, [isAuth]);

  const applyLoginSession = useCallback(async (data) => {
    const company = data?.user?.company;
    if (!data?.token || !data?.user) {
      throw new Error("Sessão inválida");
    }

    if (
      company &&
      has(company, "companieSettings") &&
      isArray(company.companieSettings?.[0])
    ) {
      const setting = company.companieSettings[0].find(
        (s) => s.key === "campaignsEnabled"
      );
      if (setting && setting.value === "true") {
        localStorage.setItem("cshow", null);
      }
    }

    if (
      company &&
      has(company, "companieSettings") &&
      isArray(company.companieSettings?.[0])
    ) {
      const setting = company.companieSettings[0].find(
        (s) => s.key === "sendSignMessage"
      );

      if (setting) {
        const signEnable = setting.value === "enable";
        if (setting.value === "enabled") {
          localStorage.setItem("sendSignMessage", signEnable);
        }
      }
    }

    localStorage.setItem("profileImage", data.user.profileImage || "");

    const userLanguage = data?.user?.language || localStorage.getItem("language") || "pt";
    const momentLocale = String(userLanguage).toLowerCase().startsWith("en")
      ? "en"
      : String(userLanguage).toLowerCase().startsWith("es")
        ? "es"
        : "pt-br";
    moment.locale(momentLocale);

    const sub = data?.user?.subscription;
    const isFreeTrial = Boolean(sub?.isFreeTrial || sub?.accountType === "FREE_TRIAL");

    let dueDate;
    if (company?.id === 1) {
      dueDate = "2999-12-31T00:00:00.000Z";
    } else if (isFreeTrial && sub?.trialExpiresAt) {
      dueDate = sub.trialExpiresAt;
    } else {
      const rawDue = company?.dueDate;
      if (!rawDue || !moment(rawDue).isValid()) {
        dueDate = "2999-12-31T00:00:00.000Z";
      } else {
        dueDate = rawDue;
      }
    }

    const vencimento = moment(dueDate).format("DD/MM/yyyy");

    const before = isFreeTrial
      ? moment().isSameOrBefore(moment(dueDate))
      : moment().startOf("day").isSameOrBefore(moment(dueDate).startOf("day"), "day");
    const dias = isFreeTrial
      ? Math.max(0, Math.ceil(moment(dueDate).diff(moment(), "hours") / 24))
      : moment(dueDate).startOf("day").diff(moment().startOf("day"), "days");

    if (before === true) {
      localStorage.setItem("token", JSON.stringify(data.token));
      localStorage.setItem("companyDueDate", vencimento);
      api.defaults.headers.Authorization = `Bearer ${data.token}`;
      const u = data.user || data;
      batchUpdates(() => {
        setUser({ ...u, queues: Array.isArray(u?.queues) ? u.queues : [] });
        setIsAuth(true);
        setLoading(false);
      });
      if (u?.language) {
        applyAppLanguage(u.language);
      }
      toast.success(i18n.t("auth.toasts.success"));

      if (Math.round(dias) >= 0 && Math.round(dias) < 7) {
        toast.warn(
          `Sua assinatura vence em ${Math.round(dias)} ${
            Math.round(dias) === 1 ? "dia" : "dias"
          } `
        );
      }

      history.push("/tickets");
    } else {
      api.defaults.headers.Authorization = `Bearer ${data.token}`;
      batchUpdates(() => {
        setIsAuth(true);
        setLoading(false);
      });
      toastError(`Opss! Sua assinatura venceu ${vencimento}.
Entre em contato com o Suporte para mais informações! `);
      history.push("/tickets");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history]);

  const handleLogin = useCallback(async (userData) => {
    setLoading(true);

    try {
      const { data } = await api.post("/auth/login", userData);
      await applyLoginSession(data);
    } catch (err) {
      toastError(err);
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyLoginSession]);

  const handleGoogleLoginComplete = useCallback(async (exchange) => {
    setLoading(true);

    try {
      const { data } = await openApi.post(
        "/auth/google/complete",
        { exchange },
        { withCredentials: true }
      );
      await applyLoginSession(data);
    } catch (err) {
      toastError(err);
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyLoginSession]);

  const handleLogout = useCallback(async () => {
    setLoading(true);

    try {
      const currentSocket = socketRef.current;
      if (currentSocket) {
        listenersRef.current.forEach(eventName => {
          if (currentSocket.off) {
            currentSocket.off(eventName);
          }
        });
        listenersRef.current.clear();
        
        if (typeof currentSocket.disconnect === 'function') {
          currentSocket.disconnect();
        }
      }

      await api.delete("/auth/logout");
      localStorage.removeItem("token");
      localStorage.removeItem("cshow");
      api.defaults.headers.Authorization = undefined;
      batchUpdates(() => {
        setIsAuth(false);
        setUser({ queues: [] });
        setSocket({
          on: () => {},
          off: () => {},
          emit: () => {},
          disconnect: () => {}
        });
        setLoading(false);
      });
      history.push("/login");
    } catch (err) {
      toastError(err);
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history]);

  const getCurrentUserInfo = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      console.log(data);
      return data;
    } catch (_) {
      return null;
    }
  }, []);

  return {
    isAuth,
    user,
    loading,
    handleLogin,
    applyLoginSession,
    handleGoogleLoginComplete,
    handleLogout,
    getCurrentUserInfo,
    socket,
  };
};

export default useAuth;
