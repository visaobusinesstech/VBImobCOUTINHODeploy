/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 *
 * Seletor de destinatários no modelo de Campanhas:
 * filtros por fila, lista, tag e público-alvo + busca por nome,
 * listagem com selecionar todos / um a um.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import api from "../../services/api";
import useQueues from "../../hooks/useQueues";
import toastError from "../../errors/toastError";

const PUBLICO_ALVO_OPTIONS = [
  { value: "", label: "Todos (sem público-alvo)" },
  { value: "lead_sem_resposta", label: "Leads sem resposta" },
  { value: "lead_inativo", label: "Leads inativos" },
];

const CLOSED_LEAD = new Set(["fechado", "perdido", "descartado", "inativo", "ganho"]);
const OPEN_LEAD = new Set([
  "novo",
  "contato",
  "contatado",
  "qualificado",
  "em_atendimento",
  "aberto",
]);

const normalizePhone = (v) => String(v || "").replace(/\D/g, "");

const recipientKey = (r) => {
  if (r?.leadSaleId != null) return `lead:${r.leadSaleId}`;
  if (r?.contactId != null) return `contact:${r.contactId}`;
  if (r?.id != null) return `id:${r.id}`;
  return `num:${normalizePhone(r?.number)}`;
};

const contactToRecipient = (c) => ({
  id: c.id,
  contactId: c.id,
  leadSaleId: c.leadSaleId || null,
  name: c.name || c.number || "—",
  number: c.number || "",
  email: c.email || "",
  tags: Array.isArray(c.tags) ? c.tags : [],
  source: "contact",
});

const listItemToRecipient = (item) => ({
  id: item.contactId || item.id,
  contactId: item.contactId || null,
  leadSaleId: null,
  name: item.name || item.number || "—",
  number: item.number || "",
  email: item.email || "",
  tags: [],
  source: "list",
});

const leadToRecipient = (lead, contactById = new Map()) => {
  const contact = lead.contactId ? contactById.get(Number(lead.contactId)) : null;
  const tagsFromLead = Array.isArray(lead.tags)
    ? lead.tags.map((t) => (typeof t === "string" ? { id: t, name: t } : t))
    : [];
  return {
    id: lead.contactId || `lead-${lead.id}`,
    contactId: lead.contactId || null,
    leadSaleId: lead.id,
    name: lead.name || contact?.name || `Lead #${lead.id}`,
    number: lead.phone || contact?.number || "",
    email: lead.email || contact?.email || "",
    tags: contact?.tags?.length ? contact.tags : tagsFromLead,
    source: "lead",
    status: lead.status,
  };
};

