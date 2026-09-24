/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 */

import React, { useContext, useEffect, useReducer, useState, useRef } from "react";
import ReactDOM from "react-dom";
import { Link as RouterLink, useLocation, useHistory } from "react-router-dom";
import { makeStyles, useTheme } from "@material-ui/core/styles";
import useHelps from "../hooks/useHelps";
import ListItem from "@material-ui/core/ListItem";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import ListItemText from "@material-ui/core/ListItemText";
import ListSubheader from "@material-ui/core/ListSubheader";
import Divider from "@material-ui/core/Divider";
import Badge from "@material-ui/core/Badge";
import Collapse from "@material-ui/core/Collapse";
import List from "@material-ui/core/List";
import Tooltip from "@material-ui/core/Tooltip";
import Typography from "@material-ui/core/Typography";

import ExpandLessIcon from "@material-ui/icons/ExpandLess";
import ExpandMoreIcon from "@material-ui/icons/ExpandMore";
import { Description } from "@material-ui/icons";
import AppIcon from "../components/ui/AppIcon";
import {
  Home,
  CircleDollarSign,
  CheckSquare,
  FolderKanban,
  Calendar,
  Building2,
  Contact,
  MoreHorizontal,
  Package,
  Code,
  HelpCircle,
  MessageSquare,
  GitBranch,
  Megaphone,
  Zap,
  LayoutDashboard,
  Mail,
  Workflow,
  Settings,
  Bot,
  Plug,
  Webhook,
} from "lucide-react";

import { WhatsAppsContext } from "../context/WhatsApp/WhatsAppsContext";
import { AuthContext } from "../context/Auth/AuthContext";
import { useActiveMenu } from "../context/ActiveMenuContext";

import { Can } from "../components/Can";

import { isArray } from "lodash";
import api from "../services/api";
import { resolveSocketCompanyId } from "../services/socket";
import toastError from "../errors/toastError";
import usePlans from "../hooks/usePlans";
// import useVersion from "../hooks/useVersion";
import { i18n } from "../translate/i18n";
import { cn } from "../lib/utils";
import useAppTranslation from "../hooks/useAppTranslation";
import { Campaign, ShapeLine } from "@mui/icons-material";

import useCompanySettings from "../hooks/useSettings/companySettings";

/** Ícones com menu aberto. */
const SIDEBAR_ICON_SIZE = 15;
/** Ícones com menu recolhido — um pouco maiores. */
const SIDEBAR_ICON_SIZE_COLLAPSED = 17;
/** Coluna de ícones (aberto). */
const SIDEBAR_ICON_COL = 28;
/** Coluna de ícones (recolhido). */
const SIDEBAR_ICON_COL_COLLAPSED = 32;
/** Altura de cada linha do menu. */
const SIDEBAR_ITEM_H = 28;
/** Altura das linhas do bloco inferior (Atendimento, Configurações, etc.). */
const SIDEBAR_BOTTOM_ITEM_H = 32;
/** Espaço vertical entre cada página do menu. */
const SIDEBAR_ITEM_GAP = 6;
/** Ícones do bloco inferior — mesmo tamanho dos demais para consistência. */
const SIDEBAR_BOTTOM_ICON_SIZE = 15;
/** Coluna de ícones do bloco inferior. */
const SIDEBAR_BOTTOM_ICON_COL = 30;
/** Margem lateral — fundo cinza não encosta na borda do menu. */
const SIDEBAR_ITEM_INSET_X = 6;

