"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import type { Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  IssueUpdatePayload,
  IssueCreatedPayload,
  IssueDeletedPayload,
  SocketUser,
  CursorMovePayload,
} from "@/server/socket-types";
import type { IssueStatus, IssuePriority } from "@/generated/prisma/enums";

// ─── Types ────────────────────────────────────────────────────────────────────

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export interface RealtimeIssue {
  id: string;
  title: string;
  description: string | null;
  status: IssueStatus;
  priority: IssuePriority;
  assigneeId: string | null;
  reporterId: string;
  projectId: string;
  labels: string[];
  sprintId: string | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
}

interface UseRealtimeIssueOptions {
  socket: TypedSocket | null;
  issue: RealtimeIssue | null;
  userId: string;
  onSave: (changes: Partial<RealtimeIssue>) => Promise<void>;
  enabled?: boolean;
}

interface UseRealtimeIssueReturn {
  localIssue: RealtimeIssue | null;
  editors: SocketUser[];
  isSaving: boolean;
  lastSavedAt: Date | null;
  updateField: <K extends keyof RealtimeIssue>(
    field: K,
    value: RealtimeIssue[K],
  ) => void;
  sendCursorPosition: (
    field: "title" | "description",
    offset: number,
    length: number,
  ) => void;
}

const DEBOUNCE_MS = 300;
const LOCAL_VERSION = "local" as const;

export function useRealtimeIssue({
  socket,
  issue,
  userId,
  onSave,
  enabled = true,
}: UseRealtimeIssueOptions): UseRealtimeIssueReturn {
  const [localIssue, setLocalIssue] = useState<RealtimeIssue | null>(issue);
  const [editors, setEditors] = useState<SocketUser[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const pendingChangesRef = useRef<Partial<RealtimeIssue>>({});
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const issueRef = useRef(issue);
  issueRef.current = issue;

  // Sync local state when the issue prop changes (e.g., initial load)
  useEffect(() => {
    if (issue) {
      setLocalIssue(issue);
    }
  }, [issue?.id, issue?.updatedAt]);

  // ── Join / Leave Issue Room ────────────────────────────────────────────────

  useEffect(() => {
    if (!socket || !issue || !enabled) return;

    socket.emit("join-issue", issue.id);

    const handleEditors = (users: SocketUser[]) => {
      setEditors(users);
    };

    socket.on("issue-editors", handleEditors);

    return () => {
      socket.emit("leave-issue", issue.id);
      socket.off("issue-editors", handleEditors);
      setEditors([]);
    };
  }, [socket, issue?.id, enabled]);

  // ── Listen for Real-time Updates ───────────────────────────────────────────

  useEffect(() => {
    if (!socket || !issue || !enabled) return;

    const handleIssueUpdated = (payload: IssueUpdatePayload) => {
      if (payload.issueId !== issue.id) return;
      if (payload.updatedBy.id === userId) return; // Ignore own updates

      setLocalIssue((prev) => {
        if (!prev) return prev;
        return { ...prev, ...payload.changes, updatedAt: new Date().toISOString() };
      });
    };

    const handleIssueDeleted = (payload: IssueDeletedPayload) => {
      if (payload.issueId !== issue.id) return;
      // The parent component should handle navigation
      setLocalIssue(null);
    };

    socket.on("issue-updated", handleIssueUpdated);
    socket.on("issue-deleted", handleIssueDeleted);

    return () => {
      socket.off("issue-updated", handleIssueUpdated);
      socket.off("issue-deleted", handleIssueDeleted);
    };
  }, [socket, issue?.id, userId, enabled]);

  // ── Debounced Auto-Save ────────────────────────────────────────────────────

  const flushSave = useCallback(async () => {
    const changes = { ...pendingChangesRef.current };
    pendingChangesRef.current = {};

    if (Object.keys(changes).length === 0) return;

    setIsSaving(true);
    try {
      await onSave(changes);
      setLastSavedAt(new Date());
    } catch (error) {
      console.error("[RealtimeIssue] Save failed:", error);
      // Re-merge failed changes back into pending
      pendingChangesRef.current = {
        ...pendingChangesRef.current,
        ...changes,
      };
    } finally {
      setIsSaving(false);
    }
  }, [onSave]);

  const scheduleAutoSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(flushSave, DEBOUNCE_MS);
  }, [flushSave]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // ── Update Field ───────────────────────────────────────────────────────────

  const updateField = useCallback(
    <K extends keyof RealtimeIssue>(field: K, value: RealtimeIssue[K]) => {
      // Optimistic update
      setLocalIssue((prev) => {
        if (!prev) return prev;
        return { ...prev, [field]: value, updatedAt: new Date().toISOString() };
      });

      // Track changes for batched save
      pendingChangesRef.current[field] = value as RealtimeIssue[K];

      // Broadcast change to other editors
      if (socket && issue) {
        socket.emit("issue-update", {
          issueId: issue.id,
          projectId: issue.projectId,
          changes: { [field]: value } as IssueUpdatePayload["changes"],
          updatedBy: {
            id: userId,
            name: "",
            email: "",
            avatar: null,
          },
        });
      }

      // Schedule debounced save
      scheduleAutoSave();
    },
    [socket, issue, userId, scheduleAutoSave],
  );

  // ── Cursor Position ────────────────────────────────────────────────────────

  const sendCursorPosition = useCallback(
    (field: "title" | "description", offset: number, length: number) => {
      if (!socket || !issue) return;

      socket.emit("cursor-move", {
        issueId: issue.id,
        userId,
        position: { field, offset, length },
      });
    },
    [socket, issue, userId],
  );

  return {
    localIssue,
    editors,
    isSaving,
    lastSavedAt,
    updateField,
    sendCursorPosition,
  };
}

