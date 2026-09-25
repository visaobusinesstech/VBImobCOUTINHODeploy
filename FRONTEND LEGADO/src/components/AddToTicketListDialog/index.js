import React, { useCallback, useEffect, useState } from "react";
import {
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  TextField,
  Typography,
  makeStyles
} from "@material-ui/core";
import AddIcon from "@material-ui/icons/Add";
import ticketListsService from "../../services/ticketListsService";
import toastError from "../../errors/toastError";
import { toast } from "react-toastify";

const useStyles = makeStyles((theme) => ({
  listRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: theme.spacing(0.5, 0)
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    marginRight: 8,
    display: "inline-block"
  },
  chips: {
    display: "flex",
    flexWrap: "wrap",
    gap: 4,
    marginBottom: theme.spacing(1)
  },
  createRow: {
    display: "flex",
    gap: 8,
    marginTop: theme.spacing(1),
    alignItems: "center"
  }
}));

const AddToTicketListDialog = ({
  open,
  onClose,
  contactId,
  contactName,
  onSaved
}) => {
  const classes = useStyles();
  const [lists, setLists] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!contactId || !open) return;
    setLoading(true);
    try {
      const [allLists, contactLists] = await Promise.all([
        ticketListsService.list(),
        ticketListsService.listByContact(contactId)
      ]);
      setLists(Array.isArray(allLists) ? allLists : []);
      setSelectedIds(
        (Array.isArray(contactLists) ? contactLists : []).map((l) => Number(l.id))
      );
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, [contactId, open]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = (listId) => {
    const id = Number(listId);
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    if (!contactId) return;
    setSaving(true);
    try {
      const saved = await ticketListsService.syncContact(contactId, selectedIds);
      toast.success("Listas atualizadas");
      if (onSaved) onSaved(saved);
      onClose();
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const created = await ticketListsService.create({
        name: newName.trim(),
        color: "#6366F1"
      });
      setLists((prev) => [...prev, created]);
      setSelectedIds((prev) => [...prev, Number(created.id)]);
      setNewName("");
      toast.success("Lista criada");
    } catch (err) {
      toastError(err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>
        Adicionar à lista
        {contactName ? (
          <Typography variant="body2" color="textSecondary">
            {contactName}
          </Typography>
        ) : null}
      </DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <Box display="flex" justifyContent="center" py={3}>
            <CircularProgress size={28} />
          </Box>
        ) : (
          <>
            {selectedIds.length > 0 && (
              <Box className={classes.chips}>
                {lists
                  .filter((l) => selectedIds.includes(Number(l.id)))
                  .map((l) => (
                    <Chip
                      key={l.id}
                      size="small"
                      label={l.name}
                      onDelete={() => toggle(l.id)}
                      style={{
                        backgroundColor: l.color || "#6366F1",
                        color: "#fff"
                      }}
                    />
                  ))}
              </Box>
            )}
            {lists.map((list) => (
              <Box key={list.id} className={classes.listRow}>
                <FormControlLabel
                  control={
                    <Checkbox
                      color="primary"
                      checked={selectedIds.includes(Number(list.id))}
                      onChange={() => toggle(list.id)}
                    />
                  }
                  label={
                    <span>
                      <span
                        className={classes.colorDot}
                        style={{ backgroundColor: list.color || "#6366F1" }}
                      />
                      {list.name}
                    </span>
                  }
                />
              </Box>
            ))}
            <Box className={classes.createRow}>
              <TextField
                size="small"
                variant="outlined"
                fullWidth
                placeholder="Nova lista"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <Button
                size="small"
                variant="outlined"
                startIcon={<AddIcon />}
                disabled={creating || !newName.trim()}
                onClick={handleCreate}
              >
                Criar
              </Button>
            </Box>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          color="primary"
          variant="contained"
          disabled={saving || loading || !contactId}
          onClick={handleSave}
        >
          Salvar
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddToTicketListDialog;
