import React, { useEffect, useState } from "react";
import { Check, Database, X } from "lucide-react";
import { BRAIN_CRM_MCP_OPTIONS } from "../../config/brainCrmCatalog";
import { getBrainCrmTabLabel } from "../../utils/brainPageContext";
import BrainMcpIcon from "../BrainMcpDialog/BrainMcpIcon";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "../ui/dialog";
import s from "../../pages/AiBrain/brainSubClassNames";

export default function BrainCrmImportDialog({
  open,
  onClose,
  pageContext,
  selectedCrms,
  onSave,
}) {
  const [draft, setDraft] = useState(selectedCrms || []);
  const tabLabel = getBrainCrmTabLabel(pageContext);

  useEffect(() => {
    if (open) setDraft(Array.isArray(selectedCrms) ? [...selectedCrms] : []);
  }, [open, selectedCrms]);

  const toggle = (id) => {
    setDraft((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSave = () => {
    onSave?.(draft);
    onClose?.();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose?.()}>
      <DialogContent className="max-w-md" showClose={false}>
        <DialogHeader>
          <h2 className={s.dialogTitle}>
            <Database size={16} />
            {tabLabel}
          </h2>
          <p className={s.dialogLead}>
            Selecione um ou mais CRMs para o Brain consultar ou importar dados nesta sessão.
            Conecte as integrações em Conexões antes de usar.
          </p>
        </DialogHeader>
        <DialogBody>
          <div className={s.grid}>
            {BRAIN_CRM_MCP_OPTIONS.map((item) => {
              const selected = draft.includes(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`${s.card} ${selected ? s.cardActive : ""}`}
                  onClick={() => toggle(item.id)}
                >
                  <div className={s.cardTop}>
                    <div className={s.cardBrand}>
                      <span className={s.cardIcon}>
                        <BrainMcpIcon id={item.id} size={16} />
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div className={s.cardTitle}>{item.name}</div>
                      </div>
                    </div>
                    <span className={`${s.check} ${selected ? s.checkOn : ""}`}>
                      {selected ? <Check size={10} /> : null}
                    </span>
                  </div>
                  <div className={s.cardDesc}>{item.description}</div>
                </button>
              );
            })}
          </div>
        </DialogBody>
        <DialogFooter>
          <button type="button" className={s.btnGhost} onClick={onClose}>
            <X size={13} />
            Cancelar
          </button>
          <button type="button" className={s.btnPrimary} onClick={handleSave}>
            {draft.length ? `Usar ${draft.length} CRM${draft.length > 1 ? "s" : ""}` : "Salvar"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
