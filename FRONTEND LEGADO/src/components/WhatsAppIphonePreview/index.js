import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import { Typography } from "@material-ui/core";
import PhoneIcon from "@material-ui/icons/Phone";
import { IconButton } from "@material-ui/core";

const useStyles = makeStyles(() => ({
  wrap: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 10,
    width: "100%"
  },
  label: {
    fontSize: 12,
    fontWeight: 650,
    letterSpacing: "-0.01em",
    opacity: 0.7,
    textAlign: "center"
  },
  iphoneFrame: {
    width: "100%",
    maxWidth: 268,
    position: "relative",
    borderRadius: 36,
    padding: 4,
    background: "linear-gradient(145deg, #2c2c2e 0%, #1c1c1e 100%)",
    boxShadow:
      "0 25px 50px -12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)",
    border: "2px solid #3a3a3c"
  },
  iphoneNotch: {
    position: "absolute",
    top: 4,
    left: "50%",
    transform: "translateX(-50%)",
    width: 90,
    height: 20,
    borderRadius: 16,
    backgroundColor: "#000",
    zIndex: 2
  },
  iphoneScreen: {
    width: "100%",
    height: 460,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "#e5ddd5",
    display: "flex",
    flexDirection: "column"
  },
  iphoneStatusBar: {
    height: 18,
    padding: "2px 10px 0",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#075e54",
    color: "#fff",
    fontSize: 10,
    opacity: 0.9
  },
  header: {
    background: "#075e54",
    color: "#fff",
    padding: "8px 10px",
    display: "flex",
    alignItems: "center",
    gap: 8,
    borderBottom: "1px solid rgba(0,0,0,0.2)"
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flex: 1,
    minWidth: 0
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: "50%",
    backgroundColor: "#128c7e",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 13,
    fontWeight: 700,
    overflow: "hidden",
    flexShrink: 0
  },
  avatarImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block"
  },
  headerTitle: { fontSize: 14, fontWeight: 600, lineHeight: 1.1 },
  headerSub: { fontSize: 11, opacity: 0.9 },
  phoneBtn: {
    color: "#fff",
    padding: 6,
    "& .MuiSvgIcon-root": { fontSize: 20 }
  },
  chat: {
    flex: 1,
    overflowY: "auto",
    padding: "8px 10px 16px",
    backgroundColor: "#e5ddd5",
    backgroundImage:
      'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M30 0L30 60M0 30L60 30\' stroke=\'%23d4cdc4\' stroke-width=\'0.5\' fill=\'none\'/%3E%3C/svg%3E")'
  },
  dateTag: {
    display: "block",
    textAlign: "center",
    marginBottom: 8,
    "& span": {
      display: "inline-block",
      padding: "4px 12px",
      borderRadius: 8,
      backgroundColor: "rgba(0,0,0,0.12)",
      color: "rgba(0,0,0,0.7)",
      fontSize: 12,
      fontWeight: 500
    }
  },
  bubble: {
    maxWidth: "88%",
    marginLeft: "auto",
    marginBottom: 6,
    padding: "7px 10px 4px",
    borderRadius: 12,
    borderTopRightRadius: 4,
    backgroundColor: "#dcf8c6",
    boxShadow: "0 1px 0.5px rgba(0,0,0,0.13)",
    fontSize: 13,
    lineHeight: 1.4,
    wordBreak: "break-word",
    whiteSpace: "pre-wrap",
    textAlign: "left",
    color: "#111"
  },
  time: {
    fontSize: 10,
    color: "rgba(0,0,0,0.45)",
    marginTop: 2,
    display: "flex",
    justifyContent: "flex-end",
    gap: 4
  },
  mediaChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
    padding: "4px 8px",
    borderRadius: 8,
    background: "rgba(0,0,0,0.06)",
    fontSize: 11,
    color: "rgba(0,0,0,0.65)"
  },
  footer: {
    padding: "6px 8px",
    backgroundColor: "#f0f0f0",
    borderTop: "1px solid rgba(0,0,0,0.1)",
    display: "flex",
    alignItems: "center",
    gap: 8
  },
  footerInput: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: "7px 12px",
    fontSize: 12,
    border: "1px solid rgba(0,0,0,0.08)",
    color: "#999"
  },
  empty: {
    textAlign: "center",
    padding: 28,
    fontSize: 12.5,
    color: "rgba(0,0,0,0.45)",
    lineHeight: 1.4
  }
}));

function nowHHMM() {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date());
  } catch {
    return "09:41";
  }
}

/**
 * Preview estilo campanhas: iPhone + bolha WhatsApp.
 */
export default function WhatsAppIphonePreview({
  message = "",
  contactName = "Cliente",
  agentName = "Agente",
  avatarUrl = "",
  showImages = false,
  showDocument = false,
  label = "Preview WhatsApp"
}) {
  const classes = useStyles();
  const text = String(message || "").trim();
  const time = nowHHMM();

  return (
    <div className={classes.wrap}>
      <Typography className={classes.label}>{label}</Typography>
      <div className={classes.iphoneFrame}>
        <div className={classes.iphoneNotch} />
        <div className={classes.iphoneScreen}>
          <div className={classes.iphoneStatusBar}>
            <span>{time}</span>
            <span>WhatsApp</span>
            <span>100%</span>
          </div>
          <div className={classes.header}>
            <div className={classes.headerLeft}>
              <div className={classes.avatar}>
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className={classes.avatarImg} />
                ) : (
                  (agentName || "A").charAt(0).toUpperCase()
                )}
              </div>
              <div>
                <div className={classes.headerTitle}>{agentName || "Agente"}</div>
                <div className={classes.headerSub}>online</div>
              </div>
            </div>
            <IconButton className={classes.phoneBtn} size="small" disableRipple>
              <PhoneIcon />
            </IconButton>
          </div>
          <div className={classes.chat}>
            <div className={classes.dateTag}>
              <span>Hoje</span>
            </div>
            {!text && !showImages && !showDocument ? (
              <div className={classes.empty}>
                A mensagem aparece aqui conforme você edita o template.
              </div>
            ) : (
              <div className={classes.bubble}>
                {text || (showImages || showDocument ? " " : "")}
                {showImages ? <div className={classes.mediaChip}>🖼 Imagem do produto</div> : null}
                {showDocument ? <div className={classes.mediaChip}>📄 Documento</div> : null}
                <div className={classes.time}>
                  <span>{time}</span>
                  <span>✓</span>
                </div>
              </div>
            )}
          </div>
          <div className={classes.footer}>
            <div className={classes.footerInput}>Mensagem para {contactName}…</div>
          </div>
        </div>
      </div>
    </div>
  );
}
