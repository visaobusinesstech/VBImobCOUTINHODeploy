import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { AUTOMATION_FONT } from "./automationTemplates";
import "./automations.css";

export function AutomationsDialog({ open, title, children, onClose, footer }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="automations-dialog-root" style={{ fontFamily: AUTOMATION_FONT }}>
      <button
        type="button"
        className="automations-dialog-root__scrim"
        aria-label="Fechar"
        onClick={onClose}
      />
      <div role="dialog" aria-modal="true" className="automations-dialog">
        <div className="automations-dialog__head">
          <h2>{title}</h2>
          <button type="button" className="automations-btn automations-btn--ghost" onClick={onClose}>
            Fechar
          </button>
        </div>
        <div className="automations-dialog__body">{children}</div>
        {footer ? <div className="automations-dialog__foot">{footer}</div> : null}
      </div>
    </div>,
    document.body
  );
}

export function FieldLabel({ children }) {
  return <label className="automations-field">{children}</label>;
}

export function TextInput(props) {
  return <input className="automations-input" {...props} />;
}

export function TextArea(props) {
  return <textarea className="automations-textarea" {...props} />;
}

export function GhostButton(props) {
  return <button type="button" className="automations-btn automations-btn--ghost" {...props} />;
}

export function PrimaryButton(props) {
  return <button type="button" className="automations-btn" {...props} />;
}

export function DangerButton(props) {
  return <button type="button" className="automations-btn automations-btn--danger" {...props} />;
}

export function ConnectionPicker({ connections, selectedIds, onToggle }) {
  if (!connections.length) {
    return (
      <p className="automations-hint">
        Nenhuma conexão deste canal ainda. O fluxo será salvo; ligue Instagram,
        Facebook ou WhatsApp em Integrações para disparar.
      </p>
    );
  }

  return (
    <div className="automations-conns">
      {connections.map((connection) => {
        const channel = String(connection.channel || "").toLowerCase();
        const label =
          connection.name ||
          connection.number ||
          connection.facebookPageUserId ||
          `Conexão ${connection.id}`;
        const channelLabel =
          channel === "instagram"
            ? "Instagram"
            : channel === "facebook"
              ? "Facebook"
              : channel === "whatsapp" || channel === "whatsapp_oficial"
                ? "WhatsApp"
                : channel || "Canal";
        return (
          <label key={connection.id}>
            <input
              type="checkbox"
              checked={selectedIds.includes(connection.id)}
              onChange={() => onToggle(connection.id)}
            />
            <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
              {label}
            </span>
            <span style={{ fontSize: 11, color: "var(--auto-muted)" }}>
              {channelLabel}
            </span>
          </label>
        );
      })}
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  danger,
  busy,
  onClose,
  onConfirm
}) {
  return (
    <AutomationsDialog
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <>
          <GhostButton onClick={onClose}>Cancelar</GhostButton>
          {danger ? (
            <DangerButton disabled={busy} onClick={onConfirm}>
              {busy ? "Aguarde…" : confirmLabel}
            </DangerButton>
          ) : (
            <PrimaryButton disabled={busy} onClick={onConfirm}>
              {busy ? "Aguarde…" : confirmLabel}
            </PrimaryButton>
          )}
        </>
      }
    >
      <p className="automations-hint" style={{ padding: 0, background: "transparent" }}>
        {body}
      </p>
    </AutomationsDialog>
  );
}

export function NameDialog({
  open,
  title,
  value,
  busy,
  onChange,
  onClose,
  onSave
}) {
  return (
    <AutomationsDialog
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <>
          <GhostButton onClick={onClose}>Cancelar</GhostButton>
          <PrimaryButton disabled={busy || !value?.trim()} onClick={onSave}>
            {busy ? "Salvando…" : "Salvar"}
          </PrimaryButton>
        </>
      }
    >
      <FieldLabel>Nome do fluxo</FieldLabel>
      <TextInput
        autoFocus
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && value?.trim() && !busy) onSave();
        }}
        placeholder="Ex.: Boas-vindas Instagram"
      />
    </AutomationsDialog>
  );
}
