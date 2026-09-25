import React from "react";
import {
  Box,
  Button,
  CircularProgress,
  LinearProgress,
  TextField,
  Typography,
} from "@material-ui/core";
import { Flag } from "@material-ui/icons";
import { toast } from "react-toastify";
import { saveMetaAdsGoals } from "../../services/metaAdsService";
import { money, numFmt, pctFmt } from "./formatters";
import {
  GOAL_FIELDS,
  evaluateGoalStatus,
  goalStatusColor,
  progressPct,
} from "./metaAdsGoalUtils";

function formatValue(v, format, currency) {
  if (format === "money") return money(v, currency);
  if (format === "pct") return pctFmt(v, 1);
  if (format === "num") return numFmt(v, 2);
  return numFmt(v);
}

export default function MetaAdsGoalsSection({
  kpis,
  currency,
  palette,
  isDark,
  hideValues,
  goals,
  setGoals,
  loading,
  onGoalsSaved,
}) {
  const [saving, setSaving] = React.useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await saveMetaAdsGoals(goals);
      const next = res?.goals || goals;
      setGoals(next);
      onGoalsSaved?.(next);
      toast.success("Metas salvas.");
    } catch {
      toast.error("Não foi possível salvar as metas.");
    } finally {
      setSaving(false);
    }
  };

  const panelStyle = {
    borderRadius: 10,
    padding: 16,
    border: `1px solid ${palette.border}`,
    background: palette.card,
    boxShadow: palette.shadow,
  };

  if (loading) {
    return (
      <Box style={panelStyle} display="flex" justifyContent="center" py={3}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  return (
    <Box style={panelStyle}>
      <Box
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        mb={2}
        flexWrap="wrap"
        style={{ gap: 8 }}
      >
        <Box display="flex" alignItems="center" style={{ gap: 8 }}>
          <Flag style={{ color: palette.blue, fontSize: 20 }} />
          <Box>
            <Typography style={{ fontWeight: 700, fontSize: 15, color: palette.text }}>
              Metas do período
            </Typography>
            <Typography style={{ fontSize: 12, color: palette.sub }}>
              Defina objetivos — os indicadores na aba Meta Ads mudam de cor conforme o desempenho
            </Typography>
          </Box>
        </Box>
        <Button
          variant="contained"
          color="primary"
          size="small"
          onClick={handleSave}
          disabled={saving}
          style={{ textTransform: "none", fontWeight: 600, borderRadius: 8 }}
        >
          {saving ? <CircularProgress size={18} color="inherit" /> : "Salvar metas"}
        </Button>
      </Box>

      <Box
        display="grid"
        style={{
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: 12,
        }}
      >
        {GOAL_FIELDS.map((field) => {
          const actual =
            field.key === "purchases"
              ? Number(kpis?.caktoOrders || kpis?.metaPurchasesReported) || 0
              : Number(kpis?.[field.source]) || 0;
          const goal = Number(goals[field.key]) || 0;
          const pct = progressPct(actual, goal, field.inverse);
          const evalStatus = evaluateGoalStatus(actual, goal, { inverse: field.inverse });
          const barColor = goalStatusColor(evalStatus.status, palette, isDark);

          return (
            <Box
              key={field.key}
              style={{
                padding: 12,
                borderRadius: 8,
                border: `1px solid ${
                  evalStatus.status === "good"
                    ? palette.green
                    : evalStatus.status === "bad"
                      ? palette.red
                      : palette.border
                }`,
                background: isDark ? "rgba(255,255,255,0.02)" : "#FAFBFC",
              }}
            >
              <Typography
                style={{ fontSize: 11, fontWeight: 600, color: palette.sub, marginBottom: 6 }}
              >
                {field.label}
              </Typography>
              <Box display="flex" justifyContent="space-between" alignItems="baseline" mb={0.5}>
                <Typography style={{ fontSize: 13, fontWeight: 700, color: palette.text }}>
                  {hideValues ? "••••" : formatValue(actual, field.format, currency)}
                </Typography>
                <Typography style={{ fontSize: 10, color: palette.sub }}>atual</Typography>
              </Box>
              <TextField
                size="small"
                variant="outlined"
                placeholder="Meta do período"
                type="number"
                label="Meta"
                value={goals[field.key] ?? ""}
                onChange={(e) =>
                  setGoals((prev) => ({
                    ...prev,
                    [field.key]: e.target.value === "" ? "" : Number(e.target.value),
                  }))
                }
                style={{ marginTop: 4, marginBottom: 8 }}
                InputProps={{ style: { fontSize: 12, borderRadius: 6 } }}
                fullWidth
              />
              {goal > 0 ? (
                <>
                  <LinearProgress
                    variant="determinate"
                    value={pct}
                    style={{ height: 5, borderRadius: 4, background: palette.track }}
                  />
                  <Typography
                    style={{ fontSize: 10, color: barColor, marginTop: 4, fontWeight: 600 }}
                  >
                    {evalStatus.hint || `${pctFmt(pct, 0)}% da meta`}
                  </Typography>
                </>
              ) : (
                <Typography style={{ fontSize: 10, color: palette.sub }}>
                  Defina uma meta para acompanhar este indicador
                </Typography>
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
