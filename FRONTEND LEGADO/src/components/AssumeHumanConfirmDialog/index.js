import React, { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "../ui/dialog";
import "./assumeHumanAlert.css";

function contactInitials(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[parts.length - 1][0] || ""}`.toUpperCase();
}

export default function AssumeHumanConfirmDialog({
  open,
  contact,
  loading = false,
  onCancel,
  onConfirm,
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const name = contact?.name || contact?.number || "este contato";
  const photo =
    contact?.urlPicture || contact?.profilePicUrl || contact?.profilePic || "";

  const initials = useMemo(() => contactInitials(name), [name]);

  useEffect(() => {
    setImgFailed(false);
  }, [photo, open]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !loading) onCancel?.();
      }}
    >
      <DialogContent
        className="assume-human-alert"
        showClose={false}
        onPointerDownOutside={(e) => {
          if (loading) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (loading) e.preventDefault();
        }}
      >
        <DialogHeader className="assume-human-alert__header">
          <div className="assume-human-alert__avatar-wrap">
            {photo && !imgFailed ? (
              <img
                className="assume-human-alert__avatar"
                src={photo}
                alt={name}
                onError={() => setImgFailed(true)}
              />
            ) : (
              <div className="assume-human-alert__avatar assume-human-alert__avatar--fallback" aria-hidden>
                {initials}
              </div>
            )}
          </div>
          <h2 className="assume-human-alert__title">Assumir atendimento humano?</h2>
        </DialogHeader>
        <DialogBody className="assume-human-alert__body">
          <p className="assume-human-alert__lead">
            O agente de IA vai parar de responder{" "}
            <strong className="assume-human-alert__name">{name}</strong> neste
            ticket. Os demais tickets continuam com o agente normalmente.
          </p>
        </DialogBody>
        <DialogFooter className="assume-human-alert__footer">
          <button
            type="button"
            className="assume-human-alert__btn assume-human-alert__btn--cancel"
            onClick={onCancel}
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="assume-human-alert__btn assume-human-alert__btn--confirm"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Confirmando…" : "Sim"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
