import { Server as HttpServer } from "http";
import { Server, type Socket } from "socket.io";
import { verifyAccessToken, type TokenPayload } from "@/server/auth";
import { PrismaClient } from "@/generated/prisma/client";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketUser,
  IssueUpdatePayload,
  IssueCreatedPayload,
  IssueDeletedPayload,
  CursorMovePayload,
  CommentAddedPayload,
  UserTypingPayload,
  NotificationPayload,
} from "@/server/socket-types";

// ─── Types ────────────────────────────────────────────────────────────────────

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents> & {
  userId: string;
  user: SocketUser;
};

interface AuthData {
  userId: string;
  user: SocketUser;
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let io: Server<ClientToServerEvents, ServerToClientEvents> | null = null;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function projectRoom(projectId: string): string {
  return `project:${projectId}`;
}

function issueRoom(issueId: string): string {
  return `issue:${issueId}`;
}

function parseLabels(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ─── Server Setup ─────────────────────────────────────────────────────────────

export function getSocketServer(): Server<ClientToServerEvents, ServerToClientEvents> | null {
  return io;
}

export function initSocketServer(
  httpServer: HttpServer,
  prisma: PrismaClient,
): Server<ClientToServerEvents, ServerToClientEvents> {
  if (io) return io;

  io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
    pingInterval: 25000,
    pingTimeout: 20000,
    maxHttpBufferSize: 1e6,
  });

  // ── Authentication Middleware ──────────────────────────────────────────────

