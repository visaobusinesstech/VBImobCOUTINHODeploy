/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 *
 * Formulário completo de Contrato (paridade Lovable ContratoFormDialog, camelCase API).
 */

import React, { useEffect, useState } from "react";
import { FileText, Loader2, Plus, Trash2, Upload, X } from "lucide-react";
import { toast } from "react-toastify";
import realtyService from "../../services/realtyService";
import {
  CANAIS_ORIGEM,
  COMISSAO_TIPOS,
  ESTADO_CIVIL,
  IMPOSTO_TIPOS,
  INDICE_CORRECAO,
  STATUS_CONTRATO,
  TIPOS_CONTRATO,
  TIPO_GARANTIA,
  getCommissionBaseValue,
  mediaUrl,
  recalculateCommissionState,
} from "../../helpers/realtyCrm";
import { emptyContratoForm } from "../../helpers/contratoFieldMap";
import {
  DEFAULT_CONTRATO_FILE_ACCEPT,
  VIDEO_CONTRATO_FILE_ACCEPT,
  getContratoFileName,
} from "../../helpers/contratoFilePreview";
import ContratoDocChecklist from "./ContratoDocChecklist";
import ContratoAnexosAnuaisSection from "./ContratoAnexosAnuaisSection";
import ContratoComprovantesMensaisSection from "./ContratoComprovantesMensaisSection";
import ContratoFileViewerDialog from "./ContratoFileViewerDialog";
import { loadFormDraft, saveFormDraft, clearFormDraft } from "../../hooks/useUserUiPreferences";

const COMMISSION_RECALC_KEYS = [
  "value",
  "tipo",
  "comissaoTipo",
  "comissaoPercentual",
  "parceiroComissaoPercentual",
  "captadorComissaoPercentual",
  "corretorComissaoPercentual",
  "impostoPercentual",
];

const FILE_ACCEPT_BY_FIELD = {
  vistoriaVideoUrl: VIDEO_CONTRATO_FILE_ACCEPT,
};

const getFileAccept = (urlKey) => FILE_ACCEPT_BY_FIELD[urlKey] || DEFAULT_CONTRATO_FILE_ACCEPT;

