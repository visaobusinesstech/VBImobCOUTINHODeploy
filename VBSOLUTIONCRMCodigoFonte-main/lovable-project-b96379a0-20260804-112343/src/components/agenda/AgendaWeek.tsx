import { useMemo, useCallback, useState, DragEvent } from "react";
import { ChevronLeft, ChevronRight, GripVertical } from "lucide-react";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { AgendaItem } from "./AgendaCalendar";

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 07:00–20:00

interface Props {
  items: AgendaItem[];
  currentWeek: Date;
  setCurrentWeek: (d: Date) => void;
  onSelectDate: (date: string) => void;
  onDropItem?: (itemId: string, source: "compromisso" | "followup", newDate: string, newHour: number) => void;
}

export function AgendaWeek({ items, currentWeek, setCurrentWeek, onSelectDate, onDropItem }: Props) {
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 0 });
  const days = useMemo(() => eachDayOfInterval({ start: weekStart, end: weekEnd }), [currentWeek]);
  const [dragOverCell, setDragOverCell] = useState<string | null>(null);

  const getItemsDia = useCallback((date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return items.filter(i => i.data.startsWith(dateStr));
  }, [items]);

  const getHour = (dataStr: string) => {
    const timePart = dataStr.slice(11, 13);
    return timePart ? parseInt(timePart, 10) : -1;
  };

  const handleDragStart = (e: DragEvent, item: AgendaItem) => {
    e.dataTransfer.setData("text/plain", JSON.stringify({ id: item.id, source: item.source }));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: DragEvent, cellKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverCell(cellKey);
  };

  const handleDragLeave = () => {
    setDragOverCell(null);
  };

  const handleDrop = (e: DragEvent, dateStr: string, hour: number) => {
    e.preventDefault();
    setDragOverCell(null);
    try {
      const data = JSON.parse(e.dataTransfer.getData("text/plain"));
      // Strip prefix (c- or f-) to get real ID
      const realId = data.id.replace(/^[cf]-/, "");
      if (onDropItem) {
        onDropItem(realId, data.source, dateStr, hour);
      }
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-4">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))} className="p-2 rounded-lg hover:bg-secondary transition-colors">
          <ChevronLeft className="w-5 h-5 text-foreground" />
        </button>
        <h2 className="text-sm font-semibold text-foreground">
          {format(weekStart, "dd MMM", { locale: ptBR })} — {format(weekEnd, "dd MMM yyyy", { locale: ptBR })}
        </h2>
        <button onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))} className="p-2 rounded-lg hover:bg-secondary transition-colors">
          <ChevronRight className="w-5 h-5 text-foreground" />
        </button>
      </div>

      {onDropItem && (
        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
          <GripVertical className="w-3 h-3" />Arraste itens entre horários para reagendar
        </p>
      )}

      {/* Grid */}
      <div className="overflow-x-auto">
        <div className="min-w-[700px]">
          {/* Day headers */}
          <div className="grid grid-cols-[60px_repeat(7,1fr)] gap-px bg-border rounded-t-lg overflow-hidden">
            <div className="bg-card p-2" />
            {days.map(day => {
              const isTodayDate = isToday(day);
              return (
                <button
                  key={day.toISOString()}
                  onClick={() => onSelectDate(format(day, "yyyy-MM-dd"))}
                  className={`bg-card p-2 text-center hover:bg-muted/50 transition-colors ${isTodayDate ? "bg-primary/5" : ""}`}
                >
                  <span className="text-[10px] uppercase text-muted-foreground">{format(day, "EEE", { locale: ptBR })}</span>
                  <span className={`block text-lg font-semibold ${isTodayDate ? "text-primary" : "text-foreground"}`}>
                    {format(day, "d")}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Hour rows */}
          <div className="grid grid-cols-[60px_repeat(7,1fr)] gap-px bg-border">
            {HOURS.map(hour => (
              <div key={hour} className="contents">
                <div className="bg-card p-1 text-right pr-2">
                  <span className="text-[10px] text-muted-foreground">{String(hour).padStart(2, "0")}:00</span>
                </div>
                {days.map(day => {
                  const dateStr = format(day, "yyyy-MM-dd");
                  const dayItems = getItemsDia(day);
                  const hourItems = dayItems.filter(item => getHour(item.data) === hour);
                  const noTimeItems = hour === 8 ? dayItems.filter(item => getHour(item.data) === -1) : [];
                  const cellItems = [...hourItems, ...noTimeItems];
                  const isTodayDate = isToday(day);
                  const cellKey = `${hour}-${dateStr}`;
                  const isOver = dragOverCell === cellKey;

                  return (
                    <div
                      key={cellKey}
                      className={`bg-card min-h-[48px] p-0.5 border-t border-border/30 transition-colors ${
                        isTodayDate ? "bg-primary/[0.02]" : ""
                      } ${isOver ? "!bg-primary/10 ring-1 ring-primary/30" : ""}`}
                      onDragOver={(e) => handleDragOver(e, cellKey)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, dateStr, hour)}
                    >
                      {cellItems.map(item => (
                        <div
                          key={item.id}
                          draggable={!!onDropItem}
                          onDragStart={(e) => handleDragStart(e, item)}
                          className={`flex items-center gap-1 px-1.5 py-1 rounded text-[10px] mb-0.5 truncate ${
                            onDropItem ? "cursor-grab active:cursor-grabbing" : "cursor-default"
                          }`}
                          style={{ backgroundColor: `${item.color}15`, color: item.color, borderLeft: `2px solid ${item.color}` }}
                          title={item.titulo}
                        >
                          {onDropItem && <GripVertical className="w-2.5 h-2.5 shrink-0 opacity-50" />}
                          <span className="truncate font-medium">{item.titulo}</span>
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
    </div>
  );
}