const useStyles = makeStyles((theme) => ({
  sidebarList: {
    width: "100%",
    boxSizing: "border-box",
    padding: "4px 0",
    "& .MuiListItem-root": {
      minHeight: `${SIDEBAR_ITEM_H}px !important`,
      height: `${SIDEBAR_ITEM_H}px !important`,
      paddingTop: "0 !important",
      paddingBottom: "0 !important",
    },
    "& .MuiListItem-dense": {
      paddingTop: "0 !important",
      paddingBottom: "0 !important",
    },
    "& .MuiListItemIcon-root": {
      minWidth: (props) =>
        props.collapsed
          ? "100% !important"
          : `${SIDEBAR_ICON_COL}px !important`,
      width: (props) => (props.collapsed ? "100%" : SIDEBAR_ICON_COL),
      padding: "0 !important",
      alignSelf: "center",
      justifyContent: "center",
    },
    "& .MuiListItemText-root": {
      margin: "0 !important",
      padding: "0 !important",
      alignSelf: "center",
    },
  },

  listItemBottomPrimary: {
    minHeight: `${SIDEBAR_BOTTOM_ITEM_H}px !important`,
    height: SIDEBAR_BOTTOM_ITEM_H,
    "& .MuiListItemIcon-root": {
      minWidth: `${SIDEBAR_BOTTOM_ICON_COL}px !important`,
      width: SIDEBAR_BOTTOM_ICON_COL,
      height: SIDEBAR_BOTTOM_ICON_COL,
    },
    "& $listItemText": {
      fontSize: "11.5px !important",
      lineHeight: `${SIDEBAR_BOTTOM_ITEM_H}px !important`,
    },
    "& $iconSlot": {
      width: SIDEBAR_ICON_SIZE,
      height: SIDEBAR_ICON_SIZE,
      "& svg": {
        width: SIDEBAR_ICON_SIZE,
        height: SIDEBAR_ICON_SIZE,
      },
    },
  },

  listItem: {
    minHeight: `${SIDEBAR_ITEM_H}px !important`,
    height: SIDEBAR_ITEM_H,
    paddingTop: "0 !important",
    paddingBottom: "0 !important",
    paddingLeft: (props) =>
      props.collapsed ? "0 !important" : "6px !important",
    paddingRight: (props) =>
      props.collapsed ? "0 !important" : "6px !important",
    borderRadius: 8,
    marginLeft: (props) =>
      props.collapsed ? 5 : SIDEBAR_ITEM_INSET_X,
    marginRight: (props) =>
      props.collapsed ? 5 : SIDEBAR_ITEM_INSET_X,
    marginTop: SIDEBAR_ITEM_GAP,
    marginBottom: 0,
    width: (props) =>
      props.collapsed
        ? `calc(100% - 10px)`
        : `calc(100% - ${SIDEBAR_ITEM_INSET_X * 2}px)`,
    alignItems: "center",
    boxSizing: "border-box",
    "& .MuiListItemIcon-root": {
      minWidth: (props) =>
        props.collapsed
          ? "100% !important"
          : `${SIDEBAR_ICON_COL}px !important`,
      width: (props) => (props.collapsed ? "100%" : SIDEBAR_ICON_COL),
      height: (props) =>
        props.collapsed ? SIDEBAR_ICON_COL_COLLAPSED : SIDEBAR_ICON_COL,
      marginRight: "0 !important",
      justifyContent: "center",
      alignItems: "center",
    },
    "&:hover $iconSlot": {
      color:
        theme.mode === "dark"
          ? theme.palette.sidebarMenuHoverAccent
          : "rgba(0, 0, 0, 0.72)",
    },
    "&:hover $listItemText": {
      color:
        theme.mode === "dark"
          ? "rgba(245, 245, 250, 0.92)"
          : "rgba(0, 0, 0, 0.72)",
      fontWeight: 300,
    },
    "&:hover": {
      backgroundColor: theme.palette.sidebarMenuItemHoverBg,
    },
    transition: "background-color 0.15s ease, color 0.15s ease",
    justifyContent: props => props.collapsed ? "center" : "flex-start", // Centraliza o conteúdo se colapsado
  },

  moreItem: {
    marginTop: 8,
    marginBottom: 4,
    "& $listItemTextRoot": {
      flex: "1 1 auto",
      display: "flex",
      justifyContent: "center",
      minWidth: 0,
    },
    "& .MuiListItemText-primary": {
      textAlign: "center",
      width: "100%",
    },
  },

  moreCollapse: {
    paddingTop: 0,
    paddingBottom: 0,
  },

  bottomSpacing: {
    marginTop: 8,
    marginBottom: 4,
  },

  listItemActive: {
    backgroundColor:
      theme.mode === "dark"
        ? "rgba(255, 255, 255, 0.07)"
        : "rgba(0, 0, 0, 0.05)",
    boxShadow: "none",
    borderRadius: 8,
    "& $listItemText": {
      color:
        theme.mode === "dark"
          ? "rgba(248, 248, 252, 0.98)"
          : "rgba(0, 0, 0, 0.78)",
      fontWeight: theme.mode === "dark" ? 400 : 500,
    },
    "& $iconSlot": {
      color:
        theme.mode === "dark"
          ? "rgba(248, 248, 252, 0.98)"
          : "rgba(0, 0, 0, 0.78)",
    },
  },

  listItemTextRoot: {
    margin: "0 !important",
    padding: "0 !important",
    flex: "1 1 auto",
    minWidth: 0,
    alignSelf: "center",
  },

  listItemTextSubmenu: {
    "& .MuiListItemText-primary": {
      paddingLeft: "8px !important",
    },
  },

  menuGroupHeader: {
    minHeight: "22px !important",
    height: 22,
    marginTop: 8,
    marginBottom: 2,
    opacity: 0.85,
    "& $listItemText": {
      fontSize: "9.5px !important",
      fontWeight: "600 !important",
      letterSpacing: "0.06em",
      textTransform: "uppercase",
    },
  },

  listItemText: {
    fontSize: "10.5px !important",
    lineHeight: `${SIDEBAR_ITEM_H}px !important`,
    color: theme.palette.sidebarMenuTextPrimary,
    transition: "color 0.15s ease",
    fontWeight: 400,
    fontFamily:
      '"Inter", "Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    letterSpacing: "-0.01em",
    display: "block",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  listItemIcon: {
    minWidth: (props) =>
      `${props.collapsed ? SIDEBAR_ICON_COL_COLLAPSED : SIDEBAR_ICON_COL}px !important`,
    width: (props) =>
      props.collapsed ? SIDEBAR_ICON_COL_COLLAPSED : SIDEBAR_ICON_COL,
    height: (props) =>
      props.collapsed ? SIDEBAR_ICON_COL_COLLAPSED : SIDEBAR_ICON_COL,
    marginRight: (props) => (props.collapsed ? 0 : 3),
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    color: theme.palette.sidebarMenuIcon,
  },

  iconSlot: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: (props) =>
      props.collapsed ? SIDEBAR_ICON_SIZE_COLLAPSED : SIDEBAR_ICON_SIZE,
    height: (props) =>
      props.collapsed ? SIDEBAR_ICON_SIZE_COLLAPSED : SIDEBAR_ICON_SIZE,
    color: "inherit",
    lineHeight: 0,
    flexShrink: 0,
    "& svg": {
      display: "block",
      flexShrink: 0,
      width: (props) =>
        props.collapsed ? SIDEBAR_ICON_SIZE_COLLAPSED : SIDEBAR_ICON_SIZE,
      height: (props) =>
        props.collapsed ? SIDEBAR_ICON_SIZE_COLLAPSED : SIDEBAR_ICON_SIZE,
    },
    "& svg:not([data-openai])": {
      fill: "none",
      stroke: "currentColor",
    },
  },

  listItemExpandable: {
    paddingRight: "8px !important",
  },

  listItemTrailing: {
    marginLeft: "auto",
    marginRight: 2,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 12,
    minWidth: 12,
    height: SIDEBAR_ITEM_H,
    flexShrink: 0,
    color: theme.palette.sidebarMenuTextSecondary,
  },

  badge: {
    "& .MuiBadge-badge": {
      backgroundColor: "#ef4444",
      color: "#fff",
      fontSize: "0.625rem",
      fontWeight: 600,
      minWidth: 16,
      height: 16,
    },
  },

  submenuContainer: {
    backgroundColor:
      theme.mode === "light" ? "rgba(0, 0, 0, 0.02)" : "transparent",
  },

  customTooltip: {
    backgroundColor: theme.mode === "light" ? "#1e293b" : "#374151",
    color: "#fff",
    fontSize: "0.875rem",
    fontWeight: 500,
    borderRadius: "8px",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
    "& .MuiTooltip-arrow": {
      color: theme.mode === "light" ? "#1e293b" : "#374151",
    }
  },

  versionContainer: {
    textAlign: "center",
    padding: "10px",
    color: theme.palette.sidebarMenuTextSecondary,
    fontSize: "12px",
    fontWeight: 300,
    borderTop: `1px solid ${theme.palette.divider}`,
    marginTop: "auto",
  },

  adminSection: {
    "& .MuiListSubheader-root": {
      color: theme.palette.sidebarMenuTextSecondary,
      fontSize: "0.875rem",
      fontWeight: 300,
      textTransform: "uppercase",
      letterSpacing: "0.5px",
    }
  },

  expandIcon: {
    fontSize: "14px !important",
    width: 14,
    height: 14,
    transition: "transform 0.3s ease",
    color: "inherit",
    display: "block",
    "&.expanded": {
      transform: "rotate(180deg)",
    },
  },

  menuContainer: {
    overflowY: "auto",
    "&::-webkit-scrollbar": {
      width: 3,
    },
    "&::-webkit-scrollbar-track": {
      backgroundColor: "transparent",
    },
    "&::-webkit-scrollbar-thumb": {
      backgroundColor: theme.palette.type === "dark" ? "rgba(255,255,255,0.4)" : "rgba(148, 163, 184, 0.6)",
      borderRadius: 2,
    },
  },
}));

