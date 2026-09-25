import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Box } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import { placeholderKeyFromToken } from "./agentScriptConstants";

const MIN_H = 320;

const useStyles = makeStyles((theme) => {
  const isDark = theme.palette.type === "dark";
  return {
    root: {
      position: "relative",
      width: "100%"
    },
    clip: {
      position: "absolute",
      left: 0,
      right: 0,
      top: 0,
      overflow: "hidden",
      pointerEvents: "none",
      zIndex: 1,
      borderRadius: 2
    },
    backdropInner: {
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
      fontSize: "0.875rem",
      lineHeight: 1.65,
      fontFamily:
        '"Helvetica Neue", HelveticaNeue, "SF Pro Text", "Segoe UI", system-ui, -apple-system, sans-serif',
      letterSpacing: "-0.011em",
      padding: 0,
      margin: 0,
      color: theme.palette.text.primary,
      willChange: "transform"
    },
    token: {
      borderRadius: 6,
      padding: "1px 6px",
      fontWeight: 600,
      boxDecorationBreak: "clone",
      WebkitBoxDecorationBreak: "clone"
    },
    textarea: {
      position: "relative",
      zIndex: 2,
      width: "100%",
      minHeight: MIN_H,
      border: "none",
      outline: "none",
      resize: "none",
      background: "transparent",
      fontSize: "0.875rem",
      lineHeight: 1.65,
      fontFamily:
        '"Helvetica Neue", HelveticaNeue, "SF Pro Text", "Segoe UI", system-ui, -apple-system, sans-serif',
      letterSpacing: "-0.011em",
      color: "transparent",
      caretColor: isDark ? "#f5f5f7" : "#111827",
      padding: 0,
      margin: 0,
      display: "block",
      overflow: "hidden",
      boxSizing: "border-box",
      "&::placeholder": {
        color: isDark ? "rgba(255,255,255,0.35)" : "rgba(15,23,42,0.38)",
        opacity: 1
      }
    }
  };
});

const TOKEN_RE = /(#[a-zA-Z][a-zA-Z0-9_-]*|\{[a-zA-Z0-9_.]+\})/g;

const VAR_COLOR = "#0d9488";
const MEDIA_COLOR = "#ec4899";

function splitWithTokens(text) {
  const s = text == null ? "" : String(text);
  const parts = [];
  let last = 0;
  let m;
  while ((m = TOKEN_RE.exec(s)) !== null) {
    if (m.index > last) parts.push({ type: "plain", text: s.slice(last, m.index) });
    parts.push({ type: "token", text: m[0] });
    last = m.index + m[0].length;
  }
  if (last < s.length) parts.push({ type: "plain", text: s.slice(last) });
  if (parts.length === 0) parts.push({ type: "plain", text: s });
  return parts;
}

function resolveTokenColor(tokenText, smartActions, mediaLibrary, presetDefs, standardVarKeys) {
  if (tokenText.startsWith("{")) {
    const k = placeholderKeyFromToken(tokenText);
    if (k && standardVarKeys && standardVarKeys.has(k)) return VAR_COLOR;
    return "#a855f7";
  }
  // Apenas #mídia e {variáveis} — barra / no roteiro é texto puro (sem cor).
  if (tokenText.startsWith("#")) {
    return MEDIA_COLOR;
  }
  return "inherit";
}

/**
 * Roteiro com realce de #mídias e {variáveis}.
 * A barra / NÃO é destacada nem tratada como comando neste editor.
 */
export default function AgentScriptEditor({
  value,
  onChange,
  onKeyDown,
  onSelect,
  placeholder,
  smartActions = [],
  mediaLibrary = [],
  presetDefs = [],
  standardVarKeys,
  inputRef: inputRefProp
}) {
  const classes = useStyles();
  const taRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [wrapH, setWrapH] = useState(MIN_H);

  const stdSet = useMemo(() => {
    if (!standardVarKeys) return null;
    if (standardVarKeys instanceof Set) return standardVarKeys;
    return new Set(standardVarKeys);
  }, [standardVarKeys]);

  const setRefs = useCallback(
    (el) => {
      taRef.current = el;
      if (typeof inputRefProp === "function") inputRefProp(el);
      else if (inputRefProp && typeof inputRefProp === "object") inputRefProp.current = el;
    },
    [inputRefProp]
  );

  useLayoutEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    const h = Math.max(MIN_H, el.scrollHeight);
    el.style.height = `${h}px`;
    setWrapH(h);
    setScrollTop(0);
  }, [value]);

  const parts = useMemo(() => splitWithTokens(value), [value]);

  const colored = useMemo(
    () =>
      parts.map((p, i) => {
        if (p.type === "plain") {
          return (
            <span key={i} style={{ color: "inherit" }}>
              {p.text}
            </span>
          );
        }
        const col = resolveTokenColor(p.text, smartActions, mediaLibrary, presetDefs, stdSet);
        return (
          <span
            key={i}
            className={classes.token}
            style={{
              color: col,
              background: `${col}18`,
              border: `1px solid ${col}40`
            }}
          >
            {p.text}
          </span>
        );
      }),
    [parts, smartActions, mediaLibrary, presetDefs, stdSet, classes.token]
  );

  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    const h = () => setScrollTop(el.scrollTop);
    el.addEventListener("scroll", h, { passive: true });
    return () => el.removeEventListener("scroll", h);
  }, [value]);

  return (
    <Box className={classes.root} style={{ minHeight: wrapH }}>
      <Box className={classes.clip} style={{ height: wrapH }}>
        <Box
          className={classes.backdropInner}
          style={{ transform: `translateY(-${scrollTop}px)` }}
        >
          {colored}
        </Box>
      </Box>
      <textarea
        ref={setRefs}
        className={classes.textarea}
        value={value == null ? "" : value}
        placeholder={placeholder}
        spellCheck={false}
        onChange={(e) => onChange(e.target.value, e)}
        onKeyDown={onKeyDown}
        onSelect={onSelect}
        onScroll={(e) => setScrollTop(e.target.scrollTop)}
      />
    </Box>
  );
}

/** No roteiro, `/` NÃO abre seletor nem é comando — sempre null. Respostas rápidas ficam no chat. */
export function getSlashFilter(_text, _cursorPos) {
  return null;
}

/**
 * Prefixo após `#` para filtrar mídias do roteiro (#nome-da-midia), ou `null`.
 * Não dispara em cabeçalhos "# ETAPA" (espaço após #).
 */
export function getHashMediaFilter(text, cursorPos) {
  const before = String(text || "").slice(0, Math.max(0, Number(cursorPos) || 0));
  if (/#\s+\S*$/.test(before)) return null;
  const m = before.match(/(?:^|[\s])#([a-zA-Z0-9_-]*)$/);
  return m ? m[1] : null;
}

/** Prefixo após `*` para filtrar variáveis, ou `null`. */
export function getStarFilter(text, cursorPos) {
  const before = String(text || "").slice(0, Math.max(0, Number(cursorPos) || 0));
  const m = before.match(/\*([a-zA-Z0-9_]*)$/);
  return m ? m[1] : null;
}
