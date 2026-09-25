/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 *
 * Comprovantes mensais de pagamento (paridade Lovable → API VBSolution).
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Check, FileText, Loader2, Receipt, Upload, X } from "lucide-react";
import { toast } from "react-toastify";
import realtyService from "../../services/realtyService";
import { mediaUrl } from "../../helpers/realtyCrm";
import { DEFAULT_CONTRATO_FILE_ACCEPT, getContratoFileName } from "../../helpers/contratoFilePreview";
import ContratoFileViewerDialog from "./ContratoFileViewerDialog";

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

/**
 * @param {{ contratoId?: string|number|null, startYear?: number|null }} props
 */
const ContratoComprovantesMensaisSection = ({ contratoId, startYear }) => {
  const [comprovantes, setComprovantes] = useState([]);
  const [uploadingKey, setUploadingKey] = useState(null);
  const [openingFile, setOpeningFile] = useState(null);
  const [togglingId, setTogglingId] = useState(null);
  const [viewer, setViewer] = useState({ open: false, loading: false, file: null });

  const currentYear = new Date().getFullYear();
  const anoBase = typeof startYear === "number" && Number.isFinite(startYear) ? startYear : currentYear;

  const anosDisponiveis = useMemo(() => {
    const anos = new Set();
    for (let y = anoBase; y <= currentYear + 1; y += 1) anos.add(y);
    comprovantes.forEach((c) => anos.add(c.ano));
    return Array.from(anos).sort((a, b) => b - a);
  }, [anoBase, currentYear, comprovantes]);

  const [anoSelecionado, setAnoSelecionado] = useState(currentYear);

  const fetchComprovantes = useCallback(async () => {
    if (!contratoId) {
      setComprovantes([]);
      return;
    }
    try {
      const data = await realtyService.listContratoComprovantesMensais(contratoId);
      setComprovantes(data?.comprovantesMensais || []);
    } catch (err) {
      toast.error(err?.response?.data?.error || err.message || "Erro ao carregar comprovantes");
    }
  }, [contratoId]);

  useEffect(() => {
    void fetchComprovantes();
  }, [fetchComprovantes]);

  const handleUpload = async (mes, file) => {
    if (!contratoId) {
      toast.error("Salve o contrato antes de anexar comprovantes");
      return;
    }
    const key = `${anoSelecionado}-${mes}`;
    setUploadingKey(key);
    try {
      const uploadData = await realtyService.uploadContratoMedia([file]);
      const fileUrl = Array.isArray(uploadData?.urls) ? uploadData.urls[0] : null;
      if (!fileUrl) throw new Error("Falha ao enviar arquivo");

      const label = `Comprovante ${MESES[mes - 1]} ${anoSelecionado}`;
      const payload = {
        ano: anoSelecionado,
        mes,
        tipo: label,
        fileName: file.name || label,
        fileUrl,
      };

      const existing = comprovantes.find((c) => c.ano === anoSelecionado && c.mes === mes);
      if (existing) {
        await realtyService.updateContratoComprovanteMensal(contratoId, existing.id, payload);
      } else {
        await realtyService.createContratoComprovanteMensal(contratoId, payload);
      }

      toast.success(`Comprovante de ${MESES[mes - 1]}/${anoSelecionado} anexado!`);
      await fetchComprovantes();
    } catch (err) {
      toast.error(err?.response?.data?.error || err.message || "Erro no upload");
    } finally {
      setUploadingKey(null);
    }
  };

  const handleToggleRecebido = async (comp) => {
    if (!contratoId) return;
    setTogglingId(comp.id);
    try {
      await realtyService.updateContratoComprovanteMensal(contratoId, comp.id, {
        recebido: !comp.recebido,
      });
      setComprovantes((prev) =>
        prev.map((c) => (c.id === comp.id ? { ...c, recebido: !c.recebido } : c))
      );
      toast.success(
        !comp.recebido
          ? `${MESES[comp.mes - 1]}/${comp.ano} confirmado como recebido`
          : `${MESES[comp.mes - 1]}/${comp.ano} desmarcado`
      );
    } catch (err) {
      toast.error(err?.response?.data?.error || err.message || "Erro ao atualizar status");
    } finally {
      setTogglingId(null);
    }
  };

  const handleOpen = (comp) => {
    if (!comp?.fileUrl) return;
    setOpeningFile(comp.id);
    setViewer({
      open: true,
      loading: false,
      file: {
        url: mediaUrl(comp.fileUrl),
        name: comp.fileName || comp.tipo || getContratoFileName(comp.fileUrl, MESES[comp.mes - 1]),
      },
    });
    setOpeningFile(null);
  };

  const handleDelete = async (id) => {
    if (!contratoId) return;
    try {
      await realtyService.deleteContratoComprovanteMensal(contratoId, id);
      toast.success("Comprovante removido");
      await fetchComprovantes();
    } catch (err) {
      toast.error(err?.response?.data?.error || err.message || "Erro ao remover comprovante");
    }
  };

  const comprovantesFiltrados = comprovantes.filter((c) => c.ano === anoSelecionado);
  const totalAnexados = comprovantesFiltrados.length;
  const totalRecebidos = comprovantesFiltrados.filter((c) => c.recebido).length;

  return (
    <>
      <div className="realty-contrato-section realty-contrato-section--comprovantes">
        <div className="realty-contrato-section__intro">
          <div className="realty-contrato-section__icon realty-contrato-section__icon--green">
            <Receipt size={20} />
          </div>
          <div className="realty-contrato-section__intro-body">
            <div className="realty-contrato-section__title-row">
              <p className="realty-contrato-section__title">Comprovantes Mensais de Pagamento</p>
              <span className="realty-contrato-section__pill realty-contrato-section__pill--green">
                {totalAnexados}/12 meses
              </span>
              {totalRecebidos > 0 && (
                <span className="realty-contrato-section__pill realty-contrato-section__pill--blue">
                  {totalRecebidos} recebido{totalRecebidos > 1 ? "s" : ""}
                </span>
              )}
            </div>
            <p className="realty-contrato-section__hint">
              Anexe o comprovante e confirme o recebimento de cada mês.
            </p>
          </div>
        </div>

        <label className="realty-contrato-year-select">
          <span>Ano:</span>
          <select value={String(anoSelecionado)} onChange={(e) => setAnoSelecionado(Number(e.target.value))}>
            {anosDisponiveis.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>

        <div className="realty-contrato-meses">
          {MESES.map((nomeMes, idx) => {
            const mes = idx + 1;
            const comp = comprovantesFiltrados.find((c) => c.mes === mes);
            const key = `${anoSelecionado}-${mes}`;
            const isUploading = uploadingKey === key;
            const isOpening = openingFile === comp?.id;
            const isToggling = togglingId === comp?.id;

            return (
              <div
                key={mes}
                className={`realty-contrato-mes${comp?.recebido ? " realty-contrato-mes--recebido" : ""}`}
              >
                <span className="realty-contrato-mes__nome">{nomeMes.slice(0, 3)}</span>
                <div className="realty-contrato-mes__file">
                  {comp ? (
                    <button type="button" onClick={() => handleOpen(comp)}>
                      {isOpening ? <Loader2 size={12} className="realty-imovel-spin" /> : <FileText size={12} />}
                      <span>{comp.tipo || comp.fileName || nomeMes}</span>
                    </button>
                  ) : (
                    <span className="realty-contrato-mes__empty">—</span>
                  )}
                </div>
                <div className="realty-contrato-mes__actions">
                  {comp && (
                    <button
                      type="button"
                      className={`realty-contrato-mes__check${comp.recebido ? " is-on" : ""}`}
                      onClick={() => void handleToggleRecebido(comp)}
                      disabled={isToggling}
                      title={comp.recebido ? "Recebido (clique para desmarcar)" : "Confirmar recebimento"}
                    >
                      {isToggling ? <Loader2 size={12} className="realty-imovel-spin" /> : <Check size={12} />}
                    </button>
                  )}
                  <label className="realty-contrato-mes__upload">
                    {isUploading ? <Loader2 size={12} className="realty-imovel-spin" /> : <Upload size={12} />}
                    <input
                      type="file"
                      hidden
                      accept={DEFAULT_CONTRATO_FILE_ACCEPT}
                      disabled={!contratoId || isUploading}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleUpload(mes, file);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  {comp && (
                    <button
                      type="button"
                      className="realty-prop-icon-btn"
                      onClick={() => void handleDelete(comp.id)}
                      aria-label={`Remover ${nomeMes}`}
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
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

export default ContratoComprovantesMensaisSection;