function ListItemLink(props) {
  const { icon, primary, to, tooltip, showBadge, bottom, submenu, isBottomPrimary } = props;
  const collapsed = props.collapsed;
  const classes = useStyles({ collapsed });
  const muiTheme = useTheme();
  const { activeMenu } = useActiveMenu();
  const location = useLocation();
  const isActive = activeMenu === to || location.pathname === to;
  const iconColor = isActive
    ? muiTheme.palette.sidebarMenuHoverAccent ||
      muiTheme.palette.sidebarMenuIcon
    : muiTheme.palette.sidebarMenuIcon;

  const renderIcon = () => {
    if (!React.isValidElement(icon)) return icon;
    const iconSize = collapsed
      ? SIDEBAR_ICON_SIZE_COLLAPSED
      : SIDEBAR_ICON_SIZE;
    return React.cloneElement(icon, {
      size: iconSize,
      color: iconColor,
      strokeWidth: icon.props?.strokeWidth ?? 1.5,
    });
  };

  const renderLink = React.useMemo(
    () =>
      React.forwardRef((itemProps, ref) => (
        <RouterLink to={to} ref={ref} {...itemProps} />
      )),
    [to]
  );

  const ConditionalTooltip = ({ children, tooltipEnabled }) =>
    tooltipEnabled ? (
      <Tooltip title={primary} placement="right">
        <span style={{ display: "block", width: "100%" }}>{children}</span>
      </Tooltip>
    ) : (
      children
    );

  return (
    <ConditionalTooltip tooltipEnabled={!!tooltip}>
      <ListItem
        button
        dense
        component={renderLink}
        className={`${classes.listItem} ${isActive ? classes.listItemActive : ""} ${bottom ? classes.bottomSpacing : ""} ${isBottomPrimary && !collapsed ? classes.listItemBottomPrimary : ""}`}
      >
        {icon ? (
          <ListItemIcon className={classes.listItemIcon}>
            {showBadge ? (
              <Badge
                badgeContent="!"
                color="error"
                overlap="circular"
                className={classes.badge}
              >
                <span className={classes.iconSlot} style={{ color: iconColor }}>
                  {renderIcon()}
                </span>
              </Badge>
            ) : (
              <span className={classes.iconSlot} style={{ color: iconColor }}>
                {renderIcon()}
              </span>
            )}
          </ListItemIcon>
        ) : null}
        {!collapsed && (
          <ListItemText
            primary={primary}
            primaryTypographyProps={{
              className: classes.listItemText,
              noWrap: true,
            }}
            className={`${classes.listItemTextRoot} ${submenu ? classes.listItemTextSubmenu : ""}`}
          />
        )}
      </ListItem>
    </ConditionalTooltip>
  );
}

const reducer = (state, action) => {
  if (action.type === "LOAD_CHATS") {
    const chats = action.payload;
    const newChats = [];

    if (isArray(chats)) {
      chats.forEach((chat) => {
        const chatIndex = state.findIndex((u) => u.id === chat.id);
        if (chatIndex !== -1) {
          state[chatIndex] = chat;
        } else {
          newChats.push(chat);
        }
      });
    }

    return [...state, ...newChats];
  }

  if (action.type === "UPDATE_CHATS") {
    const chat = action.payload;
    const chatIndex = state.findIndex((u) => u.id === chat.id);

    if (chatIndex !== -1) {
      state[chatIndex] = chat;
      return [...state];
    } else {
      return [chat, ...state];
    }
  }

  if (action.type === "DELETE_CHAT") {
    const chatId = action.payload;

    const chatIndex = state.findIndex((u) => u.id === chatId);
    if (chatIndex !== -1) {
      state.splice(chatIndex, 1);
    }
    return [...state];
  }

  if (action.type === "RESET") {
    return [];
  }

  if (action.type === "CHANGE_CHAT") {
    const changedChats = state.map((chat) => {
      if (chat.id === action.payload.chat.id) {
        return action.payload.chat;
      }
      return chat;
    });
    return changedChats;
  }
};