const formatCurrencyDisplay = (value) => {
  if (!value) return "";
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

const formatPercentDisplay = (value) => {
  if (!value) return "";
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

const sanitizeNumberInput = (raw) => String(raw || "").replace(/[^\d.,]/g, "");

const maskPhone = (v) => {
  const d = String(v || "")
    .replace(/\D/g, "")
    .slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

const maskCpf = (v) => {
  const d = String(v || "")
    .replace(/\D/g, "")
    .slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
};

const maskCpfCnpj = (v) => {
  const d = String(v || "")
    .replace(/\D/g, "")
    .slice(0, 14);
  if (d.length <= 11) return maskCpf(d);
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  if (d.length <= 13) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
};

const parseCurrencyInput = (raw) => {
  const cleaned = sanitizeNumberInput(raw);
  if (!cleaned) return 0;

  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");
  let normalized = cleaned;

  if (hasComma) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (hasDot) {
    const parts = cleaned.split(".");
    if (parts.length > 2) {
      normalized = cleaned.replace(/\./g, "");
    } else {
      const lastPart = parts[parts.length - 1] || "";
      if (lastPart.length === 3) {
        normalized = cleaned.replace(/\./g, "");
      } else {
        normalized = cleaned;
      }
    }
  }

  const num = Number.parseFloat(normalized);
  return Number.isFinite(num) ? num : 0;
};

const toDateInput = (value) => {
  if (!value) return "";
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  try {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 10);
  } catch {
    return "";
  }
};

const getContratoFormDraftKey = (contratoId) =>
  `contrato_form_${contratoId || "novo"}`;

const SwitchRow = ({ checked, onChange, label }) => (
  <label className="realty-contrato-switch-row">
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

const formFromContrato = (contrato) => {
  const base = emptyContratoForm();
  if (!contrato) return base;

  const next = { ...base };
  Object.keys(base).forEach((key) => {
    if (contrato[key] !== undefined && contrato[key] !== null) {
      next[key] = contrato[key];
    }
  });

  next.startDate = toDateInput(contrato.startDate);
  next.endDate = toDateInput(contrato.endDate);
  next.dataProximaCorrecao = toDateInput(contrato.dataProximaCorrecao);
  next.dataVencimentoApolice = toDateInput(contrato.dataVencimentoApolice);
  next.proprietarioId = contrato.proprietarioId ? String(contrato.proprietarioId) : "";
  next.parceriaEnvolvidos = Array.isArray(contrato.parceriaEnvolvidos)
    ? contrato.parceriaEnvolvidos
    : [];

  return recalculateCommissionState(next);
};

/**
 * @param {{ open: boolean, onClose: () => void, contrato?: object|null, onSave: (payload: object) => Promise<void>, saving?: boolean }} props
 */
const ContratoFormDialog = ({ open, onClose, contrato, onSave, saving = false }) => {
  const [form, setForm] = useState(() => emptyContratoForm());
  const [proprietarios, setProprietarios] = useState([]);
  const [uploading, setUploading] = useState(null);
  const [valorDisplay, setValorDisplay] = useState("");
  const [percentualDisplay, setPercentualDisplay] = useState("");
  const [currencyDisplays, setCurrencyDisplays] = useState({});
  const [viewer, setViewer] = useState({ open: false, loading: false, file: null });
  const [draftReady, setDraftReady] = useState(false);

  useEffect(() => {
    if (!open) {
      setDraftReady(false);
      setForm(emptyContratoForm());
      setValorDisplay("");
      setPercentualDisplay("");
      setCurrencyDisplays({});
      return undefined;
    }

    let cancelled = false;
    (async () => {
      try {
        const persisted = await loadFormDraft(getContratoFormDraftKey(contrato?.id));
        if (cancelled) return;
        if (persisted?.form) {
          setForm(recalculateCommissionState({ ...emptyContratoForm(), ...persisted.form }));
          setValorDisplay(persisted.valorDisplay || "");
          setPercentualDisplay(persisted.percentualDisplay || "");
          setCurrencyDisplays(persisted.currencyDisplays || {});
          setDraftReady(true);
          return;
        }
      } catch {
        /* ignore */
      }

      if (cancelled) return;

      if (contrato) {
        const mapped = formFromContrato(contrato);
        setForm(mapped);
        setValorDisplay(formatCurrencyDisplay(mapped.value));
        setPercentualDisplay(formatPercentDisplay(mapped.percentualCorrecao || 0));
        setCurrencyDisplays({});
      } else {
        setForm(emptyContratoForm());
        setValorDisplay("");
        setPercentualDisplay("");
        setCurrencyDisplays({});
      }
      setDraftReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [contrato, open]);

  useEffect(() => {
    if (!open || !draftReady) return undefined;
    const t = setTimeout(() => {
      saveFormDraft(getContratoFormDraftKey(contrato?.id), {
        form,
        valorDisplay,
        percentualDisplay,
        currencyDisplays,
      }).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [open, draftReady, contrato?.id, form, valorDisplay, percentualDisplay, currencyDisplays]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await realtyService.listProprietarios({ pageSize: 200 });
        if (!cancelled) setProprietarios(data?.proprietarios || []);
      } catch {
        if (!cancelled) setProprietarios([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  const set = (key, value) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      return COMMISSION_RECALC_KEYS.includes(key) ? recalculateCommissionState(next) : next;
    });
  };

  const handleProprietarioChange = (value) => {
    const proprietarioId = value === "" || value === "none" ? "" : value;
    if (!proprietarioId) {
      set("proprietarioId", "");
      return;
    }

    const selected = proprietarios.find((item) => String(item.id) === String(proprietarioId));
    if (!selected) {
      set("proprietarioId", proprietarioId);
      return;
    }

    setForm((prev) => ({
      ...prev,
      proprietarioId,
      proprietario: selected.name || "",
      proprietarioTelefone: selected.phone ? maskPhone(selected.phone) : "",
      proprietarioCpf: selected.document ? maskCpfCnpj(selected.document) : "",
      proprietarioEmail: selected.email || "",
      proprietarioBanco: selected.bank || "",
      proprietarioAgencia: selected.agency || "",
      proprietarioConta: selected.account || "",
      proprietarioPix: selected.pix || "",
    }));
  };

  const getCurrDisplay = (key, numVal) =>
    currencyDisplays[key] !== undefined
      ? currencyDisplays[key]
      : numVal
        ? formatCurrencyDisplay(numVal)
        : "";

  const setCurrDisplay = (key, raw) =>
    setCurrencyDisplays((prev) => ({ ...prev, [key]: raw }));

  const clearCurrDisplay = (key) =>
    setCurrencyDisplays((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });

  const currencyInputProps = (key, numVal) => ({
    type: "text",
    inputMode: "decimal",
    placeholder: "0,00",
    value: getCurrDisplay(key, numVal),
    onFocus: (e) => {
      if (numVal === 0) {
        setCurrDisplay(key, "");
        return;
      }
      setCurrDisplay(key, sanitizeNumberInput(getCurrDisplay(key, numVal)));
      requestAnimationFrame(() => e.target.select());
    },
    onChange: (e) => {
      const nextValue = sanitizeNumberInput(e.target.value);
      setCurrDisplay(key, nextValue);
      set(key, parseCurrencyInput(nextValue));
    },
    onBlur: () => clearCurrDisplay(key),
  });

  const handleGenericFileUpload = async (file, urlKey) => {
    if (!contrato?.id) {
      toast.error("Salve o contrato antes de anexar. Os anexos só podem ser enviados depois que o contrato for criado.");
      return;
    }

    setUploading(urlKey);
    try {
      const data = await realtyService.uploadContratoMedia([file]);
      const url = Array.isArray(data?.urls) ? data.urls[0] : null;
      if (!url) throw new Error("Falha ao enviar arquivo");
      set(urlKey, url);
      toast.success("Arquivo enviado e salvo!");
    } catch (err) {
      toast.error(err?.response?.data?.error || err?.message || "Não foi possível enviar o arquivo.");
    } finally {
      setUploading(null);
    }
  };

  const handleOpenArquivo = (pathOrUrl) => {
    if (!pathOrUrl) return;
    setViewer({
      open: true,
      loading: false,
      file: {
        url: mediaUrl(pathOrUrl),
        name: getContratoFileName(pathOrUrl, "Anexo do contrato"),
      },
    });
  };

  const handleClose = () => {
    clearFormDraft(getContratoFormDraftKey(contrato?.id)).catch(() => {});
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;

    const normalizedForm = recalculateCommissionState(form);
    const comissaoValor = normalizedForm.comissaoValor || 0;
    const parceiroValor = normalizedForm.parceiroComissaoValor || 0;
    const captadorValor = normalizedForm.captadorComissaoValor || 0;
    const corretorValor = normalizedForm.corretorComissaoValor || 0;
    const impostoValorTotal = normalizedForm.impostoValor || 0;
    const impostoValor = normalizedForm.temParceria ? impostoValorTotal / 2 : impostoValorTotal;

    const orNull = (v) => (v === "" || v === undefined ? null : v);

    const payload = {
      ...normalizedForm,
      title: normalizedForm.title.trim(),
      startDate: orNull(normalizedForm.startDate),
      endDate: orNull(normalizedForm.endDate),
      inquilino: orNull(normalizedForm.inquilino),
      clienteTelefone: orNull(normalizedForm.clienteTelefone),
      clienteCpf: orNull(normalizedForm.clienteCpf),
      clienteEmail: orNull(normalizedForm.clienteEmail),
      clienteRg: orNull(normalizedForm.clienteRg),
      proprietario: orNull(normalizedForm.proprietario),
      notes: orNull(normalizedForm.notes),
      matricula: orNull(normalizedForm.matricula),
      proprietarioId: orNull(normalizedForm.proprietarioId) || null,
      dataProximaCorrecao: orNull(normalizedForm.dataProximaCorrecao),
      dataVencimentoApolice: orNull(normalizedForm.dataVencimentoApolice),
      contratoAnexoUrl: orNull(normalizedForm.contratoAnexoUrl),
      apoliceAnexoUrl: orNull(normalizedForm.apoliceAnexoUrl),
      vistoriaAnexoUrl: orNull(normalizedForm.vistoriaAnexoUrl),
      numeroAgua: orNull(normalizedForm.numeroAgua),
      numeroLuz: orNull(normalizedForm.numeroLuz),
      inscricaoIptu: orNull(normalizedForm.inscricaoIptu),
      valorIptu: normalizedForm.valorIptu || 0,
      iptuParcelado: !!normalizedForm.iptuParcelado,
      valorCondominio: normalizedForm.valorCondominio || 0,
      condominioInclui: orNull(normalizedForm.condominioInclui),
      inquilinoTelefone: orNull(normalizedForm.inquilinoTelefone),
      inquilinoCpf: orNull(normalizedForm.inquilinoCpf),
      inquilinoEmail: orNull(normalizedForm.inquilinoEmail),
      inquilinoRg: orNull(normalizedForm.inquilinoRg),
      inquilino2Nome: orNull(normalizedForm.inquilino2Nome),
      inquilino2Cpf: orNull(normalizedForm.inquilino2Cpf),
      inquilino2Telefone: orNull(normalizedForm.inquilino2Telefone),
      inquilino2Email: orNull(normalizedForm.inquilino2Email),
      inquilino2Rg: orNull(normalizedForm.inquilino2Rg),
      canalOrigem: orNull(normalizedForm.canalOrigem),
      parceriaEnvolvidos: normalizedForm.parceriaEnvolvidos?.length
        ? normalizedForm.parceriaEnvolvidos
        : null,
      proprietarioTelefone: orNull(normalizedForm.proprietarioTelefone),
      proprietarioCpf: orNull(normalizedForm.proprietarioCpf),
      proprietarioEmail: orNull(normalizedForm.proprietarioEmail),
      proprietarioRg: orNull(normalizedForm.proprietarioRg),
      proprietarioBanco: orNull(normalizedForm.proprietarioBanco),
      proprietarioAgencia: orNull(normalizedForm.proprietarioAgencia),
      proprietarioConta: orNull(normalizedForm.proprietarioConta),
      proprietarioPix: orNull(normalizedForm.proprietarioPix),
      parceiroNome: orNull(normalizedForm.parceiroNome),
      captadorNome: orNull(normalizedForm.captadorNome),
      captadorTelefone: orNull(normalizedForm.captadorTelefone),
      impostoTipo: orNull(normalizedForm.impostoTipo),
      corretorNome: orNull(normalizedForm.corretorNome),
      comissaoValor,
      comissaoTipo: normalizedForm.comissaoTipo || "mensal",
      parceiroComissaoValor: parceiroValor,
      captadorComissaoValor: captadorValor,
      corretorComissaoValor: corretorValor,
      impostoValor,
      conjugeProprietario: orNull(normalizedForm.conjugeProprietario),
      conjugeCpf: orNull(normalizedForm.conjugeCpf),
      conjugeTelefone: orNull(normalizedForm.conjugeTelefone),
      conjugeEmail: orNull(normalizedForm.conjugeEmail),
      fiadorMatriculaUrl: orNull(normalizedForm.fiadorMatriculaUrl),
      caucaoComprovanteUrl: orNull(normalizedForm.caucaoComprovanteUrl),
      vistoriaVideoUrl: orNull(normalizedForm.vistoriaVideoUrl),
      aditivoAnexoUrl: orNull(normalizedForm.aditivoAnexoUrl),
      seguroIncendioAnexoUrl: orNull(normalizedForm.seguroIncendioAnexoUrl),
      seguroFiancaAnexoUrl: orNull(normalizedForm.seguroFiancaAnexoUrl),
      fiadorNome: orNull(normalizedForm.fiadorNome),
      fiadorCpf: orNull(normalizedForm.fiadorCpf),
      fiadorTelefone: orNull(normalizedForm.fiadorTelefone),
      fiadorEmail: orNull(normalizedForm.fiadorEmail),
      fiadorEstadoCivil: orNull(normalizedForm.fiadorEstadoCivil),
      fiadorEndereco: orNull(normalizedForm.fiadorEndereco),
      fiadorRendaUrl: orNull(normalizedForm.fiadorRendaUrl),
      fiador2Nome: orNull(normalizedForm.fiador2Nome),
      fiador2Cpf: orNull(normalizedForm.fiador2Cpf),
      fiador2Telefone: orNull(normalizedForm.fiador2Telefone),
      fiador2Email: orNull(normalizedForm.fiador2Email),
      fiador2EstadoCivil: orNull(normalizedForm.fiador2EstadoCivil),
      fiador2Endereco: orNull(normalizedForm.fiador2Endereco),
      fiador2MatriculaUrl: orNull(normalizedForm.fiador2MatriculaUrl),
      fiador2RendaUrl: orNull(normalizedForm.fiador2RendaUrl),
      comprovanteAguaUrl: orNull(normalizedForm.comprovanteAguaUrl),
      comprovanteLuzUrl: orNull(normalizedForm.comprovanteLuzUrl),
      numeroUnidade: orNull(normalizedForm.numeroUnidade),
      imovelId: orNull(normalizedForm.imovelId) || null,
      corretorId: orNull(normalizedForm.corretorId) || null,
    };

    await onSave(payload);
    clearFormDraft(getContratoFormDraftKey(contrato?.id)).catch(() => {});
  };

  const isLocacao = form.tipo === "Locação";
  const calculatedForm = recalculateCommissionState(form);
  const comissaoValorCalc = calculatedForm.comissaoValor || 0;
  const parceiroValorCalc = calculatedForm.parceiroComissaoValor || 0;
  const captadorValorCalc = calculatedForm.captadorComissaoValor || 0;
  const corretorValorCalc = calculatedForm.corretorComissaoValor || 0;
  const impostoValorCalcTotal = calculatedForm.impostoValor || 0;
  const impostoValorCalc = calculatedForm.temParceria
    ? impostoValorCalcTotal / 2
    : impostoValorCalcTotal;
  const fmtCur = (v) =>
    Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const busy = saving || !!uploading;
  const startYear = form.startDate
    ? new Date(`${form.startDate}T00:00:00`).getFullYear()
    : null;

  const FileUploadField = ({ label, urlKey }) => {
    const url = form[urlKey];
    const canUpload = Boolean(contrato?.id);

    return (
      <div className="realty-contrato-upload-field">
        <span className="realty-contrato-label">{label}</span>
        {url ? (
          <div className="realty-contrato-upload realty-contrato-upload--filled">
            <FileText size={16} />
            <button type="button" onClick={() => handleOpenArquivo(url)}>
              Visualizar arquivo
            </button>
            <button
              type="button"
              aria-label={`Remover ${label}`}
              onClick={() => set(urlKey, "")}
              className="realty-prop-icon-btn"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <label
            className={`realty-contrato-upload realty-contrato-upload--empty${
              canUpload ? "" : " is-disabled"
            }`}
          >
            {uploading === urlKey ? (
              <Loader2 size={16} className="realty-imovel-spin" />
            ) : (
              <Upload size={16} />
            )}
            <span>{canUpload ? "Clique para enviar" : "Salve o contrato para anexar"}</span>
            <input
              type="file"
              hidden
              accept={getFileAccept(urlKey)}
              disabled={!canUpload || uploading === urlKey}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleGenericFileUpload(f, urlKey);
                e.target.value = "";
              }}
            />
          </label>
        )}
      </div>
    );
  };

  return (
    <>
      <div
        className="realty-modal-backdrop"
        onClick={busy ? undefined : handleClose}
        role="presentation"
      >
        <form
          className="realty-modal realty-form realty-contrato-modal"
          onClick={(e) => e.stopPropagation()}
          onSubmit={handleSubmit}
        >
          <div className="realty-contrato-modal__head">
            <h3>{contrato ? "Editar Contrato" : "Novo Contrato"}</h3>
            <button
              type="button"
              className="realty-prop-icon-btn"
              onClick={handleClose}
              disabled={busy}
              aria-label="Fechar"
            >
              <X size={18} />
            </button>
          </div>

          <div className="realty-contrato-grid realty-contrato-grid--2">
            <label>
              <span>Título *</span>
              <input
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="Ex: Contrato de Venda - Apt Vila Mariana"
                required
              />
            </label>
            <label>
              <span>Nº Apartamento / Unidade</span>
              <input
                value={form.numeroUnidade}
                onChange={(e) => set("numeroUnidade", e.target.value)}
                placeholder="Ex: 101, Bloco A"
              />
            </label>
          </div>

          <div className="realty-contrato-grid realty-contrato-grid--2">
            <label>
              <span>Cliente *</span>
              <input
                value={form.cliente}
                onChange={(e) => set("cliente", e.target.value)}
                placeholder="Nome do cliente"
                required
              />
            </label>
            <label>
              <span>Tipo</span>
              <select value={form.tipo} onChange={(e) => set("tipo", e.target.value)}>
                {TIPOS_CONTRATO.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="realty-contrato-grid realty-contrato-grid--4">
            <label>
              <span>Telefone Cliente</span>
              <input
                value={form.clienteTelefone}
                onChange={(e) => set("clienteTelefone", maskPhone(e.target.value))}
                placeholder="(00) 00000-0000"
              />
            </label>
            <label>
              <span>CPF Cliente</span>
              <input
                value={form.clienteCpf}
                onChange={(e) => set("clienteCpf", maskCpf(e.target.value))}
                placeholder="000.000.000-00"
              />
            </label>
            <label>
              <span>RG Cliente</span>
              <input
                value={form.clienteRg}
                onChange={(e) => set("clienteRg", e.target.value)}
                placeholder="Nº RG"
              />
            </label>
            <label>
              <span>E-mail Cliente</span>
              <input
                type="email"
                value={form.clienteEmail}
                onChange={(e) => set("clienteEmail", e.target.value)}
                placeholder="cliente@email.com"
              />
            </label>
          </div>

          <div className="realty-contrato-grid realty-contrato-grid--3">
            <label>
              <span>Valor (R$)</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={valorDisplay}
                onFocus={(e) => {
                  if (form.value === 0) {
                    setValorDisplay("");
                    return;
                  }
                  setValorDisplay(sanitizeNumberInput(formatCurrencyDisplay(form.value)));
                  requestAnimationFrame(() => e.target.select());
                }}
                onChange={(e) => {
                  const nextValue = sanitizeNumberInput(e.target.value);
                  setValorDisplay(nextValue);
                  set("value", parseCurrencyInput(nextValue));
                }}
                onBlur={() => setValorDisplay(form.value ? formatCurrencyDisplay(form.value) : "")}
              />
            </label>
            <label>
              <span>Status</span>
              <select value={form.status} onChange={(e) => set("status", e.target.value)}>
                {STATUS_CONTRATO.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Matrícula</span>
              <input
                value={form.matricula}
                onChange={(e) => set("matricula", e.target.value)}
                placeholder="Nº matrícula"
              />
            </label>
          </div>

          <div className="realty-contrato-grid realty-contrato-grid--3">
            <label>
              <span>Nº Cliente Água</span>
              <input
                value={form.numeroAgua}
                onChange={(e) => set("numeroAgua", e.target.value)}
                placeholder="Nº conta água"
              />
            </label>
            <label>
              <span>Nº Cliente Luz</span>
              <input
                value={form.numeroLuz}
                onChange={(e) => set("numeroLuz", e.target.value)}
                placeholder="Nº conta luz"
              />
            </label>
            <label>
              <span>Inscrição IPTU</span>
              <input
                value={form.inscricaoIptu}
                onChange={(e) => set("inscricaoIptu", e.target.value)}
                placeholder="Nº inscrição IPTU"
              />
            </label>
          </div>

          <div className="realty-contrato-section">
            <p className="realty-contrato-section__title">Comprovantes de Transferência</p>
            <p className="realty-contrato-section__hint">
              Anexe aqui os comprovantes de transferência de água e luz.
            </p>
            <div className="realty-contrato-grid realty-contrato-grid--2">
              <FileUploadField label="Comprovante Transferência Água" urlKey="comprovanteAguaUrl" />
              <FileUploadField label="Comprovante Transferência Luz" urlKey="comprovanteLuzUrl" />
            </div>
          </div>

          <div className="realty-contrato-grid realty-contrato-grid--2">
            <label>
              <span>Data Início</span>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => set("startDate", e.target.value)}
              />
            </label>
            <label>
              <span>Data Fim</span>
              <input type="date" value={form.endDate} onChange={(e) => set("endDate", e.target.value)} />
            </label>
          </div>

          <div className="realty-contrato-section">
            <p className="realty-contrato-section__title">Dados do Proprietário</p>
            {isLocacao && (
              <p className="realty-contrato-section__hint">
                Ao vincular um proprietário, os dados bancários do aluguel também são preenchidos
                automaticamente.
              </p>
            )}
            <div className="realty-contrato-grid realty-contrato-grid--2">
              <label>
                <span>Proprietário vinculado</span>
                <select
                  value={form.proprietarioId || ""}
                  onChange={(e) => handleProprietarioChange(e.target.value)}
                >
                  <option value="">Nenhum</option>
                  {proprietarios.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Proprietário (manual)</span>
                <input
                  value={form.proprietario}
                  onChange={(e) => set("proprietario", e.target.value)}
                  placeholder="Nome do proprietário"
                />
              </label>
            </div>
            <div className="realty-contrato-grid realty-contrato-grid--4">
              <label>
                <span>Telefone Proprietário</span>
                <input
                  value={form.proprietarioTelefone}
                  onChange={(e) => set("proprietarioTelefone", maskPhone(e.target.value))}
                  placeholder="(00) 00000-0000"
                />
              </label>
              <label>
                <span>CPF/CNPJ Proprietário</span>
                <input
                  value={form.proprietarioCpf}
                  onChange={(e) => set("proprietarioCpf", maskCpfCnpj(e.target.value))}
                  placeholder="000.000.000-00"
                />
              </label>
              <label>
                <span>RG Proprietário</span>
                <input
                  value={form.proprietarioRg}
                  onChange={(e) => set("proprietarioRg", e.target.value)}
                  placeholder="Nº RG"
                />
              </label>
              <label>
                <span>E-mail Proprietário</span>
                <input
                  type="email"
                  value={form.proprietarioEmail}
                  onChange={(e) => set("proprietarioEmail", e.target.value)}
                  placeholder="proprietario@email.com"
                />
              </label>
            </div>
          </div>

          <div className="realty-contrato-section">
            <p className="realty-contrato-section__title">Dados Bancários do Proprietário</p>
            <div className="realty-contrato-grid realty-contrato-grid--4">
              <label>
                <span>Banco</span>
                <input
                  value={form.proprietarioBanco}
                  onChange={(e) => set("proprietarioBanco", e.target.value)}
                  placeholder="Nome do banco"
                />
              </label>
              <label>
                <span>Agência</span>
                <input
                  value={form.proprietarioAgencia}
                  onChange={(e) => set("proprietarioAgencia", e.target.value)}
                  placeholder="0000"
                />
              </label>
              <label>
                <span>Conta</span>
                <input
                  value={form.proprietarioConta}
                  onChange={(e) => set("proprietarioConta", e.target.value)}
                  placeholder="00000-0"
                />
              </label>
              <label>
                <span>Chave PIX</span>
                <input
                  value={form.proprietarioPix}
                  onChange={(e) => set("proprietarioPix", e.target.value)}
                  placeholder="CPF, e-mail, telefone ou chave aleatória"
                />
              </label>
            </div>
          </div>

          <div className="realty-contrato-section">
            <p className="realty-contrato-section__title">Cônjuge / Outro Proprietário</p>
            <div className="realty-contrato-grid realty-contrato-grid--2">
              <label>
                <span>Nome do Cônjuge</span>
                <input
                  value={form.conjugeProprietario}
                  onChange={(e) => set("conjugeProprietario", e.target.value)}
                  placeholder="Nome completo"
                />
              </label>
              <label>
                <span>CPF do Cônjuge</span>
                <input
                  value={form.conjugeCpf}
                  onChange={(e) => set("conjugeCpf", maskCpf(e.target.value))}
                  placeholder="000.000.000-00"
                />
              </label>
              <label>
                <span>Telefone do Cônjuge</span>
                <input
                  value={form.conjugeTelefone}
                  onChange={(e) => set("conjugeTelefone", maskPhone(e.target.value))}
                  placeholder="(00) 00000-0000"
                />
              </label>
              <label>
                <span>E-mail do Cônjuge</span>
                <input
                  type="email"
                  value={form.conjugeEmail}
                  onChange={(e) => set("conjugeEmail", e.target.value)}
                  placeholder="conjuge@email.com"
                />
              </label>
            </div>
          </div>

          <div className="realty-contrato-section">
            <p className="realty-contrato-section__title">Anexos do Contrato</p>
            <div className="realty-contrato-grid realty-contrato-grid--3">
              <FileUploadField label="Contrato (PDF)" urlKey="contratoAnexoUrl" />
              <FileUploadField label="Aditivo Contratual" urlKey="aditivoAnexoUrl" />
              <FileUploadField label="Vistoria" urlKey="vistoriaAnexoUrl" />
            </div>
            {isLocacao ? (
              <>
                <div className="realty-contrato-grid realty-contrato-grid--3">
                  <FileUploadField
                    label="Apólice Seguro Incêndio"
                    urlKey="seguroIncendioAnexoUrl"
                  />
                  <FileUploadField label="Seguro Fiança (anexo)" urlKey="seguroFiancaAnexoUrl" />
                  <FileUploadField label="Apólice Geral" urlKey="apoliceAnexoUrl" />
                </div>
                <div className="realty-contrato-grid realty-contrato-grid--3">
                  <FileUploadField label="Comprovante de Caução" urlKey="caucaoComprovanteUrl" />
                  <FileUploadField label="Vídeo de Vistoria (anexo)" urlKey="vistoriaVideoUrl" />
                </div>
              </>
            ) : (
              <div className="realty-contrato-grid realty-contrato-grid--2">
                <FileUploadField label="Apólice" urlKey="apoliceAnexoUrl" />
              </div>
            )}
          </div>

          <div className="realty-contrato-section">
            <p className="realty-contrato-section__title">IPTU e Condomínio</p>
            <div className="realty-contrato-grid realty-contrato-grid--3">
              <label>
                <span>Valor IPTU (R$)</span>
                <input {...currencyInputProps("valorIptu", form.valorIptu)} />
              </label>
              <div className="realty-contrato-switch-wrap">
                <SwitchRow
                  checked={!!form.iptuParcelado}
                  onChange={(v) => set("iptuParcelado", v)}
                  label={form.iptuParcelado ? "Parcelado 6x" : "À vista"}
                />
              </div>
              {form.iptuParcelado && form.valorIptu > 0 && (
                <p className="realty-contrato-calc">Parcela: {fmtCur(form.valorIptu / 6)}</p>
              )}
            </div>
            <div className="realty-contrato-grid realty-contrato-grid--2">
              <label>
                <span>Valor Condomínio (R$)</span>
                <input {...currencyInputProps("valorCondominio", form.valorCondominio)} />
              </label>
              <label>
                <span>O que inclui</span>
                <input
                  value={form.condominioInclui}
                  onChange={(e) => set("condominioInclui", e.target.value)}
                  placeholder="Água, gás, portaria..."
                />
              </label>
            </div>
          </div>

          <ContratoComprovantesMensaisSection contratoId={contrato?.id} startYear={startYear} />

          {isLocacao && (
            <>
              <p className="realty-contrato-section__title">Dados da Locação</p>

              <ContratoAnexosAnuaisSection contratoId={contrato?.id} startYear={startYear} />

              <label>
                <span>Inquilino (Locatário)</span>
                <input
                  value={form.inquilino}
                  onChange={(e) => set("inquilino", e.target.value)}
                  placeholder="Nome do inquilino"
                />
              </label>
              <div className="realty-contrato-grid realty-contrato-grid--4">
                <label>
                  <span>Telefone Locatário</span>
                  <input
                    value={form.inquilinoTelefone}
                    onChange={(e) => set("inquilinoTelefone", maskPhone(e.target.value))}
                    placeholder="(00) 00000-0000"
                  />
                </label>
                <label>
                  <span>CPF Locatário</span>
                  <input
                    value={form.inquilinoCpf}
                    onChange={(e) => set("inquilinoCpf", maskCpf(e.target.value))}
                    placeholder="000.000.000-00"
                  />
                </label>
                <label>
                  <span>RG Locatário</span>
                  <input
                    value={form.inquilinoRg}
                    onChange={(e) => set("inquilinoRg", e.target.value)}
                    placeholder="Nº RG"
                  />
                </label>
                <label>
                  <span>E-mail Locatário</span>
                  <input
                    type="email"
                    value={form.inquilinoEmail}
                    onChange={(e) => set("inquilinoEmail", e.target.value)}
                    placeholder="inquilino@email.com"
                  />
                </label>
              </div>

              <div className="realty-contrato-section">
                <p className="realty-contrato-section__title">Inquilino 2 (opcional)</p>
                <label>
                  <span>Nome do Inquilino 2</span>
                  <input
                    value={form.inquilino2Nome}
                    onChange={(e) => set("inquilino2Nome", e.target.value)}
                    placeholder="Nome completo"
                  />
                </label>
                <div className="realty-contrato-grid realty-contrato-grid--4">
                  <label>
                    <span>Telefone</span>
                    <input
                      value={form.inquilino2Telefone}
                      onChange={(e) => set("inquilino2Telefone", maskPhone(e.target.value))}
                      placeholder="(00) 00000-0000"
                    />
                  </label>
                  <label>
                    <span>CPF</span>
                    <input
                      value={form.inquilino2Cpf}
                      onChange={(e) => set("inquilino2Cpf", maskCpf(e.target.value))}
                      placeholder="000.000.000-00"
                    />
                  </label>
                  <label>
                    <span>RG</span>
                    <input
                      value={form.inquilino2Rg}
                      onChange={(e) => set("inquilino2Rg", e.target.value)}
                      placeholder="Nº RG"
                    />
                  </label>
                  <label>
                    <span>E-mail</span>
                    <input
                      type="email"
                      value={form.inquilino2Email}
                      onChange={(e) => set("inquilino2Email", e.target.value)}
                      placeholder="inquilino2@email.com"
                    />
                  </label>
                </div>
              </div>

              <div className="realty-contrato-grid realty-contrato-grid--3">
                <label>
                  <span>Dia Vencimento</span>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={form.diaVencimentoAluguel || ""}
                    onChange={(e) => set("diaVencimentoAluguel", Number(e.target.value) || 0)}
                    placeholder="10"
                  />
                </label>
                <label>
                  <span>Índice Correção</span>
                  <select
                    value={form.indiceCorrecao}
                    onChange={(e) => set("indiceCorrecao", e.target.value)}
                  >
                    {INDICE_CORRECAO.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>% Correção</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={percentualDisplay}
                    onFocus={() => {
                      if (form.percentualCorrecao === 0) setPercentualDisplay("");
                    }}
                    onChange={(e) => {
                      const nextValue = sanitizeNumberInput(e.target.value);
                      setPercentualDisplay(nextValue);
                      set("percentualCorrecao", parseCurrencyInput(nextValue));
                    }}
                    onBlur={() =>
                      setPercentualDisplay(
                        form.percentualCorrecao
                          ? formatPercentDisplay(form.percentualCorrecao)
                          : ""
                      )
                    }
                  />
                </label>
              </div>

              <div className="realty-contrato-grid realty-contrato-grid--2">
                <label>
                  <span>Próxima Correção</span>
                  <input
                    type="date"
                    value={form.dataProximaCorrecao}
                    onChange={(e) => set("dataProximaCorrecao", e.target.value)}
                  />
                </label>
                <label>
                  <span>Venc. Apólice Garantia</span>
                  <input
                    type="date"
                    value={form.dataVencimentoApolice}
                    onChange={(e) => set("dataVencimentoApolice", e.target.value)}
                  />
                </label>
              </div>

              <label>
                <span>Tipo de Garantia</span>
                <select
                  value={form.tipoGarantia}
                  onChange={(e) => set("tipoGarantia", e.target.value)}
                >
                  {TIPO_GARANTIA.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </label>

              {form.tipoGarantia === "caucao" && (
                <div className="realty-contrato-section">
                  <div className="realty-contrato-grid realty-contrato-grid--2">
                    <label>
                      <span>Valor da Caução (R$)</span>
                      <input {...currencyInputProps("caucaoValor", form.caucaoValor)} />
                    </label>
                    <label>
                      <span>Quantidade (meses)</span>
                      <input
                        type="number"
                        min={1}
                        max={12}
                        value={form.caucaoQuantidade || 1}
                        onChange={(e) => set("caucaoQuantidade", Number(e.target.value) || 1)}
                      />
                    </label>
                  </div>
                  <FileUploadField label="Comprovante de Caução" urlKey="caucaoComprovanteUrl" />
                </div>
              )}

              {form.tipoGarantia === "fiador" && (
                <>
                  <div className="realty-contrato-section">
                    <p className="realty-contrato-section__title">Dados do Fiador 1</p>
                    <div className="realty-contrato-grid realty-contrato-grid--2">
                      <label>
                        <span>Nome do Fiador</span>
                        <input
                          value={form.fiadorNome}
                          onChange={(e) => set("fiadorNome", e.target.value)}
                          placeholder="Nome completo"
                        />
                      </label>
                      <label>
                        <span>CPF do Fiador</span>
                        <input
                          value={form.fiadorCpf}
                          onChange={(e) => set("fiadorCpf", maskCpf(e.target.value))}
                          placeholder="000.000.000-00"
                        />
                      </label>
                      <label>
                        <span>Telefone</span>
                        <input
                          value={form.fiadorTelefone}
                          onChange={(e) => set("fiadorTelefone", maskPhone(e.target.value))}
                          placeholder="(00) 00000-0000"
                        />
                      </label>
                      <label>
                        <span>E-mail</span>
                        <input
                          type="email"
                          value={form.fiadorEmail}
                          onChange={(e) => set("fiadorEmail", e.target.value)}
                          placeholder="fiador@email.com"
                        />
                      </label>
                      <label>
                        <span>Estado Civil</span>
                        <select
                          value={form.fiadorEstadoCivil || ""}
                          onChange={(e) => set("fiadorEstadoCivil", e.target.value)}
                        >
                          <option value="">Não informado</option>
                          {ESTADO_CIVIL.map((ec) => (
                            <option key={ec.id} value={ec.id}>
                              {ec.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>Endereço</span>
                        <input
                          value={form.fiadorEndereco}
                          onChange={(e) => set("fiadorEndereco", e.target.value)}
                          placeholder="Endereço do fiador"
                        />
                      </label>
                    </div>
                    <FileUploadField
                      label="Matrícula/Escritura do Fiador 1"
                      urlKey="fiadorMatriculaUrl"
                    />
                    <FileUploadField
                      label="Comprovante de Renda - Fiador 1"
                      urlKey="fiadorRendaUrl"
                    />
                  </div>

                  <div className="realty-contrato-section">
                    <p className="realty-contrato-section__title">Dados do Fiador 2</p>
                    <div className="realty-contrato-grid realty-contrato-grid--2">
                      <label>
                        <span>Nome do Fiador 2</span>
                        <input
                          value={form.fiador2Nome}
                          onChange={(e) => set("fiador2Nome", e.target.value)}
                          placeholder="Nome completo"
                        />
                      </label>
                      <label>
                        <span>CPF do Fiador 2</span>
                        <input
                          value={form.fiador2Cpf}
                          onChange={(e) => set("fiador2Cpf", maskCpf(e.target.value))}
                          placeholder="000.000.000-00"
                        />
                      </label>
                      <label>
                        <span>Telefone</span>
                        <input
                          value={form.fiador2Telefone}
                          onChange={(e) => set("fiador2Telefone", maskPhone(e.target.value))}
                          placeholder="(00) 00000-0000"
                        />
                      </label>
                      <label>
                        <span>E-mail</span>
                        <input
                          type="email"
                          value={form.fiador2Email}
                          onChange={(e) => set("fiador2Email", e.target.value)}
                          placeholder="fiador2@email.com"
                        />
                      </label>
                      <label>
                        <span>Estado Civil</span>
                        <select
                          value={form.fiador2EstadoCivil || ""}
                          onChange={(e) => set("fiador2EstadoCivil", e.target.value)}
                        >
                          <option value="">Não informado</option>
                          {ESTADO_CIVIL.map((ec) => (
                            <option key={ec.id} value={ec.id}>
                              {ec.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>Endereço</span>
                        <input
                          value={form.fiador2Endereco}
                          onChange={(e) => set("fiador2Endereco", e.target.value)}
                          placeholder="Endereço do fiador 2"
                        />
                      </label>
                    </div>
                    <FileUploadField
                      label="Matrícula/Escritura do Fiador 2"
                      urlKey="fiador2MatriculaUrl"
                    />
                    <FileUploadField
                      label="Comprovante de Renda - Fiador 2"
                      urlKey="fiador2RendaUrl"
                    />
                  </div>
                </>
              )}

              <div className="realty-contrato-section">
                <p className="realty-contrato-section__title">Documentação da Locação</p>
                <SwitchRow
                  checked={!!form.vistoriaEntrada}
                  onChange={(v) => set("vistoriaEntrada", v)}
                  label="Vistoria de entrada"
                />
                <SwitchRow
                  checked={!!form.vistoriaVideo}
                  onChange={(v) => set("vistoriaVideo", v)}
                  label="Vídeo de vistoria"
                />
                <SwitchRow
                  checked={!!form.apoliceSeguro}
                  onChange={(v) => set("apoliceSeguro", v)}
                  label="Apólice de seguro"
                />
              </div>
            </>
          )}

          <div className="realty-contrato-section">
            <p className="realty-contrato-section__title">Comissão e Divisão</p>
            {isLocacao && (
              <label>
                <span>Tipo de Comissão</span>
                <select
                  value={form.comissaoTipo}
                  onChange={(e) => set("comissaoTipo", e.target.value)}
                >
                  {COMISSAO_TIPOS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className="realty-contrato-grid realty-contrato-grid--3">
              <label>
                <span>% Comissão Total</span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="6,00"
                  value={form.comissaoPercentual || ""}
                  onChange={(e) => {
                    const pct = parseCurrencyInput(sanitizeNumberInput(e.target.value));
                    set("comissaoPercentual", pct);
                    set("comissaoValor", (getCommissionBaseValue(form) * pct) / 100);
                  }}
                />
              </label>
              <label>
                <span>ou Valor (R$)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={getCurrDisplay("comissaoValor", calculatedForm.comissaoValor)}
                  onFocus={(e) => {
                    if (calculatedForm.comissaoValor === 0) {
                      setCurrDisplay("comissaoValor", "");
                      return;
                    }
                    setCurrDisplay(
                      "comissaoValor",
                      sanitizeNumberInput(getCurrDisplay("comissaoValor", calculatedForm.comissaoValor))
                    );
                    requestAnimationFrame(() => e.target.select());
                  }}
                  onChange={(e) => {
                    const raw = sanitizeNumberInput(e.target.value);
                    setCurrDisplay("comissaoValor", raw);
                    const val = parseCurrencyInput(raw);
                    const base = getCommissionBaseValue(form);
                    set("comissaoValor", val);
                    set("comissaoPercentual", base > 0 ? (val / base) * 100 : 0);
                  }}
                  onBlur={() => clearCurrDisplay("comissaoValor")}
                />
              </label>
              <p className="realty-contrato-calc">
                {comissaoValorCalc > 0 ? fmtCur(comissaoValorCalc) : "—"}
              </p>
            </div>

            <div className="realty-contrato-grid realty-contrato-grid--3">
              <label>
                <span>Corretor Responsável</span>
                <input
                  value={form.corretorNome}
                  onChange={(e) => set("corretorNome", e.target.value)}
                  placeholder="Nome"
                />
              </label>
              <label>
                <span>% Comissão p/ Corretor</span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="50"
                  value={form.corretorComissaoPercentual || ""}
                  onChange={(e) => {
                    const pct = parseCurrencyInput(sanitizeNumberInput(e.target.value));
                    const base = form.comissaoValor || comissaoValorCalc;
                    set("corretorComissaoPercentual", pct);
                    set("corretorComissaoValor", (base * pct) / 100);
                  }}
                />
              </label>
              <label>
                <span>ou Valor (R$)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={getCurrDisplay("corretorComissaoValor", calculatedForm.corretorComissaoValor)}
                  onFocus={() => {
                    if (calculatedForm.corretorComissaoValor === 0) {
                      setCurrDisplay("corretorComissaoValor", "");
                    }
                  }}
                  onChange={(e) => {
                    const raw = sanitizeNumberInput(e.target.value);
                    setCurrDisplay("corretorComissaoValor", raw);
                    const val = parseCurrencyInput(raw);
                    set("corretorComissaoValor", val);
                    set(
                      "corretorComissaoPercentual",
                      comissaoValorCalc > 0 ? (val / comissaoValorCalc) * 100 : 0
                    );
                  }}
                  onBlur={() => clearCurrDisplay("corretorComissaoValor")}
                />
                {corretorValorCalc > 0 && (
                  <span className="realty-contrato-calc-hint">{fmtCur(corretorValorCalc)}</span>
                )}
              </label>
            </div>

            <SwitchRow
              checked={!!form.temParceria}
              onChange={(v) => set("temParceria", v)}
              label="Parceria"
            />

            {form.temParceria && (
              <div className="realty-contrato-grid realty-contrato-grid--3">
                <label>
                  <span>Nome do Parceiro</span>
                  <input
                    value={form.parceiroNome}
                    onChange={(e) => set("parceiroNome", e.target.value)}
                    placeholder="Imobiliária/Corretor parceiro"
                  />
                </label>
                <label>
                  <span>% Comissão p/ Parceiro</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="50"
                    value={form.parceiroComissaoPercentual || ""}
                    onChange={(e) => {
                      const pct = parseCurrencyInput(sanitizeNumberInput(e.target.value));
                      const base = form.comissaoValor || comissaoValorCalc;
                      set("parceiroComissaoPercentual", pct);
                      set("parceiroComissaoValor", (base * pct) / 100);
                    }}
                  />
                </label>
                <label>
                  <span>ou Valor (R$)</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={getCurrDisplay("parceiroComissaoValor", calculatedForm.parceiroComissaoValor)}
                    onFocus={() => {
                      if (calculatedForm.parceiroComissaoValor === 0) {
                        setCurrDisplay("parceiroComissaoValor", "");
                      }
                    }}
                    onChange={(e) => {
                      const raw = sanitizeNumberInput(e.target.value);
                      setCurrDisplay("parceiroComissaoValor", raw);
                      const val = parseCurrencyInput(raw);
                      set("parceiroComissaoValor", val);
                      set(
                        "parceiroComissaoPercentual",
                        comissaoValorCalc > 0 ? (val / comissaoValorCalc) * 100 : 0
                      );
                    }}
                    onBlur={() => clearCurrDisplay("parceiroComissaoValor")}
                  />
                  {parceiroValorCalc > 0 && (
                    <span className="realty-contrato-calc-hint">{fmtCur(parceiroValorCalc)}</span>
                  )}
                </label>
              </div>
            )}

            <p className="realty-contrato-section__subtitle">Captador</p>
            <div className="realty-contrato-grid realty-contrato-grid--4">
              <label>
                <span>Nome</span>
                <input
                  value={form.captadorNome}
                  onChange={(e) => set("captadorNome", e.target.value)}
                  placeholder="Captador"
                />
              </label>
              <label>
                <span>Telefone</span>
                <input
                  value={form.captadorTelefone}
                  onChange={(e) => set("captadorTelefone", maskPhone(e.target.value))}
                  placeholder="(00) 00000-0000"
                />
              </label>
              <label>
                <span>% Comissão</span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="10"
                  value={form.captadorComissaoPercentual || ""}
                  onChange={(e) => {
                    const pct = parseCurrencyInput(sanitizeNumberInput(e.target.value));
                    const base = form.comissaoValor || comissaoValorCalc;
                    set("captadorComissaoPercentual", pct);
                    set("captadorComissaoValor", (base * pct) / 100);
                  }}
                />
              </label>
              <label>
                <span>ou Valor (R$)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={getCurrDisplay("captadorComissaoValor", calculatedForm.captadorComissaoValor)}
                  onFocus={() => {
                    if (calculatedForm.captadorComissaoValor === 0) {
                      setCurrDisplay("captadorComissaoValor", "");
                    }
                  }}
                  onChange={(e) => {
                    const raw = sanitizeNumberInput(e.target.value);
                    setCurrDisplay("captadorComissaoValor", raw);
                    const val = parseCurrencyInput(raw);
                    set("captadorComissaoValor", val);
                    set(
                      "captadorComissaoPercentual",
                      comissaoValorCalc > 0 ? (val / comissaoValorCalc) * 100 : 0
                    );
                  }}
                  onBlur={() => clearCurrDisplay("captadorComissaoValor")}
                />
                {captadorValorCalc > 0 && (
                  <span className="realty-contrato-calc-hint">{fmtCur(captadorValorCalc)}</span>
                )}
              </label>
            </div>

            <p className="realty-contrato-section__subtitle">Impostos</p>
            <div className="realty-contrato-grid realty-contrato-grid--4">
              <label>
                <span>Tipo</span>
                <select
                  value={form.impostoTipo || ""}
                  onChange={(e) => set("impostoTipo", e.target.value)}
                >
                  <option value="">Nenhum</option>
                  {IMPOSTO_TIPOS.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>% Imposto</span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="6,00"
                  value={form.impostoPercentual || ""}
                  onChange={(e) => {
                    const pct = parseCurrencyInput(sanitizeNumberInput(e.target.value));
                    const base = form.comissaoValor || comissaoValorCalc;
                    set("impostoPercentual", pct);
                    set("impostoValor", (base * pct) / 100);
                  }}
                />
              </label>
              <label>
                <span>ou Valor (R$)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={getCurrDisplay("impostoValor", calculatedForm.impostoValor)}
                  onFocus={() => {
                    if (calculatedForm.impostoValor === 0) setCurrDisplay("impostoValor", "");
                  }}
                  onChange={(e) => {
                    const raw = sanitizeNumberInput(e.target.value);
                    setCurrDisplay("impostoValor", raw);
                    const val = parseCurrencyInput(raw);
                    set("impostoValor", val);
                    set(
                      "impostoPercentual",
                      comissaoValorCalc > 0 ? (val / comissaoValorCalc) * 100 : 0
                    );
                  }}
                  onBlur={() => clearCurrDisplay("impostoValor")}
                />
              </label>
              <p className="realty-contrato-calc realty-contrato-calc--danger">
                {impostoValorCalc > 0 ? (
                  <>
                    -{fmtCur(impostoValorCalc)}
                    {form.temParceria && <span> (÷2)</span>}
                  </>
                ) : (
                  "—"
                )}
              </p>
            </div>
          </div>

          <label>
            <span>Canal de Origem</span>
            <select
              value={form.canalOrigem || ""}
              onChange={(e) => set("canalOrigem", e.target.value)}
            >
              <option value="">Não informado</option>
              {CANAIS_ORIGEM.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>

          {form.canalOrigem === "parceria_corretor" && (
            <div className="realty-contrato-section">
              <div className="realty-contrato-section__title-row">
                <p className="realty-contrato-section__title">Envolvidos na Parceria</p>
                <button
                  type="button"
                  className="realty-contrato-link-btn"
                  onClick={() =>
                    set("parceriaEnvolvidos", [...(form.parceriaEnvolvidos || []), ""])
                  }
                >
                  <Plus size={12} /> Adicionar
                </button>
              </div>
              {(form.parceriaEnvolvidos || []).length === 0 && (
                <p className="realty-contrato-section__hint">
                  Nenhum envolvido adicionado. Clique em &quot;Adicionar&quot;.
                </p>
              )}
              {(form.parceriaEnvolvidos || []).map((nome, idx) => (
                <div key={idx} className="realty-contrato-envolvido">
                  <span>{idx + 1}.</span>
                  <input
                    value={nome}
                    onChange={(e) => {
                      const updated = [...(form.parceriaEnvolvidos || [])];
                      updated[idx] = e.target.value;
                      set("parceriaEnvolvidos", updated);
                    }}
                    placeholder={`Nome do envolvido ${idx + 1}`}
                  />
                  <button
                    type="button"
                    className="realty-prop-icon-btn"
                    onClick={() => {
                      const updated = (form.parceriaEnvolvidos || []).filter((_, i) => i !== idx);
                      set("parceriaEnvolvidos", updated);
                    }}
                    aria-label="Remover envolvido"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <ContratoDocChecklist tipo={form.tipo} form={form} />

          <label>
            <span>Observações</span>
            <textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Anotações..."
              rows={2}
            />
          </label>

          <button
            type="submit"
            className="realty-page__btn realty-contrato-submit"
            disabled={busy || !form.title.trim()}
          >
            {saving && <Loader2 size={16} className="realty-imovel-spin" />}
            {contrato ? "Salvar Alterações" : "Criar Contrato"}
          </button>
        </form>
      </div>

      <ContratoFileViewerDialog
        open={viewer.open}
        loading={viewer.loading}
        file={viewer.file}
        onClose={() => setViewer({ open: false, loading: false, file: null })}
      />
    </>
  );
};

export default ContratoFormDialog;
