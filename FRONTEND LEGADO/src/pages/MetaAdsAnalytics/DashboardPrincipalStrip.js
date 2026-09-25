import React, { useContext, useState } from "react";
import { IconButton, Menu, MenuItem, Popover, Tooltip, makeStyles } from "@material-ui/core";
import VisibilityOutlinedIcon from "@material-ui/icons/VisibilityOutlined";
import VisibilityOffOutlinedIcon from "@material-ui/icons/VisibilityOffOutlined";
import { AuthContext } from "../../context/Auth/AuthContext";
import { applyAppLanguage, getCurrentLanguage } from "../../translate/i18n";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import MetaAdsBrandIcon from "../../components/MetaAdsBrandIcon";
import PageHelpButton from "../../components/PageHelpButton";
import MetaAdsExportMenu from "./ExportMenu";
import { UTMIFY_FONT } from "./utmifyTheme";
import { money, numFmt } from "./formatters";
import BRFlag from "../../assets/brazil.png";
import USFlag from "../../assets/unitedstates.png";
import ESFlag from "../../assets/esspain.png";
import ARFlag from "../../assets/arabe.png";

const LANGS = [
  { code: "pt-BR", label: "PT-BR", icon: BRFlag },
  { code: "en", label: "EN", icon: USFlag },
  { code: "es", label: "ES", icon: ESFlag },
  { code: "ar", label: "AR", icon: ARFlag },
];

const useStyles = makeStyles((theme) => {
  const isDark = theme.palette.type === "dark";
  return {
    strip: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      flexWrap: "wrap",
      minHeight: 64,
      padding: "10px 4px 14px",
      marginBottom: 4,
      fontFamily: UTMIFY_FONT,
      borderBottom: isDark
        ? "1px solid rgba(255,255,255,0.06)"
        : "1px solid rgba(15,23,42,0.06)",
    },
    left: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      minWidth: 0,
      flex: "1 1 240px",
    },
    title: {
      margin: 0,
      fontFamily: UTMIFY_FONT,
      fontSize: 20,
      fontWeight: 650,
      letterSpacing: "-0.03em",
      lineHeight: 1.15,
      color: isDark ? "#ffffff" : "#0f172a",
      textWrap: "balance",
    },
    iconBtn: {
      width: 32,
      height: 32,
      padding: 4,
      color: isDark ? "rgba(248,250,252,0.72)" : "#64748b",
    },
    mid: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      marginLeft: "auto",
    },
    lang: {
      appearance: "none",
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      height: 32,
      padding: "0 10px",
      borderRadius: 8,
      border: isDark
        ? "1px solid rgba(255,255,255,0.12)"
        : "1px solid rgba(15,23,42,0.1)",
      background: "transparent",
      color: isDark ? "#f8fafc" : "#0f172a",
      fontFamily: UTMIFY_FONT,
      fontSize: 12,
      fontWeight: 650,
      letterSpacing: "0.04em",
      cursor: "pointer",
    },
    flag: {
      width: 16,
      height: 12,
      borderRadius: 2,
      objectFit: "cover",
    },
    profile: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      minWidth: 0,
      paddingLeft: 4,
    },
    profileText: {
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-end",
      minWidth: 0,
      textAlign: "right",
    },
    accountName: {
      fontSize: 12,
      fontWeight: 650,
      letterSpacing: "0.04em",
      textTransform: "uppercase",
      color: isDark ? "#f8fafc" : "#0f172a",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      maxWidth: 220,
    },
    appName: {
      fontSize: 11,
      fontWeight: 500,
      color: isDark ? "rgba(248,250,252,0.5)" : "#94a3b8",
      whiteSpace: "nowrap",
    },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: "50%",
      background: "#005eff",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
      boxShadow: "0 0 0 2px rgba(0,94,255,0.25)",
    },
    profileBtn: {
      appearance: "none",
      border: 0,
      background: "transparent",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      gap: 10,
      minWidth: 0,
      padding: "4px 2px 4px 10px",
      borderRadius: 12,
      textAlign: "inherit",
      font: "inherit",
      color: "inherit",
      transition: "background 160ms ease",
      "&:hover": {
        background: isDark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.05)",
      },
    },
    intelPaper: {
      width: 320,
      maxWidth: "calc(100vw - 24px)",
      borderRadius: 16,
      overflow: "hidden",
      fontFamily: UTMIFY_FONT,
      background: isDark ? "rgba(28,28,30,0.94)" : "rgba(255,255,255,0.94)",
      backdropFilter: "saturate(180%) blur(22px)",
      WebkitBackdropFilter: "saturate(180%) blur(22px)",
      boxShadow: isDark
        ? "0 18px 48px rgba(0,0,0,0.5), 0 0 0 0.5px rgba(255,255,255,0.12)"
        : "0 18px 48px rgba(15,23,42,0.16), 0 0 0 0.5px rgba(0,0,0,0.06)",
    },
    intelInner: {
      padding: 14,
      display: "flex",
      flexDirection: "column",
      gap: 10,
    },
    intelKicker: {
      fontSize: 11,
      fontWeight: 650,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      color: isDark ? "rgba(248,250,252,0.45)" : "#86868b",
    },
    intelName: {
      fontSize: 15,
      fontWeight: 650,
      letterSpacing: "-0.03em",
      color: isDark ? "#f5f5f7" : "#1d1d1f",
      lineHeight: 1.25,
    },
    intelMeta: {
      fontSize: 12,
      color: isDark ? "rgba(245,245,247,0.55)" : "#6e6e73",
      marginTop: 2,
    },
    intelGrid: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 8,
    },
    intelCell: {
      borderRadius: 12,
      padding: "10px 10px 9px",
      border: isDark
        ? "1px solid rgba(255,255,255,0.08)"
        : "1px solid rgba(0,0,0,0.06)",
      background: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.7)",
    },
    intelLabel: {
      display: "block",
      fontSize: 10,
      fontWeight: 650,
      letterSpacing: "0.06em",
      textTransform: "uppercase",
      color: isDark ? "rgba(248,250,252,0.42)" : "#86868b",
      marginBottom: 4,
    },
    intelValue: {
      fontSize: 16,
      fontWeight: 700,
      letterSpacing: "-0.03em",
      color: isDark ? "#f8fafc" : "#0f172a",
      fontVariantNumeric: "tabular-nums",
    },
    intelHint: {
      fontSize: 11,
      color: isDark ? "rgba(245,245,247,0.5)" : "#6e6e73",
      marginTop: 2,
    },
    pixelRow: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      fontSize: 12,
      padding: "4px 0",
    },
    pixelName: {
      minWidth: 0,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      color: isDark ? "rgba(248,250,252,0.82)" : "#1d1d1f",
    },
    pixelDot: {
      width: 7,
      height: 7,
      borderRadius: "50%",
      flexShrink: 0,
    },
  };
});

