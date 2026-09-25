import React, { useState, useEffect, useContext, useRef, useCallback } from "react";
import { useParams, useHistory } from "react-router-dom";

import clsx from "clsx";

import { makeStyles, Paper, useMediaQuery } from "@material-ui/core";
import { useTheme } from "@material-ui/core/styles";

import ContactDrawer from "../ContactDrawer";
import MessageInput from "../MessageInput/";
import TicketHeader from "../TicketHeader";
import TicketInfo from "../TicketInfo";
import TicketActionButtons from "../TicketActionButtonsCustom";
import MessagesList from "../MessagesList";
import api from "../../services/api";
import { ReplyMessageProvider } from "../../context/ReplyingMessage/ReplyingMessageContext";
import { ForwardMessageProvider } from "../../context/ForwarMessage/ForwardMessageContext";

import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import { TagsContainer } from "../TagsContainer";
import { isNil } from 'lodash';
import { EditMessageProvider } from "../../context/EditingMessage/EditingMessageContext";
import { TicketsContext } from "../../context/Tickets/TicketsContext";

const drawerWidth = 320;

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    height: "100%",
    minHeight: 0,
    position: "relative",
    overflow: "hidden",
    background: "transparent",
    fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
    [theme.breakpoints.down("md")]: {
      flex: "1 1 0%",
      height: "100%",
      maxHeight: "100%",
    },
  },

  mainWrapper: {
    flex: 1,
    height: "100%",
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
    backgroundColor: "transparent",
    borderRadius: 12,
    border: theme.palette.type === "dark" ? "1px solid rgba(255,255,255,0.08)" : "1px solid #e7ebf3",
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    borderLeft: "0",
    marginRight: -drawerWidth,
    transition: theme.transitions.create("margin", {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
    [theme.breakpoints.down('md')]: {
      marginRight: 0,
      borderRadius: 0,
      border: "none",
      minHeight: 0,
      height: "100%",
      maxHeight: "100%",
      flex: "1 1 0%",
    },
  },

  mainWrapperShift: {
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    transition: theme.transitions.create("margin", {
      easing: theme.transitions.easing.easeOut,
      duration: theme.transitions.duration.enteringScreen,
    }),
    marginRight: 0,
    [theme.breakpoints.down('md')]: {
      marginRight: 0,
    },
  },

  conversationColumn: {
    flex: "1 1 0%",
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
    minWidth: 0,
    height: 0, // + flexGrow: preenche o restante e isola o scroll nas mensagens
    overflow: "hidden",
    background: "transparent",
  },
}));

