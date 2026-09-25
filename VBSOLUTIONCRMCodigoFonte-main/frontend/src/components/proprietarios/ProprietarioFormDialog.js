/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 *
 * Formulário completo de Proprietário (paridade Lovable ProprietarioFormDialog).
 * Visual: design system realty VBSolution.
 */

import React, { useEffect, useRef, useState } from "react";
import { Cake, FileText, Loader2, Plus, Trash2, Upload, X } from "lucide-react";
import { toast } from "react-toastify";
import realtyService from "../../services/realtyService";
import { mediaUrl } from "../../helpers/realtyCrm";
import {
  CANAIS_ORIGEM_PROP,
  DADOS_IMOVEL_TIPOS,
  ESTADOS_CIVIS,
  FAMILIAR_RELACOES,
  buildProprietarioPayload,
  emptyProprietarioForm,
  isCasadoOuUniao,
  proprietarioFromApi,
} from "../../helpers/proprietarioCrm";

const DRAFT_KEY = "proprietario_form_backup";

const SwitchRow = ({ checked, onChange, label }) => (
  <label className="realty-imovel-switch-row">
    <button
      type="button"
      className={`realty-imovel-switch${checked ? " realty-imovel-switch--on" : ""}`}
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
    >
      <span className="realty-imovel-switch__knob" />
    </button>
    <span>{label}</span>
  </label>
);

