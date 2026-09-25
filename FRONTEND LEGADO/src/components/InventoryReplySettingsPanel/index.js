import React, { useMemo, useState } from "react";
import { Box, Switch, TextField, Typography, InputAdornment, Button } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import { FileText, Sparkles, Type, ChevronDown, ChevronUp } from "lucide-react";

export const INVENTORY_REPLY_DEFAULT = {
  tone: "consultivo",
  strategyPreset: "price_first",
  template: "O *{{nome}}* custa {{preco}}{{estoque_frase}}{{promo_frase}}{{parcelamento_frase}}.{{link_frase}}",
  includePrice: true,
  includeStock: true,
  includeLink: true,
  includeDescription: false,
  includeSku: false,
  includePromo: false,
  promoText: "",
  includeInstallment: false,
  installmentText: "",
  sendImages: false,
  imageMode: "none",
  imageCount: 3,
  sendDocument: false,
  documentUrl: "",
  documentName: "",
  resumeHint: true,
  resumeHintText: "Quando quiser, seguimos de onde paramos."
};

export const INVENTORY_STRATEGY_PRESETS = [
  {
    id: "price_first",
    label: "Preço primeiro",
    hint: "Valor + disponibilidade",
    template: "O *{{nome}}* custa {{preco}}{{estoque_frase}}.{{link_frase}}"
  },
  {
    id: "benefit_then_price",
    label: "Benefício → preço",
    hint: "Contexto antes do valor",
    template:
      "{{descricao_ou_nome}}\n\nInvestimento: {{preco}}{{estoque_frase}}.{{link_frase}}"
  },
  {
    id: "scarcity",
    label: "Escassez suave",
    hint: "Estoque com naturalidade",
    template: "Sobre o *{{nome}}*: está {{estoque_status}} por {{preco}}.{{link_frase}}"
  },
  {
    id: "link_cta",
    label: "CTA com link",
    hint: "Convite à compra",
    template:
      "*{{nome}}* — {{preco}}{{estoque_frase}}.\n\nSe quiser, pode comprar por aqui: {{link}}"
  },
  {
    id: "catalog_brief",
    label: "Catálogo breve",
    hint: "Lista enxuta",
    template: "{{catalogo}}"
  },
  {
    id: "custom",
    label: "Personalizado",
    hint: "Seu template",
    template: ""
  }
];

const TONE_OPTIONS = [
  { id: "formal", label: "Formal" },
  { id: "consultivo", label: "Consultivo" },
  { id: "amigavel", label: "Amigável" },
  { id: "direto", label: "Direto" }
];

const IMAGE_MODES = [
  { id: "cover", label: "Só capa" },
  { id: "gallery", label: "Galeria" },
  { id: "first_n", label: "Primeiras N" }
];

const PLACEHOLDERS = [
  "{{nome}}",
  "{{preco}}",
  "{{estoque}}",
  "{{estoque_frase}}",
  "{{promo_frase}}",
  "{{parcelamento_frase}}",
  "{{link}}",
  "{{link_frase}}",
  "{{descricao}}",
  "{{sku}}"
];

