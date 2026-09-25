/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 *
 * Formulário Novo/Editar Lead — drawer clássico + busca de imóvel/CPF-CNPJ
 * e preview do ticket WhatsApp à direita quando existir conversa.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  TextField,
  Button,
  Grid,
  MenuItem,
  CircularProgress,
  InputAdornment,
  makeStyles,
} from "@material-ui/core";
import { Close as CloseIcon } from "@material-ui/icons";
import Autocomplete from "@material-ui/lab/Autocomplete";
import leadsSalesService from "../../services/leadsSalesService";
import realtyService from "../../services/realtyService";
import api, { openApi } from "../../services/api";
import toastError from "../../errors/toastError";
import { toast } from "react-toastify";
import LeadChatPane from "../CreateLeadSaleModal/LeadChatPane";
import whatsBackground from "../../assets/wa-background.png";
import whatsBackgroundDark from "../../assets/wa-background-dark.png";
import {
  PIPELINE_ESTAGIOS,
  CANAIS_ORIGEM,
  TIPOS_IMOVEL,
  formatCurrencyDisplay,
  parseCurrencyInput,
  getCanalLabel,
} from "../../constants/pipelineCrm";
import { formatBRL } from "../../helpers/realtyCrm";

const useStyles = makeStyles((theme) => {
  const isDark = theme.palette.type === "dark";
  const border = isDark ? "rgba(255,255,255,0.08)" : "#ECEEF1";
  const muted = isDark ? "rgba(255,255,255,0.55)" : "#737d8c";
  return {
    drawerPaper: {
      width: 1100,
      maxWidth: "100vw",
      padding: 0,
      borderRadius: 12,
      marginTop: theme.spacing(2),
      marginBottom: theme.spacing(2),
      marginRight: theme.spacing(2),
      height: "calc(100% - 32px)",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      backgroundColor: isDark ? theme.palette.background.paper : "#FBFBFA",
      boxShadow: isDark
        ? "-8px 0 40px rgba(0,0,0,0.45)"
        : "-6px 0 32px rgba(15, 23, 42, 0.1), 0 0 0 1px rgba(15, 23, 42, 0.05)",
    },
    drawerPaperNarrow: {
      width: 680,
      maxWidth: "100vw",
      padding: 0,
      borderRadius: 12,
      marginTop: theme.spacing(2),
      marginBottom: theme.spacing(2),
      marginRight: theme.spacing(2),
      height: "calc(100% - 32px)",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      backgroundColor: isDark ? theme.palette.background.paper : "#FBFBFA",
      boxShadow: isDark
        ? "-8px 0 40px rgba(0,0,0,0.45)"
        : "-6px 0 32px rgba(15, 23, 42, 0.1), 0 0 0 1px rgba(15, 23, 42, 0.05)",
    },
    header: {
      flexShrink: 0,
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: theme.spacing(2),
      padding: theme.spacing(1.75, 2.5, 1.25),
      borderBottom: `1px solid ${border}`,
      backgroundColor: isDark ? theme.palette.background.paper : "#fff",
    },
    title: {
      fontSize: 20,
      fontWeight: 400,
      letterSpacing: "-0.02em",
      color: theme.palette.text.primary,
      fontFamily: '"Helvetica Neue", HelveticaNeue, system-ui, sans-serif',
    },
    subtitle: {
      fontSize: 12,
      fontWeight: 300,
      color: muted,
      marginTop: 2,
    },
    splitBody: {
      flex: 1,
      minHeight: 0,
      display: "flex",
      flexDirection: "row",
      overflow: "hidden",
    },
    formCol: {
      display: "flex",
      flexDirection: "column",
      minWidth: 0,
      minHeight: 0,
      height: "100%",
      flex: "1 1 auto",
    },
    formColSplit: {
      flex: "0 0 42%",
      maxWidth: "42%",
      borderRight: `1px solid ${border}`,
    },
    body: {
      flex: 1,
      overflowY: "auto",
      padding: theme.spacing(2, 2.5, 3),
      minHeight: 0,
    },
    chatCol: {
      display: "flex",
      flexDirection: "column",
      minWidth: 0,
      minHeight: 0,
      height: "100%",
      flex: "1 1 58%",
      maxWidth: "58%",
      overflow: "hidden",
      background: "transparent",
    },
    section: {
      backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "#fff",
      border: `1px solid ${border}`,
      borderRadius: 12,
      padding: theme.spacing(2),
      marginBottom: theme.spacing(1.5),
      boxShadow: isDark ? "none" : "0 1px 2px rgba(15,23,42,0.04)",
    },
    sectionTitle: {
      fontSize: 12,
      fontWeight: 600,
      letterSpacing: "0.04em",
      textTransform: "uppercase",
      color: muted,
      marginBottom: theme.spacing(1.5),
    },
    label: {
      fontSize: 11,
      fontWeight: 600,
      color: muted,
      marginBottom: 4,
      display: "block",
    },
    field: {
      marginBottom: theme.spacing(0.25),
    },
    footer: {
      flexShrink: 0,
      display: "flex",
      justifyContent: "flex-end",
      gap: theme.spacing(1),
      padding: theme.spacing(1.5, 2.5),
      borderTop: `1px solid ${border}`,
      backgroundColor: isDark ? theme.palette.background.paper : "#fff",
    },
    footerBtnOutlined: {
      textTransform: "none",
      borderRadius: 10,
      fontWeight: 500,
    },
    footerBtnPrimary: {
      textTransform: "none",
      borderRadius: 10,
      fontWeight: 600,
      minWidth: 140,
    },
    helper: {
      fontSize: 11,
      color: muted,
      marginTop: 4,
    },
    imovelHint: {
      fontSize: 11,
      color: muted,
      marginTop: 6,
      lineHeight: 1.4,
    },
    ticketHeader: {
      display: "flex",
      background: theme.palette.total,
      flex: "none",
      borderBottom: "1px solid " + theme.palette.divider,
      height: 65,
      width: "100%",
      alignItems: "center",
      justifyContent: "space-between",
      overflow: "hidden",
    },
    ticketHeaderCompact: {
      height: 52,
      minHeight: 52,
    },
    chatBody: {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      minHeight: 0,
      background: "transparent",
    },
    chatBodyEmbedded: {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      minHeight: 0,
      background: "transparent",
    },
    chatConversationStack: {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      minHeight: 0,
      overflow: "hidden",
    },
    chatMessagesScroll: {
      flex: "1 1 auto",
      minHeight: 0,
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      backgroundImage:
        theme.palette.type === "light"
          ? `url(${whatsBackground})`
          : `url(${whatsBackgroundDark})`,
      backgroundColor:
        theme.palette.type === "light"
          ? "#e5ddd5"
          : theme.palette.background.default,
      backgroundRepeat: "repeat",
      backgroundSize: "380px auto",
    },
    chatPaneFill: {
      display: "flex",
      flexDirection: "column",
      flex: 1,
      minHeight: 0,
      height: "100%",
    },
  };
});

