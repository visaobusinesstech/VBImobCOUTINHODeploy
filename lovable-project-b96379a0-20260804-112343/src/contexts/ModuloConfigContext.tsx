import { ReactNode } from "react";
import { ModuloConfigContext, useModuloConfigProvider } from "@/hooks/useModuloConfig";

export function ModuloConfigProvider({ children }: { children: ReactNode }) {
  const value = useModuloConfigProvider();
  return (
    <ModuloConfigContext.Provider value={value}>
      {children}
    </ModuloConfigContext.Provider>
  );
}
