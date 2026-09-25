import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const POST_AUTH_REDIRECT_KEY = "post_auth_redirect";
const POST_AUTH_REDIRECT_EVENT = "post-auth-redirect-change";

function notifyPendingAuthRedirectChange() {
  try {
    window.dispatchEvent(new CustomEvent(POST_AUTH_REDIRECT_EVENT));
  } catch {
    // Ignore dispatch failures in restrictive browser contexts.
  }
}

export function setPendingAuthRedirect(path: string) {
  try {
    sessionStorage.setItem(POST_AUTH_REDIRECT_KEY, path);
    notifyPendingAuthRedirectChange();
  } catch {
    // Ignore storage failures in restrictive browser contexts.
  }
}

export function clearPendingAuthRedirect() {
  try {
    sessionStorage.removeItem(POST_AUTH_REDIRECT_KEY);
    notifyPendingAuthRedirectChange();
  } catch {
    // Ignore storage failures in restrictive browser contexts.
  }
}

function readPendingAuthRedirect() {
  try {
    return sessionStorage.getItem(POST_AUTH_REDIRECT_KEY);
  } catch {
    return null;
  }
}

export function getPendingAuthRedirect() {
  return readPendingAuthRedirect();
}

export function usePendingAuthRedirect() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [pendingPath, setPendingPath] = useState<string | null>(() => readPendingAuthRedirect());

  useEffect(() => {
    const syncPendingPath = () => {
      setPendingPath(readPendingAuthRedirect());
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === POST_AUTH_REDIRECT_KEY) {
        syncPendingPath();
      }
    };

    window.addEventListener(POST_AUTH_REDIRECT_EVENT, syncPendingPath);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(POST_AUTH_REDIRECT_EVENT, syncPendingPath);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  useEffect(() => {
    if (loading || !user || !pendingPath) return;

    clearPendingAuthRedirect();

    if (window.location.pathname !== pendingPath) {
      navigate(pendingPath, { replace: true });
    }
  }, [loading, navigate, pendingPath, user]);
}