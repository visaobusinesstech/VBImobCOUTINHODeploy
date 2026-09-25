import React, { useEffect, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  FormControlLabel,
  Switch,
  TextField,
  Typography,
  makeStyles,
  Link
} from "@material-ui/core";
import { toast } from "react-toastify";
import { getMetaAdsConfig, saveMetaAdsConfig } from "../../services/metaAdsService";

const useStyles = makeStyles((theme) => ({
  root: {
    width: "100%",
    maxWidth: 720,
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(2)
  },
  hint: {
    color: theme.palette.text.secondary,
    fontSize: 13,
    lineHeight: 1.5
  },
  tokenHint: {
    fontSize: 12,
    color: theme.palette.text.secondary
  }
}));

export default function MetaAdsCapiSettings() {
  const classes = useStyles();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [datasetId, setDatasetId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [testEventCode, setTestEventCode] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [hasAccessToken, setHasAccessToken] = useState(false);
  const [accessTokenLast4, setAccessTokenLast4] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const cfg = await getMetaAdsConfig();
        if (cancelled) return;
        setDatasetId(cfg.datasetId || "");
        setTestEventCode(cfg.testEventCode || "");
        setEnabled(Boolean(cfg.enabled));
        setHasAccessToken(Boolean(cfg.hasAccessToken));
        setAccessTokenLast4(cfg.accessTokenLast4 || "");
      } catch (err) {
        toast.error("Não foi possível carregar a config Meta Ads.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      const cfg = await saveMetaAdsConfig({
        datasetId: datasetId.trim(),
        accessToken: accessToken.trim() || undefined,
        testEventCode: testEventCode.trim(),
        enabled
      });
      setHasAccessToken(Boolean(cfg.hasAccessToken));
      setAccessTokenLast4(cfg.accessTokenLast4 || "");
      setAccessToken("");
      toast.success("Meta Ads (Conversions API) salvo.");
    } catch (err) {
      toast.error("Falha ao salvar configuração Meta Ads.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={3}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  return (
    <div className={classes.root}>
      <Typography variant="h6">Meta Ads — Conversions API</Typography>
      <Typography className={classes.hint}>
        Cole aqui o <strong>Dataset ID</strong> e o <strong>Access Token</strong> do
        Gerenciador de Eventos. Isso permite o CRM devolver conversões (venda/lead)
        para a Meta otimizar anúncios. O rastreio inbound (ticket/lead de Ads) já
        funciona via Click-to-WhatsApp, independente destas credenciais.
      </Typography>
      <Typography className={classes.hint}>
        Events Manager:{" "}
        <Link
          href="https://business.facebook.com/events_manager2"
          target="_blank"
          rel="noopener noreferrer"
        >
          business.facebook.com/events_manager2
        </Link>
      </Typography>

      <TextField
        label="Dataset ID (Pixel)"
        variant="outlined"
        fullWidth
        value={datasetId}
        onChange={(e) => setDatasetId(e.target.value)}
        placeholder="ex: 1681460729620053"
        helperText="ID do conjunto de dados CRM no Events Manager"
      />

      <TextField
        label="Access Token (Conversions API)"
        variant="outlined"
        fullWidth
        type="password"
        value={accessToken}
        onChange={(e) => setAccessToken(e.target.value)}
        placeholder={
          hasAccessToken
            ? `Token salvo (••••${accessTokenLast4}) — cole outro para trocar`
            : "Gerar em Configurações → API Conversões"
        }
        helperText={
          hasAccessToken
            ? `Token atual terminando em ${accessTokenLast4}. Deixe em branco para manter.`
            : "Em Configurações do dataset → API Conversões → Gerar token de acesso"
        }
      />

      <TextField
        label="Test Event Code (opcional)"
        variant="outlined"
        fullWidth
        value={testEventCode}
        onChange={(e) => setTestEventCode(e.target.value)}
        helperText="Código da aba Testar eventos (só homologação)"
      />

      <FormControlLabel
        control={
          <Switch
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            color="primary"
          />
        }
        label="Enviar conversões do CRM para a Meta (CAPI)"
      />

      <Box>
        <Button
          variant="contained"
          color="primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      </Box>
    </div>
  );
}
