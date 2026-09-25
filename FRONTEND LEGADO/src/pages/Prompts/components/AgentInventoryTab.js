import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Collapse,
  InputAdornment,
  Switch,
  TextField,
  Typography
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import SearchIcon from "@material-ui/icons/Search";
import { Package, MessageSquare, ChevronDown, ChevronUp, Copy } from "lucide-react";
import api from "../../../services/api";
import toastError from "../../../errors/toastError";
import { toast } from "react-toastify";
import InventoryReplySettingsPanel, {
  INVENTORY_REPLY_DEFAULT
} from "../../../components/InventoryReplySettingsPanel";
import WhatsAppIphonePreview from "../../../components/WhatsAppIphonePreview";
import { buildInventoryWhatsAppPreview } from "../../../helpers/inventoryReplyTemplates";

const DEFAULT_REPLY = {
  ...INVENTORY_REPLY_DEFAULT,
  template:
    INVENTORY_REPLY_DEFAULT.template ||
    "O *{{nome}}* custa {{preco}}{{estoque_frase}}.{{link_frase}}"
};

const PLACEHOLDERS = [
  "{{nome}}",
  "{{preco}}",
  "{{estoque_frase}}",
  "{{promo_frase}}",
  "{{parcelamento_frase}}",
  "{{link}}",
  "{{descricao}}"
];