export default function DestinatariosPicker({
  value = [],
  onChange,
  multiSelect = true,
  leads = [],
  disabled = false,
  initialPublicoAlvo = "",
  onPublicoAlvoChange,
}) {
  const { findAll: findAllQueues } = useQueues();

  const [queues, setQueues] = useState([]);
  const [tags, setTags] = useState([]);
  const [contactLists, setContactLists] = useState([]);
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);

  const [filterQueueId, setFilterQueueId] = useState("");
  const [filterListId, setFilterListId] = useState("");
  const [filterTagId, setFilterTagId] = useState("");
  const [filterPublico, setFilterPublico] = useState(initialPublicoAlvo || "");
  const [search, setSearch] = useState("");

  useEffect(() => {
    setFilterPublico(initialPublicoAlvo || "");
  }, [initialPublicoAlvo]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const [q, tRes, lRes] = await Promise.all([
          findAllQueues(),
          api.get("/tags/list").catch(() => ({ data: [] })),
          api.get("/contact-lists/list").catch(() => ({ data: [] })),
        ]);
        if (cancel) return;
        setQueues(Array.isArray(q) ? q : []);
        const tagList = Array.isArray(tRes.data) ? tRes.data : tRes.data?.tags || [];
        setTags(tagList.filter((t) => t && (t.kanban === 0 || t.kanban == null || !t.kanban)));
        const lists = Array.isArray(lRes.data) ? lRes.data : lRes.data?.records || [];
        setContactLists(lists);
      } catch (err) {
        if (!cancel) toastError(err);
      }
    })();
    return () => {
      cancel = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- carrega catálogos uma vez ao montar
  }, []);

  const leadsByContactId = useMemo(() => {
    const map = new Map();
    (leads || []).forEach((l) => {
      if (l.contactId != null) map.set(Number(l.contactId), l);
    });
    return map;
  }, [leads]);

  const leadsByPhone = useMemo(() => {
    const map = new Map();
    (leads || []).forEach((l) => {
      const p = normalizePhone(l.phone);
      if (p) map.set(p, l);
    });
    return map;
  }, [leads]);

  const enrichWithLead = useCallback(
    (recipient) => {
      if (recipient.leadSaleId) return recipient;
      const byContact = recipient.contactId
        ? leadsByContactId.get(Number(recipient.contactId))
        : null;
      const byPhone = !byContact ? leadsByPhone.get(normalizePhone(recipient.number)) : null;
      const lead = byContact || byPhone;
      if (!lead) return recipient;
      return { ...recipient, leadSaleId: lead.id, status: lead.status };
    },
    [leadsByContactId, leadsByPhone]
  );

  const loadOptions = useCallback(async () => {
    setLoading(true);
    try {
      let list = [];

      if (filterPublico) {
        const contactCache = new Map();
        try {
          const { data } = await api.get("/contacts/list", { params: {} });
          (Array.isArray(data) ? data : []).forEach((c) => contactCache.set(Number(c.id), c));
        } catch {
          /* ignore */
        }
        const filteredLeads = (leads || []).filter((l) => {
          const st = String(l.status || "").toLowerCase();
          if (filterPublico === "lead_sem_resposta") {
            return OPEN_LEAD.has(st) || (!CLOSED_LEAD.has(st) && st !== "");
          }
          if (filterPublico === "lead_inativo") {
            return !CLOSED_LEAD.has(st);
          }
          return true;
        });
        list = filteredLeads.map((l) => leadToRecipient(l, contactCache));
      } else if (filterListId) {
        const { data } = await api.get("/contact-list-items", {
          params: { contactListId: filterListId, pageNumber: 1 },
        });
        const items = Array.isArray(data?.contacts) ? data.contacts : Array.isArray(data) ? data : [];
        list = items.map(listItemToRecipient);
      } else {
        const params = {
          name: search.trim() || undefined,
          tagId: filterTagId || undefined,
          queueId: filterQueueId || undefined,
        };
        const { data } = await api.get("/contacts/list", { params });
        list = (Array.isArray(data) ? data : []).map(contactToRecipient);
      }

      list = list.map(enrichWithLead);

      if (filterTagId && filterPublico) {
        list = list.filter(
          (c) =>
            Array.isArray(c.tags) &&
            c.tags.some((t) => String(t.id) === String(filterTagId) || String(t.name) === String(filterTagId))
        );
      }

      if (search.trim() && (filterPublico || filterListId)) {
        const q = search.trim().toLowerCase();
        const digits = normalizePhone(search);
        list = list.filter((c) => {
          const name = (c.name || "").toLowerCase();
          const number = (c.number || "").toLowerCase();
          const tagsStr = (c.tags || []).map((t) => (t.name || "").toLowerCase()).join(" ");
          return (
            name.includes(q) ||
            number.includes(q) ||
            tagsStr.includes(q) ||
            (digits && normalizePhone(c.number).includes(digits))
          );
        });
      }

      setOptions(list);
    } catch (err) {
      toastError(err);
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }, [
    enrichWithLead,
    filterListId,
    filterPublico,
    filterQueueId,
    filterTagId,
    leads,
    search,
  ]);

  useEffect(() => {
    const delay = setTimeout(loadOptions, search.length < 2 ? 0 : 350);
    return () => clearTimeout(delay);
  }, [loadOptions, search]);

  const selectedKeys = useMemo(
    () => new Set((value || []).map(recipientKey)),
    [value]
  );

  const toggle = (recipient) => {
    if (disabled) return;
    const key = recipientKey(recipient);
    const isSelected = selectedKeys.has(key);
    if (!multiSelect) {
      onChange?.(isSelected ? [] : [recipient]);
      return;
    }
    if (isSelected) {
      onChange?.((value || []).filter((r) => recipientKey(r) !== key));
    } else {
      onChange?.([...(value || []), recipient]);
    }
  };

  const selectAllVisible = () => {
    if (disabled) return;
    const map = new Map((value || []).map((r) => [recipientKey(r), r]));
    options.forEach((r) => map.set(recipientKey(r), r));
    onChange?.([...map.values()]);
  };

  const clearSelection = () => {
    if (disabled) return;
    onChange?.([]);
  };

  const handlePublicoChange = (v) => {
    setFilterPublico(v);
    setFilterListId("");
    onPublicoAlvoChange?.(v || "lead_inativo");
  };

  const handleListChange = (v) => {
    setFilterListId(v);
    if (v) {
      setFilterPublico("");
      setFilterQueueId("");
    }
  };

  return (
    <div className={`destinatarios-picker${disabled ? " is-disabled" : ""}`}>
      <div className="destinatarios-picker__filters">
        <label>
          Fila
          <select
            value={filterQueueId}
            onChange={(e) => setFilterQueueId(e.target.value)}
            disabled={disabled || !!filterListId || !!filterPublico}
          >
            <option value="">Todas as filas</option>
            {queues.map((q) => (
              <option key={q.id} value={q.id}>
                {q.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Lista de contatos
          <select
            value={filterListId}
            onChange={(e) => handleListChange(e.target.value)}
            disabled={disabled}
          >
            <option value="">Nenhuma (todos os contatos)</option>
            {contactLists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Tag
          <select
            value={filterTagId}
            onChange={(e) => setFilterTagId(e.target.value)}
            disabled={disabled || !!filterListId}
          >
            <option value="">Todas as tags</option>
            {tags.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Público-alvo
          <select
            value={filterPublico}
            onChange={(e) => handlePublicoChange(e.target.value)}
            disabled={disabled}
          >
            {PUBLICO_ALVO_OPTIONS.map((o) => (
              <option key={o.value || "all"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="destinatarios-picker__toolbar">
        <input
          type="search"
          placeholder="Filtrar por nome, número ou tag…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          disabled={disabled}
        />
        <button type="button" className="realty-page__btn realty-page__btn--ghost" onClick={selectAllVisible} disabled={disabled || options.length === 0}>
          Selecionar todos
        </button>
        <button type="button" className="realty-page__btn realty-page__btn--ghost" onClick={clearSelection} disabled={disabled || !(value || []).length}>
          Desmarcar todos
        </button>
      </div>

      <div className="destinatarios-picker__list">
        {loading && options.length === 0 ? (
          <p className="destinatarios-picker__empty">Carregando contatos…</p>
        ) : options.length === 0 ? (
          <p className="destinatarios-picker__empty">
            Nenhum contato encontrado com os filtros atuais.
          </p>
        ) : (
          options.map((contact) => {
            const key = recipientKey(contact);
            const isSelected = selectedKeys.has(key);
            const tagNames = (contact.tags || []).map((t) => t.name || t).filter(Boolean);
            return (
              <button
                key={key}
                type="button"
                className={`destinatarios-picker__row${isSelected ? " is-selected" : ""}`}
                onClick={() => toggle(contact)}
                disabled={disabled}
              >
                <span className="destinatarios-picker__check" aria-hidden>
                  {isSelected ? "✓" : ""}
                </span>
                <span className="destinatarios-picker__meta">
                  <strong>{contact.name}</strong>
                  {tagNames.length > 0 && (
                    <span className="destinatarios-picker__tags">{tagNames.join(", ")}</span>
                  )}
                  {contact.leadSaleId ? (
                    <span className="destinatarios-picker__badge">Lead #{contact.leadSaleId}</span>
                  ) : null}
                </span>
                <span className="destinatarios-picker__number">{contact.number || "—"}</span>
              </button>
            );
          })
        )}
      </div>

      <p className="destinatarios-picker__hint">
        {(value || []).length} contato(s) selecionado(s). Sem filtro aparece todos os contatos —
        use Selecionar todos ou marque um a um. Tag, lista ou público-alvo restringem a lista.
      </p>
    </div>
  );
}

export { recipientKey, normalizePhone, PUBLICO_ALVO_OPTIONS };
