/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 *
 * Carteira Premium — Gestão de Imóveis (layout Lovable + design VBSolution).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Plus,
  MapPin,
  Bed,
  Bath,
  Car,
  Maximize,
  Edit,
  Trash2,
  Loader2,
  ImageOff,
  Download,
  SlidersHorizontal,
  X,
  LayoutGrid,
  List,
  Power,
  PowerOff,
  Link2,
} from "lucide-react";
import MainContainer from "../../components/MainContainer";
import ImovelFormDialog from "../../components/imoveis/ImovelFormDialog";
import ImportarViaLinkDialog from "../../components/imoveis/ImportarViaLinkDialog";
import realtyService from "../../services/realtyService";
import {
  formatBRL,
  TIPOS_IMOVEL,
  imovelStatusLabel,
  imovelPurposeLabel,
  mediaUrl,
} from "../../helpers/realtyCrm";
import { exportImoveisPDF, exportImoveisExcel } from "../../helpers/exportImoveis";
import toastError from "../../errors/toastError";
import { toast } from "react-toastify";

const FILTERS = ["Todos", "Ativos", "Venda", "Aluguel", "Exclusivos", "Destaque", "Inativos"];
const QUARTOS_OPTIONS = ["Todos", "1", "2", "3", "4+"];
const SORT_OPTIONS = [
  { value: "recentes", label: "Mais recentes" },
  { value: "antigos", label: "Mais antigos" },
  { value: "preco_asc", label: "Menor preço" },
  { value: "preco_desc", label: "Maior preço" },
  { value: "area_asc", label: "Menor área" },
  { value: "area_desc", label: "Maior área" },
];

const coverOf = (im) => {
  const imgs = im.images || [];
  if (!imgs.length) return null;
  const idx = Number(im.fotoCapaIndex) || 0;
  return mediaUrl(imgs[idx] || imgs[0]);
};

const formatPreco = (preco, purpose) => {
  const formatted = formatBRL(preco);
  return purpose === "aluguel" ? `${formatted}/mês` : formatted;
};

