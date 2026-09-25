import React, { useCallback, useEffect, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  TextField,
  Tooltip,
  Typography,
  makeStyles
} from "@material-ui/core";
import FormatListBulletedOutlined from "@mui/icons-material/FormatListBulletedOutlined";
import AddIcon from "@material-ui/icons/Add";
import EditOutlinedIcon from "@material-ui/icons/EditOutlined";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import CheckIcon from "@material-ui/icons/Check";
import ticketListsService from "../../services/ticketListsService";
import toastError from "../../errors/toastError";
import { toast } from "react-toastify";
import clsx from "clsx";

const useStyles = makeStyles((theme) => ({
  iconBtn: {
    padding: 4,
    color: theme.palette.type === "dark" ? "rgba(255,255,255,0.35)" : "#9ca3af",
    "&:hover": {
      backgroundColor: "transparent",
      color: theme.palette.type === "dark" ? "rgba(255,255,255,0.55)" : "#6b7280"
    }
  },
  iconBtnActive: {
    color: theme.palette.primary.main
  },
  menuPaper: {
    minWidth: 240,
    maxWidth: 300,
    borderRadius: 12,
    marginTop: 6,
    padding: theme.spacing(0.5, 0),
    background:
      theme.palette.type === "dark"
        ? theme.palette.background.paper
        : "rgba(255,255,255,0.98)",
    boxShadow:
      theme.palette.type === "dark"
        ? "0 16px 40px rgba(0,0,0,0.45)"
        : "0 12px 32px rgba(0,0,0,0.14)"
  },
  menuHeader: {
    padding: theme.spacing(1, 1.75, 0.75),
    fontSize: 12,
    fontWeight: 500,
    letterSpacing: "0.02em",
    textTransform: "uppercase",
    color: theme.palette.text.secondary,
    opacity: 0.85
  },
  colorDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    flexShrink: 0
  },
  listItem: {
    minHeight: 40,
    paddingTop: 4,
    paddingBottom: 4,
    borderRadius: 8,
    margin: theme.spacing(0, 0.75),
    "&:hover": {
      backgroundColor:
        theme.palette.type === "dark"
          ? "rgba(255,255,255,0.06)"
          : "rgba(0,0,0,0.04)"
    }
  },
  listItemSelected: {
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(99,102,241,0.18)"
        : "rgba(99,102,241,0.1)"
  },
  listLabel: {
    fontSize: 13,
    fontWeight: 400,
    letterSpacing: "-0.01em"
  },
  actionIcon: {
    padding: 4,
    opacity: 0.55,
    "&:hover": {
      opacity: 1,
      backgroundColor: "transparent"
    }
  },
  createItem: {
    minHeight: 40,
    margin: theme.spacing(0, 0.75),
    borderRadius: 8,
    color: theme.palette.primary.main
  },
  checkIcon: {
    fontSize: 16,
    color: theme.palette.primary.main,
    marginLeft: 4
  }
}));

