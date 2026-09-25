import { useCallback, useEffect, useState } from "react";
import { BRAIN_CRM_MCP_OPTIONS } from "../config/brainCrmCatalog";

function storageKey(userId) {
  return `brain-ai-crm:${userId || "guest"}`;
}

function readStored(userId) {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const allowed = new Set(BRAIN_CRM_MCP_OPTIONS.map((item) => item.id));
    return parsed.filter((id) => allowed.has(id));
  } catch {
    return [];
  }
}

export default function useBrainCrmSelection(userId) {
  const [selectedCrms, setSelectedCrmsState] = useState(() => readStored(userId));

  useEffect(() => {
    setSelectedCrmsState(readStored(userId));
  }, [userId]);

  const setSelectedCrms = useCallback(
    (next) => {
      const value = Array.isArray(next) ? next : [];
      setSelectedCrmsState(value);
      try {
        localStorage.setItem(storageKey(userId), JSON.stringify(value));
      } catch {
        /* ignore */
      }
    },
    [userId]
  );

  return { selectedCrms, setSelectedCrms };
}
