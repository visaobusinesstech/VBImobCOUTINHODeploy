import { useMemo, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export interface AgendaItem {
  id: string;
  titulo: string;
  tipo: string;
  data: string; // yyyy-MM-dd or ISO
  color: string;
  source: "compromisso" | "followup";
}

interface Props {
  items: AgendaItem[];
  currentMonth: Date;
  setCurrentMonth: (d: Date) => void;
  selectedDate?: string;
  onSelectDate: (date: string) => void;
}

export function AgendaCalendar({ items, currentMonth, setCurrentMonth, selectedDate, onSelectDate }: Props) {
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

  const getItemsDia = useCallback((date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return items.filter(i => i.data.startsWith(dateStr));
  }, [items]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 rounded-lg hover:bg-secondary transition-colors">
          <ChevronLeft className="w-5 h-5 text-foreground" />
        </button>
        <h2 className="text-lg font-semibold text-foreground capitalize">
          {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
        </h2>
        <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 rounded-lg hover:bg-secondary transition-colors">
          <ChevronRight className="w-5 h-5 text-foreground" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map(d => (
          <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day, i) => {
          const dayItems = getItemsDia(day);
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isTodayDate = isToday(day);
          const dateStr = format(day, "yyyy-MM-dd");
          const isSelected = selectedDate === dateStr;

          return (
            <button
              key={i}
              onClick={() => onSelectDate(dateStr)}
              className={`relative min-h-[80px] p-1.5 rounded-lg border transition-all text-left ${
                isSelected ? "border-primary bg-primary/5" :
                isTodayDate ? "border-primary/50 bg-primary/5" :
                isCurrentMonth ? "border-border hover:border-primary/30 hover:bg-muted/30" :
                "border-transparent opacity-40"
              }`}
            >
              <span className={`text-xs font-medium ${isTodayDate ? "text-primary" : "text-foreground"}`}>
                {format(day, "d")}
              </span>
              <div className="mt-1 space-y-0.5">
                {dayItems.slice(0, 3).map(item => (
                  <div key={item.id} className="flex items-center gap-1 px-1 py-0.5 rounded text-[10px] truncate" style={{ backgroundColor: `${item.color}20`, color: item.color }}>
                    <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="truncate">{item.titulo}</span>
                  </div>
                ))}
                {dayItems.length > 3 && (
                  <span className="text-[10px] text-muted-foreground pl-1">+{dayItems.length - 3} mais</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
