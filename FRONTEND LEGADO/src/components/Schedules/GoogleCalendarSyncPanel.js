import React from "react";
import { Link as RouterLink } from "react-router-dom";
import { GoogleCalendarBrandIcon } from "../BrainMcpDialog/BrainMcpBrandIcons";

export default function GoogleCalendarSyncPanel({
  connected,
  accountEmail,
  showGoogleCalendar,
  onToggleShow,
  eventCount = 0,
  isDark = false,
}) {
  return (
    <div className={`google-sync-panel${isDark ? " google-sync-panel--dark" : ""}`}>
      <div className="google-sync-panel__header">
        <div className="google-sync-panel__icon-wrap">
          <GoogleCalendarBrandIcon size={28} />
        </div>
        <div className="google-sync-panel__titles">
          <span className="google-sync-panel__eyebrow">Google Agenda</span>
          <h3 className="google-sync-panel__title">Google Calendar</h3>
        </div>
        {connected ? (
          <span className="google-sync-panel__status google-sync-panel__status--on">
            <span className="google-sync-panel__dot" />
            Ativo
          </span>
        ) : (
          <span className="google-sync-panel__status">Off</span>
        )}
      </div>

      {connected ? (
        <>
          <p className="google-sync-panel__account" title={accountEmail}>
            {accountEmail}
          </p>
          <p className="google-sync-panel__desc">
            Sincronize atividades e veja eventos do Google no calendário.
          </p>
          {eventCount > 0 ? (
            <p className="google-sync-panel__meta">
              {eventCount} evento{eventCount !== 1 ? "s" : ""} Google neste período
            </p>
          ) : null}
          <label className="google-sync-panel__switch-row">
            <span>Exibir eventos Google</span>
            <span className="google-sync-panel__switch">
              <input
                type="checkbox"
                checked={showGoogleCalendar}
                onChange={(e) => onToggleShow(e.target.checked)}
              />
              <span className="google-sync-panel__switch-slider" />
            </span>
          </label>
        </>
      ) : (
        <>
          <p className="google-sync-panel__desc">
            Conecte para sincronizar sua agenda Google aqui.
          </p>
          <RouterLink
            to="/connections/google-calendar/manage"
            className="google-sync-panel__cta"
          >
            Conectar Google Agenda
          </RouterLink>
        </>
      )}
    </div>
  );
}
