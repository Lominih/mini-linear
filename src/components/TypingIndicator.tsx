"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  UserTypingPayload,
} from "@/server/socket-types";

// ─── Types ────────────────────────────────────────────────────────────────────

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface TypingUser {
  userId: string;
  userName: string;
}

interface TypingIndicatorProps {
  socket: TypedSocket | null;
  issueId: string;
  currentUserId: string;
  className?: string;
}

const AUTO_HIDE_MS = 3000;

export function TypingIndicator({
  socket,
  issueId,
  currentUserId,
  className = "",
}: TypingIndicatorProps) {
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // ── Listen for typing events ───────────────────────────────────────────────

  useEffect(() => {
    if (!socket) return;

    const handleTyping = (payload: UserTypingPayload) => {
      if (payload.issueId !== issueId) return;
      if (payload.userId === currentUserId) return;

      // Clear existing timer for this user
      const existingTimer = timersRef.current.get(payload.userId);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      // Add user to typing list
      setTypingUsers((prev) => {
        if (prev.some((u) => u.userId === payload.userId)) return prev;
        return [...prev, { userId: payload.userId, userName: payload.userName }];
      });

      // Auto-hide after timeout
      const timer = setTimeout(() => {
        setTypingUsers((prev) =>
          prev.filter((u) => u.userId !== payload.userId),
        );
        timersRef.current.delete(payload.userId);
      }, AUTO_HIDE_MS);

      timersRef.current.set(payload.userId, timer);
    };

    socket.on("user-typing", handleTyping);

    return () => {
      socket.off("user-typing", handleTyping);
      // Cleanup all timers
      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current.clear();
    };
  }, [socket, issueId, currentUserId]);

  // ── Emit typing event ──────────────────────────────────────────────────────

  const emitTyping = useCallback(() => {
    if (!socket) return;

    socket.emit("user-typing", {
      userId: currentUserId,
      userName: "",
      issueId,
    });
  }, [socket, currentUserId, issueId]);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (typingUsers.length === 0) return null;

  const formatMessage = () => {
    if (typingUsers.length === 1) {
      return `${typingUsers[0].userName} is typing...`;
    }
    if (typingUsers.length === 2) {
      return `${typingUsers[0].userName} and ${typingUsers[1].userName} are typing...`;
    }
    return `${typingUsers[0].userName} and ${typingUsers.length - 1} others are typing...`;
  };

  return (
    <div
      className={`flex items-center gap-2 text-sm text-muted-foreground ${className}`}
      role="status"
      aria-live="polite"
    >
      <span className="flex gap-1">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-current animate-bounce [animation-delay:0ms]" />
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-current animate-bounce [animation-delay:150ms]" />
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-current animate-bounce [animation-delay:300ms]" />
      </span>
      <span>{formatMessage()}</span>
    </div>
  );
}

// ── Export hook for triggering typing indicators from input components ─────────

export function useTypingEmitter(
  socket: TypedSocket | null,
  issueId: string,
  currentUserId: string,
) {
  const lastEmitRef = useRef(0);
  const THROTTLE_MS = 1000;

  const emitTyping = useCallback(() => {
    if (!socket || !issueId) return;

    const now = Date.now();
    if (now - lastEmitRef.current < THROTTLE_MS) return;

    lastEmitRef.current = now;

    socket.emit("user-typing", {
      userId: currentUserId,
      userName: "",
      issueId,
    });
  }, [socket, issueId, currentUserId]);

  return { emitTyping };
}