const ProprietarioFormDialog = ({ open, onOpenChange, proprietario, onSave, saving }) => {
  const [form, setForm] = useState(emptyProprietarioForm());
  const [familiares, setFamiliares] = useState([]);
  const [uploadingField, setUploadingField] = useState(null);
  const exclusividadeInputRef = useRef(null);
  const certidaoInputRef = useRef(null);
  const isNew = !proprietario;

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  useEffect(() => {
    if (!open) return;
    if (proprietario) {
      const mapped = proprietarioFromApi(proprietario);
      const { familiares: fams, ...rest } = mapped;
      setForm(rest);
      setFamiliares(fams || []);
    } else {
      setForm(emptyProprietarioForm());
      setFamiliares([]);
      try {
        const backup = localStorage.getItem(DRAFT_KEY);
        if (backup) {
          const parsed = JSON.parse(backup);
          if (parsed?.name) setForm((prev) => ({ ...prev, ...parsed }));
        }
      } catch {
        /* ignore */
      }
    }
  }, [proprietario, open]);

  useEffect(() => {
    if (open && isNew) {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
      } catch {
        /* ignore */
      }
    }
  }, [form, open, isNew]);

  const handleFileUpload = async (file, field) => {
    setUploadingField(field);
    try {
      const data = await realtyService.uploadProprietarioMedia([file]);
      const url = Array.isArray(data?.urls) ? data.urls[0] : null;
      if (!url) throw new Error("Falha ao enviar arquivo");
      set(field, url);
      toast.success("Arquivo enviado com sucesso!");
    } catch (err) {
      toast.error(err?.response?.data?.error || err.message || "Erro no upload");
    } finally {
      setUploadingField(null);
    }
  };

  const handleOpenFile = (url) => {
    if (!url) return;
    window.open(mediaUrl(url), "_blank", "noopener,noreferrer");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    const payload = buildProprietarioPayload(form, familiares);
    await onSave(payload);
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
  };

  const addFamiliar = () =>
    setFamiliares((prev) => [...prev, { nome: "", dataNascimento: "", relacao: "filho" }]);
  const removeFamiliar = (idx) => setFamiliares((prev) => prev.filter((_, i) => i !== idx));
  const updateFamiliar = (idx, patch) =>
    setFamiliares((prev) => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)));

  const renderFileUpload = (label, field, inputRef, viewLabel, uploadLabel) => (
    <div className="realty-prop-upload">
      <span className="realty-prop-label">{label}</span>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
        className="realty-prop-file-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileUpload(file, field);
          e.target.value = "";
        }}
      />
      {form[field] ? (
        <div className="realty-prop-file-row">
          <FileText size={16} />
          <button type="button" className="realty-prop-link" onClick={() => handleOpenFile(form[field])}>
            {viewLabel}
          </button>
          <button type="button" className="realty-prop-icon-btn" onClick={() => set(field, "")} title="Remover">
            <X size={14} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="realty-imovel-upload"
          onClick={() => inputRef.current?.click()}
          disabled={uploadingField === field}
        >
          {uploadingField === field ? (
            <>
              <Loader2 size={16} className="realty-spin" /> Enviando...
            </>
          ) : (
            <>
              <Upload size={16} /> {uploadLabel}
            </>
          )}
        </button>
      )}
    </div>
  );

  const safeOpenChange = (value) => {
    // Evita fechar ao trocar de aba do browser (paridade Lovable safeOpenChange)
    if (!value && typeof document !== "undefined" && document.hidden) return;
    onOpenChange(value);
  };

  if (!open) return null;

  return (
    <div
      className="realty-modal-backdrop"
      onClick={() => safeOpenChange(false)}
      role="presentation"
    >
      <form
        className="realty-modal realty-form realty-prop-form"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="realty-prop-form__head">
          <h3>{proprietario ? "Editar Proprietário" : "Novo Proprietário"}</h3>
          <button type="button" className="realty-prop-icon-btn" onClick={() => safeOpenChange(false)}>
            <X size={18} />
          </button>
        </div>

        <div className="realty-prop-grid realty-prop-grid--2">
          <label className="realty-prop-span-2">
            <span>Nome *</span>
            <input value={form.name} onChange={(e) => set("name", e.target.value)} required />
          </label>
          <label>
            <span>CPF/CNPJ</span>
            <input value={form.document} onChange={(e) => set("document", e.target.value)} />
          </label>
          <label>
            <span>Tipo</span>
            <select value={form.tipo} onChange={(e) => set("tipo", e.target.value)}>
              <option value="venda">Venda</option>
              <option value="aluguel">Aluguel</option>
              <option value="ambos">Ambos</option>
            </select>
          </label>
        </div>

        <div className="realty-prop-grid realty-prop-grid--2">
          <label>
            <span>Estado Civil</span>
            <select value={form.estadoCivil || ""} onChange={(e) => set("estadoCivil", e.target.value)}>
              <option value="">Não informado</option>
              {ESTADOS_CIVIS.map((ec) => (
                <option key={ec} value={ec}>
                  {ec}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Canal de Origem</span>
            <select value={form.canalOrigem || ""} onChange={(e) => set("canalOrigem", e.target.value)}>
              <option value="">Não informado</option>
              {CANAIS_ORIGEM_PROP.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </div>

        {isCasadoOuUniao(form.estadoCivil) && (
          <div className="realty-imovel-box">
            <p className="realty-imovel-box__title">Cônjuge / Companheiro(a)</p>
            <div className="realty-prop-grid realty-prop-grid--2">
              <label>
                <span>Nome</span>
                <input
                  value={form.conjugeNome}
                  onChange={(e) => set("conjugeNome", e.target.value)}
                  placeholder="Nome do cônjuge"
                />
              </label>
              <label>
                <span>CPF</span>
                <input
                  value={form.conjugeCpf}
                  onChange={(e) => set("conjugeCpf", e.target.value)}
                  placeholder="000.000.000-00"
                />
              </label>
              <label>
                <span>Data de Nascimento do Cônjuge</span>
                <input
                  type="date"
                  value={form.conjugeDataNascimento || ""}
                  onChange={(e) => set("conjugeDataNascimento", e.target.value)}
                />
              </label>
            </div>
          </div>
        )}

        <div className="realty-imovel-box">
          <p className="realty-imovel-box__title">
            <Cake size={14} style={{ verticalAlign: "middle", marginRight: 6 }} />
            Datas de Relacionamento (para lembretes automáticos)
          </p>
          <div className="realty-prop-grid realty-prop-grid--3">
            <label>
              <span>Data de Nascimento</span>
              <input
                type="date"
                value={form.dataNascimento || ""}
                onChange={(e) => set("dataNascimento", e.target.value)}
              />
            </label>
            <label>
              <span>Data de Casamento</span>
              <input
                type="date"
                value={form.dataCasamento || ""}
                onChange={(e) => set("dataCasamento", e.target.value)}
              />
            </label>
            <label>
              <span>Aniversário da Compra do Imóvel</span>
              <input
                type="date"
                value={form.dataCompraImovel || ""}
                onChange={(e) => set("dataCompraImovel", e.target.value)}
              />
            </label>
          </div>

          <div className="realty-prop-familiares">
            <div className="realty-prop-familiares__head">
              <span className="realty-prop-label">Familiares (filhos, parentes)</span>
              <button type="button" className="realty-page__btn realty-page__btn--ghost" onClick={addFamiliar}>
                <Plus size={14} /> Adicionar
              </button>
            </div>
            {familiares.length === 0 && (
              <p className="realty-prop-hint">
                Nenhum familiar cadastrado. Clique em &quot;Adicionar&quot; para incluir aniversários de filhos ou
                parentes.
              </p>
            )}
            {familiares.map((f, idx) => (
              <div key={f.id ?? `new-${idx}`} className="realty-prop-familiar-row">
                <label>
                  <span>Nome</span>
                  <input
                    value={f.nome}
                    onChange={(e) => updateFamiliar(idx, { nome: e.target.value })}
                    placeholder="Ex: João (filho)"
                  />
                </label>
                <label>
                  <span>Data Nasc.</span>
                  <input
                    type="date"
                    value={f.dataNascimento || ""}
                    onChange={(e) => updateFamiliar(idx, { dataNascimento: e.target.value })}
                  />
                </label>
                <label>
                  <span>Relação</span>
                  <select
                    value={f.relacao || "filho"}
                    onChange={(e) => updateFamiliar(idx, { relacao: e.target.value })}
                  >
                    {FAMILIAR_RELACOES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="realty-prop-icon-btn realty-prop-icon-btn--danger"
                  onClick={() => removeFamiliar(idx)}
                  title="Remover"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="realty-prop-grid realty-prop-grid--2">
          <label>
            <span>Telefone</span>
            <input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </label>
          <label>
            <span>E-mail</span>
            <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </label>
        </div>

        <div className="realty-prop-grid realty-prop-grid--3">
          <label className="realty-prop-span-2">
            <span>Endereço</span>
            <input value={form.address} onChange={(e) => set("address", e.target.value)} />
          </label>
          <label>
            <span>CEP</span>
            <input value={form.zipCode} onChange={(e) => set("zipCode", e.target.value)} />
          </label>
        </div>

        <div className="realty-prop-grid realty-prop-grid--2">
          <label>
            <span>Cidade</span>
            <input value={form.city} onChange={(e) => set("city", e.target.value)} />
          </label>
          <label>
            <span>Estado</span>
            <input value={form.state} onChange={(e) => set("state", e.target.value)} />
          </label>
        </div>

        <p className="realty-prop-section-title">Dados Bancários</p>
        <div className="realty-prop-grid realty-prop-grid--3">
          <label>
            <span>Banco</span>
            <input value={form.bank} onChange={(e) => set("bank", e.target.value)} />
          </label>
          <label>
            <span>Agência</span>
            <input value={form.agency} onChange={(e) => set("agency", e.target.value)} />
          </label>
          <label>
            <span>Conta</span>
            <input value={form.account} onChange={(e) => set("account", e.target.value)} />
          </label>
        </div>
        <label>
          <span>Chave PIX</span>
          <input value={form.pix} onChange={(e) => set("pix", e.target.value)} />
        </label>

        <div className="realty-imovel-box">
          <p className="realty-imovel-box__title">Gestão do Proprietário</p>
          <div className="realty-imovel-switches">
            <SwitchRow
              checked={form.contratoAdministracao}
              onChange={(v) => set("contratoAdministracao", v)}
              label="Contrato de Administração"
            />
            <SwitchRow
              checked={form.exclusividade}
              onChange={(v) => set("exclusividade", v)}
              label="Exclusividade"
            />
            <label>
              <span>Comissão Acordada (%)</span>
              <input
                type="number"
                step="0.1"
                min={0}
                max={100}
                value={form.comissaoAcordada || ""}
                onChange={(e) => set("comissaoAcordada", Number(e.target.value) || 0)}
                placeholder="0"
              />
            </label>
          </div>
          {form.exclusividade && (
            <div className="realty-prop-grid realty-prop-grid--2">
              <label>
                <span>Início Exclusividade</span>
                <input
                  type="date"
                  value={form.exclusividadeInicio || ""}
                  onChange={(e) => set("exclusividadeInicio", e.target.value)}
                />
              </label>
              <label>
                <span>Fim Exclusividade</span>
                <input
                  type="date"
                  value={form.exclusividadeFim || ""}
                  onChange={(e) => set("exclusividadeFim", e.target.value)}
                />
              </label>
            </div>
          )}
          {renderFileUpload(
            "Anexar Contrato de Exclusividade",
            "exclusividadeContratoUrl",
            exclusividadeInputRef,
            "Ver contrato anexado",
            "Anexar contrato de exclusividade"
          )}
        </div>

        <div className="realty-imovel-box">
          <p className="realty-imovel-box__title">Dados do Imóvel</p>
          <div className="realty-prop-grid realty-prop-grid--3">
            <label className="realty-prop-span-2">
              <span>Endereço do Imóvel</span>
              <input
                value={form.dadosImovelEndereco}
                onChange={(e) => set("dadosImovelEndereco", e.target.value)}
                placeholder="Endereço completo"
              />
            </label>
            <label>
              <span>Tipo</span>
              <select
                value={form.dadosImovelTipo || ""}
                onChange={(e) => set("dadosImovelTipo", e.target.value)}
              >
                <option value="">Não informado</option>
                {DADOS_IMOVEL_TIPOS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            <span>Área (m²)</span>
            <input
              type="number"
              value={form.dadosImovelArea || ""}
              onChange={(e) => set("dadosImovelArea", Number(e.target.value) || 0)}
            />
          </label>
          <div className="realty-prop-grid realty-prop-grid--2">
            <label>
              <span>Inscrição IPTU</span>
              <input
                value={form.inscricaoIptu}
                onChange={(e) => set("inscricaoIptu", e.target.value)}
                placeholder="Nº da inscrição"
              />
            </label>
            <label>
              <span>Matrícula</span>
              <input
                value={form.matricula}
                onChange={(e) => set("matricula", e.target.value)}
                placeholder="Nº da matrícula"
              />
            </label>
          </div>
          {renderFileUpload(
            "Certidão de Ônus Reais",
            "certidaoOnusUrl",
            certidaoInputRef,
            "Ver certidão anexada",
            "Anexar certidão de ônus"
          )}
        </div>

        <div className="realty-imovel-box">
          <p className="realty-imovel-box__title">Status Financeiro do Imóvel</p>
          <div className="realty-imovel-switches">
            {[
              { key: "saldoDevedor", label: "Tem Saldo Devedor" },
              { key: "quitado", label: "Quitado" },
              { key: "averbacao", label: "Fez Averbação" },
              { key: "parcelaAtrasoFinanciamento", label: "Parcela em Atraso (Financiamento)" },
              { key: "parcelaAtrasoCondominio", label: "Parcela em Atraso (Condomínio)" },
              { key: "parcelaAtrasoIptu", label: "Parcela em Atraso (IPTU)" },
            ].map(({ key, label }) => (
              <SwitchRow key={key} checked={!!form[key]} onChange={(v) => set(key, v)} label={label} />
            ))}
          </div>
        </div>

        <label>
          <span>Observações</span>
          <textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </label>

        <div className="realty-card__actions">
          <button
            type="submit"
            className="realty-page__btn"
            disabled={saving || !form.name.trim() || !!uploadingField}
          >
            {saving ? <Loader2 size={16} className="realty-spin" /> : null}
            {proprietario ? "Salvar Alterações" : "Cadastrar Proprietário"}
          </button>
          <button type="button" className="realty-page__btn realty-page__btn--ghost" onClick={() => safeOpenChange(false)}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProprietarioFormDialog;
