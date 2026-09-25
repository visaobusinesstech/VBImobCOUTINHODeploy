import React, { useState, useEffect } from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    List,
    ListItem,
    ListItemText,
    IconButton,
    InputAdornment,
    Typography,
    Box,
    Chip,
    Divider,
    useMediaQuery
} from "@material-ui/core";
import {
    Search as SearchIcon,
    Close as CloseIcon,
    AttachFile as AttachFileIcon
} from "@material-ui/icons";
import { makeStyles, useTheme } from "@material-ui/core/styles";
import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import TableRowSkeleton from "../TableRowSkeleton";

const useStyles = makeStyles((theme) => ({
    dialog: {
        '& .MuiDialog-paper': {
            minHeight: 320,
            maxHeight: '85vh',
            width: '100%',
            maxWidth: 600,
            backgroundColor: theme.mode === "dark" ? theme.palette.background.paper : undefined,
            color: theme.mode === "dark" ? "#fff" : undefined,
            [theme.breakpoints.down('sm')]: {
                minHeight: '100%',
                maxHeight: '100%',
                margin: 0,
                borderRadius: 0,
                maxWidth: '100%'
            }
        }
    },
    searchField: {
        marginBottom: theme.spacing(2)
    },
    listContainer: {
        maxHeight: 'min(400px, 50vh)',
        overflow: 'auto',
        WebkitOverflowScrolling: 'touch',
        '&::-webkit-scrollbar': {
            width: '8px',
        },
        '&::-webkit-scrollbar-track': {
            background: theme.mode === "dark" ? "rgba(255,255,255,0.04)" : '#f1f1f1',
        },
        '&::-webkit-scrollbar-thumb': {
            background: theme.mode === "dark" ? "rgba(255,255,255,0.4)" : '#888',
            borderRadius: '4px',
        },
        [theme.breakpoints.down('sm')]: {
            maxHeight: 'calc(100dvh - 220px)'
        }
    },
    listItem: {
        cursor: 'pointer',
        borderRadius: theme.spacing(1),
        marginBottom: theme.spacing(0.5),
        color: theme.mode === "dark" ? "#fff" : theme.palette.text.primary,
        '&:hover': {
            backgroundColor: theme.palette.action.hover,
        },
        '& .MuiTypography-root': {
            color: theme.mode === "dark" ? "#fff" : undefined,
        },
        '& .MuiChip-outlined': {
            color: theme.mode === "dark" ? "#fff" : undefined,
            borderColor: theme.mode === "dark" ? "rgba(255,255,255,0.45)" : undefined,
        },
        '& .MuiSvgIcon-root': {
            color: theme.mode === "dark" ? "#fff" : undefined,
        }
    },
    messagePreview: {
        display: '-webkit-box',
        '-webkit-line-clamp': 2,
        '-webkit-box-orient': 'vertical',
        overflow: 'hidden',
        fontSize: '0.85rem',
        color: theme.mode === "dark" ? "rgba(255,255,255,0.75)" : theme.palette.text.secondary
    },
    shortcode: {
        fontWeight: 600,
        marginRight: theme.spacing(1)
    },
    mediaChip: {
        marginLeft: theme.spacing(1),
        height: 22,
        fontSize: '0.75rem'
    },
    emptyState: {
        textAlign: 'center',
        padding: theme.spacing(4),
        color: theme.mode === "dark" ? "#fff" : theme.palette.text.secondary
    },
    loadingContainer: {
        padding: theme.spacing(2)
    }
}));

