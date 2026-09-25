/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import MainContainer from "../../components/MainContainer";
import realtyService from "../../services/realtyService";
import { formatBRL, IMOVEL_STATUSES } from "../../helpers/realtyCrm";
import toastError from "../../errors/toastError";
import { toast } from "react-toastify";

const TIPOS = [
  "apartamento",
  "casa",
  "cobertura",
  "terreno",
  "sala",
  "loja",
  "galpao",
  "outro",
];

const emptyForm = () => ({
  title: "",
  code: "",
  type: "apartamento",
  purpose: "venda",
  status: "captacao",
  price: "",
  address: "",
  neighborhood: "",
  city: "",
  state: "SP",
  bedrooms: "",
  suites: "",
  parkingSpots: "",
  areaM2: "",
  proprietarioId: "",
  userId: "",
  description: "",
});

const Captacao = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroCidade, setFiltroCidade] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("captacao");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { pageSize: 200 };
      if (filtroStatus) params.status = filtroStatus;
      if (busca.trim()) params.searchParam = busca.trim();
      const data = await realtyService.listImoveis(params);
      setItems(data.imoveis || []);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, [busca, filtroStatus]);

  useEffect(() => {
    load();
  }, [load]);

  const cidades = useMemo(() => {
    const set = new Set();
    items.forEach((i) => {
      if (i.city) set.add(i.city);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (filtroCidade && i.city !== filtroCidade) return false;
      if (filtroTipo && String(i.type || "").toLowerCase() !== filtroTipo) return false;
      return true;
    });
  }, [items, filtroCidade, filtroTipo]);

  const kpis = useMemo(() => {
    const total = filtered.length;
    const valor = filtered.reduce((s, i) => s + (Number(i.price) || 0), 0);
    const cidadesUnicas = new Set(filtered.map((i) => i.city).filter(Boolean)).size;
    return { total, valor, cidadesUnicas };
  }, [filtered]);

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm());
    setFormOpen(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm({
      title: item.title || "",
      code: item.code || "",
      type: item.type || "apartamento",
      purpose: item.purpose || "venda",
      status: item.status || "captacao",
      price: item.price != null ? String(item.price) : "",
      address: item.address || "",
      neighborhood: item.neighborhood || "",
      city: item.city || "",
      state: item.state || "SP",
      bedrooms: item.bedrooms != null ? String(item.bedrooms) : "",
      suites: item.suites != null ? String(item.suites) : "",
      parkingSpots: item.parkingSpots != null ? String(item.parkingSpots) : "",
      areaM2: item.areaM2 != null ? String(item.areaM2) : "",
      proprietarioId: item.proprietarioId != null ? String(item.proprietarioId) : "",
      userId: item.userId != null ? String(item.userId) : "",
      description: item.description || "",
    });
    setFormOpen(true);
  };

  const numOrNull = (v) => (v === "" || v == null ? null : Number(v));

  const save = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error("Informe o título / referência");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        code: form.code || null,
        type: form.type,
        purpose: form.purpose,
        status: form.status || "captacao",
        price: numOrNull(form.price),
        address: form.address || null,
        neighborhood: form.neighborhood || null,
        city: form.city || null,
        state: form.state || null,
        bedrooms: numOrNull(form.bedrooms),
        suites: numOrNull(form.suites),
        parkingSpots: numOrNull(form.parkingSpots),
        areaM2: numOrNull(form.areaM2),
        proprietarioId: numOrNull(form.proprietarioId),
        userId: numOrNull(form.userId),
        description: form.description || null,
      };
      if (editing?.id) {
        await realtyService.updateImovel(editing.id, payload);
        toast.success("Captação atualizada");
      } else {
        await realtyService.createImovel({ ...payload, status: payload.status || "captacao" });
        toast.success("Captação criada");
      }
      setFormOpen(false);
      await load();
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item) => {
    if (!window.confirm(`Remover "${item.title}"?`)) return;
    try {
      await realtyService.deleteImovel(item.id);
      toast.success("Removido");
      await load();
    } catch (err) {
      toastError(err);
    }
  };

  const setField = (name, value) => setForm((f) => ({ ...f, [name]: value }));

  return (
    <MainContainer autoHeight>
      <div className="realty-page">
        <div className="realty-page__header">
          <div>
            <h1 className="realty-page__title">Captação</h1>
            <p className="realty-page__subtitle">
              Imóveis em captação — listagem, filtros e cadastro (endereço, operação, valor estimado, corretor).
            </p>
          </div>
          <div className="realty-page__header-actions">
            <button type="button" className="realty-page__btn realty-page__btn--ghost" onClick={load}>
              {loading ? "Atualizando…" : "Atualizar"}
            </button>
            <button type="button" className="realty-page__btn" onClick={openNew}>
              Nova captação
            </button>
          </div>
        </div>

        <div className="realty-page__grid" style={{ marginBottom: 16 }}>
          <article className="realty-card">
            <p style={{ margin: 0, fontSize: 12 }}>Total filtrado</p>
            <h2 style={{ margin: "6px 0 0", fontSize: 28 }}>{kpis.total}</h2>
          </article>
          <article className="realty-card">
            <p style={{ margin: 0, fontSize: 12 }}>Valor estimado</p>
            <h2 style={{ margin: "6px 0 0", fontSize: 22 }}>{formatBRL(kpis.valor)}</h2>
          </article>
          <article className="realty-card">
            <p style={{ margin: 0, fontSize: 12 }}>Cidades</p>
            <h2 style={{ margin: "6px 0 0", fontSize: 28 }}>{kpis.cidadesUnicas}</h2>
          </article>
        </div>

        <div className="realty-filters-panel">
          <label className="realty-filter-field">
            Busca
            <input
              placeholder="Título, cidade, bairro…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </label>
          <label className="realty-filter-field">
            Status
            <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
              <option value="">Todos</option>
              {IMOVEL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="realty-filter-field">
            Cidade
            <select value={filtroCidade} onChange={(e) => setFiltroCidade(e.target.value)}>
              <option value="">Todas</option>
              {cidades.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="realty-filter-field">
            Tipo
            <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
              <option value="">Todos</option>
              {TIPOS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        </div>

        {loading && <div className="realty-empty">Carregando…</div>}
        {!loading && filtered.length === 0 && (
          <div className="realty-empty">Nenhuma captação encontrada. Clique em Nova captação.</div>
        )}

        <div className="realty-page__grid">
          {filtered.map((item) => (
            <article key={item.id} className="realty-card">
              <h3>{item.title}</h3>
              <p>
                <span className="realty-chip">{item.status || "captacao"}</span>
                {item.type || "—"} · {item.purpose || "venda"}
              </p>
              <p>
                {item.city || "—"}
                {item.neighborhood ? ` · ${item.neighborhood}` : ""}
                {item.address ? ` · ${item.address}` : ""}
              </p>
              <p>
                {item.bedrooms != null ? `${item.bedrooms} quartos` : "—"}
                {item.areaM2 != null ? ` · ${item.areaM2} m²` : ""}
              </p>
              <strong style={{ display: "block", marginTop: 8, color: "#2b3340" }}>
                {formatBRL(item.price)}
              </strong>
              <div className="realty-card__actions">
                <button
                  type="button"
                  className="realty-page__btn realty-page__btn--ghost"
                  onClick={() => openEdit(item)}
                >
                  Editar
                </button>
                <button type="button" className="realty-page__btn realty-page__btn--ghost" onClick={() => remove(item)}>
                  Remover
                </button>
              </div>
            </article>
          ))}
        </div>

        {formOpen && (
          <div className="realty-modal-backdrop" onClick={() => !saving && setFormOpen(false)}>
            <form
              className="realty-card realty-modal realty-form"
              onClick={(e) => e.stopPropagation()}
              onSubmit={save}
            >
              <h3>{editing ? "Editar captação" : "Nova captação"}</h3>
              <label>
                Título / referência *
                <input value={form.title} onChange={(e) => setField("title", e.target.value)} required />
              </label>
              <label>
                Código
                <input value={form.code} onChange={(e) => setField("code", e.target.value)} />
              </label>
              <label>
                Tipo
                <select value={form.type} onChange={(e) => setField("type", e.target.value)}>
                  {TIPOS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Operação
                <select value={form.purpose} onChange={(e) => setField("purpose", e.target.value)}>
                  <option value="venda">Venda</option>
                  <option value="aluguel">Aluguel</option>
                </select>
              </label>
              <label>
                Status
                <select value={form.status} onChange={(e) => setField("status", e.target.value)}>
                  {IMOVEL_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Valor estimado (R$)
                <input
                  type="number"
                  value={form.price}
                  onChange={(e) => setField("price", e.target.value)}
                />
              </label>
              <label>
                Endereço
                <input value={form.address} onChange={(e) => setField("address", e.target.value)} />
              </label>
              <label>
                Bairro
                <input value={form.neighborhood} onChange={(e) => setField("neighborhood", e.target.value)} />
              </label>
              <label>
                Cidade
                <input value={form.city} onChange={(e) => setField("city", e.target.value)} />
              </label>
              <label>
                UF
                <input value={form.state} onChange={(e) => setField("state", e.target.value)} maxLength={2} />
              </label>
              <label>
                Quartos
                <input
                  type="number"
                  value={form.bedrooms}
                  onChange={(e) => setField("bedrooms", e.target.value)}
                />
              </label>
              <label>
                Suítes
                <input type="number" value={form.suites} onChange={(e) => setField("suites", e.target.value)} />
              </label>
              <label>
                Vagas
                <input
                  type="number"
                  value={form.parkingSpots}
                  onChange={(e) => setField("parkingSpots", e.target.value)}
                />
              </label>
              <label>
                Área m²
                <input type="number" value={form.areaM2} onChange={(e) => setField("areaM2", e.target.value)} />
              </label>
              <label>
                ID Proprietário
                <input
                  type="number"
                  value={form.proprietarioId}
                  onChange={(e) => setField("proprietarioId", e.target.value)}
                />
              </label>
              <label>
                Corretor captador (ID user)
                <input type="number" value={form.userId} onChange={(e) => setField("userId", e.target.value)} />
              </label>
              <label>
                Observações / origem
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setField("description", e.target.value)}
                />
              </label>
              <div className="realty-card__actions">
                <button
                  type="button"
                  className="realty-page__btn realty-page__btn--ghost"
                  onClick={() => setFormOpen(false)}
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button type="submit" className="realty-page__btn" disabled={saving}>
                  {saving ? "Salvando…" : "Salvar"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </MainContainer>
  );
};

export default Captacao;
