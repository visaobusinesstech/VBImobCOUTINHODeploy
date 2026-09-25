import { useState, useCallback } from "react";

export function useTabPersistence(storageKey: string, defaultValue: string): [string, (value: string) => void] {
  const [tab, setTab] = useState<string>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      return stored || defaultValue;
    } catch {
      return defaultValue;
    }
  });

  const setAndPersist = useCallback((value: string) => {
    setTab(value);
    try {
      localStorage.setItem(storageKey, value);
    } catch {
      // ignore
    }
  }, [storageKey]);

  return [tab, setAndPersist];
}
