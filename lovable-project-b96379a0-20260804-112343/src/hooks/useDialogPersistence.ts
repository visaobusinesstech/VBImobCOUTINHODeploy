import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface PersistedDialogState {
  open: boolean;
  editId: string | null;
}

interface UseDialogPersistenceOptions<T> {
  storageKey: string;
  items?: T[];
  getId?: (item: T) => string;
  restoreOnMount?: boolean;
}

function readPersistedDialogState(storageKey: string): PersistedDialogState | null {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<PersistedDialogState>;
    if (!parsed?.open) return null;

    return {
      open: true,
      editId: typeof parsed.editId === "string" ? parsed.editId : null,
    };
  } catch {
    return null;
  }
}

export function useDialogPersistence<T>({ storageKey, items = [], getId, restoreOnMount = true }: UseDialogPersistenceOptions<T>) {
  const restoredRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedItem = useMemo(() => {
    if (!selectedId || !getId) return null;
    return items.find((item) => getId(item) === selectedId) ?? null;
  }, [getId, items, selectedId]);

  const persist = useCallback((nextOpen: boolean, nextId?: string | null) => {
    try {
      if (nextOpen) {
        localStorage.setItem(storageKey, JSON.stringify({ open: true, editId: nextId ?? null }));
      } else {
        localStorage.removeItem(storageKey);
      }
    } catch {
      // ignore persistence failures
    }
  }, [storageKey]);

  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    if (!restoreOnMount) {
      persist(false);
      return;
    }

    const state = readPersistedDialogState(storageKey);
    if (!state?.open) return;

    // Only restore "create" dialogs (no editId), never restore edit sessions
    // This prevents stale edit states from hijacking new interactions
    if (state.editId) {
      localStorage.removeItem(storageKey);
      return;
    }

    setSelectedId(null);
    setOpen(true);
  }, [persist, restoreOnMount, storageKey]);

  const openCreate = useCallback(() => {
    setSelectedId(null);
    persist(true, null);
    setOpen(true);
  }, [persist]);

  const openEdit = useCallback((item: T) => {
    if (!getId) return;

    const itemId = getId(item);
    setSelectedId(itemId);
    persist(true, itemId);
    setOpen(true);
  }, [getId, persist]);

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setSelectedId(null);
      persist(false);
    }
  }, [persist]);

  return {
    open,
    selectedId,
    selectedItem,
    setOpen,
    setSelectedId,
    persist,
    openCreate,
    openEdit,
    handleOpenChange,
  };
}