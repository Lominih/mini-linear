import type { IssueStatus, IssuePriority } from "@/generated/prisma/enums";

// ─── User Presence ────────────────────────────────────────────────────────────

export interface SocketUser {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
}

// ─── Issue Events ─────────────────────────────────────────────────────────────

export interface IssueUpdatePayload {
  issueId: string;
  projectId: string;
  changes: Partial<{
    title: string;
    description: string | null;
    status: IssueStatus;
    priority: IssuePriority;
    assigneeId: string | null;
    labels: string[];
    dueDate: string | null;
    sprintId: string | null;
  }>;
  updatedBy: SocketUser;
}

export interface IssueCreatedPayload {
  issue: {
    id: string;
    title: string;
    description: string | null;
    status: IssueStatus;
    priority: IssuePriority;
    assigneeId: string | null;
    reporterId: string;
    projectId: string;
    labels: string[];
    createdAt: string;
    updatedAt: string;
  };
  createdBy: SocketUser;
}

export interface IssueDeletedPayload {
  issueId: string;
  projectId: string;
  deletedBy: SocketUser;
}

// ─── Cursor Events ────────────────────────────────────────────────────────────

export interface CursorMovePayload {
  issueId: string;
  userId: string;
  position: {
    field: "title" | "description";
    offset: number;
    length: number;
  };
}

// ─── Comment Events ───────────────────────────────────────────────────────────

export interface CommentAddedPayload {
  comment: {
    id: string;
    content: string;
    authorId: string;
    issueId: string;
    parentId: string | null;
    createdAt: string;
    updatedAt: string;
  };
  author: SocketUser;
}

// ─── Typing Events ────────────────────────────────────────────────────────────

export interface UserTypingPayload {
  userId: string;
  userName: string;
  issueId: string;
}

// ─── Presence Events ──────────────────────────────────────────────────────────

export interface UserOnlinePayload {
  user: SocketUser;
  projectId: string;
}

export interface UserOfflinePayload {
  userId: string;
  projectId: string;
}

// ─── Notification Events ──────────────────────────────────────────────────────

export interface NotificationPayload {
  id: string;
  type: string;
  message: string;
  link: string | null;
  createdAt: string;
}

// ─── Client-to-Server Events ──────────────────────────────────────────────────

export interface ClientToServerEvents {
  "join-project": (projectId: string) => void;
  "leave-project": (projectId: string) => void;
  "join-issue": (issueId: string) => void;
  "leave-issue": (issueId: string) => void;
  "issue-update": (payload: IssueUpdatePayload) => void;
  "cursor-move": (payload: CursorMovePayload) => void;
  "comment-added": (payload: CommentAddedPayload) => void;
  "user-typing": (payload: UserTypingPayload) => void;
}

// ─── Server-to-Client Events ──────────────────────────────────────────────────

export interface ServerToClientEvents {
  "issue-updated": (payload: IssueUpdatePayload) => void;
  "issue-created": (payload: IssueCreatedPayload) => void;
  "issue-deleted": (payload: IssueDeletedPayload) => void;
  "cursor-moved": (payload: CursorMovePayload) => void;
  "comment-added": (payload: CommentAddedPayload) => void;
  "user-typing": (payload: UserTypingPayload) => void;
  "user-online": (payload: UserOnlinePayload) => void;
  "user-offline": (payload: UserOfflinePayload) => void;
  "notification": (payload: NotificationPayload) => void;
  "online-users": (users: SocketUser[]) => void;
  "issue-editors": (editors: SocketUser[]) => void;
}