const useStyles = makeStyles((theme) => {
  const isDark = theme.palette.type === "dark";
  const ink = isDark ? "rgba(255,255,255,0.92)" : "#1d1d1f";
  const muted = isDark ? "rgba(255,255,255,0.55)" : "#86868b";
  const hairline = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";
  const surface = isDark ? "rgba(255,255,255,0.04)" : "#ffffff";
  const accent = isDark ? "#0a84ff" : "#0071e3";
  const success = "#34C759";
  return {
    root: {
      display: "flex",
      flexDirection: "column",
      gap: 16,
      width: "100%",
      maxWidth: "100%",
      boxSizing: "border-box",
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, system-ui, sans-serif',
      color: ink,
      paddingBottom: 8,
      "@media (prefers-reduced-motion: reduce)": {
        "& $productRow, & $messageCard, & $sameToggle": {
          transition: "none"
        }
      }
    },
    hero: {
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 12,
      flexWrap: "wrap"
    },
    heroTitle: {
      fontSize: 22,
      fontWeight: 650,
      letterSpacing: "-0.03em",
      margin: 0,
      textWrap: "balance"
    },
    heroSub: {
      marginTop: 4,
      fontSize: 13,
      color: muted,
      lineHeight: 1.4,
      maxWidth: 520
    },
    steps: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      flexWrap: "wrap",
      marginTop: 10,
      fontSize: 11.5,
      color: muted
    },
    stepDot: {
      width: 5,
      height: 5,
      borderRadius: "50%",
      background: accent,
      opacity: 0.55
    },
    split: {
      display: "grid",
      gridTemplateColumns:
        "minmax(220px, 0.85fr) minmax(280px, 1.15fr) minmax(220px, 0.85fr)",
      gap: 14,
      width: "100%",
      alignItems: "stretch",
      "@media (max-width: 1200px)": {
        gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.15fr)",
        "& $previewCol": { gridColumn: "1 / -1" }
      },
      "@media (max-width: 820px)": {
        gridTemplateColumns: "1fr"
      }
    },
    previewCol: {},
    panel: {
      borderRadius: 14,
      border: `1px solid ${hairline}`,
      background: surface,
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      minHeight: 520,
      minWidth: 0
    },
    previewPanelBody: {
      padding: "12px 8px 16px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "flex-start",
      flex: 1,
      overflowY: "auto",
      gap: 10
    },
    previewProductPick: {
      display: "flex",
      flexWrap: "wrap",
      gap: 6,
      justifyContent: "center",
      width: "100%",
      padding: "0 4px"
    },
    previewChip: {
      border: `1px solid ${hairline}`,
      background: "transparent",
      color: muted,
      borderRadius: 999,
      padding: "4px 10px",
      fontSize: 11,
      fontWeight: 600,
      cursor: "pointer",
      fontFamily: "inherit",
      maxWidth: 160,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      transition: "border-color 160ms ease-out, background 160ms ease-out, color 160ms ease-out",
      "&$previewChipActive": {
        borderColor: accent,
        color: accent,
        background: isDark ? "rgba(10,132,255,0.12)" : "rgba(0,113,227,0.08)"
      }
    },
    previewChipActive: {},
    panelHead: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      padding: "12px 14px",
      borderBottom: `1px solid ${hairline}`
    },
    panelTitle: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      fontSize: 13.5,
      fontWeight: 650
    },
    count: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      minWidth: 22,
      height: 22,
      padding: "0 7px",
      borderRadius: 999,
      fontSize: 11,
      fontWeight: 700,
      background: isDark ? "rgba(10,132,255,0.18)" : "rgba(0,113,227,0.1)",
      color: accent
    },
    panelBody: {
      padding: 12,
      display: "flex",
      flexDirection: "column",
      gap: 10,
      flex: 1,
      minHeight: 0
    },
    search: {
      "& .MuiOutlinedInput-root": { borderRadius: 10, fontSize: 13 }
    },
    selectAllRow: {
      display: "flex",
      alignItems: "center",
      gap: 4,
      padding: "2px 2px 4px"
    },
    selectAllLabel: {
      fontSize: 12.5,
      fontWeight: 500,
      color: muted,
      cursor: "pointer",
      userSelect: "none"
    },
    productList: {
      flex: 1,
      minHeight: 0,
      overflowY: "auto",
      display: "flex",
      flexDirection: "column",
      gap: 6,
      paddingRight: 2
    },
    productRow: {
      display: "grid",
      gridTemplateColumns: "28px 36px minmax(0, 1fr)",
      gap: 10,
      alignItems: "center",
      padding: "9px 10px",
      borderRadius: 12,
      border: `1px solid ${hairline}`,
      cursor: "pointer",
      minWidth: 0,
      transition: "background 160ms ease-out, border-color 160ms ease-out",
      "&:hover": {
        background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)"
      }
    },
    productSelected: {
      borderColor: isDark ? "rgba(10,132,255,0.45)" : "rgba(0,113,227,0.35)",
      background: isDark ? "rgba(10,132,255,0.1)" : "rgba(0,113,227,0.06)"
    },
    thumb: {
      width: 36,
      height: 36,
      borderRadius: 8,
      objectFit: "cover",
      background: isDark ? "rgba(255,255,255,0.06)" : "#f0f0f2",
      flexShrink: 0
    },
    productName: {
      fontSize: 13,
      fontWeight: 650,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis"
    },
    productSub: {
      fontSize: 11.5,
      color: muted,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      marginTop: 1
    },
    sameToggle: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      padding: "10px 12px",
      borderRadius: 12,
      border: `1px solid ${hairline}`,
      background: isDark ? "rgba(10,132,255,0.08)" : "rgba(0,113,227,0.04)",
      transition: "border-color 160ms ease-out, background 160ms ease-out"
    },
    sameToggleOn: {
      borderColor: isDark ? "rgba(10,132,255,0.4)" : "rgba(0,113,227,0.3)"
    },
    sameToggleText: {
      display: "flex",
      alignItems: "flex-start",
      gap: 8,
      minWidth: 0
    },
    sameTitle: {
      fontSize: 13,
      fontWeight: 650,
      lineHeight: 1.3
    },
    sameHint: {
      fontSize: 11.5,
      color: muted,
      marginTop: 2,
      lineHeight: 1.35
    },
    replyScroll: {
      flex: 1,
      minHeight: 0,
      overflowY: "auto",
      display: "flex",
      flexDirection: "column",
      gap: 10,
      paddingRight: 2
    },
    messageCard: {
      borderRadius: 12,
      border: `1px solid ${hairline}`,
      padding: 12,
      display: "flex",
      flexDirection: "column",
      gap: 10,
      transition: "border-color 160ms ease-out",
      cursor: "default"
    },
    messageCardActive: {
      borderColor: isDark ? "rgba(10,132,255,0.45)" : "rgba(0,113,227,0.35)"
    },
    messageHead: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      minWidth: 0
    },
    messageTitle: {
      fontSize: 13,
      fontWeight: 650,
      flex: 1,
      minWidth: 0,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis"
    },
    templateField: {
      "& .MuiOutlinedInput-root": {
        borderRadius: 10,
        fontSize: 13,
        background: isDark ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.95)"
      }
    },
    chips: { display: "flex", flexWrap: "wrap", gap: 5 },
    chip: {
      border: `1px solid ${hairline}`,
      background: isDark ? "rgba(255,255,255,0.05)" : "#f5f5f7",
      color: muted,
      borderRadius: 999,
      padding: "3px 8px",
      fontSize: 10.5,
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      cursor: "pointer",
      "&:hover": { color: accent, borderColor: accent }
    },
    moreBtn: {
      textTransform: "none",
      fontWeight: 600,
      fontSize: 12,
      alignSelf: "flex-start",
      padding: "2px 4px",
      minWidth: 0,
      color: muted
    },
    empty: {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      textAlign: "center",
      padding: "32px 20px",
      color: muted,
      gap: 8
    },
    emptyTitle: {
      fontSize: 14,
      fontWeight: 650,
      color: ink
    },
    emptyHint: {
      fontSize: 12.5,
      lineHeight: 1.4,
      maxWidth: 260
    },
    footer: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      flexWrap: "wrap",
      paddingTop: 10,
      borderTop: `1px solid ${hairline}`
    },
    footerHint: {
      fontSize: 11.5,
      color: muted
    },
    primaryBtn: {
      textTransform: "none",
      borderRadius: 10,
      fontWeight: 650,
      fontSize: 13,
      boxShadow: "none",
      background: accent,
      color: "#fff",
      padding: "6px 16px",
      "&:hover": { background: accent, filter: "brightness(0.96)" },
      "&:disabled": { opacity: 0.45 }
    },
    ghostBtn: {
      textTransform: "none",
      borderRadius: 9,
      fontWeight: 500,
      fontSize: 12,
      boxShadow: "none"
    },
    switchAccent: {
      "& .Mui-checked": { color: accent },
      "& .Mui-checked + .MuiSwitch-track": { backgroundColor: accent }
    },
    savedFlash: {
      fontSize: 12,
      fontWeight: 600,
      color: success
    }
  };
});