const useStyles = makeStyles((theme) => {
  const isDark = theme.palette.type === "dark";
  const ink = isDark ? "rgba(255,255,255,0.92)" : "#1d1d1f";
  const muted = isDark ? "rgba(255,255,255,0.55)" : "#86868b";
  const hairline = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";
  const surfaceSolid = isDark ? "#1c1c1e" : "#ffffff";
  const accent = isDark ? "#0a84ff" : "#0071e3";
  return {
    wrap: {
      display: "flex",
      flexDirection: "column",
      gap: 14,
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      color: ink
    },
    fieldLabel: {
      fontSize: 12,
      fontWeight: 600,
      color: muted,
      letterSpacing: "-0.01em",
      marginBottom: 8
    },
    segment: {
      display: "inline-flex",
      padding: 3,
      borderRadius: 12,
      background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
      gap: 2,
      flexWrap: "wrap"
    },
    segmentBtn: {
      border: "none",
      background: "transparent",
      color: muted,
      fontSize: 12.5,
      fontWeight: 500,
      padding: "7px 12px",
      borderRadius: 10,
      cursor: "pointer",
      fontFamily: "inherit",
      "&$active": {
        background: surfaceSolid,
        color: ink,
        boxShadow: isDark ? "0 1px 3px rgba(0,0,0,0.4)" : "0 1px 3px rgba(0,0,0,0.08)"
      }
    },
    active: {},
    strategyGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
      gap: 8
    },
    strategyCard: {
      border: `1px solid ${hairline}`,
      borderRadius: 12,
      padding: "10px 12px",
      cursor: "pointer",
      background: "transparent",
      textAlign: "left",
      fontFamily: "inherit",
      color: ink,
      "&$active": {
        borderColor: accent,
        background: isDark ? "rgba(10,132,255,0.12)" : "rgba(0,113,227,0.06)"
      }
    },
    strategyLabel: { fontSize: 12.5, fontWeight: 600 },
    strategyHint: { marginTop: 3, fontSize: 10.5, color: muted },
    templateInput: {
      "& .MuiOutlinedInput-root": {
        borderRadius: 12,
        fontSize: 13,
        background: isDark ? "rgba(0,0,0,0.22)" : "rgba(255,255,255,0.95)"
      }
    },
    chips: { display: "flex", flexWrap: "wrap", gap: 6 },
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
    toggleRow: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      padding: "8px 0",
      borderBottom: `1px solid ${hairline}`,
      "&:last-child": { borderBottom: "none" }
    },
    toggleLabel: { fontSize: 13, fontWeight: 500 },
    toggleHint: { fontSize: 11, color: muted, marginTop: 2 },
    preview: {
      borderRadius: 12,
      padding: 12,
      background: isDark ? "rgba(0,0,0,0.28)" : "#f5f5f7",
      whiteSpace: "pre-wrap",
      fontSize: 13,
      lineHeight: 1.45,
      minHeight: 56
    },
    switchAccent: {
      "& .Mui-checked": { color: accent },
      "& .Mui-checked + .MuiSwitch-track": { backgroundColor: accent }
    },
    pill: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      fontSize: 11,
      fontWeight: 600,
      color: accent
    }
  };
});

function buildPreview(reply) {
  const r = { ...INVENTORY_REPLY_DEFAULT, ...(reply || {}) };
  const promoFrase =
    r.includePromo && String(r.promoText || "").trim()
      ? ` (${String(r.promoText).trim()})`
      : "";
  const parcelFrase =
    r.includeInstallment && String(r.installmentText || "").trim()
      ? ` — ${String(r.installmentText).trim()}`
      : "";
  const sample = {
    nome: "VBSolution CRM",
    preco: "R$ 149,90",
    estoque: "8",
    estoque_status: "8 unidades disponíveis",
    estoque_frase: r.includeStock ? " e temos 8 unidades disponíveis" : "",
    promo_frase: promoFrase,
    parcelamento_frase: parcelFrase,
    link: "https://exemplo.com/comprar",
    link_frase: r.includeLink
      ? "\n\nSe quiser, você pode realizar a compra por aqui: https://exemplo.com/comprar"
      : "",
    descricao: "CRM completo para atendimento e vendas.",
    descricao_ou_nome: "CRM completo para atendimento e vendas.\n\n*VBSolution CRM*",
    sku: "VBS-001",
    catalogo: "1. *VBSolution CRM* — R$ 149,90 — 8 unidades disponíveis"
  };
  let tpl =
    r.strategyPreset === "custom"
      ? r.template || INVENTORY_STRATEGY_PRESETS[0].template
      : INVENTORY_STRATEGY_PRESETS.find((p) => p.id === r.strategyPreset)?.template ||
        r.template ||
        INVENTORY_STRATEGY_PRESETS[0].template;
  Object.entries(sample).forEach(([k, v]) => {
    tpl = tpl.replace(new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, "gi"), v);
  });
  tpl = tpl.replace(/\{\{[a-z0-9_]+\}\}/gi, "").trim();
  if (r.resumeHint) tpl = `${tpl}\n\n${r.resumeHintText || INVENTORY_REPLY_DEFAULT.resumeHintText}`;
  return tpl;
}

/**
 * Painel reutilizável de personalização de resposta do inventário.
 */
