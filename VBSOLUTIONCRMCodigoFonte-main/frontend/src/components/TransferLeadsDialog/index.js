/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 */

import React, { useMemo, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Typography,
} from "@material-ui/core";
import leadsSalesService from "../../services/leadsSalesService";
import toastError from "../../errors/toastError";
import { toast } from "react-toastify";

const TransferLeadsDialog = ({ open, onClose, leads = [], users = [], onDone }) => {
  const [fromId, setFromId] = useState("__all__");
  const [toId, setToId] = useState("");
  const [saving, setSaving] = useState(false);

  const candidates = useMemo(() => {
    if (fromId === "__all__") return leads;
    if (fromId === "__none__") return leads.filter((l) => !l.responsibleId);
    return leads.filter((l) => String(l.responsibleId) === String(fromId));
  }, [leads, fromId]);

  const handleTransfer = async () => {
    if (!toId) {
      toast.error("Selecione o corretor de destino");
      return;
    }
    if (!candidates.length) {
      toast.info("Nenhum lead para transferir com esse filtro");
      return;
    }
    setSaving(true);
    try {
      let ok = 0;
      for (const lead of candidates) {
        await leadsSalesService.update(lead.id, { responsibleId: Number(toId) });
        ok += 1;
      }
      toast.success(`${ok} lead(s) transferido(s)`);
      if (onDone) onDone();
      onClose();
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Transferência de Leads</DialogTitle>
      <DialogContent dividers>
        <TextField
          select
          label="De (origem)"
          value={fromId}
          onChange={(e) => setFromId(e.target.value)}
          fullWidth
          size="small"
          variant="outlined"
          style={{ marginBottom: 12 }}
        >
          <MenuItem value="__all__">Todos os leads filtrados</MenuItem>
          <MenuItem value="__none__">Sem corretor</MenuItem>
          {users.map((u) => (
            <MenuItem key={u.id} value={String(u.id)}>
              {u.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Para (destino)"
          value={toId}
          onChange={(e) => setToId(e.target.value)}
          fullWidth
          size="small"
          variant="outlined"
        >
          <MenuItem value="">Selecione</MenuItem>
          {users.map((u) => (
            <MenuItem key={u.id} value={String(u.id)}>
              {u.name}
            </MenuItem>
          ))}
        </TextField>
        <Typography variant="body2" style={{ marginTop: 12, opacity: 0.75 }}>
          {candidates.length} lead(s) serão transferidos.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button color="primary" variant="contained" onClick={handleTransfer} disabled={saving}>
          Transferir
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TransferLeadsDialog;