const Imoveis = () => {
  const [imoveis, setImoveis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("Todos");
  const [searchTerm, setSearchTerm] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(true);
  const [filterTipos, setFilterTipos] = useState([]);
  const [filterQuartos, setFilterQuartos] = useState("Todos");
  const [filterBairro, setFilterBairro] = useState("Todos");
  const [priceRange, setPriceRange] = useState([0, 1000000]);
  const [priceTouched, setPriceTouched] = useState(false);
  const [sortBy, setSortBy] = useState("recentes");
  const [viewMode, setViewMode] = useState("grid");
  const [importLinkOpen, setImportLinkOpen] = useState(false);
  const prevMaxRef = useRef(1000000);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await realtyService.listImoveis({ pageSize: 200 });
      setImoveis(data.imoveis || []);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleTipo = (t) =>
    setFilterTipos((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]));

  const bairros = useMemo(() => {
    const set = new Set(imoveis.map((i) => i.neighborhood).filter(Boolean));
    return ["Todos", ...Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"))];
  }, [imoveis]);

  const maxPrice = useMemo(() => {
    if (imoveis.length === 0) return 1000000;
    return Math.max(...imoveis.map((i) => Number(i.price) || 0), 1000000);
  }, [imoveis]);

  useEffect(() => {
    const prevMax = prevMaxRef.current;
    prevMaxRef.current = maxPrice;
    if (!priceTouched) {
      setPriceRange([0, maxPrice]);
      return;
    }
    setPriceRange(([lo, hi]) => {
      const nextHi = hi >= prevMax - 1 ? maxPrice : Math.min(hi, maxPrice);
      return [Math.min(lo, nextHi), nextHi];
    });
  }, [maxPrice, priceTouched]);

  const activeAdvancedCount = useMemo(() => {
    let count = 0;
    if (filterTipos.length > 0) count += 1;
    if (filterQuartos !== "Todos") count += 1;
    if (filterBairro !== "Todos") count += 1;
    if (priceTouched && (priceRange[0] > 0 || priceRange[1] < maxPrice)) count += 1;
    return count;
  }, [filterTipos, filterQuartos, filterBairro, priceRange, maxPrice, priceTouched]);

  const clearAdvancedFilters = () => {
    setFilterTipos([]);
    setFilterQuartos("Todos");
    setFilterBairro("Todos");
    setPriceTouched(false);
    setPriceRange([0, maxPrice]);
  };

  const filtered = useMemo(() => {
    let result = imoveis;
    if (activeFilter === "Ativos") result = result.filter((i) => i.status === "disponivel");
    else if (activeFilter === "Inativos") result = result.filter((i) => i.status === "inativo");
    else if (activeFilter === "Exclusivos")
      result = result.filter((i) => i.exclusivo && i.status !== "inativo");
    else if (activeFilter === "Destaque")
      result = result.filter((i) => i.destaque && i.status !== "inativo");
    else if (activeFilter === "Todos") result = result.filter((i) => i.status !== "inativo");
    else if (activeFilter === "Venda")
      result = result.filter(
        (i) => (i.purpose === "venda" || i.purpose === "ambos") && i.status !== "inativo"
      );
    else if (activeFilter === "Aluguel")
      result = result.filter(
        (i) => (i.purpose === "aluguel" || i.purpose === "ambos") && i.status !== "inativo"
      );

    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      result = result.filter(
        (i) =>
          (i.title || "").toLowerCase().includes(s) ||
          (i.code || "").toLowerCase().includes(s) ||
          (i.address || "").toLowerCase().includes(s) ||
          (i.neighborhood || "").toLowerCase().includes(s) ||
          (i.city || "").toLowerCase().includes(s)
      );
    }

    if (filterTipos.length > 0) {
      result = result.filter((i) =>
        filterTipos.some((t) => (i.type || "").toLowerCase() === t.toLowerCase())
      );
    }
    if (filterQuartos !== "Todos") {
      if (filterQuartos === "4+") result = result.filter((i) => Number(i.bedrooms) >= 4);
      else result = result.filter((i) => Number(i.bedrooms) === Number(filterQuartos));
    }
    if (filterBairro !== "Todos") result = result.filter((i) => i.neighborhood === filterBairro);
    if (priceTouched) {
      result = result.filter(
        (i) => Number(i.price) >= priceRange[0] && Number(i.price) <= priceRange[1]
      );
    }

    switch (sortBy) {
      case "antigos":
        result = [...result].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        break;
      case "preco_asc":
        result = [...result].sort((a, b) => Number(a.price) - Number(b.price));
        break;
      case "preco_desc":
        result = [...result].sort((a, b) => Number(b.price) - Number(a.price));
        break;
      case "area_asc":
        result = [...result].sort((a, b) => Number(a.areaM2) - Number(b.areaM2));
        break;
      case "area_desc":
        result = [...result].sort((a, b) => Number(b.areaM2) - Number(a.areaM2));
        break;
      default:
        result = [...result].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    }
    return result;
  }, [
    imoveis,
    activeFilter,
    searchTerm,
    filterTipos,
    filterQuartos,
    filterBairro,
    priceRange,
    priceTouched,
    sortBy,
  ]);

  const openCreate = () => {
    setEditItem(null);
    setFormOpen(true);
  };

  const openEdit = (im) => {
    setEditItem(im);
    setFormOpen(true);
  };

  const handleSave = async (payload) => {
    setSaving(true);
    try {
      if (editItem?.id) {
        await realtyService.updateImovel(editItem.id, payload);
        toast.success("Imóvel atualizado");
      } else {
        await realtyService.createImovel(payload);
        toast.success("Imóvel cadastrado");
      }
      setFormOpen(false);
      setEditItem(null);
      await load();
    } catch (err) {
      toastError(err);
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (im, status) => {
    try {
      await realtyService.updateImovel(im.id, { status });
      toast.success(status === "inativo" ? "Imóvel inativado" : "Imóvel reativado");
      await load();
    } catch (err) {
      toastError(err);
    }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    try {
      await realtyService.deleteImovel(deleteItem.id);
      toast.success("Imóvel excluído");
      setDeleteItem(null);
      await load();
    } catch (err) {
      toastError(err);
    }
  };

  const addPhotos = async (im, files) => {
    if (!files?.length) return;
    try {
      const { urls } = await realtyService.uploadImovelMedia(files);
      const images = [...(im.images || []), ...(urls || [])];
      await realtyService.updateImovel(im.id, { images });
      toast.success("Fotos adicionadas");
      await load();
    } catch (err) {
      toastError(err);
    }
  };

  const priceStep = Math.max(1000, Math.round(maxPrice / 100));

  const renderCardActions = (im, compact = false) => (
    <div className={`realty-imovel-card__actions${compact ? " is-compact" : ""}`}>
      <label title="Adicionar fotos">
        <Plus size={14} />
        <input
          type="file"
          multiple
          accept="image/*"
          hidden
          onChange={(e) => {
            addPhotos(im, Array.from(e.target.files || []));
            e.target.value = "";
          }}
        />
      </label>
      <button
        type="button"
        title={im.status === "inativo" ? "Ativar" : "Inativar"}
        onClick={() => setStatus(im, im.status === "inativo" ? "disponivel" : "inativo")}
      >
        {im.status === "inativo" ? <PowerOff size={14} /> : <Power size={14} />}
      </button>
      <button type="button" title="Editar" onClick={() => openEdit(im)}>
        <Edit size={14} />
      </button>
      <button type="button" title="Excluir" onClick={() => setDeleteItem(im)}>
        <Trash2 size={14} />
      </button>
    </div>
  );

  return (
    <MainContainer autoHeight>
      <div className="realty-page realty-carteira-page">
        <div className="realty-carteira-header">
          <div>
            <div className="realty-carteira-eyebrow">Carteira Premium</div>
            <h1 className="realty-page__title">Gestão de Imóveis</h1>
            <p className="realty-page__subtitle">
              {imoveis.length} imóveis cadastrados · Controle sua carteira de alto padrão.
            </p>
          </div>
          <div className="realty-carteira-actions">
            <button
              type="button"
              className="realty-page__btn realty-page__btn--ghost"
              disabled={!filtered.length}
              onClick={() =>
                exportImoveisPDF({
                  imoveis: filtered,
                  filterLabel: `Filtro: ${activeFilter}`,
                })
              }
            >
              <Download size={16} /> PDF
            </button>
            <button
              type="button"
              className="realty-page__btn realty-page__btn--ghost"
              disabled={!filtered.length}
              onClick={() => exportImoveisExcel({ imoveis: filtered })}
            >
              <Download size={16} /> Excel
            </button>
            <span className="realty-carteira-divider" />
            <button
              type="button"
              className="realty-page__btn realty-page__btn--ghost"
              onClick={() => setImportLinkOpen(true)}
            >
              <Link2 size={16} /> Importar via Link
            </button>
            <button type="button" className="realty-page__btn" onClick={openCreate}>
              <Plus size={16} /> Novo Imóvel
            </button>
          </div>
        </div>

        <div className="realty-carteira-filterbar">
          <nav className="realty-carteira-tabs">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                className={`realty-carteira-tab${activeFilter === f ? " is-active" : ""}`}
                onClick={() => setActiveFilter(f)}
              >
                {f}
              </button>
            ))}
          </nav>
          <div className="realty-carteira-tools">
            <div className="realty-search-wrap realty-carteira-search">
              <Search size={16} />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por código, endereço ou bairro..."
              />
            </div>
            <button
              type="button"
              className={`realty-page__btn${showAdvanced || activeAdvancedCount ? "" : " realty-page__btn--ghost"}`}
              onClick={() => setShowAdvanced((v) => !v)}
            >
              <SlidersHorizontal size={14} /> Filtros
              {activeAdvancedCount > 0 ? (
                <span className="realty-carteira-badge">{activeAdvancedCount}</span>
              ) : null}
            </button>
            <select
              className="realty-page__search realty-page__select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <div className="realty-carteira-viewtoggle">
              <button
                type="button"
                className={viewMode === "grid" ? "is-active" : ""}
                onClick={() => setViewMode("grid")}
                title="Grade"
              >
                <LayoutGrid size={16} />
              </button>
              <button
                type="button"
                className={viewMode === "list" ? "is-active" : ""}
                onClick={() => setViewMode("list")}
                title="Lista"
              >
                <List size={16} />
              </button>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {showAdvanced && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="realty-carteira-advanced-wrap"
            >
              <div className="realty-carteira-advanced">
                <div className="realty-carteira-advanced__head">
                  <h3>Filtros Avançados</h3>
                  {activeAdvancedCount > 0 && (
                    <button type="button" onClick={clearAdvancedFilters}>
                      <X size={12} /> Limpar filtros
                    </button>
                  )}
                </div>

                <div className="realty-carteira-advanced__tipos">
                  <label>
                    Tipo de Imóvel
                    {filterTipos.length > 0
                      ? ` (${filterTipos.length} selecionado${filterTipos.length > 1 ? "s" : ""})`
                      : ""}
                  </label>
                  <div className="realty-carteira-tipo-chips">
                    {TIPOS_IMOVEL.map((t) => {
                      const active = filterTipos.includes(t);
                      return (
                        <button
                          key={t}
                          type="button"
                          className={`realty-carteira-tipo-chip${active ? " is-active" : ""}`}
                          onClick={() => toggleTipo(t)}
                        >
                          <span className="realty-carteira-check">{active ? "✓" : ""}</span>
                          {t}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="realty-carteira-advanced__grid">
                  <label className="realty-filter-field">
                    Quartos
                    <select
                      value={filterQuartos}
                      onChange={(e) => setFilterQuartos(e.target.value)}
                    >
                      {QUARTOS_OPTIONS.map((q) => (
                        <option key={q} value={q}>
                          {q === "Todos"
                            ? "Todos"
                            : q === "4+"
                              ? "4 ou mais"
                              : `${q} quarto${q === "1" ? "" : "s"}`}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="realty-filter-field">
                    Bairro
                    <select
                      value={filterBairro}
                      onChange={(e) => setFilterBairro(e.target.value)}
                    >
                      {bairros.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="realty-filter-field realty-carteira-price">
                    Faixa de Preço: {formatBRL(priceRange[0])} — {formatBRL(priceRange[1])}
                    <div className="realty-carteira-price-inputs">
                      <input
                        type="range"
                        min={0}
                        max={maxPrice}
                        step={priceStep}
                        value={priceRange[0]}
                        onChange={(e) => {
                          setPriceTouched(true);
                          setPriceRange(([_, hi]) => [
                            Math.min(Number(e.target.value), hi),
                            hi,
                          ]);
                        }}
                      />
                      <input
                        type="range"
                        min={0}
                        max={maxPrice}
                        step={priceStep}
                        value={priceRange[1]}
                        onChange={(e) => {
                          setPriceTouched(true);
                          setPriceRange(([lo]) => [
                            lo,
                            Math.max(Number(e.target.value), lo),
                          ]);
                        }}
                      />
                    </div>
                  </label>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {loading ? (
          <div className="realty-empty">
            <Loader2 size={32} className="animate-spin" style={{ color: "#2673d9" }} />
            <p>Carregando imóveis...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="realty-empty">
            <ImageOff size={40} style={{ opacity: 0.35 }} />
            <p>
              {imoveis.length === 0
                ? "Nenhum imóvel cadastrado ainda."
                : "Nenhum imóvel encontrado com esses filtros."}
            </p>
            {imoveis.length === 0 && (
              <button
                type="button"
                className="realty-page__btn"
                style={{ marginTop: 12 }}
                onClick={openCreate}
              >
                Cadastrar primeiro imóvel
              </button>
            )}
          </div>
        ) : viewMode === "grid" ? (
          <div className="realty-carteira-grid">
            {filtered.map((im, i) => {
              const cover = coverOf(im);
              return (
                <motion.article
                  key={im.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.3) }}
                  className="realty-imovel-card"
                >
                  <div className="realty-imovel-card__media">
                    {cover ? (
                      <img src={cover} alt={im.title} />
                    ) : (
                      <div className="realty-imovel-card__empty">
                        <ImageOff size={36} />
                      </div>
                    )}
                    <div className="realty-imovel-card__badges">
                      <span>{imovelPurposeLabel(im.purpose)}</span>
                      {im.destaque ? <span className="is-gold">Destaque</span> : null}
                      {im.exclusivo ? <span className="is-outline">Exclusivo</span> : null}
                    </div>
                    {renderCardActions(im)}
                    <div className="realty-imovel-card__overlay">
                      <div className="realty-imovel-card__loc">
                        <MapPin size={12} />
                        {[im.neighborhood, im.city].filter(Boolean).join(", ") ||
                          "Localização não informada"}
                      </div>
                      <h3>{im.title}</h3>
                    </div>
                    {["inativo", "reservado", "vendido"].includes(im.status) && (
                      <div className={`realty-imovel-card__status-badge is-${im.status}`}>
                        <span className="realty-imovel-card__status-pill">
                          {imovelStatusLabel(im.status)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="realty-imovel-card__body">
                    <div className="realty-imovel-card__price-row">
                      <div>
                        <p className="realty-imovel-card__price-label">
                          {im.purpose === "aluguel" ? "Locação Mensal" : "Valor do Imóvel"}
                        </p>
                        <p className="realty-imovel-card__price">
                          {formatPreco(im.price, im.purpose)}
                        </p>
                        {(Number(im.condoFee) > 0 || Number(im.iptu) > 0) && (
                          <div className="realty-imovel-card__fees">
                            {Number(im.condoFee) > 0 && (
                              <span>Cond: {formatBRL(im.condoFee)}</span>
                            )}
                            {Number(im.iptu) > 0 && <span>IPTU: {formatBRL(im.iptu)}</span>}
                          </div>
                        )}
                      </div>
                      <div className="realty-imovel-card__type">
                        <p>{im.type || "—"}</p>
                        <strong className={im.status === "disponivel" ? "is-ok" : undefined}>
                          {imovelStatusLabel(im.status)}
                        </strong>
                      </div>
                    </div>
                    <div className="realty-imovel-card__stats">
                      <div>
                        <strong>{String(im.bedrooms || 0).padStart(2, "0")}</strong>
                        <span>Quartos</span>
                      </div>
                      <div>
                        <strong>{String(im.bathrooms || 0).padStart(2, "0")}</strong>
                        <span>Banh.</span>
                      </div>
                      <div>
                        <strong>{String(im.parkingSpots || 0).padStart(2, "0")}</strong>
                        <span>Vagas</span>
                      </div>
                      <div>
                        <strong>
                          {im.areaM2 || 0}
                          <small>m²</small>
                        </strong>
                        <span>Área</span>
                      </div>
                    </div>
                    {(im.aceitaPermuta ||
                      im.aceitaFinanciamento ||
                      im.temEscritura ||
                      im.portalOrigem ||
                      im.urlAnuncio) && (
                      <div className="realty-imovel-card__tags">
                        {im.aceitaPermuta && <span>Permuta</span>}
                        {im.aceitaFinanciamento && <span>Financiamento</span>}
                        {im.temEscritura && <span>Escritura</span>}
                        {im.portalOrigem && <span className="is-muted">{im.portalOrigem}</span>}
                        {im.urlAnuncio && (
                          <a href={im.urlAnuncio} target="_blank" rel="noopener noreferrer">
                            Ver anúncio ↗
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </motion.article>
              );
            })}
          </div>
        ) : (
          <div className="realty-carteira-list">
            {filtered.map((im, i) => {
              const cover = coverOf(im);
              return (
                <motion.article
                  key={im.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i * 0.02, 0.25) }}
                  className="realty-imovel-row"
                >
                  <div className="realty-imovel-row__thumb">
                    {cover ? (
                      <img src={cover} alt={im.title} />
                    ) : (
                      <ImageOff size={24} style={{ opacity: 0.35 }} />
                    )}
                    <span className="realty-imovel-row__purpose">
                      {imovelPurposeLabel(im.purpose)}
                    </span>
                  </div>
                  <div className="realty-imovel-row__body">
                    <div className="realty-imovel-row__top">
                      <div>
                        <h3>{im.title}</h3>
                        <p>
                          <MapPin size={12} />
                          {[im.address, im.neighborhood, im.city].filter(Boolean).join(", ") ||
                            "—"}
                        </p>
                      </div>
                      {renderCardActions(im, true)}
                    </div>
                    <div className="realty-imovel-row__bottom">
                      <div className="realty-imovel-row__meta">
                        <span>
                          <Bed size={14} /> {im.bedrooms || 0}
                        </span>
                        <span>
                          <Bath size={14} /> {im.bathrooms || 0}
                        </span>
                        <span>
                          <Car size={14} /> {im.parkingSpots || 0}
                        </span>
                        <span>
                          <Maximize size={14} /> {im.areaM2 || 0}m²
                        </span>
                        {im.exclusivo && <em>Exclusivo</em>}
                        {im.destaque && <em>Destaque</em>}
                        <em>{imovelStatusLabel(im.status)}</em>
                      </div>
                      <strong>{formatPreco(im.price, im.purpose)}</strong>
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </div>
        )}

        <ImovelFormDialog
          open={formOpen}
          onClose={() => {
            setFormOpen(false);
            setEditItem(null);
          }}
          imovel={editItem}
          onSave={handleSave}
          saving={saving}
        />

        <ImportarViaLinkDialog
          open={importLinkOpen}
          onClose={() => setImportLinkOpen(false)}
          onImported={load}
        />

        {deleteItem && (
          <div className="realty-modal-backdrop" onClick={() => setDeleteItem(null)}>
            <div
              className="realty-modal realty-imovel-modal--import"
              onClick={(e) => e.stopPropagation()}
            >
              <h2>O que deseja fazer com &quot;{deleteItem.title}&quot;?</h2>
              <p className="realty-page__subtitle">
                Você pode inativar o imóvel (ficará oculto mas poderá ser reativado) ou
                excluí-lo permanentemente.
              </p>
              <div className="realty-imovel-dialog-actions">
                <button
                  type="button"
                  className="realty-page__btn realty-page__btn--ghost"
                  onClick={() => setDeleteItem(null)}
                >
                  Cancelar
                </button>
                {deleteItem.status !== "inativo" ? (
                  <button
                    type="button"
                    className="realty-page__btn realty-page__btn--ghost"
                    onClick={async () => {
                      const id = deleteItem.id;
                      setDeleteItem(null);
                      await setStatus({ id }, "inativo");
                    }}
                  >
                    Inativar
                  </button>
                ) : (
                  <button
                    type="button"
                    className="realty-page__btn"
                    onClick={async () => {
                      const id = deleteItem.id;
                      setDeleteItem(null);
                      await setStatus({ id }, "disponivel");
                    }}
                  >
                    Reativar
                  </button>
                )}
                <button
                  type="button"
                  className="realty-page__btn realty-page__btn--danger"
                  onClick={handleDelete}
                >
                  Excluir Permanentemente
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainContainer>
  );
};

export default Imoveis;