function formatPrice(price, currency = "BRL") {
  const value = Number(price) || 0;
  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: currency === "R$" ? "BRL" : currency || "BRL"
    }).format(value);
  } catch {
    return `R$ ${value.toFixed(2)}`;
  }
}

function normalizeReply(raw) {
  return { ...DEFAULT_REPLY, ...(raw && typeof raw === "object" ? raw : {}) };
}

function ProductMessageEditor({
  classes,
  title,
  thumb,
  value,
  onChange,
  expanded,
  onToggleExpanded,
  active,
  onActivate
}) {
  const reply = normalizeReply(value);

  const insertPlaceholder = (token) => {
    const base = reply.template || "";
    onChange({
      ...reply,
      strategyPreset: "custom",
      template: `${base}${base && !base.endsWith(" ") ? " " : ""}${token}`
    });
  };

  return (
    <Box
      className={`${classes.messageCard} ${active ? classes.messageCardActive : ""}`}
      onFocusCapture={() => onActivate && onActivate()}
      onClick={() => onActivate && onActivate()}
    >
      <Box className={classes.messageHead}>
        {thumb ? (
          <img src={thumb} alt="" className={classes.thumb} />
        ) : (
          <Box className={classes.thumb} />
        )}
        <Typography className={classes.messageTitle} component="div">
          {title}
        </Typography>
      </Box>

      <TextField
        className={classes.templateField}
        fullWidth
        multiline
        minRows={3}
        variant="outlined"
        placeholder="Como o agente deve responder sobre este produto…"
        value={reply.template || ""}
        onChange={(e) =>
          onChange({
            ...reply,
            strategyPreset: "custom",
            template: e.target.value
          })
        }
      />

      <Box className={classes.chips}>
        {PLACEHOLDERS.map((ph) => (
          <button
            key={ph}
            type="button"
            className={classes.chip}
            onClick={() => insertPlaceholder(ph)}
          >
            {ph}
          </button>
        ))}
      </Box>

      <Button
        className={classes.moreBtn}
        size="small"
        onClick={onToggleExpanded}
        endIcon={expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      >
        {expanded ? "Menos opções" : "Tom, imagens e anexos"}
      </Button>

      <Collapse in={expanded}>
        <Box mt={0.5}>
          <InventoryReplySettingsPanel
            compact
            showPreview={false}
            hideTemplate
            value={reply}
            onChange={onChange}
          />
        </Box>
      </Collapse>
    </Box>
  );
}

export default function AgentInventoryTab({
  inventory,
  onChange,
  onEnsureProductActions
}) {
  const classes = useStyles();
  const enabled = inventory?.enabled !== false;
  const reply = useMemo(
    () => normalizeReply(inventory?.reply),
    [inventory?.reply]
  );
  const productReplies = useMemo(
    () =>
      inventory?.productReplies && typeof inventory.productReplies === "object"
        ? inventory.productReplies
        : {},
    [inventory?.productReplies]
  );
  const linkedIds = useMemo(
    () =>
      Array.isArray(inventory?.productIds)
        ? inventory.productIds
            .map((n) => Number(n))
            .filter((n) => Number.isFinite(n) && n > 0)
        : [],
    [inventory?.productIds]
  );
  const linkedSet = useMemo(() => new Set(linkedIds), [linkedIds]);

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [useSameMessage, setUseSameMessage] = useState(
    () => inventory?.useSameMessage === true
  );
  const [sharedDraft, setSharedDraft] = useState(() => normalizeReply(inventory?.reply));
  const [drafts, setDrafts] = useState({});
  const [expandedIds, setExpandedIds] = useState({});
  const [sharedExpanded, setSharedExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [previewProductId, setPreviewProductId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/inventory", {
        params: { searchParam: search || undefined, pageNumber: 1 }
      });
      setItems(Array.isArray(data?.inventory) ? data.inventory : []);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    load();
  }, [load]);

  const selectedProducts = useMemo(
    () => items.filter((i) => linkedSet.has(Number(i.id))),
    [items, linkedSet]
  );

  // Mantém o preview apontando para um produto ainda selecionado
  useEffect(() => {
    if (!linkedIds.length) {
      setPreviewProductId(null);
      return;
    }
    if (previewProductId == null || !linkedSet.has(Number(previewProductId))) {
      setPreviewProductId(linkedIds[0]);
    }
  }, [linkedIds, linkedSet, previewProductId]);

  const previewProduct = useMemo(() => {
    if (!linkedIds.length) return null;
    const id = Number(previewProductId) || linkedIds[0];
    return (
      selectedProducts.find((p) => Number(p.id) === id) ||
      items.find((p) => Number(p.id) === id) ||
      selectedProducts[0] ||
      null
    );
  }, [linkedIds, previewProductId, selectedProducts, items]);

  const previewDraft = useMemo(() => {
    if (useSameMessage) return normalizeReply(sharedDraft);
    if (!previewProduct) return normalizeReply(sharedDraft || reply);
    return normalizeReply(
      drafts[String(previewProduct.id)] || DEFAULT_REPLY
    );
  }, [useSameMessage, sharedDraft, previewProduct, drafts, reply]);

  const previewText = useMemo(
    () => buildInventoryWhatsAppPreview(previewDraft, previewProduct),
    [previewDraft, previewProduct]
  );

  // Hidrata drafts só para produtos novos na seleção (não apaga edições em andamento)
  useEffect(() => {
    setDrafts((prev) => {
      const next = { ...prev };
      let changed = false;
      linkedIds.forEach((id) => {
        const key = String(id);
        if (next[key]) return;
        const override = productReplies[key] || productReplies[id];
        const item = items.find((i) => Number(i.id) === id);
        next[key] = normalizeReply(
          override || item?.replySettings || inventory?.reply || DEFAULT_REPLY
        );
        changed = true;
      });
      Object.keys(next).forEach((key) => {
        if (!linkedSet.has(Number(key))) {
          delete next[key];
          changed = true;
        }
      });
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedIds.join(","), items.length]);

  useEffect(() => {
    if (inventory?.useSameMessage === true) {
      setUseSameMessage(true);
    }
    if (inventory?.reply && typeof inventory.reply === "object") {
      setSharedDraft((prev) => {
        // Só sincroniza se ainda estiver no default / vazio de edição inicial
        if (prev?.template && prev.template !== DEFAULT_REPLY.template) return prev;
        return normalizeReply(inventory.reply);
      });
    }
  }, [inventory?.useSameMessage, inventory?.reply]);

  const patch = (partial) => {
    onChange({
      enabled,
      productIds: linkedIds,
      reply,
      productReplies,
      useSameMessage,
      ...partial
    });
  };

  const toggleProduct = (id) => {
    const n = Number(id);
    if (!Number.isFinite(n)) return;
    const next = new Set(linkedSet);
    if (next.has(n)) next.delete(n);
    else next.add(n);
    const ids = Array.from(next);
    patch({ productIds: ids });
  };

  const toggleSelectAllVisible = (selectAll) => {
    const visible = items
      .map((i) => Number(i.id))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (selectAll) {
      patch({ productIds: Array.from(new Set([...linkedIds, ...visible])) });
    } else {
      const drop = new Set(visible);
      patch({ productIds: linkedIds.filter((id) => !drop.has(id)) });
    }
  };

  const allVisibleSelected =
    items.length > 0 && items.every((i) => linkedSet.has(Number(i.id)));
  const someVisibleSelected = items.some((i) => linkedSet.has(Number(i.id)));

  const updateDraft = (id, value) => {
    setDrafts((prev) => ({ ...prev, [String(id)]: normalizeReply(value) }));
    setJustSaved(false);
  };

  const handleToggleSameMessage = (checked) => {
    setUseSameMessage(checked);
    setJustSaved(false);
    if (checked) {
      const firstId = linkedIds[0];
      const first =
        (firstId != null && drafts[String(firstId)]) ||
        sharedDraft ||
        reply;
      setSharedDraft(normalizeReply(first));
    }
  };

  const handleSave = () => {
    setSaving(true);
    try {
      if (!linkedIds.length) {
        patch({
          productIds: [],
          productReplies: {},
          reply: sharedDraft,
          useSameMessage
        });
        toast.success("Nenhum produto selecionado");
        setJustSaved(true);
        return;
      }

      if (useSameMessage) {
        const payload = normalizeReply(sharedDraft);
        patch({
          productIds: linkedIds,
          reply: payload,
          productReplies: {},
          useSameMessage: true
        });
        toast.success("Mesma mensagem aplicada a todos — salve o agente");
      } else {
        const nextReplies = {};
        linkedIds.forEach((id) => {
          nextReplies[String(id)] = normalizeReply(
            drafts[String(id)] || DEFAULT_REPLY
          );
        });
        // Mantém overrides só dos produtos selecionados
        patch({
          productIds: linkedIds,
          productReplies: nextReplies,
          reply: normalizeReply(sharedDraft || reply),
          useSameMessage: false
        });
        toast.success("Mensagens por produto atualizadas — salve o agente");
      }
      setJustSaved(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box className={classes.root}>
      <Box className={classes.hero}>
        <Box>
          <Typography className={classes.heroTitle} component="h2">
            Inventário
          </Typography>
          <Typography className={classes.heroSub}>
            Escolha os produtos do agente e defina como ele responde sobre cada um.
          </Typography>
          <Box className={classes.steps}>
            <span>1. Selecionar</span>
            <span className={classes.stepDot} />
            <span>2. Personalizar</span>
            <span className={classes.stepDot} />
            <span>3. Salvar</span>
          </Box>
        </Box>
        <Box display="flex" alignItems="center" style={{ gap: 10 }}>
          <Typography style={{ fontSize: 13, fontWeight: 500 }}>Ativo</Typography>
          <Switch
            className={classes.switchAccent}
            color="primary"
            checked={enabled}
            onChange={(e) => {
              const nextEnabled = e.target.checked;
              patch({ enabled: nextEnabled });
              if (nextEnabled && typeof onEnsureProductActions === "function") {
                onEnsureProductActions();
              }
            }}
          />
        </Box>
      </Box>

      <Box
        className={classes.split}
        style={{ opacity: enabled ? 1 : 0.55, pointerEvents: enabled ? "auto" : "none" }}
      >
        {/* Produtos */}
        <Box className={classes.panel}>
          <Box className={classes.panelHead}>
            <Box className={classes.panelTitle}>
              <Package size={15} /> Produtos
            </Box>
            <span className={classes.count}>{linkedIds.length}</span>
          </Box>
          <Box className={classes.panelBody}>
            <TextField
              className={classes.search}
              size="small"
              variant="outlined"
              placeholder="Buscar produtos…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load()}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <Button
                      className={classes.ghostBtn}
                      size="small"
                      onClick={load}
                      disabled={loading}
                    >
                      Buscar
                    </Button>
                  </InputAdornment>
                )
              }}
            />

            <Box className={classes.selectAllRow}>
              <Checkbox
                color="primary"
                size="small"
                indeterminate={someVisibleSelected && !allVisibleSelected}
                checked={allVisibleSelected}
                onChange={() => toggleSelectAllVisible(!allVisibleSelected)}
                disabled={!items.length}
              />
              <Typography
                className={classes.selectAllLabel}
                onClick={() => items.length && toggleSelectAllVisible(!allVisibleSelected)}
              >
                Selecionar todos
              </Typography>
              <Box flex={1} />
              {linkedIds.length > 0 && (
                <Button
                  className={classes.ghostBtn}
                  size="small"
                  onClick={() => patch({ productIds: [] })}
                >
                  Limpar
                </Button>
              )}
            </Box>

            {loading ? (
              <Box className={classes.empty}>
                <CircularProgress size={22} />
              </Box>
            ) : !items.length ? (
              <Box className={classes.empty}>
                <Typography className={classes.emptyTitle}>Nenhum produto</Typography>
                <Typography className={classes.emptyHint}>
                  Cadastre produtos no Inventário para usá-los no agente.
                </Typography>
              </Box>
            ) : (
              <Box className={classes.productList}>
                {items.map((item) => {
                  const id = Number(item.id);
                  const checked = linkedSet.has(id);
                  return (
                    <Box
                      key={id}
                      className={`${classes.productRow} ${
                        checked ? classes.productSelected : ""
                      }`}
                      onClick={() => toggleProduct(id)}
                      role="checkbox"
                      aria-checked={checked}
                    >
                      <Checkbox
                        color="primary"
                        size="small"
                        checked={checked}
                        onChange={() => toggleProduct(id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      {item.image ? (
                        <img src={item.image} alt="" className={classes.thumb} />
                      ) : (
                        <Box className={classes.thumb} />
                      )}
                      <Box minWidth={0}>
                        <div className={classes.productName}>{item.name}</div>
                        <div className={classes.productSub}>
                          {formatPrice(item.price, item.currency)}
                          {item.sku ? ` · ${item.sku}` : ""}
                        </div>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            )}
          </Box>
        </Box>

        {/* Como responder */}
        <Box className={classes.panel}>
          <Box className={classes.panelHead}>
            <Box className={classes.panelTitle}>
              <MessageSquare size={15} /> Como responder
            </Box>
            {linkedIds.length > 0 && (
              <span className={classes.count}>
                {useSameMessage ? "1 msg" : `${linkedIds.length}`}
              </span>
            )}
          </Box>
          <Box className={classes.panelBody}>
            {!linkedIds.length ? (
              <Box className={classes.empty}>
                <Package size={28} strokeWidth={1.5} />
                <Typography className={classes.emptyTitle}>
                  Selecione produtos à esquerda
                </Typography>
                <Typography className={classes.emptyHint}>
                  Depois personalize a mensagem de cada um aqui.
                </Typography>
              </Box>
            ) : (
              <>
                <Box
                  className={`${classes.sameToggle} ${
                    useSameMessage ? classes.sameToggleOn : ""
                  }`}
                >
                  <Box className={classes.sameToggleText}>
                    <Copy size={16} style={{ marginTop: 2, flexShrink: 0 }} />
                    <Box>
                      <div className={classes.sameTitle}>
                        Usar a mesma mensagem para todos os produtos
                      </div>
                      <div className={classes.sameHint}>
                        Uma única resposta vale para todos os selecionados.
                      </div>
                    </Box>
                  </Box>
                  <Switch
                    className={classes.switchAccent}
                    color="primary"
                    checked={useSameMessage}
                    onChange={(e) => handleToggleSameMessage(e.target.checked)}
                  />
                </Box>

                <Box className={classes.replyScroll}>
                  {useSameMessage ? (
                    <ProductMessageEditor
                      classes={classes}
                      title={`Mensagem única · ${linkedIds.length} produto${
                        linkedIds.length === 1 ? "" : "s"
                      }`}
                      thumb={selectedProducts[0]?.image || ""}
                      value={sharedDraft}
                      onChange={(v) => {
                        setSharedDraft(normalizeReply(v));
                        setJustSaved(false);
                      }}
                      expanded={sharedExpanded}
                      onToggleExpanded={() => setSharedExpanded((v) => !v)}
                      active
                    />
                  ) : (
                    selectedProducts.map((item) => {
                      const id = Number(item.id);
                      const key = String(id);
                      return (
                        <ProductMessageEditor
                          key={id}
                          classes={classes}
                          title={item.name}
                          thumb={item.image || ""}
                          value={drafts[key] || DEFAULT_REPLY}
                          onChange={(v) => updateDraft(id, v)}
                          expanded={!!expandedIds[key]}
                          onToggleExpanded={() =>
                            setExpandedIds((prev) => ({
                              ...prev,
                              [key]: !prev[key]
                            }))
                          }
                          active={Number(previewProductId) === id}
                          onActivate={() => setPreviewProductId(id)}
                        />
                      );
                    })
                  )}

                  {/* Produtos selecionados que ainda não carregaram na lista (ex.: busca filtrada) */}
                  {!useSameMessage &&
                    linkedIds
                      .filter((id) => !selectedProducts.some((p) => Number(p.id) === id))
                      .map((id) => (
                        <ProductMessageEditor
                          key={id}
                          classes={classes}
                          title={`Produto #${id}`}
                          thumb=""
                          value={drafts[String(id)] || DEFAULT_REPLY}
                          onChange={(v) => updateDraft(id, v)}
                          expanded={!!expandedIds[String(id)]}
                          onToggleExpanded={() =>
                            setExpandedIds((prev) => ({
                              ...prev,
                              [String(id)]: !prev[String(id)]
                            }))
                          }
                          active={Number(previewProductId) === id}
                          onActivate={() => setPreviewProductId(id)}
                        />
                      ))}
                </Box>

                <Box className={classes.footer}>
                  {justSaved ? (
                    <span className={classes.savedFlash}>Salvo neste agente</span>
                  ) : (
                    <span className={classes.footerHint}>
                      Em seguida, salve o agente no topo da página.
                    </span>
                  )}
                  <Button
                    className={classes.primaryBtn}
                    onClick={handleSave}
                    disabled={saving || !enabled}
                  >
                    {saving ? "Salvando…" : "Salvar mensagens"}
                  </Button>
                </Box>
              </>
            )}
          </Box>
        </Box>

        {/* Preview WhatsApp */}
        <Box className={`${classes.panel} ${classes.previewCol}`}>
          <Box className={classes.panelHead}>
            <Box className={classes.panelTitle}>Preview</Box>
            <span className={classes.count}>WhatsApp</span>
          </Box>
          <Box className={classes.previewPanelBody}>
            {!linkedIds.length ? (
              <Box className={classes.empty}>
                <Typography className={classes.emptyTitle}>Sem preview</Typography>
                <Typography className={classes.emptyHint}>
                  Selecione um produto para ver como a mensagem aparece.
                </Typography>
              </Box>
            ) : (
              <>
                {selectedProducts.length > 1 && (
                  <Box className={classes.previewProductPick}>
                    {selectedProducts.map((p) => {
                      const id = Number(p.id);
                      const active = Number(previewProductId) === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          className={`${classes.previewChip} ${
                            active ? classes.previewChipActive : ""
                          }`}
                          onClick={() => setPreviewProductId(id)}
                          title={p.name}
                        >
                          {p.name}
                        </button>
                      );
                    })}
                  </Box>
                )}
                <WhatsAppIphonePreview
                  message={previewText}
                  agentName="Seu agente"
                  contactName="Cliente"
                  avatarUrl={previewProduct?.image || ""}
                  showImages={!!previewDraft.sendImages}
                  showDocument={!!previewDraft.sendDocument}
                  label={
                    previewProduct?.name
                      ? `Como fica · ${previewProduct.name}`
                      : "Como a mensagem aparece"
                  }
                />
              </>
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
