/**
 * Preferências de UI e rascunhos — persistidos no banco (Users.uiPreferences / UserFormDrafts).
 */

import { useCallback, useContext, useEffect, useRef, useState } from "react";
import api from "../services/api";
import { AuthContext } from "../context/Auth/AuthContext";

let prefsCache = {};
let prefsLoaded = false;
let saveTimer = null;

export async function fetchUiPreferences() {
  const { data } = await api.get("/users/me/ui-preferences");
  prefsCache = data?.uiPreferences || {};
  prefsLoaded = true;
  return data;
}

export async function patchUiPreferences(partial, defaultTheme) {
  const body = { uiPreferences: partial || {} };
  if (defaultTheme === "light" || defaultTheme === "dark") {
    body.defaultTheme = defaultTheme;
  }
  const { data } = await api.put("/users/me/ui-preferences", body);
  prefsCache = data?.uiPreferences || { ...prefsCache, ...(partial || {}) };
  prefsLoaded = true;
  return data;
}

export function getCachedPref(key, fallback) {
  if (!prefsLoaded) return fallback;
  const v = prefsCache?.[key];
  return v === undefined || v === null ? fallback : v;
}

export function useUserUiPreferences() {
  const { user, isAuth } = useContext(AuthContext);
  const [prefs, setPrefs] = useState(() =>
    user?.uiPreferences && typeof user.uiPreferences === "object"
      ? user.uiPreferences
      : prefsCache
  );
  const [ready, setReady] = useState(prefsLoaded || Boolean(user?.uiPreferences));
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isAuth || !user?.id) return undefined;
    let cancelled = false;
    (async () => {
      try {
        if (user.uiPreferences && typeof user.uiPreferences === "object") {
          prefsCache = { ...user.uiPreferences };
          prefsLoaded = true;
          if (!cancelled && mounted.current) {
            setPrefs(prefsCache);
            setReady(true);
          }
        }
        const data = await fetchUiPreferences();
        if (!cancelled && mounted.current) {
          setPrefs(data?.uiPreferences || {});
          setReady(true);
        }
      } catch {
        if (!cancelled && mounted.current) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuth, user?.id]);

  const getPref = useCallback(
    (key, fallback) => {
      const v = prefs?.[key];
      return v === undefined || v === null ? fallback : v;
    },
    [prefs]
  );

  const setPref = useCallback(async (key, value) => {
    const partial = { [key]: value };
    setPrefs((prev) => {
      const next = { ...(prev || {}), ...partial };
      prefsCache = next;
      return next;
    });
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      patchUiPreferences(partial).catch(() => {});
    }, 250);
  }, []);

  const setPrefsMerge = useCallback(async (partial) => {
    setPrefs((prev) => {
      const next = { ...(prev || {}), ...(partial || {}) };
      prefsCache = next;
      return next;
    });
    return patchUiPreferences(partial || {});
  }, []);

  return { prefs, ready, getPref, setPref, setPrefsMerge };
}

export async function loadFormDraft(draftKey) {
  const { data } = await api.get(`/users/me/form-drafts/${encodeURIComponent(draftKey)}`);
  return data?.payload || null;
}

export async function saveFormDraft(draftKey, payload) {
  const { data } = await api.put(`/users/me/form-drafts/${encodeURIComponent(draftKey)}`, {
    payload: payload || {},
  });
  return data?.payload || payload;
}

export async function clearFormDraft(draftKey) {
  await api.delete(`/users/me/form-drafts/${encodeURIComponent(draftKey)}`);
}
