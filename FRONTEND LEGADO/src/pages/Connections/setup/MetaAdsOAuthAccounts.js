import React, { useCallback, useEffect, useState } from "react";
import {
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  IconButton,
  Typography,
  makeStyles,
} from "@material-ui/core";
import { CheckCircle, DeleteOutline } from "@material-ui/icons";
import FacebookLogin from "react-facebook-login/dist/facebook-login-render-props";
import { toast } from "react-toastify";
import { META_ADS_OAUTH_SCOPE } from "../../../config/metaOAuthScopes";
import {
  connectMetaAdsAccounts,
  deleteMetaAdsAccount,
  discoverMetaAdsAccounts,
  listMetaAdsAccounts,
} from "../../../services/metaAdsService";
import IntegrationBrandIcon from "../IntegrationBrandIcon";
import { CONNECTIONS_FONT } from "../connectionsTypography";
import { getConnectionsBorder } from "../connectionsTheme";

const FACEBOOK_APP_ID =
  process.env.REACT_APP_FACEBOOK_APP_ID || "2005927163294829";

const useStyles = makeStyles((theme) => {
  const isDark = theme.palette.type === "dark";
  const border = getConnectionsBorder(theme);
  return {
    oauth: {
      fontFamily: CONNECTIONS_FONT,
      textTransform: "none",
      borderRadius: 8,
      fontWeight: 500,
      fontSize: "0.8125rem",
      background: "#0081FB",
      color: "#fff",
      whiteSpace: "nowrap",
      padding: theme.spacing(0.65, 1.5),
      "&:hover": { background: "#0064d1" },
    },
    dialogPaper: {
      borderRadius: 16,
      background: isDark ? "#161922" : "#fff",
      fontFamily: CONNECTIONS_FONT,
    },
    dialogHead: {
      display: "flex",
      alignItems: "baseline",
      justifyContent: "space-between",
      gap: 12,
      padding: theme.spacing(2.5, 2.5, 1),
    },
    dialogTitle: {
      fontSize: 18,
      fontWeight: 650,
      letterSpacing: "-0.03em",
    },
    dialogHint: {
      fontSize: 13,
      color: theme.palette.text.secondary,
      marginTop: 4,
    },
    grid: {
      display: "grid",
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
      gap: 12,
      [theme.breakpoints.down("sm")]: {
        gridTemplateColumns: "1fr",
      },
    },
    card: {
      position: "relative",
      display: "flex",
      flexDirection: "column",
      gap: 8,
      padding: theme.spacing(2),
      minHeight: 148,
      borderRadius: 16,
      border: `1px solid ${border}`,
      background: isDark ? "rgba(255,255,255,0.04)" : "#ffffff",
      textAlign: "left",
      font: "inherit",
      color: "inherit",
      cursor: "default",
      boxShadow: isDark
        ? "0 4px 18px rgba(0,0,0,0.22)"
        : "0 4px 18px rgba(15,23,42,0.05)",
    },
    head: { display: "flex", alignItems: "flex-start", gap: 12 },
    iconWrap: {
      width: 48,
      height: 48,
      borderRadius: 12,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: isDark ? "rgba(0,129,251,0.12)" : "rgba(0,129,251,0.08)",
      flexShrink: 0,
    },
    name: { fontSize: "0.9375rem", fontWeight: 600, letterSpacing: "-0.02em" },
    meta: {
      fontSize: 12,
      color: theme.palette.text.secondary,
      marginTop: 4,
      lineHeight: 1.4,
    },
    chipOk: {
      marginTop: 8,
      height: 22,
      fontSize: 11,
      fontWeight: 600,
      background: "rgba(52,199,89,0.16)",
      color: isDark ? "#86efac" : "#15803d",
    },
    pick: { display: "flex", flexDirection: "column", gap: 4, marginBottom: 16 },
    row: {
      display: "flex",
      alignItems: "center",
      fontSize: 13,
    },
    pageGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
      gap: 12,
      marginTop: 16,
      [theme.breakpoints.down("sm")]: {
        gridTemplateColumns: "1fr",
      },
    },
    del: {
      position: "absolute",
      top: 8,
      right: 8,
      color: theme.palette.text.secondary,
    },
  };
});

