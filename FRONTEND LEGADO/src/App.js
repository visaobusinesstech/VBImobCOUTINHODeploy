import React from "react";
import "react-toastify/dist/ReactToastify.css";
import "./styles/mobileResponsive.css";
import Routes from "./routes";

/** Router + tema global ficam em `routes/index.js` (AuthProvider) e `layout/AppThemeRoot.js`. */
export default function App() {
  return <Routes />;
}
