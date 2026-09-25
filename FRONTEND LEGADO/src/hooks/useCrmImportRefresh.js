import { useEffect, useState } from "react";

export const CRM_IMPORTED_EVENT = "vb:crm-imported";

export function dispatchCrmImported(detail) {
  window.dispatchEvent(new CustomEvent(CRM_IMPORTED_EVENT, { detail }));
}

/** Incrementa quando um import CRM conclui na página indicada — use como dependência de reload. */
export default function useCrmImportRefresh(pageKey) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const handler = (event) => {
      if (event.detail?.pageKey === pageKey) {
        setTick((value) => value + 1);
      }
    };
    window.addEventListener(CRM_IMPORTED_EVENT, handler);
    return () => window.removeEventListener(CRM_IMPORTED_EVENT, handler);
  }, [pageKey]);
  return tick;
}
