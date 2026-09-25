import { Button } from "@material-ui/core";
import React, { useRef, useEffect, useState, useMemo } from "react";
import api from "../../services/api";
import { Typography } from "@material-ui/core";
import { useTheme, makeStyles } from "@material-ui/core/styles";
import { getBackendUrl } from "../../config";

const LS_NAME = "audioMessageRate";

const useStyles = makeStyles((theme) => ({
  audioContainer: {
    display: "flex",
    flexDirection: "column",
    width: "100%",
    maxWidth: "380px",
    minWidth: "300px",
    padding: 0,
    margin: 0,
    backgroundColor: "transparent",
    border: "none",
  },
  audioPlayerContainer: {
    position: "relative",
    width: "100%",
    height: "40px",
    marginBottom: theme.spacing(1),
  },
  audioPlayer: {
    width: "100%",
    height: "40px",
    outline: "none",
    border: "none",
    backgroundColor: "transparent",
    "&::-webkit-media-controls-panel": {
      backgroundColor: "transparent",
    },
    "&::-webkit-media-controls-current-time-display, &::-webkit-media-controls-time-remaining-display":
      {
        fontSize: "12px",
      },
  },
  controlsContainer: {
    display: "flex",
    flexDirection: "column",
    width: "100%",
    gap: theme.spacing(1),
  },
  transcriptionContainer: {
    width: "100%",
    marginTop: theme.spacing(1),
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  transcriptionText: {
    fontSize: "0.875rem",
    lineHeight: 1.4,
    wordBreak: "break-word",
    padding: theme.spacing(1),
    backgroundColor:
      theme.mode === "dark" ? "rgba(255,255,255,0.08)" : theme.palette.action.hover,
    color: theme.mode === "dark" ? "#fff" : theme.palette.text.primary,
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${theme.palette.divider}`,
    width: "100%",
    boxSizing: "border-box",
  },
  transcriptionError: {
    fontSize: "0.8rem",
    lineHeight: 1.35,
    padding: theme.spacing(1),
    backgroundColor: theme.mode === "dark" ? "rgba(255,255,255,0.08)" : "#fff8e1",
    color: theme.mode === "dark" ? "#fff" : "#7a4f01",
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${
      theme.mode === "dark" ? "rgba(255,255,255,0.18)" : "#ffe082"
    }`,
    width: "100%",
    boxSizing: "border-box",
  },
  transcribeButton: {
    fontSize: "0.75rem",
    padding: theme.spacing(0.5, 1),
    minWidth: "auto",
    height: "32px",
    alignSelf: "center",
  },
  rateButton: {
    position: "absolute",
    top: "2px",
    right: "8px",
    fontSize: "0.7rem",
    minWidth: "auto",
    padding: "1px 6px",
    height: "18px",
    backgroundColor: "rgba(0,0,0,0.6)",
    color: "white",
    borderRadius: "9px",
    zIndex: 10,
    lineHeight: 1,
    "&:hover": {
      backgroundColor: "rgba(0,0,0,0.8)",
    },
    border: "none",
    textTransform: "none",
    boxShadow: "none",
  },
}));

const audioMimeFromUrl = (value = "") => {
  const clean = String(value).split("?")[0].split("#")[0].toLowerCase();
  if (clean.endsWith(".mp3")) return "audio/mpeg";
  if (clean.endsWith(".ogg") || clean.endsWith(".oga")) return "audio/ogg";
  if (clean.endsWith(".webm")) return "audio/webm";
  if (clean.endsWith(".wav")) return "audio/wav";
  if (clean.endsWith(".m4a") || clean.endsWith(".mp4")) return "audio/mp4";
  if (clean.endsWith(".aac")) return "audio/aac";
  return "";
};

const swapAudioExtension = (value = "", ext) => {
  if (!value || /^(blob:|data:)/i.test(value)) return "";
  const [base, suffix = ""] = String(value).split(/([?#].*)/);
  if (!/\.(ogg|oga|mp3|webm|wav|m4a|mp4|aac)$/i.test(base)) return "";
  return `${base.replace(/\.(ogg|oga|mp3|webm|wav|m4a|mp4|aac)$/i, ext)}${suffix}`;
};

const buildAudioSources = (url, message, blobUrl) => {
  const raw = String(url || "").trim();
  const candidates = [
    blobUrl,
    raw,
    message?.id ? `${getBackendUrl()}/messages/${message.id}/media` : "",
    swapAudioExtension(raw, ".mp3"),
    swapAudioExtension(raw, ".ogg"),
    swapAudioExtension(raw, ".webm"),
    swapAudioExtension(raw, ".m4a"),
  ].filter(Boolean);
  return [...new Set(candidates)].map((src) => ({
    src,
    // Não forçar type em blob — o browser detecta; type errado impede o play no Opera
    type: src.startsWith("blob:") ? "" : audioMimeFromUrl(src),
  }));
};

const AudioModal = ({ url, message, disableTranscription = false }) => {
  const theme = useTheme();
  const classes = useStyles();
  const audioRef = useRef(null);
  const [audioRate, setAudioRate] = useState(
    parseFloat(localStorage.getItem(LS_NAME) || "1")
  );
  const [showButtonRate, setShowButtonRate] = useState(false);
  const [transcription, setTranscription] = useState(null);
  const [transcriptionError, setTranscriptionError] = useState("");
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [sourceIndex, setSourceIndex] = useState(0);
  const [audioError, setAudioError] = useState(false);
  const [blobUrl, setBlobUrl] = useState("");

  const audioSources = useMemo(
    () => buildAudioSources(url, message, blobUrl),
    [url, message, blobUrl]
  );
  const currentSource =
    audioSources[Math.min(sourceIndex, Math.max(audioSources.length - 1, 0))] || {
      src: blobUrl || url || "",
      type: "",
    };

  const body = message?.body ?? "";
  const transcrito = message?.transcrito ?? false;

  // Carrega via API autenticada (evita 401/URL pública quebrada no player)
  useEffect(() => {
    let cancelled = false;
    let objectUrl = "";

    const loadBlob = async () => {
      if (!message?.id) return;
      try {
        const res = await api.get(`/messages/${message.id}/media`, {
          responseType: "blob",
        });
        if (cancelled) return;
        if (!res?.data || (res.data.size != null && res.data.size < 32)) return;
        objectUrl = URL.createObjectURL(res.data);
        setBlobUrl(objectUrl);
        setSourceIndex(0);
        setAudioError(false);
      } catch {
        /* fallback para URL pública */
      }
    };

    loadBlob();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [message?.id]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = audioRate;
      localStorage.setItem(LS_NAME, audioRate);
    }
  }, [audioRate, currentSource.src]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.onplaying = () => {
        setShowButtonRate(true);
      };
      audioRef.current.onpause = () => {
        setShowButtonRate(false);
      };
      audioRef.current.onended = () => {
        setShowButtonRate(false);
      };
    }
  }, []);

  const toggleRate = () => {
    let newRate = null;
    switch (audioRate) {
      case 0.5:
        newRate = 1;
        break;
      case 1:
        newRate = 1.5;
        break;
      case 1.5:
        newRate = 2;
        break;
      case 2:
        newRate = 0.5;
        break;
      default:
        newRate = 1;
        break;
    }
    setAudioRate(newRate);
  };

  useEffect(() => {
    setSourceIndex(0);
    setAudioError(false);
  }, [url, message?.id, blobUrl]);

  const handleAudioError = () => {
    if (sourceIndex < audioSources.length - 1) {
      setSourceIndex((idx) => idx + 1);
      return;
    }
    setAudioError(true);
  };

  const handleTranscribe = async () => {
    setIsTranscribing(true);
    setTranscriptionError("");
    try {
      const { data } = await api.post(`/message/transcribeAudio`, {
        wid: message.wid,
      });

      const text = typeof data === "string" ? data : String(data?.text || data || "");
      if (/falhou|não foi possível|nao foi possivel/i.test(text)) {
        setTranscriptionError(
          "Não foi possível transcrever este áudio. A reprodução continua disponível no player acima."
        );
      } else if (text) {
        setTranscription(text);
      } else {
        setTranscriptionError(
          "Não foi possível transcrever este áudio. A reprodução continua disponível no player acima."
        );
      }
    } catch (error) {
      setTranscriptionError(
        "Não foi possível transcrever este áudio. A reprodução continua disponível no player acima."
      );
    } finally {
      setIsTranscribing(false);
    }
  };

  const openHref = blobUrl || currentSource.src || url;

  return (
    <div className={classes.audioContainer}>
      <div className={classes.audioPlayerContainer}>
        <audio
          key={currentSource.src}
          ref={audioRef}
          controls
          className={classes.audioPlayer}
          preload="metadata"
          onError={handleAudioError}
          onLoadedMetadata={() => setAudioError(false)}
          src={!currentSource.type ? currentSource.src : undefined}
        >
          {currentSource.type ? (
            <source src={currentSource.src} type={currentSource.type} />
          ) : null}
          Seu navegador não suporta reprodução de áudio.
        </audio>

        {showButtonRate && (
          <Button
            className={classes.rateButton}
            onClick={toggleRate}
            size="small"
            disableRipple
          >
            {audioRate}x
          </Button>
        )}
      </div>

      <div className={classes.controlsContainer}>
        {audioError && openHref && (
          <Typography className={classes.transcriptionError} variant="body2">
            <a href={openHref} target="_blank" rel="noopener noreferrer" download>
              Baixar áudio
            </a>
          </Typography>
        )}
        {!disableTranscription && (
          <div className={classes.transcriptionContainer}>
            {!transcrito ? (
              transcription ? (
                <Typography className={classes.transcriptionText} variant="body2">
                  <strong>Transcrição:</strong> {transcription}
                </Typography>
              ) : transcriptionError ? (
                <Typography className={classes.transcriptionError} variant="body2">
                  {transcriptionError}
                </Typography>
              ) : (
                <Button
                  onClick={handleTranscribe}
                  variant="contained"
                  className={classes.transcribeButton}
                  disabled={isTranscribing}
                  style={{
                    backgroundColor: isTranscribing
                      ? "#ccc"
                      : theme.palette.primary.main,
                    color: "#fff",
                  }}
                >
                  {isTranscribing ? "Transcrevendo..." : "Transcrever"}
                </Button>
              )
            ) : (
              <Typography className={classes.transcriptionText} variant="body2">
                <strong>Transcrição:</strong> {body}
              </Typography>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AudioModal;
