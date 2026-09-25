/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 */

import React, { useMemo, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  addMonths,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default function AgendaCalendar({
  items,
  currentMonth,
  setCurrentMonth,
  selectedDate,
  onSelectDate,
}) {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  const calendarDays = useMemo(() => {
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const startDay = monthStart.getDay();
    const padding = Array.from({ length: startDay }, (_, i) => {
      const d = new Date(monthStart);
      d.setDate(d.getDate() - (startDay - i));
      return d;
    });
    return [...padding, ...days];
  }, [currentMonth]);

  const getItemsDia = useCallback(
    (date) => {
      const dateStr = format(date, "yyyy-MM-dd");
      return items.filter((i) => String(i.data || "").startsWith(dateStr));
    },
    [items]
  );

  return (
    <div className="agenda-calendar">
      <div className="agenda-nav">
        <button type="button" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
          <ChevronLeft size={18} />
        </button>
        <h2>{format(currentMonth, "MMMM yyyy", { locale: ptBR })}</h2>
        <button type="button" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="agenda-calendar__weekdays">
        {WEEKDAYS.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      <div className="agenda-calendar__grid">
        {calendarDays.map((day, i) => {
          const dayItems = getItemsDia(day);
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isTodayDate = isToday(day);
          const dateStr = format(day, "yyyy-MM-dd");
          const isSelected = selectedDate === dateStr;

          return (
            <button
              key={i}
              type="button"
              className={`agenda-day${isSelected ? " is-selected" : ""}${
                isTodayDate ? " is-today" : ""
              }${!isCurrentMonth ? " is-muted" : ""}`}
              onClick={() => onSelectDate(dateStr)}
            >
              <span>{format(day, "d")}</span>
              <div className="agenda-day__items">
                {dayItems.slice(0, 3).map((item) => (
                  <div
                    key={item.id}
                    className="agenda-day__chip"
                    style={{ background: `${item.color}22`, color: item.color }}
                    title={item.titulo}
                  >
                    {item.titulo}
                  </div>
                ))}
                {dayItems.length > 3 && (
                  <span className="agenda-day__more">+{dayItems.length - 3} mais</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
