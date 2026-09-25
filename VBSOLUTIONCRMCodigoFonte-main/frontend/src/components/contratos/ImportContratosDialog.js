/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 *
 * Importação de contratos via planilha (paridade Lovable, campos camelCase).
 */

import React, { useRef, useState } from "react";
import { AlertCircle, CheckCircle, FileSpreadsheet, Loader2, Upload, X } from "lucide-react";
import { toast } from "react-toastify";
import { parseContratoImportFile } from "../../helpers/contratosSpreadsheet";

/**
 * @param {{ open: boolean, onClose: () => void, onImport: (items: object[]) => Promise<{ success: number, errors: number }> }} props
 */
const ImportContratosDialog = ({ open, onClose, onImport }) => {
  const fileRef = useRef(null);
  const [parsed, setParsed] = useState([]);
  const [errors, setErrors] = useState([]);
  const [importing, setImporting] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [fileName, setFileName] = useState("");

  if (!open) return null;

  const reset = () => {
    setParsed([]);
    setErrors([]);
    setFileName("");
    setParsing(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setParsing(true);
    setParsed([]);
    setErrors([]);

    try {
      const { items, errors: parseErrors } = await parseContratoImportFile(file);
      setParsed(items);
      setErrors(
        items.length === 0
          ? [...parseErrors, ...(parseErrors.length === 0 ? ["Nenhum contrato válido encontrado"] : [])]
          : parseErrors
      );
    } catch (err) {
      setErrors([`Erro ao ler arquivo: ${err?.message || "Formato não suportado"}`]);
    } finally {
      setParsing(false);
      e.target.value = "";
    }
  };

  const handleImport = async () => {
    if (parsed.length === 0) return;
    setImporting(true);
    try {
      const { success, errors: importErrors } = await onImport(parsed);

      if (success === 0) {
        toast.error(
          importErrors > 0
            ? `Nenhum contrato importado. ${importErrors} registro(s) com erro ou duplicado.`
            : "Nenhum contrato importado. Verifique o arquivo e tente novamente."
        );
        return;
      }

      toast.success(
        `${success} contrato${success > 1 ? "s" : ""} importado${success > 1 ? "s" : ""}!${
          importErrors > 0 ? ` ${importErrors} registro(s) com erro ou duplicado.` : ""
        }`
      );

      reset();
      onClose();
    } catch (err) {
      toast.error(err?.message || "Erro na importação");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="realty-modal-backdrop" onClick={handleClose} role="presentation">
      <div
        className="realty-modal realty-contrato-modal realty-contrato-modal--import"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-contratos-title"
      >
        <div className="realty-contrato-modal__head">
          <h3 id="import-contratos-title">
            <Upload size={18} /> Importar Contratos
          </h3>
          <button type="button" className="realty-prop-icon-btn" onClick={handleClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <p className="realty-contrato-modal__desc">
          Importe contratos a partir de Excel, CSV ou TXT tabulado. A exportação do módulo já sai compatível
          com essa importação.
        </p>

        <div className="realty-contrato-import">
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.ods,.csv,.txt"
            onChange={handleFile}
            hidden
          />
          <button
            type="button"
            className="realty-contrato-import__pick"
            onClick={() => fileRef.current?.click()}
            disabled={parsing}
          >
            {parsing ? (
              <Loader2 size={24} className="realty-imovel-spin" />
            ) : (
              <FileSpreadsheet size={24} />
            )}
            <span>{parsing ? "Lendo arquivo..." : fileName || "Clique para selecionar arquivo de contratos"}</span>
          </button>

          {errors.length > 0 && (
            <div className="realty-contrato-import__errors">
              {errors.map((msg, i) => (
                <p key={i}>
                  <AlertCircle size={12} /> {msg}
                </p>
              ))}
            </div>
          )}

          {parsed.length > 0 && (
            <div className="realty-contrato-import__preview">
              <p>
                <CheckCircle size={16} /> {parsed.length} contratos prontos para importar
              </p>
              <div className="realty-contrato-import__list">
                {parsed.slice(0, 10).map((c, i) => (
                  <p key={i}>
                    {c.title} · {c.cliente} · {c.tipo} ·{" "}
                    {c.value ? `R$ ${Number(c.value).toLocaleString("pt-BR")}` : ""}
                  </p>
                ))}
                {parsed.length > 10 && <p>...e mais {parsed.length - 10}</p>}
              </div>
            </div>
          )}
        </div>

        <div className="realty-contrato-modal__footer">
          <button type="button" className="realty-page__btn realty-page__btn--ghost" onClick={handleClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="realty-page__btn"
            onClick={handleImport}
            disabled={parsed.length === 0 || importing}
          >
            {importing && <Loader2 size={16} className="realty-imovel-spin" />}
            Importar {parsed.length > 0 ? `(${parsed.length})` : ""}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportContratosDialog;
