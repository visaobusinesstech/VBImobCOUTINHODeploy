import { useEffect, useCallback, useRef } from "react";

const DRAFT_PREFIX = "draft_v1_";

function readDraft<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(DRAFT_PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeDraft<T>(key: string, data: T) {
  try {
    localStorage.setItem(DRAFT_PREFIX + key, JSON.stringify(data));
  } catch {
    // ignore quota errors
  }
}

export function clearDraft(key: string) {
  try {
    localStorage.removeItem(DRAFT_PREFIX + key);
  } catch {
    // ignore
  }
}

/**
 * Persists form state as a draft in localStorage.
 */
export function useDraft<T>(
  key: string,
  form: T,
  setForm: (data: T) => void,
  options: { enabled: boolean; open: boolean },
) {
  const restoredRef = useRef(false);

  useEffect(() => {
    if (!options.open || !options.enabled || restoredRef.current) {
      if (!options.open) restoredRef.current = false;
      return;
    }
    const draft = readDraft<T>(key);
    if (draft) {
      setForm(draft);
    }
    restoredRef.current = true;
  }, [options.open, options.enabled, key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!options.open || !options.enabled || !restoredRef.current) return;
    writeDraft(key, form);
  }, [form, options.open, options.enabled, key]);

  const clear = useCallback(() => {
    clearDraft(key);
    restoredRef.current = false;
  }, [key]);

  return { clearDraft: clear };
}