export default function DashboardPrincipalStrip({
  title = "Análises Ads",
  hideValues,
  onToggleHide,
  accountName,
  appName,
  exportData,
  exportFilters,
  accountIntel,
}) {
  const classes = useStyles();
  const { user } = useContext(AuthContext);
  const [langEl, setLangEl] = useState(null);
  const [profileEl, setProfileEl] = useState(null);
  const current = getCurrentLanguage?.() || user?.language || "pt-BR";
  const lang = LANGS.find((l) => l.code === current) || LANGS[0];
  const displayApp =
    appName ||
    (typeof window !== "undefined" && window.localStorage.getItem("appName")) ||
    "VB Solution";
  const intel = accountIntel || {};
  const currency = intel.currency || "BRL";
  const pixels = Array.isArray(intel.pixelNames) ? intel.pixelNames : [];

  const changeLang = async (code) => {
    try {
      await applyAppLanguage(code);
      if (user?.id) {
        await api.put(`/users/${user.id}`, { language: code });
      }
    } catch (err) {
      toastError(err);
    }
    setLangEl(null);
  };

  return (
    <header className={classes.strip}>
      <div className={classes.left}>
        <h1 className={classes.title}>{title}</h1>
        <Tooltip title={hideValues ? "Mostrar indicadores" : "Ocultar indicadores"}>
          <IconButton
            className={classes.iconBtn}
            size="small"
            onClick={onToggleHide}
            aria-label={hideValues ? "Mostrar valores" : "Ocultar valores"}
          >
            {hideValues ? (
              <VisibilityOffOutlinedIcon fontSize="small" />
            ) : (
              <VisibilityOutlinedIcon fontSize="small" />
            )}
          </IconButton>
        </Tooltip>
      </div>

      <div className={classes.mid}>
        <button
          type="button"
          className={classes.lang}
          onClick={(e) => setLangEl(e.currentTarget)}
          aria-label="Trocar idioma"
        >
          <img src={lang.icon} alt="" className={classes.flag} />
          {lang.label}
        </button>
        <Menu
          anchorEl={langEl}
          open={Boolean(langEl)}
          onClose={() => setLangEl(null)}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          transformOrigin={{ vertical: "top", horizontal: "right" }}
        >
          {LANGS.map((opt) => (
            <MenuItem key={opt.code} onClick={() => changeLang(opt.code)} selected={opt.code === lang.code}>
              <img src={opt.icon} alt="" className={classes.flag} style={{ marginRight: 8 }} />
              {opt.label}
            </MenuItem>
          ))}
        </Menu>
        <MetaAdsExportMenu data={exportData} filters={exportFilters} />
        <PageHelpButton topic="metaAdsAnalytics" />
      </div>

      <div className={classes.profile}>
        <button
          type="button"
          className={classes.profileBtn}
          onClick={(e) => setProfileEl(e.currentTarget)}
          aria-label="Detalhes da conta Meta Ads"
        >
          <div className={classes.profileText}>
            <span className={classes.accountName}>{accountName || "Conta Meta Ads"}</span>
            <span className={classes.appName}>{displayApp}</span>
          </div>
          <div className={classes.avatar} aria-hidden>
            <MetaAdsBrandIcon size={18} />
          </div>
        </button>
        <Popover
          open={Boolean(profileEl)}
          anchorEl={profileEl}
          onClose={() => setProfileEl(null)}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          transformOrigin={{ vertical: "top", horizontal: "right" }}
          PaperProps={{ className: classes.intelPaper, elevation: 0 }}
        >
          <div className={classes.intelInner}>
            <div>
              <div className={classes.intelKicker}>Conta Meta Ads</div>
              <div className={classes.intelName}>{intel.name || accountName || "Conta"}</div>
              <div className={classes.intelMeta}>
                {displayApp}
                {intel.accountId ? ` · ${intel.accountId}` : ""}
                {` · ${currency}`}
                {intel.fetchedAt
                  ? ` · atualizado ${new Date(intel.fetchedAt).toLocaleString("pt-BR")}`
                  : ""}
              </div>
            </div>
            <div className={classes.intelGrid}>
              <div className={classes.intelCell}>
                <span className={classes.intelLabel}>Campanhas</span>
                <span className={classes.intelValue}>
                  {numFmt(intel.activeCampaigns)}/{numFmt(intel.campaigns)}
                </span>
                <div className={classes.intelHint}>ativas / total</div>
              </div>
              <div className={classes.intelCell}>
                <span className={classes.intelLabel}>Anúncios</span>
                <span className={classes.intelValue}>
                  {numFmt(intel.activeAds)}/{numFmt(intel.ads)}
                </span>
                <div className={classes.intelHint}>ativos / total</div>
              </div>
              <div className={classes.intelCell}>
                <span className={classes.intelLabel}>Pixels</span>
                <span className={classes.intelValue}>
                  {numFmt(intel.pixelsOpen)}/{numFmt(intel.pixels)}
                </span>
                <div className={classes.intelHint}>abertos / cadastrados</div>
              </div>
              <div className={classes.intelCell}>
                <span className={classes.intelLabel}>ROAS</span>
                <span className={classes.intelValue}>{numFmt(intel.roas, 2)}</span>
                <div className={classes.intelHint}>{money(intel.spend, currency)} investidos</div>
              </div>
            </div>
            {pixels.length ? (
              <div>
                <div className={classes.intelLabel}>Pixels</div>
                {pixels.slice(0, 6).map((p) => (
                  <div key={p.id || p.name} className={classes.pixelRow}>
                    <span className={classes.pixelName}>{p.name}</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <span
                        className={classes.pixelDot}
                        style={{ background: p.open ? "#34d399" : "#94a3b8" }}
                      />
                      <span className={classes.intelHint} style={{ margin: 0 }}>
                        {p.open ? "Aberto" : "Inativo"}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className={classes.intelHint}>Nenhum pixel listado nesta conta.</div>
            )}
          </div>
        </Popover>
      </div>
    </header>
  );
}