const MainListItems = ({ collapsed, drawerClose, section }) => {
  const { ui: translateUi } = useAppTranslation();
  const theme = useTheme();
  const classes = useStyles({ collapsed });
  const { whatsApps } = useContext(WhatsAppsContext);
  const { user, socket } = useContext(AuthContext);
  const history = useHistory();

  const { setActiveMenu } = useActiveMenu();
  const location = useLocation();

  const [connectionWarning, setConnectionWarning] = useState(false);
  const [openCampaignSubmenu, setOpenCampaignSubmenu] = useState(false);
  const [openDashboardSubmenu, setOpenDashboardSubmenu] = useState(false);
  const [openVBZappySubmenu, setOpenVBZappySubmenu] = useState(false);
  const [openSettingsSubmenu, setOpenSettingsSubmenu] = useState(false);
  const [openMoreSubmenu, setOpenMoreSubmenu] = useState(false);
  const [menuGroup, setMenuGroup] = useState({
    atendimento: true,
    ia: true,
    vendas: true,
    imoveis: true,
    radar: false,
    conteudo: false,
    gestao: false,
    sistema: false,
  });
  const toggleMenuGroup = (key) =>
    setMenuGroup((prev) => ({ ...prev, [key]: !prev[key] }));
  const [openCompaniesSubmenu, setOpenCompaniesSubmenu] = useState(false);
  
  const [showCampaigns, setShowCampaigns] = useState(false);
  const [showKanban, setShowKanban] = useState(false);
  const [showOpenAi, setShowOpenAi] = useState(false);
  const [showIntegrations, setShowIntegrations] = useState(false);
  const [showWavoipCall, setShowWavoipCall] = useState(false);

  const [showSchedules, setShowSchedules] = useState(false);
  const [showInternalChat, setShowInternalChat] = useState(false);
  const [showExternalApi, setShowExternalApi] = useState(false);

  const [invisible, setInvisible] = useState(true);
  const [pageNumber, setPageNumber] = useState(1);
  const [searchParam] = useState("");
  const [chats, dispatch] = useReducer(reducer, []);
  
  const [managementHover, setManagementHover] = useState(false);
  const [campaignHover, setCampaignHover] = useState(false);
  const [vbzappyHover, setVbzappyHover] = useState(false);
  const [settingsHover, setSettingsHover] = useState(false);
  const [moreHover, setMoreHover] = useState(false);

  const { list } = useHelps();
  const [hasHelps, setHasHelps] = useState(false);

  const [openFlowSubmenu, setOpenFlowSubmenu] = useState(false);
  const [flowHover, setFlowHover] = useState(false);

  const { get: getSetting } = useCompanySettings();
  const [showWallets, setShowWallets] = useState(false);

  const isFlowbuilderRouteActive = location.pathname.startsWith("/phrase-lists") || location.pathname.startsWith("/flowbuilders");

  const handleVBZappyClick = () => {
    history.push("/tickets");
    setOpenVBZappySubmenu((prev) => !prev);
  };

  const handleSettingsClick = () => {
    history.push("/settings");
    setOpenSettingsSubmenu((prev) => !prev);
  };

  useEffect(() => {
    async function checkHelps() {
      try {
        const helps = await list();
        setHasHelps(helps.length > 0);
      } catch (err) {
      }
    }
    checkHelps();
  }, []);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const setting = await getSetting(
          {
            "column": "DirectTicketsToWallets"
          }
        );
        setShowWallets(setting.DirectTicketsToWallets);
      } catch (err) {
        toastError(err);
      }
    }
    fetchSettings();
  }, [setShowWallets]);

  const isManagementActive =
    location.pathname === "/" ||
    location.pathname.startsWith("/reports") ||
    location.pathname.startsWith("/moments");

  const isCampaignRouteActive =
    location.pathname === "/campaigns" ||
    location.pathname === "/campaign-meta-templates" ||
    location.pathname.startsWith("/contact-lists") ||
    location.pathname.startsWith("/campaigns-config");

  useEffect(() => {
    if (location.pathname.startsWith("/tickets")) {
      setActiveMenu("/tickets");
    } else {
      setActiveMenu("");
    }
  }, [location, setActiveMenu]);

  const { getPlanCompany } = usePlans();

  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
  }, [searchParam]);

  useEffect(() => {
    const batchUpdates = ReactDOM.unstable_batchedUpdates || ((fn) => fn());
    let cancelled = false;
    async function fetchData() {
      try {
        const companyId = user.companyId;
        if (!companyId) return;
        const planConfigs = await getPlanCompany(undefined, companyId);

        if (!planConfigs || !planConfigs.plan || cancelled) return;

        batchUpdates(() => {
          setShowCampaigns(planConfigs.plan.useCampaigns);
          setShowKanban(planConfigs.plan.useKanban);
          setShowOpenAi(planConfigs.plan.useOpenAi);
          setShowIntegrations(planConfigs.plan.useIntegrations);
          setShowSchedules(planConfigs.plan.useSchedules);
          setShowInternalChat(planConfigs.plan.useInternalChat);
          setShowExternalApi(planConfigs.plan.useExternalApi);
          setShowWavoipCall(planConfigs.plan.wavoip);
        });
      } catch (err) {
      }
    }
    fetchData();
    return () => { cancelled = true; };
  }, [user.companyId]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchChats();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchParam, pageNumber]);

  useEffect(() => {
    const socketCompanyId = resolveSocketCompanyId({ user });
    if (user.id && socketCompanyId != null && socket && typeof socket.on === 'function') {
      const onCompanyChatMainListItems = (data) => {
        if (data.action === "new-message") {
          dispatch({ type: "CHANGE_CHAT", payload: data });
        }
        if (data.action === "update") {
          dispatch({ type: "CHANGE_CHAT", payload: data });
        }
      };

      const eventName = `company-${socketCompanyId}-chat`;
      socket.on(eventName, onCompanyChatMainListItems);

      return () => {
        if (socket && typeof socket.off === 'function') {
          socket.off(eventName, onCompanyChatMainListItems);
        }
      };
    }
  }, [socket, user.id, user.companyId]);

  useEffect(() => {
    let unreadsCount = 0;
    if (chats.length > 0) {
      for (let chat of chats) {
        for (let chatUser of chat.users) {
          if (chatUser.userId === user.id) {
            unreadsCount += chatUser.unreads;
          }
        }
      }
    }
    if (unreadsCount > 0) {
      setInvisible(false);
    } else {
      setInvisible(true);
    }
  }, [chats, user.id]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (Array.isArray(whatsApps) && whatsApps.length > 0) {
        const offlineWhats = whatsApps.filter((whats) => {
          return (
            whats.status === "qrcode" ||
            whats.status === "PAIRING" ||
            whats.status === "DISCONNECTED" ||
            whats.status === "TIMEOUT" ||
            whats.status === "OPENING"
          );
        });
        if (offlineWhats.length > 0) {
          setConnectionWarning(true);
        } else {
          setConnectionWarning(false);
        }
      }
    }, 2000);
    return () => clearTimeout(delayDebounceFn);
  }, [whatsApps]);

  const fetchChats = async () => {
    try {
      const { data } = await api.get("/chats/", {
        params: { searchParam, pageNumber },
      });
      dispatch({ type: "LOAD_CHATS", payload: data.records });
    } catch (err) {
      toastError(err);
    }
  };

  const MenuGroup = ({ id, title, children }) => (
    <>
      {!collapsed && (
        <ListItem
          button
          onClick={() => toggleMenuGroup(id)}
          className={`${classes.listItem} ${classes.menuGroupHeader}`}
        >
          <ListItemText
            primary={title}
            primaryTypographyProps={{ className: classes.listItemText, noWrap: true }}
            className={classes.listItemTextRoot}
          />
          {menuGroup[id] ? (
            <ExpandLessIcon className={classes.expandIcon} />
          ) : (
            <ExpandMoreIcon className={classes.expandIcon} />
          )}
        </ListItem>
      )}
      <Collapse in={collapsed || menuGroup[id]} timeout="auto" unmountOnExit>
        {children}
      </Collapse>
    </>
  );

  return (
    <div onClick={drawerClose} className={classes.sidebarList}>
      {section === "main" && (
        <>
          <ListItemLink
            to="/"
            primary={i18n.t("mainDrawer.listItems.start")}
            icon={<AppIcon icon={Home} />}
            tooltip={collapsed}
            collapsed={collapsed}
          />

          <MenuGroup id="atendimento" title={translateUi("Atendimento")}>
            <ListItemLink to="/tickets" primary={translateUi("Tickets")} icon={<AppIcon icon={MessageSquare} size={SIDEBAR_ICON_SIZE} />} tooltip={collapsed} collapsed={collapsed} />
            <ListItemLink to="/Kanban" primary={translateUi("Kanban")} icon={<AppIcon icon={LayoutDashboard} size={SIDEBAR_ICON_SIZE} />} tooltip={collapsed} collapsed={collapsed} />
            <ListItemLink to="/queues" primary={translateUi("Filas & Chatbot")} icon={<AppIcon icon={GitBranch} size={SIDEBAR_ICON_SIZE} />} tooltip={collapsed} collapsed={collapsed} />
            <ListItemLink to="/quick-messages" primary={translateUi("Respostas rápidas")} icon={<AppIcon icon={Zap} size={SIDEBAR_ICON_SIZE} />} tooltip={collapsed} collapsed={collapsed} />
            <ListItemLink to="/campaigns" primary={translateUi("Campanhas")} icon={<AppIcon icon={Megaphone} size={SIDEBAR_ICON_SIZE} />} tooltip={collapsed} collapsed={collapsed} />
            <ListItemLink to="/email" primary={translateUi("Email")} icon={<AppIcon icon={Mail} size={SIDEBAR_ICON_SIZE} />} tooltip={collapsed} collapsed={collapsed} />
            <ListItemLink to="/schedules" primary={translateUi("Calendário")} icon={<AppIcon icon={Calendar} size={SIDEBAR_ICON_SIZE} />} tooltip={collapsed} collapsed={collapsed} />
            <ListItemLink to="/tags" primary={translateUi("Etiquetas")} icon={<AppIcon icon={CheckSquare} size={SIDEBAR_ICON_SIZE} />} tooltip={collapsed} collapsed={collapsed} />
            {user.showContacts === "enabled" && (
              <ListItemLink to="/contacts" primary={i18n.t("mainDrawer.listItems.contacts")} icon={<AppIcon icon={Contact} size={SIDEBAR_ICON_SIZE} />} tooltip={collapsed} collapsed={collapsed} />
            )}
            <ListItemLink to="/whatsapp-dashboard" primary={translateUi("Dashboard WhatsApp")} icon={<AppIcon icon={LayoutDashboard} size={SIDEBAR_ICON_SIZE} />} tooltip={collapsed} collapsed={collapsed} />
          </MenuGroup>

          <MenuGroup id="ia" title={translateUi("IA e automações")}>
            <ListItemLink to="/prompts" primary={translateUi("Agente IA / Prompts")} icon={<AppIcon icon={Bot} size={SIDEBAR_ICON_SIZE} />} tooltip={collapsed} collapsed={collapsed} />
            <ListItemLink to="/brain-ai" primary={translateUi("Brain.AI")} icon={<AppIcon icon={Bot} size={SIDEBAR_ICON_SIZE} />} tooltip={collapsed} collapsed={collapsed} />
            <ListItemLink to="/configurar-ia" primary={translateUi("Configuração da IA")} icon={<AppIcon icon={Bot} size={SIDEBAR_ICON_SIZE} />} tooltip={collapsed} collapsed={collapsed} />
            <ListItemLink to="/flowbuilders" primary={translateUi("Flow builder")} icon={<AppIcon icon={Workflow} size={SIDEBAR_ICON_SIZE} />} tooltip={collapsed} collapsed={collapsed} />
            <ListItemLink to="/automacoes" primary={translateUi("Automações")} icon={<AppIcon icon={Zap} size={SIDEBAR_ICON_SIZE} />} tooltip={collapsed} collapsed={collapsed} />
            <ListItemLink to="/automacoes-followup" primary={translateUi("Automações follow-up")} icon={<AppIcon icon={Workflow} size={SIDEBAR_ICON_SIZE} />} tooltip={collapsed} collapsed={collapsed} />
          </MenuGroup>

          <MenuGroup id="vendas" title={translateUi("Vendas")}>
            <ListItemLink to="/leads-sales" primary={translateUi("Leads e Vendas")} icon={<AppIcon icon={CircleDollarSign} size={SIDEBAR_ICON_SIZE} />} tooltip={collapsed} collapsed={collapsed} />
            <ListItemLink to="/pipeline" primary={translateUi("Pipeline")} icon={<AppIcon icon={LayoutDashboard} size={SIDEBAR_ICON_SIZE} />} tooltip={collapsed} collapsed={collapsed} />
            <ListItemLink to="/propostas" primary={translateUi("Propostas")} icon={<AppIcon icon={CircleDollarSign} size={SIDEBAR_ICON_SIZE} />} tooltip={collapsed} collapsed={collapsed} />
            <ListItemLink to="/followups" primary={translateUi("Follow-up")} icon={<AppIcon icon={Calendar} size={SIDEBAR_ICON_SIZE} />} tooltip={collapsed} collapsed={collapsed} />
            <ListItemLink to="/jornada" primary={translateUi("Jornada")} icon={<AppIcon icon={Workflow} size={SIDEBAR_ICON_SIZE} />} tooltip={collapsed} collapsed={collapsed} />
            <ListItemLink to="/fila-distribuicao" primary={translateUi("Fila de distribuição")} icon={<AppIcon icon={LayoutDashboard} size={SIDEBAR_ICON_SIZE} />} tooltip={collapsed} collapsed={collapsed} />
            <ListItemLink to="/nutricao" primary={translateUi("Nutrição")} icon={<AppIcon icon={Megaphone} size={SIDEBAR_ICON_SIZE} />} tooltip={collapsed} collapsed={collapsed} />
            <ListItemLink to="/prospeccao" primary={translateUi("Prospecção diária")} icon={<AppIcon icon={CheckSquare} size={SIDEBAR_ICON_SIZE} />} tooltip={collapsed} collapsed={collapsed} />
            <ListItemLink to="/activities" primary={translateUi("Atividades")} icon={<AppIcon icon={CheckSquare} size={SIDEBAR_ICON_SIZE} />} tooltip={collapsed} collapsed={collapsed} />
            <ListItemLink to="/leads-landing" primary={translateUi("Leads de landing")} icon={<AppIcon icon={Megaphone} size={SIDEBAR_ICON_SIZE} />} tooltip={collapsed} collapsed={collapsed} />
          </MenuGroup>

          <MenuGroup id="imoveis" title={translateUi("Imobiliário")}>
            <ListItemLink to="/dashboard" primary={translateUi("Dashboard imobiliário")} icon={<AppIcon icon={LayoutDashboard} size={SIDEBAR_ICON_SIZE} />} tooltip={collapsed} collapsed={collapsed} />
            <ListItemLink to="/imoveis" primary={translateUi("Imóveis")} icon={<AppIcon icon={Building2} size={SIDEBAR_ICON_SIZE} />} tooltip={collapsed} collapsed={collapsed} />
            <ListItemLink to="/comparativo" primary={translateUi("Comparativo")} icon={<AppIcon icon={GitBranch} size={SIDEBAR_ICON_SIZE} />} tooltip={collapsed} collapsed={collapsed} />
            <ListItemLink to="/avaliacao" primary={translateUi("Avaliação")} icon={<AppIcon icon={CircleDollarSign} size={SIDEBAR_ICON_SIZE} />} tooltip={collapsed} collapsed={collapsed} />
            <ListItemLink to="/proprietarios" primary={translateUi("Proprietários")} icon={<AppIcon icon={Contact} size={SIDEBAR_ICON_SIZE} />} tooltip={collapsed} collapsed={collapsed} />
            <ListItemLink to="/contratos" primary={translateUi("Contratos")} icon={<AppIcon icon={GitBranch} size={SIDEBAR_ICON_SIZE} />} tooltip={collapsed} collapsed={collapsed} />
            <ListItemLink to="/captacao" primary={translateUi("Captação")} icon={<AppIcon icon={Package} size={SIDEBAR_ICON_SIZE} />} tooltip={collapsed} collapsed={collapsed} />
            <ListItemLink to="/pipeline-captacao" primary={translateUi("Pipeline captação")} icon={<AppIcon icon={GitBranch} size={SIDEBAR_ICON_SIZE} />} tooltip={collapsed} collapsed={collapsed} />
            <ListItemLink to="/agenda" primary={translateUi("Agenda imobiliária")} icon={<AppIcon icon={Calendar} size={SIDEBAR_ICON_SIZE} />} tooltip={collapsed} collapsed={collapsed} />
            <ListItemLink to="/corretores" primary={translateUi("Corretores")} icon={<AppIcon icon={Contact} size={SIDEBAR_ICON_SIZE} />} tooltip={collapsed} collapsed={collapsed} />
            <ListItemLink to="/condominios" primary={translateUi("Condomínios")} icon={<AppIcon icon={Building2} size={SIDEBAR_ICON_SIZE} />} tooltip={collapsed} collapsed={collapsed} />
            <ListItemLink to="/relacionamento" primary={translateUi("Relacionamento")} icon={<AppIcon icon={Contact} size={SIDEBAR_ICON_SIZE} />} tooltip={collapsed} collapsed={collapsed} />
            <ListItemLink to="/inadimplencia" primary={translateUi("Inadimplência")} icon={<AppIcon icon={CircleDollarSign} size={SIDEBAR_ICON_SIZE} />} tooltip={collapsed} collapsed={collapsed} />
            <ListItemLink to="/consulta-cpf" primary={translateUi("Consulta CPF")} icon={<AppIcon icon={Contact} size={SIDEBAR_ICON_SIZE} />} tooltip={collapsed} collapsed={collapsed} />
          </MenuGroup>

          <MenuGroup id="radar" title={translateUi("Radar e portais")}>
            <ListItemLink to="/radarzap" primary={translateUi("RadarZAP")} icon={<AppIcon icon={Zap} size={SIDEBAR_ICON_SIZE} />} tooltip={collapsed} collapsed={collapsed} />
            <ListItemLink to="/radarzap-grupos" primary={translateUi("RadarZAP grupos")} icon={<AppIcon icon={Zap} size={SIDEBAR_ICON_SIZE} />} tooltip={collapsed} collapsed={collapsed} />
            <ListItemLink to="/radarzap/onboarding" primary={translateUi("RadarZAP onboarding")} icon={<AppIcon icon={Zap} size={SIDEBAR_ICON_SIZE} />} tooltip={collapsed} collapsed={collapsed} />
            <ListItemLink to="/radarzap/scoring" primary={translateUi("RadarZAP scoring")} icon={<AppIcon icon={Zap} size={SIDEBAR_ICON_SIZE} />} tooltip={collapsed} collapsed={collapsed} />
            <ListItemLink to="/radarzap/status" primary={translateUi("RadarZAP status")} icon={<AppIcon icon={Zap} size={SIDEBAR_ICON_SIZE} />} tooltip={collapsed} collapsed={collapsed} />
            <ListItemLink to="/portais" primary={translateUi("Portais")} icon={<AppIcon icon={Plug} size={SIDEBAR_ICON_SIZE} />} tooltip={collapsed} collapsed={collapsed} />
            <ListItemLink to="/qcapture" primary={translateUi("Q-Capture")} icon={<AppIcon icon={LayoutDashboard} size={SIDEBAR_ICON_SIZE} />} tooltip={collapsed} collapsed={collapsed} />
            <ListItemLink to="/monitoramento" primary={translateUi("Monitoramento")} icon={<AppIcon icon={Plug} size={SIDEBAR_ICON_SIZE} />} tooltip={collapsed} collapsed={collapsed} />
            <ListItemLink to="/whatsapp" primary={translateUi("WhatsApp imobiliário")} icon={<AppIcon icon={MessageSquare} size={SIDEBAR_ICON_SIZE} />} tooltip={collapsed} collapsed={collapsed} />
          </MenuGroup>

          <MenuGroup id="conteudo" title={translateUi("Conteúdo e marketing")}>
            <ListItemLink to="/conteudo-seo" primary={translateUi("Conteúdo SEO")} icon={<AppIcon icon={Megaphone} size={SIDEBAR_ICON_SIZE} />} tooltip={collapsed} collapsed={collapsed} />
            <ListItemLink to="/seo-auditoria" primary={translateUi("Auditoria SEO")} icon={<AppIcon icon={Megaphone} size={SIDEBAR_ICON_SIZE} />} tooltip={collapsed} collapsed={collapsed} />
            <ListItemLink to="/feed" primary={translateUi("Feed")} icon={<AppIcon icon={Megaphone} size={SIDEBAR_ICON_SIZE} />} tooltip={collapsed} collapsed={collapsed} />
            <ListItemLink to="/curadoria" primary={translateUi("Curadoria viral")} icon={<AppIcon icon={Zap} size={SIDEBAR_ICON_SIZE} />} tooltip={collapsed} collapsed={collapsed} />
            <ListItemLink to="/blog" primary={translateUi("Blog")} icon={<AppIcon icon={Megaphone} size={SIDEBAR_ICON_SIZE} />} tooltip={collapsed} collapsed={collapsed} />
            <ListItemLink to="/portal" primary={translateUi("Portal de imóveis")} icon={<AppIcon icon={Building2} size={SIDEBAR_ICON_SIZE} />} tooltip={collapsed} collapsed={collapsed} />
            <ListItemLink to="/captacao-avaliacao" primary={translateUi("LP Captação")} icon={<AppIcon icon={Megaphone} size={SIDEBAR_ICON_SIZE} />} tooltip={collapsed} collapsed={collapsed} />
            <ListItemLink to="/venda-crm" primary={translateUi("LP Venda CRM")} icon={<AppIcon icon={Megaphone} size={SIDEBAR_ICON_SIZE} />} tooltip={collapsed} collapsed={collapsed} />
          </MenuGroup>

          <MenuGroup id="gestao" title={translateUi("Gestão")}>
            <ListItemLink to="/financeiro" primary={translateUi("Financeiro")} icon={<AppIcon icon={CircleDollarSign} size={SIDEBAR_ICON_SIZE} />} tooltip={collapsed} collapsed={collapsed} />
            <ListItemLink to="/reports" primary={translateUi("Relatórios")} icon={<AppIcon icon={LayoutDashboard} size={SIDEBAR_ICON_SIZE} />} tooltip={collapsed} collapsed={collapsed} />
            <ListItemLink to="/relatorios-agendados" primary={translateUi("Relatórios agendados")} icon={<AppIcon icon={Calendar} size={SIDEBAR_ICON_SIZE} />} tooltip={collapsed} collapsed={collapsed} />
            <ListItemLink to="/produtividade" primary={translateUi("Produtividade")} icon={<AppIcon icon={LayoutDashboard} size={SIDEBAR_ICON_SIZE} />} tooltip={collapsed} collapsed={collapsed} />
            <ListItemLink to="/inteligencia" primary={translateUi("Inteligência")} icon={<AppIcon icon={Bot} size={SIDEBAR_ICON_SIZE} />} tooltip={collapsed} collapsed={collapsed} />
            <ListItemLink to="/auditoria-leads" primary={translateUi("Auditoria leads")} icon={<AppIcon icon={HelpCircle} size={SIDEBAR_ICON_SIZE} />} tooltip={collapsed} collapsed={collapsed} />
            <ListItemLink to="/auditoria-extracao" primary={translateUi("Auditoria extração")} icon={<AppIcon icon={HelpCircle} size={SIDEBAR_ICON_SIZE} />} tooltip={collapsed} collapsed={collapsed} />
            <ListItemLink to="/metricas-extracao" primary={translateUi("Métricas extração")} icon={<AppIcon icon={LayoutDashboard} size={SIDEBAR_ICON_SIZE} />} tooltip={collapsed} collapsed={collapsed} />
          </MenuGroup>

          <MenuGroup id="sistema" title={translateUi("Sistema")}>
            <ListItemLink to="/connections" primary={translateUi("Integrações")} icon={<AppIcon icon={Plug} size={SIDEBAR_ICON_SIZE} />} tooltip={collapsed} collapsed={collapsed} />
            <ListItemLink to="/integrations" primary={translateUi("Integrações de filas")} icon={<AppIcon icon={Plug} size={SIDEBAR_ICON_SIZE} />} tooltip={collapsed} collapsed={collapsed} />
            <ListItemLink to="/users" primary={translateUi("Usuários")} icon={<AppIcon icon={Contact} size={SIDEBAR_ICON_SIZE} />} tooltip={collapsed} collapsed={collapsed} />
            <ListItemLink to="/settings" primary={translateUi("Configurações")} icon={<AppIcon icon={Settings} size={SIDEBAR_ICON_SIZE} />} tooltip={collapsed} collapsed={collapsed} />
            <ListItemLink to="/seguranca" primary={translateUi("Segurança")} icon={<AppIcon icon={Settings} size={SIDEBAR_ICON_SIZE} />} tooltip={collapsed} collapsed={collapsed} />
            <ListItemLink to="/lgpd-solicitacoes" primary={translateUi("LGPD")} icon={<AppIcon icon={Settings} size={SIDEBAR_ICON_SIZE} />} tooltip={collapsed} collapsed={collapsed} />
          </MenuGroup>

          <ListItem
            button
            onClick={() => setOpenMoreSubmenu((prev) => !prev)}
            onMouseEnter={() => setMoreHover(true)}
            onMouseLeave={() => setMoreHover(false)}
            className={`${classes.listItem} ${classes.moreItem} ${classes.listItemExpandable}`}
          >
            <ListItemIcon className={classes.listItemIcon}>
              <span className={classes.iconSlot}>
                <AppIcon
                  icon={MoreHorizontal}
                  size={collapsed ? SIDEBAR_ICON_SIZE_COLLAPSED : SIDEBAR_ICON_SIZE}
                  color="currentColor"
                />
              </span>
            </ListItemIcon>
            {!collapsed && (
              <ListItemText
                primary={translateUi("Mais")}
                primaryTypographyProps={{
                  className: classes.listItemText,
                  noWrap: true,
                }}
                className={classes.listItemTextRoot}
              />
            )}
            {!collapsed && (
              <span className={classes.listItemTrailing}>
                {openMoreSubmenu ? (
                  <ExpandLessIcon className={classes.expandIcon} />
                ) : (
                  <ExpandMoreIcon className={classes.expandIcon} />
                )}
              </span>
            )}
          </ListItem>
          <Collapse in={openMoreSubmenu} timeout="auto" unmountOnExit className={`${classes.submenuContainer} ${classes.moreCollapse}`}>
            <ListItemLink to="/leads-convertidos" primary={translateUi("Empresas")} icon={<AppIcon icon={Building2} size={SIDEBAR_ICON_SIZE} />} tooltip={collapsed} collapsed={collapsed} submenu />
            <ListItemLink
              to="/inventory"
              primary={translateUi("Inventário")}
              icon={<AppIcon icon={Package} size={SIDEBAR_ICON_SIZE} />}
              tooltip={collapsed}
              collapsed={collapsed}
              submenu
            />
            <ListItemLink
              to="/platform-api"
              primary={translateUi("API & MCP")}
              icon={<AppIcon icon={Webhook} size={SIDEBAR_ICON_SIZE} />}
              tooltip={collapsed}
              collapsed={collapsed}
              submenu
            />

          </Collapse>

          {hasHelps && (
            <ListItemLink
              to="/helps"
              primary={i18n.t("mainDrawer.listItems.helps")}
              icon={<AppIcon icon={HelpCircle} size={SIDEBAR_ICON_SIZE} />}
              tooltip={collapsed}
            />
          )}
          
        </>
      )}

      {section === "bottom" && (
        <>
           <Tooltip title={collapsed ? translateUi("Atendimento") : ""} placement="right">
            <ListItem
                button
                onClick={handleVBZappyClick}
                onMouseEnter={() => setVbzappyHover(true)}
                onMouseLeave={() => setVbzappyHover(false)}
                className={`${classes.listItem} ${classes.listItemExpandable} ${!collapsed ? classes.listItemBottomPrimary : ""}`}
            >
                <ListItemIcon className={classes.listItemIcon}>
                    <span className={classes.iconSlot}>
                        <AppIcon
                          icon={MessageSquare}
                          size={
                            collapsed
                              ? SIDEBAR_ICON_SIZE_COLLAPSED
                              : SIDEBAR_BOTTOM_ICON_SIZE
                          }
                          color="currentColor"
                        />
                    </span>
                </ListItemIcon>
                {!collapsed && (
                  <ListItemText
                    primary={translateUi("Atendimento")}
                    primaryTypographyProps={{
                      className: classes.listItemText,
                      noWrap: true,
                    }}
                    className={classes.listItemTextRoot}
                  />
                )}
                {!collapsed && (
                  <span className={classes.listItemTrailing}>
                    {openVBZappySubmenu ? (
                      <ExpandLessIcon className={classes.expandIcon} />
                    ) : (
                      <ExpandMoreIcon className={classes.expandIcon} />
                    )}
                  </span>
                )}
            </ListItem>
           </Tooltip>
          <Collapse in={openVBZappySubmenu} timeout="auto" unmountOnExit className={classes.submenuContainer}>
                <ListItemLink to="/queues" primary={translateUi("Filas & Chatbot")} icon={<AppIcon icon={GitBranch} size={SIDEBAR_ICON_SIZE} />} tooltip={collapsed} collapsed={collapsed} submenu />
                {showCampaigns && <ListItemLink to="/campaigns" primary={translateUi("Campanhas")} icon={<AppIcon icon={Megaphone} size={SIDEBAR_ICON_SIZE} />} tooltip={collapsed} collapsed={collapsed} submenu />}
                <ListItemLink to="/quick-messages" primary={translateUi("Respostas Rápidas")} icon={<AppIcon icon={Zap} size={SIDEBAR_ICON_SIZE} />} tooltip={collapsed} collapsed={collapsed} submenu />
                <ListItemLink to="/whatsapp-dashboard" primary={translateUi("Dashboard")} icon={<AppIcon icon={LayoutDashboard} size={SIDEBAR_ICON_SIZE} />} tooltip={collapsed} collapsed={collapsed} submenu />
           </Collapse>

           {/* Email abaixo de WhatsApp no mesmo espaço */}
           <ListItemLink
              to="/email"
              primary={translateUi("Email")}
              icon={<AppIcon icon={Mail} />}
              tooltip={collapsed}
              bottom
              isBottomPrimary
              collapsed={collapsed}
           />

           {(showOpenAi || user.profile !== "user") && (
             <ListItemLink
                to="/prompts"
                primary={translateUi("Agente IA")}
                icon={<AppIcon icon={Bot} />}
                tooltip={collapsed}
                bottom
                isBottomPrimary
                collapsed={collapsed}
             />
           )}

            <ListItemLink
                to="/connections"
                primary={translateUi("Integrações")}
                icon={<AppIcon icon={Plug} />}
                tooltip={collapsed}
                bottom
                isBottomPrimary
                collapsed={collapsed}
            />

           {user.showFlow === "enabled" && (
             <Tooltip
                title={collapsed ? translateUi("Automações") : ""}
                placement="right"
             >
                <ListItemLink
                    to="/flowbuilders"
                    primary={translateUi("Automações")}
                    icon={<AppIcon icon={Workflow} size={SIDEBAR_ICON_SIZE} />}
                    tooltip={collapsed}
                    bottom
                    isBottomPrimary
                    collapsed={collapsed}
                />
             </Tooltip>
           )}

            <ListItemLink
                to="/settings"
                primary={translateUi("Configurações")}
                icon={<AppIcon icon={Settings} />}
                tooltip={collapsed}
                bottom
                isBottomPrimary
                collapsed={collapsed}
            />
        </>
      )}
    </div>
  );
};

export default MainListItems;
