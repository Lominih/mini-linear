"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import type { Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  NotificationPayload,
} from "@/server/socket-types";

// ─── Types ────────────────────────────────────────────────────────────────────

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export interface Notification {
  id: string;
  type: string;
  message: string;
  read: boolean;
  link: string | null;
  createdAt: string;
}

interface UseNotificationsOptions {
  socket: TypedSocket | null;
  userId: string;
  enabled?: boolean;
  pollIntervalMs?: number;
}

interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  refresh: () => void;
}

const DEFAULT_POLL_INTERVAL = 30_000;

export function useNotifications({
  socket,
  userId,
  enabled = true,
  pollIntervalMs = DEFAULT_POLL_INTERVAL,
}: UseNotificationsOptions): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  // ── Fetch notifications from API ───────────────────────────────────────────

  const fetchNotifications = useCallback(async () => {
    if (!enabled) return;
    setIsLoading(true);

    try {
      const response = await fetch("/api/trpc/notification.list?input=" + encodeURIComponent(JSON.stringify({ json: { limit: 50 } })));
      if (!response.ok) throw new Error("Failed to fetch notifications");

      const data = await response.json();
      const items = data?.result?.data?.json?.notifications ?? [];

      if (!mountedRef.current) return;

      setNotifications(items);
      setUnreadCount(items.filter((n: Notification) => !n.read).length);
    } catch (error) {
      console.error("[useNotifications] Failed to fetch:", error);
    } finally {
      setIsLoading(false);
    }
  }, [enabled]);

  const fetchUnreadCount = useCallback(async () => {
    if (!enabled) return;

    try {
      const response = await fetch("/api/trpc/notification.getUnreadCount");
      if (!response.ok) return;

      const data = await response.json();
      const count = data?.result?.data?.json?.count ?? 0;

      if (mountedRef.current) {
        setUnreadCount(count);
      }
    } catch {
      // Silently fail for background count check
    }
  }, [enabled]);

  // ── Polling ────────────────────────────────────────────────────────────────

  useEffect(() => {
    mountedRef.current = true;

    if (!enabled) return;

    // Initial fetch
    fetchNotifications();

    // Set up polling
    pollRef.current = setInterval(fetchUnreadCount, pollIntervalMs);

    return () => {
      mountedRef.current = false;
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [enabled, pollIntervalMs, fetchNotifications, fetchUnreadCount]);

  // ── Socket.IO real-time notifications ──────────────────────────────────────

  useEffect(() => {
    if (!socket || !enabled) return;

    const handleNotification = (payload: NotificationPayload) => {
      const notification: Notification = {
        id: payload.id,
        type: payload.type,
        message: payload.message,
        read: false,
        link: payload.link,
        createdAt: payload.createdAt,
      };

      setNotifications((prev) => [notification, ...prev]);
      setUnreadCount((prev) => prev + 1);
    };

    socket.on("notification", handleNotification);

    return () => {
      socket.off("notification", handleNotification);
    };
  }, [socket, enabled]);

  // ── Mutations ──────────────────────────────────────────────────────────────

  const markAsRead = useCallback(async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    try {
      await fetch("/api/trpc/notification.markRead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ json: { id } }),
      });
    } catch (error) {
      console.error("[useNotifications] Mark read failed:", error);
      // Revert optimistic update on failure
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: false } : n)),
      );
      setUnreadCount((prev) => prev + 1);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    const previousCount = unreadCount;
    setUnreadCount(0);

    try {
      await fetch("/api/trpc/notification.markAllRead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ json: {} }),
      });
    } catch (error) {
      console.error("[useNotifications] Mark all read failed:", error);
      // Revert
      setNotifications((prev) => prev.map((n) => ({ ...n, read: false })));
      setUnreadCount(previousCount);
    }
  }, [unreadCount]);

  const refresh = useCallback(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    refresh,
  };
}