  io.use(async (socket, next) => {
    try {
      const token =
        (socket.handshake.auth?.token as string) ||
        (socket.handshake.query?.token as string);

      if (!token) {
        return next(new Error("Authentication required"));
      }

      const result = verifyAccessToken(token);
      if (!result.valid || !result.payload) {
        return next(new Error("Invalid or expired token"));
      }

      const payload: TokenPayload = result.payload;

      const dbUser = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { id: true, name: true, email: true, avatar: true },
      });

      if (!dbUser) {
        return next(new Error("User not found"));
      }

      (socket as TypedSocket).userId = dbUser.id;
      (socket as TypedSocket).user = {
        id: dbUser.id,
        name: dbUser.name,
        email: dbUser.email,
        avatar: dbUser.avatar,
      };

      next();
    } catch {
      next(new Error("Authentication failed"));
    }
  });

  // ── Connection Handler ─────────────────────────────────────────────────────

  io.on("connection", (socket) => {
    const typedSocket = socket as unknown as TypedSocket;
    const user = typedSocket.user;
    const userId = typedSocket.userId;

    console.log(`[Socket.IO] User connected: ${user.name} (${userId})`);

    // ── Project Room Management ────────────────────────────────────────────

    typedSocket.on("join-project", async (projectId: string) => {
      const room = projectRoom(projectId);
      typedSocket.join(room);

      // Verify user is a project member
      const membership = await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId } },
      });

      if (!membership) {
        typedSocket.leave(room);
        return;
      }

      // Notify others in the project that this user is online
      typedSocket.to(room).emit("user-online", {
        user,
        projectId,
      });

      // Send the list of currently online users in the project
      const roomSockets = await io!.in(room).fetchSockets();
      const onlineUsers: SocketUser[] = roomSockets
        .map((s) => (s as unknown as TypedSocket).user)
        .filter((u) => u && u.id !== userId);

      // Send full list to the joining user
      typedSocket.emit("online-users", onlineUsers);

      console.log(`[Socket.IO] ${user.name} joined project ${projectId}`);
    });

    typedSocket.on("leave-project", (projectId: string) => {
      const room = projectRoom(projectId);
      typedSocket.leave(room);

      typedSocket.to(room).emit("user-offline", {
        userId,
        projectId,
      });

      console.log(`[Socket.IO] ${user.name} left project ${projectId}`);
    });

    // ── Issue Room Management ──────────────────────────────────────────────

    typedSocket.on("join-issue", async (issueId: string) => {
      const room = issueRoom(issueId);
      typedSocket.join(room);

      // Notify others that this user is editing
      typedSocket.to(room).emit("user-typing", {
        userId,
        userName: user.name,
        issueId,
      });

      // Send the list of current editors
      const roomSockets = await io!.in(room).fetchSockets();
      const editors: SocketUser[] = roomSockets
        .map((s) => (s as unknown as TypedSocket).user)
        .filter((u) => u && u.id !== userId);

      typedSocket.emit("issue-editors", editors);

      console.log(`[Socket.IO] ${user.name} joined issue ${issueId}`);
    });

    typedSocket.on("leave-issue", (issueId: string) => {
      const room = issueRoom(issueId);
      typedSocket.leave(room);
      console.log(`[Socket.IO] ${user.name} left issue ${issueId}`);
    });

    // ── Issue Events ───────────────────────────────────────────────────────

    typedSocket.on("issue-update", (payload: IssueUpdatePayload) => {
      // Broadcast to the project room (except sender)
      const room = projectRoom(payload.projectId);
      typedSocket.to(room).emit("issue-updated", payload);

      // Also broadcast to the issue room if someone is viewing it
      const issueRm = issueRoom(payload.issueId);
      typedSocket.to(issueRm).emit("issue-updated", payload);
    });

    // ── Cursor Movement ────────────────────────────────────────────────────

    typedSocket.on("cursor-move", (payload: CursorMovePayload) => {
      const room = issueRoom(payload.issueId);
      typedSocket.to(room).emit("cursor-moved", {
        ...payload,
        userId,
      });
    });

    // ── Comments ───────────────────────────────────────────────────────────

    typedSocket.on("comment-added", (payload: CommentAddedPayload) => {
      const room = issueRoom(payload.comment.issueId);
      typedSocket.to(room).emit("comment-added", payload);
    });

    // ── Typing Indicator ───────────────────────────────────────────────────

    typedSocket.on("user-typing", (payload: UserTypingPayload) => {
      const room = issueRoom(payload.issueId);
      typedSocket.to(room).emit("user-typing", {
        ...payload,
        userId,
        userName: user.name,
      });
    });

    // ── Disconnect ─────────────────────────────────────────────────────────

    typedSocket.on("disconnect", async (reason) => {
      console.log(`[Socket.IO] User disconnected: ${user.name} (${reason})`);

      // Notify all project rooms this user was in
      for (const room of typedSocket.rooms) {
        if (room.startsWith("project:")) {
          const projectId = room.replace("project:", "");
          typedSocket.to(room).emit("user-offline", {
            userId,
            projectId,
          });
        }
      }
    });
  });

  console.log("[Socket.IO] Server initialized");
  return io;
}

// ─── Helper: Emit to a project room from server-side code ─────────────────────

export function emitToProject(
  projectId: string,
  event: keyof ServerToClientEvents,
  ...args: Parameters<ServerToClientEvents[keyof ServerToClientEvents]>
) {
  if (!io) return;
  io.to(projectRoom(projectId)).emit(event as never, ...args as never);
}

// ─── Helper: Emit to an issue room from server-side code ──────────────────────

export function emitToIssue(
  issueId: string,
  event: keyof ServerToClientEvents,
  ...args: Parameters<ServerToClientEvents[keyof ServerToClientEvents]>
) {
  if (!io) return;
  io.to(issueRoom(issueId)).emit(event as never, ...args as never);
}

// ─── Helper: Send notification to a user across all their sockets ─────────────

export function sendNotificationToUser(
  userId: string,
  notification: NotificationPayload,
) {
  if (!io) return;

  for (const [, socket] of io.sockets.sockets) {
    const typedSocket = socket as unknown as TypedSocket;
    if (typedSocket.userId === userId) {
      typedSocket.emit("notification", notification);
    }
  }
}

