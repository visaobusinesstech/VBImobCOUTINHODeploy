import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Divider,
  Link,
  makeStyles,
  Chip
} from "@material-ui/core";
import { hasAdsAttribution } from "../MetaAdsAttributionPanel";

const useStyles = makeStyles((theme) => ({
  title: {
    fontWeight: 700,
    fontSize: 18
  },
  section: {
    marginBottom: theme.spacing(2)
  },
  sectionTitle: {
    fontWeight: 700,
    fontSize: 13,
    marginBottom: theme.spacing(1),
    color: theme.palette.text.secondary,
    textTransform: "uppercase",
    letterSpacing: 0.4
  },
  row: {
    display: "flex",
    gap: theme.spacing(1),
    marginBottom: 6,
    fontSize: 13,
    lineHeight: 1.4
  },
  label: {
    minWidth: 140,
    color: theme.palette.text.secondary,
    flexShrink: 0
  },
  value: {
    wordBreak: "break-word",
    flex: 1
  },
  mono: {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: 12
  },
  chipRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: theme.spacing(1.5)
  },
  rawBox: {
    marginTop: theme.spacing(1),
    padding: theme.spacing(1.25),
    borderRadius: 8,
    background:
      theme.palette.type === "dark" ? "rgba(255,255,255,0.06)" : "#f4f6f8",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: 11,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    maxHeight: 220,
    overflow: "auto"
  }
}));

function Row({ classes, label, children }) {
  if (children == null || children === "") return null;
  return (
    <div className={classes.row}>
      <span className={classes.label}>{label}</span>
      <span className={classes.value}>{children}</span>
    </div>
  );
}

/**
 * Modal central com todas as infos de Ads / tracking disponíveis.
 */
export default function MetaAdsTrackingDetailModal({
  open,
  onClose,
  attribution,
  extras = {}
}) {
  const classes = useStyles();
  const attr = attribution || {};
  const show = open && (hasAdsAttribution(attr) || attr.utm_source || attr.headline || attr.raw);

  if (!open) return null;

  const platform = String(attr.platform || "").toLowerCase();
  const platformLabel =
    platform === "instagram_ads"
      ? "Instagram Ads"
      : platform === "google_ads"
      ? "Google Ads"
      : "Meta Ads";

  return (
    <Dialog open={Boolean(show || open)} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle disableTypography>
        <Typography className={classes.title}>Rastreio de anúncio</Typography>
      </DialogTitle>
      <DialogContent dividers>
        <div className={classes.chipRow}>
          <Chip
            size="small"
            label={platformLabel}
            style={{
              backgroundColor:
                platform === "instagram_ads" ? "#E4405F" : "#0081FB",
              color: "#fff",
              fontWeight: 600
            }}
          />
          {attr.sourceType ? (
            <Chip size="small" label={`Tipo: ${attr.sourceType}`} />
          ) : null}
          {attr.medium ? <Chip size="small" label={`Medium: ${attr.medium}`} /> : null}
        </div>

        <div className={classes.section}>
          <Typography className={classes.sectionTitle}>Campanha & criativo</Typography>
          <Row classes={classes} label="Headline">
            {attr.headline}
          </Row>
          <Row classes={classes} label="Texto do anúncio">
            {attr.body}
          </Row>
          <Row classes={classes} label="Campanha">
            {attr.campaign || attr.utm_campaign}
          </Row>
          <Row classes={classes} label="Campaign ID">
            <span className={classes.mono}>{attr.campaignId}</span>
          </Row>
          <Row classes={classes} label="Ad set ID">
            <span className={classes.mono}>{attr.adsetId}</span>
          </Row>
          <Row classes={classes} label="Ad ID / source_id">
            <span className={classes.mono}>{attr.adId}</span>
          </Row>
          <Row classes={classes} label="Mídia">
            {attr.mediaType}
          </Row>
        </div>

        <Divider />

        <Box className={classes.section} mt={2}>
          <Typography className={classes.sectionTitle}>Click IDs & UTM</Typography>
          <Row classes={classes} label="ctwa_clid">
            <span className={classes.mono}>{attr.ctwa_clid}</span>
          </Row>
          <Row classes={classes} label="fbclid">
            <span className={classes.mono}>{attr.fbclid}</span>
          </Row>
          <Row classes={classes} label="gclid">
            <span className={classes.mono}>{attr.gclid}</span>
          </Row>
          <Row classes={classes} label="utm_source">
            {attr.utm_source}
          </Row>
          <Row classes={classes} label="utm_medium">
            {attr.utm_medium}
          </Row>
          <Row classes={classes} label="utm_campaign">
            {attr.utm_campaign}
          </Row>
          <Row classes={classes} label="utm_content">
            {attr.utm_content}
          </Row>
          <Row classes={classes} label="utm_term">
            {attr.utm_term}
          </Row>
        </Box>

        <Divider />

        <Box className={classes.section} mt={2}>
          <Typography className={classes.sectionTitle}>Destino & conexão</Typography>
          <Row classes={classes} label="URL do anúncio">
            {attr.sourceUrl || attr.landingUrl ? (
              <Link
                href={attr.sourceUrl || attr.landingUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {attr.sourceUrl || attr.landingUrl}
              </Link>
            ) : null}
          </Row>
          <Row classes={classes} label="Número oficial">
            {extras.officialNumber || extras.whatsappPhone || extras.phoneNumber}
          </Row>
          <Row classes={classes} label="Conexão WhatsApp">
            {extras.whatsappName}
          </Row>
          <Row classes={classes} label="WABA / Phone ID">
            {[extras.wabaId, extras.phoneNumberId].filter(Boolean).join(" · ") || null}
          </Row>
          <Row classes={classes} label="Capturado em">
            {attr.capturedAt
              ? new Date(attr.capturedAt).toLocaleString("pt-BR")
              : null}
          </Row>
        </Box>

        {attr.imageUrl || attr.thumbnailUrl || attr.videoUrl ? (
          <>
            <Divider />
            <Box className={classes.section} mt={2}>
              <Typography className={classes.sectionTitle}>Criativo</Typography>
              {(attr.imageUrl || attr.thumbnailUrl) && (
                <Box mt={1} mb={1}>
                  <img
                    src={attr.imageUrl || attr.thumbnailUrl}
                    alt="Criativo do anúncio"
                    style={{
                      maxWidth: "100%",
                      maxHeight: 180,
                      borderRadius: 8,
                      objectFit: "cover"
                    }}
                  />
                </Box>
              )}
              <Row classes={classes} label="Vídeo">
                {attr.videoUrl ? (
                  <Link href={attr.videoUrl} target="_blank" rel="noopener noreferrer">
                    Abrir vídeo
                  </Link>
                ) : null}
              </Row>
            </Box>
          </>
        ) : null}

        {attr.raw && (
          <>
            <Divider />
            <Box className={classes.section} mt={2}>
              <Typography className={classes.sectionTitle}>
                Payload bruto (Meta referral)
              </Typography>
              <div className={classes.rawBox}>
                {JSON.stringify(attr.raw, null, 2)}
              </div>
            </Box>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary" variant="contained">
          Fechar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
