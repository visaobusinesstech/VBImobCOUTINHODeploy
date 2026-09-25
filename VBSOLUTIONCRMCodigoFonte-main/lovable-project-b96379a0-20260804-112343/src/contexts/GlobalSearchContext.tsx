import { createContext, useContext, useState, ReactNode } from "react";

interface GlobalSearchContextType {
  globalSearch: string;
  setGlobalSearch: (q: string) => void;
}

const GlobalSearchContext = createContext<GlobalSearchContextType>({
  globalSearch: "",
  setGlobalSearch: () => {},
});

export const useGlobalSearch = () => useContext(GlobalSearchContext);

export function GlobalSearchProvider({ children }: { children: ReactNode }) {
  const [globalSearch, setGlobalSearch] = useState("");
  return (
    <GlobalSearchContext.Provider value={{ globalSearch, setGlobalSearch }}>
      {children}
    </GlobalSearchContext.Provider>
  );
}
