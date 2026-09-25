import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { GridSkeleton } from "@/components/shared/PageSkeletons";
import { SectionHeader } from "@/components/shared/MetricCard";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Search, Plus, MapPin, Bed, Bath, Car, Maximize, Edit, Trash2, Loader2, ImageOff, DoorOpen, Download, SlidersHorizontal, X, ArrowUpDown, LayoutGrid, List, Power, PowerOff, Link2, FolderDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { exportToPDF } from "@/lib/exportPDF";
import { exportToExcel } from "@/lib/exportExcel";
import { ShareMenu } from "@/components/imoveis/ShareMenu";
import { useImoveis, type Imovel } from "@/hooks/useImoveis";
import { useImobiliariaConfig } from "@/hooks/useImobiliariaConfig";
import { ImovelFormDialog } from "@/components/imoveis/ImovelFormDialog";
import { ImportarViaLinkDialog } from "@/components/imoveis/ImportarViaLinkDialog";

import { useAuth } from "@/contexts/AuthContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

import { WebResearchDialog } from "@/components/shared/WebResearchDialog";

const filters = ["Todos", "Ativos", "Venda", "Aluguel", "Exclusivos", "Destaque", "Inativos"];
const TIPOS_IMOVEL = ["Apartamento", "Casa", "Terreno", "Comercial", "Cobertura", "Kitnet", "Chácara", "Sala", "Loja", "Galpão", "Sobrado", "Studio", "Flat", "Fazenda", "Sítio", "Prédio"];
const QUARTOS_OPTIONS = ["Todos", "1", "2", "3", "4+"];
const SORT_OPTIONS = [
  { value: "recentes", label: "Mais recentes" },
  { value: "antigos", label: "Mais antigos" },
  { value: "preco_asc", label: "Menor preço" },
  { value: "preco_desc", label: "Maior preço" },
  { value: "area_asc", label: "Menor área" },
  { value: "area_desc", label: "Maior área" },
];

const formatPreco = (preco: number, operacao: string) => {
  const formatted = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(preco);
  return operacao === "Aluguel" ? `${formatted}/mês` : formatted;
};

const IMOVEIS_DIALOG_KEY = "imoveis_dialog_state";