const QuickMessageModal = ({
    open,
    onClose,
    onSelect,
    companyId,
    userId,
    isOficial = "false",
    whatsappId
}) => {
    const classes = useStyles();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
    const [quickMessages, setQuickMessages] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchParam, setSearchParam] = useState("");
    const [filteredMessages, setFilteredMessages] = useState([]);

    useEffect(() => {
        if (open && companyId) {
            fetchQuickMessages();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, companyId, userId, isOficial, whatsappId]);

    useEffect(() => {
        if (searchParam.trim() === "") {
            setFilteredMessages(quickMessages);
        } else {
            const needle = searchParam.toLowerCase();
            const filtered = quickMessages.filter((message) =>
                String(message.shortcode || "").toLowerCase().includes(needle) ||
                String(message.message || "").toLowerCase().includes(needle)
            );
            setFilteredMessages(filtered);
        }
    }, [searchParam, quickMessages]);

    const fetchQuickMessages = async () => {
        setLoading(true);
        try {
            const { data } = await api.get("/quick-messages/list", {
                params: {
                    companyId,
                    userId,
                    // Texto rápido em todas as conexões (inclui Oficial); HSM fica no seletor de templates
                    isOficial: isOficial || "false",
                    whatsappId: whatsappId || undefined
                }
            });
            const list = Array.isArray(data) ? data : [];
            setQuickMessages(
                list.filter((m) => !m.isOficial || (m.message && String(m.message).trim()))
            );
        } catch (err) {
            console.error("Erro ao buscar respostas rápidas:", err);
            toastError(err);
            setQuickMessages([]);
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setSearchParam("");
        setQuickMessages([]);
        setFilteredMessages([]);
        onClose();
    };

    const handleSelectMessage = (message) => {
        onSelect(message);
        handleClose();
    };

    const handleSearchChange = (event) => {
        setSearchParam(event.target.value);
    };

    const renderMessageItem = (message) => {
        const hasMedia = message.mediaPath || message.mediaName;

        return (
            <ListItem
                key={message.id}
                className={classes.listItem}
                onClick={() => handleSelectMessage(message)}
            >
                <ListItemText
                    primary={
                        <Box display="flex" alignItems="center" flexWrap="wrap">
                            <Typography className={classes.shortcode}>
                                /{message.shortcode}
                            </Typography>
                            {hasMedia && (
                                <Chip
                                    icon={<AttachFileIcon />}
                                    label={i18n.t("quickMessages.hasMedia")}
                                    size="small"
                                    variant="outlined"
                                    className={classes.mediaChip}
                                />
                            )}
                            {message.geral && (
                                <Chip
                                    label={i18n.t("quickMessages.global")}
                                    size="small"
                                    color="primary"
                                    className={classes.mediaChip}
                                />
                            )}
                        </Box>
                    }
                    secondary={
                        message.message && (
                            <Typography className={classes.messagePreview}>
                                {message.message}
                            </Typography>
                        )
                    }
                />
            </ListItem>
        );
    };

    const renderContent = () => {
        if (loading) {
            return (
                <Box className={classes.loadingContainer}>
                    <TableRowSkeleton columns={1} />
                </Box>
            );
        }

        if (filteredMessages.length === 0) {
            return (
                <Box className={classes.emptyState}>
                    <Typography variant="body1">
                        {searchParam
                            ? i18n.t("quickMessages.noResultsFound")
                            : i18n.t("quickMessages.noQuickMessages")
                        }
                    </Typography>
                </Box>
            );
        }

        return (
            <List className={classes.listContainer}>
                {filteredMessages.map((message, index) => (
                    <React.Fragment key={message.id}>
                        {renderMessageItem(message)}
                        {index < filteredMessages.length - 1 && <Divider />}
                    </React.Fragment>
                ))}
            </List>
        );
    };

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            className={classes.dialog}
            fullWidth
            maxWidth="sm"
            fullScreen={isMobile}
        >
            <DialogTitle>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="h6">
                        {i18n.t("quickMessages.selectMessage")}
                    </Typography>
                    <IconButton onClick={handleClose} size="small">
                        <CloseIcon />
                    </IconButton>
                </Box>
            </DialogTitle>

            <DialogContent dividers>
                <TextField
                    fullWidth
                    placeholder={i18n.t("quickMessages.searchPlaceholder")}
                    value={searchParam}
                    onChange={handleSearchChange}
                    className={classes.searchField}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon />
                            </InputAdornment>
                        ),
                    }}
                />

                {renderContent()}
            </DialogContent>

            <DialogActions>
                <Button onClick={handleClose} color="secondary">
                    {i18n.t("quickMessages.buttons.cancel")}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default QuickMessageModal;
