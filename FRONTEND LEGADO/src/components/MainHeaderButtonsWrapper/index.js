import React from "react";
import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles((theme) => ({
  MainHeaderButtonsWrapper: {
    flex: "none",
    marginLeft: "auto",
    display: "flex",
    alignItems: "center",
    "& > *": {
      margin: theme.spacing(1),
    },
  },
}));

/** Agrupa botões do cabeçalho da página (ajuda fica na navbar interna ou na topbar global). */
const MainHeaderButtonsWrapper = ({ children }) => {
  const classes = useStyles();
  return <div className={classes.MainHeaderButtonsWrapper}>{children}</div>;
};

export default MainHeaderButtonsWrapper;