const downloadAllFotos = async (imovel: { titulo: string; fotos: string[] | null }) => {
  if (!imovel.fotos || imovel.fotos.length === 0) return;
  const safeName = imovel.titulo.replace(/[^a-z0-9]+/gi, "_").slice(0, 40);
  for (let i = 0; i < imovel.fotos.length; i++) {
    const url = imovel.fotos[i];
    try {
      const res = await fetch(url, { mode: "cors" });
      const blob = await res.blob();
      const ext = (blob.type.split("/")[1] || "jpg").split(";")[0];
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `${safeName}_${i + 1}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch {
      // Fallback: open in new tab
      window.open(url, "_blank");
    }
  }
};

const Imoveis = () => {
  const { imoveis, loading, createImovel, updateImovel, deleteImovel, uploadFotos, uploadDocs, refetch } = useImoveis();
  const { nome_empresa } = useImobiliariaConfig();
  const { isMaster } = useAuth();
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState("Todos");
  const [searchTerm, setSearchTerm] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<Imovel | null>(null);
  const [deleteItem, setDeleteItem] = useState<Imovel | null>(null);
  const [saving, setSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(true);
  const [filterTipos, setFilterTipos] = useState<string[]>([]);
  const toggleTipo = (t: string) => setFilterTipos((p) => p.includes(t) ? p.filter(x => x !== t) : [...p, t]);
  const [filterQuartos, setFilterQuartos] = useState("Todos");
  const [filterBairro, setFilterBairro] = useState("Todos");
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 0]);
  const [priceInitialized, setPriceInitialized] = useState(false);
  const [sortBy, setSortBy] = useState("recentes");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [importLinkOpen, setImportLinkOpen] = useState(false);
  

  // Persist dialog state
  const persistDialogState = useCallback((isOpen: boolean, editId?: string | null) => {
    try {
      if (isOpen) {
        localStorage.setItem(IMOVEIS_DIALOG_KEY, JSON.stringify({ open: true, editId: editId || null }));
      } else {
        localStorage.removeItem(IMOVEIS_DIALOG_KEY);
      }
    } catch { /* ignore */ }
  }, []);

  // Restore dialog state on mount
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    try {
      const saved = localStorage.getItem(IMOVEIS_DIALOG_KEY);
      if (!saved) return;
      const state = JSON.parse(saved);
      if (!state?.open) return;

      if (state.editId) {
        if (imoveis.length === 0) return;
        const found = imoveis.find(i => i.id === state.editId);
        if (!found) return;
        setEditItem(found);
      } else {
        setEditItem(null);
      }
      setFormOpen(true);
      restoredRef.current = true;
    } catch { /* ignore */ }
  }, [imoveis]);

  // Extract unique bairros
  const bairros = useMemo(() => {
    const set = new Set(imoveis.map((i) => i.bairro).filter(Boolean) as string[]);
    return ["Todos", ...Array.from(set).sort()];
  }, [imoveis]);

  // Max price for slider
  const maxPrice = useMemo(() => {
    if (imoveis.length === 0) return 1000000;
    return Math.max(...imoveis.map((i) => i.preco), 1000000);
  }, [imoveis]);

  useEffect(() => {
    if (priceInitialized || imoveis.length === 0) return;
    setPriceRange([0, maxPrice]);
    setPriceInitialized(true);
  }, [priceInitialized, imoveis.length, maxPrice]);

  const activeAdvancedCount = useMemo(() => {
    let count = 0;
    if (filterTipos.length > 0) count++;
    if (filterQuartos !== "Todos") count++;
    if (filterBairro !== "Todos") count++;
    if (priceInitialized && (priceRange[0] > 0 || priceRange[1] < maxPrice)) count++;
    return count;
  }, [filterTipos, filterQuartos, filterBairro, priceRange, maxPrice, priceInitialized]);

  const clearAdvancedFilters = () => {
    setFilterTipos([]);
    setFilterQuartos("Todos");
    setFilterBairro("Todos");
    setPriceRange([0, maxPrice]);
  };

  const filtered = useMemo(() => {
    let result = imoveis;
    if (activeFilter === "Ativos") result = result.filter((i) => i.status === "Ativo");
    else if (activeFilter === "Inativos") result = result.filter((i) => i.status === "Inativo");
    else if (activeFilter === "Exclusivos") result = result.filter((i) => i.exclusivo && i.status !== "Inativo");
    else if (activeFilter === "Destaque") result = result.filter((i) => i.destaque && i.status !== "Inativo");
    else if (activeFilter === "Todos") result = result.filter((i) => i.status !== "Inativo");
    else result = result.filter((i) => i.operacao === activeFilter && i.status !== "Inativo");
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      result = result.filter((i) =>
        i.titulo.toLowerCase().includes(s) ||
        (i.endereco?.toLowerCase().includes(s)) ||
        (i.bairro?.toLowerCase().includes(s)) ||
        (i.cidade?.toLowerCase().includes(s))
      );
    }
    // Advanced filters
    if (filterTipos.length > 0) result = result.filter((i) => filterTipos.includes(i.tipo));
    if (filterQuartos !== "Todos") {
      if (filterQuartos === "4+") result = result.filter((i) => i.quartos >= 4);
      else result = result.filter((i) => i.quartos === Number(filterQuartos));
    }
    if (filterBairro !== "Todos") result = result.filter((i) => i.bairro === filterBairro);
    if (priceInitialized) {
      result = result.filter((i) => i.preco >= priceRange[0] && i.preco <= priceRange[1]);
    }
    // Sorting
    switch (sortBy) {
      case "recentes": result = [...result].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()); break;
      case "antigos": result = [...result].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()); break;
      case "preco_asc": result = [...result].sort((a, b) => a.preco - b.preco); break;
      case "preco_desc": result = [...result].sort((a, b) => b.preco - a.preco); break;
      case "area_asc": result = [...result].sort((a, b) => a.area - b.area); break;
      case "area_desc": result = [...result].sort((a, b) => b.area - a.area); break;
    }
    return result;
  }, [imoveis, activeFilter, searchTerm, filterTipos, filterQuartos, filterBairro, priceRange, priceInitialized, sortBy]);

  const openCreate = () => { setEditItem(null); persistDialogState(true, null); setFormOpen(true); };
  const openEdit = (im: Imovel) => { setEditItem(im); persistDialogState(true, im.id); setFormOpen(true); };

  const handleSave = async (data: Record<string, any>, newPhotos: File[], newDocs?: { matricula: File[]; iptu: File[]; outros: File[]; videos: File[] }) => {
    setSaving(true);
    try {
      let photoUrls: string[] = data._existingFotos ?? [];
      delete data._existingFotos;

      let matriculaUrls: string[] = data._existingMatricula ?? [];
      let iptuUrls: string[] = data._existingIptu ?? [];
      let outrosUrls: string[] = data._existingOutros ?? [];
      let videosUrls: string[] = data._existingVideos ?? [];
      delete data._existingMatricula;
      delete data._existingIptu;
      delete data._existingOutros;
      delete data._existingVideos;

      if (newPhotos.length > 0) {
        const uploaded = await uploadFotos(newPhotos);
        photoUrls = [...photoUrls, ...uploaded];
      }

      if (newDocs) {
        if (newDocs.matricula.length > 0) {
          const uploaded = await uploadDocs(newDocs.matricula);
          matriculaUrls = [...matriculaUrls, ...uploaded];
        }
        if (newDocs.iptu.length > 0) {
          const uploaded = await uploadDocs(newDocs.iptu);
          iptuUrls = [...iptuUrls, ...uploaded];
        }
        if (newDocs.outros.length > 0) {
          const uploaded = await uploadDocs(newDocs.outros);
          outrosUrls = [...outrosUrls, ...uploaded];
        }
        if (newDocs.videos.length > 0) {
          const uploaded = await uploadFotos(newDocs.videos);
          videosUrls = [...videosUrls, ...uploaded];
        }
      }

      const payload = {
        ...data,
        fotos: photoUrls,
        documentos_matricula: matriculaUrls,
        documentos_iptu: iptuUrls,
        documentos_outros: outrosUrls,
        videos: videosUrls,
      };

      const saved = editItem
        ? await updateImovel(editItem.id, payload)
        : Boolean(await createImovel(payload));

      if (!saved) {
        return false;
      }

      setFormOpen(false);
      persistDialogState(false);
      return true;
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    await deleteImovel(deleteItem.id);
    setDeleteItem(null);
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-end justify-between flex-wrap gap-4 pb-4 border-b border-[#0B1B34]/10">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#B08E4C] mb-1">Carteira Premium</div>
            <h2 className="font-editorial text-3xl md:text-4xl font-semibold text-[#0B1B34] leading-tight">Gestão de Imóveis</h2>
            <p className="text-sm text-muted-foreground mt-1.5">{imoveis.length} imóveis cadastrados · Controle sua carteira de alto padrão.</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => {
                const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
                const totalValor = filtered.reduce((s, i) => s + i.preco, 0);
                const vendas = filtered.filter(i => i.operacao === "Venda").length;
                const alugueis = filtered.filter(i => i.operacao === "Aluguel").length;
                exportToPDF({
                  brandName: nome_empresa || undefined,
                  title: "Relatório de Imóveis",
                  subtitle: `${filtered.length} imóveis · Filtro: ${activeFilter}`,
                  summary: [
                    { label: "Total", value: String(filtered.length) },
                    { label: "Venda", value: String(vendas) },
                    { label: "Aluguel", value: String(alugueis) },
                    { label: "Valor Total", value: fmt(totalValor) },
                  ],
                  columns: [
                    { header: "Título", dataKey: "titulo" },
                    { header: "Tipo", dataKey: "tipo" },
                    { header: "Operação", dataKey: "operacao" },
                    { header: "Preço", dataKey: "precoFmt" },
                    { header: "Quartos", dataKey: "quartos" },
                    { header: "Área", dataKey: "area" },
                    { header: "Localização", dataKey: "local" },
                    { header: "Status", dataKey: "status" },
                    { header: "Portal", dataKey: "portal" },
                    { header: "Link do Anúncio", dataKey: "url" },
                  ],
                  data: filtered.map(i => ({
                    titulo: i.titulo,
                    tipo: i.tipo,
                    operacao: i.operacao,
                    precoFmt: fmt(i.preco),
                    quartos: String(i.quartos),
                    area: `${i.area}m²`,
                    local: [i.bairro, i.cidade].filter(Boolean).join(", ") || "—",
                    status: i.status,
                    portal: (i as any).portal_origem || "—",
                    url: (i as any).url_anuncio || "—",
                  })),
                });
              }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary text-foreground text-sm font-medium hover:bg-secondary/80 transition-colors"
            >
              <Download className="w-4 h-4" />PDF
            </button>
            <button
              onClick={() => {
                const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
                exportToExcel({
                  fileName: `imoveis_${new Date().toISOString().slice(0, 10)}`,
                  sheetName: "Imóveis",
                  columns: [
                    { header: "Título", key: "titulo" },
                    { header: "Tipo", key: "tipo" },
                    { header: "Operação", key: "operacao" },
                    { header: "Preço", key: "preco" },
                    { header: "Quartos", key: "quartos" },
                    { header: "Banheiros", key: "banheiros" },
                    { header: "Vagas", key: "vagas" },
                    { header: "Área (m²)", key: "area" },
                    { header: "Endereço", key: "endereco" },
                    { header: "Bairro", key: "bairro" },
                    { header: "Cidade", key: "cidade" },
                    { header: "Status", key: "status" },
                    { header: "Portal de Origem", key: "portal" },
                    { header: "Link do Anúncio", key: "url" },
                  ],
                  data: filtered.map(i => ({
                    titulo: i.titulo,
                    tipo: i.tipo,
                    operacao: i.operacao,
                    preco: fmt(i.preco),
                    quartos: i.quartos,
                    banheiros: i.banheiros,
                    vagas: i.vagas,
                    area: i.area,
                    endereco: i.endereco || "",
                    bairro: i.bairro || "",
                    cidade: i.cidade || "",
                    status: i.status,
                    portal: (i as any).portal_origem || "",
                    url: (i as any).url_anuncio || "",
                  })),
                });
              }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary text-foreground text-sm font-medium hover:bg-secondary/80 transition-colors"
            >
              <Download className="w-4 h-4" />Excel
            </button>
            <div className="w-px h-6 bg-[#0B1B34]/10 mx-1" />
            <button onClick={() => setImportLinkOpen(true)} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white text-[#0B1B34] text-sm font-medium hover:border-[#C9A96A] transition-colors border border-[#0B1B34]/10">
              <Link2 className="w-4 h-4 text-[#B08E4C]" />Importar via Link
            </button>
            {isMaster && (
              <button onClick={() => setImportLinkOpen(true)} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white text-[#0B1B34] text-sm font-medium hover:border-[#C9A96A] transition-colors border border-[#0B1B34]/10">
                <FolderDown className="w-4 h-4 text-[#B08E4C]" />Importar Carteira
              </button>
            )}
            <button onClick={openCreate} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0B1B34] text-white text-sm font-semibold hover:bg-[#12244A] transition-all shadow-lg shadow-[#0B1B34]/10 border-b-2 border-[#C9A96A]">
              <Plus className="w-4 h-4 text-[#C9A96A]" />Novo Imóvel
            </button>
          </div>
        </div>
      </div>


      {/* Filters */}
      <div className="bg-white rounded-2xl border border-[#0B1B34]/10 shadow-sm p-2 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <nav className="flex px-2 overflow-x-auto no-scrollbar">
            {filters.map((f) => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`px-4 py-2.5 text-sm whitespace-nowrap transition-colors border-b-2 ${
                  activeFilter === f
                    ? "border-[#C9A96A] text-[#0B1B34] font-semibold"
                    : "border-transparent text-slate-500 hover:text-[#0B1B34] font-medium"
                }`}
              >
                {f}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-2 px-2 py-1 flex-wrap">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por código, endereço ou bairro..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-transparent rounded-xl text-sm text-foreground placeholder:text-slate-400 focus:bg-white focus:border-[#C9A96A] focus:ring-0 outline-none transition-all"
              />
            </div>
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all border ${
                showAdvanced || activeAdvancedCount > 0
                  ? "bg-[#0B1B34] text-white border-[#0B1B34]"
                  : "bg-white text-[#0B1B34] border-[#0B1B34]/10 hover:border-[#C9A96A]"
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Filtros
              {activeAdvancedCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-4 min-w-4 px-1 flex items-center justify-center text-[10px] bg-[#C9A96A] text-[#0B1B34] border-0">
                  {activeAdvancedCount}
                </Badge>
              )}
            </button>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="bg-white border-[#0B1B34]/10 h-10 w-auto min-w-[150px] text-xs font-medium gap-1.5 rounded-xl">
                <ArrowUpDown className="w-3.5 h-3.5 flex-shrink-0 text-[#B08E4C]" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center bg-white rounded-xl border border-[#0B1B34]/10 p-1">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded-lg transition-colors ${viewMode === "grid" ? "bg-[#0B1B34] text-white" : "text-slate-400 hover:text-[#0B1B34]"}`}
                title="Visualização em grade"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-1.5 rounded-lg transition-colors ${viewMode === "list" ? "bg-[#0B1B34] text-white" : "text-slate-400 hover:text-[#0B1B34]"}`}
                title="Visualização em lista"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>


      {/* Advanced Filters Panel */}
      <AnimatePresence>
        {showAdvanced && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mb-6"
          >
            <div className="glass-card p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-foreground">Filtros Avançados</h3>
                {activeAdvancedCount > 0 && (
                  <button onClick={clearAdvancedFilters} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
                    <X className="w-3 h-3" /> Limpar filtros
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Tipo - multi-select com checkboxes */}
                <div className="sm:col-span-2 lg:col-span-4">
                  <label className="text-xs text-muted-foreground mb-2 block">
                    Tipo de Imóvel {filterTipos.length > 0 && <span className="text-primary">({filterTipos.length} selecionado{filterTipos.length > 1 ? "s" : ""})</span>}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {TIPOS_IMOVEL.map((t) => {
                      const active = filterTipos.includes(t);
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => toggleTipo(t)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs transition-all ${active ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border text-foreground hover:border-primary/50"}`}
                        >
                          <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${active ? "bg-primary-foreground border-primary-foreground" : "border-muted-foreground"}`}>
                            {active && <span className="text-primary text-[10px] font-bold">✓</span>}
                          </span>
                          {t}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {/* Quartos */}
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Quartos</label>
                  <Select value={filterQuartos} onValueChange={setFilterQuartos}>
                    <SelectTrigger className="bg-secondary border-border h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {QUARTOS_OPTIONS.map((q) => (
                        <SelectItem key={q} value={q}>{q === "Todos" ? "Todos" : q === "4+" ? "4 ou mais" : `${q} quarto${q === "1" ? "" : "s"}`}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {/* Bairro */}
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Bairro</label>
                  <Select value={filterBairro} onValueChange={setFilterBairro}>
                    <SelectTrigger className="bg-secondary border-border h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {bairros.map((b) => (
                        <SelectItem key={b} value={b}>{b}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {/* Faixa de Preço */}
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">
                    Faixa de Preço: {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(priceRange[0])} — {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(priceRange[1])}
                  </label>
                  <Slider
                    min={0}
                    max={maxPrice}
                    step={Math.max(1000, Math.round(maxPrice / 100))}
                    value={priceRange}
                    onValueChange={(v) => setPriceRange(v as [number, number])}
                    className="mt-2"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Grid */}
      {loading ? (
        <GridSkeleton />
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <ImageOff className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-sm">{imoveis.length === 0 ? "Nenhum imóvel cadastrado ainda." : "Nenhum imóvel encontrado com esses filtros."}</p>
          {imoveis.length === 0 && (
            <button onClick={openCreate} className="mt-3 text-sm text-primary hover:underline">Cadastrar primeiro imóvel</button>
          )}
        </div>
      ) : (
        <div className={viewMode === "grid" ? "grid gap-6 [grid-template-columns:repeat(auto-fit,minmax(min(20rem,100%),1fr))]" : "flex flex-col gap-3"}>
          {filtered.map((imovel, i) => (
            viewMode === "grid" ? (
              <motion.div
                key={imovel.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="group bg-white rounded-2xl border border-[#0B1B34]/10 overflow-hidden cursor-pointer hover:shadow-2xl hover:shadow-slate-200/60 hover:border-[#C9A96A]/40 transition-all duration-500"
                onClick={() => navigate(`/imovel/${imovel.id}`)}
              >
                <div className="relative h-64 overflow-hidden bg-slate-100">
                  {imovel.fotos && imovel.fotos.length > 0 ? (
                    <img src={imovel.fotos[0]} alt={imovel.titulo} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                      <ImageOff className="w-12 h-12" />
                    </div>
                  )}
                  <div className="absolute top-4 left-4 flex flex-col gap-1.5 items-start">
                    <span className="px-3 py-1 bg-[#0B1B34]/90 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-widest rounded-full">
                      {imovel.operacao}
                    </span>
                    {imovel.destaque && <span className="px-3 py-1 bg-[#C9A96A]/95 backdrop-blur-md text-[#0B1B34] text-[10px] font-bold uppercase tracking-widest rounded-full">Destaque</span>}
                    {imovel.exclusivo && <span className="px-3 py-1 bg-white/90 backdrop-blur-md text-[#0B1B34] text-[10px] font-bold uppercase tracking-widest rounded-full border border-[#C9A96A]/40">Exclusivo</span>}
                  </div>
                  <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const event = new CustomEvent("open-property-research", { detail: imovel });
                        window.dispatchEvent(event);
                      }}
                      className="w-8 h-8 rounded-full bg-white/90 backdrop-blur flex items-center justify-center text-[#0B1B34] hover:bg-[#C9A96A] hover:text-white transition-colors"
                      title="Inteligência de Mercado"
                    >
                      <Search className="w-4 h-4" />
                    </button>
                    <ShareMenu id={imovel.id} titulo={imovel.titulo} preco={imovel.preco} operacao={imovel.operacao} endereco={imovel.endereco} bairro={imovel.bairro} cidade={imovel.cidade} quartos={imovel.quartos} area={imovel.area} fotos={imovel.fotos ?? []} />
                    <label
                      className="w-8 h-8 rounded-full bg-white/90 backdrop-blur flex items-center justify-center text-[#0B1B34] hover:bg-[#C9A96A] hover:text-white transition-colors cursor-pointer"
                      title="Adicionar fotos"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Plus className="w-4 h-4" />
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const files = Array.from(e.target.files || []);
                          if (!files.length) return;
                          const uploaded = await uploadFotos(files);
                          if (uploaded.length) {
                            const novas = [...(imovel.fotos ?? []), ...uploaded];
                            await updateImovel(imovel.id, { fotos: novas } as any);
                          }
                          e.target.value = "";
                        }}
                      />
                    </label>
                    <button
                      onClick={(e) => { e.stopPropagation(); downloadAllFotos(imovel); }}
                      disabled={!imovel.fotos || imovel.fotos.length === 0}
                      className="w-8 h-8 rounded-full bg-white/90 backdrop-blur flex items-center justify-center text-[#0B1B34] hover:bg-[#C9A96A] hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Baixar todas as fotos"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={async () => {
                        const newStatus = imovel.status === "Inativo" ? "Ativo" : "Inativo";
                        await updateImovel(imovel.id, { status: newStatus } as any);
                      }}
                      className="w-8 h-8 rounded-full bg-white/90 backdrop-blur flex items-center justify-center text-[#0B1B34] hover:bg-warning hover:text-white transition-colors"
                      title={imovel.status === "Inativo" ? "Ativar" : "Inativar"}
                    >
                      {imovel.status === "Inativo" ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                    </button>
                    <button onClick={() => openEdit(imovel)} className="w-8 h-8 rounded-full bg-white/90 backdrop-blur flex items-center justify-center text-[#0B1B34] hover:bg-[#C9A96A] hover:text-white transition-colors">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button onClick={() => setDeleteItem(imovel)} className="w-8 h-8 rounded-full bg-white/90 backdrop-blur flex items-center justify-center text-[#0B1B34] hover:bg-destructive hover:text-white transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  {/* Editorial gradient overlay with title */}
                  <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-[#0B1B34] via-[#0B1B34]/70 to-transparent pointer-events-none">
                    <div className="flex items-center gap-1.5 text-white/85 text-[10px] font-bold uppercase tracking-widest mb-1">
                      <MapPin className="w-3 h-3" />
                      <span className="line-clamp-1">{[imovel.bairro, imovel.cidade].filter(Boolean).join(", ") || "Localização não informada"}</span>
                    </div>
                    <h3 className="font-editorial text-white text-lg font-semibold leading-tight line-clamp-1">{imovel.titulo}</h3>
                  </div>
                  {imovel.status === "Inativo" && (
                    <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center">
                      <span className="px-4 py-2 rounded-full bg-[#0B1B34] text-white text-xs font-bold uppercase tracking-widest">Inativo</span>
                    </div>
                  )}
                  {imovel.status === "Reservado" && (
                    <div className="absolute inset-0 bg-white/50 backdrop-blur-[2px] flex items-center justify-center">
                      <span className="px-4 py-2 rounded-full bg-[#C9A96A] text-[#0B1B34] text-xs font-bold uppercase tracking-widest">Reservado</span>
                    </div>
                  )}
                  {imovel.status === "Vendido" && (
                    <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] flex items-center justify-center">
                      <span className="px-4 py-2 rounded-full bg-destructive text-destructive-foreground text-xs font-bold uppercase tracking-widest">Vendido</span>
                    </div>
                  )}
                </div>
                <div className="p-5">
                  <div className="flex justify-between items-end mb-5 gap-3">
                    <div className="min-w-0">
                      <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.15em] mb-1">
                        {imovel.operacao === "Aluguel" ? "Locação Mensal" : "Valor do Imóvel"}
                      </p>
                      <p className="font-editorial text-2xl font-bold text-[#B08E4C] leading-none truncate">{formatPreco(imovel.preco, imovel.operacao)}</p>
                      {(imovel.valor_condominio > 0 || imovel.valor_iptu > 0) && (
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-2">
                          {imovel.valor_condominio > 0 && <span>Cond: {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(imovel.valor_condominio)}</span>}
                          {imovel.valor_iptu > 0 && <span>IPTU: {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(imovel.valor_iptu)}</span>}
                        </div>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.15em] mb-1">{imovel.tipo}</p>
                      <p className={`text-xs font-semibold ${imovel.status === "Ativo" ? "text-emerald-700" : "text-[#0B1B34]"}`}>{imovel.status}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 border-t border-slate-100 pt-4">
                    <div className="flex flex-col items-center border-r border-slate-100">
                      <span className="text-[#0B1B34] font-bold text-base tabular-nums">{String(imovel.quartos).padStart(2, "0")}</span>
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Quartos</span>
                    </div>
                    <div className="flex flex-col items-center border-r border-slate-100">
                      <span className="text-[#0B1B34] font-bold text-base tabular-nums">{String(imovel.banheiros).padStart(2, "0")}</span>
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Banh.</span>
                    </div>
                    <div className="flex flex-col items-center border-r border-slate-100">
                      <span className="text-[#0B1B34] font-bold text-base tabular-nums">{String(imovel.vagas).padStart(2, "0")}</span>
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Vagas</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-[#0B1B34] font-bold text-base tabular-nums">{imovel.area}<span className="text-[10px] ml-0.5">m²</span></span>
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Área</span>
                    </div>
                  </div>

                  {(imovel.aceita_permuta || imovel.aceita_financiamento || imovel.tem_escritura || (imovel as any).portal_origem || (imovel as any).url_anuncio) && (
                    <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-1.5 flex-wrap" onClick={(e) => e.stopPropagation()}>
                      {imovel.aceita_permuta && <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#C9A96A]/10 text-[#B08E4C] border border-[#C9A96A]/20">Permuta</span>}
                      {imovel.aceita_financiamento && <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#C9A96A]/10 text-[#B08E4C] border border-[#C9A96A]/20">Financiamento</span>}
                      {imovel.tem_escritura && <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#C9A96A]/10 text-[#B08E4C] border border-[#C9A96A]/20">Escritura</span>}
                      {(imovel as any).portal_origem && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#0B1B34]/5 text-[#0B1B34]">{(imovel as any).portal_origem}</span>
                      )}
                      {(imovel as any).url_anuncio && (
                        <a href={(imovel as any).url_anuncio} target="_blank" rel="noopener noreferrer" className="text-[10px] font-medium text-[#B08E4C] hover:underline">
                          Ver anúncio ↗
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            ) : (

              /* List view */
              <motion.div
                key={imovel.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.02 }}
                className="glass-card overflow-hidden group cursor-pointer hover:border-primary/30 transition-all flex"
                onClick={() => navigate(`/imovel/${imovel.id}`)}
              >
                <div className="relative w-40 sm:w-52 flex-shrink-0 overflow-hidden bg-muted">
                  {imovel.fotos && imovel.fotos.length > 0 ? (
                    <img src={imovel.fotos[0]} alt={imovel.titulo} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground min-h-[120px]">
                      <ImageOff className="w-8 h-8 opacity-30" />
                    </div>
                  )}
                  <div className="absolute top-2 left-2 flex gap-1">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${imovel.operacao === "Venda" ? "bg-primary text-primary-foreground" : "bg-info text-info-foreground"}`}>
                      {imovel.operacao}
                    </span>
                  </div>
                  {(imovel.status === "Reservado" || imovel.status === "Vendido") && (
                    <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                      <span className={`px-2 py-1 rounded-lg text-[10px] font-bold ${imovel.status === "Vendido" ? "bg-destructive text-destructive-foreground" : "bg-warning text-warning-foreground"}`}>
                        {imovel.status.toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex-1 p-4 flex flex-col justify-between min-w-0">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-foreground line-clamp-1">{imovel.titulo}</h3>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                          <MapPin className="w-3 h-3 flex-shrink-0" />
                          <span className="line-clamp-1">{[imovel.endereco, imovel.bairro, imovel.cidade].filter(Boolean).join(", ") || "—"}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const event = new CustomEvent("open-property-research", { detail: imovel });
                            window.dispatchEvent(event);
                          }}
                          className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
                          title="Inteligência de Mercado"
                        >
                          <Search className="w-3.5 h-3.5" />
                        </button>
                        <ShareMenu id={imovel.id} titulo={imovel.titulo} preco={imovel.preco} operacao={imovel.operacao} endereco={imovel.endereco} bairro={imovel.bairro} cidade={imovel.cidade} quartos={imovel.quartos} area={imovel.area} fotos={imovel.fotos ?? []} />
                        <label
                          className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                          title="Adicionar fotos"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <input
                            type="file"
                            multiple
                            accept="image/*"
                            className="hidden"
                            onChange={async (e) => {
                              const files = Array.from(e.target.files || []);
                              if (!files.length) return;
                              const uploaded = await uploadFotos(files);
                              if (uploaded.length) {
                                const novas = [...(imovel.fotos ?? []), ...uploaded];
                                await updateImovel(imovel.id, { fotos: novas } as any);
                              }
                              e.target.value = "";
                            }}
                          />
                        </label>
                        <button
                          onClick={(e) => { e.stopPropagation(); downloadAllFotos(imovel); }}
                          disabled={!imovel.fotos || imovel.fotos.length === 0}
                          className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          title="Baixar todas as fotos"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={async () => {
                            const newStatus = imovel.status === "Inativo" ? "Ativo" : "Inativo";
                            await updateImovel(imovel.id, { status: newStatus } as any);
                          }}
                          className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-warning transition-colors"
                          title={imovel.status === "Inativo" ? "Ativar" : "Inativar"}
                        >
                          {imovel.status === "Inativo" ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                        </button>
                        <button onClick={() => openEdit(imovel)} className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-primary transition-colors">
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setDeleteItem(imovel)} className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-end justify-between gap-4 mt-2">
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      <div className="flex items-center gap-1"><Bed className="w-3.5 h-3.5" /><span>{imovel.quartos}</span></div>
                      {imovel.suites > 0 && <div className="flex items-center gap-1"><DoorOpen className="w-3.5 h-3.5" /><span>{imovel.suites}s</span></div>}
                      <div className="flex items-center gap-1"><Bath className="w-3.5 h-3.5" /><span>{imovel.banheiros}</span></div>
                      <div className="flex items-center gap-1"><Car className="w-3.5 h-3.5" /><span>{imovel.vagas}</span></div>
                      <div className="flex items-center gap-1"><Maximize className="w-3.5 h-3.5" /><span>{imovel.area}m²</span></div>
                      {imovel.exclusivo && <Badge variant="secondary" className="text-[10px] h-4">Exclusivo</Badge>}
                      {imovel.destaque && <Badge variant="secondary" className="text-[10px] h-4">Destaque</Badge>}
                      {(imovel as any).portal_origem && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary">{(imovel as any).portal_origem}</span>
                      )}
                      {(imovel as any).url_anuncio && (
                        <a href={(imovel as any).url_anuncio} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-[10px] text-primary hover:underline">
                          Ver anúncio ↗
                        </a>
                      )}
                    </div>
                    <p className="text-base font-bold text-primary whitespace-nowrap">{formatPreco(imovel.preco, imovel.operacao)}</p>
                  </div>
                </div>
              </motion.div>
            )
          ))}
        </div>
      )}

      {/* Form Dialog */}
      <ImovelFormDialog
        open={formOpen}
        onOpenChange={(open) => { setFormOpen(open); if (!open) persistDialogState(false); }}
        imovel={editItem}
        onSave={handleSave}
        saving={saving}
      />

      {/* Import via Link Dialog */}
      <ImportarViaLinkDialog open={importLinkOpen} onOpenChange={setImportLinkOpen} />
      <WebResearchDialog />


      <AlertDialog open={!!deleteItem} onOpenChange={(open) => !open && setDeleteItem(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>O que deseja fazer com "{deleteItem?.titulo}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Você pode inativar o imóvel (ele ficará oculto mas poderá ser reativado) ou excluí-lo permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setDeleteItem(null)}>Cancelar</Button>
            {deleteItem?.status !== "Inativo" ? (
              <Button
                variant="secondary"
                className="bg-warning text-warning-foreground hover:bg-warning/90"
                onClick={async () => {
                  if (deleteItem) {
                    const id = deleteItem.id;
                    setDeleteItem(null);
                    await updateImovel(id, { status: "Inativo" } as any);
                  }
                }}
              >
                Inativar
              </Button>
            ) : (
              <Button
                onClick={async () => {
                  if (deleteItem) {
                    const id = deleteItem.id;
                    setDeleteItem(null);
                    await updateImovel(id, { status: "Ativo" } as any);
                  }
                }}
              >
                Reativar
              </Button>
            )}
            <Button variant="destructive" onClick={async () => { if (deleteItem) { const id = deleteItem.id; setDeleteItem(null); await deleteImovel(id); } }}>
              Excluir Permanentemente
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default Imoveis;
