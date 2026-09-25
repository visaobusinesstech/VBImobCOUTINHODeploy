import React, { createContext, useMemo, useState } from "react";

const PageTitleContext = createContext();

const PageTitleProvider = ({ children }) => {
  const [pageTitle, setPageTitle] = useState("Dashboard");

  const value = useMemo(() => ({ pageTitle, setPageTitle }), [pageTitle]);

  return (
    <PageTitleContext.Provider value={value}>
      {children}
    </PageTitleContext.Provider>
  );
};

export { PageTitleContext, PageTitleProvider };