const onlyDigits = (v) => String(v || "").replace(/\D/g, "");

const formatDocument = (value) => {
  const d = onlyDigits(value).slice(0, 14);
  if (d.length <= 11) {
    return d
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
};

const matchTipoImovel = (type) => {
  if (!type) return "";
  const raw = String(type).trim();
  const found = TIPOS_IMOVEL.find(
    (t) => t.toLowerCase() === raw.toLowerCase()
  );
  if (found) return found;
  const map = {
    apartamento: "Apartamento",
    apto: "Apartamento",
    casa: "Casa",
    terreno: "Terreno",
    lote: "Lote",
    sala: "Sala Comercial",
    "sala comercial": "Sala Comercial",
    loja: "Loja",
    cobertura: "Cobertura",
    kitnet: "Kitnet",
    galpao: "Outro",
    galpão: "Outro",
  };
  return map[raw.toLowerCase()] || raw;
};

const imovelLabel = (imovel) => {
  if (!imovel) return "";
  const code = imovel.code ? `${imovel.code} · ` : "";
  const title = imovel.title || "Imóvel";
  const place = [imovel.neighborhood, imovel.city].filter(Boolean).join(", ");
  const price = Number(imovel.price) ? ` · ${formatBRL(imovel.price)}` : "";
  return `${code}${title}${place ? ` — ${place}` : ""}${price}`;
};

const emptyForm = (defaultEstagio) => ({
  name: "",
  phone: "",
  email: "",
  document: "",
  description: "",
  purpose: "venda",
  value: 0,
  status: defaultEstagio || "novos",
  responsibleId: "",
  origin: "",
  interestNeighborhood: "",
  interestType: "",
  featuresDesired: "",
  imovelId: null,
  contactId: null,
});

const contactLabel = (c) => {
  if (!c) return "";
  const name = c.name || "Contato";
  const number = c.number ? ` (${c.number})` : "";
  return `${name}${number}`;
};

const PipelineLeadFormDialog = ({
  open,
  onClose,
  lead,
  onSaved,
  defaultEstagio = "novos",
  stages,
  users = [],
  pipelineId,
  canAssignCorretor = true,
}) => {
  const classes = useStyles();
  const [form, setForm] = useState(emptyForm(defaultEstagio));
  const [valorDisplay, setValorDisplay] = useState("");
  const [saving, setSaving] = useState(false);
  const [docLookupLoading, setDocLookupLoading] = useState(false);
  const [imovelOptions, setImovelOptions] = useState([]);
  const [imovelSearch, setImovelSearch] = useState("");
  const [imovelLoading, setImovelLoading] = useState(false);
  const [imovelOpen, setImovelOpen] = useState(false);
  const [selectedImovel, setSelectedImovel] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [usersList, setUsersList] = useState([]);
  const [ticket, setTicket] = useState(null);
  const [ticketLoading, setTicketLoading] = useState(false);
  const [, setDrawerOpen] = useState(false);
  const docLookupRef = useRef(0);
  const ticketFetchGen = useRef(0);
  const lastDocLookup = useRef("");

  const estagios =
    Array.isArray(stages) && stages.length
      ? stages.map((s) => ({
          id: s.key || s.id,
          title: s.label || s.title || s.key,
        }))
      : PIPELINE_ESTAGIOS.map((e) => ({ id: e.id, title: e.title }));

  const showTicketPreview = Boolean(ticket?.uuid || ticket?.id);
  const responsibleUsers = usersList.length ? usersList : users;

  useEffect(() => {
    if (!open) return;
    if (lead) {
      const originId =
        CANAIS_ORIGEM.find((c) => c.id === lead.origin || c.label === lead.origin)
          ?.id ||
        lead.origin ||
        "";
      setForm({
        name: lead.name || "",
        phone: lead.phone || "",
        email: lead.email || "",
        document: lead.document ? formatDocument(lead.document) : "",
        description: lead.description || "",
        purpose: lead.purpose === "aluguel" ? "aluguel" : "venda",
        value: Number(lead.value) || 0,
        status: lead.status || defaultEstagio || "novos",
        responsibleId: lead.responsibleId ? String(lead.responsibleId) : "",
        origin: originId,
        interestNeighborhood: lead.interestNeighborhood || "",
        interestType: lead.interestType || "",
        featuresDesired: lead.featuresDesired || "",
        imovelId: lead.imovelId || null,
        contactId: lead.contactId || lead.contact?.id || null,
      });
      setValorDisplay(formatCurrencyDisplay(lead.value));
      setSelectedImovel(lead.imovel || null);
      setSelectedContact(lead.contact || null);
      if (lead.imovel) {
        setImovelOptions((prev) => {
          const exists = prev.some((i) => i.id === lead.imovel.id);
          return exists ? prev : [lead.imovel, ...prev];
        });
      }
    } else {
      setForm(emptyForm(defaultEstagio));
      setValorDisplay("");
      setSelectedImovel(null);
      setSelectedContact(null);
      setImovelSearch("");
    }
    setTicket(null);
    lastDocLookup.current = "";
  }, [open, lead, defaultEstagio]);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const [{ data: contactsResp }, usersResp, imoveisData] = await Promise.all([
          api.get("/contacts/list"),
          api.get("/users", { params: { searchParam: "" } }).catch(() => ({ data: {} })),
          realtyService.listImoveis({ pageSize: 80 }).catch(() => ({ imoveis: [] })),
        ]);
        if (cancelled) return;
        const list = Array.isArray(contactsResp) ? contactsResp : [];
        setContacts(list);
        const uList = usersResp?.data?.users || usersResp?.users || [];
        if (Array.isArray(uList) && uList.length) setUsersList(uList);
        setImovelOptions(imoveisData.imoveis || []);

        if (lead?.contactId || lead?.contact?.id) {
          const cid = lead.contactId || lead.contact?.id;
          const matched = list.find((c) => Number(c.id) === Number(cid));
          if (matched) setSelectedContact(matched);
        } else if (lead?.phone) {
          const digits = onlyDigits(lead.phone);
          const matched = list.find((c) => {
            const cd = onlyDigits(c.number);
            if (!cd || !digits) return false;
            return (
              cd === digits ||
              cd.endsWith(digits.slice(-10)) ||
              digits.endsWith(cd.slice(-10))
            );
          });
          if (matched) {
            setSelectedContact(matched);
            setForm((prev) => ({ ...prev, contactId: matched.id }));
          }
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, lead?.contactId, lead?.contact?.id, lead?.phone]);

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const applyContact = useCallback((contact) => {
    setSelectedContact(contact || null);
    if (!contact) {
      setForm((prev) => ({ ...prev, contactId: null }));
      return;
    }
    setForm((prev) => ({
      ...prev,
      contactId: contact.id,
      name: prev.name?.trim() ? prev.name : contact.name || prev.name,
      phone: contact.number || prev.phone,
      email: contact.email || prev.email,
    }));
  }, []);

  const applyImovel = useCallback((imovel) => {
    if (!imovel) {
      setSelectedImovel(null);
      setForm((prev) => ({ ...prev, imovelId: null }));
      return;
    }
    setSelectedImovel(imovel);
    const price = Number(imovel.price) || 0;
    const purpose =
      String(imovel.purpose || "").toLowerCase() === "aluguel"
        ? "aluguel"
        : "venda";
    const tipo = matchTipoImovel(imovel.type);
    const extras = [
      imovel.code ? `Cód. ${imovel.code}` : null,
      imovel.bedrooms != null ? `${imovel.bedrooms} quartos` : null,
      imovel.suites != null ? `${imovel.suites} suítes` : null,
      imovel.bathrooms != null ? `${imovel.bathrooms} banheiros` : null,
      imovel.parkingSpots != null ? `${imovel.parkingSpots} vagas` : null,
      imovel.areaM2 != null ? `${imovel.areaM2} m²` : null,
      imovel.address || null,
      imovel.city ? `${imovel.city}${imovel.state ? `/${imovel.state}` : ""}` : null,
    ]
      .filter(Boolean)
      .join(" · ");

    setForm((prev) => ({
      ...prev,
      imovelId: imovel.id,
      value: price || prev.value,
      purpose: imovel.purpose ? purpose : prev.purpose,
      interestType: tipo || prev.interestType,
      interestNeighborhood:
        imovel.neighborhood || prev.interestNeighborhood || "",
      description:
        imovel.title ||
        prev.description ||
        [tipo, imovel.neighborhood].filter(Boolean).join(" · "),
      featuresDesired: [imovel.description, extras].filter(Boolean).join("\n"),
    }));
    if (price) setValorDisplay(formatCurrencyDisplay(price));
  }, []);

  const loadImoveis = useCallback(async (q = "") => {
    setImovelLoading(true);
    try {
      const data = await realtyService.listImoveis({
        searchParam: q.trim() || undefined,
        pageSize: 80,
      });
      setImovelOptions(data.imoveis || []);
    } catch {
      /* silencioso */
    } finally {
      setImovelLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open || !imovelOpen) return undefined;
    const q = imovelSearch.trim();
    const t = setTimeout(() => loadImoveis(q), q ? 280 : 0);
    return () => clearTimeout(t);
  }, [open, imovelOpen, imovelSearch, loadImoveis]);

  useEffect(() => {
    if (!open || !lead?.imovelId || lead.imovel) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const data = await realtyService.listImoveis({
          searchParam: String(lead.imovelId),
          pageSize: 50,
        });
        const found = (data.imoveis || []).find(
          (i) => Number(i.id) === Number(lead.imovelId)
        );
        if (!cancelled && found) {
          setSelectedImovel(found);
          setImovelOptions((prev) => {
            const exists = prev.some((i) => i.id === found.id);
            return exists ? prev : [found, ...prev];
          });
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, lead?.imovelId, lead?.imovel]);

  const lookupDocument = useCallback(async (masked) => {
    const digits = onlyDigits(masked);
    if (digits.length !== 11 && digits.length !== 14) return;
    if (lastDocLookup.current === digits) return;
    lastDocLookup.current = digits;
    const gen = ++docLookupRef.current;
    setDocLookupLoading(true);
    try {
      if (digits.length === 14) {
        try {
          const res = await fetch(
            `https://brasilapi.com.br/api/cnpj/v1/${digits}`
          );
          if (res.ok) {
            const data = await res.json();
            if (gen !== docLookupRef.current) return;
            const nome =
              data.nome_fantasia || data.razao_social || data.nome || "";
            if (nome) {
              setForm((prev) => ({
                ...prev,
                name: prev.name?.trim() ? prev.name : nome,
              }));
              toast.success("CNPJ encontrado — dados preenchidos");
            }
            return;
          }
        } catch {
          /* fallback backend */
        }
        try {
          const { data } = await openApi.post("/auth/validate-cnpj", {
            cnpj: digits,
          });
          if (gen !== docLookupRef.current) return;
          const nome =
            data?.data?.nome ||
            data?.data?.razao_social ||
            data?.nome ||
            data?.razaoSocial ||
            "";
          if (nome) {
            setForm((prev) => ({
              ...prev,
              name: prev.name?.trim() ? prev.name : nome,
            }));
            toast.success("CNPJ válido — nome preenchido");
          }
        } catch {
          toast.info("CNPJ não encontrado automaticamente");
        }
        return;
      }

      const customUrl = process.env.REACT_APP_CPF_LOOKUP_URL;
      if (customUrl) {
        const r = await fetch(`${customUrl}?cpf=${digits}`);
        if (r.ok) {
          const d = await r.json();
          const nome = d.nome || d.name || d.fullname || d.nome_completo;
          if (gen !== docLookupRef.current) return;
          if (nome) {
            setForm((prev) => ({
              ...prev,
              name: prev.name?.trim() ? prev.name : nome,
            }));
            toast.success("CPF encontrado — nome preenchido");
          }
          return;
        }
      }
      const token = process.env.REACT_APP_HUBDEV_TOKEN;
      if (token) {
        const r = await fetch(
          `https://ws.hubdodesenvolvedor.com.br/v2/cpf/?cpf=${digits}&token=${token}`
        );
        if (r.ok) {
          const d = await r.json();
          const nome = d?.result?.nome || d?.nome;
          if (gen !== docLookupRef.current) return;
          if (nome) {
            setForm((prev) => ({
              ...prev,
              name: prev.name?.trim() ? prev.name : nome,
            }));
            toast.success("CPF encontrado — nome preenchido");
          }
          return;
        }
      }
      try {
        const { data } = await openApi.post("/auth/validate-cnpj", {
          cnpj: digits,
        });
        if (gen !== docLookupRef.current) return;
        if (data?.data?.tipo === "cpf" || data?.data?.nome) {
          const nome = data?.data?.nome || data?.nome;
          if (nome) {
            setForm((prev) => ({
              ...prev,
              name: prev.name?.trim() ? prev.name : nome,
            }));
            toast.success("Documento encontrado — nome preenchido");
          }
        }
      } catch {
        /* sem lookup configurado */
      }
    } finally {
      if (gen === docLookupRef.current) setDocLookupLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const digits = onlyDigits(form.document);
    if (digits.length !== 11 && digits.length !== 14) return undefined;
    const t = setTimeout(() => lookupDocument(form.document), 450);
    return () => clearTimeout(t);
  }, [open, form.document, lookupDocument]);

  useEffect(() => {
    if (!open) {
      setTicket(null);
      setTicketLoading(false);
      return undefined;
    }

    const contactId =
      lead?.contactId ||
      lead?.contact?.id ||
      form.contactId ||
      selectedContact?.id;
    const rawPhone =
      lead?.contact?.number ||
      selectedContact?.number ||
      lead?.phone ||
      form.phone ||
      "";
    const phoneKey = onlyDigits(rawPhone);
    const hasKey =
      Boolean(lead?.ticketId) ||
      Boolean(contactId) ||
      phoneKey.length >= 8;

    if (!hasKey) {
      setTicket(null);
      setTicketLoading(false);
      return undefined;
    }

    const gen = ++ticketFetchGen.current;
    let cancelled = false;

    const loadTicket = async () => {
      setTicketLoading(true);
      try {
        if (lead?.ticketId) {
          try {
            const { data } = await api.get(`/tickets/${lead.ticketId}`);
            if (!cancelled && gen === ticketFetchGen.current && data?.id) {
              setTicket(data);
              setTicketLoading(false);
              return;
            }
          } catch {
            /* tenta preview */
          }
        }

        let previewTicket = null;
        try {
          const { data } = await api.get("/tickets/preview-for-contact", {
            params: {
              contactId: contactId || undefined,
              phone: rawPhone || undefined,
            },
          });
          previewTicket = data;
        } catch {
          /* fallback */
        }

        if (cancelled || gen !== ticketFetchGen.current) return;

        if (previewTicket?.uuid || previewTicket?.id) {
          setTicket(previewTicket);
          setTicketLoading(false);
          return;
        }

        if (phoneKey.length >= 8) {
          try {
            const { data: ticketsResp } = await api.get("/tickets", {
              params: {
                searchParam: phoneKey,
                pageNumber: 1,
                showAll: "true",
                status: "search",
                queueIds: JSON.stringify([]),
              },
            });
            if (cancelled || gen !== ticketFetchGen.current) return;
            const list = Array.isArray(ticketsResp?.tickets)
              ? ticketsResp.tickets
              : [];
            const chosen = list.sort(
              (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
            )[0];
            if (chosen?.uuid) {
              const { data: full } = await api.get(`/tickets/u/${chosen.uuid}`);
              if (cancelled || gen !== ticketFetchGen.current) return;
              if (full?.uuid) {
                setTicket(full);
                setTicketLoading(false);
                return;
              }
            }
          } catch {
            /* sem ticket */
          }
        }

        if (!cancelled && gen === ticketFetchGen.current) {
          setTicket(null);
          setTicketLoading(false);
        }
      } catch {
        if (!cancelled && gen === ticketFetchGen.current) {
          setTicket(null);
          setTicketLoading(false);
        }
      }
    };

    loadTicket();
    return () => {
      cancelled = true;
    };
  }, [
    open,
    lead?.id,
    lead?.ticketId,
    lead?.contactId,
    lead?.contact?.id,
    lead?.contact?.number,
    lead?.phone,
    form.phone,
    form.contactId,
    selectedContact?.id,
    selectedContact?.number,
  ]);

  const handleValorChange = (e) => {
    const parsed = parseCurrencyInput(e.target.value);
    set("value", parsed);
    setValorDisplay(formatCurrencyDisplay(parsed));
  };

  const handleDocumentChange = (e) => {
    const formatted = formatDocument(e.target.value);
    set("document", formatted);
  };

  const handleSubmit = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Informe o nome do lead");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        phone: (form.phone || "").trim() || null,
        email: (form.email || "").trim() || null,
        document: onlyDigits(form.document) || null,
        description: (form.description || "").trim() || null,
        purpose: form.purpose || "venda",
        value: Number(form.value) || 0,
        status: form.status || "novos",
        responsibleId: form.responsibleId ? Number(form.responsibleId) : null,
        origin: form.origin
          ? getCanalLabel(form.origin) === form.origin
            ? form.origin
            : getCanalLabel(form.origin)
          : null,
        interestNeighborhood: (form.interestNeighborhood || "").trim() || null,
        interestType: (form.interestType || "").trim() || null,
        featuresDesired: (form.featuresDesired || "").trim() || null,
        imovelId: form.imovelId ? Number(form.imovelId) : null,
        contactId: form.contactId ? Number(form.contactId) : null,
        pipelineId: pipelineId ? Number(pipelineId) : undefined,
      };
      if (lead?.id) {
        await leadsSalesService.update(lead.id, payload);
        toast.success("Lead atualizado");
      } else {
        await leadsSalesService.create(payload);
        toast.success("Lead adicionado");
      }
      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  const paperClass = showTicketPreview
    ? classes.drawerPaper
    : classes.drawerPaperNarrow;

  const formFields = (
    <div className={classes.body}>
      <div className={classes.section}>
        <div className={classes.sectionTitle}>Dados pessoais</div>
        <Grid container spacing={1}>
          <Grid item xs={12}>
            <span className={classes.label}>Contato</span>
            <Autocomplete
              options={contacts}
              value={selectedContact}
              onChange={(_, value) => applyContact(value)}
              getOptionLabel={(c) => contactLabel(c)}
              getOptionSelected={(a, b) => Number(a?.id) === Number(b?.id)}
              openOnFocus
              noOptionsText="Nenhum contato encontrado"
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder="Selecionar contato cadastrado (opcional)"
                  variant="outlined"
                  size="small"
                />
              )}
            />
            <Typography className={classes.helper}>
              Ao selecionar, nome, telefone e e-mail são preenchidos automaticamente.
            </Typography>
          </Grid>
          <Grid item xs={12}>
            <span className={classes.label}>Nome *</span>
            <TextField
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Nome do lead"
              fullWidth
              size="small"
              variant="outlined"
              required
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <span className={classes.label}>CPF / CNPJ</span>
            <TextField
              value={form.document}
              onChange={handleDocumentChange}
              placeholder="000.000.000-00"
              fullWidth
              size="small"
              variant="outlined"
              InputProps={{
                endAdornment: docLookupLoading ? (
                  <InputAdornment position="end">
                    <CircularProgress size={16} />
                  </InputAdornment>
                ) : null,
              }}
              helperText="Ao completar 11 ou 14 dígitos, busca automática"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <span className={classes.label}>Telefone</span>
            <TextField
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="(11) 99999-0000"
              fullWidth
              size="small"
              variant="outlined"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <span className={classes.label}>E-mail</span>
            <TextField
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="email@exemplo.com"
              fullWidth
              size="small"
              variant="outlined"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <span className={classes.label}>Responsável (vendedor)</span>
            <Autocomplete
              options={responsibleUsers}
              value={
                responsibleUsers.find(
                  (u) => String(u.id) === String(form.responsibleId)
                ) || null
              }
              onChange={(_, value) =>
                set("responsibleId", value ? String(value.id) : "")
              }
              getOptionLabel={(u) => u?.name || ""}
              getOptionSelected={(a, b) => Number(a?.id) === Number(b?.id)}
              openOnFocus
              disabled={!canAssignCorretor}
              noOptionsText="Nenhum usuário encontrado"
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder="Selecionar responsável pelo lead"
                  variant="outlined"
                  size="small"
                />
              )}
            />
            {!canAssignCorretor && (
              <Typography className={classes.helper}>
                Apenas o admin master pode direcionar leads.
              </Typography>
            )}
          </Grid>
        </Grid>
      </div>

      <div className={classes.section}>
        <div className={classes.sectionTitle}>Imóvel cadastrado</div>
        <span className={classes.label}>Buscar imóvel</span>
        <Autocomplete
          options={imovelOptions}
          loading={imovelLoading}
          value={selectedImovel}
          open={imovelOpen}
          onOpen={() => {
            setImovelOpen(true);
            if (!imovelOptions.length) loadImoveis(imovelSearch);
          }}
          onClose={() => setImovelOpen(false)}
          onChange={(_, value) => applyImovel(value)}
          onInputChange={(_, value, reason) => {
            if (reason === "input" || reason === "clear") {
              setImovelSearch(value);
            }
          }}
          getOptionLabel={(opt) => imovelLabel(opt)}
          getOptionSelected={(a, b) => Number(a?.id) === Number(b?.id)}
          openOnFocus
          filterOptions={(opts, state) => {
            const q = String(state.inputValue || "")
              .trim()
              .toLowerCase();
            if (!q) return opts;
            return opts.filter((i) =>
              imovelLabel(i).toLowerCase().includes(q)
            );
          }}
          noOptionsText={
            imovelLoading
              ? "Carregando imóveis…"
              : "Nenhum imóvel encontrado"
          }
          renderOption={(opt) => (
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>
                {opt.code ? `${opt.code} · ` : ""}
                {opt.title || "Imóvel"}
              </span>
              <span style={{ fontSize: 11, color: "#6b7280" }}>
                {[opt.neighborhood, opt.city, opt.type]
                  .filter(Boolean)
                  .join(" · ")}
                {Number(opt.price) ? ` · ${formatBRL(opt.price)}` : ""}
              </span>
            </div>
          )}
          renderInput={(params) => (
            <TextField
              {...params}
              placeholder="Clique para ver imóveis ou digite para filtrar..."
              variant="outlined"
              size="small"
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <>
                    {imovelLoading ? (
                      <CircularProgress color="inherit" size={16} />
                    ) : null}
                    {params.InputProps.endAdornment}
                  </>
                ),
              }}
            />
          )}
        />
        <Typography className={classes.imovelHint}>
          Clique no campo para listar os imóveis cadastrados (como no inventário).
          Ao selecionar, valor e demais infos são preenchidos e podem ser editados.
          {selectedImovel
            ? ` Vinculado: #${selectedImovel.id}${
                selectedImovel.code ? ` (${selectedImovel.code})` : ""
              }.`
            : ""}
        </Typography>
      </div>

      <div className={classes.section}>
        <div className={classes.sectionTitle}>Interesse & negócio</div>
        <Grid container spacing={1}>
          <Grid item xs={12} sm={6}>
            <span className={classes.label}>Interesse</span>
            <TextField
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Ex: Apt 3 quartos"
              fullWidth
              size="small"
              variant="outlined"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <span className={classes.label}>Tipo de Operação</span>
            <TextField
              select
              value={form.purpose}
              onChange={(e) => set("purpose", e.target.value)}
              fullWidth
              size="small"
              variant="outlined"
            >
              <MenuItem value="venda">Venda</MenuItem>
              <MenuItem value="aluguel">Aluguel</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6}>
            <span className={classes.label}>Valor (R$)</span>
            <TextField
              value={valorDisplay}
              onChange={handleValorChange}
              placeholder="0,00"
              fullWidth
              size="small"
              variant="outlined"
              inputMode="numeric"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <span className={classes.label}>Estágio</span>
            <TextField
              select
              value={form.status}
              onChange={(e) => set("status", e.target.value)}
              fullWidth
              size="small"
              variant="outlined"
            >
              {estagios.map((e) => (
                <MenuItem key={e.id} value={e.id}>
                  {e.title}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6}>
            <span className={classes.label}>Bairro de Interesse</span>
            <TextField
              value={form.interestNeighborhood}
              onChange={(e) => set("interestNeighborhood", e.target.value)}
              placeholder="Ex: Águas Claras"
              fullWidth
              size="small"
              variant="outlined"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <span className={classes.label}>Tipo de Imóvel</span>
            <TextField
              select
              value={form.interestType || ""}
              onChange={(e) => set("interestType", e.target.value)}
              fullWidth
              size="small"
              variant="outlined"
            >
              <MenuItem value="">Não informado</MenuItem>
              {TIPOS_IMOVEL.map((t) => (
                <MenuItem key={t} value={t}>
                  {t}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
        </Grid>
      </div>

      <div className={classes.section}>
        <div className={classes.sectionTitle}>Origem</div>
        <Grid container spacing={1}>
          <Grid item xs={12} sm={6}>
            <span className={classes.label}>Canal de Origem</span>
            <TextField
              select
              value={form.origin || ""}
              onChange={(e) => set("origin", e.target.value)}
              fullWidth
              size="small"
              variant="outlined"
            >
              <MenuItem value="">Não informado</MenuItem>
              {CANAIS_ORIGEM.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.label}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12}>
            <span className={classes.label}>Observações</span>
            <TextField
              value={form.featuresDesired}
              onChange={(e) => set("featuresDesired", e.target.value)}
              placeholder="Anotações sobre o lead..."
              fullWidth
              size="small"
              variant="outlined"
              multiline
              rows={3}
            />
          </Grid>
        </Grid>
      </div>
    </div>
  );

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      classes={{ paper: paperClass }}
    >
      <Box className={classes.header}>
        <div>
          <Typography className={classes.title}>
            {lead ? "Detalhes do lead" : "Novo Lead"}
          </Typography>
          <Typography className={classes.subtitle}>
            {lead
              ? showTicketPreview
                ? `${lead.name || "Lead"} · conversa WhatsApp à direita`
                : `${lead.name || "Lead"} · preencha e salve as alterações`
              : "Cadastro rápido no pipeline CRM"}
            {ticketLoading && !showTicketPreview ? " · buscando ticket…" : ""}
          </Typography>
        </div>
        <IconButton size="small" onClick={onClose} aria-label="Fechar">
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          minHeight: 0,
        }}
      >
        <div className={classes.splitBody}>
          <div
            className={`${classes.formCol}${
              showTicketPreview ? ` ${classes.formColSplit}` : ""
            }`}
          >
            {formFields}
            <div className={classes.footer}>
              <Button
                onClick={onClose}
                disabled={saving}
                variant="outlined"
                className={classes.footerBtnOutlined}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                color="primary"
                variant="contained"
                disabled={saving || !form.name.trim()}
                className={classes.footerBtnPrimary}
                startIcon={
                  saving ? (
                    <CircularProgress size={16} color="inherit" />
                  ) : null
                }
              >
                {lead ? "Salvar Alterações" : "Adicionar Lead"}
              </Button>
            </div>
          </div>

          {showTicketPreview ? (
            <div className={classes.chatCol}>
              <LeadChatPane
                classes={classes}
                onClose={onClose}
                ticket={ticket}
                ticketLoading={ticketLoading}
                selectedContact={ticket?.contact || lead?.contact || null}
                setDrawerOpen={setDrawerOpen}
                compactHeader
                fillHeight
              />
            </div>
          ) : null}
        </div>
      </form>
    </Drawer>
  );
};

export default PipelineLeadFormDialog;
