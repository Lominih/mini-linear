"use client";

import { useEffect, useCallback, useState, useRef } from "react";
import type { Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketUser,
  UserOnlinePayload,
  UserOfflinePayload,
} from "@/server/socket-types";

// ─── Types ────────────────────────────────────────────────────────────────────

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface UseOnlineStatusOptions {
  socket: TypedSocket | null;
  projectId: string | null;
  currentUserId: string;
  enabled?: boolean;
}

interface UseOnlineStatusReturn {
  onlineUsers: SocketUser[];
  isUserOnline: (userId: string) => boolean;
  onlineCount: number;
}

export function useOnlineStatus({
  socket,
  projectId,
  currentUserId,
  enabled = true,
}: UseOnlineStatusOptions): UseOnlineStatusReturn {
  const [onlineUsers, setOnlineUsers] = useState<SocketUser[]>([]);
  const projectIdRef = useRef(projectId);
  projectIdRef.current = projectId;

  // ── Join / Leave Project Room ──────────────────────────────────────────────

  useEffect(() => {
    if (!socket || !projectId || !enabled) return;

    socket.emit("join-project", projectId);

    // Handle initial online users list
    const handleOnlineUsers = (users: SocketUser[]) => {
      setOnlineUsers(users);
    };

    // Handle new user coming online
    const handleUserOnline = (payload: UserOnlinePayload) => {
      if (payload.projectId !== projectIdRef.current) return;
      setOnlineUsers((prev) => {
        if (prev.some((u) => u.id === payload.user.id)) return prev;
        return [...prev, payload.user];
      });
    };

    // Handle user going offline
    const handleUserOffline = (payload: UserOfflinePayload) => {
      if (payload.projectId !== projectIdRef.current) return;
      setOnlineUsers((prev) => prev.filter((u) => u.id !== payload.userId));
    };

    socket.on("online-users", handleOnlineUsers);
    socket.on("user-online", handleUserOnline);
    socket.on("user-offline", handleUserOffline);

    return () => {
      socket.emit("leave-project", projectId);
      socket.off("online-users", handleOnlineUsers);
      socket.off("user-online", handleUserOnline);
      socket.off("user-offline", handleUserOffline);
      setOnlineUsers([]);
    };
  }, [socket, projectId, enabled]);

  const isUserOnline = useCallback(
    (userId: string) => {
      if (userId === currentUserId) return true;
      return onlineUsers.some((u) => u.id === userId);
    },
    [onlineUsers, currentUserId],
  );

  return {
    onlineUsers,
    isUserOnline,
    onlineCount: onlineUsers.length + 1, // +1 for current user
  };
}
