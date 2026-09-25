/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import {
  Building,
  Check,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  File,
  FileText,
  Home,
  Image as ImageIcon,
  Info,
  Landmark,
  Layers,
  Loader2,
  MapPin,
  Mountain,
  Send,
  Star,
  Store,
  Upload,
  Video,
  X,
} from "lucide-react";
import {
  formatBRL,
  formatCurrencyInput,
  parseCurrencyInput,
  TIPOS_IMOVEL,
  mediaUrl,
  normalizeHttpUrl,
} from "../../helpers/realtyCrm";
import realtyService from "../../services/realtyService";

const STEPS = [
  { label: "Básico", icon: Home },
  { label: "Detalhes", icon: Info },
  { label: "Mídia", icon: ImageIcon },
  { label: "Financeiro", icon: DollarSign },
  { label: "Publicar", icon: Send },
];

const TIPOS_CHIPS = [
  { value: "Apartamento", icon: Building },
  { value: "Casa", icon: Home },
  { value: "Cobertura", icon: Layers },
  { value: "Studio", icon: Store },
  { value: "Loft", icon: Store },
  { value: "Terreno", icon: Mountain },
  { value: "Sala Comercial", icon: Landmark },
  { value: "Galpão", icon: Store },
];

const OPERACOES = [
  { label: "Venda", value: "venda" },
  { label: "Aluguel", value: "aluguel" },
  { label: "Venda e Aluguel", value: "ambos" },
];

const STATUS_OPTIONS = [
  { label: "Ativo", value: "disponivel" },
  { label: "Reservado", value: "reservado" },
  { label: "Vendido", value: "vendido" },
  { label: "Inativo", value: "inativo" },
];

const POSICOES_SOLARES = ["Norte", "Sul", "Leste", "Oeste", "Nascente", "Poente"];

const PORTAIS = [
  "ZAP Imóveis",
  "VivaReal",
  "OLX",
  "Imovelweb",
  "Wimoveis",
  "DF Imóveis",
  "ImovelP",
  "Aluga Mais",
  "Captei",
  "Site Próprio",
  "Outro",
];

const defaultForm = {
  title: "",
  type: "Apartamento",
  purpose: "venda",
  price: "",
  address: "",
  city: "",
  neighborhood: "",
  state: "DF",
  zipCode: "",
  bedrooms: 0,
  bathrooms: 0,
  suites: 0,
  parkingSpots: 0,
  areaM2: "",
  description: "",
  status: "disponivel",
  exclusivo: false,
  destaque: false,
  aceitaPermuta: false,
  aceitaFinanciamento: false,
  aceitaFgts: false,
  temEscritura: false,
  condoFee: "",
  iptu: "",
  andar: "",
  posicaoSolar: "",
  exclusividadeInicio: "",
  exclusividadeFim: "",
  comissaoPercentual: "",
  urlAnuncio: "",
  portalOrigem: "",
  code: "",
  videoUrl: "",
  fotoCapaIndex: 0,
};

function asArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "string" && value.trim()) {
    return value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function sanitizeCurrencyRaw(raw) {
  return String(raw || "").replace(/[^\d.,]/g, "");
}

async function uploadMediaFiles(files) {
  if (!files || !files.length) return [];
  const data = await realtyService.uploadImovelMedia(files);
  if (Array.isArray(data?.urls)) return data.urls;
  if (Array.isArray(data)) return data;
  return [];
}

function getFileName(url) {
  try {
    return decodeURIComponent(String(url).split("/").pop() || url).split("?")[0];
  } catch {
    return String(url).split("/").pop() || url;
  }
}

function Stepper({ currentStep, onStepClick, completedSteps }) {
  const progress = (currentStep / (STEPS.length - 1)) * 100;
  return (
    <div className="realty-imovel-stepper">
      <div className="realty-imovel-stepper__mobile">
        <span>
          Etapa {currentStep + 1} de {STEPS.length}
        </span>
        <strong>{STEPS[currentStep].label}</strong>
        <div className="realty-imovel-stepper__bar">
          <div className="realty-imovel-stepper__bar-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>
      <div className="realty-imovel-stepper__desktop">
        <div className="realty-imovel-stepper__line" />
        <div
          className="realty-imovel-stepper__line-fill"
          style={{ width: `${progress * 0.8}%` }}
        />
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          const done = completedSteps.has(i);
          const active = i === currentStep;
          return (
            <button
              key={step.label}
              type="button"
              className={`realty-imovel-step${active ? " realty-imovel-step--active" : ""}${
                done && !active ? " realty-imovel-step--done" : ""
              }`}
              onClick={() => onStepClick(i)}
            >
              <span className="realty-imovel-step__icon">
                {done && !active ? <Check size={16} /> : <Icon size={16} />}
              </span>
              <span className="realty-imovel-step__label">{step.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function NumberStepper({ label, value, onChange }) {
  const n = Number(value) || 0;
  return (
    <div className="realty-imovel-field">
      <span className="realty-imovel-label">{label}</span>
      <div className="realty-imovel-num-stepper">
        <button type="button" onClick={() => onChange(Math.max(0, n - 1))} aria-label={`Diminuir ${label}`}>
          −
        </button>
        <span>{n}</span>
        <button type="button" onClick={() => onChange(n + 1)} aria-label={`Aumentar ${label}`}>
          +
        </button>
      </div>
    </div>
  );
}

function SwitchRow({ checked, onChange, label }) {
  return (
    <label className="realty-imovel-switch-row">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        className={`realty-imovel-switch${checked ? " realty-imovel-switch--on" : ""}`}
        onClick={() => onChange(!checked)}
      >
        <span className="realty-imovel-switch__knob" />
      </button>
      <span>{label}</span>
    </label>
  );
}

function DocSection({ label, icon, existing, newFiles, onRemoveExisting, onRemoveNew, onAdd }) {
  return (
    <div className="realty-imovel-doc">
      <div className="realty-imovel-doc__head">
        {icon}
        <p>{label}</p>
      </div>
      <div className="realty-imovel-doc__list">
        {existing.map((url, i) => (
          <div key={`e-${i}`} className="realty-imovel-doc__item">
            <FileText size={14} />
            <a href={mediaUrl(url)} target="_blank" rel="noopener noreferrer">
              {getFileName(url)}
            </a>
            <button type="button" onClick={() => onRemoveExisting(i)} aria-label="Remover">
              <X size={14} />
            </button>
          </div>
        ))}
        {newFiles.map((f, i) => (
          <div key={`n-${i}`} className="realty-imovel-doc__item realty-imovel-doc__item--new">
            <FileText size={14} />
            <span>{f.name}</span>
            <em>Novo</em>
            <button type="button" onClick={() => onRemoveNew(i)} aria-label="Remover">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
      <button type="button" className="realty-imovel-doc__add" onClick={onAdd}>
        <Upload size={14} /> Adicionar arquivo
      </button>
    </div>
  );
}

function PreviewSidebar({ form, previews, existingFotos }) {
  const allPhotos = [
    ...existingFotos.map((u) => mediaUrl(u)),
    ...previews,
  ];
  const coverIndex = Math.min(Number(form.fotoCapaIndex) || 0, Math.max(0, allPhotos.length - 1));
  const cover = allPhotos[coverIndex] || null;
  const location = [form.neighborhood, form.city, form.state].filter(Boolean).join(", ");
  return (
    <aside className="realty-imovel-preview">
      <p className="realty-imovel-preview__eyebrow">Preview</p>
      <div className="realty-imovel-preview__card">
        <div className="realty-imovel-preview__cover">
          {cover ? (
            <img src={cover} alt="" />
          ) : (
            <div className="realty-imovel-preview__empty">
              <ImageIcon size={32} />
              <span>Adicione fotos na etapa 3</span>
            </div>
          )}
          {form.type ? <span className="realty-imovel-preview__badge">{form.type}</span> : null}
        </div>
        <div className="realty-imovel-preview__body">
          <h4>{form.title || "Título do imóvel"}</h4>
          {location ? (
            <p className="realty-imovel-preview__loc">
              <MapPin size={12} /> {location}
            </p>
          ) : null}
          <p className="realty-imovel-preview__price">
            {form.price ? formatBRL(parseCurrencyInput(form.price)) : "R$ —"}
          </p>
          <div className="realty-imovel-preview__meta">
            <span>{form.bedrooms || 0} quartos</span>
            <span>{form.bathrooms || 0} banheiros</span>
            <span>{form.parkingSpots || 0} vagas</span>
            {form.areaM2 ? <span>{form.areaM2} m²</span> : null}
          </div>
        </div>
      </div>
    </aside>
  );
}

const ImovelFormDialog = ({ open, onClose, imovel, onSave, saving = false }) => {
  const fileInputRef = useRef(null);
  const docMatriculaRef = useRef(null);
  const docIptuRef = useRef(null);
  const docOutrosRef = useRef(null);
  const docVideosRef = useRef(null);

  const [form, setForm] = useState(defaultForm);
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState(() => new Set());
  const [uploading, setUploading] = useState(false);

  const [existingFotos, setExistingFotos] = useState([]);
  const [newFiles, setNewFiles] = useState([]);
  const [previews, setPreviews] = useState([]);

  const [existingMatricula, setExistingMatricula] = useState([]);
  const [existingIptu, setExistingIptu] = useState([]);
  const [existingOutros, setExistingOutros] = useState([]);
  const [existingVideos, setExistingVideos] = useState([]);
  const [newMatricula, setNewMatricula] = useState([]);
  const [newIptu, setNewIptu] = useState([]);
  const [newOutros, setNewOutros] = useState([]);
  const [newVideos, setNewVideos] = useState([]);
  const [cepLoading, setCepLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (imovel) {
      setForm({
        title: imovel.title || "",
        type: imovel.type || "Apartamento",
        purpose: imovel.purpose || "venda",
        price: imovel.price ? formatCurrencyInput(imovel.price) : "",
        address: imovel.address || "",
        city: imovel.city || "",
        neighborhood: imovel.neighborhood || "",
        state: imovel.state || "DF",
        zipCode: imovel.zipCode || "",
        bedrooms: Number(imovel.bedrooms) || 0,
        bathrooms: Number(imovel.bathrooms) || 0,
        suites: Number(imovel.suites) || 0,
        parkingSpots: Number(imovel.parkingSpots) || 0,
        areaM2: imovel.areaM2 != null && imovel.areaM2 !== "" ? String(imovel.areaM2) : "",
        description: imovel.description || "",
        status: imovel.status || "disponivel",
        exclusivo: Boolean(imovel.exclusivo),
        destaque: Boolean(imovel.destaque),
        aceitaPermuta: Boolean(imovel.aceitaPermuta),
        aceitaFinanciamento: Boolean(imovel.aceitaFinanciamento),
        aceitaFgts: Boolean(imovel.aceitaFgts),
        temEscritura: Boolean(imovel.temEscritura),
        condoFee: imovel.condoFee ? formatCurrencyInput(imovel.condoFee) : "",
        iptu: imovel.iptu ? formatCurrencyInput(imovel.iptu) : "",
        andar: imovel.andar || "",
        posicaoSolar: imovel.posicaoSolar || "",
        exclusividadeInicio: imovel.exclusividadeInicio || "",
        exclusividadeFim: imovel.exclusividadeFim || "",
        comissaoPercentual:
          imovel.comissaoPercentual != null && imovel.comissaoPercentual !== ""
            ? String(imovel.comissaoPercentual)
            : "",
        urlAnuncio: imovel.urlAnuncio || "",
        portalOrigem: imovel.portalOrigem || "",
        code: imovel.code || "",
        videoUrl: imovel.videoUrl || "",
        fotoCapaIndex: Number(imovel.fotoCapaIndex) || 0,
      });
      setExistingFotos(asArray(imovel.images));
      setExistingMatricula(asArray(imovel.documentosMatricula));
      setExistingIptu(asArray(imovel.documentosIptu));
      setExistingOutros(asArray(imovel.documentosOutros));
      setExistingVideos(asArray(imovel.videos));
    } else {
      setForm({ ...defaultForm });
      setExistingFotos([]);
      setExistingMatricula([]);
      setExistingIptu([]);
      setExistingOutros([]);
      setExistingVideos([]);
    }
    setNewFiles([]);
    setPreviews([]);
    setNewMatricula([]);
    setNewIptu([]);
    setNewOutros([]);
    setNewVideos([]);
    setCurrentStep(0);
    setCompletedSteps(new Set());
  }, [open, imovel]);

  const set = (key, val) => setForm((prev) => ({ ...prev, [key]: val }));

  const handleCurrencyChange = (field, raw) => set(field, sanitizeCurrencyRaw(raw));
  const handleCurrencyFocus = (field) => {
    if (parseCurrencyInput(form[field]) === 0) set(field, "");
  };
  const handleCurrencyBlur = (field) => {
    set(field, formatCurrencyInput(parseCurrencyInput(form[field])));
  };

  const fetchCep = useCallback(async (cep) => {
    const clean = String(cep || "").replace(/\D/g, "");
    if (clean.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setForm((p) => ({
          ...p,
          address: data.logradouro || p.address,
          neighborhood: data.bairro || p.neighborhood,
          city: data.localidade || p.city,
          state: data.uf || p.state,
        }));
      }
    } catch {
      /* ignore */
    }
    setCepLoading(false);
  }, []);

  const handleCepChange = (value) => {
    let masked = String(value || "")
      .replace(/\D/g, "")
      .slice(0, 8);
    if (masked.length > 5) masked = `${masked.slice(0, 5)}-${masked.slice(5)}`;
    set("zipCode", masked);
    if (masked.replace(/\D/g, "").length === 8) fetchCep(masked);
  };

  const handleFiles = (files) => {
    if (!files) return;
    const arr = Array.from(files);
    setNewFiles((prev) => [...prev, ...arr]);
    arr.forEach((f) => {
      const reader = new FileReader();
      reader.onload = (e) => setPreviews((p) => [...p, e.target.result]);
      reader.readAsDataURL(f);
    });
  };

  const handleDrop = (e) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  };

  const removeExisting = (idx) => {
    setExistingFotos((p) => p.filter((_, i) => i !== idx));
    setForm((prev) => {
      const capa = prev.fotoCapaIndex || 0;
      if (idx === capa) return { ...prev, fotoCapaIndex: 0 };
      if (idx < capa) return { ...prev, fotoCapaIndex: capa - 1 };
      return prev;
    });
  };

  const removeNew = (idx) => {
    const absoluteIdx = existingFotos.length + idx;
    setNewFiles((p) => p.filter((_, i) => i !== idx));
    setPreviews((p) => p.filter((_, i) => i !== idx));
    setForm((prev) => {
      const capa = prev.fotoCapaIndex || 0;
      if (absoluteIdx === capa) return { ...prev, fotoCapaIndex: 0 };
      if (absoluteIdx < capa) return { ...prev, fotoCapaIndex: capa - 1 };
      return prev;
    });
  };

  const goToStep = (step) => {
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      next.add(currentStep);
      return next;
    });
    setCurrentStep(step);
  };

  const nextStep = () => {
    if (currentStep < 4) goToStep(currentStep + 1);
  };
  const prevStep = () => {
    if (currentStep > 0) goToStep(currentStep - 1);
  };

  const handleSubmit = async () => {
    if (!String(form.title || "").trim()) {
      toast.error("Informe o título do imóvel");
      setCurrentStep(0);
      return;
    }

    setUploading(true);
    try {
      const [uploadedImages, uploadedMatricula, uploadedIptu, uploadedOutros, uploadedVideos] =
        await Promise.all([
          uploadMediaFiles(newFiles),
          uploadMediaFiles(newMatricula),
          uploadMediaFiles(newIptu),
          uploadMediaFiles(newOutros),
          uploadMediaFiles(newVideos),
        ]);

      const payload = {
        title: form.title.trim(),
        type: form.type || "Apartamento",
        purpose: form.purpose || "venda",
        price: parseCurrencyInput(form.price),
        address: form.address.trim() || null,
        city: form.city.trim() || null,
        neighborhood: form.neighborhood.trim() || null,
        state: form.state.trim() || null,
        zipCode: form.zipCode.replace(/\D/g, "") || null,
        bedrooms: Number(form.bedrooms) || 0,
        bathrooms: Number(form.bathrooms) || 0,
        suites: Number(form.suites) || 0,
        parkingSpots: Number(form.parkingSpots) || 0,
        areaM2: form.areaM2 !== "" ? Number(form.areaM2) || 0 : 0,
        description: form.description.trim() || null,
        status: form.status || "disponivel",
        exclusivo: Boolean(form.exclusivo),
        destaque: Boolean(form.destaque),
        aceitaPermuta: Boolean(form.aceitaPermuta),
        aceitaFinanciamento: Boolean(form.aceitaFinanciamento),
        aceitaFgts: Boolean(form.aceitaFgts),
        temEscritura: Boolean(form.temEscritura),
        condoFee: parseCurrencyInput(form.condoFee),
        iptu: parseCurrencyInput(form.iptu),
        andar: form.andar.trim() || null,
        posicaoSolar: form.posicaoSolar || null,
        exclusividadeInicio: form.exclusividadeInicio || null,
        exclusividadeFim: form.exclusividadeFim || null,
        comissaoPercentual: form.comissaoPercentual !== "" ? Number(form.comissaoPercentual) || 0 : 0,
        urlAnuncio: normalizeHttpUrl(form.urlAnuncio) || null,
        portalOrigem: form.portalOrigem.trim() || null,
        code: form.code.trim() || null,
        videoUrl: normalizeHttpUrl(form.videoUrl) || null,
        images: [...existingFotos, ...uploadedImages],
        documentosMatricula: [...existingMatricula, ...uploadedMatricula],
        documentosIptu: [...existingIptu, ...uploadedIptu],
        documentosOutros: [...existingOutros, ...uploadedOutros],
        videos: [...existingVideos, ...uploadedVideos],
        fotoCapaIndex: Number(form.fotoCapaIndex) || 0,
      };

      await onSave(payload);
    } catch (err) {
      toast.error(err?.response?.data?.error || err?.message || "Erro ao enviar mídia");
    } finally {
      setUploading(false);
    }
  };

  if (!open) return null;

  const busy = saving || uploading;
  const tipoIsChip = TIPOS_CHIPS.some((t) => t.value === form.type);

  return (
    <div className="realty-modal-backdrop" onClick={busy ? undefined : onClose} role="presentation">
      <div
        className="realty-modal realty-imovel-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="imovel-form-title"
      >
        <div className="realty-imovel-header">
          <div className="realty-imovel-header__row">
            <h2 id="imovel-form-title">{imovel ? "Editar Imóvel" : "Novo Imóvel"}</h2>
            <button
              type="button"
              className="realty-imovel-close"
              onClick={onClose}
              disabled={busy}
              aria-label="Fechar"
            >
              <X size={18} />
            </button>
          </div>
          <Stepper currentStep={currentStep} onStepClick={goToStep} completedSteps={completedSteps} />
        </div>

        <div className="realty-imovel-layout">
          <div className="realty-imovel-form-pane">
            {currentStep === 0 && (
              <div className="realty-imovel-step-panel">
                <div className="realty-imovel-field">
                  <span className="realty-imovel-label">Tipo do Imóvel</span>
                  <div className="realty-imovel-chips">
                    {TIPOS_CHIPS.map(({ value, icon: Icon }) => (
                      <button
                        key={value}
                        type="button"
                        className={`realty-imovel-chip${
                          form.type === value ? " realty-imovel-chip--active" : ""
                        }`}
                        onClick={() => set("type", value)}
                      >
                        <Icon size={18} />
                        <span>{value}</span>
                      </button>
                    ))}
                  </div>
                  <select
                    className="realty-imovel-input"
                    value={tipoIsChip ? "" : form.type}
                    onChange={(e) => {
                      if (e.target.value) set("type", e.target.value);
                    }}
                  >
                    <option value="">Outros tipos…</option>
                    {TIPOS_IMOVEL.filter((t) => !TIPOS_CHIPS.some((c) => c.value === t)).map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="realty-imovel-field">
                  <span className="realty-imovel-label">Finalidade</span>
                  <div className="realty-imovel-ops">
                    {OPERACOES.map((op) => (
                      <button
                        key={op.value}
                        type="button"
                        className={`realty-imovel-op${
                          form.purpose === op.value ? " realty-imovel-op--active" : ""
                        }`}
                        onClick={() => set("purpose", op.value)}
                      >
                        {op.label}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="realty-imovel-field">
                  <span className="realty-imovel-label">Título do Imóvel *</span>
                  <input
                    className="realty-imovel-input"
                    value={form.title}
                    onChange={(e) => set("title", e.target.value)}
                    placeholder="Ex: Apartamento 3 quartos no Sudoeste"
                  />
                </label>

                <label className="realty-imovel-field">
                  <span className="realty-imovel-label">Código</span>
                  <input
                    className="realty-imovel-input"
                    value={form.code}
                    onChange={(e) => set("code", e.target.value)}
                    placeholder="Ex: AP-001"
                  />
                </label>

                <div className="realty-imovel-row realty-imovel-row--2">
                  <label className="realty-imovel-field">
                    <span className="realty-imovel-label">CEP</span>
                    <div className="realty-imovel-cep">
                      <input
                        className="realty-imovel-input"
                        value={form.zipCode}
                        onChange={(e) => handleCepChange(e.target.value)}
                        placeholder="00000-000"
                      />
                      {cepLoading ? <Loader2 className="realty-imovel-spin" size={16} /> : null}
                    </div>
                  </label>
                  <label className="realty-imovel-field">
                    <span className="realty-imovel-label">Endereço</span>
                    <input
                      className="realty-imovel-input"
                      value={form.address}
                      onChange={(e) => set("address", e.target.value)}
                    />
                  </label>
                </div>

                <div className="realty-imovel-row realty-imovel-row--3">
                  <label className="realty-imovel-field">
                    <span className="realty-imovel-label">Bairro</span>
                    <input
                      className="realty-imovel-input"
                      value={form.neighborhood}
                      onChange={(e) => set("neighborhood", e.target.value)}
                    />
                  </label>
                  <label className="realty-imovel-field">
                    <span className="realty-imovel-label">Cidade</span>
                    <input
                      className="realty-imovel-input"
                      value={form.city}
                      onChange={(e) => set("city", e.target.value)}
                    />
                  </label>
                  <label className="realty-imovel-field">
                    <span className="realty-imovel-label">Estado</span>
                    <input
                      className="realty-imovel-input"
                      value={form.state}
                      onChange={(e) => set("state", e.target.value)}
                      maxLength={2}
                    />
                  </label>
                </div>
              </div>
            )}

            {currentStep === 1 && (
              <div className="realty-imovel-step-panel">
                <div className="realty-imovel-row realty-imovel-row--3">
                  <label className="realty-imovel-field">
                    <span className="realty-imovel-label">Preço (R$)</span>
                    <input
                      className="realty-imovel-input"
                      value={form.price}
                      inputMode="decimal"
                      placeholder="0,00"
                      onFocus={() => handleCurrencyFocus("price")}
                      onChange={(e) => handleCurrencyChange("price", e.target.value)}
                      onBlur={() => handleCurrencyBlur("price")}
                    />
                  </label>
                  <label className="realty-imovel-field">
                    <span className="realty-imovel-label">Área (m²)</span>
                    <input
                      className="realty-imovel-input"
                      type="number"
                      value={form.areaM2}
                      onChange={(e) => set("areaM2", e.target.value)}
                    />
                  </label>
                  <label className="realty-imovel-field">
                    <span className="realty-imovel-label">Andar</span>
                    <input
                      className="realty-imovel-input"
                      value={form.andar}
                      onChange={(e) => set("andar", e.target.value)}
                      placeholder="Ex: 12º"
                    />
                  </label>
                </div>

                <div className="realty-imovel-row realty-imovel-row--4">
                  <NumberStepper
                    label="Quartos"
                    value={form.bedrooms}
                    onChange={(v) => set("bedrooms", v)}
                  />
                  <NumberStepper
                    label="Suítes"
                    value={form.suites}
                    onChange={(v) => set("suites", v)}
                  />
                  <NumberStepper
                    label="Banheiros"
                    value={form.bathrooms}
                    onChange={(v) => set("bathrooms", v)}
                  />
                  <NumberStepper
                    label="Vagas"
                    value={form.parkingSpots}
                    onChange={(v) => set("parkingSpots", v)}
                  />
                </div>

                <label className="realty-imovel-field">
                  <span className="realty-imovel-label">Posição Solar</span>
                  <select
                    className="realty-imovel-input"
                    value={form.posicaoSolar}
                    onChange={(e) => set("posicaoSolar", e.target.value)}
                  >
                    <option value="">Selecione</option>
                    {POSICOES_SOLARES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="realty-imovel-field">
                  <span className="realty-imovel-label">Descrição</span>
                  <textarea
                    className="realty-imovel-input"
                    rows={5}
                    value={form.description}
                    onChange={(e) => set("description", e.target.value)}
                    placeholder="Descreva o imóvel…"
                  />
                </label>

                <div className="realty-imovel-switches">
                  <SwitchRow
                    checked={form.exclusivo}
                    onChange={(v) => set("exclusivo", v)}
                    label="Exclusivo"
                  />
                  <SwitchRow
                    checked={form.destaque}
                    onChange={(v) => set("destaque", v)}
                    label="Destaque"
                  />
                  <SwitchRow
                    checked={form.aceitaPermuta}
                    onChange={(v) => set("aceitaPermuta", v)}
                    label="Aceita Permuta"
                  />
                  <SwitchRow
                    checked={form.aceitaFinanciamento}
                    onChange={(v) => set("aceitaFinanciamento", v)}
                    label="Financiamento"
                  />
                  <SwitchRow
                    checked={form.aceitaFgts}
                    onChange={(v) => set("aceitaFgts", v)}
                    label="Aceita FGTS"
                  />
                  <SwitchRow
                    checked={form.temEscritura}
                    onChange={(v) => set("temEscritura", v)}
                    label="Tem Escritura"
                  />
                </div>

                {form.exclusivo ? (
                  <div className="realty-imovel-box">
                    <p className="realty-imovel-box__title">Detalhes da Exclusividade</p>
                    <div className="realty-imovel-row realty-imovel-row--3">
                      <label className="realty-imovel-field">
                        <span className="realty-imovel-label">Início</span>
                        <input
                          type="date"
                          className="realty-imovel-input"
                          value={form.exclusividadeInicio}
                          onChange={(e) => set("exclusividadeInicio", e.target.value)}
                        />
                      </label>
                      <label className="realty-imovel-field">
                        <span className="realty-imovel-label">Fim</span>
                        <input
                          type="date"
                          className="realty-imovel-input"
                          value={form.exclusividadeFim}
                          onChange={(e) => set("exclusividadeFim", e.target.value)}
                        />
                      </label>
                      <label className="realty-imovel-field">
                        <span className="realty-imovel-label">Comissão %</span>
                        <input
                          type="number"
                          step="0.1"
                          className="realty-imovel-input"
                          value={form.comissaoPercentual}
                          onChange={(e) => set("comissaoPercentual", e.target.value)}
                          placeholder="6.0"
                        />
                      </label>
                    </div>
                  </div>
                ) : null}

                <div className="realty-imovel-box">
                  <p className="realty-imovel-box__title">Anúncio Online (opcional)</p>
                  <div className="realty-imovel-row realty-imovel-row--3">
                    <label className="realty-imovel-field" style={{ gridColumn: "span 2" }}>
                      <span className="realty-imovel-label">Link do Anúncio (URL)</span>
                      <input
                        type="text"
                        inputMode="url"
                        className="realty-imovel-input"
                        value={form.urlAnuncio}
                        onChange={(e) => set("urlAnuncio", e.target.value)}
                        placeholder="https://www.zapimoveis.com.br/imovel/..."
                      />
                    </label>
                    <label className="realty-imovel-field">
                      <span className="realty-imovel-label">Portal de Origem</span>
                      <select
                        className="realty-imovel-input"
                        value={form.portalOrigem}
                        onChange={(e) => set("portalOrigem", e.target.value)}
                      >
                        <option value="">Selecione...</option>
                        {PORTAIS.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="realty-imovel-step-panel">
                <div className="realty-imovel-field">
                  <span className="realty-imovel-label">Fotos do Imóvel</span>
                  <p className="realty-imovel-hint">Clique em ⭐ para definir a foto de capa</p>
                  <div
                    className="realty-imovel-upload"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
                    }}
                  >
                    <Upload size={28} />
                    <p>
                      Arraste fotos aqui ou <strong>clique para selecionar</strong>
                    </p>
                    <span>JPG, PNG até 10MB</span>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    hidden
                    onChange={(e) => {
                      handleFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />
                  {existingFotos.length > 0 || previews.length > 0 ? (
                    <div className="realty-imovel-photos">
                      {existingFotos.map((url, i) => {
                        const isCapa = form.fotoCapaIndex === i;
                        return (
                          <div
                            key={`e-${i}`}
                            className={`realty-imovel-photo${
                              isCapa ? " realty-imovel-photo--capa" : ""
                            }`}
                          >
                            <img src={mediaUrl(url)} alt="" />
                            {isCapa ? <span className="realty-imovel-photo__capa">CAPA</span> : null}
                            <button
                              type="button"
                              className="realty-imovel-photo__star"
                              title="Definir como capa"
                              onClick={(e) => {
                                e.stopPropagation();
                                set("fotoCapaIndex", i);
                              }}
                            >
                              <Star size={12} fill={isCapa ? "currentColor" : "none"} />
                            </button>
                            <button
                              type="button"
                              className="realty-imovel-photo__remove"
                              title="Excluir foto"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeExisting(i);
                              }}
                            >
                              <X size={12} />
                            </button>
                          </div>
                        );
                      })}
                      {previews.map((src, i) => {
                        const absoluteIdx = existingFotos.length + i;
                        const isCapa = form.fotoCapaIndex === absoluteIdx;
                        return (
                          <div
                            key={`n-${i}`}
                            className={`realty-imovel-photo${
                              isCapa ? " realty-imovel-photo--capa" : ""
                            }`}
                          >
                            <img src={src} alt="" />
                            {isCapa ? <span className="realty-imovel-photo__capa">CAPA</span> : null}
                            <span className="realty-imovel-photo__new">Nova</span>
                            <button
                              type="button"
                              className="realty-imovel-photo__star"
                              title="Definir como capa"
                              onClick={(e) => {
                                e.stopPropagation();
                                set("fotoCapaIndex", absoluteIdx);
                              }}
                            >
                              <Star size={12} />
                            </button>
                            <button
                              type="button"
                              className="realty-imovel-photo__remove"
                              title="Excluir foto"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeNew(i);
                              }}
                            >
                              <X size={12} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>

                <label className="realty-imovel-field">
                  <span className="realty-imovel-label">URL de vídeo (opcional)</span>
                  <input
                    className="realty-imovel-input"
                    value={form.videoUrl}
                    onChange={(e) => set("videoUrl", e.target.value)}
                    placeholder="https://youtube.com/..."
                  />
                </label>

                <div className="realty-imovel-docs">
                  <span className="realty-imovel-label">Documentos</span>
                  <DocSection
                    label="Matrícula do Imóvel"
                    icon={<FileText size={16} />}
                    existing={existingMatricula}
                    newFiles={newMatricula}
                    onRemoveExisting={(i) =>
                      setExistingMatricula((p) => p.filter((_, idx) => idx !== i))
                    }
                    onRemoveNew={(i) => setNewMatricula((p) => p.filter((_, idx) => idx !== i))}
                    onAdd={() => docMatriculaRef.current?.click()}
                  />
                  <input
                    ref={docMatriculaRef}
                    type="file"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    hidden
                    onChange={(e) => {
                      if (e.target.files) {
                        setNewMatricula((p) => [...p, ...Array.from(e.target.files)]);
                      }
                      e.target.value = "";
                    }}
                  />

                  <DocSection
                    label="Documentos de IPTU"
                    icon={<File size={16} />}
                    existing={existingIptu}
                    newFiles={newIptu}
                    onRemoveExisting={(i) => setExistingIptu((p) => p.filter((_, idx) => idx !== i))}
                    onRemoveNew={(i) => setNewIptu((p) => p.filter((_, idx) => idx !== i))}
                    onAdd={() => docIptuRef.current?.click()}
                  />
                  <input
                    ref={docIptuRef}
                    type="file"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    hidden
                    onChange={(e) => {
                      if (e.target.files) setNewIptu((p) => [...p, ...Array.from(e.target.files)]);
                      e.target.value = "";
                    }}
                  />

                  <DocSection
                    label="Vídeos"
                    icon={<Video size={16} />}
                    existing={existingVideos}
                    newFiles={newVideos}
                    onRemoveExisting={(i) =>
                      setExistingVideos((p) => p.filter((_, idx) => idx !== i))
                    }
                    onRemoveNew={(i) => setNewVideos((p) => p.filter((_, idx) => idx !== i))}
                    onAdd={() => docVideosRef.current?.click()}
                  />
                  <input
                    ref={docVideosRef}
                    type="file"
                    multiple
                    accept="video/*"
                    hidden
                    onChange={(e) => {
                      if (e.target.files) setNewVideos((p) => [...p, ...Array.from(e.target.files)]);
                      e.target.value = "";
                    }}
                  />

                  <DocSection
                    label="Outros Documentos"
                    icon={<File size={16} />}
                    existing={existingOutros}
                    newFiles={newOutros}
                    onRemoveExisting={(i) =>
                      setExistingOutros((p) => p.filter((_, idx) => idx !== i))
                    }
                    onRemoveNew={(i) => setNewOutros((p) => p.filter((_, idx) => idx !== i))}
                    onAdd={() => docOutrosRef.current?.click()}
                  />
                  <input
                    ref={docOutrosRef}
                    type="file"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                    hidden
                    onChange={(e) => {
                      if (e.target.files) setNewOutros((p) => [...p, ...Array.from(e.target.files)]);
                      e.target.value = "";
                    }}
                  />
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="realty-imovel-step-panel">
                <p className="realty-imovel-hint">Valores financeiros do imóvel (opcionais)</p>
                <div className="realty-imovel-row realty-imovel-row--2">
                  <label className="realty-imovel-field">
                    <span className="realty-imovel-label">Condomínio (R$)</span>
                    <input
                      className="realty-imovel-input"
                      value={form.condoFee}
                      inputMode="decimal"
                      placeholder="0,00"
                      onFocus={() => handleCurrencyFocus("condoFee")}
                      onChange={(e) => handleCurrencyChange("condoFee", e.target.value)}
                      onBlur={() => handleCurrencyBlur("condoFee")}
                    />
                  </label>
                  <label className="realty-imovel-field">
                    <span className="realty-imovel-label">IPTU (R$)</span>
                    <input
                      className="realty-imovel-input"
                      value={form.iptu}
                      inputMode="decimal"
                      placeholder="0,00"
                      onFocus={() => handleCurrencyFocus("iptu")}
                      onChange={(e) => handleCurrencyChange("iptu", e.target.value)}
                      onBlur={() => handleCurrencyBlur("iptu")}
                    />
                  </label>
                </div>
                <label className="realty-imovel-field">
                  <span className="realty-imovel-label">Comissão (%)</span>
                  <input
                    type="number"
                    step="0.1"
                    className="realty-imovel-input"
                    value={form.comissaoPercentual}
                    onChange={(e) => set("comissaoPercentual", e.target.value)}
                    placeholder="6.0"
                  />
                </label>
              </div>
            )}

            {currentStep === 4 && (
              <div className="realty-imovel-step-panel realty-imovel-publish">
                <div className="realty-imovel-publish__hero">
                  <div className="realty-imovel-publish__icon">
                    <Home size={32} />
                  </div>
                  <h3>Tudo pronto para publicar!</h3>
                  <p>Revise o status e publique seu imóvel</p>
                </div>

                <div className="realty-imovel-field">
                  <span className="realty-imovel-label">Status do Imóvel</span>
                  <div className="realty-imovel-status-grid">
                    {STATUS_OPTIONS.map((s) => (
                      <button
                        key={s.value}
                        type="button"
                        className={`realty-imovel-status-btn${
                          form.status === s.value ? " realty-imovel-status-btn--active" : ""
                        }`}
                        onClick={() => set("status", s.value)}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="realty-imovel-summary">
                  <p className="realty-imovel-summary__title">Resumo</p>
                  <dl>
                    <dt>Tipo</dt>
                    <dd>{form.type}</dd>
                    <dt>Operação</dt>
                    <dd>
                      {OPERACOES.find((o) => o.value === form.purpose)?.label || form.purpose}
                    </dd>
                    <dt>Título</dt>
                    <dd>{form.title || "—"}</dd>
                    <dt>Preço</dt>
                    <dd>{form.price || "—"}</dd>
                    <dt>Localização</dt>
                    <dd>
                      {[form.neighborhood, form.city].filter(Boolean).join(", ") || "—"}
                    </dd>
                  </dl>
                </div>
              </div>
            )}

            <div className="realty-imovel-nav">
              <button
                type="button"
                className="realty-page__btn realty-page__btn--ghost"
                onClick={currentStep === 0 ? onClose : prevStep}
                disabled={busy}
              >
                <ChevronLeft size={16} />
                {currentStep === 0 ? "Cancelar" : "Voltar"}
              </button>
              {currentStep < 4 ? (
                <button type="button" className="realty-page__btn" onClick={nextStep} disabled={busy}>
                  Próximo <ChevronRight size={16} />
                </button>
              ) : (
                <button
                  type="button"
                  className="realty-page__btn"
                  onClick={handleSubmit}
                  disabled={busy}
                >
                  {busy ? <Loader2 size={16} className="realty-imovel-spin" /> : null}
                  {imovel ? "Salvar Alterações" : "Publicar Imóvel"}
                </button>
              )}
            </div>
          </div>

          <PreviewSidebar form={form} previews={previews} existingFotos={existingFotos} />
        </div>
      </div>
    </div>
  );
};

export default ImovelFormDialog;