const TicketListsMenu = ({
  selectedListId = null,
  onChange,
  className,
  iconButtonClassName,
  activeClassName
}) => {
  const classes = useStyles();
  const [lists, setLists] = useState([]);
  const [anchorEl, setAnchorEl] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingList, setEditingList] = useState(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#6366F1");
  const [saving, setSaving] = useState(false);

  const selectedId = selectedListId == null ? null : Number(selectedListId);
  const menuOpen = Boolean(anchorEl);
  const hasActiveFilter = selectedId != null;

  const loadLists = useCallback(async () => {
    try {
      const data = await ticketListsService.list();
      setLists(Array.isArray(data) ? data : []);
    } catch (err) {
      toastError(err);
    }
  }, []);

  useEffect(() => {
    loadLists();
  }, [loadLists]);

  const handleOpen = (e) => {
    setAnchorEl(e.currentTarget);
    loadLists();
  };

  const handleClose = () => setAnchorEl(null);

  const handleSelect = (listId) => {
    if (onChange) onChange(listId);
    handleClose();
  };

  const openCreate = () => {
    setName("");
    setColor("#6366F1");
    setCreateOpen(true);
    handleClose();
  };

  const openEdit = (e, list) => {
    e.stopPropagation();
    setEditingList(list);
    setName(list?.name || "");
    setColor(list?.color || "#6366F1");
    setEditOpen(true);
    handleClose();
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await ticketListsService.create({
        name: name.trim(),
        color
      });
      toast.success("Lista criada");
      setCreateOpen(false);
      await loadLists();
      // NÃO auto-selecionar a lista nova: vazia ⇒ contactId IN (-1) e zera Aguardando/Atendendo
      // enquanto notificações (sem ticketListIds) continuam aparecendo.
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingList?.id || !name.trim()) return;
    setSaving(true);
    try {
      await ticketListsService.update(editingList.id, {
        name: name.trim(),
        color
      });
      toast.success("Lista atualizada");
      setEditOpen(false);
      setEditingList(null);
      await loadLists();
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (e, list) => {
    e.stopPropagation();
    if (!list?.id) return;
    if (!window.confirm(`Excluir a lista "${list.name}"?`)) return;
    try {
      await ticketListsService.remove(list.id);
      if (selectedId === Number(list.id) && onChange) onChange(null);
      toast.success("Lista excluída");
      await loadLists();
    } catch (err) {
      toastError(err);
    }
  };

  const formFields = (
    <>
      <TextField
        autoFocus
        margin="dense"
        label="Nome da lista"
        fullWidth
        variant="outlined"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (editOpen) handleUpdate();
            else handleCreate();
          }
        }}
      />
      <Box mt={1.5} display="flex" alignItems="center" style={{ gap: 8 }}>
        <Typography variant="body2" color="textSecondary">
          Cor
        </Typography>
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          style={{
            width: 36,
            height: 28,
            border: "none",
            background: "transparent",
            cursor: "pointer"
          }}
        />
      </Box>
    </>
  );

  return (
    <>
      <Tooltip placement="top" title="Listas">
        <IconButton
          size="small"
          aria-label="Listas"
          className={clsx(
            classes.iconBtn,
            iconButtonClassName,
            hasActiveFilter && (activeClassName || classes.iconBtnActive),
            className
          )}
          onClick={handleOpen}
        >
          <FormatListBulletedOutlined fontSize="small" />
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={menuOpen}
        onClose={handleClose}
        getContentAnchorEl={null}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        PaperProps={{ className: classes.menuPaper, elevation: 8 }}
      >
        <Typography className={classes.menuHeader}>Listas</Typography>

        <MenuItem
          className={clsx(
            classes.listItem,
            selectedId == null && classes.listItemSelected
          )}
          onClick={() => handleSelect(null)}
        >
          <ListItemText
            primary="Todos"
            primaryTypographyProps={{ className: classes.listLabel }}
          />
          {selectedId == null ? <CheckIcon className={classes.checkIcon} /> : null}
        </MenuItem>

        {lists.map((list) => {
          const active = selectedId === Number(list.id);
          return (
            <MenuItem
              key={list.id}
              className={clsx(classes.listItem, active && classes.listItemSelected)}
              onClick={() => handleSelect(list.id)}
            >
              <ListItemIcon style={{ minWidth: 24 }}>
                <span
                  className={classes.colorDot}
                  style={{ backgroundColor: list.color || "#6366F1" }}
                />
              </ListItemIcon>
              <ListItemText
                primary={list.name}
                primaryTypographyProps={{ className: classes.listLabel }}
              />
              {active ? <CheckIcon className={classes.checkIcon} /> : null}
              <IconButton
                size="small"
                className={classes.actionIcon}
                onClick={(e) => openEdit(e, list)}
                aria-label="Editar lista"
              >
                <EditOutlinedIcon style={{ fontSize: 16 }} />
              </IconButton>
              <IconButton
                size="small"
                className={classes.actionIcon}
                onClick={(e) => handleDelete(e, list)}
                aria-label="Excluir lista"
              >
                <DeleteOutlineIcon style={{ fontSize: 16 }} />
              </IconButton>
            </MenuItem>
          );
        })}

        <Divider style={{ margin: "6px 0" }} />

        <MenuItem className={classes.createItem} onClick={openCreate}>
          <ListItemIcon style={{ minWidth: 28, color: "inherit" }}>
            <AddIcon style={{ fontSize: 18 }} />
          </ListItemIcon>
          <ListItemText
            primary="Nova lista"
            primaryTypographyProps={{ className: classes.listLabel }}
          />
        </MenuItem>
      </Menu>

      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Nova lista</DialogTitle>
        <DialogContent>{formFields}</DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancelar</Button>
          <Button
            color="primary"
            variant="contained"
            disabled={saving || !name.trim()}
            onClick={handleCreate}
          >
            Criar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Editar lista</DialogTitle>
        <DialogContent>{formFields}</DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>Cancelar</Button>
          <Button
            color="primary"
            variant="contained"
            disabled={saving || !name.trim()}
            onClick={handleUpdate}
          >
            Salvar
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default TicketListsMenu;
