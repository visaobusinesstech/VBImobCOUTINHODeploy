/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 *
 * Anexos anuais de locação (paridade Lovable → API VBSolution camelCase).
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, FileText, Loader2, Plus, Upload, X } from "lucide-react";
import { toast } from "react-toastify";
import realtyService from "../../services/realtyService";
import { mediaUrl } from "../../helpers/realtyCrm";
import { DEFAULT_CONTRATO_FILE_ACCEPT, getContratoFileName } from "../../helpers/contratoFilePreview";
import ContratoFileViewerDialog from "./ContratoFileViewerDialog";

/**
 * @param {{ contratoId?: string|number|null, startYear?: number|null }} props
 */
const ContratoAnexosAnuaisSection = ({ contratoId, startYear }) => {
  const [anexosAnuais, setAnexosAnuais] = useState([]);
  const [anosExtras, setAnosExtras] = useState([]);
  const [uploadingAno, setUploadingAno] = useState(null);
  const [openingFile, setOpeningFile] = useState(null);
  const [viewer, setViewer] = useState({ open: false, loading: false, file: null });

  const fetchAnexosAnuais = useCallback(async () => {
    if (!contratoId) {
      setAnexosAnuais([]);
      return;
    }
    try {
      const data = await realtyService.listContratoAnexosAnuais(contratoId);
      const rows = (data?.anexosAnuais || []).slice().sort((a, b) => a.ano - b.ano);
      setAnexosAnuais(rows);
    } catch (err) {
      toast.error(err?.response?.data?.error || err.message || "Erro ao carregar contratos anuais");
    }
  }, [contratoId]);

  useEffect(() => {
    setAnosExtras([]);
  }, [contratoId]);

  useEffect(() => {
    void fetchAnexosAnuais();
  }, [fetchAnexosAnuais]);

  const anoBase = useMemo(() => {
    if (typeof startYear === "number" && Number.isFinite(startYear)) return startYear;
    if (anexosAnuais.length > 0) return Math.min(...anexosAnuais.map((a) => a.ano));
    return new Date().getFullYear();
  }, [anexosAnuais, startYear]);

  const anosVisiveis = useMemo(() => {
    const anosIniciais = [anoBase, anoBase + 1, anoBase + 2];
    return Array.from(
      new Set([...anosIniciais, ...anosExtras, ...anexosAnuais.map((a) => a.ano)])
    ).sort((a, b) => a - b);
  }, [anoBase, anosExtras, anexosAnuais]);

  const handleUploadAnexoAnual = async (ano, file) => {
    if (!contratoId) {
      toast.error("Salve o contrato antes de anexar os anos");
      return;
    }

    setUploadingAno(ano);
    try {
      const uploadData = await realtyService.uploadContratoMedia([file]);
      const fileUrl = Array.isArray(uploadData?.urls) ? uploadData.urls[0] : null;
      if (!fileUrl) throw new Error("Falha ao enviar arquivo");

      const label = `Contrato ${ano}`;
      const payload = {
        ano,
        tipo: label,
        fileName: file.name || label,
        fileUrl,
      };

      const existente = anexosAnuais.find((a) => a.ano === ano);
      if (existente) {
        await realtyService.updateContratoAnexoAnual(contratoId, existente.id, payload);
      } else {
        await realtyService.createContratoAnexoAnual(contratoId, payload);
      }

      toast.success(`Contrato ${ano} anexado!`);
      await fetchAnexosAnuais();
    } catch (err) {
      toast.error(err?.response?.data?.error || err.message || "Erro no upload");
    } finally {
      setUploadingAno(null);
    }
  };

  const handleOpenAnexo = (anexo) => {
    if (!anexo?.fileUrl) return;
    setOpeningFile(anexo.id);
    setViewer({
      open: true,
      loading: false,
      file: {
        url: mediaUrl(anexo.fileUrl),
        name: anexo.fileName || anexo.tipo || getContratoFileName(anexo.fileUrl, `Contrato ${anexo.ano}`),
      },
    });
    setOpeningFile(null);
  };

  const handleDeleteAnexoAnual = async (id) => {
    if (!contratoId) return;
    try {
      await realtyService.deleteContratoAnexoAnual(contratoId, id);
      toast.success("Anexo removido");
      await fetchAnexosAnuais();
    } catch (err) {
      toast.error(err?.response?.data?.error || err.message || "Erro ao remover anexo");
    }
  };

  const adicionarProximoAno = () => {
    const ultimoAno = anosVisiveis[anosVisiveis.length - 1] ?? anoBase;
    setAnosExtras((prev) => [...prev, ultimoAno + 1]);
  };

  return (
    <>
      <div className="realty-contrato-section realty-contrato-section--anuais">
        <div className="realty-contrato-section__intro">
          <div className="realty-contrato-section__icon">
            <Archive size={20} />
          </div>
          <div>
            <div className="realty-contrato-section__title-row">
              <p className="realty-contrato-section__title">Contratos Anuais da Locação</p>
              <span className="realty-contrato-section__pill">Arquivo Histórico</span>
            </div>
            <p className="realty-contrato-section__hint">
              Anexe o contrato de cada ano do aluguel para manter o histórico completo.
            </p>
          </div>
        </div>

        <div className="realty-contrato-anuais__list">
          {anosVisiveis.map((ano) => {
            const anexo = anexosAnuais.find((item) => item.ano === ano);
            const isUploading = uploadingAno === ano;
            const isOpening = openingFile === anexo?.id;

            return (
              <div key={ano} className="realty-contrato-anuais__row">
                <div className="realty-contrato-anuais__ano">
                  <span className="realty-contrato-label">Ano</span>
                  <div className="realty-contrato-anuais__ano-box">{ano}</div>
                </div>

                <div className="realty-contrato-anuais__file">
                  <span className="realty-contrato-label">Arquivo</span>
                  {anexo ? (
                    <div className="realty-contrato-upload realty-contrato-upload--filled">
                      {isOpening ? <Loader2 size={16} className="realty-imovel-spin" /> : <FileText size={16} />}
                      <button type="button" onClick={() => handleOpenAnexo(anexo)}>
                        {anexo.tipo || anexo.fileName || `Contrato ${ano}`}
                      </button>
                    </div>
                  ) : (
                    <div className="realty-contrato-upload realty-contrato-upload--empty">
                      {contratoId
                        ? `Nenhum arquivo anexado para ${ano}`
                        : "Salve o contrato para habilitar os anexos anuais"}
                    </div>
                  )}
                </div>

                <div className="realty-contrato-anuais__actions">
                  <label className="realty-contrato-upload-btn">
                    {isUploading ? <Loader2 size={16} className="realty-imovel-spin" /> : <Upload size={16} />}
                    <span>{isUploading ? "Enviando..." : anexo ? "Trocar" : "Anexar"}</span>
                    <input
                      type="file"
                      hidden
                      accept={DEFAULT_CONTRATO_FILE_ACCEPT}
                      disabled={!contratoId || isUploading}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleUploadAnexoAnual(ano, file);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  {anexo && (
                    <button
                      type="button"
                      className="realty-prop-icon-btn"
                      onClick={() => void handleDeleteAnexoAnual(anexo.id)}
                      aria-label={`Remover contrato ${ano}`}
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <button type="button" className="realty-page__btn realty-page__btn--ghost" onClick={adicionarProximoAno}>
          <Plus size={16} /> Adicionar próximo ano
        </button>
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

export default ContratoAnexosAnuaisSection;