export default function InventoryReplySettingsPanel({
  value,
  onChange,
  compact = false,
  showPreview = true,
  hideTemplate = false,
  title = "Personalização da resposta"
}) {
  const classes = useStyles();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const reply = useMemo(
    () => ({ ...INVENTORY_REPLY_DEFAULT, ...(value || {}) }),
    [value]
  );

  const patch = (partial) => onChange({ ...reply, ...partial });

  const insertPlaceholder = (token) => {
    const base = reply.template || "";
    patch({
      strategyPreset: "custom",
      template: `${base}${base && !base.endsWith(" ") ? " " : ""}${token}`
    });
  };

  const mainToggles = [
    { key: "includePrice", label: "Preço", hint: "Valor formatado" },
    {
      key: "includeStock",
      label: "Mostrar quantidade em estoque",
      hint: "Desligue para não citar unidades disponíveis"
    },
    { key: "includeLink", label: "Link", hint: "Compra" },
    { key: "resumeHint", label: "Retomar roteiro", hint: "Frase ao final" }
  ];

  const advancedToggles = [
    { key: "includeDescription", label: "Descrição", hint: "Texto do cadastro" },
    { key: "includeSku", label: "SKU", hint: "Código" }
  ];

  return (
    <Box className={classes.wrap}>
      {!compact && (
        <Typography className={classes.pill}>
          <Sparkles size={12} /> {title}
        </Typography>
      )}

      <Box>
        <Typography className={classes.fieldLabel}>Tom</Typography>
        <Box className={classes.segment}>
          {TONE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={`${classes.segmentBtn} ${reply.tone === opt.id ? classes.active : ""}`}
              onClick={() => patch({ tone: opt.id })}
            >
              {opt.label}
            </button>
          ))}
        </Box>
      </Box>

      <Box>
        <Typography className={classes.fieldLabel}>Estratégia</Typography>
        <Box className={classes.strategyGrid}>
          {INVENTORY_STRATEGY_PRESETS.filter((p) =>
            compact ? ["price_first", "benefit_then_price", "link_cta", "custom"].includes(p.id) : true
          ).map((p) => (
            <button
              key={p.id}
              type="button"
              className={`${classes.strategyCard} ${
                reply.strategyPreset === p.id ? classes.active : ""
              }`}
              onClick={() =>
                patch({
                  strategyPreset: p.id,
                  template: p.id === "custom" ? reply.template || p.template : p.template
                })
              }
            >
              <div className={classes.strategyLabel}>{p.label}</div>
              <div className={classes.strategyHint}>{p.hint}</div>
            </button>
          ))}
        </Box>
      </Box>

      {!hideTemplate && (
        <Box>
          <Typography className={classes.fieldLabel}>
            <Type size={11} style={{ marginRight: 4, verticalAlign: -1 }} />
            Template
          </Typography>
          <TextField
            className={classes.templateInput}
            fullWidth
            multiline
            minRows={compact ? 3 : 4}
            variant="outlined"
            value={reply.template || ""}
            onChange={(e) => patch({ strategyPreset: "custom", template: e.target.value })}
            placeholder="O *{{nome}}* custa {{preco}}…"
          />
          <Box className={classes.chips} mt={1}>
            {PLACEHOLDERS.map((ph) => (
              <button key={ph} type="button" className={classes.chip} onClick={() => insertPlaceholder(ph)}>
                {ph}
              </button>
            ))}
          </Box>
        </Box>
      )}

      <Box>
        {mainToggles.map((row) => (
          <Box key={row.key} className={classes.toggleRow}>
            <Box>
              <div className={classes.toggleLabel}>{row.label}</div>
              <div className={classes.toggleHint}>{row.hint}</div>
            </Box>
            <Switch
              className={classes.switchAccent}
              color="primary"
              checked={!!reply[row.key]}
              onChange={(e) => patch({ [row.key]: e.target.checked })}
            />
          </Box>
        ))}
      </Box>

      <Box className={classes.toggleRow}>
        <Box>
          <div className={classes.toggleLabel}>Promoção</div>
          <div className={classes.toggleHint}>Ex.: 30% off, frete grátis</div>
        </Box>
        <Switch
          className={classes.switchAccent}
          color="primary"
          checked={!!reply.includePromo}
          onChange={(e) => patch({ includePromo: e.target.checked })}
        />
      </Box>
      {reply.includePromo && (
        <TextField
          className={classes.templateInput}
          fullWidth
          size="small"
          variant="outlined"
          label="Texto da promoção"
          placeholder="30% off até sexta"
          value={reply.promoText || ""}
          onChange={(e) => patch({ promoText: e.target.value })}
        />
      )}

      <Box className={classes.toggleRow}>
        <Box>
          <div className={classes.toggleLabel}>Parcelamento</div>
          <div className={classes.toggleHint}>Ex.: em até 12x sem juros</div>
        </Box>
        <Switch
          className={classes.switchAccent}
          color="primary"
          checked={!!reply.includeInstallment}
          onChange={(e) => patch({ includeInstallment: e.target.checked })}
        />
      </Box>
      {reply.includeInstallment && (
        <TextField
          className={classes.templateInput}
          fullWidth
          size="small"
          variant="outlined"
          label="Condição de parcelamento"
          placeholder="em até 12x sem juros"
          value={reply.installmentText || ""}
          onChange={(e) => patch({ installmentText: e.target.value })}
        />
      )}

      {reply.resumeHint && (
        <TextField
          className={classes.templateInput}
          fullWidth
          size="small"
          variant="outlined"
          label="Frase de retomada"
          value={reply.resumeHintText || ""}
          onChange={(e) => patch({ resumeHintText: e.target.value })}
        />
      )}

      <Box className={classes.toggleRow}>
        <Box>
          <div className={classes.toggleLabel}>Enviar imagens</div>
          <div className={classes.toggleHint}>Capa ou galeria</div>
        </Box>
        <Switch
          className={classes.switchAccent}
          color="primary"
          checked={!!reply.sendImages}
          onChange={(e) =>
            patch({
              sendImages: e.target.checked,
              imageMode: e.target.checked
                ? reply.imageMode === "none"
                  ? "cover"
                  : reply.imageMode
                : "none"
            })
          }
        />
      </Box>

      {reply.sendImages && (
        <>
          <Box className={classes.segment}>
            {IMAGE_MODES.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`${classes.segmentBtn} ${
                  reply.imageMode === opt.id ? classes.active : ""
                }`}
                onClick={() => patch({ imageMode: opt.id })}
              >
                {opt.label}
              </button>
            ))}
          </Box>
          {reply.imageMode === "first_n" && (
            <TextField
              className={classes.templateInput}
              type="number"
              size="small"
              variant="outlined"
              label="Qtd imagens (1–6)"
              value={reply.imageCount || 3}
              onChange={(e) =>
                patch({ imageCount: Math.min(6, Math.max(1, Number(e.target.value) || 1)) })
              }
              style={{ maxWidth: 160 }}
            />
          )}
        </>
      )}

      <Button
        size="small"
        onClick={() => setShowAdvanced((v) => !v)}
        style={{ textTransform: "none", alignSelf: "flex-start", fontWeight: 600 }}
        endIcon={showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      >
        {showAdvanced ? "Menos opções" : "Mais opções"}
      </Button>

      {showAdvanced && (
        <>
          {advancedToggles.map((row) => (
            <Box key={row.key} className={classes.toggleRow}>
              <Box>
                <div className={classes.toggleLabel}>{row.label}</div>
                <div className={classes.toggleHint}>{row.hint}</div>
              </Box>
              <Switch
                className={classes.switchAccent}
                color="primary"
                checked={!!reply[row.key]}
                onChange={(e) => patch({ [row.key]: e.target.checked })}
              />
            </Box>
          ))}

          <Box className={classes.toggleRow}>
            <Box>
              <div className={classes.toggleLabel}>Anexar documento</div>
              <div className={classes.toggleHint}>PDF / arquivo</div>
            </Box>
            <Switch
              className={classes.switchAccent}
              color="primary"
              checked={!!reply.sendDocument}
              onChange={(e) => patch({ sendDocument: e.target.checked })}
            />
          </Box>

          {reply.sendDocument && (
            <Box display="flex" flexDirection="column" style={{ gap: 8 }}>
              <TextField
                className={classes.templateInput}
                fullWidth
                size="small"
                variant="outlined"
                label="URL do documento"
                value={reply.documentUrl || ""}
                onChange={(e) => patch({ documentUrl: e.target.value })}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <FileText size={14} />
                    </InputAdornment>
                  )
                }}
              />
              <TextField
                className={classes.templateInput}
                fullWidth
                size="small"
                variant="outlined"
                label="Nome do arquivo"
                value={reply.documentName || ""}
                onChange={(e) => patch({ documentName: e.target.value })}
              />
            </Box>
          )}
        </>
      )}

      {showPreview && (
        <Box>
          <Typography className={classes.fieldLabel}>Prévia</Typography>
          <Box className={classes.preview}>{buildPreview(reply)}</Box>
        </Box>
      )}
    </Box>
  );
}