function ConnectionTile({ title, subtitle, onDelete }) {
  const classes = useStyles();
  return (
    <div className={classes.card}>
      {onDelete ? (
        <IconButton
          size="small"
          className={classes.del}
          onClick={onDelete}
          aria-label={`Remover ${title}`}
        >
          <DeleteOutline fontSize="small" />
        </IconButton>
      ) : null}
      <div className={classes.head}>
        <div className={classes.iconWrap}>
          <IntegrationBrandIcon
            brandKey="meta-ads"
            variant="list"
            accentColor="#0081FB"
            plain
          />
        </div>
        <div>
          <Typography className={classes.name}>{title}</Typography>
          <Typography className={classes.meta}>{subtitle}</Typography>
          <Chip
            size="small"
            className={classes.chipOk}
            icon={<CheckCircle style={{ fontSize: 14 }} />}
            label="Configurado"
          />
        </div>
      </div>
    </div>
  );
}

function ExtraAccountTiles({ accounts, onRemove }) {
  const classes = useStyles();
  const extras = (accounts || []).filter((a) => a.source === "oauth");
  if (!extras.length) return null;
  return (
    <div className={classes.pageGrid}>
      {extras.map((a) => {
        const pixelCount = Array.isArray(a.pixels)
          ? a.pixels.length
          : Number(a.pixelCount) || 0;
        const pixelName = a.pixels?.[0]?.name;
        return (
          <React.Fragment key={a.id || a.adAccountId}>
            <ConnectionTile
              title="Gerenciador de Eventos"
              subtitle={
                pixelCount
                  ? `Pixels ativos · ${pixelName || `${pixelCount} pixel${pixelCount > 1 ? "s" : ""}`}`
                  : `Conectado · ${a.name || "Conta Meta Ads"}`
              }
              onDelete={onRemove ? () => onRemove(a) : undefined}
            />
            <ConnectionTile
              title="Anúncios & Pixels"
              subtitle={`Insights ativo · ${a.name || "Conta Meta Ads"}`}
            />
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default function MetaAdsOAuthAccounts({ variant = "toolbar" }) {
  const classes = useStyles();
  const [busy, setBusy] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [pendingToken, setPendingToken] = useState("");
  const [discovered, setDiscovered] = useState([]);
  const [picked, setPicked] = useState({});
  const [cloneOpen, setCloneOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await listMetaAdsAccounts();
      setAccounts(Array.isArray(res?.accounts) ? res.accounts : []);
    } catch {
      setAccounts([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCallback = async (response) => {
    const token = response?.accessToken;
    if (!token) {
      toast.warning("Login Meta cancelado ou sem permissão ads_read.");
      setBusy(false);
      return;
    }
    try {
      setBusy(true);
      const res = await discoverMetaAdsAccounts(token);
      const list = Array.isArray(res?.accounts) ? res.accounts : [];
      if (!list.length) {
        toast.error("Nenhuma conta de anúncios encontrada neste usuário Meta.");
        return;
      }
      setPendingToken(token);
      setDiscovered(list);
      setPicked(Object.fromEntries(list.map((a) => [a.adAccountId, true])));
      setCloneOpen(true);
    } catch (e) {
      toast.error(e?.response?.data?.error || "Falha ao listar contas Meta Ads.");
    } finally {
      setBusy(false);
    }
  };

  const savePicked = async () => {
    const selected = discovered.filter((a) => picked[a.adAccountId]);
    if (!selected.length) {
      toast.error("Selecione ao menos uma conta.");
      return;
    }
    try {
      setBusy(true);
      await connectMetaAdsAccounts({
        accessToken: pendingToken,
        accounts: selected,
      });
      toast.success("Contas Meta Ads conectadas.");
      setDiscovered([]);
      setPendingToken("");
      await load();
      setCloneOpen(true);
    } catch (e) {
      toast.error(e?.response?.data?.error || "Falha ao salvar contas.");
    } finally {
      setBusy(false);
    }
  };

  const removeAccount = async (a) => {
    await deleteMetaAdsAccount(a.id);
    toast.success("Conta removida.");
    load();
  };

  const button = FACEBOOK_APP_ID ? (
    <FacebookLogin
      appId={FACEBOOK_APP_ID}
      autoLoad={false}
      fields="name,email"
      version="20.0"
      redirectUri={
        typeof window !== "undefined" ? window.location.origin : undefined
      }
      scope={META_ADS_OAUTH_SCOPE}
      callback={handleCallback}
      render={(renderProps) => (
        <Button
          className={classes.oauth}
          disableElevation
          variant="contained"
          disabled={busy}
          onClick={(e) => {
            setBusy(true);
            renderProps.onClick(e);
          }}
          startIcon={
            busy ? <CircularProgress size={14} color="inherit" /> : null
          }
        >
          {busy ? "Aguardando Meta…" : "Conectar outra conta via OAuth"}
        </Button>
      )}
    />
  ) : (
    <Typography variant="caption" color="textSecondary">
      Configure REACT_APP_FACEBOOK_APP_ID para habilitar o OAuth.
    </Typography>
  );

  const cloneDialog = (
    <Dialog
      open={cloneOpen}
      onClose={() => setCloneOpen(false)}
      maxWidth="md"
      fullWidth
      PaperProps={{ className: classes.dialogPaper }}
    >
      <div className={classes.dialogHead}>
        <div>
          <Typography className={classes.dialogTitle}>Meta Ads</Typography>
          <Typography className={classes.dialogHint}>
            Conexões criadas via OAuth — Gerenciador de Eventos e Anúncios &amp;
            Pixels desta conta.
          </Typography>
        </div>
      </div>
      <DialogContent style={{ paddingTop: 8, paddingBottom: 24 }}>
        {discovered.length > 0 ? (
          <div className={classes.pick}>
            {discovered.map((a) => (
              <label key={a.adAccountId} className={classes.row}>
                <Checkbox
                  size="small"
                  color="primary"
                  checked={Boolean(picked[a.adAccountId])}
                  onChange={() =>
                    setPicked((p) => ({
                      ...p,
                      [a.adAccountId]: !p[a.adAccountId],
                    }))
                  }
                />
                {a.name}
              </label>
            ))}
            <Button
              className={classes.oauth}
              disabled={busy}
              onClick={savePicked}
              style={{ alignSelf: "flex-start", marginTop: 8 }}
            >
              Salvar contas selecionadas
            </Button>
          </div>
        ) : null}
        <Box className={classes.grid}>
          {accounts
            .filter((a) => a.source === "oauth")
            .map((a) => {
              const pixelCount = Array.isArray(a.pixels)
                ? a.pixels.length
                : Number(a.pixelCount) || 0;
              const pixelName = a.pixels?.[0]?.name;
              return (
                <React.Fragment key={a.id || a.adAccountId}>
                  <ConnectionTile
                    title="Gerenciador de Eventos"
                    subtitle={
                      pixelCount
                        ? `Pixels ativos · ${pixelName || `${pixelCount} pixels`}`
                        : `Conectado · ${a.name || "Conta Meta Ads"}`
                    }
                    onDelete={() => removeAccount(a)}
                  />
                  <ConnectionTile
                    title="Anúncios & Pixels"
                    subtitle={`Insights ativo · ${a.name || "Conta Meta Ads"}`}
                  />
                </React.Fragment>
              );
            })}
        </Box>
        {!accounts.some((a) => a.source === "oauth") && discovered.length === 0 ? (
          <Typography className={classes.dialogHint}>
            Nenhuma conta extra conectada ainda.
          </Typography>
        ) : null}
      </DialogContent>
    </Dialog>
  );

  if (variant === "cards") {
    return (
      <>
        <ExtraAccountTiles accounts={accounts} onRemove={removeAccount} />
        {cloneDialog}
      </>
    );
  }

  return (
    <>
      {button}
      {cloneDialog}
    </>
  );
}
