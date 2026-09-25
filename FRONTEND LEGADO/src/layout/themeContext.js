import React from "react";

const ColorModeContext = React.createContext({
  toggleColorMode: () => {},
  setPrimaryColorLight: (_) => {},
  setPrimaryColorDark: (_) => {},
  setButtonPrimaryColorLight: (_) => {},
  setButtonPrimaryColorDark: (_) => {},
  setButtonPrimaryTextColorLight: (_) => {},
  setButtonPrimaryTextColorDark: (_) => {},
  setButtonSecondaryColorLight: (_) => {},
  setButtonSecondaryColorDark: (_) => {},
  setTopbarColorLight: (_) => {},
  setTopbarColorDark: (_) => {},
  setSidebarColorLight: (_) => {},
  setSidebarColorDark: (_) => {},
  setAppLogoLight: (_) => {},
  setAppLogoDark: (_) => {},
  setAppLogoFavicon: (_) => {},
  setAppLogoTickets: (_) => {},
  setAppLogoBackgroundLight: (_) => {},
  setAppLogoBackgroundDark: (_) => {},
});

export default ColorModeContext;
