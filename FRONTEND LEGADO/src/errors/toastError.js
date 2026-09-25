import { toast } from "react-toastify";
import { i18n } from "../translate/i18n";
import { isString } from 'lodash';

/** Erros típicos quando a sessão WhatsApp cai / não subiu — várias requisições geravam toast em cascata. */
const WHATSAPP_CONNECTION_ERRORS = new Set([
  "ERR_WAPP_NOT_INITIALIZED",
  "ERR_NO_DEF_WAPP_FOUND",
  "ERR_WAPP_CHECK_CONTACT",
  "ERR_WAPP_DOWNLOAD_MEDIA",
  "ERR_SENDING_WAPP_MSG",
  "ERR_DELETE_WAPP_MSG",
]);

const WHATSAPP_TOAST_COOLDOWN_MS = 45000;
let lastWhatsappConnectionToastAt = 0;

const toastError = (err) => {
  const status = err?.response?.status;
  const isNetworkOrServer =
    !status || status >= 500 || err?.message === "Network Error" || err?.code === "ECONNABORTED";

  if (isNetworkOrServer) {
    // Silencia erros de infraestrutura (ex.: DB/servidor indisponível) para não poluir a UI
    // Mantém log para diagnóstico em dev (sem referenciar process diretamente)
    const isDevEnv =
      (typeof process !== "undefined" &&
        process.env &&
        process.env.NODE_ENV !== "production");
    if (isDevEnv) {
      // eslint-disable-next-line no-console
      console.warn("[toastError] Silenciado erro de servidor/rede:", err);
    }
    return;
  }

  const errorMsg =
    err?.response?.data?.error ||
    err?.response?.data?.message ||
    err?.response?.data?.webhookError;

  if (
    typeof errorMsg === "string" &&
    (/não possui conexão vinculada/i.test(errorMsg) ||
      /provavelmente foi exclu[ií]da a conexão/i.test(errorMsg))
  ) {
    const mapped = i18n.exists("backendErrors.ERR_NO_DEF_WAPP_FOUND")
      ? i18n.t("backendErrors.ERR_NO_DEF_WAPP_FOUND")
      : "Nenhuma conexão WhatsApp CONNECTED disponível. Abra Conexões e verifique o status.";
    toast.error(mapped, {
      toastId: "whatsapp-orphan-ticket",
      autoClose: 8000,
    });
    return;
  }

  // Yup em inglês — não poluir UI; campos extras vazios já são filtrados no backend
  if (
    typeof errorMsg === "string" &&
    /^[\w.[\]]+\s+is a required field$/i.test(errorMsg.trim())
  ) {
    return;
  }

  // Sessão expirada: o interceptor de auth já remove o token e a rota privada redireciona ao login.
  // Mostrar toast aqui gera falso positivo (ex.: requisição antiga + refresh já renovou a sessão).
  if (errorMsg === "ERR_SESSION_EXPIRED") {
    return;
  }
  if (
    typeof errorMsg === "string" &&
    (errorMsg.includes("ERR_META_TOKEN_INVALID") ||
      errorMsg.includes("Token Meta") ||
      errorMsg.includes("#190") ||
      /código\s*190/i.test(errorMsg) ||
      /Authentication Error/i.test(errorMsg))
  ) {
    const friendly = /Authentication Error/i.test(errorMsg)
      ? "Token Meta expirado ou inválido (#190). Use Conexões → Reparar conexão ou refaça o Embedded Signup / cole um System User Token permanente."
      : errorMsg.replace(/^ERR_META_TOKEN_INVALID:\s*/i, "");
    toast.error(friendly, { autoClose: 10000, toastId: "meta-token-invalid" });
    return;
  }
  if (errorMsg) {
    const baseToast = {
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: false,
      draggable: true,
      progress: undefined,
      theme: "light",
    };

    let toastId = errorMsg;
    let autoClose = 2000;

    if (WHATSAPP_CONNECTION_ERRORS.has(errorMsg)) {
      const now = Date.now();
      if (now - lastWhatsappConnectionToastAt < WHATSAPP_TOAST_COOLDOWN_MS) {
        return;
      }
      lastWhatsappConnectionToastAt = now;
      toastId = "whatsapp-connection-errors";
      autoClose = 8000;
    }

    if (i18n.exists(`backendErrors.${errorMsg}`)) {
      toast.error(i18n.t(`backendErrors.${errorMsg}`), {
        ...baseToast,
        toastId,
        autoClose,
      });
      return;
    }
    toast.error(errorMsg, {
      ...baseToast,
      toastId,
      autoClose,
    });
    return;
  }

  if (isString(err)) {
    toast.error(err);
    return;
  }

  toast.error("Ocorreu um erro. Tente novamente.");
  return;
};

export default toastError;
