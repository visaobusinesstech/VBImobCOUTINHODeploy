import React, { useEffect, useContext } from "react";
import { useParams } from "react-router-dom";
import { makeStyles } from "@material-ui/core/styles";
import Box from "@material-ui/core/Box";

import TicketsManagerTabs from "../../components/TicketsManagerTabs/";
import Ticket from "../../components/Ticket/";
import TicketAdvancedLayout from "../../components/TicketAdvancedLayout";

import { TicketsContext } from "../../context/Tickets/TicketsContext";
import { QueueSelectedProvider } from "../../context/QueuesSelected/QueuesSelectedContext";

const useStyles = makeStyles((theme) => ({
  shell: {
    width: "100%",
    height: "100%",
    maxHeight: "100%",
    minHeight: 0,
    flex: "1 1 0%",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    overflowX: "hidden",
    background: theme.palette.background.default,
  },
  pane: {
    flex: "1 1 0%",
    minHeight: 0,
    minWidth: 0,
    height: 0,
    width: "100%",
    maxWidth: "100%",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    WebkitOverflowScrolling: "touch",
  },
}));

const TicketAdvanced = () => {
  const classes = useStyles();
  const { ticketId } = useParams();
  const { setCurrentTicket } = useContext(TicketsContext);

  const hasTicket =
    Boolean(ticketId) && ticketId !== "undefined" && ticketId !== "null";

  useEffect(() => {
    return () => {
      setCurrentTicket({ id: null, code: null });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <QueueSelectedProvider>
      <TicketAdvancedLayout>
        <Box className={classes.shell}>
          {hasTicket ? (
            <Box className={classes.pane} component="section" aria-label="Conversa">
              <Ticket />
            </Box>
          ) : (
            <Box
              className={classes.pane}
              component="section"
              aria-label="Lista de atendimentos"
            >
              <TicketsManagerTabs />
            </Box>
          )}
        </Box>
      </TicketAdvancedLayout>
    </QueueSelectedProvider>
  );
};

export default TicketAdvanced;
