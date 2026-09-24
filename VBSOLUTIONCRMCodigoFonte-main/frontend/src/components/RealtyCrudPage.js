/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 */

import React, { useEffect, useMemo, useState } from "react";
import MainContainer from "./MainContainer";
import { toast } from "react-toastify";
import toastError from "../errors/toastError";

const RealtyCrudPage = ({
  title,
  subtitle,
  listKey,
  loader,
  creator,
  updater,
  remover,
  fields,
  cardTitle,
  cardMeta,
  /** When true, non-core fields are stored in `payload` JSON (realty_modulos). */
  packPayload = false,
  coreFields = ["title", "status", "value", "dueDate", "notes"],
  emptyHint = "Nenhum registro ainda. Clique em Novo e preencha os campos estratégicos.",
  headerActions = null,
}) => {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(false);

  const emptyForm = useMemo(() => {
    const next = {};
    fields.forEach((f) => {
      next[f.name] = f.defaultValue != null ? f.defaultValue : "";
    });
    return next;
  }, [fields]);

  const flattenItem = (item) => {
    if (!item) return emptyForm;
    const next = { ...emptyForm };
    fields.forEach((f) => {
      if (item[f.name] != null && item[f.name] !== "") {
        next[f.name] = item[f.name];
      } else if (item.payload && item.payload[f.name] != null) {
        next[f.name] = item.payload[f.name];
      } else {
        next[f.name] = f.defaultValue != null ? f.defaultValue : "";
      }
    });
    return next;
  };

  const buildPayload = (raw) => {
    const data = { ...raw };
    fields.forEach((f) => {
      if (f.cast === "number") {
        data[f.name] = data[f.name] === "" || data[f.name] == null ? null : Number(data[f.name]);
      }
      if (f.cast === "boolean") {
        data[f.name] = data[f.name] === true || data[f.name] === "true";
      }
      if (f.type === "datetime-local" && data[f.name]) {
        data[f.name] = new Date(data[f.name]).toISOString();
      }
      if (f.name === "images" && typeof data.images === "string") {
        data.images = data.images
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      }
    });

    if (!packPayload) return data;

    const core = {};
    const payload = {};
    Object.keys(data).forEach((key) => {
      if (coreFields.includes(key)) core[key] = data[key];
      else payload[key] = data[key];
    });
    return { ...core, payload };
  };

  const load = async () => {
    setLoading(true);
    try {
      const data = await loader({ searchParam: search, pageSize: 100 });
      setItems(data[listKey] || []);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm(flattenItem(item));
    setOpen(true);
  };

  const save = async (e) => {
    e.preventDefault();
    try {
      const payload = buildPayload(form);
      if (editing) await updater(editing.id, payload);
      else await creator(payload);
      toast.success(editing ? "Registro atualizado" : "Registro criado");
      setOpen(false);
      await load();
    } catch (err) {
      toastError(err);
    }
  };

  const remove = async (item) => {
    if (!window.confirm("Excluir este registro?")) return;
    try {
      await remover(item.id);
      toast.success("Excluído");
      await load();
    } catch (err) {
      toastError(err);
    }
  };

  const display = (item, name) => {
    if (item[name] != null && item[name] !== "") return item[name];
    if (item.payload && item.payload[name] != null) return item.payload[name];
    return "";
  };

  return (
    <MainContainer autoHeight>
      <div className="realty-page">
        <div className="realty-page__header">
          <div>
            <h1 className="realty-page__title">{title}</h1>
            <p className="realty-page__subtitle">{subtitle}</p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {headerActions}
            <button type="button" className="realty-page__btn" onClick={openCreate}>
              Novo
            </button>
          </div>
        </div>
        <div className="realty-page__toolbar">
          <input
            className="realty-page__search"
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
          />
          <button type="button" className="realty-page__btn realty-page__btn--ghost" onClick={load}>
            {loading ? "Carregando..." : "Filtrar"}
          </button>
        </div>
        {items.length === 0 ? (
          <div className="realty-empty">{emptyHint}</div>
        ) : (
          <div className="realty-page__grid">
            {items.map((item) => (
              <article key={item.id} className="realty-card">
                <h3>{cardTitle ? cardTitle(item, display) : item.title}</h3>
                <div>{cardMeta ? cardMeta(item, display) : null}</div>
                <div className="realty-card__actions">
                  <button type="button" className="realty-page__btn realty-page__btn--ghost" onClick={() => openEdit(item)}>
                    Editar
                  </button>
                  <button type="button" className="realty-page__btn realty-page__btn--ghost" onClick={() => remove(item)}>
                    Excluir
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
        {open && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15,23,42,0.35)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1300,
            }}
            onClick={() => setOpen(false)}
          >
            <form
              className="realty-card realty-form"
              style={{ width: 480, maxWidth: "94vw", maxHeight: "90vh", overflow: "auto" }}
              onClick={(e) => e.stopPropagation()}
              onSubmit={save}
            >
              <h3>{editing ? "Editar" : "Novo"}</h3>
              {fields.map((f) => (
                <label key={f.name}>
                  <span style={{ display: "block", fontSize: 12, marginBottom: 4 }}>
                    {f.label}
                    {f.required ? " *" : ""}
                  </span>
                  {f.type === "select" ? (
                    <select
                      value={form[f.name] || ""}
                      onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                      required={!!f.required}
                    >
                      {!f.required ? <option value="">—</option> : null}
                      {(f.options || []).map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : f.type === "textarea" ? (
                    <textarea
                      rows={3}
                      value={form[f.name] || ""}
                      onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                      required={!!f.required}
                      placeholder={f.placeholder || ""}
                    />
                  ) : (
                    <input
                      type={f.type || "text"}
                      value={form[f.name] || ""}
                      onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                      required={!!f.required}
                      placeholder={f.placeholder || ""}
                    />
                  )}
                </label>
              ))}
              <div className="realty-card__actions">
                <button type="submit" className="realty-page__btn">
                  Salvar
                </button>
                <button type="button" className="realty-page__btn realty-page__btn--ghost" onClick={() => setOpen(false)}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </MainContainer>
  );
};

export default RealtyCrudPage;