const Ticket = () => {
  const { ticketId } = useParams();
  const history = useHistory();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const classes = useStyles();

  const { user, socket } = useContext(AuthContext);
  const { setTabOpen } = useContext(TicketsContext);


  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [contact, setContact] = useState({});
  const [ticket, setTicket] = useState({});
  const [dragDropFiles, setDragDropFiles] = useState([]);
  const { companyId } = user;

  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      const fetchTicket = async () => {
        try {

          if (!isNil(ticketId) && ticketId !== "undefined") {

            const { data } = await api.get("/tickets/u/" + ticketId);

            let ticketData = data;
            // Se ainda veio sem conexão (race/cache), força 2ª leitura — o ShowTicket reata CONNECTED
            if (
              ["whatsapp", "whatsapp_oficial"].includes(String(data.channel || "")) &&
              !data.whatsappId
            ) {
              try {
                const again = await api.get("/tickets/u/" + ticketId);
                ticketData = again.data;
              } catch {
                /* usa data original */
              }
            }

            setContact(ticketData.contact);
            setTicket(ticketData);
            if (["pending", "open", "group", "closed"].includes(ticketData.status)) {
              setTabOpen(ticketData.status);
            }
            setLoading(false);
          }
        } catch (err) {
          history.push("/tickets");   // correção para evitar tela branca uuid não encontrado Feito por Altemir 16/08/2023
          setLoading(false);
          toastError(err);
        }
      };
      fetchTicket();
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [ticketId, user, history]);

  useEffect(() => {
    if (!socket || !user?.companyId) {
      return;
    }
    if (!ticket && !ticket.id && ticket.uuid !== ticketId && ticketId === "undefined") {
      return;
    }

    if (user.companyId) {
      //    const socket = socketManager.GetSocket();

      const onConnectTicket = () => {
        socket.emit("joinChatBox", `${ticket.id}`);
      }

      const onCompanyTicket = (data) => {
        if (data.action === "update" && data.ticket.id === ticket?.id) {
          setTicket(data.ticket);
        }

        if (data.action === "delete" && data.ticketId === ticket?.id) {
          history.push("/tickets");
        }
      };

      const onCompanyContactTicket = (data) => {
        if (data.action === "update") {
          // if (isMounted) {
          setContact((prevState) => {
            if (prevState.id === data.contact?.id) {
              return { ...prevState, ...data.contact };
            }
            return prevState;
          });
          // }
        }
      };

      socket.on("connect", onConnectTicket)
      socket.on(`company-${companyId}-ticket`, onCompanyTicket);
      socket.on(`company-${companyId}-contact`, onCompanyContactTicket);

      return () => {

        socket.emit("joinChatBoxLeave", `${ticket.id}`);
        socket.off("connect", onConnectTicket);
        socket.off(`company-${companyId}-ticket`, onCompanyTicket);
        socket.off(`company-${companyId}-contact`, onCompanyContactTicket);
      };
    }
  }, [socket, user?.companyId, ticketId, ticket, history]);

  const handleDrawerOpen = useCallback(() => {
    setDrawerOpen(true);
  }, []);

  const handleDrawerClose = useCallback(() => {
    setDrawerOpen(false);
  }, []);

  const handleQuickMessageSelect = (quickMessage) => {
    try {
      if (quickMessage.message) {
        // Disparar evento que o MessageInput vai escutar
        const event = new CustomEvent('insertQuickMessage', {
          detail: { message: quickMessage.message }
        });
        window.dispatchEvent(event);
        
      }
      
      if (quickMessage.mediaPath) {
        // Tratar mídia se necessário
      }
    } catch (error) {
      console.error("Erro ao inserir resposta rápida:", error);
      toastError("Erro ao inserir resposta rápida");
    }
  };

  const renderMessagesList = () => {
    return (
      <div className={classes.conversationColumn}>
        <MessagesList
          key={`msg-list-${ticket.id || ticketId}`}
          isGroup={ticket.isGroup}
          onDrop={setDragDropFiles}
          whatsappId={ticket.whatsappId}
          queueId={ticket.queueId}
          channel={ticket.channel}
          ticketStatus={ticket.status}
          ticketInternalId={ticket.id}
          ticketIsBot={ticket.isBot}
          ticketUseIntegration={ticket.useIntegration}
          ticketUserId={ticket.userId}
          fillParent
        />
        <MessageInput
          ticketId={ticket.id}
          ticketStatus={ticket.status}
          ticketChannel={ticket.channel}
          metaWhatsAppSession={ticket.metaWhatsAppSession}
          droppedFiles={dragDropFiles}
          contactId={contact.id}
          whatsappId={ticket.whatsappId}
          edgeToEdge
        />
      </div>
    );
  };


  return (
    <div className={classes.root} id="drawer-container">
      <Paper
        variant="outlined"
        elevation={0}
        className={clsx(classes.mainWrapper, {
          [classes.mainWrapperShift]: drawerOpen && !isMobile,
        })}
      >
        {/* <div id="TicketHeader"> */}
        <TicketHeader loading={loading}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              width: "100%",
              minWidth: 0,
              maxWidth: "100%",
              overflow: "hidden",
              gap: 4,
            }}
          >
            {ticket.contact !== undefined && (
              <div
                id="TicketHeader"
                style={{
                  flex: "1 1 auto",
                  minWidth: 0,
                  overflow: "hidden",
                }}
              >
                <TicketInfo
                  contact={contact}
                  ticket={ticket}
                  onClick={handleDrawerOpen}
                />
              </div>
            )}
            <div
              style={{
                flex: "0 1 auto",
                marginLeft: "auto",
                minWidth: 0,
                maxWidth: isMobile ? "46%" : undefined,
                overflow: "hidden",
              }}
            >
              <TicketActionButtons
                ticket={ticket}
                contact={contact}
                onQuickMessageSelect={handleQuickMessageSelect}
              />
            </div>
          </div>
        </TicketHeader>
        {/* </div> */}
        
        <ReplyMessageProvider>
          <ForwardMessageProvider>
            <EditMessageProvider>
              {renderMessagesList()}
            </EditMessageProvider>
          </ForwardMessageProvider>
        </ReplyMessageProvider>
      </Paper>

      <ContactDrawer
        open={drawerOpen}
        handleDrawerClose={handleDrawerClose}
        contact={contact}
        loading={loading}
        ticket={ticket}
      />

    </div>
  );
};

export default Ticket;
