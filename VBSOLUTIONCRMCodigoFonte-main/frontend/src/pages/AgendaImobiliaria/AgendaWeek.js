/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 */

import React, { useMemo, useCallback, useState } from "react";
import { ChevronLeft, ChevronRight, GripVertical } from "lucide-react";
import {
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addWeeks,
  subWeeks,
  isToday,
} from "date-fns";
import { ptBR } from "date-fns/locale";

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7);

export default function AgendaWeek({
  items,
  currentWeek,
  setCurrentWeek,
  onSelectDate,
  onDropItem,
}) {
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 0 });
  const days = useMemo(
    () => eachDayOfInterval({ start: weekStart, end: weekEnd }),
    [currentWeek]
  );
  const [dragOverCell, setDragOverCell] = useState(null);

  const getItemsDia = useCallback(
    (date) => {
      const dateStr = format(date, "yyyy-MM-dd");
      return items.filter((i) => String(i.data || "").startsWith(dateStr));
    },
    [items]
  );

  const getHour = (dataStr) => {
    const timePart = String(dataStr || "").slice(11, 13);
    if (!timePart) {
      try {
        const d = new Date(dataStr);
        if (!Number.isNaN(d.getTime())) return d.getHours();
      } catch {
        /* ignore */
      }
      return -1;
    }
    return parseInt(timePart, 10);
  };

  const handleDragStart = (e, item) => {
    e.dataTransfer.setData(
      "text/plain",
      JSON.stringify({ id: item.id, source: item.source })
    );
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDrop = (e, dateStr, hour) => {
    e.preventDefault();
    setDragOverCell(null);
    try {
      const data = JSON.parse(e.dataTransfer.getData("text/plain"));
      const realId = String(data.id).replace(/^[cf]-/, "");
      if (onDropItem) onDropItem(realId, data.source, dateStr, hour);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="agenda-week">
      <div className="agenda-nav">
        <button type="button" onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}>
          <ChevronLeft size={18} />
        </button>
        <h2>
          {format(weekStart, "dd MMM", { locale: ptBR })} —{" "}
          {format(weekEnd, "dd MMM yyyy", { locale: ptBR })}
        </h2>
        <button type="button" onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}>
          <ChevronRight size={18} />
        </button>
      </div>

      {onDropItem && (
        <p className="agenda-week__hint">
          <GripVertical size={12} /> Arraste itens entre horários para reagendar
        </p>
      )}

      <div className="agenda-week__scroll">
        <div className="agenda-week__grid">
          <div className="agenda-week__head">
            <div />
            {days.map((day) => {
              const isTodayDate = isToday(day);
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  className={isTodayDate ? "is-today" : ""}
                  onClick={() => onSelectDate(format(day, "yyyy-MM-dd"))}
                >
                  <span className="agenda-week__dow">
                    {format(day, "EEE", { locale: ptBR })}
                  </span>
                  <span className="agenda-week__dom">{format(day, "d")}</span>
                </button>
              );
            })}
          </div>

          {HOURS.map((hour) => (
            <div key={hour} className="agenda-week__row">
              <div className="agenda-week__hour">
                {String(hour).padStart(2, "0")}:00
              </div>
              {days.map((day) => {
                const dateStr = format(day, "yyyy-MM-dd");
                const dayItems = getItemsDia(day);
                const hourItems = dayItems.filter((item) => getHour(item.data) === hour);
                const noTimeItems =
                  hour === 8 ? dayItems.filter((item) => getHour(item.data) === -1) : [];
                const cellItems = [...hourItems, ...noTimeItems];
                const cellKey = `${hour}-${dateStr}`;
                const isOver = dragOverCell === cellKey;

                return (
                  <div
                    key={cellKey}
                    className={`agenda-week__cell${isOver ? " is-over" : ""}`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOverCell(cellKey);
                    }}
                    onDragLeave={() => setDragOverCell(null)}
                    onDrop={(e) => handleDrop(e, dateStr, hour)}
                  >
                    {cellItems.map((item) => (
                      <div
                        key={item.id}
                        className="agenda-week__item"
                        draggable={!!onDropItem}
                        onDragStart={(e) => handleDragStart(e, item)}
                        style={{
                          background: `${item.color}18`,
                          color: item.color,
                          borderLeft: `2px solid ${item.color}`,
                        }}
                        title={item.titulo}
                      >
                        {onDropItem && <GripVertical size={10} />}
                        <span>{item.titulo}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
