import { useEffect, useState, useMemo } from "react";
import { useNotifications } from "@/contexts/NotificationContext";
import { Bell, Check, Loader2, Trash2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion, AnimatePresence } from "framer-motion";

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "Agora";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}min atrás`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  return `${days}d atrás`;
}

function getGroupLabel(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const notifDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (notifDay.getTime() === today.getTime()) return "Hoje";
  if (notifDay.getTime() === yesterday.getTime()) return "Ontem";
  if (now.getTime() - notifDay.getTime() < 7 * 86400000) return "Esta semana";
  return "Anteriores";
}

export function NotificationPanel() {
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, isLoading, ensureLoaded, markAllRead, clearAll } = useNotifications();

  useEffect(() => {
    if (open) {
      void ensureLoaded();
    }
  }, [open, ensureLoaded]);

  const grouped = useMemo(() => {
    const groups = new Map<string, typeof notifications>();
    const order = ["Hoje", "Ontem", "Esta semana", "Anteriores"];
    notifications.forEach(n => {
      const label = getGroupLabel(n.timestamp);
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label)!.push(n);
    });
    return order.filter(g => groups.has(g)).map(g => ({ label: g, items: groups.get(g)! }));
  }, [notifications]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative w-10 h-10 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
          <Bell className="w-5 h-5" />
          <AnimatePresence>
            {unreadCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center"
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0 bg-card border-border" sideOffset={8}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">Notificações</h3>
            {unreadCount > 0 && (
              <span className="text-[10px] bg-primary/10 text-primary font-bold px-1.5 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-secondary"
              >
                <Check className="w-3 h-3" />
                Marcar lidas
              </button>
            )}
            {notifications.length > 0 && (
              <button
                onClick={clearAll}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors px-2 py-1 rounded-md hover:bg-secondary"
              >
                <Trash2 className="w-3 h-3" />
                Limpar
              </button>
            )}
          </div>
        </div>

        <ScrollArea className="max-h-[400px]">
          {isLoading ? (
            <div className="py-12 text-center">
              <Loader2 className="w-8 h-8 mx-auto mb-2 text-muted-foreground animate-spin" />
              <p className="text-sm text-muted-foreground">Carregando notificações...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-12 text-center">
              <Bell className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Nenhuma notificação</p>
            </div>
          ) : (
            <div>
              {grouped.map((group) => (
                <div key={group.label}>
                  <div className="px-4 py-1.5 bg-muted/50 sticky top-0 z-10">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      {group.label}
                    </span>
                  </div>
                  <div className="divide-y divide-border">
                    {group.items.map((n) => (
                      <motion.div
                        key={n.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={`px-4 py-3 transition-colors ${n.read ? "opacity-60" : "bg-primary/5"}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground">{n.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">{n.description}</p>
                          </div>
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap mt-0.5">
                            {timeAgo(n.timestamp)}
                          </span>
                        </div>
                        {!n.read && (
                          <div className="mt-1 flex items-center gap-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                            <span className="text-[10px] text-primary font-medium">Nova</span>
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
