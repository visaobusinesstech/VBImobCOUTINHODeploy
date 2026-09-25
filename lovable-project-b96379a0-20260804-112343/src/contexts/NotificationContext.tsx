import { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Notification {
  id: string;
  title: string;
  description: string;
  timestamp: Date;
  read: boolean;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  addNotification: (title: string, description: string) => Promise<void>;
  pushNotification: (notification: Notification) => void;
  ensureLoaded: () => Promise<void>;
  markAllRead: () => void;
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextType>({
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  addNotification: async () => {},
  pushNotification: () => {},
  ensureLoaded: async () => {},
  markAllRead: () => {},
  clearAll: () => {},
});

export const useNotifications = () => useContext(NotificationContext);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const notificationsRef = useRef(notifications);
  const loadedUserRef = useRef<string | null>(null);
  notificationsRef.current = notifications;

  const pushNotification = useCallback((notification: Notification) => {
    setNotifications((prev) => {
      const withoutDuplicate = prev.filter((n) => n.id !== notification.id);
      return [notification, ...withoutDuplicate].slice(0, 50);
    });
  }, []);

  const ensureLoaded = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      loadedUserRef.current = null;
      return;
    }

    if (loadedUserRef.current === user.id) return;

    setIsLoading(true);

    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, title, description, created_at, read")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      setNotifications(
        (data ?? []).map((n: any) => ({
          id: n.id,
          title: n.title,
          description: n.description,
          timestamp: new Date(n.created_at),
          read: n.read,
        }))
      );

      loadedUserRef.current = user.id;
    } catch (error) {
      console.error("Error loading notifications:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setIsLoading(false);
      loadedUserRef.current = null;
      return;
    }

    const channel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const n = payload.new as any;
          pushNotification({
            id: n.id,
            title: n.title,
            description: n.description,
            timestamp: new Date(n.created_at),
            read: n.read,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, pushNotification]);

  const addNotification = useCallback(
    async (title: string, description: string) => {
      if (!user) return;
      await supabase.from("notifications").insert({
        user_id: user.id,
        title,
        description,
      } as any);
    },
    [user]
  );

  const markAllRead = useCallback(async () => {
    if (!user) return;
    const unreadIds = notificationsRef.current.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;

    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await supabase
      .from("notifications")
      .update({ read: true } as any)
      .in("id", unreadIds);
  }, [user]);

  const clearAll = useCallback(async () => {
    if (!user) return;
    const ids = notificationsRef.current.map((n) => n.id);
    if (ids.length === 0) return;

    setNotifications([]);
    await supabase.from("notifications").delete().in("id", ids);
  }, [user]);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const value = useMemo(
    () => ({ notifications, unreadCount, isLoading, addNotification, pushNotification, ensureLoaded, markAllRead, clearAll }),
    [notifications, unreadCount, isLoading, addNotification, pushNotification, ensureLoaded, markAllRead, clearAll]
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}
