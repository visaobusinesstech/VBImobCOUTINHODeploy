import React from "react";
import withWidth, { isWidthUp } from "@material-ui/core/withWidth";
import { makeStyles } from "@material-ui/core/styles";

import Tickets from "../TicketsCustom";
import TicketAdvanced from "../TicketsAdvanced";

const useStyles = makeStyles(() => ({
  mobileShell: {
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
    minHeight: 0,
    flex: "1 1 0%",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    overflowX: "hidden",
    boxSizing: "border-box",
  },
}));

function TicketResponsiveContainer(props) {
  const classes = useStyles();

  if (isWidthUp("md", props.width)) {
    return <Tickets />;
  }

  return (
    <div className={classes.mobileShell} data-tickets-layout="mobile">
      <TicketAdvanced />
    </div>
  );
}

export default withWidth()(TicketResponsiveContainer);
