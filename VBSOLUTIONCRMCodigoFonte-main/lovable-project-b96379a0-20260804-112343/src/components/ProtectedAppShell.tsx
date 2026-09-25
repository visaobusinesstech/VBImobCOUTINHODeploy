import { ReactNode } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ModuleGuard } from "@/components/ModuleGuard";
import { GlobalSearchProvider } from "@/contexts/GlobalSearchContext";
import { ModuloConfigProvider } from "@/contexts/ModuloConfigContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { MaskProvider } from "@/components/shared/MetricCard";
import { useSwCleanupSync } from "@/hooks/useSwCleanupSync";

function SwCleanupSync() {
  useSwCleanupSync();
  return null;
}

export function ProtectedAppShell({ children }: { children: ReactNode }) {
  return (
    <MaskProvider>
      <GlobalSearchProvider>
      <ModuloConfigProvider>
        <NotificationProvider>
          <ProtectedRoute>
            <SwCleanupSync />
            <ModuleGuard>{children}</ModuleGuard>
          </ProtectedRoute>
        </NotificationProvider>
      </ModuloConfigProvider>
    </GlobalSearchProvider>
  </MaskProvider>
);
}
