/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  IconButton,
  makeStyles,
} from "@material-ui/core";
import DeleteIcon from "@material-ui/icons/Delete";
import AddIcon from "@material-ui/icons/Add";
import ArrowUpwardIcon from "@material-ui/icons/ArrowUpward";
import ArrowDownwardIcon from "@material-ui/icons/ArrowDownward";
import leadPipelinesService from "../../services/leadPipelinesService";
import toastError from "../../errors/toastError";
import { toast } from "react-toastify";
import { PIPELINE_ESTAGIOS } from "../../constants/pipelineCrm";

const useStyles = makeStyles(() => ({
  row: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    marginBottom: 8,
  },
  color: {
    width: 36,
    height: 36,
    border: "1px solid #e2e6ee",
    borderRadius: 8,
    padding: 2,
  },
}));

const PipelineEstagiosDialog = ({ open, onClose, pipeline, onSaved }) => {
  const classes = useStyles();
  const [name, setName] = useState("CRM Pipeline");
  const [stages, setStages] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(pipeline?.name || "CRM Pipeline");
    const st = (pipeline?.stages || []).map((s, i) => ({
      id: s.id,
      key: s.key || s.status || `etapa_${i + 1}`,
      label: s.label || s.name || s.key,
      color: s.color || PIPELINE_ESTAGIOS.find((e) => e.id === s.key)?.color || "#3B82F6",
      order: s.order || i + 1,
    }));
    setStages(
      st.length
        ? st
        : PIPELINE_ESTAGIOS.map((e, i) => ({
            key: e.id,
            label: e.title,
            color: e.color,
            order: i + 1,
          }))
    );
  }, [open, pipeline]);

  const move = (index, dir) => {
    const next = [...stages];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    const tmp = next[index];
    next[index] = next[target];
    next[target] = tmp;
    setStages(next.map((s, i) => ({ ...s, order: i + 1 })));
  };

  const addStage = () => {
    setStages((prev) => [
      ...prev,
      {
        key: `etapa_${Date.now()}`,
        label: "Nova etapa",
        color: "#3B82F6",
        order: prev.length + 1,
      },
    ]);
  };

  const removeStage = (index) => {
    setStages((prev) => prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, order: i + 1 })));
  };

  const handleSave = async () => {
    if (!stages.length) {
      toast.error("Inclua ao menos uma etapa");
      return;
    }
    setSaving(true);
    try {
      const all = await leadPipelinesService.list();
      const list = Array.isArray(all) ? all : all.pipelines || [];
      const others = list
        .filter((p) => String(p.id) !== String(pipeline?.id))
        .map((p) => ({
          id: p.id,
          name: p.name,
          stages: (p.stages || []).map((s, i) => ({
            id: s.id,
            key: s.key,
            label: s.label || s.name,
            color: s.color || "#3B82F6",
            order: s.order || i + 1,
          })),
        }));
      const current = {
        id: pipeline?.id,
        name: name.trim() || "CRM Pipeline",
        stages: stages.map((s, i) => ({
          id: s.id,
          key: String(s.key || `etapa_${i + 1}`)
            .toLowerCase()
            .replace(/\s+/g, "_"),
          label: s.label || "Etapa",
          color: s.color || "#3B82F6",
          order: i + 1,
        })),
      };
      await leadPipelinesService.bulkSave([...others, current]);
      toast.success("Pipeline atualizado");
      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Editar pipeline</DialogTitle>
      <DialogContent dividers>
        <TextField
          label="Nome do pipeline"
          value={name}
          onChange={(e) => setName(e.target.value)}
          fullWidth
          size="small"
          variant="outlined"
          style={{ marginBottom: 16 }}
        />
        {stages.map((s, index) => (
          <div key={`${s.key}-${index}`} className={classes.row}>
            <input
              type="color"
              className={classes.color}
              value={s.color || "#3B82F6"}
              onChange={(e) => {
                const next = [...stages];
                next[index] = { ...next[index], color: e.target.value };
                setStages(next);
              }}
            />
            <TextField
              value={s.label}
              onChange={(e) => {
                const next = [...stages];
                next[index] = { ...next[index], label: e.target.value };
                setStages(next);
              }}
              fullWidth
              size="small"
              variant="outlined"
              placeholder="Nome da etapa"
            />
            <IconButton size="small" onClick={() => move(index, -1)} disabled={index === 0}>
              <ArrowUpwardIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => move(index, 1)}
              disabled={index === stages.length - 1}
            >
              <ArrowDownwardIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" onClick={() => removeStage(index)} disabled={stages.length <= 1}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </div>
        ))}
        <Button startIcon={<AddIcon />} onClick={addStage} size="small" style={{ marginTop: 8 }}>
          Adicionar etapa
        </Button>
        <Button
          size="small"
          style={{ marginLeft: 8, marginTop: 8 }}
          onClick={() =>
            setStages(
              PIPELINE_ESTAGIOS.map((e, i) => ({
                key: e.id,
                label: e.title,
                color: e.color,
                order: i + 1,
              }))
            )
          }
        >
          Restaurar etapas padrão
        </Button>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button color="primary" variant="contained" onClick={handleSave} disabled={saving}>
          Salvar
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PipelineEstagiosDialog;
